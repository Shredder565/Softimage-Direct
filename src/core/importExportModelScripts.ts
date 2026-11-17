// CMD-04b data: option properties, layouts, strings and session state of the import / export and model script commands.
// Everything here is a fact table from docs/ghidra/cmd-04b-import-export-model-scripts.md ("Wire contract") and, for the
// two dotXSI option properties, from data/spdl/spdl.json (C3DdotXSIImportOpt.spdl, C3DdotXSIExportOpt.spdl).
import { Property, Node, Model, Scene } from './scene';
import { str, int, bool, num, type ParamDef } from './params';
import type { IeDlgItem } from '../ui/importExportModelScriptsDialog';

export const IEMS_NOTE = 'docs/ghidra/cmd-04b-import-export-model-scripts.md';

// ------------------------------------------------------------------ translated strings (fallback = the attested English text)
export const IEMS_TEXT: Record<string, Record<number, string>> = {
  XSISCRIPTS: { 1078: 'Wavefront OBJ Export', 1079: 'Wavefront OBJ Import', 1080: 'Biovision Import', 1081: 'Acclaim Import', 1129: 'Search and Replace' },
  XSI_3DOBJECT2: { 10010: 'This operation is destructive and not undoable. The file used by the referenced model will be overwritten. Do you want to proceed?' },
};

export const OBJ_BROWSER = { title: 'Select a .OBJ file', filter: 'Wavefront (*.obj)|*.obj|All Files (*.*)|*.*||' };
export const BVH_BROWSER = { title: 'Select a .BVH file', filter: 'Biovision (*.bvh)|*.bvh|All Files (*.*)|*.*||' };
export const ASF_BROWSER = { title: 'Select a .ASF file', filter: 'ASF (*.asf)|*.asf|All Files (*.*)|*.*||' };
const OBJ_FILTER = 'Wavefront OBJ Files (*.obj)|*.obj|All Files (*.*)|*.*||';

const plain = (d: ParamDef): ParamDef => ({ ...d, animatable: false });
function prop(name: string, type: string, defs: ParamDef[], layout: IeDlgItem[], help: string): Property {
  const p = new Property(name, type, defs.map(plain));
  (p as any).ieLayout = layout; (p as any).help = help;
  return p;
}
export const ieLayoutOf = (p: Property): IeDlgItem[] => (p as any).ieLayout ?? [];

// ------------------------------------------------------------------ Wavefront_Export
export function makeWavefrontExport(): Property {
  const frame = { min: -100000, max: 100000, readOnly: true };   // the three frame fields start disabled
  return prop('Wavefront_Export', 'CustomProperty', [
    str('Filename', ''),
    int('FilePerObject', 0, 'Hierarchy', { min: 0, max: 1 }),
    bool('FilePerFrame', false, 'Separate Files Per Frame'),
    int('StartFrame', 0, 'Start', frame), int('EndFrame', 100, 'End', frame), int('StepFrame', 1, 'Step', frame),
    bool('Polymsh', true, 'Polygon Meshes'),
    bool('Surfmsh', false, 'Nurbs Meshes', { readOnly: true }),
    bool('Crvlist', false, 'Curve Lists', { readOnly: true }),
    bool('UserNormal', false, 'User Normals'),
    bool('Cloud', false),
    bool('Tesselation', false, 'Export Render Tesselation', { readOnly: true }),
    bool('Material', true, 'Export Material'),
    bool('uv', true, 'Export Current UV Set'),
    int('CoordinateSystem', 0, 'Vertices', { min: 0, max: 1 }),
  ], [
    { tab: 'File Output', items: [
      { group: 'File', items: [
        { param: 'Filename', control: 'file', mode: 'save', mustExist: false, initialDir: 'project', filter: OBJ_FILTER },
        { param: 'FilePerObject', control: 'radio', choices: [['Merge all objects into one file', 0], ['Separate files per object', 1]] },
      ] },
      { group: 'Sequence', items: [{ param: 'FilePerFrame' }, { row: true, items: [{ param: 'StartFrame' }, { param: 'EndFrame' }, { param: 'StepFrame' }] }] },
    ] },
    { tab: 'Geometry Options', items: [
      // the radio is bound to a parameter this property does not have (open question Q2): drawn inert
      { group: 'Hierarchy', items: [{ param: 'hrc', control: 'radio', choices: [['No Hierarchy', 0], ['Null as Parent', 1], ['Model as Parent', 2]] }] },
      { group: 'Geometry', items: [{ row: true, items: [{ param: 'Polymsh' }, { param: 'Surfmsh' }] }, { row: true, items: [{ param: 'UserNormal' }, { param: 'Crvlist' }] }] },
      { group: 'Triangulation', items: [{ param: 'Tesselation' }, { param: 'CoordinateSystem', control: 'combo', choices: [['Global Coordinates', 0], ['Local Coordinates', 1]] }] },
      { group: 'Material', items: [{ param: 'Material' }, { param: 'uv' }] },
    ] },
  ], 'xsidocs.chm::/menubar14.htm');
}
/** Layout logic of Wavefront_Export: the three frame fields are enabled exactly when FilePerFrame is true. */
export function wavefrontExportLogic(p: Property, changed: string): boolean {
  if (changed !== 'FilePerFrame') return false;
  for (const n of ['StartFrame', 'EndFrame', 'StepFrame']) p.get(n)!.def.readOnly = !p.val('FilePerFrame');
  return true;
}

