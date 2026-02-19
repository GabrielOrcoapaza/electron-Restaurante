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
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const electron_log_1 = __importDefault(require("electron-log"));
const path = __importStar(require("path"));
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// LOGS DEL AUTOUPDATE
electron_updater_1.autoUpdater.logger = electron_log_1.default;
electron_updater_1.autoUpdater.logger.transports.file.level = 'info';
// SOLO BUSCAR ACTUALIZACIONES EN PRODUCCIÓN
if (!isDev) {
    electron_1.app.on('ready', () => {
        electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    });
}
function createWindow() {
    const mainWindow = new electron_1.BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 1200,
        minHeight: 800,
        show: false, // No mostrar hasta que esté listo
        icon: path.join(__dirname, '../public/sumaq.ico'),
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
        },
        autoHideMenuBar: true, // Ocultar barra de menú (File, Edit, etc)
    });
    // Maximizar la ventana cuando esté lista
    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
    });
    if (isDev) {
        // En desarrollo: cargar desde el servidor de Vite
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.type === 'keyDown' && input.key === 'F12') {
                mainWindow?.webContents.toggleDevTools();
            }
        });
    }
    else {
        // En producción: cargar desde archivos estáticos
        // Limpiar caché antes de cargar para asegurar que se carguen los últimos cambios
        mainWindow.webContents.session.clearCache().then(() => {
            mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        });
    }
}
electron_updater_1.autoUpdater.on('update-available', () => {
    electron_1.dialog.showMessageBox({
        type: 'info',
        title: 'Actualización disponible',
        message: 'Se está descargando una nueva versión del sistema...'
    });
});
electron_updater_1.autoUpdater.on('update-downloaded', () => {
    electron_1.dialog.showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: 'La actualización se instalará al reiniciar la aplicación.',
        buttons: ['Reiniciar ahora']
    }).then(() => {
        electron_updater_1.autoUpdater.quitAndInstall();
    });
});
electron_updater_1.autoUpdater.on('error', (err) => {
    electron_log_1.default.error('Error en autoUpdater:', err);
});
electron_1.app.whenReady().then(() => {
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
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
        });
    }
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            // Limpiar caché también al reactivar
            if (!isDev) {
                electron_1.session.defaultSession.clearCache();
            }
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
