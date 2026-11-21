// Row CMD-B19d: RenderRegionSave (rendercore.dll class 8ab0e935; siuitasks only uses the class), wired to section 3.11
// of docs/ghidra/cmd-b19d-selection-playback-isolate.md and item 15 of docs/re/WIRE_CORRECTIONS_B19.md.
// Registered after src/commands/moduleToolbar.ts, whose earlier RenderRegionSave body it replaces on the bus.
//
// Render regions of this build: each 3D view's display extra (`vp.x.region`, shown unless `vp.x.hidden`; its image is
// `vp.x.regionImg`, src/ui/viewExtras.ts). Writing a file (DSWriteImageToFile) goes to the session's virtual host file
// system (src/core/sdkHelpersHostFs.ts) as a data URL, and the browser is handed the same image as a download.
// Original code only.
import { App } from '../core/commands';
import { hostFs } from '../core/sdkHelpersHostFs';
import { viewports, vm, type VP } from './inferredB10Shared';
import { b19d, nyaB19d, writePref, S_OK, E_ABORT } from './selectionB19d';
import { SiStatusError } from './alembicSeqCam';

const C = 'RenderRegionSave';
const VIEWPORT_CODE: Record<string, number> = { siViewportA: 0, siViewportB: 1, siViewportC: 2, siViewportD: 3, siViewportAll: -1, siViewportCurrent: -2, siViewportUnderMouse: -3 };

/** The Viewport argument as the resolver's code (CMD-B19a §2.1): >= 0 view id, -1 all, -2 current, -3 the other one. */
function viewportCode(v: any): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  const s = String(v ?? '').trim();
  const name = /^:?(siViewport[A-Za-z]+)/.exec(s)?.[1];
  if (name && name in VIEWPORT_CODE) return VIEWPORT_CODE[name];
  if (/^-?\d+$/.test(s)) return Number(s);
  return s === '' ? -2 : null;
}
/** Severity → this build's log: 2 error, 4 warning, 8 / 16 info. */
function rcLog(app: App, id: number, severity: number, args: string[] = []) {
  const text = `XSIRENDERCORE message ${id}${args.length ? ` (${args.join(', ')})` : ''}`;
  if (severity === 2) app.logMsg('error', `${C}: ${text}`);
  else app.logMsg('info', `${severity === 4 ? 'WARNING : ' : ''}${C}: ${text}`);
}
const letter = (i: number) => i >= 0 && i <= 3 ? 'ABCD'[i] : `View${i}`;
const regionShown = (vp: VP) => !!vp.x?.region && !vp.x?.hidden && vp.x.region.w > 0 && vp.x.region.h > 0;
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export function registerRenderRegionSaveB19dCommands(app: App) {
  (app as any).renderRegionSaveB19d = { hostFs };
  app.register({
    name: C, label: 'Save Render Region To File', category: 'Rendering', description: 'Save the contents of the render region to a file', undoable: false,
    args: [{ name: 'Viewport', default: ':siViewportCurrent:siViewport' }, { name: 'FileName', default: null }, { name: 'WaitUntilComplete', default: true }],
    execute(app2, a) {
      // UnPackArg
      const code = viewportCode(a.Viewport);
      let fileName = ''; let wait = false;
      if (typeof a.FileName === 'string') {
        fileName = a.FileName;
        if (typeof a.WaitUntilComplete === 'boolean') wait = a.WaitUntilComplete; // a non-bool: the remaining reads are skipped
      }
      if (fileName) {
        const dot = fileName.lastIndexOf('.'); const slash = Math.max(fileName.lastIndexOf('\\'), fileName.lastIndexOf('/'));
        const ext = dot > slash ? fileName.slice(dot) : '';
        if (ext) writePref(app2, 'rendering.default_savepicture_filetype', ext);
      }
      // the regions of the resolved viewport(s), those not shown dropped
      const vps = viewports(); const V = vm();
      let ids: number[] = [];
      if (code === null || code < -3) rcLog(app2, 2, 4, [String(a.Viewport)]);
      else if (code >= 0) ids = vps[code] ? [code] : [];
      else if (code === -1) ids = vps.map((_, i) => i);
      else {
        if (code === -3) nyaB19d(app2, C, 'which viewport the manager designates for code -3 (inferred: the one under the mouse); the current viewport is used');
        const i = V ? vps.indexOf(V.active()) : -1; ids = i >= 0 ? [i] : [];
      }
      const regions = ids.filter(i => regionShown(vps[i]));
      if (!regions.length) {
        rcLog(app2, 4, 4);
        b19d(app2).status[C] = E_ABORT;
        throw new SiStatusError(E_ABORT, `${C}: no render region is shown`);
      }
      const several = regions.length > 1;
      const written: string[] = [];
      for (const i of regions) {
        const vp = vps[i];
        let path = fileName;
        if (several) { const dot = fileName.lastIndexOf('.'); path = dot >= 0 ? `${fileName.slice(0, dot)}_${letter(i)}${fileName.slice(dot)}` : `${fileName}_${letter(i)}`; }
        // the region's image; with WaitUntilComplete the render lock is released while it is fetched (this build
        // renders the region on the viewport's frame, so the image is the last one drawn)
        if (wait) vm()?.redraw?.();
        const img: HTMLCanvasElement | null = vp.x?.regionImg ?? null;
        try {
          if (!img) throw new Error('the region has no image yet');
          if (!path) throw new Error('no file name');
          const dot = path.lastIndexOf('.'); const mime = MIME[dot >= 0 ? path.slice(dot).toLowerCase() : ''] ?? 'image/png';
          const url = img.toDataURL(mime);
          hostFs.writeFile(path, url); // DSWriteImageToFile
          written.push(path);
          if (typeof document !== 'undefined' && (app2 as any).renderRegionSaveDownload !== false) {
            const link = document.createElement('a'); link.href = url; link.download = hostFs.baseName(path) || 'RenderRegion.png'; link.click();
          }
          rcLog(app2, 5, several ? 8 : 16, [letter(i), path]);
        } catch (e: any) {
          rcLog(app2, 6, 2, [letter(i), path]);
          void e;
        }
      }
      (b19d(app2) as any).renderRegionFiles = written;
      b19d(app2).status[C] = S_OK;
      return undefined;
    },
  });
}
