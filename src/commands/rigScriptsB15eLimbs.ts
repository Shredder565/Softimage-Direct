// Ledger row CMD-B15e: component builders (note sections 3.7-3.14): MakeSpine, MakeTorso, MakeArm, MakeHand, MakeLeg,
// MakeFoot, MakeDogLeg, MakeHead. Original code from the note's prose; stand-in model in rigScriptsB15eKit.ts.
// Not attested (logged where reached): MakeTail (outside the row: tails / ear chains are not built), exact roll and
// normal-plane maths (recorded as parameters), mirroring of negatively scaled sides (positions come from the guides).
import { App } from '../core/commands';
import { curveLength, sampleCurve } from '../core/curves';
import {
  THREE, X3DObject, v3, gpos, dist, setP, setPs, setColor, setVisible, setGlobalPos, reparent, neutralPose, mkNull, mkCurve, mkChain, mkImplicit, mkBox,
  circlePts, applyOp, constrain, customProp, hideSetup, markingSet, link, setChainScale, logError, logInfo, logWarn, logNya, dialogStandIn,
  numArg, intArg, boolArg, objOf, collOf, bad, unset, Skel, num, guideLookup, nodeOf,
} from './rigScriptsB15eKit';
import { hipIconParams, makeRigIcon, makeBicepRoll, makeForearmRoll, makeShadowChain, makeShadowSpine } from './rigScriptsB15eLeaf';

const str0 = (v: any, d = '') => (unset(v) ? d : String(v));
const len = (b: X3DObject) => Number(b.val('length') ?? 1);

// ------------------------------------------------------------------ shared pieces
export interface Sh { Shadows: X3DObject[]; ShadowStart: X3DObject | null; ShadowEnds: X3DObject[]; ShadowHidden: X3DObject[]; ShadowEnvelope: X3DObject[] }
const noShadow = (): Sh => ({ Shadows: [], ShadowStart: null, ShadowEnds: [], ShadowHidden: [], ShadowEnvelope: [] });
export interface BoxSpec { name: string; start: X3DObject; end?: X3DObject; connector?: string; split?: boolean; spin?: number }
/** Box shadow: a Cube named after the part, Pose-constrained to its start object, with a Connector_* operator (inferred names/values from section 2). */
export function boxShadows(app: App, boxes: BoxSpec[], parent: X3DObject, width: number, taper: number, depthK: number, cs: string): X3DObject[] {
  const out: X3DObject[] = [];
  for (const b of boxes) {
    const mid = b.end ? gpos(b.start).lerp(gpos(b.end), 0.5) : gpos(b.start);
    const box = mkBox(app, b.name, parent, mid, width); constrain(app, box, 'Pose', [b.start], { compensation: false });
    const op = applyOp(app, box, b.connector ?? 'Connector_Box', { topWidth: width, topDepth: width * depthK, bottomWidth: width * taper, bottomDepth: width * depthK * taper, topOffset_z: 90, bottomOffset_z: 90, split: !!b.split, ...(b.spin ? { topOffset_x: b.spin } : {}) }, [b.start, b.end]);
    void op; setP(box, 'phong_diffuse', '0.741,0.653,0.603'); setP(box, 'phong_ambient', '0.845,0.496,0.300');
    markingSet(app, box, false, true, '', cs); out.push(box);
  }
  return out;
}
/** Shadow of a chain: 1-3 skeleton / null (MakeShadowChain, null flag = type 3), > 3 boxes, 0 none. */
export function shadowOf(app: App, src: X3DObject[], type: number, parent: X3DObject | null, scale: number, cs: string, boxes: BoxSpec[], width: number, taper: number, depthK: number): Sh {
  if (type <= 0 || !parent) return noShadow();
  if (type <= 3) {
    const r = makeShadowChain(app, { Chain: src, ShadowParent: parent, SI3DStyleChain: type === 1, IconScale: scale, ShadowType: type === 3 ? 1 : 0, ShadowCharacterSetName: cs });
    return r ? { Shadows: r.Shadows, ShadowStart: r.ShadowStart, ShadowEnds: r.ShadowEnds, ShadowHidden: r.Hidden, ShadowEnvelope: r.Envelope } : noShadow();
  }
  const bx = boxShadows(app, boxes, parent, width, taper, depthK, cs);
  return { Shadows: bx, ShadowStart: bx[0] ?? null, ShadowEnds: bx.slice(-1), ShadowHidden: [], ShadowEnvelope: bx };
}
const rollAngle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, up: THREE.Vector3): number => {   // projected mid-joint angle about the a->c axis (degrees)
  const ax = c.clone().sub(a).normalize(); const v = b.clone().sub(a); v.sub(ax.clone().multiplyScalar(v.dot(ax)));
  const u = up.clone().sub(ax.clone().multiplyScalar(up.dot(ax)));
  if (v.lengthSq() < 1e-12 || u.lengthSq() < 1e-12) return 0;
  const ang = v.angleTo(u); const sign = new THREE.Vector3().crossVectors(u, v).dot(ax) < 0 ? -1 : 1; return (sign * ang * 180) / Math.PI;
};
const jointAngle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => (a.clone().sub(b).angleTo(c.clone().sub(b)) * 180) / Math.PI;
const hand = (o: any) => (o && o.bones ? o : null);

