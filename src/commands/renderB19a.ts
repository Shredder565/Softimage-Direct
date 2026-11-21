// Ledger row CMD-B19a (rendercore.dll): the 12 RenderRegion* commands, RemoveRenderChannel, SICreatePass,
// SICreateEmptyPartition, MoveToPartition, SIRenderPass / RenderPassesFrameSet / RenderSelectedPasses,
// ExportRenderArchiveFrameSet / ExportRenderArchiveAllPasses and RenderPassToggleShowRenderedImage.
// Brief: docs/ghidra/cmd-b19a-rendercore-region-passes.md sections 2, 3 and 5, and the CMD-B19a section of
// docs/re/WIRE_CORRECTIONS_B19.md. Original code written from that prose only; there is no XSIBATCH golden.
//
// These names were registered before in src/commands/renderToolbarOm.ts and src/commands/moduleToolbar.ts (one global
// region object, label strings, a pass fallback); those registrations are removed and the bodies live here. The
// CMD-B6e script stand-ins (duplicateRenderingSimulationScriptsRendering.ts) now call these commands on the bus.
//
// How the contracts are mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError ("<command>: ... (status 0x...)"). Status 1 (S_FALSE, nothing
//    resolved) is kept in `app.renderB19a.status[<command>]`; the command then returns nothing.
//  * Output arguments (`Value`) are returned and also kept in `app.renderB19a.out[<command>]`.
//  * Render regions live per viewport id in `app.renderB19a.regions` (id 0..3 = viewports A..D of the View Manager).
//    The viewport overlay (src/ui/viewExtras.ts) draws them from the `renderregion-sync` event.
//  * The render-channel manager is this build's `window.__siRenderChannels` list (CreateRenderChannel).
//  * User preferences are the C3DPrefsRendering page of File > Preferences (`Preferences.rendering.*`).
//  * XSIRENDERCORE / simsgcat dictionary texts were not read: messages carry the string id, e.g. "[XSIRENDERCORE 0x19]".
//  * The parts the analyst could not read log "<command>: not yet attested: <what> (CMD-B19a)".
//
// CMD-B20c (docs/ghidra/cmd-b20c-pr201-answers.md Q1-Q9, WIRE_CORRECTIONS_B20 CMD-B20c items 1-8): Current / All
// registry entries of the region toggles, the preference writes with Viewport All and no region, the frame-set parser,
// SICreatePass timing / pass test / partition fill, the SICreateEmptyPartition lock test and Type rule, and the
// RemoveRenderChannel lookup. Parts still open log "not yet attested ... (CMD-B20c)".
import { App } from '../core/commands';
import { Node, X3DObject, Pass, Partition, Framebuffer, Light, Camera } from '../core/scene';
import { renderScenePasses, expandRenderTokens } from '../core/sceneRender';
import { preferenceSets } from '../ui/prefs';
import { SiStatusError } from './alembicSeqCam';
import { getSiRenderRegion } from './renderToolbarOm';
import { deleteObjList } from './tasksB16c';
import { currentPass, nodeOf } from './duplicateRenderingSimulationScriptsShared';
import { stateOf as modelTasksState } from './modelTasksB15aShared';
import { isLocked as isLockedAt } from './inferredB10Scene';

export const ROW = 'CMD-B19a';
export const S_FALSE = 1, E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_UNEXPECTED = 0x8000ffff;
/** Status the render handler returns when the worker reports E_ABORT (user cancel). */
export const SI_RENDER_CANCELLED = 0x562e80c7;
/** Status of the restricted-mode refusal of the archive export (raised with simsgcat 0x143). */
export const E_RESTRICTED = 0x80004021;

