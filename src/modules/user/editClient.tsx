import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { CREATE_PERSON } from '../../graphql/mutations';

type EditClientProps = {
    client: {
        id: string;
        name: string;
        documentType: string;
        documentNumber: string;
        email?: string;
        phone?: string;
        address?: string;
    };
    onSuccess?: () => void;
    onClose: () => void;
};

const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40';

const labelClass =
    'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300';

const EditClient: React.FC<EditClientProps> = ({ client, onSuccess, onClose }) => {
    const { companyData } = useAuth();
    const { breakpoint } = useResponsive();

    const isSmall = breakpoint === 'sm';

    const [formData, setFormData] = useState({
        name: client.name || '',
        documentType: client.documentType || 'DNI',
        documentNumber: client.documentNumber || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || ''
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [updatePerson, { loading }] = useMutation(CREATE_PERSON, {
        onCompleted: (data) => {
            if (data.createPerson.success) {
                setMessage({ type: 'success', text: data.createPerson.message || 'Cliente actualizado exitosamente' });
                if (onSuccess) {
                    setTimeout(() => {
                        onSuccess();
                        onClose();
                    }, 1000);
                }
            } else {
                setMessage({ type: 'error', text: data.createPerson.message || 'Error al actualizar el cliente' });
            }
        },
        onError: (error) => {
            setMessage({ type: 'error', text: error.message || 'Error al actualizar el cliente' });
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!formData.name.trim()) {
            setMessage({ type: 'error', text: 'El nombre es requerido' });
            return;
        }
        if (!formData.documentNumber.trim()) {
            setMessage({ type: 'error', text: 'El número de documento es requerido' });
            return;
        }

        if (!companyData?.branch?.id) {
            setMessage({ type: 'error', text: 'No se encontró información de la sucursal' });
            return;
        }

        try {
            await updatePerson({
                variables: {
                    branchId: companyData.branch.id,
                    documentType: formData.documentType,
                    documentNumber: formData.documentNumber.trim(),
                    name: formData.name.trim(),
                    email: formData.email.trim() || null,
                    phone: formData.phone.trim() || null,
                    address: formData.address.trim() || null,
                    isCustomer: true,
                    isSupplier: false
                }
            });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Error al actualizar el cliente' });
        }
    };

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                className="w-full max-w-[600px] max-h-[90vh] overflow-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6 flex items-center justify-between gap-4">
                    <h2 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">
                        ✏️ Editar Cliente
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-2 py-1 text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        ×
                    </button>
                </div>

                {message && (
                    <div
                        className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                            message.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className={labelClass}>Tipo de Documento *</label>
                        <select
                            name="documentType"
                            value={formData.documentType}
                            onChange={handleChange}
                            required
                            className={inputClass}
                        >
                            <option value="DNI">DNI</option>
                            <option value="RUC">RUC</option>
                            <option value="CE">Carné de Extranjería</option>
                            <option value="PASAPORTE">Pasaporte</option>
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Número de Documento *</label>
                        <input
                            type="text"
                            name="documentNumber"
                            value={formData.documentNumber}
                            onChange={handleChange}
                            required
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Nombre Completo *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Teléfono</label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Dirección</label>
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            className={inputClass}
                        />
                    </div>

                    <div
                        className={`mt-2 flex gap-3 ${isSmall ? 'flex-col' : 'flex-row justify-end'}`}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:disabled:bg-slate-600"
                        >
                            {loading ? 'Actualizando...' : 'Actualizar Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditClient;
