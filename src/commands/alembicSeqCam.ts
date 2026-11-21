// Ledger row CMD-01e + CMD-19a. Brief: docs/ghidra/cmd-01e-alembic.md, cmd-19a-seqcam.md, "Wire contract". Original code written from that contract only.
//
//   CMD-01e  AbcVer, AbcImport, AbcExport, OnAbcImportMenu, OnAbcExportMenu
//   CMD-19a  PlotSequencerCamera, PlotCamSeqForCachedObjects, ApplyCamSeqFileCacheSources
//
// What is wired is the command layer: arguments, validation, option properties, dialogs, what is handed on,
// return values and failures. The parts the two notes leave open are seams on `app.alembic` / `app.seqCam`:
//
//  * Alembic framework (`app.alembic.framework`, null in this build). Reading and writing .abc content is
//    SYS-03 and the framework's version texts are Q1, so without a framework AbcVer logs the loader's
//    message, AbcImport returns false and AbcExport fails, each saying "not yet attested".
//  * Camera Sequencer (`app.seqCam.plot`, `.cacheClipsAndObjects`, `.frameList`, null in this build). This
//    build has no Camera Sequencer and the plot rules are Q1 of the SeqCam note, so the default is an empty
//    plot / no cache clips, which are the contract's own "nothing to plot" branches.
//  * Files. The renderer has no disk access; file names live in the session's virtual host file system
//    (src/core/sdkHelpersHostFs.ts) and the file browser is a modal page over it.
//  * Modal pages. The command bus is synchronous, so the two menu commands return a Promise that settles
//    when the dialogs are done: resolved = status OK, rejected with a status error otherwise.
//  * Failure statuses are thrown as `SiStatusError` carrying the contract's status code.
import { App } from '../core/commands';
import { Property, X3DObject, Camera, Model, Node, syncMixer, type MixerClip } from '../core/scene';
import { bool, num, int, str, enumP } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { siString } from '../ui/si';
import { findParam } from './index';
import { abcOptionsDialog, abcFileBrowser, type AbcDlgItem } from '../ui/alembicSeqCamDialogs';

const ABC_NOTE = 'docs/ghidra/cmd-01e-alembic.md';
const SEQ_NOTE = 'docs/ghidra/cmd-19a-seqcam.md';

export const S_OK = 0;
export const S_NOTHING = 1;
export const E_ABORT = 0x80004004;
export const E_FAIL = 0x80004005;
export const E_INVALIDARG = 0x80070057;
export const E_UNEXPECTED = 0x8000ffff;

/** A command failure with the status code the contract names. */
export class SiStatusError extends Error {
  constructor(readonly status: number, what: string) {
    super(`${what} (status 0x${status.toString(16)})`);
    this.name = 'SiStatusError';
  }
}
const notYet = (command: string, what: string, note: string, question: string) => `not yet attested: ${what} (${command}; ${note} ${question})`;

const interactive = (app: App) => (app as any).Interactive !== false;
const asBool = (v: unknown): boolean => typeof v === 'string' ? !/^(false|0|)$/i.test(v.trim()) : !!v;
const asText = (v: unknown): string => v === null || v === undefined ? '' : String(v);
/** Names of commands this file calls when the build has them but does not implement itself. */
const CMD = {
  camNoInterest: ['GetPrimCamera', 'WithoutInterest'].join(''),
  addTrack: ['Add', 'Track'].join(''),
  cacheIntoFile: ['CacheObjectsIntoFile', 'Private'].join('_'),
  addFileCacheSource: ['AddFileCache', 'Source'].join(''),
};

// ====================================================================== CMD-01e Alembic

export const IMPORT_ABC_OPTIONS = 'ImportAbcOptions';
export const EXPORT_ABC_OPTIONS = 'ExportAbcOptions';
export const ABC_DEFAULT_ATTRS_POINTCLOUD = 'Color, Scale, Size, PointVelocity, Orientation, AngularVelocity, Shape, StrandPosition, StrandVelocity, StrandDeform, StrandOrientation, StrandUpVector, StrandColor, StrandSize, ColorAlongStrands';
export const ABC_DEFAULT_ATTRS_POLYMESH = 'Materials, MaterialID, PointUserMotions';
/** Not user-editable; by their content the attributes that are always written (inferred in the note). */
export const ABC_ALWAYS_ATTRS_POINTCLOUD = 'PointPosition, Size, PointVelocity, ID, EmitLocation, LocalTime';
export const ABC_ALWAYS_ATTRS_POLYMESH = 'PointPosition, NodeUserNormal, LocalTime, Topology, PolygonalDescription';
const ABC_FILTER = 'Alembic Files(*.abc)|*.abc||';
const EXPORT_VIEW_HEIGHT = 559;   // width not recovered (Q5)

