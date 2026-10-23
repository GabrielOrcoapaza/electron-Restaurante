import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
    GET_STOCKS_BY_WAREHOUSE,
    GET_WAREHOUSES_BY_BRANCH,
} from "../../graphql/queries";
import { TRANSFER_WAREHOUSE_STOCK_NOTE } from "../../graphql/mutations";
import SuggestionInput from "../../components/SuggestionInput";
import { WAREHOUSE_TRANSFER_MOTIVE_SUGGESTIONS } from "../../constants/transferReasonSuggestions";
import {
    downloadInternalTransferNotePdf,
    type InternalTransferNote,
} from "../../utils/internalTransferNotePdf";

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
    const [productFilter, setProductFilter] = useState("");
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [results, setResults] = useState<ItemResult[] | null>(null);
    // Folio de la nota interna creada (TRI-XXXX) y resultado de la descarga del PDF.
    const [noteFolio, setNoteFolio] = useState("");
    const [pdfMessage, setPdfMessage] = useState("");

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
    const normalizedFilter = productFilter.trim().toLowerCase();
    const filteredProducts = normalizedFilter
        ? availableProducts.filter((s) =>
              s.product.name.toLowerCase().includes(normalizedFilter),
          )
        : availableProducts;

    const [transferWarehouseStockNote, { loading: submitting }] = useMutation(
        TRANSFER_WAREHOUSE_STOCK_NOTE,
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
        setNoteFolio("");
        setPdfMessage("");
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
        let createdFolio = "";
        let createdNote: InternalTransferNote | null = null;
        try {
            const { data } = await transferWarehouseStockNote({
                variables: {
                    fromWarehouseId,
                    toWarehouseId,
                    items: entries.map(([productId, qtyStr]) => ({
                        productId,
                        quantity: Number(qtyStr),
                    })),
                    motive: reason || undefined,
                },
            });
            const payload = data?.transferWarehouseStockNote;
            for (const r of payload?.results || []) {
                itemResults.push({
                    productName: r.productName || r.productId,
                    success: Boolean(r.success),
                    message:
                        r.message ||
                        (r.success ? "Transferido" : "No se pudo transferir"),
                });
            }
            if (!itemResults.length && !payload?.success) {
                itemResults.push({
                    productName: "—",
                    success: false,
                    message: payload?.message || "No se pudo transferir",
                });
            }
            createdFolio = payload?.folio || "";
            createdNote = (payload?.note as InternalTransferNote | null) || null;
        } catch (err: unknown) {
            itemResults.push({
                productName: "—",
                success: false,
                message: getErrorMessage(err, "Error al transferir"),
            });
        }

        setResults(itemResults);
        setNoteFolio(createdFolio);
        await refetchStocks();

        // La nota interna nace confirmada (los ítems no tienen estado): si se creó,
        // se descarga su PDF A4 con el folio TRI-XXXX.
        if (createdNote) {
            const pdf = await downloadInternalTransferNotePdf(createdNote);
            setPdfMessage(pdf.message || "");
        } else {
            setPdfMessage("");
        }

        // No se cierra automáticamente: se muestra el folio y el estado del PDF.
        // El botón "Cerrar" llama a onTransferred() para refrescar la tabla.
    };

    const handleClose = () => {
        if (results) {
            onTransferred();
        } else {
            onClose();
        }
    };

    // Si al menos un ítem se movió ya no se permite reenviar desde este modal
    // (evita mover dos veces lo mismo). Si fallaron todos, se deja reintentar.
    const hasSuccess = Boolean(results?.some((r) => r.success));

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
                                        setProductFilter("");
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
                            <input
                                type="search"
                                value={productFilter}
                                onChange={(e) =>
                                    setProductFilter(e.target.value)
                                }
                                placeholder="Filtrar por nombre..."
                                disabled={!fromWarehouseId || stocksLoading}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none placeholder:font-semibold placeholder:text-slate-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
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
                                ) : filteredProducts.length === 0 ? (
                                    <p className="p-4 text-center text-xs font-bold text-slate-400">
                                        Ningún producto coincide con el filtro
                                    </p>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredProducts.map((s) => {
                                            const checked =
                                                s.product.id in quantities;
                                            return (
                                                <div
                                                    key={s.product.id}
                                                    onClick={() =>
                                                        toggleItem(
                                                            s.product.id,
                                                            Number(
                                                                s.currentQuantity,
                                                            ),
                                                        )
                                                    }
                                                    className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                        onWheel={(e) =>
                                                            e.currentTarget.blur()
                                                        }
                                                        onChange={() =>
                                                            toggleItem(
                                                                s.product.id,
                                                                Number(
                                                                    s.currentQuantity,
                                                                ),
                                                            )
                                                        }
                                                        className="h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
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
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                        onWheel={(e) =>
                                                            e.currentTarget.blur()
                                                        }
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                    "ArrowUp" ||
                                                                e.key ===
                                                                    "ArrowDown"
                                                            ) {
                                                                e.preventDefault();
                                                            }
                                                        }}
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
                                                        className="no-spinner w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-bold text-slate-700 outline-none disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                            <SuggestionInput
                                value={reason}
                                onChange={setReason}
                                suggestions={
                                    WAREHOUSE_TRANSFER_MOTIVE_SUGGESTIONS
                                }
                                placeholder="Elija un motivo o escriba uno propio..."
                                inputClassName="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                        </div>

                        {error && (
                            <p className="text-xs font-bold text-rose-500">
                                {error}
                            </p>
                        )}

                        {noteFolio && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                                <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                                    Nota {noteFolio} registrada
                                </p>
                                <p className="mt-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    El stock se movió en el momento: los ítems no
                                    requieren aceptación.
                                </p>
                                {pdfMessage && (
                                    <p className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                        {pdfMessage}
                                    </p>
                                )}
                            </div>
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
                        onClick={handleClose}
                        disabled={submitting}
                        className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        {results ? (hasSuccess ? "Cerrar" : "Cancelar") : "Cancelar"}
                    </button>
                    {!hasSuccess && (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {submitting ? "Transfiriendo..." : "Transferir"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransferStockModal;
