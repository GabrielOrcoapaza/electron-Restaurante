import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 1200,
    minHeight: 800,
    show: false, // No mostrar hasta que esté listo
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
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