import React, { useEffect, useState } from "react";

interface CashOpeningModalProps {
    isOpen: boolean;
    registerName: string;
    loading?: boolean;
    onConfirm: (openingAmount: number, notes: string) => void;
    onClose: () => void;
}

const CashOpeningModal: React.FC<CashOpeningModalProps> = ({
    isOpen,
    registerName,
    loading = false,
    onConfirm,
    onClose,
}) => {
    const [amount, setAmount] = useState("0");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (isOpen) {
            setAmount("0");
            setNotes("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const parsedAmount = Number(amount);
    const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0;

    return (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
                    <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                        Abrir caja
                    </h3>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {registerName} — declara cuánto efectivo hay al iniciar
                        el turno (puede ser S/ 0.00).
                    </p>
                </div>

                <div className="flex flex-col gap-4 p-6">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Monto de apertura
                        </span>
                        <input
                            type="number"
                            min={0}
                            step="0.10"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                            autoFocus
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Notas (opcional)
                        </span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                            placeholder="Ej. billetes contados con el mozo anterior"
                        />
                    </label>
                </div>

                <div className="flex gap-3 border-t border-slate-100 bg-slate-50/30 p-6 dark:border-slate-800/50 dark:bg-slate-800/10">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(parsedAmount, notes.trim())}
                        disabled={loading || !isValidAmount}
                        className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                <span>Abriendo...</span>
                            </div>
                        ) : (
                            "Abrir caja"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CashOpeningModal;
