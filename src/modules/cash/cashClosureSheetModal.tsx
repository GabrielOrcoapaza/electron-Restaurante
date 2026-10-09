import React, { useEffect, useMemo, useRef, useState } from "react";

interface StaffRow {
    num: number;
    cargo: string;
    nombre: string;
    hora: string;
    pagos: string;
    gastoCompra: string;
    total: string;
}

export interface CashClosureStaffRowInput {
    rowNumber: number;
    position: string;
    staffName: string;
    shiftTime: string;
    payments: number;
    purchaseExpense: string;
    total: number;
}

export interface CashClosureSheetSubmitInput {
    sheetDate: string;
    cashierName: string;
    cardSales: number;
    cashSales: number;
    yapeSales: number;
    totalSales: number;
    totalExpenses: number;
    netSales: number;
    paymentsTotal: number;
    purchaseExpensesTotal: number;
    observations: string;
    staffRows: CashClosureStaffRowInput[];
}

export interface CashClosureSheetModalProps {
    isOpen: boolean;
    registerName: string;
    loading?: boolean;
    onConfirm: (sheet: CashClosureSheetSubmitInput) => void;
    onClose: () => void;
}

const createEmptyStaffRow = (num: number): StaffRow => ({
    num,
    cargo: "",
    nombre: "",
    hora: "",
    pagos: "",
    gastoCompra: "",
    total: "",
});

const createEmptyStaffRows = (): StaffRow[] => [createEmptyStaffRow(1)];

const renumberStaffRows = (rows: StaffRow[]): StaffRow[] =>
    rows.map((row, index) => ({ ...row, num: index + 1 }));

const formatDateLabel = () =>
    new Date().toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

const parseAmount = (value: string): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const buildSheetSubmitInput = (
    caja: string,
    ventaVisa: string,
    ventaYape: string,
    ventaEfectivo: string,
    totalVenta: string,
    totalGastos: string,
    ventaNeta: string,
    pagosTotal: number,
    gastosComprasTotal: number,
    observaciones: string,
    staffRows: StaffRow[],
): CashClosureSheetSubmitInput => ({
    sheetDate: new Date().toISOString().slice(0, 10),
    cashierName: caja.trim(),
    cardSales: parseAmount(ventaVisa),
    cashSales: parseAmount(ventaEfectivo),
    yapeSales: parseAmount(ventaYape),
    totalSales: parseAmount(totalVenta),
    totalExpenses: parseAmount(totalGastos),
    netSales: parseAmount(ventaNeta),
    paymentsTotal: pagosTotal,
    purchaseExpensesTotal: gastosComprasTotal,
    observations: observaciones.trim(),
    staffRows: staffRows.map((row) => ({
        rowNumber: row.num,
        position: row.cargo.trim(),
        staffName: row.nombre.trim(),
        shiftTime: row.hora.trim(),
        payments: parseAmount(row.pagos),
        purchaseExpense: row.gastoCompra.trim(),
        total: parseAmount(row.total),
    })),
});

const inputClass =
    "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500";

const labelClass =
    "text-[10px] font-black uppercase tracking-widest text-slate-400";

const tableActionBtnClass =
    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition";

