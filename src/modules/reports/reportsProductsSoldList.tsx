import React from 'react';
import { ApolloError } from '@apollo/client';
import type { SoldProductItem, SoldProductsSummary } from './reportsProductsSold';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

interface ReportsProductsSoldListProps {
  products: SoldProductItem[];
  summary: SoldProductsSummary | null;
  loading: boolean;
  error?: ApolloError;
  isSmallDesktop: boolean;
  isSmall?: boolean;
  isMedium?: boolean;
}

const ReportsProductsSoldList: React.FC<ReportsProductsSoldListProps> = ({
  products,
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

  if (!products.length) {
    return (
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        color: '#94a3b8',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🛒</div>
        No se encontraron productos vendidos en el periodo seleccionado.
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
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isSmall ? '560px' : '700px', fontSize: tableFontSize }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 1px 0 0 #e2e8f0' }}>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Código</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Producto</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Cantidad</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Precio prom.</th>
              <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 600, color: '#475569', background: '#f8fafc' }}>Total (S/)</th>
            </tr>
          </thead>
          <tbody>
            {products.map((item, index) => (
              <tr
                key={`${item.code}-${item.name}-${index}`}
                style={{
                  borderBottom: index < products.length - 1 ? '1px solid #f1f5f9' : 'none',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: cellPadding, fontSize: tableFontSize, color: '#334155', fontWeight: 500 }}>{item.code}</td>
                <td style={{ padding: cellPadding, fontSize: tableFontSize, color: '#334155' }}>{item.name}</td>
                <td style={{ padding: cellPadding, textAlign: 'center', fontSize: tableFontSize, color: '#334155' }}>
                  {Number(item.totalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: cellPadding, textAlign: 'center', fontSize: tableFontSize, color: '#64748b' }}>
                  {currencyFormatter.format(Number(item.avgUnitPrice ?? 0))}
                </td>
                <td style={{ padding: cellPadding, textAlign: 'center', fontSize: tableFontSize, fontWeight: 600, color: '#22c55e' }}>
                  {currencyFormatter.format(Number(item.totalAmount ?? 0))}
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
          background: '#f8fafc',
          fontSize: tableFontSize
        }}>
          <span style={{ color: '#64748b' }}>
            <strong>Unidades vendidas:</strong>{' '}
            {Number(summary.totalItemsSold).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
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
        Mostrando {products.length} producto(s)
      </div>
    </div>
  );
};

export default ReportsProductsSoldList;