// ------------------------------------------------------------------ 3.8 MakeSpine
export function makeSpine(app: App, a: Record<string, any>) {
  const model = objOf(app, a.Model), parent = objOf(app, a.Parent), base = objOf(app, a.SpineBaseObject), top = objOf(app, a.SpineTopObject), bd = objOf(app, a.BottomDepthObject), td = objOf(app, a.TopDepthObject);
  let ok = true; [[model, 0], [parent, 1], [base, 5], [top, 6], [bd, 7], [td, 8]].forEach(([x, i]) => { if (!x) { logError(app, `makeSpine: argument ${i} is invalid`); ok = false; } });
  if (!ok) return undefined;
  const nb = intArg(a.NbVertebrae, 3), type = intArg(a.SpineType, 0), stretchy = boolArg(a.Stretchy, false); const chestTop = objOf(app, a.ChestTop);
  let sliders = nodeOf(app, a.Sliders) as any; const shType = intArg(a.ShadowType, 1); const shParent = objOf(app, a.ShadowParent);
  const vname = str0(a.VertebraeName, 'Vertebra') || 'Vertebra', cs = str0(a.CharacterSetName), scs = str0(a.ShadowCharacterSetName);
  const P = parent!;
  const bp = gpos(base!), tp = gpos(top!);
  const curve = mkCurve(app, 'spinecurve', null, [bp, gpos(bd!), gpos(td!), tp], { degree: 3 });   // created at the scene root, length read, then parented
  const crv = (curve.primitive!.operators[0] as any).data; const length = curveLength(crv);
  reparent(curve, P); if (type !== 2) setColor(curve, 49);
  const out: Record<string, any> = { nb, parent: P, stretch: stretchy, Type: type, vertebraName: vname, CharacterSetName: cs, ShadowCharacterSetName: scs, ShadowType: shType, ShadowParent: shParent, base, top, baseDepth: bd, topDepth: td, chestTop, pos: [bp, gpos(bd!), gpos(td!), tp], length, Curve: curve, ShadowCurve: null, Root: null, Skel: [], Eff: null, TopVertebra: null, Vertebra: [], scaleSlider: null, volumeSlider: null, CurveOp: null, ShadowCurveOp: null, vertDist: length / Math.max(1, nb), boneIcon: null, pathCns: null, lengthOp: null, ShadowSpine: null, Shadows: [], ShadowStart: null, ShadowEnds: [] };
  let hidden: X3DObject[] = [], env: X3DObject[] = []; const sampleAt = (t: number) => { const q = sampleCurve(crv, 101)[Math.round(t * 100)]; return v3(q[0], q[1], q[2]); };
  if (type === 2) {   // skeleton spine
    const pts = sampleCurve(crv, nb + 1).map(q => v3(q[0], q[1], q[2])); if (chestTop) pts.push(gpos(chestTop));
    const names = ['SpineEff', ...Array.from({ length: pts.length - 1 }, (_, i) => `Lumbar${i + 1}`), 'SpineRoot'];   // (sic) root SpineEff, effector SpineRoot
    const sk = mkChain(app, names, pts, P, { type: 2 }); setChainScale(sk, length * 0.4);
    sk.bones.forEach(b => markingSet(app, b, false, true, '', cs)); out.Root = sk.root; out.Skel = sk.all; out.Eff = sk.eff; out.Vertebra = sk.all.slice(2);
    hidden = [sk.root, sk.eff]; env = sk.bones.slice(); P.removeChild(curve);   // the curve is deleted
    if (shType >= 1 && shType <= 3 && shParent) { const sh = makeShadowChain(app, { Chain: sk.all, ShadowParent: shParent, SI3DStyleChain: shType === 1, IconScale: length * 0.4, ShadowType: shType === 3 ? 1 : 0, ShadowCharacterSetName: scs }); if (sh) { out.Shadows = sh.Shadows; out.ShadowStart = sh.ShadowStart; out.ShadowEnds = sh.ShadowEnds; out.ShadowSpine = sh; } }
  } else {
    const holder: any = sliders && !(sliders instanceof X3DObject) ? sliders : customProp(app, curve, 'Spine_Control');   // given page, or a new Spine_Control on the curve
    const ss = holder.add(num('spine_scale', 1, 'spine_scale', { min: 0.01, max: 10000, uimin: 0.01, uimax: 10 })), vs = holder.add(num('volume_factor', 0, 'volume_factor', { min: -10000, max: 10000, uimin: 0, uimax: 10 }));
    out.sliders = holder; out.scaleSlider = ss; out.volumeSlider = vs;
    if (!stretchy) { out.CurveOp = applyOp(app, curve, 'SpineCurve', { lgoal: length, lScale: 1 }, [curve, base, bd, td, top]); }
    else for (let i = 0; i < 4; i++) applyOp(app, curve, 'ClusterCenter', { point: i }, [[base, bd, td, top][i]]);
    // top vertebra
    let tv: X3DObject;
    if (chestTop) {
      tv = mkCurve(app, 'ChestBone', P, circlePts(0.5, 12), { degree: 1, closed: true, color: 253 }); setGlobalPos(tv, tp);
      const lp = gpos(chestTop).sub(tp); applyOp(app, tv, 'chestBone', { width: 0.4, depth: 0.4, tip_height: 0.15, upx: 1, top_pointx: lp.x, top_pointy: lp.y, top_pointz: lp.z });
      out.boneIcon = tv;
    } else tv = mkImplicit(app, 'TopVertebra', curve, 'Cube', tp, (length / Math.max(1, nb)) * 0.5);
    const pc = constrain(app, tv, 'Path', [curve], { perc: 100, tangent: true, upvector: true, dirx: 0, diry: 1, dirz: 0, upx: 0, upy: 0, upz: -1, pointatx: 0, pointaty: 0, pointatz: -1, locked: true }); out.pathCns = pc;
    if (!stretchy) out.lengthOp = applyOp(app, tv, 'FixedLength', { init_length: length, lScale: 1 }, [curve]); else { setP(tv, 'perc', 100); setP(tv, 'spine_scale_expression', 'distance(top, base) / length'); }
    setP(tv, 'scale_xz_expression', 'spine_scale ^ (-volume_factor)');
    out.TopVertebra = tv; applyOp(app, tv, 'SpinePointAt', { slider: 0 }, [tv, tv, base]);
    const verts: X3DObject[] = [];
    for (let i = 0; i < nb; i++) {
      const f = (i + 1) / (nb + 1); const v = mkImplicit(app, vname, curve, 'Cube', sampleAt(f), (length / Math.max(1, nb)) * 0.5); if (type === 0) setP(v, 'polygon_vertebra', true);
      constrain(app, v, 'Path', [curve], { perc: 100 * f, tangent: true, upvector: true, locked: true }); applyOp(app, v, 'SpinePointAt', { slider: 1 - f }, [v, tv, base]);
      setP(v, 'scale_xz_expression', 'spine_scale ^ (-volume_factor)'); markingSet(app, v, false, true, '', cs); verts.push(v);
    }
    markingSet(app, tv, false, true, '', cs);
    out.Vertebra = verts; env = [...verts, tv]; hidden = [curve];
    if (shType >= 1 && shType <= 3 && shParent) {
      const sc = mkCurve(app, 'shadowspinecurve', null, [bp, gpos(bd!), gpos(td!), tp], { degree: 3 }); reparent(sc, shParent); out.ShadowCurve = sc;
      if (!stretchy) out.ShadowCurveOp = applyOp(app, sc, 'SpineCurve', { lgoal: length, lScale: 1, linked_to_main: true }, [sc, base, bd, td, top]);
      const sh = makeShadowSpine(app, { Spline: sc, Base: base, Vertebra: verts, TopVertebra: tv, ShadowParent: shParent, ChestTop: chestTop, IconScale: length * 0.4, ShadowType: shType, ShadowCharacterSetName: scs });
      if (sh) { out.ShadowSpine = sh; out.Shadows = sh.Shadows; out.ShadowStart = sh.ShadowStart; out.ShadowEnds = sh.ShadowEnds;
        if (stretchy) for (const b of sh.Shadows) applyOp(app, b, 'RIG_stretchVertebraOp', { length_by_percentage: true }, [b, sc]); }
    } else if (shType > 3 && shParent) {
      const pts = [base!, ...verts, tv]; const bx = boxShadows(app, pts.slice(0, -1).map((s, i) => ({ name: `Lumbar${i + 1}`, start: s, end: pts[i + 1], connector: 'Connector_Box' })), shParent, length * 0.3, 1, 0.75, scs);
      for (const b of bx) setP(b.primitive!.operators.slice(-1)[0] as any, 'invert', true);
      out.Shadows = bx; out.ShadowStart = bx[0] ?? null; out.ShadowEnds = bx.slice(-1);
    }
  }
  const h = hideSetup(app, P.model, hidden, env);
  Object.assign(out, { Envelope: env, Hidden: hidden }, h);
  return out;
}

