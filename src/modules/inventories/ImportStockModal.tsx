import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@apollo/client";
import { BULK_IMPORT_STOCK } from "../../graphql/mutations";
import {
    downloadStockImportTemplate,
    getImportableProducts,
    parseStockImportExcel,
    type ImportableProduct,
    type StockImportParseError,
    type StockImportRow,
} from "./importStockExcel";

interface ImportStockModalProps {
    branchId: string;
    branchName: string;
    products: ImportableProduct[];
    onClose: () => void;
    onImported: () => void;
}

type RowResult = {
    row: number;
    productCode: string;
    success: boolean;
    message: string;
    oldQuantity?: number | null;
    newQuantity?: number | null;
    oldSalePrice?: number | null;
    newSalePrice?: number | null;
};

const formatNumber = (value: number | null | undefined) => {
    const n = Number(value);
    if (isNaN(n)) return "—";
    return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const ImportStockModal: React.FC<ImportStockModalProps> = ({
    branchId,
    branchName,
    products,
    onClose,
    onImported,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string>("");
    const [parsedRows, setParsedRows] = useState<StockImportRow[]>([]);
    const [parseErrors, setParseErrors] = useState<StockImportParseError[]>([]);
    const [reason, setReason] = useState<string>("");
    const [downloading, setDownloading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [results, setResults] = useState<RowResult[] | null>(null);
    const [summary, setSummary] = useState<string>("");

    const [bulkImportStock, { loading: submitting }] = useMutation(BULK_IMPORT_STOCK);

    const importableProducts = useMemo(
        () => getImportableProducts(products),
        [products],
    );
    const productByCode = useMemo(() => {
        const map = new Map<string, ImportableProduct>();
        for (const p of products) map.set(p.code, p);
        return map;
    }, [products]);

    const handleDownloadTemplate = async () => {
        setDownloading(true);
        try {
            await downloadStockImportTemplate(products, branchName);
        } catch (err: unknown) {
            alert(getErrorMessage(err, "No se pudo generar la plantilla."));
        } finally {
            setDownloading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setResults(null);
        setSummary("");
        setParsing(true);
        try {
            const { rows, errors } = await parseStockImportExcel(file);
            setParsedRows(rows);
            setParseErrors(errors);
        } catch (err: unknown) {
            setParsedRows([]);
            setParseErrors([{ rowNumber: 0, message: getErrorMessage(err, "No se pudo leer el archivo.") }]);
        } finally {
            setParsing(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleConfirm = async () => {
        if (parsedRows.length === 0) return;
        try {
            const { data } = await bulkImportStock({
                variables: {
                    branchId,
                    reason: reason.trim() || undefined,
                    rows: parsedRows.map((r) => ({
                        productCode: r.productCode,
                        newQuantity: r.newQuantity,
                        unitCost: r.unitCost,
                        salePrice: r.salePrice,
                    })),
                },
            });
            const res = data?.bulkImportStock;
            if (!res) {
                alert("No se recibió respuesta del servidor.");
                return;
            }
            if (!res.success) {
                alert(res.message || "No se pudo importar el stock.");
                return;
            }
            setResults(res.results || []);
            setSummary(res.message || "");
            onImported();
        } catch (err: unknown) {
            alert(getErrorMessage(err, "Error al importar el stock."));
        }
    };

    const modal = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                            Importar stock desde Excel
                        </h2>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                            Solo administrador. Aplica a ingredientes y bebidas con control de stock.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {!results ? (
                        <>
                            {/* Paso 1: descargar plantilla */}
                            <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                                <p className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                    1. Descarga la plantilla con los productos actuales ({importableProducts.length} elegibles), llena{" "}
                                    <span className="font-mono">cantidad_nueva</span> con el conteo físico real y guárdala.
                                </p>
                                <p className="mb-3 text-xs font-bold text-slate-400">
                                    <span className="font-mono">costo_unitario</span> y{" "}
                                    <span className="font-mono">precio_venta_nuevo</span> son opcionales: si los dejas vacíos no se
                                    tocan (el costo se infiere del actual). Si llenas <span className="font-mono">precio_venta_nuevo</span>,
                                    se actualiza el precio de venta del producto.
                                </p>
                                <button
                                    onClick={handleDownloadTemplate}
                                    disabled={downloading || importableProducts.length === 0}
                                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-700 disabled:opacity-40"
                                >
                                    {downloading ? "Generando..." : "Descargar plantilla"}
                                </button>
                                {importableProducts.length === 0 && (
                                    <p className="mt-2 text-xs font-bold text-rose-500">
                                        No hay productos con control de stock activo en esta sede.
                                    </p>
                                )}
                            </div>

                            {/* Paso 2: subir el archivo lleno */}
                            <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                                <p className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                    2. Sube la plantilla ya llena.
                                </p>
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                    {parsing ? "Leyendo..." : "Elegir archivo Excel"}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </label>
                                {fileName && (
                                    <span className="ml-3 text-xs font-bold text-slate-400">{fileName}</span>
                                )}

                                {parseErrors.length > 0 && (
                                    <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-900/10">
                                        <p className="mb-1 text-xs font-black text-rose-600">
                                            {parseErrors.length} fila(s) con problemas (no se importarán):
                                        </p>
                                        <ul className="max-h-24 overflow-y-auto text-xs text-rose-500">
                                            {parseErrors.map((e, i) => (
                                                <li key={i}>• {e.message}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Preview */}
                            {parsedRows.length > 0 && (
                                <div className="mb-6">
                                    <div className="mb-3 flex items-center justify-between">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                            Vista previa ({parsedRows.length} filas)
                                        </p>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <table className="w-full text-left text-xs">
                                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    <th className="px-4 py-2">Código</th>
                                                    <th className="px-4 py-2">Producto</th>
                                                    <th className="px-4 py-2 text-right">Stock actual</th>
                                                    <th className="px-4 py-2 text-right">Cantidad nueva</th>
                                                    <th className="px-4 py-2 text-right">Costo unit.</th>
                                                    <th className="px-4 py-2 text-right">Precio venta</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                                {parsedRows.map((r) => {
                                                    const product = productByCode.get(r.productCode);
                                                    const notFound = !product;
                                                    return (
                                                        <tr key={r.rowNumber}>
                                                            <td className="px-4 py-2 font-mono font-bold text-slate-500">
                                                                {r.productCode}
                                                            </td>
                                                            <td className="px-4 py-2 font-bold text-slate-700 dark:text-slate-200">
                                                                {notFound ? (
                                                                    <span className="text-rose-500">No encontrado en esta sede</span>
                                                                ) : (
                                                                    product?.name
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-right text-slate-400">
                                                                {formatNumber(product?.currentStock)}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-black text-indigo-600 dark:text-indigo-400">
                                                                {formatNumber(r.newQuantity)}
                                                            </td>
                                                            <td className="px-4 py-2 text-right text-slate-400">
                                                                {r.unitCost ? formatNumber(r.unitCost) : "—"}
                                                            </td>
                                                            <td className="px-4 py-2 text-right text-slate-400">
                                                                {r.salePrice ? (
                                                                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                                                                        {formatNumber(r.salePrice)}
                                                                    </span>
                                                                ) : (
                                                                    "—"
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {parsedRows.length > 0 && (
                                <div>
                                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Motivo (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="Ej: Inventario físico mensual"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div>
                            <p className="mb-4 text-sm font-black text-slate-700 dark:text-slate-200">
                                {summary}
                            </p>
                            <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                                <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <th className="px-4 py-2">Código</th>
                                            <th className="px-4 py-2">Stock antes → después</th>
                                            <th className="px-4 py-2">Precio antes → después</th>
                                            <th className="px-4 py-2">Resultado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {results.map((r) => (
                                            <tr key={r.row}>
                                                <td className="px-4 py-2 font-mono font-bold text-slate-500">
                                                    {r.productCode}
                                                </td>
                                                <td className="px-4 py-2 text-slate-500">
                                                    {r.oldQuantity != null && r.newQuantity != null
                                                        ? `${formatNumber(r.oldQuantity)} → ${formatNumber(r.newQuantity)}`
                                                        : "—"}
                                                </td>
                                                <td className="px-4 py-2 text-slate-500">
                                                    {r.oldSalePrice != null && r.newSalePrice != null
                                                        ? `${formatNumber(r.oldSalePrice)} → ${formatNumber(r.newSalePrice)}`
                                                        : "—"}
                                                </td>
                                                <td
                                                    className={`px-4 py-2 font-bold ${
                                                        r.success ? "text-emerald-600" : "text-rose-500"
                                                    }`}
                                                >
                                                    {r.message}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-6 dark:border-slate-800">
                    {results ? (
                        <button
                            onClick={onClose}
                            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700"
                        >
                            Cerrar
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={parsedRows.length === 0 || submitting}
                                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700 disabled:opacity-40"
                            >
                                {submitting ? "Importando..." : `Confirmar importación (${parsedRows.length})`}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
};

export default ImportStockModal;
