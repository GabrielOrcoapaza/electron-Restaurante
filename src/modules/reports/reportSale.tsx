import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { GET_SALES_REPORT, GET_DOCUMENTS } from '../../graphql/queries';
import ReportSaleList from './reportSaleList';

interface SalesReportSummary {
  totalDocuments: number;
  totalAmount: number;
  totalCash: number;
  totalYape: number;
  totalPlin: number;
  totalCard: number;
  totalTransfer: number;
  totalOthers: number;
}

interface IssuedDocument {
  id: string;
  serial: string;
  number: string;
  emissionDate: string;
  emissionTime: string;
  totalAmount: number;
  totalDiscount: number;
  igvAmount: number;
  billingStatus: string;
  notes?: string;
  document: {
    id: string;
    code: string;
    description: string;
  };
  person?: {
    id: string;
    name: string;
    documentNumber: string;
    documentType: string;
  };
  operation?: {
    id: string;
    order: string;
    status: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    total: number;
    notes?: string;
    operationDetail?: {
      product: {
        id: string;
        code: string;
        name: string;
      };
    };
  }>;
  payments: Array<{
    id: string;
    paymentMethod: string;
    paidAmount: number;
    paymentDate: string;
    status: string;
  }>;
  user: {
    id: string;
    fullName: string;
  };
  branch: {
    id: string;
    name: string;
  };
}

interface SalesReportData {
  documents: IssuedDocument[];
  summary: SalesReportSummary;
}

