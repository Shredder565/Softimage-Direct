// Ledger row CMD-B6a, second half: Align, ApplyPath, CreateCurve, AssembleNurbsMesh, AddComponentTool, ToggleContinuousDraw.
// Brief: docs/ghidra/cmd-b6a-uixsi-keys-sources-materials.md, "Wire contract". Original code written from that contract only.
// See uixsiKeysSourcesMaterials.ts for the conventions (dialogs, in/out arguments, delegation).
import * as THREE from 'three';
import { App, type CommandDef } from '../core/commands';
import { X3DObject, Node, Property, Primitive, Constraint, geomPoints, makeDisplay } from '../core/scene';
import { num, bool, int, type Parameter } from '../core/params';
import { makeCurve } from '../core/curves';
import { mapSetCurveTypeToInterp } from '../core/mixer';
import { sdkModal, renderSdkLayout } from '../ui/sdkHelpersModal';
import { applyAssembleNurbs } from '../ui/assembleNurbsDialog';
import { findParam } from './index';
import { FrozenGeomOperator } from './model';
import { objs, findNode, unset, boolArg, siConst } from './viewEditPropertyHelpers';
import { stateOf, trace, uixsiText, Cancelled, logNya, logWarning, interactive, handled, msgBox, delegate, autoInspect, fill } from './uixsiKeysSourcesMaterialsShared';

type V3 = [number, number, number];
const [SI_CREATE_CURVE, SI_SET_CURVE_POINTS, SI_ASSEMBLE, ADD_POINT_ON_CURVE_TOOL, GET_VALUE] = 'SICreateCurve SISetCurvePoints SIAssembleNurbsMesh AddPointOnCurveTool GetValue'.split(' ');

// ------------------------------------------------------------------ Align
// inferred (Q3): numeric values of siAlignModes, in the order the public SDK type library documentation lists them.
const ALIGN_MODES = ['siAlignGMIN', 'siAlignGMIDDLE', 'siAlignGMAX', 'siAlignFMIN', 'siAlignFMIDDLE', 'siAlignFMAX'];
const AXES: Record<string, number> = { siX: 1, siY: 2, siZ: 4, siXY: 3, siXZ: 5, siYZ: 6, siXYZ: 7 };
function alignMode(v: any): string { const c = siConst(v); return typeof c === 'number' ? ALIGN_MODES[c] ?? 'siAlignFMIDDLE' : String(c ?? 'siAlignFMIDDLE'); }
function axesMask(v: any): number { const c = siConst(v); return typeof c === 'number' ? c & 7 : AXES[String(c)] ?? 0; }
const modeIndex = (v: any) => Math.max(0, ALIGN_MODES.indexOf(alignMode(v)));

/** inferred stand-in for GetBBox <items>, True: the world-space box of the items' geometry points, children included
 *  (an object without geometry contributes its position). */
