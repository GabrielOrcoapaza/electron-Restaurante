/**
 * Vista previa PDF del comprobante (document_data) antes de imprimir en caja.
 */

import { ipcMain, BrowserWindow } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import log from "electron-log";
import { documentDataJsonToHtml } from "./documentToPrintHtml";

const PAPER_WIDTH_MM = 80;

async function loadHtmlInHiddenWindow(htmlPath: string): Promise<BrowserWindow> {
    const receiptViewportPx = Math.round((PAPER_WIDTH_MM * 96) / 25.4);
    const win = new BrowserWindow({
        show: false,
        width: receiptViewportPx,
        height: 4000,
        backgroundColor: "#ffffff",
        webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Timeout cargando vista previa")), 60000);
        win.webContents.once("did-finish-load", () => {
            clearTimeout(t);
            resolve();
        });
        win.webContents.once("did-fail-load", (_e, _c, desc) => {
            clearTimeout(t);
            reject(new Error(desc));
        });
        win.loadFile(htmlPath).catch(reject);
    });

    await new Promise((r) => setTimeout(r, 400));
    await win.webContents.executeJavaScript(`
        new Promise(resolve => {
            const ready = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
            document.fonts?.ready ? document.fonts.ready.then(ready) : ready();
        })
    `);

    return win;
}

async function documentJsonToPdfBase64(documentJson: string): Promise<string> {
    const html = await documentDataJsonToHtml(documentJson);
    const tmp = path.join(os.tmpdir(), `sumapp-preview-${Date.now()}.html`);
    fs.writeFileSync(tmp, html, "utf8");

    let win: BrowserWindow | null = null;
    try {
        win = await loadHtmlInHiddenWindow(tmp);
        const contentHeightPx: number = await win.webContents.executeJavaScript(
            `document.documentElement.scrollHeight || document.body.scrollHeight`,
        );
        const heightMicrons =
            Math.ceil((contentHeightPx * 25.4 * 1000) / 96) + 8000;

        const pdfBuffer = await win.webContents.printToPDF({
            printBackground: true,
            pageSize: {
                width: PAPER_WIDTH_MM * 1000,
                height: heightMicrons,
            },
            margins: { marginType: "none" },
        });

        return pdfBuffer.toString("base64");
    } finally {
        try {
            fs.unlinkSync(tmp);
        } catch {
            /* ignore */
        }
        if (win && !win.isDestroyed()) win.destroy();
    }
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
                const html = await documentDataJsonToHtml(documentJson);
                return { ok: true, html };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error("[preview] Error generando HTML:", msg);
                return { ok: false, message: msg };
            }
        },
    );

    log.info("[main] Handlers de vista previa: document-json-to-pdf, document-json-to-html");
}
