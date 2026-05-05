import React, { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_TABLE } from '../../graphql/mutations';
import type { Table } from './tableList';

const SHAPE_OPTIONS = [
  { value: 'SQUARE', label: 'Cuadrada' },
  { value: 'ROUND', label: 'Redonda' },
  { value: 'RECTANGLE', label: 'Rectangular' },
];

type TableUpdateModalProps = {
  table: Table | null;
  onClose: () => void;
  onUpdated: () => void;
};


const TableUpdateModal: React.FC<TableUpdateModalProps> = ({ table, onClose, onUpdated }) => {
  const [name, setName] = useState('');
  const [shape, setShape] = useState('SQUARE');
  const [capacity, setCapacity] = useState(4);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (table) {
      setName(table.name);
      const s = (table.shape || 'SQUARE').toUpperCase();
      if (s === 'ROUND' || s === 'CIRCLE') setShape('ROUND');
      else if (s === 'RECTANGLE') setShape('RECTANGLE');
      else setShape('SQUARE');
      setCapacity(table.capacity ?? 4);
      setPositionX(table.positionX ?? 0);
      setPositionY(table.positionY ?? 0);
      setIsActive(table.isActive !== false);
      setMessage(null);
    }
  }, [table]);

  const [updateTable, { loading }] = useMutation(UPDATE_TABLE, {
    onCompleted: (res) => {
      const result = res?.updateTable;
      if (result?.success) {
        setTimeout(() => {
          onUpdated();
          onClose();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo actualizar la mesa' });
      }
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.message });
    },
  });

  if (!table) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    updateTable({
      variables: {
        tableId: table.id,
        name: name.trim(),
        shape,
        positionX: Number(positionX) || 0,
        positionY: Number(positionY) || 0,
        capacity: Number(capacity) || 1,
        isActive,
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800/50">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Editar Mesa
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {message && (
            <div className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              message.type === 'success' 
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400' 
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400'
            }`}>
              <div className={`h-2 w-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Nombre de la Mesa
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Forma
                </label>
                <select
                  value={shape}
                  onChange={(e) => setShape(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                >
                  {SHAPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Capacidad
                </label>
                <input
                  type="number"
                  min={1}
                  value={capacity || ''}
                  onChange={(e) => setCapacity(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Posición X
                </label>
                <input
                  type="number"
                  step="any"
                  value={positionX}
                  onChange={(e) => setPositionX(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Posición Y
                </label>
                <input
                  type="number"
                  step="any"
                  value={positionY}
                  onChange={(e) => setPositionY(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 px-1">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-5 w-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Mesa Activa</span>
            </label>

            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex min-w-[120px] items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Guardando...</span>
                  </div>
                ) : (
                  'Guardar Cambios'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TableUpdateModal;
