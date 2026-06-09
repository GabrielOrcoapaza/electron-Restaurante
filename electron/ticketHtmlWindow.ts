/**
 * Ventana oculta para renderizar ticket HTML (impresión y PDF).
 * printToPDF requiere ventana pintada; offscreen suele dejar PDF en blanco.
 */

import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import log from "electron-log";
import { documentDataJsonToHtml } from "./documentToPrintHtml";

export const TICKET_PAPER_WIDTH_MM = 72;

export function ticketViewportPx(): number {
    return Math.round((TICKET_PAPER_WIDTH_MM * 96) / 25.4);
}

async function waitForTicketRender(win: BrowserWindow): Promise<void> {
    await new Promise((r) => setTimeout(r, 450));
    await win.webContents.executeJavaScript(`
        new Promise(resolve => {
            const ready = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
            document.fonts?.ready ? document.fonts.ready.then(ready) : ready();
        })
    `);
    await win.webContents.executeJavaScript(`
        Promise.all(Array.from(document.images || []).map(img =>
            img.complete
                ? Promise.resolve()
                : new Promise(r => { img.onload = () => r(undefined); img.onerror = () => r(undefined); })
        ))
    `);
    await new Promise((r) => setTimeout(r, 350));
}

export async function measureTicketContentHeightPx(
    win: BrowserWindow,
): Promise<number> {
    const measured: number = await win.webContents.executeJavaScript(`
        (() => {
            const body = document.body;
            if (!body) return 400;
            const scrollH = Math.max(
                document.documentElement.scrollHeight || 0,
                body.scrollHeight || 0,
                body.offsetHeight || 0,
            );
            let bottom = body.getBoundingClientRect().bottom;
            for (const el of body.querySelectorAll("*")) {
                const r = el.getBoundingClientRect();
                if (r.height > 0) bottom = Math.max(bottom, r.bottom);
            }
            const boundsH = Math.ceil(bottom - body.getBoundingClientRect().top + 24);
            const h = Math.max(scrollH, boundsH);
            return Number.isFinite(h) && h > 0 ? h : 400;
        })()
    `);
    return Math.max(200, Math.min(measured || 400, 8000));
}

export type TicketHtmlWindow = {
    win: BrowserWindow;
    tmpPath: string;
    contentHeightPx: number;
    cleanup: () => void;
};

/** Carga HTML del ticket, redimensiona y pinta fuera de pantalla (sin offscreen). */
export async function openTicketHtmlWindow(
    html: string,
    parentWin?: BrowserWindow | null,
): Promise<TicketHtmlWindow> {
    const receiptViewportPx = ticketViewportPx();
    const tmpPath = path.join(os.tmpdir(), `sumapp-ticket-${Date.now()}.html`);
    fs.writeFileSync(tmpPath, html, "utf8");

    const win = new BrowserWindow({
        show: false,
        skipTaskbar: true,
        width: receiptViewportPx,
        height: 1200,
        backgroundColor: "#ffffff",
        parent:
            parentWin && !parentWin.isDestroyed() ? parentWin : undefined,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    const cleanup = () => {
        try {
            fs.unlinkSync(tmpPath);
        } catch {
            /* ignore */
        }
        if (!win.isDestroyed()) win.destroy();
    };

    await new Promise<void>((resolve, reject) => {
        const t = setTimeout(
            () => reject(new Error("Timeout cargando comprobante")),
            60000,
        );
        win.webContents.once("did-finish-load", () => {
            clearTimeout(t);
            resolve();
        });
        win.webContents.once("did-fail-load", (_e, _c, desc) => {
            clearTimeout(t);
            reject(new Error(desc));
        });
        win.loadFile(tmpPath).catch(reject);
    });

    await waitForTicketRender(win);

    let contentHeightPx = await measureTicketContentHeightPx(win);
    const viewHeight = Math.max(200, Math.min(contentHeightPx + 48, 8000));
    win.setContentSize(receiptViewportPx, viewHeight);

    // Fuera de pantalla pero pintada (printToPDF no captura bien con offscreen/show:false puro).
    win.setBounds({
        x: -10000,
        y: -10000,
        width: receiptViewportPx,
        height: viewHeight,
    });
    win.showInactive();
    await new Promise((r) => setTimeout(r, 900));

    contentHeightPx = await measureTicketContentHeightPx(win);
    log.info(`[ticket-window] alto contenido: ${contentHeightPx}px (ventana ${viewHeight}px)`);

    return { win, tmpPath, contentHeightPx, cleanup };
}

export async function openTicketHtmlWindowFromJson(
    documentJson: string,
    parentWin?: BrowserWindow | null,
): Promise<TicketHtmlWindow> {
    const html = await documentDataJsonToHtml(documentJson);
    return openTicketHtmlWindow(html, parentWin);
}

function pdfHasVisibleText(pdfBuffer: Buffer): boolean {
    const raw = pdfBuffer.toString("latin1");
    if (raw.includes("Tj") || raw.includes("TJ")) return true;
    // Operadores de texto alternativos en PDF generados por Chromium
    return /\/F\d+\s+\d+\s+Tf/.test(raw) && raw.length > 4000;
}

export async function ticketWindowToPdfBuffer(
    session: TicketHtmlWindow,
): Promise<Buffer> {
    const { win, contentHeightPx } = session;
    const heightMicrons =
        Math.ceil((contentHeightPx * 25.4 * 1000) / 96) + 5000;

    const strategies: Array<() => Promise<Buffer>> = [
        () =>
            win.webContents.printToPDF({
                printBackground: true,
                preferCSSPageSize: true,
                margins: { marginType: "none" },
            }),
        () =>
            win.webContents.printToPDF({
                printBackground: true,
                preferCSSPageSize: false,
                pageSize: {
                    width: TICKET_PAPER_WIDTH_MM * 1000,
                    height: heightMicrons,
                },
                margins: { marginType: "none" },
            }),
        () =>
            win.webContents.printToPDF({
                printBackground: true,
                preferCSSPageSize: false,
                pageSize: "A4",
                margins: { marginType: "default" },
            }),
    ];

    let last: Buffer | null = null;
    for (let i = 0; i < strategies.length; i += 1) {
        const pdfBuffer = await strategies[i]();
        last = pdfBuffer;
        log.info(
            `[ticket-window] printToPDF estrategia ${i + 1}: ${pdfBuffer.length} bytes, texto=${pdfHasVisibleText(pdfBuffer)}`,
        );
        if (pdfHasVisibleText(pdfBuffer)) return pdfBuffer;
    }

    return last ?? Buffer.alloc(0);
}

export async function documentJsonToPdfBuffer(
    documentJson: string,
    parentWin?: BrowserWindow | null,
): Promise<Buffer> {
    const session = await openTicketHtmlWindowFromJson(documentJson, parentWin);
    try {
        const pdfBuffer = await ticketWindowToPdfBuffer(session);
        if (!pdfBuffer.length) {
            throw new Error("No se pudo generar el PDF.");
        }
        if (!pdfHasVisibleText(pdfBuffer)) {
            throw new Error(
                "El PDF se generó vacío. Intente de nuevo o reinicie SumApp.",
            );
        }
        return pdfBuffer;
    } finally {
        session.cleanup();
    }
}
