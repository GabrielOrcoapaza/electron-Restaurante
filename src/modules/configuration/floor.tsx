import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { GET_FLOORS_BY_BRANCH } from "../../graphql/queries";
import { CREATE_FLOOR } from "../../graphql/mutations";
import FloorList, { type Floor } from "./floorList";
import FloorUpdateModal from "./floorUpdate";

const FloorModule: React.FC = () => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;

    const [formData, setFormData] = useState({
        name: "",
        capacity: 0,
        order: 0,
    });
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [editingFloor, setEditingFloor] = useState<Floor | null>(null);

    const { data, loading, error, refetch } = useQuery(GET_FLOORS_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const [createFloor, { loading: creating }] = useMutation(CREATE_FLOOR, {
        onCompleted: (res) => {
            const result = res?.createFloor;
            if (result?.success) {
                setMessage({
                    type: "success",
                    text: result.message || "Piso creado exitosamente",
                });
                setFormData({ name: "", capacity: 0, order: 0 });
                refetch();
                // Clear message after 3 seconds
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({
                    type: "error",
                    text: result?.message || "No se pudo crear el piso",
                });
            }
        },
        onError: (mutationError) => {
            setMessage({ type: "error", text: mutationError.message });
        },
    });

    const floors: Floor[] = data?.floorsByBranch || [];

    if (!branchId) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-900/20">
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
                <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">
                    Configuración Incompleta
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    No se encontró información de la sucursal activa.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col gap-6 animate-pulse">
                <div className="h-48 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50" />
                <div className="h-96 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/30 dark:bg-rose-950/20">
                <p className="font-bold text-rose-800 dark:text-rose-400">
                    Error al cargar datos
                </p>
                <p className="mt-1 text-sm text-rose-600 dark:text-rose-500">
                    {error.message}
                </p>
                <button
                    onClick={() => refetch()}
                    className="mt-4 rounded-xl bg-rose-600 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-rose-700"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-1 md:p-0">
            {/* Header Section */}
            <div className="flex flex-col gap-1 px-2 md:px-0">
                <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-2xl">
                    Gestión de Pisos
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 md:text-sm">
                    Define las áreas físicas de tu restaurante para organizar
                    mejor las mesas y pedidos.
                </p>
            </div>

            {/* Creation Card */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
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
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                        </svg>
                        Nuevo Piso
                    </h3>
                </div>

                <div className="p-6">
                    {message && (
                        <div
                            className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
                                message.type === "success"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
                                    : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                            }`}
                        >
                            <div
                                className={`h-2 w-2 rounded-full ${message.type === "success" ? "bg-emerald-500" : "bg-rose-500"}`}
                            />
                            {message.text}
                        </div>
                    )}

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setMessage(null);
                            createFloor({
                                variables: {
                                    branchId,
                                    name: formData.name.trim(),
                                    capacity: Number(formData.capacity) || 0,
                                    order: Number(formData.order) || 0,
                                },
                            });
                        }}
                        className="grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end"
                    >
                        <div className="flex flex-col gap-2 md:col-span-1">
                            <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Nombre del Piso
                            </label>
                            <input
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        name: e.target.value,
                                    }))
                                }
                                placeholder="Ej: Salón Principal"
                                required
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Capacidad
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={formData.capacity || ""}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        capacity: Number(e.target.value) || 0,
                                    }))
                                }
                                placeholder="0"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Orden
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={formData.order || ""}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        order: Number(e.target.value) || 0,
                                    }))
                                }
                                placeholder="0"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={creating || !formData.name.trim()}
                            className="flex h-[42px] items-center justify-center rounded-xl bg-indigo-600 px-6 font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                        >
                            {creating ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    <span>Creando...</span>
                                </div>
                            ) : (
                                "Crear Piso"
                            )}
                        </button>
                    </form>
                </div>
            </div>

            <FloorList floors={floors} onEdit={(f) => setEditingFloor(f)} />

            {editingFloor && (
                <FloorUpdateModal
                    floor={editingFloor}
                    onClose={() => setEditingFloor(null)}
                    onUpdated={() => refetch()}
                />
            )}
        </div>
    );
};

export default FloorModule;