// ------------------------------------------------------------------ 3.7 MakeTorso
export function makeTorso(app: App, a: Record<string, any>) {
  const parent = objOf(app, a.Parent); const gs = collOf(app, a.GuideObjectCollection);
  if (!parent) { logError(app, 'makeTorso: required argument 0 is invalid'); return undefined; }
  if (gs.length !== 10 && gs.length !== 11) { logError(app, `makeTorso: guide collection (argument 1) needs 10 or 11 objects. Contains ${gs.length} objects`); return undefined; }
  const nb = intArg(a.NbDivisions, 3), stretch = intArg(a.StretchType, 0), ctrlType = intArg(a.ControlType, 0), spineType = intArg(a.SpineType, 0), shType = intArg(a.ShadowType, 0), neg = intArg(a.NegativeScale, 0);
  const sliders = nodeOf(app, a.Sliders); const shParent = objOf(app, a.ShadowParent) ?? app.scene.root;
  const [gBase, gHipD, gChestD, gEnd, gLLeg, gLSS, gLSE, gRLeg, gRSS, gRSE] = gs; const chestGuide = gs[10] ?? null;
  const scale = dist(gBase, gEnd) / 1.25;
  const legMid = gpos(gLLeg).lerp(gpos(gRLeg), 0.5); const hipPos = legMid.clone().lerp(gpos(gBase), 0.6);
  const model = parent.model; const cube = ctrlType === 1; const csU = 'Upper.Torso', csL = 'Lower', scs = 'ShadowUpper.ShadowTorso';
  // controls
  const ctl = (name: string, par: X3DObject, at: THREE.Vector3, k: number, color: number, key: string, pose: boolean, posrot = true) => {
    const o = makeRigIcon(app, { Parent: par, Type: cube ? 3 : 1, X: at.x, Y: at.y, Z: at.z, Xlength: k * scale, Ylength: k * scale, Zlength: k * scale, Color: color, Name: name })!;
    setGlobalPos(o, at); if (pose) neutralPose(o); markingSet(app, o, posrot, posrot, '', key); return o;
  };
  const plate = mkCurve(app, 'HipPlate', parent, circlePts(0.5 * scale, 16), { degree: 1, closed: true, color: 49 }); setGlobalPos(plate, hipPos);
  const lp = (g: X3DObject) => gpos(g).sub(hipPos);
  applyOp(app, plate, 'HipIcon', hipIconParams(lp(gBase), lp(gLLeg)));
  const spineStart = mkNull(app, 'SpineStart', parent, gBase, 0.2); setVisible(spineStart, false);
  const upperBody = ctl('UpperBody', parent, hipPos, cube ? 0.8 : 2, 253, 'Upper', true);
  const hip = ctl('Hip', upperBody, hipPos, cube ? 0.6 : 1.5, 770, 'Lower', false);
  const chestPos = gpos(chestGuide ?? gEnd);
  const chest = ctl('Chest', upperBody, chestPos, cube ? 0.8 : 2, 253, 'Upper', true);
  const spineEnd = mkNull(app, 'SpineEnd', chest, gEnd, 0.2);
  reparent(plate, hip);
  const hipDepth = mkNull(app, 'HipDepth', hip, gHipD, 0.3, 770), chestDepth = mkNull(app, 'ChestDepth', chest, gChestD, 0.3, 253);
  markingSet(app, hipDepth, true, false, '', csL); markingSet(app, chestDepth, true, false, '', csU);
  const sp = makeSpine(app, { Model: model, Parent: plate, NbVertebrae: nb, SpineType: spineType, Stretchy: stretch === 1, SpineBaseObject: spineStart, SpineTopObject: spineEnd, BottomDepthObject: hipDepth, TopDepthObject: chestDepth, ChestTop: chestGuide, Sliders: sliders, ShadowType: shType, ShadowParent: shParent, VertebraeName: 'SpineVertebra', CharacterSetName: csU, ShadowCharacterSetName: scs });
  if (spineType === 2) { reparent(plate, upperBody); for (const o of [hip, chest]) o.parentObj?.removeChild(o); }   // skeleton spine: Hip and Chest are deleted
  const topV = (sp?.TopVertebra ?? sp?.Skel?.[sp.Skel.length - 1] ?? spineEnd) as X3DObject;
  // shoulders
  const sh = (s: string, g1: X3DObject, g2: X3DObject, negScaled: boolean) => {
    const sk = mkChain(app, [`${s}ShoulderRoot`, `${s}Shoulder`, `${s}ShoulderEff`], [gpos(g1), gpos(g2)], topV, { type: 3, color: 489, normal: v3(0, 1, 0) });
    setChainScale(sk, scale, 0.2, 0.3); sk.bones.forEach(b => markingSet(app, b, false, true, '', csU)); setP(sk.root, 'mirrored', negScaled); return sk;
  };
  const rSk = sh('R', gRSS, gRSE, neg === 1), lSk = sh('L', gLSS, gLSE, neg === 2);
  // shadows
  let shadows: X3DObject[] = [], shStart: X3DObject | null = null, shEnds: X3DObject[] = [], rShadow: Sh = noShadow(), lShadow: Sh = noShadow(), chestMarker: any = null, sideMarker: any = null, bottomMarker: any = null;
  if (shType >= 1 && shType <= 3) {
    const sub = mkNull(app, 'UpperBody', shParent, hipPos, 0.5 * scale, 805); constrain(app, sub, 'Pose', [spineType === 2 ? upperBody : hip]); markingSet(app, sub, false, true, '', scs);
    shStart = sub; shadows.push(sub);
    rShadow = shadowOf(app, rSk.all, shType, sub, scale * 0.3, scs, [], 0, 0, 0); lShadow = shadowOf(app, lSk.all, shType, sub, scale * 0.3, scs, [], 0, 0, 0);
    shEnds = [sp?.ShadowEnds?.[0] ?? sub, rShadow.ShadowEnds[0], lShadow.ShadowEnds[0]].filter(Boolean) as X3DObject[]; shadows.push(...rShadow.Shadows, ...lShadow.Shadows);
  } else if (shType > 3) {
    const ch = boxShadows(app, [{ name: 'Chest', start: chest, connector: 'Connector_T' }, { name: 'UpperBody', start: upperBody, connector: 'Connector_T', split: true }], shParent, scale * 1.5, 1, 0.6, scs);
    chestMarker = mkNull(app, 'ChestMarker', ch[0], null, 0.1); sideMarker = mkNull(app, 'SideMarker', ch[1], null, 0.1); bottomMarker = mkNull(app, 'BottomMarker', ch[1], null, 0.1);
    const rb = boxShadows(app, [{ name: 'RShoulder', start: rSk.bones[0], end: rSk.eff, spin: 45 }], shParent, scale * 0.3, 0.65, 0.75, scs), lb = boxShadows(app, [{ name: 'LShoulder', start: lSk.bones[0], end: lSk.eff, spin: -45 }], shParent, scale * 0.3, 0.65, 0.75, scs);
    shadows = [...ch, ...rb, ...lb]; shStart = ch[1]; shEnds = [ch[0], rb[0], lb[0]];
  }
  // tail from numbered duplicates of the spine-base guide
  const gl = guideLookup(gBase.parentObj); const dups = gl.dups(gBase.name.replace(/\d+$/, ''));
  let tail: any = null;
  if (dups.length >= 3) logNya(app, 'MakeTorso', `MakeTail (not in this row): ${dups.length} tail guides found, no tail chain built`);
  else if (dups.length >= 1) logWarn(app, 'MakeTorso: Not enough guide points to generate a tail: 3 or more guide objects are needed.');
  const hidden = [spineStart, spineEnd, rSk.root, lSk.root]; const env = [...rSk.bones, ...lSk.bones];
  const hg = hideSetup(app, model, hidden, env);
  return { parent, nb, stretch, ribCage: chestGuide, controlType: ctrlType, NegativeScaling: neg, CharacterSetName: csU, ShadowCharacterSetName: scs, Hidden: hidden, Envelope: env, ShadowType: shType, SpineType: spineType, ShadowParent: shParent, guides: gs, model, sliders, pos: gpos(gBase), lpos: gpos(gLLeg), rpos: gpos(gRLeg), torsoObjs: gs.slice(0, 10), TailObjs: dups, TailPos: dups.map(gpos), scale, HipPos: hipPos, BaseTrans: gpos(gBase), TopTrans: gpos(gEnd), HipBone: plate, spineStart, UpperBody: upperBody, Hip: hip, Chest: chest, spineEnd, HipDepth: hipDepth, ChestDepth: chestDepth, Spine: sp, rroot: rSk.root, lroot: lSk.root, RSkel: rSk.all, LSkel: lSk.all, REff: rSk.eff, LEff: lSk.eff, ShadowStart: shStart, ShadowEnds: shEnds, Shadows: shadows, RSkelShadow: rShadow.Shadows, LSkelShadow: lShadow.Shadows, ChestMarker: chestMarker, SideMarker: sideMarker, BottomMarker: bottomMarker, Tail: tail, HiddenGroup: hg.HiddenGroup, envGroup: hg.envGroup,
    ChestBone: sp?.boneIcon ?? sp?.TopVertebra ?? ((sp?.Skel?.length ?? 0) > 1 ? sp!.Skel[sp!.Skel.length - 2] : null) ?? chest };
}

