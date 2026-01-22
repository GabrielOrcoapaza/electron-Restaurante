import React, { useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { GET_USERS_BY_BRANCH } from '../../graphql/queries';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';

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
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;
  
  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px
  
  // Tamaños adaptativos
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const tableFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const tableCellPadding = isSmall ? '0.5rem' : isMedium ? '0.625rem' : isSmallDesktop ? '0.625rem' : isMediumDesktop ? '0.75rem' : '0.75rem';
  const titleFontSize = isSmall ? '1rem' : isMedium ? '1.05rem' : isSmallDesktop ? '1.05rem' : '1.1rem';
  const badgeFontSize = isSmall ? '0.625rem' : isMedium ? '0.6875rem' : isSmallDesktop ? '0.6875rem' : isMediumDesktop ? '0.75rem' : '0.75rem';

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
          padding: isSmall ? '2rem' : isMedium ? '2.5rem' : '3rem', 
          color: '#64748b' 
        }}>
          <p style={{ fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : '1rem', margin: 0 }}>No hay empleados registrados</p>
          <p style={{ fontSize: isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem', margin: '0.5rem 0 0' }}>
            Haz clic en "Nuevo Empleado" para agregar uno
          </p>
        </div>
      ) : (
        <div style={{ 
          overflowX: 'auto',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: tableFontSize,
            tableLayout: 'auto'
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>DNI</th>
                <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Nombre</th>
                <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Email</th>
                <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Teléfono</th>
                <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Rol</th>
                <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const badgeColors = getRoleBadgeColor(user.role);
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#334155', fontSize: tableFontSize }}>{user.dni}</td>
                    <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#334155', fontWeight: 500, fontSize: tableFontSize }}>{user.fullName}</td>
                    <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontSize: tableFontSize }}>{user.email}</td>
                    <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontSize: tableFontSize }}>{user.phone || '-'}</td>
                    <td style={{ padding: tableCellPadding, textAlign: 'center' }}>
                      <span style={{
                        padding: isSmall ? '0.25rem 0.5rem' : isMedium ? '0.25rem 0.625rem' : '0.25rem 0.75rem',
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
                        padding: isSmall ? '0.25rem 0.5rem' : isMedium ? '0.25rem 0.625rem' : '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: badgeFontSize,
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

