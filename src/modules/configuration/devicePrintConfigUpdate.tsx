import React, { useEffect, useMemo, useState } from "react";
import { useMutation } from "@apollo/client";
import {
    CREATE_DEVICE_PRINT_CONFIG,
    UPDATE_DEVICE_PRINT_CONFIG,
} from "../../graphql/mutations";
import { devicePrintTypeLabel, isCategoryPrintType } from "../../constants/devicePrintTypes";
import {
    COMPACT_PRINT_TYPES,
    type DevicePrintConfigCreateProps,
} from "./devicePrintConfigCreate";
import type {
    DevicePrintConfigDeviceGroup,
    DevicePrintConfigRow,
} from "./devicePrintConfigList";

type PrintSlotState = {
    configId: string | null;
    printerId: string;
    copies: number;
    priority: number;
    useIntegratedPrinter: boolean;
    useBluetoothPrinter: boolean;
    isActive: boolean;
    categoryId: string;
};

const emptySlot = (): PrintSlotState => ({
    configId: null,
    printerId: "",
    copies: 1,
    priority: 0,
    useIntegratedPrinter: false,
    useBluetoothPrinter: false,
    isActive: true,
    categoryId: "",
});

export type DevicePrintConfigUpdateProps = {
    open: boolean;
    branchId: string | undefined;
    branchName?: string;
    group: DevicePrintConfigDeviceGroup | null;
    printers: DevicePrintConfigCreateProps["printers"];
    categories: { id: string; name: string }[];
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
};

function slotFromRow(row: DevicePrintConfigRow): PrintSlotState {
    return {
        configId: row.id,
        printerId: row.printer?.id ?? "",
        copies: row.copies ?? 1,
        priority: row.priority ?? 0,
        useIntegratedPrinter: row.useIntegratedPrinter ?? false,
        useBluetoothPrinter: row.useBluetoothPrinter ?? false,
        isActive: row.isActive ?? true,
        categoryId: row.category?.id ?? "",
    };
}

function buildInitialSlots(
    configs: DevicePrintConfigRow[],
): Record<string, PrintSlotState> {
    const byType = new Map(configs.map((c) => [c.printType, c]));
    return Object.fromEntries(
        COMPACT_PRINT_TYPES.map((t) => {
            const row = byType.get(t.value);
            return [t.value, row ? slotFromRow(row) : emptySlot()];
        }),
    );
}

