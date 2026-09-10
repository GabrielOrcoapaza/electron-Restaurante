import React from 'react';
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
    { value: 'LLAMA_FOOD', label: 'LlamaFood' },
    // Placeholder temporal: se usa cuando aún no se sabe qué método cobrará el motorizado
    // (plataformas de terceros). Se regulariza luego desde Gestión de Cajas.
    { value: 'CREDITO', label: 'Crédito (pendiente de regularizar)' },
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

type DocAbbrev = 'NV' | 'B' | 'F';

const documentToAbbrev = (doc: any): DocAbbrev => {
    if (doc?.code === '01') return 'F';
    if (doc?.code === '03') return 'B';
    return 'NV';
};

const findDocumentByAbbrev = (
    docs: any[],
    abbrev: DocAbbrev,
): any | undefined => {
    if (abbrev === 'F') return docs.find((d) => d.code === '01');
    if (abbrev === 'B') return docs.find((d) => d.code === '03');
    return (
        docs.find((d) => d.code !== '01' && d.code !== '03') ??
        docs.find((d) =>
            (d.description || '').toUpperCase().includes('NOTA'),
        )
    );
};

/** Etiquetas y colores alineados con cashPay.tsx */
const docTypeButtonLabel = (abbrev: DocAbbrev, doc?: any): string => {
    if (abbrev === 'F') return 'Factura';
    if (abbrev === 'B') return 'Boleta';
    return doc?.description || 'Nota de venta';
};

const docTypeButtonAccent = (abbrev: DocAbbrev): string => {
    if (abbrev === 'F') return '#4f46e5';
    if (abbrev === 'B') return '#059669';
    return '#475569';
};

export type PayDeliveryCheckoutProps = {
    onBack: () => void;
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
    setSelectedSerial: (v: string) => void;
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
    discountAmount: number;
    setDiscountAmount: (v: number) => void;
    discountPercent: number;
    setDiscountPercent: (v: number) => void;
    totalDiscount: number;
    onConfirm: () => void;
};

const ChevronLeft = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
        />
    </svg>
);

const PayDeliveryCheckout: React.FC<PayDeliveryCheckoutProps> = ({
    onBack,
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
    setSelectedSerial,
    paymentLines,
    onAddPayment,
    onRemovePayment,
    onUpdatePayment,
    canAddPayment,
    paymentsCoverDebt,
    totalPaymentsAmount,
    changeDue,
    discountAmount,
    setDiscountAmount,
    discountPercent,
    setDiscountPercent,
    totalDiscount,
    onConfirm,
}) => {
    const pct = Number(discountPercent) || 0;

    const remaining =
        roundMoney2(cartTotal) - roundMoney2(totalPaymentsAmount);
    const confirmDisabled =
        isSaving ||
        (roundMoney2(cartTotal) > 0.01 && !paymentsCoverDebt);

    const selectedDoc = documents.find(
        (d: any) => String(d.id) === String(selectedDocument),
    );
    const docAbbrev: DocAbbrev = selectedDoc
        ? documentToAbbrev(selectedDoc)
        : 'NV';

    const selectDocAbbrev = (abbrev: DocAbbrev) => {
        const doc = findDocumentByAbbrev(documents, abbrev);
        if (doc) {
            setSelectedDocument(doc.id);
            const docSerials = doc.serials || [];
            setSelectedSerial(docSerials[0]?.serial || '');
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mb-4 flex shrink-0 items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={isSaving}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    aria-label="Volver al pedido"
                >
                    <ChevronLeft />
                </button>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Monto a cobrar — {currencyFormatter.format(cartTotal)}
                </h3>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
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

                    <div className="mb-1">
                        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                            Tipo de doc:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {(['NV', 'B', 'F'] as DocAbbrev[]).map((type) => {
                                const doc = findDocumentByAbbrev(documents, type);
                                const isSelected = docAbbrev === type;
                                const accent = docTypeButtonAccent(type);
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => selectDocAbbrev(type)}
                                        disabled={isSaving || !doc}
                                        title={doc?.description}
                                        className={`rounded-md border-2 text-[0.72rem] font-extrabold leading-tight transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30 ${
                                            isSelected
                                                ? ''
                                                : 'bg-white dark:bg-slate-900'
                                        }`}
                                        style={{
                                            flex: '1 1 calc(33.33% - 0.4rem)',
                                            minWidth: '5.5rem',
                                            padding: '0.65rem 0.35rem',
                                            ...(isSelected
                                                ? {
                                                      background: accent,
                                                      borderColor: accent,
                                                      color: '#ffffff',
                                                  }
                                                : {
                                                      borderColor: '#cbd5e1',
                                                      color: accent,
                                                  }),
                                        }}
                                    >
                                        {docTypeButtonLabel(type, doc)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

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

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Dscto (S/)
                            </label>
                            <div
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 transition-all duration-200 ${pct > 0 ? 'bg-slate-50 opacity-40 dark:bg-slate-800/50' : 'border-slate-200 bg-white focus-within:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-indigo-500'}`}
                            >
                                <span className="text-xs font-bold text-slate-400">S/</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={discountAmount || ''}
                                    disabled={pct > 0 || isSaving}
                                    onChange={(e) => {
                                        const v = Math.max(
                                            0,
                                            parseFloat(e.target.value) || 0,
                                        );
                                        setDiscountAmount(v);
                                        if (v > 0) setDiscountPercent(0);
                                    }}
                                    placeholder="0.00"
                                    className="w-full border-none bg-transparent text-xs font-bold text-slate-800 outline-none dark:text-slate-100"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Dscto (%)
                            </label>
                            <div
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 transition-all duration-200 ${(Number(discountAmount) || 0) > 0 ? 'bg-slate-50 opacity-40 dark:bg-slate-800/50' : 'border-slate-200 bg-white focus-within:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-indigo-500'}`}
                            >
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={discountPercent || ''}
                                    disabled={(Number(discountAmount) || 0) > 0 || isSaving}
                                    onChange={(e) => {
                                        const v = Math.max(
                                            0,
                                            Math.min(
                                                100,
                                                parseFloat(e.target.value) || 0,
                                            ),
                                        );
                                        setDiscountPercent(v);
                                        if (v > 0) setDiscountAmount(0);
                                    }}
                                    placeholder="0"
                                    className="w-full border-none bg-transparent text-xs font-bold text-slate-800 outline-none dark:text-slate-100"
                                />
                                <span className="text-xs font-bold text-slate-400">%</span>
                            </div>
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
                        {totalDiscount > 0 && (
                            <div className="mb-3 flex justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span>Descuento</span>
                                <span>- S/ {totalDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between border-t border-indigo-200/70 pt-3 dark:border-indigo-800/50">
                            <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Total a pagar</span>
                            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">S/ {cartTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 shrink-0 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={confirmDisabled}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black uppercase tracking-wider text-white transition-all ${
                        confirmDisabled
                            ? 'cursor-not-allowed bg-slate-300 dark:bg-slate-800'
                            : 'bg-indigo-600 shadow-md shadow-indigo-600/20 hover:bg-indigo-700'
                    }`}
                >
                    {isSaving ? (
                        <>
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            <span>Procesando...</span>
                        </>
                    ) : (
                        'Confirmar venta'
                    )}
                </button>
            </div>
        </div>
    );
};

export default PayDeliveryCheckout;
