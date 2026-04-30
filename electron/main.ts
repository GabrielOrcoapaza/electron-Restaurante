import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import { app, BrowserWindow, session, dialog, ipcMain } from "electron";
import type { WebContentsPrintOptions } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import * as path from "path";
import { documentDataJsonToHtml } from "./documentToPrintHtml";
import { net } from "electron";
import { registerPrintHandler } from "./printHandler";

// Configurar switches de línea de comandos antes de que la app esté lista
app.commandLine.appendSwitch("ignore-certificate-errors");
app.commandLine.appendSwitch("disable-web-security");
app.commandLine.appendSwitch("disable-site-isolation-trials");
app.commandLine.appendSwitch("no-proxy-server");

// Configurar logging más detallado
log.transports.file.level = "debug";
log.transports.console.level = "debug";

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

// Capturar todas las solicitudes de red
app.on("ready", () => {
    session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: ["*://api.sumapp.pe/*"] },
        (details, callback) => {
            // Forzar Origin y Referer para que el servidor de producción acepte la conexión
            details.requestHeaders["Origin"] = "https://sumapp.pe";
            details.requestHeaders["Referer"] = "https://sumapp.pe/";
            details.requestHeaders["User-Agent"] =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

            callback({ requestHeaders: details.requestHeaders });
        },
    );
});

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
            webSecurity: false,
            allowRunningInsecureContent: true,
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
function printerNamesMatch(
    osDefault: string,
    chromiumName: string,
    chromiumDisplay: string,
): boolean {
    const a = normalizePrinterKey(stripPrinterNoise(osDefault));
    if (!a) return false;
    const candidates = [
        normalizePrinterKey(stripPrinterNoise(chromiumName)),
        normalizePrinterKey(stripPrinterNoise(chromiumDisplay)),
    ].filter(Boolean);
    for (const b of candidates) {
        if (!b) continue;
        if (a === b) return true;
        if (
            a.length >= 6 &&
            b.length >= 6 &&
            (a.includes(b) || b.includes(a))
        ) {
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
                !/^Get-CimInstance|^CategoryInfo|^FullyQualifiedErrorId|^\+/i.test(
                    l,
                ),
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
                    {
                        encoding: "utf-8",
                        windowsHide: true,
                        timeout: 25000,
                        maxBuffer: 1024 * 1024,
                    },
                );
                const name = parsePowerShellPrinterName(out);
                if (name) {
                    log.info(
                        `[get-system-printers] Predeterminada Windows (CIM): "${name}"`,
                    );
                    return name;
                }
            } catch (e: any) {
                log.warn(
                    "getDefaultSystemPrinterName PowerShell CIM:",
                    e?.message || e,
                );
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
                    {
                        encoding: "utf-8",
                        windowsHide: true,
                        timeout: 25000,
                        maxBuffer: 1024 * 1024,
                    },
                );
                const name = parsePowerShellPrinterName(out);
                if (name) {
                    log.info(
                        `[get-system-printers] Predeterminada Windows (Where-Object): "${name}"`,
                    );
                    return name;
                }
            } catch (e: any) {
                log.warn(
                    "getDefaultSystemPrinterName PowerShell Where:",
                    e?.message || e,
                );
            }

            try {
                const out = execFileSync(
                    "cmd.exe",
                    [
                        "/d",
                        "/s",
                        "/c",
                        "wmic printer where Default=true get Name /value 2>nul",
                    ],
                    {
                        encoding: "utf-8",
                        windowsHide: true,
                        timeout: 20000,
                        maxBuffer: 1024 * 1024,
                    },
                );
                const m = out.match(/Name=([^\r\n]+)/i);
                const name = m?.[1]?.trim();
                if (name) {
                    log.info(
                        `[get-system-printers] Predeterminada Windows (wmic): "${name}"`,
                    );
                    return name;
                }
            } catch (e: any) {
                log.warn("getDefaultSystemPrinterName wmic:", e?.message || e);
            }

            log.warn(
                "[get-system-printers] No se pudo obtener impresora predeterminada en Windows.",
            );
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
                    /default destination|destino predeterminado|predeterminad/i.test(
                        l,
                    ),
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
                        message:
                            "No hay ventana activa para consultar impresoras.",
                    };
                }
                const osDefaultName = getDefaultSystemPrinterName();

                const list = await win.webContents.getPrintersAsync();
                const chromiumDefaultRaw = list.find(
                    (p) => (p as { isDefault?: boolean }).isDefault === true,
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
                        `[get-system-printers] Predeterminada SO "${osDefaultName}" no coincide con ninguna fila; cabecera igual muestra el nombre de Windows.`,
                    );
                }
                if (!osDefaultName && chromiumDefaultLabel) {
                    log.info(
                        `[get-system-printers] Predeterminada vía Chromium isDefault: "${chromiumDefaultLabel}"`,
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
        },
    );

    registerPrintHandler();

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
        "[main] Handlers IPC registrados: get-system-printers, print-json-document, check-for-updates",
    );
}
if (isDev) {
    // Ignorar errores de certificado en desarrollo
    app.commandLine.appendSwitch("ignore-certificate-errors");
}

// También puedes agregar un handler para errores de certificado
app.on(
    "certificate-error",
    (event, webContents, url, error, certificate, callback) => {
        log.error(`❌ Certificate Error: ${url} - ${error}`);
        if (isDev) {
            event.preventDefault();
            callback(true); // Continuar con la conexión
        } else {
            callback(false);
        }
    },
);
app.whenReady().then(() => {
    registerIpcHandlers();

    // Configurar CSP para seguridad y permitir medios externos
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };

        if (isDev) {
            // En desarrollo, desactivamos el CSP que estamos inyectando para evitar bloqueos de fuentes/estilos
            // Electron mostrará una advertencia de seguridad en la consola, lo cual es normal en dev.
            callback({ responseHeaders });
            return;
        }

        // Cabecera de seguridad CSP para PRODUCCIÓN
        const csp =
            "default-src 'self' 'unsafe-inline' data: https://api.sumapp.pe https://sumapp.pe wss://api.sumapp.pe wss://sumapp.pe; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.sumapp.pe https://sumapp.pe wss://api.sumapp.pe wss://sumapp.pe; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:;";
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
