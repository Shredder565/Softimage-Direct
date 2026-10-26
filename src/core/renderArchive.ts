// Softimage ExportRenderArchive* / ExportObjectRenderArchive — WR-03.
// Registry + Rendering.vbs ExportObjectRenderArchiveProc attested names/args only.
// Writes an AfterImage render-archive JSON package (not Softimage .mi binary — no invent / no paste).
import type { App } from './commands';
import type { Pass, X3DObject } from './scene';
import {
  resolvePasses,
  renderScenePasses,
  type SceneRenderResult,
} from './sceneRender';

export interface RenderArchivePackage {
  softimage_command: string;
  format: 'afterimage-render-archive/v1';
  note: string;
  passes: string[];
  startFrame: number | null;
  endFrame: number | null;
  stepFrame: number | null;
  objects?: string[];
  fileName: string;
  pictures: { path: string; frame: number; format: string; byteLength: number }[];
  renderOk: boolean;
}

function downloadJson(filename: string, payload: unknown) {
  if (typeof document === 'undefined') return;
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function packageFromRender(
  cmd: string,
  fileName: string,
  passNames: string[],
  start: number | null,
  end: number | null,
  step: number | null,
  result: SceneRenderResult,
  objects?: string[],
): RenderArchivePackage {
  return {
    softimage_command: cmd,
    format: 'afterimage-render-archive/v1',
    note: 'Softimage Export*RenderArchive scripting names; Softimage .mi archive bytes ABSENT — AfterImage JSON package only (behavioral tour WR-03).',
    passes: passNames,
    startFrame: start,
    endFrame: end,
    stepFrame: step,
    objects,
    fileName,
    pictures: result.files.map(f => ({
      path: f.path,
      frame: f.frame,
      format: f.format,
      byteLength: f.byteLength,
    })),
    renderOk: result.ok,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Softimage ExportRenderArchive — Passes collection + optional frame range. */
export function exportRenderArchive(app: App, args: Record<string, any> = {}): RenderArchivePackage {
  const passesArg = args.Passes ?? 'Passes.Current';
  const start = numOrNull(args.StartFrame);
  const end = numOrNull(args.EndFrame);
  const step = numOrNull(args.StepFrame);
  const passList = resolvePasses(app, passesArg);
  const result = renderScenePasses(app, {
    passes: passesArg,
    startFrame: start,
    endFrame: end,
    stepFrame: step,
    download: false,
    openPreview: false,
  });
  const leaf = passList.map(p => p.name).join('_') || 'Passes';
  const fileName = String(args.FileName || `RenderArchive_${leaf}`);
  const pkg = packageFromRender('ExportRenderArchive', fileName, result.passNames, start, end, step, result);
  (globalThis as any).__siLastRenderArchive = pkg;
  downloadJson(fileName, pkg);
  app.logMsg('info', `ExportRenderArchive → ${fileName}.json (${pkg.pictures.length} picture(s); Softimage .mi ABSENT)`);
  return pkg;
}

/** Softimage ExportRenderArchiveAllPasses — default Passes.List.*. */
export function exportRenderArchiveAllPasses(app: App, args: Record<string, any> = {}): RenderArchivePackage {
  return exportRenderArchive(app, { ...args, Passes: args.Passes ?? 'Passes.List.*' });
}

/** Softimage ExportObjectRenderArchive — object (+ children) scope. */
export function exportObjectRenderArchive(app: App, args: Record<string, any> = {}): RenderArchivePackage {
  const targets: X3DObject[] = args.InputObj
    ? app.targets(args.InputObj)
    : [...app.selectedObjects];
  if (!targets.length) {
    const err = 'ExportObjectRenderArchive: select an object (Softimage InputObj)';
    app.logMsg('error', err);
    const empty = packageFromRender('ExportObjectRenderArchive', 'object_archive', [], null, null, null, {
      ok: false, files: [], width: 0, height: 0, format: 'pic', passNames: [], mode: 'still', outputDir: '', error: err,
    }, []);
    (globalThis as any).__siLastRenderArchive = empty;
    return empty;
  }
  const names: string[] = [];
  for (const o of targets) {
    names.push(o.name);
    for (const c of o.descendants()) names.push(c.name);
  }
  const start = numOrNull(args.StartFrame);
  const end = numOrNull(args.EndFrame);
  const step = numOrNull(args.StepFrame);
  // Softimage MultiFrame false → current/single; when Start/End null pin current frame.
  const multi = !!args.MultiFrame;
  const result = renderScenePasses(app, {
    passes: 'Passes.Current',
    currentFrameOnly: !multi && start == null && end == null,
    startFrame: start,
    endFrame: end,
    stepFrame: step,
    download: false,
    openPreview: false,
  });
  const fileName = String(args.FileName || `${targets[0].name}_RenderArchive`);
  const pkg = packageFromRender(
    'ExportObjectRenderArchive',
    fileName,
    result.passNames,
    start,
    end,
    step,
    result,
    names,
  );
  (pkg as any).displayProxy = args.DisplayProxy !== false;
  (pkg as any).multiFrame = multi;
  (globalThis as any).__siLastRenderArchive = pkg;
  downloadJson(fileName, pkg);
  app.logMsg('info', `ExportObjectRenderArchive → ${fileName}.json (${names.length} object(s); Softimage .mi ABSENT)`);
  return pkg;
}

/** Softimage ExportRenderArchiveFrameSet — FrameSet on pass then archive. */
export function exportRenderArchiveFrameSet(app: App, args: Record<string, any> = {}): RenderArchivePackage {
  if (args.FrameSet) {
    const pass = app.scene.passes[app.scene.passes.length - 1];
    if (pass?.get('FrameSet')) app.setParam(pass.get('FrameSet')!, String(args.FrameSet));
  }
  return exportRenderArchive(app, args);
}

/** Softimage RenderSelectedPasses — selected Pass nodes, else Passes.Current. */
export function resolveSelectedOrCurrentPasses(app: App): Pass[] {
  const fromSel = app.selection.filter((n): n is Pass => (n as Pass)?.kind === 'pass' || (n as any)?.type === 'Pass');
  if (fromSel.length) return fromSel;
  return resolvePasses(app, 'Passes.Current');
}
