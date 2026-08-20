import React from "react";

type ReportExportExcelButtonProps = {
    onClick: () => void;
    disabled?: boolean;
    label?: string;
    className?: string;
};

const ReportExportExcelButton: React.FC<ReportExportExcelButtonProps> = ({
    onClick,
    disabled = false,
    label = "Descargar Excel",
    className = "",
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/30 ${className}`}
    >
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
        </svg>
        {label}
    </button>
);

export default ReportExportExcelButton;
