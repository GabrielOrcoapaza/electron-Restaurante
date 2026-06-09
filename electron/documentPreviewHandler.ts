/**
 * Vista previa / descarga PDF del comprobante (document_data).
 */

import { ipcMain, BrowserWindow, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import log from "electron-log";
import {
    documentJsonToPdfBuffer,
} from "./ticketHtmlWindow";

async function documentJsonToPdfBase64(documentJson: string): Promise<string> {
    const parentWin = BrowserWindow.getFocusedWindow();
    const pdfBuffer = await documentJsonToPdfBuffer(documentJson, parentWin);
    return pdfBuffer.toString("base64");
}

function sanitizePdfFilename(filename: string): string {
    const base = path.basename(String(filename || "comprobante.pdf"));
    const withExt = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
    return withExt.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}

function resolveDownloadPath(filename: string): string {
    const safeName = sanitizePdfFilename(filename);
    const downloadsDir = app.getPath("downloads");
    let filePath = path.join(downloadsDir, safeName);
    if (!fs.existsSync(filePath)) return filePath;

    const parsed = path.parse(safeName);
    const stamp = Date.now();
    return path.join(
        downloadsDir,
        `${parsed.name}_${stamp}${parsed.ext || ".pdf"}`,
    );
}

async function saveDocumentPdfToDownloads(
    documentJson: string,
    filename: string,
): Promise<{ ok: boolean; path?: string; message?: string }> {
    const base64 = await documentJsonToPdfBase64(documentJson);
    if (!base64?.trim()) {
        return { ok: false, message: "El PDF generado está vacío." };
    }

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length < 128) {
        return { ok: false, message: "El PDF generado es inválido." };
    }

    const filePath = resolveDownloadPath(filename);
    fs.writeFileSync(filePath, buffer);
    log.info(`[preview] PDF guardado en ${filePath} (${buffer.length} bytes)`);

    return { ok: true, path: filePath };
}

export function registerDocumentPreviewHandler(): void {
    ipcMain.removeHandler("document-json-to-pdf");
    ipcMain.handle(
        "document-json-to-pdf",
        async (_event, payload: { documentJson: string }) => {
            const { documentJson } = payload;
            if (!documentJson?.trim()) {
                return { ok: false, message: "documentJson vacío." };
            }
            try {
                log.info("[preview] Generando PDF del comprobante…");
                const base64 = await documentJsonToPdfBase64(documentJson);
                log.info(`[preview] PDF generado (${base64.length} chars base64)`);
                return { ok: true, base64 };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error("[preview] Error generando PDF:", msg);
                return { ok: false, message: msg };
            }
        },
    );

    ipcMain.removeHandler("document-json-to-html");
    ipcMain.handle(
        "document-json-to-html",
        async (_event, payload: { documentJson: string }) => {
            const { documentJson } = payload;
            if (!documentJson?.trim()) {
                return { ok: false, message: "documentJson vacío." };
            }
            try {
                const { documentDataJsonToHtml } = await import(
                    "./documentToPrintHtml"
                );
                const html = await documentDataJsonToHtml(documentJson);
                return { ok: true, html };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error("[preview] Error generando HTML:", msg);
                return { ok: false, message: msg };
            }
        },
    );

    ipcMain.removeHandler("download-document-pdf");
    ipcMain.handle(
        "download-document-pdf",
        async (_event, payload: { documentJson: string; filename: string }) => {
            const { documentJson, filename } = payload;
            if (!documentJson?.trim()) {
                return { ok: false, message: "documentJson vacío." };
            }
            try {
                log.info("[preview] Descargando PDF del comprobante…");
                const result = await saveDocumentPdfToDownloads(
                    documentJson,
                    filename || "comprobante.pdf",
                );
                if (!result.ok) {
                    return result;
                }
                return {
                    ok: true,
                    path: result.path,
                    message: `PDF guardado en Descargas: ${path.basename(result.path || "")}`,
                };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error("[preview] Error descargando PDF:", msg);
                return { ok: false, message: msg };
            }
        },
    );

    log.info(
        "[main] Handlers de vista previa: document-json-to-pdf, document-json-to-html, download-document-pdf",
    );
}
