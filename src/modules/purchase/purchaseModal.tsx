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
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800/50">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
              Detalle de Compra
            </h3>
            <span className="text-xs font-mono font-black text-indigo-500 dark:text-indigo-400">
              #{purchase?.order ?? '—'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {purchase ? (
            <div className="flex flex-col gap-8">
              {/* Resumen Grid */}
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Proveedor</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {purchase.person?.name || 'Consumidor Final'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registrado por</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{purchase.user.fullName}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha y Hora</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(purchase.operationDate)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</span>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      purchase.status === 'CANCELLED'
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    }`}>
                      <div className={`h-1 w-1 rounded-full ${purchase.status === 'CANCELLED' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                      {purchase.status === 'CANCELLED' ? 'Anulado' : 'Completado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notas si existen */}
              {purchase.notes && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/20">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Observaciones</span>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{purchase.notes}</p>
                </div>
              )}

              {/* Tabla de ítems */}
              <div className="flex flex-col gap-4">
                <h4 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Lista de Artículos</h4>
                <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800/50">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3 text-center">Cant.</th>
                        <th className="px-4 py-3 text-right">Unit.</th>
                        <th className="px-4 py-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {activeDetails.map((detail) => {
                        const detailSubtotal = detail.quantity * detail.unitPrice;
                        return (
                          <tr key={detail.id} className="transition-colors hover:bg-slate-50/30 dark:hover:bg-slate-800/20">
                            <td className="px-4 py-3 font-mono text-slate-400">{detail.product?.code ?? '—'}</td>
                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{detail.product?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-slate-600 dark:text-slate-400">
                                {detail.quantity} {detail.unitMeasure}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500">{currencyFormatter.format(detail.unitPrice)}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-slate-100">
                              {currencyFormatter.format(detailSubtotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="mb-4 h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-bold uppercase tracking-widest">Sin información</p>
            </div>
          )}
        </div>

        {/* Footer con Totales */}
        <div className="border-t border-slate-100 bg-slate-900 p-8 text-white dark:bg-slate-800/40">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Base Imponible</span>
              <span className="text-lg font-bold text-slate-100">{currencyFormatter.format(purchase?.subtotal ?? 0)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">IGV ({purchase?.igvPercentage ?? 18}%)</span>
              <span className="text-lg font-bold text-slate-100">{currencyFormatter.format(purchase?.igvAmount ?? 0)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Total Transacción</span>
              <span className="text-2xl font-black text-white">{currencyFormatter.format(purchase?.total ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default PurchaseModal;
