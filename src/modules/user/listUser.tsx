import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USERS_BY_BRANCH } from '../../graphql/queries';
import { SET_USER_PERMISSIONS } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import EditUser from './editUser';
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

const ListUser: React.FC = () => {
  const { companyData, user: currentUser } = useAuth();
  const isAdmin = (currentUser?.role || '').toUpperCase() === 'ADMIN';
  const { breakpoint, isMobile, isXs } = useResponsive();
  const branchId = companyData?.branch?.id;
  
  // Adaptar según tamaño de pantalla
  const isSmall = breakpoint === 'sm' || isMobile; 
  
  // Tamaños adaptativos
  const cardPadding = isXs ? '0.75rem' : isSmall ? '1rem' : '1.5rem';
  const tableFontSize = isXs ? '0.8rem' : isSmall ? '0.85rem' : '0.875rem';
  const tableCellPadding = isXs ? '0.4rem' : isSmall ? '0.6rem' : '0.75rem';
  const titleFontSize = isXs ? '1rem' : isSmall ? '1.1rem' : '1.25rem';
  const badgeFontSize = isXs ? '0.65rem' : isSmall ? '0.7rem' : '0.75rem';

  const { data, loading, error, refetch } = useQuery(GET_USERS_BY_BRANCH, {
    variables: { branchId: branchId!, includeInactive: isAdmin },
    skip: !branchId,
    fetchPolicy: 'network-only',
    onError: (err) => {
      console.error('Error al cargar usuarios:', err);
    },
    onCompleted: (data) => {
      console.log('Usuarios cargados:', data);
    }
  });

  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<Set<string>>(new Set());
  const [permissionsMessage, setPermissionsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const permissionOptions = getPermissionOptions();

  const [setUserPermissionsMutation, { loading: savingPermissions }] = useMutation(SET_USER_PERMISSIONS, {
    onCompleted: (res) => {
      const result = res?.setUserPermissions;
      if (result?.success) {
        setPermissionsMessage({ type: 'success', text: result.message || 'Permisos actualizados' });
        refetch();
        setTimeout(() => {
          setSelectedUserForPermissions(null);
          setSelectedPermissionCodes(new Set());
          setPermissionsMessage(null);
        }, 1500);
      } else {
        setPermissionsMessage({ type: 'error', text: result?.message || 'Error al guardar' });
      }
    },
    onError: (err) => {
      setPermissionsMessage({ type: 'error', text: err.message || 'Error de conexión' });
    }
  });

  const openPermissionsModal = (u: User) => {
    setSelectedUserForPermissions(u);
    const codes = Array.isArray(u.customPermissions) ? u.customPermissions : [];
    setSelectedPermissionCodes(new Set(codes));
    setPermissionsMessage(null);
  };

  const togglePermission = (code: string) => {
    setSelectedPermissionCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const savePermissions = () => {
    if (!selectedUserForPermissions?.id) return;
    setUserPermissionsMutation({
      variables: {
        userId: selectedUserForPermissions.id,
        permissionCodes: Array.from(selectedPermissionCodes)
      }
    });
  };

  // Debug: Verificar valores
  useEffect(() => {
    console.log('ListUser - branchId:', branchId);
    console.log('ListUser - companyData:', companyData);
    console.log('ListUser - data:', data);
    console.log('ListUser - loading:', loading);
    console.log('ListUser - error:', error);
  }, [branchId, companyData, data, loading, error]);

  const users: User[] = data?.usersByBranch || [];

  const roles = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'CASHIER', label: 'Cajero' },
    { value: 'WAITER', label: 'Mozo' },
    { value: 'COOK', label: 'Cocinero' },
  ];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return { bg: '#fef3c7', color: '#d97706' };
      case 'CASHIER': return { bg: '#dbeafe', color: '#2563eb' };
      case 'WAITER': return { bg: '#dcfce7', color: '#16a34a' };
      case 'COOK': return { bg: '#fce7f3', color: '#db2777' };
      default: return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  const getRoleLabel = (role: string) => {
    return roles.find(r => r.value === role)?.label || role;
  };

  if (!branchId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Cargando empleados...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        Error al cargar empleados: {error.message}
        {error.graphQLErrors?.length > 0 && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            {error.graphQLErrors.map((err, idx) => (
              <div key={idx}>{err.message}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '100%',
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: cardPadding,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0',
      boxSizing: 'border-box'
    }}>
      <h3 style={{ 
        margin: '0 0 1rem', 
        fontSize: titleFontSize, 
        fontWeight: 600, 
        color: '#334155' 
      }}>
        📋 Lista de Empleados ({users.length})
      </h3>
      
      {users.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: isSmall ? '2rem' : '3rem', 
          color: '#64748b' 
        }}>
          <p style={{ fontSize: isSmall ? '0.875rem' : '1rem', margin: 0 }}>No hay empleados registrados</p>
          <p style={{ fontSize: isSmall ? '0.75rem' : '0.875rem', margin: '0.5rem 0 0' }}>
            Haz clic en "Nuevo Empleado" para agregar uno
          </p>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          {!isSmall ? (
            <div style={{ 
              overflowX: 'auto',
              width: '100%',
              borderRadius: '8px',
              border: '1px solid #f1f5f9',
            }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: tableFontSize,
              }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>DNI</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Nombre</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Teléfono</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Rol</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Estado</th>
                    {isAdmin && (
                      <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const badgeColors = getRoleBadgeColor(user.role);
                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#334155' }}>{user.dni}</td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#334155', fontWeight: 500 }}>{user.fullName}</td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b' }}>{user.email}</td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b' }}>{user.phone || '-'}</td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: badgeFontSize,
                            fontWeight: 600,
                            backgroundColor: badgeColors.bg,
                            color: badgeColors.color
                          }}>
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: badgeFontSize,
                            fontWeight: 600,
                            backgroundColor: user.isActive ? '#dcfce7' : '#fee2e2',
                            color: user.isActive ? '#166534' : '#991b1b'
                          }}>
                            {user.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ padding: tableCellPadding, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button onClick={() => setSelectedUserForEdit(user)} style={{ padding: '0.375rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: badgeFontSize, cursor: 'pointer' }}>✏️ Editar</button>
                              <button onClick={() => openPermissionsModal(user)} style={{ padding: '0.375rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: badgeFontSize, cursor: 'pointer' }}>🔐 Permisos</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {users.map((user) => {
                const badgeColors = getRoleBadgeColor(user.role);
                return (
                  <div key={user.id} style={{ 
                    padding: '1rem', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0', 
                    backgroundColor: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>{user.fullName}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.1rem' }}>DNI: {user.dni}</div>
                      </div>
                      <span style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: badgeColors.bg,
                        color: badgeColors.color
                      }}>
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                      <div style={{ color: '#64748b' }}>
                        <strong>Email:</strong><br/>
                        <span style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{user.email}</span>
                      </div>
                      <div style={{ color: '#64748b' }}>
                        <strong>Teléfono:</strong><br/>
                        {user.phone || '-'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: user.isActive ? '#dcfce7' : '#fee2e2',
                        color: user.isActive ? '#166534' : '#991b1b'
                      }}>
                        {user.isActive ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                      
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => setSelectedUserForEdit(user)} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>✏️</button>
                          <button onClick={() => openPermissionsModal(user)} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>🔐</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Editar Usuario (solo ADMIN) */}
      {selectedUserForEdit && (
        <EditUser
          user={selectedUserForEdit}
          onSuccess={() => {
            refetch();
            setSelectedUserForEdit(null);
          }}
          onClose={() => setSelectedUserForEdit(null)}
        />
      )}

      {/* Modal Permisos (solo ADMIN) */}
      {selectedUserForPermissions && (
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
          onClick={() => !savingPermissions && setSelectedUserForPermissions(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: cardPadding,
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 1rem', fontSize: titleFontSize, fontWeight: 700, color: '#1e293b' }}>
              🔐 Permisos: {selectedUserForPermissions.fullName}
            </h4>
            <p style={{ margin: '0 0 1rem', fontSize: tableFontSize, color: '#64748b' }}>
              Marca los permisos que tendrá este usuario. Sin marcar ninguno se usan los del rol.
            </p>
            {permissionsMessage && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: permissionsMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: permissionsMessage.type === 'success' ? '#166534' : '#991b1b',
                fontSize: tableFontSize
              }}>
                {permissionsMessage.text}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', maxHeight: '50vh', overflowY: 'auto' }}>
              {permissionOptions.map((perm) => (
                <label
                  key={perm.code}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    backgroundColor: selectedPermissionCodes.has(perm.code) ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${selectedPermissionCodes.has(perm.code) ? '#93c5fd' : '#e2e8f0'}`,
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissionCodes.has(perm.code)}
                    onChange={() => togglePermission(perm.code)}
                    style={{ width: '1rem', height: '1rem', marginTop: '0.2rem', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 500, color: '#334155', fontSize: tableFontSize }}>{perm.label}</span>
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
                onClick={() => setSelectedUserForPermissions(null)}
                disabled={savingPermissions}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  fontWeight: 600,
                  cursor: savingPermissions ? 'not-allowed' : 'pointer',
                  fontSize: tableFontSize
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={savePermissions}
                disabled={savingPermissions}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: savingPermissions ? '#94a3b8' : '#16a34a',
                  color: 'white',
                  fontWeight: 600,
                  cursor: savingPermissions ? 'not-allowed' : 'pointer',
                  fontSize: tableFontSize
                }}
              >
                {savingPermissions ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListUser;

