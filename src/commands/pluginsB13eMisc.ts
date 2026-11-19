// Ledger row CMD-B13e, part 5: Ultimapper, ShapeWeight (Face Robot), BoneCreateTool, polymatricks, FR ICE import.
//   FindUltimapperDistance GenerateUltimapper fr_AddSamplerDataCache fr_ApplyShapeWeightOp BoneCreateTool_UpdateBone
//   Applypolymatricks FR_Import_Animation_Rig_To_ICE
// Brief: docs/ghidra/cmd-b13e-small-plugins-binary.md, section 3, and docs/re/WIRE_CORRECTIONS_B13.md. Original code
// from that prose only.
import * as THREE from 'three';
import { App } from '../core/commands';
import { Model, Null, MixerClip } from '../core/scene';
import { num, int, bool } from '../core/params';
import { ICETreeOperator } from '../core/ice';
import {
  stateOf, fail, logNya, put, progress, numArg, intArg, boolArg, arrayArg, unset, listOf, resolve, objArg, addProperty,
  E_INVALIDARG, E_FAIL, X3DObject, Node, Property, Operator,
} from './pluginsB13eShared';

// ------------------------------------------------------------------ Ultimapper
/** PSet as a custom property; when that fails, as a name resolved through GetValue. */
function ultimapperPSet(app: App, v: any): Property | null {
  if (v instanceof Property) return v;
  const n = unset(v) ? null : resolve(app, String(v));
  return n instanceof Property ? n : null;
}
/** Runs `fn` with preferences.Interaction.autoinspect saved, cleared, then restored. */
function withoutAutoInspect<T>(app: App, fn: () => T): T {
  const saved = app.autoInspect; app.autoInspect = false;
  try { return fn(); } finally { app.autoInspect = saved; }
}
function findUltimapperDistance(app: App, a: Record<string, any>) {
  const C = 'FindUltimapperDistance';
  return withoutAutoInspect(app, () => {
    const prop = ultimapperPSet(app, a.PSet);
    const low = prop?.parent instanceof X3DObject ? prop.parent : null;
    const hiName = prop?.val('Group'); const high = typeof hiName === 'string' && hiName ? app.scene.find(hiName) ?? null : null;
    if (!prop || !low || !high) { app.logMsg('error', 'The high resolution source is invalid'); put(app, C, 0.0); return undefined; }
    // Temporary RenderMap settings (helpers unread): kept for inspection.
    const renderMap = { surf_enabled: false, pos_enabled: false, vbasis_enabled: false, attribute: 3, ignoreobjs: true, dpth_enabled: true,
      dpthimagefile: '%TEMP%\\depthmap.ct', camdist: 0.0, dpthimagebitdepth: 21 };
    (stateOf(app) as any).ultimapperRenderMap = renderMap;
    const pixels = stateOf(app).hooks.depthMap?.(low, high, prop);
    if (!pixels) { logNya(app, C, 'the temporary RenderMap / RegenerateMaps depth render (no renderer); Distance and DepthRange unchanged'); return undefined; }
    let D = -Infinity, R = -Infinity;
    for (let i = 0; i < pixels.length; i++) { const p = Number(pixels[i]); D = Math.max(D, Math.max(p, 0.0001)); R = Math.max(R, Math.min(Math.abs(p), 100000)); }
    if (!pixels.length) { D = 0; R = 0; logNya(app, C, 'an empty depth map'); }
    const setP = (name: string, v: number) => { const p = prop.get(name); if (p) app.setParam(p, v); else logNya(app, C, `the ${name} parameter of the Ultimapper property (Ultimapper_Define unread)`); };
    setP('Distance', D * 1.01); setP('DepthRange', R * 1.01);
    put(app, C, D);   // the unscaled distance is put, but Init does not enable a return value
    return undefined;
  });
}
function generateUltimapper(app: App, a: Record<string, any>) {
  const C = 'GenerateUltimapper';
  return withoutAutoInspect(app, () => {
    const prop = ultimapperPSet(app, a.PSet);
    logNya(app, C, `the map generator (0x180006970)${prop ? ` for ${prop.fullName}` : ''}; no maps written`);
    return undefined;
  });
}

