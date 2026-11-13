// FBX import / export command family (ledger row CMD-01a).
// Brief: docs/ghidra/cmd-01a-fbx.md, "Wire contract". Original code written from that contract only.
//
// What is wired here is the command surface: names, arguments, defaults, return values and the two
// option properties under the scene root. Everything the contract lists as an open question raises
// NotYetAttested instead of guessing (unit table Q2, group text Q4, import defaults Q5, file content SYS-03).
import { App, CommandDef } from '../core/commands';
import { Property } from '../core/scene';
import type { ParamDef } from '../core/params';

const NOTE = 'docs/ghidra/cmd-01a-fbx.md';

/** Raised by a branch whose behaviour the analyst has not attested yet. */
export class NotYetAttested extends Error {
  readonly notYetAttested = true;
  constructor(command: string, what: string, question: string) {
    super(`not yet attested: ${what} (${command}; ${NOTE} ${question})`);
    this.name = 'NotYetAttested';
  }
}

// ------------------------------------------------------------------ option properties

type OptType = 'bool' | 'float' | 'int' | 'string';
/** [parameter, type, default]. `undefined` default = the contract does not give one (value stays unset). */
type OptRow = [string, OptType, boolean | number | string | undefined];

export const EXPORT_OPTIONS = 'ExportFBXOptions';
export const IMPORT_OPTIONS = 'ImportFBXOptions';

// Definition order from the contract. The grid parameter of each property is not representable yet and is
// left out (PROP-FBX); it sits after ExportVisibilityAsShow (export) and after Info (import).
const EXPORT_ROWS: OptRow[] = [
  ['Automatic', 'bool', true],
  ['MasterScale', 'float', 1.0],
  ['MasterUnitIndex', 'int', undefined],          // index of centimetres in the unit table: Q2
  ['ExportSelection', 'bool', false],
  ['ExportGeometry', 'bool', true],
  ['ExportCameras', 'bool', true],
  ['ExportLights', 'bool', true],
  ['ExportShapes', 'bool', true],
  ['ExportSkins', 'bool', true],
  ['ExportHardEdges', 'bool', true],
  ['ExportAnimation', 'bool', true],
  ['ResamplingRate', 'float', 30.0],
  ['AsciiFBX', 'bool', false],
  ['EmbedTextures', 'bool', false],
  ['ConvertImageFormat', 'bool', false],
  ['ImageFormat', 'string', 'tiff'],
  ['ShowWarningDialog', 'bool', true],
  ['BindPose', 'bool', true],
  ['ExportShowWarningDialog', 'bool', true],
  ['ExportKeepXsiEffectors', 'bool', false],
  ['ExportDeformerAsSkeleton', 'bool', false],
  ['ExportFilename', 'string', ''],
  ['BoneSize', 'float', 10.0],
  ['Info', 'int', 0],
  ['GeometryCacheFile', 'bool', false],
  ['GroupToCache', 'int', undefined],             // no explicit default
  ['FBXSDKVersion', 'string', 'FBX201400'],
  ['ExportOneClickMode', 'bool', false],
  ['ExportVisibilityAsShow', 'bool', false],
  ['ExportShapeNamespace', 'bool', false],
];

const IMPORT_ROWS: OptRow[] = [
  ['UseMatrixFromBindPose', 'bool', false],
  ['LoadMode', 'int', 2],
  ['Automatic', 'bool', true],
  ['FileScaleFactor', 'float', undefined],        // computed at definition time: Q5
  ['MasterScale', 'float', 1.0],
  ['MasterUnitIndex', 'int', undefined],          // Q2
  ['ImportCameras', 'bool', true],
  ['ImportLights', 'bool', true],
  ['ImportMaterialsAndTextures', 'bool', true],
  ['ImportAnimation', 'bool', true],
  ['ShowWarningDialog', 'bool', true],
  ['ResamplingRate', 'float', 30.0],
  ['ConstantKeyReducer', 'bool', undefined],      // Q5 (this one and the eight that follow)
  ['KeyReducer', 'bool', undefined],
  ['KeySync', 'bool', undefined],
  ['KeysOnFrame', 'bool', undefined],
  ['UnRoll', 'bool', undefined],
  ['UnRollPath', 'bool', undefined],
  ['Character', 'bool', undefined],
  ['KeyReducerPrecision', 'float', undefined],
  ['UnRollQuality', 'float', undefined],
  ['ImportSkelsAsNulls', 'bool', true],
  ['KeepXsiEffectors', 'bool', true],
  ['ImportSkins', 'bool', true],
  ['ForceWeightNormalize', 'bool', false],
  ['ProtectExpressionFCurve', 'bool', false],
  ['NameSpaceReplacement', 'string', undefined],  // Q5
  ['ImportFilename', 'string', ''],
  ['Take', 'int', 1],
  ['Info', 'int', 0],
  ['ImportHardEdges', 'bool', false],
  ['GeometryCacheFile', 'bool', true],
  ['ImportFrameRate', 'bool', false],
  ['ImportFillTimeline', 'bool', false],
  ['ImportOneClickMerge', 'bool', false],
  ['ImportMudboxMergeTexture', 'bool', false],
  ['ImportOneClickAdd', 'bool', false],
  ['ImportOneClickMode', 'bool', false],
  ['ImportNullsAsModels', 'bool', false],
  ['StripShapeNamespace', 'bool', false],
  ['UnbiasNormalMaps', 'bool', true],
];

