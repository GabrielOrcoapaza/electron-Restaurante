import React from 'react';
import { ApolloError } from '@apollo/client';
import type { SoldProductItem, SoldProductsSummary } from './reportsProductsSold';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

interface ReportsProductsSoldListProps {
  products: SoldProductItem[];
  summary: SoldProductsSummary | null;
  loading: boolean;
  error?: ApolloError;
}

const ReportsProductsSoldList: React.FC<ReportsProductsSoldListProps> = ({
  products,
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

  if (!products.length) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Sin ventas</h3>
            <p className="max-w-xs text-sm font-bold text-slate-400">No se registraron ventas de productos en este periodo.</p>
        </div>
    );
  }

  // Calculate max quantity for popularity bar
  const maxQty = Math.max(...products.map(p => p.totalQuantity));

  return (
    <div className="grid grid-cols-1 gap-4">
      {products.map((item, index) => {
        const popularity = (item.totalQuantity / maxQty) * 100;
        const rank = index + 1;

        return (
            <div 
                key={`${item.code}-${index}`}
                className="group relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 transition-all hover:border-emerald-100 hover:shadow-xl hover:shadow-emerald-500/5 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-emerald-900/30"
            >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-5">
                        {/* Rank Number */}
                        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
                            rank === 1 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20' : 
                            rank === 2 ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' :
                            rank === 3 ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20' :
                            'bg-slate-50 text-slate-300 dark:bg-slate-800/30 dark:text-slate-600'
                        }`}>
                            {rank}
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{item.code}</span>
                                {rank === 1 && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-600 dark:bg-amber-900/30">TOP VENTAS</span>
                                )}
                            </div>
                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                                {item.name}
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                <span>P.U. PROMEDIO:</span>
                                <span className="text-slate-600 dark:text-slate-300">{currencyFormatter.format(item.avgUnitPrice)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 self-end sm:self-center">
                        <div className="text-right">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cantidad</div>
                            <div className="text-xl font-black text-slate-800 dark:text-slate-100">
                                {item.totalQuantity} <small className="text-[10px] text-slate-400 uppercase tracking-tighter">und</small>
                            </div>
                        </div>

                        <div className="text-right min-w-[100px]">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recaudado</div>
                            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                {currencyFormatter.format(item.totalAmount)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Popularity Bar */}
                <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nivel de Demanda</span>
                        <span className="text-[10px] font-black text-slate-400">{Math.round(popularity)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div 
                            className={`h-full transition-all duration-1000 ${
                                rank === 1 ? 'bg-amber-400' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${popularity}%` }}
                        />
                    </div>
                </div>
            </div>
        );
      })}

      <div className="mt-4 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            Análisis basado en {products.length} productos diferentes
        </span>
      </div>
    </div>
  );
};

export default ReportsProductsSoldList;
