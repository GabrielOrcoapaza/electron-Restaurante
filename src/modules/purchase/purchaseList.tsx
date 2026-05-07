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

  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
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
    setStartDate(todayStr);
    setEndDate(todayStr);
  };

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
          Historial de Compras 
          <span className="ml-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            ({operations.length} {startDate || endDate ? `filtradas` : `registradas`})
          </span>
        </h3>
      </div>

      {/* Filtro por rango de fechas */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-50/50 p-6 dark:bg-slate-800/30 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="flex flex-col gap-2">
          <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Desde
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Hasta
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex gap-2 lg:col-span-2">
          <button
            type="button"
            onClick={clearDateFilter}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Limpiar Filtros
          </button>
          <button
            type="button"
            onClick={() => refetchOperations()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-all hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {operationsLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
          <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando Historial...</p>
        </div>
      ) : operations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-200 dark:bg-slate-800/50 dark:text-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Sin Movimientos</h3>
          <p className="mt-1 max-w-[280px] text-xs font-medium text-slate-500 dark:text-slate-400">
            {startDate || endDate 
              ? 'No se encontraron compras en el rango de fechas seleccionado.' 
              : 'Aún no se han registrado compras en esta sucursal.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                  <th className="px-6 py-4">Orden</th>
                  <th className="px-6 py-4">Fecha / Registro</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4 text-right">Total Bruto</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {operations.map((operation) => (
                  <tr
                    key={operation.id}
                    onClick={() => setSelectedPurchaseForDetail(operation as PurchaseOperationForModal)}
                    className="group cursor-pointer transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400">
                        #{operation.order}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {new Date(operation.operationDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-slate-400">Registrado por {operation.user.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          {operation.person?.name?.charAt(0) || 'S'}
                        </div>
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {operation.person?.name || 'Consumidor Final'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 dark:text-slate-100">
                          {currencyFormatter.format(operation.total)}
                        </span>
                        <span className="text-[10px] text-slate-400">IGV: {currencyFormatter.format(operation.igvAmount)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        operation.status === 'CANCELLED'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${operation.status === 'CANCELLED' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {operation.status === 'CANCELLED' ? 'Anulado' : 'Completado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {operation.status !== 'CANCELLED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOperationId(operation.id);
                            setShowCancelModal(true);
                          }}
                          className="inline-flex h-9 items-center gap-2 rounded-xl bg-rose-50 px-4 text-xs font-bold text-rose-600 transition-all hover:bg-rose-100 active:scale-95 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30"
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de cancelación */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
              <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                Anular Compra
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Esta acción revertirá el incremento de stock y generará un ajuste negativo.
              </p>
            </div>
            
            <div className="p-6">
              <div className="flex flex-col gap-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Motivo de la Anulación *
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Especifique el motivo (ej: error en cantidades)..."
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 bg-slate-50/30 p-6 dark:border-slate-800/50 dark:bg-slate-800/10">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedOperationId('');
                  setCancellationReason('');
                }}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
              <button
                onClick={handleCancelPurchase}
                disabled={cancelingPurchase || !cancellationReason.trim()}
                className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-black text-white transition-all hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                {cancelingPurchase ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Anulando...</span>
                  </div>
                ) : (
                  'Confirmar Anulación'
                )}
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
