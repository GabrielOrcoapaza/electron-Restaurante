import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import {
  GET_CASH_REGISTERS,
  GET_PAYMENT_SUMMARY,
  GET_PAYMENT_METHODS_SUMMARY,
  GET_CASH_CLOSURE_PREVIEW,
  GET_CASH_CLOSURES
} from '../../graphql/queries';
import { CLOSE_CASH } from '../../graphql/mutations';

interface CashRegister {
  id: string;
  name: string;
  cashType: string;
  currentBalance: number;
  isActive: boolean;
}

interface PaymentSummary {
  totalPayments: number;
  totalIncome: number;
  totalExpenses: number;
  pendingPayments: number;
  paidPayments: number;
  cashBalance: number;
  digitalBalance: number;
  bankBalance: number;
}

interface PaymentMethodSummary {
  method: string;
  totalAmount: number;
  count: number;
  percentage: number;
}

interface UserSummary {
  userId: string;
  userName: string;
  userRole: string;
  totalIncome: number;
  totalExpense: number;
  netTotal: number;
  paymentsCount: number;
  operationsCount: number;
  dishesCount: number;
  hasOccupiedTables: boolean;
  occupiedTablesCount: number;
  occupiedTablesNames: string[];
  canClose: boolean;
  paymentMethods: PaymentMethodDetail[];
}

interface PaymentMethodDetail {
  methodCode: string;
  methodName: string;
  income: number;
  expense: number;
  net: number;
}

interface ClosureWarning {
  type: string;
  message: string;
}

interface CashClosurePreview {
  branchId: string;
  branchName: string;
  cashRegisterId: string;
  cashRegisterName: string;
  nextClosureNumber: number;
  totalPaymentsPending: number;
  totalIncome: number;
  totalExpense: number;
  netTotal: number;
  canClose: boolean;
  previewDate: string;
  usersSummary: UserSummary[];
  generalPaymentMethods: PaymentMethodDetail[];
  warnings: ClosureWarning[];
}

