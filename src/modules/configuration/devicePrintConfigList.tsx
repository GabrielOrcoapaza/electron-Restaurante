import React from "react";
import { devicePrintTypeLabel } from "../../constants/devicePrintTypes";

export type DevicePrintConfigRow = {
    id: string;
    deviceId: string;
    deviceName: string;
    printType: string;
    copies: number;
    priority: number;
    useIntegratedPrinter: boolean;
    useBluetoothPrinter: boolean;
    isActive: boolean;
    category?: { id: string; name: string } | null;
    printer?: { id: string; name: string } | null;
};

export type DevicePrintConfigListProps = {
    configs: DevicePrintConfigRow[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onEdit: (row: DevicePrintConfigRow) => void;
};

const DevicePrintConfigList: React.FC<DevicePrintConfigListProps> = ({
    configs,
    loading,
    selectedIds,
    onToggleSelect,
    onEdit,
}) => {
    return (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {loading ? (
                <p className="p-8 text-center text-sm text-slate-500">
                    Cargando…
                </p>
            ) : configs.length === 0 ? (
                <p className="p-12 text-center text-sm text-slate-500">
                    No hay configuraciones. Cree una regla por dispositivo y
                    tipo de impresión.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                            <tr>
                                <th className="w-10 px-3 py-3" />
                                <th className="px-3 py-3">Dispositivo</th>
                                <th className="px-3 py-3">Tipo</th>
                                <th className="px-3 py-3">Impresora</th>
                                <th className="px-3 py-3">Categoría</th>
                                <th className="px-3 py-3">Opciones</th>
                                <th className="px-3 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {configs.map((row) => (
                                <tr
                                    key={row.id}
                                    className={
                                        row.isActive ? "" : "opacity-50"
                                    }
                                >
                                    <td className="px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(row.id)}
                                            onChange={() =>
                                                onToggleSelect(row.id)
                                            }
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                                            {row.deviceName}
                                        </div>
                                        <div className="font-mono text-[10px] text-slate-400">
                                            {row.deviceId}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        {devicePrintTypeLabel(row.printType)}
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.printer?.name ?? "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.category?.name ?? "—"}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500">
                                        {row.copies}c · pri {row.priority}
                                        {row.useIntegratedPrinter && " · local"}
                                        {row.useBluetoothPrinter && " · BT"}
                                    </td>
                                    <td className="px-3 py-2">
                                        <button
                                            type="button"
                                            onClick={() => onEdit(row)}
                                            className="text-xs font-bold text-indigo-600 hover:underline"
                                        >
                                            Editar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DevicePrintConfigList;
