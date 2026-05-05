import React, { useCallback, useEffect, useState } from "react";
import {
    fetchSystemPrinters,
    type SystemPrinterInfo,
} from "../../utils/systemPrinters";
import {
    getIntegratedPrinterCashUiEnabled,
    setIntegratedPrinterCashUiEnabled,
    getLocalTicketPrinterStorage,
    setLocalTicketPrinterStorage,
} from "../../utils/localPrinterPreference";

function optionsHint(opts?: Record<string, string>): string {
    if (!opts || Object.keys(opts).length === 0) return "—";
    const entries = Object.entries(opts);
    if (entries.length <= 3) {
        return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
    }
    return `${entries.length} opciones (ver detalle en sistema)`;
}

const LocalPrinters: React.FC = () => {
    const [printers, setPrinters] = useState<SystemPrinterInfo[]>([]);
    const [defaultPrinterName, setDefaultPrinterName] = useState<string | null>(
        null,
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [integratedPrinterCashUi, setIntegratedPrinterCashUi] = useState(() =>
        getIntegratedPrinterCashUiEnabled(),
    );
    const [selectedPrinterName, setSelectedPrinterName] = useState(() =>
        getLocalTicketPrinterStorage(),
    );

    useEffect(() => {
        const sync = () => {
            setIntegratedPrinterCashUi(getIntegratedPrinterCashUiEnabled());
            setSelectedPrinterName(getLocalTicketPrinterStorage());
        };
        window.addEventListener("sumapp-integrated-printer-cash-ui", sync);
        window.addEventListener("storage", sync);
        return () => {
            window.removeEventListener(
                "sumapp-integrated-printer-cash-ui",
                sync,
            );
            window.removeEventListener("storage", sync);
        };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchSystemPrinters();
            if (res.ok) {
                setPrinters(res.printers);
                setDefaultPrinterName(res.defaultPrinterName ?? null);
                if (res.printers.length === 0) {
                    setError("No se encontraron impresoras en el sistema.");
                }
            } else {
                setPrinters([]);
                setDefaultPrinterName(null);
                setError(
                    res.message || "No se pudo obtener la lista de impresoras.",
                );
            }
        } catch (e: unknown) {
            setPrinters([]);
            setDefaultPrinterName(null);
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    // Cargar impresoras al montar
    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="flex flex-col gap-6 p-1 transition-colors duration-200 md:p-0">
            {/* Header Section */}
            <div className="flex flex-col gap-1 px-2 md:px-0">
                <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-2xl">
                    Impresoras Locales
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 md:text-sm">
                    Configura la impresora física conectada directamente a esta
                    PC vía USB o integrada.
                </p>
            </div>

            {/* Main Configuration Card */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
                <div className="p-6">
                    <label className="flex cursor-pointer items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
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
                                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                />
                            </svg>
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    Impresora integrada en esta caja
                                </span>
                                <input
                                    type="checkbox"
                                    checked={integratedPrinterCashUi}
                                    onChange={(e) => {
                                        const on = e.target.checked;
                                        setIntegratedPrinterCashUi(on);
                                        setIntegratedPrinterCashUiEnabled(on);
                                    }}
                                    className="h-5 w-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                                Activa esta opción si el equipo tiene una
                                impresora térmica conectada por USB o integrada.
                                Esto permite la impresión directa sin pasar por
                                el servidor intermedio.
                            </p>
                        </div>
                    </label>

                    {integratedPrinterCashUi && (
                        <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            {/* Info Alert */}
                            <div className="mb-6 flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-[11px] text-indigo-800 dark:border-indigo-900/30 dark:bg-indigo-950/20 dark:text-indigo-400">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-3 w-3"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={3}
                                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </div>
                                <p className="font-medium leading-relaxed">
                                    <strong>Importante:</strong> El
                                    administrador debe haber habilitado{" "}
                                    <code>use_integrated_printer</code> en el
                                    servidor para este equipo (MAC) y para cada
                                    tipo de documento.
                                </p>
                            </div>

                            {/* Printer Selector */}
                            <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    Dispositivo de Salida para Tickets
                                </label>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={selectedPrinterName}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            setSelectedPrinterName(name);
                                            setLocalTicketPrinterStorage(name);
                                        }}
                                        disabled={loading}
                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                    >
                                        <option value="">
                                            — Usar predeterminada del sistema —
                                        </option>
                                        {printers.map((p, i) => (
                                            <option
                                                key={`${p.name}-${i}`}
                                                value={p.name}
                                            >
                                                {p.displayName || p.name}{" "}
                                                {p.isSystemDefault
                                                    ? "(Predeterminada)"
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => void load()}
                                        disabled={loading}
                                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 transition-all hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className={`h-5 w-5 ${loading ? "animate-spin text-indigo-500" : ""}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                            />
                                        </svg>
                                    </button>
                                </div>

                                {!selectedPrinterName && defaultPrinterName && (
                                    <div className="flex items-center gap-1.5 px-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">
                                            Actualmente se usará:{" "}
                                            {defaultPrinterName}
                                        </p>
                                    </div>
                                )}
                                {selectedPrinterName &&
                                    !printers.find(
                                        (p) => p.name === selectedPrinterName,
                                    ) &&
                                    !loading && (
                                        <div className="flex items-center gap-1.5 px-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">
                                                La impresora seleccionada no
                                                está conectada
                                            </p>
                                        </div>
                                    )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 animate-in fade-in slide-in-from-top-2 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    {error}
                </div>
            )}

            {/* System Printers Details */}
            <div className="flex flex-col gap-4">
                <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 transition-transform group-open:rotate-180"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                        <span>Ver detalles técnicos de impresoras</span>
                    </summary>

                    <div className="mt-4 overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-100/50 dark:border-slate-800 dark:bg-slate-800/50">
                                        <th className="px-6 py-3 font-black uppercase text-slate-500 dark:text-slate-400">
                                            Estado
                                        </th>
                                        <th className="px-6 py-3 font-black uppercase text-slate-500 dark:text-slate-400">
                                            Nombre (SO)
                                        </th>
                                        <th className="px-6 py-3 font-black uppercase text-slate-500 dark:text-slate-400">
                                            Descripción
                                        </th>
                                        <th className="px-6 py-3 font-black uppercase text-slate-500 dark:text-slate-400">
                                            Opciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {printers.map((p, i) => (
                                        <tr
                                            key={`${p.name}-${i}`}
                                            className="group transition-colors hover:bg-white dark:hover:bg-slate-800/30"
                                        >
                                            <td className="px-6 py-4">
                                                {p.isSystemDefault ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        Predeterminada
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-700">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                                        {p.displayName ||
                                                            p.name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        {p.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                                {p.description || "—"}
                                            </td>
                                            <td
                                                className="max-w-[200px] px-6 py-4 text-[10px] italic text-slate-400 truncate"
                                                title={optionsHint(p.options)}
                                            >
                                                {optionsHint(p.options)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    );
};

export default LocalPrinters;
