import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { GET_STOCK_MOVEMENTS_REPORT, GET_STOCKS_BY_BRANCH, SEARCH_PRODUCTS, GET_PRODUCTS_BY_BRANCH } from '../../graphql/queries';

interface StockMovement {
  id: string;
  movementType: string;
  movementTypeDisplay: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  createdAt: string;
  productId: string;
  productCode: string;
  productName: string;
  productType: string;
  productTypeDisplay: string;
  stockId: string;
  currentQuantity: number;
  averageCost: number;
  operationId?: string;
  operationOrder?: string;
  operationType?: string;
  operationDate?: string;
  userId?: string;
  userName: string;
  branchId: string;
  branchName: string;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const Kardex: React.FC = () => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;

  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px
  
  // Tamaños adaptativos
  const containerPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const containerGap = isSmall ? '1rem' : isMedium ? '1.5rem' : isSmallDesktop ? '1.5rem' : isMediumDesktop ? '2rem' : '2rem';
  const titleFontSize = isSmall ? '1.125rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.375rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const subtitleFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const tableFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const tableCellPadding = isSmall ? '0.5rem' : isMedium ? '0.625rem' : isSmallDesktop ? '0.625rem' : isMediumDesktop ? '0.75rem' : '0.75rem';
  const inputFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const inputPadding = isSmall ? '0.5rem 0.625rem' : isMedium ? '0.5625rem 0.75rem' : isSmallDesktop ? '0.5625rem 0.75rem' : isMediumDesktop ? '0.625rem 0.875rem' : '0.625rem 0.875rem';
  const buttonFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const buttonPadding = isSmall ? '0.5625rem 0.875rem' : isMedium ? '0.625rem 1rem' : isSmallDesktop ? '0.625rem 1rem' : isMediumDesktop ? '0.75rem 1.25rem' : '0.75rem 1.25rem';
  const badgeFontSize = isSmall ? '0.625rem' : isMedium ? '0.6875rem' : isSmallDesktop ? '0.6875rem' : isMediumDesktop ? '0.75rem' : '0.75rem';
  const badgePadding = isSmall ? '0.25rem 0.5rem' : isMedium ? '0.25rem 0.625rem' : isSmallDesktop ? '0.25rem 0.625rem' : '0.25rem 0.75rem';

  // Estado para los filtros
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Últimos 30 días por defecto
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Búsqueda de productos (como order.tsx)
  const { data: searchData, loading: searchLoading } = useQuery(SEARCH_PRODUCTS, {
    variables: { search: productSearchTerm, branchId: branchId!, limit: 50 },
    skip: !branchId || productSearchTerm.length < 3,
    errorPolicy: 'ignore',
    fetchPolicy: 'network-only'
  });

