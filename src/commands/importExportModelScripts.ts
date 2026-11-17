// Ledger row CMD-04b. Brief: docs/ghidra/cmd-04b-import-export-model-scripts.md, "Wire contract". Original code written from that contract only.
//
// 13 script-implemented commands in front of the file translators and the referenced-model machinery. This file is the
// COMMAND LAYER only: arguments, option properties, dialogs, and which lower-level worker is called with which values.
//
// How this build differs from a Softimage session, and why:
//
//  * Workers. The C++ commands these scripts call (OBJ / dotXSI / IGES / mocap translators, Crosswalk, the file-backed
//    referenced-model creator) are other ledger rows (open question Q6; file content is SYS-03). Each call goes through
//    `callWorker`: it is recorded in `app.importExportModelScripts.calls`, runs `workers[name]` when a later row (or a
//    test) supplies one, else a registered command of that name, else logs "not yet attested" and yields nothing.
//  * Modal pages. The command bus is synchronous and cannot block on a dialog, so the five dialog forms (and the two
//    dotXSI option pages, and the ToggleReferencedModel confirmation) return a Promise. The dialog forms resolve to
//    the record of in/out argument values (inferred: stands for the output arguments a script gets back); the logged
//    command line is rewritten with those values when the dialog closes with OK.
//  * Batch (`app.Interactive === false`): modal inspection is treated as Cancel (inferred, open question Q4).
//  * Files. "Exists on disk" is asked of the session's virtual host file system (app.hostFs, CMD-01b) and, for
//    referenced models, of the app's own referenced-model store (inferred).
//  * Log severities: the script log knows info and error; warnings are info lines prefixed "WARNING : " (as in CMD-01b).
import { App } from '../core/commands';
import { Property, Node, Model, X3DObject, Shader, Material } from '../core/scene';
import { str, int, bool, num } from '../core/params';
import { siString } from '../ui/si';
import { hostFs } from '../core/sdkHelpersHostFs';
import { sdkModal, renderSdkLayout } from '../ui/sdkHelpersModal';
import { makeProgIdShader, getSource, setSourceRaw, currentMaterial } from '../core/textureLayers';
import { ensureLocal, masterOfInstance } from './viewEditPropertyHelpers';
import { NotYetAttested } from './fbx';
import { inspectIeModal, ieYesNo } from '../ui/importExportModelScriptsDialog';
import {
  IEMS_NOTE, IEMS_TEXT, OBJ_BROWSER, BVH_BROWSER, ASF_BROWSER, iemsState as state, ieLayoutOf,
  makeWavefrontExport, wavefrontExportLogic, makeWavefrontImport, makeBiovisionImport, makeAcclaimImport, makeSearchAndReplace,
  sceneDotXSIOptions, projectExternalFiles, modelExternalFiles, refOfModel, localRefOfModel, resolveIePath, IeExternalFile,
} from '../core/importExportModelScripts';

// Worker names (other ledger rows). Spelled in two parts on purpose: they are called here, not implemented here.
const W = {
  objExport: 'SI' + 'ObjExport', importDotXSI: 'SI' + 'ImportDotXSIFile', exportDotXSI: 'SI' + 'ExportDotXSIFile', importIges: 'SI' + 'ImportIges',
  createCrosswalkOptions: 'Create' + 'ImportCrosswalkOptions', importCrosswalk: 'Import' + 'Crosswalk', createRefModel: 'SI' + 'CreateRefModel',
  biovision: 'Biovision Import' + ' function', acclaim: 'Acclaim Import' + ' function',   // the C++ entries' display names
};

