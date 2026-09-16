import React, { useMemo } from "react";
import {
    buildCashClosureReportHtml,
    type CashClosureDetailData,
} from "../../utils/cashClosureReportHtml";

interface CashClosureReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    detail: CashClosureDetailData | null;
    downloadMessage?: string | null;
    downloading?: boolean;
}

const CashClosureReportModal: React.FC<CashClosureReportModalProps> = ({
    isOpen,
    onClose,
    detail,
    downloadMessage,
    downloading = false,
}) => {
    const reportHtml = useMemo(
        () => (detail ? buildCashClosureReportHtml(detail) : ""),
        [detail],
    );

    if (!isOpen || !detail) return null;

    return (
        <div
            className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm animate-in fade-in duration-300 sm:p-6"
            onClick={onClose}
        >
            <div
                className="relative flex h-full max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/30">
                    <div className="min-w-0">
                        <h3 className="truncate text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
                            Reporte de cierre de caja
                        </h3>
                        <p className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                            #{detail.closureNumber}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
                        aria-label="Cerrar"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {(downloading || downloadMessage) && (
                    <div
                        className={`shrink-0 border-b px-5 py-3 text-sm ${
                            downloading
                                ? "border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300"
                                : downloadMessage?.includes("Descargas") ||
                                    downloadMessage?.includes("Downloads")
                                  ? "border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                    >
                        {downloading
                            ? "Generando PDF y guardándolo en su carpeta de descargas…"
                            : downloadMessage}
                    </div>
                )}

                <div className="min-h-0 flex-1 bg-slate-100 p-3 dark:bg-slate-950">
                    <iframe
                        title={`Reporte de cierre de caja #${detail.closureNumber}`}
                        srcDoc={reportHtml}
                        className="h-full w-full rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-slate-800"
                    />
                </div>
            </div>
        </div>
    );
};

export default CashClosureReportModal;
