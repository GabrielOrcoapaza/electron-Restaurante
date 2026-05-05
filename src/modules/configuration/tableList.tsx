import React from 'react';

export interface Table {
  id: string;
  name: string;
  shape?: string;
  positionX?: number;
  positionY?: number;
  capacity?: number;
  isActive?: boolean;
  status?: string;
}

interface TableListProps {
  tables: Table[];
  floorName?: string;
  onEdit?: (table: Table) => void;
}

const shapeLabel = (shape: string | undefined): string => {
  if (!shape) return '-';
  const s = (shape || '').toUpperCase();
  if (s === 'SQUARE') return 'Cuadrada';
  if (s === 'ROUND' || s === 'CIRCLE') return 'Redonda';
  if (s === 'RECTANGLE') return 'Rectangular';
  return shape;
};

const TableList: React.FC<TableListProps> = ({ tables, floorName, onEdit }) => {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Mesas {floorName ? `• ${floorName}` : ''}
          </h3>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {tables.length} MESAS
          </span>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay mesas en este piso. Crea una arriba.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                <th className="px-6 py-4">Nombre / Identificador</th>
                <th className="px-6 py-4 text-center">Forma</th>
                <th className="px-6 py-4 text-center">Capacidad</th>
                <th className="px-6 py-4 text-center">Estado de Servicio</th>
                {onEdit && <th className="px-6 py-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {tables.map((table) => (
                <tr key={table.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{table.name}</span>
                  </td>
                  <td className="px-6 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    {shapeLabel(table.shape)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {table.capacity ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {table.isActive === false ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-500">
                        Inactiva
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        table.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        table.status === 'OCCUPIED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        table.status === 'TO_PAY' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                        table.status === 'MAINTENANCE' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 
                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        <div className={`h-1 w-1 rounded-full ${
                          table.status === 'AVAILABLE' ? 'bg-emerald-500' :
                          table.status === 'OCCUPIED' ? 'bg-amber-500' :
                          table.status === 'TO_PAY' ? 'bg-indigo-500' :
                          table.status === 'MAINTENANCE' ? 'bg-rose-500' : 'bg-slate-400'
                        }`} />
                        {table.status === 'AVAILABLE' ? 'Disponible' :
                         table.status === 'OCCUPIED' ? 'Ocupada' :
                         table.status === 'TO_PAY' ? 'Por pagar' :
                         table.status === 'IN_PROCESS' ? 'En proceso' :
                         table.status === 'MAINTENANCE' ? 'Mantenimiento' : table.status || '—'}
                      </span>
                    )}
                  </td>
                  {onEdit && (
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(table)}
                        className="inline-flex h-8 items-center gap-2 rounded-lg bg-indigo-50 px-3 text-[11px] font-bold text-indigo-600 transition-all hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
export default TableList;
