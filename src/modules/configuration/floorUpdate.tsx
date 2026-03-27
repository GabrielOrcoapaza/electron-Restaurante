import React, { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_FLOOR } from '../../graphql/mutations';
import type { Floor } from './floorList';

type FloorUpdateModalProps = {
  floor: Floor | null;
  onClose: () => void;
  onUpdated: () => void;
};

const inputStyle: React.CSSProperties = {
  padding: '0.625rem 0.875rem',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  width: '100%',
  boxSizing: 'border-box',
};

const FloorUpdateModal: React.FC<FloorUpdateModalProps> = ({ floor, onClose, onUpdated }) => {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [order, setOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (floor) {
      setName(floor.name);
      setCapacity(floor.capacity ?? 0);
      setOrder(floor.order ?? 0);
      setIsActive(floor.isActive !== false);
      setMessage(null);
    }
  }, [floor]);

  const [updateFloor, { loading }] = useMutation(UPDATE_FLOOR, {
    onCompleted: (res) => {
      const result = res?.updateFloor;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Piso actualizado' });
        onUpdated();
        onClose();
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo actualizar el piso' });
      }
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.message });
    },
  });

  if (!floor) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    updateFloor({
      variables: {
        floorId: floor.id,
        name: name.trim(),
        capacity: Number(capacity) || 0,
        order: Number(order) || 0,
        isActive,
      },
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1.25rem',
          maxWidth: '420px',
          width: '100%',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
        }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#334155', fontSize: '1.05rem' }}>Editar piso</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '1.35rem',
              lineHeight: 1,
              cursor: 'pointer',
              color: '#64748b',
              padding: '0 0.25rem',
            }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {message && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.65rem',
              borderRadius: '8px',
              border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
              backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
              fontSize: '0.8125rem',
            }}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Nombre
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Capacidad
              </label>
              <input
                type="number"
                min={0}
                value={capacity || ''}
                onChange={(e) => setCapacity(Number(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Orden
              </label>
              <input
                type="number"
                min={0}
                value={order || ''}
                onChange={(e) => setOrder(Number(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#334155' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e0',
                background: '#f8fafc',
                color: '#475569',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: loading ? '#94a3b8' : '#6366f1',
                color: 'white',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FloorUpdateModal;
