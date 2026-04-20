import React from 'react';
import { ApolloError } from '@apollo/client';

export interface CategorySalesProductLine {
  productId: string;
  code: string;
  name: string;
  totalQuantity: number;
  totalAmount: number;
}

export interface CategorySalesGroup {
  categoryId: string;
  categoryName: string;
  categoryOrder: number;
  totalQuantity: number;
  totalAmount: number;
  products: CategorySalesProductLine[];
}

export interface CategorySalesSummary {
  grandTotalQuantity: number;
  grandTotalAmount: number;
}

interface ReportCategorySalesListProps {
  categories: CategorySalesGroup[];
  summary: CategorySalesSummary | null;
  loading: boolean;
  error?: ApolloError;
  isSmallDesktop: boolean;
  isSmall?: boolean;
  isMedium?: boolean;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
});

const ReportCategorySalesList: React.FC<ReportCategorySalesListProps> = ({
  categories,
  summary,
  loading,
  error,
  isSmallDesktop,
  isSmall = false,
  isMedium = false,
}) => {
  const tableFontSize = isSmall ? '0.6875rem' : isMedium ? '0.75rem' : isSmallDesktop ? '0.75rem' : '0.875rem';
  const headerFontSize = isSmall ? '0.6875rem' : isMedium ? '0.75rem' : isSmallDesktop ? '0.75rem' : '0.8125rem';
  const cellPadding = isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem';

  if (loading) {
    return (
      <div
        style={{
          padding: isSmall ? '1.25rem' : '2rem',
          textAlign: 'center',
          color: '#64748b',
          fontSize: tableFontSize,
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        Cargando datos...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#ef4444',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        Error al cargar reporte: {error.message}
      </div>
    );
  }

  if (!categories.length) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          color: '#94a3b8',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📂</div>
        No hay ventas por categoría en el periodo seleccionado.
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflow: 'auto', maxHeight: '58vh', minHeight: '200px' }}>
        {categories.map((cat) => (
          <div key={cat.categoryId} style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div
              style={{
                padding: `${cellPadding} ${cellPadding} 0.5rem`,
                background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: isSmall ? '0.8125rem' : '0.9375rem' }}>
                  {cat.categoryName || 'Sin nombre'}
                </span>
                <span style={{ fontSize: tableFontSize, color: '#475569' }}>
                  <strong>Cant.:</strong>{' '}
                  {Number(cat.totalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
                  {' · '}
                  <strong>Subtotal:</strong> {currencyFormatter.format(Number(cat.totalAmount ?? 0))}
                </span>
              </div>
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: isSmall ? '480px' : '640px',
                fontSize: tableFontSize,
              }}
            >
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                  <th
                    style={{
                      padding: cellPadding,
                      textAlign: 'center',
                      fontSize: headerFontSize,
                      fontWeight: 600,
                      color: '#64748b',
                    }}
                  >
                    Código
                  </th>
                  <th
                    style={{
                      padding: cellPadding,
                      textAlign: 'left',
                      fontSize: headerFontSize,
                      fontWeight: 600,
                      color: '#64748b',
                    }}
                  >
                    Producto
                  </th>
                  <th
                    style={{
                      padding: cellPadding,
                      textAlign: 'center',
                      fontSize: headerFontSize,
                      fontWeight: 600,
                      color: '#64748b',
                    }}
                  >
                    Cantidad
                  </th>
                  <th
                    style={{
                      padding: cellPadding,
                      textAlign: 'center',
                      fontSize: headerFontSize,
                      fontWeight: 600,
                      color: '#64748b',
                    }}
                  >
                    Total (S/)
                  </th>
                </tr>
              </thead>
              <tbody>
                {cat.products.map((p, idx) => (
                  <tr
                    key={`${cat.categoryId}-${p.productId}-${idx}`}
                    style={{
                      borderBottom: idx < cat.products.length - 1 ? '1px solid #f8fafc' : 'none',
                    }}
                  >
                    <td style={{ padding: cellPadding, color: '#334155', fontWeight: 500 }}>{p.code}</td>
                    <td style={{ padding: cellPadding, color: '#334155' }}>{p.name}</td>
                    <td style={{ padding: cellPadding, textAlign: 'center', color: '#334155' }}>
                      {Number(p.totalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: cellPadding, textAlign: 'center', fontWeight: 600, color: '#059669' }}>
                      {currencyFormatter.format(Number(p.totalAmount ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {summary && (
        <div
          style={{
            display: 'flex',
            flexDirection: isSmall ? 'column' : 'row',
            justifyContent: 'flex-end',
            alignItems: isSmall ? 'stretch' : 'center',
            gap: isSmall ? '0.5rem' : '2rem',
            padding: cellPadding,
            borderTop: '2px solid #e2e8f0',
            background: '#f0fdf4',
            fontSize: tableFontSize,
          }}
        >
          <span style={{ color: '#64748b' }}>
            <strong>Cantidad total:</strong>{' '}
            {Number(summary.grandTotalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontWeight: 700, color: '#14532d' }}>
            <strong>Total general:</strong> {currencyFormatter.format(Number(summary.grandTotalAmount ?? 0))}
          </span>
        </div>
      )}

      <div
        style={{
          padding: cellPadding,
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          fontSize: tableFontSize,
          color: '#64748b',
        }}
      >
        {categories.length} categoría(s)
      </div>
    </div>
  );
};

export default ReportCategorySalesList;
