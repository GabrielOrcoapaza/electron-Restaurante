import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import { app, BrowserWindow, session, dialog, ipcMain } from "electron";
import type { WebContentsPrintOptions } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import * as path from "path";
import { documentDataJsonToHtml } from "./documentToPrintHtml";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

/** Ventana principal: para IPC que necesita webContents (p. ej. listar impresoras del SO). */
let mainWindowRef: BrowserWindow | null = null;

// LOGS DEL AUTOUPDATE
autoUpdater.logger = log as any;
(autoUpdater.logger as any).transports.file.level = "info";

// SOLO BUSCAR ACTUALIZACIONES EN PRODUCCIÓN
if (!isDev) {
    app.on("ready", () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 1200,
        minHeight: 800,
        title: "SumApp",
        show: false, // No mostrar hasta que esté listo
        icon: path.join(__dirname, "../public/SumApp.ico"),
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
        },
        autoHideMenuBar: true, // Ocultar barra de menú (File, Edit, etc)
    });

    mainWindowRef = mainWindow;

    // Maximizar la ventana cuando esté lista
    mainWindow.once("ready-to-show", () => {
        mainWindow.maximize();
        mainWindow.show();
    });

    if (isDev) {
        // En desarrollo: cargar desde el servidor de Vite
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.on("before-input-event", (event, input) => {
            if (input.type === "keyDown" && input.key === "F12") {
                mainWindow?.webContents.toggleDevTools();
            }
        });
    } else {
        // En producción: cargar desde archivos estáticos
        // Limpiar caché antes de cargar para asegurar que se carguen los últimos cambios
        mainWindow.webContents.session.clearCache().then(() => {
            mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
        });
    }
}

autoUpdater.on("update-available", () => {
    dialog.showMessageBox({
        type: "info",
        title: "Actualización disponible",
        message: "Se está descargando una nueva versión del sistema...",
    });
});

autoUpdater.on("update-downloaded", () => {
    dialog
        .showMessageBox({
            type: "info",
            title: "Actualización lista",
            message:
                "La actualización se instalará al reiniciar la aplicación.",
            buttons: ["Reiniciar ahora"],
        })
        .then(() => {
            autoUpdater.quitAndInstall();
        });
});

autoUpdater.on("error", (err) => {
    log.error("Error en autoUpdater:", err);
});

function normalizePrinterKey(s: string): string {
    return s
        .trim()
        .replace(/^\uFEFF/, "")
        .toLowerCase()
        .replace(/\s+/g, " ");
}

/** Quita sufijos típicos para alinear nombre WMI con el de Chromium. */
function stripPrinterNoise(s: string): string {
    return s
        .replace(/\s+printer\s*$/i, "")
        .replace(/\s+impresora\s*$/i, "")
        .trim();
}

/**
 * ¿Coincide el nombre de la impresora predeterminada del SO con la fila de Chromium?
 * Windows suele devolver "Brother X" y Chromium "Brother X Printer".
 */
function printerNamesMatch(osDefault: string, chromiumName: string, chromiumDisplay: string): boolean {
    const a = normalizePrinterKey(stripPrinterNoise(osDefault));
    if (!a) return false;
    const candidates = [
        normalizePrinterKey(stripPrinterNoise(chromiumName)),
        normalizePrinterKey(stripPrinterNoise(chromiumDisplay)),
    ].filter(Boolean);
    for (const b of candidates) {
        if (!b) continue;
        if (a === b) return true;
        if (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))) {
            return true;
        }
    }
    return false;
}

function parsePowerShellPrinterName(out: string): string | null {
    const lines = out
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^\uFEFF/, ""))
        .filter(
            (l) =>
                l.length > 0 &&
                !/^Get-CimInstance|^CategoryInfo|^FullyQualifiedErrorId|^\+/i.test(l)
        );
    if (lines.length === 0) return null;
    return lines[0] ?? null;
}

