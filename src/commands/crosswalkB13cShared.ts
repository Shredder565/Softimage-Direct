// Ledger row CMD-B13c (dotXSIConverter.64.dll, Crosswalk dotXSI/COLLADA plug-in): shared state, option properties,
// version gate and converter phases of the commands wired in crosswalkB13c.ts.
// Brief: docs/ghidra/cmd-b13c-dotxsiconverter-binary.md ("Shared facts" 2.x, "Contracts" section 3). Original code
// written from that prose contract only; no XSIBATCH golden exists for the row.
//
// How the contract is mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name) after the attested log line;
//    the last status is kept in `app.crosswalkB13c.lastStatus`.
//  * The option properties are Property nodes marked as custom properties; the two grid parameters (InfoGrid,
//    ActionSourceExportTable) are string parameters whose rows live in `(property).grids`.
//  * The converter events are the custom converters of ExportCustomFile (app.tasksB11c) and ImportCustomFile
//    (app.tasksB11b), registered for the attested extensions when the version gate is on.
//  * The Crosswalk SDK scene converters, writers and readers were not read (SPEC-PARTIAL): each run lists its phases
//    in `app.crosswalkB13c.runs` and logs the writer / reader as "not yet attested". No file is written or read.
import { App } from '../core/commands';
import { Node, X3DObject, Property } from '../core/scene';
import { int, num, bool, str, enumP } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { SiStatusError, alembicState } from './alembicSeqCam';
import { findNode, unset } from './viewEditPropertyHelpers';

export { unset };
export const ROW = 'CMD-B13c';
export const VERSION = '2015.0';
export const S_OK = 0, E_INVALIDARG = 0x80070057, E_FAIL = 0x80004005;
export const EXPORT_EVENT = 0x20510027, IMPORT_EVENT = 0x20510026;
export const EXPORT_FILTER = 'dotXSI format (*.xsi)|*.xsi|COLLADA  (*.dae *.xml)|*.dae:*.xml|All Files (*.*)|*.*||';
export const IMPORT_FILTER = 'All Supported Files (*.xsi *.dae *.xml *.xsiml)|*.xsi:*.dae:*.xml:*.xsiml|dotXSI format (*.xsi)|*.xsi|COLLADA  (*.dae *.xml)|*.dae:*.xml|Material Library (*.xsiml)|*.xsiml|All Files (*.*)|*.*||';
export const HELP = '<FactoryPath>/Doc/<DocLangPref>/xsidocs.chm::/menubar20.htm';

export interface ConverterRun { kind: 'export' | 'import' | 'matlib-export' | 'matlib-import'; file: string; format?: number; collada?: boolean; phases: string[]; property: Property | null; library?: string | null; status: number }
export interface CrosswalkB13cState {
  lastStatus: { command: string; status: number } | null;
  /** Application.Version as the plug-in reads it. */
  appVersion: string;
  /** Last import / export file name of the session ('' = none yet). */
  lastFileName: string;
  /** Converter runs (phase progress texts), oldest first. */
  runs: ConverterRun[];
  /** ExportCustomFile / ImportCustomFile calls made by ExportCrosswalk / ImportCrosswalk. */
  customFileCalls: { command: string; args: any[] }[];
  /** Converters registered with the custom file commands (extensions). */
  registered: { exportExt: string[]; importExt: string[] };
}

export function stateOf(app: App): CrosswalkB13cState {
  const a: any = app;
  if (a.crosswalkB13c) return a.crosswalkB13c;
  const st: CrosswalkB13cState = {
    lastStatus: null, appVersion: '13.2.163.0',   // inferred: Softimage 2015 SP2 (the value addonDocWizard uses)
    lastFileName: '', runs: [], customFileCalls: [], registered: { exportExt: [], importExt: [] },
  };
  a.crosswalkB13c = st;
  return st;
}

// ------------------------------------------------------------------ status, errors, log
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
export function failLog(app: App, command: string, status: number, msg: string): SiStatusError { app.logMsg('error', msg); return fail(status, `${command}: ${msg}`); }
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export const text = (v: any) => unset(v) ? '' : (v as any)?.fullName ?? String(v);
export function boolArg(v: any, dflt: boolean): boolean {
  if (unset(v)) return dflt;
  if (typeof v === 'string') return !/^(false|0|no)$/i.test(v.trim());
  return !!v;
}

