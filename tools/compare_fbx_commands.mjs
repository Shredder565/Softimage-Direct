// CMD-01a: FBX import / export command family on the command bus.
// Checked against the contract tables in docs/ghidra/cmd-01a-fbx.md and the registry dump
// data/commands_full.json. There is no XSIBATCH golden for this row yet (data/dump has no FBX dump),
// so this is a contract check, not a golden compare.
// Needs `vite preview` on :4173 (or SI_URL). Usage: node tools/compare_fbx_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

// ---------------------------------------------------------------- contract tables (transcribed from the note)
const U = '<unset>'; // no attested default
const EXPORT_DEFAULTS = [
  ['Automatic', true], ['MasterScale', 1], ['MasterUnitIndex', U], ['ExportSelection', false], ['ExportGeometry', true],
  ['ExportCameras', true], ['ExportLights', true], ['ExportShapes', true], ['ExportSkins', true], ['ExportHardEdges', true],
  ['ExportAnimation', true], ['ResamplingRate', 30], ['AsciiFBX', false], ['EmbedTextures', false], ['ConvertImageFormat', false],
  ['ImageFormat', 'tiff'], ['ShowWarningDialog', true], ['BindPose', true], ['ExportShowWarningDialog', true],
  ['ExportKeepXsiEffectors', false], ['ExportDeformerAsSkeleton', false], ['ExportFilename', ''], ['BoneSize', 10], ['Info', 0],
  ['GeometryCacheFile', false], ['GroupToCache', U], ['FBXSDKVersion', 'FBX201400'], ['ExportOneClickMode', false],
  ['ExportVisibilityAsShow', false], ['ExportShapeNamespace', false],
];
const IMPORT_DEFAULTS = [
  ['UseMatrixFromBindPose', false], ['LoadMode', 2], ['Automatic', true], ['FileScaleFactor', U], ['MasterScale', 1],
  ['MasterUnitIndex', U], ['ImportCameras', true], ['ImportLights', true], ['ImportMaterialsAndTextures', true],
  ['ImportAnimation', true], ['ShowWarningDialog', true], ['ResamplingRate', 30],
  ['ConstantKeyReducer', U], ['KeyReducer', U], ['KeySync', U], ['KeysOnFrame', U], ['UnRoll', U], ['UnRollPath', U], ['Character', U],
  ['KeyReducerPrecision', U], ['UnRollQuality', U],
  ['ImportSkelsAsNulls', true], ['KeepXsiEffectors', true], ['ImportSkins', true], ['ForceWeightNormalize', false],
  ['ProtectExpressionFCurve', false], ['NameSpaceReplacement', U], ['ImportFilename', ''], ['Take', 1], ['Info', 0],
  ['ImportHardEdges', false], ['GeometryCacheFile', true], ['ImportFrameRate', false], ['ImportFillTimeline', false],
  ['ImportOneClickMerge', false], ['ImportMudboxMergeTexture', false], ['ImportOneClickAdd', false], ['ImportOneClickMode', false],
  ['ImportNullsAsModels', false], ['StripShapeNamespace', false], ['UnbiasNormalMaps', true],
];
// command → parameter
const EXPORT_BOOLS = {
  FBXExportAscii: 'AsciiFBX', FBXExportAutomaticUnit: 'Automatic', FBXExportAnimation: 'ExportAnimation', FBXExportCameras: 'ExportCameras',
  FBXExportLights: 'ExportLights', FBXExportSelection: 'ExportSelection', FBXExportGeometries: 'ExportGeometry', FBXExportSkins: 'ExportSkins',
  FBXExportShapes: 'ExportShapes', FBXExportHardEdges: 'ExportHardEdges', FBXExportCacheFile: 'GeometryCacheFile',
  FBXExportKeepXSIEffectors: 'ExportKeepXsiEffectors', FBXExportDeformerAsSkeleton: 'ExportDeformerAsSkeleton', FBXExportEmbedMedias: 'EmbedTextures',
};
const IMPORT_BOOLS = {
  FBXImportAutomaticUnit: 'Automatic', FBXImportAnimation: 'ImportAnimation', FBXImportCameras: 'ImportCameras', FBXImportLights: 'ImportLights',
  FBXImportSetEnvelopes: 'ImportSkins', FBXImportHardEdges: 'ImportHardEdges', FBXImportCacheFile: 'GeometryCacheFile',
  FBXImportFrameRate: 'ImportFrameRate', FBXImportFillTimeline: 'ImportFillTimeline', FBXImportSkeletonsAsNulls: 'ImportSkelsAsNulls',
  FBXImportKeepXSIEffectors: 'KeepXsiEffectors', FBXImportForceNormEnvelope: 'ForceWeightNormalize', FBXImportProtectExprDrivenFC: 'ProtectExpressionFCurve',
};
// [argument, LoadMode written]
const MODE_SET = [
  ['Exclusive merge', 0], ['Update animation', 0], ['Merge', 1], ['Add and update animation', 1],
  ['Import Action Only', 3], ['Import as Action Source', 3], ['Add', 2],
  ['kExclusiveMerge', 2], ['kMerge', 2], ['kCreate', 2], ['xyz', 2], ['MERGE', 1], ['update ANIMATION', 0],
];
const MODE_GET = { 0: 'Update animation', 1: 'Add and update animation', 2: 'Add', 3: 'Import as Action Source' };