const ROWS: Record<string, OptRow[]> = { [EXPORT_OPTIONS]: EXPORT_ROWS, [IMPORT_OPTIONS]: IMPORT_ROWS };

/**
 * Parameters without an attested default hold `null` ("unset") and are kept out of the property page, so
 * nothing invented is shown. They are plain stored values: the Parameter setter would coerce null to 0 / false.
 */
function optionDefs(rows: OptRow[]): ParamDef[] {
  return rows.map(([name, type, value]): ParamDef => {
    const base: ParamDef = {
      name, label: name, value: value === undefined ? null : value, animatable: false,
      type: type === 'float' ? 'double' : type,
    };
    if (value === undefined) { base.inspectable = false; base.desc = `default not attested (${NOTE})`; }
    return base;
  });
}

/** The option property under the active scene root, looked up by name; created on first use. */
export function fbxOptions(app: App, name: typeof EXPORT_OPTIONS | typeof IMPORT_OPTIONS): Property {
  const root = app.scene.root;
  const found = root.properties.find(p => p.name === name);
  if (found) return found;
  const prop = new Property(name, name, optionDefs(ROWS[name]));
  root.addProperty(prop);
  app.events.emit('scene');
  return prop;
}

// ------------------------------------------------------------------ argument handling

/** "Empty" in the get / set convention: omitted, or the text form is the empty string. */
const isEmpty = (v: unknown) => v === undefined || v === null || String(v) === '';

/** Variant-to-bool for the values scripts pass: booleans, numbers, "true" / "false" and numeric text. */
function toBool(command: string, v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return v !== 0;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t !== '' && Number.isFinite(Number(t))) return Number(t) !== 0;
  }
  throw new NotYetAttested(command, `conversion of ${JSON.stringify(v)} to a boolean`, 'get / set convention');
}

function toNumber(command: string, v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v ? -1 : 0; // a variant True is -1
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  throw new NotYetAttested(command, `conversion of ${JSON.stringify(v)} to a number`, 'get / set convention');
}

// ------------------------------------------------------------------ command tables

/** [scripting name, registered command name, argument, parameter] */
type BoolRow = [string, string, string, string];
const same = (n: string, arg: string, param: string): BoolRow => [n, n, arg, param];

const EXPORT_BOOLS: BoolRow[] = [
  same('FBXExportAscii', 'State', 'AsciiFBX'),
  same('FBXExportAutomaticUnit', 'State', 'Automatic'),
  same('FBXExportAnimation', 'State', 'ExportAnimation'),
  same('FBXExportCameras', 'State', 'ExportCameras'),
  same('FBXExportLights', 'State', 'ExportLights'),
  same('FBXExportSelection', 'State', 'ExportSelection'),
  same('FBXExportGeometries', 'State', 'ExportGeometry'),
  same('FBXExportSkins', 'State', 'ExportSkins'),
  same('FBXExportShapes', 'State', 'ExportShapes'),
  same('FBXExportHardEdges', 'State', 'ExportHardEdges'),
  same('FBXExportCacheFile', 'State', 'GeometryCacheFile'),
  same('FBXExportKeepXSIEffectors', 'State', 'ExportKeepXsiEffectors'),
  same('FBXExportDeformerAsSkeleton', 'State', 'ExportDeformerAsSkeleton'),
  // The set path also changes a capability flag on ConvertImageFormat / ImageFormat (property-page
  // enable state). Flag and polarity are Q3, so only the stored value is written here.
  same('FBXExportEmbedMedias', 'State', 'EmbedTextures'),
];

