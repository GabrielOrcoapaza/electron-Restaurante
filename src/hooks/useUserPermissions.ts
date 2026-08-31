import { useQuery } from '@apollo/client';
import { useAuth } from './useAuth';
import { GET_USERS_BY_BRANCH_LIGHT } from '../graphql/queries';
import { getEffectivePermissions } from '../constants/rolePermissions';

/**
 * Permisos efectivos del usuario: customPermissions reemplaza al rol si no está vacío.
 * ADMIN pasa hasPermission para cualquier código.
 */
export function useUserPermissions() {
  const { user, companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const { data: usersData } = useQuery(GET_USERS_BY_BRANCH_LIGHT, {
    variables: { branchId: branchId!, includeInactive: false },
    skip: !branchId || !user?.id,
    fetchPolicy: 'network-only',
  });

  const users = usersData?.usersByBranch || [];
  const currentUserData = users.find((u: { id: string }) => String(u.id) === String(user?.id));

  const customPermissions: string[] = Array.isArray(currentUserData?.customPermissions)
    ? currentUserData.customPermissions
    : [];

  const role = (user?.role || '').toUpperCase();
  const effectivePermissions =
    role === 'ADMIN'
      ? []
      : getEffectivePermissions(role, currentUserData?.customPermissions);

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    // Admin siempre tiene todos los permisos
    if (role === 'ADMIN') return true;
    return effectivePermissions.includes(code);
  };

  return { hasPermission, effectivePermissions, customPermissions };
}
