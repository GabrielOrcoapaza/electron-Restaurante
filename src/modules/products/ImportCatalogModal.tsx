import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@apollo/client";
import { BULK_IMPORT_CATALOG } from "../../graphql/mutations";
import {
    downloadCatalogImportTemplate,
    readFileAsBase64,
    validateCatalogExcelHeaders,
    CATALOG_IMPORT_HEADERS,
} from "./importCatalogExcel";

interface ImportCatalogModalProps {
    branchId: string;
    branchName: string;
    onClose: () => void;
    onImported: () => void;
}

type ImportResult = {
    success: boolean;
    message: string;
    createdCategories: number;
    createdSubcategories: number;
    createdModifiers: number;
    createdProducts: number;
    updatedProducts: number;
    errors: string[];
};

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const ImportCatalogModal: React.FC<ImportCatalogModalProps> = ({
    branchId,
    branchName,
    onClose,
    onImported,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState("");
    const [dataRowCount, setDataRowCount] = useState<number | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [validating, setValidating] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);

    const [bulkImportCatalog, { loading: submitting }] =
        useMutation(BULK_IMPORT_CATALOG);

    const handleDownloadTemplate = async () => {
        setDownloading(true);
        try {
            await downloadCatalogImportTemplate(branchName);
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
        setResult(null);
        setParseError(null);
        setDataRowCount(null);
        setSelectedFile(null);

        if (!file.name.toLowerCase().match(/\.xlsx?$/)) {
            setParseError("Use un archivo Excel (.xlsx).");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setValidating(true);
        try {
            const check = await validateCatalogExcelHeaders(file);
            if (!check.ok) {
                setParseError(check.message || "Archivo no válido.");
                return;
            }
            setDataRowCount(check.dataRowCount ?? 0);
            setSelectedFile(file);
        } catch (err: unknown) {
            setParseError(getErrorMessage(err, "No se pudo leer el archivo."));
        } finally {
            setValidating(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleConfirm = async () => {
        if (!selectedFile) return;
        try {
            const excelBase64 = await readFileAsBase64(selectedFile);
            const { data } = await bulkImportCatalog({
                variables: { branchId, excelBase64 },
            });
            const res = data?.bulkImportCatalog;
            if (!res) {
                alert("No se recibió respuesta del servidor.");
                return;
            }
            const importResult: ImportResult = {
                success: !!res.success,
                message: res.message || "",
                createdCategories: res.createdCategories ?? 0,
                createdSubcategories: res.createdSubcategories ?? 0,
                createdModifiers: res.createdModifiers ?? 0,
                createdProducts: res.createdProducts ?? 0,
                updatedProducts: res.updatedProducts ?? 0,
                errors: res.errors ?? [],
            };
            setResult(importResult);
            if (
                importResult.success &&
                (importResult.createdProducts > 0 ||
                    importResult.updatedProducts > 0 ||
                    importResult.createdCategories > 0)
            ) {
                onImported();
            }
        } catch (err: unknown) {
            alert(getErrorMessage(err, "Error al importar el catálogo."));
        }
    };

    const modal = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                            Importar catálogo desde Excel
                        </h2>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                            Sede: {branchName}. Mismas columnas que la carga masiva del
                            admin Django.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {!result ? (
                        <>
                            <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                                <p className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                    1. Descarga la plantilla, completa tus productos y
                                    guárdala como .xlsx.
                                </p>
                                <p className="mb-3 text-xs font-bold text-slate-400">
                                    Ingredientes: deje{" "}
                                    <span className="font-mono">categoria</span> y{" "}
                                    <span className="font-mono">subcategoria</span>{" "}
                                    vacías y use{" "}
                                    <span className="font-mono">tipo = Ingrediente</span>.
                                    Platos y bebidas sí requieren categoría y
                                    subcategoría.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    disabled={downloading}
                                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-700 disabled:opacity-40"
                                >
                                    {downloading
                                        ? "Generando..."
                                        : "Descargar plantilla"}
                                </button>
                            </div>

                            <div className="mb-6 rounded-2xl border border-slate-100 p-5 dark:border-slate-800">
                                <p className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                    2. Selecciona el archivo Excel
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-xs file:font-black file:text-indigo-700"
                                />
                                {validating && (
                                    <p className="mt-2 text-xs font-bold text-slate-400">
                                        Validando archivo…
                                    </p>
                                )}
                                {fileName && !parseError && selectedFile && (
                                    <p className="mt-2 text-xs font-bold text-emerald-600">
                                        {fileName} — {dataRowCount ?? 0} fila(s) de
                                        datos detectadas
                                    </p>
                                )}
                                {parseError && (
                                    <p className="mt-2 text-xs font-bold text-rose-500">
                                        {parseError}
                                    </p>
                                )}
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                                <table className="w-full min-w-[520px] text-left text-xs">
                                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800">
                                        <tr>
                                            <th className="px-3 py-2">Columna</th>
                                            <th className="px-3 py-2">Obligatorio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        <tr>
                                            <td className="px-3 py-2 font-mono">
                                                categoria
                                            </td>
                                            <td className="px-3 py-2">
                                                Solo platos / bebidas
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 font-mono">
                                                subcategoria
                                            </td>
                                            <td className="px-3 py-2">
                                                Solo platos / bebidas
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 font-mono">
                                                codigo, nombre
                                            </td>
                                            <td className="px-3 py-2">Sí</td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 font-mono">
                                                {CATALOG_IMPORT_HEADERS.slice(4).join(", ")}
                                            </td>
                                            <td className="px-3 py-2">Opcional</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div
                                className={`rounded-2xl border p-4 ${
                                    result.success
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                                        : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40"
                                }`}
                            >
                                <p className="text-sm font-bold">{result.message}</p>
                                <ul className="mt-2 list-inside list-disc text-xs font-medium">
                                    <li>{result.createdCategories} categorías nuevas</li>
                                    <li>
                                        {result.createdSubcategories} subcategorías
                                        nuevas
                                    </li>
                                    <li>{result.createdModifiers} modificadores nuevos</li>
                                    <li>{result.createdProducts} productos creados</li>
                                    <li>{result.updatedProducts} productos actualizados</li>
                                </ul>
                            </div>
                            {result.errors.length > 0 && (
                                <div className="max-h-48 overflow-y-auto rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                                    <p className="mb-2 text-xs font-black uppercase text-amber-800 dark:text-amber-200">
                                        Avisos por fila ({result.errors.length})
                                    </p>
                                    <ul className="space-y-1 text-xs font-medium text-amber-900 dark:text-amber-100">
                                        {result.errors.slice(0, 30).map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                        {result.errors.length > 30 && (
                                            <li>
                                                … y {result.errors.length - 30} más
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 p-6 dark:border-slate-800">
                    {!result ? (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={
                                    !selectedFile ||
                                    submitting ||
                                    validating ||
                                    !!parseError
                                }
                                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700 disabled:opacity-40"
                            >
                                {submitting ? "Importando…" : "Subir y procesar"}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700"
                        >
                            Cerrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
};

export default ImportCatalogModal;
