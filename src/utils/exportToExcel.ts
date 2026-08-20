import * as XLSX from "xlsx";
import {
    invokeElectronDownloadExcelFile,
    isElectronRenderer,
} from "./electronPrint";

export type ExcelRow = Record<string, string | number | boolean | null | undefined>;

export type ExcelSheet = {
    name: string;
    rows: ExcelRow[];
};

export type ExportToExcelOptions = {
    filename: string;
    sheets: ExcelSheet[];
};

export type ExportToExcelResult = {
    savedPath?: string;
    message?: string;
};

function sanitizeSheetName(name: string): string {
    return name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Reporte";
}

function sanitizeFilename(filename: string): string {
    return filename.replace(/[<>:"/\\|?*]+/g, "-").trim() || "reporte";
}

function buildWorkbook(sheets: ExcelSheet[]): XLSX.WorkBook {
    const validSheets = sheets.filter((sheet) => sheet.rows.length > 0);
    if (validSheets.length === 0) {
        throw new Error("No hay datos para exportar.");
    }

    const workbook = XLSX.utils.book_new();

    for (const sheet of validSheets) {
        const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            sanitizeSheetName(sheet.name),
        );
    }

    return workbook;
}

export async function exportToExcel({
    filename,
    sheets,
}: ExportToExcelOptions): Promise<ExportToExcelResult> {
    const workbook = buildWorkbook(sheets);
    const safeFilename = `${sanitizeFilename(filename)}.xlsx`;

    if (isElectronRenderer()) {
        const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
        const result = await invokeElectronDownloadExcelFile(base64, safeFilename);
        if (!result.ok) {
            throw new Error(
                result.message ||
                    "No se pudo guardar el Excel en Descargas. Cierre y vuelva a abrir SumApp.",
            );
        }
        return {
            savedPath: result.path,
            message: result.message,
        };
    }

    XLSX.writeFile(workbook, safeFilename);
    return {
        message: `Archivo descargado: ${safeFilename}`,
    };
}