// ------------------------------------------------------------------ Wavefront_Import
export function makeWavefrontImport(): Property {
  return prop('Wavefront_Import', 'CustomProperty', [
    str('Filename', ''),
    int('Group', 1, 'Group', { min: 0, max: 1 }),
    int('hrc', 0, 'Hierarchy', { min: 0, max: 2 }),
    bool('UserNormal', false, 'Import Normals as User Normals'),
    bool('Material', true, 'Import Material'),
    bool('uv', true, 'Import UV'),
    bool('uvWrapping', true, 'UV wrapping'),
    str('DisplImage', '', 'Image'),
    num('DisplDepth', 0.5, 'Alpha Depth Factor', { min: 0, max: 100 }),
    bool('DisplFlipVert', false, 'Flip Image Vertically'),
    bool('DisplViewDep', false, 'View Dependent Refinement'),
    int('DisplSubDLevel', 1, 'Subdivision level', { min: 0, max: 8 }),
  ], [
    // inferred: the note names the tab "Displacement Options" and the groups; the name of the first tab is not given
    { tab: 'Import Options', items: [
      { param: 'Filename', control: 'file', mode: 'open', mustExist: true, initialDir: 'project', filter: OBJ_FILTER },
      { group: 'Group', items: [{ param: 'Group', control: 'radio', choices: [['Import as Clusters', 0], ['Import as Objects', 1]] }] },
      { group: 'Hierarchy', items: [{ param: 'hrc', control: 'radio', choices: [['No Hierarchy', 0], ['Null as Parent', 1], ['Model as Parent', 2]] }] },
      { param: 'UserNormal' },
      { group: 'Material', items: [{ param: 'Material' }, { param: 'uv' }, { param: 'uvWrapping' }] },
    ] },
    { tab: 'Displacement Options', items: [
      { param: 'DisplImage', control: 'file', mode: 'open', mustExist: true }, { param: 'DisplDepth' }, { param: 'DisplFlipVert' }, { param: 'DisplViewDep' }, { param: 'DisplSubDLevel' },
    ] },
  ], 'xsidocs.chm::/menubar10.htm');
}

