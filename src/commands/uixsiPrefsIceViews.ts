// Ledger row CMD-B6c. Brief: docs/ghidra/cmd-b6c-uixsi-prefs-ice-views.md, "Wire contract". Original code written from that contract only.
//
// 28 commands Softimage ships as VBScript procedures: ImportPreferences, ExportPreferences, RestoreDefaultPreference,
// InspectPreferences, SIUpdateCamerasFromGlobalPref, SIUpdateFxTreesFromGlobalPref, SIUpdatePlayControlFromGlobalPref,
// MakeICETreeBranch, PromoteICETree, GroupPointClouds, SplitCloud, SwitchToView, SwitchToViewByType,
// GetViewportUnderMouse, SetFocusedViewport, SetCameraSequencerLayout, PlotCameraSequencer, ManCharacterOnUpdate,
// BipedRigOnUpdate, InfoGeometry, ParamBracketing, InspectLocks, RenamePropAndRebind, RenamePropAndRebindUI,
// SavePivotKey, TransferShapeAnimation, GetShaderOnCnxPointFunction, LockEnvelopeDeformerWeights.
//
// How this build differs from a Softimage session, and why:
//
//  * Dialogs. The command bus is synchronous, so a command that needs a file browser or a modal page returns a
//    Promise: resolved when the dialog was accepted and the work is done, rejected with siErrCancelled on Cancel.
//  * In/out arguments. The bus hands arguments by value; the values a command writes back to an in/out argument
//    are kept in `app.uixsiPrefsIceViews.out[<command>]`.   // inferred
//  * Delegated commands that are not on the bus (C++ commands outside this row). Each is called when another row
//    has registered it; otherwise a documented, inferred stand-in runs or the step logs "not yet attested".
//  * One command per scripting name. The registry has four SavePivotKey entries and four SwitchToViewByType
//    entries; the generic entry is registered and the others are `app.uixsiPrefsIceViews.variants`.
//  * SavePivotKey and TransferShapeAnimation were on the bus before this row had a note (the inferred Animate
//    surface batch); this file re-registers both from the contract.
//  * Preferences, view manager, layout views, Net View, PlayControl: see uixsiPrefsIceViewsHelpers.ts.
import { App, type CommandDef } from '../core/commands';
import { X3DObject, Node, Property, Cluster, Model, Null, Camera, syncMixer } from '../core/scene';
import { str, bool, type Parameter } from '../core/params';
import { ICETreeOperator } from '../core/ice';
import { envelopeOf } from '../core/envelope';
import { SI_KEY_INTERP_CONSTANT, type Key } from '../core/animation';
import { mixerX, allModels, clipType, cameraSequencer, T_ANIM, T_ANIM_CPD, type ClipX } from '../core/mixerActionScripts';
import { currentLayoutName, layoutByName } from '../ui/layout';
import { preferencesWindow } from '../ui/prefs';
import { sdkModal, renderSdkLayout } from '../ui/sdkHelpersModal';
import { objs, nodes, findNode, findObject, unset, siConst, boolArg, reparent } from './viewEditPropertyHelpers';
import {
  NOTE, logNya, logWarning, Cancelled, interactive, ownerObject, delegate, nothingGiven, PrefStore, browseFile, makeViewManager, viewportLetter,
  layoutViews, factoryPath, openNetView, getPlayControl, setPlayControl, shaderOnCnxPoint,
  type ViewManagerFacade, type NetViewRecord, type LayoutView,
} from './uixsiPrefsIceViewsHelpers';

// ------------------------------------------------------------------ session state
export interface UixsiPrefsIceViewsState {
  prefs: PrefStore;
  viewManager: ViewManagerFacade;
  views(): LayoutView[];
  /** Every Net View opened by InfoGeometry / ParamBracketing / InspectLocks, in order. */
  netViews: NetViewRecord[];
  /** Values written back to in/out arguments, by command. */
  out: Record<string, Record<string, any>>;
  /** What InspectPreferences opened last. */
  lastInspectPreferences: { select: string | null; page: string | null } | null;
  /** siTransformFilter values used by SavePivotKey (open question Q6). */
  transformFilter: Record<string, number>;
  /** The other registry entries of SavePivotKey and SwitchToViewByType, by display name. */
  variants: Record<string, { command: string; args: Record<string, any> }>;
  runVariant(label: string): any;
}
// inferred (Q6): the transform filter is a bit set, scaling 1, rotation 2, translation 4; override here once attested.
const TRANSFORM_FILTER: Record<string, number> = { siScl: 1, siRot: 2, siSR: 3, siTrn: 4, siST: 5, siRT: 6, siSRT: 7 };

/** Commands of other rows that this row delegates to and that may not be on the bus yet (names kept out of quoted literals). */
const [TRANSFER_ICE_TREE, SI_GET_PRIM, SI_FILTER, UNLOCK, PLOT_TO_ACTIONS, PLOT_SHAPE, GET_SHOT_CLIP, RENAME_INTERNAL, SI_TRANSFER_SHAPE, SI_SHADER_ON_CNX, OPEN_XSI_EXPLORER]
  = 'TransferICETree SIGetPrim SIFilter Unlock PlotCamSeqToActions PlotCamSeqShape GetShotClip RenamePropAndRebind_Internal SITransferShapeAnimation SIGetShaderOnCnxPoint OpenXSIExplorer'.split(' ');

const stateOf = (app: App): UixsiPrefsIceViewsState => (app as any).uixsiPrefsIceViews;
const isCamera = (o: any): o is X3DObject => o instanceof X3DObject && (o instanceof Camera || o.type === 'camera');
const isCloud = (o: any): o is X3DObject => o instanceof X3DObject && o.type === 'pointcloud';
const isTree = (n: any): n is ICETreeOperator => n instanceof ICETreeOperator || (n instanceof Node && /^icetree$/i.test(n.type));
const isShapeKey = (n: any): n is Property => n instanceof Property && n.type === 'shapekey';
const setIf = (app: App, set: { get(n: string): Parameter | undefined } | null | undefined, name: string, v: any) => { const p = set?.get(name); if (p && v !== undefined && v !== null) app.setParam(p, v); };
const valueOf = (x: any) => x && typeof x === 'object' && !(x instanceof Node) && 'Value' in x ? x.Value : x;
// inferred: the type names a script host reports for the values this build can hand to the callback
const NODE_TYPE_NAME: Record<string, string> = { object: 'X3DObject', model: 'Model', property: 'Property', primitive: 'Primitive', operator: 'Operator', kinematics: 'Kinematics', material: 'Material', shader: 'Shader', scene: 'Scene' };
const typeName = (x: any): string => x === undefined ? 'Empty' : x === null ? 'Nothing' : x instanceof Node ? NODE_TYPE_NAME[x.kind] ?? x.kind
  : typeof x === 'string' ? 'String' : typeof x === 'number' ? 'Double' : typeof x === 'boolean' ? 'Boolean' : 'Object';
