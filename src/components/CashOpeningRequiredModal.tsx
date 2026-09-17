import React from "react";

type CashOpeningRequiredModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onGoToCashRegister?: () => void;
    message?: string;
};

export function CashOpeningRequiredModal({
    isOpen,
    onClose,
    onGoToCashRegister,
    message = "Debe abrir la caja antes de registrar pedidos o delivery. Vaya al módulo Caja y realice la apertura.",
}: CashOpeningRequiredModalProps): React.ReactElement | null {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[13000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-900/40 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cash-opening-required-title"
            >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl dark:bg-amber-950/40">
                    🔒
                </div>
                <h2
                    id="cash-opening-required-title"
                    className="text-lg font-black text-slate-900 dark:text-slate-100"
                >
                    Caja sin abrir
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {message}
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        Entendido
                    </button>
                    {onGoToCashRegister && (
                        <button
                            type="button"
                            onClick={() => {
                                onGoToCashRegister();
                                onClose();
                            }}
                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                            Ir a Caja
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
