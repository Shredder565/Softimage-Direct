// Ledger row CMD-B11e: action items, store-action defaults, action presets, source copy, pose items and clip merge
// (action.dll). Brief: docs/ghidra/cmd-b11e-action-maps-rules-sources-binary.md, section 3 (RemoveActionItem ...
// MergeClips). Original code written from that prose contract only. Helpers: actionB11eModel.ts.
import { App } from '../core/commands';
import { Node, Property, Model, X3DObject, Constraint } from '../core/scene';
import type { Parameter } from '../core/params';
import { int, str } from '../core/params';
import { isActionSource, isCompoundRecord, sourceOf, toGlobal, ClipNode, mixerX } from '../core/mixerActionScripts';
import {
  E_POINTER, E_INVALIDARG, E_ACCESSDENIED, DISP_E_EXCEPTION, S_OK, S_FALSE, reg, fail, logNya, unset, numArg, setStatus, b11e,
  findNode, modelArg, ensureMixer, uniqueIn, sourceArg, listOf, itemsOf, snapSource, writeSource, srcJson, makeSource, clipArg,
} from './actionB11eModel';
import { registerActionB11eMaps } from './actionB11eMaps';

const warn = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);

// ------------------------------------------------------------------ RemoveActionItem
function removeActionItem(app: App, a: Record<string, any>) {
  const C = 'RemoveActionItem';
  // inferred: unset Source = the selected action source (the argument handler is not in action.dll)
  const src = unset(a.Source) ? app.selection.find(n => isActionSource(n)) as Property | undefined : sourceArg(app, a.Source);
  if (!src) throw fail(E_POINTER, `${C}: Source is missing or is not an action source`);
  const s = src as any;
  if (s.sourceType === 6 && s.layerLocked) { // keying-layer action whose layer is locked (stand-in fields: this build has no keying-layer sources)
    app.logMsg('error', `${C}: XSIACTION2 message 0x447: the layer of ${s.layerClipPath ?? src.name} is locked (${src.fullName})`);
    throw fail(E_ACCESSDENIED, `${C}: the keying layer of ${src.name} is locked`);
  }
  const before = snapSource(src);
  const names = String(a.Name ?? '');
  const after: ReturnType<typeof snapSource> = { ...before };
  const removed: string[] = [];
  if (!names) {
    // "remove all items" (inferred meaning of slot 9)
    after.data = '{}'; after.fcurves = '{}'; after.expressions = '{}'; after.items = 0;
    removed.push(...itemsOf(src));
  } else {
    const v = srcJson<Record<string, unknown>>(src, 'data'), f = srcJson<Record<string, unknown>>(src, 'fcurves'), e = srcJson<Record<string, unknown>>(src, 'expressions');
    for (const raw of names.split(',')) {
      const n = raw.trim();
      const key = [...new Set([...Object.keys(v), ...Object.keys(f), ...Object.keys(e)])].find(k => k === n || k.endsWith(`.${n}`)); // inferred: an item is named by its path (full or relative)
      if (!key) {
        app.logMsg('error', `${C}: XSIACTION2 message 0x9f: ${n}`);
        throw fail(DISP_E_EXCEPTION, `${C}: item "${n}" cannot be removed from ${src.name} (0x80070057)`);
      }
      delete v[key]; delete f[key]; delete e[key]; removed.push(key);
    }
    after.data = JSON.stringify(v); after.fcurves = JSON.stringify(f); after.expressions = JSON.stringify(e);
    after.items = new Set([...Object.keys(v), ...Object.keys(f), ...Object.keys(e)]).size;
  }
  app.record(C, () => writeSource(src, after), () => writeSource(src, before));
  setStatus(app, C, S_OK);
  return removed;
}

// ------------------------------------------------------------------ GetStoreActionDefaults
const STORE_MASK: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 8, 5: 0xe, 6: 0xf };
function ownerObj(p: Parameter): X3DObject | null {
  let n: any = p.owner; while (n && !(n instanceof X3DObject)) n = n.parent; return n ?? null;
}
/** The store worker 0x180063c90 in query mode (batch 12 Q3). Mask bits: 1 static values, 2 fcurves, 4 expressions,
 *  8 constraints / other driving operators (3 items each). Static values only for parameters with nothing else stored.
 *  From / To: union of the stored fcurves' key ranges; else the scene span when an expression or constraint is stored;
 *  else 1 / 5 when only static values; else 0 / 0. */
