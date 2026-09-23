/** Totales por método de pago del summary de salesReport (backend Django). */
export interface SalesReportPaymentSummary {
    totalCash: number;
    totalYape: number;
    totalPlin: number;
    totalCard: number;
    totalTransfer: number;
    totalRappi: number;
    totalPedidoYa: number;
    totalLlamaFood: number;
    totalCredito: number;
    totalOthers: number;
}

export type SalesReportPaymentSummaryKey = keyof SalesReportPaymentSummary;

export interface SalesReportPaymentSummaryItem {
    key: SalesReportPaymentSummaryKey;
    label: string;
    color: string;
    bg: string;
    chartColor: string;
}

/** Alineado con SalesReportSummaryType y PAYMENT_METHODS en backend (sumaq). */
export const SALES_REPORT_PAYMENT_SUMMARY_ITEMS: SalesReportPaymentSummaryItem[] =
    [
        {
            key: "totalCash",
            label: "Efectivo",
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            chartColor: "#3b82f6",
        },
        {
            key: "totalYape",
            label: "Yape",
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
            chartColor: "#10b981",
        },
        {
            key: "totalPlin",
            label: "Plin",
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20",
            chartColor: "#f59e0b",
        },
        {
            key: "totalCard",
            label: "Tarjeta",
            color: "text-rose-600",
            bg: "bg-rose-50 dark:bg-rose-900/20",
            chartColor: "#f43f5e",
        },
        {
            key: "totalTransfer",
            label: "Transf.",
            color: "text-purple-600",
            bg: "bg-purple-50 dark:bg-purple-900/20",
            chartColor: "#a855f7",
        },
        {
            key: "totalRappi",
            label: "Rappi",
            color: "text-orange-600",
            bg: "bg-orange-50 dark:bg-orange-900/20",
            chartColor: "#f97316",
        },
        {
            key: "totalPedidoYa",
            label: "Pedido Ya",
            color: "text-pink-600",
            bg: "bg-pink-50 dark:bg-pink-900/20",
            chartColor: "#ec4899",
        },
        {
            key: "totalLlamaFood",
            label: "LlamaFood",
            color: "text-fuchsia-600",
            bg: "bg-fuchsia-50 dark:bg-fuchsia-900/20",
            chartColor: "#d946ef",
        },
        {
            key: "totalCredito",
            label: "Crédito (pend.)",
            color: "text-yellow-600",
            bg: "bg-yellow-50 dark:bg-yellow-900/20",
            chartColor: "#eab308",
        },
        {
            key: "totalOthers",
            label: "Otros",
            color: "text-slate-600",
            bg: "bg-slate-50 dark:bg-slate-800/30",
            chartColor: "#64748b",
        },
    ];

export function getUsedSalesReportPaymentMethods(
    summary: SalesReportPaymentSummary | null | undefined,
): Array<SalesReportPaymentSummaryItem & { amount: number }> {
    if (!summary) return [];

    return SALES_REPORT_PAYMENT_SUMMARY_ITEMS.map((item) => ({
        ...item,
        amount: Number(summary[item.key] ?? 0),
    })).filter((item) => item.amount > 0);
}