// ------------------------------------------------------------------ 3.9 MakeArm
export function makeArm(app: App, a: Record<string, any>) {
  const parent = objOf(app, a.ArmParent); const gs = collOf(app, a.GuideObjectCollection);
  if (!parent) { logInfo(app, 'makeArm: argument 0 is invalid'); return undefined; }
  if (gs.length !== 3) { logInfo(app, `makeArm: Guide collection needs 3 objects. Collection has ${gs.length} objects`); return undefined; }
  const p = str0(a.Prefix), cns = objOf(app, a.ArmRootConstrainingObj), nf = intArg(a.NbForearmDivisions, 0), nbic = intArg(a.NbBicepDivisions, 0), shType = intArg(a.ShadowType, 0); const shParent = objOf(app, a.ShadowParent);
  const handRoot = objOf(app, a.HandRoot) as any, neg = boolArg(a.NegativeScale, false);
  const cs = `Upper.${p}_Arm`, scs = `ShadowUpper.Shadow${p}_Arm`; const pts = gs.map(gpos); const scale = pts[0].distanceTo(pts[2]);
  const sk = mkChain(app, [`${p}Root`, `${p}Bicep`, `${p}Forearm`, `${p}ArmEff`], pts, parent, { type: 3, color: 489, normal: v3(0, 1, 0) });
  setChainScale(sk, scale * 0.15); setPs(sk.eff, { shadow_icon: 4, radius: scale * 0.18 });
  const [bicep, fore] = sk.bones; if (cns) constrain(app, sk.root, 'Position', [cns]);
  sk.bones.forEach(b => markingSet(app, b, false, true, '', cs)); markingSet(app, sk.eff, true, false, '', 'None');
  const upPos = pts[0].clone().add(v3(0, 0, -scale));
  const upV = makeRigIcon(app, { Parent: sk.root, Type: 4, X: upPos.x, Y: upPos.y, Z: upPos.z, Xlength: scale * 0.1, Ylength: scale * 0.1, Zlength: scale * 0.1, Color: 253, Name: `${p}ArmUpV` })!; setGlobalPos(upV, upPos); neutralPose(upV); markingSet(app, upV, true, false, '', 'None');
  let roll = rollAngle(pts[0], pts[1], pts[2], v3(0, 0, -1)); if (pts[0].x < 0) roll = -roll; if (neg) roll = -roll; if (jointAngle(pts[0], pts[1], pts[2]) < 90) roll += 180;
  setP(bicep, 'roll', roll); link(bicep, 'UpVectorReference', upV);
  let bRoll: any = null, fRoll: any = null; let env: X3DObject[] = [bicep, fore];
  if (nbic > 0) { bRoll = makeBicepRoll(app, { Bicep: bicep, Prefix: `${p}Bicep`, NbDivisions: nbic }); if (bRoll) { for (const d of bRoll.Divisions) setP(d, 'size', scale * 0.05); env = [...bRoll.Divisions, fore]; } }
  if (nf > 0) {
    const hr = hand(handRoot); if (hr) { const dirx = pts[2].x - pts[0].x; fRoll = makeForearmRoll(app, { Bicep: bicep, Forearm: fore, ArmEff: sk.eff, HandEff: hr.effector, HandBone: hr.bones[0], Prefix: p, NbDivisions: nf, RollOffset: dirx >= 0 ? 90 : -90 }); }
    else logNya(app, 'makeArm', 'forearm roll divisions need a HandRoot chain element (HandRoot not given)');
  }
  const boxes: BoxSpec[] = [];
  if (nbic > 0 && bRoll) bRoll.Divisions.forEach((d: X3DObject, i: number) => boxes.push({ name: `${p}Bicep`, start: d, end: bRoll.Divisions[i + 1] ?? fore })); else boxes.push({ name: `${p}Bicep`, start: bicep, end: fore, split: true });
  if (fRoll) fRoll.Divisions.forEach((d: X3DObject, i: number) => boxes.push({ name: `${p}Forearm`, start: d, end: fRoll.Divisions[i + 1] ?? sk.eff })); else boxes.push({ name: `${p}Forearm`, start: fore, end: sk.eff });
  const shadow = shadowOf(app, sk.all, shType, shParent, scale * 0.15, scs, boxes, scale * 0.15, 0.65, 0.6);
  const shEnv: X3DObject[] = [...shadow.ShadowEnvelope];
  if ((shType === 2 || shType === 5 || shType === 7) && (bRoll || fRoll) && shParent) {
    for (const d of [...(bRoll?.Divisions ?? []), ...(fRoll?.Divisions ?? [])]) { const n = mkNull(app, d.name, shParent, d, 0.3, 805); constrain(app, n, 'Pose', [d]); setP(n, 'UserDataBlob', 'bone'); shEnv.push(n); }
    hideSetup(app, shParent.model, [], shEnv.slice(shadow.ShadowEnvelope.length), true);
  }
  const h = hideSetup(app, parent.model, [sk.root], env);
  return { parent, guides: gs, prefix: p, constrainObj: cns, NegativeScaling: neg, ForearmDivisions: nf, BicepDivisions: nbic, ShadowType: shType, ShadowParent: shParent, HandRoot: handRoot, Hidden: [sk.root], Envelope: env, CharacterSetName: cs, ShadowCharacterSetName: scs, pos: pts, objs: gs, scale, pushBack: null, normalPlane: v3(0, 1, 0), Root: sk.root, Skel: sk.all, Eff: sk.all[3], elbow: pts[1], normal: v3(0, 1, 0), vecBack: null, roll, UpVpos: upPos, UpVParent: sk.root, UpV: upV, BicepRoll: bRoll, ForeArmRoll: fRoll, ShadowEnvelope: shEnv, ArmShadow: shadow.Shadows, ShadowStart: shadow.ShadowStart, Shadows: shadow.Shadows, ShadowEnds: shadow.ShadowEnds, ShadowForeArmRoll: null, HiddenGroup: h.HiddenGroup, envGroup: h.envGroup };
}

