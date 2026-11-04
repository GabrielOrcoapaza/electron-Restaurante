import React, { useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { CREATE_DEVICE_PRINT_CONFIG } from "../../graphql/mutations";

/** Tipos incluidos en el formulario compacto (admin Django). */
const COMPACT_PRINT_TYPES = [
    {
        value: "PRECUENTA",
        label: "Precuenta",
        icon: "🎫",
        headerClass:
            "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
        value: "CUENTA",
        label: "Cuenta",
        icon: "🔔",
        headerClass:
            "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    {
        value: "BOLETA",
        label: "Boleta",
        icon: "🧾",
        headerClass:
            "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
        value: "FACTURA",
        label: "Factura",
        icon: "📄",
        headerClass:
            "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    },
] as const;

type PrintSlotState = {
    printerId: string;
    copies: number;
    priority: number;
    useIntegratedPrinter: boolean;
    useBluetoothPrinter: boolean;
};

const emptySlot = (): PrintSlotState => ({
    printerId: "",
    copies: 1,
    priority: 0,
    useIntegratedPrinter: false,
    useBluetoothPrinter: false,
});

export type DevicePrintConfigCreateProps = {
    open: boolean;
    branchId: string | undefined;
    branchName?: string;
    printers: { id: string; name: string }[];
    thisDeviceId: string | null;
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
};

const DevicePrintConfigCreate: React.FC<DevicePrintConfigCreateProps> = ({
    open,
    branchId,
    branchName,
    printers,
    thisDeviceId,
    onClose,
    onSuccess,
    onError,
}) => {
    const [deviceId, setDeviceId] = useState("");
    const [deviceName, setDeviceName] = useState("");
    const [slots, setSlots] = useState<Record<string, PrintSlotState>>(() =>
        Object.fromEntries(
            COMPACT_PRINT_TYPES.map((t) => [t.value, emptySlot()]),
        ),
    );
    const [saving, setSaving] = useState(false);

    const [createConfig] = useMutation(CREATE_DEVICE_PRINT_CONFIG);

    useEffect(() => {
        if (open) {
            setDeviceId("");
            setDeviceName("");
            setSlots(
                Object.fromEntries(
                    COMPACT_PRINT_TYPES.map((t) => [t.value, emptySlot()]),
                ),
            );
        }
    }, [open]);

    if (!open) {
        return null;
    }

    const applyThisDevice = () => {
        if (!thisDeviceId) {
            onError(
                "No se pudo obtener el ID de este equipo (MAC o ID local).",
            );
            return;
        }
        setDeviceId(thisDeviceId);
        setDeviceName(
            (prev) => prev.trim() || `PC ${thisDeviceId.slice(0, 8)}…`,
        );
    };

    const updateSlot = (
        printType: string,
        patch: Partial<PrintSlotState>,
    ) => {
        setSlots((prev) => ({
            ...prev,
            [printType]: { ...prev[printType], ...patch },
        }));
    };

    const submit = async () => {
        if (!branchId) return;
        const id = deviceId.trim();
        const name = deviceName.trim();
        if (!id || !name) {
            onError("MAC / ID y nombre del dispositivo son obligatorios.");
            return;
        }

        setSaving(true);
        let created = 0;
        const errors: string[] = [];

        for (const { value: printType } of COMPACT_PRINT_TYPES) {
            const slot = slots[printType] ?? emptySlot();
            try {
                const { data } = await createConfig({
                    variables: {
                        branchId,
                        deviceId: id,
                        deviceName: name,
                        printType,
                        categoryId: null,
                        printerId: slot.printerId || null,
                        copies: slot.copies,
                        priority: slot.priority,
                        useIntegratedPrinter: slot.useIntegratedPrinter,
                        useBluetoothPrinter: slot.useBluetoothPrinter,
                        isActive: true,
                    },
                });
                const r = data?.createDevicePrintConfig;
                if (r?.success) {
                    created += 1;
                } else {
                    errors.push(
                        `${printType}: ${r?.message ?? "No se pudo crear"}`,
                    );
                }
            } catch (e) {
                const msg =
                    e instanceof Error ? e.message : "Error desconocido";
                errors.push(`${printType}: ${msg}`);
            }
        }

        setSaving(false);

        if (created === COMPACT_PRINT_TYPES.length) {
            onSuccess(
                `Dispositivo configurado: ${created} regla(s) creadas.`,
            );
            onClose();
        } else if (created > 0) {
            onError(
                `Se crearon ${created} de ${COMPACT_PRINT_TYPES.length}. ${errors.join(" · ")}`,
            );
            onClose();
        } else {
            onError(errors.join(" · ") || "No se pudo guardar la configuración.");
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
                        Configuración de impresión (compacta)
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                        Registre el dispositivo y asigne impresoras por tipo de
                        documento, como en el admin.
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
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={deviceId}
                                    onChange={(e) =>
                                        setDeviceId(e.target.value)
                                    }
                                    placeholder="dc:a6:32…"
                                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600"
                                />
                                <button
                                    type="button"
                                    onClick={applyThisDevice}
                                    title="Usar MAC o ID de este equipo"
                                    className="shrink-0 rounded-lg border border-indigo-500/50 bg-indigo-500/15 px-2.5 py-2 text-[10px] font-bold uppercase text-indigo-300 hover:bg-indigo-500/25"
                                >
                                    Este PC
                                </button>
                            </div>
                            {thisDeviceId && (
                                <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
                                    Detectado: {thisDeviceId}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                <span aria-hidden>🏷️</span> Nombre dispositivo
                            </label>
                            <input
                                type="text"
                                value={deviceName}
                                onChange={(e) =>
                                    setDeviceName(e.target.value)
                                }
                                placeholder="Tablet 01"
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {COMPACT_PRINT_TYPES.map((type) => {
                            const slot =
                                slots[type.value] ?? emptySlot();
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
                                                        updateSlot(
                                                            type.value,
                                                            {
                                                                useIntegratedPrinter:
                                                                    e.target
                                                                        .checked,
                                                            },
                                                        )
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
                                                        updateSlot(
                                                            type.value,
                                                            {
                                                                useBluetoothPrinter:
                                                                    e.target
                                                                        .checked,
                                                            },
                                                        )
                                                    }
                                                    className="rounded border-slate-600"
                                                />
                                                Bluetooth
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <p className="mt-3 text-[11px] text-slate-500">
                        Comandas y categorías de producto se agregan después con
                        otra regla o desde edición.
                    </p>
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

export default DevicePrintConfigCreate;