// ------------------------------------------------------------------ enums
// Public Softimage SDK enum values (siViewport, siRenderRegionDisplayType, siRenderRegionRefreshMode, siPartitionType,
// siRenderVerbosity). The display / refresh values agree with the C3DPrefsRendering SPDL items in src/data/si/propsets.json
// (region_display_mode: Alpha-Blended RGB 0, RGB Only 1, Alpha 2, Red 3, Green 4, Blue 5; region_refresh_mode:
// Interactive 0, Manual 2).
const ENUMS: Record<string, number> = {
  siViewportA: 0, siViewportB: 1, siViewportC: 2, siViewportD: 3,
  siViewportAll: -1, siViewportCurrent: -2, siViewportUnderMouse: -3,   // inferred names for -2 / -3 (note 2.1)
  siRenderRegionDisplayRGBA: 0, siRenderRegionDisplayRGB: 1, siRenderRegionDisplayAlpha: 2,
  siRenderRegionDisplayRed: 3, siRenderRegionDisplayGreen: 4, siRenderRegionDisplayBlue: 5,
  siRenderRegionRefreshModeInteractive: 0, siRenderRegionRefreshModeCTRS: 1, siRenderRegionRefreshModeManual: 2,
  siObjectPartition: 1, siLightPartition: 2,   // inferred mapping of the handler's Type 1 / 2 (note, SICreateEmptyPartition)
  siRenderVerbosityOff: 0, siRenderVerbosityOn: 1, siRenderVerbosityDefault: -1,   // inferred
};
/** An enum-valued argument: a number, a ":name:type" / "name" enum string, or a numeric string (`_wtol`). */
export function enumValue(v: unknown): number | undefined {
  if (typeof v === 'number') return Math.trunc(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  const m = /^:?([A-Za-z_][A-Za-z0-9_]*)(?::[A-Za-z0-9_]*)?$/.exec(s);
  if (m && m[1] in ENUMS) return ENUMS[m[1]];
  // _wtol: leading integer, 0 when there is none
  const n = /^[+-]?\d+/.exec(s);
  return n ? parseInt(n[0], 10) : 0;
}

// ------------------------------------------------------------------ state
export interface RenderRegion {
  viewport: number;
  visible: boolean;
  left: number; right: number; top: number; bottom: number;
  /** Region slot 0x40 / 0x48 (siRenderRegionRefreshMode). */
  refreshMode: number;
  /** Region slot 0x80 (siRenderRegionDisplayType). */
  displayType: number;
  trackSelection: boolean;
  /** Current viewing render channel (name of an entry of the channel manager). */
  channel: string;
  /** Number of re-renders asked (slot 0x68). */
  renders: number;
}
export interface RenderJob {
  pass: Pass; name: string; mode: 'render' | 'export';
  frames: number[];
  /** 'set' (frame set), 'range' (start / end / step) or 'own' (the pass's own range). */
  choice: 'set' | 'range' | 'own';
  verbose: number;
  frame_offset?: number; frame_total?: number;
}
export interface RenderB19aState {
  regions: Map<number, RenderRegion>;
  /** Stand-in for the viewport manager's "other designated viewport" (code -3); null = the current viewport. */
  underMouse: number | null;
  /** Notification properties raised (RENCORE_FLUSH_DELAYED_RENDERREGION_INIT). */
  notifications: string[];
  /** Global render-service refresh requests (RenderRegionRefresh). */
  globalRefreshes: number;
  status: Record<string, number>;
  out: Record<string, Record<string, unknown>>;
  /** Render / export jobs of the last run of each handler. */
  lastJobs: { command: string; jobs: RenderJob[] } | null;
  /** Archive packages written by the export commands (the archive writer itself was not read). */
  archives: { command: string; file: string; jobs: { pass: string; name: string; frames: number[] }[] }[];
  /** Stand-in for the renderer's user abort: when true the next render job run returns E_ABORT. */
  abortNext: boolean;
}
export function renderB19a(app: App): RenderB19aState {
  return ((app as any).renderB19a ??= {
    regions: new Map(), underMouse: null, notifications: [], globalRefreshes: 0, status: {}, out: {}, lastJobs: null, archives: [], abortNext: false,
  } satisfies RenderB19aState);
}

const fail = (cmd: string, status: number, what: string) => new SiStatusError(status, `${cmd}: ${what}`);
const nya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`);
const nya20 = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (CMD-B20c)`);
/** Severity 4 (warning) and severity 2 (error) messages; the dictionary texts were not read. */
const warn = (app: App, cmd: string, id: number, arg: string) => app.logMsg('info', `WARNING : ${cmd}: [XSIRENDERCORE 0x${id.toString(16)}] ${arg}`);
const error = (app: App, cmd: string, id: number, arg: string) => app.logMsg('error', `${cmd}: [XSIRENDERCORE 0x${id.toString(16)}] ${arg}`);
const unset = (v: unknown) => v === undefined || v === null || v === '';

// ------------------------------------------------------------------ preferences (Preferences.rendering.*)
const PREF_PAGE = 'C3DPrefsRendering';
function prefParam(app: App, name: string) { return preferenceSets(app).get(PREF_PAGE)?.get(name); }
export function renderPref(app: App, name: string): any { return prefParam(app, name)?.value; }
function writePref(app: App, name: string, value: unknown) {
  const p = prefParam(app, name);
  if (!p) { nya(app, 'SetUserPref', `preference rendering.${name} is not in this build`); return; }
  p.value = value;   // region preferences: not undoable (the region commands record no undo)
}

// ------------------------------------------------------------------ viewports (View Manager)
const vmOf = (): any => (globalThis as any).__vm ?? null;
function viewportIds(): number[] {
  const vps = vmOf()?.viewports?.();
  const n = Array.isArray(vps) && vps.length ? vps.length : 4;
  return [...Array(n).keys()];
}
function currentViewport(): number {
  const vm = vmOf(); const vps = vm?.viewports?.(); const a = vm?.active?.();
  const i = Array.isArray(vps) && a ? vps.indexOf(a) : -1;
  return i >= 0 ? i : 0;   // inferred: no View Manager -> viewport A
}
function refreshViewports() { vmOf()?.redraw?.(); }

/** Push the per-viewport region state to the overlay and mirror the current viewport's region on the legacy object. */
export function syncRegions(app: App) {
  const st = renderB19a(app);
  const regions = [...st.regions.values()].map(r => ({ ...r }));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('renderregion-sync', { detail: { regions } }));
  const rr = getSiRenderRegion(); const cur = st.regions.get(currentViewport());
  rr.open = !!cur; rr.visible = !!cur?.visible;
  if (cur) {
    rr.left = cur.left; rr.right = cur.right; rr.top = cur.top; rr.bottom = cur.bottom; rr.channel = cur.channel; rr.track = cur.trackSelection;
    rr.refresh = ['Interactive', 'Camera/Time/Region', 'Manual'][cur.refreshMode] ?? String(cur.refreshMode);
    rr.display = ['RGBA', 'RGB', 'Alpha', 'Red', 'Green', 'Blue'][cur.displayType] ?? String(cur.displayType);
  }
  // rendering.region_auto_refresh is its own boolean preference (default true) that no region command writes
  // (CMD-B20c Q2: ToggleAutoRefresh flips the refresh mode Interactive 0 <-> CTRS 1)
  const ar = renderPref(app, 'region_auto_refresh');
  rr.autoRefresh = ar === undefined || ar === null ? true : !!ar;
  app.events.emit('frame');
}

/**
 * The region resolver (note 2.1). `code` is the Viewport argument; only RenderRegionCreate passes `create`.
 * Returns null when nothing is resolved (status S_FALSE: the command does nothing).
 */