/** Impresora predeterminada del sistema operativo (no la de Chromium). */
function getDefaultSystemPrinterName(): string | null {
    try {
        if (process.platform === "win32") {
            try {
                const out = execFileSync(
                    "powershell.exe",
                    [
                        "-NoProfile",
                        "-NonInteractive",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-Command",
                        'Get-CimInstance -ClassName Win32_Printer -Filter "Default=True" | Select-Object -ExpandProperty Name',
                    ],
                    { encoding: "utf-8", windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024 }
                );
                const name = parsePowerShellPrinterName(out);
                if (name) {
                    log.info(`[get-system-printers] Predeterminada Windows (CIM): "${name}"`);
                    return name;
                }
            } catch (e: any) {
                log.warn("getDefaultSystemPrinterName PowerShell CIM:", e?.message || e);
            }

            try {
                const out = execFileSync(
                    "powershell.exe",
                    [
                        "-NoProfile",
                        "-NonInteractive",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-Command",
                        "(Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1 -ExpandProperty Name)",
                    ],
                    { encoding: "utf-8", windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024 }
                );
                const name = parsePowerShellPrinterName(out);
                if (name) {
                    log.info(`[get-system-printers] Predeterminada Windows (Where-Object): "${name}"`);
                    return name;
                }
            } catch (e: any) {
                log.warn("getDefaultSystemPrinterName PowerShell Where:", e?.message || e);
            }

            try {
                const out = execFileSync(
                    "cmd.exe",
                    ["/d", "/s", "/c", "wmic printer where Default=true get Name /value 2>nul"],
                    { encoding: "utf-8", windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 }
                );
                const m = out.match(/Name=([^\r\n]+)/i);
                const name = m?.[1]?.trim();
                if (name) {
                    log.info(`[get-system-printers] Predeterminada Windows (wmic): "${name}"`);
                    return name;
                }
            } catch (e: any) {
                log.warn("getDefaultSystemPrinterName wmic:", e?.message || e);
            }

            log.warn("[get-system-printers] No se pudo obtener impresora predeterminada en Windows.");
            return null;
        }
        if (process.platform === "darwin" || process.platform === "linux") {
            const out = execFileSync("lpstat", ["-d"], {
                encoding: "utf-8",
                timeout: 10000,
            });
            const line = out
                .split(/\r?\n/)
                .find((l) =>
                    /default destination|destino predeterminado|predeterminad/i.test(l)
                );
            if (!line) return null;
            const m = line.match(/:\s*(.+?)\s*$/);
            const name = m ? m[1].trim() : null;
            if (!name || /^no default|ningún|ningun/i.test(name)) return null;
            return name;
        }
    } catch (e: any) {
        log.warn("getDefaultSystemPrinterName:", e?.message || e);
    }
    return null;
}

