import { useQuery } from '@apollo/client';
import { useAuth } from './useAuth';
import { GET_USERS_BY_BRANCH } from '../graphql/queries';
import { ROLE_DEFAULT_PERMISSIONS } from '../constants/rolePermissions';

/**
 * Devuelve los permisos efectivos del usuario actual.
 * ADMIN tiene todos los permisos. El resto usa customPermissions del usuario o los de su rol por defecto.
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

  // Permisos por defecto según el rol del usuario
  const role = (user?.role || '').toUpperCase();
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[role] || [];

  // Si tiene permisos personalizados, los usamos; si no, usamos los del rol
  const effectivePermissions = customPermissions.length > 0
    ? customPermissions
    : roleDefaults;

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    // Admin siempre tiene todos los permisos
    if (role === 'ADMIN') return true;
    return effectivePermissions.includes(code);
  };

  return { hasPermission, effectivePermissions, customPermissions };
}
