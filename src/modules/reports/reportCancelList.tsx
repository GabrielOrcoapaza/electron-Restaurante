import React from "react";
import { ApolloError } from "@apollo/client";
import type { CancellationItem } from "./reportCancel";

interface ReportCancelListProps {
    items: CancellationItem[];
    loading: boolean;
    error?: ApolloError;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const ReportCancelList: React.FC<ReportCancelListProps> = ({
    items,
    loading,
    error,
}) => {
    if (loading) return null; // Loading is handled by parent

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-900/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Error en el reporte</h3>
                <p className="max-w-xs text-sm font-bold text-slate-400">{error.message}</p>
            </div>
        );
    }

    if (!items.length) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Sin anulaciones</h3>
                <p className="max-w-xs text-sm font-bold text-slate-400">No se detectaron eventos de anulación en este periodo.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            {items.map((item, index) => {
                const isOp = item.type === "OPERATION";
                const dateObj = new Date(item.cancelledAt);

                return (
                    <div 
                        key={`${item.id}-${index}`}
                        className="group relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 transition-all hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-indigo-900/30"
                    >
                        {/* Decorative side accent */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2 ${isOp ? 'bg-rose-500' : 'bg-indigo-500'}`} />

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${isOp ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20'}`}>
                                    {isOp ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isOp ? 'text-rose-500' : 'text-indigo-500'}`}>
                                            {isOp ? "Orden Anulada" : "Producto Anulado"}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-300">•</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                            #{item.operationOrder}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                                        {isOp ? `Orden Completa #${item.operationOrder}` : item.productName}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span>{item.user.fullName || "Sistema"}</span>
                                        <span className="text-slate-200 dark:text-slate-800">|</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-end justify-between sm:flex-col sm:items-end sm:justify-center">
                                <div className="text-right">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monto Perdido</div>
                                    <div className={`text-xl font-black ${isOp ? 'text-rose-500' : 'text-slate-800 dark:text-slate-100'}`}>
                                        {currencyFormatter.format(item.amount)}
                                    </div>
                                </div>
                                {!isOp && item.quantity && (
                                    <div className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-500 dark:bg-slate-800">
                                        CANT: {item.quantity}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Reason Box */}
                        <div className="mt-4 rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
                            <div className="flex items-start gap-3">
                                <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-slate-800">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Motivo de Anulación</span>
                                    <p className="text-sm font-bold italic text-slate-600 dark:text-slate-400 leading-relaxed">
                                        "{item.reason}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            <div className="mt-4 text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    Fin de la lista • {items.length} registros
                </span>
            </div>
        </div>
    );
};

export default ReportCancelList;
