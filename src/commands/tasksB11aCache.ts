// Row CMD-B11a (part 2): the cache-file commands of tasks.dll. Brief: docs/ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md.
//
//   CopyCacheFiles, DumpCacheHeader, CacheObjectsIntoFile_Private
//
// How the contracts are mapped onto this build:
//  * Files live in the session's virtual host file system (app.hostFs, CMD-01b).
//  * The five path-template preferences (ids 0..4) and the cache file-name preference come from Preferences >
//    Simulation (C3DPrefsSimulation). Which preference each id reads is note Q4; the order used here is the page order
//    (inferred): 0 project path, 1 local path, 2 path A, 3 path B, 4 path C. The file name is the file-name template
//    plus "." plus the cache file type string (inferred).
//  * Path tokens: [model], [object], [version], [frame] are set by the command; [scene] is the scene name; any other
//    token ([project path], [project], [env XSI_USERHOME]) must be given in `app.tasksB11a.tokens`, else token
//    resolution fails.
//  * The cache writer, the plan builder and the cache header reader are not read (note Q2): those branches log
//    "not yet attested" and record what would be written in `app.tasksB11a.cachePlans` / `dumps`.
import { App } from '../core/commands';
import { Node, X3DObject } from '../core/scene';
import { hostFs } from '../core/sdkHelpersHostFs';
import { siString } from '../ui/si';
import { openNetView } from './uixsiPrefsIceViewsHelpers';
import {
  b11a, reg, fail, setStatus, logNya, warn, interactive, unset, text, boolA, num, nodesArg, rawItems,
  S_OK, S_FALSE, E_NOTIMPL, E_UNEXPECTED, E_INVALIDARG,
} from './tasksB11aShared';

const T = (id: number, fallback: string) => siString('XSITASKS', id) ?? fallback;
const fmt = (s: string, ...v: (string | number)[]) => { let i = 0; return s.replace(/%[dsx]/g, () => String(v[i++] ?? '')); };

const SIM_DEFAULTS = {
  cachetemplatefilename: '[object]_[version]_[frame]', cachefiletypestring: 'icecache',
  cachetemplateprojectpath: '[project path]/Simulation/[model]/[object]/', cachetemplatelocalpath: '[env XSI_USERHOME]/Simulation/[project]/[scene]/[model]/[object]/',
  cachetemplatepatha: '', cachetemplatepathb: '', cachetemplatepathc: '',
};
function simPrefs(app: App): typeof SIM_DEFAULTS { return { ...SIM_DEFAULTS, ...((app as any).simulationPrefs ?? {}) }; }
/** Path-template preference `id` (0..4). inferred order (Q4). */
export function pathTemplate(app: App, id: number): string {
  const p = simPrefs(app);
  return [p.cachetemplateprojectpath, p.cachetemplatelocalpath, p.cachetemplatepatha, p.cachetemplatepathb, p.cachetemplatepathc][id] ?? '';
}
export function fileTemplate(app: App): string { const p = simPrefs(app); return `${p.cachetemplatefilename}.${p.cachefiletypestring}`; }

/** The path resolver: tokens set by the command first, then the scene name, then the session's token table. */
export function resolveTokens(app: App, template: string, set: Record<string, string | number>): string | null {
  let bad = false;
  const out = template.replace(/\[([^\]]+)\]/g, (all, tok: string) => {
    const k = tok.trim().toLowerCase();
    if (k in set) return String(set[k]);
    if (k === 'scene') return String(app.scene.val('Name') ?? 'Untitled');
    const user = Object.entries(b11a(app).tokens).find(([n]) => n.toLowerCase() === k);
    if (user) return user[1];
    bad = true; return all;
  });
  return bad ? null : out;
}
const join = (dir: string, file: string) => dir.replace(/[\\/]+$/, '') + '\\' + file;

/** (model name, object name, first frame, frame count) of one object. inferred: from the object's cache settings
 *  (`cacheRange` when set), else the scene frame range. */
