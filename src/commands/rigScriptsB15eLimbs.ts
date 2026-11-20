// Ledger row CMD-B15e (Character Rigging script commands), part 2: the component builders.
//   MakeSpine MakeTorso MakeArm MakeHand MakeLeg MakeFoot MakeDogLeg MakeHead
// Brief: docs/ghidra/cmd-b15e-character-rigging-scripts.md §3.7-3.14 ("Wire contract") and WIRE_CORRECTIONS_B15 items
// 36-37. Original code written from that prose only; see rigScriptsB15eShared.ts for the mapping onto this build.
// Placement the note does not state (where a control sits, how a roll angle is measured, default object names for an
// empty name argument) is marked "inferred" in the code; scripted-operator math is out of scope (operators recorded).
import { App } from '../core/commands';
import { X3DObject, Property, Node } from '../core/scene';
import { num, str } from '../core/params';
import { makeCurve, circleCurve, evalCurve } from '../core/curves';
import { hipPlate } from './rigScriptsB15eParts';
import {
  CAT, THREE, Vec, v3, wpos, asV3, translation, frame, frameY, setGlobal, objArg, objsArg, strArg, numArg, intArg, boolArg, logError, logInfo,
  logWarn, logNya, logNyaOnce, mkNull, curveObj, cubeMesh, implicitObj, customProp, addProxy, setP, setColor, hideObj, cns, scriptOp, hideSetup,
  modelOf, markingSet, drawChain, setChainScale, colorChain, boneLength, rigIcon, control, expression, upVector, reparent, deleteObj,
  neutralPose, boxShadow, runDialog, duplicates, curveLen, Chain, skeletonOf, isNothing,
} from './rigScriptsB15eShared';
import { findNode } from './viewEditPropertyHelpers';

const G = '{F1D7703B-083A-42B9-841D-49FE3779CECD}';
/** A property/object argument (Sliders pages are custom properties). */
function nodeArg(app: App, v: any): Node | null { if (isNothing(v)) return null; const x = Array.isArray(v) ? v[0] : v; if (x instanceof Node) return x; const n = findNode(app, x); return n ?? null; }
const sideSign = (prefix: string) => (/^[A-Z]*R/.test(prefix) && !/^[A-Z]*L/.test(prefix) ? -1 : 1);
/** Signed angle (degrees) from a to b about axis. */
function signedAngle(a: Vec, b: Vec, axis: Vec): number { const ang = a.angleTo(b); const s = Math.sign(new THREE.Vector3().crossVectors(a, b).dot(axis)) || 1; return (s * ang * 180) / Math.PI; }
/** Projected angle of `target` around the bone axis start→end, measured from the elbow/knee push-back direction (inferred). */
function projectedRoll(start: Vec, mid: Vec, end: Vec, target: Vec): number {
  const axis = mid.clone().sub(start).normalize(); const perp = (v: Vec) => v.clone().sub(axis.clone().multiplyScalar(v.dot(axis)));
  const knee = perp(mid.clone().sub(start.clone().lerp(end, 0.5))); const up = perp(target.clone().sub(start));
  if (knee.lengthSq() < 1e-12 || up.lengthSq() < 1e-12) return 0; return signedAngle(knee, up, axis);
}
/** Pose records stored with a name (StoreAction stand-in: the action sources keep the listed parameter values). */
export function storePose(app: App, command: string, owner: X3DObject, name: string, params: { obj: X3DObject; p: string; v: number }[]) {
  const list = ((owner as any).rigActions ??= []) as any[]; const rec = { name, items: params.map(x => ({ param: `${x.obj.fullName}.kine.local.${x.p}`, value: x.v })) };
  app.record('StoreAction ' + name, () => list.push(rec), () => list.splice(list.indexOf(rec), 1));
  logNyaOnce(app, command, 'StoreAction sources are kept as pose records on the owner (`rigActions`); this build\'s StoreAction takes other arguments');
}

// ------------------------------------------------------------------ MakeSpine core (§3.8)
export function makeSpineCore(app: App, a: any): any {
  const C = 'makeSpine';
  const model = objArg(app, a.Model), parent = objArg(app, a.Parent), base = objArg(app, a.SpineBaseObject), top = objArg(app, a.SpineTopObject), bd = objArg(app, a.BottomDepthObject), td = objArg(app, a.TopDepthObject);
  let bad = false; ([[1, parent], [5, base], [6, top], [7, bd], [8, td]] as const).forEach(([i, o]) => { if (!o) { logError(app, `${C}: argument ${i} is invalid`); bad = true; } });
  if (bad) return undefined;
  const nb = Math.max(1, intArg(a.NbVertebrae, 3)), type = intArg(a.SpineType, 0), stretch = boolArg(a.Stretchy, false), chestTop = objArg(app, a.ChestTop);
  const shadowType = intArg(a.ShadowType, 1), shadowParent = objArg(app, a.ShadowParent) ?? app.scene.root, vName = strArg(a.VertebraeName), ks = strArg(a.CharacterSetName), sks = strArg(a.ShadowCharacterSetName);
  let sliders = nodeArg(app, a.Sliders) as Property | null;
  const pos = [base!, bd!, td!, top!].map(wpos);
  const out: any = { Envelope: [], Hidden: [], nb, parent, sliders, stretch, Type: type, vertebraName: vName, CharacterSetName: ks, ShadowCharacterSetName: sks, ShadowType: shadowType, ShadowParent: shadowParent, base, top, baseDepth: bd, topDepth: td, chestTop, pos, objList: [], Shadows: [], ShadowEnds: [] };
  const curve = curveObj(app, 'spinecurve', null, [makeCurve(pos.map(asV3), 3, false)]); out.length = curveLen(curve);
  reparent(app, curve, parent); out.Curve = curve; void model;
  const L = out.length;
  if (type === 2) {
    const pts = Array.from({ length: nb + 1 }, (_, i) => pointOn(curve, i / nb));
    if (chestTop) pts.push(wpos(chestTop));
    const c = drawChain(app, parent, pts, v3(1, 0, 0), 3, { root: 'SpineEff', bones: pts.slice(1).map((_, i) => `Lumbar${i + 1}`), eff: 'SpineRoot' });
    setChainScale(c, L * 0.4); colorChain(c, 49);
    deleteObj(app, curve); out.Curve = null;
    Object.assign(out, { Root: c.root, Skel: c.skel, Eff: c.eff, Vertebra: c.bones.slice(1), TopVertebra: c.bones[c.bones.length - 1] });
    out.Envelope.push(...c.bones); out.Hidden.push(c.root, c.eff);
    for (const b of c.bones) markingSet(app, b, false, true, '', ks);
    if (shadowType >= 1 && shadowType <= 3) {
      const sc = app.run('MakeShadowChain', { Chain: c.skel, ShadowParent: shadowParent, SI3DStyleChain: shadowType === 1, IconScale: L * 0.4, ShadowType: shadowType === 3 ? 1 : 0, ShadowCharacterSetName: sks });
      if (sc) Object.assign(out, { ShadowSpine: sc, ShadowStart: sc.ShadowStart, ShadowEnds: sc.ShadowEnds, Shadows: sc.Shadows });
    } else if (shadowType > 3) spineBoxes(app, out, [c.root, ...c.bones], L, shadowParent, sks);
  } else {
    setColor(curve, 49);
    if (!sliders) sliders = customProp(app, curve, 'Spine_Control');
    const scaleP = sliders.get('spine_scale') ?? sliders.add(num('spine_scale', 1, 'spine_scale', { min: 0.01, max: 10000, uimin: 0.01, uimax: 10 } as any));
    const volP = sliders.get('volume_factor') ?? sliders.add(num('volume_factor', 0, 'volume_factor', { min: -10000, max: 10000, uimin: 0, uimax: 10 } as any));
    Object.assign(out, { sliders, scaleSlider: scaleP, volumeSlider: volP });
    if (!stretch) { out.CurveOp = scriptOp(app, C, 'SpineCurve', curve, [curve, base, bd, td, top], { lgoal: L, lScale: Number(scaleP.value) }); (out.CurveOp as any).lScaleSource = scaleP; }
    else out.CurveOp = [base, bd, td, top].map((o, i) => scriptOp(app, C, 'ClusterCenter', curve, [curve, o], { point: i }));
    const topV = chestTop ? curveObj(app, 'ChestBone', parent, [circleCurve(1)]) : implicitObj(app, 'TopVertebra', 'Cube', curve, undefined, (L / nb) * 0.5);
    if (chestTop) { const inv = topV.globalMatrix().invert(); const tp = wpos(chestTop).applyMatrix4(inv); scriptOp(app, C, 'chestBone', topV, [topV, chestTop], { width: 0.4, depth: 0.4, tip_height: 0.15, upx: 1, top_pointx: tp.x, top_pointy: tp.y, top_pointz: tp.z }); }
    const pathCns = (o: X3DObject, perc: number) => { const pc = cns(app, o, 'Curve (Path)', [curve]); pc.set('perc', perc); pc.set('tangent', true); for (const [k, v] of Object.entries({ upvct_active: 1, dirx: 0, diry: 1, dirz: 0, upx: 0, upy: 0, upz: -1, pointatx: 0, pointaty: 0, pointatz: -1 })) setP(pc, k, v); (pc as any).locked = true; return pc; };
    const topPerc = 100; out.pathCns = pathCns(topV, topPerc);
    if (!stretch) out.lengthOp = scriptOp(app, C, 'FixedLength', topV, [topV, curve], { init_length: L, lScale: Number(scaleP.value) });
    else expression(app, sliders, 'spine_scale', `ctr_dist(${topV.fullName}., ${base!.fullName}.) / ${L}`, wpos(topV).distanceTo(wpos(base!)) / Math.max(1e-9, L));
    const volExpr = `${sliders.fullName}.spine_scale ^ (-${sliders.fullName}.volume_factor)`; const volVal = Math.pow(Number(scaleP.value), -Number(volP.value));
    expression(app, topV, 'sclx', volExpr, volVal); expression(app, topV, 'sclz', volExpr, volVal);
    const vertebrae: X3DObject[] = []; const size = (L / nb) * 0.5;
    for (let i = 0; i < nb; i++) {
      const nm = vName || 'cube';   // inferred: an empty name gives the primitive's default name
      const vtx = type === 0 ? cubeMesh(app, nm, curve, undefined, size) : implicitObj(app, nm, 'Cube', curve, undefined, size);
      pathCns(vtx, topPerc * (i + 1) / (nb + 1)); scriptOp(app, C, 'SpinePointAt', vtx, [vtx, topV, base], { slider: 1 - (i + 1) / (nb + 1) });
      expression(app, vtx, 'sclx', volExpr, volVal); expression(app, vtx, 'sclz', volExpr, volVal); markingSet(app, vtx, false, true, '', ks); vertebrae.push(vtx);
    }
    scriptOp(app, C, 'SpinePointAt', topV, [topV, topV, base], { slider: 0 });
    Object.assign(out, { TopVertebra: topV, Vertebra: vertebrae, vertDist: L / (nb + 1), boneIcon: size, objList: [...vertebrae, topV] });
    out.Envelope.push(...vertebrae, topV);
    if (shadowType >= 1 && shadowType <= 3) {
      const sCurve = curveObj(app, 'shadowspinecurve', null, [makeCurve(pos.map(asV3), 3, false)]); reparent(app, sCurve, parent); out.ShadowCurve = sCurve; out.Hidden.push(sCurve);
      if (!stretch) { out.ShadowCurveOp = scriptOp(app, C, 'SpineCurve', sCurve, [sCurve, base, bd, td, top], { lgoal: L, lScale: Number(scaleP.value) }); (out.ShadowCurveOp as any).lScaleSource = out.CurveOp; }
      else out.ShadowCurveOp = [base, bd, td, top].map((o, i) => scriptOp(app, C, 'ClusterCenter', sCurve, [sCurve, o], { point: i }));
      const ss = app.run('MakeShadowSpine', { Spline: sCurve, Base: base, Vertebra: vertebrae, TopVertebra: topV, ShadowParent: shadowParent, ChestTop: chestTop, IconScale: L * 0.4, ShadowType: shadowType, ShadowCharacterSetName: sks });
      if (ss) {
        Object.assign(out, { ShadowSpine: ss, ShadowStart: ss.ShadowStart, ShadowEnds: ss.ShadowEnds, Shadows: ss.Shadows });
        if (stretch && Array.isArray(ss.Skel)) ss.Skel.filter((e: X3DObject) => e.type === 'bone').forEach((b: X3DObject, i: number) => scriptOp(app, C, 'RIG_stretchVertebraOp', b, [b, sCurve], { index: i }));
      }
    } else if (shadowType > 3) spineBoxes(app, out, [base!, ...vertebrae, topV], L, shadowParent, sks);
  }
  Object.assign(out, hideSetup(app, modelOf(parent), out.Hidden, out.Envelope));
  return out;
}
function pointOn(curve: X3DObject, t: number): Vec { const cd = curve.primitive!.curve()!; const k = cd.knots; const u = k[0] + (k[k.length - 1] - k[0]) * t; const p = evalCurve(cd, u); return v3(...p).applyMatrix4(curve.globalMatrix()); }
function spineBoxes(app: App, out: any, chain: X3DObject[], L: number, shadowParent: X3DObject, sks: string) {
  const boxes: X3DObject[] = [];
  for (let i = 0; i + 1 < chain.length; i++) boxes.push(boxShadow(app, 'makeSpine', `Lumbar${i + 1}`, shadowParent, chain[i], [chain[i + 1]], 'Connector_Box', { topWidth: L * 0.3, topDepth: L * 0.3 * 0.6, bottomWidth: L * 0.3, bottomDepth: L * 0.3 * 0.6, topOffset_z: 90, bottomOffset_z: 90, invert: true }, sks));
  Object.assign(out, { Shadows: boxes, ShadowStart: boxes[0] ?? null, ShadowEnds: boxes.length ? [boxes[boxes.length - 1]] : [] });
}

