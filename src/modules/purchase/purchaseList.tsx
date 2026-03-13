import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_PURCHASE_OPERATIONS } from '../../graphql/queries';
import { CANCEL_PURCHASE_OPERATION } from '../../graphql/mutations';
import PurchaseModal, { type PurchaseOperationForModal } from './purchaseModal';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

interface PurchaseOperation {
  id: string;
  order: string;
  operationDate: string;
  status: string;
  subtotal: number;
  igvAmount: number;
  igvPercentage: number;
  total: number;
  notes?: string;
  cancelledAt?: string;
  person: {
    id: string;
    name: string;
    documentNumber?: string;
  } | null;
  user: {
    id: string;
    fullName: string;
  };
  details: Array<{
    id: string;
    quantity: number;
    unitMeasure: string;
    unitValue: number;
    unitPrice: number;
    notes?: string;
    isCanceled: boolean;
    product: {
      id: string;
      code: string;
      name: string;
      productType: string;
    };
  }>;
}

interface PurchaseListProps {
  branchId: string;
  onRefresh?: () => void;
  setMessage?: (msg: { type: 'success' | 'error'; text: string } | null) => void;
}

const PurchaseList: React.FC<PurchaseListProps> = ({
  branchId,
  onRefresh,
  setMessage
}) => {
  const { user } = useAuth();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedOperationId, setSelectedOperationId] = useState<string>('');
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPurchaseForDetail, setSelectedPurchaseForDetail] = useState<PurchaseOperation | null>(null);

  const { data: operationsData, loading: operationsLoading, refetch: refetchOperations } = useQuery(
    GET_PURCHASE_OPERATIONS,
    {
      variables: { branchId },
      skip: !branchId,
      fetchPolicy: 'network-only'
    }
  );

  const allOperations: PurchaseOperation[] = operationsData?.purchasesByBranch || [];

  // Parsea fecha YYYY-MM-DD como fecha local (evita bug de zona horaria con new Date(string))
  const parseLocalDate = (dateStr: string, endOfDay = false) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  };

  const operations = useMemo(() => {
    if (!startDate && !endDate) return allOperations;

    return allOperations.filter((op) => {
      // Usar solo la parte de fecha (YYYY-MM-DD) para evitar problemas de zona horaria
      const opDateStr = String(op.operationDate || '').split('T')[0];
      if (!opDateStr || opDateStr.length < 10) return false;
      const [oy, om, od] = opDateStr.split('-').map(Number);
      const opLocalDate = new Date(oy, om - 1, od);

      if (startDate && endDate) {
        const from = parseLocalDate(startDate, false);
        const to = parseLocalDate(endDate, true);
        return opLocalDate >= from && opLocalDate <= to;
      }
      if (startDate) {
        const from = parseLocalDate(startDate, false);
        return opLocalDate >= from;
      }
      if (endDate) {
        const to = parseLocalDate(endDate, true);
        return opLocalDate <= to;
      }
      return true;
    });
  }, [allOperations, startDate, endDate]);

  const [cancelPurchaseOperation, { loading: cancelingPurchase }] = useMutation(
    CANCEL_PURCHASE_OPERATION,
    {
      onCompleted: (data) => {
        if (data.cancelPurchaseOperation.success) {
          const msg = data.cancelPurchaseOperation.message || 'Compra cancelada correctamente';
          setMessage?.({ type: 'success', text: msg });
          setShowCancelModal(false);
          setSelectedOperationId('');
          setCancellationReason('');
          refetchOperations();
          onRefresh?.();
          setTimeout(() => setMessage?.(null), 5000);
        } else {
          setMessage?.({
            type: 'error',
            text: data.cancelPurchaseOperation.message || 'No se pudo cancelar la compra'
          });
          setTimeout(() => setMessage?.(null), 5000);
        }
      },
      onError: (error) => {
        setMessage?.({ type: 'error', text: error.message });
        setTimeout(() => setMessage?.(null), 5000);
      }
    }
  );

  const handleCancelPurchase = () => {
    if (!cancellationReason.trim()) {
      setMessage?.({ type: 'error', text: 'Ingresa una razón de cancelación' });
      setTimeout(() => setMessage?.(null), 3000);
      return;
    }
    if (!user?.id) {
      setMessage?.({ type: 'error', text: 'Usuario no encontrado' });
      setTimeout(() => setMessage?.(null), 3000);
      return;
    }
    cancelPurchaseOperation({
      variables: {
        operationId: selectedOperationId,
        branchId,
        userId: user.id,
        cancellationReason: cancellationReason
      }
    });
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e2e8f0'
      }}
    >
      <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>
        📋 Lista de Compras ({operations.length}
        {(startDate || endDate) && ` de ${allOperations.length}`})
      </h3>

      {/* Filtro por rango de fechas */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
          Filtrar por fechas:
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
          Desde
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.875rem',
              color: '#334155'
            }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
          Hasta
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.875rem',
              color: '#334155'
            }}
          />
        </label>
        <button
          type="button"
          onClick={clearDateFilter}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: 'white',
            color: '#64748b',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Limpiar filtro
        </button>
      </div>

      {operationsLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          Cargando compras...
        </div>
      ) : operations.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          <p>
            {(startDate || endDate)
              ? 'No hay compras en el rango de fechas seleccionado'
              : 'No hay compras registradas'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Orden</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Fecha</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Proveedor</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Subtotal</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>IGV</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Total</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Estado</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((operation) => (
                <tr
                  key={operation.id}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => setSelectedPurchaseForDetail(operation as PurchaseOperationForModal)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: '0.75rem', color: '#334155', fontFamily: 'monospace' }}>
                    #{operation.order}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: '#334155' }}>
                    {new Date(operation.operationDate).toLocaleDateString('es-PE')}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: '#334155' }}>
                    {operation.person?.name || 'Sin proveedor'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: '#334155', fontWeight: 500 }}>
                    {currencyFormatter.format(operation.subtotal)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: '#334155' }}>
                    {currencyFormatter.format(operation.igvAmount)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: '#334155', fontWeight: 600 }}>
                    {currencyFormatter.format(operation.total)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: operation.status === 'CANCELLED' ? '#fee2e2' : '#dcfce7',
                        color: operation.status === 'CANCELLED' ? '#991b1b' : '#166534'
                      }}
                    >
                      {operation.status === 'CANCELLED' ? 'Cancelada' : 'Procesada'}
                    </span>
                  </td>
                  <td
                    style={{ padding: '0.75rem', textAlign: 'center' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {operation.status !== 'CANCELLED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOperationId(operation.id);
                          setShowCancelModal(true);
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de cancelación */}
      {showCancelModal && (
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
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', fontWeight: 600, color: '#334155' }}>
              Cancelar Compra
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: '#64748b' }}>
              ¿Estás seguro de que deseas cancelar esta compra? Esta acción reducirá el stock de los
              productos.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#475569' }}>
                Razón de cancelación *
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ingresa la razón de cancelación..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedOperationId('');
                  setCancellationReason('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#64748b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCancelPurchase}
                disabled={cancelingPurchase || !cancellationReason.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: cancelingPurchase || !cancellationReason.trim() ? '#94a3b8' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: cancelingPurchase || !cancellationReason.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {cancelingPurchase ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle de compra */}
      <PurchaseModal
        isOpen={!!selectedPurchaseForDetail}
        onClose={() => setSelectedPurchaseForDetail(null)}
        purchase={selectedPurchaseForDetail}
      />
    </div>
  );
};

export default PurchaseList;
