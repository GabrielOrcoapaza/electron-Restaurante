import React, { useState, useEffect } from "react";
import { useMutation } from "@apollo/client";
import { CREATE_USER } from "../../graphql/mutations";
import { useAuth } from "../../hooks/useAuth";
import ListUser from "./listUser";
import { useToast } from "../../context/ToastContext";


const CreateUser: React.FC = () => {
    const { companyData } = useAuth();
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState({
        dni: "",
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        branchId: "",
        role: "",
        phone: "",
    });
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);

    // Usar la sucursal del contexto de autenticación
    const currentBranch = companyData?.branch;
    const [refreshKey, setRefreshKey] = useState(0);

    // Auto-seleccionar la sucursal actual
    useEffect(() => {
        if (currentBranch?.id && !formData.branchId) {
            setFormData((prev) => ({ ...prev, branchId: currentBranch.id }));
        }
    }, [currentBranch?.id, formData.branchId]);

    const [createUser, { loading }] = useMutation(CREATE_USER, {
        onCompleted: (data) => {
            if (data.createUser.success) {
                showToast(data.createUser.message || "Empleado creado con éxito", "success");
                setFormData({
                    dni: "",
                    email: "",
                    password: "",
                    firstName: "",
                    lastName: "",
                    branchId: currentBranch?.id || "",
                    role: "",
                    phone: "",
                });
                setPhotoBase64(null);
                setShowForm(false);
                setRefreshKey((prev) => prev + 1);
            } else {
                showToast(data.createUser.message || "Error al crear empleado", "error");
            }
        },
        onError: (error) => {
            showToast(error.message || "Error de conexión", "error");
        },
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(",")[1];
                setPhotoBase64(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createUser({
            variables: {
                ...formData,
                photoBase64,
            },
        });
    };

    const roles = [
        { value: "ADMIN", label: "Administrador" },
        { value: "CASHIER", label: "Cajero" },
        { value: "WAITER", label: "Mozo" },
        { value: "COOK", label: "Cocinero" },
    ];


    return (
        <div className="flex min-h-full w-full flex-col gap-6 rounded-[32px] bg-slate-50/50 p-6 shadow-xl shadow-slate-200/50 dark:bg-slate-900/50 dark:shadow-none sm:p-8">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                        👥 Gestión de Empleados
                    </h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Administra el equipo y sus accesos al sistema
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-black transition-all active:scale-95 sm:w-auto ${
                        showForm
                            ? "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                            : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    }`}
                >
                    {showForm ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Cancelar</span>
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Nuevo Empleado</span>
                        </>
                    )}
                </button>
            </div>

            {/* Formulario */}
            {showForm && (
                <div className="flex-shrink-0 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm animate-in zoom-in-95 duration-300 dark:border-slate-800/50 dark:bg-slate-900 sm:p-8">
                    <div className="mb-8 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                            Registro de Empleado
                        </h3>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">DNI *</label>
                                <input
                                    type="text"
                                    name="dni"
                                    value={formData.dni}
                                    onChange={handleChange}
                                    maxLength={8}
                                    required
                                    placeholder="12345678"
                                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Email *</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="correo@ejemplo.com"
                                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Contraseña *</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    placeholder="••••••••"
                                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Rol *</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                                >
                                    <option value="">Seleccionar rol</option>
                                    {roles.map((role) => (
                                        <option key={role.value} value={role.value}>{role.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Nombre *</label>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    placeholder="Juan"
                                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Apellido *</label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    placeholder="Pérez"
                                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Teléfono</label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="987654321"
                                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Foto</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs font-bold text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-1 file:text-[10px] file:font-black file:uppercase file:text-indigo-600 dark:border-slate-800 dark:bg-slate-800/40 dark:file:bg-indigo-500/20 dark:file:text-indigo-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 border-t border-slate-50 pt-8 dark:border-slate-800/50 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="rounded-2xl bg-slate-50 px-8 py-3 text-sm font-black text-slate-500 transition-all hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-10 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                            >
                                {loading ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        <span>Guardar Empleado</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Lista de empleados */}
            <div className="w-full">
                <ListUser key={refreshKey} />
            </div>

        </div>
    );
};

export default CreateUser;
