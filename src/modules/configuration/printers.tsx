import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_PRINTERS_CONFIG,
    GET_CATEGORIES_BY_BRANCH,
} from "../../graphql/queries";
import { UPDATE_PRINTER } from "../../graphql/mutations";
import PrintersList, { type Printer } from "./printersList";
import PrintersCreate from "./printersCreate";
import PrinterPermission from "./printerPermission";

interface RaspberryPi {
    id: string;
    name?: string;
}

const Printers: React.FC = () => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;

    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [printerForPermissions, setPrinterForPermissions] =
        useState<Printer | null>(null);
    const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
    const [editForm, setEditForm] = useState<
        Partial<Printer> & { is_active?: boolean }
    >({});

    const {
        data: printersConfigData,
        refetch: refetchPrintersConfig,
    } = useQuery(GET_PRINTERS_CONFIG, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
    });

    const raspberryPi: RaspberryPi | null =
        printersConfigData?.raspberryPiByBranch ?? null;
    const raspberryPis: RaspberryPi[] = raspberryPi ? [raspberryPi] : [];
    const categories = categoriesData?.categoriesByBranch ?? [];
    const allPrinters: Printer[] = printersConfigData?.printersByBranch ?? [];
    const categoryPrintersByBranch =
        printersConfigData?.categoryPrintersByBranch ?? [];

    const [updatePrinter, { loading: updating }] = useMutation(UPDATE_PRINTER, {
        onCompleted: (res) => {
            const result = res?.updatePrinter;
            if (result?.success) {
                setMessage({
                    type: "success",
                    text: result.message ?? "Impresora actualizada",
                });
                setEditingPrinter(null);
                refetchPrintersConfig();
            } else {
                setMessage({
                    type: "error",
                    text: result?.message ?? "Error al actualizar",
                });
            }
        },
        onError: (e) => setMessage({ type: "error", text: e.message }),
    });

    const handleUpdate = () => {
        if (!editingPrinter?.id) return;
        setMessage(null);
        updatePrinter({
            variables: {
                printerId: editingPrinter.id,
                name: editForm.name !== undefined ? editForm.name : undefined,
                code: editForm.code !== undefined ? editForm.code : undefined,
                ipAddress: editForm.ipAddress,
                port: editForm.port,
                printerType: editForm.printerType,
                paperWidth: editForm.paperWidth,
                charactersPerLine: editForm.charactersPerLine,
                encoding: editForm.encoding,
                isKitchen: editForm.isKitchen,
                isBar: editForm.isBar,
                isCashier: editForm.isCashier,
                isReceipt: editForm.isReceipt,
                isInvoice: editForm.isInvoice,
                isActive: editForm.is_active,
            },
        });
    };

    const openEdit = (p: Printer) => {
        setEditingPrinter(p);
        setEditForm({
            name: p.name,
            code: p.code,
            ipAddress: p.ipAddress ?? p.ip_address,
            port: p.port,
            printerType: p.printerType ?? p.printer_type,
            paperWidth: p.paperWidth ?? p.paper_width,
            charactersPerLine: p.charactersPerLine ?? p.characters_per_line,
            encoding: p.encoding,
            isKitchen: p.isKitchen ?? p.is_kitchen,
            isBar: p.isBar ?? p.is_bar,
            isCashier: p.isCashier ?? p.is_cashier,
            isReceipt: p.isReceipt ?? p.is_receipt,
            isInvoice: p.isInvoice ?? p.is_invoice,
            is_active: p.isActive ?? p.is_active,
        });
    };

    return (
        <div className="flex flex-col gap-6 p-1 transition-colors duration-200 md:p-0">
            {/* Header Section */}
            <div className="flex flex-col gap-1 px-2 md:px-0">
                <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-2xl">
                    Configuración de Impresoras
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 md:text-sm">
                    Gestiona los dispositivos de impresión y sus asignaciones
                    por categoría.
                </p>
            </div>

            {message && (
                <div
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
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

            {/* Main List */}
            <PrintersList
                printers={allPrinters}
                onEdit={openEdit}
                onOpenPermissions={(p) => setPrinterForPermissions(p)}
                onOpenCreate={() => setShowCreateModal(true)}
            />

            {/* Assign Permissions Modal */}
            <PrinterPermission
                open={!!printerForPermissions}
                printer={printerForPermissions}
                onClose={() => setPrinterForPermissions(null)}
                categories={categories}
                categoryPrintersByBranch={categoryPrintersByBranch}
                onSuccess={refetchPrintersConfig}
            />

            {/* Create Printer Modal */}
            <PrintersCreate
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                raspberryPis={raspberryPis}
                onSuccess={refetchPrintersConfig}
            />

            {/* Edit Printer Card/Modal */}
            {editingPrinter && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
                    onClick={() => setEditingPrinter(null)}
                >
                    <div
                        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                            <div className="flex flex-col">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                    Editar Impresora
                                </h3>
                                <span className="text-[10px] font-bold uppercase text-slate-400">
                                    ID: {editingPrinter.id}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingPrinter(null)}
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
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Nombre
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.name ?? ""}
                                        onChange={(e) =>
                                            setEditForm((f) => ({
                                                ...f,
                                                name: e.target.value,
                                            }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Código
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.code ?? ""}
                                        onChange={(e) =>
                                            setEditForm((f) => ({
                                                ...f,
                                                code: e.target.value,
                                            }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold uppercase text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Dirección IP
                                    </label>
                                    <input
                                        type="text"
                                        value={
                                            editForm.ipAddress ??
                                            editForm.ip_address ??
                                            ""
                                        }
                                        onChange={(e) =>
                                            setEditForm((f) => ({
                                                ...f,
                                                ipAddress: e.target.value,
                                            }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Puerto
                                    </label>
                                    <input
                                        type="number"
                                        value={editForm.port ?? ""}
                                        onChange={(e) =>
                                            setEditForm((f) => ({
                                                ...f,
                                                port:
                                                    parseInt(
                                                        e.target.value,
                                                        10,
                                                    ) || undefined,
                                            }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                </div>

                                <div className="flex flex-col gap-4 md:col-span-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Roles de Impresión
                                    </label>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {[
                                            {
                                                key: "isKitchen",
                                                label: "Cocina",
                                            },
                                            { key: "isBar", label: "Bar" },
                                            { key: "isCashier", label: "Caja" },
                                            {
                                                key: "isReceipt",
                                                label: "Ticket",
                                            },
                                            {
                                                key: "isInvoice",
                                                label: "Factura",
                                            },
                                        ].map((role) => (
                                            <label
                                                key={role.key}
                                                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2.5 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        !!(editForm as any)[
                                                            role.key
                                                        ]
                                                    }
                                                    onChange={(e) =>
                                                        setEditForm((f) => ({
                                                            ...f,
                                                            [role.key]:
                                                                e.target
                                                                    .checked,
                                                        }))
                                                    }
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                                                />
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                    {role.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 md:col-span-2">
                                    <label className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
                                        <input
                                            type="checkbox"
                                            checked={
                                                editForm.is_active ??
                                                editForm.isActive ??
                                                true
                                            }
                                            onChange={(e) =>
                                                setEditForm((f) => ({
                                                    ...f,
                                                    is_active: e.target.checked,
                                                }))
                                            }
                                            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                                        />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                            Impresora Activa
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-8 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingPrinter(null)}
                                    className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUpdate}
                                    disabled={updating}
                                    className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg ${
                                        updating
                                            ? "bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none"
                                            : "bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 active:translate-y-0"
                                    }`}
                                >
                                    {updating ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        "Guardar Cambios"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Printers;
