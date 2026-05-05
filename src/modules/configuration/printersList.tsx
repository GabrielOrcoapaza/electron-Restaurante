import React from "react";

export interface Printer {
    id: string;
    name: string;
    code: string;
    ipAddress?: string;
    ip_address?: string;
    port?: number;
    printer_type?: string;
    printerType?: string;
    paper_width?: number;
    paperWidth?: number;
    characters_per_line?: number;
    charactersPerLine?: number;
    encoding?: string;
    is_kitchen?: boolean;
    isKitchen?: boolean;
    is_bar?: boolean;
    isBar?: boolean;
    is_cashier?: boolean;
    isCashier?: boolean;
    is_receipt?: boolean;
    isReceipt?: boolean;
    is_invoice?: boolean;
    isInvoice?: boolean;
    is_active?: boolean;
    isActive?: boolean;
}

interface PrintersListProps {
    printers: Printer[];
    onEdit: (printer: Printer) => void;
    onOpenPermissions: (printer: Printer) => void;
    onOpenCreate: () => void;
}

const getP = (p: Printer, key: keyof Printer) => p[key];
const pVal = (p: Printer, camel: string, snake: string) =>
    getP(p, camel as keyof Printer) ?? getP(p, snake as keyof Printer);


const PrintersList: React.FC<PrintersListProps> = ({
    printers,
    onEdit,
    onOpenPermissions,
    onOpenCreate,
}) => {
    return (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
            {/* List Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/30">
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
                                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                            />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                            Impresoras Registradas
                        </h3>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                            Total: {printers.length} dispositivos
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onOpenCreate}
                    className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0"
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
                            strokeWidth={3}
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    <span>Añadir Impresora</span>
                </button>
            </div>

            {/* List Content */}
            <div className="p-0">
                {printers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-16 w-16 opacity-10"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1}
                                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                            />
                        </svg>
                        <p className="text-sm font-medium">
                            No se han encontrado impresoras configuradas.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-800/20">
                                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">
                                        Dispositivo / Código
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">
                                        Conexión
                                    </th>
                                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">
                                        Uso Actual
                                    </th>
                                    <th className="px-6 py-4 text-center font-bold text-slate-500 dark:text-slate-400">
                                        Estado
                                    </th>
                                    <th className="px-6 py-4 text-right font-bold text-slate-500 dark:text-slate-400">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {printers.map((p) => {
                                    const isActive =
                                        pVal(p, "isActive", "is_active") !==
                                        false;
                                    const ip = pVal(
                                        p,
                                        "ipAddress",
                                        "ip_address",
                                    );
                                    const port = p.port;
                                    const type =
                                        pVal(
                                            p,
                                            "printerType",
                                            "printer_type",
                                        ) ?? "THERMAL";

                                    const roles = [
                                        {
                                            val: pVal(
                                                p,
                                                "isKitchen",
                                                "is_kitchen",
                                            ),
                                            label: "Cocina",
                                        },
                                        {
                                            val: pVal(p, "isBar", "is_bar"),
                                            label: "Bar",
                                        },
                                        {
                                            val: pVal(
                                                p,
                                                "isCashier",
                                                "is_cashier",
                                            ),
                                            label: "Caja",
                                        },
                                        {
                                            val: pVal(
                                                p,
                                                "isReceipt",
                                                "is_receipt",
                                            ),
                                            label: "Ticket",
                                        },
                                        {
                                            val: pVal(
                                                p,
                                                "isInvoice",
                                                "is_invoice",
                                            ),
                                            label: "Factura",
                                        },
                                    ].filter((r) => r.val);

                                    return (
                                        <tr
                                            key={p.id}
                                            className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 dark:text-slate-100">
                                                        {p.name}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                                                        {p.code}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                                        {ip ?? "No IP"}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        Puerto: {port ?? "9100"}{" "}
                                                        • {type}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {roles.length > 0 ? (
                                                        roles.map((r) => (
                                                            <span
                                                                key={r.label}
                                                                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                                            >
                                                                {r.label}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] italic text-slate-400">
                                                            Sin roles asignados
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                                                        isActive
                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                                    }`}
                                                >
                                                    <div
                                                        className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`}
                                                    />
                                                    {isActive
                                                        ? "Activa"
                                                        : "Inactiva"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onOpenPermissions(p)
                                                        }
                                                        className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-800 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                                    >
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            className="h-3.5 w-3.5"
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
                                                        Permisos
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onEdit(p)
                                                        }
                                                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-indigo-600 dark:hover:text-white"
                                                    >
                                                        Editar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrintersList;
