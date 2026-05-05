import React, { useState, useEffect, useMemo } from 'react';

function normalizeCategoryListName(s: string): string {
  return s.trim().toLowerCase();
}


interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  isActive: boolean;
}

interface CategoryListProps {
  categories: Category[];
  onEdit?: (category: Category) => void;
}

const ITEMS_PER_PAGE = 10;

const CategoryList: React.FC<CategoryListProps> = ({ categories, onEdit }) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(categories.length / ITEMS_PER_PAGE));
  const categoriesPaginated = categories.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE); 

  const duplicateCategoryNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of categories) {
      const k = normalizeCategoryListName(c.name);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const dups = new Set<string>();
    counts.forEach((n, k) => {
      if (n > 1) dups.add(k);
    });
    return dups;
  }, [categories]);

  const formatCategoryCellName = (c: Category) =>
    duplicateCategoryNames.has(normalizeCategoryListName(c.name))
      ? `${c.name} · ${String(c.id).slice(-6)}`
      : c.name;

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages, categories.length]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/30">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
          Lista de Categorías <span className="ml-2 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-black text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">{categories.length}</span>
        </h3>
      </div>

      <div className="p-0">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <p className="text-sm font-medium">No hay categorías registradas.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-800/20">
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Categoría</th>
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Descripción</th>
                    <th className="px-6 py-4 text-center font-bold text-slate-500 dark:text-slate-400">Orden</th>
                    <th className="px-6 py-4 text-center font-bold text-slate-500 dark:text-slate-400">Estado</th>
                    {onEdit && <th className="px-6 py-4 text-right font-bold text-slate-500 dark:text-slate-400">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categoriesPaginated.map((category) => (
                    <tr 
                      key={category.id} 
                      className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-110"
                            style={{ backgroundColor: category.color || '#6366f1' }}
                          >
                            {/* Aquí podrías incluir un CategoryIcon si estuviera disponible en este scope */}
                            <span className="text-xs font-black uppercase">{category.name.substring(0, 2)}</span>
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {formatCategoryCellName(category)}
                            </div>
                            <div className="text-[10px] font-medium text-slate-400">ID: {category.id.substring(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="max-w-[200px] truncate text-slate-600 dark:text-slate-400">
                          {category.description || <span className="italic opacity-30">Sin descripción</span>}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {category.order ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            category.isActive 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          }`}
                        >
                          <div className={`h-1.5 w-1.5 rounded-full ${category.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {category.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      {onEdit && (
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => onEdit(category)}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-indigo-600 dark:hover:text-white"
                          >
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/20">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Mostrando <span className="font-bold text-slate-800 dark:text-slate-200">{categoriesPaginated.length}</span> de <span className="font-bold text-slate-800 dark:text-slate-200">{categories.length}</span> categorías
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {page} <span className="mx-1 text-slate-300">/</span> {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryList;
