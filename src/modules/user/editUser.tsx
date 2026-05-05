import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_USER } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';


interface User {
  id: string;
  dni: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  phone: string;
  isActive: boolean;
  photoBase64?: string | null;
}

type EditUserProps = {
  user: User;
  onSuccess?: () => void;
  onClose: () => void;
};

const EditUser: React.FC<EditUserProps> = ({ user, onSuccess, onClose }) => {
  const { companyData } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    email: user.email || '',
    password: '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    branchId: companyData?.branch?.id || '',
    role: user.role || '',
    phone: user.phone || '',
    isActive: user.isActive ?? true,
  });
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const [updateUser, { loading }] = useMutation(UPDATE_USER, {
    onCompleted: (data) => {
      if (data.updateUser?.success) {
        showToast(data.updateUser.message || 'Empleado actualizado exitosamente', 'success');
        if (onSuccess) {
            onSuccess();
        } else {
            onClose();
        }
      } else {
        showToast(data.updateUser?.message || 'Error al actualizar', 'error');
      }
    },
    onError: (error) => {
      showToast(error.message || 'Error de conexión', 'error');
    },
  });

  // Auto-seleccionar sucursal si no está
  React.useEffect(() => {
    if (companyData?.branch?.id && !formData.branchId) {
      setFormData(prev => ({ ...prev, branchId: companyData.branch.id }));
    }
  }, [companyData?.branch?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setPhotoBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const variables: Record<string, unknown> = {
      id: user.id,
      email: formData.email.trim() || undefined,
      firstName: formData.firstName.trim() || undefined,
      lastName: formData.lastName.trim() || undefined,
      branchId: formData.branchId || undefined,
      role: formData.role || undefined,
      phone: formData.phone.trim() || undefined,
      isActive: formData.isActive,
    };
    if (formData.password.trim()) {
      variables.password = formData.password;
    }
    if (photoBase64) {
      variables.photoBase64 = photoBase64;
    }

    updateUser({ variables });
  };

  const roles = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'CASHIER', label: 'Cajero' },
    { value: 'WAITER', label: 'Mozo' },
    { value: 'COOK', label: 'Cocinero' },
  ];


  return (
    <div 
        className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300 sm:p-6"
        onClick={onClose}
    >
      <div 
        className="relative flex h-full max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800/50 dark:bg-slate-800/20">
            <div className="flex flex-col gap-1">
                <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                    Editar Empleado
                </h3>
                <span className="text-xs font-mono font-black text-indigo-500 dark:text-indigo-400">
                    DNI: {user.dni}
                </span>
            </div>
            <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email *</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nueva Contraseña</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                        />
                        <span className="text-[10px] font-medium text-slate-400 italic px-1">Dejar vacío para no cambiar</span>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre *</label>
                        <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Apellido *</label>
                        <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Teléfono</label>
                        <input
                            type="text"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rol *</label>
                        <select
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            required
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800"
                        >
                            {roles.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Foto</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs font-bold text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-1 file:text-[10px] file:font-black file:uppercase file:text-indigo-600 dark:border-slate-800 dark:bg-slate-800/40 dark:file:bg-indigo-500/20 dark:file:text-indigo-400"
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-4 sm:pt-6">
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input
                                type="checkbox"
                                name="isActive"
                                checked={formData.isActive}
                                onChange={handleChange}
                                className="peer sr-only"
                            />
                            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-slate-700"></div>
                            <span className="ml-3 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                {formData.isActive ? 'Usuario Activo' : 'Usuario Inactivo'}
                            </span>
                        </label>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-50 pt-8 dark:border-slate-800/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
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
                                <span>Actualizar</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default EditUser;
