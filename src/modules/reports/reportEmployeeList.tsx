import React from 'react';
import { ApolloError } from '@apollo/client';
import type { UserSaleOperation, UserSalesSummary } from './reportEmployee';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

interface ReportEmployeeListProps {
  operations: UserSaleOperation[];
  summary: UserSalesSummary | null;
  loading: boolean;
  error?: ApolloError;
  isSmall?: boolean;
  isXs?: boolean;
}

const ReportEmployeeList: React.FC<ReportEmployeeListProps> = ({
  operations,
  summary,
  loading,
  error,
  isSmall = false,
  isXs = false
}) => {
  const tableFontSize = isXs ? '0.8rem' : isSmall ? '0.85rem' : '0.875rem';
  const headerFontSize = isXs ? '0.75rem' : isSmall ? '0.8rem' : '0.8125rem';
  const cellPadding = isXs ? '0.6rem' : isSmall ? '0.75rem' : '1rem';

  if (loading) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#64748b',
        fontSize: tableFontSize,
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        Cargando datos...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#ef4444',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        Error al cargar reporte: {error.message}
      </div>
    );
  }

  if (!operations.length) {
    return (
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        color: '#94a3b8',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>👤</div>
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Sin registros</div>
        No se encontraron operaciones para el empleado en el periodo seleccionado.
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    }}>
      {!isXs ? (
        <div style={{
          overflow: 'auto',
          maxHeight: '60vh',
          minHeight: '200px'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isSmall ? '480px' : '600px', fontSize: tableFontSize }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 1px 0 0 #e2e8f0' }}>
                <th style={{ padding: cellPadding, textAlign: 'left', fontSize: headerFontSize, fontWeight: 700, color: '#475569', background: '#f8fafc' }}>Fecha / Hora</th>
                <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 700, color: '#475569', background: '#f8fafc' }}>Orden</th>
                <th style={{ padding: cellPadding, textAlign: 'right', fontSize: headerFontSize, fontWeight: 700, color: '#475569', background: '#f8fafc' }}>Total (S/)</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op, index) => (
                <tr
                  key={op.id}
                  style={{
                    borderBottom: index < operations.length - 1 ? '1px solid #f1f5f9' : 'none',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: cellPadding, fontSize: tableFontSize, color: '#64748b' }}>
                    {new Date(op.operationDate).toLocaleString('es-PE')}
                  </td>
                  <td style={{ padding: cellPadding, textAlign: 'center', fontSize: tableFontSize, color: '#334155', fontWeight: 600 }}>#{op.order}</td>
                  <td style={{ padding: cellPadding, textAlign: 'right', fontSize: tableFontSize, fontWeight: 700, color: '#f59e0b' }}>
                    {currencyFormatter.format(Number(op.total ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {operations.map((op, index) => (
            <div key={op.id} style={{
              padding: '1rem',
              borderBottom: index < operations.length - 1 ? '1px solid #f1f5f9' : 'none',
              background: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                    Orden #{op.order}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                    {new Date(op.operationDate).toLocaleString('es-PE')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b' }}>
                    {currencyFormatter.format(Number(op.total ?? 0))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isSmall ? '1fr' : 'repeat(2, 1fr)',
          gap: isSmall ? '0.5rem' : '1.5rem',
          padding: '1.25rem',
          borderTop: '2px solid #e2e8f0',
          background: 'linear-gradient(to right, #fffbeb, #fef3c7)',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0.75rem',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Total Operaciones</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
              {Number(summary.totalOperations).toLocaleString('es-PE')}
            </span>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0.75rem',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #f59e0b'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Total General</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>
              {currencyFormatter.format(Number(summary.grandTotal ?? 0))}
            </span>
          </div>
        </div>
      )}

      <div style={{
        padding: '0.75rem',
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: '#64748b',
        fontWeight: 500
      }}>
        Mostrando {operations.length} operación(es)
      </div>
    </div>
  );
};

export default ReportEmployeeList;