  // Todos los productos para fallback cuando la búsqueda no encuentra nada
  const { data: productsData, refetch: refetchProducts } = useQuery(GET_PRODUCTS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const allProductsFromBranch = productsData?.productsByBranch || [];
  const searchResults = (() => {
    if (productSearchTerm.length < 3) return [];
    const fromSearch = searchData?.searchProducts || [];
    if (fromSearch.length > 0) return fromSearch;
    const lower = productSearchTerm.toLowerCase();
    return allProductsFromBranch.filter(
      (p: any) =>
        (p.productType === 'INGREDIENT' || p.productType === 'BEVERAGE') &&
        ((p.name || '').toLowerCase().includes(lower) ||
          (p.code || '').toLowerCase().includes(lower) ||
          (p.description || '').toLowerCase().includes(lower))
    );
  })().filter((p: any) => p.productType === 'INGREDIENT' || p.productType === 'BEVERAGE');

  const selectedProduct = selectedProductId
    ? searchResults.find((p: any) => p.id === selectedProductId) ||
      allProductsFromBranch.find((p: any) => p.id === selectedProductId)
    : null;

  // Stock actual desde el servidor (stocksByBranch) — se actualiza al registrar o vender
  const { data: stocksData, refetch: refetchStocks } = useQuery(GET_STOCKS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const stocksByBranchList = stocksData?.stocksByBranch ?? [];
  const currentStockFromServer: Record<string, number> = {};
  stocksByBranchList.forEach((s: { product?: { id: string }; currentQuantity?: number }) => {
    const pid = s.product?.id;
    if (pid != null) {
      const q = Number(s.currentQuantity);
      if (!Number.isNaN(q)) currentStockFromServer[pid] = q;
    }
  });

  // Convertir fechas a formato ISO para GraphQL
  const startDateTime = startDate ? `${startDate}T00:00:00` : null;
  const endDateTime = endDate ? `${endDate}T23:59:59` : null;

  // Query para obtener movimientos de stock
  const { data, loading, error, refetch } = useQuery(GET_STOCK_MOVEMENTS_REPORT, {
    variables: {
      branchId: branchId!,
      productId: selectedProductId || null,
      startDate: startDateTime,
      endDate: endDateTime
    },
    skip: !branchId || !startDate || !endDate,
    fetchPolicy: 'network-only'
  });

  const movements: StockMovement[] = data?.stockMovementsReport || [];

  // Extraer stock objetivo del motivo cuando viene "X -> Y" (ej. "1.0000 -> 100.0")
  const getAdjustmentTargetFromReason = (reason: string | null | undefined): number | null => {
    if (!reason || typeof reason !== 'string') return null;
    const trimmed = reason.trim();
    // Aceptar "->" o "→" y capturar el número destino (el que va después de la flecha)
    const match = trimmed.match(/(?:->|→)\s*([\d.,]+)/);
    if (!match) return null;
    const numStr = match[1].replace(',', '.');
    const n = parseFloat(numStr);
    return Number.isNaN(n) ? null : n;
  };

  // Saldo después de cada movimiento POR PRODUCTO (cada producto tiene su propio balance)
  const balanceAfterMovementId: Record<string, number> = (() => {
    const map: Record<string, number> = {};
    const sorted = [...movements].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const balanceByProduct: Record<string, number> = {};
    for (const m of sorted) {
      const productId = m.productId || '';
      let balance = balanceByProduct[productId] ?? 0;
      const q = Number(m.quantity) || 0;
      switch ((m.movementType || '').toUpperCase()) {
        case 'IN':
          balance += q;
          break;
        case 'OUT':
          balance -= q;
          break;
        case 'ADJUSTMENT': {
          const targetFromReason = getAdjustmentTargetFromReason(m.reason);
          balance = targetFromReason != null ? targetFromReason : q;
          break;
        }
        case 'TRANSFER':
          balance += q;
          break;
        default:
          balance += q;
      }
      balanceByProduct[productId] = balance;
      map[m.id] = balance;
    }
    return map;
  })();

  // Función para obtener el color según el tipo de movimiento
  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'IN':
        return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      case 'OUT':
        return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      case 'ADJUSTMENT':
        return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
      case 'TRANSFER':
        return { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' };
      default:
        return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
    }
  };

  // Función para formatear números
  const formatNumber = (value: number, decimals: number = 4) => {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
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
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)',
        padding: containerPadding,
        borderRadius: '18px',
        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Elementos decorativos de fondo */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: isSmallDesktop ? '220px' : '260px',
          height: isSmallDesktop ? '220px' : '260px',
          background: 'radial-gradient(circle at center, rgba(102,126,234,0.25), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: isSmallDesktop ? '180px' : '220px',
          height: isSmallDesktop ? '180px' : '220px',
          background: 'radial-gradient(circle at center, rgba(72,219,251,0.18), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />

      {/* Contenido principal */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: containerGap,
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: titleFontSize, 
              fontWeight: 700, 
              color: '#1e293b' 
            }}>
              📋 Kardex
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: subtitleFontSize }}>
              Registro de movimientos. Stock actual desde el servidor o calculado por movimiento.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              refetch();
              refetchProducts();
              refetchStocks();
            }}
            disabled={loading}
            style={{
              padding: '0.625rem 1rem',
              fontSize: buttonFontSize,
              fontWeight: 600,
              color: 'white',
              background: loading ? '#94a3b8' : '#667eea',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.35)'
            }}
          >
            {loading ? 'Actualizando...' : '🔄 Refrescar'}
          </button>
        </div>

        {/* Filtros */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: cardPadding,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          marginBottom: isSmallDesktop ? '1.25rem' : '1.5rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isSmall ? '1fr' : `repeat(auto-fit, minmax(${isMedium ? '180px' : isSmallDesktop ? '180px' : '200px'}, 1fr))`,
            gap: isSmall ? '0.75rem' : isMedium ? '0.875rem' : isSmallDesktop ? '0.875rem' : '1rem',
            alignItems: 'end'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151'
              }}>
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: inputPadding,
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: inputFontSize,
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151'
              }}>
                Fecha Fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: inputPadding,
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: inputFontSize,
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151'
              }}>
                Producto (Opcional)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.9rem',
                  opacity: 0.6,
                  pointerEvents: 'none'
                }}>🔎</span>
                <input
                  type="text"
                  value={selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : productSearchTerm}
                  onChange={(e) => {
                    setSelectedProductId('');
                    setProductSearchTerm(e.target.value);
                  }}
                  onFocus={() => {
                    setSearchFocused(true);
                    if (selectedProduct) {
                      setSelectedProductId('');
                      setProductSearchTerm('');
                    }
                  }}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="Buscar producto (nombre o código)..."
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    paddingLeft: '2rem',
                    paddingRight: selectedProduct ? '3.5rem' : undefined,
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    outline: 'none',
                    transition: 'all 0.2s',
                    backgroundColor: 'white',
                    boxSizing: 'border-box'
                  }}
                />
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductId('');
                      setProductSearchTerm('');
                    }}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      color: '#64748b',
                      fontWeight: 500
                    }}
                  >
                    ✕ Todos
                  </button>
                )}
              </div>
              {searchFocused && productSearchTerm.length >= 3 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '0.25rem',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 20
                }}>
                  {searchLoading ? (
                    <div style={{ padding: '0.75rem', fontSize: inputFontSize, color: '#64748b' }}>
                      Buscando...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ padding: '0.75rem', fontSize: inputFontSize, color: '#64748b' }}>
                      No se encontraron productos
                    </div>
                  ) : (
                    searchResults.slice(0, 30).map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setProductSearchTerm('');
                          setSearchFocused(false);
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          cursor: 'pointer',
                          fontSize: inputFontSize,
                          borderBottom: '1px solid #f1f5f9'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <span style={{ fontWeight: 600 }}>{p.code}</span> - {p.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <button
                onClick={() => refetch()}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: buttonPadding,
                  backgroundColor: loading ? '#9ca3af' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: buttonFontSize,
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#5568d3';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#667eea';
                }}
              >
                {loading ? 'Cargando...' : '🔍 Buscar'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de movimientos */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: cardPadding,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          overflowX: 'auto'
        }}>
          {loading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: isSmall ? '2rem' : isMedium ? '2.5rem' : isSmallDesktop ? '2rem' : '3rem', 
              color: '#64748b',
              fontSize: tableFontSize
            }}>
              <p>Cargando movimientos...</p>
            </div>
          ) : error ? (
            <div style={{ 
              textAlign: 'center', 
              padding: isSmall ? '2rem' : isMedium ? '2.5rem' : isSmallDesktop ? '2rem' : '3rem', 
              color: '#dc2626',
              fontSize: tableFontSize
            }}>
              <p>Error al cargar los movimientos: {error.message}</p>
            </div>
          ) : movements.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: isSmall ? '2rem' : isMedium ? '2.5rem' : isSmallDesktop ? '2rem' : '3rem', 
              color: '#64748b',
              fontSize: tableFontSize
            }}>
              <p>No se encontraron movimientos en el rango de fechas seleccionado.</p>
            </div>
          ) : (
            <>
              <div style={{ 
                marginBottom: isSmall ? '0.75rem' : isMedium ? '0.875rem' : isSmallDesktop ? '0.875rem' : '1rem', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: isSmall ? 'wrap' : 'nowrap'
              }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: tableFontSize, 
                  color: '#64748b' 
                }}>
                  Total de movimientos: <strong>{movements.length}</strong>
                </p>
              </div>
              <div style={{ 
                overflowX: 'auto',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: tableFontSize,
                  tableLayout: 'auto'
                }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#f8fafc',
                      borderBottom: '2px solid #e2e8f0'
                    }}>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: tableFontSize,
                        whiteSpace: 'nowrap'
                      }}>
                        Fecha
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: tableFontSize,
                        whiteSpace: 'nowrap'
                      }}>
                        Producto
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: tableFontSize,
                        whiteSpace: 'nowrap'
                      }}>
                        Tipo
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: tableFontSize,
                        whiteSpace: 'nowrap'
                      }}>
                        Movimiento
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: tableFontSize,
                        whiteSpace: 'nowrap'
                      }}>
                        Costo Unit.
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: tableFontSize,
                        whiteSpace: 'nowrap'
                      }}>
                        Costo Total
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: tableFontSize,
                        whiteSpace: 'nowrap'
                      }}>
                        Stock Actual
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: tableFontSize,
                        whiteSpace: 'nowrap'
                      }}>
                        Usuario
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: tableFontSize,
                        whiteSpace: 'nowrap'
                      }}>
                        Motivo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => {
                      const typeColor = getMovementTypeColor(movement.movementType);
                      return (
                        <tr
                          key={movement.id}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ 
                            padding: tableCellPadding, 
                            textAlign: 'center', 
                            color: '#64748b',
                            fontSize: tableFontSize
                          }}>
                            {dateFormatter.format(new Date(movement.createdAt))}
                          </td>
                          <td style={{ 
                            padding: tableCellPadding, 
                            textAlign: 'center',
                            fontSize: tableFontSize
                          }}>
                            <div style={{ display: 'inline-block', textAlign: 'left' }}>
                              <div style={{ 
                                fontWeight: 500, 
                                color: '#1e293b',
                                fontSize: tableFontSize
                              }}>
                                {movement.productName}
                              </div>
                              <div style={{ 
                                fontSize: isSmallDesktop ? '0.6875rem' : '0.75rem', 
                                color: '#64748b' 
                              }}>
                                {movement.productCode}
                              </div>
                            </div>
                          </td>
                          <td style={{ 
                            padding: tableCellPadding, 
                            textAlign: 'center',
                            fontSize: tableFontSize
                          }}>
                            <span style={{
                              display: 'inline-block',
                              padding: badgePadding,
                              borderRadius: '6px',
                              fontSize: badgeFontSize,
                              fontWeight: 500,
                              backgroundColor: typeColor.bg,
                              color: typeColor.text,
                              border: `1px solid ${typeColor.border}`
                            }}>
                              {movement.movementTypeDisplay}
                            </span>
                          </td>
                          <td style={{ 
                            padding: tableCellPadding, 
                            textAlign: 'center', 
                            color: '#1e293b', 
                            fontWeight: 500,
                            fontSize: tableFontSize
                          }}>
                            {formatNumber(
                              (movement.movementType || '').toUpperCase() === 'OUT'
                                ? -(Math.abs(Number(movement.quantity)) || 0)
                                : Number(movement.quantity) || 0
                            )}
                          </td>
                          <td style={{ 
                            padding: tableCellPadding, 
                            textAlign: 'center', 
                            color: '#64748b',
                            fontSize: tableFontSize
                          }}>
                            {currencyFormatter.format(movement.unitCost)}
                          </td>
                          <td style={{ 
                            padding: tableCellPadding, 
                            textAlign: 'center', 
                            color: '#1e293b', 
                            fontWeight: 500,
                            fontSize: tableFontSize
                          }}>
                            {currencyFormatter.format(movement.totalCost)}
                          </td>
                          <td style={{ 
                            padding: tableCellPadding, 
                            textAlign: 'center', 
                            color: '#64748b',
                            fontSize: tableFontSize
                          }}>
                            {formatNumber(
                              balanceAfterMovementId[movement.id] ??
                              movement.currentQuantity ??
                              currentStockFromServer[movement.productId] ??
                              0
                            )}
                          </td>
                          <td style={{ 
                            padding: tableCellPadding, 
                            textAlign: 'center', 
                            color: '#64748b',
                            fontSize: tableFontSize
                          }}>
                            {movement.userName || 'N/A'}
                          </td>
                          <td style={{ 
                            padding: tableCellPadding, 
                            textAlign: 'center', 
                            color: '#64748b', 
                            maxWidth: isSmall ? '120px' : isMedium ? '150px' : isSmallDesktop ? '150px' : '200px',
                            fontSize: tableFontSize,
                            wordBreak: 'break-word'
                          }}>
                            {movement.reason || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Kardex;

