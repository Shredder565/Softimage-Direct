// Ledger row CMD-B6a. Brief: docs/ghidra/cmd-b6a-uixsi-keys-sources-materials.md, "Wire contract". Original code written from that contract only.
//
// 25 scripting names Softimage ships as VBScript UI wrappers: InspectMaterial, Store{GeomApprox,Material,Visibility}Properties,
// AddToContainer, RemoveFromContainer, SaveActionKey, SaveKeyOnMarkedKeyable, SaveShapeKey, OffsetValueMap, SaveOffsetKeys,
// DeleteUnused{Cache,Image,Animation,Audio}Sources, DeleteUnusedImageClips, DeleteUnusedMaterials, DeleteAllUnusedMaterials,
// MergeScene (this file) and Align, ApplyPath, CreateCurve, AssembleNurbsMesh, AddComponentTool, ToggleContinuousDraw
// (uixsiKeysSourcesMaterialsTools.ts).
//
// How this build differs from a Softimage session, and why:
//
//  * Script entry and native twin. Five names (SaveActionKey, SaveKeyOnMarkedKeyable, SaveShapeKey, OffsetValueMap,
//    SaveOffsetKeys) were already on the bus from other rows. Those entries are kept as the "native twins"
//    (`app.uixsiKeysSourcesMaterials.native`) and the script entries registered here call them, as the note describes.
//  * Key marker. There is one timeline value; it stands for PlayControl.Key and PlayControl.Current unless
//    `app.anim.keyMarker` is set (inferred, same convention as the mixer row).
//  * In/out arguments. The bus passes arguments by value; the written-back values are in `state.out[<command>]`.
//  * Dialogs. Modal paths return a Promise (same convention as the SDK helper row); a cancelled dialog rejects it
//    with siErrCancelled. Without a user session (`app.Interactive === false`) message boxes are logged and answered
//    OK, modal property pages count as cancelled (inferred in the note).
//  * Delegated commands that are not on the bus. Each is called when another row has registered it; otherwise a
//    documented, inferred stand-in runs or the step logs "not yet attested".
//  * Names with two registry entries (Align, ApplyPath, AssembleNurbsMesh): the scripted entry is on the bus, the
//    key-assignable / dialog entry is `app.uixsiKeysSourcesMaterials.ui.<Name>(args)`.
import { App, type CommandDef } from '../core/commands';
import { X3DObject, Node, Property, Material, Shader, Group, Layer, Partition, construction } from '../core/scene';
import { bool } from '../core/params';
import { isImageClip, isImageSource, materialOwners, isLocalMaterial, containerShaders, layersOf, allMaterials, MATERIAL_LIBRARY } from '../core/textureLayers';
import { allModels, sourcesOf } from '../core/mixerActionScripts';
import { nodes, findNode, findProperty, materialOf, findMaterial, removeProp, unset, boolArg, siConst } from './viewEditPropertyHelpers';
import {
  stateOf, trace, uixsiText, Cancelled, logNya, handled, msgBox, delegate, runNative, keyTime, syncTime, pref,
  inspectObj, autoInspect, ownerObject, type UixsiState,
} from './uixsiKeysSourcesMaterialsShared';
import { registerUixsiTools } from './uixsiKeysSourcesMaterialsTools';

export type { UixsiState };

/** Commands of other rows that this file delegates to and that may not be on the bus yet. */
const [SI_GET_MATERIAL_SHADER, MOVE_TO_FOLDER, REMOVE_FROM_FOLDER, SI_MERGE_SCENE] = 'SIGetMaterialShader MoveToFolder RemoveFromFolder SIMergeScene'.split(' ');
const NATIVE_TWINS = ['SaveActionKey', 'SaveKeyOnMarkedKeyable', 'SaveShapeKey', 'OffsetValueMap', 'SaveOffsetKeys'];

// ------------------------------------------------------------------ InspectMaterial
/** inferred stand-in for SIGetMaterialShader <objs>, siMaterialPortSurface: the surface shader of each item's material. */
function surfaceShaders(app: App, list: Node[]): Shader[] {
  const out: Shader[] = [];
  for (const n of list) {
    const m = n instanceof Material ? n : n instanceof Shader ? null : (() => { const o = ownerObject(n); return o ? materialOf(app, o) : null; })();
    const sh = n instanceof Shader ? n : m?.surface ?? null;
    if (sh && !out.includes(sh)) out.push(sh);
  }
  return out;
}