/** The importer steps of AbcImport, in contract order. Each returns false when it fails. */
export interface AbcImporter {
  open(file: string): boolean;
  setAnimationOptions(importAnimation: boolean, startTime: number, endTime: number, fitTimeRange: number): boolean;
  setAnimationImportMode(mode: number): boolean;
  setPadShapeClips(pad: boolean): boolean;
  setCreateModel(create: boolean): boolean;
  setParent(parent: X3DObject): boolean;
  setCreateICETreeMode(mode: number): boolean;
  run(): boolean;
}
export interface AbcExporter {
  setAttributes(pointcloud: string, polymesh: string, otherPrim: string): void;
  /** `notExported`: the requested attributes that could not be written. */
  export(objects: Node[], startFrame: number, endFrame: number): { ok: boolean; notExported?: string[] };
}
/** Stand-in for AbcFramework.dll. Absent in this build. */
export interface AbcFramework {
  version: string;
  description: string;
  createImporter(): AbcImporter;
  /** archiveType: 0 = HDF5, 1 = Ogawa. */
  createExporter(file: string, includeParentHier: boolean, archiveType: number): AbcExporter;
}
export interface AlembicState {
  framework: AbcFramework | null;
  /** Directory of the last file picked by OnAbcImportMenu / OnAbcExportMenu in this session ('' = none yet). */
  lastImportDir: string;
  lastExportDir: string;
  /** Path of the active project (first initial directory of the file browsers). */
  projectPath: string;
  /** View size put on the ExportAbcOptions layout by OnAbcExportMenu. */
  exportViewSize: { width: number | null; height: number } | null;
}
const abc: AlembicState = {
  framework: null,
  lastImportDir: '',
  lastExportDir: '',
  projectPath: 'C:\\Users\\user\\Autodesk\\Softimage_2015_SP2\\Data\\XSI_SAMPLES',   // inferred: the default project of a fresh install
  exportViewSize: null,
};
export { abc as alembicState };

const IMPORT_LAYOUT: AbcDlgItem[] = [
  { group: 'Options', items: [{ param: 'CreateModel' }, { param: 'CreateICETreeMode', label: 'ICE Trees for Importing' }] },
];
const EXPORT_LAYOUT: AbcDlgItem[] = [
  { group: 'Time Range', items: [{ param: 'StartFrame' }, { param: 'EndFrame' }] },
  { param: 'IncludeParentHier' },
  { param: 'ArchiveFormat', label: 'Archive Format' },
  { group: 'ICE Attributes for Pointclouds', items: [
    { text: 'PointPosition and ID will always be exported' },
    { param: 'IncludeAttributesPointcloud' },
    { button: 'ClearAttributesPointcloud', label: 'Delete All' }, { button: 'AddDefaultAttributesPointcloud', label: 'Add Default Attributes' },
  ] },
  { group: 'ICE Attributes for Polygon Meshes', items: [
    // "the same pair": the note text of the point-cloud group is not repeated here (inferred).
    { param: 'IncludeAttributesPolymesh' },
    { button: 'ClearAttributesPolymesh', label: 'Delete All' }, { button: 'AddDefaultAttributesPolymesh', label: 'Add Default Attributes' },
  ] },
  { group: 'ICE Attributes for other primitives', items: [
    { param: 'IncludeAttributesOtherPrim' },
    { button: 'ClearAttributesOtherPrim', label: 'Delete All' },
  ] },
];

/** Button logic of the export page. "Delete All" clears the text; "Add Default Attributes" puts the default list back. */
export function abcExportOptionsButton(prop: Property, id: string): void {
  // inferred (Q2): the event handler was not read; "add" replaces the field with the default list.
  if (id === 'ClearAttributesPointcloud') prop.set('IncludeAttributesPointcloud', '');
  else if (id === 'AddDefaultAttributesPointcloud') prop.set('IncludeAttributesPointcloud', ABC_DEFAULT_ATTRS_POINTCLOUD);
  else if (id === 'ClearAttributesPolymesh') prop.set('IncludeAttributesPolymesh', '');
  else if (id === 'AddDefaultAttributesPolymesh') prop.set('IncludeAttributesPolymesh', ABC_DEFAULT_ATTRS_POLYMESH);
  else if (id === 'ClearAttributesOtherPrim') prop.set('IncludeAttributesOtherPrim', '');
}

