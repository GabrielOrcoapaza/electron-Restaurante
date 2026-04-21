"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const electron_log_1 = __importDefault(require("electron-log"));
const path = __importStar(require("path"));
const documentToPrintHtml_1 = require("./documentToPrintHtml");
const isDev = process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
/** Ventana principal: para IPC que necesita webContents (p. ej. listar impresoras del SO). */
let mainWindowRef = null;
// LOGS DEL AUTOUPDATE
electron_updater_1.autoUpdater.logger = electron_log_1.default;
electron_updater_1.autoUpdater.logger.transports.file.level = "info";
// SOLO BUSCAR ACTUALIZACIONES EN PRODUCCIÓN
if (!isDev) {
    electron_1.app.on("ready", () => {
        electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    });
}
function createWindow() {
    const mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        // En producción: cargar desde archivos estáticos
        // Limpiar caché antes de cargar para asegurar que se carguen los últimos cambios
        mainWindow.webContents.session.clearCache().then(() => {
            mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
        });
    }
}
electron_updater_1.autoUpdater.on("update-available", () => {
    electron_1.dialog.showMessageBox({
        type: "info",
        title: "Actualización disponible",
        message: "Se está descargando una nueva versión del sistema...",
    });
});
electron_updater_1.autoUpdater.on("update-downloaded", () => {
    electron_1.dialog
        .showMessageBox({
        type: "info",
        title: "Actualización lista",
        message: "La actualización se instalará al reiniciar la aplicación.",
        buttons: ["Reiniciar ahora"],
    })
        .then(() => {
        electron_updater_1.autoUpdater.quitAndInstall();
    });
});
electron_updater_1.autoUpdater.on("error", (err) => {
    electron_log_1.default.error("Error en autoUpdater:", err);
});
function normalizePrinterKey(s) {
    return s
        .trim()
        .replace(/^\uFEFF/, "")
        .toLowerCase()
        .replace(/\s+/g, " ");
}
/** Quita sufijos típicos para alinear nombre WMI con el de Chromium. */
function stripPrinterNoise(s) {
    return s
        .replace(/\s+printer\s*$/i, "")
        .replace(/\s+impresora\s*$/i, "")
        .trim();
}
/**
 * ¿Coincide el nombre de la impresora predeterminada del SO con la fila de Chromium?
 * Windows suele devolver "Brother X" y Chromium "Brother X Printer".
 */
