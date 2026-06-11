/**
 * Genera PDF del comprobante capturando el ticket HTML como imagen fiable en Windows.
 */

import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import log from "electron-log";
import { documentDataJsonToHtml } from "./documentToPrintHtml";
import { pngBufferToPdfBuffer } from "./pngToPdf";

export const TICKET_PAPER_WIDTH_MM = 72;

export function ticketViewportPx(): number {
    return Math.round((TICKET_PAPER_WIDTH_MM * 96) / 25.4);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sanitizeDocumentJsonForPdf(documentJson: string): string {
    try {
        const doc = JSON.parse(documentJson) as Record<string, unknown>;
        delete doc.logo_url;
        delete doc.logo;
        return JSON.stringify(doc);
    } catch {
        return documentJson;
    }
}

async function measureContentHeight(win: BrowserWindow): Promise<number> {
    const h: number = await win.webContents.executeJavaScript(`
        Math.max(
            document.body?.scrollHeight || 0,
            document.documentElement?.scrollHeight || 0,
            400
        )
    `);
    return Math.max(200, Math.min(Number(h) || 400, 8000));
}

async function measureTextLength(win: BrowserWindow): Promise<number> {
    const len: number = await win.webContents.executeJavaScript(`
        (document.body?.innerText || "").trim().length
    `);
    return Number.isFinite(len) ? len : 0;
}

function pngHasContent(pngBuffer: Buffer): boolean {
    if (pngBuffer.length < 500) return false;
    let dark = 0;
    for (let i = 0; i < pngBuffer.length; i += 97) {
        if (pngBuffer[i] < 250) dark += 1;
    }
    return dark > 8;
}

async function loadTicketHtml(
    win: BrowserWindow,
    html: string,
): Promise<string> {
    const tmpPath = path.join(
        os.tmpdir(),
        `sumapp-ticket-${Date.now()}.html`,
    );
    fs.writeFileSync(tmpPath, html, "utf8");

    await new Promise<void>((resolve, reject) => {
        const t = setTimeout(
            () => reject(new Error("Timeout cargando comprobante")),
            30000,
        );
        win.webContents.once("did-finish-load", () => {
            clearTimeout(t);
            resolve();
        });
        win.webContents.once("did-fail-load", (_e, _c, desc) => {
            clearTimeout(t);
            reject(new Error(desc || "Error cargando HTML"));
        });
        win.loadFile(tmpPath).catch(reject);
    });

    await win.webContents.executeJavaScript(`
        new Promise(resolve => {
            const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
            document.fonts?.ready ? document.fonts.ready.then(done) : done();
        })
    `);

    return tmpPath;
}

export async function documentJsonToPdfBuffer(
    documentJson: string,
    _parentWin?: BrowserWindow | null,
): Promise<Buffer> {
    const html = await documentDataJsonToHtml(
        sanitizeDocumentJsonForPdf(documentJson),
    );
    const widthPx = ticketViewportPx();
    let tmpPath = "";

    const win = new BrowserWindow({
        show: false,
        skipTaskbar: true,
        width: widthPx,
        height: 900,
        backgroundColor: "#ffffff",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            backgroundThrottling: false,
        },
    });

    try {
        tmpPath = await loadTicketHtml(win, html);
        await delay(400);

        const contentHeight = await measureContentHeight(win);
        const viewHeight = Math.min(contentHeight + 24, 8000);
        win.setContentSize(widthPx, viewHeight);

        // Visible y pintada; fuera de pantalla para no molestar al usuario.
        win.setBounds({
            x: -widthPx - 200,
            y: 0,
            width: widthPx + 16,
            height: viewHeight + 16,
        });
        win.show();
        win.webContents.invalidate();
        await delay(Math.min(1200 + Math.floor(contentHeight / 5), 3000));

        const textLen = await measureTextLength(win);
        log.info(
            `[ticket-pdf] ${contentHeight}px alto, ${textLen} chars de texto`,
        );
        if (textLen < 15) {
            throw new Error(
                "El comprobante no tiene contenido para generar el PDF.",
            );
        }

        const image = await win.webContents.capturePage({
            x: 0,
            y: 0,
            width: widthPx,
            height: viewHeight,
        });
        const pngBuffer = image.toPNG();
        if (!pngHasContent(pngBuffer)) {
            throw new Error(
                "La captura del comprobante salió en blanco. Intente de nuevo.",
            );
        }

        const pdfBuffer = await pngBufferToPdfBuffer(pngBuffer);
        if (
            pdfBuffer.length < 800 ||
            pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-"
        ) {
            throw new Error(
                "El PDF se generó vacío. Intente de nuevo o reinicie SumApp.",
            );
        }

        log.info(`[ticket-pdf] OK (${pdfBuffer.length} bytes)`);
        return pdfBuffer;
    } finally {
        try {
            if (tmpPath) fs.unlinkSync(tmpPath);
        } catch {
            /* ignore */
        }
        if (!win.isDestroyed()) win.destroy();
    }
}

export async function measureTicketContentHeightPx(
    win: BrowserWindow,
): Promise<number> {
    return measureContentHeight(win);
}

export type TicketHtmlWindow = {
    win: BrowserWindow;
    tmpPath: string;
    contentHeightPx: number;
    cleanup: () => void;
};

export async function openTicketHtmlWindowFromJson(
    documentJson: string,
    parentWin?: BrowserWindow | null,
): Promise<TicketHtmlWindow> {
    void parentWin;
    const html = await documentDataJsonToHtml(
        sanitizeDocumentJsonForPdf(documentJson),
    );
    const widthPx = ticketViewportPx();
    const win = new BrowserWindow({
        show: false,
        width: widthPx,
        height: 900,
        webPreferences: { webSecurity: false, backgroundThrottling: false },
    });
    const tmpPath = await loadTicketHtml(win, html);
    const contentHeightPx = await measureContentHeight(win);
    return {
        win,
        tmpPath,
        contentHeightPx,
        cleanup: () => {
            try {
                fs.unlinkSync(tmpPath);
            } catch {
                /* ignore */
            }
            if (!win.isDestroyed()) win.destroy();
        },
    };
}

export async function openTicketHtmlWindow(
    html: string,
    parentWin?: BrowserWindow | null,
): Promise<TicketHtmlWindow> {
    void parentWin;
    const widthPx = ticketViewportPx();
    const win = new BrowserWindow({
        show: false,
        width: widthPx,
        height: 900,
        webPreferences: { webSecurity: false, backgroundThrottling: false },
    });
    const tmpPath = await loadTicketHtml(win, html);
    const contentHeightPx = await measureContentHeight(win);
    return {
        win,
        tmpPath,
        contentHeightPx,
        cleanup: () => {
            try {
                fs.unlinkSync(tmpPath);
            } catch {
                /* ignore */
            }
            if (!win.isDestroyed()) win.destroy();
        },
    };
}

export async function ticketWindowToPdfBuffer(
    session: TicketHtmlWindow,
): Promise<Buffer> {
    const { win, contentHeightPx } = session;
    const widthPx = ticketViewportPx();
    const viewHeight = Math.min(contentHeightPx + 24, 8000);
    win.setContentSize(widthPx, viewHeight);
    win.setBounds({ x: 50, y: 50, width: widthPx + 16, height: viewHeight + 16 });
    win.show();
    await delay(1000);
    const image = await win.webContents.capturePage({
        x: 0,
        y: 0,
        width: widthPx,
        height: viewHeight,
    });
    return pngBufferToPdfBuffer(image.toPNG());
}