// ------------------------------------------------------------------ Store...Properties
type Host = Node & { properties?: Property[] };
/** Properties of a container. Groups, layers and partitions carry no property list in this build; one is attached on demand (inferred). */
const propsOf = (h: Host): Property[] => (h.properties ??= []);
const subItems = (h: Host): Node[] => h instanceof X3DObject ? [...h.children] : h instanceof Group ? [...h.members] : h instanceof Layer || h instanceof Partition ? [...h.members] : [];
const resolveOverride = (h: Host): Property | null => propsOf(h).find(p => p.name === 'Override') ?? null;
/** `<object>.<Name>` as a property or a material, with the "local property set" test of the note's step 2.3. */
function namedProperty(app: App, n: Node, name: string): { node: Node; local: boolean } | null {
  if (/^material$/i.test(name)) {
    if (!(n instanceof X3DObject) || !n.material) return null;
    return { node: n.material, local: isLocalMaterial(app.scene, n.material, n) };
  }
  const p = n instanceof X3DObject ? findProperty(n, name) : propsOf(n as Host).find(q => q.type.toLowerCase() === name.toLowerCase() || q.name.toLowerCase() === name.toLowerCase());
  return p ? { node: p, local: !p.shared } : null;
}
function addOverride(app: App, h: Host): Property | null {
  if (h instanceof X3DObject && app.commands.has('SIAddProp')) {
    trace(app, 'SIAddProp');
    try { app.run('SIAddProp', { PresetObj: 'Override', InputObjs: [h], PropagationType: 0 }); } catch { /* the creation failed: step 2.5 then finds nothing */ }
    const made = h.properties.find(p => p.type === 'override' || p.name === 'Override') ?? null;
    if (made && made.name !== 'Override') made.name = 'Override';
    return made;
  }
  // inferred: containers that are not 3D objects get the same one-parameter override property the AddProp preset builds
  trace(app, 'SIAddProp');
  const p = new Property('Override', 'override', [bool('enable', true, 'Enabled')]);
  const list = propsOf(h);
  app.record('Add Override', () => { p.parent = h; list.push(p); }, () => { const i = list.indexOf(p); if (i >= 0) list.splice(i, 1); p.parent = null; });
  return p;
}
function storeProperties(app: App, command: string, a: Record<string, any>) {
  const name = String(a.Name ?? '');
  for (const h of nodes(app, a.InputObjs) as Host[]) {
    if (!resolveOverride(h)) addOverride(app, h);
    const found: { node: Node; local: boolean }[] = [];
    for (const s of subItems(h)) { const r = namedProperty(app, s, name); if (r) found.push(r); }
    const own = namedProperty(app, h, name); if (own) found.push(own);
    const local = found.filter(f => f.local).map(f => f.node);
    const override = resolveOverride(h);
    if (local.length && override) {
      trace(app, `SIStoreProp[${local.length}]`);
      // inferred stand-in: which parameters SIStoreProp writes into the override is that command's contract (Q9). The
      // stored properties are recorded on the override (source path and parameter values); no override parameter is added.
      const entries = local.map(n => ({ source: n.fullName, values: Object.fromEntries(n.params.map(q => [q.name, q.value])) }));
      const bag: any = override; const before: any[] = bag.stored ?? [];
      app.record('Store in Override', () => { bag.stored = [...before.filter(e => !entries.some(x => x.source === e.source)), ...entries]; }, () => { bag.stored = before; });
      logNya(app, command, `the override parameters SIStoreProp creates; ${local.length} local ${name} propert${local.length === 1 ? 'y' : 'ies'} recorded on ${override.fullName}`, 'Q9');
    }
    if (override) inspectObj(app, [override]);
  }
}

