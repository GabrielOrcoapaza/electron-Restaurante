import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { GET_PAYMENTS_BY_DATE_RANGE } from "../../graphql/queries";
import {
    PRINT_CLOSURE_EXPENSES,
    PRINT_PAYMENT,
} from "../../graphql/mutations";
import ReportExpenseList from "./reportExpenseList";
import {
    formatLocalDateYYYYMMDD,
} from "../../utils/localDateTime";
import { getPaymentMethodLabel } from "../../utils/paymentMethodLabels";
import { resolveClientDeviceIdForPrint } from "../../utils/deviceIdForPrint";
import ReportExportExcelButton from "../../components/ReportExportExcelButton";
import { useToast } from "../../context/ToastContext";
import { downloadExpenseReport } from "./reportExcelExports";

export interface ExpensePayment {
    id: string;
    paymentDate: string;
    paidAmount: number;
    transactionType: string;
    paymentMethod: string;
    status: string;
    isActive?: boolean;
    notes?: string | null;
    referenceNumber?: string | null;
    user?: { id: string; fullName: string } | null;
    operation?: {
        id: string;
        order?: string | number | null;
        operationType?: string | null;
    } | null;
    issuedDocument?: {
        id: string;
        serial: string;
        number: string | number;
    } | null;
    cashRegister?: { id: string; name: string } | null;
    cashClosure?: { id: string; closureNumber?: string | number | null } | null;
}

