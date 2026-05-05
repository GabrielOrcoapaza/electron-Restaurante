import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import {
    ASSIGN_CATEGORY_TO_PRINTER,
    BULK_ASSIGN_CATEGORY_PRINTERS,
    REMOVE_CATEGORY_PRINTERS,
} from "../../graphql/mutations";

export interface Printer {
    id: string;
    name: string;
    code?: string;
}

interface Category {
    id: string;
    name: string;
}

interface CategoryPrinterItem {
    id: string;
    priority: number;
    category?: { id: string; name: string };
    printer?: { id: string; name: string };
}

interface PrinterPermissionProps {
    open: boolean;
    onClose: () => void;
    printer: Printer | null;
    categories: Category[];
    categoryPrintersByBranch: CategoryPrinterItem[];
    onSuccess: () => void;
}


const PrinterPermission: React.FC<PrinterPermissionProps> = ({
    open,
    onClose,
    printer,
    categories,
    categoryPrintersByBranch,
    onSuccess,
}) => {
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
        new Set(),
    );
    const [assignPriority, setAssignPriority] = useState(1);

    const [assignCategory, { loading: assigningOne }] = useMutation(
        ASSIGN_CATEGORY_TO_PRINTER,
        {
            onCompleted: (res) => {
                const result = res?.assignCategoryToPrinter;
                if (result?.success) {
                    setMessage({
                        type: "success",
                        text: result.message ?? "Categoría asignada",
                    });
                    setSelectedCategoryIds(new Set());
                    onSuccess();
                } else {
                    setMessage({
                        type: "error",
                        text: result?.message ?? "Error",
                    });
                }
            },
            onError: (e) => setMessage({ type: "error", text: e.message }),
        },
    );

    const [bulkAssign, { loading: assigningBulk }] = useMutation(
        BULK_ASSIGN_CATEGORY_PRINTERS,
        {
            onCompleted: (res) => {
                const result = res?.bulkAssignCategoryPrinters;
                if (result?.success) {
                    setMessage({
                        type: "success",
                        text: result.message ?? "Categorías asignadas",
                    });
                    setSelectedCategoryIds(new Set());
                    onSuccess();
                } else {
                    setMessage({
                        type: "error",
                        text: result?.message ?? "Error",
                    });
                }
            },
            onError: (e) => setMessage({ type: "error", text: e.message }),
        },
    );

    const assigning = assigningOne || assigningBulk;

    const [removeCategoryPrinters, { loading: removing }] = useMutation(
        REMOVE_CATEGORY_PRINTERS,
        {
            onCompleted: (res) => {
                const result = res?.removeCategoryPrinters;
                if (result?.success) {
                    setMessage({
                        type: "success",
                        text: result.message ?? "Asignación quitada",
                    });
                    onSuccess();
                } else {
                    setMessage({
                        type: "error",
                        text: result?.message ?? "Error",
                    });
                }
            },
            onError: (e) => setMessage({ type: "error", text: e.message }),
        },
    );

    if (!open || !printer) return null;

    const assignedToThisPrinter = categoryPrintersByBranch.filter(
        (cp) => cp.printer?.id === printer.id,
    );
    const assignedCategoryIds = new Set(
        assignedToThisPrinter.map((cp) => cp.category?.id).filter(Boolean),
    );
    const availableToAssign = categories.filter(
        (c) => !assignedCategoryIds.has(c.id),
    );

    const toggleCategory = (categoryId: string) => {
        setSelectedCategoryIds((prev) => {
            const next = new Set(prev);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
        });
    };

    const handleAssignSelected = () => {
        if (!printer?.id || selectedCategoryIds.size === 0) {
            setMessage({
                type: "error",
                text: "Selecciona al menos una categoría",
            });
            return;
        }
        setMessage(null);
        const ids = Array.from(selectedCategoryIds);
        if (ids.length === 1) {
            assignCategory({
                variables: {
                    printerId: printer.id,
                    categoryId: ids[0],
                    priority: assignPriority,
                },
            });
        } else {
            bulkAssign({
                variables: {
                    categoryIds: ids,
                    printerIds: [printer.id],
                    priority: assignPriority,
                },
            });
        }
    };

    const handleRemove = (categoryPrinterId: string) => {
        setMessage(null);
        removeCategoryPrinters({ variables: { ids: [categoryPrinterId] } });
    };

    const handleClose = () => {
        if (!assigning && !removing) {
            setMessage(null);
            setSelectedCategoryIds(new Set());
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
            onClick={handleClose}
        >
            <div
                className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                                />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                Permisos de Categoría
                            </h3>
                            <p className="text-[10px] font-bold uppercase text-slate-400">
                                {printer.name}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    {message && (
                        <div
                            className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
                                message.type === "success"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                                    : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
                            }`}
                        >
                            <div
                                className={`h-2 w-2 rounded-full ${message.type === "success" ? "bg-emerald-500" : "bg-rose-500"}`}
                            />
                            {message.text}
                        </div>
                    )}

                    {/* Assigned Categories Section */}
                    <div className="mb-8">
                        <h5 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Categorías Asignadas Actualmente
                        </h5>
                        {assignedToThisPrinter.length === 0 ? (
                            <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 py-8 text-center dark:border-slate-800">
                                <p className="text-xs font-medium text-slate-400 italic">
                                    No hay categorías asignadas a esta
                                    impresora.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {assignedToThisPrinter.map((cp) => (
                                    <div
                                        key={cp.id}
                                        className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 transition-colors dark:border-emerald-900/30 dark:bg-emerald-950/20"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                                                <span className="text-[10px] font-black">
                                                    {cp.priority}
                                                </span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                {cp.category?.name ??
                                                    "Categoría desconocida"}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(cp.id)}
                                            disabled={removing}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600 transition-all hover:bg-rose-600 hover:text-white dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white"
                                            title="Quitar asignación"
                                        >
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
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Available to Assign Section */}
                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Asignar Nuevas Categorías
                            </h5>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">
                                    Prioridad:
                                </label>
                                <input
                                    type="number"
                                    value={assignPriority}
                                    onChange={(e) =>
                                        setAssignPriority(
                                            parseInt(e.target.value, 10) || 1,
                                        )
                                    }
                                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                />
                            </div>
                        </div>

                        {availableToAssign.length === 0 ? (
                            <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-900/50">
                                <p className="text-xs font-medium text-slate-500">
                                    Todas las categorías ya han sido asignadas.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                                    <div className="grid grid-cols-1 gap-2">
                                        {availableToAssign.map((cat) => (
                                            <label
                                                key={cat.id}
                                                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                                                    selectedCategoryIds.has(
                                                        cat.id,
                                                    )
                                                        ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/20"
                                                        : "border-slate-100 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/80"
                                                }`}
                                            >
                                                <span
                                                    className={`text-sm font-bold ${selectedCategoryIds.has(cat.id) ? "text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"}`}
                                                >
                                                    {cat.name}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCategoryIds.has(
                                                        cat.id,
                                                    )}
                                                    onChange={() =>
                                                        toggleCategory(cat.id)
                                                    }
                                                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAssignSelected}
                                    disabled={
                                        assigning ||
                                        selectedCategoryIds.size === 0
                                    }
                                    className={`mt-4 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg ${
                                        assigning ||
                                        selectedCategoryIds.size === 0
                                            ? "bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none"
                                            : "bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-emerald-600/30 active:translate-y-0"
                                    }`}
                                >
                                    {assigning
                                        ? "Asignando..."
                                        : `Asignar Seleccionadas (${selectedCategoryIds.size})`}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={assigning || removing}
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrinterPermission;
