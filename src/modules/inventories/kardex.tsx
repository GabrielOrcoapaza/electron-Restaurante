import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_STOCK_MOVEMENTS_REPORT, GET_PRODUCTS_WITH_STOCK } from '../../graphql/queries';

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

interface Product {
  id: string;
  code: string;
  name: string;
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
  const branchId = companyData?.branch?.id;

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

  // Obtener productos para el selector
  const { data: productsData } = useQuery(GET_PRODUCTS_WITH_STOCK, {
    variables: { branchId: branchId! },
    skip: !branchId
  });

  const products: Product[] = productsData?.productsByBranch || [];

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
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
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
        gap: '2rem',
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)',
        padding: '1.5rem',
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
          width: '260px',
          height: '260px',
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
          width: '220px',
          height: '220px',
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
          marginBottom: '2rem'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              fontWeight: 700, 
              color: '#1e293b' 
            }}>
              📋 Kardex
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              Registro de movimientos de inventario
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'end'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
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
                  padding: '0.625rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
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
                  padding: '0.625rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151'
              }}>
                Producto (Opcional)
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                  backgroundColor: 'white'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              >
                <option value="">Todos los productos</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} - {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <button
                onClick={() => refetch()}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  backgroundColor: loading ? '#9ca3af' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
          padding: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          overflowX: 'auto'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <p>Cargando movimientos...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#dc2626' }}>
              <p>Error al cargar los movimientos: {error.message}</p>
            </div>
          ) : movements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <p>No se encontraron movimientos en el rango de fechas seleccionado.</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                  Total de movimientos: <strong>{movements.length}</strong>
                </p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem'
                }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#f8fafc',
                      borderBottom: '2px solid #e2e8f0'
                    }}>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Fecha</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Producto</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Tipo</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Cantidad</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Costo Unit.</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Costo Total</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Stock Actual</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Usuario</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Motivo</th>
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
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                            {dateFormatter.format(new Date(movement.createdAt))}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ display: 'inline-block', textAlign: 'left' }}>
                              <div style={{ fontWeight: 500, color: '#1e293b' }}>{movement.productName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{movement.productCode}</div>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.625rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              backgroundColor: typeColor.bg,
                              color: typeColor.text,
                              border: `1px solid ${typeColor.border}`
                            }}>
                              {movement.movementTypeDisplay}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#1e293b', fontWeight: 500 }}>
                            {formatNumber(movement.quantity)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                            {currencyFormatter.format(movement.unitCost)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#1e293b', fontWeight: 500 }}>
                            {currencyFormatter.format(movement.totalCost)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                            {formatNumber(movement.currentQuantity)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                            {movement.userName || 'N/A'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', maxWidth: '200px' }}>
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

