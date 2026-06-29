import React, { useState } from "react";
import { useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { GET_SALES_REPORT, GET_DOCUMENTS } from "../../graphql/queries";
import ReportSaleList from "./reportSaleList";
import { formatLocalDateYYYYMMDD } from "../../utils/localDateTime";

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
    serial: string;
    number: string | number;
    cdrPath?: string | null;
    signedXmlPath?: string | null;
    xmlPath?: string | null;
    sunatOperationId?: string | number | null;
    emissionDate: string;
    emissionTime: string;
    totalAmount: number;
    totalDiscount: number;
    globalDiscount?: number;
    globalDiscountPercent?: number;
    igvAmount: number;
    hashCode?: string | null;
    billingStatus: string;
    notes?: string;
    document: {
        id: string;
        code: string;
        description: string;
    };
    person?: {
        id: string;
        name: string;
        documentNumber: string;
        documentType: string;
    };
    operation?: {
        id: string;
        order: string;
        status: string;
        operationType?: string;
        user?: {
            id: string;
            fullName: string;
        } | null;
        table?: {
            id: string;
            name: string;
            floor?: {
                id: string;
                name: string;
            } | null;
        } | null;
    };
    items: Array<{
        id: string;
        quantity: number;
        unitValue?: number;
        unitPrice: number;
        total: number;
        notes?: string;
        operationDetail?: {
            product: {
                id: string;
                code: string;
                name: string;
            };
        };
    }>;
    payments: Array<{
        id: string;
        paymentMethod: string;
        paidAmount: number;
        paymentDate: string;
        status: string;
        user?: {
            id: string;
            fullName: string;
        } | null;
    }>;
    user: {
        id: string;
        fullName: string;
    };
    branch: {
        id: string;
        name: string;
        igvPercentage?: number;
    };
}

interface SalesReportData {
    documents: IssuedDocument[];
    summary: SalesReportSummary;
}

interface Document {
    id: string;
    code: string;
    description: string;
    isActive: boolean;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const ReportSale: React.FC = () => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;

    const [startDate, setStartDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [endDate, setEndDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");

    const { data: documentsData } = useQuery(GET_DOCUMENTS, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const documentsList: Document[] = documentsData?.documentsByBranch || [];

    const { data, loading, error, refetch } = useQuery(GET_SALES_REPORT, {
        variables: {
            branchId: branchId!,
            startDate: startDate,
            endDate: endDate,
            documentId: selectedDocumentId || null,
        },
        skip: !branchId || !startDate || !endDate,
        fetchPolicy: "network-only",
    });

    const reportData: SalesReportData | null = data?.salesReport || null;
    const summary: SalesReportSummary | null = reportData?.summary || null;
    const salesDocuments: IssuedDocument[] = reportData?.documents || [];

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
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
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
                                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                            Reporte de Ventas
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                            Análisis detallado de facturación y cobranzas
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={loading}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    {loading ? "Actualizando" : "Refrescar"}
                </button>
            </div>

            {/* Unified Filter Toolbar */}
            <div className="rounded-[28px] border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Desde
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>

                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Hasta
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>

                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Documento
                        </label>
                        <select
                            value={selectedDocumentId}
                            onChange={(e) =>
                                setSelectedDocumentId(e.target.value)
                            }
                            className="w-full cursor-pointer bg-transparent text-sm font-bold text-slate-700 outline-none dark:bg-slate-800/60 dark:text-slate-100 dark:[color-scheme:light]"
                        >
                            <option
                                value=""
                                className="bg-white text-slate-900"
                            >
                                Todos los documentos
                            </option>
                            {documentsList
                                .filter((doc) => doc.isActive)
                                .map((doc) => (
                                    <option
                                        key={doc.id}
                                        value={doc.id}
                                        className="bg-white text-slate-900"
                                    >
                                        {doc.code} - {doc.description}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="flex items-center p-2">
                        <button
                            onClick={() => refetch()}
                            disabled={loading}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50 dark:shadow-none"
                        >
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
                                    strokeWidth={2.5}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            Filtrar Reporte
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="relative overflow-hidden rounded-[32px] bg-indigo-600 p-6 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                                Total Documentos
                            </span>
                            <div className="mt-1 text-3xl font-black">
                                {summary.totalDocuments}
                            </div>
                        </div>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                    </div>

                    <div className="relative overflow-hidden rounded-[32px] bg-emerald-500 p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                                Venta Total Bruta
                            </span>
                            <div className="mt-1 text-3xl font-black">
                                {currencyFormatter.format(summary.totalAmount)}
                            </div>
                        </div>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                    </div>

                    <div className="col-span-1 flex flex-col gap-3 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900 sm:col-span-2 lg:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Distribución por Método de Pago
                        </span>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            {[
                                {
                                    label: "Efectivo",
                                    amount: summary.totalCash,
                                    color: "text-blue-600",
                                    bg: "bg-blue-50 dark:bg-blue-900/20",
                                },
                                {
                                    label: "Yape",
                                    amount: summary.totalYape,
                                    color: "text-emerald-600",
                                    bg: "bg-emerald-50 dark:bg-emerald-900/20",
                                },
                                {
                                    label: "Plin",
                                    amount: summary.totalPlin,
                                    color: "text-amber-600",
                                    bg: "bg-amber-50 dark:bg-amber-900/20",
                                },
                                {
                                    label: "Tarjeta",
                                    amount: summary.totalCard,
                                    color: "text-rose-600",
                                    bg: "bg-rose-50 dark:bg-rose-900/20",
                                },
                                {
                                    label: "Transf.",
                                    amount: summary.totalTransfer,
                                    color: "text-purple-600",
                                    bg: "bg-purple-50 dark:bg-purple-900/20",
                                },
                                {
                                    label: "Otros",
                                    amount: summary.totalOthers,
                                    color: "text-slate-600",
                                    bg: "bg-slate-50 dark:bg-slate-800/30",
                                },
                            ].map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`flex flex-col rounded-2xl p-3 ${item.bg}`}
                                >
                                    <span className="text-[9px] font-black uppercase tracking-tighter opacity-70">
                                        {item.label}
                                    </span>
                                    <span
                                        className={`text-[11px] font-black ${item.color}`}
                                    >
                                        {currencyFormatter.format(item.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Documents List Section */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Documentos Emitidos
                    </h2>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                        {salesDocuments.length} Registros encontrados
                    </span>
                </div>

                <div className="p-4 sm:p-6">
                    {loading ? (
                        <div className="flex min-h-[300px] flex-col gap-4">
                            {Array(5)
                                .fill(0)
                                .map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-20 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                                    />
                                ))}
                        </div>
                    ) : (
                        <ReportSaleList
                            documents={salesDocuments}
                            loading={loading}
                            error={error}
                            isSmallDesktop={false}
                            isSmall={false}
                            isXs={false}
                            onRefetch={refetch}
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

export default ReportSale;
