import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { GET_DOCUMENTS, GET_SERIALS_BY_DOCUMENT, GET_PERSONS_BY_BRANCH, GET_REISSUEABLE_ITEMS, SEARCH_PERSON_BY_DOCUMENT } from '../../graphql/queries';
import { CREATE_ISSUED_DOCUMENT_FROM_ANNULLED, CREATE_PERSON } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import CreateClient from '../user/createClient';
import EditClient from '../user/editClient';

interface ConvertDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    annulledDocument: any;
    onSuccess: () => void;
}

const ConvertDocumentModal: React.FC<ConvertDocumentModalProps> = ({
    isOpen,
    onClose,
    annulledDocument,
    onSuccess
}) => {
    const { companyData, user, deviceId, getMacAddress } = useAuth();
    const branchId = companyData?.branch?.id;

    const [targetDocumentId, setTargetDocumentId] = useState('');
    const [targetSerial, setTargetSerial] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [showCreateClientModal, setShowCreateClientModal] = useState(false);
    const [showEditClientModal, setShowEditClientModal] = useState(false);
    const { showToast } = useToast();

    // Queries
    const { data: documentsData } = useQuery(GET_DOCUMENTS, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: 'network-only'
    });

    const { data: serialsData } = useQuery(GET_SERIALS_BY_DOCUMENT, {
        variables: { documentId: targetDocumentId },
        skip: !targetDocumentId,
        fetchPolicy: 'network-only'
    });

    const { data: clientsData, loading: clientsLoading, refetch: refetchClients } = useQuery(GET_PERSONS_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: 'network-only'
    });

    const [searchPersonByDocument, { loading: sunatSearchLoading }] = useLazyQuery(SEARCH_PERSON_BY_DOCUMENT, {
        fetchPolicy: 'network-only'
    });

    const [createPersonMutation] = useMutation(CREATE_PERSON);

    const { data: itemsData, loading: itemsLoading } = useQuery(GET_REISSUEABLE_ITEMS, {
        variables: { annulledDocumentId: annulledDocument?.id },
        skip: !annulledDocument?.id,
        fetchPolicy: 'network-only'
    });

    const [createDocument, { loading: creating }] = useMutation(CREATE_ISSUED_DOCUMENT_FROM_ANNULLED);

    // Effect to select default serial
    useEffect(() => {
        if (serialsData?.serialsByDocument?.length > 0) {
            setTargetSerial(serialsData.serialsByDocument[0].serial);
        } else {
            setTargetSerial('');
        }
    }, [serialsData]);

    // Effect to populate client search if conversion target matches original
    useEffect(() => {
        if (annulledDocument?.person) {
            // Pre-select client if available (optional, maybe better to let user choose)
            // setSelectedClientId(annulledDocument.person.id);
            // setClientSearchTerm(annulledDocument.person.name);
        }
    }, [annulledDocument]);

    // State for selected items to convert (checkboxes)
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

    // Initialize selected items when data loads - select ALL by default
    useEffect(() => {
        if (itemsData?.reissueableItems) {
            const initial: Record<string, number> = {};
            itemsData.reissueableItems.forEach((item: any) => {
                if (item.remainingQuantity > 0) {
                    initial[item.operationDetailId] = item.remainingQuantity; // Default to max quantity
                }
            });
            setSelectedItems(initial);
        }
    }, [itemsData]);

    const handleItemToggle = (operationDetailId: string, maxQty: number) => {
        setSelectedItems(prev => {
            const next = { ...prev };
            if (next[operationDetailId]) {
                delete next[operationDetailId];
            } else {
                next[operationDetailId] = maxQty;
            }
            return next;
        });
    };

    // Filtered lists
    const targetDocuments = useMemo(() => {
        return (documentsData?.documentsByBranch || []).filter((doc: any) =>
            ['01', '03'].includes(doc.code) && doc.isActive
        );
    }, [documentsData]);

    const isFactura = targetDocumentId && targetDocuments.find((d: any) => d.id === targetDocumentId)?.code === '01';

    const handleSearchSunat = async () => {
        const term = (clientSearchTerm || '').trim().replace(/\s/g, '');
        if (!/^\d+$/.test(term) || !companyData?.branch?.id) return;
        const isRuc = term.length === 11;
        const isDni = term.length === 8;
        if (isFactura && !isRuc) return;
        if (!isRuc && !isDni) return;
        const documentType = isRuc ? 'RUC' : 'DNI';
        try {
            const { data } = await searchPersonByDocument({
                variables: { documentType, documentNumber: term, branchId: companyData.branch.id }
            });
            const result = data?.searchPersonByDocument;
            if (!result?.person) {
                showToast('No se encontró el documento en SUNAT ni en el sistema.', 'error');
                return;
            }
            const person = result.person;
            if (person.id && result.foundLocally) {
                setSelectedClientId(person.id);
                setClientSearchTerm(person.name || '');
                const { data: refetched } = await refetchClients();
                const updated = (refetched?.personsByBranch || []).find((p: any) => p.id === person.id);
                if (updated?.name) setClientSearchTerm(updated.name);
                return;
            }
            // Encontrado en SUNAT (o datos para crear): crear cliente y seleccionar
            const { data: createData } = await createPersonMutation({
                variables: {
                    branchId: companyData.branch.id,
                    documentType: person.documentType || documentType,
                    documentNumber: person.documentNumber || term,
                    name: person.name || (documentType === 'RUC' ? 'Empresa' : 'Cliente'),
                    address: person.address || undefined,
                    phone: person.phone || undefined,
                    email: person.email || undefined,
                    isCustomer: true,
                    isSupplier: false
                }
            });
            if (createData?.createPerson?.success && createData?.createPerson?.person) {
                const newPerson = createData.createPerson.person;
                setSelectedClientId(newPerson.id);
                setClientSearchTerm(newPerson.name || '');
            } else {
                showToast(createData?.createPerson?.message || 'Error al registrar el cliente.', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error al buscar en SUNAT.', 'error');
        }
    };

    const filteredClients = useMemo(() => {
        const clients = (clientsData?.personsByBranch || []).filter((person: any) => !person.isSupplier && person.isActive !== false);
        if (!clientSearchTerm) return clients.slice(0, 50); // Limit results
        const lower = clientSearchTerm.toLowerCase();
        return clients.filter((c: any) => {
            if (isFactura && (c.documentType || '').toUpperCase() !== 'RUC') return false;
            return (c.name || '').toLowerCase().includes(lower) ||
                (c.documentNumber || '').includes(lower);
        }).slice(0, 50);
    }, [clientsData, clientSearchTerm, isFactura]);

    const reissueableItems = itemsData?.reissueableItems || [];

    // Totals Calculation based on SELECTED items
    const totals = useMemo(() => {
        let totalAmount = 0;
        let totalTaxable = 0;
        let igvAmount = 0;
        let totalDiscount = 0;

        reissueableItems.forEach((item: any) => {
            const selectedQty = selectedItems[item.operationDetailId] || 0;
            if (selectedQty > 0) {
                totalAmount += selectedQty * item.unitPrice;
                totalTaxable += selectedQty * item.unitValue;
                igvAmount += selectedQty * (item.unitPrice - item.unitValue);
                totalDiscount += selectedQty * (item.discount || 0);
            }
        });

        return {
            totalAmount: Number(totalAmount.toFixed(2)),
            totalTaxable: Number(totalTaxable.toFixed(2)),
            igvAmount: Number(igvAmount.toFixed(2)),
            totalDiscount: Number(totalDiscount.toFixed(2)),
            // Simplify others for now
            totalUnaffected: 0,
            totalExempt: 0,
            totalFree: 0,
        };
    }, [reissueableItems, selectedItems]);

    const handleCreate = async () => {
        setError(null);
        setSuccessMsg(null);

        const doc = targetDocuments.find((d: any) => d.id === targetDocumentId);
        if (!doc) {
            setError('Seleccione un tipo de documento');
            return;
        }
        if (!targetSerial) {
            setError('Seleccione una serie');
            return;
        }

        if (doc.code === '01') { // Factura requires client
            if (!selectedClientId) {
                setError('Debe seleccionar un cliente para Factura');
                return;
            }
            const client = (clientsData?.personsByBranch || []).find((c: any) => c.id === selectedClientId);
            if (client?.documentType !== 'RUC') {
                setError('El cliente para Factura debe tener RUC');
                return;
            }
        }

        // Validate at least one item selected
        const hasSelection = Object.keys(selectedItems).length > 0;
        if (!hasSelection) {
            setError('Debe seleccionar al menos un producto para convertir');
            return;
        }

        try {
            const formattedItems = reissueableItems.map((item: any) => {
                const qty = selectedItems[item.operationDetailId] || 0;
                if (qty <= 0) return null;

                return {
                    operationDetailId: item.operationDetailId,
                    quantity: qty,
                    unitValue: item.unitValue,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    notes: '' // Optional
                };
            }).filter(Boolean);

            // Obtener MAC del cliente para impresión
            const mac = await getMacAddress();
            const resolvedDeviceId = mac || deviceId;

            const response = await createDocument({
                variables: {
                    parentIssuedDocumentId: annulledDocument.id,
                    branchId: branchId,
                    documentId: targetDocumentId,
                    serial: targetSerial,
                    personId: selectedClientId || null,
                    userId: user?.id,
                    emissionDate: new Date().toISOString().split('T')[0],
                    emissionTime: new Date().toLocaleTimeString('en-US', { hour12: false }), // HH:mm:ss
                    currency: 'PEN', // Default
                    exchangeRate: 1.0,
                    itemsTotalDiscount: totals.totalDiscount,
                    globalDiscount: 0,
                    globalDiscountPercent: 0,
                    totalDiscount: totals.totalDiscount,
                    igvPercent: 18.0,
                    igvAmount: totals.igvAmount,
                    totalTaxable: totals.totalTaxable,
                    totalUnaffected: totals.totalUnaffected,
                    totalExempt: totals.totalExempt,
                    totalFree: totals.totalFree,
                    totalAmount: totals.totalAmount,
                    items: formattedItems,
                    deviceId: resolvedDeviceId, // For printing
                    printerId: null, // Let backend decide or user select?
                    notes: `Conversión desde ${annulledDocument.serial}-${annulledDocument.number}`
                }
            });

            if (response.data?.createIssuedDocumentFromAnnulled?.success) {
                setSuccessMsg(response.data.createIssuedDocumentFromAnnulled.message);
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2000);
            } else {
                setError(response.data?.createIssuedDocumentFromAnnulled?.message || 'Error al crear documento');
            }
        } catch (err: any) {
            setError(err.message || 'Error desconocido');
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <h2 style={{ marginTop: 0, color: '#1e293b' }}>Convertir Documento</h2>

                <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                    Origen: {annulledDocument?.document?.description} {annulledDocument?.serial}-{annulledDocument?.number}
                </div>

                {error && (
                    <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '1rem' }}>
                        {successMsg}
                    </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Tipo de Documento Destino</label>
                    <select
                        value={targetDocumentId}
                        onChange={e => setTargetDocumentId(e.target.value)}
                        style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }}
                    >
                        <option value="">Seleccione...</option>
                        {targetDocuments.map((doc: any) => (
                            <option key={doc.id} value={doc.id}>{doc.description} ({doc.code})</option>
                        ))}
                    </select>
                </div>

                {targetDocumentId && (
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Serie</label>
                        <select
                            value={targetSerial}
                            onChange={e => setTargetSerial(e.target.value)}
                            style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }}
                        >
                            {serialsData?.serialsByDocument?.map((s: any) => (
                                <option key={s.id} value={s.serial}>{s.serial}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Client Selection */}
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ display: 'block', fontWeight: 500 }}>
                            Cliente {isFactura && '(Requerido RUC)'}
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowCreateClientModal(true)}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                + Nuevo
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowEditClientModal(true)}
                                disabled={!selectedClientId}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: selectedClientId ? '#3b82f6' : '#94a3b8',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: selectedClientId ? 'pointer' : 'not-allowed'
                                }}
                            >
                                ✏️ Editar
                            </button>
                        </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex' }}>
                            <input
                                type="text"
                                placeholder={isFactura ? "Buscar por RUC o Razón Social..." : "Buscar por DNI, RUC o Nombre..."}
                                value={clientSearchTerm}
                                onChange={e => {
                                    setClientSearchTerm(e.target.value);
                                    setSelectedClientId('');
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const term = (clientSearchTerm || '').trim().replace(/\s/g, '');
                                        const validDoc = (/^\d{8}$/.test(term) && !isFactura) || /^\d{11}$/.test(term);
                                        if (validDoc) {
                                            handleSearchSunat();
                                        } else {
                                            showToast('Ingrese DNI (8 dígitos) o RUC (11 dígitos) y pulse la lupa', 'warning');
                                        }
                                    }
                                }}
                                disabled={clientsLoading}
                                style={{
                                    flex: 1,
                                    padding: '0.625rem 0.875rem',
                                    borderRadius: '8px 0 0 8px',
                                    border: '1px solid #d1d5db',
                                    borderRight: 'none',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const term = (clientSearchTerm || '').trim().replace(/\s/g, '');
                                    const validDoc = /^\d{8}$/.test(term) && !isFactura || /^\d{11}$/.test(term);
                                    if (validDoc) {
                                        handleSearchSunat();
                                    } else {
                                        showToast('Ingrese DNI (8 dígitos) o RUC (11 dígitos) y pulse la lupa', 'warning');
                                    }
                                }}
                                disabled={clientsLoading || sunatSearchLoading}
                                title="Buscar en SUNAT"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 0.75rem',
                                    border: 'none',
                                    borderRadius: '0 8px 8px 0',
                                    background: sunatSearchLoading ? '#e2e8f0' : '#0d9488',
                                    color: 'white',
                                    cursor: clientsLoading || sunatSearchLoading ? 'not-allowed' : 'pointer',
                                    opacity: clientsLoading || sunatSearchLoading ? 0.7 : 1
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" />
                                </svg>
                            </button>
                        </div>
                        {clientSearchTerm && !selectedClientId && filteredClients.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                marginTop: '0.25rem', maxHeight: '150px', overflowY: 'auto',
                                border: '1px solid #e5e7eb', borderRadius: '8px',
                                backgroundColor: 'white', zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
                            }}>
                                {!isFactura && (
                                    <div
                                        onClick={() => {
                                            setSelectedClientId('');
                                            setClientSearchTerm('');
                                        }}
                                        style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#64748b' }}
                                    >
                                        Sin cliente (Consumidor final)
                                    </div>
                                )}
                                {filteredClients.map((client: any) => (
                                    <div
                                        key={client.id}
                                        onClick={() => {
                                            setSelectedClientId(client.id);
                                            setClientSearchTerm(client.name);
                                        }}
                                        style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}
                                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f7fafc'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                    >
                                        <div style={{ fontWeight: 600 }}>{client.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{client.documentType}: {client.documentNumber}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {clientSearchTerm && !selectedClientId && !clientsLoading && filteredClients.length === 0 && (
                            <div style={{ marginTop: '0.25rem' }}>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>
                                    {isFactura ? 'No hay clientes con RUC' : 'No se encontraron clientes'}
                                </div>
                                {(() => {
                                    const term = (clientSearchTerm || '').trim().replace(/\s/g, '');
                                    const canSearchSunat = /^\d{8}$/.test(term) && !isFactura || /^\d{11}$/.test(term);
                                    return (
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            {canSearchSunat ? (
                                                <button
                                                    type="button"
                                                    onClick={handleSearchSunat}
                                                    disabled={sunatSearchLoading}
                                                    style={{
                                                        padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
                                                        color: '#0f766e', backgroundColor: '#ccfbf1', border: '1px solid #99f6e4',
                                                        borderRadius: '6px', cursor: sunatSearchLoading ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    {sunatSearchLoading ? 'Buscando en SUNAT...' : '🔍 Buscar en SUNAT'}
                                                </button>
                                            ) : (
                                                <span>Ingrese DNI (8 dígitos) o RUC (11 dígitos) y pulse el botón de lupa para traer el cliente desde SUNAT.</span>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>

                {itemsLoading && <div style={{ color: '#64748b' }}>Cargando items...</div>}

                {reissueableItems.length > 0 && (
                    <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Seleccionar productos a convertir:</div>
                        {reissueableItems.map((item: any) => {
                            const isSelected = !!selectedItems[item.operationDetailId];
                            const selectedQty = selectedItems[item.operationDetailId] || 0;
                            const totalForItem = selectedQty * item.unitPrice;

                            return (
                                <div key={item.operationDetailId} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.9rem',
                                    marginBottom: '0.5rem',
                                    padding: '0.5rem',
                                    background: isSelected ? 'white' : 'transparent',
                                    borderRadius: '6px',
                                    border: isSelected ? '1px solid #e2e8f0' : '1px solid transparent'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleItemToggle(item.operationDetailId, item.remainingQuantity)}
                                            style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 500, color: isSelected ? '#1e293b' : '#94a3b8' }}>{item.productName}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                Disponible: {item.remainingQuantity}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ fontWeight: 600, color: isSelected ? '#334155' : '#cbd5e1' }}>
                                        {isSelected ? `${item.remainingQuantity} x ` : ''} S/ {totalForItem.toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}
                        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '1.1rem' }}>
                            <span>Total Nuevo Documento:</span>
                            <span style={{ color: '#059669' }}>S/ {totals.totalAmount.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                        onClick={onClose}
                        disabled={creating}
                        style={{
                            padding: '0.625rem 1rem',
                            background: 'transparent',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: '#64748b'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={creating || itemsLoading}
                        style={{
                            padding: '0.625rem 1.5rem',
                            background: creating ? '#9ca3af' : '#667eea',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: creating ? 'not-allowed' : 'pointer',
                            color: 'white',
                            fontWeight: 600
                        }}
                    >
                        {creating ? 'Convirtiendo...' : 'Convertir'}
                    </button>
                </div>
            </div>
            {/* Modal para crear nuevo cliente */}
            {showCreateClientModal && (
                <CreateClient
                    onSuccess={async (clientId) => {
                        setSelectedClientId(clientId);
                        setShowCreateClientModal(false);
                        const result = await refetchClients();
                        const persons = result.data?.personsByBranch || [];
                        const newClient = persons.find((p: any) => p.id === clientId);
                        if (newClient?.name) setClientSearchTerm(newClient.name);
                    }}
                    onClose={() => setShowCreateClientModal(false)}
                />
            )}

            {/* Modal para editar cliente */}
            {showEditClientModal && selectedClientId && (() => {
                const selectedClient = filteredClients.find((c: any) => c.id === selectedClientId);
                return selectedClient ? (
                    <EditClient
                        client={selectedClient}
                        onSuccess={() => {
                            refetchClients();
                            setShowEditClientModal(false);
                        }}
                        onClose={() => setShowEditClientModal(false)}
                    />
                ) : null;
            })()}
        </div>
    );
};

export default ConvertDocumentModal;
