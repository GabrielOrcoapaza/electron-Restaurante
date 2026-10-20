import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_BRANCHES_BY_COMPANY,
    GET_PRODUCTS_FOR_MASTER_INGREDIENT_LINK,
} from "../../graphql/queries";
import { LINK_PRODUCT_TO_MASTER_INGREDIENT } from "../../graphql/mutations";

interface Product {
    id: string;
    code: string;
    name: string;
    productType: string;
    unitMeasure: string;
    isActive: boolean;
    masterIngredient: { id: string; name: string } | null;
}

interface BranchOption {
    id: string;
    name: string;
}

interface LinkProductModalProps {
    branchId: string;
    masterIngredient: { id: string; name: string };
    onClose: () => void;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const LinkProductModal: React.FC<LinkProductModalProps> = ({
    branchId,
    masterIngredient,
    onClose,
}) => {
    const { companyData } = useAuth();
    const companyId = companyData?.company?.id;

    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    // Sucursal cuyos productos se están listando. Arranca en la sucursal del
    // usuario logueado y puede cambiarse con los botones de arriba para
    // vincular hijos en otras sucursales de la misma empresa (la mutación
    // valida por empresa, no por sucursal).
    const [activeBranchId, setActiveBranchId] = useState(branchId);

    const { data: branchesData, loading: branchesLoading } = useQuery(
        GET_BRANCHES_BY_COMPANY,
        {
            variables: { companyId: companyId! },
            skip: !companyId,
            fetchPolicy: "network-only",
        },
    );
    const branches: BranchOption[] = branchesData?.branchesByCompany || [];
    const activeBranchName =
        branches.find((b) => String(b.id) === String(activeBranchId))?.name ||
        "esta sucursal";

    const { data, loading, refetch } = useQuery(
        GET_PRODUCTS_FOR_MASTER_INGREDIENT_LINK,
        {
            variables: { branchId: activeBranchId },
            skip: !activeBranchId,
            fetchPolicy: "network-only",
        },
    );

    const products: Product[] = (data?.products || []).filter(
        (p: Product) =>
            p.productType === "INGREDIENT" || p.productType === "BEVERAGE",
    );

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return products;
        return products.filter(
            (p) =>
                p.name.toLowerCase().includes(term) ||
                p.code.toLowerCase().includes(term),
        );
    }, [products, search]);

    const [linkProduct, { loading: linking }] = useMutation(
        LINK_PRODUCT_TO_MASTER_INGREDIENT,
    );

    const handleLink = async (productId: string) => {
        setError("");
        try {
            const { data } = await linkProduct({
                variables: {
                    productId,
                    masterIngredientId: masterIngredient.id,
                },
            });
            if (data?.linkProductToMasterIngredient?.success) {
                await refetch();
            } else {
                setError(
                    data?.linkProductToMasterIngredient?.message ||
                        "No se pudo vincular",
                );
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error al vincular"));
        }
    };

    const handleUnlink = async (productId: string) => {
        setError("");
        try {
            const { data } = await linkProduct({
                variables: { productId, masterIngredientId: null },
            });
            if (data?.linkProductToMasterIngredient?.success) {
                await refetch();
            } else {
                setError(
                    data?.linkProductToMasterIngredient?.message ||
                        "No se pudo desvincular",
                );
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error al desvincular"));
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Vincular producto a "{masterIngredient.name}"
                    </h2>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Solo puede haber un producto de cada sucursal vinculado
                        a este ingrediente
                    </p>
                    {branches.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {branches.map((b) => {
                                const active =
                                    String(b.id) === String(activeBranchId);
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => {
                                            setActiveBranchId(b.id);
                                            setError("");
                                        }}
                                        disabled={branchesLoading}
                                        className={
                                            active
                                                ? "rounded-full bg-indigo-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white"
                                                : "rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                                        }
                                    >
                                        {b.name}
                                        {String(b.id) === String(branchId) &&
                                            " · actual"}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <input
                        type="text"
                        placeholder={`Buscar producto en ${activeBranchName}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                    {error && (
                        <p className="mt-2 text-xs font-bold text-rose-500">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/50">
                    {loading ? (
                        <div className="flex flex-col gap-3 p-4">
                            {Array(4)
                                .fill(0)
                                .map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-14 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                                    />
                                ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="p-6 text-center text-sm font-bold text-slate-400">
                            No se encontraron productos
                        </p>
                    ) : (
                        filtered.map((p) => {
                            const linkedToThis =
                                p.masterIngredient?.id === masterIngredient.id;
                            const linkedToOther =
                                p.masterIngredient &&
                                p.masterIngredient.id !== masterIngredient.id;
                            return (
                                <div
                                    key={p.id}
                                    className="flex items-center justify-between gap-3 px-6 py-3"
                                >
                                    <div>
                                        <div className="font-black text-slate-700 dark:text-slate-200">
                                            {p.name}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400">
                                            {p.code}
                                            {linkedToThis && (
                                                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                                                    Vinculado a este
                                                </span>
                                            )}
                                            {linkedToOther && (
                                                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                                                    Vinculado a "
                                                    {p.masterIngredient!.name}"
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {linkedToThis ? (
                                        <button
                                            onClick={() =>
                                                handleUnlink(p.id)
                                            }
                                            disabled={linking}
                                            className="whitespace-nowrap rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-800 dark:hover:bg-rose-900/20"
                                        >
                                            Desvincular
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleLink(p.id)}
                                            disabled={linking}
                                            className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-indigo-700 disabled:opacity-40"
                                        >
                                            Vincular
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex justify-end border-t border-slate-100 p-4 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LinkProductModal;
