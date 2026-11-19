// Ledger row CMD-B11f, viseme / speech part: StoreViseme, SetupEvolverVisemes, CreateVisemeAction, CreateSpeechAction,
// CreateEvolverSpeechAction, FreezeLipSync. Brief: docs/ghidra/cmd-b11f-action-speech-shape-effects-binary.md,
// sections 2 and 3. Original code written from that prose contract only.
import { App } from '../core/commands';
import { FCurve } from '../core/animation';
import { Parameter } from '../core/params';
import { Cluster, Model, Property, X3DObject } from '../core/scene';
import { editMixer, mixerX, resolveItem } from '../core/mixerActionScripts';
import {
  E_POINTER, E_FAIL, S_OK, S_FALSE, KIND_SPEECH_CHANNEL, type SourceX, type ItemInfo,
  stateOf, setStatus, subtask, fail, logNya, unset, findObject, modelOf, ownerObject, paramsOf, paramByPath, strippedName, itemPath,
  resolveMixer, newSource, addItem, addSource, sourceData, isSpeechSource, findMouthControls, controlChannelParams,
} from './actionB11fModel';

const TAG_NYA = 'the Face Robot tag property read by the control finder (constant 0x180134e18, open question 6); this build reads the `frTag` field or the `tag` parameter of an `frtag` property';
const text = (v: any) => (unset(v) ? '' : String(v));

// ------------------------------------------------------------------ StoreViseme
function storeViseme(app: App, a: Record<string, any>) {
  const C = 'StoreViseme';
  if (unset(a.InputObj)) throw fail(E_POINTER, `${C}: InputObj is required`);
  const params = paramsOf(app, a.InputObj);
  const model = modelOf(app, a.Model) ?? (params[0] ? ownerObject(params[0])?.model ?? null : null);
  if (!model) { setStatus(app, C, S_FALSE); return null; }
  const list = params.filter(p => ownerObject(p)?.model === model);   // F3DActionFilterListWithModel
  resolveMixer(app, C, model);
  const src = newSource('viseme', 'StoredAction');
  addItem(src, 'PhonemeType', Number(a.PhonemeType ?? 0) | 0);
  let stored = 0;
  for (const p of list) {
    // Capability bit 2 = siReadOnly in the public siCapabilities enum (siAnimatable 1, siReadOnly 2): not storable.
    if (p.def.readOnly) continue;
    addItem(src, itemPath(app, model, strippedName(p)), Number(p.value));   // F3DAction_StoreStaticValue
    stored++;
  }
  if (!stored) { setStatus(app, C, S_FALSE); return null; }   // the source is released, nothing added
  addSource(app, model, src, unset(a.Name) ? null : String(a.Name));
  setStatus(app, C, S_OK);
  return src;
}

// ------------------------------------------------------------------ SetupEvolverVisemes
function setupEvolverVisemes(app: App, a: Record<string, any>) {
  const C = 'SetupEvolverVisemes';
  const model = modelOf(app, a.Model);
  if (!model) throw fail(E_POINTER, `${C}: Model is required`);
  if (a.ClipList === undefined || a.ClipList === null) throw fail(E_POINTER, `${C}: ClipList is required`);
  resolveMixer(app, C, model);
  const file = text(a.FileName);
  const fs = (app as any).hostFs;
  let body = '';
  try { if (file && fs?.exists?.(file)) body = String(fs.readFile(file)); } catch { body = ''; }
  const parser = stateOf(app).evolverParser;
  if (!parser) logNya(app, C, 'the Evolver mapping file format (parser 0x1800f7b80, open question 1); no parser is installed in this build');
  const mapping = parser ? parser(body, file) : null;
  if (!mapping) {
    app.logMsg('error', `${C}: the Evolver mapping file "${file}" could not be read (XSIACTION2 0x444)`);
    throw fail(E_FAIL, `${C}: the Evolver mapping file "${file}" could not be read`);
  }
  logNya(app, C, 'how ClipList selects the driven parameters (helpers 0x180068420 / 0x180068280); the parameters named by the mapping file are used');
  // Output lists: KeyList = parameters whose value changed, Action = the new sources (inferred from the argument names;
  // the note leaves the assignment open, open question 1).
  const keyList: Parameter[] = []; const actions: Property[] = []; let created = 0;
  for (const v of mapping.visemes) {
    const name = (mapping.prefix ?? '') + v.name;
    const existing = model.properties.find(p => p.type === 'actionsource' && (p as any).sourceClass === 'viseme' && p.name === name) as SourceX | undefined;   // inferred: reuse by name
    const src = existing ?? newSource('viseme', name);
    const before = src.val('data');
    addItem(src, 'PhonemeType', Number(v.phoneme) | 0);
    for (const [path, value] of Object.entries(v.values)) {
      const p = paramByPath(app, path); if (!p) continue;
      const orig = p.value; p.value = value; const stored = Number(p.value); p.value = orig;   // set, store, restore
      addItem(src, itemPath(app, model, strippedName(p)), stored);
      if (stored !== Number(orig) && !keyList.includes(p)) keyList.push(p);
    }
    if (existing) { const after = src.val('data'); app.record('Viseme items', () => src.set('data', after), () => src.set('data', before)); continue; }
    addSource(app, model, src, name);
    actions.push(src); created++;
  }
  setStatus(app, C, created ? S_OK : S_FALSE);
  return { KeyList: keyList, Action: actions };
}

