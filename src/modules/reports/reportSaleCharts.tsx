import React, { useMemo } from "react";

interface SalesReportSummary {
    totalDocuments: number;
    totalAmount: number;
    totalCash: number;
    totalYape: number;
    totalPlin: number;
    totalCard: number;
    totalTransfer: number;
    totalOthers: number;
}

interface IssuedDocument {
    id: string;
    emissionDate: string;
    totalAmount: number;
    billingStatus: string;
    document: {
        code: string;
        description: string;
    };
}

interface ReportSaleChartsProps {
    documents: IssuedDocument[];
    summary: SalesReportSummary | null;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const compactCurrency = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    notation: "compact",
    maximumFractionDigits: 1,
});

const PAYMENT_COLORS: Record<string, string> = {
    Efectivo: "#3b82f6",
    Yape: "#10b981",
    Plin: "#f59e0b",
    Tarjeta: "#f43f5e",
    "Transf.": "#a855f7",
    Otros: "#64748b",
};

const BILLING_STATUS_LABELS: Record<
    string,
    { label: string; color: string }
> = {
    ACCEPTED: { label: "Emitido", color: "#10b981" },
    SENT: { label: "Enviado", color: "#3b82f6" },
    PROCESSING: { label: "Procesando", color: "#f59e0b" },
    REJECTED: { label: "Rechazado", color: "#f43f5e" },
    ERROR: { label: "Error", color: "#ef4444" },
    CANCELLED: { label: "Anulado", color: "#dc2626" },
    PROCESSING_CANCELLATION: { label: "Anulando", color: "#fb7185" },
    CANCELLATION_PENDING: { label: "Anul. pendiente", color: "#f97316" },
    CANCELLATION_ERROR: { label: "Error anulación", color: "#b91c1c" },
};

function formatChartDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    if (!y || !m || !d) return dateStr;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
    });
}

