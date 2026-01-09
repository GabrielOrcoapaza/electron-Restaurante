import React, { useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { GET_USERS_BY_BRANCH } from '../../graphql/queries';
import { useAuth } from '../../hooks/useAuth';

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
}

const ListUser: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const { data, loading, error } = useQuery(GET_USERS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only',
    onError: (err) => {
      console.error('Error al cargar usuarios:', err);
    },
    onCompleted: (data) => {
      console.log('Usuarios cargados:', data);
    }
  });

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
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0'
    }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>
        📋 Lista de Empleados ({users.length})
      </h3>
      
      {users.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem', 
          color: '#64748b' 
        }}>
          <p style={{ fontSize: '1rem', margin: 0 }}>No hay empleados registrados</p>
          <p style={{ fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
            Haz clic en "Nuevo Empleado" para agregar uno
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '0.875rem'
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>DNI</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Nombre</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Teléfono</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Rol</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const badgeColors = getRoleBadgeColor(user.role);
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem', color: '#334155' }}>{user.dni}</td>
                    <td style={{ padding: '0.75rem', color: '#334155', fontWeight: 500 }}>{user.fullName}</td>
                    <td style={{ padding: '0.75rem', color: '#64748b' }}>{user.email}</td>
                    <td style={{ padding: '0.75rem', color: '#64748b' }}>{user.phone || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: badgeColors.bg,
                        color: badgeColors.color
                      }}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: user.isActive ? '#dcfce7' : '#fee2e2',
                        color: user.isActive ? '#166534' : '#991b1b'
                      }}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ListUser;

