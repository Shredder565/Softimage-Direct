// Ledger row CMD-B15a (modeltasks.dll), second file: referenced-model commands (SISetResolutionOfRefModels,
// Add/RemoveRefModelResolution, SICreateRefModel / CreateEmptyRefModel) and delta commands (ApplyDelta,
// ImportDelta / ImportReferencedDelta). Brief: docs/ghidra/cmd-b15a-modeltasks.md and WIRE_CORRECTIONS_B15 item 21.
// REPLACES the pre-B15a inferred AddRefModelResolution / CreateEmptyRefModel / ImportDelta of src/commands/model2.ts.
// Stand-in: a referenced model is a Model with the `ref` record of model2.ts ({file, resolution, resolutions,
// resolutionNames}); resolution k (k >= 1) is resolutions[k-1], 0 = offloaded. A "delta" is the `delta` property of
// model2.ts (parameter changes keyed by path) plus File / Mode / Target parameters. Reloading model content on a
// resolution change is not attested: logged as "not yet attested".
import { App } from '../core/commands';
import { Property } from '../core/scene';
import { str, int } from '../core/params';
import {
  stateOf, fail, raise, warn, logNya, subtask, licenceGate, restrictedGate, extOf, baseNoExt, fileExists, parentArg, add3DObjectToScene, newModel, ensureRef, refOf,
  hostFs, unset, listOf, resolve, nodesArg, boolArg, intArg, isFile, isFolder, parentPath, Node, X3DObject, Model,
  E_POINTER, E_INVALIDARG, KIND_MODEL, type RefRecord,
} from './modelTasksB15aShared';

type A = Record<string, any>;
type Arg = { name: string; default?: any };
/** Registry argument lists (data/command_registry.json). */
export const REF_ARGS: Record<string, Arg[]> = {
  SISetResolutionOfRefModels: [{ name: 'Target' }, { name: 'Resolution', default: 0 }],
  AddRefModelResolution: [{ name: 'Model' }, { name: 'ResolutionName', default: '' }, { name: 'FileName', default: '' }, { name: 'Add', default: true }],
  RemoveRefModelResolution: [{ name: 'Model' }, { name: 'ResolutionName', default: '' }, { name: 'Confirm', default: true }, { name: 'Add', default: false }],
  SICreateRefModel: [{ name: 'FileName' }, { name: 'ModelName', default: '' }, { name: 'ResolutionName', default: '' }, { name: 'Parent' }, { name: 'Activate', default: true }, { name: 'CreateFile', default: false }, { name: 'ExternalCnxMappingTemplate', default: '' }, { name: 'ShareOptions', default: 65535 }],
  CreateEmptyRefModel: [{ name: 'FileName', default: '' }, { name: 'ModelName', default: '' }, { name: 'ResolutionName', default: '' }, { name: 'Parent' }, { name: 'Activate', default: false }, { name: 'ExternalCnxMappingTemplate', default: '' }, { name: 'ShareOptions', default: 65535 }],
  ApplyDelta: [{ name: 'Deltas' }],
  ImportDelta: [{ name: 'FileName' }, { name: 'Model' }, { name: 'Reference', default: false }, { name: 'Interactive', default: true }],
  ImportReferencedDelta: [{ name: 'FileName' }, { name: 'Model' }, { name: 'Reference', default: true }, { name: 'Interactive', default: true }],
};

const modelArg = (app: App, v: any): Model | null => {
  if (unset(v)) return null;
  const n = resolve(app, v);
  return n instanceof Model ? n : n instanceof X3DObject ? (n.model ?? null) : null;
};
/** Resolution k usable: its file is on the host file system or in the app's referenced-model store (inferred). */
function usable(r: RefRecord, k: number): boolean {
  const f = r.resolutions[k - 1]; if (!f) return false;
  if (r.data) return true;
  try { if (isFile(f) || localStorage.getItem('si.refmodel.' + f) !== null) return true; } catch { /* no storage */ }
  return false;
}
const setRes = (app: App, m: Model, r: RefRecord, k: number) => { const old = r.resolution; app.record('SetResolution', () => { r.resolution = k; }, () => { r.resolution = old; }); };

// ------------------------------------------------------------------ SISetResolutionOfRefModels
function setResolution(app: App, a: A) {
  const C = 'SISetResolutionOfRefModels';
  if (!licenceGate(app, C)) return;
  if (unset(a.Target)) throw fail(E_POINTER, `${C}: Target list is missing (status 0x80004003)`);
  const k = intArg(a.Resolution, 0); const changed: Model[] = [];
  for (const n of nodesArg(app, a.Target)) {
    const m = n instanceof Model ? n : null; const r = refOf(m); if (!m || !r) continue;
    if (k === 0 || (k <= r.resolutions.length && usable(r, k))) { setRes(app, m, r, k); changed.push(m); }
    else app.logMsg('info', `${C}: ${m.name}: resolution ${k} does not exist or is not usable; skipped`);
  }
  if (changed.length) logNya(app, C, `reloading the content of ${changed.map(m => m.name).join(', ')} after the resolution change (overrides are deactivated)`);
}

