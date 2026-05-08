import React, { useState } from "react";
import { useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_STOCK_MOVEMENTS_REPORT,
    GET_STOCKS_BY_BRANCH,
    SEARCH_PRODUCTS,
    GET_PRODUCTS,
} from "../../graphql/queries";
import { formatLocalDateYYYYMMDD } from "../../utils/localDateTime";
import { useLazyQuery } from "@apollo/client";
import { useEffect } from "react";

interface StockMovement {
    id: string;
    movementType: string;
    movementTypeDisplay: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    reason: string;
    createdAt: string;
    productId: string;
    productCode: string;
    productName: string;
    productType: string;
    productTypeDisplay: string;
    stockId: string;
    currentQuantity: number;
    averageCost: number;
    operationId?: string;
    operationOrder?: string;
    operationType?: string;
    operationDate?: string;
    userId?: string;
    userName: string;
    branchId: string;
    branchName: string;
}

interface Product {
    id: string;
    code: string;
    name: string;
    productType: string;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

const Kardex: React.FC = () => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;

    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return formatLocalDateYYYYMMDD(date);
    });
    const [endDate, setEndDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [productSearchTerm, setProductSearchTerm] = useState<string>("");
    const [searchFocused, setSearchFocused] = useState(false);

    const { data: searchData, loading: searchLoading } = useQuery(
        SEARCH_PRODUCTS,
        {
            variables: {
                search: productSearchTerm,
                branchId: branchId!,
                limit: 50,
            },
            skip: !branchId || productSearchTerm.length < 3,
            errorPolicy: "ignore",
            fetchPolicy: "network-only",
        },
    );

    const { data: productsData, refetch: refetchProducts } = useQuery(
        GET_PRODUCTS,
        {
            variables: { branchId: branchId! },
            skip: !branchId,
            fetchPolicy: "network-only",
        },
    );

    const allProductsFromBranch = productsData?.products || [];
    const searchResults = (() => {
        if (productSearchTerm.length < 3) return [];
        const fromSearch = searchData?.searchProducts || [];
        if (fromSearch.length > 0) return fromSearch;
        const lower = productSearchTerm.toLowerCase();
        return allProductsFromBranch.filter(
            (p: Product) =>
                (p.productType === "INGREDIENT" ||
                    p.productType === "BEVERAGE") &&
                ((p.name || "").toLowerCase().includes(lower) ||
                    (p.code || "").toLowerCase().includes(lower)),
        );
    })().filter(
        (p: Product) =>
            p.productType === "INGREDIENT" || p.productType === "BEVERAGE",
    );

    const selectedProduct = selectedProductId
        ? searchResults.find((p: Product) => p.id === selectedProductId) ||
          allProductsFromBranch.find((p: Product) => p.id === selectedProductId)
        : null;

    const { data: stocksData, refetch: refetchStocks } = useQuery(
        GET_STOCKS_BY_BRANCH,
        {
            variables: { branchId: branchId! },
            skip: !branchId,
            fetchPolicy: "network-only",
        },
    );

    const stocksByBranchList = stocksData?.stocksByBranch ?? [];
    const currentStockFromServer: Record<string, number> = {};
    stocksByBranchList.forEach(
        (s: { product?: { id: string }; currentQuantity?: number }) => {
            const pid = s.product?.id;
            if (pid != null) {
                const q = Number(s.currentQuantity);
                if (!Number.isNaN(q)) currentStockFromServer[pid] = q;
            }
        },
    );

    const [fetchMovements, { data, loading }] = useLazyQuery(
        GET_STOCK_MOVEMENTS_REPORT,
        {
            fetchPolicy: "network-only",
        },
    );

    const handleSearch = () => {
        if (!branchId || !startDate || !endDate) return;
        fetchMovements({
            variables: {
                branchId: branchId,
                productId: selectedProductId || null,
                startDate: `${startDate}T00:00:00`,
                endDate: `${endDate}T23:59:59`,
            },
        });
    };

    useEffect(() => {
        if (branchId && startDate && endDate) {
            handleSearch();
        }
    }, [branchId]);

    const movements: StockMovement[] =
        data?.stockMovementsReport?.movements ?? [];
    const openingBalances: {
        stockId: string;
        productId: string;
        openingQuantity: number;
    }[] = data?.stockMovementsReport?.openingBalances ?? [];

    const getAdjustmentTargetFromReason = (
        reason: string | null | undefined,
    ): number | null => {
        if (!reason || typeof reason !== "string") return null;
        const match = reason.match(/(?:->|→)\s*([\d.,]+)/);
        if (!match) return null;
        const numStr = match[1].replace(",", ".");
        const n = parseFloat(numStr);
        return Number.isNaN(n) ? null : n;
    };

    const balanceAfterMovementId: Record<string, number> = (() => {
        const map: Record<string, number> = {};
        const sorted = [...movements].sort(
            (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
        );
        const balanceByStock: Record<string, number> = {};
        for (const ob of openingBalances) {
            const sid = String(ob.stockId ?? "");
            if (!sid) continue;
            const q = Number(ob.openingQuantity);
            balanceByStock[sid] = Number.isNaN(q) ? 0 : q;
        }

        for (const m of sorted) {
            const stockId = String(m.stockId || "");
            let balance = balanceByStock[stockId] ?? 0;
            const q = Number(m.quantity) || 0;
            switch ((m.movementType || "").toUpperCase()) {
                case "IN":
                    balance += q;
                    break;
                case "OUT":
                    balance -= q;
                    break;
                case "ADJUSTMENT": {
                    const targetFromReason = getAdjustmentTargetFromReason(
                        m.reason,
                    );
                    balance = targetFromReason != null ? targetFromReason : q;
                    break;
                }
                case "TRANSFER":
                    balance += q;
                    break;
                default:
                    balance += q;
            }
            balanceByStock[stockId] = balance;
            map[m.id] = balance;
        }
        return map;
    })();

    const getMovementTypeStyles = (type: string) => {
        switch (type.toUpperCase()) {
            case "IN":
                return "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400";
            case "OUT":
                return "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400";
            case "ADJUSTMENT":
                return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400";
            case "TRANSFER":
                return "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400";
            default:
                return "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
        }
    };

    const formatNumber = (value: number, decimals: number = 4) => {
        return new Intl.NumberFormat("es-PE", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value);
    };

    if (!branchId) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-[32px] bg-white p-8 shadow-sm dark:bg-slate-900">
                <div className="text-center text-rose-500 font-bold">
                    No se encontró información de la sucursal.
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-7 w-7"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                            />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                            Kardex de Inventario
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                            Historial detallado de movimientos de productos
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        handleSearch();
                        refetchProducts();
                        refetchStocks();
                    }}
                    disabled={loading}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    {loading ? "Actualizando" : "Refrescar"}
                </button>
            </div>

            {/* Filters Section */}
            <div className="rounded-[28px] border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Desde
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>

                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Hasta
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>

                    <div className="relative flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Producto
                        </label>
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={
                                    selectedProduct
                                        ? `${selectedProduct.code} - ${selectedProduct.name}`
                                        : productSearchTerm
                                }
                                onChange={(e) => {
                                    setSelectedProductId("");
                                    setProductSearchTerm(e.target.value);
                                }}
                                onFocus={() => {
                                    setSearchFocused(true);
                                    if (selectedProduct) {
                                        setSelectedProductId("");
                                        setProductSearchTerm("");
                                    }
                                }}
                                onBlur={() =>
                                    setTimeout(
                                        () => setSearchFocused(false),
                                        200,
                                    )
                                }
                                placeholder="Cualquier producto..."
                                className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300 dark:text-slate-200 dark:placeholder:text-slate-600"
                            />
                            {selectedProduct && (
                                <button
                                    onClick={() => {
                                        setSelectedProductId("");
                                        setProductSearchTerm("");
                                    }}
                                    className="text-slate-400 hover:text-rose-500"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>
                            )}
                        </div>
                        {searchFocused && productSearchTerm.length >= 3 && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-4 max-h-60 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                                {searchLoading ? (
                                    <div className="p-3 text-xs font-bold text-slate-400">
                                        Buscando...
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="p-3 text-xs font-bold text-slate-400">
                                        Sin resultados
                                    </div>
                                ) : (
                                    searchResults.map((p: Product) => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setSelectedProductId(p.id);
                                                setProductSearchTerm("");
                                            }}
                                            className="w-full rounded-xl p-3 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            <span className="text-blue-500">
                                                {p.code}
                                            </span>{" "}
                                            - {p.name}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center p-2">
                        <button
                            onClick={() => {
                                handleSearch();
                            }}
                            disabled={loading}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-blue-300 disabled:opacity-50 dark:shadow-none"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Movements Table */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Historial de Movimientos
                    </h2>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                        {movements.length} Registros
                    </span>
                </div>

                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    {loading ? (
                        <div className="flex min-h-[300px] flex-col gap-4 p-6">
                            {Array(5)
                                .fill(0)
                                .map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-12 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                                    />
                                ))}
                        </div>
                    ) : movements.length === 0 ? (
                        <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
                            <p className="text-sm font-bold text-slate-400">
                                No se encontraron movimientos en este periodo
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-50 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Producto</th>
                                    <th className="px-6 py-4 text-center">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-4 text-center">
                                        Cantidad
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        Costo Unit.
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        Costo Total
                                    </th>
                                    <th className="px-6 py-4 text-center text-blue-600 dark:text-blue-400">
                                        Stock Final
                                    </th>
                                    <th className="px-6 py-4">Usuario</th>
                                    <th className="px-6 py-4">Motivo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {movements.map((m) => {
                                    const qty =
                                        (m.movementType || "").toUpperCase() ===
                                        "OUT"
                                            ? -(
                                                  Math.abs(
                                                      Number(m.quantity),
                                                  ) || 0
                                              )
                                            : Number(m.quantity) || 0;
                                    return (
                                        <tr
                                            key={m.id}
                                            className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-500">
                                                {dateFormatter.format(
                                                    new Date(m.createdAt),
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-700 dark:text-slate-200">
                                                        {m.productName}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        {m.productCode}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span
                                                    className={`inline-block rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-tighter ${getMovementTypeStyles(m.movementType)}`}
                                                >
                                                    {m.movementTypeDisplay}
                                                </span>
                                            </td>
                                            <td
                                                className={`px-6 py-4 text-center font-black ${qty < 0 ? "text-rose-500" : "text-emerald-500"}`}
                                            >
                                                {qty > 0 ? "+" : ""}
                                                {formatNumber(qty, 2)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-500">
                                                {currencyFormatter.format(
                                                    m.unitCost,
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-slate-700 dark:text-slate-200">
                                                {currencyFormatter.format(
                                                    m.totalCost,
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center font-black text-blue-600 dark:text-blue-400">
                                                {formatNumber(
                                                    balanceAfterMovementId[
                                                        m.id
                                                    ] ?? 0,
                                                    2,
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-500">
                                                {m.userName}
                                            </td>
                                            <td
                                                className="px-6 py-4 text-slate-400 max-w-[200px] truncate"
                                                title={m.reason}
                                            >
                                                {m.reason || "-"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Kardex;
