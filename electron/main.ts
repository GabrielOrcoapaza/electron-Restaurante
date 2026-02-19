import { app, BrowserWindow, session, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import * as path from 'path';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;


// LOGS DEL AUTOUPDATE
autoUpdater.logger = log as any;
(autoUpdater.logger as any).transports.file.level = 'info';

// SOLO BUSCAR ACTUALIZACIONES EN PRODUCCIÓN
if (!isDev) {
  app.on('ready', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
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
  } else {
    // En producción: cargar desde archivos estáticos
    // Limpiar caché antes de cargar para asegurar que se carguen los últimos cambios
    mainWindow.webContents.session.clearCache().then(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  }
}

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización disponible',
    message: 'Se está descargando una nueva versión del sistema...'
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización lista',
    message: 'La actualización se instalará al reiniciar la aplicación.',
    buttons: ['Reiniciar ahora']
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (err) => {
  log.error('Error en autoUpdater:', err);
});

app.whenReady().then(() => {
  // Desactivar caché en producción para asegurar que se carguen los últimos cambios
  if (!isDev) {
    // Limpiar solo el caché (NO el localStorage para mantener datos de autenticación)
    session.defaultSession.clearCache();
    // NO limpiar clearStorageData() para mantener companyData y otros datos de autenticación

    // Interceptar solicitudes para desactivar caché (solo una vez al iniciar)
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Limpiar caché también al reactivar
      if (!isDev) {
        session.defaultSession.clearCache();
      }
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});