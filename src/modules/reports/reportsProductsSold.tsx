import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { GET_SOLD_PRODUCTS_REPORT, GET_PRODUCTS_BY_BRANCH } from '../../graphql/queries';
import ReportsProductsSoldList from './reportsProductsSoldList';

export interface SoldProductItem {
  code: string;
  name: string;
  totalQuantity: number;
  avgUnitPrice: number;
  totalAmount: number;
}

export interface SoldProductsSummary {
  totalItemsSold: number;
  grandTotal: number;
}

const ReportsProductsSold: React.FC = () => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;

  const isSmall = breakpoint === 'sm';
  const isMedium = breakpoint === 'md';
  const isSmallDesktop = breakpoint === 'lg';
  const isMediumDesktop = breakpoint === 'xl';

  const containerPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const containerGap = isSmall ? '1rem' : isMedium ? '1.5rem' : isSmallDesktop ? '1.5rem' : isMediumDesktop ? '2rem' : '2rem';
  const titleFontSize = isSmall ? '1.125rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.375rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const subtitleFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const inputFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const buttonFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';

  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [productId, setProductId] = useState<string>('');

  const { data: productsData } = useQuery(GET_PRODUCTS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId
  });

  const products = productsData?.productsByBranch ?? [];
  const activeProducts = products.filter((p: { productType: string; isActive: boolean }) =>
    ['DISH', 'BEVERAGE'].includes(p.productType) && p.isActive
  );

  const { data, loading, error, refetch } = useQuery(GET_SOLD_PRODUCTS_REPORT, {
    variables: {
      branchId: branchId!,
      startDate,
      endDate,
      productId: productId || null
    },
    skip: !branchId || !startDate || !endDate,
    fetchPolicy: 'network-only'
  });

  const productsList: SoldProductItem[] = data?.soldProductsReport?.products ?? [];
  const summary: SoldProductsSummary | null = data?.soldProductsReport?.summary ?? null;

  const handleSearch = () => {
    refetch();
  };

  if (!branchId) {
    return (
      <div style={{
        padding: containerPadding,
        textAlign: 'center',
        color: '#dc2626',
        fontSize: subtitleFontSize
      }}>
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: containerGap,
        background: 'linear-gradient(160deg, #f0fdf4 0%, #f9fafb 45%, #ffffff 100%)',
        padding: containerPadding,
        borderRadius: '18px',
        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: isSmall ? '180px' : isMedium ? '220px' : isSmallDesktop ? '220px' : '260px',
          height: isSmall ? '180px' : isMedium ? '220px' : isSmallDesktop ? '220px' : '260px',
          background: 'radial-gradient(circle at center, rgba(34,197,94,0.2), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: isSmall ? '140px' : isMedium ? '180px' : isSmallDesktop ? '180px' : '220px',
          height: isSmall ? '140px' : isMedium ? '180px' : isSmallDesktop ? '180px' : '220px',
          background: 'radial-gradient(circle at center, rgba(72,219,251,0.15), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isSmall ? 'flex-start' : 'center',
          flexDirection: isSmall ? 'column' : 'row',
          marginBottom: containerGap,
          flexWrap: isSmall || isMedium ? 'wrap' : 'nowrap',
          gap: isSmall || isMedium ? '1rem' : '0'
        }}>
          <div>
            <h1 style={{ fontSize: titleFontSize, fontWeight: 700, color: '#1e293b', margin: 0, marginBottom: '0.5rem' }}>
              Reporte de Productos Vendidos
            </h1>
            <p style={{ fontSize: subtitleFontSize, color: '#64748b', margin: 0 }}>
              Cantidad y monto por producto en el periodo
            </p>
          </div>
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: cardPadding,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            marginBottom: containerGap
          }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: isSmall ? '1fr' : isMedium ? '1fr 1fr' : isSmallDesktop ? '1fr 1fr 1fr' : '1fr 1fr 1fr auto',
            gap: '1rem',
            alignItems: 'end'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  fontSize: inputFontSize,
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Fecha Fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  fontSize: inputFontSize,
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Producto (opcional)
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  fontSize: inputFontSize,
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Todos los productos</option>
                {activeProducts.map((p: { id: string; code: string; name: string }) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSearch}
              style={{
                padding: '0.625rem 1.5rem',
                fontSize: buttonFontSize,
                fontWeight: 600,
                color: 'white',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '42px'
              }}
            >
              Buscar
            </button>
          </div>
        </div>

        <ReportsProductsSoldList
          products={productsList}
          summary={summary}
          loading={loading}
          error={error}
          isSmallDesktop={isSmallDesktop}
          isSmall={isSmall}
          isMedium={isMedium}
        />
      </div>
    </div>
  );
};

export default ReportsProductsSold;