function DonutChart({
    segments,
    size = 200,
}: {
    segments: Array<{ label: string; value: number; color: string }>;
    size?: number;
}) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total <= 0) {
        return (
            <div className="flex h-[200px] items-center justify-center text-sm font-bold text-slate-400">
                Sin datos de pago
            </div>
        );
    }

    const radius = size / 2 - 12;
    const innerRadius = radius * 0.58;
    const cx = size / 2;
    const cy = size / 2;
    let angle = -Math.PI / 2;

    const arcs = segments
        .filter((s) => s.value > 0)
        .map((segment) => {
            const slice = (segment.value / total) * Math.PI * 2;
            const x1 = cx + radius * Math.cos(angle);
            const y1 = cy + radius * Math.sin(angle);
            const x2 = cx + radius * Math.cos(angle + slice);
            const y2 = cy + radius * Math.sin(angle + slice);
            const ix1 = cx + innerRadius * Math.cos(angle + slice);
            const iy1 = cy + innerRadius * Math.sin(angle + slice);
            const ix2 = cx + innerRadius * Math.cos(angle);
            const iy2 = cy + innerRadius * Math.sin(angle);
            const largeArc = slice > Math.PI ? 1 : 0;
            const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
            angle += slice;
            return { ...segment, path, pct: (segment.value / total) * 100 };
        });

    return (
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-center">
            <svg width={size} height={size} className="shrink-0">
                {arcs.map((arc) => (
                    <path
                        key={arc.label}
                        d={arc.path}
                        fill={arc.color}
                        className="transition-opacity hover:opacity-80"
                    />
                ))}
                <circle cx={cx} cy={cy} r={innerRadius - 2} className="fill-white dark:fill-slate-900" />
                <text
                    x={cx}
                    y={cy - 6}
                    textAnchor="middle"
                    className="fill-slate-800 text-[11px] font-black dark:fill-slate-100"
                >
                    {compactCurrency.format(total)}
                </text>
                <text
                    x={cx}
                    y={cy + 12}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9px] font-bold uppercase"
                >
                    Total
                </text>
            </svg>
            <div className="grid w-full max-w-xs grid-cols-1 gap-2">
                {arcs.map((arc) => (
                    <div
                        key={arc.label}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: arc.color }}
                            />
                            <span className="truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                                {arc.label}
                            </span>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-[10px] font-black text-slate-800 dark:text-slate-100">
                                {currencyFormatter.format(arc.value)}
                            </div>
                            <div className="text-[9px] font-bold text-slate-400">
                                {arc.pct.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HorizontalBarChart({
    items,
    valueKey,
    labelKey,
    color = "#6366f1",
    formatValue,
}: {
    items: Array<Record<string, string | number>>;
    valueKey: string;
    labelKey: string;
    color?: string;
    formatValue?: (v: number) => string;
}) {
    const max = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 1);
    const fmt = formatValue || ((v: number) => String(v));

    return (
        <div className="flex flex-col gap-3">
            {items.map((item, idx) => {
                const value = Number(item[valueKey]) || 0;
                const pct = (value / max) * 100;
                return (
                    <div key={idx} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                                {String(item[labelKey])}
                            </span>
                            <span className="shrink-0 text-[10px] font-black text-slate-800 dark:text-slate-100">
                                {fmt(value)}
                            </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: color,
                                    opacity: 1 - idx * 0.08,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function VerticalBarChart({
    items,
}: {
    items: Array<{ label: string; amount: number; count: number }>;
}) {
    const max = Math.max(...items.map((i) => i.amount), 1);
    const chartHeight = 180;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-2 px-1" style={{ height: chartHeight }}>
                {items.map((item) => {
                    const barH = Math.max((item.amount / max) * (chartHeight - 24), 4);
                    return (
                        <div
                            key={item.label}
                            className="group flex flex-1 flex-col items-center justify-end gap-2"
                        >
                            <div className="relative flex w-full max-w-[48px] flex-col items-center justify-end">
                                <span className="mb-1 text-[8px] font-black text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
                                    {compactCurrency.format(item.amount)}
                                </span>
                                <div
                                    className="w-full rounded-t-xl bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all group-hover:from-indigo-700 group-hover:to-indigo-500"
                                    style={{ height: barH }}
                                    title={`${item.label}: ${currencyFormatter.format(item.amount)} (${item.count} docs)`}
                                />
                            </div>
                            <span className="text-center text-[9px] font-bold leading-tight text-slate-500 dark:text-slate-400">
                                {item.label}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => (
                    <div
                        key={`detail-${item.label}`}
                        className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50"
                    >
                        <div className="text-[9px] font-bold uppercase text-slate-400">
                            {item.label}
                        </div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                            {currencyFormatter.format(item.amount)}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400">
                            {item.count} documento{item.count !== 1 ? "s" : ""}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const ReportSaleCharts: React.FC<ReportSaleChartsProps> = ({
    documents,
    summary,
}) => {
    const dailySales = useMemo(() => {
        const map = new Map<string, { amount: number; count: number }>();
        for (const doc of documents) {
            const date = doc.emissionDate;
            const prev = map.get(date) || { amount: 0, count: 0 };
            map.set(date, {
                amount: prev.amount + Number(doc.totalAmount || 0),
                count: prev.count + 1,
            });
        }
        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({
                label: formatChartDate(date),
                amount: data.amount,
                count: data.count,
            }));
    }, [documents]);

    const byDocumentType = useMemo(() => {
        const map = new Map<
            string,
            { label: string; amount: number; count: number }
        >();
        for (const doc of documents) {
            const key = doc.document.code;
            const prev = map.get(key) || {
                label: doc.document.description,
                amount: 0,
                count: 0,
            };
            map.set(key, {
                label: prev.label,
                amount: prev.amount + Number(doc.totalAmount || 0),
                count: prev.count + 1,
            });
        }
        return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    }, [documents]);

    const byBillingStatus = useMemo(() => {
        const map = new Map<string, number>();
        for (const doc of documents) {
            const status = doc.billingStatus?.toUpperCase?.() || "OTRO";
            map.set(status, (map.get(status) || 0) + 1);
        }
        return Array.from(map.entries())
            .map(([status, count]) => ({
                status,
                label:
                    BILLING_STATUS_LABELS[status]?.label || status,
                color:
                    BILLING_STATUS_LABELS[status]?.color || "#94a3b8",
                count,
            }))
            .sort((a, b) => b.count - a.count);
    }, [documents]);

    const paymentSegments = useMemo(() => {
        if (!summary) return [];
        return [
            { label: "Efectivo", value: summary.totalCash, color: PAYMENT_COLORS.Efectivo },
            { label: "Yape", value: summary.totalYape, color: PAYMENT_COLORS.Yape },
            { label: "Plin", value: summary.totalPlin, color: PAYMENT_COLORS.Plin },
            { label: "Tarjeta", value: summary.totalCard, color: PAYMENT_COLORS.Tarjeta },
            { label: "Transf.", value: summary.totalTransfer, color: PAYMENT_COLORS["Transf."] },
            { label: "Otros", value: summary.totalOthers, color: PAYMENT_COLORS.Otros },
        ].filter((s) => s.value > 0);
    }, [summary]);

    if (!documents.length) {
        return (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <h3 className="text-lg font-black text-slate-700 dark:text-slate-200">
                    Sin datos para graficar
                </h3>
                <p className="mt-1 max-w-sm text-sm font-bold text-slate-400">
                    Ajusta el rango de fechas o el tipo de documento para ver los gráficos de ventas.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                Ventas por Día
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400">
                                Monto facturado por fecha de emisión
                            </p>
                        </div>
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {dailySales.length} día{dailySales.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    {dailySales.length > 0 ? (
                        <VerticalBarChart items={dailySales} />
                    ) : (
                        <p className="text-sm font-bold text-slate-400">Sin ventas en el período</p>
                    )}
                </div>

                <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                    <div className="mb-6">
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                            Métodos de Pago
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400">
                            Distribución de cobros en el período
                        </p>
                    </div>
                    <DonutChart segments={paymentSegments} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                    <div className="mb-6">
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                            Ventas por Tipo de Documento
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400">
                            Boletas, facturas, cuentas y otros comprobantes
                        </p>
                    </div>
                    <HorizontalBarChart
                        items={byDocumentType.map((d) => ({
                            label: d.label,
                            amount: d.amount,
                            count: d.count,
                        }))}
                        valueKey="amount"
                        labelKey="label"
                        color="#10b981"
                        formatValue={(v) => currencyFormatter.format(v)}
                    />
                </div>

                <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                    <div className="mb-6">
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                            Estado de Comprobantes
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400">
                            Cantidad por estado de facturación SUNAT
                        </p>
                    </div>
                    <HorizontalBarChart
                        items={byBillingStatus.map((s) => ({
                            label: s.label,
                            count: s.count,
                        }))}
                        valueKey="count"
                        labelKey="label"
                        color="#6366f1"
                        formatValue={(v) => `${v} doc${v !== 1 ? "s" : ""}`}
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                        {byBillingStatus.map((s) => (
                            <span
                                key={s.status}
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300"
                                style={{ backgroundColor: `${s.color}18` }}
                            >
                                <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: s.color }}
                                />
                                {s.label}: {s.count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportSaleCharts;