const IMPORT_BOOLS: BoolRow[] = [
  same('FBXImportAutomaticUnit', 'State', 'Automatic'),
  same('FBXImportAnimation', 'State', 'ImportAnimation'),
  same('FBXImportCameras', 'State', 'ImportCameras'),
  same('FBXImportLights', 'State', 'ImportLights'),
  same('FBXImportSetEnvelopes', 'State', 'ImportSkins'),
  same('FBXImportHardEdges', 'State', 'ImportHardEdges'),
  same('FBXImportCacheFile', 'State', 'GeometryCacheFile'),
  same('FBXImportFrameRate', 'State', 'ImportFrameRate'),
  same('FBXImportFillTimeline', 'State', 'ImportFillTimeline'),
  ['FBXImportSkeletonsAsNulls', 'FBXImportSkeletonAsNulls', 'State', 'ImportSkelsAsNulls'],
  same('FBXImportKeepXSIEffectors', 'State', 'KeepXsiEffectors'),
  same('FBXImportForceNormEnvelope', 'State', 'ForceWeightNormalize'),
  ['FBXImportProtectExprDrivenFC', 'FBXImportProtectExprDriven', 'State', 'ProtectExpressionFCurve'],
];

/** FBXImportMode: LoadMode value → text returned on get, and the texts accepted on set. */
const IMPORT_MODES: { value: number; text: string; accepts: string[] }[] = [
  { value: 0, text: 'Update animation', accepts: ['exclusive merge', 'update animation'] },
  { value: 1, text: 'Add and update animation', accepts: ['merge', 'add and update animation'] },
  { value: 2, text: 'Add', accepts: [] }, // any other non-empty text
  { value: 3, text: 'Import as Action Source', accepts: ['import action only', 'import as action source'] },
];

// ------------------------------------------------------------------ registration

