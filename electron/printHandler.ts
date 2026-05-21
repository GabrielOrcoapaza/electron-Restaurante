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
// MÉTODO PRINCIPAL: Puerto raw Windows USB001 o Ruta de Red Compartida
// Escribe los bytes ESC/POS directamente al puerto o a la cola compartida.
// ─────────────────────────────────────────────────────────────────────────────
async function sendToRawPort(
    escposBytes: Buffer,
    deviceName?: string,
): Promise<boolean> {
    // ── Linux / Mac ───────────────────────────────────────────────────────────
    if (process.platform !== "win32") {
        for (const p of ["/dev/usb/lp0", "/dev/usb/lp1", "/dev/lp0"]) {
            try {
                fs.writeFileSync(p, escposBytes);
                log.info(`[escpos] OK → ${p}`);
                return true;
            } catch {
                /* siguiente */
            }
        }
        return false;
    }

    // ── Windows: Intento 1 - Ruta de Red Compartida (\\127.0.0.1\Nombre) ──
    if (deviceName) {
        const cleanName = deviceName.trim();
        const sharedPath = `\\\\127.0.0.1\\${cleanName}`;
        log.info(`[escpos] Intentando ruta compartida: ${sharedPath}`);

        // Sub-intento 1.1: Escritura directa vía Node.js (más limpio)
        try {
            fs.writeFileSync(sharedPath, escposBytes);
            log.info(`[escpos] OK → ${sharedPath} (escritura directa)`);
            return true;
        } catch (e: any) {
            log.debug(`[escpos] Escritura directa a share falló: ${e?.message}`);
        }

        // Sub-intento 1.2: Comando copy /b (el método clásico de CMD)
        const tmpBin = path.join(
            os.tmpdir(),
            `sumapp-shared-${Date.now()}.bin`,
        );
        try {
            fs.writeFileSync(tmpBin, escposBytes);
            await new Promise<void>((resolve, reject) => {
                // Usamos exec en lugar de execFile para que el shell maneje la ruta UNC de forma más natural
                const { exec } = require("child_process");
                exec(
                    `copy /b "${tmpBin}" "${sharedPath}"`,
                    { windowsHide: true, timeout: 4000 },
                    (err: any) => {
                        if (err) reject(err);
                        else resolve();
                    },
                );
            });
            log.info(`[escpos] OK → ${sharedPath} (copy /b shared)`);
            try {
                fs.unlinkSync(tmpBin);
            } catch {
                /* ignore */
            }
            return true;
        } catch (e: any) {
            log.debug(`[escpos] copy /b shared falló: ${e?.message}`);
            try {
                fs.unlinkSync(tmpBin);
            } catch {
                /* ignore */
            }
        }
    }

    // ── Windows: Intento 2 - Escritura directa al dispositivo USB00x ──
    for (const i of orderedUsbIndices()) {
        if (writeWindowsUsbDirect(i, escposBytes)) {
            lastWindowsUsbIndex = i;
            log.info(`[escpos] OK → USB00${i} (directo)`);
            return true;
        }
    }

    // ── Windows: Intento 3 - copy /b USB00x (fallback clásico) ──
    const tmpBinFallback = path.join(
        os.tmpdir(),
        `sumapp-escpos-${Date.now()}.bin`,
    );
    try {
        fs.writeFileSync(tmpBinFallback, escposBytes);
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
                    ["/d", "/s", "/c", `copy /b "${tmpBinFallback}" \\\\.\\${port}`],
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
                fs.unlinkSync(tmpBinFallback);
            } catch {
                /* ignore */
            }
            return true;
        } catch {
            log.debug(`[escpos] copy falló ${port}`);
        }
    }

    try {
        fs.unlinkSync(tmpBinFallback);
    } catch {
        /* ignore */
    }
    log.warn("[escpos] Ningún método de puerto raw (shared o USB00x) respondió");
    return false;
}