function bbox(list: X3DObject[]): THREE.Box3 {
  const box = new THREE.Box3(); const v = new THREE.Vector3();
  const add = (o: X3DObject) => {
    const m = o.globalMatrix(); let pts: Float32Array | null = null;
    try { pts = geomPoints(o.primitive?.geom?.()); } catch { pts = null; }
    if (pts && pts.length >= 3) for (let i = 0; i + 2 < pts.length; i += 3) box.expandByPoint(v.set(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(m));
    else box.expandByPoint(v.setFromMatrixPosition(m));
    for (const c of o.children) add(c);
  };
  for (const o of list) add(o);
  return box;
}
const lo = (b: THREE.Box3): V3 => [b.min.x, b.min.y, b.min.z], hi = (b: THREE.Box3): V3 => [b.max.x, b.max.y, b.max.z];
function alignObjects(app: App, a: Record<string, any>) {
  const items = objs(app, a.InputObjs); if (!items.length) return;
  const mask = axesMask(a.AlignAxes);
  trace(app, 'GetBBox'); const G = bbox(items);
  trace(app, 'GetBBox'); const F = bbox([items[0]]);
  const ref = [a.RefX, a.RefY, a.RefZ].map((m, i) => {
    switch (alignMode(m)) {
      case 'siAlignGMAX': return hi(G)[i];
      case 'siAlignGMIN': return lo(G)[i];
      case 'siAlignGMIDDLE': return (lo(G)[i] + hi(G)[i]) / 2;
      case 'siAlignFMAX': return hi(F)[i];
      case 'siAlignFMIN': return lo(F)[i];
      default: return (lo(F)[i] + hi(F)[i]) / 2;
    }
  });
  const all = boolArg(a.AllObjects);
  items.forEach((o, n) => {
    if (n === 0 && !all) return;   // the first item is moved only when AllObjects is true
    let own = F; if (n > 0) { trace(app, 'GetBBox'); own = bbox([o]); }
    const d = [a.PosX, a.PosY, a.PosZ].map((m, i) => {
      if (!(mask & (1 << i))) return 0;
      const pm = alignMode(m); const anchor = pm === 'siAlignGMAX' ? hi(own)[i] : pm === 'siAlignGMIN' ? lo(own)[i] : (lo(own)[i] + hi(own)[i]) / 2;
      return ref[i] - anchor;
    });
    // inferred: the displacement is a world-space delta; the build's Translate adds to the local position, so the
    // delta is expressed in the parent's space first.
    const inv = (o.parentObj ? o.parentObj.globalMatrix() : new THREE.Matrix4()).invert();
    const l = new THREE.Vector3(d[0], d[1], d[2]).applyMatrix4(inv).sub(new THREE.Vector3().applyMatrix4(inv));
    const clean = (x: number) => Math.abs(x) < 1e-12 ? 0 : x;
    trace(app, 'Translate');
    app.run('Translate', { InputObj: [o], X: clean(l.x), Y: clean(l.y), Z: clean(l.z), Mode: 'siRelative' });
  });
}
const ALIGN_PARAMS = ['doX', 'doY', 'doZ', 'posX', 'posY', 'posZ', 'doAllObj', 'refX', 'refY', 'refZ'];
async function alignUI(app: App, a: Record<string, any>) {
  const items = objs(app, a.InputObjs);
  if (!items.length) throw new Cancelled('Align');
  if (items.length < 2) {
    logWarning(app, uixsiText(1013));
    await msgBox(app, uixsiText(1013), 'Warning', false);
    throw new Cancelled('Align');
  }
  const root = app.scene.root;
  let prop = root.properties.find(p => p.name === 'Align');
  if (!prop) {
    // inferred (Q3): the AlignWizard preset's parameter types; the note names the ten parameters only.
    const mask = axesMask(a.AlignAxes); const mode = { min: 0, max: 5 };
    const made = prop = new Property('Align', 'AlignWizard', [
      bool('doX', !!(mask & 1), 'X'), bool('doY', !!(mask & 2), 'Y'), bool('doZ', !!(mask & 4), 'Z'),
      int('posX', modeIndex(a.PosX), 'Pos X', mode), int('posY', modeIndex(a.PosY), 'Pos Y', mode), int('posZ', modeIndex(a.PosZ), 'Pos Z', mode),
      bool('doAllObj', boolArg(a.AllObjects), 'All Objects'),
      int('refX', modeIndex(a.RefX), 'Ref X', mode), int('refY', modeIndex(a.RefY), 'Ref Y', mode), int('refZ', modeIndex(a.RefZ), 'Ref Z', mode),
    ]);
    app.record('Add Align', () => { root.addProperty(made); }, () => { root.removeProperty(made); });
  }
  const page = prop;
  stateOf(app).lastInspect = { via: 'InspectObj', nodes: [page], title: 'Align', modal: true }; trace(app, 'InspectObj');
  // inferred: without a user session the modal inspect fails and counts as Cancel
  const ok = interactive(app) && await sdkModal('Align', (body) => renderSdkLayout(body, page, ALIGN_PARAMS.map(param => ({ param }))), { cls: 'uixsi-align' });
  if (!ok) throw new Cancelled('Align');
  const v = (n: string) => page.val(n); const m = (n: string) => ALIGN_MODES[Number(v(n))] ?? 'siAlignFMIDDLE';
  const out = { AlignAxes: (boolArg(v('doX')) ? 1 : 0) + (boolArg(v('doY')) ? 2 : 0) + (boolArg(v('doZ')) ? 4 : 0), PosX: m('posX'), PosY: m('posY'), PosZ: m('posZ'), RefX: m('refX'), RefY: m('refY'), RefZ: m('refZ'), AllObjects: boolArg(v('doAllObj')) };
  stateOf(app).out.Align = out;
  app.run('Align', { InputObjs: items, ...out });
}

// ------------------------------------------------------------------ ApplyPath
const cnsPath = (app: App, o: X3DObject, c: Constraint, name: string): string | null => {
  for (const mid of [c.type, c.name]) { const path = `${o.name}.${mid}.${name}`; if (findParam(app, path) === c.get(name)) return path; }
  return null;
};
function saveKey(app: App, o: X3DObject, c: Constraint, p: Parameter, time: number, value: number) {
  const path = cnsPath(app, o, c, p.name); trace(app, 'SaveKey');
  const has = () => !!app.anim.fcurve(p)?.keys.some(k => k.time === time && Math.abs(k.value - value) < 1e-9);
  if (path) { try { app.run('SaveKey', { InputObjs: path, Time: time, Value: value }); } catch { /* fall through to the direct key */ } }
  if (has()) return;
  // the build's SaveKey could not reach the parameter: the key is set directly (undoable)
  const fc = app.anim.fcurve(p, true)!; const before = fc.keys.map(k => ({ ...k }));
  app.record('Save Key', () => { app.anim.setKey(p, time, value); }, () => { fc.keys = before.map(k => ({ ...k })); });
}
function applyPath(app: App, a: Record<string, any>) {
  const items = objs(app, a.InputObjs); const path = unset(a.Path) ? [] : objs(app, a.Path); const nb = Math.floor(Number(a.NbKeys));
  if (!items.length || !path.length || !(nb >= 2)) return;
  const start = Number(a.StartFrame) || 0, end = Number(a.EndFrame) || 0;
  // inferred: the user preference SI3D_CONSTRAINT_COMPENSATION_MODE is the constraint-compensation toggle of this build
  const comp = boolArg((app as any).userPrefs?.SI3D_CONSTRAINT_COMPENSATION_MODE ?? (app as any).cnsComp ?? false);
  const made: Constraint[] = [];
  for (const o of items) {
    trace(app, 'SIApplyCns');
    const r = app.run('SIApplyCns', { PresetObj: 'Path', ConstrainedObj: [o], ConstrainingObj: path, Compensation: comp });
    const c = (Array.isArray(r) ? r[0] : r) as Constraint | undefined; if (!(c instanceof Constraint)) continue;
    made.push(c);
    const perc = c.get('perc');
    if (perc) {
      for (let k = 0; k < nb; k++) saveKey(app, o, c, perc, start + k * (end - start) / (nb - 1), k * 100 / (nb - 1));
      if (boolArg(a.Linear)) {
        trace(app, 'SetCurveType'); const pp = cnsPath(app, o, c, 'perc'); const interp = mapSetCurveTypeToInterp(2);
        const fc = app.anim.fcurve(perc);
        if (pp && app.commands.has('SetCurveType')) app.run('SetCurveType', { InputObjs: pp, Interpolation: 2 });
        if (fc && fc.keys.some(k => k.interp !== interp)) { fc.interp = interp; for (const k of fc.keys) k.interp = interp; }
      }
    } else logNya(app, 'ApplyPath', `${c.fullName} has no perc parameter; no keys saved`, 'Q9');
    const tangent = c.get('tangent');
    if (tangent) { trace(app, 'SetValue'); const tp = cnsPath(app, o, c, 'tangent'); if (tp) app.run('SetValue', { Target: tp, Value: boolArg(a.Tangent) }); else app.setParam(tangent, boolArg(a.Tangent)); }
  }
  autoInspect(app, made);
}
async function applyPathUI(app: App, a: Record<string, any>) {
  const tIn = Number(app.anim.startFrame), tOut = Number(app.anim.endFrame); const root = app.scene.root;
  const range = { min: -1000000, max: 1000000, uimin: tIn, uimax: tOut };
  // The two boolean initial values are crossed as shipped.
  const set = new Property(app.scene.uniqueName('ApplyPath'), 'customparamset', [
    num('Start', tIn, 'Start', { ...range, desc: 'Start Frame' }), num('End', tOut, 'End', { ...range, desc: 'End Frame' }),
    bool('Linear', boolArg(a.Tangent), 'Linear'), bool('Tangent', boolArg(a.Linear), 'Tangent'),
  ]);
  root.addProperty(set); app.events.emit('scene');
  const drop = () => { trace(app, 'DeleteObj'); root.removeProperty(set); app.events.emit('scene'); };
  stateOf(app).lastInspect = { via: 'InspectObj', nodes: [set], title: 'Set Path', modal: true }; trace(app, 'InspectObj');
  let ok = false;
  try { ok = interactive(app) && await sdkModal('Set Path', (body) => renderSdkLayout(body, set, ['Start', 'End', 'Linear', 'Tangent'].map(param => ({ param }))), { cls: 'uixsi-applypath' }); }
  catch { ok = false; }
  if (!ok) { drop(); throw new Cancelled('ApplyPath'); }
  const out = { StartFrame: Number(set.val('Start')), EndFrame: Number(set.val('End')), Tangent: boolArg(set.val('Tangent')), Linear: boolArg(set.val('Linear')) };
  stateOf(app).out.ApplyPath = out;
  try { app.run('ApplyPath', { InputObjs: a.InputObjs, Path: a.Path, NbKeys: a.NbKeys, ...out }); } finally { drop(); }
}

// ------------------------------------------------------------------ CreateCurve
/** `(x0,y0,z0),(x1,y1,z1)...` as triples; anything that is not a full numeric triple is skipped (the real parser is SISetCurvePoints's). */
export function parseCurvePoints(text: any): V3[] {
  const out: V3[] = []; const re = /\(([^()]*)\)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(String(text ?? '')))) { const p = m[1].split(',').map(s => Number(s.trim())); if (p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) out.push([p[0], p[1], p[2]]); }
  return out;
}
/** inferred stand-ins for SICreateCurve and SISetCurvePoints (Q9): an empty curve object under the scene root, then its control points. */
function createCurve(app: App, a: Record<string, any>): X3DObject {
  const degree = Math.max(1, Math.floor(Number(a.Degree)) || 3);
  let curve: X3DObject | null = null;
  const d1 = delegate(app, SI_CREATE_CURVE, { Name: '', Degree: a.Degree, CurveType: a.CurveType });
  if (d1.done) { const r = Array.isArray(d1.result) ? d1.result[0] : d1.result; if (r instanceof X3DObject) curve = r; }
  let gen: FrozenGeomOperator | null = null;
  if (!curve) {
    trace(app, `${SI_CREATE_CURVE} (stand-in)`);
    const o = curve = new X3DObject(app.scene.uniqueName('crvlist'), 'crvlist');
    const prim = new Primitive('NURBS Curve List', 'crvlist'); gen = new FrozenGeomOperator(null, 'Curve');   // no control points yet: the viewport cannot draw a curve without points, so the geometry stays empty
    prim.addOperator(gen); o.setPrimitive(prim); o.addProperty(makeDisplay());
    const root = app.scene.root; app.record('Create Curve', () => { root.addChild(o); }, () => { root.removeChild(o); });
  }
  if (!delegate(app, SI_SET_CURVE_POINTS, { InputObj: curve, Points: a.Points, Local: a.Local }).done) {
    trace(app, `${SI_SET_CURVE_POINTS} (stand-in)`);
    let pts = parseCurvePoints(a.Points);
    if (!boolArg(a.Local)) { const inv = curve.globalMatrix().invert(); pts = pts.map(p => { const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(inv); return [v.x, v.y, v.z] as V3; }); }
    if (Number(a.CurveType)) logNya(app, 'CreateCurve', 'the interpolated curve type (the points are used as control points)', 'Q9');
    const op = gen ?? (curve.primitive?.operators[0] as FrozenGeomOperator | undefined);
    if (op && 'data' in op && pts.length) {
      const prim = curve.primitive!; const before = op.data; const after = makeCurve(pts, degree, false);
      app.record('Set Curve Points', () => { (op as any).data = after; prim.dirty = true; }, () => { (op as any).data = before; prim.dirty = true; });
    }
  }
  return curve;
}