export function registerFbxCommands(app: App) {
  // Shared shape of all 40: uncategorised, return value enabled, always enabled.
  // Whether Softimage puts these on the undo stack is not in the contract; nothing is recorded.
  const reg = (def: Pick<CommandDef, 'name' | 'label' | 'description' | 'args' | 'execute' | 'supported'>) =>
    app.register({ category: '', undoable: false, ...def });

  // ---- bool option commands (get / set convention)
  const boolCommand = (propName: typeof EXPORT_OPTIONS | typeof IMPORT_OPTIONS) => ([name, command, arg, param]: BoolRow) => reg({
    name, label: command, description: `${name} <bool>`, args: [{ name: arg, default: null }],
    execute(app, a) {
      const prop = fbxOptions(app, propName);
      if (isEmpty(a[arg])) return prop.val(param);
      const v = toBool(name, a[arg]);
      prop.set(param, v);
      return v;
    },
  });
  EXPORT_BOOLS.forEach(boolCommand(EXPORT_OPTIONS));
  IMPORT_BOOLS.forEach(boolCommand(IMPORT_OPTIONS));

  // ---- FBXExportFrameRate: a rate (single-precision parameter), unlike the import switch of the same name
  reg({
    name: 'FBXExportFrameRate', label: 'FBXExportFrameRate', description: 'FBXExportFrameRate <float>', args: [{ name: 'Value', default: null }],
    execute(app, a) {
      const prop = fbxOptions(app, EXPORT_OPTIONS);
      if (isEmpty(a.Value)) return prop.val('ResamplingRate');
      const v = toNumber('FBXExportFrameRate', a.Value);
      prop.set('ResamplingRate', Math.fround(v)); // the parameter is a float (siFloat)
      return v;                                   // the converted argument is what comes back
    },
  });

  // ---- FBXExportScaleFactor: read-only, ignores its argument
  reg({
    name: 'FBXExportScaleFactor', label: 'FBXExportScaleFactor', description: 'FBXExportScaleFactor <float>', args: [{ name: 'Factor', default: null }],
    execute: (app) => fbxOptions(app, EXPORT_OPTIONS).val('MasterScale'),
  });

  // ---- unit commands: the nine unit names and their order are not attested (Q2)
  for (const [name, propName] of [['FBXExportUnit', EXPORT_OPTIONS], ['FBXImportUnit', IMPORT_OPTIONS]] as const) {
    reg({
      name, label: name, description: `${name} <string>`, args: [{ name: 'Unit', default: null }],
      supported: () => false,
      execute(app) {
        fbxOptions(app, propName); // the lookup-or-create side effect is attested for every option command
        throw new NotYetAttested(name, 'FBX unit table (names and order of the nine predefined units)', 'Q2');
      },
    });
  }

  // ---- FBXExportGroupAsCache
  reg({
    name: 'FBXExportGroupAsCache', label: 'FBXExportGroupAsCache', description: 'FBXExportGroupAsCache <string>', args: [{ name: 'Group', default: null }],
    execute(app, a) {
      const prop = fbxOptions(app, EXPORT_OPTIONS);
      if (isEmpty(a.Group)) throw new NotYetAttested('FBXExportGroupAsCache', 'text returned when reading GroupToCache', 'Q4');
      // The stored value is the position of the matching group, 0 when nothing matches. With fewer than
      // two groups that is 0 either way; with more, it depends on the enumeration order of the groups.
      if (app.scene.groupList.length > 1) throw new NotYetAttested('FBXExportGroupAsCache', 'group enumeration order with two or more groups', 'special cases / golden 5');
      prop.set('GroupToCache', 0);
      return String(a.Group);
    },
  });

  // ---- FBXImportNamespaceReplacement
  reg({
    name: 'FBXImportNamespaceReplacement', label: 'FBXImportNamespaceReplacement', description: 'FBXImportNamespaceReplacement <string>', args: [{ name: 'Regex', default: null }],
    execute(app, a) {
      const prop = fbxOptions(app, IMPORT_OPTIONS);
      if (isEmpty(a.Regex)) {
        const v = prop.val('NameSpaceReplacement');
        if (v === null || v === undefined) throw new NotYetAttested('FBXImportNamespaceReplacement', 'default of NameSpaceReplacement', 'Q5');
        return v;
      }
      const v = String(a.Regex);
      prop.set('NameSpaceReplacement', v);
      return v;
    },
  });

  // ---- FBXImportMode
  reg({
    name: 'FBXImportMode', label: 'FBXImportMode', description: 'FBXImportMode <kExclusiveMerge | kMerge | kCreate>', args: [{ name: 'Mode', default: null }],
    execute(app, a) {
      const prop = fbxOptions(app, IMPORT_OPTIONS);
      if (isEmpty(a.Mode)) {
        const mode = IMPORT_MODES.find(m => m.value === prop.val('LoadMode'));
        if (!mode) throw new NotYetAttested('FBXImportMode', `text for LoadMode ${prop.val('LoadMode')} (outside 0..3)`, 'FBXImportMode table');
        return mode.text;
      }
      const text = String(a.Mode);
      const mode = IMPORT_MODES.find(m => m.accepts.includes(text.toLowerCase()));
      prop.set('LoadMode', mode ? mode.value : 2);
      return text; // the argument as given, not the canonical text
    },
  });

  // ---- information commands
  reg({ name: 'FBXGetPluginVersion', label: 'FBXGetPluginVersion', description: 'GetFBXPluginVersion', args: [], execute: () => '2015.0' });
  reg({ name: 'FBXGetSDKVersion', label: 'FBXGetSDKVersion', description: 'GetFBXSDKVersion', args: [], execute: () => String(7400) });
  reg({ name: 'FBXExportConvert2Tif', label: 'FBXExportConvert2Tif', description: '', args: [], execute: () => undefined }); // accepted no-op

  // ---- file commands. Only the `options` keyword is wired; reading and writing .fbx content is SYS-03.
  const isOptions = (v: unknown) => typeof v === 'string' && v.toLowerCase() === 'options';
  reg({
    name: 'FBXExport', label: 'FBXFileExport', description: 'FBX Export <fbx file>', args: [{ name: 'FilePathName', default: '' }],
    supported: (a) => isOptions(a.FilePathName),
    execute(app, a) {
      if (isOptions(a.FilePathName)) { fbxOptions(app, EXPORT_OPTIONS); return undefined; } // no return value, nothing exported
      throw new NotYetAttested('FBXExport', 'FBX file writing', 'SYS-03');
    },
  });
  reg({
    name: 'FBXImport', label: 'FBXFileImport', description: 'FBX Import\t<fbx file> <take nb>', args: [{ name: 'FilePathName', default: '' }, { name: 'TakeNb', default: -1 }],
    supported: (a) => isOptions(a.FilePathName),
    execute(app, a) {
      if (isOptions(a.FilePathName)) { fbxOptions(app, IMPORT_OPTIONS); return undefined; }
      throw new NotYetAttested('FBXImport', 'FBX file reading', 'SYS-03');
    },
  });
  reg({
    name: 'FBXInjectInOriginal', label: 'FBXFileInjectInOriginal', description: 'FBXInjectInOriginal <fbx file> <object>',
    args: [{ name: 'FilePathName', default: '' }, { name: 'Objects', default: null }],
    supported: () => false,
    execute() { throw new NotYetAttested('FBXInjectInOriginal', 'FBX injection', 'SYS-03'); },
  });
  reg({
    name: 'FBXInjectInCopy', label: 'FBXFileInjectInCopy', description: 'FBXInjectInCopy <fbx source file> <object> <fbx output file>',
    args: [{ name: 'SourceFilePathName', default: '' }, { name: 'Objects', default: null }, { name: 'OutputFilePathName', default: '' }],
    supported: () => false,
    execute() { throw new NotYetAttested('FBXInjectInCopy', 'FBX injection', 'SYS-03'); },
  });
}
