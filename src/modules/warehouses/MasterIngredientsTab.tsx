import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { GET_MASTER_INGREDIENTS_WITH_LINKS } from "../../graphql/queries";
import {
    CREATE_MASTER_INGREDIENT,
    UPDATE_MASTER_INGREDIENT,
} from "../../graphql/mutations";
import { PRODUCT_UNIT_MEASURE_OPTIONS } from "../../constants/productUnitMeasures";
import LinkProductModal from "./LinkProductModal";

interface LinkedProduct {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    branch: { id: string; name: string } | null;
}

interface ConglomerateIdentityRef {
    id: string;
    name: string;
    unitMeasure: string;
}

interface MasterIngredient {
    id: string;
    name: string;
    unitMeasure: string;
    isActive: boolean;
    conglomerateIngredient?: ConglomerateIdentityRef | null;
    branchProducts?: LinkedProduct[];
}

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const MasterIngredientsTab: React.FC<{ branchId: string }> = ({
    branchId,
}) => {
    const [showFormModal, setShowFormModal] = useState(false);
    const [editing, setEditing] = useState<MasterIngredient | null>(null);
    const [linkingIngredient, setLinkingIngredient] =
        useState<MasterIngredient | null>(null);
    const [formName, setFormName] = useState("");
    const [formUnit, setFormUnit] = useState("NIU");
    const [formError, setFormError] = useState("");

    const { data, loading, refetch } = useQuery(
        GET_MASTER_INGREDIENTS_WITH_LINKS,
        {
            variables: { includeInactive: true },
            fetchPolicy: "network-only",
        },
    );
    const masterIngredients: MasterIngredient[] =
        data?.masterIngredientsByCompany || [];

    const productsOf = (mi: MasterIngredient): LinkedProduct[] =>
        [...(mi.branchProducts || [])].sort(
            (a, b) =>
                (a.branch?.name || "").localeCompare(
                    b.branch?.name || "",
                ) || a.name.localeCompare(b.name),
        );

    const [createMasterIngredient, { loading: creating }] = useMutation(
        CREATE_MASTER_INGREDIENT,
    );
    const [updateMasterIngredient, { loading: updating }] = useMutation(
        UPDATE_MASTER_INGREDIENT,
    );

    const openCreate = () => {
        setEditing(null);
        setFormName("");
        setFormUnit("NIU");
        setFormError("");
        setShowFormModal(true);
    };

    const openEdit = (mi: MasterIngredient) => {
        setEditing(mi);
        setFormName(mi.name);
        setFormUnit(mi.unitMeasure);
        setFormError("");
        setShowFormModal(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            setFormError("El nombre es obligatorio");
            return;
        }
        try {
            if (editing) {
                const { data } = await updateMasterIngredient({
                    variables: {
                        masterIngredientId: editing.id,
                        name: formName.trim(),
                        unitMeasure: formUnit,
                    },
                });
                if (!data?.updateMasterIngredient?.success) {
                    setFormError(
                        data?.updateMasterIngredient?.message ||
                            "No se pudo actualizar",
                    );
                    return;
                }
            } else {
                const { data } = await createMasterIngredient({
                    variables: { name: formName.trim(), unitMeasure: formUnit },
                });
                if (!data?.createMasterIngredient?.success) {
                    setFormError(
                        data?.createMasterIngredient?.message ||
                            "No se pudo crear",
                    );
                    return;
                }
            }
            setShowFormModal(false);
            await refetch();
        } catch (err: unknown) {
            setFormError(getErrorMessage(err, "Error al guardar"));
        }
    };

    const handleToggleActive = async (mi: MasterIngredient) => {
        try {
            const { data } = await updateMasterIngredient({
                variables: { masterIngredientId: mi.id, isActive: !mi.isActive },
            });
            if (data?.updateMasterIngredient?.success) {
                await refetch();
            } else {
                alert(
                    data?.updateMasterIngredient?.message ||
                        "No se pudo actualizar",
                );
            }
        } catch (err: unknown) {
            alert(getErrorMessage(err, "Error al actualizar"));
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Ingredientes Maestros
                    </h2>
                    <p className="mt-1 max-w-2xl text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Identidad de insumo a nivel empresa. Aquí se ven los
                        productos de cada sucursal y la identidad del
                        conglomerado vinculados a cada maestro.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex h-11 items-center gap-2 whitespace-nowrap rounded-2xl bg-indigo-600 px-4 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-indigo-700"
                >
                    + Nuevo
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col gap-4">
                    {Array(3)
                        .fill(0)
                        .map((_, i) => (
                            <div
                                key={i}
                                className="h-28 animate-pulse rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900"
                            />
                        ))}
                </div>
            ) : masterIngredients.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[32px] border border-slate-100 bg-white p-8 text-center shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                    <p className="text-sm font-bold text-slate-400">
                        No hay ingredientes maestros todavía
                    </p>
                    <p className="max-w-md text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Cree un ingrediente maestro y vincule el producto
                        equivalente de cada sucursal.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {masterIngredients.map((mi) => {
                        const products = productsOf(mi);
                        return (
                            <div
                                key={mi.id}
                                className="flex flex-col gap-4 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                                                {mi.name}
                                            </h3>
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                {mi.unitMeasure}
                                            </span>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                                    mi.isActive
                                                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                        : "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                                                }`}
                                            >
                                                {mi.isActive
                                                    ? "Activo"
                                                    : "Inactivo"}
                                            </span>
                                            {mi.conglomerateIngredient && (
                                                <span
                                                    title="Identidad del conglomerado vinculada"
                                                    className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                                                >
                                                    Conglomerado ·{" "}
                                                    {
                                                        mi
                                                            .conglomerateIngredient
                                                            .name
                                                    }
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            {products.length}{" "}
                                            {products.length === 1
                                                ? "producto vinculado"
                                                : "productos vinculados"}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <button
                                            onClick={() =>
                                                setLinkingIngredient(mi)
                                            }
                                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            Vincular producto
                                        </button>
                                        <button
                                            onClick={() => openEdit(mi)}
                                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleToggleActive(mi)
                                            }
                                            disabled={updating}
                                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            {mi.isActive
                                                ? "Desactivar"
                                                : "Activar"}
                                        </button>
                                    </div>
                                </div>

                                {products.length === 0 ? (
                                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                                        Sin productos vinculados: este insumo
                                        todavía no puede usarse en
                                        transferencias.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {products.map((p) => (
                                            <span
                                                key={p.id}
                                                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${
                                                    p.isActive
                                                        ? "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                                        : "border-rose-200 text-rose-500 dark:border-rose-800"
                                                }`}
                                            >
                                                <span className="font-black uppercase tracking-wider text-slate-400">
                                                    {p.branch?.name || "—"}
                                                </span>
                                                {p.name}
                                                <span className="text-slate-400">
                                                    {p.code}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showFormModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-black text-slate-800 dark:text-slate-100">
                            {editing ? "Editar ingrediente" : "Nuevo ingrediente maestro"}
                        </h2>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={formName}
                                    onChange={(e) =>
                                        setFormName(e.target.value)
                                    }
                                    placeholder="Ej. TOMATE, COCA COLA"
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Unidad de medida
                                </label>
                                <select
                                    value={formUnit}
                                    onChange={(e) =>
                                        setFormUnit(e.target.value)
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                    {PRODUCT_UNIT_MEASURE_OPTIONS.map(
                                        (opt) => (
                                            <option
                                                key={opt.value}
                                                value={opt.value}
                                            >
                                                {opt.label}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </div>
                            {formError && (
                                <p className="text-xs font-bold text-rose-500">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowFormModal(false)}
                                className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={creating || updating}
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {creating || updating
                                    ? "Guardando..."
                                    : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {linkingIngredient && (
                <LinkProductModal
                    branchId={branchId}
                    masterIngredient={linkingIngredient}
                    onClose={() => {
                        setLinkingIngredient(null);
                        void refetch();
                    }}
                />
            )}
        </div>
    );
};

export default MasterIngredientsTab;