type HtmlPrintResult = { printed: boolean; cancelled: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// HTML + webContents.print() — silent o diálogo del sistema (vista previa Windows)
// ─────────────────────────────────────────────────────────────────────────────
async function sendViaElectronHtmlPrint(
    documentJson: string,
    deviceName: string | undefined,
    options: { silent: boolean },
): Promise<HtmlPrintResult> {
    let html: string;
    try {
        html = await documentDataJsonToHtml(documentJson);
    } catch (e: any) {
        log.error("[escpos/fallback] Error generando HTML:", e?.message);
        return { printed: false, cancelled: false };
    }

    const PAPER_WIDTH_MM    = 72;
    const receiptViewportPx = Math.round((PAPER_WIDTH_MM * 96) / 25.4);
    const tmp               = path.join(os.tmpdir(), `sumapp-print-${Date.now()}.html`);
    fs.writeFileSync(tmp, html, "utf8");

    /** Con diálogo del SO: ventana visible (Electron no ofrece miniatura en el cuadro de Windows). */
    const useVisiblePreview = !options.silent;
    const parentWin = BrowserWindow.getFocusedWindow();

    const printWin = new BrowserWindow({
        show: useVisiblePreview,
        width: useVisiblePreview ? receiptViewportPx + 16 : receiptViewportPx,
        height: useVisiblePreview ? 720 : 4000,
        minWidth: receiptViewportPx,
        title: useVisiblePreview
            ? "Vista previa del comprobante — SumApp"
            : undefined,
        autoHideMenuBar: true,
        backgroundColor: "#ffffff",
        parent:
            useVisiblePreview && parentWin && !parentWin.isDestroyed()
                ? parentWin
                : undefined,
        modal: useVisiblePreview && Boolean(parentWin),
        webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    if (useVisiblePreview) {
        printWin.center();
    }

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

        if (useVisiblePreview) {
            printWin.show();
            printWin.focus();
            await new Promise((r) => setTimeout(r, 600));
        }

        const contentHeightPx: number = await printWin.webContents.executeJavaScript(
            `document.documentElement.scrollHeight || document.body.scrollHeight`,
        );
        const contentHeightMicrons = Math.ceil((contentHeightPx * 25.4 * 1000) / 96) + 5000;
        const dn = deviceName?.trim() || undefined;

        const printSettings: WebContentsPrintOptions = options.silent
            ? {
                  silent: true,
                  printBackground: true,
                  deviceName: dn,
                  pageSize: {
                      width: PAPER_WIDTH_MM * 1000,
                      height: contentHeightMicrons,
                  },
                  margins: { marginType: "none" },
                  scaleFactor: 100,
              }
            : {
                  silent: false,
                  printBackground: true,
                  deviceName: dn,
                  margins: { marginType: "default" },
              };

        const result = await new Promise<HtmlPrintResult>((resolve) => {
            printWin.webContents.print(
                printSettings,
                (success, reason) => {
                    const cancelled = reason === "cancelled";
                    log.info(
                        `[escpos/html] print: silent=${options.silent} success=${success} reason=${reason ?? "none"}`,
                    );
                    resolve({
                        printed: success && !cancelled,
                        cancelled,
                    });
                },
            );
        });

        cleanup();
        return result;
    } catch (e: any) {
        log.error("[escpos/fallback] Error:", e?.message);
        cleanup();
        return { printed: false, cancelled: false };
    }
}

/** Impresión silenciosa (USB fallback / ESC/POS fallido). */
async function sendViaElectronPrint(
    documentJson: string,
    deviceName: string | undefined,
): Promise<boolean> {
    const r = await sendViaElectronHtmlPrint(documentJson, deviceName, {
        silent: true,
    });
    return r.printed;
}

/** Diálogo nativo del SO con vista previa (como Ctrl+P en Windows). */
export async function openSystemPrintDialogForDocument(
    documentJson: string,
    deviceName: string | undefined,
): Promise<HtmlPrintResult> {
    log.info("[print-dialog] Abriendo diálogo de impresión del sistema…");
    return sendViaElectronHtmlPrint(documentJson, deviceName, { silent: false });
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

            // PASO 2: Enviar al puerto USB directo (USB001) o Ruta Compartida
            const rawOk = await sendToRawPort(escposBytes, dn);
            if (rawOk) {
                log.info("[print] OK → ESC/POS directo (USB o Shared)");
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

    ipcMain.removeHandler("print-json-document-dialog");
    ipcMain.handle(
        "print-json-document-dialog",
        async (
            _event,
            payload: { documentJson: string; deviceName?: string | null },
        ) => {
            const { documentJson, deviceName } = payload;
            const dn = deviceName?.trim() || undefined;
            if (!documentJson?.trim()) {
                return {
                    ok: false,
                    printed: false,
                    cancelled: false,
                    message: "documentJson vacío.",
                };
            }
            try {
                const { printed, cancelled } = await openSystemPrintDialogForDocument(
                    documentJson,
                    dn,
                );
                return {
                    ok: printed,
                    printed,
                    cancelled,
                    message: cancelled
                        ? "Impresión cancelada."
                        : printed
                          ? undefined
                          : "No se pudo imprimir.",
                };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error("[print-dialog] Error:", msg);
                return {
                    ok: false,
                    printed: false,
                    cancelled: false,
                    message: msg,
                };
            }
        },
    );

    log.info(
        "[main] Handlers: print-json-document, print-json-document-dialog",
    );
}