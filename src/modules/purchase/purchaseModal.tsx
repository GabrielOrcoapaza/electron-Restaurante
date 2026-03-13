import React from 'react';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

export interface PurchaseOperationForModal {
  id: string;
  order: string;
  operationDate: string;
  status: string;
  subtotal: number;
  igvAmount: number;
  igvPercentage: number;
  total: number;
  notes?: string;
  person: { id: string; name: string; documentNumber?: string } | null;
  user: { id: string; fullName: string };
  details: Array<{
    id: string;
    quantity: number;
    unitMeasure: string;
    unitValue: number;
    unitPrice: number;
    notes?: string;
    isCanceled: boolean;
    product: { id: string; code: string; name: string; productType: string };
  }>;
}

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: PurchaseOperationForModal | null;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ isOpen, onClose, purchase }) => {
  if (!isOpen) return null;

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

  const details = purchase?.details ?? [];
  const activeDetails = details.filter((d) => !d.isCanceled);

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
          maxWidth: '700px',
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
            🛒 Detalle de Compra #{purchase?.order ?? '—'}
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

        {purchase && (
          <>
            <div
              style={{
                padding: '1rem',
                borderRadius: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: '1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '1rem'
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Proveedor</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{purchase.person?.name || 'Sin proveedor'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Usuario</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{purchase.user.fullName}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Fecha</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{formatDate(purchase.operationDate)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Estado</div>
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: purchase.status === 'CANCELLED' ? '#fee2e2' : '#dcfce7',
                    color: purchase.status === 'CANCELLED' ? '#991b1b' : '#166534'
                  }}
                >
                  {purchase.status === 'CANCELLED' ? 'Cancelada' : 'Procesada'}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Subtotal</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{currencyFormatter.format(purchase.subtotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>IGV</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{currencyFormatter.format(purchase.igvAmount)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total</div>
                <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#1e293b' }}>
                  {currencyFormatter.format(purchase.total)}
                </div>
              </div>
            </div>

            {purchase.notes && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Notas</div>
                <div style={{ fontSize: '0.875rem', color: '#334155' }}>{purchase.notes}</div>
              </div>
            )}

            <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#475569' }}>
              Productos ({activeDetails.length})
            </h4>

            {activeDetails.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                No hay productos en esta compra
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Código</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Producto</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Cantidad</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Precio Unit.</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDetails.map((detail) => {
                      const subtotal = detail.quantity * detail.unitPrice;
                      return (
                        <tr key={detail.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem', color: '#334155', fontFamily: 'monospace' }}>
                            {detail.product?.code ?? '—'}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#334155' }}>
                            {detail.product?.name ?? '—'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155' }}>
                            {detail.quantity} {detail.unitMeasure}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155' }}>
                            {currencyFormatter.format(detail.unitPrice)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                            {currencyFormatter.format(subtotal)}
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

export default PurchaseModal;
