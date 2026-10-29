import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { GET_CONGLOMERATE_CATALOG } from "../../graphql/queries";
import {
    CREATE_CONGLOMERATE_INGREDIENT,
    DELETE_CONGLOMERATE_INGREDIENT,
    LINK_MASTER_INGREDIENT_TO_CONGLOMERATE,
    UNLINK_MASTER_INGREDIENT_FROM_CONGLOMERATE,
    UPDATE_CONGLOMERATE_INGREDIENT,
} from "../../graphql/mutations";
import { PRODUCT_UNIT_MEASURE_OPTIONS } from "../../constants/productUnitMeasures";

interface CompanyRef {
    id: string;
    denomination?: string | null;
    commercialName?: string | null;
}

interface CatalogMaster {
    id: string;
    name: string;
    unitMeasure: string;
    isActive: boolean;
    company: CompanyRef;
}

interface CatalogIdentity {
    id: string;
    name: string;
    unitMeasure: string;
    isActive: boolean;
    masterIngredients: CatalogMaster[];
}

interface Catalog {
    conglomerateId: string;
    conglomerateName: string;
    masterCompanyId?: string | null;
    masterCompanyName?: string | null;
    isMasterCompany: boolean;
    canManage: boolean;
    blockedReason?: string | null;
    ingredients: CatalogIdentity[];
    unlinkedMasters: CatalogMaster[];
}

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const companyLabel = (c?: CompanyRef | null) =>
    c ? c.commercialName || c.denomination || `Empresa ${c.id}` : "—";