// ------------------------------------------------------------------ AddRefModelResolution / RemoveRefModelResolution
function resolutionCmd(cmd: string) {
  return (app: App, a: A) => {
    const add = boolArg(a.Add, cmd === 'AddRefModelResolution');
    if (!add && unset(a.ResolutionName)) throw fail(E_INVALIDARG, `${cmd}: ResolutionName is required when Add is false (status 0x80070057)`);
    if (!licenceGate(app, cmd)) return;
    const m = modelArg(app, a.Model) ?? modelArg(app, app.selectedObjects[0]);
    const r = refOf(m);
    if (!m || !r) { app.logMsg('info', `${cmd}: ${m ? m.name + ' is not' : 'no'} referenced model; nothing done`); return; }
    const names = r.resolutionNames ??= r.resolutions.map(() => '');
    const name = unset(a.ResolutionName) ? '' : String(a.ResolutionName);
    if (add) {
      const file = unset(a.FileName) ? '' : String(a.FileName);
      app.record('AddRefModelResolution', () => { r.resolutions.push(file); names.push(name); }, () => { r.resolutions.pop(); names.pop(); });
      app.logMsg('info', `${m.name}: resolution ${r.resolutions.length + 1} = ${file}`);
      return;
    }
    const i = names.indexOf(name);   // nothing happens when not found, resolution 0 (offloaded) or the active resolution
    if (i < 0 || r.resolution === i + 1) return;
    const f = r.resolutions[i], was = r.resolution;
    app.record('RemoveRefModelResolution', () => { r.resolutions.splice(i, 1); names.splice(i, 1); if (r.resolution > i + 1) r.resolution--; },
      () => { r.resolutions.splice(i, 0, f); names.splice(i, 0, name); r.resolution = was; });
  };
}

// ------------------------------------------------------------------ SICreateRefModel / CreateEmptyRefModel
function createRefModel(cmd: string, empty: boolean) {
  return (app: App, a: A) => {
    if (!licenceGate(app, cmd)) return undefined;
    let file = unset(a.FileName) ? '' : String(a.FileName);
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(file)) logNya(app, cmd, `downloading the URL "${file}"`);
    if (file && !fileExists(file)) warn(app, cmd, 0x16, `file "${file}" does not exist`);
    const name = !unset(a.ModelName) ? String(a.ModelName) : file ? baseNoExt(file) : 'RefModel';
    subtask(app, 'SICreateModel', `${name} (no inputs, add to scene, undo on)`);
    const m = newModel(app, name);
    add3DObjectToScene(app, m, parentArg(app, a.Parent));
    if (!empty && boolArg(a.CreateFile, false) && file && !fileExists(file)) {
      const dir = parentPath(file); if (dir && !isFolder(dir)) hostFs.ensureFolder(dir);
      subtask(app, 'ExportModel', file);
      hostFs.writeFile(file, JSON.stringify({ format: 'softimage-direct-empty-emdl', model: m.name, nodes: [] }));
      logNya(app, cmd, 'the .emdl storage format of the empty model written by ExportModel (a stand-in text file is written)');
    }
    const r = ensureRef(m);
    r.shareOptions = intArg(a.ShareOptions, 0xffff);
    r.file = file; r.resolutions = [file]; r.resolutionNames = [unset(a.ResolutionName) ? '' : String(a.ResolutionName)];
    if (!file) { r.resolutions = []; r.resolutionNames = []; }
    r.activate = empty ? boolArg(a.Activate, false) : boolArg(a.Activate, true);
    if (r.activate && file && fileExists(file)) { r.resolution = 1; logNya(app, cmd, `loading resolution 1 ("${file}") into ${m.name}`); }
    if (!unset(a.ExternalCnxMappingTemplate)) (m as any).externalCnxMappingTemplate = String(a.ExternalCnxMappingTemplate);   // passed on; no use seen
    app.select([m]); app.events.emit('scene');
    return m;
  };
}

