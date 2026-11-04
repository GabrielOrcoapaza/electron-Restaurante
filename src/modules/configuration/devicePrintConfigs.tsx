import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_CATEGORIES_BY_BRANCH,
    GET_DEVICE_PRINT_CONFIGS_BY_BRANCH,
    GET_PRINTERS_CONFIG,
} from "../../graphql/queries";
import { DELETE_DEVICE_PRINT_CONFIGS } from "../../graphql/mutations";
import { resolveClientDeviceIdForPrint } from "../../utils/deviceIdForPrint";
import DevicePrintConfigList, {
    type DevicePrintConfigRow,
} from "./devicePrintConfigList";
import DevicePrintConfigUpdate from "./devicePrintConfigUpdate";
import DevicePrintConfigCreate from "./devicePrintConfigCreate";

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

            <DevicePrintConfigCreate
                open={showCreate}
                branchId={branchId}
                branchName={companyData?.branch?.name}
                printers={printers}
                thisDeviceId={thisDeviceId}
                onClose={() => setShowCreate(false)}
                onSuccess={(text) => {
                    setMessage({ type: "success", text });
                    refetch();
                }}
                onError={(text) => {
                    setMessage({ type: "error", text });
                    refetch();
                }}
            />
        </div>
    );
};

export default DevicePrintConfigs;