// ------------------------------------------------------------------ ShapeWeight (Face Robot)
/** Get or create the `SamplerData` blob and store the sampler's pose in ControlParent's space. */
function samplerDataBlob(app: App, C: string, a: Record<string, any>): Property {
  const sampler = objArg(app, a.Sampler), control = objArg(app, a.Control), parent = objArg(app, a.ControlParent);
  // inferred: missing objects fail with E_INVALIDARG (the note does not describe the failure path)
  if (!sampler || !control || !parent) throw fail(E_INVALIDARG, `${C}: Sampler, Control and ControlParent must be objects`);
  const M = parent.globalMatrix().invert().multiply(sampler.globalMatrix());
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); M.decompose(p, q, s);
  const L = sampler.kinematics.local;
  if (Number(L.val('sclx')) <= 0.0012) s.x = 0;
  if (Number(L.val('scly')) <= 0.0012) s.y = 0;
  if (Number(L.val('sclz')) <= 0.0012) s.z = 0;
  const m = new THREE.Matrix4().compose(p, q, s);
  // inferred owner: Control
  let blob = control.properties.find(x => x.name === 'SamplerData');
  if (!blob) blob = addProperty(app, control, new Property('SamplerData', 'UserDataBlob', []));
  const b: any = blob; const old = { matrix: b.matrix, flag: b.flag, buffer: b.buffer };
  const next = { matrix: Array.from(m.elements), flag: 1, buffer: new Uint8Array(192) };
  app.record('SetValue', () => Object.assign(b, next), () => Object.assign(b, old));
  logNya(app, C, 'the byte layout of the 192-byte SamplerData blob value (matrix and flag kept as fields)');
  return blob;
}
function addSamplerDataCache(app: App, a: Record<string, any>) { return samplerDataBlob(app, 'fr_AddSamplerDataCache', a); }

/** Mixer clips by name in every mixer of the scene. */
function mixerClips(app: App): MixerClip[] {
  const out: MixerClip[] = [];
  for (const o of [app.scene.root, ...app.scene.allObjects()]) { const m: any = o.properties.find(p => p.type === 'mixer'); if (m?.clips) out.push(...m.clips); }
  return out;
}
function clipArg(app: App, v: any): (Node | MixerClip)[] {
  const clips = mixerClips(app);
  return listOf(v).map(x => (typeof x === 'object' ? x : resolve(app, x) ?? clips.find(c => c.name === String(x) || String(x).endsWith('.' + c.name)) ?? null)).filter(Boolean);
}
function applyShapeWeightOp(app: App, a: Record<string, any>) {
  const C = 'fr_ApplyShapeWeightOp';
  // Method is never read (WIRE_CORRECTIONS_B13); the return value is enabled but never set.
  const blob = samplerDataBlob(app, C, a);
  const control = objArg(app, a.Control)!, parent = objArg(app, a.ControlParent)!;
  const st = stateOf(app);
  clipArg(app, a.Clip).forEach((clip, i) => {
    const op = new Operator('fro_ShapeWeightOp', 'fro_ShapeWeightOp', [
      num('n0', numArg(a.n0, 0), 'n0', { min: 0, max: 3 }), num('n1', numArg(a.n1, 0), 'n1', { min: 0, max: 3 }), num('n2', numArg(a.n2, 0), 'n2', { min: 0, max: 3 }),
      int('i', i, 'i', { min: 0, max: 256 }), bool('NoNeutralPose', boolArg(a.NoNeutraPose, false), 'NoNeutralPose'),
    ]);
    (op as any).ports = {
      output: { name: `weight${i}`, target: clip, parameter: 'weight' },   // inferred port name ("weight" and i)
      inputs: { InCntrlLocal: control.kinematics.local, InParentCntrlLocal: parent.kinematics.local, InSamplerMatrixBlob: blob },
    };
    app.record('ApplyOp', () => { st.operators.push(op); }, () => { const k = st.operators.indexOf(op); if (k >= 0) st.operators.splice(k, 1); });
  });
  if (st.operators.some(o => o.type === 'fro_ShapeWeightOp')) logNya(app, C, 'the fro_ShapeWeightOp update (outside this row); operators are connected, not evaluated');
  return undefined;
}