// ------------------------------------------------------------------ Biovision_Import / Acclaim_Import (SPDL property types)
// The combo items of NullsHierarchy / GaplessSkeleton / SI3DChains are not in the SPDL data (open question Q3): drawn as numbers.
const MOCAP_TAIL_DEFS = (): ParamDef[] => [
  int('NullsHierarchy', 0, 'NullsHierarchy'), int('GaplessSkeleton', 0, 'Hierarchy'), int('SI3DChains', 1, 'Chains'),
];
const MOCAP_TAIL_LAYOUT: IeDlgItem[] = [
  { group: 'Skeleton Description Mode', items: [{ param: 'NullsHierarchy', control: 'number' }] },
  { group: 'Bones Skeleton Options', items: [{ param: 'GaplessSkeleton', control: 'number' }, { param: 'SI3DChains', control: 'number' }] },
];
export function makeBiovisionImport(): Property {
  return prop('Biovision_Import', 'BiovisionImport', [
    str('FileName', '', 'File Name'), ...MOCAP_TAIL_DEFS(),
    bool('InsertMotion', true, 'Add motion action to Mixer'), bool('GroupAnimObjs', true, 'Group Animated Objects'),
  ], [
    { param: 'FileName', control: 'file', mode: 'open', filter: BVH_BROWSER.filter }, ...MOCAP_TAIL_LAYOUT, { param: 'InsertMotion' }, { param: 'GroupAnimObjs' },
  ], 'xsidocs.chm::/menubar18.htm');
}
export function makeAcclaimImport(): Property {
  return prop('Acclaim_Import', 'AcclaimImport', [
    str('FileDoc', 'Make sure that both the ASF and AMC files are compatible...'),
    str('ASFFile', '', 'Skeleton File'), str('AMCFile', '', 'Motion File'), ...MOCAP_TAIL_DEFS(),
    bool('ApplyLimits', false, 'Crop Motion Values to Limits'),
    bool('OverrideLength', false, 'Override Bone Length Multiplier'),
    num('LengthMultiplier', 1.0, 'Length Multiplier', { min: 0.005 }),
    bool('InsertMotion', true, 'Add motion action to Mixer'), bool('GroupAnimObjs', true, 'Group Animated Objects'),
  ], [
    { group: 'File Input', items: [{ param: 'FileDoc', control: 'static' }, { param: 'ASFFile', control: 'file', mode: 'open', filter: ASF_BROWSER.filter }, { param: 'AMCFile', control: 'file', mode: 'open' }] },
    ...MOCAP_TAIL_LAYOUT,
    { group: 'Import Options', items: [{ param: 'ApplyLimits' }, { param: 'OverrideLength' }, { param: 'LengthMultiplier' }, { param: 'InsertMotion' }, { param: 'GroupAnimObjs' }] },
  ], 'xsidocs.chm::/menubar17.htm');
}

// ------------------------------------------------------------------ Search_And_Replace
export function makeSearchAndReplace(): Property {
  return prop('Search_And_Replace', 'CustomProperty', [
    str('File_Category', 'All', 'File Category'), str('Old_String', 'old string', 'Old String'),
    str('New_String', 'new string', 'New String'), bool('Case_Sensitive', false, 'Case Sensitive'),
  ], [{ param: 'File_Category' }, { param: 'Old_String' }, { param: 'New_String' }, { param: 'Case_Sensitive' }], '');
}

