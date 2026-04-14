import React from 'react';

export interface Table {
  id: string;
  name: string;
  shape?: string;
  positionX?: number;
  positionY?: number;
  capacity?: number;
  isActive?: boolean;
  status?: string;
}

interface TableListProps {
  tables: Table[];
  floorName?: string;
  onEdit?: (table: Table) => void;
}

const shapeLabel = (shape: string | undefined): string => {
  if (!shape) return '-';
  const s = (shape || '').toUpperCase();
  if (s === 'SQUARE') return 'Cuadrada';
  if (s === 'ROUND' || s === 'CIRCLE') return 'Redonda';
  if (s === 'RECTANGLE') return 'Rectangular';
  return shape;
};

const TableList: React.FC<TableListProps> = ({ tables, floorName, onEdit }) => {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '1rem',
        border: '1px solid #e2e8f0',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem', color: '#334155' }}>
        Mesas {floorName ? `- ${floorName}` : ''} ({tables.length})
      </h3>

      {tables.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 1rem' }}>
          No hay mesas en este piso. Crea una arriba.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '0.65rem' }}>Nombre</th>
                <th style={{ textAlign: 'center', padding: '0.65rem' }}>Forma</th>
                <th style={{ textAlign: 'center', padding: '0.65rem' }}>Capacidad</th>
                <th style={{ textAlign: 'center', padding: '0.65rem' }}>Estado</th>
                {onEdit && <th style={{ textAlign: 'center', padding: '0.65rem', width: '88px' }}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.65rem', color: '#334155', fontWeight: 600 }}>{table.name}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'center', color: '#64748b' }}>
                    {shapeLabel(table.shape)}
                  </td>
                  <td style={{ padding: '0.65rem', textAlign: 'center', color: '#334155' }}>{table.capacity ?? 0}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                    {table.isActive === false ? (
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        Inactiva
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor:
                            table.status === 'AVAILABLE' ? '#dcfce7' :
                            table.status === 'OCCUPIED' ? '#fef3c7' :
                            table.status === 'TO_PAY' ? '#fde68a' :
                            table.status === 'MAINTENANCE' ? '#fee2e2' : '#e5e7eb',
                          color:
                            table.status === 'AVAILABLE' ? '#166534' :
                            table.status === 'OCCUPIED' ? '#92400e' :
                            table.status === 'TO_PAY' ? '#b45309' :
                            table.status === 'MAINTENANCE' ? '#991b1b' : '#4b5563',
                        }}
                      >
                        {table.status === 'AVAILABLE' ? 'Disponible' :
                         table.status === 'OCCUPIED' ? 'Ocupada' :
                         table.status === 'TO_PAY' ? 'Por pagar' :
                         table.status === 'IN_PROCESS' ? 'En proceso' :
                         table.status === 'MAINTENANCE' ? 'Mantenimiento' : table.status || '-'}
                      </span>
                    )}
                  </td>
                  {onEdit && (
                    <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onEdit(table)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#6366f1',
                          background: '#eef2ff',
                          border: '1px solid #c7d2fe',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TableList;
