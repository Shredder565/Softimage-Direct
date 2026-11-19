// Analyst batch 13 answers to wire PR #185 (docs/re/WIRE_CORRECTIONS_B13.md, items 1-9), applied to the CMD-B12 wiring.
// No XSIBATCH golden: a contract check against the batch-13 addenda of docs/ghidra/cmd-b12a/b/d/e-*.md.
//   1 UpdateConnectOnOp bit mask 3 = replace          2 MoveOperator class tests (MoveAction 2 only)
//   3 TransferICETree modes / silent refusals / Value  4 RemovePortFromICENode (exposed port, output port, disconnect)
//   5 RemoveAttributeFromSetDataICENode unknown name   6 GetICECompoundPortProperties OutputArgs order, Enum text
//   7 EditExposedParamInICECompoundNode change rule    8 HideAllPortValues per-node rule, undo, referenced model
//   9 GetGeneratorInputsForDisposal 1 = delete, 2 = hide (named constants, operatorsScripts.ts numbering)
//   + AddPortToICENode (old name of AddPortToICENode2's task class) on the bus.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_b13_b12_corrections.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('TransferICETree') && !!window.Application?.commands?.get('UpdateConnectOnOp') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(() => {
  const A = window.Application; A.autoInspect = false;
  const D = A.optasksB12d, I = A.optasksB12, E = A.optasksB12e, MS = A.meshCurveStepTasks;
  const out = [];
  const ok = (name, cond, detail = '') => out.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const J = (x) => JSON.stringify(x);
  const mk = (preset, name) => A.run('CreatePrim', { PresetObj: preset, Name: name });
  const cube = A.scene.find('cube');

  // ================= 1. UpdateConnectOnOp
  {
    const c1 = mk('Cube', 'b13Cube'); const s1 = mk('Sphere', 'b13S1'); const s2 = mk('Sphere', 'b13S2'); const s3 = mk('Sphere', 'b13S3');
    const pl = mk('Grid', 'b13Plane');
    const slice = MS.tool.applySlicePolygons(c1);
    const inst = (g) => D.groupsOf(slice)[g].instances.map(r => r.map(x => x ? (x.name ?? (x.obj ? `${x.obj.name}.${x.kind}` : '?')) : null));
    A.run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [slice], Source: [s1] });
    A.undoStack.length = 0; A.redoStack.length = 0;
    const C = 'UpdateConnectOnOp';
    let r = run(C, { Operator: slice, GroupIndex: 1, GroupInstanceIndex: 0, InputObjs: [s2] });
    ok('1 UpdateConnectOnOp: a given input on a connected port replaces the connection', !r.err && J(inst(1)) === J([['b13S2']]), [r.err, inst(1)]);
    ok('1 UpdateConnectOnOp: the disconnected object source goes to Delete Objects (flag 0x10 meaning logged)', !A.scene.find('b13S1') && nya(r) === 1 && has(r, /0x10/), r.log);
    ok('1 UpdateConnectOnOp: one undo entry restores connection and object', A.undoStack.length === 1 && (A.undo(), J(inst(1)) === J([['b13S1']]) && !!A.scene.find('b13S1')));
    A.redo(); ok('1 UpdateConnectOnOp: redo', J(inst(1)) === J([['b13S2']]) && !A.scene.find('b13S1'));
    A.undo();
    r = run(C, { Operator: slice, GroupIndex: 1, InputObjs: [s1] });
    ok('1 UpdateConnectOnOp: the same input again = nothing deleted', !r.err && !!A.scene.find('b13S1') && nya(r) === 0 && J(inst(1)) === J([['b13S1']]), [r.err, inst(1)]);
    r = run(C, { Operator: slice, GroupIndex: 1, InputObjs: [null] });
    ok('1 UpdateConnectOnOp: no input for a port keeps its connection', !r.err && J(inst(1)) === J([['b13S1']]), [r.err, inst(1)]);
    r = run(C, { Operator: slice, GroupIndex: 1, InputObjs: [null], ForceDisconnect: true });
    ok('1 UpdateConnectOnOp: ForceDisconnect on an optional port (dynamic group, inferred) disconnects it, nothing deleted', !r.err && J(inst(1)) === J([[null]]) && !!A.scene.find('b13S1'), [r.err, inst(1)]);
    A.undo();
    const prim0 = D.groupsOf(slice)[0].instances[0][0];
    r = run(C, { Operator: slice, GroupIndex: 0, InputObjs: [null], ForceDisconnect: true });
    ok('1 UpdateConnectOnOp: ForceDisconnect leaves a required port connected', !r.err && D.groupsOf(slice)[0].instances[0][0] === prim0, r.err);
    A.run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [slice], Source: ['b13Plane.poly[0]'] });
    r = run(C, { Operator: slice, GroupIndex: 1, InputObjs: [s3] });
    ok('1 UpdateConnectOnOp: a sub-component source is disconnected, not deleted', !r.err && J(inst(1)) === J([['b13S3']]) && !!A.scene.find('b13Plane') && nya(r) === 0, [r.err, inst(1)]);
    ok('1 UpdateConnectOnOp: null operator -> 0x80004003', status(run(C, { InputObjs: [s3] }), '80004003'));
    ok('1 UpdateConnectOnOp: no InputObjs -> 0x80004005', status(run(C, { Operator: slice }), '80004005'));
    void pl;
  }

  // ================= 2. MoveOperator
  {
    const o = mk('Cylinder', 'b13Move');
    A.select([o]); const twist = A.run('ApplyOp', { PresetObj: 'Twist' })[0]; A.select([o]); const bend = A.run('ApplyOp', { PresetObj: 'Bend' })[0]; A.select([o]); const taper = A.run('ApplyOp', { PresetObj: 'Taper' })[0];
    const prim = o.primitive; const gen = prim.operators[0];
    const stack = () => prim.operators.map(x => x === gen ? 'gen' : x === twist ? 'twist' : x === bend ? 'bend' : x === taper ? 'taper' : '?').join();
    const ssm = prim.explorerChildren().find(n => n.type === 'secondaryshapemarker'), anim = prim.explorerChildren().find(n => n.type === 'animationmarker');
    const C = 'MoveOperator';
    let r = run(C, { Object: o, OperatorToMove: twist, MoveAction: 2, OperatorReference: ssm });
    ok('2 MoveOperator: MoveAction 2 on the Secondary Shape marker ({dba00978-85be-...}) -> 0x407, stop', !r.err && has(r, /XSIOPTASKS 0x407/) && stack() === 'gen,twist,bend,taper', r);
    r = run(C, { Object: o, OperatorToMove: twist, MoveAction: 2, OperatorReference: anim });
    ok('2 MoveOperator: the Animation marker is not of that class (no 0x407)', !r.err && !has(r, /0x407/) && twist.region === 'animation', [r.err, twist.region]);
    A.undo();
    const t0 = bend.type;
    bend.type = 'PostSimulationMarker';
    r = run(C, { Object: o, OperatorToMove: twist, MoveAction: 2, OperatorReference: bend });
    ok('2 MoveOperator: a Post Simulation marker reference (same class) -> 0x407, stop', !r.err && has(r, /XSIOPTASKS 0x407/) && stack() === 'gen,twist,bend,taper', r);
    bend.type = 'scmfixer';
    r = run(C, { Object: o, OperatorToMove: twist, MoveAction: 2, OperatorReference: bend });
    ok('2 MoveOperator: a C3DSCMFixerOp2 reference ({4ed3b713-...}) stops silently', !r.err && !has(r, /XSIOPTASKS/) && stack() === 'gen,twist,bend,taper', r);
    r = run(C, { Object: o, OperatorToMove: taper, MoveAction: 1, OperatorReference: bend });
    ok('2 MoveOperator: the class tests run only for MoveAction 2 (MoveAction 1 moves)', !r.err && !has(r, /0x407/) && stack() === 'gen,twist,taper,bend', [r.err, stack()]);
    A.undo();
    bend.type = t0;
  }

  // ================= ICE fixture (CMD-B12a/b)
  const op = A.run('ApplyICEOp', { File: 'Push Points', Target: cube.fullName });
  const g = I.graphOf(op);
  const nodeT = (t, i = 0) => g.nodes.filter(n => n.type === t)[i];
  const last = () => I.lastStatus?.status;
  const lay = (items) => items.map(i => i.kind === 'port' ? i.port.name : `${i.name}[${lay(i.items)}]`).join(',');

  // ================= 6 / 7. GetICECompoundPortProperties / EditExposedParamInICECompoundNode
  {
    const c = I.makeCompound(op, g, 'B13Props', ['In'], ['Out']);
    const p = c.inputs[0];
    const Ed = 'EditExposedParamInICECompoundNode', G = 'GetICECompoundPortProperties';
    let r = run(Ed, { Parameter: p, Name: 'Amount', Min: '0', Max: '10', Picking: 'pk', Description: 'How much', ExposeType: 99, Enum: 'a,1;bad;,x;y,;c,3,4', PPGLayoutGroup: 'Ctl' });
    ok('7 Edit: fields applied; ExposeType passed through unchanged', !r.err && p.name === 'Amount' && p.exposed.min === '0' && p.exposed.exposeType === 99 && lay(c.layout) === 'Ctl[Amount]', [r.err, p.exposed]);
    r = run(G, { Parameter: p });
    ok('6 Get: 8 values Name, Min, Max, Picking, Description, ExposeType, Enum, PPGLayoutGroup', !r.err && J(r.v) === J(['Amount', '0', '10', 'pk', 'How much', 99, 'a,1;c,3,4;', 'Ctl']) && nya(r) === 0, r);
    ok('7 Edit: Enum items without "," or with an empty part are dropped; split at the first ","', r.v?.[6] === 'a,1;c,3,4;', r.v);
    ok('6 Get: ExposeType is an integer (I4)', Number.isInteger(r.v?.[5]));
    const u0 = A.undoStack.length;
    r = run(Ed, { Parameter: p });
    ok('7 Edit: an empty Name keeps the name; empty strings are values (Min, Max, Picking, Description, Enum, group cleared)', !r.err && p.name === 'Amount' && p.exposed.min === '' && p.exposed.max === '' && p.exposed.picking === '' && p.exposed.description === '' && p.exposed.enumText === '' && p.exposed.ppgGroup === '' && p.exposed.exposeType === 0 && nya(r) === 0, [r.err, p.exposed]);
    ok('7 Edit: undo restores the previous properties', A.undoStack.length === u0 + 1 && (A.undo(), p.exposed.min === '0' && p.exposed.enumText === 'a,1;c,3,4;' && lay(c.layout) === 'Ctl[Amount]'));
    r = run(Ed, { Parameter: p, Name: '', Min: '0', Max: '10', Picking: 'pk', Description: 'How much', ExposeType: 99, Enum: 'a,1;c,3,4', PPGLayoutGroup: 'Ctl' });
    ok('7 Edit: the last Enum item may omit its ";" (same items = no change)', !r.err && p.exposed.enumText === 'a,1;c,3,4;' && lay(c.layout) === 'Ctl[Amount]', [r.err, p.exposed.enumText]);
    const stray = new p.constructor('Stray', 'in', c, 'Stray'); stray.exposed = { ...p.exposed };
    ok('6 Get: a port the compound does not list -> 0x80004005', status(run(G, { Parameter: stray }), '80004005'));
    ok('7 Edit: a port the compound does not list -> 0x80004005', status(run(Ed, { Parameter: stray, Name: 'x' }), '80004005'));
    c.lockLevels = 1; ok('7 Edit: locked compound -> 0x80070005', status(run(Ed, { Parameter: p, Name: 'x' }), '80070005')); c.lockLevels = 0;
    g.nodes = g.nodes.filter(n => n !== c);
  }

  // ================= 8. HideAllPortValues
  {
    const C = 'HideAllPortValues';
    const add = nodeT('Add'), sd = nodeT('Set Data');
    const c = I.makeCompound(op, g, 'B13Hide', ['X']); const inner = I.makeNode(op, c.graph, 'Negate');
    const connected = add.inputs.filter(p => g.links.some(l => l.dst === p)).length;
    sd.inputs[0].valueShown = false;   // hidden before the command
    let before = I.refreshes; let u0 = A.undoStack.length;
    let r = run(C, { InputObjs: [add, sd, c] });
    ok('8 Hide: every input port hidden, connected ones included', !r.err && connected > 0 && add.inputs.every(p => !p.valueShown) && sd.inputs.every(p => !p.valueShown), [r.err, connected]);
    ok('8 Hide: a compound is walked recursively (inner nodes hidden too)', c.inputs.every(p => !p.valueShown) && inner.inputs.every(p => !p.valueShown));
    ok('8 Hide: no "not yet attested" line; refresh once; status 0', nya(r) === 0 && I.refreshes === before + 1 && last() === 0, r.log);
    ok('8 Hide: undo shows every listed port, also the one hidden before', A.undoStack.length === u0 + 1 && (A.undo(), add.inputs.every(p => p.valueShown) && sd.inputs.every(p => p.valueShown) && inner.inputs.every(p => p.valueShown)));
    A.redo();
    before = I.refreshes;
    r = run(C, { InputObjs: [add] });
    ok('8 Hide: nothing changed = no refresh', !r.err && I.refreshes === before, [I.refreshes, before]);
    c.readOnly = true; for (const p of c.inputs) p.valueShown = true;
    run(C, { InputObjs: [c] });
    ok('8 Hide: a read-only compound is left as it is', c.inputs.every(p => p.valueShown));
    c.readOnly = false;
    add.inReferencedModel = true;
    r = run(C, { InputObjs: [add] });
    ok('8 Hide: a node in a referenced model -> XSIOPTASKS 0x425, 0x80070005', status(r, '80070005') && has(r, /XSIOPTASKS 0x425/), r);
    add.inReferencedModel = false;
    g.nodes = g.nodes.filter(n => n !== c);
  }

  // ================= 4. RemovePortFromICENode (+ AddPortToICENode)
  {
    const R = 'RemovePortFromICENode';
    op.addNode('Execute');
    const ex = I.graphOf(op).nodes.find(n => n.type === 'Execute');
    let r = run('AddPortToICENode', { Port: ex.inputs[2], InsertLocation: 'siNodePortDataInsertionLocationAfter' });
    ok('+ AddPortToICENode: on the bus; returns the single created port, NewPorts not filled', !r.err && r.v && r.v === ex.inputs[3] && I.lastStatus?.command === 'AddPortToICENode' && !Array.isArray(r.v), r.err);
    const src = nodeT('Add').outputs[0];
    g.links.push({ src, dst: ex.inputs[3] });
    const u0 = A.undoStack.length; const port = ex.inputs[3];
    r = run(R, { Port: port });
    ok('4 Remove: a connected instance is disconnected, then removed', !r.err && !ex.inputs.includes(port) && !g.links.some(l => l.dst === port), r.err);
    ok('4 Remove: undo restores port and connection', A.undoStack.length === u0 + 1 && (A.undo(), ex.inputs.includes(port) && g.links.some(l => l.src === src && l.dst === port)));
    r = run(R, { Port: nodeT('Add').outputs[0] });
    ok('4 Remove: an output port -> XSIOPTASKS 0x417, 0x80004005', status(r, '80004005') && has(r, /XSIOPTASKS 0x417/), r);
    const c = I.makeCompound(op, g, 'B13Rm', ['P', 'Q']); const inner = I.makeNode(op, c.graph, 'Negate');
    c.graph.links.push({ src: c.inputs[0], dst: inner.inputs[0] }); c.inputs[0].value = 5;
    const pp = c.inputs[0];
    r = run(R, { Port: pp });
    ok('4 Remove: a compound port runs RemoveExposedParamFromICECompoundNode (port gone, inner port keeps the value)', !r.err && !c.inputs.includes(pp) && inner.inputs[0].value === 5 && !c.graph.links.some(l => l.src === pp), r.err);
    ok('4 Remove: undo restores the exposed port', (A.undo(), c.inputs[0] === pp && c.graph.links.some(l => l.src === pp)));
    g.nodes = g.nodes.filter(n => n !== c);
  }

  // ================= 5. RemoveAttributeFromSetDataICENode
  {
    const R = 'RemoveAttributeFromSetDataICENode';
    const sd = nodeT('Set Data'); const before = J(sd.attributes.map(a => a.name)); const ports = sd.inputs.length;
    const u0 = A.undoStack.length;
    const r = run(R, { SetDataNode: sd, AttributeName: 'Self.NoSuchB13' });
    ok('5 RemoveAttribute: unknown name -> XSIOPTASKS 0x415, nothing changes, succeeds', !r.err && has(r, /XSIOPTASKS 0x415/) && last() === 0 && J(sd.attributes.map(a => a.name)) === before && sd.inputs.length === ports && A.undoStack.length === u0 && nya(r) === 0, r);
    A.run('AddAttributeToSetDataICENode', { SetDataNode: sd, AttributeName: 'Self.B13' });
    const at = sd.attributes.at(-1); const src = nodeT('Add').outputs[0];
    g.links.push({ src, dst: at.port });
    const r2 = run(R, { SetDataNode: sd, AttributeName: 'Self.B13' });
    ok('5 RemoveAttribute: a connected attribute is disconnected, then removed', !r2.err && !sd.attributes.includes(at) && !g.links.some(l => l.dst === at.port), r2.err);
    A.undo(); A.undo();
  }

  // ================= 3. TransferICETree
  {
    const C = 'TransferICETree';
    const sph = mk('Sphere', 'b13Tgt');
    const fromPrim = cube.primitive, toPrim = sph.primitive;
    const n0 = op.nodes.length;
    const u0 = A.undoStack.length;
    let r = run(C, { Operator: op, '3DObject': sph, Mode: 1 });
    const copy = toPrim.operators.find(x => x.type === 'icetree');
    ok('3 Transfer Mode 1 = copy: the original stays, a duplicate goes to the target', !r.err && fromPrim.operators.includes(op) && copy && copy !== op && copy.nodes.length === n0 && J(copy.links) === J(op.links) && copy.owner() === sph, r.err);
    ok('3 Transfer Mode 1: Value is the original operator', r.v === op);
    ok('3 Transfer Mode 1: the copy keeps the construction region', copy && copy.region === op.region);
    ok('3 Transfer Mode 1: undo removes the copy', A.undoStack.length === u0 + 1 && (A.undo(), !toPrim.operators.some(x => x.type === 'icetree')));
    r = run(C, { Operator: op, '3DObject': A.scene.root });
    ok('3 Transfer: target Scene_Root = silent no-op', !r.err && fromPrim.operators.includes(op) && A.undoStack.length === u0 && r.v === op, r.err);
    sph.lockLevel = 1;
    r = run(C, { Operator: op, '3DObject': sph });
    ok('3 Transfer: locked target = silent no-op', !r.err && fromPrim.operators.includes(op) && A.undoStack.length === u0, r.err);
    delete sph.lockLevel;
    r = run(C, { '3DObject': sph });
    ok('3 Transfer: null operator = silent no-op', !r.err && A.undoStack.length === u0, r.err);
    r = run(C, { Operator: op });
    ok('3 Transfer: null target = silent no-op', !r.err && A.undoStack.length === u0, r.err);
    r = run(C, { Operator: op, '3DObject': sph.properties[0] });
    ok('3 Transfer: a target that is not a 3D object (kind not 2 / 8) = silent no-op', !r.err && A.undoStack.length === u0, r.err);
    cube.lockLevel = 1;
    r = run(C, { Operator: op, '3DObject': sph });
    ok('3 Transfer Mode 0: a locked owner = silent no-op', !r.err && fromPrim.operators.includes(op) && A.undoStack.length === u0, r.err);
    r = run(C, { Operator: op, '3DObject': sph, Mode: 1 });
    ok('3 Transfer Mode 1: the owner lock check is Mode 0 only (copy made)', !r.err && toPrim.operators.some(x => x.type === 'icetree'), r.err);
    A.undo(); delete cube.lockLevel;
    r = run(C, { Operator: op, '3DObject': sph });
    ok('3 Transfer Mode 0 = move; Value is the operator', !r.err && toPrim.operators.includes(op) && !fromPrim.operators.includes(op) && r.v === op, r.err);
    A.undo();
    ok('3 Transfer: Mode 2 -> 0x80070057', status(run(C, { Operator: op, '3DObject': sph, Mode: 2 }), '80070057'));
  }

  // ================= 9. GetGeneratorInputsForDisposal
  {
    const C = 'GetGeneratorInputsForDisposal';
    const sA = mk('Sphere', 'b13GA'), sB = mk('Sphere', 'b13GB');
    const gen = A.run('ApplyGenOp', { PresetObj: 'MeshMerge', ConnectionSet: [sA, sB] }); const gop = gen.primitive.operators[0];
    const gen2 = A.run('ApplyGenOp', { PresetObj: 'MeshMerge', ConnectionSet: [sA, mk('Sphere', 'b13GC')] });
    const names = (r) => (r.v ?? []).map(o => o.name).join();
    let r = run(C, { InputObjs: gop, GenOpInputsDisposal: 'siDeleteGenOpInputs' });
    ok('9 Disposal: siDeleteGenOpInputs = 1 = delete (an input still read by another generator is kept, inferred)', !r.err && names(r) === 'b13GB', [r.err, names(r)]);
    r = run(C, { InputObjs: gop, GenOpInputsDisposal: 'siHideGenOpInputs' });
    ok('9 Disposal: siHideGenOpInputs = 2 = hide (every input)', !r.err && names(r) === 'b13GA,b13GB', [r.err, names(r)]);
    r = run(C, { InputObjs: gop, GenOpInputsDisposal: ':siDeleteGenOpInputs:siGenOpInputsDisposalMode' });
    ok('9 Disposal: the registry spelling of the constant', !r.err && names(r) === 'b13GB', [r.err, names(r)]);
    ok('9 Disposal: siKeepGenOpInputs (0) -> 0x80070057', status(run(C, { InputObjs: gop, GenOpInputsDisposal: 'siKeepGenOpInputs' }), '80070057'));
    ok('9 Disposal: 3 -> 0x80070057', status(run(C, { InputObjs: gop, GenOpInputsDisposal: 3 }), '80070057'));
    void gen2; void E;
  }
  return out;
});

let fail = 0, pass = 0;
for (const [name, cond, detail] of got) { if (cond) { pass++; console.log(`ok   ${name}`); } else { fail++; console.log(`FAIL ${name} ${detail}`); } }
if (pageErrors.length) { fail++; console.log(`FAIL page errors: ${pageErrors.join(' | ')}`); }
await browser.close();
console.log(`compare_b13_b12_corrections: ${pass}/${pass + fail} ok`);
process.exit(fail ? 1 : 0);
