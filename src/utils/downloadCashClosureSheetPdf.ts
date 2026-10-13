/**
 * Genera y descarga la hoja de cierre de caja como PDF A4.
 */

import {
    buildCashClosureSheetFilename,
    buildCashClosureSheetHtml,
    type CashClosureSheetPdfData,
} from "./cashClosureSheetHtml";
import {
    invokeElectronSaveHtmlA4PdfDialog,
    isElectronRenderer,
} from "./electronPrint";

export async function downloadCashClosureSheetPdf(
    data: CashClosureSheetPdfData,
): Promise<{ ok: boolean; message?: string; cancelled?: boolean }> {
    const html = buildCashClosureSheetHtml(data);
    const filename = buildCashClosureSheetFilename(data.closureNumber);

    if (!isElectronRenderer()) {
        return {
            ok: false,
            message:
                "La descarga del PDF solo funciona en SumApp escritorio (Windows). No use el navegador web.",
        };
    }

    const result = await invokeElectronSaveHtmlA4PdfDialog(html, filename);
    if (result.cancelled) {
        return { ok: false, cancelled: true, message: result.message };
    }
    if (!result.ok) {
        return {
            ok: false,
            message:
                result.message ||
                "No se pudo guardar el PDF. Cierre y vuelva a abrir SumApp.",
        };
    }

    return {
        ok: true,
        message: result.message || `PDF guardado: ${filename}`,
    };
}