const interactive = (app: App) => (app as any).Interactive !== false;
const text = (dict: string, id: number): string => siString(dict, id) ?? IEMS_TEXT[dict]?.[id] ?? '';
const logWarning = (app: App, t: string) => app.logMsg('info', `WARNING : ${t}`);
const logNya = (app: App, cmd: string, what: string, q: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${IEMS_NOTE} ${q})`);
function nya(cmd: string, what: string, q: string): NotYetAttested {
  const e = new NotYetAttested(cmd, what, q); e.message = `not yet attested: ${what} (${cmd}; ${IEMS_NOTE} ${q})`; return e;
}
const unset = (v: any) => v === undefined || v === null || v === '';
const truthy = (v: any): boolean => typeof v === 'string' ? /^(true|1|yes|-1)$/i.test(v.trim()) : !!v;

/** Softimage-style full name: `<model>.<name>` below a model other than the scene root, else the bare name. */
function siName(app: App, o: X3DObject): string {
  const owner = o instanceof Model ? o.parentObj?.model : o.model;
  return owner && owner !== app.scene.root ? `${owner.name}.${o.name}` : o.name;
}
function findObj(app: App, x: any): X3DObject | undefined {
  if (x instanceof X3DObject) return x;
  const s = String(x ?? '').trim(); if (!s) return undefined;
  if (s === app.scene.root.name) return app.scene.root;
  return app.scene.find(s) ?? [...app.scene.allObjects()].find(o => siName(app, o) === s);
}
/** An explicit collection argument as objects; unset gives `fallback`. */
function objList(app: App, arg: any, fallback: () => X3DObject[]): X3DObject[] {
  if (unset(arg) || (Array.isArray(arg) && !arg.length)) return fallback();
  const list = Array.isArray(arg) ? arg : String(arg).split(',');
  return list.map(x => findObj(app, x)).filter((o): o is X3DObject => !!o);
}

/** Call a lower-level worker (see the header). `by` is the script command making the call. */
function callWorker(app: App, by: string, worker: string, args: any[]): any {
  const rec = { worker, by, args: [...args], ran: false };
  state.calls.push(rec); if (state.calls.length > 200) state.calls.shift();
  const fn = state.workers[worker];
  if (fn) { rec.ran = true; return fn(...args); }
  if (worker !== by && app.commands.has(worker)) { rec.ran = true; return app.ExecuteCommand(worker, args); }
  logNya(app, by, `the worker ${worker} is not wired yet; called with (${args.map(logArg).join(', ')})`, 'Q6');
  return undefined;
}
function logArg(v: any): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return `"${v.map(x => x?.fullName ?? x).join(',')}"`;
  if (typeof v === 'object' && 'fullName' in v) return `"${v.fullName}"`;
  return typeof v === 'string' ? `"${v}"` : String(v);
}
/** The command line of a call in the session's scripting language (the bus formats its own lines the same way). */
function commandLine(app: App, name: string, vals: any[]): string {
  const args = vals.map(logArg); const lang = (app as any).scriptLang ?? 'VBScript';
  if (lang === 'Python') return `Application.${name}(${args.map(a => a === '' ? 'None' : /^true$/i.test(a) ? 'True' : /^false$/i.test(a) ? 'False' : a).join(', ')})`;
  if (lang === 'JScript') return `${name}(${args.map(a => a === '' ? 'null' : a).join(', ')});`;
  if (lang === 'PerlScript') return `$Application->${name}(${args.map(a => a === '' ? 'undef' : a).join(', ')});`;
  return `${name} ${args.join(', ')}`;
}
/** The bus logs a command when `execute` returns, which for a dialog form is before the dialog closes. This finds that
 *  line and hands back a function that rewrites it with the in/out values actually used. // inferred mechanism */
function trackCommandLine(app: App, name: string, a: Record<string, any>): () => void {
  let entry: { kind: string; text: string } | null = null;
  queueMicrotask(() => { const e = app.log[app.log.length - 1]; if (e && e.kind === 'cmd' && e.text.includes(name)) entry = e; });
  return () => { if (!entry) return; entry.text = commandLine(app, name, app.commands.get(name)!.args.map(d => a[d.name])); app.events.emit('log'); };
}

/** Stand-in for the host file browser: the hook when there is one, else a modal page with one path field. Empty = cancelled. */
function browseFile(app: App, b: { title: string; filter: string }, mode: 'open' | 'save'): Promise<string> {
  if (state.fileBrowser) return Promise.resolve(state.fileBrowser(b.title, b.filter, mode)).then(v => String(v ?? ''));
  if (!interactive(app)) return Promise.resolve('');
  const set = new Property('FileBrowser', 'CustomProperty', [str('Path', '', mode === 'save' ? 'Save as' : 'File')]);
  return sdkModal(b.title, (body) => { body.dataset.filter = b.filter; body.dataset.mode = mode; renderSdkLayout(body, set, [{ param: 'Path', control: 'file', filter: b.filter }]); }, { w: 420, cls: 'iems-browser' })
    .then(ok => ok ? String(set.val('Path') ?? '') : '');
}

/**
 * The temporary option property pattern: add `prop` under the scene root, inspect it modally, run `onOk` on OK (it returns
 * false to end like a cancel), delete the property on every path. Resolves to the record of argument values.
 */
function withTempProperty(app: App, cmd: string, a: Record<string, any>, prop: Property, title: string, onOk: () => boolean | void | Promise<boolean | void>, logic?: (param: string) => boolean): any {
  const root = app.scene.root;
  root.addProperty(prop); app.events.emit('scene');
  const drop = () => { root.removeProperty(prop); app.events.emit('scene'); };
  const result = (ok: boolean) => { const args = { ...a }; state.last[cmd] = { ok, args }; return args; };
  if (!interactive(app)) { drop(); logNya(app, cmd, 'batch mode: the modal inspection is treated as Cancel', 'Q4'); return result(false); }
  const relog = trackCommandLine(app, cmd, a);
  return inspectIeModal(title, prop, ieLayoutOf(prop), `iems-${prop.name}`, { onChange: logic })
    .then(async (ok) => {
      let done = false;
      try { if (ok) done = (await onOk()) !== false; }
      catch (e: any) { app.logMsg('error', `${cmd}: ${e?.message ?? e}`); throw e; }
      finally { drop(); }
      if (done) relog();
      return result(done);
    });
}

// ================================================================== OBJ export

/** "OBJ Export Proc": the worker behind both ObjExport entries. */
function objExportProc(app: App, a: Record<string, any>): void {
  const CMD = 'ObjExport';
  // 1. the selection expanded to its child nodes, else every object; the selection itself is not touched
  const picked: X3DObject[] = [];
  for (const o of app.selectedObjects) for (const x of [o, ...o.descendants()]) if (!picked.includes(x)) picked.push(x);
  const candidates = picked.length ? picked : [...app.scene.allObjects()];
  const flag: Record<string, boolean> = { polymsh: truthy(a.Polymsh), surfmsh: truthy(a.Surfmsh), crvlist: truthy(a.Crvlist), cloud: truthy(a.Cloud) };
  const typeOf = (o: X3DObject) => o.type === 'pointcloud' ? 'cloud' : o.type;   // inferred: the app's point clouds
  const kept = candidates.filter(o => !!o.primitive && flag[typeOf(o)] === true);
  // 2.
  if (!kept.length) { app.logMsg('error', 'Nothing to export...'); return; }
  app.logMsg('info', kept.map(o => siName(app, o)).join(','));
  // 3. everything from the last ".obj" on is removed
  const fileName = String(a.FileName ?? ''); const cut = fileName.lastIndexOf('.obj');
  const base = cut >= 0 ? fileName.slice(0, cut) : fileName;
  const perObject = Number(a.FilePerObject) === 1 || a.FilePerObject === true;
  const tail = [a.CoordinateSystem, a.Tesselation, a.Material, a.UV, a.UserNormal];   // passed through as they came (Q1)
  const exportNow = (suffix: string) => {
    if (perObject) for (const o of kept) callWorker(app, CMD, W.objExport, [[o], `${base}_${siName(app, o)}${suffix}`, ...tail]);
    else callWorker(app, CMD, W.objExport, [kept, `${base}${suffix}`, ...tail]);
  };
  // 4. / 5.
  if (!truthy(a.FilePerFrame)) { exportNow(''); return; }
  const start = Number(a.StartFrame), end = Number(a.EndFrame), step = Number(a.StepFrame);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0) throw nya(CMD, `a frame range with StepFrame = ${a.StepFrame}`, 'worker step 5');
  // the current frame is set and not restored: it stays on the last exported frame
  for (let f = start; step > 0 ? f <= end : f >= end; f += step) { app.anim.frame = f; exportNow(`.${f}`); }
}

/** "OBJ Export...": the options dialog, then the worker. */
function objExportDialog(app: App, a: Record<string, any>): any {
  const prop = makeWavefrontExport();
  prop.set('StartFrame', app.anim.startFrame); prop.set('EndFrame', app.anim.endFrame);
  prop.set('StepFrame', Number((app.anim as any).step ?? 1) || 1);   // inferred: PlayControl.Step is 1 where the app has no step
  prop.set('Filename', String(a.FileName ?? ''));
  return withTempProperty(app, 'ObjExport', a, prop, text('XSISCRIPTS', 1078), async () => {
    if (!prop.val('Filename')) { const f = await browseFile(app, OBJ_BROWSER, 'save'); if (!f) return false; prop.set('Filename', f); }
    const v = (n: string) => prop.val(n);
    const used = {
      FileName: v('Filename'), FilePerObject: v('FilePerObject'), FilePerFrame: v('FilePerFrame'), StartFrame: v('StartFrame'), EndFrame: v('EndFrame'), StepFrame: v('StepFrame'),
      Polymsh: v('Polymsh'), Surfmsh: v('Surfmsh'), Crvlist: v('Crvlist'), Cloud: v('Cloud'), CoordinateSystem: v('CoordinateSystem'), Tesselation: v('Tesselation'),
      Material: v('Material'), UV: v('uv'), UserNormal: v('UserNormal'),
    };
    objExportProc(app, used);
    Object.assign(a, used);   // all 15 arguments are written back from the property
    return true;
  }, (p) => wavefrontExportLogic(prop, p));
}

// ================================================================== displacement

function setupDisplacement(app: App, a: Record<string, any>): void {
  const CMD = 'SetupDisplacement';
  const objs = objList(app, a.InputObjs, () => []);   // inferred: a required collection that is empty gives nothing to do
  const D = Number(a.DisplDepth); const file = String(a.FileName ?? '');
  const selection = [...app.selection];
  const shader = (progId: string, fallbackName: string, defs: any[]): Shader => makeProgIdShader(progId) ?? new Shader(fallbackName, fallbackName, defs);   // inferred fallback when the definition is not bundled
  const setVal = (n: Node, name: string, v: any, def: () => any) => { let p = n.get(name); if (!p) p = n.add({ ...def(), animatable: false }); app.setParam(p, v, CMD); };
  const uniqueRootName = (type: string, baseName: string) => {   // inferred: a taken name gets a numeric suffix
    const taken = new Set(app.scene.root.properties.filter(p => p.type === type).map(p => p.name));
    if (!taken.has(baseName)) return baseName; let i = 1; while (taken.has(`${baseName}${i}`)) i++; return `${baseName}${i}`;
  };
  try {
    for (const o of objs) {
      // 1. the object's material is made local
      if (!o.material) { try { app.run('MakeLocal', { InputObjs: `${o.fullName}.material` }); } catch { /* the app's MakeLocal does not know this path form */ } }
      if (!o.material && app.commands.has('MakeLocalMaterialsForHierarchy')) app.run('MakeLocalMaterialsForHierarchy', { InputObj: [o] });
      const mat: Material | null = o.material ?? currentMaterial(app.scene, o);
      if (!mat) throw new Error(`${siName(app, o)} has no material`);
      // 2. displacement <- linear interpolation <- explicit 2D image
      const lin = shader('Softimage.sib_interp_linear.1', 'sib_interp_linear', [num('newrange_min', 0), num('newrange_max', 1)]);
      const img = shader('Softimage.txt2d-image-explicit.1', 'txt2d-image-explicit', [str('tex', '')]);
      const before = getSource({ owner: mat, name: 'displacement' });
      app.record('Connect displacement', () => { setSourceRaw({ owner: mat, name: 'displacement' }, lin); lin.parent = mat; setSourceRaw({ owner: lin, name: 'input' }, img); },
        () => { setSourceRaw({ owner: mat, name: 'displacement' }, before); });
      // 3.
      setVal(lin, 'newrange_min', -D / 2, () => num('newrange_min', 0)); setVal(lin, 'newrange_max', D / 2, () => num('newrange_max', 1));
      // 4. a new image source and a new image clip for every object, named after the file's base name
      if (!file.trim()) throw new Error('the image source cannot be created: no file name');   // inferred: wording and that the image source command is what fails
      const baseName = (file.split(/[\\/]/).pop() ?? file).replace(/\.[^.]*$/, '');
      const source = new Property(uniqueRootName('imagesource', baseName), 'imagesource', [str('filename', file, 'File Name')]);
      // 5. ImageDefinitionType is always set to 0; FlipY only when FlipVert is true
      const clip = new Property(uniqueRootName('imageclip', baseName), 'imageclip', [str('filename', file, 'File Name'), bool('enabled', true, 'Enabled'),
        str('Source', source.name, 'Source', { readOnly: true }), int('ImageDefinitionType', 0, 'Image Definition Type'), bool('FlipY', truthy(a.FlipVert), 'Flip Y')]);
      const root = app.scene.root;
      app.record('Image source and clip', () => { root.addProperty(source); root.addProperty(clip); }, () => { root.removeProperty(clip); root.removeProperty(source); });
      // 6.
      app.record('Connect clip', () => setSourceRaw({ owner: img, name: 'tex' }, clip), () => setSourceRaw({ owner: img, name: 'tex' }, null));
      // 7. local geometry approximation set up for fine displacement
      const ga = ensureLocal(app, o, 'geomapprox');
      // inferred: the app's Geometry Approximation carries only the polygon-mesh parameters; the displacement ones are added on first use
      setVal(ga, 'gapproxmaxdisp', D / 2, () => num('gapproxmaxdisp', 0, 'Maximum Displacement'));
      setVal(ga, 'gapproxrdangdep', 3, () => int('gapproxrdangdep', 0, 'Displacement Approximation'));
      if (truthy(a.DisplViewDep)) setVal(ga, 'gapproxrdfinevwdep', true, () => bool('gapproxrdfinevwdep', false, 'View Dependent'));
      setVal(ga, 'gapproxmosl', Number(a.DisplSubDLevel), () => int('gapproxmosl', 0, 'OGL Subdivision Level'));
      setVal(ga, 'gapproxmordrsl', Number(a.DisplSubDLevel), () => int('gapproxmordrsl', 0, 'Subdivision Level'));
    }
  } finally { if (app.selection.length !== selection.length || app.selection.some((n, i) => n !== selection[i])) app.select(selection); }   // nothing is selected or inspected
}

// ================================================================== referenced models

function autoInspectGeneral(app: App, o: Node) { if (app.autoInspect) app.events.emit('inspect', o); }   // AutoInspect <obj>, , , "General"
/** Run a selection-driven app command on one model without leaving the selection changed. */
function withSelected<T>(app: App, m: Model, fn: () => T): T {
  const keep = [...app.selection]; app.select([m]);
  try { return fn(); } finally { app.select(keep); }
}
function refStoreHas(file: string): boolean { try { return localStorage.getItem('si.refmodel.' + file) !== null; } catch { return false; } }
const fileOnDisk = (file: string): boolean => { try { return hostFs.isFile(file); } catch { return false; } };

function createRefModel(app: App, a: Record<string, any>): any {
  const CMD = 'CreateRefModel'; const file = String(a.FileName ?? '');
  const finish = (m: any, emit: boolean) => { if (!(m instanceof X3DObject)) return undefined; app.select([m]); if (emit) autoInspectGeneral(app, m); return m; };   // branch selection is a plain selection here
  if (file !== '' && (fileOnDisk(file) || refStoreHas(file))) {
    const all = [file, a.ModelName, a.ResolutionName, a.Parent, a.Activate, a.CreateFile, a.ExternalCnxMappingTemplate, a.ShareOptions];
    if (state.workers[W.createRefModel] || app.commands.has(W.createRefModel)) return finish(callWorker(app, CMD, W.createRefModel, all), false);
    // inferred: until the file-backed creator has its own row, a file in the app's referenced-model store goes through the app's own loader
    if (refStoreHas(file) && app.commands.has('ImportRefModels')) {
      state.calls.push({ worker: W.createRefModel, by: CMD, args: all, ran: false });
      logNya(app, CMD, `the worker ${W.createRefModel} is not wired yet; the app's referenced-model loader is used for "${file}"`, 'Q6');
      return Promise.resolve(app.run('ImportRefModels', { FileName: file, Parent: a.Parent })).then(m => finish(m, true));
    }
    return finish(callWorker(app, CMD, W.createRefModel, all), false);
  }
  // empty name or missing file: the empty creator, same arguments without CreateFile
  const m = app.run('CreateEmptyRefModel', { Name: a.ModelName || undefined }) as Model | undefined;
  if (!(m instanceof Model)) return undefined;
  const r: any = (m as any).ref ?? ((m as any).ref = { file: '', resolution: 0, resolutions: [] });
  // the file name is still recorded on the resolution, so the model can be resolved later
  if (file) { r.file = file; r.resolutions = [file]; }
  r.resolutionNames = file ? [String(a.ResolutionName ?? '')] : [];
  r.activate = truthy(a.Activate); r.mappingTemplate = String(a.ExternalCnxMappingTemplate ?? ''); r.shareOptions = Number(a.ShareOptions);
  const parent = unset(a.Parent) ? null : findObj(app, a.Parent);
  if (parent && parent !== m.parentObj) { const old = m.parentObj!; app.record('Parent', () => parent.addChild(m), () => old.addChild(m)); }
  return finish(m, false);   // the bus auto-inspects the Create* result itself
}

