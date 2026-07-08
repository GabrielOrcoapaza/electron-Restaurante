import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { GET_BRANCH_BY_ID } from "../../graphql/queries";
import { UPDATE_BRANCH } from "../../graphql/mutations";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";

type BranchFormState = {
    name: string;
    password: string;
    address: string;
    phone: string;
    latitude: string;
    longitude: string;
    igvPercentage: string;
    pdfSize: string;
    pdfColor: string;
    isPayment: boolean;
    isBilling: boolean;
    isDelivery: boolean;
    isActive: boolean;
    isKitchenPrint: boolean;
    isKitchenDisplay: boolean;
    printCancellations: boolean;
    isCommandItemMode: boolean;
    requireWaiterPassword: boolean;
    isMultiWaiterEnabled: boolean;
};

const emptyForm = (): BranchFormState => ({
    name: "",
    password: "",
    address: "",
    phone: "",
    latitude: "",
    longitude: "",
    igvPercentage: "18",
    pdfSize: "",
    pdfColor: "",
    isPayment: true,
    isBilling: false,
    isDelivery: false,
    isActive: true,
    isKitchenPrint: false,
    isKitchenDisplay: false,
    printCancellations: false,
    isCommandItemMode: false,
    requireWaiterPassword: false,
    isMultiWaiterEnabled: false,
});

function branchToForm(branch: Record<string, unknown>): BranchFormState {
    return {
        name: String(branch.name ?? ""),
        password: "",
        address: String(branch.address ?? ""),
        phone: String(branch.phone ?? ""),
        latitude:
            branch.latitude != null ? String(branch.latitude) : "",
        longitude:
            branch.longitude != null ? String(branch.longitude) : "",
        igvPercentage:
            branch.igvPercentage != null
                ? String(branch.igvPercentage)
                : "18",
        pdfSize: String(branch.pdfSize ?? ""),
        pdfColor: String(branch.pdfColor ?? ""),
        isPayment: Boolean(branch.isPayment ?? true),
        isBilling: Boolean(branch.isBilling ?? false),
        isDelivery: Boolean(branch.isDelivery ?? false),
        isActive: Boolean(branch.isActive ?? true),
        isKitchenPrint: Boolean(branch.isKitchenPrint ?? false),
        isKitchenDisplay: Boolean(branch.isKitchenDisplay ?? false),
        printCancellations: Boolean(branch.printCancellations ?? false),
        isCommandItemMode: Boolean(branch.isCommandItemMode ?? false),
        requireWaiterPassword: Boolean(
            branch.requireWaiterPassword ?? false,
        ),
        isMultiWaiterEnabled: Boolean(
            branch.isMultiWaiterEnabled ?? false,
        ),
    };
}

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40";

const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