// ------------------------------------------------------------------ dotXSI option properties (one per scene, persistent)
type C = [string, number][];
const combo = (name: string, value: number, label: string, _items: C) => int(name, value, label);
const SIZE: C = [['Original', 0], ['Auto', 1], ['2', 2], ['4', 3], ['8', 4], ['16', 5], ['32', 6], ['64', 7], ['128', 8], ['256', 9], ['512', 10]];
const XSI_EXPORT_COMBOS: Record<string, C> = {
  output_file_format: [['Ascii', 1], ['Binary', 0]], output_file_format_version: [['3.0', 300], ['3.5', 350], ['3.6', 360]],
  tesselation: [['Polygons', 0], ['Triangles', 1], ['Triangle Strips', 2]],
  ik: [['Convert to FK (with Nulls)', 0], ['Full IK', 1], ['Convert to FK (keep Skeletons)', 2]], envelope: [['Convert to Shape Animation', 0], ['Weighted', 1]],
  fcurveKind: [['Boolean', 10], ['Integer', 15], ['Standard', 20], ['Raw Data', 30]], interpolation: [['Constant', 1], ['Linear', 2], ['Spline', 3]],
  txtresizeX: SIZE, txtresizeY: SIZE, txtformat: [['Original', 0], ['PIC', 1], ['BMP', 2], ['PPM', 3], ['TGA', 4], ['JPEG', 5], ['TIM2', 6]],
};
const xp = (n: string): IeDlgItem => XSI_EXPORT_COMBOS[n] ? { param: n, control: 'combo', choices: XSI_EXPORT_COMBOS[n] } : { param: n };
function makeDotXSIExportOptions(): Property {
  const c = XSI_EXPORT_COMBOS;
  return prop('dotXSIExportOptions', 'C3DdotXSIExportOpt', [
    str('project_name', '', 'Project Name'),
    combo('output_file_format', 1, 'File Format', c.output_file_format), combo('output_file_format_version', 300, 'dotXSI Format Version', c.output_file_format_version),
    bool('sceneroot', false, 'Export Scene Root When No Selection'), bool('polymesh', true, 'Polygon Meshes'),
    combo('tesselation', 0, 'Polygon Type', c.tesselation), bool('user_normals', true, 'User Normals'),
    bool('nrbssrf', true, 'Nurbs Surfaces'), bool('nrbscrv', true, 'Nurbs Curves'),
    bool('animall', true, 'All'), bool('animgeom', false, 'Geometry'), bool('animcam', false, 'Camera'), bool('animlight', false, 'Light'),
    bool('animmat', false, 'Material'), bool('animenv', false, 'Ambience'), bool('animaction', false, 'Action'), bool('animplot', false, 'Plot'),
    bool('constraint', true, 'Constraints'), bool('custompset', true, 'Custom Parameter Sets'),
    combo('ik', 1, 'IK', c.ik), combo('envelope', 1, 'Envelopes', c.envelope), combo('fcurveKind', 20, 'Kind of fcurve', c.fcurveKind), combo('interpolation', 3, 'Interpolation', c.interpolation),
    bool('fitFCurve', false, 'Fit FCurve'), num('fitTolerance', 0.01, 'Fit Tolerance'),
    bool('textures', true, 'Textures'), bool('txtabsolute', false, 'Absolute Path'), bool('txtsequences', false, 'Sequences'), bool('txtfiles', true, 'Copy Files'),
    combo('txtresizeX', 0, 'Size X', SIZE), combo('txtresizeY', 0, 'Size Y', SIZE), combo('txtformat', 0, 'File Format', c.txtformat),
    str('export_path', '', 'Path', { inspectable: false }), bool('keep_shared_mat', true, 'Keep Shared Materials'),
  ], [{ tab: 'Export', items: [
    { group: 'dotXSI File', items: ['project_name', 'output_file_format', 'output_file_format_version'].map(xp) },
    { group: 'Geometry', items: ['sceneroot', 'polymesh', 'nrbssrf', 'user_normals', 'nrbscrv', 'tesselation'].map(xp) },
    { group: 'Animation', items: ['animall', 'animgeom', 'animcam', 'animlight', 'animmat', 'animenv', 'animaction'].map(xp) },
    { group: 'Animation Filtering', items: ['animplot', 'fcurveKind', 'interpolation', 'fitFCurve', 'fitTolerance'].map(xp) },
    { group: 'Relations', items: ['constraint', 'envelope', 'ik'].map(xp) },
    { group: '', items: [xp('custompset')] }, { group: '', items: [xp('keep_shared_mat')] },
    { group: 'Textures', items: ['textures', 'txtabsolute', 'txtsequences', 'txtfiles', 'txtformat', 'txtresizeX', 'txtresizeY'].map(xp) },
  ] }], 'xsidocs.chm::/menubar16.htm');
}
function makeDotXSIImportOptions(): Property {
  return prop('dotXSIImportOptions', 'C3DdotXSIOpt', [
    bool('anim_import', true, 'Animation'), bool('classical_scaling', true, 'Classical Scaling'), bool('mat_import', true, 'Material'),
    bool('txt_import', true, 'Texture (only affects SI_Texture2D templates)'), bool('norm_import', false, 'Normal (different normals in user normal cluster)'),
    str('import_path', '', 'Path', { inspectable: false }), bool('raw_fcurves', false, 'Import linear fCurves as RAW'),
  ], [{ tab: 'Import', items: ['anim_import', 'classical_scaling', 'mat_import', 'txt_import', 'norm_import', 'raw_fcurves'].map(n => ({ param: n })) }], 'xsidocs.chm::/menubar15.htm');
}
const SCENE_OPTIONS = new WeakMap<Scene, Record<string, Property>>();
/** The scene's dotXSIImportOptions / dotXSIExportOptions property (created on first use, kept for the scene's life). */
export function sceneDotXSIOptions(scene: Scene, which: 'import' | 'export'): Property {
  let m = SCENE_OPTIONS.get(scene); if (!m) SCENE_OPTIONS.set(scene, m = {});
  if (!m[which]) { m[which] = which === 'import' ? makeDotXSIImportOptions() : makeDotXSIExportOptions(); m[which].parent = scene; }
  return m[which];
}

