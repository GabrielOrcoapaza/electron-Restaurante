import React, { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_CLIENT_SALES_REPORT } from '../../graphql/queries';
import { formatLocalDateYYYYMMDD } from '../../utils/localDateTime';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
});

interface ClientSalesReportItem {
    id: string;
    serial: string;
    number: number;
    emissionDate: string;
    emissionTime: string;
    clientName: string;
    clientDocumentNumber?: string;
    clientDocumentType?: string;
    paymentMethods?: string;
    totalAmount: number;
    billingStatus: string;
}

interface ClientSalesReportSummary {
    totalDocuments: number;
    totalClients: number;
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

function formatCorrelativo(serial: string, number: number): string {
    return `${serial}-${String(number).padStart(8, '0')}`;
}

const ReportClientSales: React.FC = () => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;

    const [startDate, setStartDate] = useState<string>(() => formatLocalDateYYYYMMDD());
    const [endDate, setEndDate] = useState<string>(() => formatLocalDateYYYYMMDD());
    const [searchTerm, setSearchTerm] = useState<string>('');

    const { data, loading, error, refetch } = useQuery(GET_CLIENT_SALES_REPORT, {
        variables: { branchId: branchId!, startDate, endDate },
        skip: !branchId || !startDate || !endDate,
        fetchPolicy: 'network-only',
    });

    const documents: ClientSalesReportItem[] = data?.clientSalesReport?.documents ?? [];
    const summary: ClientSalesReportSummary | null = data?.clientSalesReport?.summary ?? null;

    const filteredDocuments = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return documents;
        return documents.filter((doc) =>
            doc.clientName.toLowerCase().includes(term) ||
            (doc.clientDocumentNumber ?? '').toLowerCase().includes(term)
        );
    }, [documents, searchTerm]);

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
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-teal-500 text-white shadow-lg shadow-teal-200 dark:shadow-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                            Reporte de Clientes
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                            Ventas con cliente identificado, por método de pago
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

            {/* Filter Toolbar */}
            <div className="rounded-[28px] border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Buscar cliente</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Nombre o documento..."
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200 placeholder:text-slate-300"
                        />
                    </div>

                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desde</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="report-date-field w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>

                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hasta</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="report-date-field w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>

                    <div className="flex items-center p-2">
                        <button
                            onClick={() => refetch()}
                            disabled={loading}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-teal-200 transition-all hover:bg-teal-600 hover:shadow-teal-300 disabled:opacity-50 dark:shadow-none"
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
                    <div className="relative overflow-hidden rounded-[32px] bg-teal-500 p-6 text-white shadow-lg shadow-teal-200 dark:shadow-none">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Documentos</span>
                            <div className="mt-1 text-3xl font-black">{summary.totalDocuments}</div>
                        </div>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                    </div>

                    <div className="relative overflow-hidden rounded-[32px] bg-slate-800 p-6 text-white shadow-lg shadow-slate-200 dark:shadow-none">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Clientes Distintos</span>
                            <div className="mt-1 text-3xl font-black">{summary.totalClients}</div>
                        </div>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                    </div>

                    <div className="col-span-1 flex flex-col justify-center gap-1 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900 sm:col-span-2 lg:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Vendido a Clientes</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-teal-600">{currencyFormatter.format(summary.totalAmount)}</span>
                        </div>
                    </div>

                    <div className="col-span-1 flex flex-col gap-3 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900 sm:col-span-2 lg:col-span-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Distribución por Método de Pago
                        </span>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                            {[
                                { label: "Efectivo", amount: summary.totalCash, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                                { label: "Yape", amount: summary.totalYape, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
                                { label: "Plin", amount: summary.totalPlin, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
                                { label: "Tarjeta", amount: summary.totalCard, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-900/20" },
                                { label: "Transf.", amount: summary.totalTransfer, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
                                { label: "Rappi", amount: summary.totalRappi, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
                                { label: "Pedido Ya", amount: summary.totalPedidoYa, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-900/20" },
                                { label: "Otros", amount: summary.totalOthers, color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-800/30" },
                            ].map((item, idx) => (
                                <div key={idx} className={`flex flex-col rounded-2xl p-3 ${item.bg}`}>
                                    <span className="text-[9px] font-black uppercase tracking-tighter opacity-70">{item.label}</span>
                                    <span className={`text-[11px] font-black ${item.color}`}>{currencyFormatter.format(item.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Results Table */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex flex-col gap-2 border-b border-slate-50 p-6 dark:border-slate-800/50 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Detalle de Ventas por Cliente</h2>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                        {filteredDocuments.length} {filteredDocuments.length === 1 ? 'documento' : 'documentos'}
                    </span>
                </div>

                <div className="p-4 sm:p-6">
                    {loading ? (
                        <div className="flex min-h-[200px] flex-col gap-3">
                            {Array(5).fill(0).map((_, i) => (
                                <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Error en la consulta</h3>
                            <p className="max-w-xs text-sm font-bold text-slate-400">{error.message}</p>
                        </div>
                    ) : filteredDocuments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Sin resultados</h3>
                            <p className="max-w-xs text-sm font-bold text-slate-400">
                                {searchTerm
                                    ? `No se encontró a "${searchTerm}" en el periodo seleccionado.`
                                    : "No hay ventas con cliente identificado para el periodo seleccionado."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800/30">
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Comprobante</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Método de Pago</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {filteredDocuments.map((doc) => (
                                        <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                            <td className="px-4 py-3 font-bold text-slate-500">
                                                {doc.emissionDate} {doc.emissionTime?.slice(0, 5)}
                                            </td>
                                            <td className="px-4 py-3 font-black text-slate-700 dark:text-slate-200">
                                                {formatCorrelativo(doc.serial, doc.number)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">
                                                        {doc.clientName}
                                                    </span>
                                                    {doc.clientDocumentNumber && (
                                                        <span className="text-[10px] text-slate-400">{doc.clientDocumentNumber}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">
                                                {doc.paymentMethods || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-slate-100">
                                                {currencyFormatter.format(doc.totalAmount)}
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
    );
};

export default ReportClientSales;
