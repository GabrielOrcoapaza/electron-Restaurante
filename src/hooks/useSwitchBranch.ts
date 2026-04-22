import { useCallback, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { useAuth } from './useAuth';
import { GET_BRANCH_FULL } from '../graphql/queries';
import {
  GET_FLOORS_BY_BRANCH,
  GET_CATEGORIES_BY_BRANCH,
  GET_USERS_BY_BRANCH,
  GET_TABLES_BY_FLOOR,
} from '../graphql/queries';

/**
 * Hook para cambiar de sucursal (multisucursal).
 * Intenta GET_BRANCH_FULL primero; si falla, usa fallback con queries existentes.
 */
export const useSwitchBranch = () => {
  const { companyData, switchBranch } = useAuth();
  const client = useApolloClient();
  const [loading, setLoading] = useState(false);

  const switchToBranch = useCallback(
    async (branchId: string) => {
      if (!companyData || branchId === companyData.branch.id) return;
      setLoading(true);
      try {
        const { data } = await client.query({
          query: GET_BRANCH_FULL,
          variables: { branchId },
          fetchPolicy: 'network-only',
        });

        const branch = data?.branch;
        if (branch) {
          switchBranch(branch);
          await client.resetStore();
          return;
        }
      } catch {
        // Fallback: ensamblar branch con queries existentes
      }

      const avail = companyData.availableBranches?.find((b: any) => b.id === branchId);
      if (!avail) return;

      try {
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
            query: GET_USERS_BY_BRANCH,
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
      } catch (err) {
        console.error('Error al cambiar sucursal:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [companyData, switchBranch, client]
  );

  return { switchToBranch, loading };
};
