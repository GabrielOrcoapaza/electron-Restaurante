import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { GET_DOCUMENTS, GET_SERIALS_BY_DOCUMENT, GET_PERSONS_BY_BRANCH, GET_REISSUEABLE_ITEMS, SEARCH_PERSON_BY_DOCUMENT } from '../../graphql/queries';
import { CREATE_ISSUED_DOCUMENT_FROM_ANNULLED, CREATE_PERSON } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import CreateClient from '../user/createClient';
import EditClient from '../user/editClient';
import { formatLocalDateYYYYMMDD, formatLocalTimeHHMMSS } from '../../utils/localDateTime';

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

    // State for selected items to convert (checkboxes)
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

    // Initialize selected items when data loads - select ALL by default
    useEffect(() => {
        if (itemsData?.reissueableItems) {
            const initial: Record<string, number> = {};
            itemsData.reissueableItems.forEach((item: any) => {
                if (item.remainingQuantity > 0) {
                    initial[item.operationDetailId] = item.remainingQuantity;
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
        if (!clientSearchTerm) return clients.slice(0, 50);
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

        if (doc.code === '01') {
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
                    notes: ''
                };
            }).filter(Boolean);

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
                    emissionDate: formatLocalDateYYYYMMDD(),
                    emissionTime: formatLocalTimeHHMMSS(),
                    currency: 'PEN',
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
                    deviceId: resolvedDeviceId,
                    printerId: null,
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl dark:bg-slate-900 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-indigo-600 p-8 text-white flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-black">Convertir Documento</h3>
                    <p className="mt-1 text-sm font-bold opacity-80">
                        Origen: {annulledDocument?.document?.description} {annulledDocument?.serial}-{annulledDocument?.number}
                    </p>
                </div>

                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {error && (
                        <div className="mb-6 p-4 rounded-2xl border border-rose-100 bg-rose-50 text-sm font-bold text-rose-600 dark:border-rose-900/20 dark:bg-rose-900/10">
                            {error}
                        </div>
                    )}
                    {successMsg && (
                        <div className="mb-6 p-4 rounded-2xl border border-emerald-100 bg-emerald-50 text-sm font-bold text-emerald-600 dark:border-emerald-900/20 dark:bg-emerald-900/10">
                            {successMsg}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Documento</label>
                            <select
                                value={targetDocumentId}
                                onChange={e => setTargetDocumentId(e.target.value)}
                                className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                            >
                                <option value="">Seleccione...</option>
                                {targetDocuments.map((doc: any) => (
                                    <option key={doc.id} value={doc.id}>{doc.description} ({doc.code})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Serie Disponible</label>
                            <select
                                value={targetSerial}
                                onChange={e => setTargetSerial(e.target.value)}
                                disabled={!targetDocumentId}
                                className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 disabled:opacity-50"
                            >
                                {serialsData?.serialsByDocument?.map((s: any) => (
                                    <option key={s.id} value={s.serial}>{s.serial}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Client Selection */}
                    <div className="flex flex-col gap-3 mb-8">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Cliente {isFactura && '(Requerido RUC)'}
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateClientModal(true)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all dark:bg-emerald-900/20"
                                >
                                    + Nuevo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowEditClientModal(true)}
                                    disabled={!selectedClientId}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all dark:bg-indigo-900/20 disabled:opacity-30 disabled:hover:bg-indigo-50 disabled:hover:text-indigo-600"
                                >
                                    Editar
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="flex overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
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
                                            handleSearchSunat();
                                        }
                                    }}
                                    className="flex-1 bg-transparent py-3.5 px-4 text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                                />
                                <button
                                    type="button"
                                    onClick={handleSearchSunat}
                                    disabled={clientsLoading || sunatSearchLoading}
                                    className="flex items-center justify-center px-4 bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                                >
                                    {sunatSearchLoading ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {/* Dropdown Results */}
                            {clientSearchTerm && !selectedClientId && (filteredClients.length > 0 || !isFactura) && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 custom-scrollbar">
                                    {!isFactura && (
                                        <div
                                            onClick={() => { setSelectedClientId(''); setClientSearchTerm(''); }}
                                            className="flex cursor-pointer items-center rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border-b border-slate-50 dark:border-slate-800 mb-1"
                                        >
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 mr-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <span className="text-sm font-bold text-slate-500">Consumidor final</span>
                                        </div>
                                    )}
                                    {filteredClients.map((client: any) => (
                                        <div
                                            key={client.id}
                                            onClick={() => { setSelectedClientId(client.id); setClientSearchTerm(client.name); }}
                                            className="flex cursor-pointer items-center rounded-xl p-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all"
                                        >
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 mr-3">
                                                <span className="text-[10px] font-black">{client.documentType}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{client.name}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{client.documentNumber}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Products Selection */}
                    <div className="flex flex-col gap-4 mb-8">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionar Productos</label>
                        {itemsLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {reissueableItems.map((item: any) => {
                                    const isSelected = !!selectedItems[item.operationDetailId];
                                    return (
                                        <div
                                            key={item.operationDetailId}
                                            onClick={() => handleItemToggle(item.operationDetailId, item.remainingQuantity)}
                                            className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                                                isSelected 
                                                ? 'border-indigo-200 bg-indigo-50/30 dark:border-indigo-900/30 dark:bg-indigo-900/10' 
                                                : 'border-slate-100 bg-white hover:border-indigo-100 dark:border-slate-800 dark:bg-slate-900'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all ${
                                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200'
                                                }`}>
                                                    {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${isSelected ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                                                        {item.productName}
                                                    </span>
                                                    <span className="text-[10px] font-black text-slate-400">CANT: {item.remainingQuantity} • P.U: S/ {item.unitPrice.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <span className={`text-sm font-black ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300'}`}>
                                                S/ {(item.remainingQuantity * item.unitPrice).toFixed(2)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Summary & Actions */}
                    <div className="mt-4 flex flex-col gap-6 rounded-[24px] bg-slate-50 p-6 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-700">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Nuevo Documento</span>
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                S/ {totals.totalAmount.toFixed(2)}
                            </span>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={creating}
                                className="flex-1 h-14 rounded-2xl bg-white border border-slate-100 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                            >
                                Regresar
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={creating || itemsLoading}
                                className="flex-[2] h-14 rounded-2xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-50 dark:shadow-none"
                            >
                                {creating ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        <span>Procesando...</span>
                                    </div>
                                ) : (
                                    'Confirmar Conversión'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals for Create/Edit Client */}
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

            {showEditClientModal && selectedClientId && (() => {
                const selectedClient = (clientsData?.personsByBranch || []).find((c: any) => c.id === selectedClientId);
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