const P = { animatable: false };   // both properties are persistable only
function makeImportOptions(): Property {
  const p = new Property(IMPORT_ABC_OPTIONS, IMPORT_ABC_OPTIONS, [
    bool('CreateModel', false, 'Import under newly created Model', P),
    // an int4 parameter shown as a combo; item values 0 and 1 in list order (inferred in the note)
    enumP('CreateICETreeMode', 0, [{ label: 'Multiple - One per Object', value: 0 }, { label: 'Single - One driving all Objects', value: 1 }],
      'Create ICETree per Object or single one to drive all Objects'),
  ]);
  p.layout = IMPORT_LAYOUT;
  return p;
}
function makeExportOptions(): Property {
  const p = new Property(EXPORT_ABC_OPTIONS, EXPORT_ABC_OPTIONS, [
    num('StartFrame', 1.0, 'Start Frame', P),
    num('EndFrame', 100.0, 'End Frame', P),
    bool('IncludeParentHier', false, 'Include hierarchy up to Scene Root', P),
    enumP('ArchiveFormat', 'Ogawa', [{ label: 'Ogawa', value: 'Ogawa' }, { label: 'HDF5', value: 'HDF5' }], 'Archive Format'),
    str('IncludeAttributesPointcloud', ABC_DEFAULT_ATTRS_POINTCLOUD, 'Included ICE Attributes for Pointclouds'),
    str('IncludeAttributesPolymesh', ABC_DEFAULT_ATTRS_POLYMESH, 'Included ICE Attributes for Polymeshes'),
    str('IncludeAttributesOtherPrim', '', 'Included ICE Attributes for other primitives'),
  ]);
  p.layout = EXPORT_LAYOUT;
  return p;
}

/** The option property directly under the active scene root, found by name; created on demand. */
export function abcOptions(app: App, name: typeof IMPORT_ABC_OPTIONS | typeof EXPORT_ABC_OPTIONS): { prop: Property; created: boolean } {
  const root = app.scene.root;
  const found = root.properties.find(p => p.name === name);
  if (found) return { prop: found, created: false };
  const prop = name === IMPORT_ABC_OPTIONS ? makeImportOptions() : makeExportOptions();
  root.addProperty(prop);
  app.events.emit('scene');
  return { prop, created: true };
}

/** Parent of AbcImport: the argument when it is a 3D object, else the first selected item, else the scene root. */
function resolveImportParent(app: App, arg: unknown): X3DObject {
  if (arg instanceof X3DObject) return arg;
  // 'SingleObj' is the registered default (one object taken from the selection), not an object name.
  if (typeof arg === 'string' && arg !== '' && arg !== 'SingleObj') { const o = app.scene.find(arg); if (o) return o; }
  const first = app.selection[0];
  // inferred: class id 0x48 is not named in the note (Q4); taken to be "a 3D object".
  if (first instanceof X3DObject) return first;
  return app.scene.root;
}

function resolveCollection(app: App, arg: unknown): Node[] {
  if (arg === null || arg === undefined || arg === '') return [];   // no default: an empty collection, not the selection
  const list = Array.isArray(arg) ? arg : arg instanceof Node ? [arg] : String(arg).split(',');
  return list.map(x => x instanceof Node ? x : app.scene.find(String(x).trim())).filter((n): n is Node => !!n);
}

function abcVer(app: App): void {
  const fw = abc.framework;
  if (fw) { app.logMsg('info', `Using Alembic Framework ${fw.version} with ${fw.description}`); return; }
  // The loader's own report (inferred in the note; spelling as in the string table). The version texts are Q1.
  app.logMsg('info', `Unable to load the Alembic Framwork library (${notYet('AbcVer', 'Alembic framework version texts', ABC_NOTE, 'Q1')})`);
}

function abcImport(app: App, a: Record<string, any>): boolean {
  // 1. parent
  const parent = resolveImportParent(app, a.Parent);
  // 2. validation
  const fit = Number(a.FitTimeRange), mode = Number(a.AnimationImportMode);
  if (!(fit >= 0 && fit <= 2)) { app.logMsg('error', 'Invalid FitTimeRange argument'); throw new SiStatusError(E_FAIL, 'Invalid FitTimeRange argument'); }
  if (!(mode >= 0 && mode <= 1)) { app.logMsg('error', 'Invalid AnimationImportMode argument'); throw new SiStatusError(E_FAIL, 'Invalid AnimationImportMode argument'); }
  // 3.
  app.logMsg('info', 'AbcImport_Execute called');
  // 4. configure and run, stopping at the first step that fails
  const fw = abc.framework;
  if (!fw) {
    app.logMsg('info', notYet('AbcImport', 'reading an Alembic archive (no Alembic framework in this build)', ABC_NOTE, 'SYS-03'));
    return false;   // 5. the command status stays OK
  }
  const imp = fw.createImporter();
  const steps: (() => boolean)[] = [
    () => imp.open(asText(a.FilePathName)),
    () => imp.setAnimationOptions(asBool(a.ImportAnimation), Number(a.StartTime), Number(a.EndTime), fit),
    () => imp.setAnimationImportMode(mode),
    () => imp.setPadShapeClips(asBool(a.PadShapeClips)),
    () => imp.setCreateModel(asBool(a.CreateModel)),
    () => imp.setParent(parent),
    () => imp.setCreateICETreeMode(Number(a.CreateICETreeMode)),
    () => imp.run(),
  ];
  for (const step of steps) if (step() !== true) return false;
  return true;
}

