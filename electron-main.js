/* ═════════════════════════════════════════════════════════════════
   electron-main.js — Enveloppe desktop (Electron) du site C.C. Salouel
   ─────────────────────────────────────────────────────────────────
   - Démarre le serveur Express (server.js) avec le Node intégré d'Electron
     (ELECTRON_RUN_AS_NODE) si rien n'écoute déjà sur le port.
   - Ouvre une fenêtre qui charge http://localhost:PORT.
   - Les liens externes s'ouvrent dans le navigateur système.
   - Coupe le serveur à la fermeture.

   Nécessite que MySQL (Laragon) soit démarré — le serveur s'y connecte.
   ═════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, shell, dialog, Menu } = require('electron');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');

// En prod packagée, les ressources sont dans process.resourcesPath/app ;
// __dirname pointe déjà au bon endroit (asar désactivé). On charge le .env
// présent à côté de server.js.
const APP_DIR = __dirname;
const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

let serverProc = null;
let mainWindow = null;

function ping(timeout = 1200) {
  return new Promise((resolve) => {
    const req = http.get(BASE + '/', (res) => { res.resume(); resolve(res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(timeout, () => { req.destroy(); resolve(false); });
  });
}

async function ensureServer() {
  // Si un serveur tourne déjà (Laragon, npm start…), on le réutilise.
  if (await ping()) return true;

  serverProc = fork(path.join(APP_DIR, 'server.js'), [], {
    cwd: APP_DIR,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(PORT) },
  });
  serverProc.on('error', (e) => console.error('[server] fork error', e));

  for (let i = 0; i < 60; i++) {
    if (await ping()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 390,
    minHeight: 600,
    backgroundColor: '#0A1410',
    title: 'Club de Cyclisme de Salouel',
    icon: path.join(APP_DIR, 'asset', 'img', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadURL(BASE);

  // Les liens marqués target=_blank → navigateur système (pas une fenêtre Electron).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Empêche plusieurs instances de l'app.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });

  app.whenReady().then(async () => {
    const ok = await ensureServer();
    if (!ok) {
      dialog.showErrorBox(
        'Démarrage impossible',
        'Le serveur local n’a pas pu démarrer.\n\nVérifie que MySQL (Laragon) est bien démarré, puis relance l’application.'
      );
    }
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

function stopServer() {
  if (serverProc) { try { serverProc.kill(); } catch { /* ignore */ } serverProc = null; }
}

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', stopServer);
