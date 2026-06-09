/**
 * Genera y descarga un comprobante emitido como PDF.
 * Electron: guarda en Descargas vía IPC (sin ventanas de vista previa).
 * Navegador web: no soportado (use SumApp escritorio).
 */

import {
    invokeElectronDownloadDocumentPdf,
    isElectronRenderer,
} from "./electronPrint";

export async function downloadIssuedDocumentPdf(
    documentJson: string,
    filename: string,
): Promise<{ ok: boolean; message?: string }> {
    const json = String(documentJson || "").trim();
    if (!json) {
        return { ok: false, message: "No hay datos del comprobante." };
    }

    if (!isElectronRenderer()) {
        return {
            ok: false,
            message:
                "La descarga de PDF solo funciona en SumApp escritorio (Windows). No use el navegador web.",
        };
    }

    const result = await invokeElectronDownloadDocumentPdf(json, filename);
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