function abcExport(app: App, a: Record<string, any>): boolean {
  // 1.
  app.logMsg('info', 'AbcExport_Execute called');
  // 2. storage, compared without regard to case
  const storage = asText(a.Storage).toLowerCase();
  const archiveType = storage === 'hdf5' ? 0 : storage === 'ogawa' ? 1 : -1;
  if (archiveType < 0) throw new SiStatusError(E_INVALIDARG, `Invalid Storage "${asText(a.Storage)}"`);
  // 3. frame range against the play control's In / Out: rejected, not clamped
  const start = Math.trunc(Number(a.StartFrame)), end = Math.trunc(Number(a.EndFrame));
  const tIn = app.anim.startFrame, tOut = app.anim.endFrame;
  if (!(tIn <= start && start <= end && end <= tOut)) throw new SiStatusError(E_INVALIDARG, `Frame range ${start}..${end} is outside the timeline ${tIn}..${tOut}`);
  // 4. exporter
  const fw = abc.framework;
  if (!fw) throw new SiStatusError(E_FAIL, notYet('AbcExport', 'writing an Alembic archive (no Alembic framework in this build)', ABC_NOTE, 'SYS-03'));
  const exp = fw.createExporter(asText(a.FilePathName), asBool(a.IncludeParentHier), archiveType);
  exp.setAttributes(asText(a.AttributesPointcloud), asText(a.AttributesPolymesh), asText(a.AttributesOtherPrim));
  const res = exp.export(resolveCollection(app, a.InputObjs), start, end);
  // 5. one line per attribute that could not be written (separator inferred)
  for (const name of res.notExported ?? []) app.logMsg('info', `Attribute not exported: ${name}`);
  // 6. the command status is the export status
  if (!res.ok) throw new SiStatusError(E_FAIL, 'Alembic export failed');
  return true;
}

/** Settle handling shared by the two menu commands: a failure is logged, a cancel is not. */
function menuPromise(app: App, command: string, work: () => Promise<void>): Promise<void> {
  const p = work();
  p.catch((e) => { if (!(e instanceof SiStatusError && e.status === E_ABORT)) app.logMsg('error', `${command}: ${e?.message ?? e}`); });
  return p;
}
const batchRefusal = (command: string) => new Error(`${command} needs an interactive session (modal dialog and file browser)`);   // inferred: wording not attested

function onAbcImportMenu(app: App, a: Record<string, any>): Promise<void> {
  if (!interactive(app)) throw batchRefusal('OnAbcImportMenu');
  // 1.
  const { prop } = abcOptions(app, IMPORT_ABC_OPTIONS);
  return menuPromise(app, 'OnAbcImportMenu', async () => {
    // 2. the options page comes first, also when a file name was passed in
    if (!await abcOptionsDialog('Alembic Import', prop, IMPORT_LAYOUT, () => undefined)) throw new SiStatusError(E_ABORT, 'Alembic Import cancelled');
    // 3.
    let file = asText(a.FilePathName);
    if (file === '') {
      file = await abcFileBrowser({ title: 'Alembic Import', filter: ABC_FILTER, initialDirectory: abc.lastImportDir || abc.projectPath, save: false }, (d, n) => hostFs.join(d, n));
      if (file === '') return;   // status OK, nothing imported
      abc.lastImportDir = hostFs.parentPath(file);
    }
    // 4. everything else takes the registered defaults
    const ok = app.run('AbcImport', { FilePathName: file, CreateModel: !!prop.val('CreateModel'), CreateICETreeMode: Number(prop.val('CreateICETreeMode')) });
    // 5.
    if (ok !== true) throw new SiStatusError(E_FAIL, 'AbcImport did not succeed');
  });
}