// ------------------------------------------------------------------ CreateVisemeAction
function createVisemeAction(app: App, a: Record<string, any>) {
  const C = 'CreateVisemeAction';
  const model = modelOf(app, a.Model);
  if (!model) { setStatus(app, C, S_FALSE); return null; }
  resolveMixer(app, C, model);
  logNya(app, C, TAG_NYA);
  const controls = findMouthControls(model);
  if (!controls.length) { setStatus(app, C, S_FALSE); return null; }
  const src = newSource('viseme', 'Viseme');
  for (const c of controls) for (const p of controlChannelParams(c)) addItem(src, itemPath(app, model, strippedName(p)), 0);
  addSource(app, model, src, unset(a.Name) ? null : String(a.Name));
  setStatus(app, C, S_OK);
  return src;
}

// ------------------------------------------------------------------ CreateSpeechAction
function createSpeechAction(app: App, a: Record<string, any>) {
  const C = 'CreateSpeechAction';
  const face = findObject(app, Array.isArray(a.Face) ? a.Face[0] : a.Face);
  if (!face) { setStatus(app, C, S_FALSE); return null; }
  const model = face instanceof Model ? face : face.model;
  if (!model) { setStatus(app, C, S_FALSE); return null; }
  resolveMixer(app, C, model);
  logNya(app, C, TAG_NYA);
  const controls = findMouthControls(model);
  if (!controls.length) { setStatus(app, C, S_FALSE); return null; }
  const src = newSource('speech', 'SpeechAction');
  (src as any).container = [];   // helper container (class at 0x1801355f8, not identified): holds the item paths
  const mesh = face.primitive?.mesh();
  if (mesh) {
    let cl = face.clusters.find(c => c.compKind === 'pnt' && c.properties.some(p => p.type === 'shapekey'));
    if (!cl) {
      const made = new Cluster('Shape', 'pnt', new Set(Array.from({ length: mesh.positions.length / 3 }, (_, i) => i)));
      app.record('Create cluster', () => { if (!face.clusters.includes(made)) face.addCluster(made); }, () => face.removeCluster(made));
      subtask(app, C, 'SICreateCluster', `${face.name}: Shape (cluster type 3)`);
      cl = made;
    }
    logNya(app, C, 'the parameter name of the cluster shape weight item; the item is named <object>.cls.<cluster>.weight');
    const path = itemPath(app, model, `${face.name}.cls.${cl.name}.weight`);
    addItem(src, path, 0, { group: 'Face,Mesh', flag: 1 });
    (src as any).container.push(path);
  }
  for (const c of controls) {
    const group = (c as any).frTag ?? c.properties.find(p => p.type === 'frtag')?.val('tag') ?? '';
    for (const p of controlChannelParams(c)) {
      const path = itemPath(app, model, strippedName(p));
      addItem(src, path, Number(p.value), { group: String(group), kind: KIND_SPEECH_CHANNEL } as ItemInfo);   // inferred: control channels are the 0x1a items
      (src as any).container.push(path);
    }
  }
  src.published = true;   // the item list published on the source (slot 0x5e8, flags 1, 1)
  addSource(app, model, src, unset(a.Name) ? null : String(a.Name));
  setStatus(app, C, S_OK);
  return src;
}

