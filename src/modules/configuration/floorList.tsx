import React, { useState, useEffect } from 'react';

export interface Floor {
  id: string;
  name: string;
  capacity?: number;
  order?: number;
  isActive?: boolean;
}

interface FloorListProps {
  floors: Floor[];
  onEdit?: (floor: Floor) => void;
}

const ITEMS_PER_PAGE = 10;

const FloorList: React.FC<FloorListProps> = ({ floors, onEdit }) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(floors.length / ITEMS_PER_PAGE));
  const floorsPaginated = floors.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages, floors.length]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Pisos Registrados
          </h3>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {floors.length} TOTAL
          </span>
        </div>
      </div>

      {floors.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay pisos registrados. Crea uno arriba.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                  <th className="px-6 py-4">Nombre del Área</th>
                  <th className="px-6 py-4 text-center">Capacidad</th>
                  <th className="px-6 py-4 text-center">Orden</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  {onEdit && <th className="px-6 py-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {floorsPaginated.map((floor) => (
                  <tr key={floor.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{floor.name}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {floor.capacity ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{floor.order ?? 0}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {floor.isActive === false ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                          <div className="h-1 w-1 rounded-full bg-rose-500" />
                          Inactivo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <div className="h-1 w-1 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      )}
                    </td>
                    {onEdit && (
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => onEdit(floor)}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-800/10">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FloorList;