function onAbcExportMenu(app: App): Promise<void> {
  if (!interactive(app)) throw batchRefusal('OnAbcExportMenu');
  // 1. a new property takes its range from the current time range (timeline in / out, inferred in the note)
  const { prop, created } = abcOptions(app, EXPORT_ABC_OPTIONS);
  if (created) { prop.set('StartFrame', app.anim.startFrame); prop.set('EndFrame', app.anim.endFrame); }
  // 2. view size on the layout
  abc.exportViewSize = { width: null, height: EXPORT_VIEW_HEIGHT };
  (prop as any).viewSize = abc.exportViewSize;
  // InputObjs of step 5 is the selection at the time the export runs.
  return menuPromise(app, 'OnAbcExportMenu', async () => {
    // 3.
    if (!await abcOptionsDialog('Alembic Export', prop, EXPORT_LAYOUT, (id) => abcExportOptionsButton(prop, id), { h: EXPORT_VIEW_HEIGHT })) throw new SiStatusError(E_ABORT, 'Alembic Export cancelled');
    // 4. a Save dialog with its own remembered directory
    const file = await abcFileBrowser({ title: 'Alembic Export', filter: ABC_FILTER, initialDirectory: abc.lastExportDir || abc.projectPath, save: true }, (d, n) => hostFs.join(d, n));
    if (file === '') return;
    abc.lastExportDir = hostFs.parentPath(file);
    // 5.
    const ok = app.run('AbcExport', {
      FilePathName: file, StartFrame: prop.val('StartFrame'), EndFrame: prop.val('EndFrame'), InputObjs: [...app.selection],
      IncludeParentHier: !!prop.val('IncludeParentHier'), Storage: prop.val('ArchiveFormat'),
      AttributesPointcloud: prop.val('IncludeAttributesPointcloud'), AttributesPolymesh: prop.val('IncludeAttributesPolymesh'), AttributesOtherPrim: prop.val('IncludeAttributesOtherPrim'),
    });
    // 6.
    if (ok !== true) throw new SiStatusError(E_FAIL, 'AbcExport did not succeed');
  });
}

// ====================================================================== CMD-19a Camera Sequencer

export interface SeqCamKey { time: number; value: number; interp?: number }
/** Result of plotting the sequencer camera. Paths are relative to the camera, e.g. `kine.local.posx`, `camera.fov`. */
export interface SeqCamPlot {
  curves: Record<string, SeqCamKey[]>;
  /** Camera parameter values that do not need curves. */
  constants: Record<string, number>;
}
export interface SeqCamState {
  /** The sequencer plot (Q1). Null: this build has no Camera Sequencer, the plot is empty. */
  plot: ((req: { sequenceIn: number; sequenceOut: number; withoutGaps: boolean }) => SeqCamPlot | null) | null;
  /** Scene.GetAllCacheClipsAndObjects. Null: this build has no file cache clips. */
  cacheClipsAndObjects: (() => { clips: any[]; objects: (X3DObject | string)[] }) | null;
  /** Source frames to sample for the sequencer range, one per output frame (Q1). Null: empty list. */
  frameList: ((sequenceIn: number, sequenceOut: number, withoutGaps: boolean) => number[]) | null;
  /** The last notice shown by PlotSequencerCamera when the plot was empty. */
  lastNotice: string | null;
}
const seq: SeqCamState = { plot: null, cacheClipsAndObjects: null, frameList: null, lastNotice: null };
export { seq as seqCamState };

/** Script name of an object: `name` under the scene root, `Model.name` inside a model. */
const objName = (o: any): string => {
  if (typeof o === 'string') return o;
  if (o instanceof X3DObject) { const m = o.parentObj?.model; return m && m.parentObj ? `${m.name}.${o.name}` : o.name; }
  return asText(o?.name ?? o);
};

/** A camera parameter by its path relative to the camera: `kine.local.posx`, `kine.global.posx`, `camera.fov`, `<property>.<name>`. */
function cameraParam(app: App, cam: X3DObject, rel: string) {
  const i = rel.lastIndexOf('.'); const mid = rel.slice(0, i), name = rel.slice(i + 1);
  if (mid === 'kine.local') return cam.kinematics.local.get(name);
  if (mid === 'kine.global') return cam.kinematics.global.get(name);
  if (cam.primitive && (mid === cam.primitive.type || mid === cam.primitive.name)) return cam.primitive.get(name);
  return findParam(app, `${cam.name}.${rel}`);
}

/** Pull the created camera out of whatever the camera command hands back (its output argument, Q5). */
function cameraFrom(app: App, result: any): X3DObject | null {
  const pick = (v: any): X3DObject | null => v instanceof X3DObject && v.type === 'camera' ? v : null;
  const direct = pick(result) ?? pick(result?.['3DObjCamera']);
  if (direct) return direct;
  if (Array.isArray(result)) for (const v of [...result].reverse()) { const c = pick(v); if (c) return c; }
  return pick(app.selectedObjects[0]);
}