const DeleteRowButton = ({
    onClick,
    disabled,
}: {
    onClick: () => void;
    disabled?: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title="Eliminar fila"
        className={`${tableActionBtnClass} text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950/30`}
    >
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
        </svg>
    </button>
);

const CashClosureSheetModal: React.FC<CashClosureSheetModalProps> = ({
    isOpen,
    registerName,
    loading = false,
    onConfirm,
    onClose,
}) => {
    const wasOpenRef = useRef(false);
    const [fecha, setFecha] = useState(formatDateLabel());
    const [caja, setCaja] = useState("");
    const [staffRows, setStaffRows] = useState<StaffRow[]>(createEmptyStaffRows);
    const [ventaVisa, setVentaVisa] = useState("");
    const [ventaYape, setVentaYape] = useState("");
    const [ventaEfectivo, setVentaEfectivo] = useState("");
    const [totalVenta, setTotalVenta] = useState("");
    const [totalGastos, setTotalGastos] = useState("");
    const [ventaNeta, setVentaNeta] = useState("");
    const [observaciones, setObservaciones] = useState("");

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            setFecha(formatDateLabel());
            setCaja("");
            setStaffRows(createEmptyStaffRows());
            setVentaVisa("");
            setVentaYape("");
            setVentaEfectivo("");
            setTotalVenta("");
            setTotalGastos("");
            setVentaNeta("");
            setObservaciones("");
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    const pagosTotal = useMemo(
        () =>
            staffRows.reduce((sum, row) => sum + parseAmount(row.pagos), 0),
        [staffRows],
    );

    const gastosComprasTotal = useMemo(
        () =>
            staffRows.reduce((sum, row) => sum + parseAmount(row.total), 0),
        [staffRows],
    );

    const updateStaffRow = (
        index: number,
        field: keyof Omit<StaffRow, "num">,
        value: string,
    ) => {
        setStaffRows((prev) =>
            prev.map((row, i) =>
                i === index ? { ...row, [field]: value } : row,
            ),
        );
    };

    const addStaffRow = () => {
        setStaffRows((prev) =>
            renumberStaffRows([
                ...prev,
                createEmptyStaffRow(prev.length + 1),
            ]),
        );
    };

    const removeStaffRow = (index: number) => {
        setStaffRows((prev) => {
            if (prev.length <= 1) return prev;
            return renumberStaffRows(prev.filter((_, i) => i !== index));
        });
    };

    const canRemoveStaffRow = staffRows.length > 1;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/50 p-2 backdrop-blur-sm sm:p-4">
            <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800/50 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-xl">
                                Hoja de cierre de caja
                            </h3>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {registerName} — complete la liquidación antes
                                de cerrar el turno
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800"
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
                        <div className="flex flex-col gap-6">
                            {/* Encabezado */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="flex flex-col gap-1">
                                    <span className={labelClass}>Fecha</span>
                                    <input
                                        type="text"
                                        value={fecha}
                                        onChange={(e) =>
                                            setFecha(e.target.value)
                                        }
                                        className={inputClass}
                                    />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className={labelClass}>Caja</span>
                                    <input
                                        type="text"
                                        value={caja}
                                        onChange={(e) =>
                                            setCaja(e.target.value)
                                        }
                                        className={inputClass}
                                    />
                                </label>
                            </div>

                            {/* Tablas: personal/pagos y gastos */}
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <div className="overflow-x-auto">
                                    <table className="w-full min-w-[420px] border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800">
                                                <th className="border border-slate-200 px-2 py-2 text-left font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    #
                                                </th>
                                                <th className="border border-slate-200 px-2 py-2 text-left font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    Cargo
                                                </th>
                                                <th className="border border-slate-200 px-2 py-2 text-left font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    Nombre
                                                </th>
                                                <th className="border border-slate-200 px-2 py-2 text-left font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    Hora
                                                </th>
                                                <th className="border border-slate-200 px-2 py-2 text-left font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    Pagos
                                                </th>
                                                <th className="border border-slate-200 px-2 py-2 text-center font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    {" "}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {staffRows.map((row, index) => (
                                                <tr
                                                    key={`staff-${index}`}
                                                    className="bg-white dark:bg-slate-900"
                                                >
                                                    <td className="border border-slate-200 px-2 py-1 text-center font-bold text-slate-500 dark:border-slate-700">
                                                        {row.num}
                                                    </td>
                                                    <td className="border border-slate-200 p-1 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={row.cargo}
                                                            onChange={(e) =>
                                                                updateStaffRow(
                                                                    index,
                                                                    "cargo",
                                                                    e.target.value,
                                                                )
                                                            }
                                                            className={
                                                                inputClass
                                                            }
                                                        />
                                                    </td>
                                                    <td className="border border-slate-200 p-1 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={row.nombre}
                                                            onChange={(e) =>
                                                                updateStaffRow(
                                                                    index,
                                                                    "nombre",
                                                                    e.target.value,
                                                                )
                                                            }
                                                            className={
                                                                inputClass
                                                            }
                                                        />
                                                    </td>
                                                    <td className="border border-slate-200 p-1 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={row.hora}
                                                            onChange={(e) =>
                                                                updateStaffRow(
                                                                    index,
                                                                    "hora",
                                                                    e.target.value,
                                                                )
                                                            }
                                                            className={
                                                                inputClass
                                                            }
                                                            placeholder="HH:MM"
                                                        />
                                                    </td>
                                                    <td className="border border-slate-200 p-1 dark:border-slate-700">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="0.01"
                                                            value={row.pagos}
                                                            onChange={(e) =>
                                                                updateStaffRow(
                                                                    index,
                                                                    "pagos",
                                                                    e.target.value,
                                                                )
                                                            }
                                                            className={
                                                                inputClass
                                                            }
                                                        />
                                                    </td>
                                                    <td className="border border-slate-200 p-1 text-center dark:border-slate-700">
                                                        <DeleteRowButton
                                                            onClick={() =>
                                                                removeStaffRow(
                                                                    index,
                                                                )
                                                            }
                                                            disabled={
                                                                !canRemoveStaffRow
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-slate-50 font-black dark:bg-slate-800/50">
                                                <td
                                                    colSpan={4}
                                                    className="border border-slate-200 px-2 py-2 text-right uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                                >
                                                    Pagos total
                                                </td>
                                                <td className="border border-slate-200 px-2 py-2 text-slate-800 dark:border-slate-700 dark:text-slate-100">
                                                    S/ {pagosTotal.toFixed(2)}
                                                </td>
                                                <td className="border border-slate-200 dark:border-slate-700" />
                                            </tr>
                                        </tbody>
                                    </table>
                                    </div>
                                    <div className="flex justify-end border-t border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/20">
                                        <button
                                            type="button"
                                            onClick={addStaffRow}
                                            className={`${tableActionBtnClass} bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600`}
                                        >
                                            + Agregar fila
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <div className="overflow-x-auto">
                                    <table className="w-full min-w-[320px] border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800">
                                                <th className="border border-slate-200 px-2 py-2 text-left font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    #
                                                </th>
                                                <th className="border border-slate-200 px-2 py-2 text-left font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    Gasto en compras
                                                </th>
                                                <th className="border border-slate-200 px-2 py-2 text-left font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    Total S/
                                                </th>
                                                <th className="border border-slate-200 px-2 py-2 text-center font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    {" "}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {staffRows.map((row, index) => (
                                                <tr
                                                    key={`expense-${index}`}
                                                    className="bg-white dark:bg-slate-900"
                                                >
                                                    <td className="border border-slate-200 px-2 py-1 text-center font-bold text-slate-500 dark:border-slate-700">
                                                        {row.num}
                                                    </td>
                                                    <td className="border border-slate-200 p-1 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={
                                                                row.gastoCompra
                                                            }
                                                            onChange={(e) =>
                                                                updateStaffRow(
                                                                    index,
                                                                    "gastoCompra",
                                                                    e.target.value,
                                                                )
                                                            }
                                                            className={
                                                                inputClass
                                                            }
                                                        />
                                                    </td>
                                                    <td className="border border-slate-200 p-1 dark:border-slate-700">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="0.01"
                                                            value={row.total}
                                                            onChange={(e) =>
                                                                updateStaffRow(
                                                                    index,
                                                                    "total",
                                                                    e.target.value,
                                                                )
                                                            }
                                                            className={
                                                                inputClass
                                                            }
                                                        />
                                                    </td>
                                                    <td className="border border-slate-200 p-1 text-center dark:border-slate-700">
                                                        <DeleteRowButton
                                                            onClick={() =>
                                                                removeStaffRow(
                                                                    index,
                                                                )
                                                            }
                                                            disabled={
                                                                !canRemoveStaffRow
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-slate-50 font-black dark:bg-slate-800/50">
                                                <td className="border border-slate-200 px-2 py-2 text-right uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                    Gastos total
                                                </td>
                                                <td
                                                    colSpan={2}
                                                    className="border border-slate-200 px-2 py-2 text-slate-800 dark:border-slate-700 dark:text-slate-100"
                                                >
                                                    S/{" "}
                                                    {gastosComprasTotal.toFixed(
                                                        2,
                                                    )}
                                                </td>
                                                <td className="border border-slate-200 dark:border-slate-700" />
                                            </tr>
                                        </tbody>
                                    </table>
                                    </div>
                                    <div className="flex justify-end border-t border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/20">
                                        <button
                                            type="button"
                                            onClick={addStaffRow}
                                            className={`${tableActionBtnClass} bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600`}
                                        >
                                            + Agregar fila
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen financiero */}
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                    <span className={labelClass}>
                                        Ventas por método
                                    </span>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                            Venta Visa
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={ventaVisa}
                                            onChange={(e) =>
                                                setVentaVisa(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                            Venta Yape
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={ventaYape}
                                            onChange={(e) =>
                                                setVentaYape(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                            Venta Efectivo
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={ventaEfectivo}
                                            onChange={(e) =>
                                                setVentaEfectivo(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </label>
                                </div>

                                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                    <span className={labelClass}>Totales</span>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                            Total venta
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={totalVenta}
                                            onChange={(e) =>
                                                setTotalVenta(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                            Total de gastos
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={totalGastos}
                                            onChange={(e) =>
                                                setTotalGastos(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                            Venta neta
                                        </span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={ventaNeta}
                                            onChange={(e) =>
                                                setVentaNeta(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Observaciones */}
                            <label className="flex flex-col gap-1.5">
                                <span className={labelClass}>
                                    Observaciones
                                </span>
                                <textarea
                                    value={observaciones}
                                    onChange={(e) =>
                                        setObservaciones(e.target.value)
                                    }
                                    rows={4}
                                    className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-500"
                                    placeholder="Promociones, cortesías, cumpleaños, activaciones DJ, etc."
                                />
                            </label>
                        </div>
                </div>

                <div className="flex gap-3 border-t border-slate-100 bg-slate-50/30 p-4 dark:border-slate-800/50 dark:bg-slate-800/10 sm:p-6">
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
                        onClick={() =>
                            onConfirm(
                                buildSheetSubmitInput(
                                    caja,
                                    ventaVisa,
                                    ventaYape,
                                    ventaEfectivo,
                                    totalVenta,
                                    totalGastos,
                                    ventaNeta,
                                    pagosTotal,
                                    gastosComprasTotal,
                                    observaciones,
                                    staffRows,
                                ),
                            )
                        }
                        disabled={loading}
                        className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                <span>Cerrando caja...</span>
                            </div>
                        ) : (
                            "Cerrar caja"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CashClosureSheetModal;
