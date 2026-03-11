import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_FLOORS_BY_BRANCH } from '../../graphql/queries';
import { CREATE_FLOOR } from '../../graphql/mutations';
import FloorList, { type Floor } from './floorList';

const FloorModule: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const [formData, setFormData] = useState({
    name: '',
    capacity: 0,
    order: 0,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, loading, error, refetch } = useQuery(GET_FLOORS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only',
  });

  const [createFloor, { loading: creating }] = useMutation(CREATE_FLOOR, {
    onCompleted: (res) => {
      const result = res?.createFloor;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Piso creado exitosamente' });
        setFormData({ name: '', capacity: 0, order: 0 });
        refetch();
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo crear el piso' });
      }
    },
    onError: (mutationError) => {
      setMessage({ type: 'error', text: mutationError.message });
    },
  });

  const floors: Floor[] = data?.floorsByBranch || [];

  if (!branchId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de sucursal.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
        Cargando pisos...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#dc2626' }}>
        Error al cargar pisos: {error.message}
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
        <h3 style={{ margin: '0 0 0.75rem', color: '#334155' }}>Crear Piso</h3>

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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            createFloor({
              variables: {
                branchId,
                name: formData.name.trim(),
                capacity: Number(formData.capacity) || 0,
                order: Number(formData.order) || 0,
              },
            });
          }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}
        >
          <input
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre del piso (ej: Primer piso)"
            required
            style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />

          <input
            type="number"
            min={0}
            value={formData.capacity || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, capacity: Number(e.target.value) || 0 }))}
            placeholder="Capacidad"
            style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />

          <input
            type="number"
            min={0}
            value={formData.order || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, order: Number(e.target.value) || 0 }))}
            placeholder="Orden"
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
            {creating ? 'Creando...' : 'Crear Piso'}
          </button>
        </form>
      </div>

      <FloorList floors={floors} />
    </div>
  );
};

export default FloorModule;
