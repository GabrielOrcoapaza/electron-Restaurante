import React from "react";
import { useQuery } from "@apollo/client";
import { GET_PAYMENTS_BY_CLOSURE } from "../../graphql/queries";

export interface CashClosureForDetail {
    id: string;
    closureNumber: number;
    closedAt: string;
    totalIncome: number;
    totalExpense: number;
    netTotal: number;
    user: { id: string; fullName: string; role: string };
    cashRegister: { id: string; name: string; cashType: string };
    branch: { id: string; name: string };
}

interface PaymentMovement {
    id: string;
    paymentDate?: string;
    payment_date?: string;
    paidAmount?: number;
    paid_amount?: number;
    transactionType?: string;
    transaction_type?: string;
    paymentMethod?: string;
    payment_method?: string;
    status?: string;
    notes?: string;
    user?: { fullName?: string; full_name?: string };
    operation?: { order?: string };
    issuedDocument?: { serial?: string; number?: string };
    issued_document?: { serial?: string; number?: string };
}

interface CashDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    closure: CashClosureForDetail | null;
    onReprint?: (closure: CashClosureForDetail) => void;
    reprintingClosureId?: string | null;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
        CASH: "Efectivo",
        YAPE: "Yape",
        PLIN: "Plin",
        CARD: "Tarjeta",
        TRANSFER: "Transferencia",
        OTROS: "Otros",
    };
    return labels[method] || method;
};

const getTransactionTypeLabel = (type: string) => {
    return type === "INCOME" ? "Ingreso" : type === "EXPENSE" ? "Egreso" : type;
};