function printerNamesMatch(osDefault, chromiumName, chromiumDisplay) {
    const a = normalizePrinterKey(stripPrinterNoise(osDefault));
    if (!a)
        return false;
    const candidates = [
        normalizePrinterKey(stripPrinterNoise(chromiumName)),
        normalizePrinterKey(stripPrinterNoise(chromiumDisplay)),
    ].filter(Boolean);
    for (const b of candidates) {
        if (!b)
            continue;
        if (a === b)
            return true;
        if (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))) {
            return true;
        }
    }
    return false;
}
function parsePowerShellPrinterName(out) {
    const lines = out
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^\uFEFF/, ""))
        .filter((l) => l.length > 0 &&
        !/^Get-CimInstance|^CategoryInfo|^FullyQualifiedErrorId|^\+/i.test(l));
    if (lines.length === 0)
        return null;
    return lines[0] ?? null;
}
/** Impresora predeterminada del sistema operativo (no la de Chromium). */
function getDefaultSystemPrinterName() {
    try {
        if (process.platform === "win32") {
            try {
                const out = (0, child_process_1.execFileSync)("powershell.exe", [
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    'Get-CimInstance -ClassName Win32_Printer -Filter "Default=True" | Select-Object -ExpandProperty Name',
                ], { encoding: "utf-8", windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024 });
                const name = parsePowerShellPrinterName(out);
                if (name) {
                    electron_log_1.default.info(`[get-system-printers] Predeterminada Windows (CIM): "${name}"`);
                    return name;
                }
            }
            catch (e) {
                electron_log_1.default.warn("getDefaultSystemPrinterName PowerShell CIM:", e?.message || e);
            }
            try {
                const out = (0, child_process_1.execFileSync)("powershell.exe", [
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    "(Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1 -ExpandProperty Name)",
                ], { encoding: "utf-8", windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024 });
                const name = parsePowerShellPrinterName(out);
                if (name) {
                    electron_log_1.default.info(`[get-system-printers] Predeterminada Windows (Where-Object): "${name}"`);
                    return name;
                }
            }
            catch (e) {
                electron_log_1.default.warn("getDefaultSystemPrinterName PowerShell Where:", e?.message || e);
            }
            try {
                const out = (0, child_process_1.execFileSync)("cmd.exe", ["/d", "/s", "/c", "wmic printer where Default=true get Name /value 2>nul"], { encoding: "utf-8", windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 });
                const m = out.match(/Name=([^\r\n]+)/i);
                const name = m?.[1]?.trim();
                if (name) {
                    electron_log_1.default.info(`[get-system-printers] Predeterminada Windows (wmic): "${name}"`);
                    return name;
                }
            }
            catch (e) {
                electron_log_1.default.warn("getDefaultSystemPrinterName wmic:", e?.message || e);
            }
            electron_log_1.default.warn("[get-system-printers] No se pudo obtener impresora predeterminada en Windows.");
            return null;
        }
        if (process.platform === "darwin" || process.platform === "linux") {
            const out = (0, child_process_1.execFileSync)("lpstat", ["-d"], {
                encoding: "utf-8",
                timeout: 10000,
            });
            const line = out
                .split(/\r?\n/)
                .find((l) => /default destination|destino predeterminado|predeterminad/i.test(l));
            if (!line)
                return null;
            const m = line.match(/:\s*(.+?)\s*$/);
            const name = m ? m[1].trim() : null;
            if (!name || /^no default|ningún|ningun/i.test(name))
                return null;
            return name;
        }
    }
    catch (e) {
        electron_log_1.default.warn("getDefaultSystemPrinterName:", e?.message || e);
    }
    return null;
}
function registerIpcHandlers() {
    electron_1.ipcMain.removeHandler("get-system-printers");
    /** Impresoras del SO (Chromium PrinterInfo: name, displayName, description, options). */
    electron_1.ipcMain.handle("get-system-printers", async () => {
        try {
            const win = mainWindowRef ||
                electron_1.BrowserWindow.getFocusedWindow() ||
                electron_1.BrowserWindow.getAllWindows()[0];
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
            const chromiumDefaultRaw = list.find((p) => p.isDefault === true);
            const chromiumDefaultLabel = chromiumDefaultRaw?.displayName ||
                chromiumDefaultRaw?.name ||
                null;
            const bannerDefaultName = osDefaultName || chromiumDefaultLabel;
            const printers = list.map((p) => {
                const name = p.name ?? "";
                const displayName = p.displayName ?? "";
                const chromiumSaysDefault = p.isDefault === true;
                const matchesOs = !!osDefaultName &&
                    printerNamesMatch(osDefaultName, name, displayName);
                const isSystemDefault = matchesOs || chromiumSaysDefault;
                return {
                    name,
                    displayName,
                    description: p.description ?? "",
                    isSystemDefault,
                    options: p.options && typeof p.options === "object"
                        ? { ...p.options }
                        : undefined,
                };
            });
            const marked = printers.some((x) => x.isSystemDefault);
            if (osDefaultName && !marked) {
                electron_log_1.default.info(`[get-system-printers] Predeterminada SO "${osDefaultName}" no coincide con ninguna fila; cabecera igual muestra el nombre de Windows.`);
            }
            if (!osDefaultName && chromiumDefaultLabel) {
                electron_log_1.default.info(`[get-system-printers] Predeterminada vía Chromium isDefault: "${chromiumDefaultLabel}"`);
            }
            return {
                ok: true,
                printers,
                defaultPrinterName: bannerDefaultName,
            };
        }
        catch (err) {
            electron_log_1.default.error("get-system-printers:", err);
            return {
                ok: false,
                printers: [],
                defaultPrinterName: null,
                message: err?.message || String(err),
            };
        }
    });
    electron_1.ipcMain.removeHandler("print-json-document");
    electron_1.ipcMain.handle("print-json-document", async (_event, payload) => {
        const { documentJson, deviceName } = payload;
        if (!documentJson || !String(documentJson).trim()) {
            return { ok: false, message: "documentJson vacío" };
        }
        let html;
        try {
            html = (0, documentToPrintHtml_1.documentDataJsonToHtml)(String(documentJson));
        }
        catch (e) {
            electron_log_1.default.error("documentDataJsonToHtml:", e);
            return { ok: false, message: e?.message || String(e) };
        }
        const tmp = path.join(os.tmpdir(), `sumapp-print-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.html`);
        try {
            fs.writeFileSync(tmp, html, "utf8");
        }
        catch (e) {
            return { ok: false, message: `No se pudo escribir temporal: ${e?.message || e}` };
        }
        /** Térmica 80×80 mm; viewport ~igual a 96dpi para alinear con pageSize. */
        const THERMAL_MM = 70;
        const receiptViewportPx = Math.round((THERMAL_MM * 96) / 25.4);
        const printWin = new electron_1.BrowserWindow({
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
            }
            catch {
                /* */
            }
            if (!printWin.isDestroyed()) {
                printWin.destroy();
            }
        };
        try {
            await new Promise((resolve, reject) => {
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
            }
            catch (e) {
                electron_log_1.default.warn("[print-json-document] reflow/ fonts:", e);
            }
            await new Promise((r) => setTimeout(r, 750));
            const dn = deviceName && String(deviceName).trim() ? String(deviceName).trim() : undefined;
            /**
             * Papel térmico 80×80 mm (micrones: 1 mm = 1000).
             * @see https://www.electronjs.org/docs/latest/api/web-contents#contentsprintoptions
             */
            const pageSize80x80 = {
                width: THERMAL_MM * 1000,
                height: THERMAL_MM * 1000,
            };
            /* Térmicas: printBackground true suele rasterizar "fantasma" con muchos drivers; A4 acepta ambos. */
            const baseOpts = {
                silent: true,
                printBackground: false,
                landscape: false,
                pageSize: pageSize80x80,
                margins: { marginType: "none" },
            };
            const printSilent = (opts) => new Promise((resolve) => {
                printWin.webContents.print(opts, (success, failureReason) => {
                    if (!success)
                        electron_log_1.default.warn("webContents.print:", failureReason);
                    resolve(success);
                });
            });
            let printed = false;
            if (dn) {
                printed = await printSilent({ ...baseOpts, deviceName: dn });
            }
            else {
                printed = await printSilent(baseOpts);
            }
            if (!printed && dn) {
                printed = await printSilent(baseOpts);
                electron_log_1.default.info("[print-json-document] Reintento sin deviceName");
            }
            if (!printed && dn) {
                electron_log_1.default.info("[print-json-document] Reintento con printBackground (algunos controladores A4/instalado)");
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
                    message: "No se pudo imprimir (silent). Compruebe el nombre de la impresora o la impresora predeterminada de Windows.",
                };
            }
            electron_log_1.default.info(`[print-json-document] Impreso device=${dn || "predeterminada"}`);
            cleanup();
            return { ok: true };
        }
        catch (e) {
            electron_log_1.default.error("print-json-document:", e);
            cleanup();
            return { ok: false, message: e?.message || String(e) };
        }
    });
    electron_1.ipcMain.removeHandler("check-for-updates");
    electron_1.ipcMain.handle("check-for-updates", async () => {
        if (isDev) {
            return {
                success: false,
                message: "En modo desarrollo no se buscan actualizaciones.",
            };
        }
        try {
            const result = await electron_updater_1.autoUpdater.checkForUpdates();
            const hasUpdate = result?.updateInfo != null;
            return {
                success: true,
                hasUpdate,
                message: hasUpdate
                    ? "Actualización encontrada. Se está descargando..."
                    : "No hay actualizaciones disponibles. Ya tienes la última versión.",
            };
        }
        catch (err) {
            electron_log_1.default.error("Error al buscar actualizaciones:", err);
            return {
                success: false,
                message: err?.message || "Error al buscar actualizaciones.",
            };
        }
    });
    electron_log_1.default.info("[main] Handlers IPC registrados: get-system-printers, print-json-document, check-for-updates");
}
electron_1.app.whenReady().then(() => {
    registerIpcHandlers();
    // Desactivar caché en producción para asegurar que se carguen los últimos cambios
    if (!isDev) {
        // Limpiar solo el caché (NO el localStorage para mantener datos de autenticación)
        electron_1.session.defaultSession.clearCache();
        // NO limpiar clearStorageData() para mantener companyData y otros datos de autenticación
        // Interceptar solicitudes para desactivar caché (solo una vez al iniciar)
        electron_1.session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            callback({
                requestHeaders: {
                    ...details.requestHeaders,
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            });
        });
    }
    createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            // Limpiar caché también al reactivar
            if (!isDev) {
                electron_1.session.defaultSession.clearCache();
            }
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
