// CMD-B20b (grouptask.dll partitions / groups, environments.dll SetCurrentEnvironment / SIStoreEnvironmentCacheToMixer,
// viewinteraction.dll MoveJoint / SICreateSkeleton, gap.dll CreateVertexColorSupport / PaintVertexColors,
// siclustertasks.dll CopyCluster, pathanimtask.dll SaveKeyOnPath): the commands of src/commands/groupsB20b.ts plus the
// CMD-B7a SetInstanceGroup / RemoveInstanceGroup confirmations.
// There is no XSIBATCH golden for the row: this is a contract check against section 3 of
// docs/ghidra/cmd-b20b-groups-env-skeleton-vcolor.md and items 1-14 of docs/re/WIRE_CORRECTIONS_B20.md (CMD-B20b).
//   1. every name is registered with the registry argument list (data/command_registry.json, first entry of the
//      scripting name; output-only arguments, flag 0x200, left out; "Save Locked Key on Path" = registry entry 260);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an error, except the
//      ones whose contract requires an input that the default does not give (expected status listed in DEFAULT_FAILS);
//   3. the contract's stated results, statuses and undo / redo.
// Needs `vite preview` (SI_URL, default :4173). Usage: SI_URL=http://localhost:4182/ node tools/compare_groups_b20b.mjs
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
  'AddToPartition', 'RemoveFromPartition', 'SIAddToGroupLowLevel', 'SIRemoveFromGroup', 'SICreateGroup', 'AddGroup',
  'SetInstanceGroup', 'RemoveInstanceGroup', 'SetCurrentEnvironment', 'SIStoreEnvironmentCacheToMixer',
  'MoveJoint', 'SICreateSkeleton', 'CreateVertexColorSupport', 'PaintVertexColors', 'CopyCluster', 'SaveKeyOnPath',
  'Save Locked Key on Path',
];
const DEFAULT_FAILS = {
  AddToPartition: 0x80070057,            // no Target given or found
  RemoveFromPartition: 0x80070057,       // the cube sits in no explicit partition
  SetInstanceGroup: 0x8000ffff,          // CMD-B7a: empty Object list
  RemoveInstanceGroup: 0x8000ffff,
  SetCurrentEnvironment: 0x80004002,     // the selected cube is not an environment
  SIStoreEnvironmentCacheToMixer: 0x80004002,
  MoveJoint: 0x80070057,                 // the cube is not a chain element
  PaintVertexColors: 0x80070057,         // empty Polynodes / Colors
  CopyCluster: 0x80004002,               // no cluster
  SaveKeyOnPath: 0x80020008,             // Time is required
  'Save Locked Key on Path': 0x80020008,
};
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n) ?? reg.find(x => x.name === n); if (!c) return [n, null];
  const f = full.find(x => (x.scripting_name || x.name) === n); const fd = Object.fromEntries((f?.args ?? []).map(a => [a.name, a.default]));
  return [n, c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? fd[a.name] ?? null])];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.scene?.find('cube') && !!window.Application?.scene?.find('root_null'), null, { timeout: 60000 });
