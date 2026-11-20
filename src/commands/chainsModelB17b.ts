// Ledger row CMD-B17b: the chain / skeleton script commands of chains.vbs and the model / referenced-model script
// commands of Model.vbs. Brief: docs/ghidra/cmd-b17b-chains-model-scripts.md §2 and §3 "Wire contract", and the cmd-b17b
// section of docs/re/WIRE_CORRECTIONS_B17.md. Original code written from the prose contract.
//
// It REPLACES the older inferred bodies of these names (src/commands/model.ts chains, src/commands/model2.ts model
// commands). DeleteModelFromObj / DuplicateModelFromObj are rewritten in place in src/commands/viewEditProperty.ts and
// use the material localisation exported here.
//
// Stand-ins of this build (no Softimage object model behind them):
//  * A bone / effector's `joint` property (rotlim_active, rotMin/Max X/Y/Z, pseudoroot_active, chntype) is created on
//    first use; the preferred rotation is read from `joint.prefrot*` when present, else from the bone's own prefrot*.
//  * The camera visibility parameters `Views.View<v>.<cam>Camera.camvis.<attr>` have no node here: they are kept in
//    `app.chainsModelB17b.camvis` (key = the full parameter path), undoable.
//  * Modal inspection and the Yes/No question answer through `app.chainsModelB17b.hooks` when set (checks); otherwise
//    interactive: the property dialog / window.confirm; batch: Cancel / OK as the contract states.
//  * `XSIFileService.UpdateReferencedModel` and `Model.CommitToReference` go through this build's model file layer
//    (`app.modelFiles`, src/commands/model2.ts).
import { App } from '../core/commands';
import { Node, X3DObject, Model, Property, Material, Shader, Cluster } from '../core/scene';
import { hostFs } from '../core/sdkHelpersHostFs';
import { ChainRoot, Bone, Effector, makeChain } from '../core/scene2';
import { num, int, bool, str } from '../core/params';
import type { V3 } from '../core/curves';
import { siString } from '../ui/si';
import { resolvePath, cloneShaderTree, currentMaterial, materialOwners, isImageClip } from '../core/textureLayers';
import { startPickSession, interactive } from './miscDsScriptsPick';
import { inspectModal } from './miscScriptsB15fShared';
import { modelFiles } from './model2';

const ROW = 'CMD-B17b';
type A = Record<string, any>;

export interface ChainsModelB17bState {
  note: string;
  /** Views.View<v>.<cam>Camera.camvis.<attr> -> value (see header). */
  camvis: Map<string, boolean>;
  hooks: {
    /** Modal inspection: true = OK. */
    inspect?: (prop: Property, title: string) => boolean;
    /** Yes/No question: true = Yes. */
    yesNo?: (text: string, title: string) => boolean;
  };
  /** Message boxes shown (MsgBox / question box texts). */
  boxes: string[];
  /** Collections given to InspectObj by InspectChainProperties. */
  inspected: Node[][];
  /** The other registry entries of SetResolutionOfRefModels: name -> resolution. */
  variants: Record<string, number>;
  /** Contract calls made through this build's file layer (XSIFileService / Model.CommitToReference). */
  calls: { what: string; args: any[] }[];
}
export const b17b = (app: App): ChainsModelB17bState => (app as any).chainsModelB17b ??= {
  note: 'docs/ghidra/cmd-b17b-chains-model-scripts.md', camvis: new Map(), hooks: {}, boxes: [], inspected: [],
  variants: { 'Set Resolution Of All RefModels': 0, SetResolutionOfRefModels_OffLoaded: 0, SetResolutionOfRefModels_Low: 1, SetResolutionOfRefModels_Medium: 2, SetResolutionOfRefModels_High: 3 },
  calls: [],
};

