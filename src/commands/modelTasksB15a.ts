// Ledger row CMD-B15a (modeltasks.dll): entry point. Brief: docs/ghidra/cmd-b15a-modeltasks.md, "Wire contract" of each
// command, and WIRE_CORRECTIONS_B15 items 16-21. This file: SICreateModel, SIGetModel, SIImportModel, SIMergeScene,
// SIImportIges, SIExportIges, ImportMixer / MergeMixer, SIImportMatLib / SIImportReferencedMatLib, ExportMaterialLibrary,
// Get/SetLightListOnModelClip. The referenced-model and delta commands are in modelTasksB15aRef.ts.
// It REPLACES the pre-B15a inferred ImportMixer (src/commands/anim.ts); the shared stand-in state is in
// modelTasksB15aShared.ts (see its header for what is a stand-in: file content, licence word, restricted mode).
import * as THREE from 'three';
import { App } from '../core/commands';
import { threeOrder } from '../core/scene';
import { ensureMixer } from './actionB11eModel';
import { registerModelTasksB15aRefCommands } from './modelTasksB15aRef';
import {
  stateOf, fail, raise, warn, logNya, subtask, restrictedGate, fireFileEvent, extOf, baseNoExt, validFile, fileExists, parentArg, modelOfNode,
  ownerModel, isDescendant, add3DObjectToScene, newModel, hostFs, unset, listOf, resolve, nodesArg, boolArg, intArg, isFolder, parentPath,
  Node, X3DObject, Model, Group,
  E_POINTER, E_INVALIDARG, E_FAIL, EV_BEFORE_IMPORT, EV_AFTER_IMPORT, EV_BEFORE_EXPORT, EV_AFTER_EXPORT, KIND_MATLIB, KIND_MIXER, KIND_IGES, KIND_MODEL,
} from './modelTasksB15aShared';

type A = Record<string, any>;
type Arg = { name: string; default?: any };
/** Registry argument lists (data/command_registry.json). */
export const ARGS: Record<string, Arg[]> = {
  SICreateModel: [{ name: 'InputObj' }, { name: 'Name', default: 'Model' }, { name: 'Parent' }, { name: 'Value' }],
  SIMergeScene: [{ name: 'FileName' }, { name: 'Name', default: '' }, { name: 'Parent' }, { name: 'ShareOptions', default: ':siImportShareOptionsAll:siImportShareOptions' }, { name: 'CreatedObj' }],
  SIImportModel: [{ name: 'FileName' }, { name: 'Parent' }, { name: 'Value' }, { name: 'Name', default: '' }, { name: 'ShareOptions', default: 0 }],
  SIGetModel: [{ name: 'InputObjs' }],
  SIImportIges: [{ name: 'FileName' }, { name: 'Parent' }, { name: 'Value' }],
  SIExportIges: [{ name: 'InputObjs' }, { name: 'FileName' }],
  MergeMixer: [{ name: 'FileName' }, { name: 'Parent' }, { name: 'Merge', default: true }, { name: 'Value' }],
  ImportMixer: [{ name: 'FileName' }, { name: 'Parent' }, { name: 'Merge', default: false }, { name: 'Value' }],
  SIImportMatLib: [{ name: 'FileName' }, { name: 'ShareOptions', default: 0 }, { name: 'Value' }],
  SIImportReferencedMatLib: [{ name: 'FileName' }, { name: 'ShareOptions', default: 1 }, { name: 'Value' }],
  ExportMaterialLibrary: [{ name: 'FileName' }, { name: 'InputObjs' }, { name: 'ExportUsedImageClipsOnly', default: true }],
  GetLightListOnModelClip: [{ name: 'ModelClip' }],
  SetLightListOnModelClip: [{ name: 'ModelClip' }, { name: 'LightList', default: '' }],
};

const isStr = (v: any) => typeof v === 'string';
const fileArg = (cmd: string, v: any): string => {
  if (unset(v)) throw fail(E_INVALIDARG, `${cmd}: FileName is required (status 0x80070057)`);
  if (!isStr(v)) throw fail(E_INVALIDARG, `${cmd}: FileName is not a string (status 0x80070057)`);
  return v;
};

// ------------------------------------------------------------------ SICreateModel
const kineParams = (o: X3DObject) => ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'sclx', 'scly', 'sclz'].map(n => o.kinematics.local.get(n)!).filter(Boolean);
const animated = (app: App, o: X3DObject) => kineParams(o).some(p => app.anim.isAnimated(p));