// ------------------------------------------------------------------ containers
function container(app: App, command: string, a: Record<string, any>, groupCommand: string, folderCommand: string) {
  const key = a.Target instanceof Node ? a.Target : String(a.Target ?? '');
  const target = key instanceof Node ? key : app.scene.groupList.find(g => g.name === key) ?? findNode(app, key) ?? null;
  if (!target) throw new Error(`${command}: "${String(key)}" is not in the scene (dictionary lookup failed)`);
  if (target instanceof Group) { trace(app, groupCommand); app.run(groupCommand, { Target: target.name, InputObjs: a.InputObjs }); return; }
  if (!delegate(app, folderCommand, { Target: target, InputObjs: a.InputObjs }).done) logNya(app, command, `${folderCommand} (target ${target.fullName} is not a Group)`, 'Q9');
}

// ------------------------------------------------------------------ key saving
const KEY8 = (a: Record<string, any>, T: number) => ({ InputObjs: a.InputObjs, Time: T, Value: a.Value, Tolerance: a.Tolerance, Layer: a.Layer, ModifiedOnly: a.ModifiedOnly, AutokeyScope: a.AutokeyScope, Source: 'FCurve' });
function saveKeyDispatch(app: App, a: Record<string, any>) {
  const T = keyTime(app);
  stateOf(app).out.SaveActionKey = { Time: a.Time ?? null };   // Time is not written back although the registry marks it in/out
  if (a.Source === 'Action') { runNative(app, 'SaveActionKey', { InputObjs: a.InputObjs, Time: T, Value: a.Value, Tolerance: a.Tolerance }); return; }
  if (a.Source !== 'FCurve') throw new Cancelled('SaveActionKey');
  const mode = Number(pref(app, 'preferences.animation.save_key_command', 0));   // inferred default 0 = "any other value" (Q4)
  const name = mode === 1 ? 'SaveKeyOnKeyable' : mode === 2 ? 'SaveKeyOnMarkedKeyable' : mode === 3 ? 'SaveKeyOnCharacterKeySet' : 'SaveKey';
  if (!delegate(app, name, mode === 3 ? {} : KEY8(a, T)).done) logNya(app, 'SaveActionKey', `${name} is not on the bus`, 'Q9');
}
function saveKeyOnMarked(app: App, a: Record<string, any>) {
  const T = keyTime(app);
  stateOf(app).out.SaveKeyOnMarkedKeyable = { Time: a.Time ?? null };
  // inferred (Q1): the hidden ninth "marked only" parameter is true for this entry, so the native twin of the same name runs.
  runNative(app, 'SaveKeyOnMarkedKeyable', KEY8(a, T), 'Q1');
}