const ConglomerateCatalogTab: React.FC = () => {
    const { data, loading, refetch } = useQuery(GET_CONGLOMERATE_CATALOG, {
        fetchPolicy: "network-only",
    });
    const catalog: Catalog | null = data?.conglomerateCatalog ?? null;

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<CatalogIdentity | null>(null);
    const [formName, setFormName] = useState("");
    const [formUnit, setFormUnit] = useState("NIU");
    const [formActive, setFormActive] = useState(true);
    const [formError, setFormError] = useState("");

    const [linkModal, setLinkModal] = useState<{
        identityId?: string;
        masterId?: string;
    } | null>(null);

    const [unlinking, setUnlinking] = useState<CatalogMaster | null>(null);
    const [unlinkError, setUnlinkError] = useState("");
    const [deleting, setDeleting] = useState<CatalogIdentity | null>(null);
    const [deleteError, setDeleteError] = useState("");

    const [createIngredient, { loading: creating }] = useMutation(
        CREATE_CONGLOMERATE_INGREDIENT,
    );
    const [updateIngredient, { loading: updating }] = useMutation(
        UPDATE_CONGLOMERATE_INGREDIENT,
    );
    const [deleteIngredient, { loading: deletingLoading }] = useMutation(
        DELETE_CONGLOMERATE_INGREDIENT,
    );
    const [unlinkMaster, { loading: unlinkingLoading }] = useMutation(
        UNLINK_MASTER_INGREDIENT_FROM_CONGLOMERATE,
    );

    const unlinkedByCompany = useMemo(() => {
        const map = new Map<
            string,
            { company: CompanyRef; masters: CatalogMaster[] }
        >();
        for (const master of catalog?.unlinkedMasters || []) {
            const key = master.company?.id || "—";
            if (!map.has(key)) {
                map.set(key, { company: master.company, masters: [] });
            }
            map.get(key)!.masters.push(master);
        }
        return Array.from(map.values());
    }, [catalog?.unlinkedMasters]);

    const openCreate = () => {
        setEditing(null);
        setFormName("");
        setFormUnit("NIU");
        setFormActive(true);
        setFormError("");
        setShowForm(true);
    };

    const openEdit = (identity: CatalogIdentity) => {
        setEditing(identity);
        setFormName(identity.name);
        setFormUnit(identity.unitMeasure);
        setFormActive(identity.isActive);
        setFormError("");
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            setFormError("El nombre es obligatorio");
            return;
        }
        try {
            if (editing) {
                const { data: result } = await updateIngredient({
                    variables: {
                        conglomerateIngredientId: editing.id,
                        name: formName.trim(),
                        unitMeasure: formUnit,
                        isActive: formActive,
                    },
                });
                if (!result?.updateConglomerateIngredient?.success) {
                    setFormError(
                        result?.updateConglomerateIngredient?.message ||
                            "No se pudo actualizar",
                    );
                    return;
                }
            } else {
                const { data: result } = await createIngredient({
                    variables: {
                        name: formName.trim(),
                        unitMeasure: formUnit,
                    },
                });
                if (!result?.createConglomerateIngredient?.success) {
                    setFormError(
                        result?.createConglomerateIngredient?.message ||
                            "No se pudo crear",
                    );
                    return;
                }
            }
            setShowForm(false);
            await refetch();
        } catch (err: unknown) {
            setFormError(getErrorMessage(err, "Error al guardar"));
        }
    };

    const handleToggleActive = async (identity: CatalogIdentity) => {
        try {
            const { data: result } = await updateIngredient({
                variables: {
                    conglomerateIngredientId: identity.id,
                    isActive: !identity.isActive,
                },
            });
            if (result?.updateConglomerateIngredient?.success) {
                await refetch();
            } else {
                alert(
                    result?.updateConglomerateIngredient?.message ||
                        "No se pudo actualizar",
                );
            }
        } catch (err: unknown) {
            alert(getErrorMessage(err, "Error al actualizar"));
        }
    };

    const handleUnlink = async () => {
        if (!unlinking) return;
        setUnlinkError("");
        try {
            const { data: result } = await unlinkMaster({
                variables: { masterIngredientId: unlinking.id },
            });
            if (result?.unlinkMasterIngredientFromConglomerate?.success) {
                setUnlinking(null);
                await refetch();
            } else {
                setUnlinkError(
                    result?.unlinkMasterIngredientFromConglomerate?.message ||
                        "No se pudo desvincular",
                );
            }
        } catch (err: unknown) {
            setUnlinkError(getErrorMessage(err, "Error al desvincular"));
        }
    };

    const handleDelete = async () => {
        if (!deleting) return;
        setDeleteError("");
        try {
            const { data: result } = await deleteIngredient({
                variables: { conglomerateIngredientId: deleting.id },
            });
            if (result?.deleteConglomerateIngredient?.success) {
                setDeleting(null);
                await refetch();
            } else {
                setDeleteError(
                    result?.deleteConglomerateIngredient?.message ||
                        "No se pudo eliminar",
                );
            }
        } catch (err: unknown) {
            setDeleteError(getErrorMessage(err, "Error al eliminar"));
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-3 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                {Array(4)
                    .fill(0)
                    .map((_, i) => (
                        <div
                            key={i}
                            className="h-14 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                        />
                    ))}
            </div>
        );
    }

    if (!catalog) {
        return (
            <div className="flex min-h-[220px] items-center justify-center rounded-[32px] border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-400 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                Esta empresa no pertenece a un conglomerado con transferencias
                habilitadas.
            </div>
        );
    }

    if (!catalog.canManage) {
        return (
            <div className="rounded-[32px] border border-amber-100 bg-amber-50 p-8 text-center dark:border-amber-900/40 dark:bg-amber-900/10">
                <p className="text-sm font-black text-amber-700 dark:text-amber-300">
                    Catálogo no disponible para administrar
                </p>
                <p className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                    {catalog.blockedReason ||
                        "Solo la empresa master del conglomerado puede administrar este catálogo."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Catálogo del conglomerado
                    </h2>
                    <p className="mt-1 max-w-2xl text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Identidad única por insumo para todas las empresas del
                        grupo ({catalog.conglomerateName}). Empresa master:{" "}
                        {catalog.masterCompanyName || "—"}. Vincule a cada
                        identidad un ingrediente maestro por empresa.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex h-11 items-center gap-2 whitespace-nowrap rounded-2xl bg-indigo-600 px-4 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-indigo-700"
                >
                    + Nueva identidad
                </button>
            </div>

            {/* Identidades */}
            {catalog.ingredients.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[32px] border border-slate-100 bg-white p-8 text-center shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                    <p className="text-sm font-bold text-slate-400">
                        Todavía no hay identidades en el catálogo
                    </p>
                    <p className="max-w-md text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Cree una identidad por insumo y vincule el ingrediente
                        maestro equivalente de cada empresa.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {catalog.ingredients.map((identity) => (
                        <div
                            key={identity.id}
                            className="flex flex-col gap-4 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                                            {identity.name}
                                        </h3>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                            {identity.unitMeasure}
                                        </span>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                                identity.isActive
                                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                    : "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                                            }`}
                                        >
                                            {identity.isActive
                                                ? "Activo"
                                                : "Inactivo"}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        {identity.masterIngredients.length}{" "}
                                        {identity.masterIngredients.length === 1
                                            ? "maestro vinculado"
                                            : "maestros vinculados"}
                                    </p>
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                        onClick={() =>
                                            setLinkModal({
                                                identityId: identity.id,
                                            })
                                        }
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Vincular maestro
                                    </button>
                                    <button
                                        onClick={() => openEdit(identity)}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleToggleActive(identity)
                                        }
                                        disabled={updating}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        {identity.isActive
                                            ? "Desactivar"
                                            : "Activar"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDeleteError("");
                                            setDeleting(identity);
                                        }}
                                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/20"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>

                            {identity.masterIngredients.length === 0 ? (
                                <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                                    Sin maestros vinculados: ninguna empresa
                                    puede enviar ni recibir este insumo
                                    todavía.
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {identity.masterIngredients.map((master) => (
                                        <span
                                            key={master.id}
                                            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${
                                                master.isActive
                                                    ? "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                                    : "border-rose-200 text-rose-500 dark:border-rose-800"
                                            }`}
                                        >
                                            <span className="font-black uppercase tracking-wider text-slate-400">
                                                {companyLabel(master.company)}
                                            </span>
                                            {master.name}
                                            <button
                                                onClick={() => {
                                                    setUnlinkError("");
                                                    setUnlinking(master);
                                                }}
                                                title="Desvincular"
                                                className="ml-1 rounded-full px-1 text-sm leading-none text-slate-400 transition-colors hover:text-rose-500"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Maestros sin identidad */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        Ingredientes maestros sin identidad
                    </h3>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        No podrán enviarse ni recibirse desde otras empresas
                        hasta que se vinculen a una identidad.
                    </p>
                </div>
                {unlinkedByCompany.length === 0 ? (
                    <p className="p-6 text-center text-sm font-bold text-slate-400">
                        Todos los maestros del conglomerado están vinculados
                    </p>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {unlinkedByCompany.map((group) => (
                            <div key={group.company?.id || "—"} className="p-6">
                                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {companyLabel(group.company)}
                                </p>
                                <div className="flex flex-col gap-2">
                                    {group.masters.map((master) => (
                                        <div
                                            key={master.id}
                                            className="flex items-center justify-between gap-3"
                                        >
                                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {master.name}{" "}
                                                <span className="text-slate-400">
                                                    ({master.unitMeasure})
                                                </span>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    setLinkModal({
                                                        masterId: master.id,
                                                    })
                                                }
                                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                Vincular
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-black text-slate-800 dark:text-slate-100">
                            {editing
                                ? "Editar identidad"
                                : "Nueva identidad del conglomerado"}
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
                                    placeholder="Ej. SAN LUIS 600ML"
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
                                    {PRODUCT_UNIT_MEASURE_OPTIONS.map((opt) => (
                                        <option
                                            key={opt.value}
                                            value={opt.value}
                                        >
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {editing && (
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={formActive}
                                        onChange={(e) =>
                                            setFormActive(e.target.checked)
                                        }
                                        className="h-4 w-4 rounded border-slate-300"
                                    />
                                    Identidad activa (se puede transferir)
                                </label>
                            )}
                            {formError && (
                                <p className="text-xs font-bold text-rose-500">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowForm(false)}
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

            {linkModal && catalog && (
                <LinkMasterModal
                    key={`${linkModal.identityId || ""}-${linkModal.masterId || ""}`}
                    identities={catalog.ingredients}
                    unlinkedMasters={catalog.unlinkedMasters}
                    initialIdentityId={linkModal.identityId}
                    initialMasterId={linkModal.masterId}
                    onClose={() => setLinkModal(null)}
                    onChanged={async () => {
                        await refetch();
                    }}
                    onRequestUnlink={(master) => {
                        setUnlinkError("");
                        setUnlinking(master);
                    }}
                />
            )}

            {unlinking && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <h2 className="mb-1 text-lg font-black text-slate-800 dark:text-slate-100">
                            Desvincular maestro
                        </h2>
                        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {companyLabel(unlinking.company)} — {unlinking.name}
                        </p>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            Dejará de poder enviar/recibir este insumo desde
                            otras empresas. Las transferencias ya enviadas
                            conservan su identidad y no se ven afectadas.
                        </p>
                        {unlinkError && (
                            <p className="mt-2 text-xs font-bold text-rose-500">
                                {unlinkError}
                            </p>
                        )}
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setUnlinking(null)}
                                className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleUnlink}
                                disabled={unlinkingLoading}
                                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-rose-700 disabled:opacity-50"
                            >
                                {unlinkingLoading
                                    ? "Desvinculando..."
                                    : "Desvincular"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleting && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <h2 className="mb-1 text-lg font-black text-slate-800 dark:text-slate-100">
                            Eliminar identidad
                        </h2>
                        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {deleting.name}
                        </p>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            Solo se puede eliminar si no tiene maestros
                            vinculados ni transferencias registradas. Si ya se
                            usó, desactívela en su lugar.
                        </p>
                        {deleteError && (
                            <p className="mt-2 text-xs font-bold text-rose-500">
                                {deleteError}
                            </p>
                        )}
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setDeleting(null)}
                                className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deletingLoading}
                                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-rose-700 disabled:opacity-50"
                            >
                                {deletingLoading
                                    ? "Eliminando..."
                                    : "Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const LinkMasterModal: React.FC<{
    identities: CatalogIdentity[];
    unlinkedMasters: CatalogMaster[];
    initialIdentityId?: string;
    initialMasterId?: string;
    onClose: () => void;
    onChanged: () => void | Promise<void>;
    onRequestUnlink: (master: CatalogMaster) => void;
}> = ({
    identities,
    unlinkedMasters,
    initialIdentityId,
    initialMasterId,
    onClose,
    onChanged,
    onRequestUnlink,
}) => {
    const [identityId, setIdentityId] = useState(initialIdentityId || "");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [pendingLinkId, setPendingLinkId] = useState<string | null>(null);
    const [linkMaster, { loading: linking }] = useMutation(
        LINK_MASTER_INGREDIENT_TO_CONGLOMERATE,
    );
    const busy = linking || pendingLinkId !== null;

    // Todos los maestros del conglomerado: los ya vinculados (que vienen
    // dentro de cada identidad) y los que todavía no tienen identidad.
    const masterLinkByIdentity = useMemo(() => {
        const map = new Map<string, CatalogIdentity>();
        for (const identity of identities) {
            for (const master of identity.masterIngredients) {
                map.set(String(master.id), identity);
            }
        }
        return map;
    }, [identities]);

    const allMasters = useMemo(() => {
        const seen = new Set<string>();
        const result: CatalogMaster[] = [];
        for (const identity of identities) {
            for (const master of identity.masterIngredients) {
                const key = String(master.id);
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(master);
                }
            }
        }
        for (const master of unlinkedMasters) {
            const key = String(master.id);
            if (!seen.has(key)) {
                seen.add(key);
                result.push(master);
            }
        }
        return result;
    }, [identities, unlinkedMasters]);

    const mastersByCompany = useMemo(() => {
        const map = new Map<
            string,
            { company: CompanyRef; masters: CatalogMaster[] }
        >();
        for (const master of allMasters) {
            const key = String(master.company?.id || "—");
            if (!map.has(key)) {
                map.set(key, { company: master.company, masters: [] });
            }
            map.get(key)!.masters.push(master);
        }
        const groups = Array.from(map.values());
        for (const group of groups) {
            group.masters.sort((a, b) =>
                a.name.localeCompare(b.name, undefined, {
                    numeric: true,
                    sensitivity: "base",
                }),
            );
        }
        return groups;
    }, [allMasters]);

    const master = initialMasterId
        ? allMasters.find((m) => String(m.id) === String(initialMasterId))
        : undefined;
    const selectedIdentity = identities.find(
        (identity) => String(identity.id) === String(identityId),
    );
    const identityInactive = !!selectedIdentity && !selectedIdentity.isActive;

    // Maestro que ya ocupa el cupo de cada empresa en la identidad actual.
    const identityMasterByCompany = useMemo(() => {
        const map = new Map<string, CatalogMaster>();
        for (const linked of selectedIdentity?.masterIngredients || []) {
            map.set(String(linked.company?.id || "—"), linked);
        }
        return map;
    }, [selectedIdentity]);

    // Pestaña por empresa (igual que LinkProductModal con sucursales): arranca
    // en la empresa del maestro preseleccionado, o en la primera disponible.
    const [activeCompanyId, setActiveCompanyId] = useState(
        () => master?.company?.id || mastersByCompany[0]?.company?.id || "",
    );
    const [masterSearch, setMasterSearch] = useState("");

    // Si la empresa activa se queda sin maestros, cae en la primera disponible.
    const activeGroup =
        mastersByCompany.find(
            (g) => String(g.company?.id || "—") === String(activeCompanyId),
        ) || mastersByCompany[0];
    const effectiveCompanyId = activeGroup
        ? String(activeGroup.company?.id || "—")
        : "";
    const activeCompanyName = activeGroup
        ? companyLabel(activeGroup.company)
        : "la empresa";

    const filteredActiveMasters = useMemo(() => {
        const activeMasters = activeGroup?.masters || [];
        const term = masterSearch.trim().toLowerCase();
        if (!term) return activeMasters;
        return activeMasters.filter((m) =>
            m.name.toLowerCase().includes(term),
        );
    }, [activeGroup, masterSearch]);

    const refreshCatalog = async () => {
        try {
            await onChanged();
        } catch (err: unknown) {
            setError(
                `El cambio se guardó, pero no se pudo actualizar el catálogo: ${getErrorMessage(err, "error desconocido")}`,
            );
        }
    };

    const handleLink = async (masterToLink: CatalogMaster) => {
        setError("");
        setSuccessMessage("");
        if (!identityId) {
            setError("Seleccione la identidad del conglomerado");
            return;
        }
        if (identityInactive) {
            setError("La identidad del conglomerado está inactiva");
            return;
        }
        if (masterLinkByIdentity.has(String(masterToLink.id))) {
            // Los maestros ya vinculados se desvinculan con el botón correspondiente.
            return;
        }

        const targetCompanyMaster = identityMasterByCompany.get(
            String(masterToLink.company?.id || "—"),
        );
        if (
            targetCompanyMaster &&
            String(targetCompanyMaster.id) !== String(masterToLink.id)
        ) {
            setError(
                `La empresa ya tiene el ingrediente maestro "${targetCompanyMaster.name}" vinculado a esta identidad. Desvincúlelo primero para cambiarlo.`,
            );
            return;
        }

        setPendingLinkId(String(masterToLink.id));
        try {
            const { data } = await linkMaster({
                variables: {
                    masterIngredientId: masterToLink.id,
                    conglomerateIngredientId: identityId,
                },
            });
            if (data?.linkMasterIngredientToConglomerate?.success) {
                setSuccessMessage(
                    `"${masterToLink.name}" quedó vinculado a la identidad.`,
                );
                await refreshCatalog();
            } else {
                setError(
                    data?.linkMasterIngredientToConglomerate?.message ||
                        "No se pudo vincular",
                );
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error al vincular"));
        } finally {
            setPendingLinkId(null);
        }
    };

    /** La desvinculación conserva la confirmación existente, que maneja el padre. */
    const handleUnlink = (masterToUnlink: CatalogMaster) => {
        setError("");
        setSuccessMessage("");
        onRequestUnlink(masterToUnlink);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Vincular maestros a una identidad
                    </h2>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {selectedIdentity
                            ? `Vincule los maestros de cada empresa a "${selectedIdentity.name}"`
                            : "Elija la identidad y el maestro de cualquier empresa"}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Solo puede haber un maestro de cada empresa vinculado
                        a esta identidad
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                        Para mover un maestro de otra identidad, desvincúlelo
                        primero y luego vincúlelo a esta.
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        Desvincular impide futuros envíos/recepciones de este
                        insumo; las transferencias ya emitidas no cambian.
                    </p>
                    <div className="mt-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Identidad del conglomerado
                        </label>
                        <select
                            value={identityId}
                            onChange={(e) => {
                                setIdentityId(e.target.value);
                                setError("");
                                setSuccessMessage("");
                            }}
                            disabled={!!initialIdentityId}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                            <option value="">Seleccione...</option>
                            {identities.map((identity) => (
                                <option key={identity.id} value={identity.id}>
                                    {identity.name} ({identity.unitMeasure})
                                    {identity.isActive ? "" : " — inactiva"}
                                </option>
                            ))}
                        </select>
                    </div>
                    {mastersByCompany.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {mastersByCompany.map((group) => {
                                const key = String(group.company?.id || "—");
                                const active = key === effectiveCompanyId;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            setActiveCompanyId(key);
                                            setMasterSearch("");
                                        }}
                                        className={
                                            active
                                                ? "rounded-full bg-indigo-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white"
                                                : "rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                                        }
                                    >
                                        {companyLabel(group.company)}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <input
                        type="text"
                        value={masterSearch}
                        onChange={(e) => setMasterSearch(e.target.value)}
                        placeholder={`Buscar ingrediente en ${activeCompanyName}...`}
                        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />

                    {successMessage && (
                        <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {successMessage}
                        </p>
                    )}
                    {error && (
                        <p className="mt-2 text-xs font-bold text-rose-500">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex-1 divide-y divide-slate-50 overflow-y-auto dark:divide-slate-800/50">
                    {filteredActiveMasters.length === 0 ? (
                        <p className="p-6 text-center text-sm font-bold text-slate-400">
                            No se encontraron ingredientes
                        </p>
                    ) : (
                        filteredActiveMasters.map((activeMaster) => {
                                const linkedIdentity =
                                    masterLinkByIdentity.get(
                                        String(activeMaster.id),
                                    );
                                const linkedToThis =
                                    !!linkedIdentity &&
                                    String(linkedIdentity.id) ===
                                        String(identityId);
                                const linkedToOther =
                                    !!linkedIdentity && !linkedToThis;
                                const targetCompanyMaster =
                                    identityMasterByCompany.get(
                                        String(
                                            activeMaster.company?.id || "—",
                                        ),
                                    );
                                const companySlotTaken =
                                    !!targetCompanyMaster &&
                                    String(targetCompanyMaster.id) !==
                                        String(activeMaster.id);
                                const isPending =
                                    pendingLinkId ===
                                    String(activeMaster.id);
                                const linkDisabled =
                                    busy ||
                                    !identityId ||
                                    identityInactive ||
                                    linkedToOther ||
                                    companySlotTaken;
                                const unlinkDisabled = busy;
                                const rowTitle = linkedToThis
                                    ? "Desvincular de esta identidad"
                                    : linkedToOther && linkedIdentity
                                      ? `Desvincule de "${linkedIdentity.name}" antes de vincular a esta identidad.`
                                      : !identityId
                                        ? "Seleccione una identidad del conglomerado"
                                        : identityInactive
                                        ? "La identidad del conglomerado está inactiva"
                                        : companySlotTaken &&
                                            targetCompanyMaster
                                          ? `La identidad ya tiene el maestro "${targetCompanyMaster.name}" de esta empresa. Desvincúlelo primero para cambiarlo.`
                                          : undefined;

                                return (
                                    <div
                                        key={activeMaster.id}
                                        title={rowTitle}
                                        className="flex items-center justify-between gap-3 px-6 py-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate font-black text-slate-700 dark:text-slate-200">
                                                {activeMaster.name}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                                                <span>
                                                    {
                                                        activeMaster.unitMeasure
                                                    }
                                                </span>
                                                {!activeMaster.isActive && (
                                                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
                                                        Inactivo
                                                    </span>
                                                )}
                                                {linkedToThis && (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                                                        Vinculado a este
                                                    </span>
                                                )}
                                                {linkedToOther && (
                                                    <span className="max-w-full truncate rounded-full bg-amber-50 px-2 py-0.5 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                                                        {`Vinculado a "${linkedIdentity.name}"`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {linkedToThis ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleUnlink(activeMaster)
                                                }
                                                disabled={unlinkDisabled}
                                                className="whitespace-nowrap rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-800 dark:hover:bg-rose-900/20"
                                            >
                                                Desvincular
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleLink(activeMaster)
                                                }
                                                disabled={linkDisabled}
                                                className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-indigo-700 disabled:opacity-40"
                                            >
                                                {isPending
                                                    ? "Vinculando..."
                                                    : "Vincular"}
                                            </button>
                                        )}
                                    </div>
                                );
                        })
                    )}
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
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

export default ConglomerateCatalogTab;