/** SICreateModel worker, steps 1 to 8 of the contract. `addToScene` is always 1 from the command. */
export function createModel(app: App, cmd: string, input: any, nameArg: any, parentArgV: any): Model {
  const st = stateOf(app);
  const given = parentArg(app, parentArgV);
  // 2. filter the inputs
  const items = unset(input) ? [] : listOf(input).map(x => resolve(app, x)).filter((n): n is Node => !!n);
  const objs: X3DObject[] = []; const groups: Group[] = []; let dropped = false;
  for (const n of items) {
    if (n instanceof Group) groups.push(n);
    else if (n instanceof X3DObject && !(n === app.scene.root)) {
      if (objs.length && n.parentObj !== objs[0].parentObj) { dropped = true; continue; }
      objs.push(n);
    } else dropped = true;
  }
  if (dropped) warn(app, cmd, 0x13, 'some inputs were dropped (not 3D objects with a common parent)');
  if (items.length) {
    if (!objs.length && !groups.length) throw raise(app, cmd, E_INVALIDARG, 0x14, 'no usable input object or group');
    if (given && objs.some(o => o === given || isDescendant(given, o))) throw raise(app, cmd, E_INVALIDARG, 0x14, 'the parent is one of the inputs or below one');
  }
  // 3. create the model
  const model = newModel(app, unset(nameArg) ? 'Model' : String(nameArg));
  // 4. parent
  let parent: X3DObject | null = given;
  if (!parent && objs.length === 1) parent = objs[0].parentObj;
  else if (!parent && groups.length === 1) { const g: any = groups[0].parent; parent = g instanceof X3DObject ? (g.model ?? null) : null; }
  // 5. Add3DObjectToScene
  add3DObjectToScene(app, model, parent);
  // 6. ParentObj + average global position
  if (objs.length) {
    const before = objs.map(o => o.globalMatrix().clone());
    const keep = !objs.some(o => animated(app, o));
    subtask(app, 'ParentObj', `${model.name} <- ${objs.map(o => o.name).join(',')}`);
    st.compensate = 1;
    try {
      app.run('ParentObj', { Parent: model.fullName, Children: objs });
      if (keep) {
        const avg = new THREE.Vector3(); for (const m of before) avg.add(new THREE.Vector3().setFromMatrixPosition(m)); avg.multiplyScalar(1 / before.length);
        const pm = model.parentObj ? model.parentObj.globalMatrix().clone().invert() : new THREE.Matrix4();
        const lp = avg.clone().applyMatrix4(pm); const l = model.kinematics.local;
        app.setParam(l.get('posx')!, lp.x); app.setParam(l.get('posy')!, lp.y); app.setParam(l.get('posz')!, lp.z);
        const inv = model.globalMatrix().clone().invert(); const d = Math.PI / 180;
        objs.forEach((o, i) => {   // children keep their global pose
          const m = inv.clone().multiply(before[i]); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
          const e = new THREE.Euler().setFromQuaternion(q, threeOrder(o.kinematics.local.val('rotorder'))); const c = o.kinematics.local;
          const set = (n: string, v: number) => { const pr = c.get(n)!; if (Math.abs(Number(pr.value) - v) > 1e-9) app.setParam(pr, v); };
          set('posx', p.x); set('posy', p.y); set('posz', p.z); set('rotx', e.x / d); set('roty', e.y / d); set('rotz', e.z / d); set('sclx', s.x); set('scly', s.y); set('sclz', s.z);
        });
      }
    } finally { st.compensate = 0; }
  }
  // 7. exactly one group: AddGroup
  if (groups.length === 1) { subtask(app, 'AddGroup', `${model.name} <- ${groups[0].name}`); app.run('AddGroup', { Target: model, InputObjs: [groups[0]] }); }
  return model;
}

// ------------------------------------------------------------------ SIGetModel
function getModel(app: App, input: any): Model {
  const root = app.scene.root;
  const list = unset(input) ? [] : Array.isArray(input) ? input : listOf(input);
  if (!list.length) return root;
  const uniq = (ms: (Model | null)[]) => [...new Set(ms.filter((m): m is Model => !!m))];
  const prune = (ms: Model[]) => ms.filter(m => !ms.some(o => o !== m && isDescendant(m, o)));
  let set = prune(uniq(nodesArg(app, list).map(n => modelOfNode(app, n))));
  let guard = 0;
  while (set.length > 1 && guard++ < 1000) set = prune(uniq(set.map(m => ownerModel(m) ?? root)));
  if (!set.length) throw raise(app, 'SIGetModel', E_FAIL, 0x38, 'no model owns the inputs');
  return set[0];
}