function storeQuery(app: App, input: any[], mask: number): { From: number; To: number; Size: number } {
  const objs: X3DObject[] = []; const direct: Parameter[] = [];
  for (const x of input) {
    const n = x instanceof Node ? x : findNode(app, x);
    if (n instanceof X3DObject) { if (!objs.includes(n)) objs.push(n); }
    else if (x && typeof x === 'object' && 'def' in x && 'owner' in x) direct.push(x as Parameter);
    else if (typeof x === 'string') { for (const [p] of app.anim.fcurves) if (p.fullName === x) direct.push(p); for (const [p] of app.anim.expressions) if (p.fullName === x && !direct.includes(p)) direct.push(p); }
  }
  // the parameters of the input: the given ones, the objects' keyable local transform and their animated parameters (inferred)
  const params: Parameter[] = [...direct];
  const add = (p: Parameter) => { if (!params.includes(p)) params.push(p); };
  for (const o of objs) o.kinematics.local.params.filter(p => p.keyable).forEach(add);
  for (const [p] of app.anim.fcurves) if (objs.includes(ownerObj(p) as X3DObject)) add(p);
  for (const [p] of app.anim.expressions) if (objs.includes(ownerObj(p) as X3DObject)) add(p);
  let size = 0, from = Infinity, to = -Infinity, curves = 0, exprOrCns = 0, statics = 0;
  for (const p of params) {
    let storedHere = false;
    const fc = app.anim.fcurves.get(p);
    if ((mask & 2) && fc && fc.keys.length) { size++; curves++; storedHere = true; from = Math.min(from, fc.keys[0].time); to = Math.max(to, fc.keys[fc.keys.length - 1].time); }
    if ((mask & 4) && app.anim.expressions.has(p)) { size++; exprOrCns++; storedHere = true; }
    if ((mask & 1) && !storedHere) { size++; statics++; }
  }
  if (mask & 8) for (const o of objs) for (const c of o.properties) if (c instanceof Constraint) { size += 3; exprOrCns++; } // inferred: constraints enumerated per object
  if (!size) return { From: 0, To: 0, Size: 0 }; // nothing would be stored: no source
  if (curves) return { From: from, To: to, Size: size };
  if (exprOrCns) return { From: app.anim.startFrame, To: app.anim.endFrame, Size: size };
  if (statics) return { From: 1, To: 5, Size: size };
  return { From: 0, To: 0, Size: size };
}
function storeDefaults(app: App, a: Record<string, any>) {
  const C = 'GetStoreActionDefaults';
  const type = String(a.Type ?? 'ReturnOnly');
  const mask = STORE_MASK[numArg(a.Mode, 1)] ?? 0;
  if (type !== 'ReturnOnly') {
    const kind = type === 'TransientAction' ? 2 : type === 'UnownedAction' ? 0 : 1;
    logNya(app, C, `the store worker outside query mode (storage kind ${kind}); the action is stored through StoreAction`);
    return app.run('StoreAction', { Model: a.Model ?? '', InputObj: a.InputObj ?? '', Mode: numArg(a.Mode, 1) });
  }
  // query mode: only InputObj and Mode are read
  const input = unset(a.InputObj) ? app.selectedObjects : listOf(a.InputObj); // inferred: unset InputObj = the selection
  const r = storeQuery(app, input, mask);
  Object.assign(a, r);
  setStatus(app, C, S_OK);
  return r;
}

// ------------------------------------------------------------------ LoadActionPreset
const PRESET_EXT = ['.preset', '.xsi', '.eani'];
function loadActionPreset(app: App, a: Record<string, any>) {
  const C = 'LoadActionPreset';
  const given = unset(a.FileName) ? '' : String(a.FileName);
  // batch 12 Q4: full path = <folder> + "\" (only when the folder does not end in one) + <file>. inferred: a bare file
  // name takes the folder kept under Nle\animmix\action; a path carries its own folder
  const lastFolder = b11e(app).registry['Nle\\animmix\\action'];
  const file = given && !/[\\/]/.test(given) && lastFolder ? lastFolder + (lastFolder.endsWith('\\') ? '' : '\\') + given : given;
  const ext = (/\.[^.\\/]+$/.exec(file)?.[0] ?? '').toLowerCase(); // case-insensitive extension test (batch 12)
  if (!file || !PRESET_EXT.includes(ext)) {
    app.logMsg('error', `${C}: XSIACTION2 message 0x33: ${file || '(no file)'}`);
    throw fail(E_INVALIDARG, `${C}: "${file}" is not a .Preset, .xsi or .eani file`);
  }
  const model = modelArg(app, unset(a.Model) ? app.scene.root : a.Model); // inferred: unset Model = the scene root
  if (!model) throw fail(E_POINTER, `${C}: Model does not resolve to a model`);
  const mix = ensureMixer(app, model);
  const folder = file.replace(/[\\/][^\\/]*$/, '');
  const st = b11e(app); const prevFolder = st.registry['Nle\\animmix\\action'];
  app.record(C, () => { st.registry['Nle\\animmix\\action'] = folder; }, () => { if (prevFolder === undefined) delete st.registry['Nle\\animmix\\action']; else st.registry['Nle\\animmix\\action'] = prevFolder; });
  if ((model as any).referencedModel && (model as any).lockFlags) { const was = mix.val('Active'); app.record(C, () => mix.set('Active', true), () => mix.set('Active', was)); }
  if (ext === '.eani') st.fileEvents.push({ id: 0x20510015, type: 10, file }); // before the load
  logNya(app, C, `the ${ext === '.preset' ? 'preset' : ext === '.xsi' ? 'scene-source' : '.eani'} loader and the item post-processing; an empty action source is created`);
  const base = file.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, '');
  const name = String(a.Name || base);
  const src = makeSource(uniqueIn(model.properties.map(p => p.name), name), {}, {}, [int('storage', 1, 'Storage'), str('filename', file, 'File Name')]); // inferred: names of properties 7 / 8
  const storage = numArg(a.ActionStorage, 0);
  if (storage !== -1) { src.set('storage', storage); if (storage === 0) src.set('filename', ''); }
  app.record(C, () => model.addProperty(src), () => model.removeProperty(src));
  if (ext === '.eani') st.fileEvents.push({ id: 0x20510016, type: 10, file }); // post-load event (batch 12 Q4)
  setStatus(app, C, S_OK);
  return src;
}