const DevicePrintConfigUpdate: React.FC<DevicePrintConfigUpdateProps> = ({
    open,
    branchId,
    branchName,
    group,
    printers,
    categories,
    onClose,
    onSuccess,
    onError,
}) => {
    const [deviceName, setDeviceName] = useState("");
    const [slots, setSlots] = useState<Record<string, PrintSlotState>>(() =>
        Object.fromEntries(
            COMPACT_PRINT_TYPES.map((t) => [t.value, emptySlot()]),
        ),
    );
    const [extraConfigs, setExtraConfigs] = useState<
        (PrintSlotState & { printType: string })[]
    >([]);
    const [saving, setSaving] = useState(false);

    const compactTypeSet = useMemo(
        () => new Set<string>(COMPACT_PRINT_TYPES.map((t) => t.value)),
        [],
    );

    useEffect(() => {
        if (open && group) {
            setDeviceName(group.deviceName);
            setSlots(buildInitialSlots(group.configs));
            setExtraConfigs(
                group.configs
                    .filter((c) => !compactTypeSet.has(c.printType))
                    .map((c) => ({
                        ...slotFromRow(c),
                        printType: c.printType,
                    })),
            );
        } else if (!open) {
            setDeviceName("");
            setExtraConfigs([]);
        }
    }, [open, group, compactTypeSet]);

    const [createConfig] = useMutation(CREATE_DEVICE_PRINT_CONFIG);
    const [updateConfig] = useMutation(UPDATE_DEVICE_PRINT_CONFIG);

    if (!open || !group) {
        return null;
    }

    const updateSlot = (printType: string, patch: Partial<PrintSlotState>) => {
        setSlots((prev) => ({
            ...prev,
            [printType]: { ...prev[printType], ...patch },
        }));
    };

    const updateExtra = (
        index: number,
        patch: Partial<PrintSlotState>,
    ) => {
        setExtraConfigs((prev) =>
            prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
        );
    };

    const saveSlot = async (
        printType: string,
        slot: PrintSlotState,
        categoryId: string | null,
    ): Promise<string | null> => {
        const name = deviceName.trim();
        if (!branchId || !name) {
            return "Nombre del dispositivo obligatorio.";
        }

        if (slot.configId) {
            const { data } = await updateConfig({
                variables: {
                    configId: slot.configId,
                    deviceName: name,
                    printType,
                    categoryId,
                    printerId: slot.printerId || null,
                    copies: slot.copies,
                    priority: slot.priority,
                    useIntegratedPrinter: slot.useIntegratedPrinter,
                    useBluetoothPrinter: slot.useBluetoothPrinter,
                    isActive: slot.isActive,
                },
            });
            const r = data?.updateDevicePrintConfig;
            if (!r?.success) {
                return `${devicePrintTypeLabel(printType)}: ${r?.message ?? "No se pudo actualizar"}`;
            }
            return null;
        }

        const { data } = await createConfig({
            variables: {
                branchId,
                deviceId: group.deviceId,
                deviceName: name,
                printType,
                categoryId,
                printerId: slot.printerId || null,
                copies: slot.copies,
                priority: slot.priority,
                useIntegratedPrinter: slot.useIntegratedPrinter,
                useBluetoothPrinter: slot.useBluetoothPrinter,
                isActive: slot.isActive,
            },
        });
        const r = data?.createDevicePrintConfig;
        if (!r?.success) {
            return `${devicePrintTypeLabel(printType)}: ${r?.message ?? "No se pudo crear"}`;
        }
        return null;
    };

    const submit = async () => {
        if (!branchId) return;
        const name = deviceName.trim();
        if (!name) {
            onError("El nombre del dispositivo es obligatorio.");
            return;
        }

        for (const extra of extraConfigs) {
            if (
                isCategoryPrintType(extra.printType) &&
                !extra.categoryId
            ) {
                onError(
                    `Seleccione categoría para ${devicePrintTypeLabel(extra.printType)}.`,
                );
                return;
            }
        }

        setSaving(true);
        const errors: string[] = [];

        for (const { value: printType } of COMPACT_PRINT_TYPES) {
            const slot = slots[printType] ?? emptySlot();
            try {
                const err = await saveSlot(printType, slot, null);
                if (err) errors.push(err);
            } catch (e) {
                const msg =
                    e instanceof Error ? e.message : "Error desconocido";
                errors.push(`${printType}: ${msg}`);
            }
        }

        for (const extra of extraConfigs) {
            try {
                const err = await saveSlot(
                    extra.printType,
                    extra,
                    extra.categoryId || null,
                );
                if (err) errors.push(err);
            } catch (e) {
                const msg =
                    e instanceof Error ? e.message : "Error desconocido";
                errors.push(`${extra.printType}: ${msg}`);
            }
        }

        setSaving(false);

        if (errors.length === 0) {
            onSuccess("Configuración del dispositivo actualizada.");
            onClose();
        } else {
            onError(errors.join(" · "));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-3 backdrop-blur-sm md:p-4">
            <div
                className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="border-b border-slate-800 bg-slate-900/90 px-4 py-3 md:px-5">
                    <h3 className="text-base font-bold text-slate-100 md:text-lg">
                        Editar dispositivo
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                        Ajuste impresoras por tipo de documento para este
                        equipo.
                    </p>
                </div>

                <div className="overflow-y-auto px-4 py-4 md:px-5">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                <span aria-hidden>📍</span> Sede
                            </label>
                            <input
                                type="text"
                                readOnly
                                value={branchName ?? "—"}
                                className="w-full cursor-default rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-300"
                            />
                        </div>
                        <div>
                            <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                <span aria-hidden>🪪</span> MAC / ID dispositivo
                            </label>
                            <input
                                type="text"
                                readOnly
                                value={group.deviceId}
                                className="w-full cursor-default rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 font-mono text-sm text-slate-300"
                            />
                        </div>
                        <div>
                            <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                <span aria-hidden>🏷️</span> Nombre dispositivo
                            </label>
                            <input
                                type="text"
                                value={deviceName}
                                onChange={(e) => setDeviceName(e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                            />
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {COMPACT_PRINT_TYPES.map((type) => {
                            const slot = slots[type.value] ?? emptySlot();
                            return (
                                <div
                                    key={type.value}
                                    className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"
                                >
                                    <div
                                        className={`flex items-center gap-2 border-b px-3 py-2 text-sm font-bold ${type.headerClass}`}
                                    >
                                        <span aria-hidden>{type.icon}</span>
                                        {type.label}
                                    </div>
                                    <div className="space-y-3 p-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <select
                                                value={slot.printerId}
                                                onChange={(e) =>
                                                    updateSlot(type.value, {
                                                        printerId:
                                                            e.target.value,
                                                    })
                                                }
                                                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                                            >
                                                <option value="">
                                                    — Red / Raspberry —
                                                </option>
                                                {printers.map((p) => (
                                                    <option
                                                        key={p.id}
                                                        value={p.id}
                                                    >
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                min={1}
                                                max={10}
                                                title="Copias"
                                                value={slot.copies}
                                                onChange={(e) =>
                                                    updateSlot(type.value, {
                                                        copies: Math.max(
                                                            1,
                                                            Number(
                                                                e.target.value,
                                                            ) || 1,
                                                        ),
                                                    })
                                                }
                                                className="w-12 rounded-lg border border-slate-700 bg-slate-950 px-1 py-1.5 text-center text-xs text-slate-200"
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                title="Prioridad"
                                                value={slot.priority}
                                                onChange={(e) =>
                                                    updateSlot(type.value, {
                                                        priority: Math.max(
                                                            0,
                                                            Number(
                                                                e.target.value,
                                                            ) || 0,
                                                        ),
                                                    })
                                                }
                                                className="w-12 rounded-lg border border-slate-700 bg-slate-950 px-1 py-1.5 text-center text-xs text-slate-200"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                                            <label className="flex cursor-pointer items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        slot.useIntegratedPrinter
                                                    }
                                                    onChange={(e) =>
                                                        updateSlot(type.value, {
                                                            useIntegratedPrinter:
                                                                e.target.checked,
                                                        })
                                                    }
                                                    className="rounded border-slate-600"
                                                />
                                                Integrada
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        slot.useBluetoothPrinter
                                                    }
                                                    onChange={(e) =>
                                                        updateSlot(type.value, {
                                                            useBluetoothPrinter:
                                                                e.target.checked,
                                                        })
                                                    }
                                                    className="rounded border-slate-600"
                                                />
                                                Bluetooth
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={slot.isActive}
                                                    onChange={(e) =>
                                                        updateSlot(type.value, {
                                                            isActive:
                                                                e.target.checked,
                                                        })
                                                    }
                                                    className="rounded border-slate-600"
                                                />
                                                Activo
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {extraConfigs.length > 0 && (
                        <div className="mt-6 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Otras reglas en este dispositivo
                            </h4>
                            {extraConfigs.map((extra, index) => (
                                <div
                                    key={extra.configId ?? `${extra.printType}-${index}`}
                                    className="rounded-xl border border-slate-800 bg-slate-900/40 p-3"
                                >
                                    <p className="mb-2 text-sm font-semibold text-slate-200">
                                        {devicePrintTypeLabel(extra.printType)}
                                        {extra.categoryId &&
                                            categories.find(
                                                (c) => c.id === extra.categoryId,
                                            )?.name &&
                                            ` · ${categories.find((c) => c.id === extra.categoryId)?.name}`}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {isCategoryPrintType(extra.printType) && (
                                            <select
                                                value={extra.categoryId}
                                                onChange={(e) =>
                                                    updateExtra(index, {
                                                        categoryId:
                                                            e.target.value,
                                                    })
                                                }
                                                className="min-w-[8rem] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                                            >
                                                <option value="">
                                                    — Categoría —
                                                </option>
                                                {categories.map((c) => (
                                                    <option
                                                        key={c.id}
                                                        value={c.id}
                                                    >
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <select
                                            value={extra.printerId}
                                            onChange={(e) =>
                                                updateExtra(index, {
                                                    printerId: e.target.value,
                                                })
                                            }
                                            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                                        >
                                            <option value="">
                                                — Sin impresora —
                                            </option>
                                            {printers.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 border-t border-slate-800 bg-slate-900/90 p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={saving || !branchId}
                        onClick={() => void submit()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                        {saving ? "Guardando…" : "💾 Guardar configuración"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DevicePrintConfigUpdate;