function toggleReferencedModel(app: App, a: Record<string, any>): any {
  const CMD = 'ToggleReferencedModel';
  const items: any[] = unset(a.Model) ? [...app.selection] : Array.isArray(a.Model) ? a.Model : String(a.Model).split(',').map(s => s.trim()).filter(Boolean);
  const show = truthy(a.ShowWarnings);
  const owningModel = (item: any): Model | null => {
    let n: any = item instanceof Node ? item : findObj(app, item);
    while (n && !(n instanceof X3DObject)) n = n.parent;
    if (!(n instanceof X3DObject)) return null;
    if (n instanceof Model && !masterOfInstance(n)) return n;                 // a model that is not an instance stands for itself
    if (n instanceof Model) return n.parentObj?.model ?? null;                // an instance stands for the model that owns it
    return n.model;
  };
  const convert = (m: Model, path: string) => { app.run('ConvertToRefModel', { Model: m.fullName, FileName: path }); delete (m as any).refLocal; };
  const from = (i: number): any => {
    for (; i < items.length; i++) {
      const item = items[i]; const m = owningModel(item);
      if (!m) { app.logMsg('error', `Object ${item instanceof Node ? (item instanceof X3DObject ? siName(app, item) : item.fullName) : item} is not a 3D object`); return; }   // stops the whole loop
      if (m === app.scene.root) { logWarning(app, 'Cannot toggle the active SceneRoot!'); continue; }
      const ref = refOfModel(m);
      if (ref) {
        // inferred: the app drops the record on MakeModelLocal; what a local model keeps of its resolutions is stored beside it
        const kept = { file: ref.file, resolution: ref.resolution, resolutions: [...ref.resolutions] }; const old = (m as any).refLocal;
        withSelected(app, m, () => app.run('MakeModelLocal'));
        app.record('Keep resolutions', () => { (m as any).refLocal = kept; }, () => { (m as any).refLocal = old; });
        continue;
      }
      const local = localRefOfModel(m);
      if (!local || local.resolution <= 0) { app.logMsg('error', 'You cannot toggle this model. It has not been a referenced model before.'); continue; }
      const file = local.resolutions[local.resolution - 1] ?? local.file;
      const ext = modelExternalFiles(m).find(e => e.path === file || resolveIePath(e.path) === file);   // only the first match counts
      if (!ext) continue;                                                     // silently
      const path = resolveIePath(ext.path);
      if (!show) { convert(m, path); continue; }
      if (!interactive(app)) { logNya(app, CMD, 'batch mode: the Yes / No confirmation; nothing is converted', 'Q4'); continue; }
      const next = i + 1;
      return ieYesNo(text('XSI_3DOBJECT2', 10010), `Toggling ${m.name}`).then(yes => {
        if (yes) { try { convert(m, path); } catch (e: any) { app.logMsg('error', `${CMD}: ${e?.message ?? e}`); throw e; } }
        return from(next);
      });
    }
  };
  return from(0);
}

