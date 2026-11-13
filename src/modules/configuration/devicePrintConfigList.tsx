import React, { useMemo } from "react";
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

export type DevicePrintConfigDeviceGroup = {
    deviceId: string;
    deviceName: string;
    configs: DevicePrintConfigRow[];
};

export function groupDevicePrintConfigs(
    configs: DevicePrintConfigRow[],
): DevicePrintConfigDeviceGroup[] {
    const map = new Map<string, DevicePrintConfigDeviceGroup>();

    for (const row of configs) {
        const key = row.deviceId.trim().toLowerCase();
        let group = map.get(key);
        if (!group) {
            group = {
                deviceId: row.deviceId,
                deviceName: row.deviceName,
                configs: [],
            };
            map.set(key, group);
        }
        group.configs.push(row);
        if (row.deviceName.trim()) {
            group.deviceName = row.deviceName;
        }
    }

    return [...map.values()].sort((a, b) =>
        a.deviceName.localeCompare(b.deviceName, "es"),
    );
}

function groupConfigIds(group: DevicePrintConfigDeviceGroup): string[] {
    return group.configs.map((c) => c.id);
}

function isGroupFullySelected(
    group: DevicePrintConfigDeviceGroup,
    selectedIds: Set<string>,
): boolean {
    const ids = groupConfigIds(group);
    return ids.length > 0 && ids.every((id) => selectedIds.has(id));
}

function isGroupPartiallySelected(
    group: DevicePrintConfigDeviceGroup,
    selectedIds: Set<string>,
): boolean {
    const ids = groupConfigIds(group);
    const selected = ids.filter((id) => selectedIds.has(id)).length;
    return selected > 0 && selected < ids.length;
}

export type DevicePrintConfigListProps = {
    configs: DevicePrintConfigRow[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleSelectDevice: (
        group: DevicePrintConfigDeviceGroup,
    ) => void;
    onEdit: (group: DevicePrintConfigDeviceGroup) => void;
};

const DevicePrintConfigList: React.FC<DevicePrintConfigListProps> = ({
    configs,
    loading,
    selectedIds,
    onToggleSelectDevice,
    onEdit,
}) => {
    const groups = useMemo(
        () => groupDevicePrintConfigs(configs),
        [configs],
    );

    return (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {loading ? (
                <p className="p-8 text-center text-sm text-slate-500">
                    Cargando…
                </p>
            ) : groups.length === 0 ? (
                <p className="p-12 text-center text-sm text-slate-500">
                    No hay configuraciones. Cree un dispositivo y asigne
                    impresoras por tipo de documento.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                            <tr>
                                <th className="w-10 px-3 py-3" />
                                <th className="px-3 py-3">Dispositivo</th>
                                <th className="px-3 py-3">Documentos</th>
                                <th className="px-3 py-3">Impresoras</th>
                                <th className="px-3 py-3">Reglas</th>
                                <th className="px-3 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {groups.map((group) => {
                                const allInactive = group.configs.every(
                                    (c) => !c.isActive,
                                );
                                const printerNames = [
                                    ...new Set(
                                        group.configs
                                            .map((c) => c.printer?.name)
                                            .filter(Boolean) as string[],
                                    ),
                                ];
                                return (
                                    <tr
                                        key={group.deviceId}
                                        className={
                                            allInactive ? "opacity-50" : ""
                                        }
                                    >
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={isGroupFullySelected(
                                                    group,
                                                    selectedIds,
                                                )}
                                                ref={(el) => {
                                                    if (el) {
                                                        el.indeterminate =
                                                            isGroupPartiallySelected(
                                                                group,
                                                                selectedIds,
                                                            );
                                                    }
                                                }}
                                                onChange={() =>
                                                    onToggleSelectDevice(group)
                                                }
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                                                {group.deviceName}
                                            </div>
                                            <div className="font-mono text-[10px] text-slate-400">
                                                {group.deviceId}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-wrap gap-1">
                                                {group.configs.map((c) => (
                                                    <span
                                                        key={c.id}
                                                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                                            c.isActive
                                                                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                                : "bg-slate-50 text-slate-400 line-through dark:bg-slate-900"
                                                        }`}
                                                    >
                                                        {devicePrintTypeLabel(
                                                            c.printType,
                                                        )}
                                                        {c.category?.name
                                                            ? ` (${c.category.name})`
                                                            : ""}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                            {printerNames.length === 0
                                                ? "—"
                                                : printerNames.join(", ")}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-500">
                                            {group.configs.length}
                                        </td>
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => onEdit(group)}
                                                className="text-xs font-bold text-indigo-600 hover:underline"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DevicePrintConfigList;
