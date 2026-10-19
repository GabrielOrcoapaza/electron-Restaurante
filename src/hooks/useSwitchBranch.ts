import { useCallback, useState } from 'react';
import { useApolloClient, useMutation } from '@apollo/client';
import { useAuth } from './useAuth';
import { useToast } from '../context/ToastContext';
import { normalizeTaxAffectationType } from '../utils/getBranchIgvPercentage';
import { SWITCH_ACTIVE_BRANCH } from '../graphql/mutations';
import { GET_BRANCH_FULL } from '../graphql/queries';
import {
  GET_FLOORS_BY_BRANCH,
  GET_CATEGORIES_BY_BRANCH,
  GET_USERS_BY_BRANCH_LIGHT,
  GET_TABLES_BY_FLOOR,
} from '../graphql/queries';

/**
 * Hook para cambiar de sucursal (multisucursal).
 * Carga la sucursal con branchById; si falla, arma los datos con queries existentes.
 */
export const useSwitchBranch = () => {
  const { companyData, switchBranch } = useAuth();
  const client = useApolloClient();
  const { showToast } = useToast();
  const [switchActiveBranchMutation] = useMutation(SWITCH_ACTIVE_BRANCH);
  const [loading, setLoading] = useState(false);

  const switchToBranch = useCallback(
    async (branchId: string) => {
      if (!companyData || branchId === companyData.branch.id) return;
      setLoading(true);
      try {
        const { data: switchData } = await switchActiveBranchMutation({
          variables: { branchId },
        });
        const switchResult = switchData?.switchActiveBranch;
        if (!switchResult?.success) {
          showToast(
            switchResult?.message ?? 'No se pudo actualizar la sucursal del usuario',
            'error',
          );
          return;
        }

        try {
          const { data } = await client.query({
            query: GET_BRANCH_FULL,
            variables: { branchId },
            fetchPolicy: 'network-only',
          });

          const branch = data?.branchById;
          if (branch) {
            switchBranch(branch);
            await client.resetStore();
            showToast(`Sucursal cambiada a ${branch.name}`, 'success');
            return;
          }
        } catch {
          // Fallback: ensamblar branch con queries existentes
        }

        const avail = companyData.availableBranches?.find((b: any) => b.id === branchId);
        if (!avail) return;

        const [floorsRes, categoriesRes, usersRes] = await Promise.all([
          client.query({
            query: GET_FLOORS_BY_BRANCH,
            variables: { branchId },
            fetchPolicy: 'network-only',
          }),
          client.query({
            query: GET_CATEGORIES_BY_BRANCH,
            variables: { branchId },
            fetchPolicy: 'network-only',
          }),
          client.query({
            query: GET_USERS_BY_BRANCH_LIGHT,
            variables: { branchId, includeInactive: false },
            fetchPolicy: 'network-only',
          }),
        ]);

        const floors = floorsRes.data?.floorsByBranch || [];
        const categories = categoriesRes.data?.categoriesByBranch || [];
        const users = usersRes.data?.usersByBranch || [];

        const tablesByFloor = await Promise.all(
          floors.map(async (f: any) => {
            try {
              const { data: tablesData } = await client.query({
                query: GET_TABLES_BY_FLOOR,
                variables: { floorId: f.id },
                fetchPolicy: 'network-only',
              });
              const tables = tablesData?.tablesByFloor || [];
              return { ...f, tables };
            } catch {
              return { ...f, tables: [] };
            }
          })
        );

        const allTables = tablesByFloor.flatMap((floor: any) =>
          (floor.tables || []).map((t: any) => ({
            ...t,
            floorId: floor.id,
            floorName: floor.name,
          }))
        );

        const newBranch = {
          id: avail.id,
          name: avail.name,
          address: avail.address,
          igvPercentage: avail.igvPercentage ?? companyData.branch.igvPercentage,
          taxAffectationType: normalizeTaxAffectationType(
            avail.taxAffectationType ?? companyData.branch.taxAffectationType,
          ),
          isPayment: avail.isPayment ?? true,
          isBilling: avail.isBilling ?? false,
          isDelivery: avail.isDelivery ?? false,
          isActive: true,
          floors: tablesByFloor,
          categories,
          users,
          tables: allTables,
        };

        switchBranch(newBranch as any);
        await client.resetStore();
        showToast(`Sucursal cambiada a ${avail.name}`, 'success');
      } catch (err) {
        console.error('Error al cambiar sucursal:', err);
        showToast('No se pudo cambiar de sucursal', 'error');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [companyData, switchBranch, client, showToast, switchActiveBranchMutation]
  );

  return { switchToBranch, loading };
};
