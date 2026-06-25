/**
 * Convierte HTML A4 (comprobante SUNAT) a PDF en ventana oculta.
 * Sin offscreen (evita cierres en Windows).
 */

import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import log from "electron-log";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function htmlToA4PdfBuffer(html: string): Promise<Buffer> {
    const tmpPath = path.join(
        os.tmpdir(),
        `sumapp-a4-${Date.now()}.html`,
    );
    fs.writeFileSync(tmpPath, html, "utf8");

    const win = new BrowserWindow({
        show: false,
        skipTaskbar: true,
        width: 794,
        height: 1123,
        backgroundColor: "#ffffff",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            backgroundThrottling: false,
        },
    });

    try {
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error("Timeout generando PDF A4")),
                60000,
            );
            win.webContents.once("did-finish-load", () => {
                clearTimeout(timeout);
                resolve();
            });
            win.webContents.once("did-fail-load", (_e, _c, desc) => {
                clearTimeout(timeout);
                reject(new Error(desc || "Error cargando comprobante A4"));
            });
            win.loadFile(tmpPath).catch(reject);
        });

        await win.webContents.executeJavaScript(`
            new Promise(resolve => {
                const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
                if (document.fonts?.ready) document.fonts.ready.then(done);
                else done();
            })
        `);
        await delay(600);

        const pdfBuffer = await win.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
            margins: { marginType: "default" },
        });

        if (
            !pdfBuffer?.length ||
            pdfBuffer.length < 128 ||
            pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-"
        ) {
            throw new Error("El PDF A4 generado es inválido o está vacío.");
        }

        log.info(`[a4-pdf] OK (${pdfBuffer.length} bytes)`);
        return pdfBuffer;
    } finally {
        try {
            fs.unlinkSync(tmpPath);
        } catch {
            /* ignore */
        }
        if (!win.isDestroyed()) win.destroy();
    }
}
