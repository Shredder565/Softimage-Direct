/**
 * AfterImage — Electron main process.
 * Loads the Vite-built static app from dist/ (production) or Vite dev server (ELECTRON_DEV=1).
 * Softimage Layout chrome: single in-app menubar (WR-LOOK-00) — no duplicate OS File/Edit row.
 */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const isDev = process.env.ELECTRON_DEV === '1';
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

/** Softimage Desktop title density (HWND dump): five-space Project/Scene clusters. */
const SOFTIMAGE_CAPTION = 'AfterImage     Project: Softimage-Direct     Scene: Untitled';
/** Softimage 2015 Layout light warm-gray (--bg). */
const SOFTIMAGE_BG = '#aca8a5';

/** @type {BrowserWindow | null} */
let mainWindow = null;

/**
 * window.open handler — Softimage Flipbook / still used to call window.open('', '_blank').
 * openExternal('about:blank') on Windows surfaces Store / ms-link prompts for missing apps.
 * Allow blank/blob/data in-app; http(s) → default browser; never ms-windows-store or unknown protocols.
 */
function handleWindowOpen({ url }) {
  const u = String(url || '');
  if (!u || u === 'about:blank' || u.startsWith('blob:') || u.startsWith('data:')) {
    return { action: 'allow' };
  }
  if (/^https?:/i.test(u)) {
    shell.openExternal(u);
    return { action: 'deny' };
  }
  // Refuse ms-windows-store:, ms-link, file: without association, and other protocol traps.
  return { action: 'deny' };
}

function createWindow() {
  // Softimage Layout: one Softimage menubar inside the page — hide Electron OS menu (WR-LOOK-00).
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: SOFTIMAGE_CAPTION,
    backgroundColor: SOFTIMAGE_BG,
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(handleWindowOpen);

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { handleWindowOpen };