// ------------------------------------------------------------------ version gate (note 2.2)
export function versionTuple(v: string): number[] | null {
  const f = String(v).split('.'); if (f.length !== 4) return null;
  const n = f.map(parseFloat); return n.every(Number.isFinite) ? n : null;
}
/** The converter-event path: off for major < 7 and for 7.0.x / 7.1.x with sub 0; on otherwise. */
export function eventGate(app: App): boolean {
  const t = versionTuple(stateOf(app).appVersion); if (!t) return true;
  const [major, minor, , sub] = t;
  if (major < 7) return false;
  if (major === 7 && (minor === 0 || minor === 1) && sub === 0) return false;
  return true;
}
/** "Old" argument layout of ExportCustomFile / ImportCustomFile: 7.x builds older than 7.5 / build 718 sub <= 1028 (inferred reading). */
export function oldLayout(app: App): boolean {
  const t = versionTuple(stateOf(app).appVersion); if (!t) return false;
  const [major, minor, build, sub] = t;
  return major === 7 && (minor < 5 || (minor === 5 && build <= 718 && sub <= 1028));
}

// ------------------------------------------------------------------ option properties (note 2.3 / 2.4)
const P = (d: any) => ({ ...d, animatable: false });
function defaultFilename(app: App): string {
  const st = stateOf(app);
  return st.lastFileName || hostFs.join(alembicState.projectPath, 'dotXSI') + '\\';
}
const FORMAT_ITEMS = [{ label: '.XSI 5.0 (text)', value: 0 }, { label: '.XSI 5.0 (binary)', value: 2 }, { label: 'COLLADA 1.4.1', value: 1 }, { label: '.XSI 6.0 (text)', value: 3 }, { label: '.XSI 6.0 (binary)', value: 4 }];
const TARGET_ITEMS = [{ label: 'Softimage to Max', value: 0 }, { label: 'Softimage to Maya', value: 1 }, { label: 'Softimage to Softimage', value: 2 }, { label: 'Custom', value: 3 }];
function mark(app: App, command: string, p: Property, flavour: 'export' | 'import') {
  (p as any).customProperty = true; (p as any).help = HELP;
  (p as any).fileFilter = flavour === 'export' ? EXPORT_FILTER : IMPORT_FILTER;
  (p as any).grids = { InfoGrid: { columns: '200:50:290', rows: [] as any[][] }, ...(flavour === 'export' ? { ActionSourceExportTable: { columns: '', rows: [] } } : {}) };
  logNya(app, command, `the ${flavour} target capability table of InfoGrid (0x1800582f0); the grid is left empty`);
}
export function makeExportOptions(app: App, command: string, type: string, name: string): Property {
  const frame = (v: number) => ({ ...int('', v), animatable: false });
  const p = new Property(name, type, [
    str('Filename', defaultFilename(app), 'Filename'),
    P(enumP('Format', 0, FORMAT_ITEMS, 'Crosswalk File Type')),
    bool('Verbose', true, 'Verbose'),
    bool('ExportXSIExtra', true, 'Export XSI Extra'),
    bool('ExportSelectionOnly', false, 'Selection Only'),
    bool('ExportMaterials', true, 'Materials'),
    bool('ExportImageClips', true, 'Image Clips'),
    bool('ExportUsedMaterialsAndImagesOnly', true, 'Used Materials And Images Only'),
    bool('ExportGeometries', true, 'Polygon Meshes (Nulls exported when off)'),
    bool('ApplySubdivisionToGeometry', false, 'Apply Subdivision To Geometry'),
    bool('Triangulate', false, 'Convert Meshes To Triangles'),
    bool('ExportTangentsAsVtxColor', false, 'Export Tangents As Vertex Colors'),
    P(enumP('ShapeAnim', 1, [{ label: 'Export Shapes', value: 1 }, { label: 'Plot all deformations', value: 0 }], 'Shapes')),
    bool('PlotAnimation', false, 'Plot All Animation'),
    bool('PlotNonFCurveActionSources', false, 'Plot Non FCurve Action Sources'),
    { ...frame(Math.trunc(app.anim.startFrame ?? 1)), name: 'PlotStartFrame', label: 'Start' },
    { ...frame(Math.trunc(app.anim.endFrame ?? 100)), name: 'PlotEndFrame', label: 'End' },
    P(num('PlotStepFrame', 1.0, 'Step')),
    P(enumP('PlotInterpolation', 0, [{ label: 'Use Existing FCurve Interpolation', value: 0 }, { label: 'Constant', value: 1 }, { label: 'Linear', value: 2 }, { label: 'Cubic', value: 3 }], 'Interpolation')),
    bool('PlotFit', true, 'Filter keys'),
    P(num('PlotFitTolerance', 1.0, '% Tolerance')),
    bool('PlotProcessRotation', true, 'Make rotations continuous'),
    bool('ExportXSINormals', false, 'Export XSI Normals'),
    bool('PreserveIK', false, 'Preserve IK Chains'),
    P(enumP('Target', 0, TARGET_ITEMS, 'Target')),
    str('InfoGrid', '', 'InfoGrid', { inspectable: true }),
    bool('PathRelative', true, 'Keep Referenced Paths Relative'),
    bool('ExportAllActionSources', true, 'Export All Action Sources'),
    str('Models', '', 'Models'),
    str('ActionSourceExportTable', '', 'ActionSourceExportTable'),
    bool('MatLib_ExportUsedImageClipsOnly', false, 'Export Used Image Clips Only'),
  ]);
  mark(app, command, p, 'export');
  (p as any).versionText = VERSION;
  return p;
}
export function makeImportOptions(app: App, command: string, type: string, name: string): Property {
  const p = new Property(name, type, [
    str('Filename', defaultFilename(app), 'Filename'),
    bool('Verbose', true, 'Verbose'),
    bool('OptimizeForXSI', true, 'Optimize For XSI'),
    bool('ImportTimelineSettings', true, 'Import Timeline Settings'),
    P(enumP('Target', 0, TARGET_ITEMS, 'Target')),
    str('InfoGrid', '', 'InfoGrid'),
  ]);
  mark(app, command, p, 'import');
  return p;
}