// ------------------------------------------------------------------ 3.10 MakeHand
export function makeHand(app: App, a: Record<string, any>) {
  const parent = objOf(app, a.HandParent); if (!parent) { logInfo(app, 'makeHand: argument 0 is invalid'); return undefined; }
  const fg = collOf(app, a.FingerGuideCollection), bg = collOf(app, a.BladeGuideCollection), hg = collOf(app, a.HandGuideCollection); const p = str0(a.Prefix), ftype = intArg(a.FingerBoneType, 0);
  let st = intArg(a.ShadowType, 0); const noFingers = st >= 8; if (noFingers) st -= 8; const shParent = objOf(app, a.ShadowParent); const neg = boolArg(a.NegativeScale, false);
  const cs = `Upper.${p}_Hand`, scs = `ShadowUpper.Shadow${p}_Hand`; const model = parent.model;
  if (hg.length < 2) { logInfo(app, 'makeHand: argument 3 is invalid'); return undefined; }
  const hs = mkChain(app, [`${p}HandRoot`, `${p}Hand`, `${p}HandEffector`], [gpos(hg[0]), gpos(hg[1])], parent, { type: 1, color: 489 });
  const hbone = hs.bones[0]; markingSet(app, hbone, false, true, '', cs);
  const fingers: Skel[] = [], fnames: string[] = [], roots: X3DObject[] = []; let lastSeg = 1; const found: string[] = [];
  fg.forEach((g, fi) => {
    const base = g.name.replace(/\d+$/, ''); const gl = guideLookup(g.parentObj); const joints = [g, ...gl.dups(base).filter(d => d !== g && Number(d.name.slice(base.length)) > 1)];
    if (joints.length < 2) { logInfo(app, `Not enought guide elements found to make finger for guide: ${g.name}`); return; }
    const kw = base.startsWith(p) ? base.slice(p.length) : base; found.push(kw);
    const names = [`${p}${kw}Root`, ...joints.slice(0, -1).map((_, i) => `${p}${kw}${i + 1}`), `${p}${kw}Effector`];
    const sk = mkChain(app, names, joints.map(gpos), hbone, { type: ftype === 1 ? 2 : 3, color: 489, normal: bg[fi] ? v3(0, 1, 0) : v3(0, 1, 0) });
    if (ftype === 1) sk.bones.forEach((b, i) => { setP(b, 'chntype', i === 0 ? 2 : 0); setPs(b, { prefrotx: 0, prefroty: 0, prefrotz: 3 }); });
    lastSeg = dist(joints[0], joints[1]); fingers.push(sk); fnames.push(kw); roots.push(sk.root);
  });
  const scale = fingers.length ? (4 * lastSeg) / fingers.length : 1;   // the sum is overwritten each loop: only the last finger counts
  for (const sk of fingers) setChainScale(sk, scale);
  setChainScale(hs, scale * 2);
  const claw = mkImplicit(app, `${hbone.name}_grab`, hbone, 'Cube', gpos(hs.eff), scale); markingSet(app, claw, false, true, '', cs);
  const fcurves: X3DObject[] = [];
  for (const sk of fingers) for (const b of sk.bones) { neutralPose(b); setP(b, 'rotz_fcurve', true); fcurves.push(b); applyOp(app, b, 'RIG_grabOp', { Direction: -1 }, [claw, b]); const op = (b as any).rigOps?.slice(-1)[0]; if (op) op.name = 'grabOp'; for (const ax of ['posx', 'posy', 'posz', 'rotx', 'roty']) { const pr = b.kinematics.local.get(ax); if (pr && (ax.startsWith('pos') || ax.startsWith('rot'))) pr.value = ax.startsWith('pos') ? pr.value : pr.value; } }
  const sl = customProp(app, hs.root, `${p}hand_sliders`); fingers.forEach((sk, fi) => sk.bones.forEach((b, i) => { const pr = sl.add(num(`${fnames[fi]}${i + 1}`, b.kinematics.local.val('rotz'), `${fnames[fi]}${i + 1}`, { keyable: true })); (pr as any).proxied = b.kinematics.local.get('rotz'); }));
  const poses: Record<string, number[]> = {}; const allB = fingers.flatMap(f => f.bones);
  const snap = () => allB.map(b => ['x', 'y', 'z'].map(ax => b.kinematics.local.val('rot' + ax))).flat();
  poses[`${p}Hand_Spread`] = snap(); for (const b of allB) b.kinematics.local.set('rotz', b.kinematics.local.val('rotz') + 20); poses[`${p}Hand_Relaxed`] = snap();
  for (const b of allB) b.kinematics.local.set('rotz', b.kinematics.local.val('rotz') + 40); poses[`${p}Hand_Fist`] = snap();
  allB.forEach((b, i) => b.kinematics.local.set('rotz', poses[`${p}Hand_Spread`][i * 3 + 2]));   // applies the spread action
  (hs.root as any).poseActions = poses; logNya(app, 'makeHand', 'StoreAction of the hand poses (kept as stored value lists on the hand root)');
  // shadows
  const boxes: BoxSpec[] = [{ name: `${p}Hand`, start: hbone, end: hs.eff, split: true }];
  const hShadow = shadowOf(app, hs.all, st, shParent, scale, scs, boxes, scale * 0.3, 1, 0.6); const fShadows: Sh[] = [];
  if (!noFingers) for (const sk of fingers) fShadows.push(shadowOf(app, sk.all, st, hShadow.ShadowStart ?? shParent, scale * 0.5, scs, sk.bones.map((b, i) => ({ name: b.name, start: b, end: sk.bones[i + 1] ?? sk.eff })), scale * 0.15, 0.6, 0.6));
  const hidden = [hs.root, ...roots, hs.eff, ...fingers.map(f => f.eff)]; const env = [hbone, ...allB];
  const h = hideSetup(app, model, hidden, env);
  return { parent, model, Prefix: p, FingerType: ftype, CharacterSetName: cs, ShadowCharacterSetName: scs, FingerGuides: fg, BladeGuides: bg, HandGuides: hg, ShadowType: st, ShadowParent: shParent, NegativeScaling: neg, Hidden: hidden, Envelope: env, markers: [], blades: bg, foundKeyWords: found, handRoot: hg[0], handEnd: hg[1], Finger: fingers.map(f => f.all), positions: hg.map(gpos), mirrorPlane: null, bone: hbone, Root: hs.root, skel: hs.all, Eff: hs.eff, scale, Claw: claw, HandShadow: hShadow.Shadows, FingerShadows: fShadows.map(f => f.Shadows), ShadowStart: hShadow.ShadowStart, Shadows: [...hShadow.Shadows, ...fShadows.flatMap(f => f.Shadows)], ShadowEnds: hShadow.ShadowEnds, FingerRoots: roots, HiddenGroup: h.HiddenGroup, envGroup: h.envGroup, hand_sliders: sl };
}

// ------------------------------------------------------------------ 3.11 MakeLeg
export function makeLeg(app: App, a: Record<string, any>) {
  const model = objOf(app, a.Model), parent = objOf(app, a.Parent); const gs = collOf(app, a.GuideObjectCollection);
  if (!parent) { logError(app, 'makeLeg: argument 1 is invalid'); return undefined; }
  if (gs.length !== 3) { logInfo(app, `makeLeg: Guide collection needs 3 objects. Collection has ${gs.length} objects`); return undefined; }
  const p = str0(a.Prefix), behind = boolArg(a.UpVectorBehindLeg, false), nth = intArg(a.NbThighDivisions, 3), shType = intArg(a.ShadowType, 0); const shParent = objOf(app, a.ShadowParent);
  const cs = `Lower.${p}_Leg`, scs = `ShadowLower.Shadow${p}_Leg`; const pts = gs.map(gpos); const scale = pts[0].distanceTo(pts[2]);
  const sk = mkChain(app, [`${p}Root`, `${p}Thigh`, `${p}Shin`, `${p}legEff`], pts, parent, { type: 3, color: 489, normal: v3(0, 0, 0) });
  setChainScale(sk, scale * 0.15); setPs(sk.eff, { shadow_icon: 4, shadow_scaleX: scale * 0.18, radius: scale * 0.18, shadow_scaleZ: scale * 0.09 });
  const [thigh, shin] = sk.bones; setPs(thigh, { pref_axis_x: 1, pref_axis_y: 0, pref_axis_z: 0 }); setPs(shin, { prefrotx: 0, prefroty: 0, prefrotz: 3 });
  markingSet(app, thigh, false, true, '', cs); markingSet(app, shin, false, true, '', cs); markingSet(app, sk.eff, true, false, '', 'None');
  const upPos = pts[0].clone().add(v3(0, 0, behind ? -scale : scale));
  const upV = makeRigIcon(app, { Parent: sk.root, Type: 4, X: upPos.x, Y: upPos.y, Z: upPos.z, Xlength: scale * 0.1, Ylength: scale * 0.1, Zlength: scale * 0.1, Color: 253, Name: `${p}legUpV` })!; setGlobalPos(upV, upPos); neutralPose(upV); markingSet(app, upV, true, false, '', 'None');
  const roll = rollAngle(pts[0], pts[1], pts[2], upPos.clone().sub(pts[0])) + 180; link(thigh, 'UpVectorReference', upV); setP(thigh, 'roll', roll);
  const tRoll = nth > 0 ? makeBicepRoll(app, { Bicep: thigh, Prefix: `${p}Thigh`, NbDivisions: nth }) : null;
  const boxes: BoxSpec[] = []; const spin = pts[0].x < 0 ? 45 : -45;
  if (tRoll) tRoll.Divisions.forEach((d: X3DObject, i: number) => boxes.push({ name: `${p}Thigh`, start: d, end: tRoll.Divisions[i + 1] ?? shin })); else boxes.push({ name: `${p}Thigh`, start: thigh, end: shin, split: true });
  boxes.push({ name: `${p}Foreleg`, start: shin, end: sk.eff, spin });
  const shadow = shadowOf(app, sk.all, shType, shParent, scale * 0.15, scs, boxes, scale * 0.15, 0.65, 0.6);
  if (tRoll && shParent && shType >= 1) for (const d of tRoll.Divisions) { const n = mkNull(app, d.name, shParent, d, 0.3, 805); constrain(app, n, 'Pose', [d]); setP(n, 'UserDataBlob', 'bone'); }
  const env = tRoll ? [...tRoll.Divisions, shin] : [thigh, shin]; const h = hideSetup(app, (model ?? parent.model), [sk.root, sk.eff], env);
  return { model, parent, prefix: p, upVBehind: behind, CharacterSetName: cs, ShadowCharacterSetName: scs, guides: gs, ThighDivisions: nth, ShadowType: shType, ShadowParent: shParent, Hidden: [sk.root, sk.eff], Envelope: env, pos: pts, scale, Root: sk.root, Skel: sk.all, Eff: sk.all[3], pushBack: null, knee: pts[1], normal: null, vecBack: null, proj_knee: null, proj_upv: null, roll, upVpos: upPos, upV, ThighRoll: tRoll, ShadowEnds: shadow.ShadowEnds, Shadows: shadow.Shadows, ShadowHidden: shadow.ShadowHidden, ShadowEnvelope: shadow.ShadowEnvelope, LegShadow: shadow.Shadows, ShadowStart: shadow.ShadowStart, HiddenGroup: h.HiddenGroup, envGroup: h.envGroup };
}