// ------------------------------------------------------------------ external files
/** One entry of an external file list: a path the scene refers to, with its file type (for example `Pictures`). */
export class IeExternalFile {
  constructor(readonly fileType: string, private read: () => string, private write: (v: string) => void, readonly owner: Node | null = null) {}
  get path(): string { return this.read(); }
  set path(v: string) { this.write(v); }
  /** How the entry prints in a logged command line. */
  get fullName(): string { return this.path; }
}
export interface RefInfo { file: string; resolution: number; resolutions: string[] }
/** The app's referenced-model record of a model (src/commands/model2.ts keeps it on the model as `ref`). */
export const refOfModel = (m: any): RefInfo | null => (m && m.ref ? m.ref as RefInfo : null);
/** What ToggleReferencedModel keeps of a model it made local: its resolutions list and active resolution. // inferred */
export const localRefOfModel = (m: any): RefInfo | null => (m && m.refLocal ? m.refLocal as RefInfo : null);

export interface IeWorkerCall { worker: string; by: string; args: any[]; ran: boolean }
export interface IemsState {
  /** Licence name; "Avid 3D" switches ImportDotXSI to the importer without a dialog. */
  licence: string;
  /** Which of the two registry entries the scripting name ObjExport stands for. auto = dialog when interactive. // inferred */
  objExportForm: 'auto' | 'dialog' | 'proc';
  /** Optional implementations of the lower-level workers this row calls (their own ledger rows), by worker name. */
  workers: Record<string, (...args: any[]) => any>;
  /** Every worker call the script layer made, newest last (kept to 200). */
  calls: IeWorkerCall[];
  /** Optional host file browser `(title, filter, mode) => path`. Absent: a modal text field stands in. */
  fileBrowser: ((title: string, filter: string, mode: 'open' | 'save') => string | Promise<string>) | null;
  /** External files that are not derived from scene nodes (audio and so on). */
  extraFiles: IeExternalFile[];
  /** Outcome of the last run of each dialog form: ok = false on cancel. */
  last: Record<string, { ok: boolean; args: Record<string, any> }>;
}
export const iemsState: IemsState = { licence: 'Softimage', objExportForm: 'auto', workers: {}, calls: [], fileBrowser: null, extraFiles: [], last: {} };

/** Project.ExternalFilesList as far as this build models it: image sources and clips (Pictures), referenced-model files (Models). */
export function projectExternalFiles(scene: Scene): IeExternalFile[] {
  const out: IeExternalFile[] = [];
  for (const p of scene.root.properties) {
    if (p.type !== 'imageclip' && p.type !== 'imagesource') continue;
    const f = p.get('filename') ?? p.get('FileName'); if (!f || !String(f.value ?? '')) continue;
    out.push(new IeExternalFile('Pictures', () => String(f.value ?? ''), (v) => { f.value = v; }, p));
  }
  for (const o of [scene.root, ...scene.allObjects()]) if (o instanceof Model) out.push(...modelExternalFiles(o));
  return [...out, ...iemsState.extraFiles];
}
/** The external files of one model: the files of its resolutions, referenced or kept from before it was made local. */
export function modelExternalFiles(m: Model): IeExternalFile[] {
  const r = refOfModel(m) ?? localRefOfModel(m); if (!r) return [];
  const list = r.resolutions.length ? r.resolutions : (r.file ? [r.file] : []);
  return list.map((_, i) => new IeExternalFile('Models', () => (r.resolutions.length ? r.resolutions[i] : r.file),   // inferred: file type name
    (v) => { if (r.resolutions.length) { if (r.file === r.resolutions[i]) r.file = v; r.resolutions[i] = v; } else r.file = v; }, m));
}
/** XSIUtils.ResolvePath stand-in: this build has no path tokens to expand, so a path resolves to itself. // inferred */
export const resolveIePath = (p: string): string => String(p ?? '');