// ------------------------------------------------------------------ CopySourceActionToFolder
/** A copy target: a model (its sources), a mixer (its model) or a folder / library node with an item list. */
function targetOf(app: App, x: any): { add: (p: Property) => void; remove: (p: Property) => void; names: () => string[] } | null {
  const n = x instanceof Node ? x : findNode(app, x) ?? (typeof x === 'string' ? [...app.scene.allObjects()].flatMap(o => o.properties).find(p => p.fullName === x) : undefined);
  const model = n instanceof Model ? n : n instanceof Property && n.type === 'mixer' && n.parent instanceof Model ? n.parent : null;
  if (model) return { add: p => model.addProperty(p), remove: p => model.removeProperty(p), names: () => model.properties.map(p => p.name) };
  const items = (n as any)?.items;
  if (Array.isArray(items)) return { add: p => items.push(p), remove: p => { const i = items.indexOf(p); if (i >= 0) items.splice(i, 1); }, names: () => items.map((i: Node) => i.name) };
  return null;
}
function copySourceActionToFolder(app: App, a: Record<string, any>) {
  const C = 'CopySourceActionToFolder';
  if (unset(a.InputObj) || unset(a.Target)) throw fail(E_POINTER, `${C}: InputObj and Target are required`);
  const sources = listOf(a.InputObj).map(x => sourceArg(app, x)).filter((p): p is Property => !!p);
  const targets = listOf(a.Target).map(x => targetOf(app, x)).filter(Boolean) as NonNullable<ReturnType<typeof targetOf>>[];
  const copies: Property[] = [];
  for (const t of targets) for (const src of sources) {
    // the copy helper task (mode 2): a deep copy of the source parameters. inferred: the copy keeps the name, made unique in the target
    const copy = new Property(uniqueIn(t.names(), src.name), src.type, src.params.map(p => ({ ...p.def, value: p.value })));
    for (const k of ['frameStart', 'frameEnd']) if ((src as any)[k] !== undefined) (copy as any)[k] = (src as any)[k];
    app.record(C, () => t.add(copy), () => t.remove(copy));
    copies.push(copy);
  }
  setStatus(app, C, copies.length ? S_OK : S_FALSE);
  if (!copies.length) app.logMsg('info', `${C}: nothing was copied`);
  return copies;
}

// ------------------------------------------------------------------ AddPoseActionItems
// Batch 12 Q4: <Name>.kine.local.{scl,rot,pos}{x,y,z} (the "." separator inferred); identity values 1,1,1,0,0,0,0,0,0
const POSE_SUFFIX = ['.kine.local.sclx', '.kine.local.scly', '.kine.local.sclz', '.kine.local.rotx', '.kine.local.roty', '.kine.local.rotz', '.kine.local.posx', '.kine.local.posy', '.kine.local.posz'];
const POSE_VALUES = [1, 1, 1, 0, 0, 0, 0, 0, 0];
function addPoseActionItems(app: App, a: Record<string, any>) {
  const C = 'AddPoseActionItems';
  if (unset(a.InputObjs)) throw fail(E_POINTER, `${C}: InputObjs is required`);
  const base = String(a.Name ?? 'OFFSET_ROOT');
  const names = POSE_SUFFIX.map(s => base + s);
  const done: Property[] = [];
  for (const x of listOf(a.InputObjs)) {
    const src = x instanceof Node ? (isActionSource(x) ? x as Property : undefined) : sourceArg(app, x);
    if (!src) continue; // no action-source interface
    const S = src as any;
    if (Array.isArray(S.poseItems) && S.poseItems.length) continue; // the source already has a pose-item list: skipped silently
    const before = snapSource(src); const beforePose = S.poseItems;
    // pass 1: the nine items are added one by one (value 0 until pass 2); pass 2: the nine values in one call
    const v = srcJson<Record<string, number>>(src, 'data'); names.forEach(n => { v[n] = 0; });
    names.forEach((n, i) => { v[n] = POSE_VALUES[i]; });
    const after = { ...before, data: JSON.stringify(v) }; after.items = new Set([...Object.keys(v), ...Object.keys(srcJson(src, 'fcurves')), ...Object.keys(srcJson(src, 'expressions'))]).size;
    app.record(C, () => { writeSource(src, after); S.poseItems = [...names]; }, () => { writeSource(src, before); S.poseItems = beforePose; });
    done.push(src);
  }
  setStatus(app, C, done.length ? S_OK : S_FALSE);
  return done.length;
}