// ------------------------------------------------------------------ registration
export function registerRigScriptsB15eLimbCommands(app: App) {
  // ---------------------------------------------------------------- MakeSpine (§3.8)
  app.register({
    name: 'MakeSpine', label: 'Make Spine', category: CAT, description: 'Create Spine Rig',
    args: [{ name: 'Model', default: G }, { name: 'Parent', default: G }, { name: 'NbVertebrae', default: 3 }, { name: 'SpineType', default: 0 }, { name: 'Stretchy', default: false }, { name: 'SpineBaseObject', default: G }, { name: 'SpineTopObject', default: G }, { name: 'BottomDepthObject', default: G }, { name: 'TopDepthObject', default: G }, { name: 'ChestTop', default: G }, { name: 'Sliders', default: G }, { name: 'ShadowType', default: 1 }, { name: 'ShadowParent', default: G }, { name: 'VertebraeName', default: '' }, { name: 'CharacterSetName', default: '' }, { name: 'ShadowCharacterSetName', default: '' }],
    execute: (app, a) => makeSpineCore(app, a),
  });

  // ---------------------------------------------------------------- MakeTorso (§3.7)
  app.register({
    name: 'MakeTorso', label: 'Make Torso', category: CAT, description: 'Create Torso',
    args: [{ name: 'Parent', default: G }, { name: 'NbDivisions', default: 3 }, { name: 'StretchType', default: 0 }, { name: 'GuideObjectCollection', default: G }, { name: 'ControlType', default: 0 }, { name: 'SpineType', default: 0 }, { name: 'Sliders', default: G }, { name: 'ShadowType', default: 0 }, { name: 'ShadowParent', default: G }, { name: 'NegativeScale', default: 0 }],
    execute(app, a) {
      const C = 'makeTorso'; const parent = objArg(app, a.Parent); const guides = objsArg(app, a.GuideObjectCollection);
      if (guides.length !== 10 && guides.length !== 11) { logError(app, `${C}: guide collection (argument 1) needs 10 or 11 objects. Contains ${guides.length} objects`); return undefined; }
      if (!parent) { logError(app, `${C}: required argument 0 is invalid`); return undefined; }
      const nb = intArg(a.NbDivisions, 3), stretch = intArg(a.StretchType, 0), cube = intArg(a.ControlType, 0) === 1, spineType = intArg(a.SpineType, 0), shadowType = intArg(a.ShadowType, 0), neg = intArg(a.NegativeScale, 0);
      const shadowParent = objArg(app, a.ShadowParent) ?? app.scene.root; const sliders = nodeArg(app, a.Sliders);
      const P = guides.map(wpos); const [baseP, , , endP, lLeg, lSS, lSE, rLeg, rSS, rSE] = P; const ribCage = guides[10] ?? null;
      const scale = baseP.distanceTo(endP) / 1.25; const legMid = lLeg.clone().add(rLeg).multiplyScalar(0.5); const hipPos = legMid.clone().lerp(baseP, 0.6);
      const ydir = endP.clone().sub(baseP).normalize();
      if (spineType === 3) ydir.set(ydir.x, ydir.y, 0).normalize();
      if (spineType === 4) { const ax = [Math.abs(ydir.x), Math.abs(ydir.y), Math.abs(ydir.z)]; const m = ax.indexOf(Math.max(...ax)); ydir.set(m === 0 ? Math.sign(ydir.x) : 0, m === 1 ? Math.sign(ydir.y) : 0, m === 2 ? Math.sign(ydir.z) : 0); }
      const F = (p: Vec) => frameY(p, ydir, v3(1, 0, 0));
      const out: any = { parent, nb, stretch, ribCage, controlType: cube ? 1 : 0, NegativeScaling: neg, CharacterSetName: 'Upper.Torso', ShadowCharacterSetName: 'ShadowUpper.ShadowTorso', Hidden: [], Envelope: [], ShadowType: shadowType, SpineType: spineType, ShadowParent: shadowParent, guides, model: modelOf(parent), sliders, pos: P, lpos: [lLeg, lSS, lSE], rpos: [rLeg, rSS, rSE], torsoObjs: [], TailObjs: [], TailPos: [], scale, HipPos: hipPos, BaseTrans: F(baseP), TopTrans: F(endP), Shadows: [], ShadowEnds: [] };
      const hp = hipPlate(app, C, parent, F(hipPos), baseP, lLeg); out.HipBone = hp;
      const spineStart = mkNull(app, 'SpineStart', hp, F(baseP)); out.spineStart = spineStart; out.Hidden.push(spineStart);
      const ub = control(app, C, 'UpperBody', parent, F(hipPos), cube, 2 * scale, 0.8 * scale, 253); neutralPose(app, ub); markingSet(app, ub, true, true, '', 'Upper');
      const hip = control(app, C, 'Hip', ub, F(hipPos), cube, 1.5 * scale, 0.6 * scale, 770); markingSet(app, hip, true, true, '', 'Lower');
      const chest = control(app, C, 'Chest', ub, F(endP), cube, 2 * scale, 0.8 * scale, 253); neutralPose(app, chest); markingSet(app, chest, true, true, '', 'Upper');
      const spineEnd = mkNull(app, 'SpineEnd', chest, F(endP)); reparent(app, hp, hip);
      const hd = mkNull(app, 'HipDepth', hip, F(P[1]), { color: 770, icon: 2 }); markingSet(app, hd, true, false, '', 'Upper.Torso');
      const cd = mkNull(app, 'ChestDepth', chest, F(P[2]), { color: 253, icon: 2 }); markingSet(app, cd, true, false, '', 'Upper.Torso');
      Object.assign(out, { UpperBody: ub, Hip: hip, Chest: chest, spineEnd, HipDepth: hd, ChestDepth: cd });
      const spine = app.run('MakeSpine', { Model: out.model, Parent: hp, NbVertebrae: nb, SpineType: spineType, Stretchy: !!stretch, SpineBaseObject: spineStart, SpineTopObject: spineEnd, BottomDepthObject: hd, TopDepthObject: cd, ChestTop: ribCage, Sliders: sliders, ShadowType: shadowType, ShadowParent: shadowParent, VertebraeName: 'SpineVertebra', CharacterSetName: 'Upper.Torso', ShadowCharacterSetName: 'ShadowUpper.ShadowTorso' });
      out.Spine = spine;
      if (spineType === 2) {
        reparent(app, hp, ub);
        for (const o of [hip, chest]) { for (const ch of [...o.children]) reparent(app, ch, ub); deleteObj(app, o); }   // inferred: their children are kept under UpperBody
        out.Hip = null; out.Chest = null;
      }
      const topV: X3DObject = spine?.TopVertebra ?? spineEnd;
      const shoulder = (s: 'L' | 'R', ss: Vec, se: Vec) => {
        const c = drawChain(app, topV, [ss, se], v3(0, 1, 0), 3, { root: `${s}ShoulderRoot`, bones: [`${s}Shoulder`], eff: `${s}ShoulderEff` });
        setChainScale(c, scale, 0.2, 0.3); setColor(c.bones[0], 489); markingSet(app, c.bones[0], false, true, '', 'Upper.Torso');
        if ((neg === 1 && s === 'R') || (neg === 2 && s === 'L')) logNyaOnce(app, 'MakeTorso', 'DuplicateSymmetry mirroring of the negative-scaled shoulder (drawn through its guides instead)');
        out.Envelope.push(c.bones[0]); return c;
      };
      const rc = shoulder('R', rSS, rSE), lc = shoulder('L', lSS, lSE);
      Object.assign(out, { rroot: rc.root, lroot: lc.root, RSkel: rc.skel, LSkel: lc.skel, REff: rc.eff, LEff: lc.eff });
      if (shadowType >= 1 && shadowType <= 3) {
        const sub = mkNull(app, 'UpperBody', shadowParent, (spineType === 2 ? ub : hip).globalMatrix(), { color: shadowType === 3 ? 381 : 805 });
        cns(app, sub, 'Pose', [spineType === 2 ? ub : hip], true); out.ShadowStart = sub;
        const sEnd: X3DObject = spine?.ShadowEnds?.[0] ?? sub;
        const rs = app.run('MakeShadowChain', { Chain: rc.skel, ShadowParent: sEnd, SI3DStyleChain: shadowType === 1, IconScale: scale * 0.3, ShadowType: shadowType === 3 ? 1 : 0, ShadowCharacterSetName: 'ShadowUpper.ShadowTorso' });
        const ls = app.run('MakeShadowChain', { Chain: lc.skel, ShadowParent: sEnd, SI3DStyleChain: shadowType === 1, IconScale: scale * 0.3, ShadowType: shadowType === 3 ? 1 : 0, ShadowCharacterSetName: 'ShadowUpper.ShadowTorso' });
        Object.assign(out, { RSkelShadow: rs, LSkelShadow: ls, ShadowEnds: [sEnd, rs?.ShadowEnds?.[0] ?? sEnd, ls?.ShadowEnds?.[0] ?? sEnd, spine?.ShadowStart ?? sub] });
        out.Shadows = [sub, ...(spine?.Shadows ?? []), ...(rs?.Shadows ?? []), ...(ls?.Shadows ?? [])];
      } else if (shadowType > 3) {
        const w = scale; const chestBox = boxShadow(app, C, 'Chest', shadowParent, topV, [lc.root, rc.root], 'Connector_T', { topWidth: w, topDepth: w * 0.6, bottomWidth: w, bottomDepth: w * 0.6, topOffset_z: 90, bottomOffset_z: 90 }, 'ShadowUpper.ShadowTorso');
        const side = mkNull(app, 'SideMarker', hp, translation(lLeg)), bottom = mkNull(app, 'BottomMarker', hp, translation(legMid)); out.Hidden.push(side, bottom);
        const ubBox = boxShadow(app, C, 'UpperBody', shadowParent, hp, [side, bottom], 'Connector_T', { topWidth: w, topDepth: w * 0.6, bottomWidth: w, bottomDepth: w * 0.6, topOffset_z: 90, bottomOffset_z: 90, split: true }, 'ShadowUpper.ShadowTorso');
        const rBox = boxShadow(app, C, 'RShoulder', chestBox, rc.bones[0], [rc.eff], 'Connector_Box', { topWidth: w * 0.3, topDepth: w * 0.3 * 0.75, topOffset_x: -45, topOffset_z: 90, bottomOffset_z: 90 }, 'ShadowUpper.ShadowTorso');
        const lBox = boxShadow(app, C, 'LShoulder', chestBox, lc.bones[0], [lc.eff], 'Connector_Box', { topWidth: w * 0.3, topDepth: w * 0.3 * 0.75, topOffset_x: 45, topOffset_z: 90, bottomOffset_z: 90 }, 'ShadowUpper.ShadowTorso');
        Object.assign(out, { ChestMarker: chestBox, SideMarker: side, BottomMarker: bottom, ShadowStart: ubBox, ShadowEnds: [chestBox, rBox, lBox, ubBox], Shadows: [chestBox, ubBox, rBox, lBox, ...(spine?.Shadows ?? [])] });
      }
      // tail from numbered duplicates of the spine-base guide
      const tail = duplicates(guides[0].model ?? guides[0].parentObj, guides[0].name);
      if (tail.length >= 3) { out.TailObjs = tail; out.TailPos = tail.map(wpos); logNya(app, 'MakeTorso', 'MakeTail (the tail builder is outside this row, note §4 Q3); no tail built'); out.Tail = null; }
      else if (tail.length > 0) logWarn(app, 'MakeTorso: Not enough guide points to generate a tail: 3 or more guide objects are needed.');
      out.torsoObjs = [hp, spineStart, ub, hip, chest, spineEnd, hd, cd];
      Object.assign(out, hideSetup(app, out.model, out.Hidden, out.Envelope));
      return out;
    },
  });

  // ---------------------------------------------------------------- MakeArm (§3.9)
  app.register({
    name: 'MakeArm', label: 'Make Arm', category: CAT, description: 'Create Rigged Arm',
    args: [{ name: 'ArmParent', default: G }, { name: 'GuideObjectCollection', default: G }, { name: 'Prefix', default: '' }, { name: 'ArmRootConstrainingObj', default: G }, { name: 'NbForearmDivisions', default: 0 }, { name: 'NbBicepDivisions', default: 0 }, { name: 'ShadowType', default: 0 }, { name: 'ShadowParent', default: G }, { name: 'HandRoot', default: G }, { name: 'NegativeScale', default: false }],
    execute(app, a) {
      const parent = objArg(app, a.ArmParent); const guides = objsArg(app, a.GuideObjectCollection);
      if (!parent) { logInfo(app, 'makeArm: argument 0 is invalid'); return undefined; }
      if (guides.length !== 3) { logInfo(app, `makeArm: Guide collection needs 3 objects. Collection has ${guides.length} objects`); return undefined; }
      const p = strArg(a.Prefix), cnsObj = objArg(app, a.ArmRootConstrainingObj), nf = intArg(a.NbForearmDivisions, 0), nbic = intArg(a.NbBicepDivisions, 0), st = intArg(a.ShadowType, 0), sp = objArg(app, a.ShadowParent) ?? app.scene.root, handRoot = objArg(app, a.HandRoot), neg = boolArg(a.NegativeScale, false);
      const P = guides.map(wpos); const s = P[0].distanceTo(P[2]); const ks = `Upper.${p}_Arm`, sks = `ShadowUpper.Shadow${p}_Arm`;
      const out: any = { parent, guides, prefix: p, constrainObj: cnsObj, NegativeScaling: neg, ForearmDivisions: nf, BicepDivisions: nbic, ShadowType: st, ShadowParent: sp, HandRoot: handRoot, Hidden: [], Envelope: [], CharacterSetName: ks, ShadowCharacterSetName: sks, pos: P, objs: [], scale: s, Shadows: [], ShadowEnds: [] };
      if (neg) logNyaOnce(app, 'MakeArm', 'DuplicateSymmetry rebuild of a negative-scaled arm (drawn through the guides instead)');
      const c = drawChain(app, parent, P, v3(0, 1, 0), 3, { root: `${p}Root`, bones: [`${p}Bicep`, `${p}Forearm`], eff: `${p}ArmEff` });
      setChainScale(c, s * 0.15); setP(c.eff, 'shadow_icon', 4); setP(c.eff, 'radius', s * 0.18); colorChain(c, 489);
      const [bicep, forearm] = c.bones; out.Hidden.push(c.root); out.Envelope.push(bicep, forearm);
      markingSet(app, bicep, false, true, '', ks); markingSet(app, forearm, false, true, '', ks); markingSet(app, c.eff, true, false, '', 'None');
      if (cnsObj) cns(app, c.root, 'Position', [cnsObj]);
      const pushBack = P[1].clone().sub(P[0].clone().lerp(P[2], 0.5)); const normal = new THREE.Vector3().crossVectors(P[1].clone().sub(P[0]), P[2].clone().sub(P[1])).normalize();
      const upPos = P[0].clone().add(v3(0, 0, -s));
      const upv = rigIcon(app, 'makeArm', c.root, 4, upPos, [s * 0.1, s * 0.1, s * 0.1], 253, `${p}ArmUpV`)!; neutralPose(app, upv); markingSet(app, upv, true, false, '', 'None');
      const elbowAngle = P[0].clone().sub(P[1]).angleTo(P[2].clone().sub(P[1])) * 180 / Math.PI;
      let roll = projectedRoll(P[0], P[1], P[2], upPos) * sideSign(p); if (neg) roll = -roll; if (elbowAngle < 90) roll += 180;
      setP(bicep, 'roll', roll); upVector(app, bicep, upv);
      Object.assign(out, { pushBack, normalPlane: normal, Root: c.root, Skel: c.skel, Eff: c.eff, elbow: P[1], normal, vecBack: pushBack.clone().normalize(), roll, UpVpos: upPos, UpVParent: c.root, UpV: upv });
      if (nbic > 0) { const br = app.run('MakeBicepRoll', { Bicep: bicep, Prefix: `${p}Bicep`, NbDivisions: nbic }); out.BicepRoll = br; if (br) { br.Divisions.forEach((d: X3DObject) => setP(d, 'size', s * 0.05)); out.Envelope.splice(out.Envelope.indexOf(bicep), 1, ...br.Divisions); } }
      if (nf > 0 && handRoot) {
        const hs = skeletonOf(handRoot) ?? [];
        const dir = P[2].clone().sub(P[1]); const off = dir.x >= 0 ? 90 : -90;   // inferred: ±90 by arm direction vs +X
        out.ForeArmRoll = app.run('MakeForearmRoll', { Bicep: bicep, Forearm: forearm, ArmEff: c.eff, HandEff: hs[2], HandBone: hs[1], Prefix: p, NbDivisions: nf, RollOffset: off });
        if (out.ForeArmRoll) out.Envelope.splice(out.Envelope.indexOf(forearm), 1, ...out.ForeArmRoll.Divisions);
      }
      if (st >= 1 && st <= 3) {
        const sc = app.run('MakeShadowChain', { Chain: c.skel, ShadowParent: sp, SI3DStyleChain: st === 1, IconScale: s * 0.15, ShadowType: st === 3 ? 1 : 0, ShadowCharacterSetName: sks });
        if (sc) Object.assign(out, { ArmShadow: sc, ShadowStart: sc.ShadowStart, Shadows: sc.Shadows, ShadowEnds: sc.ShadowEnds });
      } else if (st > 3) {
        const parts: X3DObject[] = [];
        const bic = out.BicepRoll?.Divisions?.length ? [bicep, ...out.BicepRoll.Divisions] : [bicep];
        if (bic.length === 1) parts.push(boxShadow(app, 'makeArm', `${p}Bicep`, sp, bicep, [forearm], 'Connector_Box', { topWidth: s * 0.15, topDepth: s * 0.15 * 0.75, bottomWidth: s * 0.15 * 0.65, bottomDepth: s * 0.15 * 0.75 * 0.65, topOffset_z: 90, bottomOffset_z: 90, split: true }, sks));
        else for (let i = 0; i + 1 < bic.length; i++) parts.push(boxShadow(app, 'makeArm', `${p}Bicep`, sp, bic[i], [bic[i + 1]], 'Connector_Box', { topWidth: s * 0.15, topDepth: s * 0.15 * 0.75, bottomWidth: s * 0.15 * 0.65, bottomDepth: s * 0.15 * 0.75 * 0.65, topOffset_z: 90, bottomOffset_z: 90 }, sks));
        parts.push(boxShadow(app, 'makeArm', `${p}Forearm`, sp, forearm, [c.eff], 'Connector_Box', { topWidth: s * 0.12, topDepth: s * 0.12 * 0.75, bottomWidth: s * 0.12 * 0.65, bottomDepth: s * 0.12 * 0.75 * 0.65, topOffset_z: 90, bottomOffset_z: 90 }, sks));
        Object.assign(out, { Shadows: parts, ShadowStart: parts[0], ShadowEnds: [parts[parts.length - 1]] });
      }
      if ([2, 5, 7].includes(st) && out.ArmShadow?.Skel) {
        const sb = (out.ArmShadow.Skel as X3DObject[]).filter(e => e.type === 'bone'); out.ShadowEnvelope = [];
        const copyRoll = (divs: X3DObject[] | undefined, under: X3DObject | undefined) => (divs ?? []).map(d => { const n = mkNull(app, d.name, under ?? sp, d.globalMatrix(), { color: 805 }); cns(app, n, 'Pose', [d], true); (n as any).UserDataBlob = 'bone'; out.ShadowEnvelope.push(n); return n; });
        copyRoll(out.BicepRoll?.Divisions, sb[0]); out.ShadowForeArmRoll = copyRoll(out.ForeArmRoll?.Divisions, sb[1]);
        Object.assign(out, hideSetup(app, modelOf(sp), [], out.ShadowEnvelope, true));
      }
      out.objs = c.skel;
      Object.assign(out, hideSetup(app, modelOf(parent), out.Hidden, out.Envelope));
      return out;
    },
  });

  // ---------------------------------------------------------------- MakeHand (§3.10)
  app.register({
    name: 'MakeHand', label: 'Make Hand', category: CAT, description: 'Create Rigged Hand',
    args: [{ name: 'HandParent', default: G }, { name: 'FingerGuideCollection', default: G }, { name: 'BladeGuideCollection', default: G }, { name: 'HandGuideCollection', default: G }, { name: 'Prefix', default: '' }, { name: 'FingerBoneType', default: 0 }, { name: 'ShadowType', default: 0 }, { name: 'ShadowParent', default: G }, { name: 'NegativeScale', default: false }],
    execute(app, a) {
      const C = 'makeHand'; const parent = objArg(app, a.HandParent);
      if (!parent) { logError(app, `${C}: argument 0 is invalid`); return undefined; }
      const fingers = objsArg(app, a.FingerGuideCollection), blades = objsArg(app, a.BladeGuideCollection), handG = objsArg(app, a.HandGuideCollection);
      const p = strArg(a.Prefix), ftype = intArg(a.FingerBoneType, 0); let st = intArg(a.ShadowType, 0); const noFingerShadows = st >= 8; if (noFingerShadows) st -= 8;
      const sp = objArg(app, a.ShadowParent) ?? app.scene.root, neg = boolArg(a.NegativeScale, false); const ks = `Upper.${p}_Hand`, sks = `ShadowUpper.Shadow${p}_Hand`;
      if (handG.length < 2) { logError(app, `${C}: argument 3 is invalid`); return undefined; }
      if (neg) logNyaOnce(app, 'MakeHand', 'DuplicateSymmetry rebuild of a negative-scaled hand (drawn through the guides instead)');
      const out: any = { parent, model: modelOf(parent), Prefix: p, FingerType: ftype, CharacterSetName: ks, ShadowCharacterSetName: sks, FingerGuides: fingers, BladeGuides: blades, HandGuides: handG, ShadowType: st, ShadowParent: sp, NegativeScaling: neg, Hidden: [], Envelope: [], markers: [], blades: [], foundKeyWords: [], Finger: [], positions: [], FingerShadows: [], FingerRoots: [], Shadows: [], ShadowEnds: [] };
      const hand = drawChain(app, parent, handG.slice(0, 2).map(wpos), null, 1, { root: `${p}HandRoot`, bones: [`${p}Hand`], eff: `${p}HandEffector` });
      Object.assign(out, { handRoot: handG[0], handEnd: handG[1], bone: hand.bones[0], Root: hand.root, skel: hand.skel, Eff: hand.eff, mirrorPlane: null });
      out.Hidden.push(hand.root, hand.eff); out.Envelope.push(hand.bones[0]); markingSet(app, hand.bones[0], false, true, '', ks);
      let scale = 1; const chains: Chain[] = [];
      fingers.forEach((g, fi) => {
        const m = /^(.*?)(\d+)$/.exec(g.name); const base = m ? m[1] : g.name; const start = m ? Number(m[2]) : 0;
        const joints = [g]; const owner = g.model ?? g.parentObj; for (let k = start + 1; ; k++) { const d = owner ? [...owner.descendants()].find(o => o.name === base + k) : null; if (!d) break; joints.push(d); }
        if (joints.length < 2) { logInfo(app, `Not enought guide elements found to make finger for guide: ${g.name}`); return; }
        const kw = base.startsWith(p) ? base.slice(p.length) : base; out.foundKeyWords.push(kw); out.markers.push(joints);
        const bl = blades[fi]; let normal: Vec | null = null;
        const cd = bl?.primitive?.curve(); if (bl && cd && cd.cvs.length >= 2) { const M = bl.globalMatrix(); const a0 = v3(cd.cvs[0][0], cd.cvs[0][1], cd.cvs[0][2]).applyMatrix4(M), a1 = v3(cd.cvs[1][0], cd.cvs[1][1], cd.cvs[1][2]).applyMatrix4(M); normal = a1.sub(a0).negate(); out.blades.push(bl); }
        const pts = joints.map(wpos); out.positions.push(pts);
        const c = drawChain(app, hand.bones[0], pts, normal, 3, { root: `${p}${kw}Root`, bones: pts.slice(1).map((_, i) => `${p}${kw}${i + 1}`), eff: `${p}${kw}Effector` });
        if (ftype === 1) c.bones.forEach((b, i) => { setP(b, 'chntype', i === 0 ? 2 : 0); setP(b, 'prefrotx', 0); setP(b, 'prefroty', 0); setP(b, 'prefrotz', 3); });
        scale = (4 * pts[0].distanceTo(pts[1])) / Math.max(1, fingers.length);   // shipped: the sum is overwritten each loop (last finger only)
        chains.push(c); out.Finger.push(c.skel); out.FingerRoots.push(c.root); out.Hidden.push(c.root, c.eff); out.Envelope.push(...c.bones);
        for (const b of c.bones) markingSet(app, b, false, true, '', ks);
      });
      for (const c of chains) setChainScale(c, scale); setChainScale(hand, scale * 2); out.scale = scale;
      const claw = implicitObj(app, `${hand.bones[0].name}_grab`, 'Cube', hand.bones[0], hand.eff.globalMatrix(), scale); markingSet(app, claw, false, true, '', ks); out.Claw = claw;
      for (const k of ['posx', 'posy', 'posz', 'rotx', 'roty']) expression(app, claw, k, '0', 0);
      const fingerBones = chains.flatMap(c => c.bones);
      for (const b of fingerBones) neutralPose(app, b);
      if (fingerBones.length) { const op = scriptOp(app, C, 'RIG_grabOp', claw, [claw, ...fingerBones], { Direction: -1 }); op.name = 'grabOp'; (op as any).outputs = fingerBones.map(b => `${b.fullName}.kine.local.pcrotz`); logNyaOnce(app, 'MakeHand', 'the rotz fcurve each finger bone gets (its keys are not stated)'); }
      if (st >= 1 && st <= 3) {
        const hsC = app.run('MakeShadowChain', { Chain: hand.skel, ShadowParent: sp, SI3DStyleChain: st === 1, IconScale: scale * 2, ShadowType: st === 3 ? 1 : 0, ShadowCharacterSetName: sks }); out.HandShadow = hsC;
        const handEnd: X3DObject = hsC?.ShadowEnds?.[0] ?? sp;
        if (!noFingerShadows) for (const c of chains) { const fs = app.run('MakeShadowChain', { Chain: c.skel, ShadowParent: handEnd, SI3DStyleChain: st === 1, IconScale: scale, ShadowType: st === 3 ? 1 : 0, ShadowCharacterSetName: sks }); out.FingerShadows.push(fs); }
        Object.assign(out, { ShadowStart: hsC?.ShadowStart ?? null, Shadows: [...(hsC?.Shadows ?? []), ...out.FingerShadows.flatMap((f: any) => f?.Shadows ?? [])], ShadowEnds: hsC?.ShadowEnds ?? [] });
      } else if (st > 3) {
        const hb = boxShadow(app, 'makeHand', `${p}Hand`, sp, hand.bones[0], [hand.eff], 'Connector_Box', { topWidth: scale * 2, topDepth: scale * 2 * 0.3, bottomWidth: scale * 2, bottomDepth: scale * 2 * 0.3, topOffset_z: 90, bottomOffset_z: 90, split: true }, sks);
        const fbs: X3DObject[] = []; if (!noFingerShadows) for (const c of chains) { let taper = 0.6; c.bones.forEach((b, i) => { fbs.push(boxShadow(app, 'makeHand', b.name, hb, b, [c.skel[i + 2] ?? c.eff], 'Connector_Box', { topWidth: scale * taper, topDepth: scale * taper, bottomWidth: scale * taper * 0.8, bottomDepth: scale * taper * 0.8, topOffset_z: 90, bottomOffset_z: 90 }, sks)); taper *= 0.8; }); }
        Object.assign(out, { HandShadow: hb, FingerShadows: fbs, ShadowStart: hb, Shadows: [hb, ...fbs], ShadowEnds: [hb] });
      }
      const sliders = customProp(app, hand.root, `${p}hand_sliders`); chains.forEach((c, fi) => c.bones.forEach((b, i) => addProxy(sliders, b.kinematics.local.get('rotz')!, `${out.foundKeyWords[fi]}${i + 1}`)));
      const env = [hand.bones[0], ...fingerBones]; const vals = (extra: number) => env.flatMap(b => ['rotx', 'roty', 'rotz'].map(k => ({ obj: b, p: k, v: b.kinematics.local.val(k) + (k === 'rotz' && fingerBones.includes(b as any) ? extra : 0) })));
      storePose(app, 'MakeHand', hand.root, `${p}Hand_Spread`, vals(0)); storePose(app, 'MakeHand', hand.root, `${p}Hand_Relaxed`, vals(20)); storePose(app, 'MakeHand', hand.root, `${p}Hand_Fist`, vals(60));
      Object.assign(out, hideSetup(app, out.model, out.Hidden, out.Envelope));
      return out;
    },
  });

  // ---------------------------------------------------------------- MakeLeg (§3.11)
  app.register({
    name: 'MakeLeg', label: 'Make Leg', category: CAT, description: 'Create Rigged Leg',
    args: [{ name: 'Model', default: G }, { name: 'Parent', default: G }, { name: 'Prefix', default: '' }, { name: 'GuideObjectCollection', default: G }, { name: 'UpVectorBehindLeg', default: false }, { name: 'NbThighDivisions', default: 3 }, { name: 'ShadowType', default: 0 }, { name: 'ShadowParent', default: G }],
    execute(app, a) {
      const parent = objArg(app, a.Parent); const guides = objsArg(app, a.GuideObjectCollection);
      if (!parent) { logError(app, 'makeLeg: argument 1 is invalid'); return undefined; }
      if (guides.length !== 3) { logInfo(app, `makeLeg: Guide collection needs 3 objects. Collection has ${guides.length} objects`); return undefined; }
      const model = objArg(app, a.Model), p = strArg(a.Prefix), behind = boolArg(a.UpVectorBehindLeg, false), nt = intArg(a.NbThighDivisions, 3), st = intArg(a.ShadowType, 0), sp = objArg(app, a.ShadowParent) ?? app.scene.root;
      const ks = `Lower.${p}_Leg`, sks = `ShadowLower.Shadow${p}_Leg`; const P = guides.map(wpos); const s = P[0].distanceTo(P[2]);
      const out: any = { model, parent, prefix: p, upVBehind: behind, CharacterSetName: ks, ShadowCharacterSetName: sks, guides, ThighDivisions: nt, ShadowType: st, ShadowParent: sp, Hidden: [], Envelope: [], pos: P, scale: s, Shadows: [], ShadowEnds: [], ShadowHidden: [], ShadowEnvelope: [] };
      const c = drawChain(app, parent, P, v3(0, 0, 0), 3, { root: `${p}Root`, bones: [`${p}Thigh`, `${p}Shin`], eff: `${p}legEff` });
      const [thigh, shin] = c.bones; setP(thigh, 'pref_relRoot', 1); setP(thigh, 'prefaxisx', 1); setP(thigh, 'prefaxisy', 0); setP(thigh, 'prefaxisz', 0);
      setChainScale(c, s * 0.15); setP(c.eff, 'shadow_icon', 4); setP(c.eff, 'shadow_scaleX', s * 0.18); setP(c.eff, 'radius', s * 0.18); setP(c.eff, 'shadow_scaleZ', s * 0.09); colorChain(c, 489);
      setP(shin, 'prefrotx', 0); setP(shin, 'prefroty', 0); setP(shin, 'prefrotz', 3);
      out.Hidden.push(c.root, c.eff); out.Envelope.push(thigh, shin); markingSet(app, thigh, false, true, '', ks); markingSet(app, shin, false, true, '', ks);
      const upPos = P[0].clone().add(v3(0, 0, behind ? -s : s));
      const upv = rigIcon(app, 'makeLeg', c.root, 4, upPos, [s * 0.1, s * 0.1, s * 0.1], 253, `${p}legUpV`)!; neutralPose(app, upv); markingSet(app, upv, true, false, '', 'None');
      const roll = projectedRoll(P[0], P[1], P[2], upPos) + 180; setP(thigh, 'roll', roll); upVector(app, thigh, upv);
      const pushBack = P[1].clone().sub(P[0].clone().lerp(P[2], 0.5));
      Object.assign(out, { Root: c.root, Skel: c.skel, Eff: c.eff, pushBack, knee: P[1], normal: new THREE.Vector3().crossVectors(P[1].clone().sub(P[0]), P[2].clone().sub(P[1])).normalize(), vecBack: pushBack.clone().normalize(), proj_knee: pushBack, proj_upv: upPos.clone().sub(P[0]), roll, upVpos: upPos, upV: upv });
      if (nt > 0) { out.ThighRoll = app.run('MakeBicepRoll', { Bicep: thigh, Prefix: `${p}Thigh`, NbDivisions: nt }); if (out.ThighRoll) out.Envelope.splice(out.Envelope.indexOf(thigh), 1, ...out.ThighRoll.Divisions); }
      if (st >= 1 && st <= 3) {
        const sc = app.run('MakeShadowChain', { Chain: c.skel, ShadowParent: sp, SI3DStyleChain: st === 1, IconScale: s * 0.15, ShadowType: st === 3 ? 1 : 0, ShadowCharacterSetName: sks });
        if (sc) Object.assign(out, { LegShadow: sc, ShadowStart: sc.ShadowStart, Shadows: sc.Shadows, ShadowEnds: sc.ShadowEnds });
        if (nt > 0 && sc?.Skel) { const sb = (sc.Skel as X3DObject[]).filter(e => e.type === 'bone'); for (const d of out.ThighRoll?.Divisions ?? []) { const n = mkNull(app, d.name, sb[0], d.globalMatrix(), { color: 805 }); cns(app, n, 'Pose', [d], true); (n as any).UserDataBlob = 'bone'; out.ShadowEnvelope.push(n); } hideSetup(app, modelOf(sp), [], out.ShadowEnvelope, true); }
      } else if (st > 3) {
        const spin = sideSign(p) < 0 ? 45 : -45; const parts: X3DObject[] = [];
        parts.push(boxShadow(app, 'makeLeg', `${p}Thigh`, sp, thigh, [shin], 'Connector_Box', { topWidth: s * 0.15, topDepth: s * 0.15 * 0.75, bottomWidth: s * 0.15 * 0.65, bottomDepth: s * 0.15 * 0.75 * 0.65, topOffset_x: spin, topOffset_z: 90, bottomOffset_z: 90, split: !(nt > 0) }, sks));
        parts.push(boxShadow(app, 'makeLeg', `${p}Foreleg`, parts[0], shin, [c.eff], 'Connector_Box', { topWidth: s * 0.12, topDepth: s * 0.12 * 0.75, bottomWidth: s * 0.12 * 0.65, bottomDepth: s * 0.12 * 0.75 * 0.65, topOffset_z: 90, bottomOffset_z: 90 }, sks));
        Object.assign(out, { Shadows: parts, ShadowStart: parts[0], ShadowEnds: [parts[1]] });
      }
      Object.assign(out, hideSetup(app, modelOf(parent), out.Hidden, out.Envelope));
      return out;
    },
  });

  // ---------------------------------------------------------------- MakeFoot (§3.12)
  app.register({
    name: 'MakeFoot', label: 'Make Foot', category: CAT, description: 'Create Rigged Foot',
    args: [{ name: 'Model', default: G }, { name: 'Parent', default: G }, { name: 'ShortPrefix', default: '' }, { name: 'FullPrefix', default: '' }, { name: 'GuideObjectCollection', default: G }, { name: 'Sliders', default: G }, { name: 'Extension', default: false }, { name: 'ShadowType', default: 0 }, { name: 'ShadowParent', default: G }, { name: 'ThreeBoneToe', default: true }],
    execute(app, a) {
      const C = 'makeFoot'; const model = objArg(app, a.Model); const parent = objArg(app, a.Parent) ?? app.scene.root; let guides = objsArg(app, a.GuideObjectCollection);
      if (!model) { logError(app, `${C}: required argument 0 is invalid`); return undefined; }
      if (guides.length < 6) { logError(app, `${C}: required argument 4 is invalid`); return undefined; }
      let p = strArg(a.ShortPrefix), full = strArg(a.FullPrefix);
      if (!p) { const v = runDialog(app, 'MakeFoot', 'Foot_Maker', [str('ShortPrefix', 'BL', 'Short Prefix'), str('FullPrefix', 'BLeft', 'Long Prefix')]); if (!v) return undefined; p = String(v.ShortPrefix); full = String(v.FullPrefix); }
      const three = boolArg(a.ThreeBoneToe, true); if (!three) guides = guides.slice(0, -1);
      const ext = boolArg(a.Extension, false), st = intArg(a.ShadowType, 0), sp = objArg(app, a.ShadowParent) ?? app.scene.root; const ks = `Lower.${p}_Leg`, sks = `ShadowLower.Shadow${p}_Leg`;
      const piv = guides.slice(0, 3).map(wpos); const toes = guides.slice(3).map(wpos); const s = toes[0].distanceTo(toes[Math.min(2, toes.length - 1)]) / 1.25;
      const out: any = { model, makeExtension: ext, prefix: p, fullPrefix: full, CharacterSetName: ks, ShadowCharacterSetName: sks, Parent: parent, guideObjs: guides, ShadowType: st, ShadowParent: sp, FootPos: toes, pivots: piv, Envelope: [], Hidden: [], scale: s, Shadows: [], ShadowEnds: [] };
      const c = drawChain(app, null, toes, v3(1, 0, 0), 3, { root: `${p}FootRoot`, bones: toes.slice(1).map((_, i) => `${p}FootBone${i + 1}`), eff: `${p}FootEff` });
      reparent(app, c.root, parent); c.bones.forEach((b, i) => setP(b, 'chntype', i === 0 ? 2 : 0)); setChainScale(c, s, 0.3, 0.6);
      out.Hidden.push(c.root, c.eff); out.Envelope.push(...c.bones); for (const b of c.bones) markingSet(app, b, false, true, '', ks);
      const fwd = toes[toes.length - 1].clone().sub(toes[0]).setY(0); const F = (pp: Vec) => frame(pp, fwd.lengthSq() > 1e-12 ? fwd : v3(0, 0, 1), v3(0, 1, 0));   // inferred: controls oriented along the foot
      const box = (name: string, par: X3DObject, at: Vec, l: [number, number, number], col: number) => { const o = rigIcon(app, C, par, 3, v3(), l, col, name)!; setGlobal(o, F(at)); return o; };
      const foot = box(`${full}Foot`, parent, piv[0], [0.7 * s, 2 * s, 2 * s], 253);
      const tip = box(`${full}Tip`, foot, toes[toes.length - 1], [0.4 * s, 0.4 * s, 0.4 * s], 250);
      const roll = box(`${full}Roll`, tip, toes[Math.min(1, toes.length - 1)], [0.6 * s, 1.2 * s, 1.2 * s], 770);
      const extension = ext ? box(`${full}Extension`, tip, toes[0], [0.7 * s, 1.6 * s, 1.6 * s], 746) : null;
      markingSet(app, foot, true, true, '', ks); markingSet(app, tip, true, true, '', ks); markingSet(app, roll, false, true, '', ks); if (extension) markingSet(app, extension, false, true, '', ks);
      const toeOffsets: X3DObject[] = [], bindSquares: X3DObject[] = [];
      const gn = (name: string, par: X3DObject, at: Vec) => { const n = mkNull(app, name, par, F(at), { color: 607, size: 0.15 * s }); for (const k of ['rotx', 'roty', 'rotz']) n.kinematics.local.set(k, 0); return n; };
      const pivotBase = gn(`${p}PivotBase`, tip, piv[0]), place_ = gn(`${p}PlacePivot`, tip, piv[0]), pr = gn(`${p}PivotRight`, tip, piv[1]), pl = gn(`${p}PivotLeft`, tip, piv[2]);
      const footGuides: X3DObject[] = []; let gp: X3DObject = pivotBase;
      for (let i = toes.length - 1, k = 1; i >= 0; i--, k++) { const g = mkNull(app, `${p}FootGuide${k}`, gp, F(toes[i]), { color: 607, size: 0.15 * s }); footGuides.push(g); gp = g; }
      let bp: X3DObject = c.root;
      c.bones.forEach((b, i) => {
        if (i === 0) return;
        const bind = rigIcon(app, C, bp === c.root ? footGuides[footGuides.length - 1 - i] ?? pivotBase : bp, 1, wpos(b), [0.3 * s, 0.3 * s, 0.3 * s], 730, `${p}FootBind${i}`)!; bindSquares.push(bind); out.Hidden.push(bind);
        const fg = footGuides[footGuides.length - 1 - i]; if (fg) expression(app, bind, 'rotx', `-${fg.fullName}.kine.local.rotx`, -fg.kinematics.local.val('rotx'));
        cns(app, b, 'Position', [bind]);
        const off = rigIcon(app, C, bind, 3, wpos(b), [0.25 * s, 0.25 * s, 0.25 * s], 107, `${p}ToeOffset${i}`)!; toeOffsets.push(off); markingSet(app, off, false, true, '', ks);
        for (const k of ['posx', 'posy', 'posz']) expression(app, off, k, '0', 0);
        bp = off;
      });
      const toeGuide = three
        ? scriptOp(app, C, 'ToeGuide', pivotBase, [pivotBase, ...footGuides.slice(0, 3), roll, pl, pr, place_], { R1: 15, R2: 20, R3: 30 })
        : scriptOp(app, C, 'RIG_twoBoneToes', pivotBase, [roll, pl, pr, place_], {});
      if (!three) (toeGuide as any).outputs = [`${pivotBase.fullName}.kine.local`, ...footGuides.slice(0, 2).map(g => `${g.fullName}.kine.local.rotx`)];
      c.bones.forEach((b, i) => { const u = mkNull(app, `${p}FootUpV${i + 1}`, foot, translation(wpos(b).add(v3(0, -0.5 * s, 0))), { color: 507, size: 0.1 * s }); out.Hidden.push(u); upVector(app, b, u); });
      if (st >= 1 && st <= 3) {
        const sc = app.run('MakeShadowChain', { Chain: c.skel, ShadowParent: sp, SI3DStyleChain: st === 1, IconScale: s * 0.6, ShadowType: st === 3 ? 1 : 0, ShadowCharacterSetName: sks });
        if (sc) Object.assign(out, { ArmShadow: sc, ShadowStart: sc.ShadowStart, Shadows: sc.Shadows, ShadowEnds: sc.ShadowEnds });
      } else if (st > 3) {
        const parts = [boxShadow(app, C, c.bones[0].name, sp, c.bones[0], [c.skel[2]], 'Connector_L', { topWidth: s * 0.8, topDepth: s * 0.8 * 0.8, topOffset_x: 60, topOffset_z: 90, bottomOffset_z: 90 }, sks)];
        c.bones.slice(1).forEach((b, i) => parts.push(boxShadow(app, C, b.name, parts[parts.length - 1], b, [c.skel[i + 3]], 'Connector_Box', { topWidth: s * 0.8, topDepth: s * 0.8 * 0.6, bottomWidth: s * 0.8 * 0.8, bottomDepth: s * 0.8 * 0.6 * 0.8, topOffset_z: 90, bottomOffset_z: 90 }, sks)));
        Object.assign(out, { Shadows: parts, ShadowStart: parts[0], ShadowEnds: [parts[parts.length - 1]] });
      }
      let sliders = nodeArg(app, a.Sliders) as Property | null; if (!sliders) sliders = customProp(app, model.model ?? model, `${p}FootRoll_Controls`);
      if (three) { addProxy(sliders, toeGuide.get('R1')!, `${p}_Foot Roll 1`); addProxy(sliders, toeGuide.get('R2')!, `${p}_Foot Roll 2`); }
      Object.assign(out, { sliderPage: sliders, Root: c.root, Skel: c.skel, eff: c.eff, Foot: foot, Tip: tip, Roll: roll, Extension: extension, toeOffsets, bindSquares, PivotBase: pivotBase, PlacePivot: place_, PivotRight: pr, PivotLeft: pl, FootGuides: footGuides, lastGuide: footGuides[footGuides.length - 1], toeGuide, lastOffset: toeOffsets[toeOffsets.length - 1] ?? null, FootEff: c.eff, BaseGuide: footGuides[footGuides.length - 1] });
      Object.assign(out, hideSetup(app, modelOf(parent), out.Hidden, out.Envelope));
      return out;
    },
  });

  // ---------------------------------------------------------------- MakeDogLeg (§3.13)
  app.register({
    name: 'MakeDogLeg', label: 'Make Dog Leg', category: CAT, description: 'Create Dog Leg Rig',
    args: [{ name: 'Model', default: G }, { name: 'Parent', default: G }, { name: 'FootParent', default: G }, { name: 'GuideObjectCollection', default: G }, { name: 'ShortPrefix', default: '' }, { name: 'FullPrefix', default: '' }, { name: 'Sliders', default: G }, { name: 'NbThighDivisions', default: 3 }, { name: 'ShadowType', default: 0 }, { name: 'ShadowParent', default: G }],
    execute(app, a) {
      const C = 'makeDogLeg'; const model = objArg(app, a.Model), parent = objArg(app, a.Parent), footParent = objArg(app, a.FootParent); const guides = objsArg(app, a.GuideObjectCollection);
      let bad = false; [model, parent, footParent].forEach((o, i) => { if (!o) { logError(app, `${C}: required argument ${i} is invalid`); bad = true; } });
      if (!bad && guides.length < 9) { logError(app, `${C}: required argument 3 is invalid`); bad = true; }
      if (bad) return undefined;
      let p = strArg(a.ShortPrefix), full = strArg(a.FullPrefix);
      if (!p) { const v = runDialog(app, 'MakeDogLeg', 'Dog_Leg_Maker', [str('ShortPrefix', 'BL', 'Short Prefix'), str('FullPrefix', 'BLeft', 'Long Prefix')]); if (!v) return undefined; p = String(v.ShortPrefix); full = String(v.FullPrefix); }
      const nt = intArg(a.NbThighDivisions, 3); let st = intArg(a.ShadowType, 0); const sp = objArg(app, a.ShadowParent) ?? app.scene.root;
      let footSt = st; if (st === 6 || st === 7) { st = 1; footSt = 4; }
      const ks = `Lower.${p}_Leg`, sks = `ShadowLower.Shadow${p}_Leg`; const P = guides.slice(0, 3).map(wpos); const toe0 = wpos(guides[6]); const s = P[0].distanceTo(toe0);
      const out: any = { model, prefix: p, fullPrefix: full, CharacterSetName: ks, ShadowCharacterSetName: sks, Hidden: [], Envelope: [], parent, FootAttachPoint: footParent, guides, ThighDivisions: nt, ShadowParent: sp, ShadowType: st, FootShadowType: footSt, pos: P, objs: guides.slice(0, 3), footObjs: guides.slice(3), scale: s, Shadows: [], ShadowEnds: [] };
      const c = drawChain(app, parent, [...P, toe0], null, 3, { root: `${p}LegRoot`, bones: [`${p}Femur`, `${p}Tibia`, `${p}Metarsal`], eff: `${p}LegEff` });
      setChainScale(c, s, 0.07, 0.1); const [femur, tibia, meta] = c.bones; out.Hidden.push(c.root, c.eff); out.Envelope.push(...c.bones); for (const b of c.bones) markingSet(app, b, false, true, '', ks);
      const upParent = mkNull(app, `${p}UpVectorParent`, c.root, c.root.globalMatrix()); out.Hidden.push(upParent);
      const upPos = P[0].clone().add(v3(0, 0, -s)); const upv = rigIcon(app, C, upParent, 4, upPos, [s * 0.1, s * 0.1, s * 0.1], 253, `${p}UpVector`)!; markingSet(app, upv, true, false, '', 'None');
      const knee = mkNull(app, `${p}kneeGuide`, c.root, translation(P[1]), { color: 607, size: s * 0.02 }), tarsus = mkNull(app, `${p}tarsusGuide`, c.root, translation(P[2]), { color: 607, size: s * 0.02 });
      Object.assign(out, { Root: c.root, Skel: c.skel, eff: c.eff, upPos, UpVec: upv, upParent, Knee: knee, Tarsus: tarsus });
      if (st >= 1 && st <= 3) {
        const sc = app.run('MakeShadowChain', { Chain: c.skel, ShadowParent: sp, SI3DStyleChain: st === 1, IconScale: s * 0.15, ShadowType: st === 3 ? 1 : 0, ShadowCharacterSetName: sks });
        if (sc) Object.assign(out, { ArmShadow: sc, ShadowStart: sc.ShadowStart, Shadows: [...sc.Shadows], ShadowEnds: sc.ShadowEnds });
      } else if (st > 3) {
        const spin = sideSign(p) < 0 ? 45 : -45; const parts: X3DObject[] = [];
        parts.push(boxShadow(app, C, `${p}Thigh`, sp, femur, [tibia], 'Connector_Box', { topWidth: s * 0.15, topDepth: s * 0.15 * 0.75, bottomWidth: s * 0.15 * 0.8, bottomDepth: s * 0.15 * 0.75 * 0.8, topOffset_x: spin, topOffset_z: 90, bottomOffset_z: 90 }, sks));
        parts.push(boxShadow(app, C, `${p}Tibia`, parts[0], tibia, [meta], 'Connector_Box', { topWidth: s * 0.12, topDepth: s * 0.12 * 0.75, bottomWidth: s * 0.12 * 0.8, bottomDepth: s * 0.12 * 0.75 * 0.8, topOffset_z: 90, bottomOffset_z: 90 }, sks));
        parts.push(boxShadow(app, C, `${p}Metarsal`, parts[1], meta, [c.eff], 'Connector_Box', { topWidth: s * 0.1, topDepth: s * 0.1 * 0.75, bottomWidth: s * 0.1 * 0.8, bottomDepth: s * 0.1 * 0.75 * 0.8, topOffset_z: 90, bottomOffset_z: 90 }, sks));
        Object.assign(out, { Shadows: parts, ShadowStart: parts[0], ShadowEnds: [parts[2]] });
      }
      // the foot: two-bone toes (MakeFoot called without ThreeBoneToe), Extension created
      const foot = app.run('MakeFoot', { Model: model, Parent: footParent, ShortPrefix: p, FullPrefix: full, GuideObjectCollection: guides.slice(3), Sliders: nodeArg(app, a.Sliders), Extension: true, ShadowType: footSt, ShadowParent: out.ShadowEnds?.[0] ?? sp, ThreeBoneToe: false });
      out.Foot = foot;
      if (foot) {
        reparent(app, foot.Root, c.eff); cns(app, tibia, 'Position', [knee]); cns(app, meta, 'Position', [tarsus]); cns(app, c.eff, 'Position', [foot.BaseGuide]);
        const l1 = boneLength(femur), l2 = boneLength(tibia), l3 = boneLength(meta);
        const roll = projectedRoll(P[0], P[1], P[2], upPos), second = projectedRoll(P[1], P[2], toe0, upPos);
        out.dogLeg = scriptOp(app, C, 'DogLeg', c.root, [knee, tarsus, upv, c.root, foot.BaseGuide, foot.Extension], { length1: l1, length2: l2, length3: l3, initial_percentage: P[1].distanceTo(toe0) / (l2 + l3), roll, secondRoll: second, lock_percentage: 0.97 });
        upVector(app, femur, upv);
        const metaP = wpos(meta), footP = wpos(foot.Foot); const baseNull = mkNull(app, 'baseNull', foot.Foot, translation(metaP.clone().add(metaP.clone().sub(footP).multiplyScalar(2))));
        const lastUp = mkNull(app, 'lastboneUpV', foot.Foot, translation(wpos(baseNull).lerp(upPos, 0.5))); cns(app, lastUp, '2 Points', [baseNull, upv]); upVector(app, meta, lastUp); out.Hidden.push(baseNull, lastUp);
        out.FootControl = foot.Foot;
        let sliders = nodeArg(app, a.Sliders) as Property | null; if (!sliders) sliders = customProp(app, c.root.model ?? c.root, `${p}DogLeg_Controls`);
        const lp = addProxy(sliders, out.dogLeg.get('lock_percentage'), `${p}_lock percentage`); lp.def.min = 0.001; lp.def.max = 1; out.sliderPage = sliders;
      }
      if (nt > 0) out.ThighRoll = app.run('MakeBicepRoll', { Bicep: femur, Prefix: `${p}Thigh`, NbDivisions: nt });
      Object.assign(out, hideSetup(app, modelOf(parent), out.Hidden, out.Envelope));
      return out;
    },
  });

  // ---------------------------------------------------------------- MakeHead (§3.14)
  app.register({
    name: 'MakeHead', label: 'Make Head', category: CAT, description: 'Create Rigged Head and Neck',
    args: [{ name: 'Parent', default: G }, { name: 'GuideObjectCollection', default: G }, { name: 'Prefix', default: '' }, { name: 'AssemblyType', default: 0 }, { name: 'HeadType', default: 0 }, { name: 'NbDivisions', default: 3 }, { name: 'StretchType', default: 0 }, { name: 'Sliders', default: G }, { name: 'EarGuideCollection', default: G }, { name: 'ShadowType', default: 0 }, { name: 'ShadowParent', default: G }],
    execute(app, a) {
      const C = 'makeHead'; const parent = objArg(app, a.Parent); const guides = objsArg(app, a.GuideObjectCollection);
      if (guides.length !== 3) { logError(app, `${C}: guide collection (argument 1) needs 3 objects. Contains ${guides.length} objects`); return undefined; }
      if (!parent) { logError(app, `${C}: required argument 0 is invalid`); return undefined; }
      const p = strArg(a.Prefix), asm = intArg(a.AssemblyType, 0), htype = intArg(a.HeadType, 0); let nbd = intArg(a.NbDivisions, 3); if (nbd === 0) nbd = 2;
      const stretch = intArg(a.StretchType, 0), sliders = nodeArg(app, a.Sliders), ears = objsArg(app, a.EarGuideCollection), st = intArg(a.ShadowType, 0), sp = objArg(app, a.ShadowParent) ?? app.scene.root;
      const ks = `Upper.${p}Head_Neck`, sks = `ShadowUpper.Shadow${p}Head_Neck`;
      const owner = guides[2].model ?? guides[2].parentObj;
      const headDups = duplicates(owner, guides[2].name), jawDups = duplicates(owner, guides[1].name);
      const pts = [...guides, ...headDups].map(wpos); const scale = pts[0].distanceTo(pts[pts.length - 1]);
      const out: any = { parent, guides, prefix: p, CharacterSetName: ks, ShadowCharacterSetName: sks, ShadowType: st, ShadowParent: sp, Type: htype, Ears: ears, inNbDivisions: nbd, Stretch: stretch, Sliders: sliders, AssemblyType: asm, Hidden: [], Envelope: [], pos: pts, objs: [...guides, ...headDups], JawPos: jawDups.map(wpos), JawObjs: jawDups, scale, EarChains: [], Shadows: [], ShadowEnds: [] };
      let headBone: X3DObject | null = null;
      if (asm === 0) {
        const nb = pts.length - 1; const names = Array.from({ length: nb }, (_, i) => (i === nb - 1 ? 'Head' : 'Neck'));
        const c = drawChain(app, parent, pts, v3(0, 1, 0), 3, { root: `${p}HeadRoot`, bones: names.map(n => p + n), eff: `${p}HeadEff` });
        setChainScale(c, scale * 0.3); setP(c.bones[0], 'chntype', 2); for (const b of c.bones) markingSet(app, b, false, true, '', ks);
        out.Hidden.push(c.root, c.eff); out.Envelope.push(...c.bones); headBone = c.bones[c.bones.length - 1];
        Object.assign(out, { Root: c.root, Skel: c.skel, Head: headBone, normalPlane: v3(0, 1, 0) });
        if (st >= 1 && st <= 3) { const sc = app.run('MakeShadowChain', { Chain: c.skel, ShadowParent: sp, SI3DStyleChain: st === 1, IconScale: scale * 0.3, ShadowType: st === 3 ? 1 : 0, ShadowCharacterSetName: sks }); if (sc) Object.assign(out, { HeadShadow: sc, ShadowStart: sc.ShadowStart, ShadowEnds: sc.ShadowEnds, Shadows: [...sc.Shadows] }); }
      } else {
        const span = pts[2].distanceTo(pts[pts.length - 1]) || scale * 0.3; out.HeadScale = span;
        const head = rigIcon(app, C, parent, 3, pts[2], [span, span, span], 253, `${p}Head`)!; markingSet(app, head, true, true, '', ks); headBone = head;
        const neckBase = mkNull(app, `${p}NeckBase`, parent, translation(pts[0]), { color: 484 });
        const bdP = pts.length >= 4 ? pts[1] : pts[0].clone().lerp(pts[1], 0.25), tdP = pts.length >= 4 ? pts[2] : pts[1].clone().lerp(pts[2], 0.25);   // inferred reading of "25% along the L-shaped guide"
        const bd = mkNull(app, `${p}BaseDepth`, neckBase, translation(bdP), { color: 770 }), td = mkNull(app, `${p}TopDepth`, head, translation(tdP), { color: 253 });
        markingSet(app, bd, true, false, '', ks); markingSet(app, td, true, false, '', ks);
        const spine = app.run('MakeSpine', { Model: null, Parent: neckBase, NbVertebrae: nbd, SpineType: 1, Stretchy: !!stretch, SpineBaseObject: neckBase, SpineTopObject: head, BottomDepthObject: bd, TopDepthObject: td, ChestTop: null, Sliders: sliders, ShadowType: st, ShadowParent: sp, VertebraeName: 'NeckVertebra', CharacterSetName: ks, ShadowCharacterSetName: sks });
        Object.assign(out, { Head: head, NeckBase: neckBase, BaseDepth: bd, TopDepth: td, Spine: spine, ShadowStart: spine?.ShadowStart, ShadowEnds: spine?.ShadowEnds ?? [], Shadows: [...(spine?.Shadows ?? [])] });
      }
      for (const e of ears) { const chain = [e, ...duplicates(e.model ?? e.parentObj, e.name.replace(/\d+$/, '')).filter(x => x !== e)]; if (chain.length >= 2) { logNya(app, 'MakeHead', 'ears: MakeTail (the tail builder is outside this row, note §4 Q3)'); out.EarChains.push(null); } }
      if (jawDups.length >= 2 && headBone) {
        logNyaOnce(app, 'MakeHead', 'jaw chain plane normal (unset in the shipped script; the plane of the jaw guides is used)');
        const jc = drawChain(app, headBone, [pts[1], ...jawDups.map(wpos)], null, 3, { root: `${p}JawRoot`, bones: jawDups.map(() => `${p}JawNeck`), eff: `${p}JawEff` });
        setChainScale(jc, scale * 0.3); for (const b of jc.bones) markingSet(app, b, false, true, '', ks); out.Hidden.push(jc.root, jc.eff); out.Envelope.push(...jc.bones);
        Object.assign(out, { JawRoot: jc.root, JawSkel: jc.skel });
        if (st >= 1 && st <= 3) out.JawShadow = app.run('MakeShadowChain', { Chain: jc.skel, ShadowParent: out.ShadowEnds?.[0] ?? sp, SI3DStyleChain: st === 1, IconScale: scale * 0.3, ShadowType: st === 3 ? 1 : 0, ShadowCharacterSetName: sks });
      }
      if (st > 3 && asm === 0 && out.Skel) {
        const bones = (out.Skel as X3DObject[]).filter(e => e.type === 'bone'); const parts: X3DObject[] = []; let par: X3DObject = sp;
        bones.slice(0, -1).forEach((b, i) => { const bx = boxShadow(app, C, `${p}Neck`, par, b, [out.Skel[i + 2]], 'Connector_Box', { topWidth: scale * 0.3, topDepth: scale * 0.3 * 0.8, bottomWidth: scale * 0.3, bottomDepth: scale * 0.3 * 0.8, topOffset_z: 90, bottomOffset_z: 90 }, sks); parts.push(bx); par = bx; });
        const hb = boxShadow(app, C, `${p}Head`, par, bones[bones.length - 1], [], 'Connector_Head', { topWidth: scale * 0.5, topDepth: scale * 0.5, quadruped: htype === 1 }, sks); parts.push(hb);
        Object.assign(out, { HeadShadow: hb, Shadows: parts, ShadowStart: parts[0], ShadowEnds: [hb] });
      }
      Object.assign(out, hideSetup(app, modelOf(parent), out.Hidden, out.Envelope));
      return out;
    },
  });
}