// ------------------------------------------------------------------ AssembleNurbsMesh
const isSurface = (o: X3DObject) => (o.primitive?.type ?? o.type) === 'surfmsh';
const kindOf = (o: X3DObject) => o.primitive?.type ?? o.type;
function assemble(app: App, a: Record<string, any>) {
  let obj: X3DObject | null = null;
  const d = delegate(app, SI_ASSEMBLE, { InputObj: a.InputObj, Tolerance: a.Tolerance, CopyUserCluster: a.CopyUserCluster, CopyMaterial: a.CopyMaterial, CenterGeomCenter: a.CenterGeomCenter });
  if (d.done) { const r = Array.isArray(d.result) ? d.result[0] : d.result; obj = r instanceof X3DObject ? r : null; }
  else {
    // inferred stand-in (Q9): the surface-mesh merge behind this build's Assemble dialog, with the same four options
    const inputs = objs(app, a.InputObj).filter(isSurface);
    if (!inputs.length) { logNya(app, 'AssembleNurbsMesh', `${SI_ASSEMBLE} without a surface mesh in the input; nothing assembled`, 'Q9'); return; }
    trace(app, `${SI_ASSEMBLE} (stand-in)`);
    const before = new Set(app.scene.allObjects());
    app.select(inputs);
    applyAssembleNurbs(app, { toleranceText: String(Number(a.Tolerance)), copyClusters: boolArg(a.CopyUserCluster), copyMats: boolArg(a.CopyMaterial), center: boolArg(a.CenterGeomCenter) });
    obj = [...app.scene.allObjects()].find(o => !before.has(o) && isSurface(o)) ?? [...app.scene.allObjects()].find(o => !before.has(o)) ?? null;
  }
  if (obj) { trace(app, 'SelectObj'); app.run('SelectObj', { InputObjs: [obj], Mode: 'replace' }); autoInspect(app, [obj]); }
}
async function assembleUI(app: App, a: Record<string, any>) {
  trace(app, 'SIFilter');
  if (!objs(app, a.InputObj).some(isSurface)) return;
  // inferred (Q7): the TaskUI.SCMDialog layout; its four values are shown as a plain page
  const dlg = new Property('SCMDialog', 'customparamset', [
    num('Tolerance', Number(a.Tolerance), 'Tolerance'), bool('CopyClusterFlag', boolArg(a.CopyUserCluster), 'Copy User Clusters'),
    bool('CopyMaterialFlag', boolArg(a.CopyMaterial), 'Copy Materials'), bool('CenterGeomCenterFlag', boolArg(a.CenterGeomCenter), 'Center To Geometric Center'),
  ]);
  const ok = interactive(app) && await sdkModal('Assemble Surface Mesh', (body) => renderSdkLayout(body, dlg, dlg.params.map(p => ({ param: p.name }))), { cls: 'uixsi-scm' });
  if (!ok) return;   // Cancel: silent, no error
  // As shipped the object list passed on is unset: the scripted entry then works on the selection (Q6).
  app.run('AssembleNurbsMesh', { Tolerance: Number(dlg.val('Tolerance')), CopyUserCluster: boolArg(dlg.val('CopyClusterFlag')), CopyMaterial: boolArg(dlg.val('CopyMaterialFlag')), CenterGeomCenter: boolArg(dlg.val('CenterGeomCenterFlag')) });
}