// ------------------------------------------------------------------ BoneCreateTool_UpdateBone
function vec3(v: any): [number, number, number] {
  if (Array.isArray(v) || ArrayBuffer.isView(v)) { const x = Array.from(v as any, Number); return [x[0] || 0, x[1] || 0, x[2] || 0]; }
  if (v && typeof v === 'object') return [Number(v.x ?? v.X) || 0, Number(v.y ?? v.Y) || 0, Number(v.z ?? v.Z) || 0];
  if (typeof v === 'string') { const x = v.split(/[\s,;]+/).map(Number).filter(Number.isFinite); if (x.length >= 3) return [x[0], x[1], x[2]]; }
  return [0, 0, 0];
}
function updateBone(app: App, a: Record<string, any>) {
  const st = stateOf(app);
  if (!st.boneTool) return undefined;   // records only while a BoneCreateTool instance is live
  const rec = { old: String(a.OldBone ?? ''), neu: String(a.NewBone ?? ''), oldRoot: String(a.OldRootBone ?? ''), newRoot: String(a.NewRootBone ?? ''), pos: vec3(a.RootPos) };
  const apply = (bone: string, root: string) => {
    const t = st.boneTool; if (!t) return;
    t.currentBone = objArg(app, bone);   // cleared when the name does not resolve
    t.rootBone = objArg(app, root);
    t.rootPos = [...rec.pos];            // the same vector for both directions
  };
  // Execute changes nothing; the record is the UndoRedoData (Undo -> Old*, Redo -> New*).
  let first = true;
  app.record('BoneCreateTool_UpdateBone', () => { if (first) { first = false; return; } apply(rec.neu, rec.newRoot); }, () => apply(rec.old, rec.oldRoot));
  return undefined;   // Init does not enable a return value
}

// ------------------------------------------------------------------ Applypolymatricks
function applyPolymatricks(app: App, a: Record<string, any>) {
  const C = 'Applypolymatricks';
  const st = stateOf(app);
  st.polymatricksStack = arrayArg(a.stack).filter(x => x !== null && x !== undefined).map(x => String(x));
  const op = new Operator('polymatricks', 'polymatricks', []);
  (op as any).stack = [...st.polymatricksStack];
  if (st.polymatricksStack.length) logNya(app, C, 'polymatricks_Define (operator parameters built from the stack list)');
  const target = objArg(app, a.target);
  const prim = target?.primitive;
  if (prim) {
    (op as any).ports = { input: target, output: target };
    app.record('ApplyOp', () => { prim.addOperator(op); st.operators.push(op); }, () => { prim.removeOperator(op); const k = st.operators.indexOf(op); if (k >= 0) st.operators.splice(k, 1); });
  }
  // An invalid target is not reported (inferred: Connect fails silently).
  put(app, C, op);
  st.polymatricksStack = [];
  return undefined;   // Init does not enable a return value
}

// ------------------------------------------------------------------ FR_Import_Animation_Rig_To_ICE
const SHAPE_ATTRS = ['Self.ShapeScaling', 'Self.ShapeRotation', 'Self.ShapePosition', 'Self.ShapeDivisions', 'Self.Shape_I_Value', 'Self.ShapeController'];
function importRigToIce(app: App, a: Record<string, any>) {
  const C = 'FR_Import_Animation_Rig_To_ICE';
  put(app, C, true);   // ReturnValue = true is put before any check
  const model = unset(a.ModelName) ? null : resolve(app, String(a.ModelName));
  if (!(model instanceof Model)) throw fail(E_FAIL, `${C}: ModelName is not a model`);
  const tongue = boolArg(a.IsTongue, false);
  const prop = model.properties.find(p => p.name === (tongue ? 'Tongue' : 'Mesh'));
  const geo = prop?.val('Geometry');
  if (!prop || unset(geo)) throw fail(E_FAIL, `${C}: no ${tongue ? 'Tongue' : 'Mesh'} property with a Geometry parameter`);
  // inferred: the model name and the Geometry value are joined as written, then with a '.' separator
  const names = [`${model.name}${geo}`, `${model.name}.${geo}`];
  const mesh = [...model.descendants()].find(o => names.includes(`${model.name}.${o.name}`)) ?? app.scene.find(names[0]) ?? app.scene.find(names[1]) ?? null;
  if (!mesh || !mesh.primitive) throw fail(E_FAIL, `${C}: target mesh ${model.name}.${geo} not found`);
  const samplers = [...model.descendants()].filter(o => o instanceof Null && o.fullName.includes('Tongue') === tongue
    && o.properties.some(p => p.name.toLowerCase() === 'samplercache'));
  const clips = (model.properties.find(p => p.type === 'mixer') as any)?.clips as MixerClip[] | undefined ?? [];
  for (const s of samplers) {
    const prefix = s.name.split('_')[0];
    for (const c of clips.filter(c => c.name === prefix)) { const old = c.weight, w = (c.weight ?? 1) + 0.0; app.record('SetValue', () => { c.weight = w; }, () => { c.weight = old; }); }
  }
  if (samplers.length) logNya(app, C, 'the shape action source of the matching clips (cluster property and indices)');
  progress(app, 'Converting Shape Setup to ICE Trees (this may take a few minutes)...');
  app.run('FreezeObj', { InputObjs: [mesh] });
  const prim = mesh.primitive!;
  const trees = ['FR Create ICE Data', 'FR ICE Blend Shapes'].map(n => {
    const t = new ICETreeOperator(n, () => mesh); t.region = 'modeling';
    app.record('ApplyICEOp', () => prim.addOperator(t), () => prim.removeOperator(t));
    return t;
  });
  (trees[1] as any).compounds = ['FR Blend Shapes', 'FR Determine Shapes Per Point'];
  (trees[0] as any).attributes = SHAPE_ATTRS.slice();
  (trees[0] as any).samplers = samplers.map(s => ({ name: s.name, values: Object.fromEntries(['sclx', 'scly', 'sclz', 'rotx', 'roty', 'rotz', 'posx', 'posy', 'posz', 'denx', 'deny', 'denz'].map(k => [k, s.properties.find(p => p.name.toLowerCase() === 'samplercache')?.val(k) ?? s.kinematics.local.val(k) ?? null])) }));
  logNya(app, C, 'the ICE port wiring and per-port values (GetDataNode Reference / Set Data / BuildArray / ScalarTo3DVector)');
  if (boolArg(a.FreezeICEData, false)) app.run('FreezeObj', { InputObjs: [mesh] });
  return true;
}

