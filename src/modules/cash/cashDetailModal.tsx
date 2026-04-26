import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_PAYMENTS_BY_CLOSURE } from '../../graphql/queries';
import { useResponsive } from '../../hooks/useResponsive';

export interface CashClosureForDetail {
  id: string;
  closureNumber: number;
  closedAt: string;
  totalIncome: number;
  totalExpense: number;
  netTotal: number;
  user: { id: string; fullName: string; role: string };
  cashRegister: { id: string; name: string; cashType: string };
  branch: { id: string; name: string };
}

interface PaymentMovement {
  id: string;
  paymentDate?: string;
  payment_date?: string;
  paidAmount?: number;
  paid_amount?: number;
  transactionType?: string;
  transaction_type?: string;
  paymentMethod?: string;
  payment_method?: string;
  status?: string;
  notes?: string;
  user?: { fullName?: string; full_name?: string };
  operation?: { order?: string };
  issuedDocument?: { serial?: string; number?: string };
  issued_document?: { serial?: string; number?: string };
}

interface CashDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  closure: CashClosureForDetail | null;
  onReprint?: (closure: CashClosureForDetail) => void;
  reprintingClosureId?: string | null;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    CASH: 'Efectivo',
    YAPE: 'Yape',
    PLIN: 'Plin',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    OTROS: 'Otros'
  };
  return labels[method] || method;
};

const getTransactionTypeLabel = (type: string) => {
  return type === 'INCOME' ? 'Ingreso' : type === 'EXPENSE' ? 'Egreso' : type;
};

const getCashTypeLabel = (type: string) => {
  switch (type) {
    case 'CASH': return 'Efectivo';
    case 'DIGITAL': return 'Digital';
    case 'BANK': return 'Bancario';
    default: return type;
  }
};