// ------------------------------------------------------------------ ToggleContinuousDraw
type Slot = { read(): any; write(v: any): void };
function slot(app: App, target: any, name: string): Slot {
  const key = target instanceof Node ? target.fullName : String(target).trim();
  if (/^views$/i.test(key)) { const views = stateOf(app).views; return { read: () => views[name], write: (v) => { views[name] = v; app.events.emit('params'); } }; }
  const path = `${key}.${name}`; const node = target instanceof Node ? target : findNode(app, key);
  const p = findParam(app, path) ?? node?.get(name) ?? (node instanceof X3DObject ? node.properties.map(q => q.get(name)).find(Boolean) : undefined);
  if (!p) throw new Error(`No such parameter ${path}`);
  return { read: () => p.value, write: (v) => app.setParam(p, v) };
}
function toggleValue(app: App, a: Record<string, any>) {
  const names = String(a.ParamName ?? '').split(',');   // no trimming of spaces
  const targets: any[] = unset(a.InputObjs) ? [] : Array.isArray(a.InputObjs) ? a.InputObjs : String(a.InputObjs).split(',');
  if (!targets.length || !names.length) return;
  trace(app, GET_VALUE);
  const value = !(slot(app, targets[0], names[0]).read() === true);
  for (const t of targets) for (const n of names) { trace(app, 'SetValue'); slot(app, t, n).write(value); }
  stateOf(app).out.ToggleContinuousDraw = { value };
}

