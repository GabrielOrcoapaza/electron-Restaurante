/**
 * Genera y descarga el reporte de cierre de caja como PDF A4.
 * Electron: guarda en Descargas / Downloads vía IPC (sin ventanas emergentes).
 */

import {
    buildCashClosureReportFilename,
    buildCashClosureReportHtml,
    type CashClosureDetailData,
} from "./cashClosureReportHtml";
import {
    invokeElectronDownloadHtmlA4Pdf,
    isElectronRenderer,
} from "./electronPrint";

export async function downloadCashClosureReportPdf(
    detail: CashClosureDetailData,
): Promise<{ ok: boolean; message?: string }> {
    const html = buildCashClosureReportHtml(detail);
    const filename = buildCashClosureReportFilename(detail.closureNumber);

    if (!isElectronRenderer()) {
        return {
            ok: false,
            message:
                "La descarga del PDF solo funciona en SumApp escritorio (Windows). No use el navegador web.",
        };
    }

    const result = await invokeElectronDownloadHtmlA4Pdf(html, filename);
    if (!result.ok) {
        return {
            ok: false,
            message:
                result.message ||
                "No se pudo descargar el PDF. Cierre y vuelva a abrir SumApp.",
        };
    }

    return {
        ok: true,
        message:
            result.message || `PDF guardado en Descargas: ${filename}`,
    };
}