function plotSequencerCamera(app: App, a: Record<string, any>): any {
  const seqIn = Math.trunc(Number(a.SequenceIn)), seqOut = Math.trunc(Number(a.SequenceOut));
  const actionName = asText(a.ActionName), cameraName = asText(a.CameraName);
  // 1.
  if (!(seqOut > seqIn)) throw new SiStatusError(E_INVALIDARG, 'SequenceOut must be greater than SequenceIn');
  if (actionName === '' || cameraName === '') throw new SiStatusError(E_INVALIDARG, 'ActionName and CameraName must not be empty');
  // 2. the target camera, without interest
  const root = app.scene.root;
  const selectionBefore = [...app.selection];
  let cam: X3DObject | null;
  if (app.commands.has(CMD.camNoInterest)) cam = cameraFrom(app, app.run(CMD.camNoInterest, { Name: cameraName }));
  else {
    // inferred: the build has no such command yet; a camera object without an interest is created directly.
    const c = new Camera(app.scene.uniqueName(cameraName));
    app.record('Add ' + c.name, () => root.addChild(c), () => root.removeChild(c));
    app.select([c]);
    cam = c;
  }
  if (!cam) return undefined;
  const camera = cam;
  // 3. plot into a new action source
  const plot = seq.plot ? seq.plot({ sequenceIn: seqIn, sequenceOut: seqOut, withoutGaps: asBool(a.PlotWithoutGaps) }) : null;
  const curvePaths = plot ? Object.keys(plot.curves).filter(k => plot.curves[k]?.length) : [];
  if (!plot || !curvePaths.length) {
    // The notice text is Q2; without a sequencer model the plot itself is Q1.
    seq.lastNotice = seq.plot ? notYet('PlotSequencerCamera', 'text of the "nothing was plotted" notice', SEQ_NOTE, 'Q2')
      : notYet('PlotSequencerCamera', 'sequencer camera plot (this build has no Camera Sequencer); nothing was plotted', SEQ_NOTE, 'Q1, Q2');
    app.logMsg('info', seq.lastNotice);
    app.select(selectionBefore);   // inferred: the failed command is rolled back, so the selection is put back too
    throw new SiStatusError(E_ABORT, 'The sequencer camera plot produced nothing');
  }
  const fcurves: Record<string, SeqCamKey[]> = {}; const values: Record<string, number> = {};
  const curveParams: [import('../core/params').Parameter, SeqCamKey[]][] = [];
  for (const rel of curvePaths) {
    const p = cameraParam(app, camera, rel);
    if (!p) { app.logMsg('info', `PlotSequencerCamera: ${camera.name}.${rel} is not a parameter of the camera in this build`); continue; }
    fcurves[p.fullName] = plot.curves[rel]; values[p.fullName] = plot.curves[rel][0].value; curveParams.push([p, plot.curves[rel]]);
  }
  let srcName = actionName;   // inferred: a taken source name gets a numeric suffix
  for (let i = 1; root.properties.some(p => p.name === srcName); i++) srcName = `${actionName}${i}`;
  const src = new Property(srcName, 'actionsource', [
    str('data', JSON.stringify(values), 'Values', { readOnly: true }), str('fcurves', JSON.stringify(fcurves), 'FCurves', { readOnly: true }),
    str('expressions', '{}', 'Expressions', { readOnly: true }), int('items', curvePaths.length, 'Items', { readOnly: true }), int('mode', 1, 'Mode', { readOnly: true }),
  ]);
  app.record('Plot ' + src.name, () => root.addProperty(src), () => root.removeProperty(src));
  // 4. constants straight onto the new camera
  for (const [rel, value] of Object.entries(plot.constants ?? {})) {
    const p = cameraParam(app, camera, rel);
    if (p) app.setParam(p, value);
    else app.logMsg('info', `PlotSequencerCamera: ${camera.name}.${rel} is not a parameter of the camera in this build`);
  }
  app.select([camera]);
  // 5.
  if (asBool(a.ApplyToCamera)) {
    app.run('ApplyAction', { Source: src.name, Target: camera, 'Consider Time': false, StartFrame: 0, EndFrame: 0, Ripple: false });
    // inferred: this build's ApplyAction does not reach every parameter (e.g. primitive parameters); a curve of
    // the source that did not arrive on the camera is put there directly, so the camera ends with all its curves.
    for (const [p, keys] of curveParams) {
      if (app.anim.fcurve(p)?.keys.length) continue;
      app.record('Plot ' + p.name, () => { const fc = app.anim.fcurve(p, true)!; fc.keys = keys.map(k => ({ time: k.time, value: k.value, left: k.value, right: k.value, interp: k.interp ?? fc.interp })); },
        () => app.anim.removeAnimation(p));
    }
    // dispose of the temporary source (inferred in the note)
    app.record('Delete ' + src.name, () => root.removeProperty(src), () => root.addProperty(src));
    app.select([camera]);
    return [camera];
  }
  let track: any = 0;
  if (app.commands.has(CMD.addTrack)) track = app.run(CMD.addTrack, { Model: root, Compound: root, Type: 0, Name: actionName });
  // inferred: without a track command in the build the clip goes on the mixer's first track.
  const added = app.run('AddClip', { Model: root, Source: src.name, Compound: root, Track: track, Time: seqIn, Name: actionName });
  const clip = added?.clip ?? added;   // AddClip (CMD-B20a) returns the clip object (a ClipNode); this command hands back the clip record
  // 6.
  return [camera, clip];
}

