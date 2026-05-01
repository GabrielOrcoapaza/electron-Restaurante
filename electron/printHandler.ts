/**
 * printHandler.ts
 * Coloca este archivo en el mismo directorio que main.ts
 *
 * En main.ts:
 *   1. Agrega al inicio:
 *        import { registerPrintHandler } from "./printHandler";
 *
 *   2. Dentro de registerIpcHandlers(), reemplaza el bloque
 *      ipcMain.removeHandler("print-json-document") + ipcMain.handle("print-json-document", ...)
 *      por una sola línea:
 *        registerPrintHandler();
 *
 * No requiere dependencias nativas.
 * Usa "copy /b bin USB001" para enviar ESC/POS directo a la impresora.
 */

import { ipcMain, BrowserWindow } from "electron";
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import log from "electron-log";
import { documentJsonToEscPos } from "./documentToEscPos";
import { documentDataJsonToHtml } from "./documentToPrintHtml";
import type { WebContentsPrintOptions } from "electron";

/** Puerto USB raw que funcionó la última vez (1–4); reduce intentos fallidos en cada impresión. */
let lastWindowsUsbIndex: number | null = null;

function writeWindowsUsbDirect(portIndex: number, data: Buffer): boolean {
    const devicePath = `\\\\.\\USB00${portIndex}`;
    let fd: number | undefined;
    try {
        fd = fs.openSync(devicePath, "w");
        fs.writeSync(fd, data);
        return true;
    } catch {
        return false;
    } finally {
        if (fd !== undefined) {
            try {
                fs.closeSync(fd);
            } catch {
                /* ignore */
            }
        }
    }
}

function orderedUsbIndices(): number[] {
    const all = [1, 2, 3, 4] as const;
    if (lastWindowsUsbIndex != null && lastWindowsUsbIndex >= 1 && lastWindowsUsbIndex <= 4) {
        const rest = all.filter((i) => i !== lastWindowsUsbIndex);
        return [lastWindowsUsbIndex, ...rest];
    }
    return [...all];
}

// ─────────────────────────────────────────────────────────────────────────────
// MÉTODO PRINCIPAL: Puerto raw Windows USB001
// Escribe los bytes ESC/POS directamente al puerto USB de la impresora.
// Equivalente a: copy /b archivo.bin \\.\USB001
// ─────────────────────────────────────────────────────────────────────────────
async function sendToRawPort(escposBytes: Buffer): Promise<boolean> {

    // ── Linux / Mac ───────────────────────────────────────────────────────────
    if (process.platform !== "win32") {
        for (const p of ["/dev/usb/lp0", "/dev/usb/lp1", "/dev/lp0"]) {
            try {
                fs.writeFileSync(p, escposBytes);
                log.info(`[escpos] OK → ${p}`);
                return true;
            } catch { /* siguiente */ }
        }
        return false;
    }

    // ── Windows: escritura directa al dispositivo (más rápido que cmd copy + tmp) ──
    for (const i of orderedUsbIndices()) {
        if (writeWindowsUsbDirect(i, escposBytes)) {
            lastWindowsUsbIndex = i;
            log.info(`[escpos] OK → USB00${i} (directo)`);
            return true;
        }
    }

    // Fallback: copy /b por si el driver solo acepta el flujo clásico
    const tmpBin = path.join(os.tmpdir(), `sumapp-escpos-${Date.now()}.bin`);
    try {
        fs.writeFileSync(tmpBin, escposBytes);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error("[escpos] No se pudo escribir bin temporal:", msg);
        return false;
    }

    const COPY_TIMEOUT_MS = 3500;
    for (const i of orderedUsbIndices()) {
        const port = `USB00${i}`;
        try {
            await new Promise<void>((resolve, reject) => {
                execFile(
                    "cmd.exe",
                    ["/d", "/s", "/c", `copy /b "${tmpBin}" \\\\.\\${port}`],
                    { windowsHide: true, timeout: COPY_TIMEOUT_MS },
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    },
                );
            });
            lastWindowsUsbIndex = i;
            log.info(`[escpos] OK → ${port} (copy /b)`);
            try {
                fs.unlinkSync(tmpBin);
            } catch {
                /* ignore */
            }
            return true;
        } catch {
            log.debug(`[escpos] copy falló ${port}`);
        }
    }

    try {
        fs.unlinkSync(tmpBin);
    } catch {
        /* ignore */
    }
    log.warn("[escpos] Ningún puerto USB00x respondió");
    return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÉTODO FALLBACK: HTML + webContents.print()
