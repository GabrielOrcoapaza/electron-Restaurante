import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useLazyQuery } from "@apollo/client";
import {
    GET_ACTIVE_COMBOS,
    GET_PRODUCTS_BY_CATEGORY,
    GET_PRODUCTS_BY_SUBCATEGORY,
} from "../graphql/queries";
import type {
    ComboProduct,
    ComboComponentSelection,
    ComboScope,
} from "../types/promotions";
import { isProductOrderable } from "../utils/operationStock";
import { productStockLabel } from "../utils/productStockDisplay";

interface ComboSelectorModalProps {
    branchId: string;
    onConfirm: (
        combo: ComboProduct,
        components: ComboComponentSelection[],
    ) => void;
    onClose: () => void;
    initialProduct?: ComboProduct | null;
}

/** Grupo de elección dentro del combo (1 scope o varios scopes fusionados) */
interface ChoiceGroup {
    key: string;
    title: string;
    /** Cuántos platos debe elegir el usuario en este grupo */
    requiredPickCount: number;
    /** pick_many: menú (subcategoría/categoría); pick_one: producto fijo del combo */
    pickMode: "pick_many" | "pick_one";
    /** scopeId → cantidad requerida, para mapear al confirmar */
    scopeByProductId: Map<string, { scopeId: string; quantity: number }>;
}

type ComboListProduct = {
    id?: string;
    name?: string;
    salePrice?: number;
    isActive?: boolean;
    managesStock?: boolean | null;
    currentStock?: number | null;
    productType?: string;
};

const isComboListProduct = (p: ComboListProduct): boolean =>
    p.isActive !== false && p.productType !== "PROMOTION";

const sameId = (a: unknown, b: unknown) => String(a) === String(b);

function scopeGroupTitle(scope: ComboScope): string {
    return (
        scope.scopeLabel ||
        scope.label ||
        scope.subcategory?.name ||
        scope.category?.name ||
        "Elige una opción"
    );
}

function scopeRequiredQuantity(scope: ComboScope): number {
    const qty = Number(scope.requiredQuantity);
    if (!Number.isFinite(qty) || qty < 1) return 1;
    return Math.floor(qty);
}

/** Agrupa scopes de producto fijo que comparten subcategoría en un solo grupo de elección */
function buildChoiceGroups(scopes: ComboScope[]): ChoiceGroup[] {
    const groups: ChoiceGroup[] = [];
    const productBuckets = new Map<string, ChoiceGroup>();

    for (const scope of scopes) {
        if (scope.subcategory?.id || scope.category?.id) {
            groups.push({
                key: scope.id,
                title: scopeGroupTitle(scope),
                requiredPickCount: scopeRequiredQuantity(scope),
                pickMode: "pick_many",
                scopeByProductId: new Map(),
            });
            continue;
        }

        if (!scope.product?.id) continue;

        const subKey =
            scope.product.subcategory?.id ||
            scope.product.subcategoryId ||
            (scope.product.subcategory?.name
                ? `subcat-name-${scope.product.subcategory.name}`
                : null) ||
            (scope.scopeLabel || scope.label || "").trim().toLowerCase() ||
            `fixed-${scope.id}`;

        const bucketTitle =
            scope.product.subcategory?.name ||
            scope.scopeLabel ||
            scope.label ||
            "Elige una opción";

        if (!productBuckets.has(subKey)) {
            productBuckets.set(subKey, {
                key: `product-group-${subKey}`,
                title: bucketTitle,
                requiredPickCount: 1,
                pickMode: "pick_one",
                scopeByProductId: new Map(),
            });
        }

        const bucket = productBuckets.get(subKey)!;
        bucket.scopeByProductId.set(String(scope.product.id), {
            scopeId: scope.id,
            quantity: scopeRequiredQuantity(scope),
        });
    }

    return [...groups, ...productBuckets.values()];
}