const ToggleField = ({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-indigo-800">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                {label}
            </span>
            {description && (
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    {description}
                </span>
            )}
        </span>
    </label>
);

const BranchSettings: React.FC = () => {
    const { companyData, switchBranch } = useAuth();
    const { showToast } = useToast();
    const branchId = companyData?.branch?.id;

    const [form, setForm] = useState<BranchFormState>(emptyForm);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoBase64, setLogoBase64] = useState<string | null>(null);

    const { data, loading, error, refetch } = useQuery(GET_BRANCH_BY_ID, {
        variables: { id: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const branch = data?.branchById;

    useEffect(() => {
        if (!branch) return;
        setForm(branchToForm(branch));
        setLogoPreview(
            branch.logo ||
                companyData?.branchLogo ||
                companyData?.branch?.logo ||
                null,
        );
        setLogoBase64(null);
    }, [branch, companyData?.branchLogo, companyData?.branch?.logo]);

    const [updateBranch, { loading: saving }] = useMutation(UPDATE_BRANCH, {
        onCompleted: (res) => {
            const result = res?.updateBranch;
            if (result?.success && result.branch) {
                showToast(
                    result.message || "Sucursal actualizada exitosamente",
                    "success",
                );
                if (companyData?.branch) {
                    switchBranch({
                        ...companyData.branch,
                        ...result.branch,
                    });
                }
                setForm((prev) => ({ ...prev, password: "" }));
                setLogoBase64(null);
                refetch();
            } else {
                showToast(
                    result?.message || "No se pudo actualizar la sucursal",
                    "error",
                );
            }
        },
        onError: (err) => showToast(err.message, "error"),
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleToggle = (name: keyof BranchFormState, value: boolean) => {
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setLogoPreview(result);
            setLogoBase64(result.split(",")[1] ?? null);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchId) return;

        const variables: Record<string, unknown> = {
            id: branchId,
            name: form.name.trim() || undefined,
            address: form.address.trim() || undefined,
            phone: form.phone.trim() || undefined,
            pdfSize: form.pdfSize.trim() || undefined,
            pdfColor: form.pdfColor.trim() || undefined,
            isPayment: form.isPayment,
            isBilling: form.isBilling,
            isDelivery: form.isDelivery,
            isActive: form.isActive,
            isKitchenPrint: form.isKitchenPrint,
            isKitchenDisplay: form.isKitchenDisplay,
            printCancellations: form.printCancellations,
            isCommandItemMode: form.isCommandItemMode,
            requireWaiterPassword: form.requireWaiterPassword,
            isMultiWaiterEnabled: form.isMultiWaiterEnabled,
        };

        if (form.password.trim()) {
            variables.password = form.password;
        }
        if (form.latitude.trim()) {
            variables.latitude = parseFloat(form.latitude);
        }
        if (form.longitude.trim()) {
            variables.longitude = parseFloat(form.longitude);
        }
        if (form.igvPercentage.trim()) {
            variables.igvPercentage = parseFloat(form.igvPercentage);
        }
        if (logoBase64) {
            variables.logoBase64 = logoBase64;
        }

        updateBranch({ variables });
    };

    if (!branchId) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                No se encontró información de la sucursal activa.
            </div>
        );
    }

    if (loading && !branch) {
        return (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Cargando datos de la sede...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900/40 dark:bg-rose-950/30">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                    Error al cargar la sede
                </p>
                <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                    {error.message}
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-5xl">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Datos de la sede
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {companyData?.company.denomination}
                                {branch?.serial
                                    ? ` · Serie ${branch.serial}`
                                    : ""}
                            </p>
                        </div>
                        {logoPreview && (
                            <img
                                src={logoPreview}
                                alt="Logo de la sede"
                                className="h-16 w-16 rounded-xl border border-slate-200 object-contain dark:border-slate-700"
                            />
                        )}
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        <div>
                            <label className={labelClass}>Nombre</label>
                            <input
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                className={inputClass}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>
                                Contraseña de sucursal
                            </label>
                            <input
                                name="password"
                                type="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="Dejar vacío para no cambiar"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Dirección</label>
                            <input
                                name="address"
                                value={form.address}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Teléfono</label>
                            <input
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Latitud</label>
                            <input
                                name="latitude"
                                type="number"
                                step="any"
                                value={form.latitude}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Longitud</label>
                            <input
                                name="longitude"
                                type="number"
                                step="any"
                                value={form.longitude}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClass}>Logo</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-300 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
                            />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Facturación y comprobantes
                    </h3>
                    <div className="grid gap-5 md:grid-cols-3">
                        <div>
                            <label className={labelClass}>% IGV</label>
                            <input
                                name="igvPercentage"
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.igvPercentage}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Tamaño PDF</label>
                            <input
                                name="pdfSize"
                                value={form.pdfSize}
                                onChange={handleChange}
                                placeholder="Ej: A4, 80mm"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Color PDF</label>
                            <input
                                name="pdfColor"
                                value={form.pdfColor}
                                onChange={handleChange}
                                placeholder="Ej: #000000"
                                className={inputClass}
                            />
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <ToggleField
                            label="Pagos habilitados"
                            checked={form.isPayment}
                            onChange={(v) => handleToggle("isPayment", v)}
                        />
                        <ToggleField
                            label="Facturación electrónica"
                            checked={form.isBilling}
                            onChange={(v) => handleToggle("isBilling", v)}
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Operación
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <ToggleField
                            label="Delivery / para llevar"
                            checked={form.isDelivery}
                            onChange={(v) => handleToggle("isDelivery", v)}
                        />
                        <ToggleField
                            label="Impresión en cocina"
                            checked={form.isKitchenPrint}
                            onChange={(v) =>
                                handleToggle("isKitchenPrint", v)
                            }
                        />
                        <ToggleField
                            label="Pantalla de cocina"
                            checked={form.isKitchenDisplay}
                            onChange={(v) =>
                                handleToggle("isKitchenDisplay", v)
                            }
                        />
                        <ToggleField
                            label="Imprimir anulaciones"
                            checked={form.printCancellations}
                            onChange={(v) =>
                                handleToggle("printCancellations", v)
                            }
                        />
                        <ToggleField
                            label="Modo comanda por ítem"
                            checked={form.isCommandItemMode}
                            onChange={(v) =>
                                handleToggle("isCommandItemMode", v)
                            }
                        />
                        <ToggleField
                            label="Requiere contraseña de mozo"
                            checked={form.requireWaiterPassword}
                            onChange={(v) =>
                                handleToggle("requireWaiterPassword", v)
                            }
                        />
                        <ToggleField
                            label="Múltiples mozos por mesa"
                            checked={form.isMultiWaiterEnabled}
                            onChange={(v) =>
                                handleToggle("isMultiWaiterEnabled", v)
                            }
                        />
                        <ToggleField
                            label="Sede activa"
                            checked={form.isActive}
                            onChange={(v) => handleToggle("isActive", v)}
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    >
                        {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default BranchSettings;