// ------------------------------------------------------------------ SaveShapeKey
/** Items of the input: the selection when unset; strings are split on top-level commas (sub-component strings keep their brackets). */
function shapeItems(app: App, arg: any): any[] {
  if (unset(arg)) {
    const c = app.compSel;
    if (c && c.kind === 'point' && c.points.size) return [`${c.obj.name}.pnt[${[...c.points].sort((x, y) => x - y).join(',')}]`];
    return [...app.selection];
  }
  if (Array.isArray(arg)) return [...arg];
  if (typeof arg !== 'string') return [arg];
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of arg + ',') { if (ch === '[') depth++; else if (ch === ']') depth--; if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch; }
  return out;
}
const isPointSubComponent = (it: any) => typeof it === 'string' && /\.pnt\[/.test(it);
function itemObject(app: App, it: any): X3DObject | null {
  if (it instanceof Node) return ownerObject(it);
  const s = String(it); return app.scene.find(s.replace(/\.(pnt|poly|edge|sample)\[.*$/, '')) ?? ownerObject(findNode(app, s) ?? null);
}
/** The note's solo-index fix. The cluster shape combiner is not modelled; when no operator of that kind is found the step is reported once. */
function soloIndexFix(app: App, it: any) {
  const o = itemObject(app, it); const prim = o?.primitive;
  const combiner = prim?.operators.find(op => /clustershapecombiner/i.test(op.type) || /clustershapecombiner/i.test(op.name.replace(/[\s_]/g, '')));
  if (!combiner) { logNya(app, 'SaveShapeKey', `solo-index fix: ${prim?.fullName ?? String(it)}.ClusterShapeCombiner is not modelled`, 'Q9'); return; }
  const show = combiner.get('ShowResult'), solo = combiner.get('SoloIndex');
  // inferred: "instances in port group 2" = the shape keys the combiner blends
  if (show && solo && !show.value) app.setParam(solo, o!.properties.filter(p => p.type === 'shapekey').length);
}
function storeShape(app: App, it: any, name: any, refMode: any): Property | null {
  // The build's StoreShapeKey takes an object (inferred mapping of clusters / sub-component strings to their object).
  const o = itemObject(app, it); trace(app, 'StoreShapeKey');
  const key = app.run('StoreShapeKey', { InputObj: o ? [o] : it, Name: unset(name) ? '' : name, RefMode: refMode });
  return key instanceof Property ? key : null;
}
function applyShape(app: App, key: Property, args: Record<string, any>): any {
  trace(app, 'ApplyShapeKey'); app.select([key]);   // the build's ApplyShapeKey reads the key from the selection
  return app.run('ApplyShapeKey', { InputObj: key, ...args });
}
function saveShapeKeyBody(app: App, a: Record<string, any>): any {
  if (boolArg(pref(app, 'preferences.modeling.constructionmodeautoupdate', (app as any).constructionAutoUpdate)) && construction.mode !== 'shape') {
    trace(app, 'SetConstructionMode'); app.run('SetConstructionMode', { Mode: 'shape' });
  }
  const T = keyTime(app);
  // RefMode is overwritten with the preference; inferred fallback when the preference has no value in this build: the registry default (Q5).
  const refMode = pref(app, 'Preferences.shape_animation.ShapeReference', siConst(':siShapeLocalReferenceMode:siShapeReferenceMode'));
  const out = (stateOf(app).out.SaveShapeKey = { RefMode: refMode } as Record<string, any>);
  const items = shapeItems(app, a.InputObj);
  let result: any;
  if (items.length === 1) {
    const key = storeShape(app, items[0], a.Name, refMode);
    if (key) {
      applyShape(app, key, { Compound: a.Compound, Track: a.Track, Time: T, Duration: a.Duration, Mode: a.Mode, Name: a.Name, Overwrite: a.Overwrite });
      soloIndexFix(app, items[0]);
      autoInspect(app, [key]);
    }
    result = undefined;   // nothing is assigned to the return value in this branch (Q5)
  } else {
    // inferred: an empty input takes this branch too (no item, an empty clip collection)
    const kept = items.filter(it => !isPointSubComponent(it));
    const keys = kept.map(it => storeShape(app, it, a.Name, refMode)).filter((k): k is Property => !!k);
    const clips = keys.map(k => applyShape(app, k, { Time: T, Duration: a.Duration, Mode: a.Mode, Overwrite: a.Overwrite }));
    for (const it of kept) soloIndexFix(app, it);
    autoInspect(app, keys);
    result = clips;
  }
  syncTime(app, 'SaveShapeKey', a.Time, T);
  out.Time = stateOf(app).out.SaveShapeKey.Time;
  return result;
}

// ------------------------------------------------------------------ unused sources, clips, materials
interface Candidate { node: Property; host: X3DObject; used: boolean }
/** The shared delete helper in "force clean, never ask" mode. */
function deleteUnused(app: App, cands: Candidate[]) {
  const del = (list: Candidate[]) => { trace(app, `DeleteObj[${list.length}]`); for (const c of list) removeProp(app, c.host, c.node); };
  if (!cands.length) return;
  if (cands.length === 1) { if (!cands[0].used) del(cands); return; }
  del(cands.filter(c => !c.used));   // also issued when nothing is unused
}
const rootProps = (app: App, test: (p: Property) => boolean): Property[] => app.scene.root.properties.filter(test);
/** inferred: an image clip is in use when a shader port, a texture layer or a material's clip parameter of this build refers to it. */
function clipUsed(app: App, clip: Property): boolean {
  for (const m of allMaterials(app.scene)) {
    if (m.val('ImageClipName') === clip.name) return true;
    for (const l of layersOf(m)) if ([...l.inputs.values()].includes(clip as any)) return true;
    for (const sh of containerShaders(m)) {
      if (sh.params.some(p => p.def.type === 'string' && p.value === clip.name)) return true;
      for (const l of layersOf(sh)) if ([...l.inputs.values()].includes(clip as any)) return true;
    }
  }
  return false;
}
const fileOf = (p: Property) => String(p.val('filename') ?? p.val('FileName') ?? '');
/** inferred: an image source is owned by the clips made from it (same file name, or an explicit `source` link). */
const imageSourceUsed = (app: App, src: Property) => rootProps(app, isImageClip).some(c => (c as any).source === src || (fileOf(src) !== '' && fileOf(c) === fileOf(src)));
/** inferred: a mixer source is in use when a clip of a mixer names it. */
function clipNamesSource(app: App, name: string): boolean {
  for (const model of allModels(app.scene)) {
    const mix: any = model.properties.find(p => p.type === 'mixer');
    for (const c of [...(mix?.clips ?? []), ...(mix?.compounds ?? [])]) if (c?.source === name) return true;
  }
  return false;
}
function sourceCandidates(app: App, kind: string): Candidate[] {
  const root = app.scene.root;
  switch (kind) {
    case 'Image Clip': return rootProps(app, isImageClip).map(node => ({ node, host: root, used: clipUsed(app, node) }));
    case 'Image Source': return rootProps(app, isImageSource).map(node => ({ node, host: root, used: imageSourceUsed(app, node) }));
    case 'Animation Source': return allModels(app.scene).flatMap(m => sourcesOf(m).map(node => ({ node, host: m as X3DObject, used: clipNamesSource(app, node.name) })));
    // inferred: cache and audio sources are not modelled; properties of these types on a model are treated as such
    case 'Cache Source': return allModels(app.scene).flatMap(m => m.properties.filter(p => /^(filecache(source)?|cachesource)$/i.test(p.type)).map(node => ({ node, host: m as X3DObject, used: clipNamesSource(app, node.name) })));
    case 'Audio Source': return allModels(app.scene).flatMap(m => m.properties.filter(p => /^audiosource$/i.test(p.type)).map(node => ({ node, host: m as X3DObject, used: clipNamesSource(app, node.name) })));
  }
  return [];
}
const isLibrary = (x: any): boolean => typeof x === 'string'
  ? [MATERIAL_LIBRARY.toLowerCase(), 'defaultlib'].includes(x.trim().toLowerCase())
  : !!x && typeof x === 'object' && /^materiallibrary$/i.test(String(x.type ?? ''));
/** The DeleteUnusedMaterials behaviour on the one material library of this build (Sources.Materials.DefaultLib). */
function deleteUnusedMaterials(app: App) {
  const mats = app.scene.materials;
  const kept = mats.filter(m => m instanceof Material && materialOwners(app.scene, m).length === 0 && !(m as any).locked && !(m as any).IsLocked);
  if (!kept.length) { app.logMsg('info', 'Nothing to delete'); return; }
  app.logMsg('info', `deleting those ${kept.map(m => `${MATERIAL_LIBRARY}.${m.name}`).join(',')}`);   // inferred: the list is printed as full names
  trace(app, `DeleteObj[${kept.length}]`);
  const before = [...mats];
  app.record('Delete unused materials', () => { for (const m of kept) { const i = mats.indexOf(m); if (i >= 0) mats.splice(i, 1); } }, () => { mats.splice(0, mats.length, ...before); });
}

// ------------------------------------------------------------------ registration
export function registerUixsiKeysSourcesMaterialsCommands(app: App) {
  const st = stateOf(app);
  for (const n of NATIVE_TWINS) if (!st.registered.includes(n)) st.native[n] = app.commands.get(n);
  const reg = (def: CommandDef) => { app.register(def); if (!st.registered.includes(def.name)) st.registered.push(def.name); };

  reg({
    name: 'InspectMaterial', label: 'Modify Shader', category: 'Rendering', description: 'Inspect the material of the 3do/cluster/group', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const list = (unset(a.InputObjs) ? [...app.selection] : (Array.isArray(a.InputObjs) ? a.InputObjs : String(a.InputObjs).split(',')).map((x: any) => x instanceof Node ? x : findMaterial(app, String(x).trim()) ?? findNode(app, String(x).trim())).filter(Boolean)) as Node[];
      const d = delegate(app, SI_GET_MATERIAL_SHADER, { InputObjs: list, Port: 'siMaterialPortSurface' });
      let shaders: Node[];
      if (d.done) shaders = (Array.isArray(d.result) ? d.result : d.result ? [d.result] : []).filter((x: any) => x instanceof Node);
      else { trace(app, `${SI_GET_MATERIAL_SHADER} (stand-in)`); shaders = surfaceShaders(app, list.flatMap(n => n instanceof Group ? [...n.members] : [n])); }
      inspectObj(app, shaders, 'Rendering');
    },
  });

  const store = (name: string, label: string, description: string, propName: string) => reg({
    name, label, category: 'Property', description,
    args: [{ name: 'InputObjs', default: null }, { name: 'Name', default: propName }],
    execute(app, a) { storeProperties(app, name, a); },
  });
  store('StoreGeomApproxProperties', 'Store Geometry Approx. Properties', 'Store GeomApprox Properties To Override', 'GeomApprox');
  store('StoreMaterialProperties', 'Store Material Properties', 'Store Material Properties To Override', 'Material');
  store('StoreVisibilityProperties', 'Store Visibility Properties', 'Store Visibility Properties To Override', 'visibility');

  const CONTAINER_ARGS = [{ name: 'Target', default: '' }, { name: 'InputObjs', default: '' }];
  reg({ name: 'AddToContainer', label: 'Add to Container', category: '', description: '', args: CONTAINER_ARGS, execute(app, a) { container(app, 'AddToContainer', a, 'SIAddToGroup', MOVE_TO_FOLDER); } });
  reg({ name: 'RemoveFromContainer', label: 'Remove from Container', category: '', description: '', args: CONTAINER_ARGS, execute(app, a) { container(app, 'RemoveFromContainer', a, 'RemoveFromGroup', REMOVE_FROM_FOLDER); } });

  reg({
    name: 'SaveActionKey', label: 'Save Action Key', category: 'Animation', description: '',
    args: [{ name: 'InputObjs', default: null }, { name: 'Time', default: null }, { name: 'Value', default: null }, { name: 'Tolerance', default: null }, { name: 'Layer', default: 0 }, { name: 'ModifiedOnly', default: false }, { name: 'AutokeyScope', default: 0 }, { name: 'Source', default: 'Action' }],
    execute(app, a) { saveKeyDispatch(app, a); },
  });
  reg({
    name: 'SaveKeyOnMarkedKeyable', label: 'Save Key On Marked Keyable', category: 'Animation', description: 'Save key on the marked keyable parameters',
    args: [{ name: 'InputObjs', default: null }, { name: 'Time', default: null }, { name: 'Value', default: null }, { name: 'Tolerance', default: null }, { name: 'Layer', default: null }, { name: 'ModifiedOnly', default: false }, { name: 'AutokeyScope', default: 0 }, { name: 'Source', default: 'FCurve' }],
    execute(app, a) { saveKeyOnMarked(app, a); },
  });
  reg({
    name: 'SaveShapeKey', label: 'Save Shape Key', category: 'Animation|Deformation', description: '',
    args: [{ name: 'InputObj', default: null }, { name: 'Compound', default: null }, { name: 'Track', default: null }, { name: 'Time', default: null }, { name: 'Duration', default: null }, { name: 'Mode', default: null }, { name: 'Name', default: null }, { name: 'Overwrite', default: null }, { name: 'RefMode', default: ':siShapeLocalReferenceMode:siShapeReferenceMode' }],
    execute(app, a) {
      if (construction.mode !== 'shape' && construction.mode !== 'secondaryshape') {
        const answer = msgBox(app, uixsiText(1008), 'Warning', true);
        if (answer instanceof Promise) return handled(app, 'SaveShapeKey', answer.then(ok => { if (!ok) throw new Cancelled('SaveShapeKey'); return saveShapeKeyBody(app, a); }));
      }
      return saveShapeKeyBody(app, a);
    },
  });
  reg({
    name: 'OffsetValueMap', label: 'Set Value Map Offset', category: 'Animation Mixer', description: '',
    args: [{ name: 'InputObjs', default: null }, { name: 'Type', default: null }, { name: 'Time', default: null }, { name: 'Value', default: null }],
    execute(app, a) {
      const T = keyTime(app);
      runNative(app, 'OffsetValueMap', { InputObjs: a.InputObjs, Type: a.Type, Time: T, Value: a.Value });
      syncTime(app, 'OffsetValueMap', a.Time, T);
    },
  });
  reg({
    name: 'SaveOffsetKeys', label: 'Save offset keys', category: 'Animation Mixer', description: '',
    args: [{ name: 'InputObjs', default: null }, { name: 'Type', default: null }, { name: 'Time', default: null }],
    execute(app, a) {
      const T = keyTime(app);
      runNative(app, 'SaveOffsetKeys', { InputObjs: a.InputObjs, Type: a.Type, Time: T });
      // the refresh comes before the time change (effect curves are otherwise not re-evaluated)
      syncTime(app, 'SaveOffsetKeys', a.Time, T, () => { trace(app, 'Refresh'); if (!delegate(app, 'Refresh', {}).done) app.events.emit('scene'); });
    },
  });

  const clean = (name: string, category: string, description: string, kind: string) => reg({
    name, label: name, category, description, args: [],
    execute(app) { deleteUnused(app, sourceCandidates(app, kind)); },
  });
  clean('DeleteUnusedCacheSources', 'Source', 'Delete Unused Cache Sources', 'Cache Source');
  clean('DeleteUnusedImageSources', 'File|Texturing', 'Delete Unused Image Sources', 'Image Source');
  clean('DeleteUnusedImageClips', 'File|Texturing', 'Delete Unused Image Clips', 'Image Clip');
  clean('DeleteUnusedAnimationSources', 'Source', 'Delete Unused Animation Sources', 'Animation Source');
  clean('DeleteUnusedAudioSources', 'Source', 'Delete Unused Audio Sources', 'Audio Source');

  reg({
    name: 'DeleteUnusedMaterials', label: 'DeleteUnusedMaterials', category: 'File|Texturing', description: 'Delete Unused Materials',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const first = unset(a.InputObjs) ? app.selection[0] : Array.isArray(a.InputObjs) ? a.InputObjs[0] : typeof a.InputObjs === 'string' ? a.InputObjs.split(',')[0] : a.InputObjs;
      // Only the first item is used and it must be a material library; anything else is an object model error in the script.
      if (!isLibrary(first)) throw new Error(`DeleteUnusedMaterials: the first input item is not a material library (${MATERIAL_LIBRARY})`);
      deleteUnusedMaterials(app);
    },
  });
  reg({
    name: 'DeleteAllUnusedMaterials', label: 'DeleteAllUnusedMaterials', category: 'File|Texturing', description: 'Delete All Unused Materials', args: [],
    execute(app) { deleteUnusedMaterials(app); },   // Sources.Materials.* has one library in this build
  });

  reg({
    name: 'MergeScene', label: 'Merge Scene', category: 'File', description: 'Merge a scene in the current scene',
    args: [{ name: 'FileName', default: '' }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }, { name: 'ShareOptions', default: ':siImportShareOptionsAll:siImportShareOptions' }],
    execute(app, a) {
      const d = delegate(app, SI_MERGE_SCENE, { FileName: a.FileName, Name: a.Name, Parent: a.Parent, ShareOptions: a.ShareOptions });
      st.out.MergeScene = { FileName: a.FileName };
      if (!d.done) {
        logNya(app, 'MergeScene', unset(a.FileName) ? `${SI_MERGE_SCENE} and its file browser are not on the bus; nothing merged` : `${SI_MERGE_SCENE} is not on the bus; "${a.FileName}" not merged`, 'Q9');
        return undefined;
      }
      const model = Array.isArray(d.result) ? d.result[0] : d.result;
      if (model instanceof X3DObject) { trace(app, 'SelectObj'); app.run('SelectObj', { InputObjs: [model], Mode: 'replace' }); return model; }
      return undefined;
    },
  });

  registerUixsiTools(app, reg);
}
