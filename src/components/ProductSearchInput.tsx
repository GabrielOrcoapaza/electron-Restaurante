import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import {
    GET_PRODUCT_BY_CODE,
    SEARCH_PRODUCTS,
} from '../graphql/queries';

interface SearchProduct {
    id: string;
    code?: string;
    name: string;
    salePrice?: number;
    productType?: string | null;
    unitMeasure?: string | null;
    isActive?: boolean | null;
}

interface ProductSearchInputProps {
    branchId: string;
    selectedProductId?: string;
    selectedProductName?: string;
    onSelect: (product: SearchProduct) => void;
    onClear?: () => void;
    placeholder?: string;
    compact?: boolean;
    /** Si se define, solo devuelve productos de estos tipos (ej. INGREDIENT). */
    productTypes?: string[];
    /** IDs de productos que no deben aparecer en los resultados. */
    excludeProductIds?: string[];
}

function isSearchableProduct(
    p: SearchProduct,
    allowedTypes?: string[],
): boolean {
    if (p.isActive === false) return false;
    const t = String(p.productType || '').toUpperCase();
    if (allowedTypes?.length) {
        return allowedTypes.some(
            (type) => type.toUpperCase() === t,
        );
    }
    return t === 'DISH' || t === 'BEVERAGE' || t === 'PROMOTION';
}

const ProductSearchInput: React.FC<ProductSearchInputProps> = ({
    branchId,
    selectedProductId,
    selectedProductName,
    onSelect,
    onClear,
    placeholder = 'Buscar producto o escanear código',
    compact = false,
    productTypes,
    excludeProductIds = [],
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchByCodeOnly, setSearchByCodeOnly] = useState(false);

    const searchMinLength = searchByCodeOnly ? 1 : 3;
    const trimmedSearch = searchTerm.trim();
    const isSearching = searchByCodeOnly
        ? trimmedSearch.length >= 1
        : trimmedSearch.length >= 3;

    const { data: searchData, loading: searchLoading } = useQuery(
        SEARCH_PRODUCTS,
        {
            variables: {
                search: trimmedSearch,
                branchId,
                limit: 50,
            },
            skip: !branchId || searchByCodeOnly || trimmedSearch.length < searchMinLength,
            errorPolicy: 'ignore',
            fetchPolicy: 'network-only',
        },
    );

    const { data: productByCodeData, loading: productByCodeLoading } = useQuery(
        GET_PRODUCT_BY_CODE,
        {
            variables: {
                branchId,
                code: trimmedSearch,
            },
            skip: !branchId || !searchByCodeOnly || !trimmedSearch,
            errorPolicy: 'ignore',
            fetchPolicy: 'network-only',
        },
    );

    let products: SearchProduct[] = [];
    let loading = false;

    const excludedIds = new Set(excludeProductIds.map(String));

    if (searchByCodeOnly && trimmedSearch.length >= 1) {
        const p =
            productByCodeData?.productByCode ??
            productByCodeData?.product_by_code;
        products =
            p &&
            isSearchableProduct(p, productTypes) &&
            !excludedIds.has(String(p.id))
                ? [p]
                : [];
        loading = productByCodeLoading;
    } else if (trimmedSearch.length >= 3) {
        const raw = searchData?.searchProducts;
        products = Array.isArray(raw)
            ? raw.filter(
                  (p) =>
                      isSearchableProduct(p, productTypes) &&
                      !excludedIds.has(String(p.id)),
              )
            : [];
        loading = searchLoading;
    }

    const resultsLabel =
        productTypes?.length === 1 &&
        productTypes[0].toUpperCase() === 'INGREDIENT'
            ? 'ingredientes'
            : 'productos';

    const inputClass = compact
        ? 'w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
        : 'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-slate-900 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

    const handleSelect = (product: SearchProduct) => {
        onSelect(product);
        setSearchTerm('');
    };

    const hasSelection = Boolean(selectedProductId && selectedProductName);
    const showResults =
        !hasSelection &&
        isSearching &&
        (loading || products.length > 0 || trimmedSearch.length >= searchMinLength);

    return (
        <div className="space-y-2">
            {hasSelection && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300">
                    <span>
                        Seleccionado: <strong>{selectedProductName}</strong>
                    </span>
                    {onClear && (
                        <button
                            type="button"
                            onClick={() => {
                                onClear();
                                setSearchTerm('');
                            }}
                            className="shrink-0 text-xs font-semibold text-green-700 hover:text-green-900 dark:text-green-300"
                        >
                            Cambiar
                        </button>
                    )}
                </div>
            )}

            {!hasSelection && (
                <>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setSearchByCodeOnly((v) => !v)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        searchByCodeOnly
                            ? 'border-blue-500 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                >
                    Solo código
                </button>
                <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">
                        🔎
                    </span>
                    <input
                        type="text"
                        placeholder={
                            searchByCodeOnly
                                ? 'Código del producto...'
                                : placeholder
                        }
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && products.length > 0) {
                                e.preventDefault();
                                handleSelect(products[0]);
                            }
                        }}
                        className={inputClass}
                    />
                </div>
            </div>

            {showResults && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    {loading ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">
                            Buscando...
                        </div>
                    ) : products.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">
                            No se encontraron {resultsLabel}
                        </div>
                    ) : (
                        products.map((product) => (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => handleSelect(product)}
                                className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-indigo-50 dark:border-slate-800 dark:hover:bg-indigo-500/10"
                            >
                                <div className="min-w-0">
                                    <div className="truncate font-medium text-slate-800 dark:text-slate-100">
                                        {product.name}
                                    </div>
                                    {product.code && (
                                        <div className="text-xs text-slate-400">
                                            Cód: {product.code}
                                        </div>
                                    )}
                                </div>
                                {product.salePrice != null && (
                                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                                        S/ {Number(product.salePrice).toFixed(2)}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}

            {!isSearching && trimmedSearch.length > 0 && trimmedSearch.length < 3 && !searchByCodeOnly && (
                <p className="text-xs text-slate-400">
                    Escribe al menos 3 caracteres para buscar
                </p>
            )}
                </>
            )}
        </div>
    );
};

export default ProductSearchInput;