// ---------------------------------------------------------------- registry dump
const registry = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/commands_full.json'), 'utf8'))
  .filter(c => /\\FBXXSI\.64\.dll$/i.test(c.file || ''))
  .map(c => ({ scripting: c.scripting_name, name: c.name, category: c.category, args: c.args.map(a => ({ name: a.name, default: a.default })) }));

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1000);

const got = await page.evaluate(({ registry, EXPORT_BOOLS, IMPORT_BOOLS, MODE_SET }) => {
  const A = window.Application;
  const U = '<unset>';
  const prop = n => A.scene.root.properties.find(p => p.name === n);
  const dump = n => { const p = prop(n); return p ? p.params.map(q => [q.name, q.value === null || q.value === undefined ? U : q.value]) : null; };
  const run = (name, args) => { try { const v = A.run(name, args ?? {}); return { v: v === undefined ? '<none>' : v }; } catch (e) { return { err: String(e?.message ?? e), nya: e?.notYetAttested === true }; } };
  const val = (pn, param) => { const v = prop(pn)?.val(param); return v === null || v === undefined ? U : v; };
  const out = {};

  // 1. registration against the registry dump
  out.registration = registry.map(c => {
    const d = A.commands.get(c.scripting);
    return { scripting: c.scripting, found: !!d, label: d?.label, category: d?.category, args: d?.args.map(a => ({ name: a.name, default: a.default === undefined ? null : a.default })) };
  });

  // 2. fresh scene: no option property until an option command runs; then defaults
  A.run('NewScene');
  out.freshExport = dump('ExportFBXOptions'); out.freshImport = dump('ImportFBXOptions');
  out.firstExportGet = run('FBXExportAscii');
  out.importAfterExportGet = dump('ImportFBXOptions');
  out.exportDefaults = dump('ExportFBXOptions');
  out.exportPropType = prop('ExportFBXOptions')?.type;
  out.firstImportGet = run('FBXImportCameras');
  out.importDefaults = dump('ImportFBXOptions');
  out.importPropType = prop('ImportFBXOptions')?.type;
  out.optionPropCount = A.scene.root.properties.filter(p => /FBXOptions$/.test(p.name)).length;

  // 3. every bool command: get, set false, get, set true, get, plus the text / numeric forms
  const bools = (table, pn) => Object.entries(table).map(([cmd, param]) => {
    const arg = A.commands.get(cmd).args[0].name;
    const step = v => { const r = run(cmd, v === undefined ? {} : { [arg]: v }); return [r.v ?? r.err, val(pn, param)]; };
    return { cmd, param, steps: [step(), step(false), step(), step(true), step(), step('false'), step('True'), step(0), step(1), step('0'), step('')] };
  });
  out.exportBools = bools(EXPORT_BOOLS, 'ExportFBXOptions');
  out.importBools = bools(IMPORT_BOOLS, 'ImportFBXOptions');
  // a bool command touches only its own parameter
  A.run('NewScene');
  run('FBXExportAscii', { State: true }); run('FBXImportHardEdges', { State: true });
  out.afterOneSetExport = dump('ExportFBXOptions'); out.afterOneSetImport = dump('ImportFBXOptions');
  out.badBool = run('FBXExportAscii', { State: 'maybe' });

  // 4. FBXImportMode
  A.run('NewScene');
  out.modeDefault = run('FBXImportMode');
  out.modeSet = MODE_SET.map(([text]) => { const r = run('FBXImportMode', { Mode: text }); return [text, r.v ?? r.err, val('ImportFBXOptions', 'LoadMode'), run('FBXImportMode').v]; });

  // 5. information commands
  out.pluginVersion = run('FBXGetPluginVersion'); out.sdkVersion = run('FBXGetSDKVersion');
  A.run('NewScene');
  out.convert2Tif = run('FBXExportConvert2Tif');
  out.convert2TifCreated = !!prop('ExportFBXOptions') || !!prop('ImportFBXOptions');

  // 6. FBXExportFrameRate and FBXExportScaleFactor
  out.rate = [run('FBXExportFrameRate'), run('FBXExportFrameRate', { Value: 24 }), val('ExportFBXOptions', 'ResamplingRate'), run('FBXExportFrameRate'),
    run('FBXExportFrameRate', { Value: '29.97' }), val('ExportFBXOptions', 'ResamplingRate'), run('FBXExportFrameRate')];
  out.scale = [run('FBXExportScaleFactor'), run('FBXExportScaleFactor', { Factor: 5 }), val('ExportFBXOptions', 'MasterScale'), run('FBXExportScaleFactor')];

  // 7. file commands: the `options` keyword
  A.run('NewScene');
  out.exportOptions = run('FBXExport', { FilePathName: 'options' });
  out.exportOptionsState = [!!prop('ExportFBXOptions'), !!prop('ImportFBXOptions')];
  out.importOptions = run('FBXImport', { FilePathName: 'OPTIONS' });
  out.importOptionsState = [!!prop('ExportFBXOptions'), !!prop('ImportFBXOptions')];
  out.importOptionsDefaults = dump('ImportFBXOptions');

  // 8. FBXImportNamespaceReplacement
  out.ns = [run('FBXImportNamespaceReplacement'), run('FBXImportNamespaceReplacement', { Regex: '^ns:(.*)$' }), val('ImportFBXOptions', 'NameSpaceReplacement'), run('FBXImportNamespaceReplacement')];

  // 9. FBXExportGroupAsCache
  A.run('NewScene');
  out.groupGet = run('FBXExportGroupAsCache');
  out.groupNoGroups = [run('FBXExportGroupAsCache', { Group: 'nothing' }), val('ExportFBXOptions', 'GroupToCache')];
  A.run('GetPrim', { PresetObj: 'Null', Name: 'n1' }); A.run('CreateGroup', { Name: 'cacheA', InputObjs: [A.scene.find('n1')] });
  out.groupOne = [run('FBXExportGroupAsCache', { Group: 'cacheA' }), val('ExportFBXOptions', 'GroupToCache'), run('FBXExportGroupAsCache', { Group: 'miss' }), val('ExportFBXOptions', 'GroupToCache')];
  A.run('CreateGroup', { Name: 'cacheB', InputObjs: [A.scene.find('n1')] });
  out.groupTwo = run('FBXExportGroupAsCache', { Group: 'cacheB' });

  // 10. branches that must raise "not yet attested"
  A.run('NewScene');
  out.unattested = {
    FBXExportUnit_get: run('FBXExportUnit'), FBXExportUnit_set: run('FBXExportUnit', { Unit: 'Meters' }),
    FBXImportUnit_get: run('FBXImportUnit'), FBXImportUnit_set: run('FBXImportUnit', { Unit: 'Meters' }),
    FBXExport_path: run('FBXExport', { FilePathName: 'C:\\temp\\a.fbx' }), FBXExport_browse: run('FBXExport'),
    FBXImport_path: run('FBXImport', { FilePathName: 'C:\\temp\\a.fbx' }), FBXImport_browse: run('FBXImport'),
    FBXInjectInOriginal: run('FBXInjectInOriginal', { FilePathName: 'C:\\temp\\a.fbx' }),
    FBXInjectInCopy: run('FBXInjectInCopy', { SourceFilePathName: 'a.fbx', OutputFilePathName: 'b.fbx' }),
  };
  out.unitSideEffect = [!!prop('ExportFBXOptions'), !!prop('ImportFBXOptions')];
  out.supported = Object.fromEntries(['FBXExportUnit', 'FBXImportUnit', 'FBXInjectInOriginal', 'FBXInjectInCopy', 'FBXExport', 'FBXImport', 'FBXExportAscii']
    .map(n => { const d = A.commands.get(n); return [n, d.supported ? [!!d.supported({ FilePathName: 'options' }), !!d.supported({ FilePathName: 'x.fbx' })] : 'always']; }));

  // 11. positional call through ExecuteCommand; new scene drops the options; nothing went on the undo stack
  out.positional = [A.ExecuteCommand('FBXExportLights', [false]), A.ExecuteCommand('FBXExportLights', [])];
  // (NewScene empties the undo stack, so count before it: only GetPrim / CreateGroup style entries may be there)
  A.run('GetPrim', { PresetObj: 'Null', Name: 'undoProbe' });
  const before = A.undoStack.length;
  run('FBXExportAscii', { State: true }); run('FBXImportMode', { Mode: 'Merge' }); run('FBXExport', { FilePathName: 'options' });
  out.undoGrowth = A.undoStack.length - before;
  A.run('NewScene');
  out.afterNewScene = [!!prop('ExportFBXOptions'), !!prop('ImportFBXOptions')];
  return out;
}, { registry, EXPORT_BOOLS, IMPORT_BOOLS, MODE_SET });
await b.close();