interface CashClosure {
  id: string;
  closureNumber: number;
  closedAt: string;
  totalIncome: number;
  totalExpense: number;
  netTotal: number;
  user: {
    id: string;
    fullName: string;
    role: string;
  };
  cashRegister: {
    id: string;
    name: string;
    cashType: string;
  };
  branch: {
    id: string;
    name: string;
  };
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const Cashs: React.FC = () => {
  const { companyData, user, deviceId, getMacAddress } = useAuth();
  const { breakpoint, isMobile, isTablet } = useResponsive();
  const branchId = companyData?.branch?.id;

  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px

  // Tamaños adaptativos
  const containerPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '2rem';
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : '1.5rem';
  const titleFontSize = isSmall ? '1.125rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.375rem' : isMediumDesktop ? '1.5rem' : '1.75rem';
  const subtitleFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : '0.875rem';
  const sectionTitleFontSize = isSmall ? '0.9375rem' : isMedium ? '1rem' : isSmallDesktop ? '1rem' : '1.125rem';
  const gridGap = isSmall ? '0.75rem' : isMedium ? '1rem' : isSmallDesktop ? '1rem' : '1.5rem';
  const statCardMinWidth = isSmall ? '160px' : isMedium ? '180px' : isSmallDesktop ? '180px' : isMediumDesktop ? '200px' : '220px';
  const cashCardMinWidth = isSmall ? '240px' : isMedium ? '260px' : isSmallDesktop ? '280px' : isMediumDesktop ? '300px' : '320px';
  const buttonPadding = isSmall ? '0.5rem 0.875rem' : isMedium ? '0.5rem 1rem' : isSmallDesktop ? '0.5rem 1rem' : '0.75rem 1.5rem';
  const buttonFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : '0.875rem';

  const [selectedCashRegister, setSelectedCashRegister] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Query para obtener cajas
  const { data: cashRegistersData, loading: cashRegistersLoading, refetch: refetchCashRegisters } = useQuery(
    GET_CASH_REGISTERS,
    {
      variables: { branchId: branchId! },
      skip: !branchId,
      fetchPolicy: 'network-only'
    }
  );

  // Query para obtener resumen de pagos
  const { data: paymentSummaryData, loading: paymentSummaryLoading, refetch: refetchPaymentSummary } = useQuery(
    GET_PAYMENT_SUMMARY,
    {
      variables: { branchId: branchId! },
      skip: !branchId,
      fetchPolicy: 'network-only'
    }
  );

  // Query para obtener resumen de métodos de pago
  const { data: paymentMethodsData } = useQuery(
    GET_PAYMENT_METHODS_SUMMARY,
    {
      variables: { branchId: branchId! },
      skip: !branchId,
      fetchPolicy: 'network-only'
    }
  );

  // Query para obtener preview de cierre
  const { data: previewData, loading: previewLoading } = useQuery(
    GET_CASH_CLOSURE_PREVIEW,
    {
      variables: {
        branchId: branchId!,
        cashRegisterId: selectedCashRegister,
        userId: selectedUserId
      },
      skip: !branchId || !selectedCashRegister || !showPreview,
      fetchPolicy: 'network-only'
    }
  );

  // Query para obtener historial de cierres
  const { data: closuresData, loading: closuresLoading, error: closuresError, refetch: refetchClosures } = useQuery(
    GET_CASH_CLOSURES,
    {
      variables: {
        branchId: branchId!,
        userId: null,
        startDate: null,
        endDate: null
      },
      skip: !branchId,
      fetchPolicy: 'network-only',
      onCompleted: (data) => {
        console.log('📜 Datos de cierres recibidos:', data);
        console.log('📜 Cierres:', data?.cashClosures);
      },
      onError: (error) => {
        console.error('❌ Error al cargar cierres:', error);
      }
    }
  );

  // Mutación para cerrar caja
  const [closeCashMutation, { loading: closingCash }] = useMutation(CLOSE_CASH, {
    onCompleted: (data) => {
      if (data?.closeCash?.success) {
        const summary = data.closeCash.summary;
        const closure = data.closeCash.closure;
        
        // Mostrar mensaje de éxito con información del cierre
        const message = data.closeCash.message || 'Caja cerrada exitosamente';
        
        // Construir mensaje detallado
        let detailMessage = message;
        if (closure) {
          detailMessage += `\n\n📊 Resumen del Cierre #${closure.closureNumber}:`;
          detailMessage += `\n• Total Ingresos: ${currencyFormatter.format(closure.totalIncome)}`;
          detailMessage += `\n• Total Egresos: ${currencyFormatter.format(closure.totalExpense)}`;
          detailMessage += `\n• Neto Total: ${currencyFormatter.format(closure.netTotal)}`;
        }
        
        alert(detailMessage);
        
        // Si hay summary, mostrar información adicional en consola
        if (summary) {
          try {
            const summaryData = typeof summary === 'string' ? JSON.parse(summary) : summary;
            console.log('📊 Resumen completo del cierre:', summaryData);
          } catch (e) {
            console.log('📊 Resumen del cierre:', summary);
          }
        }
        
        // Limpiar estado y refrescar datos
        setShowPreview(false);
        setSelectedCashRegister('');
        setSelectedUserId(null);
        
        // Refrescar todas las queries relacionadas
        refetchCashRegisters();
        refetchPaymentSummary();
        refetchClosures();
      } else {
        const errorMessage = data?.closeCash?.message || 'No se pudo cerrar la caja';
        alert(`❌ Error: ${errorMessage}`);
      }
    },
    onError: (error) => {
      console.error('❌ Error al cerrar la caja:', error);
      const errorMessage = error.message || 'Ocurrió un error al intentar cerrar la caja';
      alert(`❌ Error al cerrar la caja: ${errorMessage}`);
    }
  });

  const cashRegisters: CashRegister[] = cashRegistersData?.cashRegistersByBranch || [];
  const paymentSummary: PaymentSummary | null = paymentSummaryData?.paymentSummary || null;
  const paymentMethods: PaymentMethodSummary[] = paymentMethodsData?.paymentMethodsSummary || [];
  const preview: CashClosurePreview | null = previewData?.cashClosurePreview || null;
  // Intentar ambos nombres por si hay diferencia entre snake_case y camelCase
  const closures: CashClosure[] = closuresData?.cashClosures || closuresData?.cash_closures || [];

  // Debug: Log para verificar datos de cierres
  useEffect(() => {
    if (closuresData) {
      console.log('📜 closuresData completo:', closuresData);
      console.log('📜 cashClosures:', closuresData.cashClosures);
      console.log('📜 cash_closures:', closuresData.cash_closures);
      console.log('📜 closures array:', closures);
    }
    if (closuresError) {
      console.error('❌ Error en query de cierres:', closuresError);
    }
  }, [closuresData, closuresError, closures]);

  const getCashTypeLabel = (type: string) => {
    switch (type) {
      case 'CASH': return 'Efectivo';
      case 'DIGITAL': return 'Digital';
      case 'BANK': return 'Bancario';
      default: return type;
    }
  };

  const getCashTypeColor = (type: string) => {
    switch (type) {
      case 'CASH': return { bg: '#dcfce7', color: '#166534', border: '#86efac' };
      case 'DIGITAL': return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' };
      case 'BANK': return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
      default: return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return 'Efectivo';
      case 'YAPE': return 'Yape';
      case 'PLIN': return 'Plin';
      case 'CARD': return 'Tarjeta';
      case 'TRANSFER': return 'Transferencia';
      case 'OTROS': return 'Otros';
      default: return method;
    }
  };

  const handleShowPreview = (cashRegisterId: string) => {
    setSelectedCashRegister(cashRegisterId);
    setShowPreview(true);
    setShowHistory(false);
  };

  const handleCloseCashClick = () => {
    if (!selectedCashRegister || !branchId || !user?.id) {
      alert('❌ Por favor selecciona una caja y verifica que estés autenticado');
      return;
    }

    if (!preview?.canClose) {
      alert('❌ No se puede cerrar la caja. Revisa las advertencias.');
      return;
    }

    // Mostrar modal de confirmación
    setShowConfirmModal(true);
  };

  const handleConfirmCloseCash = async () => {
    setShowConfirmModal(false);
    
    if (!selectedCashRegister || !branchId || !user?.id) {
      return;
    }

    try {
      // Obtener deviceId o MAC address
      const resolvedDeviceId = deviceId || await getMacAddress();
      
      if (!resolvedDeviceId) {
        alert('❌ No se pudo obtener el ID del dispositivo. Por favor, intenta nuevamente.');
        return;
      }

      await closeCashMutation({
        variables: {
          userId: user.id,
          branchId: branchId,
          deviceId: resolvedDeviceId,
          cashRegisterId: selectedCashRegister
        }
      });
    } catch (error) {
      console.error('Error al cerrar caja:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Mostrar mensaje si es móvil o tablet
  if (isMobile || isTablet) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#dc2626',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📱</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>
          No disponible en dispositivos móviles
        </h2>
        <p style={{ fontSize: '1rem', color: '#64748b', maxWidth: '400px' }}>
          Esta funcionalidad está optimizada para pantallas de escritorio. Por favor, accede desde una computadora o tableta en modo horizontal.
        </p>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div style={{ padding: containerPadding, textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
      </div>
    );
  }

  return (
    <div style={{ padding: containerPadding, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: cardPadding,
        marginBottom: gridGap,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e2e8f0'
      }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: titleFontSize, fontWeight: 700, color: '#1e293b' }}>
          💰 Gestión de Cajas
        </h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setShowPreview(false);
              setShowHistory(false);
              setSelectedCashRegister('');
            }}
            style={{
              padding: buttonPadding,
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: showPreview || showHistory ? 'white' : '#3b82f6',
              color: showPreview || showHistory ? '#64748b' : 'white',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: buttonFontSize,
              transition: 'all 0.2s'
            }}
          >
            Cajas
          </button>
          <button
            onClick={() => {
              setShowHistory(true);
              setShowPreview(false);
            }}
            style={{
              padding: buttonPadding,
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: showHistory ? '#3b82f6' : 'white',
              color: showHistory ? 'white' : '#64748b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: buttonFontSize,
              transition: 'all 0.2s'
            }}
          >
            Historial de Cierres
          </button>
        </div>
      </div>

      {/* Vista de Cajas */}
      {!showPreview && !showHistory && (
        <>
          {/* Resumen de Pagos */}
          {paymentSummaryLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              Cargando resumen...
            </div>
          ) : paymentSummary && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: cardPadding,
              marginBottom: gridGap,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: sectionTitleFontSize, fontWeight: 600, color: '#334155' }}>
                📊 Resumen de Pagos
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(${statCardMinWidth}, 1fr))`,
                gap: gridGap
              }}>
                <div style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Ingresos</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
                    {currencyFormatter.format(paymentSummary.totalIncome)}
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Egresos</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                    {currencyFormatter.format(paymentSummary.totalExpenses)}
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Neto</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
                    {currencyFormatter.format(paymentSummary.totalIncome - paymentSummary.totalExpenses)}
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Pendientes</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706' }}>
                    {currencyFormatter.format(paymentSummary.pendingPayments)}
                  </div>
                </div>
              </div>

              {/* Balances por tipo de caja */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', fontWeight: 600, color: '#475569' }}>
                  Balances por Tipo de Caja
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${statCardMinWidth}, 1fr))`,
                  gap: gridGap
                }}>
                  <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: '#dcfce7',
                    border: '1px solid #86efac'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#166534', marginBottom: '0.5rem', fontWeight: 600 }}>
                      💵 Efectivo
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534' }}>
                      {currencyFormatter.format(paymentSummary.cashBalance)}
                    </div>
                  </div>
                  <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: '#dbeafe',
                    border: '1px solid #93c5fd'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.5rem', fontWeight: 600 }}>
                      📱 Digital
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e40af' }}>
                      {currencyFormatter.format(paymentSummary.digitalBalance)}
                    </div>
                  </div>
                  <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fde68a'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#92400e', marginBottom: '0.5rem', fontWeight: 600 }}>
                      🏦 Bancario
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#92400e' }}>
                      {currencyFormatter.format(paymentSummary.bankBalance)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resumen de Métodos de Pago */}
          {paymentMethods.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: cardPadding,
              marginBottom: gridGap,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: sectionTitleFontSize, fontWeight: 600, color: '#334155' }}>
                💳 Resumen por Método de Pago
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Método</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Monto</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Cantidad</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Porcentaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentMethods.map((method, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem', color: '#334155', fontWeight: 500 }}>
                          {getPaymentMethodLabel(method.method)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                          {currencyFormatter.format(method.totalAmount)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                          {method.count}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b' }}>
                          {method.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lista de Cajas */}
          {cashRegistersLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              Cargando cajas...
            </div>
          ) : (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: cardPadding,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: sectionTitleFontSize, fontWeight: 600, color: '#334155' }}>
                🏪 Cajas Registradoras ({cashRegisters.length})
              </h3>
              {cashRegisters.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: isSmall ? '1.5rem' : isMedium ? '2rem' : isSmallDesktop ? '2rem' : '3rem',
                  color: '#64748b'
                }}>
                  <p style={{ fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', margin: 0 }}>No hay cajas registradas</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${cashCardMinWidth}, 1fr))`,
                  gap: gridGap
                }}>
                  {cashRegisters.map((cashRegister) => {
                    const typeColors = getCashTypeColor(cashRegister.cashType);
                    return (
                      <div
                        key={cashRegister.id}
                        style={{
                          padding: cardPadding,
                          borderRadius: '12px',
                          border: `2px solid ${typeColors.border}`,
                          backgroundColor: typeColors.bg,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                        }}
                        onClick={() => handleShowPreview(cashRegister.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <h4 style={{ margin: '0 0 0.5rem', fontSize: isSmall ? '0.9375rem' : isMedium ? '1rem' : isSmallDesktop ? '1rem' : '1.125rem', fontWeight: 700, color: typeColors.color }}>
                              {cashRegister.name}
                            </h4>
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: 'white',
                              color: typeColors.color,
                              display: 'inline-block'
                            }}>
                              {getCashTypeLabel(cashRegister.cashType)}
                            </span>
                          </div>
                        </div>
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${typeColors.border}` }}>
                          <div style={{ fontSize: '0.875rem', color: typeColors.color, marginBottom: '0.5rem' }}>
                            Balance Actual
                          </div>
                          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: typeColors.color }}>
                            {currencyFormatter.format(cashRegister.currentBalance)}
                          </div>
                        </div>
                        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                          <button
                            style={{
                              padding: buttonPadding,
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: typeColors.color,
                              color: 'white',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: buttonFontSize,
                              width: '100%'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowPreview(cashRegister.id);
                            }}
                          >
                            Ver Detalles / Cerrar Caja
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Vista de Preview de Cierre */}
      {showPreview && selectedCashRegister && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: cardPadding,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: isSmall ? '1rem' : isMedium ? '1.125rem' : isSmallDesktop ? '1.125rem' : '1.25rem', fontWeight: 700, color: '#1e293b' }}>
              🔍 Preview de Cierre de Caja
            </h3>
            <button
              onClick={() => {
                setShowPreview(false);
                setSelectedCashRegister('');
                setSelectedUserId(null);
              }}
              style={{
                padding: buttonPadding,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                color: '#64748b',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: buttonFontSize
              }}
            >
              ← Volver
            </button>
          </div>

          {previewLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              Cargando preview...
            </div>
          ) : preview ? (
            <>
              {/* Información General */}
              <div style={{
                padding: cardPadding,
                borderRadius: '12px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                marginBottom: gridGap
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${statCardMinWidth}, 1fr))`, gap: gridGap }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Caja</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{preview.cashRegisterName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>N° Cierre</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>#{preview.nextClosureNumber}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Pagos Pendientes</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{preview.totalPaymentsPending}</div>
                  </div>
                </div>
              </div>

              {/* Advertencias */}
              {preview.warnings && preview.warnings.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  {preview.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '0.5rem',
                        backgroundColor:
                          warning.type === 'ERROR' ? '#fef2f2' :
                          warning.type === 'WARNING' ? '#fffbeb' :
                          '#f0f9ff',
                        border: `1px solid ${
                          warning.type === 'ERROR' ? '#fecaca' :
                          warning.type === 'WARNING' ? '#fde68a' :
                          '#bae6fd'
                        }`,
                        color:
                          warning.type === 'ERROR' ? '#991b1b' :
                          warning.type === 'WARNING' ? '#92400e' :
                          '#1e40af'
                      }}
                    >
                      <strong>{warning.type === 'ERROR' ? '❌' : warning.type === 'WARNING' ? '⚠️' : 'ℹ️'}</strong> {warning.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Totales Generales */}
              <div style={{
                padding: cardPadding,
                borderRadius: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: gridGap
              }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', fontWeight: 600, color: '#475569' }}>
                  Totales Generales
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${statCardMinWidth}, 1fr))`, gap: gridGap }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Ingresos</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
                      {currencyFormatter.format(preview.totalIncome)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Egresos</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                      {currencyFormatter.format(preview.totalExpense)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Neto Total</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: preview.netTotal >= 0 ? '#16a34a' : '#dc2626' }}>
                      {currencyFormatter.format(preview.netTotal)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Métodos de Pago Generales */}
              {preview.generalPaymentMethods && preview.generalPaymentMethods.length > 0 && (
                <div style={{ marginBottom: gridGap }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', fontWeight: 600, color: '#475569' }}>
                    Métodos de Pago - Totales Generales
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Método</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Ingresos</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Egresos</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.generalPaymentMethods.map((method, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem', color: '#334155', fontWeight: 500 }}>
                              {method.methodName}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#16a34a' }}>
                              {currencyFormatter.format(method.income)}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#dc2626' }}>
                              {currencyFormatter.format(method.expense)}
                            </td>
                            <td style={{
                              padding: '0.75rem',
                              textAlign: 'right',
                              fontWeight: 600,
                              color: method.net >= 0 ? '#16a34a' : '#dc2626'
                            }}>
                              {currencyFormatter.format(method.net)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resumen por Usuario */}
              {preview.usersSummary && preview.usersSummary.length > 0 && (
                <div style={{ marginBottom: gridGap }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', fontWeight: 600, color: '#475569' }}>
                    Resumen por Usuario
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: gridGap }}>
                    {preview.usersSummary.map((userSummary, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: cardPadding,
                          borderRadius: '12px',
                          border: `2px solid ${userSummary.canClose ? '#86efac' : '#fecaca'}`,
                          backgroundColor: userSummary.canClose ? '#f0fdf4' : '#fef2f2'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <h5 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                              {userSummary.userName}
                            </h5>
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: 'white',
                              color: '#64748b',
                              display: 'inline-block',
                              marginRight: '0.5rem'
                            }}>
                              {userSummary.userRole}
                            </span>
                            {userSummary.hasOccupiedTables && (
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                display: 'inline-block'
                              }}>
                                ⚠️ {userSummary.occupiedTablesCount} mesa(s) ocupada(s)
                              </span>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Neto</div>
                            <div style={{
                              fontSize: '1.25rem',
                              fontWeight: 700,
                              color: userSummary.netTotal >= 0 ? '#16a34a' : '#dc2626'
                            }}>
                              {currencyFormatter.format(userSummary.netTotal)}
                            </div>
                          </div>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '1rem',
                          marginBottom: '1rem'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Ingresos</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#16a34a' }}>
                              {currencyFormatter.format(userSummary.totalIncome)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Egresos</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#dc2626' }}>
                              {currencyFormatter.format(userSummary.totalExpense)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Pagos</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
                              {userSummary.paymentsCount}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Operaciones</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
                              {userSummary.operationsCount}
                            </div>
                          </div>
                        </div>

                        {/* Métodos de Pago del Usuario */}
                        {userSummary.paymentMethods && userSummary.paymentMethods.length > 0 && (
                          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                              Métodos de Pago:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {userSummary.paymentMethods.map((method, methodIdx) => (
                                <div
                                  key={methodIdx}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '6px',
                                    backgroundColor: 'white',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                                    {method.methodName}
                                  </div>
                                  <div style={{ color: method.net >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                    {currencyFormatter.format(method.net)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón de Cerrar Caja */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: gridGap, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setSelectedCashRegister('');
                    setSelectedUserId(null);
                  }}
                  style={{
                    padding: buttonPadding,
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: buttonFontSize
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCloseCashClick}
                  disabled={!preview.canClose || closingCash}
                  style={{
                    padding: buttonPadding,
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: preview.canClose ? '#16a34a' : '#94a3b8',
                    color: 'white',
                    cursor: preview.canClose && !closingCash ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: buttonFontSize,
                    opacity: preview.canClose && !closingCash ? 1 : 0.6
                  }}
                >
                  {closingCash ? 'Cerrando...' : '✅ Cerrar Caja'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              No se pudo cargar el preview de cierre
            </div>
          )}
        </div>
      )}

      {/* Vista de Historial de Cierres */}
      {showHistory && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: cardPadding,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: isSmall ? '1rem' : isMedium ? '1.125rem' : isSmallDesktop ? '1.125rem' : '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                📜 Historial de Cierres de Caja
              </h3>
              <p style={{ margin: 0, fontSize: subtitleFontSize, color: '#64748b' }}>
                {closures.length > 0 ? `${closures.length} cierre(s) registrado(s)` : 'No hay cierres registrados'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => refetchClosures()}
                style={{
                  padding: buttonPadding,
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: buttonFontSize,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                title="Actualizar historial"
              >
                🔄 Actualizar
              </button>
              <button
                onClick={() => {
                  setShowHistory(false);
                }}
                style={{
                  padding: buttonPadding,
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: buttonFontSize
                }}
              >
                ← Volver
              </button>
            </div>
          </div>

          {closuresLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
              <p style={{ fontSize: '1rem', margin: 0 }}>Cargando historial de cierres...</p>
            </div>
          ) : closures.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              <p style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', fontWeight: 600 }}>No hay cierres registrados</p>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>
                Los cierres de caja aparecerán aquí una vez que se realicen
              </p>
            </div>
          ) : (
            <>
              {/* Resumen del historial */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(${statCardMinWidth}, 1fr))`,
                gap: gridGap,
                marginBottom: gridGap,
                padding: cardPadding,
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Cierres</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#334155' }}>
                    {closures.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Ingresos</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
                    {currencyFormatter.format(closures.reduce((sum, c) => sum + c.totalIncome, 0))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Egresos</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                    {currencyFormatter.format(closures.reduce((sum, c) => sum + c.totalExpense, 0))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Neto Total</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#334155' }}>
                    {currencyFormatter.format(closures.reduce((sum, c) => sum + c.netTotal, 0))}
                  </div>
                </div>
              </div>

              {/* Tabla de cierres */}
              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ 
                      borderBottom: '2px solid #e2e8f0',
                      backgroundColor: '#f8fafc'
                    }}>
                      <th style={{ padding: '1rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>N° Cierre</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Caja</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Usuario</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Fecha y Hora</th>
                      <th style={{ padding: '1rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Ingresos</th>
                      <th style={{ padding: '1rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Egresos</th>
                      <th style={{ padding: '1rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closures.map((closure, index) => {
                      const cashTypeColors = getCashTypeColor(closure.cashRegister.cashType);
                      return (
                        <tr 
                          key={closure.id} 
                          style={{ 
                            borderBottom: index < closures.length - 1 ? '1px solid #f1f5f9' : 'none',
                            transition: 'background-color 0.2s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td style={{ padding: '1rem', color: '#334155', fontWeight: 700 }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '6px',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              fontSize: '0.75rem'
                            }}>
                              #{closure.closureNumber}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: '#334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: cashTypeColors.bg,
                                color: cashTypeColors.color
                              }}>
                                {getCashTypeLabel(closure.cashRegister.cashType)}
                              </span>
                              <span style={{ fontWeight: 500 }}>{closure.cashRegister.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem', color: '#334155' }}>
                            <div>
                              <div style={{ fontWeight: 500 }}>{closure.user.fullName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                {closure.user.role}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '1rem', color: '#64748b' }}>
                            <div>
                              <div>{formatDate(closure.closedAt)}</div>
                            </div>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                            {currencyFormatter.format(closure.totalIncome)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                            {currencyFormatter.format(closure.totalExpense)}
                          </td>
                          <td style={{
                            padding: '1rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            fontSize: '1rem',
                            color: closure.netTotal >= 0 ? '#16a34a' : '#dc2626'
                          }}>
                            {currencyFormatter.format(closure.netTotal)}
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
      )}

      {/* Modal de Confirmación para Cerrar Caja */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: cardPadding,
              maxWidth: isSmall ? '400px' : isMedium ? '450px' : isSmallDesktop ? '450px' : '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: isSmall ? '2rem' : isMedium ? '2.5rem' : isSmallDesktop ? '2.5rem' : '3rem',
                textAlign: 'center',
                marginBottom: '1rem'
              }}>
                ⚠️
              </div>
              <h3 style={{
                margin: '0 0 0.5rem',
                fontSize: isSmall ? '1.125rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : '1.5rem',
                fontWeight: 700,
                color: '#1e293b',
                textAlign: 'center'
              }}>
                Confirmar Cierre de Caja
              </h3>
              <p style={{
                margin: 0,
                fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem',
                color: '#64748b',
                textAlign: 'center',
                lineHeight: '1.5'
              }}>
                ¿Estás seguro de que deseas cerrar esta caja? Esta acción agrupará todos los pagos pendientes en un cierre.
              </p>
            </div>

            {preview && (
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: cardPadding,
                marginBottom: '1.5rem',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Resumen del cierre:
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  fontSize: '0.875rem'
                }}>
                  <div>
                    <div style={{ color: '#64748b' }}>Ingresos:</div>
                    <div style={{ fontWeight: 600, color: '#16a34a' }}>
                      {currencyFormatter.format(preview.totalIncome)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>Egresos:</div>
                    <div style={{ fontWeight: 600, color: '#dc2626' }}>
                      {currencyFormatter.format(preview.totalExpense)}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b' }}>Neto Total:</div>
                    <div style={{ fontWeight: 700, fontSize: '1.125rem', color: preview.netTotal >= 0 ? '#16a34a' : '#dc2626' }}>
                      {currencyFormatter.format(preview.netTotal)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: buttonPadding,
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: buttonFontSize,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCloseCash}
                disabled={closingCash}
                style={{
                  padding: buttonPadding,
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: closingCash ? '#94a3b8' : '#16a34a',
                  color: 'white',
                  cursor: closingCash ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: buttonFontSize,
                  transition: 'all 0.2s',
                  opacity: closingCash ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!closingCash) {
                    e.currentTarget.style.backgroundColor = '#15803d';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!closingCash) {
                    e.currentTarget.style.backgroundColor = '#16a34a';
                  }
                }}
              >
                {closingCash ? 'Cerrando...' : '✅ Confirmar y Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cashs;