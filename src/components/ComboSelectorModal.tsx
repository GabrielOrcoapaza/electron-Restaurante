import React, { useState, useEffect } from "react";
import { useQuery, useLazyQuery } from "@apollo/client";
import {
    GET_ACTIVE_COMBOS,
    GET_PRODUCTS_BY_CATEGORY,
    GET_PRODUCTS_BY_SUBCATEGORY,
} from "../graphql/queries";
import type {
    ComboProduct,
    ComboComponentSelection,
} from "../types/promotions";

interface ComboSelectorModalProps {
    branchId: string;
    onConfirm: (
        combo: ComboProduct,
        components: ComboComponentSelection[],
    ) => void;
    onClose: () => void;
    initialProduct?: ComboProduct | null;
}

export const ComboSelectorModal: React.FC<ComboSelectorModalProps> = ({
    branchId,
    onConfirm,
    onClose,
    initialProduct,
}) => {
    console.log(
        "ComboSelectorModal - branchId:",
        branchId,
        "type:",
        typeof branchId,
    );
    const [selectedCombo, setSelectedCombo] = useState<ComboProduct | null>(
        initialProduct || null,
    );
    const [scopeProducts, setScopeProducts] = useState<Record<string, any[]>>(
        {},
    );
    const [selectedComponents, setSelectedComponents] = useState<
        Record<string, any>
    >({});

    const { data, loading, refetch } = useQuery(GET_ACTIVE_COMBOS, {
        variables: { branchId },
        fetchPolicy: "network-only",
        notifyOnNetworkStatusChange: true,
        onCompleted: (data) => {
            console.log("GET_ACTIVE_COMBOS completed:", data);
            console.log("Variables used:", { branchId });
        },
        onError: (error) => {
            console.error("GET_ACTIVE_COMBOS error:", error);
        },
    });
    const combos: ComboProduct[] = data?.activeCombos || [];
    console.log("Render combos:", combos);

    useEffect(() => {
        console.log("ComboSelectorModal mounted/updated, refetching...");
        refetch();
    }, [branchId, refetch]);

    const [loadSubcategoryProducts] = useLazyQuery(
        GET_PRODUCTS_BY_SUBCATEGORY,
        {
            fetchPolicy: "network-only",
        },
    );
    const [loadCategoryProducts] = useLazyQuery(GET_PRODUCTS_BY_CATEGORY, {
        fetchPolicy: "network-only",
    });

    useEffect(() => {
        if (!selectedCombo?.asPromotion) return;
        setScopeProducts({});
        setSelectedComponents({});

        selectedCombo.asPromotion.scopes.forEach((scope) => {
            if (scope.product) {
                const fixedOk =
                    !scope.product.managesStock ||
                    (scope.product.currentStock ?? 1) > 0;
                setScopeProducts((prev) => ({
                    ...prev,
                    [scope.id]: fixedOk ? [scope.product] : [],
                }));
                if (fixedOk) {
                    setSelectedComponents((prev) => ({
                        ...prev,
                        [scope.id]: scope.product,
                    }));
                }
            } else if (scope.subcategory?.id) {
                loadSubcategoryProducts({
                    variables: { subcategoryId: scope.subcategory.id },
                }).then((res) => {
                    const raw =
                        res.data?.productsBySubcategory ||
                        res.data?.products ||
                        [];
                    const filtered = raw.filter(
                        (p: any) =>
                            p.isActive !== false &&
                            (!p.managesStock || (p.currentStock ?? 1) > 0),
                    );
                    setScopeProducts((prev) => ({
                        ...prev,
                        [scope.id]: filtered,
                    }));
                });
            } else if (scope.category?.id) {
                loadCategoryProducts({
                    variables: { categoryId: scope.category.id },
                }).then((res) => {
                    const raw =
                        res.data?.productsByCategory ||
                        res.data?.products ||
                        [];
                    const filtered = raw.filter(
                        (p: any) =>
                            p.isActive !== false &&
                            (!p.managesStock || (p.currentStock ?? 1) > 0),
                    );
                    setScopeProducts((prev) => ({
                        ...prev,
                        [scope.id]: filtered,
                    }));
                });
            }
        });
    }, [selectedCombo, loadSubcategoryProducts, loadCategoryProducts]);

    const allSelected =
        selectedCombo?.asPromotion?.scopes.every(
            (s) => selectedComponents[s.id],
        ) ?? false;

    const handleConfirm = () => {
        if (!selectedCombo?.asPromotion) return;
        const components: ComboComponentSelection[] =
            selectedCombo.asPromotion.scopes.map((scope) => ({
                scopeId: scope.id,
                scopeLabel: scope.scopeLabel || scope.label || "",
                product: selectedComponents[scope.id],
                quantity: scope.requiredQuantity,
            }));
        onConfirm(selectedCombo, components);
    };

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
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
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                    >
                        ✕
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-4">
                    {loading ? (
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
                                onClick={() => setSelectedCombo(null)}
                                className="flex items-center gap-2 text-sm font-semibold text-orange-400 hover:text-orange-300"
                            >
                                ← Volver a combos
                            </button>
                            <div className="rounded-xl bg-orange-500/10 px-4 py-3">
                                <h3 className="font-bold text-orange-300">
                                    {selectedCombo.name}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    S/ {selectedCombo.salePrice.toFixed(2)}
                                </p>
                            </div>
                            {selectedCombo.asPromotion?.scopes.map((scope) => (
                                <div key={scope.id} className="space-y-2">
                                    <h4 className="font-semibold text-slate-200">
                                        ID: {scope.id}
                                        {scope.scopeLabel || scope.label}
                                        {scope.requiredQuantity > 1 && (
                                            <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs">
                                                ×{scope.requiredQuantity}
                                            </span>
                                        )}
                                    </h4>
                                    {scopeProducts[scope.id]?.length === 0 ? (
                                        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-300">
                                            Sin stock disponible
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            {scopeProducts[scope.id]?.map(
                                                (product) => {
                                                    const isSelected =
                                                        selectedComponents[
                                                            scope.id
                                                        ]?.id === product.id;
                                                    return (
                                                        <button
                                                            key={product.id}
                                                            onClick={() =>
                                                                setSelectedComponents(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        [scope.id]:
                                                                            product,
                                                                    }),
                                                                )
                                                            }
                                                            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-all ${
                                                                isSelected
                                                                    ? "border-orange-500 bg-orange-500/20"
                                                                    : "border-slate-700 bg-slate-800 hover:border-slate-600"
                                                            }`}
                                                        >
                                                            <div>
                                                                <span className="font-semibold text-white">
                                                                    {
                                                                        product.name
                                                                    }
                                                                </span>
                                                            </div>
                                                            <span className="text-sm text-slate-400">
                                                                S/{" "}
                                                                {product.salePrice.toFixed(
                                                                    2,
                                                                )}
                                                            </span>
                                                        </button>
                                                    );
                                                },
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-700 px-4 py-4">
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedCombo || !allSelected}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                    >
                        {!selectedCombo
                            ? "Selecciona un combo"
                            : !allSelected
                              ? "Selecciona todas las opciones"
                              : "⭐ Agregar al pedido"}
                    </button>
                </div>
            </div>
        </div>
    );
};