// ------------------------------------------------------------------ registration
export function registerUixsiTools(app: App, reg: (def: CommandDef) => void) {
  const st = stateOf(app);
  const GM = ':siAlignGMIDDLE:siAlignModes';
  const ALIGN_ARGS = [{ name: 'InputObjs', default: null }, { name: 'AlignAxes', default: ':siY:siAxesFilter' }, { name: 'PosX', default: GM }, { name: 'PosY', default: GM }, { name: 'PosZ', default: GM }, { name: 'RefX', default: GM }, { name: 'RefY', default: GM }, { name: 'RefZ', default: GM }, { name: 'AllObjects', default: true }];
  reg({ name: 'Align', label: 'Align Objects', category: 'Manipulation|Transform', description: '', args: ALIGN_ARGS, execute(app, a) { alignObjects(app, a); } });
  st.uiArgs.Align = ALIGN_ARGS;
  st.ui.Align = (args = {}) => handled(app, 'Align', alignUI(app, fill(ALIGN_ARGS, args)));

  reg({
    name: 'ApplyPath', label: 'Apply Path', category: 'Animation', description: '',
    args: [{ name: 'InputObjs', default: null }, { name: 'Path', default: null }, { name: 'StartFrame', default: 0.0 }, { name: 'EndFrame', default: 0.0 }, { name: 'NbKeys', default: 2 }, { name: 'Linear', default: false }, { name: 'Tangent', default: false }],
    execute(app, a) { applyPath(app, a); },
  });
  st.uiArgs.ApplyPath = [{ name: 'InputObjs', default: null }, { name: 'Path', default: null }, { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null }, { name: 'NbKeys', default: 2 }, { name: 'Linear', default: false }, { name: 'Tangent', default: false }];
  st.ui.ApplyPath = (args = {}) => handled(app, 'ApplyPath', applyPathUI(app, fill(st.uiArgs.ApplyPath, args)));

  reg({
    name: 'CreateCurve', label: 'Create Curve', category: 'Drawing', description: "CreateCurve <degree>, <interpolated>, '(x0,y0,z0),(xn,yn,zn)...'",
    args: [{ name: 'Degree', default: 3 }, { name: 'CurveType', default: 0 }, { name: 'Points', default: '' }, { name: 'Local', default: false }, { name: 'Value', default: null }],
    execute(app, a) {
      const curve = createCurve(app, a);
      st.out.CreateCurve = { Value: curve };
      // No return value in the registry; the object is the `Value` output argument, handed back the way output
      // arguments reach a script (a one-item list that also carries the argument name).
      return Object.assign([curve], { Value: curve });
    },
  });

  const SCM_ARGS = [{ name: 'InputObj', default: null }, { name: 'Tolerance', default: 0.15 }, { name: 'CopyUserCluster', default: false }, { name: 'CopyMaterial', default: false }, { name: 'CenterGeomCenter', default: true }];
  reg({ name: 'AssembleNurbsMesh', label: 'Assemble Surface Mesh', category: 'Modeling|Generator', description: '', args: SCM_ARGS, execute(app, a) { assemble(app, a); } });
  st.uiArgs.AssembleNurbsMesh = SCM_ARGS;
  st.ui.AssembleNurbsMesh = (args = {}) => handled(app, 'AssembleNurbsMesh', assembleUI(app, fill(SCM_ARGS, args)));

  reg({
    name: 'AddComponentTool', label: 'Add Component Tool', category: 'Modeling|Drawing', description: '', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const kinds = objs(app, a.InputObjs).map(kindOf); trace(app, 'SIFilter');
      const split = () => { trace(app, 'SplitEdgeTool'); app.run('SplitEdgeTool'); };
      if (kinds.includes('polymsh')) split();
      else if (kinds.includes('crvlist')) { if (!delegate(app, ADD_POINT_ON_CURVE_TOOL, {}).done) logNya(app, 'AddComponentTool', `${ADD_POINT_ON_CURVE_TOOL} is not on the bus (no registry entry in the dump); no tool started`, 'Q9'); }
      else if (kinds.includes('surfmsh')) { /* no tool exists for surfaces */ }
      else split();
    },
  });

  reg({
    name: 'ToggleContinuousDraw', label: 'Continuous Draw', category: 'Viewing', description: '', undoable: false,
    args: [{ name: 'ParamName', default: 'ContinuousDraw' }, { name: 'InputObjs', default: 'Views' }],
    execute(app, a) { toggleValue(app, a); },
  });
}