// ------------------------------------------------------------------ 3.12 MakeFoot
export function makeFoot(app: App, a: Record<string, any>) {
  const model = objOf(app, a.Model); const parentArg = objOf(app, a.Parent); let guides = collOf(app, a.GuideObjectCollection);
  if (!model) { logError(app, 'makeFoot: required argument 0 is invalid'); return undefined; }
  let sp = str0(a.ShortPrefix), fp = str0(a.FullPrefix);
  if (!sp) { dialogStandIn(app, 'Foot_Maker', { ShortPrefix: 'BL', FullPrefix: 'BLeft' }); sp = 'BL'; fp = 'BLeft'; }
  if (guides.length < 6) { logError(app, 'makeFoot: required argument 4 is invalid'); return undefined; }
  const parent = parentArg ?? app.scene.root; const ext = boolArg(a.Extension, false), shType = intArg(a.ShadowType, 0); const shParent = objOf(app, a.ShadowParent); const three = a.ThreeBoneToe === undefined ? false : boolArg(a.ThreeBoneToe, true);   // omitted by a caller (MakeDogLeg / MakeQuadruped) = two-bone toes (WIRE_CORRECTIONS_B15 item 37)
  if (!three) guides = guides.slice(0, -1);   // two-bone toes: the last guide is removed
  const [gMid, gR, gL] = guides; const toes = guides.slice(3); const cs = `Lower.${sp}_Leg`, scs = `ShadowLower.Shadow${sp}_Leg`;
  const scale = dist(toes[0], toes[2]) / 1.25; const names = [`${sp}FootRoot`, ...toes.slice(0, -1).map((_, i) => `${sp}FootBone${i + 1}`), `${sp}FootEff`];
  const sk = mkChain(app, names, toes.map(gpos), parent, { type: 3, color: 489, normal: v3(1, 0, 0) });
  sk.bones.forEach((b, i) => setP(b, 'chntype', i === 0 ? 2 : 0)); setChainScale(sk, scale, 0.6, 0.3);
  const cube = (name: string, par: X3DObject, at: THREE.Vector3, x: number, y: number, z: number, color: number) => makeRigIcon(app, { Parent: par, Type: 3, X: at.x, Y: at.y, Z: at.z, Xlength: x, Ylength: y, Zlength: z, Color: color, Name: name })!;
  const tip0 = gpos(toes[toes.length - 1]);
  const Foot = cube(`${fp}Foot`, parent, gpos(gMid), 0.7 * scale, 2 * scale, 2 * scale, 253); setGlobalPos(Foot, gpos(gMid));
  const Tip = cube(`${fp}Tip`, Foot, tip0, 0.4 * scale, 0.4 * scale, 0.4 * scale, 250); setGlobalPos(Tip, tip0);
  const Roll = cube(`${fp}Roll`, Tip, gpos(gMid), 0.6 * scale, 1.2 * scale, 1.2 * scale, 770); setGlobalPos(Roll, gpos(gMid));
  const Ext = ext ? cube(`${fp}Extension`, Tip, tip0, 0.7 * scale, 1.6 * scale, 1.6 * scale, 746) : null; if (Ext) setGlobalPos(Ext, tip0);
  markingSet(app, Foot, true, true, '', cs); markingSet(app, Tip, true, true, '', cs); markingSet(app, Roll, false, true, '', cs); if (Ext) markingSet(app, Ext, false, true, '', cs);
  const nbones = sk.bones.length; const toeOffsets: X3DObject[] = [], bind: X3DObject[] = [];
  for (let i = 0; i < nbones; i++) {
    const at = gpos(toes[i]); const bs = mkCurve(app, `${sp}FootBind${i + 1}`, parent, circlePts(0.1 * scale, 4), { degree: 1, closed: true, color: 730 }); setGlobalPos(bs, at); setVisible(bs, false); bind.push(bs);
    const to = mkCurve(app, `${sp}ToeOffset${i + 1}`, bs, circlePts(0.1 * scale, 4), { degree: 1, closed: true, color: 107 }); setGlobalPos(to, at); markingSet(app, to, false, true, '', cs); toeOffsets.push(to);
    setPs(to, { posx_expression: '0', posy_expression: '0', posz_expression: '0' }); if (i >= 1) constrain(app, sk.bones[i], 'Position', [bs]);
  }
  const g0 = (n: string, at: THREE.Vector3, par: X3DObject) => mkNull(app, `${sp}${n}`, par, at, 0.15 * scale, 607);
  const PivotBase = g0('PivotBase', gpos(gMid), Tip), PlacePivot = g0('PlacePivot', gpos(gMid), Tip), PivotRight = g0('PivotRight', gpos(gR), Tip), PivotLeft = g0('PivotLeft', gpos(gL), Tip);
  for (const n of [PivotBase, PlacePivot, PivotRight, PivotLeft]) setPs(n.kinematics.local, { rotx: 0, roty: 0, rotz: 0 });
  const fgs: X3DObject[] = []; let par: X3DObject = PivotBase; for (let i = 0; i < toes.length; i++) { const g = g0(`FootGuide${i + 1}`, gpos(toes[toes.length - 1 - i]), par); fgs.push(g); par = g; }
  bind.forEach((bs, i) => setP(bs, 'rotx_expression', `-${fgs[fgs.length - 1 - i]?.name ?? ''}.rotx`));
  const ups: X3DObject[] = sk.bones.map((b, i) => { const u = mkNull(app, `${sp}FootUpV${i + 1}`, b, gpos(b).add(v3(0, 0.2 * scale, 0)), 0.1 * scale, 507); link(b, 'UpVectorReference', u); return u; });
  const op = three ? applyOp(app, PivotBase, 'ToeGuide', { R1: 15, R2: 20, R3: 30 }, [PivotBase, fgs[0], fgs[1], fgs[2], Roll, PivotLeft, PivotRight, PlacePivot])
    : applyOp(app, PivotBase, 'RIG_twoBoneToes', {}, [PivotBase, fgs[0], fgs[1], Roll, PivotLeft, PivotRight, PlacePivot]);
  const sl = nodeOf(app, a.Sliders) as any; const holder: any = sl && !(sl instanceof X3DObject) ? sl : customProp(app, parent.model ?? parent, `${sp}FootRoll_Controls`);
  for (const [i, k] of [[1, 'R1'], [2, 'R2']] as [number, string][]) { const pr = op.get(k); if (!pr) continue; const px = holder.add(num(`${sp}_Foot Roll ${i}`, pr.value, `${sp}_Foot Roll ${i}`, { min: 0, max: 360 })); (px as any).proxied = pr; }
  const boxes: BoxSpec[] = sk.bones.map((b, i) => ({ name: b.name, start: b, end: sk.bones[i + 1] ?? sk.eff, connector: i === 0 ? 'Connector_L' : 'Connector_Box', spin: i === 0 ? 60 : 0 }));
  const shadow = shadowOf(app, sk.all, shType, shParent, scale * 0.6, scs, boxes, scale * 0.3, 0.8, 0.6);
  const hidden = [sk.root, sk.eff, ...bind]; const env = sk.bones.slice(); const h = hideSetup(app, model, hidden, env);
  return { model, makeExtension: ext, prefix: sp, fullPrefix: fp, CharacterSetName: cs, ShadowCharacterSetName: scs, sliderPage: holder, Parent: parent, guideObjs: guides, ShadowType: shType, ShadowParent: shParent, FootPos: toes.map(gpos), pivots: [gMid, gR, gL], Envelope: env, Hidden: hidden, scale, Root: sk.root, Skel: sk.all, eff: sk.eff, Foot, Tip, Roll, Extension: Ext, toeOffsets, bindSquares: bind, PivotBase, PlacePivot, PivotRight, PivotLeft, FootGuides: fgs, lastGuide: fgs[fgs.length - 1], toeGuide: op, lastOffset: toeOffsets[toeOffsets.length - 1], FootEff: sk.eff, ArmShadow: shadow.Shadows, ShadowStart: shadow.ShadowStart, Shadows: shadow.Shadows, ShadowEnds: shadow.ShadowEnds, BaseGuide: fgs[fgs.length - 1], HiddenGroup: h.HiddenGroup, envGroup: h.envGroup, FootUpVectors: ups };
}

