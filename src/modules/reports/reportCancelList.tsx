import React from 'react';
import { ApolloError } from '@apollo/client';
import type { CancellationItem } from './reportCancel';

interface ReportCancelListProps {
  items: CancellationItem[];
  loading: boolean;
  error?: ApolloError;
  isSmallDesktop: boolean;
  isSmall?: boolean;
  isMedium?: boolean;
}

const ReportCancelList: React.FC<ReportCancelListProps> = ({
  items,
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

  if (!items.length) {
    return (
      <div style={{ 
        padding: '3rem', 
        textAlign: 'center', 
        color: '#94a3b8',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
        No se encontraron registros de anulación en el periodo seleccionado.
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
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isSmall ? '640px' : '800px', fontSize: tableFontSize }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 1px 0 0 #e2e8f0' }}>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Fecha</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Tipo</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Usuario</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Detalle</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Razón</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Cantidad</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Monto (S/)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={`${item.id}-${index}`}
                style={{
                  borderBottom: index < items.length - 1 ? '1px solid #f1f5f9' : 'none',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: cellPadding, fontSize: tableFontSize, color: '#334155' }}>
                  {new Date(item.cancelledAt).toLocaleString()}
                </td>
                <td style={{ padding: cellPadding, fontSize: tableFontSize }}>
                  <span style={{
                    padding: isSmall ? '0.2rem 0.5rem' : '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: isSmall ? '0.625rem' : '0.75rem',
                    fontWeight: 600,
                    background: item.type === 'OPERATION' ? '#fee2e2' : '#e0e7ff',
                    color: item.type === 'OPERATION' ? '#991b1b' : '#3730a3'
                  }}>
                    {item.type === 'OPERATION' ? 'OPERACIÓN' : 'PRODUCTO'}
                  </span>
                </td>
                <td style={{ padding: cellPadding, fontSize: tableFontSize, color: '#334155' }}>
                  {item.user?.fullName || 'N/A'}
                </td>
                <td style={{ padding: cellPadding, fontSize: tableFontSize, color: '#334155' }}>
                  {item.type === 'OPERATION' ? (
                    <span>Orden #{item.operationOrder}</span>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 500 }}>{item.productName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Orden #{item.operationOrder}</div>
                    </div>
                  )}
                </td>
                <td style={{ padding: cellPadding, fontSize: tableFontSize, color: '#64748b', fontStyle: 'italic' }}>
                  {item.reason}
                </td>
                <td style={{ padding: cellPadding, textAlign: 'right', fontSize: tableFontSize, color: '#334155' }}>
                  {item.quantity ? item.quantity : '-'}
                </td>
                <td style={{ padding: cellPadding, textAlign: 'right', fontSize: tableFontSize, fontWeight: 600, color: '#ef4444' }}>
                  S/ {Number(item.amount || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{
        padding: cellPadding,
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center',
        fontSize: tableFontSize,
        color: '#64748b'
      }}>
        Mostrando {items.length} registro(s)
      </div>
    </div>
  );
};

export default ReportCancelList;
