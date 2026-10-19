import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_BRANCHES_BY_COMPANY,
    GET_MASTER_INGREDIENTS_BY_COMPANY,
    GET_WAREHOUSES_BY_BRANCH,
} from "../../graphql/queries";
import { SEND_WAREHOUSE_TRANSFER } from "../../graphql/mutations";

interface Warehouse {
    id: string;
    name: string;
    isActive: boolean;
    isDefaultPurchase: boolean;
    isDefaultSale: boolean;
}

interface BranchOption {
    id: string;
    name: string;
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

interface ItemResult {
    ingredientName: string;
    success: boolean;
    message: string;
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
    const companyId = companyData?.company?.id;

    const { data: branchesData, loading: branchesLoading } = useQuery(
        GET_BRANCHES_BY_COMPANY,
        {
            variables: { companyId: companyId! },
            skip: !companyId,
            fetchPolicy: "network-only",
        },
    );
    const otherBranches: BranchOption[] = (
        branchesData?.branchesByCompany || []
    ).filter((b: BranchOption) => String(b.id) !== String(branchId));

    const [toBranchId, setToBranchId] = useState("");
    const [fromWarehouseId, setFromWarehouseId] = useState("");
    const [toWarehouseId, setToWarehouseId] = useState("");
    // masterIngredientId -> cantidad (string). Solo los ingredientes presentes
    // aqui estan "marcados" para enviar.
    const [quantities, setQuantities] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");
    const [results, setResults] = useState<ItemResult[] | null>(null);

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

    const toggleItem = (ingredientId: string) => {
        setQuantities((prev) => {
            const next = { ...prev };
            if (ingredientId in next) {
                delete next[ingredientId];
            } else {
                next[ingredientId] = "";
            }
            return next;
        });
    };

    const setItemQuantity = (ingredientId: string, value: string) => {
        setQuantities((prev) => ({ ...prev, [ingredientId]: value }));
    };

    const selectedCount = Object.keys(quantities).length;

    const handleSubmit = async () => {
        setError("");
        setResults(null);
        if (!toBranchId) {
            setError("Seleccione la sucursal destino");
            return;
        }
        if (!fromWarehouseId || !toWarehouseId) {
            setError("Seleccione almacén de origen y destino");
            return;
        }
        const entries = Object.entries(quantities);
        if (entries.length === 0) {
            setError("Seleccione al menos un ingrediente");
            return;
        }
        for (const [, qtyStr] of entries) {
            const qty = Number(qtyStr);
            if (!qty || qty <= 0) {
                setError(
                    "Ingrese una cantidad válida en todos los ingredientes marcados",
                );
                return;
            }
        }

        const itemResults: ItemResult[] = [];
        for (const [masterIngredientId, qtyStr] of entries) {
            const mi = masterIngredients.find(
                (m) => m.id === masterIngredientId,
            );
            const ingredientName = mi?.name || masterIngredientId;
            try {
                const { data } = await sendWarehouseTransfer({
                    variables: {
                        fromWarehouseId,
                        toWarehouseId,
                        masterIngredientId,
                        quantity: Number(qtyStr),
                        notes: notes || undefined,
                    },
                });
                if (data?.sendWarehouseTransfer?.success) {
                    itemResults.push({
                        ingredientName,
                        success: true,
                        message: "Enviado",
                    });
                } else {
                    itemResults.push({
                        ingredientName,
                        success: false,
                        message:
                            data?.sendWarehouseTransfer?.message ||
                            "No se pudo enviar",
                    });
                }
            } catch (err: unknown) {
                itemResults.push({
                    ingredientName,
                    success: false,
                    message: getErrorMessage(err, "Error al enviar"),
                });
            }
        }

        setResults(itemResults);
        if (itemResults.every((r) => r.success)) {
            onSent();
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Enviar transferencia a otra sucursal
                    </h2>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        El stock sale de su almacén de inmediato. La sucursal
                        destino debe confirmar la recepción.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
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
                                <option value="">
                                    {branchesLoading
                                        ? "Cargando..."
                                        : "Seleccione..."}
                                </option>
                                {otherBranches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                            {!branchesLoading && otherBranches.length === 0 && (
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
                                Ingredientes a transferir{" "}
                                {selectedCount > 0 &&
                                    `(${selectedCount} marcados)`}
                            </label>
                            <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                {masterIngredients.length === 0 ? (
                                    <p className="p-4 text-center text-xs font-bold text-slate-400">
                                        No hay ingredientes maestros activos
                                    </p>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {masterIngredients.map((mi) => {
                                            const checked = mi.id in quantities;
                                            return (
                                                <div
                                                    key={mi.id}
                                                    className="flex items-center gap-3 px-3 py-2"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() =>
                                                            toggleItem(mi.id)
                                                        }
                                                        className="h-4 w-4 shrink-0 accent-indigo-600"
                                                    />
                                                    <div className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {mi.name}{" "}
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            ({mi.unitMeasure})
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        disabled={!checked}
                                                        value={
                                                            quantities[mi.id] ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            setItemQuantity(
                                                                mi.id,
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-bold text-slate-700 outline-none disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <p className="mt-1 text-[10px] font-bold text-slate-400">
                                Ambas sucursales deben tener un producto
                                propio vinculado a cada ingrediente (pestaña
                                "Ingredientes Maestros").
                            </p>
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

                        {results && (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {results.map((r, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold"
                                        >
                                            <span className="text-slate-700 dark:text-slate-200">
                                                {r.ingredientName}
                                            </span>
                                            <span
                                                className={
                                                    r.success
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-rose-500"
                                                }
                                            >
                                                {r.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        {results ? "Cerrar" : "Cancelar"}
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
