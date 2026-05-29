import React from 'react';
import { ApolloError } from '@apollo/client';
import type { EmployeeDishLine } from './reportEmployee';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
});

interface ReportEmployeeDishesListProps {
  dishes: EmployeeDishLine[];
  loading: boolean;
  error?: ApolloError;
}

const ReportEmployeeDishesList: React.FC<ReportEmployeeDishesListProps> = ({
  dishes,
  loading,
  error,
}) => {
  if (loading) return null;

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

  if (!dishes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-300 dark:bg-amber-900/20 dark:text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Sin platos vendidos</h3>
        <p className="max-w-xs text-sm font-bold text-slate-400">
          No hay productos registrados en ventas completadas de este empleado en el periodo.
        </p>
      </div>
    );
  }

  const totalQty = dishes.reduce((sum, line) => sum + line.quantity, 0);
  const totalAmount = dishes.reduce((sum, line) => sum + line.total, 0);

  return (
    <div className="grid grid-cols-1 gap-4">
      {dishes.map((item) => {
        const dateObj = new Date(item.operationDate);

        return (
          <div
            key={item.lineKey}
            className="group relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 transition-all hover:border-amber-100 hover:shadow-xl hover:shadow-amber-500/5 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-amber-900/30"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 transition-all group-hover:w-2" />

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 pl-2">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Orden #{item.order}
                    </span>
                    {item.code && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {item.code}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black leading-tight text-slate-800 dark:text-slate-100">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      {dateObj.toLocaleDateString()}{' '}
                      {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 self-end sm:self-center">
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cantidad</div>
                  <div className="text-xl font-black text-slate-800 dark:text-slate-100">
                    {item.quantity}{' '}
                    <small className="text-[10px] uppercase tracking-tighter text-slate-400">und</small>
                  </div>
                  {item.quantity > 1 && (
                    <div className="text-[10px] font-bold text-slate-400">
                      PU: {currencyFormatter.format(item.unitPrice)}
                    </div>
                  )}
                </div>

                <div className="min-w-[100px] text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Importe</div>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                    {currencyFormatter.format(item.total)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-4 flex flex-col items-center gap-1 text-center sm:flex-row sm:justify-center sm:gap-6">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
          {dishes.length} registros de platos
        </span>
        <span className="hidden text-slate-200 sm:inline">•</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {totalQty} unidades · {currencyFormatter.format(totalAmount)}
        </span>
      </div>
    </div>
  );
};

export default ReportEmployeeDishesList;
