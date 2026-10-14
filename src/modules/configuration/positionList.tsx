import React, { useEffect, useState } from "react";

export interface ClosureStaffPosition {
    id: string;
    name: string;
    sortOrder?: number;
    isActive?: boolean;
}

interface PositionListProps {
    positions: ClosureStaffPosition[];
    onEdit?: (position: ClosureStaffPosition) => void;
    onDelete?: (position: ClosureStaffPosition) => void;
    deletingId?: string | null;
}

const ITEMS_PER_PAGE = 10;

const PositionList: React.FC<PositionListProps> = ({
    positions,
    onEdit,
    onDelete,
    deletingId,
}) => {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(
        1,
        Math.ceil(positions.length / ITEMS_PER_PAGE),
    );
    const paginated = positions.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE,
    );

    useEffect(() => {
        setPage((p) => Math.min(p, totalPages));
    }, [totalPages, positions.length]);

    return (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 10h16M4 14h16M4 18h16"
                            />
                        </svg>
                        Cargos registrados
                    </h3>
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {positions.length} TOTAL
                    </span>
                </div>
            </div>

            {positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        No hay cargos. Crea uno en el formulario superior.
                    </p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                                    <th className="px-6 py-4">Cargo</th>
                                    <th className="px-6 py-4 text-center">
                                        Orden
                                    </th>
                                    <th className="px-6 py-4 text-center">
                                        Estado
                                    </th>
                                    {(onEdit || onDelete) && (
                                        <th className="px-6 py-4 text-right">
                                            Acciones
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {paginated.map((pos) => (
                                    <tr
                                        key={pos.id}
                                        className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                                {pos.name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                {pos.sortOrder ?? 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {pos.isActive === false ? (
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
                                        {(onEdit || onDelete) && (
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {onEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                onEdit(pos)
                                                            }
                                                            className="inline-flex h-8 items-center gap-2 rounded-lg bg-indigo-50 px-3 text-[11px] font-bold text-indigo-600 transition-all hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                                                        >
                                                            Editar
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                deletingId ===
                                                                pos.id
                                                            }
                                                            onClick={() =>
                                                                onDelete(pos)
                                                            }
                                                            className="inline-flex h-8 items-center gap-2 rounded-lg bg-rose-50 px-3 text-[11px] font-bold text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40"
                                                        >
                                                            {deletingId ===
                                                            pos.id
                                                                ? "..."
                                                                : "Eliminar"}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-800/10">
                            <span className="text-[11px] font-bold uppercase tracking-tight text-slate-400 dark:text-slate-500">
                                Página {page} de {totalPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPage((p) => Math.max(1, p - 1))
                                    }
                                    disabled={page <= 1}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Anterior
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPage((p) =>
                                            Math.min(totalPages, p + 1),
                                        )
                                    }
                                    disabled={page >= totalPages}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PositionList;