const CashDetailModal: React.FC<CashDetailModalProps> = ({
    isOpen,
    onClose,
    closure,
    onReprint,
    reprintingClosureId,
}) => {
    const { data, loading } = useQuery(GET_PAYMENTS_BY_CLOSURE, {
        variables: { cashClosureId: closure?.id ?? "" },
        skip: !isOpen || !closure?.id,
        fetchPolicy: "network-only",
    });

    const payments: PaymentMovement[] =
        data?.paymentsByClosure ?? data?.payments_by_closure ?? [];

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString("es-PE", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (!isOpen) return null;

    const totalIncome = closure
        ? Number(
              (closure as any).totalIncome ??
                  (closure as any).total_income ??
                  0,
          )
        : 0;
    const totalExpense = closure
        ? Number(
              (closure as any).totalExpense ??
                  (closure as any).total_expense ??
                  0,
          )
        : 0;
    const netTotal = closure
        ? Number((closure as any).netTotal ?? (closure as any).net_total ?? 0)
        : 0;

    return (
        <div
            className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300 sm:p-6"
            onClick={onClose}
        >
            <div
                className="relative flex h-full max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800/50 dark:bg-slate-800/20">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                            Detalle de Cierre
                        </h3>
                        <span className="text-xs font-mono font-black text-indigo-500 dark:text-indigo-400">
                            #{closure?.closureNumber ?? "—"}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {onReprint && closure && (
                            <button
                                type="button"
                                onClick={() => onReprint(closure)}
                                disabled={reprintingClosureId === closure.id}
                                className="hidden items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 sm:flex"
                            >
                                {reprintingClosureId === closure.id ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                )}
                                <span>Ticket</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                    {closure && (
                        <div className="flex flex-col gap-8">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/40">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Información General</span>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-slate-500">Caja:</span>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{closure.cashRegister.name}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-slate-500">Responsable:</span>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{closure.user.fullName}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-slate-500">Fecha Cierre:</span>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(closure.closedAt)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/40">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Balance de Efectivo</span>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500">Total Ingresos:</span>
                                            <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">{currencyFormatter.format(totalIncome)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-rose-600 dark:text-rose-500">Total Egresos:</span>
                                            <span className="text-sm font-black text-rose-700 dark:text-rose-400">{currencyFormatter.format(totalExpense)}</span>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between border-t border-slate-50 pt-2 dark:border-slate-800/50">
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Saldo Neto:</span>
                                            <span className={`text-base font-black ${netTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {currencyFormatter.format(netTotal)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="hidden flex-col gap-4 rounded-3xl border border-indigo-100 bg-indigo-50/30 p-6 shadow-sm dark:border-indigo-900/30 dark:bg-indigo-900/10 lg:flex">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Resumen Rápido</span>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                                                {payments.length}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase text-indigo-500/70">Movimientos Registrados</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {onReprint && (
                                                <button
                                                    onClick={() => onReprint(closure)}
                                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-2 text-[10px] font-black uppercase tracking-wider text-indigo-600 shadow-sm transition-all hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-slate-700"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                    </svg>
                                                    Imprimir
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen por método de pago */}
                            {!loading && payments.length > 0 && (
                                <div className="flex flex-col gap-4">
                                    <h4 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Distribución por Método</h4>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                                        {(["CASH", "CARD", "YAPE", "PLIN", "TRANSFER", "OTROS"] as const).map((method) => {
                                            const total = payments.reduce((acc, mov) => {
                                                const movMethod = mov.paymentMethod ?? mov.payment_method ?? "";
                                                if (movMethod !== method) return acc;
                                                const amount = Number(mov.paidAmount ?? mov.paid_amount ?? 0);
                                                const type = mov.transactionType ?? mov.transaction_type ?? "";
                                                return type === "INCOME" ? acc + amount : acc - amount;
                                            }, 0);
                                            if (total === 0) return null;
                                            return (
                                                <div key={method} className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-center dark:border-slate-800 dark:bg-slate-800/20">
                                                    <span className="text-[10px] font-bold text-slate-400">{getPaymentMethodLabel(method)}</span>
                                                    <span className={`text-sm font-black ${total >= 0 ? 'text-slate-700 dark:text-slate-200' : 'text-rose-600'}`}>
                                                        {currencyFormatter.format(total)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Tabla de movimientos */}
                            <div className="flex flex-col gap-4">
                                <h4 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Historial de Movimientos</h4>
                                <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
                                            <p className="text-xs font-bold uppercase tracking-widest">Cargando movimientos...</p>
                                        </div>
                                    ) : payments.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="mb-4 h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-sm font-bold uppercase tracking-widest">No hay movimientos</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                                                        <th className="px-6 py-4">Fecha/Hora</th>
                                                        <th className="px-6 py-4 text-center">Tipo</th>
                                                        <th className="px-6 py-4 text-center">Método</th>
                                                        <th className="px-6 py-4 text-right">Monto</th>
                                                        <th className="px-6 py-4">Referencia / Notas</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                    {payments.map((mov) => (
                                                        <tr key={mov.id} className="transition-colors hover:bg-slate-50/30 dark:hover:bg-slate-800/20">
                                                            <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-600 dark:text-slate-400">
                                                                {mov.paymentDate || mov.payment_date ? formatDate(mov.paymentDate || mov.payment_date!) : "—"}
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                                                                    (mov.transactionType || mov.transaction_type) === "INCOME"
                                                                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                                        : "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                                                                }`}>
                                                                    <div className={`h-1 w-1 rounded-full ${(mov.transactionType || mov.transaction_type) === "INCOME" ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                                    {getTransactionTypeLabel(mov.transactionType || mov.transaction_type || "")}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                                                    {getPaymentMethodLabel(mov.paymentMethod || mov.payment_method || "")}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className={`text-sm font-black ${(mov.transactionType || mov.transaction_type) === "INCOME" ? 'text-slate-800 dark:text-slate-100' : 'text-rose-600'}`}>
                                                                    {currencyFormatter.format(Number(mov.paidAmount || mov.paid_amount || 0))}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                                                        {mov.operation?.order ? `Pedido #${mov.operation.order}` : 
                                                                         mov.issuedDocument?.number ? `Doc: ${mov.issuedDocument.serial}-${mov.issuedDocument.number}` : 
                                                                         mov.issued_document?.number ? `Doc: ${mov.issued_document.serial}-${mov.issued_document.number}` :
                                                                         "Movimiento Manual"}
                                                                    </span>
                                                                    {mov.notes && (
                                                                        <span className="text-[10px] font-medium text-slate-400">
                                                                            {mov.notes}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CashDetailModal;
