import React from 'react';
import type { EmployeeSalesRankItem } from './reportEmployee';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
});

interface ReportEmployeeRankingListProps {
  employees: EmployeeSalesRankItem[];
  loading: boolean;
  error?: string | null;
}

const ReportEmployeeRankingList: React.FC<ReportEmployeeRankingListProps> = ({
  employees,
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
        <p className="max-w-xs text-sm font-bold text-slate-400">{error}</p>
      </div>
    );
  }

  if (!employees.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-300 dark:bg-amber-900/20 dark:text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Sin ventas registradas</h3>
        <p className="max-w-xs text-sm font-bold text-slate-400">
          Ningún empleado registró ventas hasta el momento.
        </p>
      </div>
    );
  }

  const maxTotal = Math.max(...employees.map((e) => e.grandTotal));

  return (
    <div className="grid grid-cols-1 gap-4">
      {employees.map((employee, index) => {
        const rank = index + 1;
        const popularity = maxTotal > 0 ? (employee.grandTotal / maxTotal) * 100 : 0;

        return (
          <div
            key={employee.userId}
            className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
                    rank === 1
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20'
                      : rank === 2
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                        : rank === 3
                          ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20'
                          : 'bg-slate-50 text-slate-300 dark:bg-slate-800/30 dark:text-slate-600'
                  }`}
                >
                  {rank}
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                      {employee.role || 'Empleado'}
                    </span>
                    {rank === 1 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-600 dark:bg-amber-900/30">
                        Top vendedor
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black leading-tight text-slate-800 dark:text-slate-100">
                    {employee.fullName}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                    <span>{employee.totalOperations}</span>
                    <span>{employee.totalOperations === 1 ? 'orden gestionada' : 'órdenes gestionadas'}</span>
                  </div>
                </div>
              </div>

              <div className="self-end text-right min-w-[120px] sm:self-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recaudación</div>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {currencyFormatter.format(employee.grandTotal)}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Participación en ventas
                </span>
                <span className="text-[10px] font-black text-slate-400">{Math.round(popularity)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${popularity}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-4 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
          {employees.length} empleados con ventas en el periodo
        </span>
      </div>
    </div>
  );
};

export default ReportEmployeeRankingList;