export const ComboSelectorModal: React.FC<ComboSelectorModalProps> = ({
    branchId,
    onConfirm,
    onClose,
    initialProduct,
}) => {
    const [selectedCombo, setSelectedCombo] = useState<ComboProduct | null>(
        initialProduct || null,
    );
    const [groupProducts, setGroupProducts] = useState<Record<string, any[]>>(
        {},
    );
    const [loadingGroups, setLoadingGroups] = useState<Record<string, boolean>>(
        {},
    );
    const [selectedByGroup, setSelectedByGroup] = useState<
        Record<string, ComboListProduct[]>
    >({});

    const { data, loading } = useQuery(GET_ACTIVE_COMBOS, {
        variables: { branchId },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const combos: ComboProduct[] = data?.activeCombos || [];
    const isInitialLoading = loading && !data;

    const [loadSubcategoryProducts] = useLazyQuery(
        GET_PRODUCTS_BY_SUBCATEGORY,
        { fetchPolicy: "network-only" },
    );
    const [loadCategoryProducts] = useLazyQuery(GET_PRODUCTS_BY_CATEGORY, {
        fetchPolicy: "network-only",
    });

    const selectedComboId = selectedCombo?.id ?? null;
    const selectedComboRef = useRef(selectedCombo);
    selectedComboRef.current = selectedCombo;
    const loadedComboIdRef = useRef<string | null>(null);
    const loadSubcategoryRef = useRef(loadSubcategoryProducts);
    const loadCategoryRef = useRef(loadCategoryProducts);
    loadSubcategoryRef.current = loadSubcategoryProducts;
    loadCategoryRef.current = loadCategoryProducts;

    const activeCombo =
        selectedComboId != null
            ? combos.find((c) => sameId(c.id, selectedComboId)) ?? selectedCombo
            : selectedCombo;

    const choiceGroups = useMemo(() => {
        const scopes = activeCombo?.asPromotion?.scopes ?? [];
        return buildChoiceGroups(scopes);
    }, [activeCombo?.asPromotion?.scopes]);

    const scopesById = useMemo(() => {
        const map = new Map<string, ComboScope>();
        for (const s of activeCombo?.asPromotion?.scopes ?? []) {
            map.set(s.id, s);
        }
        return map;
    }, [activeCombo?.asPromotion?.scopes]);

    useEffect(() => {
        if (!selectedComboId) {
            loadedComboIdRef.current = null;
            return;
        }

        const combo =
            combos.find((c) => sameId(c.id, selectedComboId)) ??
            selectedComboRef.current;
        if (!combo?.asPromotion) return;
        if (loadedComboIdRef.current === selectedComboId) return;
        loadedComboIdRef.current = selectedComboId;

        let cancelled = false;
        setGroupProducts({});
        setSelectedByGroup({});
        setLoadingGroups({});

        const groups = buildChoiceGroups(combo.asPromotion.scopes);
        const pending: Record<string, boolean> = {};
        groups.forEach((g) => {
            pending[g.key] = true;
        });
        setLoadingGroups(pending);

        const finishGroup = (groupKey: string, products: any[]) => {
            if (cancelled) return;
            setGroupProducts((prev) => ({ ...prev, [groupKey]: products }));
            setLoadingGroups((prev) => ({ ...prev, [groupKey]: false }));
        };

        for (const group of groups) {
            const scope = combo.asPromotion!.scopes.find(
                (s) => s.id === group.key,
            );

            if (scope?.subcategory?.id) {
                loadSubcategoryRef
                    .current({ variables: { subcategoryId: scope.subcategory.id } })
                    .then((res) => {
                        const raw =
                            res.data?.productsBySubcategory ||
                            res.data?.products ||
                            [];
                        finishGroup(
                            group.key,
                            raw.filter((p: ComboListProduct) =>
                                isComboListProduct(p),
                            ),
                        );
                    })
                    .catch(() => finishGroup(group.key, []));
                continue;
            }

            if (scope?.category?.id) {
                loadCategoryRef
                    .current({ variables: { categoryId: scope.category.id } })
                    .then((res) => {
                        const raw =
                            res.data?.productsByCategory ||
                            res.data?.products ||
                            [];
                        finishGroup(
                            group.key,
                            raw.filter((p: ComboListProduct) =>
                                isComboListProduct(p),
                            ),
                        );
                    })
                    .catch(() => finishGroup(group.key, []));
                continue;
            }

            // Grupo fusionado de productos fijos → listar todos como opciones
            const products: any[] = [];
            for (const [productId] of group.scopeByProductId) {
                for (const s of combo.asPromotion!.scopes) {
                    if (
                        s.product?.id &&
                        sameId(s.product.id, productId) &&
                        isComboListProduct(s.product)
                    ) {
                        products.push(s.product);
                    }
                }
            }
            finishGroup(group.key, products);
        }

        return () => {
            cancelled = true;
        };
    }, [selectedComboId, combos]);

    const handleSelectProduct = useCallback(
        (groupKey: string, product: ComboListProduct, group: ChoiceGroup) => {
            if (!isProductOrderable(product)) return;
            setSelectedByGroup((prev) => {
                const current = prev[groupKey] ?? [];

                if (group.pickMode === "pick_one") {
                    const only = current[0];
                    if (only && sameId(only.id, product.id)) {
                        return { ...prev, [groupKey]: [] };
                    }
                    return { ...prev, [groupKey]: [product] };
                }

                if (current.length >= group.requiredPickCount) {
                    return prev;
                }
                return { ...prev, [groupKey]: [...current, product] };
            });
        },
        [],
    );

    const handleRemoveSelection = useCallback(
        (groupKey: string, index: number) => {
            setSelectedByGroup((prev) => {
                const current = prev[groupKey] ?? [];
                if (index < 0 || index >= current.length) return prev;
                const next = current.filter((_, i) => i !== index);
                return { ...prev, [groupKey]: next };
            });
        },
        [],
    );

    const groupSelectionComplete = useCallback(
        (group: ChoiceGroup) => {
            const selections = selectedByGroup[group.key] ?? [];
            return selections.length === group.requiredPickCount;
        },
        [selectedByGroup],
    );

    const groupHasSelectable = useCallback(
        (group: ChoiceGroup) =>
            (groupProducts[group.key] ?? []).some((p) =>
                isProductOrderable(p),
            ),
        [groupProducts],
    );

    const allSelected =
        choiceGroups.length > 0 &&
        choiceGroups.every(
            (g) => !groupHasSelectable(g) || groupSelectionComplete(g),
        );

    const canConfirm =
        Boolean(activeCombo) &&
        choiceGroups.length > 0 &&
        choiceGroups.every((g) => groupHasSelectable(g)) &&
        allSelected;

    const handleConfirm = () => {
        if (!activeCombo?.asPromotion) return;

        const components: ComboComponentSelection[] = [];

        for (const group of choiceGroups) {
            const selections = selectedByGroup[group.key] ?? [];
            if (selections.length === 0) continue;

            if (group.pickMode === "pick_one") {
                const product = selections[0];
                const mapping = group.scopeByProductId.get(String(product.id));
                const scopeId = mapping?.scopeId ?? group.key;
                const scope = scopesById.get(scopeId);
                const quantity =
                    mapping?.quantity ?? scope?.requiredQuantity ?? 1;

                components.push({
                    scopeId,
                    scopeLabel:
                        scope?.scopeLabel || scope?.label || group.title || "",
                    product: {
                        id: product.id!,
                        name: product.name ?? "",
                        salePrice: Number(product.salePrice) || 0,
                    },
                    quantity,
                });
                continue;
            }

            for (const product of selections) {
                const scopeId = group.key;
                const scope = scopesById.get(scopeId);

                components.push({
                    scopeId,
                    scopeLabel:
                        scope?.scopeLabel || scope?.label || group.title || "",
                    product: {
                        id: product.id!,
                        name: product.name ?? "",
                        salePrice: Number(product.salePrice) || 0,
                    },
                    quantity: 1,
                });
            }
        }

        onConfirm(activeCombo, components);
    };

    const modal = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-700 bg-orange-600 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            ⭐ Combos Disponibles
                        </h2>
                        <p className="text-orange-100 text-sm">
                            {selectedCombo
                                ? "Elige tus opciones"
                                : "Selecciona un combo"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                    >
                        ✕
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-4">
                    {isInitialLoading ? (
                        <div className="py-12 text-center text-slate-400">
                            Cargando combos...
                        </div>
                    ) : !selectedCombo ? (
                        <div className="grid gap-3">
                            {combos.length === 0 ? (
                                <div className="py-12 text-center text-slate-400">
                                    No hay combos disponibles en este momento.
                                </div>
                            ) : (
                                combos.map((combo) => (
                                    <button
                                        type="button"
                                        key={combo.id}
                                        onClick={() => setSelectedCombo(combo)}
                                        className="flex flex-col items-start gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-left transition-all hover:border-orange-500 hover:bg-orange-500/10"
                                    >
                                        <div className="flex w-full items-center justify-between">
                                            <span className="font-bold text-white">
                                                {combo.name}
                                            </span>
                                            <span className="font-bold text-orange-400">
                                                S/ {combo.salePrice.toFixed(2)}
                                            </span>
                                        </div>
                                        {combo.description && (
                                            <span className="text-sm text-slate-400">
                                                {combo.description}
                                            </span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <button
                                type="button"
                                onClick={() => {
                                    loadedComboIdRef.current = null;
                                    setSelectedCombo(null);
                                }}
                                className="flex items-center gap-2 text-sm font-semibold text-orange-400 hover:text-orange-300"
                            >
                                ← Volver a combos
                            </button>
                            <div className="rounded-xl bg-orange-500/10 px-4 py-3">
                                <h3 className="font-bold text-orange-300">
                                    {activeCombo?.name}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    S/ {activeCombo?.salePrice.toFixed(2)}
                                </p>
                            </div>
                            {choiceGroups.map((group) => {
                                const products = groupProducts[group.key] ?? [];
                                const multiChoice = products.length > 1;
                                const selectableProducts = products.filter((p) =>
                                    isProductOrderable(p),
                                );
                                const selections = selectedByGroup[group.key] ?? [];
                                const pickLabel =
                                    group.requiredPickCount === 1
                                        ? "(elige 1)"
                                        : `(elige ${group.requiredPickCount})`;
                                const atMaxSelections =
                                    group.pickMode === "pick_many" &&
                                    selections.length >= group.requiredPickCount;

                                const renderProductStock = (
                                    product: ComboListProduct,
                                ) => {
                                    const stockLabel = productStockLabel(product);
                                    if (!stockLabel) return null;
                                    return (
                                        <span className="text-xs font-semibold text-slate-400">
                                            {stockLabel}
                                        </span>
                                    );
                                };

                                const selectionCountForProduct = (
                                    product: ComboListProduct,
                                ) =>
                                    selections.filter((s) =>
                                        sameId(s.id, product.id),
                                    ).length;

                                return (
                                    <div key={group.key} className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="font-semibold text-slate-200">
                                                {group.title}
                                                {(multiChoice ||
                                                    group.requiredPickCount >
                                                        1) && (
                                                    <span className="ml-2 text-xs font-normal text-slate-400">
                                                        {pickLabel}
                                                    </span>
                                                )}
                                            </h4>
                                            {group.pickMode === "pick_many" &&
                                                group.requiredPickCount > 1 && (
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                                            groupSelectionComplete(
                                                                group,
                                                            )
                                                                ? "bg-emerald-500/20 text-emerald-300"
                                                                : "bg-slate-700 text-slate-300"
                                                        }`}
                                                    >
                                                        {selections.length}/
                                                        {group.requiredPickCount}
                                                    </span>
                                                )}
                                        </div>
                                        {selections.length > 0 &&
                                            group.pickMode === "pick_many" &&
                                            group.requiredPickCount > 1 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {selections.map(
                                                        (product, index) => (
                                                            <button
                                                                type="button"
                                                                key={`${product.id}-${index}`}
                                                                onClick={() =>
                                                                    handleRemoveSelection(
                                                                        group.key,
                                                                        index,
                                                                    )
                                                                }
                                                                className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-200 hover:bg-orange-500/20"
                                                            >
                                                                {product.name}
                                                                <span className="text-orange-300">
                                                                    ✕
                                                                </span>
                                                            </button>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        {loadingGroups[group.key] ? (
                                            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-400">
                                                Cargando opciones...
                                            </div>
                                        ) : products.length === 0 ? (
                                            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-300">
                                                No hay opciones disponibles
                                            </div>
                                        ) : selectableProducts.length === 0 ? (
                                            <div className="grid gap-2">
                                                {products.map((product) => (
                                                    <div
                                                        key={product.id}
                                                        className="flex cursor-not-allowed items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 opacity-60"
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-600 bg-transparent" />
                                                            <div className="flex min-w-0 flex-col gap-0.5">
                                                                <span className="font-semibold text-slate-400">
                                                                    {product.name}
                                                                </span>
                                                                {renderProductStock(
                                                                    product,
                                                                )}
                                                            </div>
                                                        </div>
                                                        <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">
                                                            Sin stock
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="grid gap-2">
                                                {products.map((product) => {
                                                    const pickedCount =
                                                        selectionCountForProduct(
                                                            product,
                                                        );
                                                    const isSelected =
                                                        pickedCount > 0;
                                                    const outOfStock =
                                                        !isProductOrderable(
                                                            product,
                                                        );
                                                    const disabledAdd =
                                                        outOfStock ||
                                                        (group.pickMode ===
                                                            "pick_many" &&
                                                            atMaxSelections &&
                                                            pickedCount === 0);
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={product.id}
                                                            disabled={
                                                                disabledAdd
                                                            }
                                                            onClick={() =>
                                                                handleSelectProduct(
                                                                    group.key,
                                                                    product,
                                                                    group,
                                                                )
                                                            }
                                                            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-all ${
                                                                outOfStock
                                                                    ? "cursor-not-allowed border-slate-700 bg-slate-800/40 opacity-60"
                                                                    : isSelected
                                                                      ? "cursor-pointer border-orange-500 bg-orange-500/20 ring-2 ring-orange-500/40 active:scale-[0.99]"
                                                                      : disabledAdd
                                                                        ? "cursor-not-allowed border-slate-700 bg-slate-800/40 opacity-50"
                                                                        : "cursor-pointer border-slate-600 bg-slate-800 hover:border-orange-400 hover:bg-slate-700 active:scale-[0.99]"
                                                            }`}
                                                        >
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <span
                                                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                                                        outOfStock
                                                                            ? "border-slate-600 bg-transparent"
                                                                            : isSelected
                                                                              ? "border-orange-500 bg-orange-500 text-white"
                                                                              : "border-slate-400 bg-transparent"
                                                                    }`}
                                                                >
                                                                    {isSelected &&
                                                                        !outOfStock &&
                                                                        (pickedCount >
                                                                        1 ? (
                                                                            <span className="text-[10px] leading-none font-bold">
                                                                                {
                                                                                    pickedCount
                                                                                }
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs leading-none">
                                                                                ✓
                                                                            </span>
                                                                        ))}
                                                                </span>
                                                                <div className="flex min-w-0 flex-col gap-0.5">
                                                                    <span
                                                                        className={`font-semibold ${
                                                                            outOfStock
                                                                                ? "text-slate-400"
                                                                                : "text-white"
                                                                        }`}
                                                                    >
                                                                        {
                                                                            product.name
                                                                        }
                                                                    </span>
                                                                    {renderProductStock(
                                                                        product,
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                                {outOfStock ? (
                                                                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">
                                                                        Sin stock
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-sm text-slate-400">
                                                                        S/{" "}
                                                                        {Number(
                                                                            product.salePrice,
                                                                        ).toFixed(
                                                                            2,
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-700 px-4 py-4">
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                    >
                        {!selectedCombo
                            ? "Selecciona un combo"
                            : !choiceGroups.every((g) => groupHasSelectable(g))
                              ? "Sin stock en alguna opción del menú"
                              : !allSelected
                                ? "Selecciona todas las opciones"
                                : "⭐ Agregar al pedido"}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
};
