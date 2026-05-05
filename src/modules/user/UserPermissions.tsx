import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USERS_BY_BRANCH_LIGHT } from '../../graphql/queries';
import { SET_USER_PERMISSIONS } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { getPermissionOptions } from '../../constants/permissionLabels';
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
  customPermissions?: string[] | null;
}

const UserPermissions: React.FC = () => {
  const { companyData, user: currentUser } = useAuth();
  const { showToast } = useToast();
  const branchId = companyData?.branch?.id;
  const isAdmin = (currentUser?.role || '').toUpperCase() === 'ADMIN';

  const { data: usersData, loading: usersLoading, error: usersError, refetch } = useQuery(GET_USERS_BY_BRANCH_LIGHT, {
    variables: { branchId: branchId!, includeInactive: true },
    skip: !branchId || !isAdmin,
    fetchPolicy: 'network-only'
  });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const permissionOptions = getPermissionOptions();
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const [setUserPermissionsMutation, { loading: saving }] = useMutation(SET_USER_PERMISSIONS, {
    onCompleted: (res) => {
      const result = res?.setUserPermissions;
      if (result?.success) {
        showToast(result.message || 'Permisos actualizados correctamente', 'success');
        refetch();
        setSelectedUser(null);
      } else {
        showToast(result?.message || 'Error al guardar permisos', 'error');
      }
    },
    onError: (err) => {
      showToast(err.message || 'Error de conexión', 'error');
    }
  });

  const users: User[] = usersData?.usersByBranch || usersData?.users_by_branch || [];

  const openModal = (u: User) => {
    setSelectedUser(u);
    const codes = Array.isArray(u.customPermissions) ? u.customPermissions : [];
    setSelectedCodes(new Set(codes));
  };

  const togglePermission = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const savePermissions = () => {
    if (!selectedUser?.id) return;
    setUserPermissionsMutation({
      variables: {
        userId: selectedUser.id,
        permissionCodes: Array.from(selectedCodes)
      }
    });
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
        ADMIN: "Administrador",
        CASHIER: "Cajero",
        WAITER: "Mozo",
        COOK: "Cocinero",
    };
    return roles[role] || role;
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-900/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Acceso Restringido</h3>
        <p className="text-sm font-medium text-slate-500">Solo el administrador puede acceder a la gestión de permisos.</p>
      </div>
    );
  }

  if (!branchId) return null;

  return (
    <div className="flex flex-col gap-6 rounded-[32px] bg-slate-50/50 p-6 shadow-xl shadow-slate-200/50 dark:bg-slate-900/50 dark:shadow-none sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            🔐 Control de Accesos
        </h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Asigna permisos específicos a cada integrante de tu equipo
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
        {usersLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
            <p className="text-xs font-bold uppercase tracking-widest">Cargando empleados...</p>
          </div>
        ) : usersError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-rose-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="mb-4 h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-black">Error al cargar datos</p>
                <p className="mt-1 text-xs">{usersError.message}</p>
            </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
             <svg xmlns="http://www.w3.org/2000/svg" className="mb-4 h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm font-bold uppercase tracking-widest">No hay empleados registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                  <th className="px-6 py-4">Empleado</th>
                  <th className="px-6 py-4">Rol Actual</th>
                  <th className="px-6 py-4 text-center">Permisos Especiales</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {users.map((u) => (
                  <tr key={u.id} className="group transition-colors hover:bg-slate-50/30 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{u.fullName}</span>
                        <span className="text-[10px] text-slate-400">{u.dni}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        (u.customPermissions?.length ?? 0) > 0 
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' 
                            : 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                      }`}>
                        {u.customPermissions?.length || 0} personalizados
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openModal(u)}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 text-xs font-black uppercase tracking-widest text-indigo-600 transition-all hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-slate-700 sm:w-auto"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Configurar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Permisos */}
      {selectedUser && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="relative flex h-full max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Header */}
             <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800/50 dark:bg-slate-800/20">
                <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                        Gestionar Permisos
                    </h3>
                    <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">
                        {selectedUser.fullName}
                    </span>
                </div>
                <button
                    onClick={() => !saving && setSelectedUser(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6 flex items-start gap-4 rounded-2xl bg-amber-50/50 p-4 dark:bg-amber-900/10">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-800/20 dark:text-amber-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-amber-700 dark:text-amber-400">
                        Marca los permisos específicos que tendrá este usuario. Si no marcas ninguno, se utilizarán los permisos predeterminados de su rol ({getRoleLabel(selectedUser.role)}).
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {permissionOptions.map((perm) => (
                        <label
                            key={perm.code}
                            className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                                selectedCodes.has(perm.code)
                                    ? 'border-indigo-100 bg-indigo-50/30 ring-1 ring-indigo-500/10 dark:border-indigo-900/30 dark:bg-indigo-900/10'
                                    : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'
                            }`}
                        >
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={selectedCodes.has(perm.code)}
                                    onChange={() => togglePermission(perm.code)}
                                    className="h-5 w-5 rounded-lg border-slate-200 text-indigo-600 transition-all focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                                    {selectedUser.role === 'WAITER' && perm.code === 'users.manage'
                                        ? 'Requiere contraseña para ingresar'
                                        : perm.label}
                                </span>
                                {perm.description && (
                                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                        {selectedUser.role === 'WAITER' && perm.code === 'users.manage'
                                          ? 'Si está marcado, el mozo deberá ingresar su contraseña para acceder al panel.'
                                          : perm.description}
                                    </span>
                                )}
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800/50 dark:bg-slate-800/20">
                <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    disabled={saving}
                    className="rounded-2xl bg-white px-6 py-2.5 text-sm font-black text-slate-500 shadow-sm transition-all hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                    Cerrar
                </button>
                <button
                    type="button"
                    onClick={savePermissions}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-8 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                >
                    {saving ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            <span>Guardar Permisos</span>
                        </>
                    )}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPermissions;
