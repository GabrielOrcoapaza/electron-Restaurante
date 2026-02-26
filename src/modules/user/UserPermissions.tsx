import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USERS_BY_BRANCH } from '../../graphql/queries';
import { SET_USER_PERMISSIONS } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { getPermissionOptions } from '../../constants/permissionLabels';

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
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;
  const isAdmin = (currentUser?.role || '').toUpperCase() === 'ADMIN';

  const isSmall = breakpoint === 'sm';
  const isMedium = breakpoint === 'md';
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : '1.5rem';
  const tableFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem';
  const titleFontSize = isSmall ? '1rem' : isMedium ? '1.05rem' : '1.1rem';

  const { data: usersData, loading: usersLoading, error: usersError, refetch } = useQuery(GET_USERS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId || !isAdmin,
    fetchPolicy: 'network-only'
  });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const permissionOptions = getPermissionOptions();
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [setUserPermissionsMutation, { loading: saving }] = useMutation(SET_USER_PERMISSIONS, {
    onCompleted: (res) => {
      const result = res?.setUserPermissions;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Permisos actualizados' });
        refetch();
        setTimeout(() => {
          setSelectedUser(null);
          setMessage(null);
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result?.message || 'Error al guardar' });
      }
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.message || 'Error de conexión' });
    }
  });

  const users: User[] = usersData?.usersByBranch || usersData?.users_by_branch || [];

  const openModal = (u: User) => {
    setSelectedUser(u);
    const codes = Array.isArray(u.customPermissions) ? u.customPermissions : [];
    setSelectedCodes(new Set(codes));
    setMessage(null);
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

  if (!isAdmin) {
    return (
      <div style={{
        padding: cardPadding,
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, color: '#dc2626', fontWeight: 600 }}>
          Solo el administrador puede acceder a la gestión de permisos.
        </p>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div style={{ padding: cardPadding, textAlign: 'center', color: '#dc2626' }}>
        No se encontró la sucursal. Inicia sesión nuevamente.
      </div>
    );
  }

  if (usersLoading) {
    return (
      <div style={{ padding: cardPadding, textAlign: 'center', color: '#64748b' }}>
        Cargando...
      </div>
    );
  }

  if (usersError) {
    return (
      <div style={{ padding: cardPadding, textAlign: 'center', color: '#dc2626' }}>
        Error al cargar usuarios: {usersError.message}
      </div>
    );
  }

  return (
    <div style={{ padding: cardPadding, minHeight: '400px' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: cardPadding,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0',
        minHeight: '320px'
      }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: titleFontSize, fontWeight: 700, color: '#1e293b' }}>
          🔐 Permisos por usuario
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: tableFontSize, color: '#64748b' }}>
          Selecciona un empleado y asigna los permisos. Lista vacía = usar permisos por defecto del rol.
        </p>

        {users.length === 0 ? (
          <p style={{ color: '#64748b', margin: 0 }}>No hay empleados en esta sucursal. Agrega empleados en la sección Empleados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFontSize }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#334155', fontWeight: 600 }}>Nombre</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#334155', fontWeight: 600 }}>Rol</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#334155', fontWeight: 600 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem', color: '#334155' }}>{u.fullName}</td>
                    <td style={{ padding: '0.75rem', color: '#64748b' }}>{u.role}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => openModal(u)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          fontWeight: 600,
                          fontSize: tableFontSize,
                          cursor: 'pointer'
                        }}
                      >
                        🔐 Permisos
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: permisos del usuario seleccionado */}
      {selectedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={() => !saving && setSelectedUser(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: cardPadding,
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 0.5rem', fontSize: titleFontSize, fontWeight: 700, color: '#1e293b' }}>
              🔐 Permisos: {selectedUser.fullName}
            </h4>
            <p style={{ margin: '0 0 1rem', fontSize: tableFontSize, color: '#64748b' }}>
              Marca los permisos que tendrá este usuario. Sin marcar ninguno se usan los del rol.
            </p>
            {message && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: message.type === 'success' ? '#166534' : '#991b1b',
                fontSize: tableFontSize
              }}>
                {message.text}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {permissionOptions.map((perm) => (
                <label
                  key={perm.code}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    backgroundColor: selectedCodes.has(perm.code) ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${selectedCodes.has(perm.code) ? '#93c5fd' : '#e2e8f0'}`,
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCodes.has(perm.code)}
                    onChange={() => togglePermission(perm.code)}
                    style={{ width: '1rem', height: '1rem', marginTop: '0.2rem', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 500, color: '#334155' }}>{perm.label}</span>
                    {perm.description && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                        {perm.description}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: tableFontSize
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={savePermissions}
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: saving ? '#94a3b8' : '#16a34a',
                  color: 'white',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: tableFontSize
                }}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPermissions;
