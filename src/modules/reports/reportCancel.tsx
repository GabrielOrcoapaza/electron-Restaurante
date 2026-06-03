import React, { useState } from "react";
import { useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { GET_CANCELLATION_REPORT } from "../../graphql/queries";
import ReportCancelList from "./reportCancelList";
import { formatLocalDateYYYYMMDD } from "../../utils/localDateTime";

export interface CancellationItem {
    id: string;
    type: string;
    operationId: string;
    operationOrder: string;
    detailId?: string;
    productName?: string;
    quantity?: number;
    amount: number;
    reason: string;
    cancelledAt: string;
    user: {
        id: string;
        fullName: string;
    };
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

function formatCancellationReason(
    reason: string | null | undefined,
): string {
    const trimmed = (reason ?? "").trim();
    return trimmed || "No especificado";
}

const ReportCancel: React.FC = () => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;

    const [startDate, setStartDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [endDate, setEndDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [type, setType] = useState<string>("BOTH");

    const { data, loading, error, refetch } = useQuery(
        GET_CANCELLATION_REPORT,
        {
            variables: {
                branchId: branchId!,
                startDate: startDate,
                endDate: endDate,
            },
            skip: !branchId || !startDate || !endDate,
            fetchPolicy: "network-only",
        },
    );

    const { cancellationItems, summary } = React.useMemo(() => {
        if (!data?.cancellationReport?.operations) return { cancellationItems: [], summary: { total: 0, amount: 0, ops: 0, items: 0 } };

        const items: CancellationItem[] = [];
        const operations = data.cancellationReport.operations;
        let totalAmount = 0;
        let opsCount = 0;
        let itemsCount = 0;

        operations.forEach((op: any) => {
            if (op.status === "CANCELLED") {
                opsCount++;
                totalAmount += op.cancelledTotal;
                const opReason =
                    op.cancellationReason?.trim() ||
                    op.cancelledItems?.[0]?.cancellationReason?.trim() ||
                    "";
                items.push({
                    id: op.operationId,
                    type: "OPERATION",
                    operationId: op.operationId,
                    operationOrder: op.order,
                    amount: op.cancelledTotal,
                    reason: formatCancellationReason(opReason),
                    cancelledAt: op.cancelledAt,
                    user: {
                        id: "",
                        fullName: op.cancelledByName || "Sistema",
                    },
                });
            }

            if (op.cancelledItems && op.cancelledItems.length > 0) {
                op.cancelledItems.forEach((item: any) => {
                    itemsCount++;
                    totalAmount += item.total;
                    items.push({
                        id: item.detailId,
                        type: "ITEM",
                        operationId: op.operationId,
                        operationOrder: op.order,
                        detailId: item.detailId,
                        productName: item.productName,
                        quantity: item.quantity,
                        amount: item.total,
                        reason: formatCancellationReason(
                            item.cancellationReason,
                        ),
                        cancelledAt: item.cancelledAt,
                        user: {
                            id: "",
                            fullName: item.cancelledByName || "Sistema",
                        },
                    });
                });
            }
        });

        const filtered = items.filter((item) => {
            if (type === "BOTH") return true;
            if (type === "OPERATIONS") return item.type === "OPERATION";
            if (type === "ITEMS") return item.type === "ITEM";
            return true;
        });

        return { 
            cancellationItems: filtered, 
            summary: { 
                total: items.length, 
                amount: totalAmount, 
                ops: opsCount, 
                items: itemsCount 
            } 
        };
    }, [data, type]);

    if (!branchId) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-[32px] bg-white p-8 shadow-sm dark:bg-slate-900">
                <div className="text-center text-rose-500 font-bold">
                    No se encontró información de la sucursal activa.
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-rose-500 text-white shadow-lg shadow-rose-200 dark:shadow-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                            Reporte de Anulaciones
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                            Control detallado de mermas y cancelaciones
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={loading}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {loading ? "Actualizando" : "Refrescar"}
                </button>
            </div>

            {/* Unified Filter Toolbar */}
            <div className="rounded-[28px] border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desde</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>

                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hasta</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>

                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Anulación</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200 cursor-pointer"
                        >
                            <option value="BOTH">Todas las anulaciones</option>
                            <option value="OPERATIONS">Solo Operaciones (Órdenes)</option>
                            <option value="ITEMS">Solo Productos</option>
                        </select>
                    </div>

                    <div className="flex items-center p-2">
                        <button
                            onClick={() => refetch()}
                            disabled={loading}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-rose-200 transition-all hover:bg-rose-600 hover:shadow-rose-300 disabled:opacity-50 dark:shadow-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Filtrar Reporte
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="relative overflow-hidden rounded-[32px] bg-rose-500 p-6 text-white shadow-lg shadow-rose-200 dark:shadow-none">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Anulaciones</span>
                            <div className="mt-1 text-3xl font-black">{summary.total}</div>
                        </div>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                    </div>

                    <div className="relative overflow-hidden rounded-[32px] bg-slate-800 p-6 text-white shadow-lg shadow-slate-200 dark:shadow-none">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Monto Total Perdido</span>
                            <div className="mt-1 text-3xl font-black">{currencyFormatter.format(summary.amount)}</div>
                        </div>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                    </div>

                    <div className="flex flex-col justify-center gap-1 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desglose de Órdenes</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-rose-500">{summary.ops}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Órdenes completas</span>
                        </div>
                    </div>

                    <div className="flex flex-col justify-center gap-1 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desglose de Productos</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-indigo-500">{summary.items}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Items individuales</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Results List */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Registros de Anulación</h2>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                        {cancellationItems.length} Eventos detectados
                    </span>
                </div>

                <div className="p-4 sm:p-6">
                    {loading ? (
                        <div className="flex min-h-[300px] flex-col gap-4">
                            {Array(5).fill(0).map((_, i) => (
                                <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50" />
                            ))}
                        </div>
                    ) : (
                        <ReportCancelList
                            items={cancellationItems}
                            loading={loading}
                            error={error}
                        />
                    )}
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-900/30 dark:bg-rose-900/10">
                    Error al cargar el reporte: {error.message}
                </div>
            )}
        </div>
    );
};

export default ReportCancel;
