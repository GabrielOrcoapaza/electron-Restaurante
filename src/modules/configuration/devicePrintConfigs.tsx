import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_CATEGORIES_BY_BRANCH,
    GET_DEVICE_PRINT_CONFIGS_BY_BRANCH,
    GET_PRINTERS_CONFIG,
} from "../../graphql/queries";
import {
    CREATE_DEVICE_PRINT_CONFIG,
    DELETE_DEVICE_PRINT_CONFIGS,
} from "../../graphql/mutations";
import {
    DEVICE_PRINT_TYPE_OPTIONS,
    isCategoryPrintType,
} from "../../constants/devicePrintTypes";
import { resolveClientDeviceIdForPrint } from "../../utils/deviceIdForPrint";
import DevicePrintConfigList, {
    type DevicePrintConfigRow,
} from "./devicePrintConfigList";
import DevicePrintConfigUpdate from "./devicePrintConfigUpdate";

type CreateFormState = {
    deviceId: string;
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

const emptyCreateForm = (): CreateFormState => ({
    deviceId: "",
    deviceName: "",
    printType: "PRECUENTA",
    categoryId: "",
    printerId: "",
    copies: 1,
    priority: 0,
    useIntegratedPrinter: false,
    useBluetoothPrinter: false,
    isActive: true,
});

const DevicePrintConfigs: React.FC = () => {
    const { companyData, getMacAddress, getDeviceId } = useAuth();
    const branchId = companyData?.branch?.id;

    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [filterActive, setFilterActive] = useState<boolean | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<DevicePrintConfigRow | null>(null);
    const [createForm, setCreateForm] = useState<CreateFormState>(
        emptyCreateForm,
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [thisDeviceId, setThisDeviceId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const id = await resolveClientDeviceIdForPrint({
                getMacAddress,
                getDeviceId,
                logPrefix: "[Config dispositivos]",
            });
            if (!cancelled) setThisDeviceId(id);
        })();
        return () => {
            cancelled = true;
        };
    }, [getMacAddress, getDeviceId]);

    const { data, loading, refetch } = useQuery(
        GET_DEVICE_PRINT_CONFIGS_BY_BRANCH,
        {
            variables: {
                branchId: branchId!,
                isActive: filterActive ?? undefined,
            },
            skip: !branchId,
            fetchPolicy: "network-only",
        },
    );

    const { data: printersData } = useQuery(GET_PRINTERS_CONFIG, {
        variables: { branchId: branchId! },
        skip: !branchId,
    });

    const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
    });

    const configs: DevicePrintConfigRow[] =
        data?.devicePrintConfigsByBranch ?? [];
    const printers = printersData?.printersByBranch ?? [];
    const categories = categoriesData?.categoriesByBranch ?? [];

    const uniqueDeviceIds = useMemo(
        () => new Set(configs.map((c) => c.deviceId)),
        [configs],
    );

    const [createConfig, { loading: creating }] = useMutation(
        CREATE_DEVICE_PRINT_CONFIG,
        {
            onCompleted: (res) => {
                const r = res?.createDevicePrintConfig;
                if (r?.success) {
                    setMessage({
                        type: "success",
                        text: r.message ?? "Configuración creada",
                    });
                    setShowCreate(false);
                    setCreateForm(emptyCreateForm());
                    refetch();
                } else {
                    setMessage({
                        type: "error",
                        text: r?.message ?? "No se pudo crear",
                    });
                }
            },
            onError: (e) =>
                setMessage({ type: "error", text: e.message }),
        },
    );

    const [deleteConfigs, { loading: deleting }] = useMutation(
        DELETE_DEVICE_PRINT_CONFIGS,
        {
            onCompleted: (res) => {
                const r = res?.deleteDevicePrintConfigs;
                if (r?.success) {
                    setMessage({
                        type: "success",
                        text: r.message ?? "Eliminado",
                    });
                    setSelectedIds(new Set());
                    refetch();
                } else {
                    setMessage({
                        type: "error",
                        text: r?.message ?? "No se pudo eliminar",
                    });
                }
            },
            onError: (e) =>
                setMessage({ type: "error", text: e.message }),
        },
    );

    const applyThisDevice = useCallback(() => {
        if (!thisDeviceId) {
            setMessage({
                type: "error",
                text: "No se pudo obtener el ID de este equipo (MAC o ID local).",
            });
            return;
        }
        setCreateForm((f) => ({
            ...f,
            deviceId: thisDeviceId,
            deviceName:
                f.deviceName.trim() || `PC ${thisDeviceId.slice(0, 8)}…`,
        }));
    }, [thisDeviceId]);

    const submitCreate = () => {
        if (!branchId) return;
        setMessage(null);
        if (!createForm.deviceId.trim() || !createForm.deviceName.trim()) {
            setMessage({
                type: "error",
                text: "ID y nombre del dispositivo son obligatorios.",
            });
            return;
        }
        if (
            isCategoryPrintType(createForm.printType) &&
            !createForm.categoryId
        ) {
            setMessage({
                type: "error",
                text: "Debe seleccionar una categoría cuando el tipo es Categoría de Producto.",
            });
            return;
        }
        createConfig({
            variables: {
                branchId,
                deviceId: createForm.deviceId.trim(),
                deviceName: createForm.deviceName.trim(),
                printType: createForm.printType,
                categoryId: createForm.categoryId || null,
                printerId: createForm.printerId || null,
                copies: createForm.copies,
                priority: createForm.priority,
                useIntegratedPrinter: createForm.useIntegratedPrinter,
                useBluetoothPrinter: createForm.useBluetoothPrinter,
                isActive: createForm.isActive,
            },
        });
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        if (
            !window.confirm(
                `¿Eliminar ${selectedIds.size} configuración(es)?`,
            )
        ) {
            return;
        }
        setMessage(null);
        deleteConfigs({ variables: { ids: [...selectedIds] } });
    };

    return (
        <div className="flex flex-col gap-6 p-1 md:p-0">
            <div className="flex flex-col gap-1 px-2 md:px-0">
                <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-2xl">
                    Dispositivos de impresión
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 md:text-sm">
                    Asigne qué imprime cada PC o terminal (por MAC/ID), tipo de
                    documento e impresora de red. El backend limita dispositivos
                    únicos por sede.
                </p>
            </div>

            {message && (
                <div
                    className={`rounded-2xl border p-4 text-sm font-medium ${
                        message.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
                    }`}
                >
                    {message.text}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                    <strong>{uniqueDeviceIds.size}</strong> dispositivo(s) ·{" "}
                    <strong>{configs.length}</strong> regla(s)
                </span>
                <select
                    value={
                        filterActive === null
                            ? "all"
                            : filterActive
                              ? "active"
                              : "inactive"
                    }
                    onChange={(e) => {
                        const v = e.target.value;
                        setFilterActive(
                            v === "all" ? null : v === "active",
                        );
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                    <option value="all">Todas</option>
                    <option value="active">Solo activas</option>
                    <option value="inactive">Solo inactivas</option>
                </select>
                <button
                    type="button"
                    onClick={() => {
                        setMessage(null);
                        setCreateForm(emptyCreateForm());
                        setShowCreate(true);
                    }}
                    className="ml-auto rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                >
                    + Nueva configuración
                </button>
                {selectedIds.size > 0 && (
                    <button
                        type="button"
                        onClick={handleDeleteSelected}
                        disabled={deleting}
                        className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                        Eliminar ({selectedIds.size})
                    </button>
                )}
            </div>

            <DevicePrintConfigList
                configs={configs}
                loading={loading}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onEdit={setEditing}
            />

            <DevicePrintConfigUpdate
                open={!!editing}
                config={editing}
                printers={printers}
                categories={categories}
                onClose={() => setEditing(null)}
                onSuccess={(text) => {
                    setMessage({ type: "success", text });
                    refetch();
                }}
                onError={(text) =>
                    setMessage({ type: "error", text })
                }
            />

            {showCreate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
                    onClick={() => setShowCreate(false)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">
                            Nueva configuración
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                    ID del dispositivo (MAC o identificador)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={createForm.deviceId}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                deviceId: e.target.value,
                                            }))
                                        }
                                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                        placeholder="ej. AA:BB:CC:DD:EE:FF"
                                    />
                                    <button
                                        type="button"
                                        onClick={applyThisDevice}
                                        className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                                    >
                                        Este equipo
                                    </button>
                                </div>
                                {thisDeviceId && (
                                    <p className="mt-1 text-[10px] text-slate-400">
                                        Este PC: {thisDeviceId}
                                    </p>
                                )}
                            </div>
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                    Nombre del dispositivo
                                </label>
                                <input
                                    type="text"
                                    value={createForm.deviceName}
                                    onChange={(e) =>
                                        setCreateForm((f) => ({
                                            ...f,
                                            deviceName: e.target.value,
                                        }))
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                    Tipo de impresión
                                </label>
                                <select
                                    value={createForm.printType}
                                    onChange={(e) => {
                                        const printType = e.target.value;
                                        setCreateForm((f) => ({
                                            ...f,
                                            printType,
                                            categoryId: isCategoryPrintType(
                                                printType,
                                            )
                                                ? f.categoryId
                                                : "",
                                        }));
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
                                    value={createForm.printerId}
                                    onChange={(e) =>
                                        setCreateForm((f) => ({
                                            ...f,
                                            printerId: e.target.value,
                                        }))
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                    <option value="">— Sin asignar —</option>
                                    {printers.map(
                                        (p: { id: string; name: string }) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </div>
                            {isCategoryPrintType(createForm.printType) && (
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                        Categoría de producto *
                                    </label>
                                    <select
                                        value={createForm.categoryId}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                categoryId: e.target.value,
                                            }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    >
                                        <option value="">
                                            — Seleccione categoría —
                                        </option>
                                        {categories.map(
                                            (c: {
                                                id: string;
                                                name: string;
                                            }) => (
                                                <option
                                                    key={c.id}
                                                    value={c.id}
                                                >
                                                    {c.name}
                                                </option>
                                            ),
                                        )}
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
                                    value={createForm.copies}
                                    onChange={(e) =>
                                        setCreateForm((f) => ({
                                            ...f,
                                            copies: Math.max(
                                                1,
                                                Number(e.target.value) || 1,
                                            ),
                                        }))
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
                                    value={createForm.priority}
                                    onChange={(e) =>
                                        setCreateForm((f) => ({
                                            ...f,
                                            priority: Math.max(
                                                0,
                                                Number(e.target.value) || 0,
                                            ),
                                        }))
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                />
                            </div>
                            <div className="flex flex-col gap-2 sm:col-span-2">
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={
                                            createForm.useIntegratedPrinter
                                        }
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                useIntegratedPrinter:
                                                    e.target.checked,
                                            }))
                                        }
                                    />
                                    Usar impresora integrada / local (USB en
                                    esta PC)
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={
                                            createForm.useBluetoothPrinter
                                        }
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                useBluetoothPrinter:
                                                    e.target.checked,
                                            }))
                                        }
                                    />
                                    Usar impresora Bluetooth
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={createForm.isActive}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                isActive: e.target.checked,
                                            }))
                                        }
                                    />
                                    Activo
                                </label>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={creating}
                                onClick={submitCreate}
                                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {creating ? "Guardando…" : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevicePrintConfigs;
