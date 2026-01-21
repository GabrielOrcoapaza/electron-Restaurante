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

  // Adaptar según tamaño de pantalla de PC
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  
  // Tamaños adaptativos
  const containerPadding = isSmallDesktop ? '1.25rem' : '1.5rem';
  const containerGap = isSmallDesktop ? '1.5rem' : '2rem';
  const titleFontSize = isSmallDesktop ? '1.375rem' : '1.5rem';
  const subtitleFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const cardPadding = isSmallDesktop ? '1.25rem' : '1.5rem';
  const inputFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const buttonFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';

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
  const [showDetails, setShowDetails] = useState(false);

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
          marginBottom: containerGap
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
            <p style={{ 
              fontSize: subtitleFontSize, 
              color: '#64748b', 
              margin: 0 
            }}>
              Documentos emitidos y totales por método de pago
            </p>
          </div>
        </div>

        {/* Filtros */}
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
            gridTemplateColumns: isSmallDesktop ? '1fr 1fr 1fr auto' : '1fr 1fr 1fr auto',
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
                padding: '0.625rem 1.5rem',
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

        {/* Resumen */}
        {summary && showDetails && (
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: cardPadding,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              marginBottom: containerGap
            }}
          >
            <h2 style={{
              fontSize: isSmallDesktop ? '1.125rem' : '1.25rem',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '1.5rem'
            }}>
              Resumen General
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isSmallDesktop ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '10px',
                padding: '1rem',
                color: 'white'
              }}>
                <div style={{ fontSize: subtitleFontSize, opacity: 0.9, marginBottom: '0.5rem' }}>
                  Total Documentos
                </div>
                <div style={{ fontSize: isSmallDesktop ? '1.5rem' : '1.75rem', fontWeight: 700 }}>
                  {summary.totalDocuments}
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                borderRadius: '10px',
                padding: '1rem',
                color: 'white'
              }}>
                <div style={{ fontSize: subtitleFontSize, opacity: 0.9, marginBottom: '0.5rem' }}>
                  Total General
                </div>
                <div style={{ fontSize: isSmallDesktop ? '1.5rem' : '1.75rem', fontWeight: 700 }}>
                  {currencyFormatter.format(summary.totalAmount)}
                </div>
              </div>
            </div>

            <h3 style={{
              fontSize: isSmallDesktop ? '1rem' : '1.125rem',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '1rem',
              marginTop: '1rem'
            }}>
              Totales por Método de Pago
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isSmallDesktop ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: '1rem'
            }}>
              <div style={{
                background: '#f0f9ff',
                border: '2px solid #0ea5e9',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{ fontSize: subtitleFontSize, color: '#0c4a6e', marginBottom: '0.5rem' }}>
                  Efectivo
                </div>
                <div style={{ fontSize: isSmallDesktop ? '1.25rem' : '1.5rem', fontWeight: 700, color: '#0369a1' }}>
                  {currencyFormatter.format(summary.totalCash)}
                </div>
              </div>

              <div style={{
                background: '#f0fdf4',
                border: '2px solid #10b981',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{ fontSize: subtitleFontSize, color: '#064e3b', marginBottom: '0.5rem' }}>
                  Yape
                </div>
                <div style={{ fontSize: isSmallDesktop ? '1.25rem' : '1.5rem', fontWeight: 700, color: '#047857' }}>
                  {currencyFormatter.format(summary.totalYape)}
                </div>
              </div>

              <div style={{
                background: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{ fontSize: subtitleFontSize, color: '#78350f', marginBottom: '0.5rem' }}>
                  Plin
                </div>
                <div style={{ fontSize: isSmallDesktop ? '1.25rem' : '1.5rem', fontWeight: 700, color: '#b45309' }}>
                  {currencyFormatter.format(summary.totalPlin)}
                </div>
              </div>

              <div style={{
                background: '#fef2f2',
                border: '2px solid #ef4444',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{ fontSize: subtitleFontSize, color: '#7f1d1d', marginBottom: '0.5rem' }}>
                  Tarjeta
                </div>
                <div style={{ fontSize: isSmallDesktop ? '1.25rem' : '1.5rem', fontWeight: 700, color: '#b91c1c' }}>
                  {currencyFormatter.format(summary.totalCard)}
                </div>
              </div>

              <div style={{
                background: '#f3e8ff',
                border: '2px solid #a855f7',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{ fontSize: subtitleFontSize, color: '#581c87', marginBottom: '0.5rem' }}>
                  Transferencia
                </div>
                <div style={{ fontSize: isSmallDesktop ? '1.25rem' : '1.5rem', fontWeight: 700, color: '#7e22ce' }}>
                  {currencyFormatter.format(summary.totalTransfer)}
                </div>
              </div>

              <div style={{
                background: '#f1f5f9',
                border: '2px solid #64748b',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{ fontSize: subtitleFontSize, color: '#1e293b', marginBottom: '0.5rem' }}>
                  Otros
                </div>
                <div style={{ fontSize: isSmallDesktop ? '1.25rem' : '1.5rem', fontWeight: 700, color: '#334155' }}>
                  {currencyFormatter.format(summary.totalOthers)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de documentos */}
        {showDetails && (
          <ReportSaleList 
            documents={salesDocuments} 
            loading={loading}
            error={error}
            isSmallDesktop={isSmallDesktop}
          />
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: cardPadding,
            color: '#991b1b'
          }}>
            Error al cargar el reporte: {error.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportSale;