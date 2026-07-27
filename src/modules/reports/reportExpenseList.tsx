import React, { useState } from "react";
import { ApolloError, useMutation } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { PRINT_PAYMENT } from "../../graphql/mutations";
import { resolveClientDeviceIdForPrint } from "../../utils/deviceIdForPrint";
import { getPaymentMethodLabel } from "../../utils/paymentMethodLabels";
import type { ExpensePayment } from "./reportExpense";

interface ReportExpenseListProps {
    payments: ExpensePayment[];
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

const getExpenseSourceLabel = (payment: ExpensePayment): string => {
    const opType = (payment.operation?.operationType || "").toUpperCase();
    if (opType === "PURCHASE") {
        const order = payment.operation?.order;
        return order != null ? `Compra #${order}` : "Compra";
    }
    if (payment.issuedDocument) {
        return `${payment.issuedDocument.serial}-${payment.issuedDocument.number}`;
    }
    if (payment.operation?.order != null) {
        return `Operación #${payment.operation.order}`;
    }
    return "Manual";
};

const ReportExpenseList: React.FC<ReportExpenseListProps> = ({
    payments,
    loading,
    error,
}) => {
    const { getMacAddress, getDeviceId } = useAuth();
    const [printingId, setPrintingId] = useState<string | null>(null);
    const [printMessage, setPrintMessage] = useState<string | null>(null);
    const [printPaymentMutation] = useMutation(PRINT_PAYMENT);

    const handlePrintPayment = async (
        paymentId: string,
        e: React.MouseEvent,
    ) => {
        e.stopPropagation();
        setPrintingId(paymentId);
        setPrintMessage(null);

        try {
            const resolvedDeviceId = await resolveClientDeviceIdForPrint({
                getMacAddress,
                getDeviceId,
                logPrefix: "[Egreso]",
            });
            if (!resolvedDeviceId?.trim()) {
                throw new Error("No se pudo obtener la MAC de esta PC.");
            }

            const { data } = await printPaymentMutation({
                variables: {
                    paymentId,
                    deviceId: resolvedDeviceId,
                },
            });

            const result = data?.printPayment;
            if (!result?.success) {
                throw new Error(result?.message || "No se pudo imprimir.");
            }

            if (result.printLocally) {
                throw new Error(
                    "Este equipo tiene impresora integrada/USB activa. Desactívela en Configuración → Impresoras por dispositivo para usar impresión en red.",
                );
            }

            setPrintMessage("Comprobante enviado a impresión en red.");
        } catch (err: unknown) {
            const msg =
                err instanceof Error ? err.message : "Error al imprimir.";
            setPrintMessage(msg);
        } finally {
            setPrintingId(null);
            setTimeout(() => setPrintMessage(null), 4000);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-rose-500/30 border-t-rose-500" />
                <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">
                    Cargando egresos...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
                    Error en el reporte
                </h3>
                <p className="max-w-xs text-sm font-bold text-slate-400">
                    {error.message}
                </p>
            </div>
        );
    }

    if (!payments.length) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
                    Sin egresos
                </h3>
                <p className="max-w-xs text-sm font-bold text-slate-400">
                    No se encontraron egresos en el periodo seleccionado.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {printMessage && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
                    {printMessage}
                </div>
            )}

            <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-left text-sm">
                        <thead>
                            <tr className="bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                                <th className="px-5 py-4">Fecha</th>
                                <th className="px-5 py-4">Origen</th>
                                <th className="px-5 py-4">Descripción</th>
                                <th className="px-5 py-4">Método</th>
                                <th className="px-5 py-4">Usuario</th>
                                <th className="px-5 py-4 text-right">Monto</th>
                                <th className="px-5 py-4 text-center">Imprimir</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {payments.map((payment) => (
                                <tr
                                    key={payment.id}
                                    className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                                >
                                    <td className="px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                                        {formatDateTime(payment.paymentDate)}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            {getExpenseSourceLabel(payment)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <p className="max-w-[260px] truncate font-bold text-slate-700 dark:text-slate-200">
                                            {payment.notes || "Egreso"}
                                        </p>
                                        {payment.referenceNumber && (
                                            <p className="mt-1 text-[10px] font-bold text-slate-400">
                                                Ref: {payment.referenceNumber}
                                            </p>
                                        )}
                                        {payment.cashRegister?.name && (
                                            <p className="mt-1 text-[10px] font-bold text-slate-400">
                                                Caja: {payment.cashRegister.name}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-xs font-black text-slate-700 dark:text-slate-200">
                                        {getPaymentMethodLabel(
                                            payment.paymentMethod,
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                                        {payment.user?.fullName || "—"}
                                    </td>
                                    <td className="px-5 py-4 text-right text-sm font-black text-rose-600 dark:text-rose-400">
                                        {currencyFormatter.format(
                                            Number(payment.paidAmount) || 0,
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <button
                                            type="button"
                                            onClick={(e) =>
                                                handlePrintPayment(
                                                    payment.id,
                                                    e,
                                                )
                                            }
                                            disabled={printingId === payment.id}
                                            title="Imprimir egreso"
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition-all hover:bg-rose-600 hover:text-white disabled:opacity-50 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className={`h-4 w-4 ${printingId === payment.id ? "animate-spin" : ""}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                                />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportExpenseList;