// ------------------------------------------------------------------ importers
function importModel(app: App, a: A): Model {
  const C = 'SIImportModel', st = stateOf(app);
  const file = fileArg(C, a.FileName); const parent = parentArg(app, a.Parent);
  const share = intArg(a.ShareOptions, 0);
  const ext = extOf(file);
  if (ext !== '.emdl' || !fileExists(file)) {
    if (!fileExists(file)) throw raise(app, C, E_INVALIDARG, 0x17, `file "${file}" does not exist`);
    if (ext === '.xsi') throw raise(app, C, E_INVALIDARG, 0x33, `"${file}" is a dotXSI file (use SIImportDotXSIFile); invalid or unsupported`);
    const conv = st.hooks.converters[ext];
    if (!conv) { app.logMsg('error', `${C}: no converter for extension "${ext}" (XSIMODELTASKS 0x15)`); throw raise(app, C, E_INVALIDARG, 0x33, `"${file}" is invalid or unsupported`); }
    fireFileEvent(app, C, EV_BEFORE_IMPORT, KIND_MODEL, file);
    let m = newModel(app, unset(a.Name) ? baseNoExt(file) : String(a.Name));
    subtask(app, 'SICreateModel', `${m.name} (no inputs, add to scene, undo on)`);
    add3DObjectToScene(app, m, parent);
    const r = conv(file, m); if (r instanceof Model) m = r;
    fireFileEvent(app, C, EV_AFTER_IMPORT, KIND_MODEL, file);
    return m;
  }
  // .emdl
  fireFileEvent(app, C, EV_BEFORE_IMPORT, KIND_MODEL, file);
  const name = unset(a.Name) ? baseNoExt(file) : String(a.Name);
  let m: Model | null = null;
  const reader = st.hooks.readers.emdl;
  if (reader) { m = newModel(app, name); add3DObjectToScene(app, m, parent); reader(file, m); }
  else {
    // text .emdl of this build's own preset format (src/commands/model2.ts) is loaded; the Softimage OLE storage is not attested
    try { const d = JSON.parse(hostFs.readFile(file)); if (d && Array.isArray(d.nodes)) { const r = app.run('ImportPresetModelData', { Data: d, Name: name }); if (r instanceof Model) { m = r; if (parent) { const old = m.parentObj!; app.record('Parent', () => parent.addChild(m!), () => old.addChild(m!)); } } } } catch { /* not this build's format */ }
    if (!m) { m = newModel(app, name); add3DObjectToScene(app, m, parent); logNya(app, C, `the .emdl storage reader; "${file}" gives an empty model`); }
  }
  (m as any).shareOptions = share;
  fireFileEvent(app, C, EV_AFTER_IMPORT, KIND_MODEL, file);
  return m;
}

function mergeScene(app: App, a: A): Model {
  const C = 'SIMergeScene', st = stateOf(app);
  const file = fileArg(C, a.FileName); const parent = parentArg(app, a.Parent);
  const ext = extOf(file); const conv = st.hooks.converters[ext];
  if (ext !== '.scn' && !(st.restricted && ext === '.exp') && !conv) throw raise(app, C, E_INVALIDARG, 0x33, `"${file}" is invalid or unsupported`);
  if (!fileExists(file)) throw raise(app, C, E_INVALIDARG, 0x33, `"${file}" is invalid or unsupported`);
  const name = unset(a.Name) ? baseNoExt(file) : String(a.Name);
  const m = newModel(app, name);
  add3DObjectToScene(app, m, parent);
  if (ext === '.scn') {
    if (st.hooks.readers.scn) st.hooks.readers.scn(file, m);
    else logNya(app, C, `the .scn section merge rules and ShareOptions (${a.ShareOptions}); "${file}" gives an empty model (open question 2)`);
  } else conv?.(file, m);
  return m;
}

function importIges(app: App, a: A): Model {
  const C = 'SIImportIges', st = stateOf(app);
  const file = fileArg(C, a.FileName); const parent = unset(a.Parent) ? null : a.Parent;
  if (!validFile(file, ['.iges', '.igs'])) throw raise(app, C, E_INVALIDARG, 0x33, `"${file}" is not an IGES file (filter "Iges Files (*.iges;*.igs)")`);
  fireFileEvent(app, C, EV_BEFORE_IMPORT, KIND_IGES, file);
  subtask(app, 'SICreateModel', 'no inputs, default name, add to scene, no undo');
  const m = app.run('SICreateModel', { Parent: parent }) as Model;
  if (st.hooks.readers.iges) st.hooks.readers.iges(file, m); else logNya(app, C, `the IGES translator; "${file}" gives an empty model`);
  fireFileEvent(app, C, EV_AFTER_IMPORT, KIND_IGES, file);
  return m;
}

