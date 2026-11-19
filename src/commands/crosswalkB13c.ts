// Ledger row CMD-B13c: the 11 commands of the Crosswalk dotXSI/COLLADA converter plug-in (dotXSIConverter.64.dll).
//   CreateExportCrosswalkOptions CreateExportFTKOptions CreateImportCrosswalkOptions CreateImportFTKOptions
//   CrosswalkVersion ExportCrosswalk ExportFTK ImportCrosswalk ImportFTK CrosswalkExportMatLib CrosswalkImportMatLib
// Brief: docs/ghidra/cmd-b13c-dotxsiconverter-binary.md, section 3. Original code from that prose only.
import { App } from '../core/commands';
import { Property, X3DObject } from '../core/scene';
import {
  S_OK, E_INVALIDARG, VERSION, stateOf, setStatus, failLog, logNya, text, unset, boolArg, eventGate, oldLayout,
  makeExportOptions, makeImportOptions, resolveProperty, resolveObject, findMatLib, addProp, deleteProp, runPhases, isCollada,
  EXPORT_PHASES, IMPORT_PHASES, MATLIB_EXPORT_PHASES, MATLIB_IMPORT_PHASES, type ConverterRun,
} from './crosswalkB13cShared';
import { stateOf as b11c, type ConverterCtx } from './tasksB11cShared';
import { b11b } from './tasksB11bShared';

// ------------------------------------------------------------------ Create*Options
function createOptions(C: string, type: string, flavour: 'export' | 'import') {
  return (app: App, a: Record<string, any>) => {
    const name = unset(a.arg1) || a.arg1 === '' ? type : String(a.arg1);
    let host: X3DObject | null = null;
    if (unset(a.arg0) || a.arg0 === '') host = app.scene.root;
    else host = resolveObject(app, a.arg0);   // an unresolvable path creates nothing and still succeeds
    setStatus(app, C, S_OK);
    if (!host) return null;
    const p = flavour === 'export' ? makeExportOptions(app, C, type, type) : makeImportOptions(app, C, type, type);
    addProp(app, host, p);
    p.name = name;   // rename to the name argument (inferred: the rename argument is the property-name argument)
    return p;
  };
}

// ------------------------------------------------------------------ internal converters (note 2.5)
function internalExport(app: App, C: string, prop: Property, file: string): number {
  const verbose = !!prop.val('Verbose'); const format = Number(prop.val('Format'));
  const run: ConverterRun = { kind: 'export', file, format, phases: [], property: prop, status: S_OK };
  runPhases(app, C, run, EXPORT_PHASES, verbose);
  logNya(app, C, `the dotXSI / COLLADA scene converters and writer; "${file}" is not written`);
  stateOf(app).lastFileName = file;   // inferred: an export also sets the "last used file name"
  return S_OK;
}
function internalImport(app: App, C: string, prop: Property, file: string, parent: any): number {
  const st = stateOf(app);
  const collada = isCollada(file);
  st.lastFileName = file;   // remembered for the next options property
  const verbose = !!prop.val('Verbose'); void prop.val('OptimizeForXSI');
  const fps = app.anim.fps; const fmt = (app.anim as any).timeFormat;   // PlayControl.Rate / Format read before
  const run: ConverterRun = { kind: 'import', file, collada, phases: [], property: prop, status: S_OK };
  runPhases(app, C, run, IMPORT_PHASES, verbose);
  logNya(app, C, `the ${collada ? 'COLLADA' : 'dotXSI'} reader and scene converters; nothing is imported from "${file}" under ${text(parent) || 'the scene root'}`);
  if (prop.val('ImportTimelineSettings')) logNya(app, C, 'the file\'s frame format / rate (reader unread); the timeline is kept');
  app.anim.fps = fps; (app.anim as any).timeFormat = fmt;   // restored after
  return S_OK;
}