export interface ExpenseReportSummary {
    totalPayments: number;
    totalAmount: number;
    totalCash: number;
    totalYape: number;
    totalPlin: number;
    totalCard: number;
    totalTransfer: number;
    totalRappi: number;
    totalPedidoYa: number;
    totalOthers: number;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const roundMoney2 = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const isCancelledPayment = (status?: string | null): boolean => {
    const normalized = (status ?? "").trim().toUpperCase();
    return (
        normalized === "CANCELLED" ||
        normalized === "CANCELED" ||
        normalized === "ANULLED" ||
        normalized === "VOID"
    );
};

const toRangeStartISO = (date: string) => `${date}T00:00:00`;
const toRangeEndISO = (date: string) => `${date}T23:59:59.999`;

const buildSummary = (payments: ExpensePayment[]): ExpenseReportSummary => {
    const summary: ExpenseReportSummary = {
        totalPayments: payments.length,
        totalAmount: 0,
        totalCash: 0,
        totalYape: 0,
        totalPlin: 0,
        totalCard: 0,
        totalTransfer: 0,
        totalRappi: 0,
        totalPedidoYa: 0,
        totalOthers: 0,
    };

    for (const payment of payments) {
        const amount = roundMoney2(payment.paidAmount);
        summary.totalAmount += amount;
        const method = (payment.paymentMethod || "").toUpperCase();
        if (method === "CASH") summary.totalCash += amount;
        else if (method === "YAPE") summary.totalYape += amount;
        else if (method === "PLIN") summary.totalPlin += amount;
        else if (method === "CARD") summary.totalCard += amount;
        else if (method === "TRANSFER") summary.totalTransfer += amount;
        else if (method === "RAPPI") summary.totalRappi += amount;
        else if (method === "PEDIDO_YA") summary.totalPedidoYa += amount;
        else summary.totalOthers += amount;
    }

    summary.totalAmount = roundMoney2(summary.totalAmount);
    summary.totalCash = roundMoney2(summary.totalCash);
    summary.totalYape = roundMoney2(summary.totalYape);
    summary.totalPlin = roundMoney2(summary.totalPlin);
    summary.totalCard = roundMoney2(summary.totalCard);
    summary.totalTransfer = roundMoney2(summary.totalTransfer);
    summary.totalRappi = roundMoney2(summary.totalRappi);
    summary.totalPedidoYa = roundMoney2(summary.totalPedidoYa);
    summary.totalOthers = roundMoney2(summary.totalOthers);

    return summary;
};

const ReportExpense: React.FC = () => {
    const { companyData, getMacAddress, getDeviceId } = useAuth();
    const { showToast } = useToast();
    const branchId = companyData?.branch?.id;

    const [printClosureExpensesMutation] = useMutation(PRINT_CLOSURE_EXPENSES);
    const [printPaymentMutation] = useMutation(PRINT_PAYMENT);

    const [startDate, setStartDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [endDate, setEndDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("");
    const [printingReport, setPrintingReport] = useState(false);
    const [printMessage, setPrintMessage] = useState<{
        type: "success" | "error" | "warning";
        text: string;
    } | null>(null);

    const { data, loading, error, refetch } = useQuery(
        GET_PAYMENTS_BY_DATE_RANGE,
        {
            variables: {
                branchId: branchId!,
                startDate: toRangeStartISO(startDate),
                endDate: toRangeEndISO(endDate),
            },
            skip: !branchId || !startDate || !endDate,
            fetchPolicy: "network-only",
        },
    );

    const expensePayments = useMemo(() => {
        const rows = (data?.paymentsByDateRange || []) as ExpensePayment[];
        return rows
            .filter(
                (p) =>
                    (p.transactionType || "").toUpperCase() === "EXPENSE" &&
                    (p.status || "").toUpperCase() === "PAID" &&
                    p.isActive !== false &&
                    !isCancelledPayment(p.status),
            )
            .filter((p) =>
                paymentMethodFilter
                    ? (p.paymentMethod || "").toUpperCase() ===
                      paymentMethodFilter
                    : true,
            )
            .sort(
                (a, b) =>
                    new Date(b.paymentDate).getTime() -
                    new Date(a.paymentDate).getTime(),
            );
    }, [data, paymentMethodFilter]);

    const summary = useMemo(
        () => buildSummary(expensePayments),
        [expensePayments],
    );

    const handleExportExcel = async () => {
        if (!expensePayments.length) {
            showToast("No hay egresos para exportar en este periodo.", "warning");
            return;
        }

        try {
            const result = await downloadExpenseReport(expensePayments, summary, {
                startDate,
                endDate,
            });
            showToast(result.message || "Reporte descargado en Excel.", "success");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "No se pudo exportar el reporte.";
            showToast(message, "error");
        }
    };

    const handlePrintReport = async () => {
        if (expensePayments.length === 0) {
            setPrintMessage({
                type: "warning",
                text: "No hay egresos para imprimir en este periodo.",
            });
            setTimeout(() => setPrintMessage(null), 4000);
            return;
        }

        setPrintingReport(true);
        setPrintMessage(null);

        try {
            const resolvedDeviceId = await resolveClientDeviceIdForPrint({
                getMacAddress,
                getDeviceId,
                logPrefix: "[Reporte egresos]",
            });
            if (!resolvedDeviceId?.trim()) {
                throw new Error(
                    "No se pudo obtener la MAC de esta PC.",
                );
            }

            const closureIds = [
                ...new Set(
                    expensePayments
                        .map((p) => p.cashClosure?.id)
                        .filter((id): id is string => Boolean(id)),
                ),
            ];
            const orphanPayments = expensePayments.filter(
                (p) => !p.cashClosure?.id,
            );

            const errors: string[] = [];
            let printedClosures = 0;
            let printedOrphans = 0;

            for (const closureId of closureIds) {
                const { data } = await printClosureExpensesMutation({
                    variables: {
                        closureId,
                        deviceId: resolvedDeviceId,
                    },
                });
                const result = data?.printClosureExpenses;
                if (result?.success && !result.printLocally) {
                    printedClosures += 1;
                } else if (result?.success && result.printLocally) {
                    errors.push(
                        "Este equipo tiene impresora integrada/USB activa. Desactívela en Configuración → Impresoras por dispositivo para usar impresión en red.",
                    );
                } else {
                    errors.push(
                        result?.message ||
                            "No se pudo imprimir el reporte de egresos del cierre.",
                    );
                }
            }

            for (const payment of orphanPayments) {
                const { data } = await printPaymentMutation({
                    variables: {
                        paymentId: payment.id,
                        deviceId: resolvedDeviceId,
                    },
                });
                const result = data?.printPayment;
                if (result?.success && !result.printLocally) {
                    printedOrphans += 1;
                } else if (result?.success && result.printLocally) {
                    errors.push(
                        `Egreso ${payment.id}: impresora integrada/USB activa en este equipo.`,
                    );
                } else {
                    errors.push(
                        result?.message ||
                            `No se pudo imprimir el egreso ${payment.id}.`,
                    );
                }
            }

            if (printedClosures + printedOrphans === 0) {
                throw new Error(
                    errors[0] ||
                        "No se pudo enviar el reporte a la impresora de red.",
                );
            }

            const parts: string[] = [];
            if (printedClosures > 0) {
                parts.push(
                    printedClosures === 1
                        ? "1 reporte de cierre enviado a impresión en red"
                        : `${printedClosures} reportes de cierre enviados a impresión en red`,
                );
            }
            if (printedOrphans > 0) {
                parts.push(
                    printedOrphans === 1
                        ? "1 egreso sin cierre enviado a impresión en red"
                        : `${printedOrphans} egresos sin cierre enviados a impresión en red`,
                );
            }

            setPrintMessage({
                type: errors.length > 0 ? "warning" : "success",
                text:
                    parts.join(". ") +
                    (errors.length > 0 ? `. ${errors[0]}` : "."),
            });
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "No se pudo imprimir el reporte.";
            setPrintMessage({ type: "error", text: msg });
        } finally {
            setPrintingReport(false);
            setTimeout(() => setPrintMessage(null), 5000);
        }
    };

    if (!branchId) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-[32px] bg-white p-8 shadow-sm dark:bg-slate-900">
                <div className="text-center font-bold text-rose-500">
                    No se encontró información de la sucursal activa.
                </div>
            </div>
        );
    }

    const summaryCards = [
        { label: "Total egresos", value: summary.totalAmount, tone: "rose" },
        { label: "Movimientos", value: summary.totalPayments, tone: "slate", isCount: true },
        { label: "Efectivo", value: summary.totalCash, tone: "sky" },
        { label: "Yape", value: summary.totalYape, tone: "emerald" },
        { label: "Plin", value: summary.totalPlin, tone: "amber" },
        { label: "Tarjeta", value: summary.totalCard, tone: "purple" },
    ].filter((card) => card.isCount || Number(card.value) > 0);

    return (
        <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-rose-600 text-white shadow-lg shadow-rose-200 dark:shadow-none">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-7 w-7"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                            Reporte de Egresos
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                            Compras, gastos manuales y salidas de caja
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <ReportExportExcelButton
                        onClick={handleExportExcel}
                        disabled={loading || expensePayments.length === 0}
                    />
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={loading}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        {loading ? "..." : "Actualizar"}
                    </button>
                    <button
                        type="button"
                        onClick={handlePrintReport}
                        disabled={printingReport || loading}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-rose-200 transition-all hover:bg-rose-700 disabled:opacity-50 dark:shadow-none"
                    >
                        {printingReport ? "Imprimiendo..." : "Imprimir reporte"}
                    </button>
                </div>
            </div>

            {printMessage && (
                <div
                    className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                        printMessage.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                            : printMessage.type === "warning"
                              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300"
                              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300"
                    }`}
                >
                    {printMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Desde
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Hasta
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                    />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Método de pago
                    </label>
                    <select
                        value={paymentMethodFilter}
                        onChange={(e) => setPaymentMethodFilter(e.target.value)}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                    >
                        <option value="">Todos los métodos</option>
                        {[
                            "CASH",
                            "YAPE",
                            "PLIN",
                            "CARD",
                            "TRANSFER",
                            "RAPPI",
                            "PEDIDO_YA",
                            "OTROS",
                        ].map((method) => (
                            <option key={method} value={method}>
                                {getPaymentMethodLabel(method)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {summaryCards.map((card) => (
                    <div
                        key={card.label}
                        className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {card.label}
                        </p>
                        <p className="mt-2 text-lg font-black text-slate-800 dark:text-slate-100">
                            {card.isCount
                                ? card.value
                                : currencyFormatter.format(Number(card.value))}
                        </p>
                    </div>
                ))}
            </div>

            <ReportExpenseList
                payments={expensePayments}
                loading={loading}
                error={error}
            />
        </div>
    );
};

export default ReportExpense;