// ------------------------------------------------------------------ 3.13 MakeDogLeg
export function makeDogLeg(app: App, a: Record<string, any>) {
  const model = objOf(app, a.Model), parent = objOf(app, a.Parent), footParent = objOf(app, a.FootParent); let gs = collOf(app, a.GuideObjectCollection);
  [[model, 0], [parent, 1], [footParent, 2]].forEach(([x, i]) => { if (!x) logError(app, `makeDogLeg: required argument ${i} is invalid`); });
  if (!model || !parent || !footParent) return undefined;
  let sp = str0(a.ShortPrefix), fp = str0(a.FullPrefix);
  if (!sp) { dialogStandIn(app, 'Dog_Leg_Maker', { ShortPrefix: 'BL', FullPrefix: 'BLeft' }); sp = 'BL'; fp = 'BLeft'; }
  if (gs.length < 9) { logError(app, 'makeDogLeg: required argument 3 is invalid'); return undefined; }
  const nth = intArg(a.NbThighDivisions, 3); let shType = intArg(a.ShadowType, 0); const shParent = objOf(app, a.ShadowParent); let footShadow = shType; if (shType === 6 || shType === 7) { shType = 1; footShadow = 4; } else if (shType >= 4) footShadow = shType;
  const cs = `Lower.${sp}_Leg`, scs = `ShadowLower.Shadow${sp}_Leg`; const [gF, gT, gM] = gs; const toeGuides = gs.slice(3); const toeStart = toeGuides[3];
  const scale = dist(gF, toeStart);
  const sk = mkChain(app, [`${sp}LegRoot`, `${sp}Femur`, `${sp}Tibia`, `${sp}Metarsal`, `${sp}LegEff`], [gpos(gF), gpos(gT), gpos(gM), gpos(toeStart)], parent, { type: 2, color: 489 });
  setChainScale(sk, scale, 0.1, 0.07); setPs(sk.eff, { radius: scale * 0.1 });
  const [femur, tibia, meta] = sk.bones; sk.bones.forEach(b => markingSet(app, b, false, true, '', cs)); markingSet(app, sk.eff, true, false, '', 'None');
  const upPos = gpos(gF).add(v3(0, 0, -scale)); const upParent = mkNull(app, `${sp}UpVectorParent`, sk.root, gpos(gF), 0.1); setVisible(upParent, false);
  const upV = makeRigIcon(app, { Parent: upParent, Type: 4, X: upPos.x, Y: upPos.y, Z: upPos.z, Xlength: scale * 0.1, Ylength: scale * 0.1, Zlength: scale * 0.1, Color: 253, Name: `${sp}UpVector` })!; setGlobalPos(upV, upPos); markingSet(app, upV, true, false, '', 'None');
  const knee = mkNull(app, `${sp}kneeGuide`, sk.root, gT, scale * 0.02, 607), tarsus = mkNull(app, `${sp}tarsusGuide`, sk.root, gM, scale * 0.02, 607);
  const boxes: BoxSpec[] = [{ name: `${sp}Thigh`, start: femur, end: tibia, split: true }, { name: `${sp}Tibia`, start: tibia, end: meta }, { name: `${sp}Metarsal`, start: meta, end: sk.eff, spin: gpos(gF).x < 0 ? 45 : -45 }];
  const shadow = shadowOf(app, sk.all, shType, shParent, scale * 0.15, scs, boxes, scale * 0.15, 0.8, 0.6);
  const foot = makeFoot(app, { Model: model, Parent: footParent, ShortPrefix: sp, FullPrefix: fp, GuideObjectCollection: toeGuides.length ? gs.slice(3) : [], Sliders: a.Sliders, Extension: true, ShadowType: footShadow, ShadowParent: shadow.ShadowEnds[0] ?? shParent });   // ThreeBoneToe deliberately omitted: two-bone toes (item 37)
  if (foot) { reparent(foot.Root, sk.eff); constrain(app, tibia, 'Position', [knee]); constrain(app, meta, 'Position', [tarsus]); constrain(app, sk.eff, 'Position', [foot.BaseGuide]); }
  const l1 = len(femur), l2 = len(tibia), l3 = len(meta); const dl = applyOp(app, sk.root, 'DogLeg', { length1: l1, length2: l2, length3: l3, initial_percentage: dist(tibia, toeStart) / Math.max(1e-6, l2 + l3), roll: rollAngle(gpos(gF), gpos(gT), gpos(toeStart), upPos.clone().sub(gpos(gF))), secondRoll: rollAngle(gpos(gT), gpos(gM), gpos(toeStart), upPos.clone().sub(gpos(gT))), lock_percentage: 0.97 }, [knee, tarsus, upV, sk.root, foot?.BaseGuide, foot?.Extension]);
  link(femur, 'UpVectorReference', upV);
  const fc = foot?.Foot ?? footParent; const baseNull = mkNull(app, 'baseNull', fc, gpos(meta).add(gpos(meta).sub(gpos(fc)).multiplyScalar(0)), 0.1); const lastUp = mkNull(app, 'lastboneUpV', fc, gpos(meta), 0.1);
  constrain(app, lastUp, 'TwoPoints', [baseNull, upV]); link(meta, 'UpVectorReference', lastUp);
  const tRoll = nth > 0 ? makeBicepRoll(app, { Bicep: femur, Prefix: `${sp}Thigh`, NbDivisions: nth }) : null;
  const slg = nodeOf(app, a.Sliders) as any; const holder: any = slg && !(slg instanceof X3DObject) ? slg : customProp(app, parent.model ?? parent, `${sp}DogLeg_Controls`);
  const lp = dl.get('lock_percentage'); if (lp) { const px = holder.add(num(`${sp}_lock percentage`, lp.value, `${sp}_lock percentage`, { min: 0.001, max: 1 })); (px as any).proxied = lp; }
  const env = tRoll ? [...tRoll.Divisions, tibia, meta] : [femur, tibia, meta]; const hidden = [sk.root, sk.eff, upParent];
  const h = hideSetup(app, model, hidden, env);
  return { model, prefix: sp, fullPrefix: fp, CharacterSetName: cs, ShadowCharacterSetName: scs, sliderPage: holder, Hidden: hidden, Envelope: env, parent, FootAttachPoint: footParent, guides: gs, ThighDivisions: nth, ShadowParent: shParent, ShadowType: shType, FootShadowType: footShadow, pos: [gF, gT, gM].map(gpos), objs: [gF, gT, gM], footObjs: toeGuides, scale, Root: sk.root, Skel: sk.all, eff: sk.eff, upPos, UpVec: upV, upParent, Knee: knee, Tarsus: tarsus, ArmShadow: shadow.Shadows, ShadowStart: shadow.ShadowStart, Shadows: shadow.Shadows, ShadowEnds: shadow.ShadowEnds, Foot: foot, FootControl: foot?.Foot ?? null, dogLeg: dl, ThighRoll: tRoll, HiddenGroup: h.HiddenGroup, envGroup: h.envGroup };
}

