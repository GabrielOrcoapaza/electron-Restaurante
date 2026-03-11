import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_FLOORS_BY_BRANCH, GET_TABLES_BY_FLOOR } from '../../graphql/queries';
import { CREATE_TABLE } from '../../graphql/mutations';
import TableList, { type Table } from './tableList';

const SHAPE_OPTIONS = [
  { value: 'SQUARE', label: 'Cuadrada' },
  { value: 'ROUND', label: 'Redonda' },
  { value: 'RECTANGLE', label: 'Rectangular' },
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
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de sucursal.
      </div>
    );
  }

  if (floorsLoading) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
        Cargando pisos...
      </div>
    );
  }

  if (floorsError || floors.length === 0) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
        {floorsError
          ? `Error al cargar pisos: ${floorsError.message}`
          : 'No hay pisos. Crea primero un piso en la pestaña "Pisos".'}
      </div>
    );
  }

  // Esperar a que se seleccione un piso
  if (!selectedFloorId) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1rem',
          border: '1px solid #e2e8f0',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem', color: '#334155' }}>Crear Mesa</h3>

        {message && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.75rem',
              borderRadius: '8px',
              border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
              backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
              fontSize: '0.875rem',
            }}
          >
            {message.text}
          </div>
        )}

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: '#334155', fontSize: '0.875rem' }}>
            Piso
          </label>
          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            style={{
              padding: '0.625rem 0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '280px',
            }}
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
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}
        >
          <input
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre de la mesa (ej: Mesa 1)"
            required
            style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>Forma</label>
            <select
              value={formData.shape}
              onChange={(e) => setFormData((prev) => ({ ...prev, shape: e.target.value }))}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%' }}
            >
              {SHAPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <input
            type="number"
            min={1}
            value={formData.capacity || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, capacity: Number(e.target.value) || 4 }))}
            placeholder="Capacidad"
            style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />

          <button
            type="submit"
            disabled={creating || !formData.name.trim()}
            style={{
              padding: '0.625rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: creating ? '#94a3b8' : '#6366f1',
              color: 'white',
              fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Creando...' : 'Crear Mesa'}
          </button>
        </form>
      </div>

      {tablesLoading ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Cargando mesas...</div>
      ) : (
        <TableList tables={tables} floorName={selectedFloor?.name} />
      )}
    </div>
  );
};

export default TableModule;
