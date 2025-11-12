import React from 'react';
import { gql, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import type { Table } from '../../types/table';

const GET_OPERATION_BY_TABLE = gql`
  query GetOperationByTableForCash($tableId: ID!, $branchId: ID!) {
    operationByTable(tableId: $tableId, branchId: $branchId) {
      id
      order
      status
      total
      subtotal
      igvAmount
      igvPercentage
      operationDate
      details {
        id
        productId
        productCode
        productName
        productDescription
        quantity
        unitPrice
        total
        notes
      }
    }
  }
`;

type CashPayProps = {
  table: Table | null;
  onBack: () => void;
};

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const CashPay: React.FC<CashPayProps> = ({ table, onBack }) => {
  const { companyData } = useAuth();
  const hasSelection = Boolean(table?.id && companyData?.branch.id);

  const {
    data,
    loading,
    error,
    refetch
  } = useQuery(GET_OPERATION_BY_TABLE, {
    variables: {
      tableId: table?.id || '',
      branchId: companyData?.branch.id || ''
    },
    skip: !hasSelection,
    fetchPolicy: 'network-only'
  });

  const operation = data?.operationByTable;

  if (!table) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
            textAlign: 'center',
            maxWidth: '400px'
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💳</div>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#1a202c',
              marginBottom: '0.75rem'
            }}
          >
            Selecciona una mesa
          </h2>
          <p
            style={{
              fontSize: '0.95rem',
              color: '#4a5568',
              marginBottom: '1.5rem'
            }}
          >
            Elige una mesa desde la vista de mesas para revisar y cobrar su
            orden.
          </p>
          <button
            onClick={onBack}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#667eea',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Ir a mesas
          </button>
        </div>
      </div>
    );
  }

  const subtotal = Number(operation?.subtotal) || 0;
  const igvAmount = Number(operation?.igvAmount) || 0;
  const total = Number(operation?.total) || 0;

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
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '260px',
          height: '260px',
          background: 'radial-gradient(circle at center, rgba(102,126,234,0.25), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0
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
          zIndex: 0
        }}
      />

      <div
        style={{
          background: 'linear-gradient(135deg, rgba(102,126,234,0.95), rgba(118,75,162,0.92))',
          borderRadius: '20px',
          padding: '2rem 2.5rem',
          color: 'white',
          boxShadow: '0 20px 35px rgba(102,126,234,0.3)',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(120deg, rgba(255,255,255,0.09), rgba(255,255,255,0))',
            pointerEvents: 'none'
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.25rem',
            flexWrap: 'wrap',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.85)',
                padding: '0.35rem 0.9rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 600
              }}
            >
              💳 Caja Activa
            </span>
            <h2
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                margin: 0,
                textShadow: '0 6px 18px rgba(0,0,0,0.20)'
              }}
            >
              {table.name}
            </h2>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                fontSize: '0.95rem',
                color: 'rgba(255,255,255,0.85)'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                🪑 <strong>{table.capacity} plazas</strong>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                🕒 {operation?.operationDate ? new Date(operation.operationDate).toLocaleString() : 'Sin horario'}
              </span>
            </div>
            {operation?.order && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#fefcbf'
                }}
              >
                🔖 Orden #{operation.order}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(6px)',
                fontWeight: 600,
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              Estado:
              <span
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  color: 'white',
                  fontWeight: 700
                }}
              >
                {table.status}
              </span>
            </span>
            <button
              onClick={refetch}
              disabled={!hasSelection || loading}
              style={{
                padding: '0.85rem 1.45rem',
                borderRadius: '999px',
                border: 'none',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))',
                color: '#4c51bf',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '0.92rem',
                boxShadow: '0 12px 24px rgba(15,23,42,0.18)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                opacity: loading ? 0.7 : 1
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 16px 28px rgba(15,23,42,0.22)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(15,23,42,0.18)';
              }}
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
            <button
              onClick={onBack}
              style={{
                padding: '0.85rem 1.45rem',
                borderRadius: '999px',
                border: 'none',
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.92rem',
                boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 16px 28px rgba(0,0,0,0.18)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
              }}
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: '20px',
          padding: '2rem',
          border: '1px solid rgba(226,232,240,0.8)',
          boxShadow: '0 24px 40px -12px rgba(15,23,42,0.15)',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.15rem',
              fontWeight: 600,
              color: '#1a202c'
            }}
          >
            Detalle de la orden
          </h3>
          {operation?.status && (
            <span
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(102,126,234,0.12)',
                border: '1px solid rgba(102,126,234,0.35)',
                color: '#434190',
                fontSize: '0.88rem',
                fontWeight: 600,
                boxShadow: '0 10px 18px rgba(102,126,234,0.15)'
              }}
            >
              Estado de orden: {operation.status}
            </span>
          )}
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#fed7d7',
              border: '1px solid #feb2b2',
              color: '#742a2a',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.95rem'
            }}
          >
            Error al cargar la orden: {error.message}
          </div>
        )}

        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#4a5568'
            }}
          >
            Cargando orden...
          </div>
        )}

        {!loading && !error && !operation && (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#4a5568'
            }}
          >
            No se encontró una orden activa para esta mesa.
          </div>
        )}

        {operation && (
          <>
            <div
              style={{
                border: '1px solid rgba(226,232,240,0.9)',
                borderRadius: '18px',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95))',
                boxShadow: '0 18px 28px -14px rgba(15,23,42,0.22)'
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 0.4fr 0.6fr 0.6fr',
                  background: 'linear-gradient(135deg, rgba(102,126,234,0.12), rgba(129,140,248,0.12))',
                  padding: '0.9rem 1.2rem',
                  fontWeight: 700,
                  color: '#2d3748',
                  fontSize: '0.92rem',
                  letterSpacing: '0.01em'
                }}
              >
                <span>Producto</span>
                <span style={{ textAlign: 'center' }}>Cant.</span>
                <span style={{ textAlign: 'right' }}>P. Unit.</span>
                <span style={{ textAlign: 'right' }}>Total</span>
              </div>

              {(operation.details || []).map((detail: any, index: number) => {
                const quantity = Number(detail.quantity) || 0;
                const unitPrice = Number(detail.unitPrice) || 0;
                const lineTotal =
                  Number(detail.total) || unitPrice * quantity || 0;

                const isEvenRow = index % 2 === 0;

                return (
                  <div
                    key={detail.id || `${detail.productId}-${detail.productCode}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 0.4fr 0.6fr 0.6fr',
                      padding: '1rem 1.2rem',
                      fontSize: '0.9rem',
                      alignItems: 'center',
                      color: '#1a202c',
                      backgroundColor: isEvenRow ? 'rgba(247,250,252,0.85)' : 'rgba(255,255,255,0.92)',
                      borderTop: '1px solid rgba(226,232,240,0.7)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        {detail.productName || 'Producto'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                        {detail.productCode && (
                          <span
                            style={{
                              backgroundColor: 'rgba(237,242,247,0.9)',
                              color: '#4a5568',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '999px',
                              fontWeight: 600
                            }}
                          >
                            Código {detail.productCode}
                          </span>
                        )}
                        {detail.notes && (
                          <span
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.85)',
                              border: '1px dashed rgba(102,126,234,0.5)',
                              color: '#434190',
                              padding: '0.3rem 0.55rem',
                              borderRadius: '10px'
                            }}
                          >
                            Nota: {detail.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      style={{
                        textAlign: 'center',
                        fontWeight: 700,
                        color: '#4c51bf',
                        fontSize: '1.05rem'
                      }}
                    >
                      {quantity}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        color: '#2d3748'
                      }}
                    >
                      {currencyFormatter.format(unitPrice)}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: '1.05rem',
                        color: '#1a202c'
                      }}
                    >
                      {currencyFormatter.format(lineTotal)}
                    </span>
                  </div>
                );
              })}

              {operation.details?.length === 0 && (
                <div
                  style={{
                    padding: '1.75rem',
                    textAlign: 'center',
                    color: '#4a5568'
                  }}
                >
                  No hay ítems registrados en esta orden.
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: '2rem',
                display: 'flex',
                justifyContent: 'flex-end',
                position: 'relative'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  right: '18%',
                  top: '-40px',
                  width: '160px',
                  height: '160px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at center, rgba(72,219,251,0.18), transparent 70%)',
                  filter: 'blur(8px)',
                  zIndex: 0
                }}
              />
              <div
                style={{
                  minWidth: '320px',
                  borderRadius: '18px',
                  padding: '1.75rem',
                  background: 'linear-gradient(145deg, rgba(102,126,234,0.16), rgba(79,209,197,0.16))',
                  border: '1px solid rgba(102,126,234,0.28)',
                  boxShadow: '0 22px 35px -15px rgba(79,209,197,0.35)',
                  backdropFilter: 'blur(14px)',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    color: '#2d3748',
                    fontSize: '0.92rem',
                    letterSpacing: '0.01em'
                  }}
                >
                  <span>Subtotal</span>
                  <span>{currencyFormatter.format(subtotal)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    color: '#2d3748',
                    fontSize: '0.92rem',
                    letterSpacing: '0.01em'
                  }}
                >
                  <span>
                    IGV ({operation.igvPercentage ? `${operation.igvPercentage}%` : '—'})
                  </span>
                  <span>{currencyFormatter.format(igvAmount)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#1a202c',
                    fontWeight: 700,
                    fontSize: '1.35rem',
                    marginTop: '1rem',
                    alignItems: 'center'
                  }}
                >
                  <span>Total</span>
                  <span>{currencyFormatter.format(total)}</span>
                </div>
                <button
                  style={{
                    width: '100%',
                    marginTop: '1.35rem',
                    padding: '0.95rem 1.25rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(130deg, #4fd1c5, #63b3ed)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    boxShadow: '0 16px 28px -12px rgba(79,209,197,0.55)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 20px 32px -10px rgba(79,209,197,0.6)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 16px 28px -12px rgba(79,209,197,0.55)';
                  }}
                >
                  Procesar pago
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CashPay;