/** Script name of an object: `name` under the scene root, `Model.name` inside a model. */
const scriptName = (o: X3DObject): string => { const m = o.parentObj?.model; return m && m.parentObj ? `${m.name}.${o.name}` : o.name; };
function inspectLater(app: App, n: Node) { if (app.autoInspect) queueMicrotask(() => app.events.emit('inspect', n)); }   // AutoInspect <object>

// ------------------------------------------------------------------ ICE trees
/** Parent3DObject of a tree: the object it was made a branch tree of, else the object whose primitive holds it. */
const treeHost = (op: ICETreeOperator): X3DObject | null => (op as any).branchHost ?? op.owner?.() ?? ownerObject(op.parent);
/** TransferICETree <tree>, <object>, <mode>, <branch>. */
function transferTree(app: App, command: string, op: ICETreeOperator, target: X3DObject, mode: number, branch: boolean) {
  if (delegate(app, TRANSFER_ICE_TREE, { Operator: op, '3DObject': target, Mode: mode, Branch: branch }).done) return;
  // inferred stand-in (Q9): the tree is marked a branch tree of the target. It keeps evaluating on the object whose
  // stack holds it, which is the target itself or lies below the target in every call of this row.
  const o: any = op; const old = { branch: o.branch, host: o.branchHost };
  app.record('Transfer ICE tree', () => { o.branch = branch; o.branchHost = target; }, () => { o.branch = old.branch; o.branchHost = old.host; });
  logNya(app, command, `the tree transfer is the C++ command's; ${op.name} was marked a branch tree of ${target.name} and still evaluates on its own object`, 'Q9');
}
/** A null made by the low-level creator (no selection change, no inspection). */
function newNull(app: App, name: string, parent: X3DObject): X3DObject {
  const d = delegate(app, SI_GET_PRIM, { PresetObj: 'Null', Name: name, Parent: parent });
  const made = Array.isArray(d.result) ? d.result[0] : d.result;
  if (d.done && made instanceof X3DObject) return made;
  const n = new Null(app.scene.uniqueName(name || 'null'));
  app.record('Add ' + n.name, () => parent.addChild(n), () => parent.removeChild(n));
  return n;
}
/** Collection argument, expanded and passed through the object filter. */
function filteredObjects(app: App, arg: any): X3DObject[] {
  const list = objs(app, arg);
  const d = delegate(app, SI_FILTER, { InputObjs: list, Type: '' });
  if (d.done) return (Array.isArray(d.result) ? d.result : d.result ? [d.result] : []).filter((o: any): o is X3DObject => o instanceof X3DObject);
  return list;   // inferred (Q4): the filter with an empty type keeps scene objects; the point cloud test selects the items
}

// ------------------------------------------------------------------ rename and rebind
/** inferred: string parameters of the owner's material shaders and of its other properties that hold the property's name. */
function referencesTo(app: App, p: Property, name: string): Parameter[] {
  const o = ownerObject(p); const out: Parameter[] = []; if (!o) return out;
  const take = (set: { params: Parameter[] } | null | undefined) => { for (const q of set?.params ?? []) if (q.def.type === 'string' && q.value === name) out.push(q); };
  for (const q of o.allProperties()) if (q !== p) take(q);
  let m = o.material; for (let n: X3DObject | null = o; n && !m; n = n.parentObj) m = n.material;
  const walk = (s: any) => { if (!s) return; take(s); for (const i of s.inputs?.values?.() ?? []) walk(i); };
  walk((m ?? app.scene.root.material)?.surface);
  return out;
}
function renameAndRebind(app: App, props: Property[], newName: string, updateRefs: boolean, updateWildcards: boolean) {
  if (!newName) { logNya(app, 'RenamePropAndRebind', 'the rename command with an empty name; nothing was renamed', 'Q8'); return; }   // checked before the internal command, which raises 0x6f on a bad name (CMD-B12f)
  if (delegate(app, RENAME_INTERNAL, { Properties: props, PropertyName: newName, UpdateRefs: updateRefs, UpdateWildcards: updateWildcards }).done) return;
  let rebound = 0;
  for (const p of props) {
    const siblings: Property[] = (p.parent as any)?.properties ?? [];
    let nn = newName; for (let i = 1; siblings.some(q => q !== p && q.name === nn); i++) nn = `${newName}${i}`;   // inferred (Q8): a taken name gets a numeric suffix
    const old = p.name; if (old === nn) continue;
    const refs = updateRefs ? referencesTo(app, p, old) : []; rebound += refs.length;
    app.record('Rename ' + old, () => { p.name = nn; for (const r of refs) r.value = nn; }, () => { p.name = old; for (const r of refs) r.value = old; });
  }
  logNya(app, 'RenamePropAndRebind', `the rename is the C++ command's; ${props.length} propert${props.length === 1 ? 'y' : 'ies'} renamed here, ${rebound} name reference(s) on the owner's material and properties updated${updateWildcards ? ', wildcard references not updated' : ''}`, 'Q8');
}

// ------------------------------------------------------------------ camera sequencer
/** GetShotClip <frame>: the shot clip at a sequencer frame and its camera. */
function shotClipAt(app: App, frame: number): { clip: any; camera: X3DObject | null } {
  const d = delegate(app, GET_SHOT_CLIP, { Frame: frame });
  if (d.done) { const r = d.result ?? {}; const cam = r.ActiveCamera ?? (Array.isArray(r) ? r[1] : null); return { clip: r.Clip ?? (Array.isArray(r) ? r[0] : null), camera: isCamera(cam) ? cam : typeof cam === 'string' ? app.scene.find(cam) ?? null : null }; }
  // inferred stand-in (Q10): the first camera shot clip that covers the frame; its source names the camera
  for (const t of cameraSequencer(app.scene.root).tracks) for (const c of t.clips) {
    if (frame >= c.start && frame < c.start + c.duration) { const cam = app.scene.find(String(c.source ?? '')); return { clip: c, camera: isCamera(cam) ? cam : null }; }
  }
  return { clip: null, camera: null };
}
/** inferred: the scene's renderable cameras are its camera objects, in scene order. */
const renderableCameras = (app: App): X3DObject[] => [...app.scene.allObjects()].filter(isCamera);