function resolveRegions(app: App, cmd: string, viewport: unknown, create = false, emptyAll = false): { all: boolean; regions: RenderRegion[] } | null {
  const st = renderB19a(app);
  const code = enumValue(viewport) ?? -2;
  if (code < -3) { warn(app, cmd, 2, String(code)); st.status[cmd] = S_FALSE; return null; }
  const ids = viewportIds();
  let picked: number[];
  if (code >= 0) picked = ids.includes(code) ? [code] : [];
  else if (code === -1) picked = ids;
  else if (code === -2) picked = [currentViewport()];
  else {
    if (st.underMouse == null) nya(app, cmd, 'the viewport manager\'s designated viewport for code -3 (siViewportUnderMouse, inferred); the current viewport is used');
    picked = [st.underMouse ?? currentViewport()];
  }
  const regions: RenderRegion[] = [];
  for (const id of picked) {
    let r = st.regions.get(id);
    if (!r && create) {
      // inferred: a new region starts with zero bounds and the preference modes, hidden, on the Main channel
      r = {
        viewport: id, visible: false, left: 0, right: 0, top: 0, bottom: 0,
        refreshMode: Number(renderPref(app, 'region_refresh_mode') ?? 0), displayType: Number(renderPref(app, 'region_display_mode') ?? 0),
        trackSelection: !!renderPref(app, 'region_track_selection'), channel: 'Main', renders: 0,
      };
      st.regions.set(id, r);
    }
    if (r) regions.push(r);
  }
  if (!regions.length) {
    st.status[cmd] = S_FALSE;
    // CMD-B20c Q3: the set / toggle workers ignore the resolver's S_FALSE; with Viewport All the region loop runs zero
    // times and the preference branch still runs (`emptyAll`)
    return emptyAll && code === -1 ? { all: true, regions } : null;
  }
  st.status[cmd] = 0;
  return { all: code === -1, regions };
}

// ------------------------------------------------------------------ render channels
interface RenderChannel { name: string; type: string }
export function renderChannels(): RenderChannel[] {
  const w = globalThis as any;
  return (w.__siRenderChannels ??= [{ name: 'Main', type: 'Color' }]);
}

// ------------------------------------------------------------------ pass list argument (note 2.2)
function passListArg(app: App, cmd: string, arg: unknown): Pass[] {
  const out: Pass[] = [];
  const add = (p: Pass) => { if (!out.includes(p)) out.push(p); };
  const one = (x: unknown) => {
    if (x === undefined || x === null || x === '') return;
    if (Array.isArray(x)) { x.forEach(one); return; }
    if (x instanceof Pass) { add(x); return; }
    if (x instanceof Node) { warn(app, cmd, 0x19, x.name); return; }
    if (typeof x !== 'string') return;
    for (const raw of x.split(',')) {
      const s = raw.trim().replace(/^\{[0-9A-Fa-f-]+\}:/, ''); if (!s) continue;
      if (/^Passes\.List\.\*$/i.test(s) || /^Passes\.\*$/i.test(s)) { app.scene.passes.forEach(add); continue; }
      const n = /^Passes\.Current$/i.test(s) ? currentPass(app) : nodeOf(app, s);
      if (n instanceof Pass) add(n);
      else warn(app, cmd, 0x19, s);   // inferred: an unresolved name is reported like a non-pass item
    }
  };
  // Collection handler: an empty argument is the selection (RenderSelectedPasses has no default)
  if (unset(arg)) app.selection.forEach(one); else one(arg);
  return out;
}

