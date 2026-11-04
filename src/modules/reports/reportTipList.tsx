import React from "react";
import { ApolloError } from "@apollo/client";
import { getPaymentMethodLabel } from "../../utils/paymentMethodLabels";
import type { TipPayment, WaiterTipsSummaryRow } from "./reportTip";

interface ReportTipListProps {
    summaryRows: WaiterTipsSummaryRow[];
    payments: TipPayment[];
    loading: boolean;
    error?: ApolloError;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const formatDateTime = (value: string) => {
    const dateObj = new Date(value);
    if (Number.isNaN(dateObj.getTime())) return "—";
    return `${dateObj.toLocaleDateString("es-PE")} ${dateObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;
};

const getTipSourceLabel = (payment: TipPayment): string => {
    if (payment.issuedDocument) {
        return `${payment.issuedDocument.serial}-${payment.issuedDocument.number}`;
    }
    if (payment.operation?.order != null) {
        return `Operación #${payment.operation.order}`;
    }
    return "—";
};

const ReportTipList: React.FC<ReportTipListProps> = ({
    summaryRows,
    payments,
    loading,
    error,
}) => {
    if (loading) {
        return (
            <div className="space-y-3">
                {Array(4)
                    .fill(0)
                    .map((_, i) => (
                        <div
                            key={i}
                            className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/50"
                        />
                    ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-bold text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
                {error.message || "No se pudo cargar el reporte de propinas."}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h3 className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Resumen por mozo
                </h3>
                {summaryRows.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400 dark:border-slate-700">
                        Sin propinas en este periodo
                    </p>
                ) : (
                    <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px] text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                                        <th className="px-4 py-3">Mozo</th>
                                        <th className="px-4 py-3 text-right">
                                            Propinas
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Total
                                        </th>
                                        <th className="px-4 py-3">
                                            Por método
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryRows.map((row) => (
                                        <tr
                                            key={row.waiterId}
                                            className="border-b border-slate-50 last:border-0 dark:border-slate-800/50"
                                        >
                                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">
                                                {row.waiterName || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">
                                                {row.tipCount}
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-amber-600 dark:text-amber-400">
                                                {currencyFormatter.format(
                                                    row.totalAmount || 0,
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                                                {(row.methods || [])
                                                    .map(
                                                        (m) =>
                                                            `${m.methodName || m.methodCode}: ${currencyFormatter.format(m.totalAmount || 0)}`,
                                                    )
                                                    .join(" · ") || "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <h3 className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Detalle de movimientos
                </h3>
                {payments.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400 dark:border-slate-700">
                        Sin movimientos de propina
                    </p>
                ) : (
                    <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Mozo</th>
                                        <th className="px-4 py-3">Documento</th>
                                        <th className="px-4 py-3">Método</th>
                                        <th className="px-4 py-3">Caja</th>
                                        <th className="px-4 py-3 text-right">
                                            Monto
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((payment) => (
                                        <tr
                                            key={payment.id}
                                            className="border-b border-slate-50 last:border-0 dark:border-slate-800/50"
                                        >
                                            <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                                                {formatDateTime(
                                                    payment.paymentDate,
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">
                                                {payment.tipWaiter?.fullName ||
                                                    payment.user?.fullName ||
                                                    "—"}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                                                {getTipSourceLabel(payment)}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                {getPaymentMethodLabel(
                                                    payment.paymentMethod,
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                                                {payment.cashRegister?.name ||
                                                    "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-amber-600 dark:text-amber-400">
                                                {currencyFormatter.format(
                                                    payment.paidAmount || 0,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportTipList;
