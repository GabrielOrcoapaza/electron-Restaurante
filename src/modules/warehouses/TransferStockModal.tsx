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
    isDefault: boolean;
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
    const [productId, setProductId] = useState("");
    const [quantity, setQuantity] = useState("");
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    const { data: warehousesData } = useQuery(GET_WAREHOUSES_BY_BRANCH, {
        variables: { branchId, includeInactive: false },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const warehouses: Warehouse[] = warehousesData?.warehousesByBranch || [];

    const { data: stocksData, loading: stocksLoading } = useQuery(
        GET_STOCKS_BY_WAREHOUSE,
        {
            variables: { warehouseId: fromWarehouseId },
            skip: !fromWarehouseId,
            fetchPolicy: "network-only",
        },
    );
    const stocks: StockRow[] = stocksData?.stocksByWarehouse || [];
    const availableProducts = stocks.filter(
        (s) => s.product.productType !== "DISH" && s.currentQuantity > 0,
    );

    const [transferWarehouseStock, { loading: submitting }] = useMutation(
        TRANSFER_WAREHOUSE_STOCK,
    );

    const handleSubmit = async () => {
        setError("");
        if (!fromWarehouseId || !toWarehouseId) {
            setError("Seleccione almacén de origen y destino");
            return;
        }
        if (fromWarehouseId === toWarehouseId) {
            setError("El almacén de origen y destino no pueden ser el mismo");
            return;
        }
        if (!productId) {
            setError("Seleccione un producto");
            return;
        }
        const qty = Number(quantity);
        if (!qty || qty <= 0) {
            setError("Ingrese una cantidad válida");
            return;
        }
        try {
            const { data } = await transferWarehouseStock({
                variables: {
                    fromWarehouseId,
                    toWarehouseId,
                    productId,
                    quantity: qty,
                    reason: reason || undefined,
                },
            });
            if (data?.transferWarehouseStock?.success) {
                onTransferred();
            } else {
                setError(
                    data?.transferWarehouseStock?.message ||
                        "No se pudo transferir el stock",
                );
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error al transferir el stock"));
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                <h2 className="mb-4 text-lg font-black text-slate-800 dark:text-slate-100">
                    Transferir stock entre almacenes
                </h2>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Almacén origen
                        </label>
                        <select
                            value={fromWarehouseId}
                            onChange={(e) => {
                                setFromWarehouseId(e.target.value);
                                setProductId("");
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
                            onChange={(e) => setToWarehouseId(e.target.value)}
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

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Producto
                        </label>
                        <select
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            disabled={!fromWarehouseId || stocksLoading}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                            <option value="">
                                {!fromWarehouseId
                                    ? "Elija primero el almacén origen"
                                    : stocksLoading
                                      ? "Cargando..."
                                      : "Seleccione..."}
                            </option>
                            {availableProducts.map((s) => (
                                <option key={s.product.id} value={s.product.id}>
                                    {s.product.name} (disp:{" "}
                                    {Number(s.currentQuantity).toFixed(2)})
                                </option>
                            ))}
                        </select>
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
                        {submitting ? "Transfiriendo..." : "Transferir"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransferStockModal;
