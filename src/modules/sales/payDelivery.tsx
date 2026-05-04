import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export type PersonPayment = {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
};

type SerialItem = { id: string; serial: string };

export type DeliveryPaymentLine = {
    id: string;
    method: string;
    amount: number;
    referenceNumber: string;
};

/** Coincide con métodos del backend / cashPay. */
export const SALE_PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: 'CASH', label: 'Efectivo' },
    { value: 'YAPE', label: 'Yape' },
    { value: 'PLIN', label: 'Plin' },
    { value: 'CARD', label: 'Tarjeta' },
    { value: 'TRANSFER', label: 'Transferencia Bancaria' },
    { value: 'OTROS', label: 'Otros' },
];

export const paymentMethodNeedsReference = (method: string): boolean =>
    method === 'YAPE' ||
    method === 'PLIN' ||
    method === 'TRANSFER' ||
    method === 'OTROS';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
});

const roundMoney2 = (n: number): number =>
    Math.round((Number(n) || 0) * 100) / 100;

export type PayDeliveryModalProps = {
    isOpen: boolean;
    onClose: () => void;
    cartTotal: number;
    isFactura: boolean;
    personSearchTerm: string;
    setPersonSearchTerm: (v: string) => void;
    selectedPerson: PersonPayment | null;
    setSelectedPerson: (p: PersonPayment | null) => void;
    filteredClients: any[];
    clientsLoading: boolean;
    sunatSearchLoading: boolean;
    isSaving: boolean;
    onSearchSunat: () => void;
    showToast: (msg: string, type: ToastType) => void;
    documents: any[];
    selectedDocument: string;
    setSelectedDocument: (v: string) => void;
    serials: SerialItem[];
    selectedSerial: string;
    setSelectedSerial: (v: string) => void;
    cashRegisters: any[];
    selectedCashRegister: string;
    setSelectedCashRegister: (v: string) => void;
    paymentLines: DeliveryPaymentLine[];
    onAddPayment: () => void;
    onRemovePayment: (id: string) => void;
    onUpdatePayment: (
        id: string,
        field: keyof DeliveryPaymentLine,
        value: string | number,
    ) => void;
    canAddPayment: boolean;
    paymentsCoverDebt: boolean;
    totalPaymentsAmount: number;
    changeDue: number;
    onConfirm: () => void;
};

