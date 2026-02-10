import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_DOCUMENTS, GET_SERIALS_BY_DOCUMENT, GET_PERSONS_BY_BRANCH, GET_REISSUEABLE_ITEMS } from '../../graphql/queries';
import { CREATE_ISSUED_DOCUMENT_FROM_ANNULLED } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';

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

    // Queries
    const { data: documentsData } = useQuery(GET_DOCUMENTS, {
        variables: { branchId: branchId! },
        skip: !branchId
    });

    const { data: serialsData } = useQuery(GET_SERIALS_BY_DOCUMENT, {
        variables: { documentId: targetDocumentId },
        skip: !targetDocumentId
    });

    const { data: clientsData } = useQuery(GET_PERSONS_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId
    });

    const { data: itemsData, loading: itemsLoading } = useQuery(GET_REISSUEABLE_ITEMS, {
        variables: { annulledDocumentId: annulledDocument?.id },
        skip: !annulledDocument?.id
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

    // Filtered lists
    const targetDocuments = useMemo(() => {
        return (documentsData?.documentsByBranch || []).filter((doc: any) =>
            ['01', '03'].includes(doc.code) && doc.isActive
        );
    }, [documentsData]);

    const filteredClients = useMemo(() => {
        const clients = clientsData?.personsByBranch || [];
        if (!clientSearchTerm) return clients.slice(0, 50); // Limit results
        const lower = clientSearchTerm.toLowerCase();
        return clients.filter((c: any) =>
            c.name.toLowerCase().includes(lower) ||
            c.documentNumber?.includes(lower)
        ).slice(0, 50);
    }, [clientsData, clientSearchTerm]);

    const reissueableItems = itemsData?.reissueableItems || [];

    // Totals Calculation
    const totals = useMemo(() => {
        let totalAmount = 0;
        let totalTaxable = 0;
        let igvAmount = 0;
        let totalDiscount = 0;

        reissueableItems.forEach((item: any) => {
            const q = item.remainingQuantity;
            if (q > 0) {
                totalAmount += q * item.unitPrice;
                totalTaxable += q * item.unitValue;
                igvAmount += q * (item.unitPrice - item.unitValue);
                totalDiscount += q * (item.discount || 0);
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
    }, [reissueableItems]);

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

        if (reissueableItems.length === 0) {
            setError('No hay items disponibles para convertir');
            return;
        }

        try {
            const formattedItems = reissueableItems.map((item: any) => ({
                operationDetailId: item.operationDetailId,
                quantity: item.remainingQuantity,
                unitValue: item.unitValue,
                unitPrice: item.unitPrice,
                discount: item.discount,
                notes: '' // Optional
            })).filter((i: any) => i.quantity > 0);

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
                    printerId: null, // Let backend decide or user select? Not required in python mutation
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
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                        Cliente {targetDocumentId && targetDocuments.find((d: any) => d.id === targetDocumentId)?.code === '01' && '(Requerido RUC)'}
                    </label>
                    <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={clientSearchTerm}
                        onChange={e => {
                            setClientSearchTerm(e.target.value);
                            setSelectedClientId(''); // Clear selection when searching
                        }}
                        style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '0.25rem' }}
                    />
                    {clientSearchTerm && !selectedClientId && filteredClients.length > 0 && (
                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            {filteredClients.map((client: any) => (
                                <div
                                    key={client.id}
                                    onClick={() => {
                                        setSelectedClientId(client.id);
                                        setClientSearchTerm(client.name);
                                    }}
                                    style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: 'white' }}
                                >
                                    <div style={{ fontWeight: 500 }}>{client.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{client.documentType}: {client.documentNumber}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {itemsLoading && <div style={{ color: '#64748b' }}>Cargando items...</div>}

                {reissueableItems.length > 0 && (
                    <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Items a convertir:</div>
                        {reissueableItems.map((item: any) => (
                            <div key={item.operationDetailId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                <span>{item.quantity} x {item.productName}</span>
                                <span>S/ {(item.remainingQuantity * item.unitPrice).toFixed(2)}</span>
                            </div>
                        ))}
                        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span>Total:</span>
                            <span>S/ {totals.totalAmount.toFixed(2)}</span>
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
        </div>
    );
};

export default ConvertDocumentModal;
