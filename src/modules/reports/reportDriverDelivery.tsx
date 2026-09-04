import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_DRIVER_DELIVERY_REPORT, GET_USERS_BY_BRANCH_ROLE } from '../../graphql/queries';
import { formatLocalDateYYYYMMDD } from '../../utils/localDateTime';
import ReportExportExcelButton from '../../components/ReportExportExcelButton';
import { useToast } from '../../context/ToastContext';
import { downloadDriverDeliveryReport } from './reportExcelExports';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
});

interface DriverDeliveryReportItem {
    id: string;
    serial: string;
    number: number;
    emissionDate: string;
    emissionTime: string;
    clientName?: string;
    clientDocumentNumber?: string;
    deliveryPrice: number;
    totalAmount: number;
    billingStatus: string;
    driverId?: string;
    driverName?: string;
}

interface DriverDeliveryReportSummary {
    totalDocuments: number;
    totalDeliveryPrice: number;
    totalSaleAmount: number;
}

function formatCorrelativo(serial: string, number: number): string {
    return `${serial}-${String(number).padStart(8, '0')}`;
}

const ReportDriverDelivery: React.FC = () => {
    const { companyData } = useAuth();
    const { showToast } = useToast();
    const branchId = companyData?.branch?.id;

    const [startDate, setStartDate] = useState<string>(() => formatLocalDateYYYYMMDD());
    const [endDate, setEndDate] = useState<string>(() => formatLocalDateYYYYMMDD());
    const [driverId, setDriverId] = useState<string>('');

    const { data: driversData } = useQuery(GET_USERS_BY_BRANCH_ROLE, {
        variables: { branchId: branchId!, role: 'MOTORIZADO' },
        skip: !branchId,
    });
    const drivers: Array<{ id: string; fullName: string }> = driversData?.usersByBranch ?? [];

    const { data, loading, error, refetch } = useQuery(GET_DRIVER_DELIVERY_REPORT, {
        variables: {
            branchId: branchId!,
            startDate,
            endDate,
            driverId: driverId || null,
        },
        skip: !branchId || !startDate || !endDate,
        fetchPolicy: 'network-only',
    });

    const documents: DriverDeliveryReportItem[] = data?.driverDeliveryReport?.documents ?? [];
    const summary: DriverDeliveryReportSummary | null = data?.driverDeliveryReport?.summary ?? null;

    const selectedDriverName = driverId
        ? drivers.find((d) => d.id === driverId)?.fullName
        : undefined;

    const handleExportExcel = async () => {
        if (!documents.length) {
            showToast('No hay entregas para exportar en este periodo.', 'warning');
            return;
        }

        try {
            const result = await downloadDriverDeliveryReport(
                documents,
                summary,
                { startDate, endDate },
                selectedDriverName,
            );
            showToast(result.message || 'Reporte descargado en Excel.', 'success');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'No se pudo exportar el reporte.';
            showToast(message, 'error');
        }
    };

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
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-sky-500 text-white shadow-lg shadow-sky-200 dark:shadow-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m6 0a2 2 0 104 0" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                            Reporte de Motorizados
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                            Ventas delivery entregadas por cada motorizado
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <ReportExportExcelButton
                        onClick={handleExportExcel}
                        disabled={loading || documents.length === 0}
                    />
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
            </div>

            {/* Filter Toolbar */}
            <div className="rounded-[28px] border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motorizado</label>
                        <select
                            value={driverId}
                            onChange={(e) => setDriverId(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        >
                            <option value="">Todos los motorizados</option>
                            {drivers.map((d) => (
                                <option key={d.id} value={d.id}>{d.fullName}</option>
                            ))}
                        </select>
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
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-sky-200 transition-all hover:bg-sky-600 hover:shadow-sky-300 disabled:opacity-50 dark:shadow-none"
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
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <div className="relative overflow-hidden rounded-[32px] bg-sky-500 p-6 text-white shadow-lg shadow-sky-200 dark:shadow-none">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Documentos</span>
                            <div className="mt-1 text-3xl font-black">{summary.totalDocuments}</div>
                        </div>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                    </div>

                    <div className="relative overflow-hidden rounded-[32px] bg-slate-800 p-6 text-white shadow-lg shadow-slate-200 dark:shadow-none">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Cobrado Delivery</span>
                            <div className="mt-1 text-3xl font-black">{currencyFormatter.format(summary.totalDeliveryPrice)}</div>
                        </div>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                    </div>

                    <div className="flex flex-col justify-center gap-1 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Ventas</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-sky-600">{currencyFormatter.format(summary.totalSaleAmount)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Table */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex flex-col gap-2 border-b border-slate-50 p-6 dark:border-slate-800/50 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Detalle de Entregas</h2>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                        {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
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
                    ) : documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Sin entregas</h3>
                            <p className="max-w-xs text-sm font-bold text-slate-400">
                                No hay ventas delivery registradas para el filtro seleccionado.
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
                                        {!driverId && <th className="px-4 py-3">Motorizado</th>}
                                        <th className="px-4 py-3 text-right">Precio Delivery</th>
                                        <th className="px-4 py-3 text-right">Total Venta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {documents.map((doc) => (
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
                                                        {doc.clientName || 'Cliente varios'}
                                                    </span>
                                                    {doc.clientDocumentNumber && (
                                                        <span className="text-[10px] text-slate-400">{doc.clientDocumentNumber}</span>
                                                    )}
                                                </div>
                                            </td>
                                            {!driverId && (
                                                <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">
                                                    {doc.driverName || '-'}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-right font-black text-sky-600">
                                                {currencyFormatter.format(doc.deliveryPrice)}
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

export default ReportDriverDelivery;