function exportIges(app: App, a: A) {
  const C = 'SIExportIges', st = stateOf(app);
  restrictedGate(app, C);
  const file = fileArg(C, a.FileName);
  try {
    fireFileEvent(app, C, EV_BEFORE_EXPORT, KIND_IGES, file);
    const dir = parentPath(file);
    if (dir && !isFolder(dir)) throw raise(app, C, E_INVALIDARG, 0x51, `folder "${dir}" is not writable`);
    const inputs = unset(a.InputObjs) ? [] : nodesArg(app, a.InputObjs);   // empty = the whole scene
    if (st.hooks.writers.iges) st.hooks.writers.iges(file, inputs); else logNya(app, C, `the IGES writer; "${file}" is not written`);
    fireFileEvent(app, C, EV_AFTER_EXPORT, KIND_IGES, file);
  } catch (e: any) {
    if (e?.status === 0x562e80c7) throw e;
    if (e?.status !== undefined && String(e.message).includes('XSIMODELTASKS 0x51')) { /* raised inside the worker, Do raises 0x1c on top */ }
    throw raise(app, C, E_INVALIDARG, 0x1c, `export to "${file}" failed`);
  }
}

function importMixer(cmd: string) {
  return (app: App, a: A) => {
    const st = stateOf(app);
    const file = fileArg(cmd, a.FileName);
    let model: Model | null = null;
    const p = parentArg(app, a.Parent);
    if (p) model = p instanceof Model ? p : p.model;
    else { const s = app.selectedObjects[0]; model = s ? (s instanceof Model ? s : s.model) : null; }   // default object = selection (inferred)
    if (!model) throw raise(app, cmd, E_INVALIDARG, 0x1c, 'no model to import the mixer into');
    if (!validFile(file, ['.xsimixer'])) throw raise(app, cmd, E_INVALIDARG, 0x33, `"${file}" is not a .xsimixer file`);
    const merge = boolArg(a.Merge, cmd === 'MergeMixer');
    fireFileEvent(app, cmd, EV_BEFORE_IMPORT, KIND_MIXER, file);
    if (!merge && model.property('mixer')) {   // existing mixer content removed with a DeleteObj sub-task
      const old = model.property('mixer')!; subtask(app, 'DeleteObj', `${model.name}.Mixer`);
      app.record('DeleteObj', () => model!.removeProperty(old), () => model!.addProperty(old));
    }
    app.logMsg('info', 'Importing Mixer...');
    const mix = ensureMixer(app, model);
    if (st.hooks.readers.xsimixer) st.hooks.readers.xsimixer(file, model); else logNya(app, cmd, `the "Contents" stream reader; the mixer of "${file}" is not read`);
    fireFileEvent(app, cmd, EV_AFTER_IMPORT, KIND_MIXER, file);
    return mix;
  };
}

function importMatLib(cmd: string, forceRef: boolean) {
  return (app: App, a: A) => {
    const st = stateOf(app);
    const file = unset(a.FileName) ? '' : String(a.FileName);
    if (!file) throw fail(E_INVALIDARG, `${cmd}: FileName is required (status 0x80070057)`);
    const referenced = forceRef || intArg(a.ShareOptions, 0) !== 0;
    if (!fileExists(file)) { warn(app, cmd, 0x16, `file "${file}" does not exist`); throw fail(E_INVALIDARG, `${cmd}: file "${file}" does not exist (status 0x80070057)`); }
    if (!validFile(file, ['.xsi', '.xsiml'])) throw raise(app, cmd, E_INVALIDARG, 0x11c, `"${file}" is not a material library file (.xsi / .xsiml)`);
    fireFileEvent(app, cmd, EV_BEFORE_IMPORT, KIND_MATLIB, file);
    subtask(app, 'CreateLibrary', '___Default___');
    const lib: any = app.run('CreateLibrary', { Name: '___Default___', Type: 1 });
    if (lib) { app.run('SetCurrentMaterialLibrary', { InputObj: lib }); if (referenced) (lib as any).referencedFile = file; }
    if (st.hooks.readers.xsiml) st.hooks.readers.xsiml(file, lib);
    app.run('CrosswalkImportMatLib', { Filename: file, MatLib: lib?.name ?? '' });
    fireFileEvent(app, cmd, EV_AFTER_IMPORT, KIND_MATLIB, file);
    return lib;
  };
}