function registerIpcHandlers(): void {
    ipcMain.removeHandler("get-system-printers");
    /** Impresoras del SO (Chromium PrinterInfo: name, displayName, description, options). */
    ipcMain.handle(
        "get-system-printers",
        async (): Promise<{
            ok: boolean;
            printers: Array<{
                name: string;
                displayName: string;
                description: string;
                isSystemDefault: boolean;
                options?: Record<string, string>;
            }>;
            defaultPrinterName: string | null;
            message?: string;
        }> => {
            try {
                const win =
                    mainWindowRef ||
                    BrowserWindow.getFocusedWindow() ||
                    BrowserWindow.getAllWindows()[0];
                if (!win || win.isDestroyed()) {
                    return {
                        ok: false,
                        printers: [],
                        defaultPrinterName: null,
                        message: "No hay ventana activa para consultar impresoras.",
                    };
                }
                const osDefaultName = getDefaultSystemPrinterName();

                const list = await win.webContents.getPrintersAsync();
                const chromiumDefaultRaw = list.find(
                    (p) => (p as { isDefault?: boolean }).isDefault === true
                );
                const chromiumDefaultLabel =
                    chromiumDefaultRaw?.displayName ||
                    chromiumDefaultRaw?.name ||
                    null;

                const bannerDefaultName = osDefaultName || chromiumDefaultLabel;

                const printers = list.map((p) => {
                    const name = p.name ?? "";
                    const displayName = p.displayName ?? "";
                    const chromiumSaysDefault =
                        (p as { isDefault?: boolean }).isDefault === true;
                    const matchesOs =
                        !!osDefaultName &&
                        printerNamesMatch(osDefaultName, name, displayName);
                    const isSystemDefault = matchesOs || chromiumSaysDefault;
                    return {
                        name,
                        displayName,
                        description: p.description ?? "",
                        isSystemDefault,
                        options:
                            p.options && typeof p.options === "object"
                                ? { ...(p.options as Record<string, string>) }
                                : undefined,
                    };
                });

                const marked = printers.some((x) => x.isSystemDefault);
                if (osDefaultName && !marked) {
                    log.info(
                        `[get-system-printers] Predeterminada SO "${osDefaultName}" no coincide con ninguna fila; cabecera igual muestra el nombre de Windows.`
                    );
                }
                if (!osDefaultName && chromiumDefaultLabel) {
                    log.info(
                        `[get-system-printers] Predeterminada vía Chromium isDefault: "${chromiumDefaultLabel}"`
                    );
                }

                return {
                    ok: true,
                    printers,
                    defaultPrinterName: bannerDefaultName,
                };
            } catch (err: any) {
                log.error("get-system-printers:", err);
                return {
                    ok: false,
                    printers: [],
                    defaultPrinterName: null,
                    message: err?.message || String(err),
                };
            }
        }
    );

    ipcMain.removeHandler("print-json-document");
    ipcMain.handle(
        "print-json-document",
        async (
            _event,
            payload: { documentJson: string; deviceName?: string | null }
        ): Promise<{ ok: boolean; message?: string }> => {
            const { documentJson, deviceName } = payload;
            if (!documentJson || !String(documentJson).trim()) {
                return { ok: false, message: "documentJson vacío" };
            }
            let html: string;
            try {
                html = documentDataJsonToHtml(String(documentJson));
            } catch (e: any) {
                log.error("documentDataJsonToHtml:", e);
                return { ok: false, message: e?.message || String(e) };
            }
            const tmp = path.join(
                os.tmpdir(),
                `sumapp-print-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.html`
            );
            try {
                fs.writeFileSync(tmp, html, "utf8");
            } catch (e: any) {
                return { ok: false, message: `No se pudo escribir temporal: ${e?.message || e}` };
            }

            /** Térmica 80×80 mm; viewport ~igual a 96dpi para alinear con pageSize. */
            const THERMAL_MM = 70;
            const receiptViewportPx = Math.round((THERMAL_MM * 96) / 25.4);
            const printWin = new BrowserWindow({
                show: false,
                width: receiptViewportPx,
                height: receiptViewportPx,
                backgroundColor: "#ffffff",
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                },
            });

            const cleanup = () => {
                try {
                    fs.unlinkSync(tmp);
                } catch {
                    /* */
                }
                if (!printWin.isDestroyed()) {
                    printWin.destroy();
                }
            };

            try {
                await new Promise<void>((resolve, reject) => {
                    const t = setTimeout(() => reject(new Error("Timeout cargando HTML para imprimir")), 60000);
                    printWin.webContents.once("did-fail-load", (_e, code, desc) => {
                        clearTimeout(t);
                        reject(new Error(desc || `Error de carga ${code}`));
                    });
                    printWin.webContents.once("did-finish-load", () => {
                        clearTimeout(t);
                        resolve();
                    });
                    printWin.loadFile(tmp).catch((err) => {
                        clearTimeout(t);
                        reject(err);
                    });
                });

                /** Después de load, forzar layout + 2 rAF (térmicas: imprimir demasiado pronto = ticket en blanco). */
                await new Promise((r) => setTimeout(r, 120));
                try {
                    await printWin.webContents.executeJavaScript(`
            new Promise((resolve) => {
              const raf2 = () => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
              };
              if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(raf2).catch(raf2);
              } else {
                raf2();
              }
            });
          `);
                } catch (e) {
                    log.warn("[print-json-document] reflow/ fonts:", e);
                }
                await new Promise((r) => setTimeout(r, 750));

                const dn =
                    deviceName && String(deviceName).trim() ? String(deviceName).trim() : undefined;
                /**
                 * Papel térmico 80×80 mm (micrones: 1 mm = 1000).
                 * @see https://www.electronjs.org/docs/latest/api/web-contents#contentsprintoptions
                 */
                const pageSize80x80: { width: number; height: number } = {
                    width: THERMAL_MM * 1000,
                    height: THERMAL_MM * 1000,
                };
                /* Térmicas: printBackground true suele rasterizar "fantasma" con muchos drivers; A4 acepta ambos. */
                const baseOpts: WebContentsPrintOptions = {
                    silent: true,
                    printBackground: false,
                    landscape: false,
                    pageSize: pageSize80x80,
                    margins: { marginType: "none" },
                };

                const printSilent = (opts: WebContentsPrintOptions): Promise<boolean> =>
                    new Promise((resolve) => {
                        printWin.webContents.print(opts, (success, failureReason) => {
                            if (!success) log.warn("webContents.print:", failureReason);
                            resolve(success);
                        });
                    });

                let printed = false;
                if (dn) {
                    printed = await printSilent({ ...baseOpts, deviceName: dn });
                } else {
                    printed = await printSilent(baseOpts);
                }

                if (!printed && dn) {
                    printed = await printSilent(baseOpts);
                    log.info("[print-json-document] Reintento sin deviceName");
                }
                if (!printed && dn) {
                    log.info("[print-json-document] Reintento con printBackground (algunos controladores A4/instalado)");
                    printed = await printSilent({
                        ...baseOpts,
                        printBackground: true,
                        deviceName: dn,
                    });
                }
                if (!printed) {
                    printed = await printSilent({ ...baseOpts, printBackground: true });
                }

                if (!printed) {
                    cleanup();
                    return {
                        ok: false,
                        message:
                            "No se pudo imprimir (silent). Compruebe el nombre de la impresora o la impresora predeterminada de Windows.",
                    };
                }

                log.info(`[print-json-document] Impreso device=${dn || "predeterminada"}`);
                cleanup();
                return { ok: true };
            } catch (e: any) {
                log.error("print-json-document:", e);
                cleanup();
                return { ok: false, message: e?.message || String(e) };
            }
        }
    );

    ipcMain.removeHandler("check-for-updates");
    ipcMain.handle("check-for-updates", async () => {
        if (isDev) {
            return {
                success: false,
                message: "En modo desarrollo no se buscan actualizaciones.",
            };
        }
        try {
            const result = await autoUpdater.checkForUpdates();
            const hasUpdate = result?.updateInfo != null;
            return {
                success: true,
                hasUpdate,
                message: hasUpdate
                    ? "Actualización encontrada. Se está descargando..."
                    : "No hay actualizaciones disponibles. Ya tienes la última versión.",
            };
        } catch (err: any) {
            log.error("Error al buscar actualizaciones:", err);
            return {
                success: false,
                message: err?.message || "Error al buscar actualizaciones.",
            };
        }
    });

    log.info(
        "[main] Handlers IPC registrados: get-system-printers, print-json-document, check-for-updates"
    );
}

