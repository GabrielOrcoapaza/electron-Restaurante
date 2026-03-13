import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_PAYMENTS_BY_CLOSURE } from '../../graphql/queries';

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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
            Detalle del Cierre de Caja #{closure?.closureNumber ?? '—'}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              color: '#64748b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            ✕ Cerrar
          </button>
        </div>

        {closure && (
          <>
            <div style={{
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Caja</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{closure.cashRegister.name}</div>
                <span style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb'
                }}>
                  {getCashTypeLabel(closure.cashRegister.cashType)}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Usuario</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{closure.user.fullName}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{closure.user.role}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Fecha y hora</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{formatDate(closure.closedAt)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Ingresos</div>
                <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '1.125rem' }}>
                  {currencyFormatter.format(totalIncome)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Egresos</div>
                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '1.125rem' }}>
                  {currencyFormatter.format(totalExpense)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Neto Total</div>
                <div style={{
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  color: netTotal >= 0 ? '#16a34a' : '#dc2626'
                }}>
                  {currencyFormatter.format(netTotal)}
                </div>
              </div>
            </div>

            {onReprint && (
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => onReprint(closure)}
                  disabled={reprintingClosureId === closure.id}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: reprintingClosureId === closure.id ? '#94a3b8' : '#2563eb',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: reprintingClosureId === closure.id ? 'not-allowed' : 'pointer'
                  }}
                >
                  {reprintingClosureId === closure.id ? 'Imprimiendo...' : '🖨️ Reimprimir Cierre'}
                </button>
              </div>
            )}

            <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#475569' }}>
              Movimientos ({payments.length})
            </h4>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                Cargando movimientos...
              </div>
            ) : payments.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                No hay movimientos en este cierre
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Fecha / Hora</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Tipo</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Método</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Monto</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Usuario</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Referencia / Documento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((mov) => {
                      const dateStr = mov.paymentDate ?? mov.payment_date ?? '';
                      const amount = Number(mov.paidAmount ?? mov.paid_amount ?? 0);
                      const type = mov.transactionType ?? mov.transaction_type ?? '';
                      const method = mov.paymentMethod ?? mov.payment_method ?? '';
                      const doc = mov.issuedDocument ?? mov.issued_document;
                      const docLabel = doc ? `${doc.serial ?? ''}-${doc.number ?? ''}`.replace(/^-|-$/g, '') || '—' : (mov.notes || '—');
                      const userName = mov.user?.fullName ?? (mov.user as any)?.full_name ?? '—';

                      return (
                        <tr key={mov.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem', color: '#334155' }}>
                            {dateStr ? formatDate(dateStr) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: type === 'INCOME' ? '#dcfce7' : '#fee2e2',
                              color: type === 'INCOME' ? '#166534' : '#991b1b'
                            }}>
                              {getTransactionTypeLabel(type)}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#475569' }}>
                            {getPaymentMethodLabel(method)}
                          </td>
                          <td style={{
                            padding: '0.75rem',
                            textAlign: 'right',
                            fontWeight: 600,
                            color: type === 'INCOME' ? '#16a34a' : '#dc2626'
                          }}>
                            {type === 'EXPENSE' ? '-' : ''}{currencyFormatter.format(amount)}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#64748b' }}>{userName}</td>
                          <td style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.75rem' }}>
                            {mov.operation?.order ? `Op: ${mov.operation.order} — ` : ''}{docLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CashDetailModal;