// ------------------------------------------------------------------ deltas
const deltasOf = (m: Model): Property[] => m.properties.filter(p => p.type === 'delta');
function applyIn(app: App, m: Model, d: Property) {
  const legacy = stateOf(app).legacy.ImportDelta; const r = refOf(m);
  if (r) r.applying = (r.applying ?? 0) | 2;
  try {
    const changes: Map<string, any> | undefined = (d as any).changes;
    if (changes?.size && legacy) {   // legacy payload applier of model2.ts works on the selected model
      const sel = app.selection.slice();
      try { app.selection = [m]; legacy(app, { Data: { delta: [], params: Object.fromEntries(changes) } }); } finally { app.selection = sel; }
    }
  } finally { if (r) r.applying = (r.applying ?? 0) & ~2; }
}
function applyDelta(app: App, a: A) {
  const C = 'ApplyDelta';
  if (!licenceGate(app, C)) return;
  if (unset(a.Deltas)) throw fail(E_POINTER, `${C}: Deltas list is missing (status 0x80004003)`);
  for (const n of nodesArg(app, a.Deltas)) {
    if (!(n instanceof Property) || n.type !== 'delta') continue;   // only items exposing the delta interface
    const m = n.parent instanceof Model ? n.parent : modelArg(app, (n as any).val?.('target'));
    if (m && refOf(m)) applyIn(app, m, n);
  }
}
function loadDeltaText(file: string): any | null {
  try { if (isFile(file)) return JSON.parse(hostFs.readFile(file)); } catch { /* */ }
  try { const t = localStorage.getItem('si.delta.' + file) ?? localStorage.getItem('si.delta.' + file + '.delta'); if (t) return JSON.parse(t); } catch { /* */ }
  return null;
}
function importDelta(cmd: string) {
  return (app: App, a: A) => {
    const st = stateOf(app);
    restrictedGate(app, cmd);
    const file = unset(a.FileName) ? '' : String(a.FileName);
    if (!file || unset(a.Model)) throw fail(E_INVALIDARG, `${cmd}: FileName and Model are required (status 0x80070057)`);
    if (!licenceGate(app, cmd)) return undefined;
    const m = modelArg(app, a.Model); if (!m) return undefined;
    const noFile = file === 'non$existent.delta';
    const payload = noFile ? null : loadDeltaText(file);
    if (!noFile && !payload && !fileExists(file)) warn(app, cmd, 0x16, `file "${file}" does not exist`);
    const r = refOf(m);
    if (!r) return undefined;   // acts only on a locked referenced model with a ref-model head
    const old = deltasOf(m)[0]; const interactive = boolArg(a.Interactive, true) && (app as any).Interactive !== false;
    if (old && interactive) {
      const q = st.hooks.yesNoCancel?.(`Delta "${old.name}" exists: keep it as ${old.name}_BACKUP and create a new one? (XSIMODELTASKS 0x10 / 0x11)`);
      if (q === 'cancel') return undefined;
      if (!q) logNya(app, cmd, 'the replace-delta question has no UI in this build; answered No (inferred)');
      if (q === 'yes') app.record('BackupDelta', () => { old.name = old.name + '_BACKUP'; }, () => { old.name = old.name.replace(/_BACKUP$/, ''); });
      else app.record('DeleteObj', () => m.removeProperty(old), () => m.addProperty(old));
    } else if (old) app.record('DeleteObj', () => m.removeProperty(old), () => m.addProperty(old));   // batch: new delta (inferred)
    const d = new Property(app.scene.uniqueName('Delta'), 'delta', [str('target', m.name, 'Model', { readOnly: true }), int('changes', 0, 'Changes', { readOnly: true }), { ...str('File', file, 'File') }, int('Mode', 3, 'Mode'), str('TargetPath', m.fullName, 'Target')] as any);
    (d as any).changes = new Map<string, any>();
    app.record('Add Delta', () => m.addProperty(d), () => m.removeProperty(d));
    if (payload) {   // load from the file with the ambient flag referencing.importingdelta set
      st.importingDelta = true;
      try { for (const [k, v] of Object.entries(payload.params ?? {})) (d as any).changes.set(k, v); d.set('changes', (d as any).changes.size); } finally { st.importingDelta = false; }
      if (Array.isArray(payload.delta) && payload.delta.length) { const sel = app.selection.slice(); try { app.selection = [m]; st.legacy.ImportDelta?.(app, { Data: payload }); } finally { app.selection = sel; } }
    }
    if (!boolArg(a.Reference, cmd === 'ImportReferencedDelta')) d.set('Mode', 0);   // copied, not referenced
    applyIn(app, m, d);
    return d;
  };
}

export function registerModelTasksB15aRefCommands(app: App) {
  const reg = (name: string, label: string, execute: (app: App, a: A) => any, undoable = true) =>
    app.register({ name, label, category: 'File', description: '', args: REF_ARGS[name].map(x => ({ name: x.name, default: x.default })), undoable, execute });
  reg('SISetResolutionOfRefModels', 'Set Resolution Of All RefModels', setResolution);
  reg('AddRefModelResolution', 'AddRefModelResolution', resolutionCmd('AddRefModelResolution'));
  reg('RemoveRefModelResolution', 'RemoveRefModelResolution', resolutionCmd('RemoveRefModelResolution'));
  reg('SICreateRefModel', 'Create Referenced Model', createRefModel('SICreateRefModel', false));
  reg('CreateEmptyRefModel', 'Create Empty Referenced Model', createRefModel('CreateEmptyRefModel', true));
  reg('ApplyDelta', 'Apply a model delta', applyDelta);
  reg('ImportDelta', 'Import a model delta', importDelta('ImportDelta'));
  reg('ImportReferencedDelta', 'Import a referenced model delta', importDelta('ImportReferencedDelta'));
}
