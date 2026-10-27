/**
 * AfterImage preload — Softimage Render_Pictures auto-write (WR-MSLINK-01).
 * Never opens plates externally (no OpenWith / ms-link).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('afterimage', {
  /** Softimage OutputDir root on disk (…/AfterImage/Render_Pictures). */
  getRenderPicturesRoot: () => ipcRenderer.invoke('afterimage:getRenderPicturesRoot'),
  /**
   * Softimage-faithful silent plate write. relative Softimage path → disk under Render_Pictures.
   * Does not ShellExecute / openExternal the file.
   */
  writeRenderPicture: (payload) => ipcRenderer.invoke('afterimage:writeRenderPicture', payload),
});