app.whenReady().then(() => {
    registerIpcHandlers();

    // Configurar CSP para seguridad y permitir medios externos
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };

        // Cabecera de seguridad CSP (Elimina el aviso de Electron y permite imágenes externas)
        const csp = isDev
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: gap: http://localhost:5173 https://api.sumapp.pe wss://api.sumapp.pe; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:5173 https://api.sumapp.pe wss://api.sumapp.pe; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:;"
            : "default-src 'self' 'unsafe-inline' data: https://api.sumapp.pe wss://api.sumapp.pe; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.sumapp.pe wss://api.sumapp.pe; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:;";

        responseHeaders["Content-Security-Policy"] = [csp];

        callback({ responseHeaders });
    });

    // Desactivar caché en producción para asegurar que se carguen los últimos cambios
    if (!isDev) {
        // Limpiar solo el caché (NO el localStorage para mantener datos de autenticación)
        session.defaultSession.clearCache();
        // NO limpiar clearStorageData() para mantener companyData y otros datos de autenticación

        // Interceptar solicitudes para desactivar caché (solo una vez al iniciar)
        session.defaultSession.webRequest.onBeforeSendHeaders(
            (details, callback) => {
                callback({
                    requestHeaders: {
                        ...details.requestHeaders,
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                        Pragma: "no-cache",
                        Expires: "0",
                    },
                });
            },
        );
    }

    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            // Limpiar caché también al reactivar
            if (!isDev) {
                session.defaultSession.clearCache();
            }
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
