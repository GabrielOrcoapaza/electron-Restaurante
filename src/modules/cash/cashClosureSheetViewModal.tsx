import React from "react";

export interface CashClosureSheetStaffRowData {
    id?: string;
    rowNumber: number;
    position?: string;
    staffName?: string;
    shiftTime?: string;
    payments?: number;
    purchaseExpense?: string;
    total?: number;
    user?: { id: string; fullName: string } | null;
}

export interface CashClosureSheetViewData {
    id?: string;
    sheetDate?: string | null;
    cashierName?: string;
    cardSales?: number;
    cashSales?: number;
    yapeSales?: number;
    totalSales?: number;
    totalExpenses?: number;
    netSales?: number;
    paymentsTotal?: number;
    purchaseExpensesTotal?: number;
    observations?: string;
    staffRows?: CashClosureSheetStaffRowData[];
}

interface CashClosureSheetViewModalProps {
    isOpen: boolean;
    closureNumber: number;
    registerName: string;
    loading?: boolean;
    sheet: CashClosureSheetViewData | null;
    onClose: () => void;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
});

const formatMoney = (value: unknown): string => {
    const amount = Number(value);
    return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
};

const formatSheetDate = (value?: string | null): string => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
};

const displayStaffName = (row: CashClosureSheetStaffRowData): string =>
    row.user?.fullName?.trim() || row.staffName?.trim() || "—";

const hasStaffRowContent = (row: CashClosureSheetStaffRowData): boolean =>
    Boolean(
        row.position?.trim() ||
            row.staffName?.trim() ||
            row.user?.fullName?.trim() ||
            row.shiftTime?.trim() ||
            row.purchaseExpense?.trim() ||
            Number(row.payments) > 0 ||
            Number(row.total) > 0,
    );

const cellClass =
    "border border-slate-200 px-2 py-2 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200";

const CashClosureSheetViewModal: React.FC<CashClosureSheetViewModalProps> = ({
    isOpen,
    closureNumber,
    registerName,
    loading = false,
    sheet,
    onClose,
}) => {
    if (!isOpen) return null;

    const staffRows = [...(sheet?.staffRows ?? [])].sort(
        (a, b) => a.rowNumber - b.rowNumber,
    );
    const visibleStaffRows = staffRows.filter(hasStaffRowContent);

    return (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/50 p-2 backdrop-blur-sm sm:p-4">
            <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800/50 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-xl">
                                Hoja de cierre #{closureNumber}
                            </h3>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {registerName}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                            aria-label="Cerrar"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                            <p className="text-sm font-bold uppercase tracking-widest">
                                Cargando hoja de cierre...
                            </p>
                        </div>
                    ) : !sheet ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                            <p className="text-sm font-bold uppercase tracking-widest">
                                Este cierre no tiene hoja registrada
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Fecha
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                                        {formatSheetDate(sheet.sheetDate)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Caja
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                                        {sheet.cashierName?.trim() || "—"}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <table className="w-full min-w-[420px] border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800">
                                                <th className={`${cellClass} text-left font-black uppercase`}>
                                                    #
                                                </th>
                                                <th className={`${cellClass} text-left font-black uppercase`}>
                                                    Cargo
                                                </th>
                                                <th className={`${cellClass} text-left font-black uppercase`}>
                                                    Nombre
                                                </th>
                                                <th className={`${cellClass} text-left font-black uppercase`}>
                                                    Hora
                                                </th>
                                                <th className={`${cellClass} text-left font-black uppercase`}>
                                                    Pagos
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(visibleStaffRows.length > 0
                                                ? visibleStaffRows
                                                : staffRows
                                            ).map((row) => (
                                                <tr key={`staff-${row.id ?? row.rowNumber}`}>
                                                    <td className={`${cellClass} text-center font-bold`}>
                                                        {row.rowNumber}
                                                    </td>
                                                    <td className={cellClass}>
                                                        {row.position?.trim() || "—"}
                                                    </td>
                                                    <td className={cellClass}>
                                                        {displayStaffName(row)}
                                                    </td>
                                                    <td className={cellClass}>
                                                        {row.shiftTime?.trim() || "—"}
                                                    </td>
                                                    <td className={cellClass}>
                                                        {formatMoney(row.payments)}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-slate-50 font-black dark:bg-slate-800/50">
                                                <td
                                                    colSpan={4}
                                                    className={`${cellClass} text-right uppercase`}
                                                >
                                                    Pagos total
                                                </td>
                                                <td className={cellClass}>
                                                    {formatMoney(sheet.paymentsTotal)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <table className="w-full min-w-[320px] border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800">
                                                <th className={`${cellClass} text-left font-black uppercase`}>
                                                    #
                                                </th>
                                                <th className={`${cellClass} text-left font-black uppercase`}>
                                                    Gasto en compras
                                                </th>
                                                <th className={`${cellClass} text-left font-black uppercase`}>
                                                    Total S/
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(visibleStaffRows.length > 0
                                                ? visibleStaffRows
                                                : staffRows
                                            ).map((row) => (
                                                <tr key={`expense-${row.id ?? row.rowNumber}`}>
                                                    <td className={`${cellClass} text-center font-bold`}>
                                                        {row.rowNumber}
                                                    </td>
                                                    <td className={cellClass}>
                                                        {row.purchaseExpense?.trim() || "—"}
                                                    </td>
                                                    <td className={cellClass}>
                                                        {formatMoney(row.total)}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-slate-50 font-black dark:bg-slate-800/50">
                                                <td className={`${cellClass} text-right uppercase`}>
                                                    Gastos total
                                                </td>
                                                <td
                                                    colSpan={2}
                                                    className={cellClass}
                                                >
                                                    {formatMoney(
                                                        sheet.purchaseExpensesTotal,
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Ventas por método
                                    </span>
                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            Venta Visa
                                        </span>
                                        <span className="font-black text-slate-800 dark:text-slate-100">
                                            {formatMoney(sheet.cardSales)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            Venta Yape
                                        </span>
                                        <span className="font-black text-slate-800 dark:text-slate-100">
                                            {formatMoney(sheet.yapeSales)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            Venta Efectivo
                                        </span>
                                        <span className="font-black text-slate-800 dark:text-slate-100">
                                            {formatMoney(sheet.cashSales)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Totales
                                    </span>
                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            Total venta
                                        </span>
                                        <span className="font-black text-slate-800 dark:text-slate-100">
                                            {formatMoney(sheet.totalSales)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            Total de gastos
                                        </span>
                                        <span className="font-black text-slate-800 dark:text-slate-100">
                                            {formatMoney(sheet.totalExpenses)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            Venta neta
                                        </span>
                                        <span className="font-black text-slate-800 dark:text-slate-100">
                                            {formatMoney(sheet.netSales)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Observaciones
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                                    {sheet.observations?.trim() || "—"}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-100 bg-slate-50/30 p-4 dark:border-slate-800/50 dark:bg-slate-800/10 sm:p-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CashClosureSheetViewModal;