// ------------------------------------------------------------------ converter events (CrosswalkExportCustomFile / CrosswalkImportCustomFile)
function exportEvent(app: App) {
  return (ctx: ConverterCtx): number => {
    const C = 'CrosswalkExportCustomFile';
    if ((ctx as any).fileType === 2) { logNya(app, C, 'CrosswalkExportCustomFileFromModel (FileType 2)'); return S_OK; }
    logNya(app, C, 'CrosswalkPreProcessUserDataOnExport; UserData is used as given');
    const ud = Array.isArray(ctx.userData) ? ctx.userData : [ctx.userData];
    const prop = resolveProperty(app, ud[0]);
    if (!prop) { app.logMsg('error', `Invalid export properties: <${text(ud[0])}>`); return E_INVALIDARG; }   // inferred: same text as the command
    const sel = [...app.selection];
    const swap = !!prop.val('ExportSelectionOnly') && ctx.target.length > 0 && (ctx.target.length !== sel.length || ctx.target.some(t => !sel.includes(t)));
    if (swap) app.select(ctx.target);
    try { return internalExport(app, C, prop, ctx.fileName); } finally { if (swap) app.select(sel); }
  };
}
function importEvent(app: App) {
  return (file: string, fileType: number, _frame: number, userData: any, ctx: { target: any }) => {
    const C = 'CrosswalkImportCustomFile';
    if (fileType === 2) { logNya(app, C, 'CrosswalkImportCustomFileFromModel (FileType 2)'); return undefined; }
    logNya(app, C, 'CrosswalkPreProcessUserDataOnImport; UserData is used as given');
    const ud = Array.isArray(userData) ? userData : [userData];
    const prop = resolveProperty(app, ud[0]);
    if (!prop) { app.logMsg('error', `Invalid import properties: <${text(ud[0])}>`); return undefined; }
    internalImport(app, C, prop, file, ctx.target);
    return undefined;
  };
}

// ------------------------------------------------------------------ ExportCrosswalk / ExportFTK
const exportCrosswalk = (C: string) => (app: App, a: Record<string, any>) => {
  const prop = resolveProperty(app, a.arg0);
  if (!prop) throw failLog(app, C, E_INVALIDARG, `Invalid export properties: <${text(a.arg0)}>`);
  let file = String(prop.val('Filename') ?? ''); const format = Number(prop.val('Format'));
  if ([0, 2, 3, 4].includes(format)) { if (!/\.xsi$/i.test(file)) file += '.xsi'; }
  else if (format === 1) { if (!/\.(dae|xml)$/i.test(file)) file += '.dae'; }
  if (!eventGate(app)) { setStatus(app, C, internalExport(app, C, prop, file)); return; }
  // new layout: (filename, <empty>, <arguments>); the old 7.x layout inserts one more empty argument. This build's
  // ExportCustomFile is (FileName, Target, Frame, UserData): the argument array goes to UserData in both layouts.
  const args = { FileName: file, Target: null, Frame: null, UserData: [a.arg0] };
  stateOf(app).customFileCalls.push({ command: 'ExportCustomFile', args: oldLayout(app) ? [file, null, null, [a.arg0]] : [file, null, [a.arg0]] });
  app.run('ExportCustomFile', args);   // its failure status is returned as is
  setStatus(app, C, S_OK);
};

// ------------------------------------------------------------------ ImportCrosswalk / ImportFTK
const importCrosswalk = (C: string) => (app: App, a: Record<string, any>) => {
  const prop = resolveProperty(app, a.ppg);
  if (!prop) throw failLog(app, C, E_INVALIDARG, `Invalid import properties: <${text(a.ppg)}>`);
  const file = String(prop.val('Filename') ?? '');
  if (!eventGate(app)) { setStatus(app, C, internalImport(app, C, prop, file, a.parent)); return; }
  const parent = text(a.parent);
  stateOf(app).customFileCalls.push({ command: 'ImportCustomFile', args: oldLayout(app) ? [file, parent, 0, null, [a.ppg, a.parent]] : [file, parent, 0, null, null, [a.ppg, a.parent]] });
  app.run('ImportCustomFile', { FileName: file, Target: parent || null, Reference: 0, Name: null, Frame: null, UserData: [a.ppg, a.parent] });
  setStatus(app, C, S_OK);
};

