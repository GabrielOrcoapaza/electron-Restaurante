import React from "react";
import { createPortal } from "react-dom";

export type DocumentPrintPreviewModalProps = {
    title: string;
    htmlUrl?: string | null;
    loading?: boolean;
    onPrint: () => void;
    onContinuePay: () => void;
    onCancel: () => void;
};

export function DocumentPrintPreviewModal({
    title,
    htmlUrl,
    loading = false,
    onPrint,
    onContinuePay,
    onCancel,
}: DocumentPrintPreviewModalProps): React.ReactElement {
    const hasPreview = Boolean(htmlUrl);

    const modal = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-print-preview-title"
        >
            <div className="flex max-h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <div>
                        <h2
                            id="document-print-preview-title"
                            className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg"
                        >
                            Vista previa — {title}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            Revise el comprobante antes de pagar. El cuadro de
                            Windows puede no mostrar miniatura; aquí sí ve el
                            ticket completo.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label="Cancelar"
                    >
                        ✕
                    </button>
                </div>

                <div className="min-h-[200px] flex-1 overflow-auto bg-slate-100 p-3 dark:bg-slate-950">
                    {loading ? (
                        <div className="flex h-[min(55vh,480px)] items-center justify-center text-sm font-medium text-slate-500">
                            Generando vista previa…
                        </div>
                    ) : hasPreview ? (
                        <iframe
                            title={title}
                            src={htmlUrl!}
                            className="mx-auto block h-[min(55vh,520px)] w-[72mm] max-w-[72mm] shrink-0 rounded-lg border border-slate-300 bg-white shadow-sm"
                        />
                    ) : (
                        <div className="flex h-[min(40vh,320px)] items-center justify-center px-4 text-center text-sm text-slate-500">
                            No se pudo generar la vista previa.
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 p-4 sm:flex-row dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onPrint}
                        disabled={loading}
                        className="flex-1 rounded-xl border border-emerald-700 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200"
                    >
                        Imprimir…
                    </button>
                    <button
                        type="button"
                        onClick={onContinuePay}
                        disabled={loading}
                        className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        Continuar con el pago
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

