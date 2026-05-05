import React from 'react';
import { ApolloError } from '@apollo/client';
import type { UserSaleOperation, UserSalesSummary } from './reportEmployee';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

interface ReportEmployeeListProps {
  operations: UserSaleOperation[];
  summary: UserSalesSummary | null;
  loading: boolean;
  error?: ApolloError;
}

const ReportEmployeeList: React.FC<ReportEmployeeListProps> = ({
  operations,
  loading,
  error,
}) => {
  if (loading) return null; // Handled by parent skeleton

  if (error) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-900/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Error en la consulta</h3>
            <p className="max-w-xs text-sm font-bold text-slate-400">{error.message}</p>
        </div>
    );
  }

  if (!operations.length) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-300 dark:bg-amber-900/20 dark:text-amber-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Sin operaciones</h3>
            <p className="max-w-xs text-sm font-bold text-slate-400">Selecciona un empleado para ver su historial de ventas en este periodo.</p>
        </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {operations.map((op, index) => {
        const dateObj = new Date(op.operationDate);
        const isCancelled = op.status === 'CANCELLED';

        return (
            <div 
                key={`${op.id}-${index}`}
                className="group relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 transition-all hover:border-amber-100 hover:shadow-xl hover:shadow-amber-500/5 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-amber-900/30"
            >
                {/* Status Side Accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2 ${isCancelled ? 'bg-rose-500' : 'bg-emerald-500'}`} />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${isCancelled ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isCancelled ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {isCancelled ? 'Operación Anulada' : 'Venta Exitosa'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-300">•</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                    ORDEN #{op.order}
                                </span>
                            </div>
                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase leading-tight">
                                Transacción de Venta #{op.order}
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 self-end sm:self-center">
                        <div className="text-right">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Importe de Venta</div>
                            <div className={`text-xl font-black ${isCancelled ? 'text-rose-500 line-through opacity-50' : 'text-slate-800 dark:text-slate-100'}`}>
                                {currencyFormatter.format(op.total)}
                            </div>
                        </div>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 transition-all dark:border-slate-800 ${isCancelled ? 'text-rose-500' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                            {isCancelled ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
      })}

      <div className="mt-4 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            Total histórico analizado: {operations.length} órdenes
        </span>
      </div>
    </div>
  );
};

export default ReportEmployeeList;