function cacheInfo(app: App, o: Node): { model: string; object: string; first: number; count: number } {
  const x = o instanceof X3DObject ? o : null; const r = (o as any).cacheRange as { first: number; count: number } | undefined;
  return { model: x?.model?.name ?? app.scene.root.name, object: o.name, first: r?.first ?? app.anim.startFrame, count: r?.count ?? (app.anim.endFrame - app.anim.startFrame + 1) };
}

export function registerTasksB11aCache(app: App) {
  reg(app, 'CopyCacheFiles', {
    undoable: false,
    execute(app, a) {
      const C = 'CopyCacheFiles'; const st = b11a(app);
      const src = num(a.SourcePathID, -1) >>> 0, dst = num(a.TargetPathID, -1) >>> 0; // unsigned compare
      if (src >= 5 || dst >= 5) throw fail(E_INVALIDARG, `${C}: SourcePathID and TargetPathID must be 0..4`);
      const srcT = pathTemplate(app, src), dstT = pathTemplate(app, dst);
      const fileT = fileTemplate(app); const pc2 = /\.pc2$/i.test(fileT);
      if (!srcT) { app.logMsg('error', fmt(T(0x41e, 'The source path template %d is empty.'), src)); throw fail(E_INVALIDARG, `${C}: ${fmt(T(0x41e, 'The source path template %d is empty.'), src)}`); }
      if (!dstT) { app.logMsg('error', fmt(T(0x41f, 'The target path template %d is empty.'), dst)); throw fail(E_INVALIDARG, `${C}: ${fmt(T(0x41f, 'The target path template %d is empty.'), dst)}`); }
      const overwrite = boolA(a.Overwrite), version = text(a.Version ?? 'A');
      const objs = nodesArg(app, a.ObjectsToCache);
      if (objs.some(o => !(o as any).cacheRange)) logNya(app, C, 'how the frame range of each object is read (0x180076730); the scene frame range is used');
      const bar = boolA(a.ShowProgressbar ?? true) ? { title: T(0x433, 'Copying cache files...'), items: [] as string[] } : null;
      if (bar) st.progress.push(bar);
      let copied = 0, failed = 0;
      for (const o of objs) {
        const info = cacheInfo(app, o);
        bar?.items.push(`Copying cache files for ${info.model}.${info.object}`);
        const tok = (frame: number) => ({ model: info.model, object: info.object, version, frame });
        const targetDir = resolveTokens(app, dstT, tok(info.first));
        if (targetDir === null) throw fail(E_UNEXPECTED, `${C}: a token of the target path template ${dst} cannot be resolved`);
        try { hostFs.ensureFolder(targetDir.replace(/[\\/]+$/, '')); } catch { app.logMsg('error', fmt(T(0x420, 'Cannot copy files. The path %s is invalid.'), targetDir)); continue; }
        const last = pc2 ? info.first : info.first + info.count - 1; // one .pc2 file holds all frames
        for (let f = info.first; f <= last; f++) {
          const sDir = resolveTokens(app, srcT, tok(f)), tDir = resolveTokens(app, dstT, tok(f)), name = resolveTokens(app, fileT, tok(f));
          if (sDir === null || tDir === null || name === null) throw fail(E_UNEXPECTED, `${C}: a path token cannot be resolved`);
          const from = join(sDir, name), to = join(tDir, name);
          let ok = false;
          try { if (hostFs.isFile(from) && (overwrite || !hostFs.exists(to))) { hostFs.writeFile(to, hostFs.readFile(from)); ok = true; } } catch { ok = false; }
          if (ok) copied++; else failed++;
        }
      }
      if (failed) { warn(app, fmt(T(0x41c, 'Copied %d files.'), copied)); warn(app, fmt(T(0x41d, '%d files could not be copied.'), failed)); }
      setStatus(app, C, S_FALSE);
      return { Copied: copied, Failed: failed };
    },
  });

  reg(app, 'DumpCacheHeader', {
    undoable: false,
    execute(app, a) {
      const C = 'DumpCacheHeader'; const path = text(a.SourcePath);
      if (!path) throw fail(E_INVALIDARG, `${C}: SourcePath is empty`);
      const xml = path.replace(/\.[^.\\/]*$/, '') + '.xml'; // inferred name of the produced file
      logNya(app, C, `F3DDumpCacheHeaderFromFile (the cache header reader and the XML it writes); ${xml} is not written`);
      const show = interactive(app) && boolA(a.ShowInNetview ?? true);
      b11a(app).dumps.push({ source: path, xml, netView: show });
      if (show) openNetView(app, b11a(app).netViews, C, xml, false, 0); // OpenNetView URL = the produced file
      setStatus(app, C, S_OK);
      return xml;
    },
  });

  reg(app, 'CacheObjectsIntoFile_Private', {
    undoable: false,
    execute(app, a) {
      const C = 'CacheObjectsIntoFile_Private'; const st = b11a(app);
      const objs = nodesArg(app, a.ObjectsToCache);
      const pathId = Math.trunc(num(a.PathID, 0)), first = Math.trunc(num(a.FirstFrame, 1)), step = Math.max(1, Math.trunc(num(a.FramesPerStep, 1)));
      const attrs = rawItems(a.Attributes).map(text); const version = text(a.Version ?? 'A'); const alt = text(a.AlternativePath);
      const type = Number.isFinite(Number(a.Type)) ? Math.trunc(Number(a.Type)) : 0; // a failed read = 0
      let frames: number[] = [];
      if (type === 0) { const lastF = Math.trunc(num(a.LastFrame, 100)); for (let f = first; f <= lastF; f += step) frames.push(f); }
      else if (type === 1) {
        if (!unset(a.FrameSet) && !Array.isArray(a.FrameSet)) throw fail(E_INVALIDARG, `${C}: FrameSet is not an array`);
        frames = (Array.isArray(a.FrameSet) ? a.FrameSet : []).map(Number).filter(Number.isFinite); // written only if given
      } else throw fail(E_NOTIMPL, `${C}: Type ${type} is not 0 (frame range) or 1 (frame set)`);
      const bar = boolA(a.ShowProgressbar ?? true) ? { title: C, items: [] as string[] } : null;
      if (bar) st.progress.push(bar);
      st.ambient.Datamanagement_CachingToFiles = 1;
      const files: string[] = [];
      try {
        logNya(app, C, 'the plan builder and the cache writers (file naming, cache format; note Q2); the planned files are recorded in app.tasksB11a.cachePlans');
        for (const o of objs) {
          const info = cacheInfo(app, o); const tok = { model: info.model, object: info.object, version, frame: frames[0] ?? first };
          // inferred: PathID 0..4 = the path-template preferences; otherwise AlternativePath, whose "#" stands for the frame
          const file = pathId >= 0 && pathId < 5 && !alt
            ? (() => { const d = resolveTokens(app, pathTemplate(app, pathId), tok), n = resolveTokens(app, fileTemplate(app), tok); return d !== null && n !== null ? join(d, n) : join(pathTemplate(app, pathId), fileTemplate(app)); })()
            : (resolveTokens(app, alt, tok) ?? alt).replace('#', String(frames[0] ?? first));
          bar?.items.push(`${info.model}.${info.object}`);
          if (frames.length) st.cachePlans.push({ object: o.name, file, frames: [...frames], attributes: attrs });
          files.push(file);
        }
      } finally { st.ambient.Datamanagement_CachingToFiles = 0; }
      setStatus(app, C, S_OK);
      // RePackArg: ResolvedPath with its last character removed. inferred: the resolved paths each followed by ","
      const resolved = files.map(f => f + ',').join('');
      return resolved.slice(0, -1);
    },
  });
}