// ================================================================== dotXSI

/** Format version of a dotXSI file: characters 5 to 8 of the first text line (header `xsi ` + four digits). */
function dotXSIVersion(file: string): number {
  const first = hostFs.readFile(file).split(/\r?\n/, 1)[0] ?? '';
  return Number(first.slice(4, 8));
}
function importDotXSI(app: App, a: Record<string, any>): any {
  const CMD = 'ImportDotXSI'; const file = String(a.FileName ?? ''); const parent = a.Parent;
  const legacyNow = () => callWorker(app, CMD, W.importDotXSI, [file, parent]);
  const legacy = () => {
    if (!interactive(app)) { logNya(app, CMD, 'batch mode: the modal inspection of the import options is treated as Cancel', 'Q4'); return undefined; }
    const opt = sceneDotXSIOptions(app.scene, 'import');
    return inspectIeModal('.xsi Import Options', opt, ieLayoutOf(opt), 'iems-dotXSIImportOptions').then(ok => { if (ok) legacyNow(); return ok; });
  };
  const crosswalk = () => {
    const root = app.scene.root; const NAME = 'ImportCrosswalkOptions';
    let opt: any = root.properties.find(p => p.name === NAME);
    if (!opt) {
      opt = callWorker(app, CMD, W.createCrosswalkOptions, []);
      if (!(opt instanceof Property)) {
        // inferred stand-in: only the parameter this command sets is known here; the real property is the worker's row
        opt = new Property(NAME, NAME, [str('Filename', '', 'Filename')]);
        app.record('Crosswalk import options', () => root.addProperty(opt), () => root.removeProperty(opt));
      }
    }
    if (!opt.get('Filename')) opt.add({ ...str('Filename', ''), animatable: false });
    app.setParam(opt.get('Filename'), file, CMD);
    callWorker(app, CMD, W.importCrosswalk, [opt, parent]);   // no dialog; the property stays in the scene
    return undefined;
  };
  if (state.licence === 'Avid 3D') return legacyNow();
  if (!fileOnDisk(file)) return legacy();                     // the importer then reports the missing file
  const lower = file.toLowerCase();
  if (lower.includes('.xml') || lower.includes('.dae')) return crosswalk();
  const version = dotXSIVersion(file);
  if (!Number.isFinite(version)) throw nya(CMD, `a file whose first line has no numeric version at characters 5 to 8 ("${file}")`, 'decision table');
  return version >= 500 ? crosswalk() : legacy();
}
function exportDotXSI(app: App, a: Record<string, any>): any {
  const CMD = 'ExportDotXSI';
  if (!interactive(app)) { logNya(app, CMD, 'batch mode: the modal inspection of the export options is treated as Cancel', 'Q4'); return undefined; }
  const opt = sceneDotXSIOptions(app.scene, 'export');
  return inspectIeModal('.xsi Export Options', opt, ieLayoutOf(opt), 'iems-dotXSIExportOptions').then(ok => {
    if (!ok) return false;
    const models = objList(app, a.Model, () => [app.scene.root]);   // an empty Model means the scene root
    callWorker(app, CMD, W.exportDotXSI, [models.length ? models : [app.scene.root], a.FileName]);
    return true;
  });
}

