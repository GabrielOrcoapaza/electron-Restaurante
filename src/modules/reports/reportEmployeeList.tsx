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
  isSmallDesktop: boolean;
  isSmall?: boolean;
  isMedium?: boolean;
}

const ReportEmployeeList: React.FC<ReportEmployeeListProps> = ({
  operations,
  summary,
  loading,
  error,
  isSmallDesktop,
  isSmall = false,
  isMedium = false
}) => {
  const tableFontSize = isSmall ? '0.6875rem' : isMedium ? '0.75rem' : isSmallDesktop ? '0.75rem' : '0.875rem';
  const headerFontSize = isSmall ? '0.6875rem' : isMedium ? '0.75rem' : isSmallDesktop ? '0.75rem' : '0.8125rem';
  const cellPadding = isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem';

  if (loading) {
    return (
      <div style={{
        padding: isSmall ? '1.25rem' : '2rem',
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
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👤</div>
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
      <div style={{
        overflow: 'auto',
        maxHeight: '55vh',
        minHeight: '200px'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isSmall ? '480px' : '600px', fontSize: tableFontSize }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 1px 0 0 #e2e8f0' }}>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Fecha / Hora</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Orden</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Total (S/)</th>
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
                <td style={{ padding: cellPadding, fontSize: tableFontSize, color: '#334155' }}>
                  {new Date(op.operationDate).toLocaleString('es-PE')}
                </td>
                <td style={{ padding: cellPadding, fontSize: tableFontSize, color: '#334155', fontWeight: 500 }}>#{op.order}</td>
                <td style={{ padding: cellPadding, textAlign: 'center', fontSize: tableFontSize, fontWeight: 600, color: '#f59e0b' }}>
                  {currencyFormatter.format(Number(op.total ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary && (
        <div style={{
          display: 'flex',
          flexDirection: isSmall ? 'column' : 'row',
          justifyContent: 'flex-end',
          alignItems: isSmall ? 'stretch' : 'center',
          gap: isSmall ? '0.5rem' : '2rem',
          padding: cellPadding,
          borderTop: '2px solid #e2e8f0',
          background: '#fffbeb',
          fontSize: tableFontSize
        }}>
          <span style={{ color: '#64748b' }}>
            <strong>Total operaciones:</strong> {Number(summary.totalOperations).toLocaleString('es-PE')}
          </span>
          <span style={{ fontWeight: 700, color: '#1e293b' }}>
            <strong>Total general:</strong> {currencyFormatter.format(Number(summary.grandTotal ?? 0))}
          </span>
        </div>
      )}

      <div style={{
        padding: cellPadding,
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center',
        fontSize: tableFontSize,
        color: '#64748b'
      }}>
        Mostrando {operations.length} operación(es)
      </div>
    </div>
  );
};

export default ReportEmployeeList;
