/**
 * AfterImage — Electron main process.
 * Loads the Vite-built static app from dist/ (production) or Vite dev server (ELECTRON_DEV=1).
 * Softimage Layout chrome: single in-app menubar (WR-LOOK-00) — no duplicate OS File/Edit row.
 * Softimage Render_Pictures auto-write (WR-MSLINK-01) — no Save As / OpenWith ms-link.
 */
const { app, BrowserWindow, Menu, shell, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isDev = process.env.ELECTRON_DEV === '1';
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

/** Softimage Desktop title density (HWND dump): five-space Project/Scene clusters. */
const SOFTIMAGE_CAPTION = 'AfterImage     Project: Softimage-Direct     Scene: Untitled';
/** Softimage 2015 Layout light warm-gray (--bg). */
const SOFTIMAGE_BG = '#aca8a5';

/** @type {BrowserWindow | null} */
let mainWindow = null;

/**
 * Softimage OutputDir analogue: [Project Path]\Render_Pictures under user Documents.
 * Dump-attested leaf: Default_Pass_Main.<f>.pic — never ShellExecute (assoc .pic missing → Pick an app).
 */
function renderPicturesRoot() {
  const docs = app.getPath('documents');
  return path.join(docs, 'AfterImage', 'Render_Pictures');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

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

/**
 * Softimage still Save As was Electron download dialog (tour: #32770 PIC File).
 * Softimage auto-writes — if a plate download somehow starts, setSavePath under Render_Pictures (no dialog).
 */
function installDownloadGuard() {
  session.defaultSession.on('will-download', (_event, item) => {
    const name = item.getFilename() || '';
    const softimagePlate =
      /\.(pic|png)$/i.test(name) &&
      (/Default_Pass|still_frame|Pass_Main|Render_Pictures/i.test(name) || /^\w+_Pass_/i.test(name));
    if (!softimagePlate) return;
    const root = renderPicturesRoot();
    ensureDir(root);
    // Keep Softimage .pic leaf when download name is Softimage-faithful; else store as given under root.
    const dest = path.join(root, path.basename(name));
    item.setSavePath(dest);
    // Never open after download — OpenWith Pick an app for .pic (WR-MSLINK-00).
  });
}

function registerIpc() {
  ipcMain.handle('afterimage:getRenderPicturesRoot', () => renderPicturesRoot());

  ipcMain.handle('afterimage:writeRenderPicture', (_evt, payload = {}) => {
    const softimagePath = String(payload.softimagePath || payload.path || '');
    const dataUrl = String(payload.dataUrl || '');
    if (!softimagePath || !dataUrl.startsWith('data:')) {
      return { ok: false, error: 'softimagePath + dataUrl required' };
    }
    // Softimage relative path under OutputDir (Render_Pictures/Default_Pass_Main.1.pic).
    const rel = softimagePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/^[a-zA-Z]:\//, '') // strip drive if absolute Windows path leaked
      .replace(/^.*?(Render_Pictures\/)/i, '$1');
    const underPictures = rel.includes('Render_Pictures/')
      ? rel
      : path.posix.join('Render_Pictures', path.posix.basename(rel));
    const leafRel = underPictures.replace(/^Render_Pictures\/?/i, '');
    const root = renderPicturesRoot();
    const abs = path.join(root, ...leafRel.split('/').filter(Boolean));
    ensureDir(path.dirname(abs));

    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
    if (!m) return { ok: false, error: 'bad dataUrl' };
    const b64 = m[2] ? m[3] : Buffer.from(decodeURIComponent(m[3])).toString('base64');
    const buf = Buffer.from(b64, 'base64');
    fs.writeFileSync(abs, buf);
    // Softimage writes silently — do not shell.openPath / openExternal (ms-link / Pick an app).
    return { ok: true, path: abs, bytes: buf.length, softimagePath };
  });
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
      preload: path.join(__dirname, 'preload.cjs'),
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
  registerIpc();
  installDownloadGuard();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { handleWindowOpen, renderPicturesRoot };