const logNya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`);
const unset = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const truthy = (v: any, dflt = false) => (v === undefined || v === null || v === '' ? dflt : v === true || v === 1 || /^(true|1|-1)$/i.test(String(v)));
const xsiScripts = (id: number, fallback: string) => siString('XSISCRIPTS', id) ?? fallback;

function nodeOf(app: App, x: any): Node | null {
  if (x instanceof Node) return x;
  if (typeof x !== 'string') return null;
  const s = x.trim(); if (!s) return null;
  const o = app.scene.find(s); if (o) return o;
  try { const r = resolvePath(app.scene, s, false); if (r && !r.param) return r.node; } catch { /* not a path */ }
  return null;
}
/** A Collection argument: left empty it is the selection (siArgHandlerCollection). */
function collection(app: App, v: any): Node[] {
  if (unset(v)) return [...app.selection];
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [v];
  const out: Node[] = [];
  for (const x of list) { const n = nodeOf(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}
const isChainElement = (n: any): n is X3DObject => n instanceof ChainRoot || n instanceof Bone || n instanceof Effector;
const params = (o: X3DObject) => o.kinematics.local;
/** A parameter of a node, added (bool / number by the value's type) when missing. */
function ensureParam(n: Node, name: string, value: any) {
  if (!n.get(name)) n.add(typeof value === 'boolean' ? bool(name, value, name) : num(name, Number(value) || 0, name));
  return n.get(name)!;
}

// ------------------------------------------------------------------ joint property (stand-in, see header)
function jointOf(app: App, o: X3DObject): Property {
  let j = o.properties.find(p => p.type === 'joint');
  if (j) return j;
  // inferred: parameter defaults (limits off, limits 0, not a pseudo-root, chain type 0)
  j = new Property('joint', 'joint', [
    bool('rotlim_active', false, 'Rotation Limits Active'),
    num('rotMinX', 0, 'Min Rot X'), num('rotMinY', 0, 'Min Rot Y'), num('rotMinZ', 0, 'Min Rot Z'),
    num('rotMaxX', 0, 'Max Rot X'), num('rotMaxY', 0, 'Max Rot Y'), num('rotMaxZ', 0, 'Max Rot Z'),
    bool('pseudoroot_active', false, 'Pseudo Root'), int('chntype', 0, 'Chain Type'),
  ]);
  const jj = j;
  app.record('Add joint', () => o.addProperty(jj), () => o.removeProperty(jj));
  return j;
}
const prefRot = (b: X3DObject, ax: string): number => {
  const j = b.properties.find(p => p.type === 'joint');
  const p = j?.get('prefrot' + ax) ?? b.get('prefrot' + ax);
  return Number(p?.value ?? 0) || 0;
};

// ------------------------------------------------------------------ skeleton helpers
function skeletonOf(app: App, o: X3DObject): X3DObject[] {
  try { const r = app.run('GetSkeleton', { InputObj: o }); const l = r?.ChainElements; return Array.isArray(l) ? l : []; } catch { return []; }
}
const vec = (x: any, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);

/** CreateSkeletonProc (Create2DSkeleton / Create3DSkeleton). */
function createSkeleton(app: App, cmd: 'Create2DSkeleton' | 'Create3DSkeleton', a: A): ChainRoot | undefined {
  // this build's chain drawing tool hands the clicked joints over as Points (not a registry argument)
  if (Array.isArray(a.Points) && a.Points.length >= 2) {
    const root = makeChain(app.scene.uniqueName('root'), a.Points as V3[], cmd === 'Create2DSkeleton');
    app.record('Add ' + root.name, () => app.scene.root.addChild(root), () => app.scene.root.removeChild(root));
    app.select([root.effector!]);
    return root;
  }
  app.run('DeselectAll');
  const type = Math.trunc(vec(a.SkeletonType, cmd === 'Create2DSkeleton' ? 2 : 3));
  if (type !== 2 && type !== 3) { app.logMsg('error', 'CreateSkeleton: invalid skeleton type'); return undefined; }
  let align = false;
  try { align = truthy(app.run('GetUserPref', { Target: 'SI3D_ALIGN_ROOT_1ST_BONE' })); } catch { /* preference not available: False */ }
  // the registry of Create3DSkeleton has no ViewType entry: its view type is the contract default 0
  const viewType = cmd === 'Create2DSkeleton' ? vec(a.ViewType, 3) : 0;
  const s: A = { Rx: a.Rx, Ry: a.Ry, Rz: a.Rz, Ex: a.Ex, Ey: a.Ey, Ez: a.Ez, Nx: a.Nx, Ny: a.Ny, Nz: a.Nz, ViewType: viewType, SkeletonType: type, AlignRootToFirstBone: align };
  let root: any;
  try { root = app.run('SICreateSkeleton', s); } catch { root = null; }
  if (!(root instanceof ChainRoot)) { app.logMsg('error', `Create${type}DSkeleton: error while creating skeleton`); return undefined; }
  // the Bone / Effector output arguments (the bus hands the callee a copy of the argument record: read them off the root)
  const bone = root.bones[0] ?? null, eff = root.effector;
  a.Bone = bone; a.Effector = eff; a.Value = root;
  app.run('SelectObj', { InputObjs: [root], Mode: 'replace' });
  for (const x of [bone, eff]) if (x) app.run('AddToSelection', { SelectionList: [x], HierarchyLevel: 'NODE', CheckObjectSelectability: true });
  return root;
}

/** SICreateSkeleton stand-in: root at R, one bone to E, effector at E; N is the chain plane normal. */
export function siCreateSkeleton(app: App, a: A): ChainRoot | undefined {
  const R: V3 = [vec(a.Rx), vec(a.Ry), vec(a.Rz)], E: V3 = [vec(a.Ex, 1), vec(a.Ey), vec(a.Ez)];
  if (Math.hypot(E[0] - R[0], E[1] - R[1], E[2] - R[2]) < 1e-9) { app.logMsg('error', 'SICreateSkeleton: the root and the effector are at the same position'); return undefined; }   // inferred
  const type = Math.trunc(vec(a.SkeletonType, 2));
  const root = makeChain(app.scene.uniqueName('root'), [R, E], type === 2);
  (root as any).chainKind = type === 2 ? 2 : 3;   // read by SIAppendBone (2D vs 3D chain)
  (root as any).chainNormal = [vec(a.Nx), vec(a.Ny), vec(a.Nz, 1)];
  logNya(app, 'SICreateSkeleton', 'the use of the chain normal (Nx, Ny, Nz) and ViewType in the bone orientation; the bone points from R to E');
  if (truthy(a.AlignRootToFirstBone)) {
    const b = root.bones[0];
    for (const ax of ['x', 'y', 'z']) { params(root).set('rot' + ax, params(b).val('rot' + ax)); params(b).set('rot' + ax, 0); }
  }
  app.record('Add ' + root.name, () => app.scene.root.addChild(root), () => app.scene.root.removeChild(root));
  a.Bone = root.bones[0]; a.Effector = root.effector; a.Value = root;
  return root;
}

// ------------------------------------------------------------------ CreateChainfromCurve
function curveObj(n: any): X3DObject | null { return n instanceof X3DObject && !!n.primitive?.curve?.() ? n : null; }

function plainChainFromCurve(app: App, curve: X3DObject, nb: number): ChainRoot | undefined {
  const N = nb === 0 ? 2 : nb;
  const at = (f: number): V3 => { const r = app.run('EvaluateCurveAt', { InputObj: curve, Value: f, Local: true }) ?? {}; return [vec(r.PosX), vec(r.PosY), vec(r.PosZ)]; };
  const p0 = at(0), p1 = at(1 / N);
  // the first-bone direction against +Y: the test is written "dot - 1 < 0.00001", always true, so the normal is (1,0,0)
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; const len = Math.hypot(d[0], d[1], d[2]) || 1;
  const dot = d[1] / len;
  const normal: V3 = dot - 1 < 0.00001 ? [1, 0, 0] : [0, 1, 0];
  const root = app.run('Create3DSkeleton', { Rx: p0[0], Ry: p0[1], Rz: p0[2], Ex: p1[0], Ey: p1[1], Ez: p1[2], Nx: normal[0], Ny: normal[1], Nz: normal[2] }) as ChainRoot | undefined;
  if (!root) return undefined;
  for (let i = 2; i <= N; i++) { const p = at(i / N); app.run('AppendBone', { InputObjs: '', Ex: p[0], Ey: p[1], Ez: p[2], Pin: false }); }
  return root;
}

function splineIkChainFromCurve(app: App, curve: X3DObject, nb: number): ChainRoot | undefined {
  const C = 'CreateChainfromCurve';
  const N = nb === 0 ? 2 : nb;   // inferred: the plain chain's 0 -> 2 rule also guards the step division here
  const L = vec(app.run('GetCurveLength', { InputObj: curve })?.Length);
  const step = L / N;
  // the straight support curve along +Y, degree 1, under the curve's parent, named <curve>_crv
  const support = app.run('SICreateCurve', { Name: `${curve.name}_crv`, Degree: 1, CurveType: 0 }) as X3DObject | undefined;
  if (!(support instanceof X3DObject)) { app.logMsg('error', `${C}: the support curve could not be created`); return undefined; }
  const pts = Array.from({ length: N + 1 }, (_, i) => `(0,${i * step},0)`).join(',');
  app.run('SISetCurvePoints', { InputObj: support, Points: pts, Local: true });
  logNya(app, C, 'the non-uniform parameterisation and the point weights (w 1) of the support curve');
  const parent = curve.parentObj ?? app.scene.root;
  if (support.parentObj !== parent) { const old = support.parentObj ?? app.scene.root; app.record('Parent', () => parent.addChild(support), () => old.addChild(support)); }
  let op: any = null;
  try { op = app.run('ApplyOp', { PresetObj: 'CrvDeform', ConnectionSet: `${support.fullName};${curve.fullName}` }); } catch { op = null; }
  if (op instanceof Node) ensureParam(op, 'cns2deformer', true) && op.set('cns2deformer', true);
  else logNya(app, C, `ApplyOperator "CrvDeform", "${support.name};${curve.name}" (deforming a curve by a curve is not modelled); cns2deformer not set`);
  const root = app.run('Create3DSkeleton', { Rx: 0, Ry: 0, Rz: 0, Ex: 0, Ey: step, Ez: 0, Nx: 1, Ny: 0, Nz: 0 }) as ChainRoot | undefined;
  if (!root) return undefined;
  for (let i = 2; i <= N; i++) app.run('AppendBone', { InputObjs: '', Ex: 0, Ey: i * step, Ez: 0, Pin: false });
  const elems = skeletonOf(app, root.effector ?? root);
  elems.forEach((el, i) => {
    let cns: any = null;
    try { cns = app.run('SIApplyCns', { PresetObj: 'Path', ConstrainedObj: [el], ConstrainingObj: [support] }); } catch { cns = null; }
    const c = Array.isArray(cns) ? cns[0] : cns;
    if (c instanceof Node) { const p = ensureParam(c, 'perc', 0); app.setParam(p, L > 0 ? (i * step * 100) / L : 0); }
  });
  return root;
}

function chainFromCurves(app: App, input: any, nbJoints: any, useCns: any): ChainRoot[] {
  const nb = Math.trunc(vec(nbJoints, 5)); const cns = truthy(useCns);
  const roots: ChainRoot[] = [];
  for (const n of collection(app, input)) {
    const c = curveObj(n); if (!c) continue;
    const r = cns ? splineIkChainFromCurve(app, c, nb) : plainChainFromCurve(app, c, nb);
    if (r) roots.push(r);
  }
  return roots;
}

/** GetInputAndCreateChainFromCurveProc: the wizard property, modal inspection, then the scripted procedure. */
function createChainFromCurveUi(app: App, a: A): ChainRoot[] | Promise<ChainRoot[]> | undefined {
  const st = b17b(app);
  const curves = collection(app, a.InputObjs).filter(curveObj);
  if (!curves.length) { app.logMsg('info', 'WARNING : Please select at least one Curve...'); return undefined; }   // severity 4 (warning)
  const title = xsiScripts(1045, 'Chain from Curve Wizard');
  const nb0 = unset(a.NbJoints) ? 5 : Math.trunc(vec(a.NbJoints, 5));   // inferred: an omitted argument takes the scripted defaults 5 / False
  // a Custom_parameter_list (custom parameter set) property on the scene root, named by XSISCRIPTS 1045
  const prop = new Property(title, 'customparamset', [
    { ...int('nbJoints', nb0, 'Bones', { min: 1, max: 1000 }), uiMin: 1, uiMax: 20, description: 'Number of Bones' } as any,
    { ...bool('useCns', truthy(a.UseCns), 'Constrain'), description: 'Constrain Chain to Curve' } as any,
  ]);
  const root = app.scene.root;
  app.record('AddProp', () => root.addProperty(prop), () => root.removeProperty(prop));
  const done = (ok: boolean): ChainRoot[] => {
    let out: ChainRoot[] = [];
    try { if (ok) out = chainFromCurves(app, curves, prop.val('nbJoints'), prop.val('useCns')); }
    finally { app.run('DeleteObj', { InputObj: [prop] }); if (root.properties.includes(prop)) root.removeProperty(prop); }
    a.Value = out; return out;
  };
  if (st.hooks.inspect) return done(!!st.hooks.inspect(prop, title));
  const r = inspectModal(app, 'CreateChainfromCurve', prop, title, [{ param: 'nbJoints' }, { param: 'useCns' }], true);
  if (typeof r === 'boolean') return done(r);
  return r.then(ok => done(ok));
}

// ------------------------------------------------------------------ AddBoneToEnd
function addBoneToEnd(app: App, a: A) {
  const C = 'AddBoneToEnd';
  const elems = collection(app, a.InputObjs).filter(isChainElement);
  if (!elems.length) { app.logMsg('info', 'Please select a chain element first'); return undefined; }
  const skel = skeletonOf(app, elems[0]); const eff = skel[skel.length - 1];
  if (!(eff instanceof Effector)) { app.logMsg('info', 'Please select a chain element first'); return undefined; }
  const append = (x: number, y: number, z: number) => app.run('AppendBone', { InputObjs: [eff], Ex: x, Ey: y, Ez: z });
  const hooked = !!(app as any).tasksB11a?.hooks?.pickPosition;
  if (hooked || !interactive(app)) {
    // a pick loop: each pick is its own AppendBone command; button 0 ends
    for (let guard = 0; guard < 10000; guard++) {
      const r = app.run('PickPosition', { LeftMessage: 'Append Bone', MiddleMessage: '' }) ?? {};
      if (!vec(r.ButtonPressed)) break;
      append(vec(r.PosX), vec(r.PosY), vec(r.PosZ));
    }
    return undefined;
  }
  startPickSession(app, { command: C, kind: 'position', prompt: 'Append Bone', fromClick: p => p,
    onPick: (v) => { const p = Array.isArray(v) ? v : [0, 0, 0]; append(vec(p[0]), vec(p[1]), vec(p[2])); return true; } });
  return undefined;
}

// ------------------------------------------------------------------ joint limits / preferred rotation / pseudo-root
const VIEWS = ['A', 'B', 'C', 'D'], CAMS = ['User', 'Top', 'Front', 'Right'], GUIDES = ['attrselchnjntareaguide', 'attrunselchnjntareaguide'];
function showJointAreaGuides(app: App) {
  const cv = b17b(app).camvis;
  for (const v of VIEWS) for (const c of CAMS) for (const g of GUIDES) {
    const key = `Views.View${v}.${c}Camera.camvis.${g}`;
    if (cv.get(key) === true) continue;
    const had = cv.has(key), old = cv.get(key);
    app.record('SetValue ' + key, () => cv.set(key, true), () => { if (had) cv.set(key, old!); else cv.delete(key); });
  }
}
function setJointMinMax(app: App, a: A) {
  const items = collection(app, a.InputObjs);
  if (!items.length) { app.logMsg('info', 'Please select a bone first'); return; }
  showJointAreaGuides(app);
  const min = truthy(a.DoMin);
  for (const n of items) {
    if (!(n instanceof Bone)) continue;   // non-bone items are skipped silently
    const j = jointOf(app, n);
    app.setParam(j.get('rotlim_active')!, true);
    for (const ax of ['X', 'Y', 'Z']) app.setParam(j.get((min ? 'rotMin' : 'rotMax') + ax)!, params(n).val('rot' + ax.toLowerCase()));
  }
}
function setJointsToPrefRotations(app: App, a: A) {
  const items = collection(app, a.InputObjs);
  if (!items.length) { app.logMsg('info', 'Please select a bone first'); return; }
  for (const n of items) {
    if (!(n instanceof Bone)) continue;
    app.run('Rotate', { InputObj: [n], X: prefRot(n, 'x'), Y: prefRot(n, 'y'), Z: prefRot(n, 'z'), Mode: 'siAbsolute', RefFrame: 'siLocal', Center: 'siObj', AxesFilter: 'siXYZ' });
  }
}
function breakChainAtJoint(app: App, a: A) {
  const elems = collection(app, a.InputObjs).filter(isChainElement);
  if (!elems.length) { app.logMsg('info', 'Please select a bone first'); return; }
  for (const el of elems) {
    if (!(el instanceof Bone) && !(el instanceof Effector)) continue;
    const j = jointOf(app, el); const cnspos = ensureParam(params(el), 'cnspos', true);
    const on = !!j.val('pseudoroot_active');
    app.setParam(j.get('pseudoroot_active')!, !on);
    app.setParam(j.get('chntype')!, on ? 0 : 1);
    app.setParam(cnspos, on);
  }
}

// ------------------------------------------------------------------ key / inspect
function keyAllBoneRotations(app: App, a: A) {
  const elems = collection(app, a.InputObjs).filter(isChainElement);
  for (const el of elems) {
    const skel = skeletonOf(app, el);
    if (!skel.length) { app.logMsg('info', 'Please select the effector, or any node of a chain'); return; }
    for (let i = 1; i <= skel.length - 2; i++) {
      const l = params(skel[i]);
      app.run('SaveKey', { InputObjs: ['rotx', 'roty', 'rotz'].map(n => l.get(n)!.fullName).join(',') });
    }
  }
}
function inspectChainProperties(app: App, a: A) {
  const elems = collection(app, a.InputObjs).filter(isChainElement);
  if (!elems.length) return;
  const out: Node[] = [];
  let fellBack = false;
  for (const el of elems) {
    const skel = skeletonOf(app, el); const first = skel[1]; if (!first) continue;
    let chain: Node | null = first.properties.find(p => p.name === 'chain' || p.type === 'chain') ?? null;
    if (!chain) { chain = skel[0]; fellBack = true; }   // this build keeps the chain parameters on the root
    if (!out.includes(chain)) out.push(chain);
  }
  if (fellBack) logNya(app, 'InspectChainProperties', 'the "chain" property of the first bone (this build keeps the chain parameters on the chain root, which is inspected)');
  if (!out.length) return;
  b17b(app).inspected.push(out);
  app.run('InspectObj', { InputObjs: out });
}

// ================================================================== Model.vbs
const isModel = (n: any): n is Model => n instanceof Model;
const refRec = (m: any) => (m && m.ref ? m.ref : null);
const autoInspectGeneral = (app: App, n: Node) => { if (app.autoInspect) app.events.emit('inspect', n); };   // AutoInspect <obj>, , , "General"

function importModel(app: App, a: A): any {
  const C = 'ImportModel';
  const file = unset(a.FileName) ? '' : String(a.FileName);
  const reference = truthy(a.Reference); const template = unset(a.ExternalCnxMappingTemplate) ? '' : String(a.ExternalCnxMappingTemplate);
  const finish = (m: any) => {
    if (!(m instanceof Model)) { a.Value = null; return m ?? null; }
    if (reference || template) { try { app.run('ReconnectModel', { Model: m, ExternalCnxMappingTemplate: template, DeleteUnconnectedObjects: false }); } catch (e: any) { app.logMsg('error', `${C}: ${e?.message ?? e}`); } }
    a.Value = m;
    app.run('SelectObj', { InputObjs: [m], Mode: 'replace' });   // "BRANCH": a plain selection here
    autoInspectGeneral(app, m);
    return m;
  };
  const fs = modelFiles(app);
  // this build's file layer: in-memory bytes / data (not registry arguments), URLs, the store and bundled presets
  if (!reference && fs) {
    if (a.Data && typeof a.Data === 'object') return finish(fs.importData(a.Data));
    if (a.Bytes) return fs.importBytes(a.Bytes, file || 'model.emdl').then(finish);
    if (file && /^(blob:|https?:|\/|\.\/)/i.test(file) && !hostFileExists(file)) return fs.importUrl(file).then(finish);
    if (file && fs.known(file) && !hostFileExists(file)) return fs.importFile(file).then(finish);
    // the FileName handler: an empty name opens the file browser
    if (!file && interactive(app) && typeof document !== 'undefined') return fs.browse().then(finish);
  }
  let m: any;
  if (reference) m = app.run('CreateRefModel', { FileName: file, ModelName: a.Name ?? '', ResolutionName: '', Parent: a.Parent ?? '', Activate: true, CreateFile: false, ExternalCnxMappingTemplate: template, ShareOptions: a.ShareOptions });
  else {
    const s: A = { FileName: file, Parent: unset(a.Parent) ? null : a.Parent, Name: a.Name ?? '', ShareOptions: a.ShareOptions };
    m = app.run('SIImportModel', s);
  }
  if (m && typeof m.then === 'function') return m.then(finish);
  return finish(m);
}
function hostFileExists(file: string): boolean { try { return hostFs.isFile(file); } catch { return false; } }

function importRefModels(app: App, a: A): any {
  const files = String(a.FileName ?? '').split(',');   // no trimming
  const template = unset(a.ExternalCnxMappingTemplate) ? '' : String(a.ExternalCnxMappingTemplate);
  const made: any[] = [];
  for (const f of files) {
    try { made.push(app.run('CreateRefModel', { FileName: f, ModelName: '', ResolutionName: '', Parent: a.Parent ?? '', Activate: true, CreateFile: false, ExternalCnxMappingTemplate: template })); }
    catch { /* errors are ignored */ }
  }
  const reconnect = (list: any[]): Model[] => {
    const models = list.filter(isModel);
    const tpl = [...models.map(m => m.fullName), template].join(',');
    for (const m of models) { try { app.run('ReconnectModel', { Model: m, ExternalCnxMappingTemplate: tpl, DeleteUnconnectedObjects: false }); } catch { /* ignored */ } }
    a.Value = models; return models;
  };
  if (made.some(x => x && typeof x.then === 'function')) return Promise.all(made.map(x => Promise.resolve(x).catch(() => null))).then(reconnect);
  return reconnect(made);
}

function updateReferencedModel(app: App, a: A): any {
  const C = 'UpdateReferencedModel';
  const items = collection(app, a.Clip);
  if (!items.length) { app.logMsg('info', 'No valid referenced model in argument'); return undefined; }
  const models = items.filter(isModel);
  if (!models.length) return undefined;
  b17b(app).calls.push({ what: 'XSIFileService.UpdateReferencedModel', args: [models] });
  const fs = modelFiles(app);
  if (!fs) { logNya(app, C, 'XSIFileService.UpdateReferencedModel without a file layer'); return undefined; }
  const jobs = models.map(m => { try { return fs.reload(m); } catch { return null; } }).filter(Boolean) as Promise<void>[];
  for (const m of models) if (!refRec(m)?.file) app.logMsg('info', `${C}: ${m.name} has no referenced file; not updated`);
  return jobs.length ? Promise.all(jobs).then(() => models) : models;
}

function setResolutionOfRefModels(app: App, a: A): any {
  const res = Math.trunc(vec(a.resolution, 0));
  let models: Model[];
  try {
    if (unset(a.InputObjs)) {
      const found = app.run('FindObjects', { Path: '', Type: '{0496EAB0-0ECF-11d1-ABF1-00A02485CECB}' });
      models = (Array.isArray(found) ? found : []).filter((n: any): n is Model => isModel(n) && (n.val?.('referenced_model') === true || !!refRec(n)));
    } else models = collection(app, a.InputObjs) as any[];
  } catch { models = []; }
  if (!models.length) return undefined;
  try { app.run('SISetResolutionOfRefModels', { Target: models, Resolution: res }); } catch { /* errors are ignored */ }
  for (const m of models) {
    try {
      const cur = vec(app.run('GetCurrentAnimationLayer', { InputObjs: [m] }));
      const n = vec(app.run('GetNumberOfAnimationLayers', { InputObjs: [m] }));
      if (!(cur < n)) app.run('SetCurrentAnimationLayer', { InputObjs: [m], Layer: 0 });
    } catch { /* ignored */ }
  }
  return models;
}

function commitToReference(app: App, a: A): any {
  const C = 'CommitToReference'; const st = b17b(app);
  const items = collection(app, a.Model);
  if (!items.length) return undefined;
  const file = unset(a.FileName) ? '' : String(a.FileName);
  if (!file && truthy(a.Confirm, true)) {
    const text = xsiScripts(1083, 'This operation is destructive and not undoable. The file used by the referenced model will be overwritten. Do you want to proceed?');
    const title = siString('XSISCRIPTS', 'Warning') ?? 'Warning';
    st.boxes.push(`${title}: ${text}`);
    let yes: boolean;
    if (st.hooks.yesNo) yes = !!st.hooks.yesNo(text, title);
    else if (!interactive(app) || typeof window === 'undefined' || typeof window.confirm !== 'function') { app.logMsg('info', `${title}: ${text}`); yes = false; }   // batch: the answer is OK, not Yes
    else yes = window.confirm(`${title}\n\n${text}`);
    if (!yes) return undefined;
  }
  const one = items.length === 1;
  const done: Model[] = [];
  for (const m of items) {
    if (!isModel(m)) continue;
    const target = one ? file : '';
    st.calls.push({ what: 'Model.CommitToReference', args: [m, target, truthy(a.IncludeNestedRefModels)] });
    const r = refRec(m); const out = target || r?.file || '';
    if (!r || !out) { app.logMsg('error', `${C}: ${m.name} is not a referenced model with a file`); continue; }   // inferred: the OM call fails for that model
    if (truthy(a.IncludeNestedRefModels)) logNya(app, C, 'committing the nested referenced models of ' + m.name);
    modelFiles(app)?.commit(m, out); done.push(m);
  }
  return done;
}

function addDelta(app: App, a: A): any {
  const m = unset(a.Model) ? (app.selection[0] ?? null) : nodeOf(app, a.Model);
  let d: any;
  try { d = app.run('ImportDelta', { FileName: 'non.existent.delta', Model: m, Reference: false, Interactive: false }); } catch (e) { throw e; }
  if (d instanceof Node) {
    for (const [k, v] of [['storage', 0], ['status', 2]] as const) app.setParam(ensureParam(d, k, v), v);
    if (!d.get('filename')) d.add(str('filename', '', 'filename'));
    app.setParam(d.get('filename')!, '');
    a.Value = d;
  }
  return d;
}

// ------------------------------------------------------------------ material localisation / clip duplication
/** Objects using a material (direct owners) and the 3D objects of clusters carrying it. */
function usersOf(app: App, mat: Material): X3DObject[] {
  const out = [...materialOwners(app.scene, mat)];
  for (const o of app.scene.allObjects()) for (const c of o.clusters) if ((c as any).material === mat && !out.includes(o)) out.push(o);
  return out;
}
interface LocaliseCtx { filter: Set<Node> | null; dict: Map<string, Material>; collected: Material[] }
function copyMaterial(app: App, owner: X3DObject | Cluster, mat: Material, collect: Material[] | null): Material {
  const copy = app.scene.newMaterial(`${mat.name}_copy`, mat.surface ? cloneShaderTree(mat.surface) : (null as any));
  const anyOwner: any = owner;
  const old = anyOwner.material ?? null;
  const set = (m: Material | null) => { if (owner instanceof X3DObject) owner.setMaterial(m); else anyOwner.material = m; };
  app.record('SIMakeLocal ' + mat.name, () => set(copy), () => set(old));
  const lib = app.scene.materials;
  app.record('Material library', () => { if (!lib.includes(copy)) lib.push(copy); }, () => { const i = lib.indexOf(copy); if (i >= 0) lib.splice(i, 1); });
  if (collect) collect.push(copy);
  return copy;
}
function localiseObject(app: App, o: X3DObject, ctx: LocaliseCtx) {
  const owners: (X3DObject | Cluster)[] = [o, ...o.clusters];
  for (const owner of owners) {
    const mat: Material | null = (owner as any).material ?? null;
    if (!(mat instanceof Material)) continue;
    const key = `${app.scene.root.name}.${mat.name}`;   // the library-qualified name (inferred form)
    const known = ctx.dict.get(key);
    if (known && known !== mat) { const ow: any = owner; const old = ow.material; app.record('Assign ' + known.name, () => (owner instanceof X3DObject ? owner.setMaterial(known) : (ow.material = known)), () => (owner instanceof X3DObject ? owner.setMaterial(old) : (ow.material = old))); }
    let make: boolean;
    if (o instanceof Model) make = true;
    else if (!ctx.filter) make = usersOf(app, mat).some(u => u.model !== o.model);
    else { app.logMsg('info', 'Selection'); make = usersOf(app, mat).some(u => !ctx.filter!.has(u)); }   // the logged type name is open question Q2
    if (make) { const c = copyMaterial(app, owner, mat, ctx.collected); ctx.dict.set(key, c); }
  }
  if (o instanceof Model) {
    // groups with a local material: the swapped-argument path always runs in "selection" mode against the (empty)
    // material list, so every group material is made local, and the copies are not collected
    for (const g of app.scene.groupList ?? []) {
      const gm: any = (g as any).material; if (!(gm instanceof Material)) continue;
      if ((g as any).parent !== o && (g as any).rigModel !== o) continue;
      const old = gm; const copy = app.scene.newMaterial(`${gm.name}_copy`, gm.surface ? cloneShaderTree(gm.surface) : (null as any));
      app.record('SIMakeLocal ' + gm.name, () => { (g as any).material = copy; }, () => { (g as any).material = old; });
    }
  }
  for (const ch of [...o.children]) localiseObject(app, ch, ctx);
}
/** Clip duplication for the materials made local: every image-clip input of their shader trees gets its own clip. */
function duplicateClips(app: App, mats: Material[]) {
  const clips = new Map<string, any>();
  const walk = (s: Shader, seen: Set<Shader>) => {
    if (seen.has(s)) return; seen.add(s);
    for (const [port, src] of [...s.inputs.entries()]) {
      const x: any = src;
      if (isImageClip(src as any)) {
        const file = String(x.val('filename') ?? x.source?.val?.('FileName') ?? '');
        let clip = clips.get(file);
        if (!clip) {
          let source: any = null;
          try { source = app.run('SIAddImageSource', { FileName: file, Name: '' }); } catch { source = null; }
          const oldSourceName = x.source?.name ?? x.name;
          try { clip = app.run('SICreateImageClip', { FileName: file, Name: oldSourceName }); } catch { clip = null; }
          if (source && clip) { const old = clip.source; app.record('Set image source', () => { clip.source = source; }, () => { clip.source = old; }); }
          logNya(app, 'MakeLocalMaterialsForHierarchy', 'AddImageClip <new source>, <old source name> (this build\'s AddImageClip is the texture file picker); the clip is made from the new source\'s file');
          if (clip) clips.set(file, clip);
        }
        if (clip && clip !== x) { const old = x; app.record('Connect ' + port, () => { s.inputs.set(port, clip); }, () => { s.inputs.set(port, old); }); }
      } else if (src instanceof Shader) walk(src, seen);
    }
  };
  for (const m of mats) if (m.surface) walk(m.surface, new Set());
}
/** ProcessModel with no selection filter, then clip duplication (DuplicateModelFromObj). */
export function localiseMaterialsOfCopy(app: App, o: X3DObject) {
  const ctx: LocaliseCtx = { filter: null, dict: new Map(), collected: [] };
  localiseObject(app, o, ctx);
  duplicateClips(app, ctx.collected);
}
function makeLocalMaterialsForHierarchy(app: App, a: A) {
  app.run('DeselectAll');
  app.run('SelectObj', { InputObjs: collection(app, a.InputObj).filter(n => n instanceof X3DObject), Mode: 'replace' });
  app.run('SelectChildNodes', { InputObjs: '' });
  const sel = [...app.selection]; const filter = new Set<Node>(sel);
  for (const n of sel) {
    if (!(n instanceof X3DObject)) continue;
    const ctx: LocaliseCtx = { filter, dict: new Map(), collected: [] };
    localiseObject(app, n, ctx);
    duplicateClips(app, ctx.collected);
  }
}

// ------------------------------------------------------------------ DeleteModelFromObj / DuplicateModelFromObj helpers
const SUB_RE = /^(.*?)\.(pnt|edge|poly)\[([^\]]*)\]$/i;
/** The sub-components in a Collection argument (the component selection when the argument is empty). */
export function subComponentsOf(app: App, v: any): { polygons: boolean; text: string; obj: X3DObject; kind: 'point' | 'edge' | 'polygon'; indices: number[] }[] {
  const out: { polygons: boolean; text: string; obj: X3DObject; kind: 'point' | 'edge' | 'polygon'; indices: number[] }[] = [];
  if (unset(v)) {
    const cs = app.componentSel();
    if (cs) { const k = cs.sel.kind; const tag = k === 'point' ? 'pnt' : k === 'edge' ? 'edge' : 'poly'; out.push({ polygons: k === 'polygon', text: `${cs.obj.fullName}.${tag}[${cs.sel.indices.join(',')}]`, obj: cs.obj, kind: k, indices: [...cs.sel.indices] }); }
    return out;
  }
  for (const x of Array.isArray(v) ? v : String(v).split(/,(?![^[]*\])/)) {
    if (typeof x !== 'string') continue;
    const m = SUB_RE.exec(x.trim()); if (!m) continue;
    const o = app.scene.find(m[1]); if (!o) continue;
    const kind = /^pnt$/i.test(m[2]) ? 'point' : /^edge$/i.test(m[2]) ? 'edge' : 'polygon';
    const indices = m[3].split(',').flatMap(r => { const [a, b] = r.split('-').map(Number); return Number.isFinite(b) ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : Number.isFinite(a) ? [a] : []; });
    out.push({ polygons: kind === 'polygon', text: x.trim(), obj: o, kind, indices });
  }
  return out;
}
/** Step 2 of both commands: the owning model of each 3D object (the object itself under the scene root), unique. */
export function owningModelsOf(app: App, v: any): X3DObject[] | null {
  const items = collection(app, v); const out: X3DObject[] = [];
  for (const n of items) {
    if (!(n instanceof X3DObject)) return null;
    const m = n instanceof Model ? n : n.model;
    const pick = !m || m === app.scene.root ? n : m;
    if (!out.includes(pick)) out.push(pick);
  }
  return out;
}
export const branchList = (list: X3DObject[]) => list.map(o => `B:${o.fullName}`).join(',');
export function msgBoxB17b(app: App, text: string) { b17b(app).boxes.push(text); app.logMsg('info', `MsgBox: ${text}`); }

/** The app's own "give this object its own material" helper (copy of the material it renders with). It is not the
 *  MakeLocalMaterialsForHierarchy contract, which only localises materials the object already owns. */
export function makeOwnMaterialCopy(app: App, o: X3DObject): Material | null {
  if (o.material) return o.material;
  const src = currentMaterial(app.scene, o) ?? app.scene.root.material; if (!src?.surface) return null;
  const mat = app.scene.newMaterial(o.name + '_Mat', cloneShaderTree(src.surface));
  app.record('Make local', () => o.setMaterial(mat), () => o.setMaterial(null));
  return mat;
}

// ================================================================== registration
const COL = (name: string) => ({ name, default: null });
export function registerChainsModelB17bCommands(app: App) {
  b17b(app);
  const reg = (name: string, label: string, category: string, args: { name: string; default?: any }[], execute: (app: App, a: A) => any, extra: Partial<Parameters<App['register']>[0]> = {}) =>
    app.register({ name, label, category, description: `${label} (${ROW})`, args, execute, ...extra });

  // ---- chains.vbs (category Animation)
  reg('SetBoneMinRotLimit', 'Set Bone Min Rot Limit', 'Animation', [COL('InputObjs'), { name: 'DoMin', default: true }], setJointMinMax);
  reg('SetBoneMaxRotLimit', 'Set Bone Max Rot Limit', 'Animation', [COL('InputObjs'), { name: 'DoMin', default: false }], setJointMinMax);
  // the shipped registry names this entry "Set Bone Max Rot Limit" (copy error); it rotates to the preferred rotation
  reg('SetBoneRotationToPrefRotation', 'Set Bone Max Rot Limit', 'Animation', [COL('InputObjs')], setJointsToPrefRotations);
  reg('BreakChainAtBone', 'Break Chain at Bone', 'Animation', [COL('InputObjs')], breakChainAtJoint);
  reg('AddBoneToEnd', 'Add Bone to Chain', 'Animation', [COL('InputObjs')], addBoneToEnd);
  const sk = (vt: boolean) => [
    { name: 'Rx', default: 0 }, { name: 'Ry', default: 0 }, { name: 'Rz', default: 0 }, { name: 'Ex', default: 1 }, { name: 'Ey', default: 0 }, { name: 'Ez', default: 0 },
    { name: 'Nx', default: 0 }, { name: 'Ny', default: 0 }, { name: 'Nz', default: 1 },
    ...(vt ? [{ name: 'ViewType', default: 3 }, { name: 'Bone', default: null }] : [{ name: 'Bone', default: 0 }]), { name: 'Effector', default: null },
    // not in the registry: the contract's SkeletonType, and the joints of this build's chain drawing tool
    { name: 'SkeletonType', default: vt ? 2 : 3 }, { name: 'Points', default: null },
  ];
  reg('Create2DSkeleton', 'Create a 2D skeleton', 'Animation', sk(true), (app, a) => createSkeleton(app, 'Create2DSkeleton', a));
  reg('Create3DSkeleton', 'Create a 3D skeleton', 'Animation', sk(false), (app, a) => createSkeleton(app, 'Create3DSkeleton', a));
  reg('CreateChainfromCurve', 'Create Chain from Curve', 'Animation', [COL('InputObjs'), { name: 'NbJoints', default: null }, { name: 'UseCns', default: null }],
    (app, a) => {
      // two registry entries: the UI entry (no values: the wizard) and the scripted one (NbJoints / UseCns given)
      if (unset(a.NbJoints) && unset(a.UseCns)) return createChainFromCurveUi(app, a);
      const r = chainFromCurves(app, a.InputObjs, a.NbJoints, a.UseCns); a.Value = r; return r;
    });
  reg('KeyAllBoneRotations', 'Key All Bone Rotations', 'Animation', [COL('InputObjs')], keyAllBoneRotations);
  reg('InspectChainProperties', 'Inspect Chain Properties', 'Animation', [COL('InputObjs')], inspectChainProperties, { undoable: false });

  // ---- Model.vbs
  reg('ImportModel', 'Import Model', 'File', [
    { name: 'FileName', default: '' }, { name: 'Parent', default: '' }, { name: 'Reference', default: false }, { name: 'Value', default: null }, { name: 'Name', default: '' },
    { name: 'ShareOptions', default: 13 }, { name: 'ExternalCnxMappingTemplate', default: '' },
    // not in the registry: in-memory file content for this build's file layer (binary .emdl bytes / parsed data)
    { name: 'Data', default: null }, { name: 'Bytes', default: null },
  ], importModel, { undoable: false });
  reg('ImportRefModels', 'Import Ref Model', 'Model', [{ name: 'FileName', default: '' }, { name: 'Parent', default: '' }, { name: 'ExternalCnxMappingTemplate', default: '' }], importRefModels, { undoable: false });
  reg('UpdateReferencedModel', 'Update Referenced Model', 'Model', [COL('Clip')], updateReferencedModel, { undoable: false });
  reg('SetResolutionOfRefModels', 'Set Resolution Of All RefModels', 'Model', [COL('InputObjs'), { name: 'resolution', default: 0 }], setResolutionOfRefModels);
  reg('CommitToReference', 'Commit to reference', 'Model', [COL('Model'), { name: 'IncludeNestedRefModels', default: false }, { name: 'FileName', default: '' }, { name: 'Confirm', default: true }], commitToReference, { undoable: false });
  reg('AddDelta', 'AddDelta', 'Model', [COL('Model')], addDelta);
  reg('MakeLocalMaterialsForHierarchy', 'Make local materials for Hierarchy', 'Rendering', [COL('InputObj')], makeLocalMaterialsForHierarchy);
}