// ================================================================== search and replace

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function searchAndReplaceDirect(app: App, a: Record<string, any>): void {
  const files: any[] = unset(a.Files) ? projectExternalFiles(app.scene) : Array.isArray(a.Files) ? a.Files : [a.Files];
  const category = String(a.Category ?? ''); const all = category === 'All' || category === 'all' || category === 'ALL';
  const oldS = String(a.OldString), newS = String(a.NewString ?? '');
  const re = new RegExp(escapeRe(oldS), truthy(a.CaseSensitive) ? 'g' : 'gi');   // binary compare when case sensitive, text compare otherwise
  for (const f of files) {
    if (!f || typeof f.path !== 'string') continue;
    if (!all && category !== f.fileType) continue;
    const before: string = f.path; const after = before.replace(re, () => newS);
    if (after === before) continue;                                              // unchanged paths are neither written nor logged
    app.record('Replace path', () => { f.path = after; }, () => { f.path = before; });
    app.logMsg('info', `Changing ${before} To ${f.path}`);
  }
}
function searchAndReplaceDialog(app: App, a: Record<string, any>): any {
  const CMD = 'SearchAndReplacePath'; const prop = makeSearchAndReplace();
  return withTempProperty(app, CMD, a, prop, text('XSISCRIPTS', 1129), () => {
    const v = (n: string) => String(prop.val(n) ?? '');
    for (const [param, label] of [['File_Category', 'Type Parameter'], ['Old_String', 'Old String'], ['New_String', 'New String']]) {
      if (v(param) === '') { app.logMsg('error', `Parameter ${label} is empty. script command not completed`); return false; }
    }
    // the command calls itself in direct form with the whole project list, so a second line is logged
    app.run(CMD, { Category: v('File_Category'), OldString: v('Old_String'), NewString: v('New_String'), CaseSensitive: !!prop.val('Case_Sensitive'), Files: projectExternalFiles(app.scene) });
    return true;    // nothing is written back: the arguments are inputs only
  });
}