function plotCameraSequencer(app: App, a: Record<string, any>) {
  const C = 'PlotCameraSequencer';
  let start = Number(a.StartFrame), end = Number(a.EndFrame); const gaps = boolArg(a.PlotWithoutGaps);
  // 1. remove all locks, so that locked clips can be deleted
  if (!delegate(app, UNLOCK, { InputObjs: 'Scene_Root', Level: 'siLockLevelAll', Password: '', RemoveAll: true }).done) logNya(app, C, 'the unlock command is not available; this build has no locks to remove');
  // 2. everything the sequencer drives, as action sources that are applied in step 8
  let actions: any[] = [];
  const pa = delegate(app, PLOT_TO_ACTIONS, {
    InputObjs: null, ActionName: 'CamSeq_PlotAction', StartFrame: start, EndFrame: end, PlotWithoutGaps: gaps, 'FCurve Kind': 'siStandardFCurve',
    DefaultSegKind: 'siCubicInterpolation', 'Fit FCurve': false, 'Fit Tolerance': 0.01, ProcessContRots: true, Apply: false, Delete: false,
  });
  if (pa.done) {
    actions = Array.isArray(pa.result) ? pa.result : pa.result ? [pa.result] : [];
    const o = (pa.result as any) ?? {}; if (Number.isFinite(Number(o.StartFrame))) start = Number(o.StartFrame); if (Number.isFinite(Number(o.EndFrame))) end = Number(o.EndFrame);
  } else logNya(app, C, 'the plot-to-actions command is not available; no object animation was plotted', 'Q10');
  // 3. file caches
  const caches = app.run('PlotCamSeqForCachedObjects', {
    Path: '[project path]\\Simulation\\CamSeqSimulationPlot\\[model]\\[object]\\[object]_#.icecache',
    SequenceIn: start, SequenceOut: end, PlotWithoutGaps: gaps, Attributes: null, UseGlobalKine: true,
  });
  // 4. shapes
  if (!delegate(app, PLOT_SHAPE, {
    InputObjs: null, Name: 'CamSeq_PlotShape', StartFrame: start, EndFrame: end, PlotWithoutGaps: gaps, ApplyKeys: true,
    Mode: 'siShapeBlendedWeightMode', Content: 'siShapeContentAllDeforms', RefMode: 'siShapeAbsoluteReferenceMode',
  }).done) logNya(app, C, 'the shape plot command is not available; no shape animation was plotted', 'Q10');
  // 5. the sequencer camera: one item (camera) or two (camera, new clip)
  const plotted = app.run('PlotSequencerCamera', {
    SequenceIn: start, SequenceOut: end, ActionName: 'SequencerCamera_Plot_Action', CameraName: a.SequencerCameraName, PlotWithoutGaps: gaps, ApplyToCamera: boolArg(a.ApplyToCamera),
  });
  // 6. animation clips and animation compound clips of every model's mixer, without the plotted camera's clip
  const keep: any = Array.isArray(plotted) && plotted.length === 2 ? plotted[1] : null;
  const same = (c: ClipX) => !!keep && (c === keep || (typeof keep === 'string' ? c.name === keep : !!keep.name && c.name === keep.name && c.source === keep.source));
  const doomed: { mix: ReturnType<typeof mixerX>; clips: ClipX[]; compounds: ClipX[] }[] = [];
  for (const model of allModels(app.scene)) {
    if (!model.property('mixer')) continue;
    const mix = mixerX(model);
    const wanted = (c: ClipX) => { const t = clipType(c); return (t === T_ANIM || t === T_ANIM_CPD) && !same(c); };
    const clips = mix.clips.filter(wanted), compounds = (mix.compounds as ClipX[]).filter(wanted);
    if (clips.length || compounds.length) doomed.push({ mix, clips, compounds });
  }
  // 7. one delete for the whole collection; errors are suppressed from here on
  if (doomed.length) {
    const before = doomed.map(d => ({ clips: [...d.mix.clips], compounds: [...d.mix.compounds] }));
    app.record('Delete clips', () => {
      for (const d of doomed) { d.mix.clips.splice(0, d.mix.clips.length, ...d.mix.clips.filter(c => !d.clips.includes(c))); d.mix.compounds.splice(0, d.mix.compounds.length, ...d.mix.compounds.filter(c => !d.compounds.includes(c as ClipX))); syncMixer(d.mix); }
    }, () => { doomed.forEach((d, i) => { d.mix.clips.splice(0, d.mix.clips.length, ...before[i].clips); d.mix.compounds.splice(0, d.mix.compounds.length, ...before[i].compounds); syncMixer(d.mix); }); });
  }
  // 8. apply the plotted actions, then dispose of them
  for (const action of actions) {
    if (!action || typeof action !== 'object') continue;
    try {
      app.run('ApplyAction', { Source: action.name ?? action, Target: null, 'Consider Time': false, RemoveLayerAnimation: true });
      const owner: any = action.parent;
      if (action instanceof Property && owner?.removeProperty) app.record('Delete ' + action.name, () => owner.removeProperty(action), () => owner.addProperty(action));
    } catch { /* suppressed */ }
  }
  // 9. plotted caches
  if (Array.isArray(caches) && caches.length === 3) {
    try { app.run('ApplyCamSeqFileCacheSources', { ObjectsToApply: caches[0], CacheFilePaths: caches[1], ClipsToDelete: caches[2] }); } catch { /* suppressed */ }
  }
  // 10.
  try { setPlayControl(app, 'In', start); setPlayControl(app, 'Out', end); } catch { /* suppressed */ }
  stateOf(app).out[C] = { StartFrame: start, EndFrame: end };
}

// ------------------------------------------------------------------ rig callbacks
function contextParam(ctx: any, name: string): any {
  const c = valueOf(ctx); const ps = c?.Parameters ?? c?.parameters ?? c;
  let p: any;
  if (typeof ps === 'function') p = ps(name);
  else if (ps && typeof ps.get === 'function') p = ps.get(name);
  else if (ps && typeof ps.Item === 'function') p = ps.Item(name);
  else p = ps?.[name];
  return Number(p && typeof p === 'object' ? (p.Value ?? p.value) : p);
}
/** Position of the point named by the first element of a single-point cluster. */
function clusterPointPosition(app: App, mesh: any, input: any): [number, number, number] {
  const c = valueOf(input);
  if (!(c instanceof Cluster) && !(c && typeof c === 'object' && (Array.isArray(c.elements) || c.elements instanceof Set || Array.isArray(c.Elements)))) {
    app.logMsg('info', `Expected cluster, got ${typeName(c)}`);
    return [0, 0, 0];   // inferred: the callback carries on with an empty position
  }
  const first = Number([...(c.elements ?? c.Elements)][0]);
  const g = valueOf(mesh); const prim = g instanceof X3DObject ? g.primitive : g;
  const pos: ArrayLike<number> | undefined = prim?.mesh?.()?.positions ?? prim?.positions ?? prim?.Geometry?.Points;
  if (!pos || !(first >= 0) || first * 3 + 2 >= pos.length) return [0, 0, 0];
  return [Number(pos[first * 3]), Number(pos[first * 3 + 1]), Number(pos[first * 3 + 2])];
}