// ------------------------------------------------------------------ lookups
const OPTION_TYPES = ['ExportCrosswalkOptions', 'ExportFTKOptions', 'ImportCrosswalkOptions', 'ImportFTKOptions'];
/** Resolve a property path (full name, owner.name, or a property node). */
export function resolveProperty(app: App, v: any): Property | null {
  if (v instanceof Property) return v;
  if (unset(v) || typeof v !== 'string') return null;
  const n = findNode(app, v); if (n instanceof Property) return n;
  const all = [app.scene.root, ...app.scene.allObjects()];
  for (const o of all) for (const p of o.properties) if (p.fullName === v || `${o.name}.${p.name}` === v) return p;
  for (const p of app.scene.root.properties) if (p.name === v && OPTION_TYPES.includes(p.type)) return p;
  return null;
}
export function resolveObject(app: App, v: any): X3DObject | null {
  if (v instanceof X3DObject) return v;
  if (unset(v)) return null;
  const n = findNode(app, String(v)); return n instanceof X3DObject ? n : null;
}
/** A scene material library by name (stand-in libraries of inferredB10Scene; DefaultLib always exists). */
export function findMatLib(app: App, name: string): Node | { name: string } | null {
  if (!name) return null;
  const libs: Node[] = ((app.scene as any).libraryState?.libraries ?? []) as Node[];
  const l = libs.find(x => x.name === name); if (l) return l;
  return !libs.length && name === 'DefaultLib' ? { name } : null;
}
/** Add a property to a host with an undoable step. */
export function addProp(app: App, host: X3DObject, p: Property) { app.record('AddProp', () => host.addProperty(p), () => host.removeProperty(p)); }
export function deleteProp(app: App, host: X3DObject, p: Property) {
  const i = host.properties.indexOf(p);
  app.record('DeleteObj', () => host.removeProperty(p), () => { host.properties.splice(Math.min(Math.max(i, 0), host.properties.length), 0, p); p.parent = host; });
}

// ------------------------------------------------------------------ converter phases (note 2.5)
export const EXPORT_PHASES = ['Set version', 'Converting scene info', 'Converting environment', 'Converting environment animations', 'Converting image clips',
  'Converting image clip animations', 'Converting materials', 'Converting material animations', 'Filtering pass', 'Converting hierarchy - first pass',
  'Converting mixers', 'Writing file', 'Export completed'];
export const IMPORT_PHASES = ['Reading file', 'Converting scene info', 'Converting environment', 'Converting environment animation', 'Converting image clips',
  'Converting image clip animation', 'Converting materials', 'Converting material animation', 'Converting hierarchies and primitives', 'Resolving instances',
  'Converting hierarchy node data and animation', 'Import completed'];
export const MATLIB_EXPORT_PHASES = ['Set version', 'Converting scene info', 'Converting environment', 'Converting image clips', 'Converting image clip animations',
  'Converting materials', 'Converting material animations', 'Writing file', 'Export completed'];
export const MATLIB_IMPORT_PHASES = ['Reading file', 'Converting scene info', 'Converting image clips', 'Converting image clip animation', 'Converting materials',
  'Converting material animation', 'Material library pass', 'Import completed'];
export function runPhases(app: App, command: string, run: ConverterRun, phases: string[], verbose: boolean) {
  for (const ph of phases) { run.phases.push(ph); if (verbose) app.logMsg('info', `${command}: ${ph}`); }
  stateOf(app).runs.push(run);
}
export const isCollada = (file: string) => { const d = file.lastIndexOf('.'); const ext = d >= 0 ? file.slice(d + 1) : ''; return /dae|DAE|xml|XML/.test(ext); };
