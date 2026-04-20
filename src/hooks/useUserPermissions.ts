import { useQuery } from '@apollo/client';
import { useAuth } from './useAuth';
import { GET_USERS_BY_BRANCH } from '../graphql/queries';
import { ROLE_DEFAULT_PERMISSIONS } from '../constants/rolePermissions';

/**
 * Permisos efectivos del usuario: unión de defaults del rol ∪ customPermissions.
 * ADMIN pasa hasPermission para cualquier código.
 */
export function useUserPermissions() {
  const { user, companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const { data: usersData } = useQuery(GET_USERS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId || !user?.id,
    fetchPolicy: 'network-only',
  });

  const users = usersData?.usersByBranch || [];
  const currentUserData = users.find((u: { id: string }) => String(u.id) === String(user?.id));

  // Permisos personalizados asignados en la DB
  const customPermissions: string[] = Array.isArray(currentUserData?.customPermissions)
    ? currentUserData.customPermissions
    : [];

  // Permisos por defecto según el rol (incluye CAJA, mismo mapa que CASHIER en rolePermissions)
  const role = (user?.role || '').toUpperCase();
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[role] || [];

  /**
   * Unión rol + custom: si antes se sustituía todo por custom, se perdían permisos del rol
   * (p. ej. cash.change_payment_method en cajeros) y el UI desmentía al backend.
   */
  const effectivePermissions =
    role === 'ADMIN'
      ? []
      : [...new Set([...roleDefaults, ...customPermissions])];

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    // Admin siempre tiene todos los permisos
    if (role === 'ADMIN') return true;
    return effectivePermissions.includes(code);
  };

  return { hasPermission, effectivePermissions, customPermissions };
}
