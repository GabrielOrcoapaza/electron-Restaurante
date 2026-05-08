import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { CREATE_PRINTER } from "../../graphql/mutations";

interface RaspberryPi {
    id: string;
    name?: string;
}

interface PrintersCreateProps {
    open: boolean;
    onClose: () => void;
    raspberryPis: RaspberryPi[];
    onSuccess: () => void;
}

const PRINTER_TYPES = [
    { value: "THERMAL", label: "Térmica" },
    { value: "MATRIX", label: "Matricial" },
    { value: "LASER", label: "Láser" },
];

const defaultForm = {
    raspberry_pi_id: "",
    name: "",
    code: "",
    ip_address: "",
    port: 9100,
    printer_type: "THERMAL",
    paper_width: 80,
    characters_per_line: 48,
    encoding: "UTF-8",
    is_kitchen: true,
    is_bar: false,
    is_cashier: false,
    is_receipt: false,
    is_invoice: false,
};


const PrintersCreate: React.FC<PrintersCreateProps> = ({
    open,
    onClose,
    raspberryPis,
    onSuccess,
}) => {
    const [form, setForm] = useState(defaultForm);
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

    const [createPrinter, { loading: creating }] = useMutation(CREATE_PRINTER, {
        onCompleted: (res) => {
            const result = res?.createPrinter;
            if (result?.success) {
                setMessage({
                    type: "success",
                    text: result.message ?? "Impresora creada",
                });
                setForm(defaultForm);
                onSuccess();
                setTimeout(() => {
                    setMessage(null);
                    onClose();
                }, 1200);
            } else {
                setMessage({
                    type: "error",
                    text: result?.message ?? "Error al crear",
                });
            }
        },
        onError: (e) => setMessage({ type: "error", text: e.message }),
    });

    const handleSubmit = () => {
        if (
            !form.raspberry_pi_id ||
            !form.name?.trim() ||
            !form.code?.trim() ||
            !form.ip_address?.trim()
        ) {
            setMessage({
                type: "error",
                text: "Completa Raspberry Pi, nombre, código e IP",
            });
            return;
        }
        setMessage(null);
        createPrinter({
            variables: {
                raspberryPiId: form.raspberry_pi_id,
                name: form.name.trim(),
                code: form.code.trim().toUpperCase(),
                ipAddress: form.ip_address.trim(),
                port: form.port ?? 9100,
                printerType: form.printer_type ?? "THERMAL",
                paperWidth: form.paper_width ?? 80,
                charactersPerLine: form.characters_per_line ?? 48,
                encoding: form.encoding ?? "UTF-8",
                isKitchen: form.is_kitchen ?? true,
                isBar: form.is_bar ?? false,
                isCashier: form.is_cashier ?? false,
                isReceipt: form.is_receipt ?? false,
                isInvoice: form.is_invoice ?? false,
            },
        });
    };

    const handleClose = () => {
        if (!creating) {
            setForm(defaultForm);
            setMessage(null);
            onClose();
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
            onClick={handleClose}
        >
            <div
                className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
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
                                    d="M12 4v16m8-8H4"
                                />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            Registrar Nueva Impresora
                        </h3>
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

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Device Selection */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Raspberry Pi (Dispositivo) *
                            </label>
                            <select
                                value={form.raspberry_pi_id}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        raspberry_pi_id: e.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="">
                                    Seleccionar dispositivo
                                </option>
                                {raspberryPis.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name ||
                                            `Dispositivo ${r.id.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                            {raspberryPis.length === 0 && (
                                <p className="text-[10px] font-bold text-amber-500">
                                    No hay dispositivos registrados en esta
                                    sucursal.
                                </p>
                            )}
                        </div>

                        {/* Basic Info */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Nombre de Impresora *
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        name: e.target.value,
                                    }))
                                }
                                placeholder="Ej. Cocina 1"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Código Identificador *
                            </label>
                            <input
                                type="text"
                                value={form.code}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        code: e.target.value.toUpperCase(),
                                    }))
                                }
                                placeholder="Ej. COCINA1"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold uppercase text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        {/* Connection Info */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Dirección IP *
                            </label>
                            <input
                                type="text"
                                value={form.ip_address}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        ip_address: e.target.value,
                                    }))
                                }
                                placeholder="192.168.1.100"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Puerto
                            </label>
                            <input
                                type="number"
                                value={form.port}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        port:
                                            parseInt(e.target.value, 10) ||
                                            9100,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        {/* Hardware Config */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Tipo de Impresión
                            </label>
                            <select
                                value={form.printer_type}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        printer_type: e.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                                {PRINTER_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Ancho de Papel (mm)
                            </label>
                            <input
                                type="number"
                                value={form.paper_width}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        paper_width:
                                            parseInt(e.target.value, 10) || 80,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Caracteres por Línea
                            </label>
                            <input
                                type="number"
                                value={form.characters_per_line}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        characters_per_line:
                                            parseInt(e.target.value, 10) || 48,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        {/* Roles Section */}
                        <div className="flex flex-col gap-4 md:col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-t border-slate-100 pt-4 dark:border-slate-800">
                                Configuración de Roles (Uso)
                            </label>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                                {[
                                    { key: "is_kitchen", label: "Cocina" },
                                    { key: "is_bar", label: "Bar" },
                                    { key: "is_cashier", label: "Caja" },
                                    { key: "is_receipt", label: "Ticket" },
                                    { key: "is_invoice", label: "Factura" },
                                ].map((role) => (
                                    <label
                                        key={role.key}
                                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!!(form as any)[role.key]}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    [role.key]:
                                                        e.target.checked,
                                                }))
                                            }
                                            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                                        />
                                        <span className="text-[10px] font-black uppercase tracking-tight text-slate-600 dark:text-slate-400">
                                            {role.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="mt-8 flex gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={creating}
                            className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={creating}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg ${
                                creating
                                    ? "bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none"
                                    : "bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 active:translate-y-0"
                            }`}
                        >
                            {creating ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    <span>Creando...</span>
                                </>
                            ) : (
                                "Crear Impresora"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintersCreate;