const CashDetailModal: React.FC<CashDetailModalProps> = ({
  isOpen,
  onClose,
  closure,
  onReprint,
  reprintingClosureId
}) => {
  const { breakpoint, isMobile } = useResponsive();
  const isSmall = breakpoint === 'sm' || isMobile;
  const isMedium = breakpoint === 'md';
  const isSmallDesktop = breakpoint === 'lg';

  // Responsive: pantalla completa en todos los tamaños; valores de padding/fuentes adaptados para sm, md, lg y xl
  const headerPadding = isSmall ? '0.75rem 1rem' : isMedium ? '1rem 1.5rem' : isSmallDesktop ? '1.25rem 2rem' : '1.5rem 2.5rem';
  const titleFontSize = isSmall ? '1.1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.35rem' : '1.5rem';
  const contentPadding = isSmall ? '1rem' : isMedium ? '1.5rem' : isSmallDesktop ? '2rem' : '2.5rem';
  const btnPadding = isSmall ? '0.4rem 0.8rem' : isMedium ? '0.5rem 1rem' : '0.6rem 1.25rem';
  const btnFontSize = isSmall ? '0.8rem' : isMedium ? '0.85rem' : '0.9rem';

  const { data, loading } = useQuery(GET_PAYMENTS_BY_CLOSURE, {
    variables: { cashClosureId: closure?.id ?? '' },
    skip: !isOpen || !closure?.id,
    fetchPolicy: 'network-only'
  });

  const payments: PaymentMovement[] =
    data?.paymentsByClosure ?? data?.payments_by_closure ?? [];

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

  if (!isOpen) return null;

  const totalIncome = closure
    ? Number((closure as any).totalIncome ?? (closure as any).total_income ?? 0)
    : 0;
  const totalExpense = closure
    ? Number((closure as any).totalExpense ?? (closure as any).total_expense ?? 0)
    : 0;
  const netTotal = closure
    ? Number((closure as any).netTotal ?? (closure as any).net_total ?? 0)
    : 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: isSmall ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#f8fafc',
          width: '100%',
          maxWidth: isSmall ? '100%' : '1000px',
          height: isSmall ? '95vh' : '85vh',
          borderRadius: isSmall ? '20px 20px 0 0' : '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: isSmall ? 'slideUp 0.3s ease-out' : 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #334155)',
          padding: headerPadding,
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: titleFontSize, fontWeight: 700 }}>
              📄 Detalle de Cierre #{closure?.closureNumber ?? '—'}
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#cbd5e1' }}>
              Historial de movimientos y resumen final
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {onReprint && closure && (
              <button
                type="button"
                onClick={() => onReprint(closure)}
                disabled={reprintingClosureId === closure.id}
                style={{
                  padding: btnPadding,
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  cursor: reprintingClosureId === closure.id ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: btnFontSize,
                  display: isSmall ? 'none' : 'block'
                }}
              >
                {reprintingClosureId === closure.id ? '...' : '🖨️ Ticket'}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}
            >
              &times;
            </button>
          </div>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: contentPadding
        }}>
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            {closure && (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isSmall ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  {/* Cards de resumen superior */}
                  <div style={{ padding: '1.25rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>INFORMACIÓN</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#64748b' }}>Caja:</span>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{closure.cashRegister.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#64748b' }}>Usuario:</span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{closure.user.fullName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Fecha:</span>
                      <span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{formatDate(closure.closedAt)}</span>
                    </div>
                  </div>

                  <div style={{ padding: '1.25rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>TOTALES</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>Ingresos:</span>
                      <span style={{ fontWeight: 800, color: '#16a34a' }}>{currencyFormatter.format(totalIncome)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>Egresos:</span>
                      <span style={{ fontWeight: 800, color: '#dc2626' }}>{currencyFormatter.format(totalExpense)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '2px dashed #f1f5f9' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>Neto Final:</span>
                      <span style={{ fontWeight: 900, fontSize: '1.1rem', color: netTotal >= 0 ? '#16a34a' : '#dc2626' }}>{currencyFormatter.format(netTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Resumen por método de pago */}
                {!loading && payments.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      💳 Resumen por Método
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '0.75rem'
                    }}>
                      {(['CASH', 'CARD', 'YAPE', 'PLIN', 'TRANSFER', 'OTROS'] as const).map(method => {
                        const total = payments.reduce((acc, mov) => {
                          const movMethod = mov.paymentMethod ?? mov.payment_method ?? '';
                          if (movMethod !== method) return acc;
                          const amount = Number(mov.paidAmount ?? mov.paid_amount ?? 0);
                          const type = mov.transactionType ?? mov.transaction_type ?? '';
                          return type === 'INCOME' ? acc + amount : acc - amount;
                        }, 0);
                        if (total === 0) return null;
                        return (
                          <div key={method} style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 600 }}>{getPaymentMethodLabel(method)}</div>
                            <div style={{ fontWeight: 800, color: total >= 0 ? '#16a34a' : '#dc2626', fontSize: '1.05rem' }}>{currencyFormatter.format(total)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#334155' }}>
                    📊 Movimientos ({payments.length})
                  </h4>
                  {isSmall && onReprint && closure && (
                    <button onClick={() => onReprint(closure)} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', fontSize: '0.8rem', fontWeight: 600 }}>🖨️ Reimprimir</button>
                  )}
                </div>

                {loading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Cargando movimientos...</div>
                ) : payments.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>No hay movimientos en este cierre</div>
                ) : (
                  <div style={{ overflow: 'hidden', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
                    {!isSmall ? (
                      <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                              <th style={{ padding: '1rem', textAlign: 'left', color: '#64748b' }}>Fecha/Hora</th>
                              <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Tipo</th>
                              <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Método</th>
                              <th style={{ padding: '1rem', textAlign: 'right', color: '#64748b' }}>Monto</th>
                              <th style={{ padding: '1rem', textAlign: 'left', color: '#64748b' }}>Referencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((mov) => (
                              <tr key={mov.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem' }}>{mov.paymentDate ? formatDate(mov.paymentDate) : '—'}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                  <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: (mov.transactionType || mov.transaction_type) === 'INCOME' ? '#dcfce7' : '#fee2e2', color: (mov.transactionType || mov.transaction_type) === 'INCOME' ? '#166534' : '#991b1b' }}>
                                    {getTransactionTypeLabel(mov.transactionType || mov.transaction_type || '')}
                                  </span>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>{getPaymentMethodLabel(mov.paymentMethod || mov.payment_method || '')}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: (mov.transactionType || mov.transaction_type) === 'INCOME' ? '#16a34a' : '#dc2626' }}>{currencyFormatter.format(mov.paidAmount || mov.paid_amount || 0)}</td>
                                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.75rem' }}>{mov.issuedDocument?.number || mov.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '50vh', overflowY: 'auto' }}>
                        {payments.map((mov) => (
                          <div key={mov.id} style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{mov.paymentDate ? formatDate(mov.paymentDate) : '—'}</span>
                              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: (mov.transactionType || mov.transaction_type) === 'INCOME' ? '#dcfce7' : '#fee2e2', color: (mov.transactionType || mov.transaction_type) === 'INCOME' ? '#166534' : '#991b1b' }}>{getTransactionTypeLabel(mov.transactionType || mov.transaction_type || '')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: 600, color: '#334155' }}>{getPaymentMethodLabel(mov.paymentMethod || mov.payment_method || '')}</div>
                              <div style={{ fontWeight: 800, color: (mov.transactionType || mov.transaction_type) === 'INCOME' ? '#16a34a' : '#dc2626' }}>{currencyFormatter.format(mov.paidAmount || mov.paid_amount || 0)}</div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>{mov.issuedDocument?.number || mov.notes || 'Sin referencia'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}} />
      </div>
    </div>
  );
};

export default CashDetailModal;
