import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
    GET_STOCKS_BY_WAREHOUSE,
    GET_WAREHOUSES_BY_BRANCH,
} from "../../graphql/queries";
import { TRANSFER_WAREHOUSE_STOCK } from "../../graphql/mutations";

interface Warehouse {
    id: string;
    name: string;
    isActive: boolean;
    isDefaultPurchase: boolean;
    isDefaultSale: boolean;
}

interface StockRow {
    id: string;
    currentQuantity: number;
    product: {
        id: string;
        name: string;
        productType: string;
    };
}

interface TransferStockModalProps {
    branchId: string;
    defaultFromWarehouseId?: string;
    onClose: () => void;
    onTransferred: () => void;
}

interface ItemResult {
    productName: string;
    success: boolean;
    message: string;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const TransferStockModal: React.FC<TransferStockModalProps> = ({
    branchId,
    defaultFromWarehouseId,
    onClose,
    onTransferred,
}) => {
    const [fromWarehouseId, setFromWarehouseId] = useState(
        defaultFromWarehouseId || "",
    );
    const [toWarehouseId, setToWarehouseId] = useState("");
    // productId -> cantidad (string, tal cual lo escribe el usuario). Solo los
    // productos presentes aquí están "marcados" para transferir.
    const [quantities, setQuantities] = useState<Record<string, string>>({});
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [results, setResults] = useState<ItemResult[] | null>(null);

    const { data: warehousesData } = useQuery(GET_WAREHOUSES_BY_BRANCH, {
        variables: { branchId, includeInactive: false },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const warehouses: Warehouse[] = warehousesData?.warehousesByBranch || [];

    const {
        data: stocksData,
        loading: stocksLoading,
        refetch: refetchStocks,
    } = useQuery(GET_STOCKS_BY_WAREHOUSE, {
        variables: { warehouseId: fromWarehouseId },
        skip: !fromWarehouseId,
        fetchPolicy: "network-only",
    });
    const stocks: StockRow[] = stocksData?.stocksByWarehouse || [];
    const availableProducts = stocks.filter(
        (s) => s.product.productType !== "DISH" && s.currentQuantity > 0,
    );

    const [transferWarehouseStock, { loading: submitting }] = useMutation(
        TRANSFER_WAREHOUSE_STOCK,
    );

    const toggleItem = (productId: string, available: number) => {
        setQuantities((prev) => {
            const next = { ...prev };
            if (productId in next) {
                delete next[productId];
            } else {
                next[productId] = String(available);
            }
            return next;
        });
    };

    const setItemQuantity = (productId: string, value: string) => {
        setQuantities((prev) => ({ ...prev, [productId]: value }));
    };

    const selectedCount = Object.keys(quantities).length;

    const handleSubmit = async () => {
        setError("");
        setResults(null);
        if (!fromWarehouseId || !toWarehouseId) {
            setError("Seleccione almacén de origen y destino");
            return;
        }
        if (fromWarehouseId === toWarehouseId) {
            setError("El almacén de origen y destino no pueden ser el mismo");
            return;
        }
        const entries = Object.entries(quantities);
        if (entries.length === 0) {
            setError("Seleccione al menos un producto");
            return;
        }
        for (const [, qtyStr] of entries) {
            const qty = Number(qtyStr);
            if (!qty || qty <= 0) {
                setError("Ingrese una cantidad válida en todos los productos marcados");
                return;
            }
        }

        const itemResults: ItemResult[] = [];
        for (const [productId, qtyStr] of entries) {
            const product = availableProducts.find(
                (s) => s.product.id === productId,
            );
            const productName = product?.product.name || productId;
            try {
                const { data } = await transferWarehouseStock({
                    variables: {
                        fromWarehouseId,
                        toWarehouseId,
                        productId,
                        quantity: Number(qtyStr),
                        reason: reason || undefined,
                    },
                });
                if (data?.transferWarehouseStock?.success) {
                    itemResults.push({
                        productName,
                        success: true,
                        message: "Transferido",
                    });
                } else {
                    itemResults.push({
                        productName,
                        success: false,
                        message:
                            data?.transferWarehouseStock?.message ||
                            "No se pudo transferir",
                    });
                }
            } catch (err: unknown) {
                itemResults.push({
                    productName,
                    success: false,
                    message: getErrorMessage(err, "Error al transferir"),
                });
            }
        }

        setResults(itemResults);
        await refetchStocks();
        if (itemResults.every((r) => r.success)) {
            onTransferred();
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Transferir stock entre almacenes
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Almacén origen
                                </label>
                                <select
                                    value={fromWarehouseId}
                                    onChange={(e) => {
                                        setFromWarehouseId(e.target.value);
                                        setQuantities({});
                                    }}
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                    <option value="">Seleccione...</option>
                                    {warehouses.map((w) => (
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
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                    <option value="">Seleccione...</option>
                                    {warehouses
                                        .filter((w) => w.id !== fromWarehouseId)
                                        .map((w) => (
                                            <option key={w.id} value={w.id}>
                                                {w.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Productos a transferir{" "}
                                {selectedCount > 0 && `(${selectedCount} marcados)`}
                            </label>
                            <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                {!fromWarehouseId ? (
                                    <p className="p-4 text-center text-xs font-bold text-slate-400">
                                        Elija primero el almacén origen
                                    </p>
                                ) : stocksLoading ? (
                                    <p className="p-4 text-center text-xs font-bold text-slate-400">
                                        Cargando...
                                    </p>
                                ) : availableProducts.length === 0 ? (
                                    <p className="p-4 text-center text-xs font-bold text-slate-400">
                                        Este almacén no tiene productos con
                                        stock disponible
                                    </p>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {availableProducts.map((s) => {
                                            const checked =
                                                s.product.id in quantities;
                                            return (
                                                <div
                                                    key={s.product.id}
                                                    className="flex items-center gap-3 px-3 py-2"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() =>
                                                            toggleItem(
                                                                s.product.id,
                                                                Number(
                                                                    s.currentQuantity,
                                                                ),
                                                            )
                                                        }
                                                        className="h-4 w-4 shrink-0 accent-indigo-600"
                                                    />
                                                    <div className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {s.product.name}
                                                        <div className="text-[10px] font-bold text-slate-400">
                                                            disponible:{" "}
                                                            {Number(
                                                                s.currentQuantity,
                                                            ).toFixed(2)}
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        disabled={!checked}
                                                        value={
                                                            quantities[
                                                                s.product.id
                                                            ] ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            setItemQuantity(
                                                                s.product.id,
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
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Motivo (opcional)
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
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
                                                {r.productName}
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
                        {submitting ? "Transfiriendo..." : "Transferir"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransferStockModal;