// ------------------------------------------------------------------ 3.14 MakeHead
export function makeHead(app: App, a: Record<string, any>) {
  const parent = objOf(app, a.Parent); const gs = collOf(app, a.GuideObjectCollection);
  if (!parent) { logError(app, 'makeHead: required argument 0 is invalid'); return undefined; }
  if (gs.length !== 3) { logError(app, `makeHead: guide collection (argument 1) needs 3 objects. Contains ${gs.length} objects`); return undefined; }
  const p = str0(a.Prefix), asm = intArg(a.AssemblyType, 0), htype = intArg(a.HeadType, 0); let nb = intArg(a.NbDivisions, 3); if (nb === 0) nb = 2; const stretch = intArg(a.StretchType, 0);
  const sliders = nodeOf(app, a.Sliders); const ears = collOf(app, a.EarGuideCollection); const shType = intArg(a.ShadowType, 0); const shParent = objOf(app, a.ShadowParent);
  const cs = `Upper.${p}Head_Neck`, scs = `ShadowUpper.Shadow${p}Head_Neck`; const model = parent.model; const [gN, gM, gH] = gs;
  const gl = guideLookup(gH.parentObj);
  const hDups = gl.dups(gH.name.replace(/\d+$/, '')).filter(d => d !== gH && Number(d.name.replace(/\D+/g, '')) > 1), jDups = gl.dups(gM.name.replace(/\d+$/, '')).filter(d => d !== gM && Number(d.name.replace(/\D+/g, '')) > 1);
  const pts = [gN, gM, gH, ...hDups].map(gpos); const jawPts = [gM, ...jDups].map(gpos); const scale = pts[0].distanceTo(pts[pts.length - 1]);
  const out: Record<string, any> = { parent, guides: gs, prefix: p, CharacterSetName: cs, ShadowCharacterSetName: scs, ShadowType: shType, ShadowParent: shParent, Type: htype, Ears: ears, inNbDivisions: nb, Stretch: stretch, Sliders: sliders, AssemblyType: asm, pos: pts, objs: gs, JawPos: jawPts, JawObjs: jDups, scale, normalPlane: v3(0, 1, 0), Root: null, Skel: [], Head: null, HeadScale: 0, NeckBase: null, BaseDepth: null, TopDepth: null, Spine: null, EarChains: [], JawRoot: null, JawSkel: [], HeadShadow: [], JawShadow: [], ShadowStart: null, ShadowEnds: [], Shadows: [] };
  let hidden: X3DObject[] = [], env: X3DObject[] = []; let headObj: X3DObject; let hs: Sh = noShadow(); let headBone: X3DObject;
  if (asm === 0) {
    const names = ['HeadRoot', ...pts.slice(0, -1).map((_, i) => (i === pts.length - 2 ? 'Head' : 'Neck')), 'HeadEff'];
    const sk = mkChain(app, names, pts, parent, { type: 3, normal: v3(0, 1, 0) }); setChainScale(sk, scale * 0.3); sk.bones[0] && setP(sk.bones[0], 'chntype', 2);
    sk.bones.forEach(b => markingSet(app, b, false, true, '', cs)); out.Root = sk.root; out.Skel = sk.all; headObj = headBone = sk.bones[sk.bones.length - 1]; hidden = [sk.root, sk.eff]; env = sk.bones.slice();
    hs = shadowOf(app, sk.all, shType, shParent, scale * 0.3, scs, sk.bones.map((b, i) => ({ name: i === sk.bones.length - 1 ? 'Head' : 'Neck', start: b, end: sk.bones[i + 1] ?? sk.eff, connector: i === sk.bones.length - 1 ? 'Connector_Head' : 'Connector_Box' })), scale * 0.3, 1, 0.8);
  } else {
    const span = pts[1].distanceTo(pts[pts.length - 1]); const head = mkImplicit(app, 'Head', parent, 'Cube', pts[pts.length - 1], span, 253); markingSet(app, head, true, true, '', cs);
    const nbase = mkNull(app, 'NeckBase', parent, gN, 0.2 * scale, 484); const bd = mkNull(app, 'BaseDepth', nbase, gpos(gN).lerp(pts[1], 0.25), 0.1 * scale, 770), td = mkNull(app, 'TopDepth', head, pts[pts.length - 1].clone().lerp(pts[1], 0.25), 0.1 * scale, 253);
    const sp = makeSpine(app, { Model: model, Parent: parent, NbVertebrae: nb, SpineType: 1, Stretchy: stretch === 1, SpineBaseObject: nbase, SpineTopObject: head, BottomDepthObject: bd, TopDepthObject: td, ChestTop: null, Sliders: sliders, ShadowType: shType, ShadowParent: shParent, VertebraeName: 'NeckVertebra', CharacterSetName: cs, ShadowCharacterSetName: scs });
    Object.assign(out, { Head: head, HeadScale: span, NeckBase: nbase, BaseDepth: bd, TopDepth: td, Spine: sp }); headObj = head; headBone = head; hidden = [nbase, bd, td];
    if (sp) { hs = { Shadows: sp.Shadows, ShadowStart: sp.ShadowStart, ShadowEnds: sp.ShadowEnds, ShadowHidden: [], ShadowEnvelope: [] }; env = [head]; }
  }
  if (asm === 0) out.Head = headObj;
  if (ears.length) logNya(app, 'makeHead', 'MakeTail for the ear guides (not in this row); no ear chains built');
  let js: Sh = noShadow();
  if (jDups.length >= 2) {
    const sk = mkChain(app, ['JawRoot', 'JawNeck', 'JawEff'], jawPts.slice(0, 2), headBone, { type: 3, normal: v3(0, 1, 0) }); setChainScale(sk, scale * 0.2);
    out.JawRoot = sk.root; out.JawSkel = sk.all; hidden.push(sk.root, sk.eff); env.push(sk.bones[0]);
    js = shadowOf(app, sk.all, shType, hs.ShadowEnds[0] ?? shParent, scale * 0.2, scs, [{ name: 'Jaw', start: sk.bones[0], end: sk.eff }], scale * 0.2, 1, 0.8);
  }
  const h = hideSetup(app, model, hidden, env);
  Object.assign(out, { Hidden: hidden, Envelope: env, HeadShadow: hs.Shadows, JawShadow: js.Shadows, ShadowStart: hs.ShadowStart, ShadowEnds: hs.ShadowEnds, Shadows: [...hs.Shadows, ...js.Shadows], HiddenGroup: h.HiddenGroup, envGroup: h.envGroup });
  return out;
}
export { numArg, bad, hipIconParams };
