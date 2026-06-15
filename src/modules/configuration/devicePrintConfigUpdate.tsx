import React, { useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { UPDATE_DEVICE_PRINT_CONFIG } from "../../graphql/mutations";
import {
    DEVICE_PRINT_TYPE_OPTIONS,
    isCategoryPrintType,
} from "../../constants/devicePrintTypes";
import type { DevicePrintConfigRow } from "./devicePrintConfigList";

export type DevicePrintConfigUpdateProps = {
    open: boolean;
    config: DevicePrintConfigRow | null;
    printers: { id: string; name: string }[];
    categories: { id: string; name: string }[];
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
};

type EditFormState = {
    deviceName: string;
    printType: string;
    categoryId: string;
    printerId: string;
    copies: number;
    priority: number;
    useIntegratedPrinter: boolean;
    useBluetoothPrinter: boolean;
    isActive: boolean;
};

function formFromConfig(row: DevicePrintConfigRow): EditFormState {
    return {
        deviceName: row.deviceName,
        printType: row.printType,
        categoryId: row.category?.id ?? "",
        printerId: row.printer?.id ?? "",
        copies: row.copies ?? 1,
        priority: row.priority ?? 0,
        useIntegratedPrinter: row.useIntegratedPrinter ?? false,
        useBluetoothPrinter: row.useBluetoothPrinter ?? false,
        isActive: row.isActive ?? true,
    };
}

const DevicePrintConfigUpdate: React.FC<DevicePrintConfigUpdateProps> = ({
    open,
    config,
    printers,
    categories,
    onClose,
    onSuccess,
    onError,
}) => {
    const [form, setForm] = useState<EditFormState | null>(null);

    useEffect(() => {
        if (open && config) {
            setForm(formFromConfig(config));
        } else if (!open) {
            setForm(null);
        }
    }, [open, config]);

    const [updateConfig, { loading: updating }] = useMutation(
        UPDATE_DEVICE_PRINT_CONFIG,
        {
            onCompleted: (res) => {
                const r = res?.updateDevicePrintConfig;
                if (r?.success) {
                    onSuccess(r.message ?? "Configuración actualizada");
                    onClose();
                } else {
                    onError(r?.message ?? "No se pudo actualizar");
                }
            },
            onError: (e) => onError(e.message),
        },
    );

    if (!open || !config || !form) {
        return null;
    }

    const submitUpdate = () => {
        if (isCategoryPrintType(form.printType) && !form.categoryId) {
            onError(
                "Debe seleccionar una categoría cuando el tipo es Categoría de Producto.",
            );
            return;
        }
        updateConfig({
            variables: {
                configId: config.id,
                deviceName: form.deviceName.trim(),
                printType: form.printType,
                categoryId: form.categoryId || null,
                printerId: form.printerId || null,
                copies: form.copies,
                priority: form.priority,
                useIntegratedPrinter: form.useIntegratedPrinter,
                useBluetoothPrinter: form.useBluetoothPrinter,
                isActive: form.isActive,
            },
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        >
            <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="mb-1 text-lg font-bold text-slate-800 dark:text-slate-100">
                    Editar configuración
                </h3>
                <p className="mb-4 font-mono text-[10px] text-slate-400">
                    {config.deviceId}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                            Nombre del dispositivo
                        </label>
                        <input
                            type="text"
                            value={form.deviceName}
                            onChange={(e) =>
                                setForm((f) =>
                                    f
                                        ? {
                                              ...f,
                                              deviceName: e.target.value,
                                          }
                                        : f,
                                )
                            }
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                            Tipo de impresión
                        </label>
                        <select
                            value={form.printType}
                            onChange={(e) => {
                                const printType = e.target.value;
                                setForm((f) =>
                                    f
                                        ? {
                                              ...f,
                                              printType,
                                              categoryId: isCategoryPrintType(
                                                  printType,
                                              )
                                                  ? f.categoryId
                                                  : "",
                                          }
                                        : f,
                                );
                            }}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                        >
                            {DEVICE_PRINT_TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                            Impresora de red (opcional)
                        </label>
                        <select
                            value={form.printerId}
                            onChange={(e) =>
                                setForm((f) =>
                                    f
                                        ? {
                                              ...f,
                                              printerId: e.target.value,
                                          }
                                        : f,
                                )
                            }
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                        >
                            <option value="">— Sin asignar —</option>
                            {printers.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    {isCategoryPrintType(form.printType) && (
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                Categoría de producto *
                            </label>
                            <select
                                value={form.categoryId}
                                onChange={(e) =>
                                    setForm((f) =>
                                        f
                                            ? {
                                                  ...f,
                                                  categoryId: e.target.value,
                                              }
                                            : f,
                                    )
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                            >
                                <option value="">
                                    — Seleccione categoría —
                                </option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                            Copias
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={form.copies}
                            onChange={(e) =>
                                setForm((f) =>
                                    f
                                        ? {
                                              ...f,
                                              copies: Math.max(
                                                  1,
                                                  Number(e.target.value) || 1,
                                              ),
                                          }
                                        : f,
                                )
                            }
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                            Prioridad
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={form.priority}
                            onChange={(e) =>
                                setForm((f) =>
                                    f
                                        ? {
                                              ...f,
                                              priority: Math.max(
                                                  0,
                                                  Number(e.target.value) || 0,
                                              ),
                                          }
                                        : f,
                                )
                            }
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                    </div>
                    <div className="flex flex-col gap-2 sm:col-span-2">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.useIntegratedPrinter}
                                onChange={(e) =>
                                    setForm((f) =>
                                        f
                                            ? {
                                                  ...f,
                                                  useIntegratedPrinter:
                                                      e.target.checked,
                                              }
                                            : f,
                                    )
                                }
                            />
                            Usar impresora integrada / local (USB en esta PC)
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.useBluetoothPrinter}
                                onChange={(e) =>
                                    setForm((f) =>
                                        f
                                            ? {
                                                  ...f,
                                                  useBluetoothPrinter:
                                                      e.target.checked,
                                              }
                                            : f,
                                    )
                                }
                            />
                            Usar impresora Bluetooth
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) =>
                                    setForm((f) =>
                                        f
                                            ? {
                                                  ...f,
                                                  isActive: e.target.checked,
                                              }
                                            : f,
                                    )
                                }
                            />
                            Activo
                        </label>
                    </div>
                </div>

                <div className="mt-6 flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={updating}
                        onClick={submitUpdate}
                        className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {updating ? "Guardando…" : "Guardar"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DevicePrintConfigUpdate;
