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
  isSmall?: boolean;
  isXs?: boolean;
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
  isSmall = false,
  isXs = false
}) => {
  const tableFontSize = isXs ? '0.8rem' : isSmall ? '0.85rem' : '0.875rem';
  const headerFontSize = isXs ? '0.75rem' : isSmall ? '0.8rem' : '0.8125rem';
  const cellPadding = isXs ? '0.6rem' : isSmall ? '0.75rem' : '1rem';

  if (loading) {
    return (
      <div
        style={{
          padding: '2rem',
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
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📂</div>
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Sin registros</div>
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
      <div style={{ overflow: 'auto', maxHeight: '60vh', minHeight: '200px' }}>
        {categories.map((cat) => (
          <div key={cat.categoryId} style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: isXs ? '0.85rem' : '1rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                {cat.categoryName || 'Sin nombre'}
              </span>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', background: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <strong>{Number(cat.totalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })}</strong> und
                </span>
                <span style={{ fontSize: isXs ? '0.85rem' : '0.95rem', fontWeight: 800, color: '#2563eb' }}>
                  {currencyFormatter.format(Number(cat.totalAmount ?? 0))}
                </span>
              </div>
            </div>

            {!isXs ? (
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
                    <th style={{ padding: cellPadding, textAlign: 'left', fontSize: headerFontSize, fontWeight: 700, color: '#64748b' }}>Código</th>
                    <th style={{ padding: cellPadding, textAlign: 'left', fontSize: headerFontSize, fontWeight: 700, color: '#64748b' }}>Producto</th>
                    <th style={{ padding: cellPadding, textAlign: 'center', fontSize: headerFontSize, fontWeight: 700, color: '#64748b' }}>Cantidad</th>
                    <th style={{ padding: cellPadding, textAlign: 'right', fontSize: headerFontSize, fontWeight: 700, color: '#64748b' }}>Subtotal (S/)</th>
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
                      <td style={{ padding: cellPadding, color: '#64748b', fontWeight: 600 }}>{p.code}</td>
                      <td style={{ padding: cellPadding, color: '#334155', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: cellPadding, textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>
                        {Number(p.totalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>
                        {currencyFormatter.format(Number(p.totalAmount ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {cat.products.map((p, idx) => (
                  <div key={`${cat.categoryId}-${p.productId}-${idx}`} style={{
                    padding: '0.85rem 1rem',
                    borderBottom: idx < cat.products.length - 1 ? '1px solid #f1f5f9' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ flex: 1, paddingRight: '1rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>{p.code}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                        {Number(p.totalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })} unidades
                      </div>
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#3b82f6' }}>
                      {currencyFormatter.format(Number(p.totalAmount ?? 0))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isSmall ? '1fr' : 'repeat(2, 1fr)',
            gap: isSmall ? '0.5rem' : '1.5rem',
            padding: '1.25rem',
            borderTop: '2px solid #e2e8f0',
            background: 'linear-gradient(to right, #eff6ff, #f8fafc)',
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0.75rem',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Cantidad Total</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
              {Number(summary.grandTotalQuantity).toLocaleString('es-PE', { maximumFractionDigits: 2 })}
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
            borderLeft: '4px solid #3b82f6'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Total General</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb' }}>
              {currencyFormatter.format(Number(summary.grandTotalAmount ?? 0))}
            </span>
          </div>
        </div>
      )}

      <div
        style={{
          padding: '0.75rem',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#64748b',
          fontWeight: 500
        }}
      >
        {categories.length} categoría(s) analizada(s)
      </div>
    </div>
  );
};

export default ReportCategorySalesList;
