import { useQuery } from '@apollo/client';
import { useAuth } from './useAuth';
import { GET_USERS_BY_BRANCH } from '../graphql/queries';

/**
 * Devuelve los permisos efectivos del usuario actual.
 * ADMIN tiene todos los permisos. El resto usa customPermissions del usuario (desde GET_USERS_BY_BRANCH).
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
  const customPermissions: string[] = Array.isArray(currentUserData?.customPermissions)
    ? currentUserData.customPermissions
    : [];

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    if (user.role?.toUpperCase() === 'ADMIN') return true;
    return customPermissions.includes(code);
  };

  return { hasPermission, customPermissions };
}
