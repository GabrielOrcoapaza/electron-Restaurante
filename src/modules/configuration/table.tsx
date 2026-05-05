import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_FLOORS_BY_BRANCH, GET_TABLES_BY_FLOOR } from '../../graphql/queries';
import { CREATE_TABLE } from '../../graphql/mutations';
import TableList, { type Table } from './tableList';
import TableUpdateModal from './tableUpdate';

const SHAPE_OPTIONS = [
  { value: 'SQUARE', label: 'Cuadrada' },
  { value: 'ROUND', label: 'Redonda' },
 
];

const TableModule: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    shape: 'SQUARE',
    capacity: 4,
    positionX: 0,
    positionY: 0,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  const { data: floorsData, loading: floorsLoading, error: floorsError } = useQuery(GET_FLOORS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only',
  });

  const { data: tablesData, loading: tablesLoading, refetch: refetchTables } = useQuery(GET_TABLES_BY_FLOOR, {
    variables: { floorId: selectedFloorId },
    skip: !selectedFloorId,
    fetchPolicy: 'network-only',
  });

  const [createTable, { loading: creating }] = useMutation(CREATE_TABLE, {
    onCompleted: (res) => {
      const result = res?.createTable;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Mesa creada exitosamente' });
        setFormData({ name: '', shape: 'SQUARE', capacity: 4, positionX: 0, positionY: 0 });
        refetchTables();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo crear la mesa' });
      }
    },
    onError: (mutationError) => {
      setMessage({ type: 'error', text: mutationError.message });
    },
  });

  const floors = floorsData?.floorsByBranch || [];
  const tables: Table[] = tablesData?.tablesByFloor || [];
  const selectedFloor = floors.find((f: any) => f.id === selectedFloorId);

  // Seleccionar primer piso por defecto cuando se carguen los pisos
  useEffect(() => {
    if (floors.length > 0 && !selectedFloorId) {
      setSelectedFloorId(floors[0].id);
    }
  }, [floors, selectedFloorId]);

  if (!branchId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-rose-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="mb-4 h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        No se encontró información de sucursal.
      </div>
    );
  }

  if (floorsLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse p-1">
        <div className="h-48 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50" />
        <div className="h-96 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
    );
  }

  if (floorsError || floors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="mb-4 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        {floorsError
          ? `Error al cargar pisos: ${floorsError.message}`
          : 'No hay pisos. Crea primero un piso en la pestaña "Pisos".'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-1 md:p-0 transition-colors duration-200">
      {/* Header Section */}
      <div className="flex flex-col gap-1 px-2 md:px-0">
        <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-2xl">
          Configuración de Mesas
        </h1>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 md:text-sm">
          Distribuye y organiza las mesas de tu restaurante por piso y capacidad.
        </p>
      </div>

      {/* Creation Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nueva Mesa
          </h3>
        </div>

        <div className="p-6">
          {message && (
            <div className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              message.type === 'success' 
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400' 
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400'
            }`}>
              <div className={`h-2 w-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {message.text}
            </div>
          )}

          <div className="mb-6 flex flex-col gap-2">
            <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Ubicación (Piso)
            </label>
            <select
              value={selectedFloorId}
              onChange={(e) => setSelectedFloorId(e.target.value)}
              className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              {floors.map((floor: any) => (
                <option key={floor.id} value={floor.id}>
                  {floor.name}
                </option>
              ))}
            </select>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMessage(null);
              createTable({
                variables: {
                  floorId: selectedFloorId,
                  name: formData.name.trim(),
                  shape: formData.shape,
                  capacity: Number(formData.capacity) || 4,
                  positionX: Number(formData.positionX) || 0,
                  positionY: Number(formData.positionY) || 0,
                },
              });
            }}
            className="grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end"
          >
            <div className="flex flex-col gap-2 md:col-span-1">
              <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Nombre de Mesa
              </label>
              <input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Mesa 12"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Forma
              </label>
              <select
                value={formData.shape}
                onChange={(e) => setFormData((prev) => ({ ...prev, shape: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
              >
                {SHAPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Capacidad
              </label>
              <input
                type="number"
                min={1}
                value={formData.capacity || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, capacity: Number(e.target.value) || 4 }))}
                placeholder="4"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={creating || !formData.name.trim()}
              className="flex h-[42px] items-center justify-center rounded-xl bg-indigo-600 px-6 font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
            >
              {creating ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Creando...</span>
                </div>
              ) : (
                'Crear Mesa'
              )}
            </button>
          </form>
        </div>
      </div>

      {tablesLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
        </div>
      ) : (
        <TableList
          tables={tables}
          floorName={selectedFloor?.name}
          onEdit={(t) => {
            setMessage(null);
            setEditingTable(t);
          }}
        />
      )}

      {editingTable && (
        <TableUpdateModal
          table={editingTable}
          onClose={() => setEditingTable(null)}
          onUpdated={() => {
            setMessage(null);
            refetchTables();
          }}
        />
      )}
    </div>
  );
};

export default TableModule;
