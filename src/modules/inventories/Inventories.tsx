import React, { useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
import {
    GET_PRODUCTS_WITH_STOCK,
    GET_CATEGORIES_BY_BRANCH,
    GET_PRODUCTS,
} from "../../graphql/queries";
import { useAuth } from "../../hooks/useAuth";

interface Product {
    id: string;
    code: string;
    name: string;
    description?: string;
    salePrice: number;
    purchasePrice?: number;
    unitMeasure: string;
    currentStock?: number | null;
    stockMin?: number | null;
    stockMax?: number | null;
    imageBase64?: string;
    isActive: boolean;
    productType: string;
    subcategoryId?: string;
}

interface Subcategory {
    id: string;
    name: string;
    description?: string;
    order: number;
    isActive: boolean;
}

interface Category {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    order: number;
    isActive: boolean;
    subcategories?: Subcategory[];
}

// Helper para formatear números de forma segura
const formatNumber = (value: any, decimals: number = 2) => {
    const n = Number(value);
    if (isNaN(n)) return "0.00";
    return n.toLocaleString("es-PE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

const getSafeNumber = (value: any, defaultValue: number = 0): number => {
    if (value === null || value === undefined || isNaN(value)) {
        return defaultValue;
    }
    return Number(value);
};

const PAGE_SIZE = 10;

const Inventories: React.FC = () => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [currentPage, setCurrentPage] = useState<number>(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, searchTerm]);

    const {
        data: productsData,
        loading: productsLoading,
        refetch: refetchStocks,
    } = useQuery(GET_PRODUCTS_WITH_STOCK, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const { data: productsByCategoryData, loading: productsByCategoryLoading } =
        useQuery(GET_PRODUCTS, {
            variables: {
                branchId: branchId!,
                productType: undefined,
                categoryId: selectedCategory || undefined,
            },
            skip: !branchId || !selectedCategory,
            fetchPolicy: "network-only",
        });

    const allProducts: Product[] = productsData?.productsByBranch || [];
    const categories: Category[] = categoriesData?.categoriesByBranch || [];
    const productIdsInCategory: string[] = (
        productsByCategoryData?.products || []
    ).map((p: { id: string }) => p.id);

    const getProductCategoryNames = (subcategoryId?: string) => {
        if (!subcategoryId) return { catName: "—", subName: "—" };
        for (const cat of categories) {
            const sub = cat.subcategories?.find((s) => s.id === subcategoryId);
            if (sub) return { catName: cat.name, subName: sub.name };
        }
        return { catName: "—", subName: "—" };
    };

    const matchesSearch = (product: Product, searchLower: string) => {
        const { catName, subName } = getProductCategoryNames(
            product.subcategoryId,
        );
        return (
            product.name?.toLowerCase().includes(searchLower) ||
            product.code?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower) ||
            catName.toLowerCase().includes(searchLower) ||
            subName.toLowerCase().includes(searchLower)
        );
    };

    let filteredProducts: Product[] = [];
    const trimmedSearch = searchTerm.trim().toLowerCase();

    if (trimmedSearch && !selectedCategory) {
        filteredProducts = allProducts.filter((product) =>
            matchesSearch(product, trimmedSearch),
        );
    } else if (selectedCategory) {
        filteredProducts = allProducts.filter((product) =>
            productIdsInCategory.includes(product.id),
        );
        if (trimmedSearch) {
            filteredProducts = filteredProducts.filter((product) =>
                matchesSearch(product, trimmedSearch),
            );
        }
    } else {
        filteredProducts = allProducts;
    }

    const totalPages = Math.max(
        1,
        Math.ceil(filteredProducts.length / PAGE_SIZE),
    );
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;
    const paginatedProducts = filteredProducts.slice(
        startIndex,
        startIndex + PAGE_SIZE,
    );

    const getStockStatus = (product: Product) => {
        const currentStock = getSafeNumber(product.currentStock, 0);
        const stockMin = getSafeNumber(product.stockMin, 0);
        const stockMax = getSafeNumber(product.stockMax, 0);

        if (currentStock <= stockMin) {
            return {
                status: "low",
                color: "text-rose-600 dark:text-rose-400",
                bgColor: "bg-rose-50 dark:bg-rose-900/20",
                label: "Stock Bajo",
                dot: "bg-rose-500",
            };
        } else if (stockMax > 0 && currentStock >= stockMax) {
            return {
                status: "high",
                color: "text-emerald-600 dark:text-emerald-400",
                bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
                label: "Stock Óptimo",
                dot: "bg-emerald-500",
            };
        } else {
            return {
                status: "normal",
                color: "text-blue-600 dark:text-blue-400",
                bgColor: "bg-blue-50 dark:bg-blue-900/20",
                label: "Stock Normal",
                dot: "bg-blue-500",
            };
        }
    };

    if (!branchId) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-[32px] bg-white p-8 shadow-sm dark:bg-slate-900">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-900/20">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Error de Sucursal
                    </h3>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        No se encontró información de la sucursal activa.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
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
                                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                            Gestión de Inventario
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                            Control de stock y existencias en tiempo real
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetchStocks()}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600 dark:bg-slate-900 dark:text-slate-500 dark:hover:bg-slate-800"
                        title="Refrescar Stock"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
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
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="rounded-[28px] border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-0">
                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Buscar Producto
                        </label>
                        <div className="relative flex items-center">
                            <div className="mr-3 flex items-center text-slate-400">
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
                            </div>
                            <input
                                type="text"
                                placeholder="Nombre o código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300 dark:text-slate-200 dark:placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Categoría
                        </label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200 cursor-pointer"
                        >
                            <option value="">Todas las categorías</option>
                            {categories
                                .filter((c) => c.isActive)
                                .map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="hidden lg:flex flex-col justify-center px-6 py-3 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-r-[22px]">
                        <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                            Resumen General
                        </label>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                                {filteredProducts.length}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tight">
                                Productos encontrados
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Listado de Existencias
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                            {safePage} / {totalPages} Páginas
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    {productsLoading ||
                    (selectedCategory && productsByCategoryLoading) ? (
                        <div className="flex min-h-[300px] flex-col gap-4 p-6">
                            {Array(5)
                                .fill(0)
                                .map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-16 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                                    />
                                ))}
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 dark:bg-slate-800">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-8 w-8"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-2.586 2.586a2 2 0 01-2.828 0L12 14l-2.586 2.586a2 2 0 01-2.828 0L4 13"
                                    />
                                </svg>
                            </div>
                            <p className="text-sm font-bold text-slate-400">
                                No se encontraron productos en el inventario
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-50 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                                        <th className="px-6 py-4">Producto</th>
                                        <th className="px-6 py-4">Código</th>
                                        <th className="px-6 py-4 text-center">
                                            Stock Actual
                                        </th>
                                        <th className="px-6 py-4 text-center">
                                            Mín / Máx
                                        </th>
                                        <th className="px-6 py-4">Unidad</th>
                                        <th className="px-6 py-4 text-center">
                                            Estado
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {paginatedProducts.map((p) => {
                                        const status = getStockStatus(p);
                                        return (
                                            <tr
                                                key={p.id}
                                                className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
                                                            {p.imageBase64 ? (
                                                                <img
                                                                    src={`data:image/jpeg;base64,${p.imageBase64}`}
                                                                    alt={p.name}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center text-slate-300">
                                                                    <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        className="h-5 w-5"
                                                                        fill="none"
                                                                        viewBox="0 0 24 24"
                                                                        stroke="currentColor"
                                                                    >
                                                                        <path
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            strokeWidth={
                                                                                2
                                                                            }
                                                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002-2z"
                                                                        />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-700 dark:text-slate-200">
                                                                {p.name}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-slate-400">
                                                                {
                                                                    getProductCategoryNames(
                                                                        p.subcategoryId,
                                                                    ).catName
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono font-bold text-slate-400">
                                                    {p.code}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span
                                                        className={`text-base font-black ${status.color}`}
                                                    >
                                                        {formatNumber(
                                                            p.currentStock,
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            Mín:{" "}
                                                            {formatNumber(
                                                                p.stockMin,
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            Máx:{" "}
                                                            {formatNumber(
                                                                p.stockMax,
                                                            )}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">
                                                    {p.unitMeasure}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${status.bgColor} ${status.color}`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                                                        />
                                                        {status.label}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {filteredProducts.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t border-slate-50 p-6 dark:border-slate-800/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {startIndex + 1} -{" "}
                            {Math.min(
                                startIndex + PAGE_SIZE,
                                filteredProducts.length,
                            )}{" "}
                            de {filteredProducts.length} Productos
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() =>
                                    setCurrentPage((p) => Math.max(1, p - 1))
                                }
                                disabled={safePage === 1}
                                className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white px-4 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() =>
                                    setCurrentPage((p) =>
                                        Math.min(totalPages, p + 1),
                                    )
                                }
                                disabled={safePage === totalPages}
                                className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white px-4 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inventories;