/** `_wtof` (C runtime): the value of the longest decimal prefix of the text, leading blanks skipped; 0 when none. */
export function wtof(text: string): number {
  const m = /^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(text);
  return m ? Number(m[0]) : 0;
}
const PUNCT = /[!-\/:-@\[-`{-~]/;   // iswpunct on ASCII
/** Guard of this build only (a browser cannot hold an unbounded range); the parser itself has no limit. */
const MAX_FRAMES = 1_000_000;
/** Number check of the frame-set parser: one leading sign is skipped, then a second punctuation character fails. */
function frameNumberOk(t: string): boolean {
  let n = 0;
  for (let i = /^[+-]/.test(t) ? 1 : 0; i < t.length; i++) if (!/[0-9]/.test(t[i]) && PUNCT.test(t[i]) && ++n > 1) return false;
  return true;
}
/**
 * Frame-set parser 0x1800a77e0 (CMD-B20c Q5). Comma-separated tokens, each trimmed; an empty token invalidates the
 * whole set. A token is a range "A-B" only when its first '-' is after the first character (so "-5" and "-5-3" are
 * single frames); a range is step 1 from A while <= B, and B < A is invalid. There is no step syntax. Every number
 * passes the punctuation check and is read with `_wtof` ("5abc" -> 5, "2.5" -> 2.5). The result is an ordered set:
 * sorted ascending, duplicates dropped. Returns null for an invalid set (the parser's E_INVALIDARG).
 */
export function parseFrameSet(app: App, cmd: string, text: string): number[] | null {
  const s = String(text ?? '');
  if (!s) return null;
  const set = new Set<number>();
  for (const tok of s.split(',')) {
    const t = tok.trim();
    if (!t) return null;
    const dash = t.indexOf('-');
    if (dash > 0) {
      const l = t.slice(0, dash).trim(), r = t.slice(dash + 1).trim();
      if (!frameNumberOk(l) || !frameNumberOk(r)) return null;
      const a = wtof(l), b = wtof(r);
      if (b < a) return null;
      if (b - a > MAX_FRAMES) { nya20(app, cmd, `a frame range of more than ${MAX_FRAMES} frames ("${t}"); this build refuses it as invalid`); return null; }
      for (let f = a; f <= b; f += 1) set.add(f);
    } else {
      if (!frameNumberOk(t)) return null;
      set.add(wtof(t));
    }
  }
  return set.size ? [...set].sort((x, y) => x - y) : null;
}

interface FrameArgs { frameSet: number[] | null; frameSetText: string; start?: number; end?: number; step?: number; verbose: number }
function frameArgs(app: App, cmd: string, a: Record<string, any>, integer: boolean): FrameArgs {
  const out: FrameArgs = { frameSet: null, frameSetText: '', verbose: -1 };
  if (typeof a.FrameSet === 'string') {
    out.frameSetText = a.FrameSet;
    out.frameSet = parseFrameSet(app, cmd, a.FrameSet);
    if (!out.frameSet) return out;   // an empty / unparsable set: no frame set and Verbose is not read
  } else {
    const conv = (v: unknown) => { if (unset(v)) return undefined; const n = Number(v); if (!Number.isFinite(n)) return undefined; return integer ? Math.round(n) : n; };
    out.start = conv(a.StartFrame); out.end = conv(a.EndFrame);
    const st = unset(a.StepFrame) ? undefined : Math.trunc(Number(a.StepFrame));
    out.step = st !== undefined && Number.isFinite(st) ? st : undefined;
    if (out.start !== undefined && out.end !== undefined && out.step === undefined) out.step = 1;
  }
  const v = enumValue(a.Verbose);
  out.verbose = v === 0 || v === 1 ? v : -1;
  return out;
}

function rangeFrames(start: number, end: number, step: number): number[] {
  const s = step >= 1 ? step : 1; const out: number[] = [];
  for (let f = start; f <= end + 1e-9; f += s) out.push(f);
  return out;
}

/** Own range of a pass from its range source (parameter 0x1b, inferred name FrameRangeSource; note, export slot 9). */
function ownFrames(app: App, cmd: string, pass: Pass): number[] {
  const read = (src: Node, depth: number): number[] => {
    const source = Number(src.val('FrameRangeSource') ?? 0);
    if (source === 3 && depth === 0) return read(app.scene.renderOptions as unknown as Node, 1);   // scene render options (params 0xc-0x10)
    if (source === 0) {
      const step = Math.trunc(Number(src.val('FrameStep') ?? 1));
      return rangeFrames(Math.trunc(Number(src.val('FrameStart') ?? 1)), Math.trunc(Number(src.val('FrameEnd') ?? 1)), step < 1 ? 1 : step);
    }
    if (source === 1) {
      const text = String(src.val('FrameSet') ?? '');
      const set = parseFrameSet(app, cmd, text);
      if (!set) { error(app, cmd, 0x37, `${text} ${pass.name}`); throw fail(cmd, E_INVALIDARG, `invalid frame set "${text}" on ${pass.name}`); }
      return set;
    }
    if (source === 2) return rangeFrames(Math.round(app.anim.startFrame), Math.round(app.anim.endFrame), 1);
    throw fail(cmd, E_UNEXPECTED, `range source ${source} of ${pass.name}`);
  };
  return read(pass, 0);
}

function buildJobs(app: App, cmd: string, mode: 'render' | 'export', passes: Pass[], fa: FrameArgs): RenderJob[] {
  // Do: frame set -> worker slot 11, Start and End -> slot 10, otherwise slot 9 (each pass's own range)
  const choice: RenderJob['choice'] = fa.frameSet ? 'set' : fa.start !== undefined && fa.end !== undefined ? 'range' : 'own';
  nya(app, cmd, `${mode} job builder (0x180083320) and the job-name suffix; jobs are named after their pass`);
  return passes.map(pass => ({
    pass, name: pass.name, mode, choice, verbose: fa.verbose,
    frames: choice === 'set' ? [...fa.frameSet!] : choice === 'range' ? rangeFrames(fa.start!, fa.end!, fa.step ?? 1) : ownFrames(app, cmd, pass),
  }));
}

function renderPasses(app: App, cmd: string, a: Record<string, any>) {
  const st = renderB19a(app);
  const passes = passListArg(app, cmd, a.Passes);
  if (!passes.length) { error(app, cmd, 0x1a, ''); st.lastJobs = { command: cmd, jobs: [] }; return undefined; }
  const fa = frameArgs(app, cmd, a, false);
  const jobs = buildJobs(app, cmd, 'render', passes, fa);
  // frame_offset = frames of all earlier jobs; frame_total = total frames, on every job
  let offset = 0;
  for (const j of jobs) { j.frame_offset = offset; offset += j.frames.length; }
  for (const j of jobs) j.frame_total = offset;
  st.lastJobs = { command: cmd, jobs };
  if (st.abortNext) { st.abortNext = false; throw fail(cmd, SI_RENDER_CANCELLED, 'render cancelled by the user'); }
  nya(app, cmd, 'render loop (0x18008f330); the jobs are rendered with this build\'s renderer');
  // inferred: the rendered image is shown when Preferences.rendering.render_pass_show_rendered_images is on
  const show = renderPref(app, 'render_pass_show_rendered_images') !== false;
  const result = renderScenePasses(app, { passList: passes, framesByPass: new Map(jobs.map(j => [j.pass, j.frames])), openPreview: show });
  (st.out[cmd] ??= {}).result = result;
  return undefined;
}

function restrictedGate(app: App, cmd: string) {
  if (modelTasksState(app).restricted) {
    app.logMsg('error', `${cmd}: [simsgcat 0x143]`);
    throw fail(cmd, E_RESTRICTED, 'render archives cannot be exported in this application mode (simsgcat 0x143)');
  }
}
function exportArchive(app: App, cmd: string, a: Record<string, any>) {
  const st = renderB19a(app);
  restrictedGate(app, cmd);   // UnPackArg
  const passes = passListArg(app, cmd, a.Passes);
  if (!passes.length) { error(app, cmd, 0x1a, ''); st.lastJobs = { command: cmd, jobs: [] }; return undefined; }
  const fa = frameArgs(app, cmd, a, true);
  restrictedGate(app, cmd);   // Do
  nya(app, cmd, 'pass-list preparation (0x180090690)');
  const jobs = buildJobs(app, cmd, 'export', passes, fa);
  restrictedGate(app, cmd);   // worker
  st.lastJobs = { command: cmd, jobs };
  nya(app, cmd, 'archive writer (0x18008ea60) and archive file naming; an AfterImage archive record is kept instead of a .mi file');
  const tpl = String(renderPref(app, 'archive_filename') ?? '[Project Path]/Render_Archives/[Pass]_Archive');
  for (const j of jobs) {
    const rec = { command: cmd, file: expandRenderTokens(tpl, j.pass.name, ''), jobs: [{ pass: j.pass.name, name: j.name, frames: j.frames }] };
    st.archives.push(rec);
    (globalThis as any).__siLastRenderArchive = rec;
    app.logMsg('info', `${cmd}: ${j.pass.name} frames ${j.frames[0]}..${j.frames[j.frames.length - 1]} (${j.frames.length}) -> ${rec.file}`);
  }
  return undefined;
}

// ------------------------------------------------------------------ passes and partitions
const isLightPartition = (p: Partition) => (p as any).partitionType === 'siLightPartition' || p.name === 'Background_Lights_Partition';
/** Pass that owns a partition (the pass container lookup). */
const passOfPartition = (app: App, p: Partition): Pass | undefined => app.scene.passes.find(x => x.partitions.includes(p));
/** Scene naming rule (inferred): a name already used by a sibling partition gets a number. */
function siblingName(pass: Pass, base: string): string {
  const taken = new Set(pass.partitions.map(p => p.name));
  if (!taken.has(base)) return base;
  let i = 1; while (taken.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}
/** The pass's lock status asked IsLocked at level 1 (CMD-B20c Q9), on the shared lock-info records (inferredB10Scene). */
const passLocked = (app: App, n: Node) => isLockedAt(app, n, 1);

function presetName(preset: unknown): string {
  const s = String((preset as any)?.name ?? preset ?? '').trim().replace(/^\{[0-9A-Fa-f-]+\}:/, '');
  return s.split(/[\\/]/).pop()!.replace(/\.preset$/i, '');
}
/**
 * SICreateObjectAndUpgradeFromPreset stand-in: does the object the preset creates answer the pass interface
 * (d233acd7, CMD-B20c Q8)? This build has no preset loader, so the created object's class is decided from the preset:
 * a Pass given as the preset, the default "Pass" preset, or a preset file under a "Passes" folder (inferred: the
 * siPassFamily presets) create a pass; any other preset creates an object that is not a pass.
 */
function presetCreatesPass(preset: unknown): boolean {
  if (preset instanceof Pass) return true;
  const raw = String((preset as any)?.name ?? preset ?? '').trim().replace(/^\{[0-9A-Fa-f-]+\}:/, '');
  if (/^pass$/i.test(presetName(preset))) return true;
  return raw.split(/[\\/]/).slice(0, -1).some(seg => /^passes$/i.test(seg));   // inferred
}
/** Rounding of the pass frame parameters 0x1c / 0x1d: half away from zero. */
const roundHalfAway = (v: number) => Math.sign(v) * Math.round(Math.abs(v));

export function siCreatePass(app: App, a: Record<string, any>): Pass | undefined {
  const C = 'SICreatePass';
  if (a.PresetObj === undefined || a.PresetObj === null) throw fail(C, E_INVALIDARG, 'PresetObj is required');   // missing argument 0x80020008
  const pname = presetName(a.PresetObj);
  // the pass test is a capability test on the created object, reported with the preset's name (CMD-B20c Q8)
  if (!presetCreatesPass(a.PresetObj)) { error(app, C, 0x17, pname); return undefined; }
  if (!/^pass$/i.test(pname)) nya(app, C, `pass preset "${pname}" content (SICreateObjectAndUpgradeFromPreset); a default pass is made`);
  const scene = app.scene;
  // a non-empty Name renames the pass; an empty Name keeps the preset's own name
  const name = typeof a.Name === 'string' && a.Name !== '' ? a.Name : pname;
  const pass = new Pass(scene.uniqueName(name));
  // Added to the pass container first. The handler does not make the pass current; this build reads the last pass
  // as the current one, so the new pass goes in front of it.
  const add = () => {
    if (scene.passes.includes(pass)) return;
    pass.parent = scene;
    if (scene.passes.length) scene.passes.splice(scene.passes.length - 1, 0, pass); else scene.passes.push(pass);
  };
  add();
  // Timing object read by index (inferred: PlayControl In 1, Out 2, step 6): 1 and 2 must be doubles, 6 an unsigned
  // integer; a wrong type skips everything after it (no frame parameters, partitions, Value or undo record).
  const tIn = Number(app.anim.startFrame), tOut = Number(app.anim.endFrame), tStep = Number(app.anim.frameStep ?? 1);
  if (!Number.isFinite(tIn) || !Number.isFinite(tOut) || !Number.isInteger(tStep) || tStep < 0) {
    app.events.emit('scene');
    return undefined;
  }
  // 0x1c / 0x1d rounded half away from zero, 0x1e as int, 0x1f "%d-%d" of the values truncated toward zero
  pass.set('FrameStart', roundHalfAway(tIn)); pass.set('FrameEnd', roundHalfAway(tOut)); pass.set('FrameStep', tStep | 0);
  pass.set('FrameSet', `${Math.trunc(tIn)}-${Math.trunc(tOut)}`);
  // Partition fill (0x18008c760): first members list (pass slot 0x38) <- lights, second list (0x30) <- every other
  // object except cameras (inferred class identities). Objects with no owning model are skipped.
  const lightsPart = pass.partitions.find(p => p.name === 'Background_Lights_Partition') ?? pass.partitions[1];
  const objsPart = pass.partitions.find(p => p.name === 'Background_Objects_Partition') ?? pass.partitions[0];
  const flagged = new Set<string>();
  for (const o of scene.allObjects()) {
    if (o === scene.root) continue;   // the scene root: no owning model below the root
    const model = o.parentObj?.model ?? null;   // first owner that is a model (the object itself does not count)
    if (!model) continue;
    if (model !== scene.root && !flagged.has(model.name)) flagged.add(model.name);
    if (o instanceof Light) lightsPart?.members.add(o);
    else if (!(o instanceof Camera)) objsPart?.members.add(o);
  }
  if (flagged.size) nya20(app, C, `the owning model's component-hierarchy flag 0x8 that skips its objects (models ${[...flagged].join(', ')}); their objects are kept`);
  renderB19a(app).out[C] = { Value: pass };
  app.record('SICreatePass', add, () => { const i = scene.passes.indexOf(pass); if (i >= 0) scene.passes.splice(i, 1); pass.parent = null; });
  app.events.emit('scene');
  return pass;
}

export function siCreateEmptyPartition(app: App, a: Record<string, any>): Partition[] {
  const C = 'SICreateEmptyPartition';
  // UnPackArg: keep the pass items of Target (default Passes.Current)
  const targets: Pass[] = [];
  const one = (x: unknown) => {
    if (Array.isArray(x)) { x.forEach(one); return; }
    if (x instanceof Pass) { if (!targets.includes(x)) targets.push(x); return; }
    if (typeof x === 'string') for (const s of x.split(',')) { const t = s.trim().replace(/^\{[0-9A-Fa-f-]+\}:/, ''); const n = t === '' || /^Passes\.Current$/i.test(t) ? currentPass(app) : nodeOf(app, t); if (n instanceof Pass && !targets.includes(n)) targets.push(n); }
  };
  one(unset(a.Target) ? 'Passes.Current' : a.Target);   // inferred: an empty Target is the registry default
  if (typeof a.Name !== 'string') throw fail(C, E_INVALIDARG, 'Name must be a string');
  // Type is taken only when it is an integer (VT_I4); anything else keeps the task's constructor value (CMD-B20c Q4).
  // The registry default ":siObjectPartition:siPartitionType" is an enum string that the command layer converts
  // (inferred); other strings are not integers.
  let type: number;
  const enumType = typeof a.Type === 'string' ? /^:?(siObjectPartition|siLightPartition)(?::siPartitionType)?$/.exec(a.Type.trim()) : null;
  if (typeof a.Type === 'number' && Number.isInteger(a.Type)) type = a.Type;
  else if (enumType) type = ENUMS[enumType[1]];
  else { type = 1; nya20(app, C, `the task's constructor value of Type when Type ${JSON.stringify(a.Type)} is not an integer; 1 (object partition) is used`); }
  if (a.Name === '' || (type !== 1 && type !== 2)) throw fail(C, E_INVALIDARG, a.Name === '' ? 'empty Name' : `Type ${String(a.Type)} is not 1 (object) or 2 (light)`);
  const made: Partition[] = [];
  for (const pass of targets) {
    if (passLocked(app, pass)) { app.logMsg('error', `${C}: ${pass.name} is locked`); continue; }
    const p = new Partition(siblingName(pass, a.Name));
    (p as any).partitionType = type === 2 ? 'siLightPartition' : 'siObjectPartition';
    (p as any).partitionClass = type === 2 ? '7a1bb9d6-58a3-49d6-84ba-39429edad489' : '8b291ad2-aac2-4f09-a027-b47e6c11e4ac';
    app.record(C, () => { p.parent = pass as any; pass.partitions.push(p); }, () => { const i = pass.partitions.indexOf(p); if (i >= 0) pass.partitions.splice(i, 1); p.parent = null; });
    made.push(p);
  }
  renderB19a(app).out[C] = { Value: made };
  app.events.emit('scene');
  return made;
}

export function moveToPartition(app: App, a: Record<string, any>) {
  const C = 'MoveToPartition';
  const list = (x: unknown): Node[] => {
    if (unset(x)) return [...app.selection];
    const items = Array.isArray(x) ? x : typeof x === 'string' ? x.split(',') : [x];
    const out: Node[] = [];
    for (const it of items) { const n = it instanceof Node ? it : typeof it === 'string' ? (/^Passes\.Current$/i.test(it.trim()) ? currentPass(app) : nodeOf(app, it.trim())) : undefined; if (n && !out.includes(n)) out.push(n); }
    return out;
  };
  const source = list(a.Source).find((n): n is Pass => n instanceof Pass);
  const target = list(a.Target).find((n): n is Partition => n instanceof Partition && (!source || passOfPartition(app, n) === source));
  if (!target) throw fail(C, E_INVALIDARG, 'no object or light partition in Target' + (source ? ` belonging to ${source.name}` : ''));
  const pass = passOfPartition(app, target);
  if (!pass) throw fail(C, E_POINTER, 'the partition has no pass');
  const items = list(a.InputObjs).filter((n): n is X3DObject => n instanceof X3DObject);
  // MoveToLayer's low-level task (1c7c2c98) on (partition, InputObjs). inferred: membership is exclusive in the pass
  const before = pass.partitions.map(p => [p, [...p.members]] as const);
  app.record(C, () => { for (const p of pass.partitions) for (const o of items) p.members.delete(o); for (const o of items) target.members.add(o); },
    () => { for (const [p, m] of before) { p.members.clear(); for (const o of m) p.members.add(o); } });
  app.events.emit('scene');
  return undefined;
}

// ------------------------------------------------------------------ registration
export function registerRenderB19aCommands(app: App) {
  const CAT = 'Rendering';
  const VP_CUR = ':siViewportCurrent:siViewport', VP_ALL = ':siViewportAll:siViewport';
  renderB19a(app);   // state object present from start-up (inspection seam)
  const st = () => renderB19a(app);
  const out =(cmd: string, v: unknown) => { st().out[cmd] = { Value: v }; return v; };
  const reg = (name: string, label: string, args: { name: string; default?: any }[], execute: (app: App, a: Record<string, any>) => any, undoable = false) =>
    app.register({ name, label, category: CAT, args, undoable, execute });

  // ---- region commands (none is undoable; none returns a value except the Get commands' Value)
  reg('RenderRegionCreate', 'Create Render Region', [
    { name: 'Viewport', default: VP_CUR }, { name: 'Left', default: 0.10000000149011612 }, { name: 'Right', default: 0.8999999761581421 },
    { name: 'Top', default: 0.10000000149011612 }, { name: 'Bottom', default: 0.8999999761581421 },
  ], (app, a) => {
    st().notifications.push('RENCORE_FLUSH_DELAYED_RENDERREGION_INIT');
    const r = resolveRegions(app, 'RenderRegionCreate', a.Viewport, true); if (!r) return undefined;
    const b = [a.Left, a.Right, a.Top, a.Bottom];
    const floats = b.every(x => typeof x === 'number' && Number.isFinite(x));   // all four VT_R4, else none is stored
    for (const g of r.regions) {
      if (floats) { g.left = a.Left; g.right = a.Right; g.top = a.Top; g.bottom = a.Bottom; }
      g.visible = true;
    }
    syncRegions(app);
    return undefined;
  });
  reg('RenderRegionClose', 'Close Render Region', [{ name: 'Viewport', default: VP_CUR }], (app, a) => {
    const r = resolveRegions(app, 'RenderRegionClose', a.Viewport); if (!r) return undefined;
    for (const g of r.regions) st().regions.delete(g.viewport);
    syncRegions(app);
    return undefined;
  });
  // RenderRegionToggleVisibility / Refresh / ToggleSelectionTracking: the registry has a Current entry first (1890 /
  // 1891 / 1893, plain label) and an "All" entry (1903 / 1902 / 1904) served by the same handler. A call by scripting
  // name gets the first one (inferred, CMD-B20c Q1); the "All" menu items and key bindings pass siViewportAll.
  reg('RenderRegionToggleVisibility', 'Show/Hide Render Region', [{ name: 'Viewport', default: VP_CUR }], (app, a) => {
    const r = resolveRegions(app, 'RenderRegionToggleVisibility', a.Viewport); if (!r) return undefined;
    const v = !r.regions.some(g => g.visible);
    for (const g of r.regions) g.visible = v;
    syncRegions(app);
    return undefined;
  });
  reg('RenderRegionRefresh', 'Refresh Render Region', [{ name: 'Viewport', default: VP_CUR }], (app, a) => {
    const r = resolveRegions(app, 'RenderRegionRefresh', a.Viewport); if (!r) return undefined;
    for (const g of r.regions) if (g.visible) g.renders++;
    st().globalRefreshes++;   // one global render-service refresh, whatever the number of regions
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('renderregion-refresh'));
    syncRegions(app);
    return undefined;
  });
  reg('RenderRegionToggleAutoRefresh', 'Toggle Auto-Refresh Mode for Render Region', [{ name: 'Viewport', default: VP_ALL }], (app, a) => {
    const r = resolveRegions(app, 'RenderRegionToggleAutoRefresh', a.Viewport, false, true); if (!r) return undefined;
    // any region in Interactive (0) -> CTRS (1), otherwise Interactive; no region (Viewport All) -> 0
    const mode = r.regions.some(g => g.refreshMode === 0) ? 1 : 0;
    for (const g of r.regions) g.refreshMode = mode;
    if (r.all) { writePref(app, 'region_refresh_mode', mode); refreshViewports(); }
    syncRegions(app);
    return undefined;
  });
  reg('RenderRegionToggleSelectionTracking', 'Toggle Selection Tracking for Render Region', [{ name: 'Viewport', default: VP_CUR }], (app, a) => {
    const r = resolveRegions(app, 'RenderRegionToggleSelectionTracking', a.Viewport, false, true); if (!r) return undefined;
    const v = !r.regions.some(g => g.trackSelection);   // no region (Viewport All) -> true
    for (const g of r.regions) g.trackSelection = v;
    if (r.all) { writePref(app, 'region_track_selection', v); refreshViewports(); }
    syncRegions(app);
    return undefined;
  });
  // Set workers: with Viewport All the preference is written and the viewports refreshed even with no region
  // (CMD-B20c Q3; SetDisplayType's worker was not re-read and is inferred to match SetRefreshMode).
  const setMode = (cmd: string, argName: string, field: 'displayType' | 'refreshMode', pref: string) => (app: App, a: Record<string, any>) => {
    const r = resolveRegions(app, cmd, a.Viewport, false, true); if (!r) return undefined;
    const v = enumValue(a[argName]) ?? 0;   // passed unchanged, no range check
    for (const g of r.regions) g[field] = v;
    if (r.all) { writePref(app, pref, v); refreshViewports(); }
    syncRegions(app);
    return undefined;
  };
  const getMode = (cmd: string, field: 'displayType' | 'refreshMode', pref: string) => (app: App, a: Record<string, any>) => {
    // Viewport All reads the preference without resolving any region (CMD-B20c Q3)
    if (enumValue(a.Viewport) === -1) { st().status[cmd] = 0; return out(cmd, Number(renderPref(app, pref) ?? 0)); }
    const r = resolveRegions(app, cmd, a.Viewport); if (!r) { nya(app, cmd, 'Get on a viewport without a region (the handler reads an empty map unchecked: undefined)'); return undefined; }
    const v = r.regions[0][field];
    return out(cmd, v);   // Value written as VT_INT
  };
  reg('RenderRegionSetDisplayType', 'Set Render Region Display Type', [{ name: 'Viewport', default: VP_CUR }, { name: 'Type', default: ':siRenderRegionDisplayRGBA:siRenderRegionDisplayType' }],
    setMode('RenderRegionSetDisplayType', 'Type', 'displayType', 'region_display_mode'));
  reg('RenderRegionGetDisplayType', 'Get Render Region Display Type', [{ name: 'Viewport', default: VP_CUR }], getMode('RenderRegionGetDisplayType', 'displayType', 'region_display_mode'));
  reg('RenderRegionSetRefreshMode', 'Set Refresh Mode for Render Region', [{ name: 'Viewport', default: VP_ALL }, { name: 'RefreshMode', default: ':siRenderRegionRefreshModeInteractive:siRenderRegionRefreshMode' }],
    setMode('RenderRegionSetRefreshMode', 'RefreshMode', 'refreshMode', 'region_refresh_mode'));
  reg('RenderRegionGetRefreshMode', 'Get Refresh Mode for Render Region', [{ name: 'Viewport', default: VP_CUR }], getMode('RenderRegionGetRefreshMode', 'refreshMode', 'region_refresh_mode'));
  reg('RenderRegionSetRenderChannel', 'Set Render Region Viewing Render Channel', [{ name: 'Viewport', default: VP_CUR }, { name: 'RenderChannel', default: 'Main' }], (app, a) => {
    const C = 'RenderRegionSetRenderChannel';
    if (typeof a.RenderChannel !== 'string') throw fail(C, E_INVALIDARG, 'RenderChannel must be a string');
    const name = a.RenderChannel === '' ? 'Main' : a.RenderChannel;
    const r = resolveRegions(app, C, a.Viewport); if (!r) return undefined;
    // phase 1: every region must offer the channel (case-insensitive); inferred: a region's list is the channel manager's
    const picks: [RenderRegion, RenderChannel][] = [];
    for (const g of r.regions) {
      const list = renderChannels();
      if (list.some(c => c == null)) throw fail(C, E_POINTER, 'null channel in the list');
      const hit = list.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!hit) throw fail(C, E_INVALIDARG, `render channel "${name}" is not available in viewport ${'ABCD'[g.viewport] ?? g.viewport}`);
      picks.push([g, hit]);
    }
    // phase 2
    for (const [g, c] of picks) g.channel = c.name;
    syncRegions(app);
    return undefined;
  });
  reg('RenderRegionGetRenderChannel', 'Get Render Region Viewing Render Channel', [{ name: 'Viewport', default: VP_CUR }], (app, a) => {
    const C = 'RenderRegionGetRenderChannel';
    if (enumValue(a.Viewport) === -1) throw fail(C, E_INVALIDARG, 'siViewportAll has no viewing render channel');
    const r = resolveRegions(app, C, a.Viewport); if (!r) { nya(app, C, 'Get on a viewport without a region (the handler reads an empty map unchecked)'); return undefined; }
    const ch = r.regions[0].channel;
    if (!ch) throw fail(C, E_POINTER, 'the region has no current channel');
    return out(C, ch);   // Value VT_BSTR
  });

  // ---- render channels
  reg('RemoveRenderChannel', 'Remove Render Channel', [{ name: 'Name', default: '' }], (app, a) => {
    const C = 'RemoveRenderChannel';
    if (typeof a.Name !== 'string' || a.Name === '') throw fail(C, E_INVALIDARG, 'Name must be a non-empty string');
    const list = renderChannels();
    // The lookup (and any refusal) belongs to the render-channel manager; the handler compares nothing itself and has
    // no Main guard (CMD-B20c Q7). The manager's case rule is unattested: this build's manager matches exactly.
    const i = list.findIndex(c => c.name === a.Name);
    if (i < 0) {
      if (list.some(c => c.name.toLowerCase() === a.Name.toLowerCase())) nya20(app, C, `the render-channel manager's case rule for "${a.Name}"; this build matches names exactly`);
      throw fail(C, E_INVALIDARG, `render channel "${a.Name}" not found`);
    }
    const ch = list[i];   // with undo the channel (and its type) is kept
    // every pass's framebuffers on that channel are deleted first (DeleteObj, undo recorded)
    const fbs: Framebuffer[] = [];
    for (const p of app.scene.passes) for (const fb of p.framebuffers) if (String(fb.val('RenderChannel') ?? '') === ch.name) fbs.push(fb);
    if (fbs.length) deleteObjList(app, 'DeleteObj', fbs);
    app.record(C, () => { const k = list.indexOf(ch); if (k >= 0) list.splice(k, 1); }, () => { if (!list.includes(ch)) list.splice(Math.min(i, list.length), 0, ch); });
    app.events.emit('scene');
    return undefined;
  }, true);

  // ---- passes / partitions
  reg('SICreatePass', 'Low Level Create Pass', [{ name: 'PresetObj', default: 'Pass' }, { name: 'Name', default: '' }, { name: 'Value', default: null }],
    (app, a) => siCreatePass(app, a), true);
  reg('SICreateEmptyPartition', 'Create Empty Partition', [
    { name: 'Target', default: 'Passes.Current' }, { name: 'Name', default: 'Partition' }, { name: 'Type', default: ':siObjectPartition:siPartitionType' }, { name: 'Value', default: null },
  ], (app, a) => siCreateEmptyPartition(app, a), true);
  reg('MoveToPartition', 'Move to Partition', [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }, { name: 'Source', default: null }],
    (app, a) => moveToPartition(app, a), true);

  // ---- pass rendering / render-archive export (one handler each; PresetObj / DisposeRendering are never read)
  reg('SIRenderPass', 'Render Pass', [
    { name: 'Passes', default: 'Passes.Current' }, { name: 'PresetObj', default: null }, { name: 'StartFrame', default: null },
    { name: 'EndFrame', default: null }, { name: 'StepFrame', default: null }, { name: 'DisposeRendering', default: true },
  ], (app, a) => renderPasses(app, 'SIRenderPass', { Passes: a.Passes, StartFrame: a.StartFrame, EndFrame: a.EndFrame, StepFrame: a.StepFrame }));
  reg('RenderPassesFrameSet', 'Render Passes Using a Frame Set', [
    { name: 'Passes', default: 'Passes.Current' }, { name: 'FrameSet', default: '' }, { name: 'Verbose', default: ':siRenderVerbosityDefault:siRenderVerbosity' },
  ], (app, a) => renderPasses(app, 'RenderPassesFrameSet', a));
  reg('RenderSelectedPasses', 'Render Selected Passes', [{ name: 'Passes', default: null }], (app, a) => renderPasses(app, 'RenderSelectedPasses', { Passes: a.Passes }));
  reg('ExportRenderArchiveFrameSet', 'Export Passes to Render Archive', [
    { name: 'Passes', default: 'Passes.Current' }, { name: 'FrameSet', default: '' }, { name: 'Verbose', default: ':siRenderVerbosityDefault:siRenderVerbosity' },
  ], (app, a) => exportArchive(app, 'ExportRenderArchiveFrameSet', a));
  reg('ExportRenderArchiveAllPasses', 'Export All Passes to Render Archives', [{ name: 'Passes', default: 'Passes.List.*' }],
    (app, a) => exportArchive(app, 'ExportRenderArchiveAllPasses', { Passes: a.Passes }));

  // ---- show rendered image: SetValue on the preference, as an undoable sub-task
  reg('RenderPassToggleShowRenderedImage', 'Toggle Show Rendered Image for Pass Rendering', [], (app) => {
    const target = 'Preferences.rendering.render_pass_show_rendered_images';
    const p = prefParam(app, 'render_pass_show_rendered_images');
    if (!p) { nya(app, 'RenderPassToggleShowRenderedImage', 'preference rendering.render_pass_show_rendered_images is not in this build'); return undefined; }
    const v = !p.value;
    app.setParam(p, v, 'SetValue');
    app.logMsg('info', `SetValue "${target}", ${v ? 'True' : 'False'}`);
    return undefined;
  }, true);
}