// Se usa solo si el puerto raw falla. Calidad inferior pero siempre funciona.
// ─────────────────────────────────────────────────────────────────────────────
async function sendViaElectronPrint(
    documentJson: string,
    deviceName: string | undefined,
): Promise<boolean> {
    let html: string;
    try {
        html = await documentDataJsonToHtml(documentJson);
    } catch (e: any) {
        log.error("[escpos/fallback] Error generando HTML:", e?.message);
        return false;
    }

    const PAPER_WIDTH_MM    = 72;
    const receiptViewportPx = Math.round((PAPER_WIDTH_MM * 96) / 25.4);
    const tmp               = path.join(os.tmpdir(), `sumapp-print-${Date.now()}.html`);
    fs.writeFileSync(tmp, html, "utf8");

    const printWin = new BrowserWindow({
        show: false,
        width: receiptViewportPx,
        height: 4000,
        backgroundColor: "#ffffff",
        webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    const cleanup = () => {
        try { fs.unlinkSync(tmp); } catch {}
        if (!printWin.isDestroyed()) printWin.destroy();
    };

    try {
        await new Promise<void>((resolve, reject) => {
            const t = setTimeout(() => reject(new Error("Timeout HTML")), 60000);
            printWin.webContents.once("did-finish-load", () => { clearTimeout(t); resolve(); });
            printWin.webContents.once("did-fail-load", (_e, _c, desc) => { clearTimeout(t); reject(new Error(desc)); });
            printWin.loadFile(tmp).catch(reject);
        });

        await new Promise((r) => setTimeout(r, 400));
        await printWin.webContents.executeJavaScript(`
            new Promise(resolve => {
                const ready = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
                document.fonts?.ready ? document.fonts.ready.then(ready) : ready();
            })
        `);

        const contentHeightPx: number = await printWin.webContents.executeJavaScript(
            `document.documentElement.scrollHeight || document.body.scrollHeight`,
        );
        const contentHeightMicrons = Math.ceil((contentHeightPx * 25.4 * 1000) / 96) + 5000;
        const dn = deviceName?.trim() || undefined;

        const printed = await new Promise<boolean>((resolve) => {
            printWin.webContents.print(
                {
                    silent: true,
                    printBackground: true,
                    deviceName: dn,
                    pageSize: { width: PAPER_WIDTH_MM * 1000, height: contentHeightMicrons },
                    margins: { marginType: "none" },
                    scaleFactor: 100,
                } as WebContentsPrintOptions,
                (success, reason) => {
                    log.info(`[escpos/fallback] print: success=${success} reason=${reason ?? "none"}`);
                    resolve(success);
                },
            );
        });

        cleanup();
        return printed;
    } catch (e: any) {
        log.error("[escpos/fallback] Error:", e?.message);
        cleanup();
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function registerPrintHandler(): void {
    ipcMain.removeHandler("print-json-document");

    ipcMain.handle(
        "print-json-document",
        async (
            _event,
            payload: { documentJson: string; deviceName?: string | null },
        ) => {
            const { documentJson, deviceName } = payload;
            const dn = deviceName?.trim() || undefined;

            log.info(`[print] Iniciando → device="${dn ?? "default"}"`);

            // PASO 1: Generar bytes ESC/POS
            let escposBytes: Buffer;
            try {
                escposBytes = await documentJsonToEscPos(documentJson, 80);
                log.info(`[print] ESC/POS generado: ${escposBytes.length} bytes`);
            } catch (e: any) {
                log.error("[print] Error generando ESC/POS:", e?.message);
                const ok = await sendViaElectronPrint(documentJson, dn);
                return ok
                    ? { ok: true }
                    : { ok: false, message: "Error generando ESC/POS" };
            }

            // PASO 2: Enviar al puerto USB directo (USB001)
            const rawOk = await sendToRawPort(escposBytes);
            if (rawOk) {
                log.info("[print] OK → ESC/POS directo USB");
                return { ok: true };
            }

            // PASO 3: Fallback HTML si el puerto raw no respondió
            log.warn("[print] Puerto raw falló → usando fallback HTML");
            const htmlOk = await sendViaElectronPrint(documentJson, dn);
            if (htmlOk) {
                log.info("[print] OK → Fallback HTML");
                return { ok: true };
            }

            return {
                ok: false,
                message: "No se pudo imprimir. Verifica que la impresora esté conectada.",
            };
        },
    );

    log.info("[main] Handler ESC/POS registrado: print-json-document");
}