function plotCamSeqForCachedObjects(app: App, a: Record<string, any>): any {
  const seqIn = Math.trunc(Number(a.SequenceIn)), seqOut = Math.trunc(Number(a.SequenceOut));
  const path = asText(a.Path);
  // 1.
  if (!(seqOut > seqIn)) throw new SiStatusError(E_INVALIDARG, 'SequenceOut must be greater than SequenceIn');
  if (path === '') throw new SiStatusError(E_INVALIDARG, 'Path must not be empty');
  if (!path.includes('_#')) throw new SiStatusError(E_INVALIDARG, 'Path must contain the frame placeholder _#');
  // 2. status 1: nothing written, no return value
  const found = seq.cacheClipsAndObjects ? seq.cacheClipsAndObjects() : { clips: [], objects: [] };
  if (!found.objects.length) return undefined;
  // 3.
  const frames = seq.frameList ? seq.frameList(seqIn, seqOut, asBool(a.PlotWithoutGaps)) : [];
  if (!frames.length) {
    app.logMsg('error', siString('XSIMSGCAT', 463) ?? notYet('PlotCamSeqForCachedObjects', 'message 463 of XSIMSGCAT (no source frames for the sequencer range)', SEQ_NOTE, 'Q1, Q2'));
    throw new SiStatusError(E_ABORT, 'No frames to plot in the sequencer range');
  }
  // 4.
  if (!app.commands.has(CMD.cacheIntoFile)) throw new SiStatusError(E_FAIL, notYet('PlotCamSeqForCachedObjects', `${CMD.cacheIntoFile} is not available in this build`, SEQ_NOTE, 'Q3'));
  const res = app.ExecuteCommand(CMD.cacheIntoFile, [found.objects, 5, seqIn, -1, 1, true, true, a.Attributes ?? null, 'CamSeq_Plot', path, asBool(a.UseGlobalKine), 1, frames]);
  // the path that command reports (its ResolvedPath output; how an output argument comes back is build-specific)
  const reported = typeof res === 'string' ? res : asText(res?.ResolvedPath ?? (Array.isArray(res) ? res[res.length - 1] : ''));
  // 5. single-frame suffix -> range suffix
  const single = `_${seqIn}`, range = `_[${seqIn}..${seqIn + frames.length - 1}]`;   // inferred: count = length of the frame list
  const at = reported.lastIndexOf(single);                                             // inferred: the last occurrence
  const pattern = at < 0 ? reported : reported.slice(0, at) + range + reported.slice(at + single.length);
  return [found.objects.map(objName).join(','), pattern, found.clips];
}

/** Every mixer property of the scene (scene root and models). */
function mixers(app: App): Property[] {
  const out: Property[] = [];
  for (const o of [app.scene.root as X3DObject, ...app.scene.allObjects()]) if (o instanceof Model) { const m = o.properties.find(p => p.type === 'mixer'); if (m) out.push(m); }
  return out;
}

/** Delete file cache clips. How Softimage deletes them is Q4; here: objects through DeleteObj, mixer clips out of their mixer. */
function deleteClips(app: App, arg: unknown): void {
  const list: any[] = arg === null || arg === undefined || arg === '' ? [] : Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',').map(s => s.trim()).filter(Boolean) : [arg];
  const objects: X3DObject[] = [];
  for (const c of list) {
    if (c instanceof X3DObject) { objects.push(c); continue; }
    let done = false;
    for (const mix of mixers(app)) {
      const clips: MixerClip[] = (mix as any).clips ?? [];
      const i = clips.findIndex(k => k === c || (typeof c === 'string' && (k.name === c || `${mix.fullName}.${k.name}` === c)));
      if (i < 0) continue;
      const clip = clips[i];
      app.record('Delete ' + clip.name, () => { clips.splice(clips.indexOf(clip), 1); syncMixer(mix); }, () => { clips.splice(i, 0, clip); syncMixer(mix); });
      done = true; break;
    }
    if (!done) throw new SiStatusError(E_FAIL, `Cannot delete clip ${objName(c)}`);
  }
  if (objects.length) app.run('DeleteObj', { InputObj: objects });
}