// ------------------------------------------------------------------ CrosswalkExportMatLib / CrosswalkImportMatLib
function exportMatLib(app: App, a: Record<string, any>) {
  const C = 'CrosswalkExportMatLib';
  const root = app.scene.root; const file = text(a.Filename); const name = text(a.MatLib);
  const tmp = makeExportOptions(app, C, 'ExportCrosswalkOptions', 'ExportCrosswalkOptions'); addProp(app, root, tmp);
  tmp.set('Filename', file); tmp.set('Format', boolArg(a.Binary, false) ? 4 : 3);   // no extension forced on this path
  tmp.set('MatLib_ExportUsedImageClipsOnly', boolArg(a.ExportUsedImageClipsOnly, true));
  const lib = findMatLib(app, name);
  if (!lib) { deleteProp(app, root, tmp); throw failLog(app, C, E_INVALIDARG, `Invalid material library: <${name}>`); }
  const run: ConverterRun = { kind: 'matlib-export', file, format: Number(tmp.val('Format')), phases: [], property: tmp, library: lib.name, status: S_OK };
  runPhases(app, C, run, MATLIB_EXPORT_PHASES, true);
  logNya(app, C, `the dotXSI material-library writer; "${file}" is not written`);
  deleteProp(app, root, tmp);
  setStatus(app, C, S_OK);
}
function importMatLib(app: App, a: Record<string, any>) {
  const C = 'CrosswalkImportMatLib';
  const root = app.scene.root; const file = text(a.Filename); const name = text(a.MatLib);
  const tmp = makeImportOptions(app, C, 'ImportCrosswalkOptions', 'ImportCrosswalkOptions'); addProp(app, root, tmp);
  tmp.set('Filename', file); tmp.set('ImportTimelineSettings', false);
  const lib = findMatLib(app, name);   // not validated
  if (!lib) logNya(app, C, `an import into a material library that does not exist ("${name}")`);
  const fps = app.anim.fps; const fmt = (app.anim as any).timeFormat;
  const run: ConverterRun = { kind: 'matlib-import', file, phases: [], property: tmp, library: lib?.name ?? null, status: S_OK };
  runPhases(app, C, run, MATLIB_IMPORT_PHASES, false);
  logNya(app, C, `the dotXSI material-library reader; nothing is imported from "${file}"`);
  app.anim.fps = fps; (app.anim as any).timeFormat = fmt;
  deleteProp(app, root, tmp);
  setStatus(app, C, S_OK);
}

export function registerCrosswalkB13cCommands(app: App) {
  const st = stateOf(app);
  const reg = (name: string, args: { name: string; default?: any }[], execute: (app: App, a: Record<string, any>) => any, description: string, undoable = true) =>
    app.register({ name, label: name, category: 'File|Crosswalk', description, args, undoable, execute });
  const optArgs = (dflt: string) => [{ name: 'arg0', default: '' }, { name: 'arg1', default: dflt }];
  reg('CreateExportCrosswalkOptions', optArgs('ExportCrosswalkOptions'), createOptions('CreateExportCrosswalkOptions', 'ExportCrosswalkOptions', 'export'), 'Creates an ExportCrosswalkOptions property.');
  reg('CreateExportFTKOptions', optArgs('ExportFTKOptions'), createOptions('CreateExportFTKOptions', 'ExportFTKOptions', 'export'), 'Creates an ExportFTKOptions property.');
  reg('CreateImportCrosswalkOptions', optArgs('ImportCrosswalkOptions'), createOptions('CreateImportCrosswalkOptions', 'ImportCrosswalkOptions', 'import'), 'Creates an ImportCrosswalkOptions property.');
  reg('CreateImportFTKOptions', optArgs('ImportFTKOptions'), createOptions('CreateImportFTKOptions', 'ImportFTKOptions', 'import'), 'Creates an ImportFTKOptions property.');
  reg('CrosswalkVersion', [], (app) => { setStatus(app, 'CrosswalkVersion', S_OK); return VERSION; }, 'Returns the Crosswalk plug-in version.', false);
  reg('ExportCrosswalk', [{ name: 'arg0', default: '' }], exportCrosswalk('ExportCrosswalk'), 'Exports a dotXSI / COLLADA file with an export options property.', false);
  reg('ExportFTK', [{ name: 'arg0', default: '' }], exportCrosswalk('ExportFTK'), 'Same as ExportCrosswalk.', false);
  reg('ImportCrosswalk', [{ name: 'ppg', default: '' }, { name: 'parent' }], importCrosswalk('ImportCrosswalk'), 'Imports a dotXSI / COLLADA file with an import options property.');
  reg('ImportFTK', [{ name: 'ppg', default: '' }, { name: 'parent' }], importCrosswalk('ImportFTK'), 'Same as ImportCrosswalk.');
  reg('CrosswalkExportMatLib', [{ name: 'Filename', default: '' }, { name: 'MatLib', default: '' }, { name: 'Binary', default: false }, { name: 'ExportUsedImageClipsOnly', default: true }],
    exportMatLib, 'Exports a material library to a dotXSI file.', false);
  reg('CrosswalkImportMatLib', [{ name: 'Filename', default: '' }, { name: 'MatLib', default: '' }], importMatLib, 'Imports a dotXSI material library.');
  // converter events (only when the event-path gate is on)
  if (eventGate(app)) {
    const ex = b11c(app), im = b11b(app);
    for (const e of ['DAE', 'XML', 'XSI']) { ex.registerCustomConverter(e, `CrosswalkExportCustomFile${e}`, exportEvent(app)); st.registered.exportExt.push(e); }
    const h = importEvent(app);
    for (const e of ['DAE', 'XML', 'XSI', 'XSIML']) { im.converters.set(e.toLowerCase(), h); st.registered.importExt.push(e); }
  }
}