interface Document {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const ReportSale: React.FC = () => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;

  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl)
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
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [showDetails, setShowDetails] = useState(true);

  // Obtener documentos para el selector
  const { data: documentsData } = useQuery(GET_DOCUMENTS, {
    variables: { branchId: branchId! },
    skip: !branchId
  });

  const documents: Document[] = documentsData?.documentsByBranch || [];

  // Query para obtener reporte de ventas
  const { data, loading, error, refetch } = useQuery(GET_SALES_REPORT, {
    variables: {
      branchId: branchId!,
      startDate: startDate,
      endDate: endDate,
      documentId: selectedDocumentId || null
    },
    skip: !branchId || !startDate || !endDate,
    fetchPolicy: 'network-only'
  });

  const reportData: SalesReportData | null = data?.salesReport || null;
  const summary: SalesReportSummary | null = reportData?.summary || null;
  const salesDocuments: IssuedDocument[] = reportData?.documents || [];

  // Función para manejar búsqueda
  const handleSearch = () => {
    refetch();
    setShowDetails(true);
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
        overflowX: 'hidden', // Allow vertical scroll, hide horizontal decorations
      }}
    >
      {/* Elementos decorativos de fondo */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: isSmall ? '180px' : isMedium ? '220px' : isSmallDesktop ? '220px' : '260px',
          height: isSmall ? '180px' : isMedium ? '220px' : isSmallDesktop ? '220px' : '260px',
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
          width: isSmall ? '140px' : isMedium ? '180px' : isSmallDesktop ? '180px' : '220px',
          height: isSmall ? '140px' : isMedium ? '180px' : isSmallDesktop ? '180px' : '220px',
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
          alignItems: isSmall ? 'flex-start' : 'center',
          flexDirection: isSmall ? 'column' : 'row',
          marginBottom: containerGap,
          flexWrap: isSmall || isMedium ? 'wrap' : 'nowrap',
          gap: isSmall || isMedium ? '1rem' : '0'
        }}>
          <div>
            <h1 style={{
              fontSize: titleFontSize,
              fontWeight: 700,
              color: '#1e293b',
              margin: 0,
              marginBottom: '0.5rem'
            }}>
              Reporte de Ventas
            </h1>
            <p style={{ fontSize: subtitleFontSize, color: '#64748b', margin: 0 }}>
              Documentos emitidos y totales por método de pago
            </p>
          </div>
        </div>

        {/* Grid Principal: Filtros (Izq) y Resumen (Der) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isSmall || isMedium ? '1fr' : '1fr 2fr',
          gap: containerGap,
          marginBottom: containerGap,
          alignItems: 'stretch'
        }}>

          {/* CARD 1: Filtros (Izquierda) */}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: cardPadding,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
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
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                  Tipo de Documento
                </label>
                <select
                  value={selectedDocumentId}
                  onChange={(e) => setSelectedDocumentId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    fontSize: inputFontSize,
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    background: 'white',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                >
                  <option value="">Todos los documentos</option>
                  {documents
                    .filter(doc => doc.isActive)
                    .map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.code} - {doc.description}
                      </option>
                    ))}
                </select>
              </div>

              <button
                onClick={handleSearch}
                disabled={loading || !startDate || !endDate}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: buttonFontSize,
                  fontWeight: 600,
                  color: 'white',
                  background: loading || !startDate || !endDate
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading || !startDate || !endDate ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: loading || !startDate || !endDate
                    ? 'none'
                    : '0 4px 6px -1px rgba(102, 126, 234, 0.3)',
                  marginTop: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  if (!loading && startDate && endDate) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px -1px rgba(102, 126, 234, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && startDate && endDate) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(102, 126, 234, 0.3)';
                  }
                }}
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>

          {/* CARD 2: Resumen Completo (Derecha) */}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: cardPadding,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: '300px'
            }}
          >
            {summary && showDetails ? (
              <>
                <h2 style={{
                  fontSize: isSmallDesktop ? '0.9375rem' : '1rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  marginBottom: '0.75rem',
                  marginTop: 0
                }}>
                  Resumen General
                </h2>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isSmall
                    ? '1fr'
                    : isMedium
                      ? '1fr 1fr'
                      : 'repeat(2, 1fr)',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '8px',
                    padding: '1rem',
                    color: 'white',
                    boxShadow: '0 4px 6px -1px rgba(102, 126, 234, 0.2)'
                  }}>
                    <div style={{ fontSize: isSmall ? '0.75rem' : '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>
                      Total Documentos
                    </div>
                    <div style={{ fontSize: isSmall ? '1.25rem' : '1.5rem', fontWeight: 700 }}>
                      {summary.totalDocuments}
                    </div>
                  </div>

                  <div style={{
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    borderRadius: '8px',
                    padding: '1rem',
                    color: 'white',
                    boxShadow: '0 4px 6px -1px rgba(245, 87, 108, 0.2)'
                  }}>
                    <div style={{ fontSize: isSmall ? '0.75rem' : '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>
                      Total General
                    </div>
                    <div style={{ fontSize: isSmall ? '1.25rem' : '1.5rem', fontWeight: 700 }}>
                      {currencyFormatter.format(summary.totalAmount)}
                    </div>
                  </div>
                </div>

                <h2 style={{
                  fontSize: isSmallDesktop ? '0.9375rem' : '1rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  marginBottom: '0.75rem',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '1rem'
                }}>
                  Totales por Método de Pago
                </h2>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: '0.75rem'
                }}>
                  {[
                    { label: 'Efectivo', amount: summary.totalCash, color: '#0369a1', bg: '#f0f9ff', border: '#0ea5e9' },
                    { label: 'Yape', amount: summary.totalYape, color: '#047857', bg: '#f0fdf4', border: '#10b981' },
                    { label: 'Plin', amount: summary.totalPlin, color: '#b45309', bg: '#fef3c7', border: '#f59e0b' },
                    { label: 'Tarjeta', amount: summary.totalCard, color: '#b91c1c', bg: '#fef2f2', border: '#ef4444' },
                    { label: 'Transf.', amount: summary.totalTransfer, color: '#7e22ce', bg: '#f3e8ff', border: '#a855f7' },
                    { label: 'Otros', amount: summary.totalOthers, color: '#334155', bg: '#f1f5f9', border: '#64748b' },
                  ].map((item, index) => (
                    <div key={index} style={{
                      background: item.bg,
                      border: `1px solid ${item.border}`,
                      borderRadius: '8px',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: item.color, opacity: 0.8, marginBottom: '0.25rem' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: item.color }}>
                        {currencyFormatter.format(item.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontStyle: 'italic',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ fontSize: '3rem' }}>📊</div>
                <div>Realiza una búsqueda para ver el resumen</div>
              </div>
            )}
          </div>
        </div>

        {/* Lista de documentos: en su propio card con scroll */}
        {showDetails && loading && (
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: cardPadding,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
              color: '#64748b',
              fontSize: subtitleFontSize
            }}
          >
            Cargando documentos...
          </div>
        )}

        {showDetails && !loading && (
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: cardPadding,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: '400px',
              maxHeight: '900px',
              overflow: 'hidden'
            }}
          >
            <h2 style={{
              fontSize: isSmallDesktop ? '0.9375rem' : '1rem',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '1rem',
              marginTop: 0,
              flexShrink: 0
            }}>
              Lista de documentos
            </h2>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
              <ReportSaleList
                documents={salesDocuments}
                loading={false}
                error={error}
                isSmallDesktop={isSmallDesktop}
                isSmall={isSmall}
                isMedium={isMedium}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: cardPadding,
            color: '#991b1b',
            marginTop: containerGap
          }}>
            Error al cargar el reporte: {error.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportSale;