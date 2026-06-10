import React from "react";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "default";
    loading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    variant = "default",
    loading = false,
    onConfirm,
    onClose,
}) => {
    if (!isOpen) return null;

    const confirmClass =
        variant === "danger"
            ? "bg-rose-600 shadow-rose-500/20 hover:bg-rose-700"
            : "bg-indigo-600 shadow-indigo-500/20 hover:bg-indigo-700";

    return (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
                    <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                        {title}
                    </h3>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {message}
                    </p>
                </div>

                <div className="flex gap-3 border-t border-slate-100 bg-slate-50/30 p-6 dark:border-slate-800/50 dark:bg-slate-800/10">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 rounded-2xl py-3 text-sm font-black text-white shadow-lg transition-all disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 ${confirmClass}`}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                <span>Procesando...</span>
                            </div>
                        ) : (
                            confirmLabel
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
