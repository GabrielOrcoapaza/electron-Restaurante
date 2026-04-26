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
  isXs?: boolean;
}

const ReportsProductsSoldList: React.FC<ReportsProductsSoldListProps> = ({
  products,
  summary,
  loading,
  error,
  isSmallDesktop,
  isSmall = false,
  isMedium = false,
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
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🛒</div>
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Sin registros</div>
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
      {!isXs ? (
        <div style={{
          overflow: 'auto',
          maxHeight: '60vh',
          minHeight: '200px'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isSmall ? '560px' : '700px', fontSize: tableFontSize }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 1px 0 0 #e2e8f0' }}>
                <th style={{ padding: cellPadding, textAlign: 'left', fontSize: headerFontSize, fontWeight: 700, color: '#475569', background: '#f8fafc' }}>Código</th>
                <th style={{ padding: cellPadding, textAlign: 'left', fontSize: headerFontSize, fontWeight: 700, color: '#475569', background: '#f8fafc' }}>Producto</th>
                <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 700, color: '#475569', background: '#f8fafc' }}>Cantidad</th>
                <th style={{ padding: cellPadding, textAlign: 'right', fontSize: headerFontSize, fontWeight: 700, color: '#475569', background: '#f8fafc' }}>Precio prom.</th>
                <th style={{ padding: cellPadding, textAlign: 'right', fontSize: headerFontSize, fontWeight: 700, color: '#475569', background: '#f8fafc' }}>Total (S/)</th>
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
                  <td style={{ padding: cellPadding, color: '#64748b', fontWeight: 600 }}>{item.code}</td>
                  <td style={{ padding: cellPadding, color: '#334155', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: cellPadding, textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>
                    {Number(item.totalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: cellPadding, textAlign: 'right', color: '#64748b' }}>
                    {currencyFormatter.format(Number(item.avgUnitPrice ?? 0))}
                  </td>
                  <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                    {currencyFormatter.format(Number(item.totalAmount ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {products.map((item, index) => (
            <div key={`${item.code}-${item.name}-${index}`} style={{
              padding: '1rem',
              borderBottom: index < products.length - 1 ? '1px solid #f1f5f9' : 'none',
              background: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ flex: 1, paddingRight: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.1rem' }}>
                    {item.code}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
                    {item.name}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>
                    {currencyFormatter.format(Number(item.totalAmount ?? 0))}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                  <strong>Cant:</strong> {Number(item.totalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  <strong>Prom:</strong> {currencyFormatter.format(Number(item.avgUnitPrice ?? 0))}
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
          background: 'linear-gradient(to right, #f8fafc, #f1f5f9)',
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
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Total Unidades</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
              {Number(summary.totalItemsSold).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
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
            borderLeft: '4px solid #16a34a'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Gran Total</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>
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
        Reporte generado para {products.length} productos distintos
      </div>
    </div>
  );
};

export default ReportsProductsSoldList;
