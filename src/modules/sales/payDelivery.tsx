import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import ClientSearchBar, {
    type EditClientForModal,
} from '../../components/ClientSearchBar';

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
    { value: 'RAPPI', label: 'Rappi' },
    { value: 'PEDIDO_YA', label: 'Pedido Ya' },
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

export type { EditClientForModal };

export type PayDeliveryModalProps = {
    isOpen: boolean;
    onClose: () => void;
    cartTotal: number;
    subtotal: number;
    igvAmount: number;
    igvPercentage: number;
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
    onOpenCreateClient: () => void;
    onOpenEditClient: () => void;
    showCreateClientModal: boolean;
    onCloseCreateClientModal: () => void;
    onCreateClientSuccess: (clientId: string) => void;
    showEditClientModal: boolean;
    editClientForModal: EditClientForModal | null;
    onCloseEditClientModal: () => void;
    onEditClientSuccess: () => void;
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
    subtotal,
    igvAmount,
    igvPercentage,
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
    onOpenCreateClient,
    onOpenEditClient,
    showCreateClientModal,
    onCloseCreateClientModal,
    onCreateClientSuccess,
    showEditClientModal,
    editClientForModal,
    onCloseEditClientModal,
    onEditClientSuccess,
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

    return (
        <>
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950"
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
                        <ClientSearchBar
                            variant="default"
                            label="Cliente (opcional)"
                            searchTerm={personSearchTerm}
                            onSearchTermChange={(value) => {
                                setPersonSearchTerm(value);
                                setSelectedPerson(null);
                            }}
                            selectedClient={selectedPerson}
                            onSelectClient={(client) => {
                                setSelectedPerson(client);
                                setPersonSearchTerm(client.name);
                            }}
                            onClearClient={() => {
                                setSelectedPerson(null);
                                setPersonSearchTerm('');
                            }}
                            filteredClients={filteredClients}
                            clientsLoading={clientsLoading}
                            sunatSearchLoading={sunatSearchLoading}
                            disabled={isSaving}
                            isFactura={isFactura}
                            onSearchSunat={onSearchSunat}
                            onOpenCreateClient={onOpenCreateClient}
                            onOpenEditClient={onOpenEditClient}
                            showCreateClientModal={showCreateClientModal}
                            onCloseCreateClientModal={onCloseCreateClientModal}
                            onCreateClientSuccess={onCreateClientSuccess}
                            showEditClientModal={showEditClientModal}
                            editClientForModal={editClientForModal}
                            onCloseEditClientModal={onCloseEditClientModal}
                            onEditClientSuccess={onEditClientSuccess}
                            onInvalidSunatSearch={() =>
                                showToast(
                                    'Ingrese DNI (8 dígitos) o RUC (11 dígitos) y pulse la lupa para buscar en SUNAT.',
                                    'warning',
                                )
                            }
                        />

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
                            <div className="mb-2 flex justify-between text-[11px] font-semibold text-indigo-800/80 dark:text-indigo-200/80">
                                <span>Subtotal</span>
                                <span>S/ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="mb-3 flex justify-between text-[11px] font-semibold text-indigo-800/80 dark:text-indigo-200/80">
                                <span>IGV ({igvPercentage}%)</span>
                                <span>S/ {igvAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-indigo-200/70 pt-3 dark:border-indigo-800/50">
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

        </>
    );
};

export default PayDeliveryModal;
