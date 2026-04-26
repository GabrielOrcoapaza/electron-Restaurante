import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { GET_SOLD_PRODUCTS_REPORT, GET_PRODUCTS_BY_BRANCH } from '../../graphql/queries';
import ReportsProductsSoldList from './reportsProductsSoldList';
import { formatLocalDateYYYYMMDD } from '../../utils/localDateTime';

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
  const { breakpoint, isMobile, isXs } = useResponsive();
  const branchId = companyData?.branch?.id;

  // Adaptar según tamaño de pantalla
  const isSmall = breakpoint === 'sm' || isMobile;
  const isMedium = breakpoint === 'md';
  const isSmallDesktop = breakpoint === 'lg';

  const containerPadding = isXs ? '0.75rem' : isSmall ? '1rem' : '1.5rem';
  const containerGap = isXs ? '0.75rem' : isSmall ? '1rem' : '1.5rem';
  const titleFontSize = isXs ? '1.1rem' : isSmall ? '1.25rem' : '1.5rem';
  const subtitleFontSize = isXs ? '0.7rem' : isSmall ? '0.75rem' : '0.875rem';
  const cardPadding = isXs ? '0.85rem' : isSmall ? '1rem' : '1.5rem';
  const inputFontSize = isXs ? '0.85rem' : isSmall ? '0.9rem' : '0.875rem';
  const buttonFontSize = isXs ? '0.85rem' : isSmall ? '0.9rem' : '0.875rem';

  // Por defecto fecha actual (hoy); el usuario puede cambiar si desea otro rango
  const [startDate, setStartDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [endDate, setEndDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [productId, setProductId] = useState<string>('');
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const productPickerRef = useRef<HTMLDivElement>(null);

  const { data: productsData } = useQuery(GET_PRODUCTS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const products = productsData?.productsByBranch ?? [];
  type BranchProduct = {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    productType: string;
    isActive: boolean;
  };
  const activeProducts: BranchProduct[] = products.filter((p: BranchProduct) =>
    ['DISH', 'BEVERAGE'].includes(p.productType) && p.isActive
  );

  const selectedReportProduct = useMemo(
    () => activeProducts.find((p) => p.id === productId) ?? null,
    [activeProducts, productId]
  );

  const filteredReportProducts = useMemo(() => {
    const q = productSearchTerm.toLowerCase().trim();
    if (!q) return [];
    return activeProducts
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q) ||
          Boolean(p.description && p.description.toLowerCase().includes(q))
      )
      .slice(0, 80);
  }, [activeProducts, productSearchTerm]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) {
        setProductPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const clearProductFilter = () => {
    setProductId('');
    setProductSearchTerm('');
    setProductPickerOpen(false);
  };

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

            <div ref={productPickerRef} style={{ position: 'relative' }}>
              <label style={{
                display: 'block',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Producto (opcional)
              </label>
              {selectedReportProduct ? (
                <div
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem',
                    fontSize: inputFontSize,
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    backgroundColor: 'white',
                    color: '#111827',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                    }}
                    title={`${selectedReportProduct.code} — ${selectedReportProduct.name}`}
                  >
                    {selectedReportProduct.code} — {selectedReportProduct.name}
                  </span>
                  <button
                    type="button"
                    onClick={clearProductFilter}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: 0.55,
                      fontSize: '1rem',
                      padding: '0 0.25rem',
                      lineHeight: 1,
                    }}
                    title="Quitar filtro de producto"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.625rem',
                    fontSize: inputFontSize,
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    backgroundColor: 'white',
                  }}
                >
                  <span style={{ opacity: 0.6, flexShrink: 0, lineHeight: 1 }} aria-hidden>🔎</span>
                  <input
                    type="text"
                    placeholder="Buscar producto o escanear código"
                    value={productSearchTerm}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value);
                      setProductPickerOpen(true);
                    }}
                    onFocus={() => setProductPickerOpen(true)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 'none',
                      outline: 'none',
                      padding: 0,
                      margin: 0,
                      fontSize: inputFontSize,
                      backgroundColor: 'transparent',
                      color: '#111827',
                    }}
                  />
                  {productSearchTerm ? (
                    <button
                      type="button"
                      onClick={() => setProductSearchTerm('')}
                      style={{
                        flexShrink: 0,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0.5,
                        fontSize: '1rem',
                        padding: '0 0.25rem',
                        lineHeight: 1,
                      }}
                      title="Limpiar búsqueda"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              )}
              {productPickerOpen && !selectedReportProduct && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    marginTop: '0.35rem',
                    maxHeight: 'min(240px, 40vh)',
                    overflowY: 'auto',
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 12px 28px rgba(15,23,42,0.12)'
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        clearProductFilter();
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.55rem 0.75rem',
                        border: 'none',
                        borderBottom: '1px solid #f1f5f9',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        fontSize: inputFontSize,
                        fontWeight: 600,
                        color: '#475569'
                      }}
                    >
                      Todos los productos
                    </button>
                    {!productSearchTerm.trim() ? (
                      <div style={{ padding: '0.75rem', fontSize: inputFontSize, color: '#94a3b8' }}>
                        Escribe nombre, código o descripción (como en Productos)
                      </div>
                    ) : filteredReportProducts.length === 0 ? (
                      <div style={{ padding: '0.75rem', fontSize: inputFontSize, color: '#94a3b8' }}>
                        No hay coincidencias
                      </div>
                    ) : (
                      filteredReportProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setProductId(p.id);
                            setProductSearchTerm('');
                            setProductPickerOpen(false);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.5rem 0.75rem',
                            border: 'none',
                            borderBottom: '1px solid #f1f5f9',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: inputFontSize,
                            color: '#334155'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                        >
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{p.code}</span>
                          <span style={{ marginLeft: '0.35rem' }}>{p.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
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
          isSmall={isSmall}
          isXs={isXs}
        />
      </div>
    </div>
  );
};

export default ReportsProductsSold;