// ------------------------------------------------------------------ MergeClips
function mergeClips(app: App, a: Record<string, any>) {
  const C = 'MergeClips';
  // inferred: unset InputObjs = the selected clips
  const nodes = (unset(a.InputObjs) ? app.selection.filter(n => n instanceof ClipNode) : listOf(a.InputObjs)).map(x => clipArg(app, x)).filter((n): n is ClipNode => !!n);
  const models = [...new Set(nodes.map(n => n.ref.model))];
  logNya(app, C, 'the clip collection rules (helper 0x180044d60); every clip of one model is accepted');
  if (!nodes.length || models.length !== 1) {
    app.logMsg('error', `${C}: XSIACTION2 message 0xe3: invalid clip selection`);
    throw fail(E_INVALIDARG, `${C}: select clips of one model to merge`);
  }
  const model = models[0];
  const spanStart = Math.min(...nodes.map(n => n.clip.start)), spanEnd = Math.max(...nodes.map(n => n.clip.start + n.clip.duration));
  ensureMixer(app, model);
  logNya(app, C, 'the per-clip item conversion (helper 0x1800430e0); each clip gives its source items with keys moved to scene time');
  const values: Record<string, number> = {}; const curves: Record<string, { time: number; value: number; interp?: number }[]> = {};
  let given = 0;
  for (const n of nodes) {
    if (isCompoundRecord(n.clip)) continue; // inferred: a compound clip gives no item
    const src = sourceOf(n.ref);
    if (!src || !isActionSource(src)) continue;
    const v = srcJson<Record<string, number>>(src, 'data'); const f = srcJson<Record<string, { time: number; value: number; interp?: number }[]>>(src, 'fcurves');
    if (!Object.keys(v).length && !Object.keys(f).length) continue;
    given++;
    for (const [k, x] of Object.entries(v)) if (!(k in values)) values[k] = x;
    for (const [k, keys] of Object.entries(f)) {
      const out = curves[k] ?? (curves[k] = []);
      for (const key of keys ?? []) { const t = toGlobal(n.ref, key.time); const i = out.findIndex(o => Math.abs(o.time - t) < 1e-9); const kk = { ...key, time: t }; if (i >= 0) out[i] = kk; else out.push(kk); }
      out.sort((p, q) => p.time - q.time);
    }
  }
  if (!given) { warn(app, `${C}: XSIACTION2 message 0xe4: the clips give no item to merge`); setStatus(app, C, S_FALSE); return null; }
  const src = makeSource(uniqueIn(model.properties.map(p => p.name), 'MergedClips'), values, curves);
  (src as any).frameStart = spanStart; (src as any).frameEnd = spanEnd - 1;
  mixerX(model);
  app.record(C, () => model.addProperty(src), () => model.removeProperty(src));
  setStatus(app, C, S_OK);
  return src;
}

/** Row CMD-B11e (the single entry main.ts calls). */
export function registerActionB11eCommands(app: App) {
  registerActionB11eMaps(app);
  reg(app, 'RemoveActionItem', { description: 'Remove an item of the selected action', execute: removeActionItem });
  reg(app, 'GetStoreActionDefaults', { description: 'Get the suggested clip in/out and number of items that would be found if an Action were stored.', execute: storeDefaults });
  reg(app, 'LoadActionPreset', { description: 'Loads an action source from a .Preset, .xsi or .eani file into the model\'s mixer.', execute: loadActionPreset });
  reg(app, 'CopySourceActionToFolder', { description: 'Copy the animation from a container to an other container', execute: copySourceActionToFolder });
  reg(app, 'AddPoseActionItems', { description: 'Adds the identity pose items to action sources.', execute: addPoseActionItems });
  reg(app, 'MergeClips', { description: 'Merge clips into a new source', execute: mergeClips });
}