function applyCamSeqFileCacheSources(app: App, a: Record<string, any>): void {
  // 1.
  const split = (v: unknown) => { const s = asText(v); return s === '' ? [] : s.split(','); };
  const objects = split(a.ObjectsToApply), paths = split(a.CacheFilePaths);
  if (!objects.length || !paths.length) throw new SiStatusError(E_INVALIDARG, 'ObjectsToApply and CacheFilePaths must not be empty');
  if (objects.length !== paths.length) throw new SiStatusError(E_UNEXPECTED, `${objects.length} objects but ${paths.length} cache file paths`);
  // 2.
  deleteClips(app, a.ClipsToDelete);
  // 3. stop at the first failure (a failing command throws)
  if (!app.commands.has(CMD.addFileCacheSource)) throw new SiStatusError(E_FAIL, notYet('ApplyCamSeqFileCacheSources', `${CMD.addFileCacheSource} is not available in this build`, SEQ_NOTE, 'step 3'));
  for (let i = 0; i < objects.length; i++) app.ExecuteCommand(CMD.addFileCacheSource, [objects[i], paths[i]]);
}

// ====================================================================== registration

export function registerAlembicSeqCamCommands(app: App) {
  (app as any).alembic = abc;
  (app as any).seqCam = seq;

  // ---- CMD-01e. All five: uncategorised, enabled, no enable condition.
  app.register({
    name: 'AbcVer', label: 'AbcVer', category: '', description: '', args: [], undoable: false,
    execute(app2) { abcVer(app2); },
  });
  app.register({
    name: 'AbcImport', label: 'AbcImport', category: '', description: '',
    args: [
      { name: 'FilePathName', default: '' }, { name: 'ImportAnimation', default: true }, { name: 'StartTime', default: -1 }, { name: 'EndTime', default: -1 },
      { name: 'PadShapeClips', default: true }, { name: 'FitTimeRange', default: 0 }, { name: 'AnimationImportMode', default: 0 },
      { name: 'Parent', default: 'SingleObj' }, { name: 'CreateModel', default: false }, { name: 'CreateICETreeMode', default: 0 },
    ],
    execute: abcImport,
  });
  app.register({
    name: 'AbcExport', label: 'AbcExport', category: '', description: '',
    args: [
      { name: 'FilePathName', default: '' }, { name: 'StartFrame', default: 1 }, { name: 'EndFrame', default: 100 }, { name: 'InputObjs', default: null },
      { name: 'IncludeParentHier', default: false }, { name: 'Storage', default: 'Ogawa' },
      { name: 'AttributesPointcloud', default: '' }, { name: 'AttributesPolymesh', default: '' }, { name: 'AttributesOtherPrim', default: '' },
    ],
    undoable: false,
    execute: abcExport,
  });
  app.register({
    name: 'OnAbcImportMenu', label: 'OnAbcImportMenu', category: '', description: 'Prompt to set options and import an Alembic file',
    args: [{ name: 'FilePathName', default: '' }], undoable: false,
    execute: onAbcImportMenu,
  });
  app.register({
    name: 'OnAbcExportMenu', label: 'OnAbcExportMenu', category: '', description: 'Prompt to set options and export an Alembic file',
    args: [], undoable: false,
    execute: (app2) => onAbcExportMenu(app2),
  });

  // ---- CMD-19a. All three: uncategorised, enabled, no enable condition.
  app.register({
    name: 'PlotSequencerCamera', label: 'PlotSequencerCamera', category: '', description: 'Plot Sequencer Camera',
    args: [
      { name: 'SequenceIn', default: 1 }, { name: 'SequenceOut', default: 100 }, { name: 'ActionName', default: 'SequencerCamera_Plot_Action' },
      { name: 'CameraName', default: 'SequencerCamera_Plot' }, { name: 'PlotWithoutGaps', default: false }, { name: 'ApplyToCamera', default: true },
    ],
    execute: plotSequencerCamera,
  });
  app.register({
    name: 'PlotCamSeqForCachedObjects', label: 'PlotCamSeqForCachedObjects', category: '', description: 'Plot objects with file cache clips in sequencer time',
    args: [
      { name: 'Path', default: null }, { name: 'SequenceIn', default: 1 }, { name: 'SequenceOut', default: 100 },
      { name: 'PlotWithoutGaps', default: false }, { name: 'Attributes', default: null }, { name: 'UseGlobalKine', default: true },
    ],
    execute: plotCamSeqForCachedObjects,
  });
  app.register({
    name: 'ApplyCamSeqFileCacheSources', label: 'ApplyCamSeqFileCacheSources', category: '', description: 'Delete previous file cache clips and apply plotted file caches to objects',
    args: [{ name: 'ObjectsToApply', default: null }, { name: 'CacheFilePaths', default: null }, { name: 'ClipsToDelete', default: null }],
    execute: applyCamSeqFileCacheSources,
  });
}
