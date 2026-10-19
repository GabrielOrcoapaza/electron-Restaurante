import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
    GET_STOCKS_BY_WAREHOUSE,
    GET_WAREHOUSES_BY_BRANCH,
} from "../../graphql/queries";
import {
    CREATE_WAREHOUSE,
    UPDATE_WAREHOUSE,
    SET_DEFAULT_WAREHOUSE,
} from "../../graphql/mutations";
import { normalizeProductUnitMeasure } from "../../constants/productUnitMeasures";
import TransferStockModal from "./TransferStockModal";

interface Warehouse {
    id: string;
    name: string;
    isActive: boolean;
    isDefault: boolean;
    createdAt: string;
}

interface StockRow {
    id: string;
    currentQuantity: number;
    averageCost: number;
    reservedQuantity: number;
    availableQuantity: number;
    isLowStock: boolean;
    product: {
        id: string;
        code: string;
        name: string;
        unitMeasure: string;
        productType: string;
        stockMin?: number | null;
        stockMax?: number | null;
    };
}

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const formatNumber = (value: any, decimals: number = 2) => {
    const n = Number(value);
    if (isNaN(n)) return "0.00";
    return n.toLocaleString("es-PE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

const WarehousesTab: React.FC<{ branchId: string }> = ({ branchId }) => {
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<
        string | null
    >(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingWarehouse, setEditingWarehouse] =
        useState<Warehouse | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [formName, setFormName] = useState("");
    const [formError, setFormError] = useState("");

    const {
        data: warehousesData,
        loading: warehousesLoading,
        refetch: refetchWarehouses,
    } = useQuery(GET_WAREHOUSES_BY_BRANCH, {
        variables: { branchId, includeInactive: true },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const warehouses: Warehouse[] = useMemo(
        () => warehousesData?.warehousesByBranch || [],
        [warehousesData],
    );

    useEffect(() => {
        if (!selectedWarehouseId && warehouses.length > 0) {
            setSelectedWarehouseId(warehouses[0].id);
        }
    }, [warehouses, selectedWarehouseId]);

    const selectedWarehouse = warehouses.find(
        (w) => w.id === selectedWarehouseId,
    );

    const {
        data: stocksData,
        loading: stocksLoading,
        refetch: refetchStocks,
    } = useQuery(GET_STOCKS_BY_WAREHOUSE, {
        variables: { warehouseId: selectedWarehouseId! },
        skip: !selectedWarehouseId,
        fetchPolicy: "network-only",
    });

    const stocks: StockRow[] = stocksData?.stocksByWarehouse || [];

    const [createWarehouse, { loading: creating }] =
        useMutation(CREATE_WAREHOUSE);
    const [updateWarehouse, { loading: updating }] =
        useMutation(UPDATE_WAREHOUSE);
    const [setDefaultWarehouse, { loading: settingDefault }] = useMutation(
        SET_DEFAULT_WAREHOUSE,
    );

    const openCreateModal = () => {
        setFormName("");
        setFormError("");
        setShowCreateModal(true);
    };

    const openEditModal = (w: Warehouse) => {
        setEditingWarehouse(w);
        setFormName(w.name);
        setFormError("");
    };

    const handleCreate = async () => {
        if (!formName.trim()) {
            setFormError("El nombre es obligatorio");
            return;
        }
        try {
            const { data } = await createWarehouse({
                variables: { branchId, name: formName.trim() },
            });
            if (data?.createWarehouse?.success) {
                setShowCreateModal(false);
                await refetchWarehouses();
            } else {
                setFormError(
                    data?.createWarehouse?.message ||
                        "No se pudo crear el almacén",
                );
            }
        } catch (err: unknown) {
            setFormError(getErrorMessage(err, "Error al crear el almacén"));
        }
    };

    const handleRename = async () => {
        if (!editingWarehouse) return;
        if (!formName.trim()) {
            setFormError("El nombre es obligatorio");
            return;
        }
        try {
            const { data } = await updateWarehouse({
                variables: {
                    warehouseId: editingWarehouse.id,
                    name: formName.trim(),
                },
            });
            if (data?.updateWarehouse?.success) {
                setEditingWarehouse(null);
                await refetchWarehouses();
            } else {
                setFormError(
                    data?.updateWarehouse?.message ||
                        "No se pudo actualizar el almacén",
                );
            }
        } catch (err: unknown) {
            setFormError(getErrorMessage(err, "Error al actualizar el almacén"));
        }
    };

    const handleToggleActive = async (w: Warehouse) => {
        try {
            const { data } = await updateWarehouse({
                variables: { warehouseId: w.id, isActive: !w.isActive },
            });
            if (data?.updateWarehouse?.success) {
                await refetchWarehouses();
            } else {
                alert(
                    data?.updateWarehouse?.message ||
                        "No se pudo actualizar el almacén",
                );
            }
        } catch (err: unknown) {
            alert(getErrorMessage(err, "Error al actualizar el almacén"));
        }
    };

    const handleSetDefault = async (w: Warehouse) => {
        try {
            const { data } = await setDefaultWarehouse({
                variables: { warehouseId: w.id },
            });
            if (data?.setDefaultWarehouse?.success) {
                await refetchWarehouses();
            } else {
                alert(
                    data?.setDefaultWarehouse?.message ||
                        "No se pudo marcar como principal",
                );
            }
        } catch (err: unknown) {
            alert(getErrorMessage(err, "Error al marcar como principal"));
        }
    };

    return (
        <div className="flex flex-col gap-6 lg:flex-row">
            {/* Lista de almacenes */}
            <div className="flex w-full flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900 lg:w-80">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        Almacenes
                    </h2>
                    <button
                        onClick={openCreateModal}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-700"
                        title="Crear almacén"
                    >
                        +
                    </button>
                </div>
                <div className="flex-1 divide-y divide-slate-50 overflow-y-auto dark:divide-slate-800/50">
                    {warehousesLoading ? (
                        <div className="flex flex-col gap-3 p-4">
                            {Array(3)
                                .fill(0)
                                .map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-16 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                                    />
                                ))}
                        </div>
                    ) : warehouses.length === 0 ? (
                        <p className="p-6 text-center text-sm font-bold text-slate-400">
                            No hay almacenes todavía
                        </p>
                    ) : (
                        warehouses.map((w) => (
                            <button
                                key={w.id}
                                onClick={() => setSelectedWarehouseId(w.id)}
                                className={`flex w-full flex-col gap-1 px-6 py-4 text-left transition-colors ${
                                    selectedWarehouseId === w.id
                                        ? "bg-indigo-50/60 dark:bg-indigo-900/20"
                                        : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-black text-slate-700 dark:text-slate-200">
                                        {w.name}
                                    </span>
                                    <span
                                        role="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(w);
                                        }}
                                        className="text-[10px] font-black uppercase tracking-wider text-indigo-400 hover:text-indigo-600"
                                    >
                                        Editar
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {w.isDefault && (
                                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                                            Por defecto
                                        </span>
                                    )}
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                            w.isActive
                                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                : "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                                        }`}
                                    >
                                        {w.isActive ? "Activo" : "Inactivo"}
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Stock del almacén seleccionado */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                            {selectedWarehouse
                                ? `Stock en "${selectedWarehouse.name}"`
                                : "Seleccione un almacén"}
                        </h2>
                        {selectedWarehouse && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {selectedWarehouse.isDefault
                                    ? "Almacén por defecto: lo usan ventas, compras y ajustes"
                                    : "Almacén secundario: solo se actualiza por transferencias manuales"}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedWarehouse && (
                            <>
                                {!selectedWarehouse.isDefault &&
                                    selectedWarehouse.isActive && (
                                        <button
                                            onClick={() =>
                                                handleSetDefault(
                                                    selectedWarehouse,
                                                )
                                            }
                                            disabled={settingDefault}
                                            title="Las ventas, compras y ajustes empezarán a descontar de este almacén"
                                            className="flex h-9 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-black uppercase tracking-wider text-indigo-600 transition-all hover:bg-indigo-100 disabled:opacity-40 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
                                        >
                                            Marcar como principal
                                        </button>
                                    )}
                                <button
                                    onClick={() =>
                                        handleToggleActive(selectedWarehouse)
                                    }
                                    disabled={updating}
                                    className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-wider text-slate-500 transition-all hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                    {selectedWarehouse.isActive
                                        ? "Desactivar"
                                        : "Activar"}
                                </button>
                                <button
                                    onClick={() => setShowTransferModal(true)}
                                    className="flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-indigo-700"
                                >
                                    Transferir stock
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    {!selectedWarehouseId ? (
                        <div className="flex min-h-[300px] items-center justify-center p-8 text-center text-sm font-bold text-slate-400">
                            Elija un almacén de la lista para ver su stock
                        </div>
                    ) : stocksLoading ? (
                        <div className="flex min-h-[300px] flex-col gap-4 p-6">
                            {Array(4)
                                .fill(0)
                                .map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-14 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                                    />
                                ))}
                        </div>
                    ) : stocks.length === 0 ? (
                        <div className="flex min-h-[300px] items-center justify-center p-8 text-center text-sm font-bold text-slate-400">
                            Este almacén todavía no tiene stock registrado
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-50 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                                        <th className="px-6 py-4">
                                            Producto
                                        </th>
                                        <th className="px-6 py-4 text-center">
                                            Cantidad
                                        </th>
                                        <th className="px-6 py-4 text-center">
                                            Disponible
                                        </th>
                                        <th className="px-6 py-4 text-center">
                                            Costo Prom.
                                        </th>
                                        <th className="px-6 py-4">Unidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {stocks.map((s) => (
                                        <tr
                                            key={s.id}
                                            className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-black text-slate-700 dark:text-slate-200">
                                                    {s.product.name}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400">
                                                    {s.product.code}
                                                </div>
                                            </td>
                                            <td
                                                className={`px-6 py-4 text-center text-base font-black ${
                                                    s.isLowStock
                                                        ? "text-rose-600 dark:text-rose-400"
                                                        : "text-slate-700 dark:text-slate-200"
                                                }`}
                                            >
                                                {formatNumber(
                                                    s.currentQuantity,
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-500 dark:text-slate-400">
                                                {formatNumber(
                                                    s.availableQuantity,
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-500 dark:text-slate-400">
                                                S/ {formatNumber(s.averageCost)}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">
                                                {normalizeProductUnitMeasure(
                                                    s.product.unitMeasure,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal crear almacén */}
            {showCreateModal && (
                <WarehouseFormModal
                    title="Crear almacén"
                    name={formName}
                    error={formError}
                    saving={creating}
                    onChangeName={setFormName}
                    onCancel={() => setShowCreateModal(false)}
                    onSave={handleCreate}
                />
            )}

            {/* Modal renombrar almacén */}
            {editingWarehouse && (
                <WarehouseFormModal
                    title={`Editar "${editingWarehouse.name}"`}
                    name={formName}
                    error={formError}
                    saving={updating}
                    onChangeName={setFormName}
                    onCancel={() => setEditingWarehouse(null)}
                    onSave={handleRename}
                />
            )}

            {showTransferModal && selectedWarehouse && (
                <TransferStockModal
                    branchId={branchId}
                    defaultFromWarehouseId={selectedWarehouse.id}
                    onClose={() => setShowTransferModal(false)}
                    onTransferred={() => {
                        setShowTransferModal(false);
                        refetchStocks();
                    }}
                />
            )}
        </div>
    );
};

const WarehouseFormModal: React.FC<{
    title: string;
    name: string;
    error: string;
    saving: boolean;
    onChangeName: (v: string) => void;
    onCancel: () => void;
    onSave: () => void;
}> = ({ title, name, error, saving, onChangeName, onCancel, onSave }) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-black text-slate-800 dark:text-slate-100">
                {title}
            </h2>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nombre
            </label>
            <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="Ej. Cocina, Barra, Depósito"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {error && (
                <p className="mt-2 text-xs font-bold text-rose-500">
                    {error}
                </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                    Cancelar
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                >
                    {saving ? "Guardando..." : "Guardar"}
                </button>
            </div>
        </div>
    </div>
);

export default WarehousesTab;