// ------------------------------------------------------------------ CreateEvolverSpeechAction
function createEvolverSpeechAction(app: App, a: Record<string, any>) {
  const C = 'CreateEvolverSpeechAction';
  const model = modelOf(app, a.Model);
  if (!model) { setStatus(app, C, S_FALSE); return null; }
  resolveMixer(app, C, model);
  const src = newSource('speech', 'SpeechAction');
  for (const p of paramsOf(app, a.KeyList)) {
    const full = p.fullName;
    const group = full.includes('expressions') ? 'expressions' : full.includes('teeth') ? 'teeth' : 'unknown';
    addItem(src, itemPath(app, model, strippedName(p)), Number(p.value), { group, kind: KIND_SPEECH_CHANNEL });   // inferred: value = current value, kind 0x1a
  }
  src.published = true;
  addSource(app, model, src, unset(a.Name) ? null : String(a.Name));   // the name is set only when non-empty
  setStatus(app, C, S_OK);
  return src;
}

// ------------------------------------------------------------------ FreezeLipSync
function freezeLipSync(app: App, a: Record<string, any>) {
  const C = 'FreezeLipSync';
  const model = modelOf(app, a.Model);
  if (!model || !model.property('mixer')) { setStatus(app, C, S_FALSE); return 0; }
  let total = 0;
  for (const src of model.properties.filter(isSpeechSource)) {
    let frozen = 0;
    for (const [path, value] of Object.entries(sourceData(src))) {
      if (src.itemInfo[path]?.kind !== KIND_SPEECH_CHANNEL) continue;
      const rel = model !== app.scene.root && path.startsWith(model.name + '.') ? path.slice(model.name.length + 1) : path;   // `<model name>.` + item name
      const p = resolveItem(app.scene as any, rel, model).param; if (!p) continue;
      const old = app.anim.fcurves.get(p);
      if (old) subtask(app, C, 'DeleteObj', `${p.fullName} fcurve (flag 0x10)`);   // inferred: replaced
      const fc = new FCurve(p); fc.addKey(Number(src.frameStart ?? src.val('FrameStart') ?? 1), Number(value));   // F3DCreateFCurve, filled from the item
      app.record('Freeze lip sync', () => { app.anim.fcurves.set(p, fc); }, () => { if (old) app.anim.fcurves.set(p, old); else app.anim.fcurves.delete(p); });
      subtask(app, C, 'AddFCurve', p.fullName);
      frozen++;
    }
    if (!frozen) continue;
    total += frozen;
    subtask(app, C, 'DeleteObj', src.name);
    const mix = mixerX(model);
    if (mix.clips.some(c => c.source === src.name)) editMixer(app, mix, app.scene.root, 'Delete source clips', () => { mix.clips.splice(0, mix.clips.length, ...mix.clips.filter(c => c.source !== src.name)); });
    app.record('Delete speech source', () => model.removeProperty(src), () => { if (!model.properties.includes(src)) model.addProperty(src); });
  }
  if (total) logNya(app, C, 'the fill rule of the frozen fcurve (sampled speech evaluation, open question 2); one key with the item value at the source FrameStart is written');
  app.events.emit('params');
  setStatus(app, C, total ? S_OK : S_FALSE);
  return total;
}

export const SPEECH_HANDLERS: Record<string, (app: App, a: Record<string, any>) => any> = {
  StoreViseme: storeViseme,
  SetupEvolverVisemes: setupEvolverVisemes,
  CreateVisemeAction: createVisemeAction,
  CreateSpeechAction: createSpeechAction,
  CreateEvolverSpeechAction: createEvolverSpeechAction,
  FreezeLipSync: freezeLipSync,
};
export type { X3DObject };