// ================================================================== registration

export function registerImportExportModelScriptCommands(app: App) {
  (app as any).importExportModelScripts = state;
  if (!(app as any).hostFs) (app as any).hostFs = hostFs;
  (state as any).externalFiles = () => projectExternalFiles(app.scene);
  (state as any).ExternalFile = IeExternalFile;
  /** What is connected to a port of a material or shader (for scripts and checks). */
  (state as any).sourceOf = (owner: Node, port: string) => getSource({ owner, name: port });
  const FILE = 'File';

  app.register({
    name: 'ObjExport', label: 'OBJ Export...', category: FILE, description: 'Exports the selection to a Wavefront .obj file.', undoable: false,
    args: [{ name: 'FileName', default: '' }, { name: 'FilePerObject', default: 0 }, { name: 'FilePerFrame', default: false }, { name: 'StartFrame', default: 1 },
      { name: 'EndFrame', default: 100 }, { name: 'StepFrame', default: 1 }, { name: 'Polymsh', default: true }, { name: 'Surfmsh', default: false },
      { name: 'Crvlist', default: false }, { name: 'Cloud', default: false }, { name: 'CoordinateSystem', default: true }, { name: 'Tesselation', default: 0 },
      { name: 'Material', default: true }, { name: 'UV', default: true }, { name: 'UserNormal', default: true }],
    execute(app2, a) {
      // The scripting name has two registry entries with the same arguments: the dialog form and the worker alone.
      // inferred: which one a call by name reaches. Here: the dialog when the session is interactive, unless
      // importExportModelScripts.objExportForm says otherwise; batch always runs the worker.
      const form = state.objExportForm === 'auto' ? (interactive(app2) ? 'dialog' : 'proc') : state.objExportForm;
      return form === 'dialog' ? objExportDialog(app2, a) : objExportProc(app2, a);
    },
  });

  app.register({
    name: 'SI_InspectWavefrontImportOptions', label: 'Inspect OBJ-Import Options', category: '', undoable: false,
    args: [{ name: 'FileName', default: '' }, { name: 'Group', default: 0 }, { name: 'hrc', default: 0 }, { name: 'Material', default: false }, { name: 'UV', default: false },
      { name: 'UVwrapping', default: false }, { name: 'UserNormal', default: false }, { name: 'DisplImage', default: '' }, { name: 'DisplDepth', default: 0.5 },
      { name: 'DisplFlipVert', default: true }, { name: 'DisplViewDep', default: false }, { name: 'DisplSubDLevel', default: 1 }],
    execute(app2, a) {
      const prop = makeWavefrontImport();   // always the property defaults; only FileName is carried in
      prop.set('Filename', String(a.FileName ?? ''));
      const dirOf = (f: string) => f.replace(/[\\/][^\\/]*$/, '');
      return withTempProperty(app2, 'SI_InspectWavefrontImportOptions', a, prop, text('XSISCRIPTS', 1079), async () => {
        if (!prop.val('Filename')) { const f = await browseFile(app2, OBJ_BROWSER, 'open'); if (!f) return false; prop.set('Filename', f); }
        const v = (n: string) => prop.val(n);
        Object.assign(a, { FileName: v('Filename'), Group: v('Group'), hrc: v('hrc'), Material: v('Material'), UV: v('uv'), UVwrapping: v('uvWrapping'), UserNormal: v('UserNormal'),
          DisplImage: v('DisplImage'), DisplDepth: v('DisplDepth'), DisplFlipVert: v('DisplFlipVert'), DisplViewDep: v('DisplViewDep'), DisplSubDLevel: v('DisplSubDLevel') });
        return true;
      }, (p) => {
        // layout logic: the DisplImage browser starts in the folder of the chosen file, and the page is refreshed
        if (p !== 'Filename') return false;
        const item = ieLayoutOf(prop).flatMap(t => t.items ?? []).find(i => i.param === 'DisplImage'); if (item) item.initialDir = dirOf(String(prop.val('Filename') ?? ''));
        (prop as any).displImageDir = dirOf(String(prop.val('Filename') ?? ''));
        return true;
      });
    },
  });

  app.register({
    name: 'SetupDisplacement', label: 'Setup Displacement', category: FILE,
    args: [{ name: 'InputObjs', default: null }, { name: 'FileName', default: '' }, { name: 'DisplDepth', default: 0.5 }, { name: 'FlipVert', default: true },
      { name: 'DisplViewDep', default: true }, { name: 'DisplSubDLevel', default: 1 }],
    execute(app2, a) { setupDisplacement(app2, a); },
  });

  // The two mocap script entries share their scripting names with the C++ workers behind them ("... function").
  const mocap = (prop: Property) => {
    const v = (n: string) => prop.val(n);
    // two values are inverted on the way to the worker: true exactly when the parameter is 0
    return { prop, gapless: () => Number(v('GaplessSkeleton')) === 0, si3d: () => Number(v('SI3DChains')) === 0, nulls: () => !!Number(v('NullsHierarchy')) };
  };
  app.register({
    name: 'BiovisionImport', label: 'Biovision Import...', category: FILE, description: 'Import Biovision BVH file',
    args: [{ name: 'FileName', default: '' }, { name: 'InserMotion', default: false }, { name: 'NullsHierarchy', default: false }, { name: 'GaplessSkeleton', default: false },
      { name: 'SI3DChains', default: false }, { name: 'GroupAnimObjs', default: false }],
    execute(app2, a) {
      const m = mocap(makeBiovisionImport());   // incoming argument values are ignored
      return withTempProperty(app2, 'BiovisionImport', a, m.prop, text('XSISCRIPTS', 1080), async () => {
        if (!m.prop.val('FileName')) { const f = await browseFile(app2, BVH_BROWSER, 'open'); if (!f) return false; m.prop.set('FileName', f); }
        const used = [m.prop.val('FileName'), !!m.prop.val('InsertMotion'), m.nulls(), m.gapless(), m.si3d(), !!m.prop.val('GroupAnimObjs')];
        callWorker(app2, 'BiovisionImport', W.biovision, used);
        ['FileName', 'InserMotion', 'NullsHierarchy', 'GaplessSkeleton', 'SI3DChains', 'GroupAnimObjs'].forEach((n, i) => { a[n] = used[i]; });
        return true;
      });
    },
  });
  app.register({
    name: 'AcclaimImport', label: 'Acclaim Import...', category: FILE, description: 'Import Acclaim ASF and AMC files',
    args: [{ name: 'SkeletonFileName', default: '' }, { name: 'MotionFileName', default: '' }, { name: 'CropMotionValuesToLimit', default: false },
      { name: 'OverrideBoneLengthMultiplier', default: false }, { name: 'BoneLengthMultiplier', default: 1 }, { name: 'InserMotion', default: false },
      { name: 'NullsHierarchy', default: false }, { name: 'GaplessSkeleton', default: false }, { name: 'SI3DChains', default: false }, { name: 'GroupAnimObjs', default: false }],
    execute(app2, a) {
      const m = mocap(makeAcclaimImport());
      return withTempProperty(app2, 'AcclaimImport', a, m.prop, text('XSISCRIPTS', 1081), async () => {
        const v = (n: string) => m.prop.val(n);
        if (!v('ASFFile')) { const f = await browseFile(app2, ASF_BROWSER, 'open'); if (!f) return false; m.prop.set('ASFFile', f); }
        // an empty AMCFile is passed on as is (skeleton only)
        const used = [v('ASFFile'), v('AMCFile'), !!v('ApplyLimits'), !!v('OverrideLength'), Number(v('LengthMultiplier')), !!v('InsertMotion'), m.nulls(), m.gapless(), m.si3d(), !!v('GroupAnimObjs')];
        callWorker(app2, 'AcclaimImport', W.acclaim, used);
        ['SkeletonFileName', 'MotionFileName', 'CropMotionValuesToLimit', 'OverrideBoneLengthMultiplier', 'BoneLengthMultiplier', 'InserMotion', 'NullsHierarchy', 'GaplessSkeleton', 'SI3DChains', 'GroupAnimObjs']
          .forEach((n, i) => { a[n] = used[i]; });
        return true;
      });
    },
  });

  app.register({
    name: 'ImportDotXSI', label: 'Import .xsi', category: FILE, description: 'Imports a .xsi file in the current scene',
    args: [{ name: 'FileName', default: '' }, { name: 'Parent', default: '' }],
    execute(app2, a) { return importDotXSI(app2, a); },
  });
  app.register({
    name: 'ExportDotXSI', label: 'Export .xsi', category: FILE, description: 'Exports the scene to a .xsi', undoable: false,
    args: [{ name: 'Model', default: null }, { name: 'FileName', default: '' }],
    execute(app2, a) { return exportDotXSI(app2, a); },
  });
  app.register({
    name: 'ImportIges', label: 'Import IGES FIle', category: FILE, description: 'Import an IGES file into the scene',
    args: [{ name: 'FileName', default: '' }, { name: 'Parent', default: '' }, { name: 'Value', default: null }],
    execute(app2, a) {
      // Parent is accepted and not used
      const got = callWorker(app2, 'ImportIges', W.importIges, [a.FileName]);
      const obj = Array.isArray(got) ? got[0] : (got && typeof got === 'object' && 'Value' in got ? (got as any).Value : got);
      if (!(obj instanceof X3DObject)) return undefined;
      app2.select([obj]); autoInspectGeneral(app2, obj);
      a.Value = obj;
      return obj;   // inferred: the output argument is what a caller without by-reference arguments gets
    },
  });

  app.register({
    name: 'CreateRefModel', label: 'CreateRefModel', category: FILE,
    args: [{ name: 'FileName', default: '' }, { name: 'ModelName', default: '' }, { name: 'ResolutionName', default: '' }, { name: 'Parent', default: '' },
      { name: 'Activate', default: true }, { name: 'CreateFile', default: false }, { name: 'ExternalCnxMappingTemplate', default: '' }, { name: 'ShareOptions', default: 65535 }],
    execute(app2, a) { return createRefModel(app2, a); },
  });
  app.register({
    name: 'CreateModelAndConvertToRef', label: 'CreateModelAndConvertToRef', category: FILE,
    args: [{ name: 'Objects', default: null }, { name: 'FileName', default: '' }],
    execute(app2, a) {
      const objs = objList(app2, a.Objects, () => app2.selectedObjects);
      app2.run('CreateModel', { InputObj: objs });                 // default name and parent; leaves the new model selected
      const first = app2.selection[0];
      if (!(first instanceof X3DObject)) throw new Error('CreateModel left nothing selected');
      app2.run('ConvertToRefModel', { Model: first.fullName, FileName: a.FileName });
      // the registry announces a return value; the procedure yields none (open question Q5)
    },
  });
  app.register({
    name: 'ToggleReferencedModel', label: 'ToggleReferencedModel', category: FILE,
    args: [{ name: 'Model', default: null }, { name: 'ShowWarnings', default: true }],
    execute(app2, a) { return toggleReferencedModel(app2, a); },
  });
  app.register({
    name: 'RemoveUnusedDeltas', label: 'RemoveUnusedDeltas', category: FILE, args: [],
    execute(app2) {
      // every delta in the scene (class {6D906778-A713-40E3-A5FB-0F5CA3361370}); here: the properties of type `delta`
      const root = app2.scene.root;
      for (const o of [root, ...app2.scene.allObjects()]) for (const d of o.properties.filter(p => p.type === 'delta')) {
        const target = String(d.val('target') ?? '');
        if (target === root.name || [...app2.scene.allObjects()].some(x => x.name === target || siName(app2, x) === target)) continue;   // a live target: left alone
        try { const idx = o.properties.indexOf(d); app2.record('Delete delta', () => { o.removeProperty(d); }, () => { o.addProperty(d); o.properties.splice(o.properties.indexOf(d), 1); o.properties.splice(idx, 0, d); }); }
        catch { /* a failing delete is ignored */ }
      }
    },
  });

  app.register({
    name: 'SearchAndReplacePath', label: 'Search And Replace Paths', category: FILE, description: 'Searches and replaces source paths for pictures, audio, etc...',
    args: [{ name: 'Category', default: 'All' }, { name: 'OldString', default: '' }, { name: 'NewString', default: '' }, { name: 'CaseSensitive', default: false }, { name: 'Files', default: null }],
    execute(app2, a) {
      if (!unset(a.OldString)) { searchAndReplaceDirect(app2, a); return undefined; }
      return searchAndReplaceDialog(app2, a);   // the other incoming arguments are ignored
    },
  });
}