// ================================================================== registration
export function registerUixsiPrefsIceViewsCommands(app: App) {
  const state: UixsiPrefsIceViewsState = {
    prefs: new PrefStore(app), viewManager: makeViewManager(app), views: layoutViews, netViews: [], out: {}, lastInspectPreferences: null,
    transformFilter: { ...TRANSFORM_FILTER },
    variants: {
      'Save Pivot Key on Scl': { command: 'SavePivotKey', args: { Type: ':siScl:siTransformFilter' } },
      'Save Pivot Key on Rot': { command: 'SavePivotKey', args: { Type: ':siRot:siTransformFilter' } },
      'Save Pivot Key on Pos': { command: 'SavePivotKey', args: { Type: ':siTrn:siTransformFilter' } },
      'Switch to Panel Weight': { command: 'SwitchToViewByType', args: { ViewType: 'Weight Paint Panel' } },
      'Switch to Panel Toolbar': { command: 'SwitchToViewByType', args: { ViewType: 'Toolbar Panel' } },
      'Switch to Panel Palette': { command: 'SwitchToViewByType', args: { ViewType: 'Palettes' } },
    },
    runVariant(label) { const v = state.variants[label]; if (!v) throw new Error(`No registry entry "${label}"`); return app.run(v.command, { ...v.args }); },
  };
  (app as any).uixsiPrefsIceViews = state;
  const reg = (def: CommandDef) => app.register(def);
  const pref = (name: string) => state.prefs.get(`output_format.${name}`);

  // ---------------------------------------------------------------- preferences: import / export / restore / inspect
  const FILTER = 'xsipref (*.xsipref)|*.xsipref|All Files (*.*)|*.*||';
  reg({
    name: 'ImportPreferences', label: 'Import Preferences', category: 'file', description: 'Import Preferences',
    args: [{ name: 'FileName', default: '' }], undoable: false,
    execute(app, a) {
      const run = (file: string) => {
        state.out.ImportPreferences = { FileName: file };
        if (file === '') { logNya(app, 'ImportPreferences', 'Preferences.Import with an empty file name; nothing was imported', 'Q3'); return; }
        state.prefs.import(file);
      };
      if (interactive(app) && unset(a.FileName)) {
        return browseFile({ title: 'Import a Category of Preferences', filter: FILTER, initialDirectory: 'c:\\', save: false, baseName: '' }).then((file) => {
          if (file === '') throw new Cancelled('ImportPreferences');
          run(file);
        });
      }
      run(String(a.FileName ?? ''));
    },
  });
  reg({
    name: 'ExportPreferences', label: 'Export Preferences', category: 'file', description: 'Export Preferences',
    args: [{ name: 'FileName', default: '' }, { name: 'Categories', default: '' }], undoable: false,
    execute(app, a) {
      const run = (file: string) => {
        state.out.ExportPreferences = { FileName: file };
        if (file === '') { logNya(app, 'ExportPreferences', 'Preferences.Export with an empty file name; nothing was exported', 'Q3'); return; }
        const r = state.prefs.export(file, a.Categories);
        if (r.unknown.length) logNya(app, 'ExportPreferences', `categor${r.unknown.length === 1 ? 'y' : 'ies'} ${r.unknown.join(', ')} not known to this build; the form of the Categories string is the object model method's`, 'Q3');
      };
      if (interactive(app) && unset(a.FileName)) {
        return browseFile({ title: 'Export a Category of Preferences', filter: FILTER, initialDirectory: 'c:\\', save: true, baseName: String(a.Categories ?? '') }).then((file) => {
          if (file === '') throw new Cancelled('ExportPreferences');
          run(file);
        });
      }
      run(String(a.FileName ?? ''));
    },
  });
  reg({
    name: 'RestoreDefaultPreference', label: 'Restore Default Preference', category: 'file', description: 'Restore the default preference values on a category or one preference',
    args: [{ name: 'PreferenceName', default: '' }], undoable: false,
    execute(app, a) {
      if (state.prefs.restoreDefault(a.PreferenceName) < 0) logNya(app, 'RestoreDefaultPreference', `Preferences.RestoreDefault "${String(a.PreferenceName ?? '')}" (not a category or preference of this build); nothing was restored`, 'Q3');
    },
  });
  reg({
    name: 'InspectPreferences', label: 'Inspect Preferences', category: 'Viewing', description: '',
    args: [{ name: 'Preference', default: '' }], undoable: false,
    execute(app, a) {
      const p = String(a.Preference ?? '');
      const select = p === '' ? null : p.includes('.') ? p : `Preferences.${p}`;
      const d = delegate(app, OPEN_XSI_EXPLORER, { Scope: 'siExplorerScopeCustom', Viewer: 'Property Editor', InputObjs: 'Preferences', ShowToolbar: false, Title: 'Preferences', Reuse: false });
      if (d.done) {
        const ex = d.result?.Views?.('explorer') ?? d.result?.views?.explorer;
        ex?.SetAttributeValue?.('localselection', 'true'); ex?.SetAttributeValue?.('FilterMask', 'siSEFilterPropertyNodes');
        if (select) ex?.SetAttributeValue?.('select', select);
        state.lastInspectPreferences = { select, page: null };
        return;
      }
      // inferred stand-in: this build's Preferences window (category list on the left, property page on the right).
      // It is one window that is reused; Softimage opens a new one on every call.
      const hit = select ? state.prefs.resolve(select.split('.').slice(0, 2).join('.')) : null;
      state.lastInspectPreferences = { select, page: hit?.key ?? null };
      preferencesWindow(app, hit?.key);
    },
  });

  // ---------------------------------------------------------------- SIUpdate...FromGlobalPref
  reg({
    name: 'SIUpdateCamerasFromGlobalPref', label: 'Update Cameras', category: 'Camera|Preferences', description: 'Update cameras based on the global preference settings',
    args: [{ name: 'InputObjs', default: '{F1D7703B-083A-42B9-841D-49FE3779CECD}' }],
    execute(app, a) {
      const cams = (nothingGiven(a.InputObjs) ? [...app.scene.allObjects()] : objs(app, a.InputObjs)).filter(isCamera);
      if (!cams.length) return;
      const std = pref('picture_standard'), ratio = pref('picture_ratio'), pixel = pref('roto_pixel_ratio');
      for (const cam of cams) {
        if (cam.parentObj === cam) continue;   // a camera that is its own parent is skipped
        // aspect and pixel ratio first, the standard last: it has to end on the preference value
        setIf(app, cam.primitive, 'aspect', ratio); setIf(app, cam.primitive, 'pixelratio', pixel); setIf(app, cam.primitive, 'std', std);
      }
    },
  });
  reg({
    name: 'SIUpdateFxTreesFromGlobalPref', label: 'Update FxTrees', category: 'Preferences', description: 'Update FxTrees based on the global preference settings',
    args: [{ name: 'InputObjs', default: '{F1D7703B-083A-42B9-841D-49FE3779CECD}' }],
    execute(app, a) {
      let list: Node[];
      if (nothingGiven(a.InputObjs)) {
        list = app.scene.root.properties.filter(p => p.type === 'FxTree');
        for (const m of app.scene.allObjects()) if (m instanceof Model) list.push(...m.properties.filter(p => p.type === 'FxTree'));
      } else list = nodes(app, a.InputObjs);
      const x = pref('ir_xres'), y = pref('ir_yres'), pixel = pref('ir_pixel_ratio');
      for (const t of list) {
        if (t.type !== 'FxTree') continue;
        setIf(app, t, 'DefaultWidth', x); setIf(app, t, 'DefaultHeight', y); setIf(app, t, 'PixelRatio', pixel);
      }
    },
  });
  reg({
    name: 'SIUpdatePlayControlFromGlobalPref', label: 'Update PlayControl', category: 'Preferences', description: 'Update PlayControl based on the global preference settings',
    args: [],
    execute(app) {
      const step = pref('frame_step'), format = pref('frame_format'), rate = pref('frame_rate');
      setPlayControl(app, 'Step', step); setPlayControl(app, 'Rate', rate); setPlayControl(app, 'Format', format);
    },
  });

  // ---------------------------------------------------------------- ICE trees
  const treeArg = (app: App, x: any): Node | undefined => { const v = Array.isArray(x) ? x[0] : x; return v instanceof Node ? v : findNode(app, v); };
  reg({
    name: 'MakeICETreeBranch', label: 'MakeICETreeBranch', category: 'Simulation', description: '',
    args: [{ name: 'Operator', default: null }],
    execute(app, a) {
      const op = treeArg(app, a.Operator);
      if (!isTree(op)) return;   // any other operator type: nothing, no message
      const host = treeHost(op); if (!host) return;
      transferTree(app, 'MakeICETreeBranch', op, host, 0, true);
    },
  });
  reg({
    name: 'PromoteICETree', label: 'PromoteICETree', category: 'Simulation', description: '',
    args: [{ name: 'Operator', default: null }],
    execute(app, a) {
      const op = treeArg(app, a.Operator);
      const host = op ? (isTree(op) ? treeHost(op) : ownerObject(op)) : null;
      const target = host?.parentObj ?? null;
      if (!target || target === app.scene.root) return;   // already directly under the scene root
      if (!isTree(op)) return;
      transferTree(app, 'PromoteICETree', op, target, 0, true);
    },
  });

  // ---------------------------------------------------------------- point clouds
  reg({
    name: 'GroupPointClouds', label: 'GroupPointClouds', category: 'Simulation', description: '',
    args: [{ name: 'InputObjs', default: null }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }],
    execute(app, a) {
      try {
        const list = filteredObjects(app, a.InputObjs); if (!list.length) return undefined;
        const clouds = list.filter(isCloud); if (clouds.length < 2) return undefined;
        const given = unset(a.Parent) ? null : a.Parent instanceof X3DObject ? a.Parent : findObject(app, String(a.Parent)) ?? null;
        const parent = given ?? clouds[0].parentObj ?? app.scene.root;
        const n = newNull(app, String(a.Name ?? ''), parent);
        for (const c of clouds) reparent(app, c, n);
        app.select([n]); inspectLater(app, n);
        return n;
      } catch { return undefined; }   // all errors inside the procedure are suppressed
    },
  });
  reg({
    name: 'SplitCloud', label: 'SplitCloud', category: 'Simulation', description: '',
    args: [{ name: 'InputObj', default: null }, { name: 'Name', default: '' }],
    execute(app, a) {
      let last: X3DObject | undefined;
      try {
        const name = unset(a.Name) ? 'Effect' : String(a.Name);
        const trees: ICETreeOperator[] = [];   // not cleared between clouds
        for (const cloud of filteredObjects(app, a.InputObj)) {
          if (!isCloud(cloud)) continue;
          for (const op of cloud.primitive?.operators ?? []) if (isTree(op) && !trees.includes(op)) trees.push(op);
          const n = newNull(app, name, cloud.parentObj ?? app.scene.root);
          app.select([n]);   // the scripted creator selects what it makes
          reparent(app, cloud, n);
          for (const t of trees) transferTree(app, 'SplitCloud', t, n, 0, true);
          const made = app.run('SIDuplicate', { InputObjs: cloud, NbItems: 1, Hierarchy: 'siNoParent' });
          const copy: X3DObject | undefined = Array.isArray(made) ? made[0] : made;
          // The copy is made after the trees left the cloud, so it carries none.
          const prim = copy?.primitive;
          if (prim) {
            const own = prim.operators.filter(isTree);
            if (own.length) { const before = [...prim.operators]; app.record('Remove ICE trees', () => { prim.operators.splice(0, prim.operators.length, ...before.filter(o => !own.includes(o as any))); prim.dirty = true; }, () => { prim.operators.splice(0, prim.operators.length, ...before); prim.dirty = true; }); }
          }
          logNya(app, 'SplitCloud', `where the copy${copy ? ` ${copy.name}` : ''} lands and how the branch trees of ${n.name} drive it`, 'Q5');
          last = n;
        }
        if (last) { app.select([last]); inspectLater(app, last); }
      } catch { /* errors are suppressed */ }
      return last;
    },
  });

  // ---------------------------------------------------------------- views
  reg({
    name: 'SwitchToView', label: 'Switch to View', category: 'Views', description: 'Makes the given view visible if it\'s hidden',
    args: [{ name: 'ViewName', default: '' }], undoable: false,
    execute(_app, a) { const v = layoutViews().find(x => x.name === String(a.ViewName ?? '')); if (v) v.show(); },
  });
  reg({
    name: 'SwitchToViewByType', label: 'Switch to View by Type', category: 'Views', description: 'Makes the first view of given type visible if it\'s hidden',
    args: [{ name: 'ViewType', default: '' }], undoable: false,
    execute(_app, a) { const v = layoutViews().find(x => x.type === String(a.ViewType ?? '')); if (v) v.show(); },
  });
  reg({
    name: 'GetViewportUnderMouse', label: 'Get Viewport Under Mouse', category: 'Viewing', description: 'Returns the view pane underneath the mouse (or last if mouse not over view manager)',
    args: [], undoable: false, noLog: true,
    execute() {
      // inferred (Q1): the shared handler is given the attribute name "viewportundermouse"
      if (!state.viewManager.present()) return undefined;
      const v = state.viewManager.get('viewportundermouse');
      return typeof v === 'string' ? v : undefined;
    },
  });
  reg({
    name: 'SetFocusedViewport', label: 'Set Focused Viewport', category: 'Viewing', description: 'Sets the view pane in the view manager which has the focus',
    args: [{ name: 'Viewport', default: '' }], undoable: false,
    execute(_app, a) {
      if (!state.viewManager.present()) throw new Error('SetFocusedViewport: the active layout has no View Manager');   // inferred: a script error in Softimage
      state.viewManager.set('focusedviewport', String(a.Viewport ?? ''));
    },
  });
  reg({
    name: 'SetCameraSequencerLayout', label: 'Reset Camera Sequencer Layout', category: 'Viewing | Camera Sequencer', description: 'Reset Camera Sequencer Layout',
    args: [
      { name: 'EditorViewportID', default: ':siViewportA:siViewport' }, { name: 'SequencerCameraViewportID', default: ':siViewportB:siViewport' },
      { name: 'CameraEditingViewportID', default: ':siViewportC:siViewport' }, { name: 'UserViewportID', default: ':siViewportD:siViewport' },
    ],
    undoable: false,
    execute(app, a) {
      const C = 'SetCameraSequencerLayout';
      if (!interactive(app)) return;
      // 1.
      if (currentLayoutName() !== 'Camera Sequencer') {
        logNya(app, C, layoutByName('Camera Sequencer') ? 'switching to the "Camera Sequencer" layout (a layout switch restarts this build); the current layout is kept' : 'this build has no layout named "Camera Sequencer"; the current layout is kept');
      }
      const vm = state.viewManager;
      if (!vm.present()) throw new Error(`${C}: the active layout has no View Manager`);   // inferred: a script error in Softimage
      // 2.
      const editor = viewportLetter(vm, a.EditorViewportID), seq = viewportLetter(vm, a.SequencerCameraViewportID);
      const editing = viewportLetter(vm, a.CameraEditingViewportID), user = viewportLetter(vm, a.UserViewportID);
      // 3.
      vm.set('suspenddrawing', 'true');
      try {
        vm.set('layout', 'alternate'); vm.set('layout', 'reset');
        if (!vm.set(`viewport:${editor}`, 'Camera Sequencer Editor')) logNya(app, C, `the Camera Sequencer Editor view (not part of this build); pane ${editor} keeps its view`);
        // The built-in sequencer camera of the pane (Views.View<pane>.sequencercamera): this build has no such object.
        if (findNode(app, `Views.View${seq}.sequencercamera`)) vm.set(`activecamera:${seq}`, 'sequencercamera');
        const cams = renderableCameras(app);
        const frame = Number(getPlayControl(app, 'Current'));   // inferred: the sequencer frame is the one timeline value of this build
        const shot = shotClipAt(app, frame);
        if (shot.camera) vm.set(`activecamera:${editing}`, scriptName(shot.camera));
        else if (cams.length) vm.set(`activecamera:${editing}`, scriptName(cams[0]));
        if (cams.length) vm.set(`activecamera:${user}`, 'User');
        vm.set('focusedviewport', 'd');   // fixed: it does not follow UserViewportID
      } finally { vm.set('suspenddrawing', 'false'); }
    },
  });
  reg({
    name: 'PlotCameraSequencer', label: 'Plot Camera Sequencer', category: 'Camera Sequencer', description: 'Plot the whole Camera Sequencer',
    args: [
      { name: 'StartFrame', default: 1.0 }, { name: 'EndFrame', default: 100.0 }, { name: 'PlotWithoutGaps', default: false },
      { name: 'SequencerCameraName', default: 'SequencerCamera_Plot' }, { name: 'ApplyToCamera', default: true }, { name: 'Apply', default: true },   // Apply is unused
    ],
    execute(app, a) { plotCameraSequencer(app, a); },
  });

  // ---------------------------------------------------------------- rig update callbacks
  reg({
    name: 'ManCharacterOnUpdate', label: 'Man Character update', category: '', description: '',
    args: [{ name: 'UpdateContext', default: null }, { name: 'InMesh', default: null }, { name: 'InOuter', default: null }, { name: 'InUpper', default: null }, { name: 'Out', default: null }],
    undoable: false, noLog: true,
    execute(app, a) {
      const p = clusterPointPosition(app, a.InMesh, a.InOuter), q = clusterPointPosition(app, a.InMesh, a.InUpper);
      // as shipped: absolute differences, not squares, and Z is ignored
      const d = Math.sqrt(Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]));
      const s = d / contextParam(a.UpdateContext, 'Eye_scaling_factor') + 0.005;
      const out = valueOf(a.Out);
      for (const n of ['sclx', 'scly', 'sclz']) {
        if (out && typeof out.get === 'function' && out.get(n)) out.get(n).value = s;
        else if (out && typeof out === 'object') out[n] = s;
      }
    },
  });
  reg({
    name: 'BipedRigOnUpdate', label: 'Biped Rig update', category: '', description: '',
    args: [{ name: 'UpdateContext', default: null }, { name: 'InHandle', default: null }, { name: 'Out', default: null }],
    undoable: false, noLog: true,
    execute(_app, a) {
      const h = Number(valueOf(a.InHandle)); const S = contextParam(a.UpdateContext, 'SteppingAngle');
      const out = a.Out; const port = String(out?.Name ?? out?.name ?? '');
      let v: number;
      if (port === 'heel_out') v = h <= 0 ? h : 0;
      else if (port === 'toe_out') v = h >= S ? h - S : 0;
      else if (port === 'mid_out') v = h <= 0 ? 0 : h < S ? h : S;
      else return;   // any other port: the output is not written
      if (out && typeof out === 'object') out.Value = v;
    },
  });

  // ---------------------------------------------------------------- HTML pages
  const page = (app: App, command: string, file: string, reuse: boolean) => { openNetView(app, state.netViews, command, `${factoryPath(app)}/Application/views/html/${file}`, reuse, 1); };
  reg({ name: 'InfoGeometry', label: 'Info Geometry', category: 'General', description: 'Opens Info Geometry HTML Page', args: [], undoable: false, execute(app) { page(app, 'InfoGeometry', 'InfoGeometry.htm', false); } });
  reg({ name: 'ParamBracketing', label: 'Parameter Bracketing', category: 'General', description: 'Opens Parameter Bracketing HTML Page', args: [], undoable: false, execute(app) { page(app, 'ParamBracketing', 'ParamBracketing.htm', false); } });
  reg({
    name: 'InspectLocks', label: 'InspectLocks', category: 'General', description: 'Inspect Locks',
    args: [{ name: 'InputObj', default: null }], undoable: false,
    execute(app, a) {
      try {
        const list = nodes(app, a.InputObj);
        // AddToSelection <InputObj>: the page reports on the selection. Only nodes that are not selected yet are
        // handed on: App.select(..., 'add') toggles when it meets a node that is already selected.
        const add = list.filter(n => !app.selection.includes(n));
        if (add.length) app.select(add, 'add');
        page(app, 'InspectLocks', 'InfoLocks.htm', true);
      } catch { /* errors are suppressed */ }
    },
  });

  // ---------------------------------------------------------------- RenamePropAndRebind
  const propsOf = (app: App, arg: any): Property[] => nodes(app, arg).filter((n): n is Property => n instanceof Property);
  function renamePropAndRebind(app: App, a: Record<string, any>): void | Promise<void> {
    const props = propsOf(app, a.Properties);
    let newName = String(a.NewName ?? ''); let updateRefs = boolArg(a.UpdateRefs), updateWildcards = boolArg(a.UpdateWildcards);
    if (!boolArg(a.ShowUI)) { renameAndRebind(app, props, newName, updateRefs, updateWildcards); return; }
    if (newName === '') newName = props[0]?.name ?? '';
    // The dialog property (preset RenamePropertyDialog, named Rename, on the scene root). inferred (Q8): parameter types and labels.
    // The wildcard check box is primed with an empty value, not with the argument.
    const dlg = new Property('Rename', 'RenamePropertyDialog', [str('newname', newName, 'New Name'), bool('updaterefs', updateRefs, 'Update References'), bool('updatewildcards', false, 'Update Wildcards')]);
    const root = app.scene.root; root.addProperty(dlg);
    const drop = () => { root.removeProperty(dlg); app.events.emit('scene'); };
    const title = props.length > 1 ? 'Rename multiple properties' : `Rename ${newName}`;
    if (!interactive(app)) { drop(); logNya(app, 'RenamePropAndRebind', 'the modal property page needs a user session; treated as Cancel'); throw new Cancelled('RenamePropAndRebind'); }
    return sdkModal(title, (body) => renderSdkLayout(body, dlg, [{ param: 'newname' }, { param: 'updaterefs' }, { param: 'updatewildcards' }]), { cls: 'uixsi-renameprop' }).then((ok) => {
      if (!ok) { drop(); throw new Cancelled('RenamePropAndRebind'); }
      newName = String(dlg.val('newname') ?? ''); updateRefs = !!dlg.val('updaterefs'); updateWildcards = !!dlg.val('updatewildcards');
      state.out.RenamePropAndRebind = { NewName: newName, UpdateRefs: updateRefs, UpdateWildcards: updateWildcards };
      drop();
      renameAndRebind(app, props, newName, updateRefs, updateWildcards);
      app.events.emit('scene');
    });
  }
  reg({
    name: 'RenamePropAndRebind', label: 'RenamePropAndRebind', category: '', description: '',
    args: [{ name: 'Properties', default: null }, { name: 'NewName', default: '' }, { name: 'UpdateRefs', default: true }, { name: 'UpdateWildcards', default: false }, { name: 'ShowUI', default: false }],
    execute(app, a) { return renamePropAndRebind(app, a); },
  });
  reg({
    name: 'RenamePropAndRebindUI', label: 'RenamePropAndRebindUI', category: '', description: '',
    args: [{ name: 'Properties', default: null }, { name: 'NewName', default: '' }, { name: 'UpdateRefs', default: true }, { name: 'UpdateWildcards', default: false }],
    execute(app, a) {
      const r = app.run('RenamePropAndRebind', { Properties: a.Properties, NewName: a.NewName, UpdateRefs: a.UpdateRefs, UpdateWildcards: a.UpdateWildcards, ShowUI: true });
      return r && typeof r.then === 'function' ? r.then(() => { state.out.RenamePropAndRebindUI = { ...state.out.RenamePropAndRebind }; }) : r;
    },
  });

  // ---------------------------------------------------------------- SavePivotKey
  const PIVOT_GROUPS: { tests: string[]; params: string[] }[] = [
    { tests: ['siScl', 'siSRT', 'siSR', 'siST'], params: ['psclx', 'pscly', 'psclz', 'pcsclx', 'pcscly', 'pcsclz'] },
    { tests: ['siRot', 'siSRT', 'siSR', 'siRT'], params: ['protx', 'proty', 'protz', 'pcrotx', 'pcroty', 'pcrotz'] },
    { tests: ['siTrn', 'siSRT', 'siST', 'siRT'], params: ['pposx', 'pposy', 'pposz', 'pcposx', 'pcposy', 'pcposz'] },
  ];
  reg({
    // The generic registry entry ("Save Pivot Key", siSRT); the Scl / Rot / Pos entries are `variants`.
    name: 'SavePivotKey', label: 'Save Pivot Key', category: 'Animation', description: 'Save pivot key on object',
    args: [{ name: 'InputObjs', default: null }, { name: 'Type', default: ':siSRT:siTransformFilter' }, { name: 'Time', default: null }],
    execute(app, a) {
      const K = Number(getPlayControl(app, 'Key'));
      const F = state.transformFilter; const c = siConst(a.Type);
      let type = typeof c === 'number' ? c : F[String(c)] ?? 0;
      if (type === 0) type = F.siSRT;
      const missing = new Set<string>();
      for (const o of objs(app, a.InputObjs)) for (const g of PIVOT_GROUPS) {
        if (!g.tests.some(t => (type & F[t]) !== 0)) continue;   // "any common bit", not equality
        for (const name of g.params) {
          const p = o.kinematics.local.get(name); const path = `${o.fullName}.kine.local.${name}`;
          if (!p) { missing.add(name); continue; }
          if (app.anim.expression(p) !== undefined) { logWarning(app, `Cannot save key, Expression on ${path}`); continue; }   // a source that is not an fcurve
          // SaveKey <parameter>, K, <current value>, then the whole curve becomes a stepped curve.
          // inferred: written to the curve directly, the bus SaveKey resolves keyable transform parameters only.
          const had = app.anim.fcurve(p); const before: { keys: Key[]; interp: number } | null = had ? { keys: had.keys.map(k => ({ ...k })), interp: had.interp } : null;
          const value = Number(p.value);
          app.record('Save pivot key ' + name, () => {
            const fc = app.anim.fcurve(p, true)!; fc.addKey(K, value);
            fc.interp = SI_KEY_INTERP_CONSTANT; for (const k of fc.keys) k.interp = SI_KEY_INTERP_CONSTANT;
          }, () => {
            if (!before) app.anim.removeAnimation(p); else { const fc = app.anim.fcurve(p, true)!; fc.keys = before.keys.map(k => ({ ...k })); fc.interp = before.interp; }
          });
        }
      }
      if (missing.size) logNya(app, 'SavePivotKey', `local kinematics parameter(s) ${[...missing].join(', ')} (not part of this build's kinematics); no key saved on them`);
      state.out.SavePivotKey = { Time: K };
      if (unset(a.Time) || Number(a.Time) !== K) setPlayControl(app, 'Current', K);
      app.events.emit('params');
    },
  });

  // ---------------------------------------------------------------- TransferShapeAnimation
  reg({
    name: 'TransferShapeAnimation', label: 'Transfer Shape Animation', category: 'Animation|Deformation', description: '',
    args: [{ name: 'SourceObject', default: null }, { name: 'DestinationObject', default: null }, { name: 'SourceShapeKeys', default: null }, { name: 'DestinationShapeKeys', default: null }],
    execute(app, a) {
      const C = 'TransferShapeAnimation'; const fail = (text: string) => { app.logMsg('error', `${C}: ${text}`); };
      const obj = (x: any) => x instanceof X3DObject ? x : typeof x === 'string' && x ? findObject(app, x) ?? null : null;
      const src = obj(a.SourceObject), dst = obj(a.DestinationObject);
      if (src === dst) { fail('the destination needs to be different than the target.'); return; }
      const S = a.SourceShapeKeys, D = a.DestinationShapeKeys;
      if (!Array.isArray(S) || !Array.isArray(D)) return;   // a shape list that is not a collection: silent return
      // Unique is switched on on both collections (the caller's lists lose their duplicates)
      for (const l of [S, D]) { const u = [...new Set(l)]; l.splice(0, l.length, ...u); }
      if (S.length !== D.length) { fail('you need to provide the same amount of shapes.'); return; }
      const key = (x: any) => { const n = x instanceof Node ? x : findNode(app, x); return isShapeKey(n) ? n : null; };
      const sk = S.map(key), dk = D.map(key);
      for (const k of sk) {
        if (!k) { fail('origin shapes needs to be shape key.'); return; }
        if (ownerObject(k) !== src) { fail('origin shapes needs to be shapes nested under the origin object.'); return; }
      }
      for (const k of dk) {
        if (!k) { fail('destination shapes needs to be shape key.'); return; }
        if (ownerObject(k) !== dst) { fail('destination shapes needs to be shapes nested under the destination object.'); return; }
      }
      if (delegate(app, SI_TRANSFER_SHAPE, { SourceObject: a.SourceObject, DestinationObject: a.DestinationObject, SourceShapeKeys: S, DestinationShapeKeys: D }).done) return;   // the same four arguments
      // inferred stand-in: shapes are paired by position; the weight curve (or value) of each source key goes to its destination key.
      sk.forEach((s, i) => {
        const from = s!.get('weight'), to = dk[i]!.get('weight'); if (!from || !to) return;
        const fc = app.anim.fcurve(from); const had = app.anim.fcurve(to);
        const before = had ? { keys: had.keys.map(k => ({ ...k })), interp: had.interp } : null; const oldValue = to.value;
        app.record('Transfer shape animation', () => {
          if (fc?.keys.length) { const t = app.anim.fcurve(to, true)!; t.keys = fc.keys.map(k => ({ ...k })); t.interp = fc.interp; t.extrap = fc.extrap; }
          else app.anim.removeAnimation(to);
          to.value = from.value;
        }, () => {
          if (before) { const t = app.anim.fcurve(to, true)!; t.keys = before.keys; t.interp = before.interp; } else app.anim.removeAnimation(to);
          to.value = oldValue;
        });
      });
      logNya(app, C, `the transfer is the C++ command's; the weight animation of ${sk.length} shape key(s) was copied by position`);
    },
  });

  // ---------------------------------------------------------------- GetShaderOnCnxPointFunction
  reg({
    name: 'GetShaderOnCnxPointFunction', label: '', category: 'Rendering', description: '',
    args: [{ name: 'InputObj', default: null }], undoable: false, noLog: true,
    execute(app, a) {
      const d = delegate(app, SI_SHADER_ON_CNX, { InputObj: a.InputObj });
      if (d.done) return d.result;
      const x = Array.isArray(a.InputObj) ? a.InputObj[0] : a.InputObj;
      return shaderOnCnxPoint(app, x);   // inferred stand-in for the C++ query
    },
  });

  // ---------------------------------------------------------------- LockEnvelopeDeformerWeights (SPEC-PARTIAL, Q7)
  reg({
    name: 'LockEnvelopeDeformerWeights', label: 'Lock Envelope Deformer Weights', category: 'Deformation', description: 'Lock envelope weights for given deformers',
    args: [{ name: 'PropObj', default: null }, { name: 'Deformers', default: null }, { name: 'Locked', default: true }],
    execute(app, a) {
      const C = 'LockEnvelopeDeformerWeights';
      // The script procedure does not exist (its only occurrence is commented out); the live behaviour is the C++ entry's.
      // inferred stand-in: the lock state is kept per deformer on the envelope of the given weight property / object.
      const given = unset(a.PropObj) ? app.selection[0] : a.PropObj instanceof Node ? a.PropObj : findNode(app, Array.isArray(a.PropObj) ? a.PropObj[0] : a.PropObj);
      const owner = given instanceof X3DObject ? given : ownerObject(given);
      const env = owner ? envelopeOf(owner) : null;
      if (!env) { logNya(app, C, 'no envelope on the given weight property; nothing locked', 'Q7'); return undefined; }
      const deformers = unset(a.Deformers) ? [] : objs(app, a.Deformers).filter(d => env.deformers.includes(d));
      if (!deformers.length) { logNya(app, C, 'no deformer of the envelope given (the pick session of the unused script block is not live behaviour); nothing locked', 'Q7'); return undefined; }
      const e: any = env; const old: X3DObject[] = [...(e.lockedDeformers ?? [])]; const next = new Set<X3DObject>(old);
      for (const d of deformers) { if (boolArg(a.Locked)) next.add(d); else next.delete(d); }
      app.record('Lock deformer weights', () => { e.lockedDeformers = new Set(next); }, () => { e.lockedDeformers = new Set(old); });
      logNya(app, C, `the C++ command (lock storage, effect on weight editing, return value); the lock flag of ${deformers.length} deformer(s) was ${boolArg(a.Locked) ? 'set' : 'cleared'} on ${owner!.name}'s envelope`, 'Q7');
      return undefined;
    },
  });
  void NOTE;
}
