// CMD-B12a / CMD-B12b (optasks.dll ICE compound / node / port commands): the 24 commands of src/commands/optasksB12ice*.ts.
// There is no XSIBATCH golden for either row: this is a contract check against
//   docs/ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md and docs/ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, output-only arguments
//      left out; defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the demo scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (return values, graph state, logged ids, statuses, undo / redo) on an ICE tree
//      applied to the cube, with compounds built through the stand-in model (`Application.optasksB12`).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_optasks_b12ab_commands.mjs
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
  // CMD-B12a
  'AddExposedParamToICECompoundNode', 'EditExposedParamInICECompoundNode', 'RemoveExposedParamFromICECompoundNode', 'RemoveExposedPortPassThrough',
  'GetICECompoundPortProperties', 'MoveICECompoundPort', 'MoveICECompoundPortsAndLayoutGroups', 'CreateLayoutGroupInICECompoundNode',
  'RenameICEPPGLayoutGroup', 'HideAllPortValues', 'PrivateGetCompoundConstructionMode', 'ReplaceICECompoundNode',
  // CMD-B12b
  'AddPortToICENode2', 'RemovePortFromICENode', 'AddNodeToICECompoundNode', 'RemoveNodeFromICECompoundNode', 'AddAttributeToSetDataICENode',
  'RemoveAttributeFromSetDataICENode', 'SetPortType', 'CleanDisconnectedICENodes', 'CreateICENodeComment', 'SetICESimInitState',
  'RemoveICESimInitState', 'TransferICETree',
];
// Default arguments that are usable with the cube selected; every other command needs an ICE object and must fail.
const DEFAULT_OK = new Set(['HideAllPortValues', 'SetICESimInitState', 'RemoveICESimInitState', 'TransferICETree']);   // TransferICETree: a null operator is a silent no-op (batch 13)

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n); if (!c) return [n, null];
  const f = full.find(x => (x.scripting_name || x.name) === n); const fd = Object.fromEntries((f?.args ?? []).map(a => [a.name, a.default]));
  return [n, c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? fd[a.name] ?? null])];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('TransferICETree') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_OK: DO }) => {
  const DEFAULT_OK = new Set(DO);
  const A = window.Application; A.autoInspect = false;
  const S = A.optasksB12;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const last = () => S.lastStatus?.status;
  const cube = A.scene.find('cube');
  const reset = () => { A.select([cube]); };
  const names = (ps) => ps.map(p => p.name).join(',');
  const lay = (items) => items.map(i => i.kind === 'port' ? i.port.name : `${i.name}[${lay(i.items)}]`).join(',');
  const undoOne = (u0) => A.undoStack.length === u0 + 1;

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }

  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (!DEFAULT_OK.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_OK.has(n) ? 'ok' : 'UNEXPECTED-OK');
  }
  reset();

  // ICE tree on the cube: Push Points (Get Data, Get Data, Multiply by Scalar, Add, Set Data)
  const op = A.run('ApplyICEOp', { File: 'Push Points', Target: cube.fullName });
  const g = S.graphOf(op);
  const T = op.fullName;
  const nodeT = (t, i = 0) => g.nodes.filter(n => n.type === t)[i];
  ok('graph view mirrors the flat ICE tree (5 nodes, Set Data on root Port1)', g.nodes.length === 5 && g.links.some(l => l.dst === g.root.inputs[0] && l.src.node.type === 'Set Data'), g.nodes.map(n => n.name));
  ok('paths resolve: <tree>.<node>.<port>', run('GetICECompoundPortProperties', { Parameter: `${T}.Add.first` }).err?.includes('not an exposed port'));

  // ================= CMD-B12a
  // CreateLayoutGroupInICECompoundNode / RenameICEPPGLayoutGroup / MoveICECompoundPortsAndLayoutGroups / MoveICECompoundPort
  {
    const C = 'CreateLayoutGroupInICECompoundNode';
    const c = S.makeCompound(op, g, 'Layout Test', ['In1', 'In2', 'In3'], ['Out']);
    ok('compound path <tree>.Layout_Test', c.fullName === `${T}.Layout_Test`, c.fullName);
    let u0 = A.undoStack.length;
    const r = run(C, { Compound: c.fullName, Names: ['In1', 'In2'], Group: '' });
    ok(`${C}: empty Group becomes "Group", returned as Value; items in list order`, r.v === 'Group' && lay(c.layout) === 'Group[In1,In2],In3', [r, lay(c.layout)]);
    ok(`${C}: one undo entry; undo / redo`, undoOne(u0) && (A.undo(), lay(c.layout) === 'In1,In2,In3') && (A.redo(), lay(c.layout) === 'Group[In1,In2],In3'), lay(c.layout));
    const r2 = run(C, { Compound: c, Names: ['In3'], Group: 'Group' });
    ok(`${C}: name made unique (Group1)`, r2.v === 'Group1' && lay(c.layout) === 'Group[In1,In2],Group1[In3]', [r2.err, lay(c.layout)]);
    ok(`${C}: Names not an array -> 0x80070057`, status(run(C, { Compound: c, Names: 5 }), '80070057'));
    ok(`${C}: empty Names -> 0x80070057`, status(run(C, { Compound: c, Names: [] }), '80070057'));
    c.readOnly = true; ok(`${C}: read-only compound dropped -> 0x80004005`, status(run(C, { Compound: c, Names: ['In1'] }), '80004005')); c.readOnly = false;
    c.lockLevels = 1; ok(`${C}: locked compound -> 0x80070005`, status(run(C, { Compound: c, Names: ['In1'] }), '80070005')); c.lockLevels = 0;

    const R = 'RenameICEPPGLayoutGroup';
    const s1 = run(R, { Compound: c, Name: 'Group', NewName: 'GROUP' });
    ok(`${R}: same name ignoring case -> nothing, S_FALSE`, !s1.err && last() === 1 && lay(c.layout).startsWith('Group['), s1);
    u0 = A.undoStack.length;
    const s2 = run(R, { Compound: c, Name: 'Group', NewName: 'Main' });
    ok(`${R}: renames and writes the final name back`, s2.v === 'Main' && lay(c.layout) === 'Main[In1,In2],Group1[In3]' && last() === 0, [s2, lay(c.layout)]);
    ok(`${R}: undo / redo`, undoOne(u0) && (A.undo(), lay(c.layout).startsWith('Group[')) && (A.redo(), lay(c.layout).startsWith('Main[')));
    const s3 = run(R, { Compound: c, Name: 'Main', NewName: 'Group1' });
    ok(`${R}: new name made unique`, s3.v === 'Group11', s3);
    run(R, { Compound: c, Name: 'Group11', NewName: 'Main' });
    ok(`${R}: empty Name -> 0x80070057`, status(run(R, { Compound: c, Name: '', NewName: 'x' }), '80070057'));
    ok(`${R}: no compound -> 0x80004005`, status(run(R, { Compound: `${T}.Add`, Name: 'a', NewName: 'b' }), '80004005'));

    const M = 'MoveICECompoundPortsAndLayoutGroups';
    u0 = A.undoStack.length;
    const m1 = run(M, { Compound: c, Names: ['Group1'], Marker: 'Main', MoveAction: 0 });
    ok(`${M}: MoveAction 0 puts the items before the marker`, !m1.err && lay(c.layout) === 'Group1[In3],Main[In1,In2]', [m1.err, lay(c.layout)]);
    ok(`${M}: undo restores the order`, undoOne(u0) && (A.undo(), lay(c.layout) === 'Main[In1,In2],Group1[In3]'));
    const m2 = run(M, { Compound: c, Names: ['In1'], Marker: 'Group1' });
    ok(`${M}: default MoveAction 1 puts the items after the marker`, !m2.err && lay(c.layout) === 'Main[In2],Group1[In3],In1', [m2.err, lay(c.layout)]);
    ok(`${M}: empty Marker -> 0x80070057`, status(run(M, { Compound: c, Names: ['In1'], Marker: '' }), '80070057'));
    ok(`${M}: Names not an array -> 0x80070057`, status(run(M, { Compound: c, Names: 3, Marker: 'Main' }), '80070057'));
    const m3 = run(M, { Compound: c, Names: ['In1'], Marker: 'Main', MoveAction: 7 });
    ok(`${M}: unknown MoveAction logs not yet attested`, !m3.err && nya(m3) === 1 && lay(c.layout) === 'Main[In2],Group1[In3],In1', m3);

    const P = 'MoveICECompoundPort';
    u0 = A.undoStack.length;
    const p1 = run(P, { InputObj: `${c.fullName}.In1` });
    ok(`${P}: Step 1 moves the port one down on its side`, !p1.err && names(c.inputs) === 'In2,In1,In3' && names(c.outputs) === 'Out', [p1.err, names(c.inputs)]);
    ok(`${P}: undo moves it back`, undoOne(u0) && (A.undo(), names(c.inputs) === 'In1,In2,In3'));
    run(P, { InputObj: c.inputs[2], Step: -1 });
    ok(`${P}: negative Step moves up`, names(c.inputs) === 'In1,In3,In2', names(c.inputs));
    ok(`${P}: Step 0 -> 0x80070057`, status(run(P, { InputObj: c.inputs[0], Step: 0 }), '80070057'));
    ok(`${P}: port without an owning compound -> 0x80070057`, status(run(P, { InputObj: `${T}.Add.first` }), '80070057'));
    c.lockLevels = 2; ok(`${P}: locked owner -> 0x80070005`, status(run(P, { InputObj: c.inputs[0] }), '80070005')); c.lockLevels = 0;
    g.nodes.splice(g.nodes.indexOf(c), 1);
  }
  // AddExposedParamToICECompoundNode / EditExposedParamInICECompoundNode / GetICECompoundPortProperties / RemoveExposedParamFromICECompoundNode
  {
    const c = S.makeCompound(op, g, 'Expose');
    const inner = S.makeNode(op, c.graph, 'Multiply by Scalar');
    const AE = 'AddExposedParamToICECompoundNode';
    let u0 = A.undoStack.length;
    const r = run(AE, { Parameter: inner.port('factor'), Compound: c });
    const np = c.inputs[0];
    ok(`${AE}: exposes the inner input (named after it) and connects it`, r.v === np && np?.name === 'factor' && c.graph.links.some(l => l.src === np && l.dst === inner.port('factor')) && lay(c.layout) === 'factor', [r.err, names(c.inputs)]);
    ok(`${AE}: undo removes the exposed port`, undoOne(u0) && (A.undo(), c.inputs.length === 0 && c.graph.links.length === 0) && (A.redo(), c.inputs[0] === np));
    const r2 = run(AE, { Parameter: inner.port('result'), Compound: c, Name: 'Out' });
    ok(`${AE}: an inner output gives an exposed output with the given Name`, r2.v?.name === 'Out' && c.outputs[0] === r2.v && c.graph.links.some(l => l.src === inner.port('result') && l.dst === r2.v), r2.err);
    const r3 = run(AE, { Parameter: inner.port('value'), Compound: c, ExistingPort: np });
    ok(`${AE}: ExistingPort connects to that port instead of creating one`, r3.v === np && c.inputs.length === 1 && c.graph.links.some(l => l.src === np && l.dst === inner.port('value')), r3.err);
    ok(`${AE}: no editable compound -> 0x80004005`, status(run(AE, { Parameter: inner.port('factor'), Compound: `${T}.Add` }), '80004005'));
    ok(`${AE}: port outside the compound -> 0x80070057`, status(run(AE, { Parameter: `${T}.Add.first`, Compound: c }), '80070057'));
    ok(`${AE}: unread worker logged`, nya(r) === 1);

    const E = 'EditExposedParamInICECompoundNode', G = 'GetICECompoundPortProperties';
    u0 = A.undoStack.length;
    const e1 = run(E, { Parameter: np, Name: 'Amount', Min: '0', Max: '10', Description: 'How much', ExposeType: 2, PPGLayoutGroup: 'Controls' });
    ok(`${E}: applies the properties`, !e1.err && np.name === 'Amount' && np.exposed.min === '0' && np.exposed.max === '10' && lay(c.layout) === 'Controls[Amount]', [e1.err, lay(c.layout)]);
    const g1 = run(G, { Parameter: `${c.fullName}.Amount` });
    ok(`${G}: Name, Min, Max, Picking, Description, ExposeType, Enum, PPGLayoutGroup (batch-13 order)`, JSON.stringify(g1.v) === JSON.stringify(['Amount', '0', '10', '', 'How much', 2, '', 'Controls']) && nya(g1) === 0, g1);
    ok(`${G}: not undoable`, A.undoStack.length === u0 + 1);
    ok(`${E}: undo restores`, (A.undo(), np.name === 'factor' && np.exposed.min === '' && lay(c.layout) === 'factor'), lay(c.layout));
    A.redo();
    ok(`${E}: an empty Name leaves the name unchanged; the other fields are applied (batch 13)`, (() => { const e = run(E, { Parameter: np, Min: '0', Max: '20', Description: 'How much', ExposeType: 2, PPGLayoutGroup: 'Controls' }); return np.exposed.min === '0' && np.exposed.max === '20' && np.name === 'Amount' && lay(c.layout) === 'Controls[Amount]' && nya(e) === 0; })());
    ok(`${G}: no compound -> 0x80004005`, status(run(G, { Parameter: `${T}.Add.first` }), '80004005'));

    const RM = 'RemoveExposedParamFromICECompoundNode';
    np.value = 3;
    u0 = A.undoStack.length;
    const rm = run(RM, { Parameter: np, Compound: c });
    ok(`${RM}: removes the port, the inner ports keep its value, the emptied group goes`,
      !rm.err && !c.inputs.length && !c.graph.links.some(l => l.dst === inner.port('factor') || l.dst === inner.port('value')) && inner.port('factor').value === 3 && inner.port('value').value === 3 && lay(c.layout) === '', [rm.err, lay(c.layout)]);
    ok(`${RM}: undo restores port, links and layout`, undoOne(u0) && (A.undo(), c.inputs[0] === np && c.graph.links.some(l => l.src === np && l.dst === inner.port('factor')) && lay(c.layout) === 'Controls[Amount]'));
    const other = S.makeCompound(op, g, 'Other', ['X']);
    const bad = run(RM, { Parameter: other.inputs[0], Compound: c });
    ok(`${RM}: port the compound cannot remove -> XSIOPTASKS 0x174, 0x80070057`, status(bad, '80070057') && has(bad, /0x174/), bad);
    const nul = run(RM, { Compound: c });
    ok(`${RM}: null Parameter -> XSIOPTASKS 0x111, 0x80070057`, status(nul, '80070057') && has(nul, /0x111/), nul);
    g.nodes = g.nodes.filter(n => n !== c && n !== other);
  }
  // RemoveExposedPortPassThrough
  {
    const C = 'RemoveExposedPortPassThrough';
    const c = S.makeCompound(op, g, 'PT', ['In'], ['Out']);
    const pt = S.makePassThrough(op, c.graph); const x = S.makeNode(op, c.graph, 'Negate');
    c.graph.links.push({ src: c.inputs[0], dst: pt.inputs[0] }, { src: pt.outputs[0], dst: x.inputs[0] }, { src: x.outputs[0], dst: c.outputs[0] });
    const u0 = A.undoStack.length;
    const r = run(C, { Port: `${c.fullName}.In` });
    ok(`${C}: source reconnected to the downstream port, pass-through deleted`, !r.err && !c.graph.nodes.includes(pt) && c.graph.links.some(l => l.src === c.inputs[0] && l.dst === x.inputs[0]) && c.graph.links.length === 2, r.err);
    ok(`${C}: undo restores the pass-through`, undoOne(u0) && (A.undo(), c.graph.nodes.includes(pt) && c.graph.links.length === 3));
    const pt2 = S.makePassThrough(op, c.graph, 'PT_Out');
    c.graph.links = c.graph.links.filter(l => l.dst !== c.outputs[0]);
    c.graph.links.push({ src: x.outputs[0], dst: pt2.inputs[0] }, { src: pt2.outputs[0], dst: c.outputs[0] });
    run(C, { Port: c.outputs[0] });
    ok(`${C}: output side: upstream source wired to the compound's port`, !c.graph.nodes.includes(pt2) && c.graph.links.some(l => l.src === x.outputs[0] && l.dst === c.outputs[0]));
    const n = run(C, { Port: `${T}.Add.first` });
    ok(`${C}: owner not a compound -> S_FALSE, nothing done`, !n.err && last() === 1);
    g.nodes = g.nodes.filter(k => k !== c);
  }
  // HideAllPortValues
  {
    const C = 'HideAllPortValues';
    const add = nodeT('Add'), sd = nodeT('Set Data');
    sd.inReferencedModel = true;
    const before = S.refreshes; const u0 = A.undoStack.length;
    const r = run(C, { InputObjs: [add, sd, cube] });
    ok(`${C}: input value displays hidden; referenced-model node skipped with XSIOPTASKS 0x425`, add.inputs.every(p => !p.valueShown) && sd.inputs.every(p => p.valueShown) && has(r, /0x425/), r);
    ok(`${C}: tree view refreshed once; status 0x80070005 for the refused node (batch 13)`, S.refreshes === before + 1 && nya(r) === 0 && last() === 0x80070005);
    ok(`${C}: undo restores`, undoOne(u0) && (A.undo(), add.inputs.every(p => p.valueShown)));
    sd.inReferencedModel = false;
    const n = run(C, { InputObjs: [cube] });
    ok(`${C}: no ICE node -> S_FALSE`, !n.err && last() === 1);
  }
  // PrivateGetCompoundConstructionMode
  {
    const C = 'PrivateGetCompoundConstructionMode';
    const fsys = A.hostFs;
    fsys.ensureFolder('C:\\B12\\Compounds');
    fsys.writeFile('C:\\B12\\Compounds\\Anim.xsicompound', '<?xml version="1.0"?>\n<xsi_file type="CompoundNode" name="Anim" constructionmode="2" formatversion="1.4"></xsi_file>');
    fsys.writeFile('C:\\B12\\Compounds\\Bad.xsicompound', 'not a compound');
    const r = run(C, { File: 'C:\\B12\\Compounds\\Anim.xsicompound' });
    ok(`${C}: Mode from the header, S_FALSE`, r.v === 2 && last() === 1, r);
    ok(`${C}: missing file -> 0x80004005`, status(run(C, { File: 'C:\\B12\\none.xsicompound' }), '80004005'));
    ok(`${C}: unreadable header -> 0x80004005`, status(run(C, { File: 'C:\\B12\\Compounds\\Bad.xsicompound' }), '80004005'));
    ok(`${C}: not undoable`, !A.undoStack.some(u => u.label === C));
  }
  // ReplaceICECompoundNode
  {
    const C = 'ReplaceICECompoundNode';
    S.library.push({ name: 'Lib', major: 1, minor: 0, inputs: ['A'], outputs: ['R'] }, { name: 'Lib', major: 1, minor: 1, inputs: ['A', 'B'], outputs: ['R'] });
    const c = S.makeCompound(op, g, 'Lib', ['A'], ['R']);
    const gd = nodeT('Get Data');
    g.links.push({ src: gd.outputs[0], dst: c.inputs[0] });
    c.inputs[0].value = 7;
    const u0 = A.undoStack.length;
    const r = run(C, { InputObjs: [c] });
    const nw = g.nodes.find(n => n.name === c.name);
    ok(`${C}: empty Version -> latest (1.1); connections and values kept by port name`, !r.err && nw && nw !== c && nw.minor === 1 && names(nw.inputs) === 'A,B' && g.links.some(l => l.src === gd.outputs[0] && l.dst === nw.inputs[0]) && nw.inputs[0].value === 7, r.err);
    ok(`${C}: undo puts the old node back`, undoOne(u0) && (A.undo(), g.nodes.includes(c) && !g.nodes.includes(nw) && g.links.some(l => l.dst === c.inputs[0])));
    const r2 = run(C, { InputObjs: [c], Version: '1.0' });
    ok(`${C}: Version major.minor`, g.nodes.find(n => n.name === c.name)?.minor === 0, r2.err);
    A.undo();
    const r3 = run(C, { InputObjs: [c], Version: '3.2' });
    ok(`${C}: unknown version logs not yet attested, node kept`, !r3.err && g.nodes.includes(c) && nya(r3) >= 1, r3);
    ok(`${C}: no compound -> 0x80004005`, status(run(C, { InputObjs: [nodeT('Add')] }), '80004005'));
    g.nodes = g.nodes.filter(n => n !== c); g.links = g.links.filter(l => l.dst !== c.inputs[0]);
  }

  // ================= CMD-B12b
  // AddPortToICENode2 / RemovePortFromICENode
  {
    const C = 'AddPortToICENode2';
    op.addNode('Execute');
    const ex = S.graphOf(op).nodes.find(n => n.type === 'Execute');
    ok('a node added to the flat tree appears in the graph view', !!ex && names(ex.inputs) === 'port1,port2,port3');
    let u0 = A.undoStack.length;
    const r = run(C, { Port: `${ex.fullName}.port3`, InsertLocation: 'siNodePortDataInsertionLocationAfter' });
    ok(`${C}: After adds a group instance after the port; NewPorts = the created ports`, Array.isArray(r.v) && r.v.length === 1 && names(ex.inputs) === 'port1,port2,port3,port4', [r.err, names(ex.inputs)]);
    ok(`${C}: undo`, undoOne(u0) && (A.undo(), names(ex.inputs) === 'port1,port2,port3') && (A.redo(), ex.inputs.length === 4));
    run(C, { Port: ex.inputs[0] });
    ok(`${C}: default Before inserts before the port`, ex.inputs[0].name === 'port5' && ex.inputs.length === 5, names(ex.inputs));
    ok(`${C}: bad InsertLocation -> 0x80070057`, status(run(C, { Port: ex.inputs[0], InsertLocation: 9 }), '80070057'));
    const R = 'RemovePortFromICENode';
    u0 = A.undoStack.length;
    const rr = run(R, { Port: ex.inputs[0] });
    ok(`${R}: removes the instance`, !rr.err && names(ex.inputs) === 'port1,port2,port3,port4' && undoOne(u0), rr.err);
    const sdv = run(R, { Port: `${nodeT('Set Data').fullName}.value` });
    ok(`${R}: last instance logs not yet attested, S_FALSE`, !sdv.err && nya(sdv) === 1 && last() === 1 && nodeT('Set Data').inputs.length >= 1, sdv);
  }
  // AddNodeToICECompoundNode / RemoveNodeFromICECompoundNode
  {
    const C = 'AddNodeToICECompoundNode', R = 'RemoveNodeFromICECompoundNode';
    const mbs = nodeT('Multiply by Scalar'), add = nodeT('Add'), nrm = g.links.find(l => l.dst === mbs.inputs[0]).src;
    const flatBefore = JSON.stringify(op.links);
    const cc = S.makeCompound(op, g, 'Wrap');
    const u0 = A.undoStack.length;
    const r = run(C, { InputObj: [mbs.fullName], Compound: cc.fullName });
    const P = cc.inputs[0], Q = cc.outputs[0];
    ok(`${C}: node moved in; crossing links kept through new exposed ports`,
      !r.err && mbs.parent === cc.graph && !g.nodes.includes(mbs) && P && Q && g.links.some(l => l.src === nrm && l.dst === P) && g.links.some(l => l.src === Q && l.dst === add.inputs[1])
      && cc.graph.links.some(l => l.src === P && l.dst === mbs.inputs[0]) && cc.graph.links.some(l => l.src === mbs.outputs[0] && l.dst === Q), [r.err, names(cc.inputs), names(cc.outputs)]);
    ok(`${C}: the evaluated flat tree is unchanged`, JSON.stringify(op.links) === flatBefore);
    ok(`${C}: undo moves it back out`, undoOne(u0) && (A.undo(), g.nodes.includes(mbs) && !cc.inputs.length && g.links.some(l => l.src === mbs.outputs[0] && l.dst === add.inputs[1])) && (A.redo(), mbs.parent === cc.graph));
    const u1 = A.undoStack.length;
    const rr = run(R, { InputObj: `${cc.fullName}.Multiply_by_Scalar` });
    ok(`${R}: node moved out to the parent graph; links rewired around the compound`,
      !rr.err && mbs.parent === g && g.links.some(l => l.src === nrm && l.dst === mbs.inputs[0]) && g.links.some(l => l.src === mbs.outputs[0] && l.dst === add.inputs[1]) && undoOne(u1), rr.err);
    ok(`${R}: undo moves it back in`, (A.undo(), mbs.parent === cc.graph) && (A.redo(), mbs.parent === g));
    const inner = S.makeNode(op, cc.graph, 'Negate');
    const skip = run(C, { InputObj: [inner], Compound: cc });
    ok(`${C}: nodes of another graph are skipped`, !skip.err && inner.parent === cc.graph);
    ok(`${C}: no compound -> 0x80004005`, status(run(C, { InputObj: [mbs], Compound: add }), '80004005'));
    const nl = run(C, { Compound: cc });
    ok(`${C}: null node list -> 0x111, 0x80070057`, status(nl, '80070057') && has(nl, /0x111/), nl);
    ok(`${R}: no node inside a compound -> 0x80004005`, status(run(R, { InputObj: [add] }), '80004005'));
    g.nodes = g.nodes.filter(n => n !== cc);
  }
  // AddAttributeToSetDataICENode / RemoveAttributeFromSetDataICENode
  {
    const C = 'AddAttributeToSetDataICENode', R = 'RemoveAttributeFromSetDataICENode';
    const sd = nodeT('Set Data'); const n0 = sd.attributes.length;
    const u0 = A.undoStack.length;
    const r = run(C, { SetDataNode: sd.fullName, AttributeName: 'Self.Foo' });
    const at = sd.attributes[n0];
    ok(`${C}: attribute entry and input port added (defaults Float / Component0D / Single)`, !r.err && at?.name === 'Self.Foo' && at.type === 4 && at.context === 2 && at.structure === 1 && r.v === at.port && sd.inputs.includes(at.port), r.err);
    ok(`${C}: undo`, undoOne(u0) && (A.undo(), sd.attributes.length === n0 && !sd.inputs.includes(at.port)) && (A.redo(), sd.attributes.length === n0 + 1));
    const t = run(C, { SetDataNode: sd, AttributeName: 'x', AttributeType: 1024, AttributeContext: 3 });
    ok(`${C}: Type outside 0xFCBFF -> XSIOPTASKS 0x41C first, 0x80070057`, status(t, '80070057') && has(t, /0x41C/) && !has(t, /0x41D/), t);
    const c = run(C, { SetDataNode: sd, AttributeName: 'x', AttributeContext: 3 });
    ok(`${C}: Context not one bit -> 0x41D`, status(c, '80070057') && has(c, /0x41D/), c);
    const s = run(C, { SetDataNode: sd, AttributeName: 'x', AttributeStructure: 4 });
    ok(`${C}: Structure outside 0x3 -> 0x41E`, status(s, '80070057') && has(s, /0x41E/), s);
    ok(`${C}: named enum values accepted`, !run(C, { SetDataNode: sd, AttributeName: 'Self.V', AttributeType: 'siComponentDataTypeVector3', AttributeContext: 'siComponentDataContextSingleton', AttributeStructure: 'siComponentDataStructureArray' }).err && sd.attributes.at(-1).type === 16 && sd.attributes.at(-1).structure === 2);
    const u1 = A.undoStack.length;
    const rr = run(R, { SetDataNode: sd, AttributeName: 'Self.Foo' });
    ok(`${R}: entry and port removed`, !rr.err && !sd.attributes.some(a => a.name === 'Self.Foo') && !sd.inputs.includes(at.port) && undoOne(u1), rr.err);
    const un = run(R, { SetDataNode: sd, AttributeName: 'Self.Nope' });
    ok(`${R}: unknown name -> XSIOPTASKS 0x415, nothing changes, succeeds (batch 13)`, !un.err && has(un, /0x415/) && last() === 0 && nya(un) === 0, un);
    ok(`${C}: not a Set Data node -> 0x80070057`, status(run(C, { SetDataNode: nodeT('Add') }), '80070057'));
  }
  // SetPortType
  {
    const C = 'SetPortType';
    const add = nodeT('Add');
    const u0 = A.undoStack.length;
    const r = run(C, { Port: `${add.fullName}.first`, Type: 'siComponentDataTypeVector3' });
    ok(`${C}: polymorphic port typed, structure 0`, !r.err && add.inputs[0].type === 16 && add.inputs[0].structure === 0 && last() === 0, r.err);
    ok(`${C}: undo restores the old record`, undoOne(u0) && (A.undo(), add.inputs[0].type === 0));
    run(C, { Port: add.inputs[0], Type: 65536 });
    ok(`${C}: bit 0x10000 sets structure to any (-1)`, add.inputs[0].type === 65536 && add.inputs[0].structure === -1);
    const bad = run(C, { Port: add.inputs[0], Type: 1024 });
    ok(`${C}: Type outside 0xFCBFF -> XSIOPTASKS 0x42E, 0x80070057`, status(bad, '80070057') && has(bad, /0x42E/), bad);
    const sinN = S.makeNode(op, g, 'Sin');
    const fx = run(C, { Port: sinN.inputs[0] });
    ok(`${C}: node with a defined type -> XSIOPTASKS 0x42F, 0x562E80C7 (nothing changed)`, !fx.err && has(fx, /0x42F/) && last() === 0x562e80c7 && sinN.inputs[0].type === 4, fx);
    add.inputs[1].allowedTypes = 4;
    const na = run(C, { Port: add.inputs[1], Type: 16 });
    ok(`${C}: Type not allowed on the port -> XSIOPTASKS 0x430, 0x562E80C7`, !na.err && has(na, /0x430/) && last() === 0x562e80c7 && add.inputs[1].type === 0, na);
    add.inputs[1].allowedTypes = 0xfffff;
    const c = S.makeCompound(op, g, 'Typed', ['In']); const inner = S.makeNode(op, c.graph, 'Negate');
    c.graph.links.push({ src: c.inputs[0], dst: inner.inputs[0] });
    run(C, { Port: c.inputs[0], Type: 2 });
    ok(`${C}: an exposed port is followed to the inner node's port`, inner.inputs[0].type === 2 && c.inputs[0].type === 0);
    inner.editable = false;
    ok(`${C}: node not editable -> 0x80004005`, status(run(C, { Port: inner.inputs[0] }), '80004005'));
    g.nodes = g.nodes.filter(n => n !== c && n !== sinN);
  }
  // CleanDisconnectedICENodes
  {
    const C = 'CleanDisconnectedICENodes';
    const flat = op.addNode('Scalar');
    const ex = S.graphOf(op).nodes.find(n => n.flatId === flat.id);
    const comp = S.makeCompound(op, g, 'Loose');
    const n0 = op.nodes.length, g0 = g.nodes.length;
    const u0 = A.undoStack.length;
    const r = run(C, { ICETree: T });
    ok(`${C}: nodes not feeding the root are deleted (graph and flat tree)`, !r.err && !g.nodes.includes(ex) && !g.nodes.includes(comp) && !op.nodes.some(n => n.id === flat.id) && !op.nodes.some(n => n.type === 'Execute')
      && g.nodes.some(n => n.type === 'Set Data') && g.nodes.some(n => n.type === 'Add') && g.nodes.some(n => n.type === 'Multiply by Scalar'), [r.err, g.nodes.map(n => n.name)]);
    ok(`${C}: undo restores`, undoOne(u0) && (A.undo(), op.nodes.length === n0 && g.nodes.length === g0 && g.nodes.includes(ex)) && (A.redo(), !g.nodes.includes(ex)));
    ok(`${C}: not an operator -> 0x80070057`, status(run(C, { ICETree: 'cube' }), '80070057'));
  }
  // CreateICENodeComment
  {
    const C = 'CreateICENodeComment';
    const add = nodeT('Add');
    const u0 = A.undoStack.length;
    const r = run(C, { InputObj: [cube, add] });
    ok(`${C}: comment created on the first ICE node and returned`, !r.err && r.v && r.v === add.comment && r.v.kind === 'ICENodeComment', r.err);
    const again = run(C, { InputObj: add });
    ok(`${C}: node already has a comment -> 0x111, 0x80070057`, status(again, '80070057') && has(again, /0x111/), again);
    ok(`${C}: undo deletes the comment`, undoOne(u0) && (A.undo(), add.comment === null));
    ok(`${C}: no ICE node -> 0x8000FFFF`, status(run(C, { InputObj: [cube] }), '8000ffff'));
  }
  // SetICESimInitState / RemoveICESimInitState
  {
    const C = 'SetICESimInitState', R = 'RemoveICESimInitState';
    const u0 = A.undoStack.length;
    const r = run(C, { InputObj: cube.fullName, Time: 12 });
    const s = S.simInitStates.get(cube);
    ok(`${C}: initial state stored at Time (frames -> seconds); service logged`, !r.err && s && s.frame === 12 && Math.abs(s.seconds - 12 / (A.anim.fps || 30)) < 1e-9 && Array.isArray(s.positions) && nya(r) === 1, r.err);
    ok(`${C}: undo`, undoOne(u0) && (A.undo(), !S.simInitStates.has(cube)) && (A.redo(), S.simInitStates.get(cube) === s));
    const rr = run(R, { InputObj: [cube] });
    ok(`${R}: removes the stored state; undo restores`, !rr.err && !S.simInitStates.has(cube) && (A.undo(), S.simInitStates.get(cube) === s));
    A.undo();
  }
  // TransferICETree
  {
    const C = 'TransferICETree';
    const other = A.run('CreatePrim', { PresetObj: 'Sphere' }) ?? A.selectedObjects[0];
    reset();
    const fromPrim = cube.primitive, toPrim = other.primitive;
    const u0 = A.undoStack.length;
    const r = run(C, { Operator: op, '3DObject': other.fullName });
    ok(`${C}: tree moved to 3DObject, returned as Value`, !r.err && r.v === op && toPrim.operators.includes(op) && !fromPrim.operators.includes(op) && op.parent === toPrim && op.owner() === other, r.err);
    ok(`${C}: Mode 0 keeps the construction region`, op.region === 'modeling' || op.region === (fromPrim && op.region));
    ok(`${C}: undo moves it back`, undoOne(u0) && (A.undo(), fromPrim.operators.includes(op) && !toPrim.operators.includes(op) && op.owner() === cube));
    ok(`${C}: Mode 2 -> 0x80070057`, status(run(C, { Operator: op, '3DObject': other, Mode: 2 }), '80070057'));
    ok(`${C}: Mode not an integer -> 0x80070057`, status(run(C, { Operator: op, '3DObject': other, Mode: '1' }), '80070057'));
    const b = run(C, { Operator: op, '3DObject': other, Branch: true });
    ok(`${C}: Branch: moved and marked a branch tree of 3DObject (inferred, logged)`, !b.err && nya(b) === 1 && toPrim.operators.includes(op) && op.branch === true && op.branchHost === other);
    A.undo();
    ok(`${C}: undo clears the branch mark`, op.branch === undefined && fromPrim.operators.includes(op));
    const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'b12Null' }); reset();
    ok(`${C}: target without geometry and no Branch -> nothing (silent refusal, build limit logged)`, (() => { const x = run(C, { Operator: op, '3DObject': nul }); return !x.err && fromPrim.operators.includes(op) && nya(x) === 1 && x.v === op; })());
    const bn = run(C, { Operator: op, '3DObject': nul, Branch: true });
    ok(`${C}: Branch to an object without geometry: tree stays, branch host recorded`, !bn.err && fromPrim.operators.includes(op) && op.branchHost === nul);
    A.undo();
    ok(`${C}: not an ICE tree -> 0x80070057`, status(run(C, { Operator: 'cube', '3DObject': other }), '80070057'));
  }
  reset();
  return out;
}, { NAMES, DEFAULT_OK: [...DEFAULT_OK] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_optasks_b12ab_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