const PayDeliveryModal: React.FC<PayDeliveryModalProps> = ({
    isOpen,
    onClose,
    cartTotal,
    isFactura,
    personSearchTerm,
    setPersonSearchTerm,
    selectedPerson,
    setSelectedPerson,
    filteredClients,
    clientsLoading,
    sunatSearchLoading,
    isSaving,
    onSearchSunat,
    showToast,
    documents,
    selectedDocument,
    setSelectedDocument,
    serials,
    selectedSerial,
    setSelectedSerial,
    cashRegisters,
    selectedCashRegister,
    setSelectedCashRegister,
    paymentLines,
    onAddPayment,
    onRemovePayment,
    onUpdatePayment,
    canAddPayment,
    paymentsCoverDebt,
    totalPaymentsAmount,
    changeDue,
    onConfirm,
}) => {
    const { breakpoint } = useResponsive();
    const isMedium = breakpoint === 'md';
    const inputPadding = isMedium ? '0.45rem' : '0.35rem';

    const remaining =
        roundMoney2(cartTotal) - roundMoney2(totalPaymentsAmount);
    const confirmDisabled =
        isSaving ||
        (roundMoney2(cartTotal) > 0.01 && !paymentsCoverDebt);

    if (!isOpen) return null;

    const handleSearchSunatClick = () => {
        const term = (personSearchTerm || '').trim().replace(/\s/g, '');
        const validDoc = (/^\d{8}$/.test(term) && !isFactura) || /^\d{11}$/.test(term);
        if (validDoc) {
            onSearchSunat();
        } else {
            showToast('Ingrese DNI (8 dígitos) o RUC (11 dígitos) y pulse la lupa para buscar en SUNAT.', 'warning');
        }
    };

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Información de Pago
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                        aria-label="Cerrar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Cliente (opcional)
                            </label>
                            <div className="relative">
                                <div className="flex items-stretch gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900">
                                    <input
                                        type="text"
                                        value={personSearchTerm}
                                        onChange={(e) => {
                                            setPersonSearchTerm(e.target.value);
                                            setSelectedPerson(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSearchSunatClick();
                                            }
                                        }}
                                        placeholder={isFactura ? 'Buscar cliente (solo RUC)...' : 'Buscar cliente (DNI/RUC)...'}
                                        disabled={clientsLoading || isSaving}
                                        className="w-full bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none dark:text-slate-100 disabled:cursor-not-allowed"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSearchSunatClick}
                                        disabled={clientsLoading || sunatSearchLoading || isSaving}
                                        title="Buscar en SUNAT"
                                        className={`flex items-center justify-center px-4 transition-all ${
                                            sunatSearchLoading || isSaving
                                                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                                                : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95'
                                        }`}
                                    >
                                        {sunatSearchLoading ? (
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        ) : (
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {personSearchTerm && !selectedPerson && filteredClients.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                                        {!isFactura && (
                                            <div
                                                onClick={() => { setSelectedPerson(null); setPersonSearchTerm(''); }}
                                                className="cursor-pointer border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50"
                                            >
                                                Sin cliente (Consumidor final)
                                            </div>
                                        )}
                                        {filteredClients.map((client: any) => (
                                            <div
                                                key={client.id}
                                                onClick={() => {
                                                    setSelectedPerson({
                                                        id: client.id,
                                                        name: client.name || '',
                                                        documentType: client.documentType || '',
                                                        documentNumber: client.documentNumber || '',
                                                    });
                                                    setPersonSearchTerm(client.name || '');
                                                }}
                                                className="cursor-pointer border-b border-slate-100 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                                            >
                                                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{client.name}</div>
                                                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-500">{client.documentType}: {client.documentNumber}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {personSearchTerm && !selectedPerson && !clientsLoading && filteredClients.length === 0 && (
                                    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50">
                                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-500">
                                            {isFactura ? 'No hay clientes con RUC registrados' : 'No se encontraron clientes registrados'}
                                        </p>
                                        {(() => {
                                            const term = (personSearchTerm || '').trim().replace(/\s/g, '');
                                            const canSearchSunat = (/^\d{8}$/.test(term) && !isFactura) || /^\d{11}$/.test(term);
                                            if (canSearchSunat) {
                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={onSearchSunat}
                                                        disabled={sunatSearchLoading || isSaving}
                                                        className="flex items-center justify-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 transition-all hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:hover:bg-teal-900/30"
                                                    >
                                                        {sunatSearchLoading ? (
                                                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600" />
                                                        ) : '🔍'}
                                                        <span>Buscar en SUNAT</span>
                                                    </button>
                                                );
                                            }
                                            return <p className="text-[10px] leading-tight text-slate-400">Ingrese DNI (8 dígitos) o RUC (11 dígitos) y use la lupa.</p>;
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-5 gap-3">
                            <div className="col-span-3 flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 tracking-tight">Tipo Documento *</label>
                                <select
                                    value={selectedDocument}
                                    onChange={(e) => {
                                        setSelectedDocument(e.target.value);
                                        setSelectedSerial('');
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                >
                                    <option value="...">...</option>
                                    {documents.map((doc: any) => (
                                        <option key={doc.id} value={doc.id}>{doc.description}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2 flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 tracking-tight">Serie *</label>
                                <select
                                    value={selectedSerial}
                                    onChange={(e) => setSelectedSerial(e.target.value)}
                                    disabled={!selectedDocument}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-50"
                                >
                                    <option value="">...</option>
                                    {serials.map((serial: SerialItem) => (
                                        <option key={serial.id} value={serial.serial}>{serial.serial}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 tracking-tight">Caja *</label>
                            <select
                                value={selectedCashRegister}
                                onChange={(e) => setSelectedCashRegister(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                style={{ padding: inputPadding }}
                            >
                                <option value="">Seleccionar...</option>
                                {cashRegisters.map((cashRegister: any) => (
                                    <option key={cashRegister.id} value={cashRegister.id}>{cashRegister.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Multipago (misma idea que cashPay) */}
                        <div className="flex flex-col gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                                    Pagos
                                </span>
                                <button
                                    type="button"
                                    onClick={onAddPayment}
                                    disabled={!canAddPayment || isSaving}
                                    className="rounded-lg border border-indigo-300 bg-white px-2 py-1 text-[11px] font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
                                >
                                    + Pago
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {paymentLines.map((p) => (
                                    <div
                                        key={p.id}
                                        className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                                    >
                                        <div className="mb-2 flex gap-2">
                                            <select
                                                value={p.method}
                                                onChange={(e) =>
                                                    onUpdatePayment(p.id, 'method', e.target.value)}
                                                disabled={isSaving}
                                                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white py-2 pl-2 pr-1 text-xs font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                                            >
                                                {SALE_PAYMENT_METHODS.map(({ value, label }) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                            {paymentLines.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => onRemovePayment(p.id)}
                                                    disabled={isSaving}
                                                    className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm font-black text-red-600 transition-colors hover:bg-red-100 disabled:opacity-40 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
                                                    aria-label="Quitar pago"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">S/</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={p.amount === 0 ? '' : p.amount}
                                                onChange={(e) =>
                                                    onUpdatePayment(
                                                        p.id,
                                                        'amount',
                                                        Number(e.target.value),
                                                    )}
                                                disabled={isSaving}
                                                placeholder="0.00"
                                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                                            />
                                        </div>
                                        {paymentMethodNeedsReference(p.method) && (
                                            <input
                                                type="text"
                                                value={p.referenceNumber}
                                                onChange={(e) =>
                                                    onUpdatePayment(
                                                        p.id,
                                                        'referenceNumber',
                                                        e.target.value,
                                                    )}
                                                disabled={isSaving}
                                                placeholder="Nº operación / referencia"
                                                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-indigo-200/60 pt-2 text-[11px] font-bold text-indigo-900 dark:border-indigo-800/60 dark:text-indigo-200">
                                <span>
                                    Falta: {currencyFormatter.format(Math.max(0, remaining))}
                                </span>
                                {changeDue > 0.005 && (
                                    <span className="text-emerald-700 dark:text-emerald-400">
                                        Vuelto: {currencyFormatter.format(changeDue)}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl bg-indigo-50 p-4 transition-colors dark:bg-indigo-900/20">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Total a pagar</span>
                                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">S/ {cartTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 border-t border-slate-100 p-6 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={confirmDisabled}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg ${
                            confirmDisabled
                                ? 'cursor-not-allowed bg-slate-300 dark:bg-slate-800 shadow-none'
                                : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 active:translate-y-0'
                        }`}
                    >
                        {isSaving ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                <span>Procesando</span>
                            </>
                        ) : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PayDeliveryModal;