await page.waitForTimeout(800);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const S = () => A.groupsB20b;
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); return { v, log: A.log.slice(m).filter(l => l.kind !== 'cmd').map(l => l.text), status: S()?.status?.[n] }; } catch (e) { return { err: String(e?.message ?? e), code: e?.status, log: A.log.slice(m).map(l => l.text), status: S()?.status?.[n] }; } };
  const nya = (r) => (r.log ?? []).some(l => /not yet attested/.test(l) && /CMD-B20b/.test(l));
  const J = JSON.stringify;
  const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
  const cube = A.scene.find('cube'), sph = A.scene.find('sphere'), rn = A.scene.find('root_null');
  const names = (l) => [...(l ?? [])].map(n => n.name);
  const reset = () => { A.anim.stop?.(); A.compSel = null; A.setSelMode('object'); A.select([cube]); if (S()) { S().calls = []; } };
  const undoRedo = (label, read, before, after) => { A.undo(); const u = read(); A.redo(); const r2 = read(); ok(`${label}: undo / redo`, J(u) === J(before) && J(r2) === J(after), [u, r2]); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = DEFAULT_FAILS[n] !== undefined ? (r.err && r.code === DEFAULT_FAILS[n] ? 'ok' : `expected failure 0x${DEFAULT_FAILS[n].toString(16)}, got ${r.err ?? 'success'}`) : r.err ? 'ERROR: ' + r.err : 'ok';
  }
  reset();

  try {
    const pass = A.scene.passes[0];
    const bgO = pass.partitions.find(p => p.name === 'Background_Objects_Partition');
    const P1 = pass.addPartition('P1_B20b'), P2 = pass.addPartition('P2_B20b');
    const mem = (p) => names(p.members).sort();
    // ================= AddToPartition (correction 1)
    let r = run('AddToPartition', { Target: P1, InputObjs: [cube] });
    ok('AddToPartition: the object moves into the Target partition', !r.err && J(mem(P1)) === J(['cube']), [r.err, mem(P1)]);
    undoRedo('AddToPartition', () => mem(P1), [], ['cube']);
    r = run('AddToPartition', { InputObjs: [P2, sph] });
    ok('AddToPartition: the first partition in InputObjs is the Target', !r.err && J(mem(P2)) === J(['sphere']), [r.err, mem(P2)]);
    r = run('AddToPartition', { Target: 'P2_B20b', InputObjs: 'cube' });
    ok('AddToPartition: a move: out of the source partition of the pass', !r.err && J(mem(P2)) === J(['cube', 'sphere']) && mem(P1).length === 0, [r.err, mem(P1), mem(P2)]);
    undoRedo('AddToPartition (move)', () => [mem(P1), mem(P2)], [['cube'], ['sphere']], [[], ['cube', 'sphere']]);
    const G = run('SICreateGroup', { Name: 'GB20b' }).v; G.members.push(rn);
    r = run('AddToPartition', { Target: P1, InputObjs: [G] });
    ok('AddToPartition: an ordinary group in InputObjs contributes its members', !r.err && J(mem(P1)) === J(['root_null']), [r.err, mem(P1)]);
    r = run('AddToPartition', { Target: bgO, InputObjs: [cube, rn] });
    ok('AddToPartition: objects from two partitions -> 0x80070057 with warning 0x93', r.code === 0x80070057 && r.log.some(l => /^WARNING : .*0x93/.test(l)) && J(mem(P1)) === J(['root_null']), r);
    r = run('AddToPartition', { Target: G, InputObjs: [cube] });
    ok('AddToPartition: a Target that is not a partition -> 0x80070057', r.code === 0x80070057, r);
    r = run('AddToPartition', { Target: cube, InputObjs: [sph] });
    ok('AddToPartition: a Target without group kind -> 0x80004002', r.code === 0x80004002, r);
    r = run('AddToPartition', { InputObjs: [cube] });
    ok('AddToPartition: no Target at all -> 0x80070057', r.code === 0x80070057, r);
    // ================= RemoveFromPartition (correction 2)
    r = run('RemoveFromPartition', { Target: P1, InputObjs: [rn] });
    ok('RemoveFromPartition: removes from the given partition; destination logged not yet attested', !r.err && mem(P1).length === 0 && nya(r), r);
    undoRedo('RemoveFromPartition', () => mem(P1), ['root_null'], []);
    r = run('RemoveFromPartition', { InputObjs: [cube] });
    ok('RemoveFromPartition: the partition is derived from the objects', !r.err && J(mem(P2)) === J(['sphere']), [r.err, mem(P2)]);
    r = run('RemoveFromPartition', { InputObjs: [cube] });
    ok('RemoveFromPartition: no partition derivable -> 0x80070057', r.code === 0x80070057, r);
    r = run('RemoveFromPartition', { InputObjs: [P2, sph] });
    ok('RemoveFromPartition: the partition may be given inside InputObjs', !r.err && mem(P2).length === 0, [r.err, mem(P2)]);

    // ================= SICreateGroup (correction 5)
    const Model = A.scene.root.constructor; const mdl = new Model('MdlB20b'); A.scene.root.addChild(mdl);
    reset(); const n0 = A.scene.groupList.length;
    r = run('SICreateGroup', { Name: 'GX' }); const GX = r.v;
    ok('SICreateGroup: empty group under the current scene model, returned, Value written', !r.err && GX?.name === 'GX' && GX.members.length === 0 && GX.parent === A.scene.root && S().out.SICreateGroup.Value === GX && A.scene.groupList.length === n0 + 1, r);
    undoRedo('SICreateGroup', () => A.scene.groupList.includes(GX), false, true);
    r = run('SICreateGroup', { Name: 'GC', Parent: cube });
    ok('SICreateGroup: a Parent that is not a container falls back to the scene model', !r.err && r.v?.parent === A.scene.root, r); A.undo();
    r = run('SICreateGroup', { Name: 'GM', Parent: 'MdlB20b' });
    ok('SICreateGroup: a model Parent', !r.err && r.v?.parent === mdl, r); A.undo();
    r = run('SICreateGroup', { Name: 5 });
    ok('SICreateGroup: Name must be a string -> 0x80070057', r.code === 0x80070057, r);
    mdl.ref = { file: 'x.emdl', resolution: 1, resolutions: [] }; const n1 = A.scene.groupList.length;
    r = run('SICreateGroup', { Name: 'GR', Parent: mdl });
    ok('SICreateGroup: a container refusing groups (referenced model, inferred): warning XSIGROUPTASKS 11, no group', !r.err && r.v === undefined && A.scene.groupList.length === n1 && r.log.some(l => /^WARNING : .*XSIGROUPTASKS 0xb/.test(l)), r);
    delete mdl.ref;

    // ================= SIAddToGroupLowLevel (correction 3)
    reset(); const G2 = run('SICreateGroup', { Name: 'G2B20b' }).v;
    r = run('SIAddToGroupLowLevel', { InputObjs: [G2, cube] });
    ok('SIAddToGroupLowLevel: empty Target = the first ordinary group of InputObjs; members added and returned', !r.err && J(names(G2.members)) === J(['cube']) && J(names(r.v)) === J(['cube']) && nya(r), r);
    undoRedo('SIAddToGroupLowLevel', () => names(G2.members), [], ['cube']);
    r = run('SIAddToGroupLowLevel', { Target: G2, InputObjs: [sph] });
    ok('SIAddToGroupLowLevel: given Target', !r.err && J(names(G2.members)) === J(['cube', 'sphere']), r);
    r = run('SIAddToGroupLowLevel', { Target: A.scene.layers[0], InputObjs: [sph] });
    ok('SIAddToGroupLowLevel: a layer is not an ordinary group -> 0x80070057', r.code === 0x80070057, r);
    r = run('SIAddToGroupLowLevel', { InputObjs: [P1, rn] });
    ok('SIAddToGroupLowLevel: partitions are skipped; no target = not applicable (S_FALSE, nothing added)', !r.err && r.status === 1 && !P1.members.has(rn), r);

    // ================= SIRemoveFromGroup (correction 4)
    r = run('SIRemoveFromGroup', { InputObjs: [sph, rn] });
    ok('SIRemoveFromGroup: members of different groups -> no target, nothing removed', !r.err && J(names(G2.members)) === J(['cube', 'sphere']) && J(names(G.members)) === J(['root_null']) && r.status === 1, r);
    r = run('SIRemoveFromGroup', { InputObjs: [sph] });
    ok('SIRemoveFromGroup: the single group all members share', !r.err && J(names(G2.members)) === J(['cube']), r);
    undoRedo('SIRemoveFromGroup', () => names(G2.members), ['cube', 'sphere'], ['cube']);
    r = run('SIRemoveFromGroup', { InputObjs: [G, rn] });
    ok('SIRemoveFromGroup: a group given inside InputObjs', !r.err && G.members.length === 0, r);
    G2.members.push(rn); G.members.push(rn);
    r = run('SIRemoveFromGroup', { Target: G, InputObjs: [rn] });
    ok('SIRemoveFromGroup: the given Target only (not every group holding the object)', !r.err && G.members.length === 0 && G2.members.includes(rn), r);

    // ================= AddGroup (correction 6)
    reset(); r = run('AddGroup', { Target: mdl, InputObjs: [GX] });
    ok('AddGroup: the group is re-parented under the Target model', !r.err && GX.parent === mdl, r);
    undoRedo('AddGroup', () => GX.parent === mdl, false, true);
    A.select([]); r = run('AddGroup', { Target: mdl });
    ok('AddGroup: empty InputObjs -> 0x80004005', r.code === 0x80004005, r);
    r = run('AddGroup', { Target: mdl, InputObjs: [A.scene.layers[0]] });
    ok('AddGroup: a group that cannot move is reported (message 0x34) and dropped; nothing left = no-op', !r.err && r.status === 0x562e80d2 && r.log.some(l => /^INFO : .*0x34/.test(l)), r);
    A.lockRecordsB11 ??= new Map(); A.lockRecordsB11.set(mdl, [{ id: 0, lockLevel: 0xffff, tagLevel: 0, type: 0 }]);
    r = run('AddGroup', { Target: mdl, InputObjs: [G2] });
    ok('AddGroup: a locked Target -> 0x80070005', r.code === 0x80070005 && G2.parent !== mdl, r);
    A.lockRecordsB11.delete(mdl);
    r = run('AddGroup', { Target: cube, InputObjs: [G2] });
    ok('AddGroup: a Target that is not a group container -> error', !!r.err, r);

    // ================= SetInstanceGroup / RemoveInstanceGroup (correction 7: one registration, CMD-B7a)
    {
      const d = A.commands.get('SetInstanceGroup');
      ok('SetInstanceGroup / RemoveInstanceGroup: the CMD-B7a bodies (no hair-name test)', run('SetInstanceGroup', { Object: cube, Group: G2 }).err === 'SetInstanceGroup: cube is not a group container (status 0x80070057)' && !!d, null);
    }

    // ================= SetCurrentEnvironment
    reset(); const env = A.run('CreateEnvironment', { Name: 'EnvB20b' }); const prevEnv = A.scene.currentEnvironment ?? null;
    r = run('SetCurrentEnvironment', { InputObj: env });
    ok('SetCurrentEnvironment: the environment becomes current', !r.err && A.scene.currentEnvironment === env, r);
    undoRedo('SetCurrentEnvironment', () => A.scene.currentEnvironment === env, prevEnv === env, true);
    r = run('SetCurrentEnvironment', { InputObj: cube });
    ok('SetCurrentEnvironment: not an environment -> 0x80004002', r.code === 0x80004002, r);

    // ================= SIStoreEnvironmentCacheToMixer (correction 8)
    {
      const cache = A.run('CreateEnvironmentCache', { Model: A.scene.root, Environment: env });
      cache.items = [{ name: 'cube', file: 'cube.#.icecache', start: 1, count: 10 }, { name: 'sphere', type: 0x15 }];
      reset(); r = run('SIStoreEnvironmentCacheToMixer', { EnvironmentCache: cache, Name: '', AddClip: true });
      const act = r.v; const fps = A.anim.fps;
      ok('SIStoreEnvironmentCacheToMixer: an action source "SimulationRun" over the simulation range (seconds), in the model, returned as Action', !r.err && act?.name === 'SimulationRun' && act.type === 'actionsource' && near(act.val('StartTime'), A.anim.startFrame / fps) && near(act.val('EndTime'), A.anim.endFrame / fps) && A.scene.root.properties.includes(act) && S().out.SIStoreEnvironmentCacheToMixer.Action === act, r);
      ok('SIStoreEnvironmentCacheToMixer: one AddFileCacheSource per item, "#" -> [start..start+count], then AddClip at the start', J(S().calls.map(c => c.cmd)) === J(['AddFileCacheSource', 'AddFileCacheSource', 'AddClip']) && act.fileCacheItems[0].file === 'cube.[1..11].icecache' && act.fileCacheItems[0].target === `${A.scene.root.name}.cube` && /\[\d+\.\.\d+\]/.test(act.fileCacheItems[1].file), [S().calls, act?.fileCacheItems]);
      ok('SIStoreEnvironmentCacheToMixer: unread branches logged not yet attested', nya(r), r.log);
      undoRedo('SIStoreEnvironmentCacheToMixer', () => A.scene.root.properties.includes(act), false, true);
      A.undo();
      cache.items = [];
      r = run('SIStoreEnvironmentCacheToMixer', { EnvironmentCache: cache, Name: 'Run2' });
      ok('SIStoreEnvironmentCacheToMixer: nothing stored -> the action is not added to the mixer', !r.err && r.v?.name === 'Run2' && !A.scene.root.properties.includes(r.v) && S().out.SIStoreEnvironmentCacheToMixer.stored === false, r);
    }

    // ================= MoveJoint (correction 9)
    {
      reset(); const ch = A.run('Create3DSkeleton', { Points: [[0, 0, 0], [2, 0, 0], [4, 0, 0]] });
      const b1 = ch.bones[0], b2 = ch.bones[1];
      const lens = () => ch.bones.map(b => Math.round(b.val('length') * 1e4) / 1e4);
      const endP = () => { const v = ch.chainEnd(); return [v.x, v.y, v.z].map(x => Math.round(x * 1e4) / 1e4); };
      r = run('MoveJoint', { InputObjs: b2, X: 2, Y: 2, Z: 0 });
      const s8 = Math.round(Math.sqrt(8) * 1e4) / 1e4;
      ok('MoveJoint: the joint goes to (X,Y,Z); the adjacent bones adapt, the chain end stays', !r.err && J(lens()) === J([s8, s8]) && J(endP()) === J([4, 0, 0]), [r.err, lens(), endP()]);
      undoRedo('MoveJoint', () => lens(), [2, 2], [s8, s8]); A.undo();
      r = run('MoveJoint', { InputObjs: b2, X: 2, Y: 2, Z: 0, MoveJointBranch: true });
      ok('MoveJoint MoveJointBranch (inferred): the downstream joints follow', !r.err && J(lens()) === J([s8, 2]) && J(endP()) === J([4, 2, 0]), [r.err, lens(), endP()]); A.undo();
      r = run('MoveJoint', { InputObjs: ch.effector, X: 5, Y: 1, Z: 0 });
      ok('MoveJoint: the effector moves the chain end', !r.err && J(endP()) === J([5, 1, 0]), [r.err, endP()]); A.undo();
      r = run('MoveJoint', { InputObjs: ch, X: 0, Y: 1, Z: 0, MoveJointBone: true });
      ok('MoveJoint MoveJointBone (inferred): the bone starting at the joint keeps its length', !r.err && lens()[0] === 2 && J(endP()) === J([4, 0, 0]), [r.err, lens(), endP()]); A.undo();
      r = run('MoveJoint', { InputObjs: cube });
      ok('MoveJoint: not a chain element -> 0x80070057', r.code === 0x80070057, r);
    }

    // ================= SICreateSkeleton (correction 10)
    {
      reset(); const a = {}; r = run('SICreateSkeleton', a);
      const o = S().out.SICreateSkeleton;
      ok('SICreateSkeleton: root / bone / effector returned (Value, Bone, Effector), SkeletonType 2 = builder mode 1 with ViewType', !r.err && r.v && o.Value === r.v && o.Bone === r.v.bones[0] && o.Effector === r.v.effector && o.mode === 1 && o.viewType === 3 && near(r.v.bones[0].val('length'), 1), [r.err, o?.mode, o?.viewType]);
      undoRedo('SICreateSkeleton', () => !!r.v.parentObj, false, true);
      r = run('SICreateSkeleton', { SkeletonType: 3, ViewType: 7 });
      ok('SICreateSkeleton: other SkeletonType = mode 2, view type -1, no error', !r.err && S().out.SICreateSkeleton.mode === 2 && S().out.SICreateSkeleton.viewType === -1 && r.v.chainKind === 3, r);
      r = run('SICreateSkeleton', { SkeletonType: 9 });
      ok('SICreateSkeleton: an unlisted SkeletonType is not an error at this level', !r.err && S().out.SICreateSkeleton.mode === 2, r);
    }

    // ================= CreateVertexColorSupport (correction 11)
    reset(); r = run('CreateVertexColorSupport', { InputObjs: [cube] });
    const vc = r.v?.[0];
    ok('CreateVertexColorSupport: a "Vertex_Color" colour-at-vertices property per geometric object, returned as a list', !r.err && r.v?.length === 1 && vc.name === 'Vertex_Color' && vc.type === 'vertexcolor' && cube.allProperties().includes(vc) && S().out.CreateVertexColorSupport.PropertyName === 'Vertex_Color', r);
    undoRedo('CreateVertexColorSupport', () => cube.allProperties().includes(vc), false, true);
    r = run('CreateVertexColorSupport', { PropertyName: 'Vertex_Color', InputObjs: [cube, rn] });
    ok('CreateVertexColorSupport: the name is made unique and written back; non-geometric items skipped', !r.err && r.v?.length === 1 && r.v[0].name === 'Vertex_Color1' && S().out.CreateVertexColorSupport.PropertyName === 'Vertex_Color1', r);
    r = run('CreateVertexColorSupport', { InputObjs: [rn] });
    ok('CreateVertexColorSupport: none created -> 0x80020005', r.code === 0x80020005, r);
    A.select([]); r = run('CreateVertexColorSupport', {});
    ok('CreateVertexColorSupport: empty input = nothing done (status 1)', !r.err && r.v === undefined && r.status === 1, r);
    ok('CreateVertexColorSupport: PresetObj is not read', !run('CreateVertexColorSupport', { PresetObj: 'nonsense', InputObjs: [sph] }).err && (A.undo(), true));

    // ================= PaintVertexColors (correction 12)
    {
      reset(); const before = sph.allProperties().filter(p => p.type === 'vertexcolor').length;
      r = run('PaintVertexColors', { InputObj: sph, Polynodes: [0, 1], Colors: [1, 0, 0, 1, 0, 1, 0, 1] });
      const p = r.v; const pts = sph.primitive.mesh().polygons.flatMap(f => [...f]);
      ok('PaintVertexColors: auto-creates "Vertex_Color" (sub-task) and writes one RGBA per polynode', !r.err && p?.name === 'Vertex_Color' && J(p.nodeColors.get(0)) === J([1, 0, 0, 1]) && J(p.nodeColors.get(1)) === J([0, 1, 0, 1]) && J(p.values.get(pts[0])) === J([1, 0, 0]) && S().calls.some(c => c.cmd === 'CreateVertexColorSupport'), [r.err, S().calls]);
      A.undo(); ok('PaintVertexColors: undo removes the colours and the auto-created property', sph.allProperties().filter(q => q.type === 'vertexcolor').length === before);
      A.redo();
      r = run('PaintVertexColors', { InputObj: p, Polynodes: [0], Colors: [[0, 0, 1, 1]] });
      ok('PaintVertexColors: the property itself as InputObj; previous colours kept for undo', !r.err && J(p.nodeColors.get(0)) === J([0, 0, 1, 1]), r);
      undoRedo('PaintVertexColors (repaint)', () => p.nodeColors.get(0), [1, 0, 0, 1], [0, 0, 1, 1]);
      r = run('PaintVertexColors', { InputObj: sph, Polynodes: [], Colors: [1, 1, 1, 1] });
      ok('PaintVertexColors: empty Polynodes -> 0x80070057', r.code === 0x80070057, r);
      const n2 = cube.allProperties().filter(q => q.type === 'vertexcolor').length;
      r = run('PaintVertexColors', { InputObj: cube, Polynodes: [0], Colors: [1, 1, 1, 1], Mode: 2 });
      ok('PaintVertexColors: Mode other than 0 / 1 paints nothing', !!r.err && cube.allProperties().filter(q => q.type === 'vertexcolor').length === n2, r);
      r = run('PaintVertexColors', { InputObj: sph, Polynodes: [2], Colors: [1, 1, 0, 1], Mode: 1 });
      ok('PaintVertexColors: Mode 1 paints (array layout logged not yet attested)', !r.err && nya(r), r);
    }

    // ================= CopyCluster (correction 13)
    {
      reset(); A.setSelMode('point'); A.selectComponents(cube, 'point', [0, 1, 2]);
      const c = A.run('CreateCluster', { Name: 'CB20b' }); A.setSelMode('object'); A.select([cube]);
      r = run('CopyCluster', { Cluster: c, Target: [sph] });
      const cp = r.v?.[0];
      ok('CopyCluster: a cluster with the same type and indices on each target, returned as a list', !r.err && r.v?.length === 1 && cp.obj === sph && cp.compKind === 'pnt' && J([...cp.elements].sort()) === J([0, 1, 2]) && S().calls.some(x => x.cmd === 'CreateClusterFromSubComponent'), [r.err, cp && [...cp.elements]]);
      undoRedo('CopyCluster', () => sph.clusters.includes(cp), false, true);
      r = run('CopyCluster', { Cluster: c, Target: [rn] });
      ok('CopyCluster: unsupported target geometry -> 0x80004005 with message 0x62', r.code === 0x80004005 && r.log.some(l => /0x62/.test(l)), r);
      const nS = sph.primitive.mesh().positions.length / 3;
      A.setSelMode('point'); A.selectComponents(sph, 'point', [nS - 1]); const c2 = A.run('CreateCluster', { Name: 'CHigh' }); A.setSelMode('object');
      r = run('CopyCluster', { Cluster: c2, Target: [cube] });
      ok('CopyCluster: an index beyond the target components -> 0x80004005 with message 0x61', r.code === 0x80004005 && r.log.some(l => /0x61/.test(l)), r);
      r = run('CopyCluster', { Cluster: c, Target: [sph, cube] });
      ok('CopyCluster: several targets, unique names on the target', !r.err && r.v.length === 2 && r.v[1].obj === cube && r.v[1].name !== c.name, r);
    }

    // ================= SaveKeyOnPath (correction 14)
    {
      reset();
      const crv = A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'pathB20b' });
      const n1 = A.run('GetPrim', { PresetObj: 'Null', Name: 'pnB20b1' }), n2 = A.run('GetPrim', { PresetObj: 'Null', Name: 'pnB20b2' });
      A.run('ApplyCns', { Preset: 'Curve (Path)', InputObjs: n1.name, Target: crv.name });
      A.run('ApplyCns', { Preset: 'Curve (Path)', InputObjs: n2.name, Target: crv.name });
      const perc = (o) => o.properties.find(p => p.type === 'poscns').get('perc');
      const fc = (o) => A.anim.fcurves.get(perc(o));
      const keyAt = (o, t) => fc(o)?.keys.find(k => k.time === t);
      perc(n1).value = 10; perc(n2).value = 30;
      r = run('SaveKeyOnPath', { InputObj: [n1, n2], Time: 12 });
      ok('SaveKeyOnPath: every input object gets a path key at Time (frames), not locked', !r.err && r.v === 2 && keyAt(n1, 12)?.value === 10 && keyAt(n2, 12)?.value === 30 && !keyAt(n1, 12).locked, [r.err, keyAt(n1, 12), keyAt(n2, 12)]);
      undoRedo('SaveKeyOnPath', () => [!!keyAt(n1, 12), !!keyAt(n2, 12)], [false, false], [true, true]);
      r = run('Save Locked Key on Path', { InputObj: n1, Time: 15 });
      ok('Save Locked Key on Path: same task, Locked defaults to true', !r.err && keyAt(n1, 15)?.locked === true, keyAt(n1, 15));
      // a global position: the key gets the path percentage of that position
      perc(n1).value = 25;
      const M = n1.globalMatrix().elements; const at = [M[12], M[13], M[14]];
      perc(n1).value = 0;
      r = run('SaveKeyOnPath', { InputObj: n1, Time: 20, X: at[0], Y: at[1], Z: at[2] });
      ok('SaveKeyOnPath X/Y/Z: the key is the path percentage of the given global position (tolerance 0.05 %)', !r.err && Math.abs((keyAt(n1, 20)?.value ?? -99) - 25) < 0.05 && S().out.SaveKeyOnPath.flags === 7, [r.err, keyAt(n1, 20)]);
      r = run('SaveKeyOnPath', { InputObj: n1 });
      ok('SaveKeyOnPath: Time is required -> 0x80020008', r.code === 0x80020008, r);
      r = run('SaveKeyOnPath', { InputObj: cube, Time: 3 });
      ok('SaveKeyOnPath: an object without a path constraint gets no key task', !r.err && r.v === 0, r);
    }
  } catch (e) { ok('no exception in the checks', false, String(e?.stack ?? e)); }
  return out;
}, { NAMES, DEFAULT_FAILS });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_groups_b20b: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
