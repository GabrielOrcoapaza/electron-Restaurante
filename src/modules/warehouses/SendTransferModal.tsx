import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_MASTER_INGREDIENTS_BY_COMPANY,
    GET_WAREHOUSES_BY_BRANCH,
} from "../../graphql/queries";
import { SEND_WAREHOUSE_TRANSFER } from "../../graphql/mutations";

interface Warehouse {
    id: string;
    name: string;
    isActive: boolean;
    isDefault: boolean;
}

interface MasterIngredient {
    id: string;
    name: string;
    unitMeasure: string;
    isActive: boolean;
}

interface SendTransferModalProps {
    branchId: string;
    onClose: () => void;
    onSent: () => void;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const SendTransferModal: React.FC<SendTransferModalProps> = ({
    branchId,
    onClose,
    onSent,
}) => {
    const { companyData } = useAuth();
    const otherBranches = (companyData?.availableBranches || []).filter(
        (b) => String(b.id) !== String(branchId),
    );

    const [toBranchId, setToBranchId] = useState("");
    const [fromWarehouseId, setFromWarehouseId] = useState("");
    const [toWarehouseId, setToWarehouseId] = useState("");
    const [masterIngredientId, setMasterIngredientId] = useState("");
    const [quantity, setQuantity] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");

    const { data: fromWarehousesData } = useQuery(GET_WAREHOUSES_BY_BRANCH, {
        variables: { branchId, includeInactive: false },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const fromWarehouses: Warehouse[] =
        fromWarehousesData?.warehousesByBranch || [];

    const { data: toWarehousesData, loading: toWarehousesLoading } = useQuery(
        GET_WAREHOUSES_BY_BRANCH,
        {
            variables: { branchId: toBranchId, includeInactive: false },
            skip: !toBranchId,
            fetchPolicy: "network-only",
        },
    );
    const toWarehouses: Warehouse[] =
        toWarehousesData?.warehousesByBranch || [];

    const { data: ingredientsData } = useQuery(
        GET_MASTER_INGREDIENTS_BY_COMPANY,
        {
            variables: { includeInactive: false },
            fetchPolicy: "network-only",
        },
    );
    const masterIngredients: MasterIngredient[] =
        ingredientsData?.masterIngredientsByCompany || [];

    const [sendWarehouseTransfer, { loading: submitting }] = useMutation(
        SEND_WAREHOUSE_TRANSFER,
    );

    const handleSubmit = async () => {
        setError("");
        if (!toBranchId) {
            setError("Seleccione la sucursal destino");
            return;
        }
        if (!fromWarehouseId || !toWarehouseId) {
            setError("Seleccione almacén de origen y destino");
            return;
        }
        if (!masterIngredientId) {
            setError("Seleccione el ingrediente a transferir");
            return;
        }
        const qty = Number(quantity);
        if (!qty || qty <= 0) {
            setError("Ingrese una cantidad válida");
            return;
        }
        try {
            const { data } = await sendWarehouseTransfer({
                variables: {
                    fromWarehouseId,
                    toWarehouseId,
                    masterIngredientId,
                    quantity: qty,
                    notes: notes || undefined,
                },
            });
            if (data?.sendWarehouseTransfer?.success) {
                onSent();
            } else {
                setError(
                    data?.sendWarehouseTransfer?.message ||
                        "No se pudo enviar la transferencia",
                );
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error al enviar la transferencia"));
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                <h2 className="mb-1 text-lg font-black text-slate-800 dark:text-slate-100">
                    Enviar transferencia a otra sucursal
                </h2>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    El stock sale de su almacén de inmediato. La sucursal
                    destino debe confirmar la recepción.
                </p>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Sucursal destino
                        </label>
                        <select
                            value={toBranchId}
                            onChange={(e) => {
                                setToBranchId(e.target.value);
                                setToWarehouseId("");
                            }}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                            <option value="">Seleccione...</option>
                            {otherBranches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                        {otherBranches.length === 0 && (
                            <p className="mt-1 text-[10px] font-bold text-amber-500">
                                No hay otras sucursales disponibles en su
                                empresa
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Almacén origen
                            </label>
                            <select
                                value={fromWarehouseId}
                                onChange={(e) =>
                                    setFromWarehouseId(e.target.value)
                                }
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            >
                                <option value="">Seleccione...</option>
                                {fromWarehouses.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Almacén destino
                            </label>
                            <select
                                value={toWarehouseId}
                                onChange={(e) =>
                                    setToWarehouseId(e.target.value)
                                }
                                disabled={!toBranchId || toWarehousesLoading}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            >
                                <option value="">
                                    {!toBranchId
                                        ? "Elija la sucursal"
                                        : "Seleccione..."}
                                </option>
                                {toWarehouses.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Ingrediente
                        </label>
                        <select
                            value={masterIngredientId}
                            onChange={(e) =>
                                setMasterIngredientId(e.target.value)
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                            <option value="">Seleccione...</option>
                            {masterIngredients.map((mi) => (
                                <option key={mi.id} value={mi.id}>
                                    {mi.name} ({mi.unitMeasure})
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                            Ambas sucursales deben tener un producto propio
                            vinculado a este ingrediente (pestaña
                            "Ingredientes Maestros").
                        </p>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Cantidad
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Notas (opcional)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                    </div>

                    {error && (
                        <p className="text-xs font-bold text-rose-500">
                            {error}
                        </p>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {submitting ? "Enviando..." : "Enviar"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SendTransferModal;