function exportMatLib(app: App, a: A) {
  const C = 'ExportMaterialLibrary';
  restrictedGate(app, C);   // the real command shows a message box here (simsgcat 0x143)
  const file = fileArg(C, a.FileName);
  fireFileEvent(app, C, EV_BEFORE_EXPORT, KIND_MATLIB, file);
  if (!['.xsi', '.xsiml'].includes(extOf(file))) throw raise(app, C, E_INVALIDARG, 0x33, `"${file}" is not a material library file name (.xsi / .xsiml)`);
  const dir = parentPath(file);
  if (dir && !isFolder(dir)) throw raise(app, C, E_INVALIDARG, 0x11c, `cannot write to "${file}"`);
  const given = unset(a.InputObjs) ? null : nodesArg(app, a.InputObjs)[0];
  const lib: any = given ?? (app.scene as any).libraryState?.current ?? null;   // none given = the current material library
  app.run('CrosswalkExportMatLib', { Filename: file, MatLib: lib ? lib.name : 'DefaultLib', Binary: false, ExportUsedImageClipsOnly: boolArg(a.ExportUsedImageClipsOnly, true) });
  fireFileEvent(app, C, EV_AFTER_EXPORT, KIND_MATLIB, file);
}

// ------------------------------------------------------------------ light list on model clips
const clipOf = (app: App, cmd: string, v: any): any => {
  const n = unset(v) ? null : resolve(app, v);
  if (!n) throw fail(E_POINTER, `${cmd}: ModelClip is missing (status 0x80004003)`);
  return n;
};

export function registerModelTasksB15aCommands(app: App) {
  const st = stateOf(app);
  for (const n of ['ImportMixer', 'ImportDelta']) st.legacy[n] = app.commands.get(n)?.execute as any;   // pre-B15a inferred handlers (replaced below)
  const reg = (name: string, category: string, label: string, execute: (app: App, a: A) => any, opts: { undoable?: boolean; description?: string } = {}) =>
    app.register({ name, label, category, description: opts.description ?? '', args: ARGS[name].map(x => ({ name: x.name, default: x.default })), undoable: opts.undoable ?? true, execute });

  reg('SICreateModel', 'File', 'Create Model', (app, a) => createModel(app, 'SICreateModel', a.InputObj, a.Name, a.Parent), { description: 'Create a model object' });
  reg('SIGetModel', 'File', 'Get model', (app, a) => getModel(app, a.InputObjs), { undoable: false, description: 'Get the model of an object' });
  reg('SIImportModel', 'File', 'Import Model', importModel, { description: 'Imports an export model into the scene' });
  reg('SIMergeScene', 'File', 'Merge Scene', mergeScene);
  reg('SIImportIges', 'File', 'Import IGES File', importIges, { description: 'Import an IGES file into the scene' });
  reg('SIExportIges', 'File', 'Export IGES File', exportIges, { undoable: false, description: 'Export the scene into an IGES file' });
  reg('MergeMixer', 'File', 'Merge Mixer', importMixer('MergeMixer'), { description: 'Merge an mixer into the model' });
  reg('ImportMixer', 'File', 'Import Mixer', importMixer('ImportMixer'), { description: 'Imports an mixer into the model' });
  reg('SIImportMatLib', 'File', 'Import Material Library', importMatLib('SIImportMatLib', false), { description: 'Imports a material library in the scene' });
  reg('SIImportReferencedMatLib', 'File', 'Import Material Library (Referenced)', importMatLib('SIImportReferencedMatLib', true), { description: 'Imports a material library in the scene by reference' });
  reg('ExportMaterialLibrary', 'File|Texturing', 'ExportMaterialLibrary', exportMatLib, { undoable: false, description: 'Export Material Library' });
  reg('GetLightListOnModelClip', 'Edit', 'Get Light List from ModelClip', (app, a) => String(clipOf(app, 'GetLightListOnModelClip', a.ModelClip).lightListB15a ?? ''), { undoable: false });
  reg('SetLightListOnModelClip', 'Edit', 'Set Light List from ModelClip', (app, a) => {
    const clip = clipOf(app, 'SetLightListOnModelClip', a.ModelClip); const old = clip.lightListB15a; const v = unset(a.LightList) ? '' : String(a.LightList);
    app.record('SetLightListOnModelClip', () => { clip.lightListB15a = v; }, () => { clip.lightListB15a = old; });
  });
  registerModelTasksB15aRefCommands(app);
}
