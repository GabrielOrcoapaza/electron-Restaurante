import React, { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_TABLE } from '../../graphql/mutations';
import type { Table } from './tableList';

const SHAPE_OPTIONS = [
  { value: 'SQUARE', label: 'Cuadrada' },
  { value: 'ROUND', label: 'Redonda' },
  { value: 'RECTANGLE', label: 'Rectangular' },
];

type TableUpdateModalProps = {
  table: Table | null;
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

const TableUpdateModal: React.FC<TableUpdateModalProps> = ({ table, onClose, onUpdated }) => {
  const [name, setName] = useState('');
  const [shape, setShape] = useState('SQUARE');
  const [capacity, setCapacity] = useState(4);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (table) {
      setName(table.name);
      const s = (table.shape || 'SQUARE').toUpperCase();
      if (s === 'ROUND' || s === 'CIRCLE') setShape('ROUND');
      else if (s === 'RECTANGLE') setShape('RECTANGLE');
      else setShape('SQUARE');
      setCapacity(table.capacity ?? 4);
      setPositionX(table.positionX ?? 0);
      setPositionY(table.positionY ?? 0);
      setIsActive(table.isActive !== false);
      setMessage(null);
    }
  }, [table]);

  const [updateTable, { loading }] = useMutation(UPDATE_TABLE, {
    onCompleted: (res) => {
      const result = res?.updateTable;
      if (result?.success) {
        onUpdated();
        onClose();
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo actualizar la mesa' });
      }
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.message });
    },
  });

  if (!table) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    updateTable({
      variables: {
        tableId: table.id,
        name: name.trim(),
        shape,
        positionX: Number(positionX) || 0,
        positionY: Number(positionY) || 0,
        capacity: Number(capacity) || 1,
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
          maxWidth: '440px',
          width: '100%',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#334155', fontSize: '1.05rem' }}>Editar mesa</h3>
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
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Forma
            </label>
            <select value={shape} onChange={(e) => setShape(e.target.value)} style={inputStyle}>
              {SHAPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Capacidad
              </label>
              <input
                type="number"
                min={1}
                value={capacity || ''}
                onChange={(e) => setCapacity(Number(e.target.value) || 1)}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Posición X
              </label>
              <input
                type="number"
                step="any"
                value={positionX}
                onChange={(e) => setPositionX(Number(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Posición Y
              </label>
              <input
                type="number"
                step="any"
                value={positionY}
                onChange={(e) => setPositionY(Number(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#334155' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activa
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

export default TableUpdateModal;
