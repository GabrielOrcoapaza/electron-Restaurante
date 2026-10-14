import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { GET_CLOSURE_STAFF_POSITIONS_BY_BRANCH } from "../../graphql/queries";
import {
    CREATE_CLOSURE_STAFF_POSITION,
    UPDATE_CLOSURE_STAFF_POSITION,
    DELETE_CLOSURE_STAFF_POSITION,
} from "../../graphql/mutations";
import PositionList, {
    type ClosureStaffPosition,
} from "./positionList";

const PositionModule: React.FC = () => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;
    const allowCashClosureSheet = Boolean(
        companyData?.branch?.allowCashClosureSheet,
    );

    const [formData, setFormData] = useState({
        name: "",
        sortOrder: 0,
        isActive: true,
    });
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [editing, setEditing] = useState<ClosureStaffPosition | null>(null);
    const [editForm, setEditForm] = useState({
        name: "",
        sortOrder: 0,
        isActive: true,
    });
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data, loading, error, refetch } = useQuery(
        GET_CLOSURE_STAFF_POSITIONS_BY_BRANCH,
        {
            variables: { branchId: branchId!, includeInactive: true },
            skip: !branchId || !allowCashClosureSheet,
            fetchPolicy: "network-only",
        },
    );

    useEffect(() => {
        if (editing) {
            setEditForm({
                name: editing.name,
                sortOrder: editing.sortOrder ?? 0,
                isActive: editing.isActive !== false,
            });
            setMessage(null);
        }
    }, [editing]);

    const [createPosition, { loading: creating }] = useMutation(
        CREATE_CLOSURE_STAFF_POSITION,
        {
            onCompleted: (res) => {
                const result = res?.createClosureStaffPosition;
                if (result?.success) {
                    setMessage({
                        type: "success",
                        text: result.message || "Cargo creado",
                    });
                    setFormData({ name: "", sortOrder: 0, isActive: true });
                    refetch();
                } else {
                    setMessage({
                        type: "error",
                        text: result?.message || "No se pudo crear el cargo",
                    });
                }
            },
            onError: (err) =>
                setMessage({ type: "error", text: err.message }),
        },
    );

    const [updatePosition, { loading: updating }] = useMutation(
        UPDATE_CLOSURE_STAFF_POSITION,
        {
            onCompleted: (res) => {
                const result = res?.updateClosureStaffPosition;
                if (result?.success) {
                    setMessage({
                        type: "success",
                        text: result.message || "Cargo actualizado",
                    });
                    setEditing(null);
                    refetch();
                } else {
                    setMessage({
                        type: "error",
                        text: result?.message || "No se pudo actualizar",
                    });
                }
            },
            onError: (err) =>
                setMessage({ type: "error", text: err.message }),
        },
    );

    const [deletePosition] = useMutation(DELETE_CLOSURE_STAFF_POSITION, {
        onCompleted: (res) => {
            const result = res?.deleteClosureStaffPosition;
            setDeletingId(null);
            if (result?.success) {
                setMessage({
                    type: "success",
                    text: result.message || "Cargo eliminado",
                });
                refetch();
            } else {
                setMessage({
                    type: "error",
                    text: result?.message || "No se pudo eliminar",
                });
            }
        },
        onError: (err) => {
            setDeletingId(null);
            setMessage({ type: "error", text: err.message });
        },
    });

    const positions: ClosureStaffPosition[] =
        data?.closureStaffPositionsByBranch || [];

    if (!branchId) {
        return (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/30 dark:bg-rose-950/20">
                <p className="font-bold text-rose-800 dark:text-rose-400">
                    No se encontró la sucursal activa.
                </p>
            </div>
        );
    }

    if (!allowCashClosureSheet) {
        return (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/30 dark:bg-amber-950/20">
                <p className="font-bold text-amber-900 dark:text-amber-300">
                    Informe de caja desactivado
                </p>
                <p className="mt-2 text-sm text-amber-800/90 dark:text-amber-400/90">
                    Active la opción &quot;Informe de caja&quot; (hoja de
                    liquidación) en la configuración de la sucursal para
                    gestionar cargos.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col gap-6 animate-pulse">
                <div className="h-40 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50" />
                <div className="h-64 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/30 dark:bg-rose-950/20">
                <p className="font-bold text-rose-800 dark:text-rose-400">
                    Error al cargar cargos
                </p>
                <p className="mt-1 text-sm text-rose-600">{error.message}</p>
                <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-4 rounded-xl bg-rose-600 px-6 py-2 text-sm font-bold text-white"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    const handleDelete = (pos: ClosureStaffPosition) => {
        if (
            !window.confirm(
                `¿Eliminar el cargo "${pos.name}"? Los cierres anteriores conservan el nombre guardado.`,
            )
        ) {
            return;
        }
        setMessage(null);
        setDeletingId(pos.id);
        deletePosition({ variables: { positionId: pos.id } });
    };

    return (
        <div className="flex flex-col gap-6 p-1 md:p-0">
            <div className="flex flex-col gap-1 px-2 md:px-0">
                <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-2xl">
                    Cargos — informe de caja
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 md:text-sm">
                    Catálogo de cargos que aparecen en la hoja de liquidación al
                    cerrar caja (columna Cargo).
                </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                        Nuevo cargo
                    </h3>
                </div>
                <div className="p-6">
                    {message && !editing && (
                        <div
                            className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium ${
                                message.type === "success"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
                                    : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                            }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setMessage(null);
                            createPosition({
                                variables: {
                                    branchId,
                                    name: formData.name.trim(),
                                    sortOrder: Number(formData.sortOrder) || 0,
                                    isActive: formData.isActive,
                                },
                            });
                        }}
                        className="grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end"
                    >
                        <div className="flex flex-col gap-2 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Nombre del cargo *
                            </label>
                            <input
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((p) => ({
                                        ...p,
                                        name: e.target.value,
                                    }))
                                }
                                placeholder="Ej: Mesero, Barra, Anfitriona..."
                                required
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Orden en lista
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={formData.sortOrder}
                                onChange={(e) =>
                                    setFormData((p) => ({
                                        ...p,
                                        sortOrder: Number(e.target.value) || 0,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={creating || !formData.name.trim()}
                            className="flex h-[42px] items-center justify-center rounded-xl bg-indigo-600 px-6 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800"
                        >
                            {creating ? "Creando..." : "Crear cargo"}
                        </button>
                    </form>
                </div>
            </div>

            <PositionList
                positions={positions}
                onEdit={(p) => setEditing(p)}
                onDelete={handleDelete}
                deletingId={deletingId}
            />

            {editing && (
                <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                    <div
                        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
                        onClick={(ev) => ev.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800/50">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                                Editar cargo
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6">
                            {message && (
                                <div
                                    className={`mb-4 rounded-xl border p-3 text-sm ${
                                        message.type === "success"
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : "border-rose-200 bg-rose-50 text-rose-800"
                                    }`}
                                >
                                    {message.text}
                                </div>
                            )}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    setMessage(null);
                                    updatePosition({
                                        variables: {
                                            positionId: editing.id,
                                            name: editForm.name.trim(),
                                            sortOrder:
                                                Number(editForm.sortOrder) || 0,
                                            isActive: editForm.isActive,
                                        },
                                    });
                                }}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500">
                                        Nombre
                                    </label>
                                    <input
                                        value={editForm.name}
                                        onChange={(e) =>
                                            setEditForm((p) => ({
                                                ...p,
                                                name: e.target.value,
                                            }))
                                        }
                                        required
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500">
                                        Orden
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={editForm.sortOrder}
                                        onChange={(e) =>
                                            setEditForm((p) => ({
                                                ...p,
                                                sortOrder:
                                                    Number(e.target.value) || 0,
                                            }))
                                        }
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100"
                                    />
                                </div>
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={editForm.isActive}
                                        onChange={(e) =>
                                            setEditForm((p) => ({
                                                ...p,
                                                isActive: e.target.checked,
                                            }))
                                        }
                                        className="rounded border-slate-300"
                                    />
                                    Activo (visible al cerrar caja)
                                </label>
                                <button
                                    type="submit"
                                    disabled={updating || !editForm.name.trim()}
                                    className="rounded-xl bg-indigo-600 py-2.5 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {updating ? "Guardando..." : "Guardar"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PositionModule;