// ---------------------------------------------------------------- compare
const diffs = [];
let checks = 0;
const eq = (label, g, want) => { checks++; if (JSON.stringify(g) !== JSON.stringify(want)) diffs.push(`${label}: want ${JSON.stringify(want)} got ${JSON.stringify(g)}`); };
const nya = (label, r) => { checks++; if (!r || r.nya !== true || !/^not yet attested: /.test(r.err || '')) diffs.push(`${label}: want a "not yet attested" error, got ${JSON.stringify(r)}`); };

// 1
eq('registry: FBXXSI commands in dump', registry.length, 42);
for (const c of registry) {
  const g = got.registration.find(x => x.scripting === c.scripting);
  eq(`${c.scripting} registered`, g.found, true);
  if (!g.found) continue;
  if (c.scripting === 'FBXImportScaleFactor') continue; // not part of CMD-01a (older stub, not specified in the note)
  eq(`${c.scripting} command name`, g.label, c.name);
  eq(`${c.scripting} category`, g.category, c.category);
  eq(`${c.scripting} arguments`, g.args, c.args);
}
// 2
eq('fresh scene has no ExportFBXOptions', got.freshExport, null);
eq('fresh scene has no ImportFBXOptions', got.freshImport, null);
eq('first export getter returns the default', got.firstExportGet, { v: false });
eq('export getter does not create ImportFBXOptions', got.importAfterExportGet, null);
eq('ExportFBXOptions defaults, definition order', got.exportDefaults, EXPORT_DEFAULTS);
eq('ExportFBXOptions type', got.exportPropType, 'ExportFBXOptions');
eq('first import getter returns the default', got.firstImportGet, { v: true });
eq('ImportFBXOptions defaults, definition order', got.importDefaults, IMPORT_DEFAULTS);
eq('ImportFBXOptions type', got.importPropType, 'ImportFBXOptions');
eq('one property of each kind', got.optionPropCount, 2);
// 3
const boolCheck = (rows, defaults, table) => {
  eq('bool command count', rows.length, Object.keys(table).length);
  for (const r of rows) {
    const d = defaults.find(x => x[0] === r.param)[1];
    //            get      set false       get             set true      get           'false'         'True'        0               1             '0'             ''(get)
    eq(`${r.cmd} → ${r.param}`, r.steps, [[d, d], [false, false], [false, false], [true, true], [true, true], [false, false], [true, true], [false, false], [true, true], [false, false], [false, false]]);
  }
};
boolCheck(got.exportBools, EXPORT_DEFAULTS, EXPORT_BOOLS);
boolCheck(got.importBools, IMPORT_DEFAULTS, IMPORT_BOOLS);
eq('FBXExportAscii writes only AsciiFBX', got.afterOneSetExport, EXPORT_DEFAULTS.map(([n, v]) => [n, n === 'AsciiFBX' ? true : v]));
eq('FBXImportHardEdges writes only ImportHardEdges', got.afterOneSetImport, IMPORT_DEFAULTS.map(([n, v]) => [n, n === 'ImportHardEdges' ? true : v]));
nya('bool from unconvertible text', got.badBool);
// 4
eq('FBXImportMode default text', got.modeDefault, { v: 'Add' });
eq('FBXImportMode set table', got.modeSet, MODE_SET.map(([text, mode]) => [text, text, mode, MODE_GET[mode]]));
// 5
eq('FBXGetPluginVersion', got.pluginVersion, { v: '2015.0' });
eq('FBXGetSDKVersion', got.sdkVersion, { v: '7400' });
eq('FBXExportConvert2Tif returns nothing', got.convert2Tif, { v: '<none>' });
eq('FBXExportConvert2Tif has no effect', got.convert2TifCreated, false);
// 6
const f2997 = Math.fround(29.97);
eq('FBXExportFrameRate', got.rate, [{ v: 30 }, { v: 24 }, 24, { v: 24 }, { v: 29.97 }, f2997, { v: f2997 }]);
eq('FBXExportScaleFactor is read-only', got.scale, [{ v: 1 }, { v: 1 }, 1, { v: 1 }]);
// 7
eq('FBXExport "options" sets no return value', got.exportOptions, { v: '<none>' });
eq('FBXExport "options" creates ExportFBXOptions only', got.exportOptionsState, [true, false]);
eq('FBXImport "OPTIONS" sets no return value', got.importOptions, { v: '<none>' });
eq('FBXImport "OPTIONS" creates ImportFBXOptions', got.importOptionsState, [true, true]);
eq('ImportFBXOptions defaults via "options"', got.importOptionsDefaults, IMPORT_DEFAULTS);
// 8
nya('FBXImportNamespaceReplacement get before any set (Q5)', got.ns[0]);
eq('FBXImportNamespaceReplacement set / get', got.ns.slice(1), [{ v: '^ns:(.*)$' }, '^ns:(.*)$', { v: '^ns:(.*)$' }]);
// 9
nya('FBXExportGroupAsCache get (Q4)', got.groupGet);
eq('FBXExportGroupAsCache, no groups', got.groupNoGroups, [{ v: 'nothing' }, 0]);
eq('FBXExportGroupAsCache, one group: match and miss', got.groupOne, [{ v: 'cacheA' }, 0, { v: 'miss' }, 0]);
nya('FBXExportGroupAsCache with two groups (enumeration order)', got.groupTwo);
// 10
for (const [k, r] of Object.entries(got.unattested)) nya(k, r);
eq('unit commands still create their option property', got.unitSideEffect, [true, true]);
eq('greyed / supported state', got.supported, {
  FBXExportUnit: [false, false], FBXImportUnit: [false, false], FBXInjectInOriginal: [false, false], FBXInjectInCopy: [false, false],
  FBXExport: [true, false], FBXImport: [true, false], FBXExportAscii: 'always',
});
// 11
eq('positional set / get', got.positional, [false, false]);
eq('NewScene drops both option properties', got.afterNewScene, [false, false]);
eq('no FBX entries on the undo stack', got.undoGrowth, 0);
eq('page errors', pageErrors, []);

const wired = registry.filter(c => c.scripting !== 'FBXImportScaleFactor').length;
if (diffs.length) {
  console.error(`FAIL CMD-01a FBX commands: ${diffs.length} of ${checks} checks`);
  for (const d of diffs) console.error('  ' + d);
  process.exit(1);
}
console.log(`OK CMD-01a FBX commands: ${checks} checks, ${wired} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired: 27 bool options, FBXExportFrameRate, FBXExportScaleFactor, FBXImportMode, FBXGetPluginVersion, FBXGetSDKVersion, FBXExportConvert2Tif');
console.log('   partly wired: FBXExport / FBXImport ("options" only), FBXExportGroupAsCache (set, fewer than two groups), FBXImportNamespaceReplacement (get after a set)');
console.log('   raise "not yet attested": FBXExportUnit, FBXImportUnit, FBXInjectInOriginal, FBXInjectInCopy');
