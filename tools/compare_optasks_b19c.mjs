// CMD-B19c (optasks.dll static ICE attributes, ICE compounds, constraints, envelope locks, SwapOperators, ConnectMap,
// DeleteMotionDerivator; ophost AddScriptedOpFromFile; ConvertScriptedOp; shadertasks DisconnectAndDeleteShaders;
// propertytasks RemoveProxyParam; selectionmgr SelectBranch / SelectTree / SelectChain / SelectModel): the 26 commands
// of src/commands/optasksB19c.ts, optasksB19cIce.ts and selectionGroupLayer.ts.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b19c-optasks-ice-cns-envelope.md
// section 3 and the CMD-B19c items of docs/re/WIRE_CORRECTIONS_B19.md.
//   1. every name is registered with the catalogue argument list (data/commands_full.json), followed by the registry's
//      hidden input arguments (data/command_registry.json, flags bit 1 set, not outputs) where there are any;
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error
//      (commands whose contract fails on the defaults must fail with the contract's status);
//   3. the contract's stated results (validation and message ids, scene changes, sub-tasks, undo, outputs, the
//      "not yet attested ... CMD-B19c" logs of the open branches).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_optasks_b19c.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = [
  'AddStaticICEAttribute', 'RemoveStaticICEAttribute', 'RenameStaticICEAttribute', 'SetStaticICEAttributeType', 'ToggleICEAttributeAlwaysEvaluated',
  'CreateICECompoundNode', 'ExplodeICECompoundNode', 'ExportICECompoundNode', 'EditICECompoundProperties',
  'RemoveCnsType', 'RemoveCns', 'GetConstrainedObjects', 'LockEnvelopePointWeights', 'ClearEnvelopeWeightLocks', 'RemoveFlexEnv',
  'SwapOperators', 'ConnectMap', 'DeleteMotionDerivator', 'RemoveProxyParam', 'DisconnectAndDeleteShaders', 'AddScriptedOpFromFile', 'ConvertScriptedOp',
  'SelectBranch', 'SelectTree', 'SelectChain', 'SelectModel',
];
/** Default runs that must fail, with the contract's status (cube selected, nothing else given). */
const DEFAULT_FAILS = {
  RenameStaticICEAttribute: '80070057',      // zero names
  CreateICECompoundNode: '80070057',         // no ICE nodes: message 0x173
  ExplodeICECompoundNode: '80004005',        // the cube is not a compound: message 0x1c3
  RemoveCnsType: '80004005',                 // "" is no constraint type name (SIGetKineCnsIDFromName)
  ClearEnvelopeWeightLocks: '80004003',      // no envelope weight property
  SwapOperators: '80070057',                 // no operators
  DisconnectAndDeleteShaders: '80070057',    // no shader
  AddScriptedOpFromFile: '80070057',         // no FileName
  ConvertScriptedOp: '80070057',             // no scripted operator
};
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n);
  const r = reg.find(x => x.scripting_name === n);
  const hidden = (r?.args ?? []).filter(a => (a.flags & 1) && !(a.flags & 512)).map(a => [a.name, a.default ?? null]);
  return [n, f ? [...f.args.map(a => [a.name, a.default ?? null]), ...hidden] : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('ConvertScriptedOp') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false;
  const S = A.optasksB19c; const api = S.api; const B12 = A.optasksB12;
  const out = { reg: {}, defaults: {}, checks: [] };
  const safe = d => { try { return JSON.stringify(d, (k, v) => v && typeof v === 'object' && 'fullName' in v ? v.fullName : v); } catch { return String(d); } };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : safe(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); return { v, log: A.log.slice(m).filter(l => l.kind !== 'cmd').map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested.*CMD-B19c/);
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const st = n => S.status[n];
  const cube = A.scene.find('cube');
  const reset = () => { A.setTool?.(null); A.compSel = null; A.select([cube]); };
  const names = l => l.map(x => x.name);
  const J = JSON.stringify;
  const subs = (from, task) => S.subtasks.slice(from).filter(s => !task || s.task === task);

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    const want = DEFAULT_FAILS[n];
    out.defaults[n] = r.err ? (want && status(r, want) ? 'expected-failure' : 'ERROR: ' + r.err) : (want ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  const mk = (preset, name) => { A.run('CreatePrim', { PresetObj: preset, GeometryType: 'MeshSurface', Name: name }); return A.scene.find(name); };
  const nul = (name, x = 0) => { A.run('GetPrim', { PresetObj: 'Null', Name: name }); const o = A.scene.find(name); o.kinematics.local.set('posx', x); return o; };

  // ================= static ICE attributes
  try {
    const g = mk('Sphere', 'b19Attr'); reset();
    const T = api.attributeTable(g.primitive); const def = n => T.defs.find(d => d.name === n);
    const geom = g.primitive.fullName;
    let c0 = S.opCacheClears; let u0 = A.undoStack.length;
    let r = run('AddStaticICEAttribute', { Object: g, AttributeName: 'Foo,Bar', AttributeType: 'siComponentDataTypeVector3', AttributeContext: 'siComponentDataContextComponent0D' });
    ok('AddStaticICEAttribute: comma list, both defined persisted on the geometry of Object (not the selection)', !r.err && def('Foo')?.persisted && def('Bar')?.desc.type === 16 && def('Foo').desc.context === 2 && def('Foo').desc.structure === 1 && T.multiData, r);
    ok('AddStaticICEAttribute: geometry dirty + F3DClearEvolveOpCache once, one undo step', S.opCacheClears === c0 + 1 && A.undoStack.length === u0 + 1 && !cube.properties.some(p => p.type === 'iceattr'));
    A.undo(); ok('AddStaticICEAttribute undo removes the added names', !def('Foo') && !def('Bar'));
    A.redo(); ok('AddStaticICEAttribute redo re-adds them', !!def('Foo') && !!def('Bar'));
    r = run('AddStaticICEAttribute', { Object: g, AttributeName: 'Foo' });
    ok('AddStaticICEAttribute: existing static name -> 0x435 "<geometry>.<attr>", 0x80070057', status(r, '80070057') && has(r, new RegExp(`\\[XSIOPTASKS 0x435\\] ${geom.replace(/\./g, '\\.')}\\.Foo`)), r);
    r = run('AddStaticICEAttribute', { Object: g, AttributeName: 'PointPosition' });
    ok('AddStaticICEAttribute: a non-persisted attribute owned by the geometry data -> 0x435', status(r, '80070057') && has(r, /0x435\] .*PointPosition/), r);
    for (const [t, v] of [['Geometry', 1024], ['Execute', 4096], ['Reference', 8192], ['None', 0], ['3 bits', 3]]) {
      r = run('AddStaticICEAttribute', { Object: g, AttributeName: 'T1', AttributeType: v });
      ok(`AddStaticICEAttribute: AttributeType ${t} (${v}) rejected, 0x431`, status(r, '80070057') && has(r, /\[XSIOPTASKS 0x431\]/) && !def('T1'), r);
    }
    r = run('AddStaticICEAttribute', { Object: g, AttributeName: 'T1', AttributeContext: 64 }); ok('AddStaticICEAttribute: AttributeContext 64 rejected, 0x432', status(r, '80070057') && has(r, /0x432/), r);
    r = run('AddStaticICEAttribute', { Object: g, AttributeName: 'T1', AttributeStructure: 4 }); ok('AddStaticICEAttribute: AttributeStructure 4 rejected, 0x433', status(r, '80070057') && has(r, /0x433/), r);
    r = run('AddStaticICEAttribute', { Object: g, AttributeName: 'Ctx', AttributeContext: 0x100000, AttributeType: 2048 });
    ok('AddStaticICEAttribute: context 0x100000 and type Location accepted', !r.err && def('Ctx')?.desc.context === 0x100000 && def('Ctx').desc.type === 2048, r);
    r = run('AddStaticICEAttribute', { Object: g, AttributeName: 'Txt', AttributeType: 'siComponentDataTypeString' });
    ok('AddStaticICEAttribute: a String type marks the sub-type list', !r.err && def('Txt')?.desc.stringSub === true, r);
    // Remove
    r = run('RemoveStaticICEAttribute', { Object: g, AttributeName: 'PointPosition' });
    ok('RemoveStaticICEAttribute: non-persisted -> 0x434, 0x80070057', status(r, '80070057') && has(r, /0x434\] .*PointPosition/), r);
    r = run('RemoveStaticICEAttribute', { Object: g, AttributeName: 'Nope' }); ok('RemoveStaticICEAttribute: unknown -> 0x434', status(r, '80070057') && has(r, /0x434/), r);
    def('Bar').owners = 2; r = run('RemoveStaticICEAttribute', { Object: g, AttributeName: 'Bar' }); def('Bar').owners = 1;
    ok('RemoveStaticICEAttribute: owner count != 1 -> 0x437', status(r, '80070057') && has(r, /0x437\] .*Bar/) && !!def('Bar'), r);
    r = run('RemoveStaticICEAttribute', { Object: g, AttributeName: 'Foo,Bar' });
    ok('RemoveStaticICEAttribute: both removed, old descriptors kept for undo', !r.err && !def('Foo') && !def('Bar') && S.out.RemoveStaticICEAttribute.removed.length === 2, r);
    A.undo(); ok('RemoveStaticICEAttribute undo re-adds them with their descriptors', def('Foo')?.desc.type === 16 && !!def('Bar'));
    // Rename
    r = run('RenameStaticICEAttribute', { Object: g, AttributeName: 'Foo,Bar', NewName: 'X' });
    ok('RenameStaticICEAttribute: two names -> 0x80070057, no message', status(r, '80070057') && !has(r, /XSIOPTASKS/), r);
    r = run('RenameStaticICEAttribute', { Object: g, AttributeName: 'PointNormal', NewName: 'X' }); ok('RenameStaticICEAttribute: non-persisted -> 0x434', status(r, '80070057') && has(r, /0x434/), r);
    r = run('RenameStaticICEAttribute', { Object: g, AttributeName: 'Foo', NewName: '1bad name' }); ok('RenameStaticICEAttribute: NewName not normalisable -> 0x438', status(r, '80070057') && has(r, /0x438/), r);
    r = run('RenameStaticICEAttribute', { Object: g, AttributeName: 'Foo', NewName: 'Bar' }); ok('RenameStaticICEAttribute: NewName taken -> 0x435', status(r, '80070057') && has(r, /0x435\] .*Bar/), r);
    r = run('RenameStaticICEAttribute', { Object: g, AttributeName: 'Foo', NewName: 'Self.Qux' });
    ok('RenameStaticICEAttribute: renamed to the normalised name, descriptor kept', !r.err && !def('Foo') && def('Qux')?.desc.type === 16 && def('Qux').persisted, r);
    A.undo(); ok('RenameStaticICEAttribute undo renames back', !!def('Foo') && !def('Qux'));
    // SetType
    r = run('SetStaticICEAttributeType', { Object: g, AttributeName: 'Foo', AttributeType: 'siComponentDataTypeFloat' });
    ok('SetStaticICEAttributeType: None context / structure keep the current values', !r.err && def('Foo').desc.type === 4 && def('Foo').desc.context === 2 && def('Foo').desc.structure === 1 && S.out.SetStaticICEAttributeType.changes.length === 1, r);
    A.undo(); ok('SetStaticICEAttributeType undo', def('Foo').desc.type === 16);
    r = run('SetStaticICEAttributeType', { Object: g, AttributeName: 'Foo', AttributeType: 16 });
    ok('SetStaticICEAttributeType: same descriptor -> nothing redefined', !r.err && S.out.SetStaticICEAttributeType.changes.length === 0, r);
    r = run('SetStaticICEAttributeType', { Object: g, AttributeName: 'Foo', AttributeStructure: 'siComponentDataStructureArray', AttributeContext: 8 });
    ok('SetStaticICEAttributeType: structure and context substituted', !r.err && def('Foo').desc.structure === 2 && def('Foo').desc.context === 8, r); A.undo();
    r = run('SetStaticICEAttributeType', { Object: g, AttributeName: 'Foo', AttributeType: 4096 }); ok('SetStaticICEAttributeType: Execute type -> 0x431', status(r, '80070057') && has(r, /0x431/), r);
    r = run('SetStaticICEAttributeType', { Object: g, AttributeName: 'PointPosition', AttributeType: 4 }); ok('SetStaticICEAttributeType: non-persisted -> 0x434', status(r, '80070057') && has(r, /0x434/), r);
    // Toggle
    u0 = A.undoStack.length;
    r = run('ToggleICEAttributeAlwaysEvaluated', { Object: g, AttributeName: 'PointPosition,Nope,Foo' });
    ok('ToggleICEAttributeAlwaysEvaluated: works on any attribute, unknown names skipped, no property created', !r.err && def('PointPosition').forceEval === true && def('Foo').forceEval === true && J(S.out.ToggleICEAttributeAlwaysEvaluated.toggled) === J(['PointPosition', 'Foo']) && !g.properties.some(p => p.type === 'iceattr'), r);
    run('ToggleICEAttributeAlwaysEvaluated', { Object: g, AttributeName: 'Foo' }); ok('ToggleICEAttributeAlwaysEvaluated: flips per call', def('Foo').forceEval === false);
    A.undo(); A.undo(); ok('ToggleICEAttributeAlwaysEvaluated undo = the same toggle', def('PointPosition').forceEval === false && def('Foo').forceEval === false && A.undoStack.length === u0);
    A.select([]); r = run('ToggleICEAttributeAlwaysEvaluated', { AttributeName: 'Foo' }); ok('static ICE attribute tasks: no object -> 0x80004003', status(r, '80004003'), r);
    reset(); r = run('AddStaticICEAttribute', { AttributeName: 'OnCube' }); ok('AddStaticICEAttribute: unset Object = the selected object', !r.err && !!api.attributeTable(cube.primitive).defs.find(d => d.name === 'OnCube'), r); A.undo();
  } catch (e) { ok('static ICE attributes block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= ICE compounds
  try {
    const g = mk('Grid', 'b19Ice'); reset();
    const op = A.run('ApplyICEOp', { File: 'Push Points', Target: g.fullName });
    const G = B12.graphOf(op); const flatLinks = op.links.length;
    const byType = t => G.nodes.find(n => n.type === t);
    const mulN = byType('Multiply by Scalar'), addN = byType('Add');
    const before = G.links.map(l => `${l.src.fullName}>${l.dst.fullName}`).sort();
    const n0 = G.nodes.length; let s0 = S.subtasks.length;
    let r = run('CreateICECompoundNode', { InputObj: [mulN, addN] });
    const c = r.v;
    ok('CreateICECompoundNode: a real compound in the container, default name CompoundNode, containing the input nodes', !r.err && c?.kind === 'ICECompoundNode' && c.name === 'CompoundNode' && c.parent === G && c.graph.nodes.includes(mulN) && c.graph.nodes.includes(addN) && G.nodes.length === n0 - 1, r);
    ok('CreateICECompoundNode: crossing connections go through exposed ports (AddExposedParam sub-tasks), output Operator = the compound',
      c && c.inputs.length >= 1 && c.outputs.length >= 1 && G.links.some(l => l.dst.node === c) && G.links.some(l => l.src.node === c) && subs(s0, 'AddICENode').length === 1 && subs(s0, 'AddExposedParamToICECompoundNode').length === c.inputs.length + c.outputs.length && S.out.CreateICECompoundNode.Operator === c, c && [c.inputs.map(p => p.name), c.outputs.map(p => p.name)]);
    ok('CreateICECompoundNode: the flat ICE tree (evaluation) is unchanged; port naming logged not yet attested (Q1)', op.links.length === flatLinks && nya(r) && has(r, /Q1/), r.log);
    A.undo(); ok('CreateICECompoundNode undo restores the graph', G.nodes.length === n0 && mulN.parent === G && J(G.links.map(l => `${l.src.fullName}>${l.dst.fullName}`).sort()) === J(before));
    A.redo();
    r = run('CreateICECompoundNode', { InputObj: [mulN], Name: 'Inner' });
    ok('CreateICECompoundNode: Name sets the compound name; nodes inside a compound are wrapped in that compound', !r.err && r.v?.name === 'Inner' && r.v.parent === c.graph, r); A.undo();
    r = run('CreateICECompoundNode', { InputObj: [cube] }); ok('CreateICECompoundNode: no ICE nodes -> 0x173, 0x80070057', status(r, '80070057') && has(r, /0x173/), r);
    // Edit
    s0 = S.subtasks.length;
    r = run('EditICECompoundProperties', { Compound: c, Author: 'me', Category: 'Cat', SetMask: 0x10 });
    const P = api.compoundProps(c);
    ok('EditICECompoundProperties: SetMask selects the fields (0x10 Author only)', !r.err && P.author === 'me' && P.category === '', r);
    r = run('EditICECompoundProperties', { Compound: c, Name: 'Edited', Category: 'Cat', Tasks: 'T', Author: 'me', Description: 'D', URL: 'U', VersionMajor: 2, VersionMinor: 3, VersionTag: 'beta', ModeForApplyICEOp: 2, BackgroundColor: 255, PPGLogic: 'L', PPGLogicLanguage: 'Perl' });
    ok('EditICECompoundProperties: SetMask 0 = every field; Name through a SetValue sub-task; version on the compound', !r.err && c.name === 'Edited' && P.category === 'Cat' && P.tasks === 'T' && P.description === 'D' && P.url === 'U' && c.major === 2 && c.minor === 3 && P.versionTag === 'beta' && P.modeForApplyICEOp === 2 && P.backgroundColor === 255 && P.ppgLogic === 'L' && subs(s0, 'SetValue').length === 1, [c.name, P]);
    ok('EditICECompoundProperties: an unknown PPGLogicLanguage -> 0x1a6 (severity 4), language left unchanged', has(r, /WARNING : EditICECompoundProperties: \[XSIOPTASKS 0x1a6\] EditICECompoundProperties Perl/) && P.ppgLogicLanguage === '', r.log);
    r = run('EditICECompoundProperties', { Compound: c, PPGLogicLanguage: 'Python 3', SetMask: 0x1000 }); ok('EditICECompoundProperties: a language containing "Python" is accepted', !r.err && P.ppgLogicLanguage === 'Python 3', r);
    A.undo(); A.undo(); ok('EditICECompoundProperties undo restores the old values', c.name === 'CompoundNode' && P.category === '' && c.major === 1 && c.minor === 0 && P.modeForApplyICEOp === 4 && P.backgroundColor === 0x66bc9a, [c.name, P]);
    r = run('EditICECompoundProperties', { Compound: cube, Author: 'x' }); ok('EditICECompoundProperties: not a compound -> nothing to edit (S_FALSE)', !r.err && st('EditICECompoundProperties') === 1, r);
    c.lockLevels = 1; r = run('EditICECompoundProperties', { Compound: c, Author: 'x' }); c.lockLevels = 0; ok('EditICECompoundProperties: locked compound -> 0x80070005', status(r, '80070005'), r);
    // Export
    const H = A.shadertasksB12.classes.hostFs;
    const rf = S.compoundRefreshes;
    r = run('ExportICECompoundNode', { Compound: c });
    ok('ExportICECompoundNode: default path = user Compounds folder \\ Name .xsicompound (version 1.0 not in the name); Output = path', !r.err && /\\Data\\Compounds\\CompoundNode\.xsicompound$/.test(r.v) && H.isFile(r.v) && S.out.ExportICECompoundNode.Output === r.v, r);
    ok('ExportICECompoundNode: two compound refreshes, the library rescanned (definition known to ReplaceICECompoundNode)', S.compoundRefreshes === rf + 2 && B12.library.some(d => d.name === 'CompoundNode' && d.major === 1));
    r = run('ExportICECompoundNode', { Compound: c, Directory: 'C:\\b19', Name: 'MyComp', Version: '1.2', Private: true });
    ok('ExportICECompoundNode: Name renames the compound, Version written to it, Private -> .xsicompoundp', !r.err && r.v === 'C:\\b19\\MyComp.1.2.xsicompoundp' && c.name === 'MyComp' && c.major === 1 && c.minor === 2 && H.isFile(r.v), r);
    r = run('ExportICECompoundNode', { Compound: c, FullPath: 'C:\\b19\\as is.xsicompound', Name: 'Other', Version: '3.0' });
    ok('ExportICECompoundNode: FullPath used as is (no renaming / version change)', !r.err && r.v === 'C:\\b19\\as is.xsicompound' && c.name === 'MyComp' && c.minor === 2, r);
    S.restrictedMode = true; r = run('ExportICECompoundNode', { Compound: c, Directory: 'C:\\b19', Name: 'Priv', Private: true }); S.restrictedMode = false;
    ok('ExportICECompoundNode: Private in the restricted mode -> message box 0x427, 0x80004021, nothing written', status(r, '80004021') && S.messageBoxes.some(m => m.id === 'XSIOPTASKS 0x427') && !H.isFile('C:\\b19\\Priv.xsicompoundp'), r);
    r = run('ExportICECompoundNode', { Compound: [c, mulN] }); ok('ExportICECompoundNode: more than one item -> nothing exported', !r.err && st('ExportICECompoundNode') === 1, r);
    c.name = 'CompoundNode'; c.defName = 'CompoundNode'; c.major = 1; c.minor = 0;
    // Explode
    const nOut = G.nodes.length; s0 = S.subtasks.length;
    r = run('ExplodeICECompoundNode', { InputObj: c });
    ok('ExplodeICECompoundNode: compound removed, inner nodes moved to the parent, connections restored', !r.err && !G.nodes.includes(c) && mulN.parent === G && addN.parent === G && G.nodes.length === nOut + 1 && J(G.links.map(l => `${l.src.fullName}>${l.dst.fullName}`).sort()) === J(before), [G.links.map(l => `${l.src.fullName}>${l.dst.fullName}`).sort(), before]);
    ok('ExplodeICECompoundNode: RemoveExposedParam sub-tasks (inputs then outputs) and DeleteObj; OutputObjs = the moved nodes (Q2 logged)', subs(s0, 'RemoveExposedParamFromICECompoundNode').length === c.inputs.length + c.outputs.length && subs(s0, 'DeleteObj').length === 1 && r.v.length === 2 && nya(r) && has(r, /Q2/), r);
    A.undo(); ok('ExplodeICECompoundNode undo', G.nodes.includes(c) && mulN.parent === c.graph);
    r = run('ExplodeICECompoundNode', { InputObj: mulN }); ok('ExplodeICECompoundNode: input that is not a compound -> 0x1c3, 0x80004005', status(r, '80004005') && has(r, /0x1c3/), r);
    A.select([]); r = run('ExplodeICECompoundNode', {}); ok('ExplodeICECompoundNode: no compound -> 0x111, 0x80070057', status(r, '80070057') && has(r, /0x111/), r);
  } catch (e) { ok('ICE compound block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= constraints
  try {
    const N = nul('b19N', 3), N2 = nul('b19N2', -3), a1 = nul('b19A'), a2 = nul('b19B'); reset();
    const cns = o => o.properties.filter(p => p.targets !== undefined);
    const apply = (preset, o, t) => A.run('ApplyCns', { Preset: preset, InputObjs: o.name, Target: t.name });
    apply('Position', a1, N); apply('Orientation', a1, N2); apply('Position', a2, N);
    let s0 = S.subtasks.length;
    let r = run('RemoveCnsType', { Type: 'Position', ConstrainedObj: [a1, a2] });
    ok('RemoveCnsType: every constraint of that type over all objects, one DeleteObj sub-task', !r.err && r.v === 2 && J(names(cns(a1))) === J(['Orientation Cns']) && cns(a2).length === 0 && subs(s0, 'DeleteObj').length === 1, r);
    A.undo(); ok('RemoveCnsType undo', cns(a1).length === 2 && cns(a2).length === 1);
    r = run('RemoveCnsType', { Type: 'oricns', ConstrainedObj: 'b19A' }); ok('RemoveCnsType: by constraint type string', !r.err && r.v === 1 && J(names(cns(a1))) === J(['Position Cns']), r); A.undo();
    r = run('RemoveCnsType', { Type: 5, ConstrainedObj: [a1] }); ok('RemoveCnsType: Type not a string -> 0x80070057', status(r, '80070057'), r);
    r = run('RemoveCnsType', { Type: 'NoSuchCns', ConstrainedObj: [a1] }); ok('RemoveCnsType: unknown name -> the SIGetKineCnsIDFromName failure', status(r, '80004005'), r);
    r = run('RemoveCnsType', { Type: 'Position', ConstrainedObj: [a1, a1.kinematics] }); ok('RemoveCnsType: an item that is not a 3D object -> 0x80070057', status(r, '80070057') && cns(a1).length === 2, r);
    A.select([]); r = run('RemoveCnsType', { Type: 'Position' }); ok('RemoveCnsType: empty list -> 0x80070057', status(r, '80070057'), r);
    r = run('RemoveCnsType', { Type: 'Scaling', ConstrainedObj: [a1] }); ok('RemoveCnsType: none of that type -> nothing (status 1)', !r.err && st('RemoveCnsType') === 1 && cns(a1).length === 2, r);
    // RemoveCns
    r = run('RemoveCns', { ConstrainedObj: [a1, a2] }); ok('RemoveCns: several constrained objects -> all their constraints', !r.err && cns(a1).length === 0 && cns(a2).length === 0, r); A.undo();
    r = run('RemoveCns', { ConstrainedObj: [a1, a2], ConstrainingObj: [N2] }); ok('RemoveCns: with ConstrainingObj only the constraints to it', !r.err && J(names(cns(a1))) === J(['Position Cns']) && cns(a2).length === 1, r); A.undo();
    r = run('RemoveCns', { ConstrainedObj: [a2] }); ok('RemoveCns: one object with one constraint -> removed', !r.err && cns(a2).length === 0, r); A.undo();
    r = run('RemoveCns', { ConstrainedObj: [a1] }); ok('RemoveCns: one object, several constraints, no UI -> pick skipped, all removed (Q3 logged)', !r.err && cns(a1).length === 0 && nya(r) && has(r, /Q3/), r); A.undo();
    r = run('RemoveCns', { ConstrainedObj: [a1], ForceDeletion: true }); ok('RemoveCns: ForceDeletion -> no pick', !r.err && cns(a1).length === 0 && !nya(r), r); A.undo();
    A.Interactive = true;
    r = run('RemoveCns', { ConstrainedObj: [a1] });
    const session = A.miscDsScripts?.session;
    ok('RemoveCns: with a UI the pick session starts (prompt 0x3ef), nothing removed yet', !r.err && cns(a1).length === 2 && has(r, /0x3ef/) && !!session?.active, [r, !!session]);
    session?.pick(N2, 1, 0); A.Interactive = false;
    ok('RemoveCns: the picked object becomes ConstrainingObj (RePack), its constraints removed', J(names(cns(a1))) === J(['Position Cns']) && S.out.RemoveCns.ConstrainingObj?.name === 'b19N2', [names(cns(a1)), S.out.RemoveCns]);
    A.undo(); A.setTool(null);
    r = run('RemoveCns', { ConstrainedObj: [cube] }); ok('RemoveCns: nothing collected -> status 1', !r.err && st('RemoveCns') === 1, r);
    // GetConstrainedObjects
    r = run('GetConstrainedObjects', { InputObj: N }); ok('GetConstrainedObjects: the objects constrained by the input, as OutputObjs', !r.err && J(names(r.v)) === J(['b19A', 'b19B']) && S.out.GetConstrainedObjects.OutputObjs === r.v, r);
    A.select([]); r = run('GetConstrainedObjects'); ok('GetConstrainedObjects: no object -> 0x80004003', status(r, '80004003'), r);
  } catch (e) { ok('constraint block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= envelope locks, RemoveFlexEnv
  try {
    const g = mk('Grid', 'b19Env'); nul('b19L', -2); nul('b19R', 2); reset();
    A.run('SIApplyFlexEnv', { ConnectionSet: 'b19Env;b19L,b19R' });
    const prop = g.allProperties().find(p => p.type === 'envelope'); const env = prop?.op;
    ok('setup: enveloped grid', !!prop && !!env);
    let s0 = S.subtasks.length;
    let r = run('LockEnvelopePointWeights', { SubComp: 'b19Env.pnt[0,1]' });
    const lop = api.lockOpOf(prop);
    ok('LockEnvelopePointWeights: lock operator applied on demand (ApplyOperator c3dlockenvelopeweightsop, mode 3), returned as OutputObj', !r.err && !!lop && r.v === lop && S.out.LockEnvelopePointWeights.OutputObj === lop && subs(s0, 'ApplyOperator').some(s => s.args.Preset === 'c3dlockenvelopeweightsop' && s.args.ConnectMode === 3), r);
    ok('LockEnvelopePointWeights: points locked on every deformer; PropObj defaulted to the points\' envelope property', !!lop && lop.isLocked(0, 0) && lop.isLocked(0, 1) && lop.isLocked(1, 1) && !lop.isLocked(2, 0) && env.locked.has(0));
    r = run('LockEnvelopePointWeights', { PropObj: prop, SubComp: 'b19Env.pnt[1]', Locked: false });
    ok('LockEnvelopePointWeights: Locked false unlocks; the existing operator is reused', !r.err && r.v === lop && !lop.isLocked(1, 0) && lop.isLocked(0, 0), r);
    A.undo(); A.undo(); ok('LockEnvelopePointWeights undo: locks and the applied operator undone', !api.lockOpOf(prop) && lop.locks.size === 0);
    A.select([]); r = run('LockEnvelopePointWeights', {}); ok('LockEnvelopePointWeights: empty SubComp -> warning 0x6f, status 1', !r.err && has(r, /WARNING : LockEnvelopePointWeights: \[XSIOPTASKS 0x6f\]/) && st('LockEnvelopePointWeights') === 1, r);
    r = run('LockEnvelopePointWeights', { SubComp: 'b19Env.poly[0]' }); ok('LockEnvelopePointWeights: other component type -> warning 0x80, status 1', !r.err && has(r, /0x80\]/) && st('LockEnvelopePointWeights') === 1, r);
    r = run('LockEnvelopePointWeights', { PropObj: cube, SubComp: 'b19Env.pnt[0]' }); ok('LockEnvelopePointWeights: no envelope property -> 0x80004003', status(r, '80004003'), r);
    run('LockEnvelopePointWeights', { SubComp: 'b19Env.pnt[0,1,2]' }); const lop2 = api.lockOpOf(prop);
    r = run('ClearEnvelopeWeightLocks', { PropObj: prop });
    ok('ClearEnvelopeWeightLocks: same operator lookup, every lock cleared, OutputObj', !r.err && r.v === lop2 && lop2.locks.size === 0 && env.locked.size === 0, r);
    A.undo(); ok('ClearEnvelopeWeightLocks undo restores the saved locks', lop2.locks.size === 6 && env.locked.size === 3, lop2.locks.size);
    A.undo();
    r = run('ClearEnvelopeWeightLocks', { PropObj: 'b19Env' }); ok('ClearEnvelopeWeightLocks: an object gives its envelope property; the lock operator applied when absent', !r.err && !!api.lockOpOf(prop), r); A.undo();
    // RemoveFlexEnv
    s0 = S.subtasks.length;
    r = run('RemoveFlexEnv', { InputObjs: 'b19Env' });
    ok('RemoveFlexEnv: one DeleteObj of the envelope weight property and the envelope operator (Q4 logged)', !r.err && !g.allProperties().some(p => p.type === 'envelope') && !g.primitive.operators.includes(env) && subs(s0, 'DeleteObj').length === 1 && subs(s0, 'DeleteObj')[0].args.InputObj.length === 2 && nya(r), r);
    A.undo(); ok('RemoveFlexEnv undo', g.allProperties().includes(prop) && g.primitive.operators.includes(env));
    const cl = g.clusters.find(c => c.properties.includes(prop));
    r = run('RemoveFlexEnv', { InputObjs: [cl] }); ok('RemoveFlexEnv: a cluster works through its geometry', !r.err && !g.primitive.operators.includes(env), r); A.undo();
    r = run('RemoveFlexEnv', { InputObjs: [cube] }); ok('RemoveFlexEnv: no envelope -> nothing (status 1)', !r.err && st('RemoveFlexEnv') === 1, r);
  } catch (e) { ok('envelope block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= SwapOperators
  try {
    const o = mk('Sphere', 'b19Swap'); reset();
    A.run('ApplyOp', { PresetObj: 'Twist', ConnectionSet: o.name }); A.run('ApplyOp', { PresetObj: 'Bend', ConnectionSet: o.name });
    const prim = o.primitive; const ops = prim.operators; const [gen, d1, d2] = ops;
    const order = () => prim.operators.map(x => x.name);
    ok('setup: generator + two deformers', ops.length === 3, order());
    const before = order();
    let r = run('SwapOperators', { Object: o, Operator1: d1, Operator2: d2 });
    ok('SwapOperators: exchanges the two operators', !r.err && prim.operators[1] === d2 && prim.operators[2] === d1, order());
    A.undo(); ok('SwapOperators undo (reverse call)', J(order()) === J(before));
    r = run('SwapOperators', { Object: o, Operator1: d1, Operator2: d1 }); ok('SwapOperators: nothing to swap -> warning 0x5f, status 1', !r.err && has(r, /WARNING : SwapOperators: \[XSIOPTASKS 0x5f\]/) && st('SwapOperators') === 1, r);
    r = run('SwapOperators', { Object: o, Operator1: gen, Operator2: d2 }); ok('SwapOperators: generator -> message 0x5e, 0x80004001', status(r, '80004001') && has(r, /0x5e/), r);
    r = run('SwapOperators', { Object: cube, Operator1: d1, Operator2: d2 }); ok('SwapOperators: operators not in the stack -> message 0x60, 0x80070057', status(r, '80070057') && has(r, /0x60/), r);
    const LR = A.lockRecordsB11 ?? new Map(); A.lockRecordsB11 = LR; LR.set(d1, [{ id: 1, lockLevel: 0xffff, tagLevel: 0, type: 0 }]);
    r = run('SwapOperators', { Object: o, Operator1: d1, Operator2: d2 }); LR.delete(d1);
    ok('SwapOperators: locked operator -> message 0x5c, 0x80004005', status(r, '80004005') && has(r, /0x5c/) && J(order()) === J(before), r);
  } catch (e) { ok('SwapOperators block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= ConnectMap / DeleteMotionDerivator
  try {
    reset();
    const map = cube.properties.find(p => p.type !== 'kine') ?? cube.properties[0];
    const tgt = cube.primitive.operators[0];
    let s0 = S.subtasks.length;
    let r = run('ConnectMap', { PropObj: map, Target: tgt });
    const mo = S.out.ConnectMap?.Operator;
    ok('ConnectMap: ApplyOperator of a Map Component operator (c70b63f1), inputs [PropObj, Target], mode 2', !r.err && mo?.siClass === 'c70b63f1-2d25-11d5-bdeb-00a0c9615daf' && mo.inputs[0] === map && mo.inputs[1] === tgt && subs(s0, 'ApplyOperator').some(s => s.args.Preset === 'MapComponentOp' && s.args.ConnectMode === 2), r);
    r = run('ConnectMap', { PropObj: map, Target: tgt }); ok('ConnectMap: Target already has one -> nothing', !r.err && st('ConnectMap') === 1 && subs(s0, 'ApplyOperator').length === 1, r);
    A.undo(); r = run('ConnectMap', { PropObj: map, Target: tgt }); ok('ConnectMap undo removes the operator (a new connect works again)', !r.err && st('ConnectMap') === 0, r); A.undo();
    r = run('ConnectMap', { PropObj: map }); ok('ConnectMap: null Target -> nothing', !r.err && st('ConnectMap') === 1, r);
    // DeleteMotionDerivator
    const o = nul('b19Mo'); reset();
    const m1 = api.addMotionDerivator(o), m2 = api.addMotionDerivator(o);
    const kops = () => api.kineStateOperators(o);
    s0 = S.subtasks.length;
    r = run('DeleteMotionDerivator', { InputObj: o });
    ok('DeleteMotionDerivator: only the first derivator of the global kinematic state, DeleteObj + SetValue velaccactive 0', !r.err && !kops().includes(m1) && kops().includes(m2) && o.kinematics.global.val('velaccactive') === false && subs(s0, 'DeleteObj').length === 1 && subs(s0, 'SetValue').some(s => /velaccactive$/.test(s.args.Target) && s.args.Value === 0), r);
    A.undo(); ok('DeleteMotionDerivator undo', kops().includes(m1) && o.kinematics.global.val('velaccactive') === true);
    r = run('DeleteMotionDerivator', { InputObj: cube }); ok('DeleteMotionDerivator: no derivator -> nothing', !r.err && st('DeleteMotionDerivator') === 1, r);
  } catch (e) { ok('ConnectMap / DeleteMotionDerivator block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= RemoveProxyParam
  try {
    const o = nul('b19Px'); reset();
    A.run('AddProp', { PresetObj: 'Custom Parameter Set', InputObjs: o.name }); const cps = o.properties.find(p => p.type === 'customparamset');
    const proxy = A.run('AddProxyParam', { InputObjs: cps, Proxied: 'cube.kine.local.posx' });
    const set = proxy.owner; const idx = set.params.indexOf(proxy);
    let r = run('RemoveProxyParam', { InputObjs: [proxy] });
    ok('RemoveProxyParam: only the listed proxy parameter goes (removal step logged, Q6)', !r.err && !set.params.includes(proxy) && st('RemoveProxyParam') === 0 && nya(r), r);
    A.undo(); ok('RemoveProxyParam undo recreates the proxy on its custom property with its name', set.params.indexOf(proxy) === idx && proxy.proxied?.def.name === 'posx' && !!A.anim.expression(proxy));
    const plain = cube.kinematics.local.get('posy');
    r = run('RemoveProxyParam', { InputObjs: [proxy, plain] }); ok('RemoveProxyParam: a non-proxy in the list -> status 0x562e80d2, the proxy still removed', !r.err && st('RemoveProxyParam') === 0x562e80d2 && !set.params.includes(proxy) && cube.kinematics.local.get('posy') === plain, r); A.undo();
    A.anim.marked.clear(); r = run('RemoveProxyParam'); ok('RemoveProxyParam: empty list -> warning XSIPROPERTYTASKS 0x2b, status 0x562e80d2', !r.err && has(r, /WARNING : RemoveProxyParam: \[XSIPROPERTYTASKS 0x2b\]/) && st('RemoveProxyParam') === 0x562e80d2, r);
  } catch (e) { ok('RemoveProxyParam block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= DisconnectAndDeleteShaders
  try {
    const o = mk('Sphere', 'b19Sh'); reset();
    A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [o] });
    const ph = o.material.surface; const T = A.textureLayers;
    const img = A.run('SIApplyShaderToCnxPoint', { PresetObj: 'Image', InputObjs: [{ owner: ph, name: 'diffuse' }] });
    ok('setup: Image shader on the Phong diffuse', T.getSource({ owner: ph, name: 'diffuse' }) === img, img?.name);
    let s0 = S.subtasks.length;
    let r = run('DisconnectAndDeleteShaders', { Shaders: [img] });
    ok('DisconnectAndDeleteShaders: disconnected from the other shaders, update sub-task 1ffd73c3, deleted (Q6 logged)', !r.err && !T.getSource({ owner: ph, name: 'diffuse' }) && subs(s0, '1ffd73c3').length === 1 && nya(r), r);
    A.undo(); ok('DisconnectAndDeleteShaders undo', T.getSource({ owner: ph, name: 'diffuse' }) === img);
    r = run('DisconnectAndDeleteShaders', { Shaders: [img, 'nothing_here'] }); ok('DisconnectAndDeleteShaders: an invalid entry -> 0x80004005', status(r, '80004005') && T.getSource({ owner: ph, name: 'diffuse' }) === img, r);
    r = run('DisconnectAndDeleteShaders', { Shaders: [cube] }); ok('DisconnectAndDeleteShaders: no shader -> 0x80070057', status(r, '80070057'), r);
    const LR = A.lockRecordsB11 ?? new Map(); A.lockRecordsB11 = LR; LR.set(img, [{ id: 1, lockLevel: 0xffff, tagLevel: 0, type: 0 }]);
    r = run('DisconnectAndDeleteShaders', { Shaders: [img] }); LR.delete(img);
    ok('DisconnectAndDeleteShaders: locked shader -> lock error, 0x80004005', status(r, '80004005') && has(r, /is locked/) && T.getSource({ owner: ph, name: 'diffuse' }) === img, r);
  } catch (e) { ok('DisconnectAndDeleteShaders block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= scripted operators
  try {
    const H = A.shadertasksB12.classes.hostFs; H.ensureFolder('C:\\b19'); H.writeFile('C:\\b19\\op.py', 'def Update(ctx, out):\n  pass\n');
    const o = mk('Sphere', 'b19Sop'); reset();
    let r = run('AddScriptedOpFromFile', { OutputObjs: [o], FileName: 'C:\\b19\\op.py', Name: 'FileOp' });
    ok('AddScriptedOpFromFile: operator on the output stack from the file text (Python by extension); FileName read / Do logged not yet attested (Q5)', !r.err && o.primitive.operators.includes(r.v) && r.v.name === 'FileOp' && r.v.val('Language') === 'Python' && /def Update/.test(r.v.val('Code')) && nya(r) && has(r, /Q5/), r);
    A.undo(); ok('AddScriptedOpFromFile undo', !o.primitive.operators.some(x => x.name === 'FileOp'));
    r = run('AddScriptedOpFromFile', { OutputObjs: [o], FileName: 'C:\\b19\\op.py', Name: 5 }); ok('AddScriptedOpFromFile: Name not a string -> 0x80070057', status(r, '80070057'), r);
    r = run('AddScriptedOpFromFile', { OutputObjs: [o], FileName: 'C:\\b19\\op.py', Language: 3 }); ok('AddScriptedOpFromFile: Language not a string -> 0x80070057', status(r, '80070057'), r);
    r = run('AddScriptedOpFromFile', { OutputObjs: [o], FileName: 'C:\\b19\\op.py', ConstructionMode: 'abc' }); ok('AddScriptedOpFromFile: ConstructionMode not an I4 -> 0x80070057', status(r, '80070057'), r);
    r = run('AddScriptedOpFromFile', { OutputObjs: [o], FileName: 'C:\\b19\\op.py', ConstructionMode: 'siConstructionModeAnimation' }); ok('AddScriptedOpFromFile: ConstructionMode enum name coerced', !r.err && r.v.constructionMode === 2, r);
    const sop = r.v;
    r = run('ConvertScriptedOp', { Source: sop }); ok('ConvertScriptedOp: Source resolved; the conversion logs not yet attested (CMD-B19c, LOCK)', !r.err && nya(r) && st('ConvertScriptedOp') === 1, r);
    r = run('ConvertScriptedOp', { Source: o }); ok('ConvertScriptedOp: an object gives its scripted operator', !r.err && nya(r), r);
    A.undo();
  } catch (e) { ok('scripted operator block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  // ================= Select*
  try {
    const p = nul('b19P'), c1 = nul('b19C1'); A.run('ParentObj', { Parent: 'b19P', Children: 'b19C1' });
    const sel = () => names(A.selection);
    A.select([p]); let r = run('SelectBranch');
    ok('SelectBranch: the selection at level BRANCH', !r.err && J(sel()) === J(['b19P', 'b19C1']), sel());
    A.select([cube]); r = run('SelectBranch', { SelectionList: 'b19P' });
    ok('SelectBranch: hidden SelectionList argument', !r.err && J(sel()) === J(['b19P', 'b19C1']), sel());
    A.select([c1]); r = run('SelectTree'); ok('SelectTree: level TREE', !r.err && J(sel()) === J(['b19P', 'b19C1']), sel());
    A.select([p]); r = run('SelectBranch', { HierarchyLevel: 'NODE' }); ok('SelectBranch: another HierarchyLevel logs not yet attested (CMD-B19c Q5)', !r.err && nya(r) && has(r, /Q5/), r);
    A.select([cube]); r = run('SelectModel'); ok('SelectModel: outside a model logs not yet attested (CMD-B19c)', !r.err && nya(r) && J(sel()) === J(['cube']), r);
    A.select([cube]); r = run('SelectChain'); ok('SelectChain: a non-chain object keeps its selection', !r.err && J(sel()) === J(['cube']), sel());
  } catch (e) { ok('Select block threw', false, String(e?.stack ?? e).slice(0, 400)); }
  reset();
  return out;
}, { NAMES, DEFAULT_FAILS });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_optasks_b19c: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