export function registerPluginsB13eMiscCommands(app: App) {
  app.register({ name: 'FindUltimapperDistance', label: 'FindUltimapperDistance', category: 'Rendering', description: 'Ultimapper: finds the cage distance from a depth map.', args: [{ name: 'PSet', default: null }], execute: findUltimapperDistance });
  app.register({ name: 'GenerateUltimapper', label: 'GenerateUltimapper', category: 'Rendering', description: 'Ultimapper: generates the maps.', args: [{ name: 'PSet', default: null }], execute: generateUltimapper });
  app.register({
    name: 'fr_AddSamplerDataCache', label: 'fr_AddSamplerDataCache', category: 'Face Robot', description: 'Stores the sampler pose in the SamplerData blob.',
    args: [{ name: 'Sampler', default: null }, { name: 'Control', default: null }, { name: 'ControlParent', default: null }], execute: addSamplerDataCache,
  });
  app.register({
    name: 'fr_ApplyShapeWeightOp', label: 'fr_ApplyShapeWeightOp', category: 'Face Robot', description: 'Applies fro_ShapeWeightOp operators on clip weights.',
    args: [{ name: 'Clip', default: null }, { name: 'Sampler', default: null }, { name: 'n0', default: null }, { name: 'n1', default: null }, { name: 'n2', default: null },
      { name: 'Control', default: null }, { name: 'ControlParent', default: null }, { name: 'NoNeutraPose', default: false }, { name: 'Method', default: 3 }],
    execute: applyShapeWeightOp,
  });
  app.register({
    name: 'BoneCreateTool_UpdateBone', label: 'BoneCreateTool_UpdateBone', category: 'Animation', description: 'BoneCreateTool undo record.',
    args: [{ name: 'OldBone', default: '' }, { name: 'NewBone', default: '' }, { name: 'OldRootBone', default: '' }, { name: 'NewRootBone', default: '' },
      { name: 'RootPos', default: [0, 0, 0] }],   // the catalogue default is a Python ISIVector3 repr; vector (0,0,0)
    execute: updateBone,
  });
  app.register({
    name: 'Applypolymatricks', label: 'Applypolymatricks', category: 'Modeling', description: 'Create an instance of polymatricks operator',
    args: [{ name: 'target', default: '' }, { name: 'stack', default: [] }], execute: applyPolymatricks,
  });
  app.register({
    name: 'FR_Import_Animation_Rig_To_ICE', label: 'FR_Import_Animation_Rig_To_ICE', category: 'Face Robot', description: 'Converts a Face Robot shape setup to ICE trees.',
    args: [{ name: 'ModelName', default: null }, { name: 'FreezeICEData', default: null }, { name: 'IsTongue', default: null }], execute: importRigToIce,
  });
}

