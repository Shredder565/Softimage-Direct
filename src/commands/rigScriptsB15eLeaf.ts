// Ledger row CMD-B15e: leaf builders (note sections 3.1, 3.15-3.25): MakeRigIcon, MakeHip, MakeBelly, MakeBicepRoll,
// MakeForearmRoll, Make2PointSlide, MakeThighSlide, MakeJointCompression, MakeShadowChain, MakeShadowSpine, the key-set
// builders and SetKeyableRig. Original code from the note's prose; see rigScriptsB15eKit.ts for the stand-in model.
import { App } from '../core/commands';
import { Property, Group } from '../core/scene';
import { sampleCurve } from '../core/curves';
import {
  THREE, X3DObject, v3, gpos, dist, setP, setPs, setColor, setVisible, setGlobalPos, copyXform, reparent, mkNull, mkCurve, mkChain, mkImplicit,
  circlePts, boxPts, applyOp, constrain, customProp, hideSetup, markingSet, marksOf, link, setChainScale, logError, logInfo, logWarn, logNya,
  numArg, intArg, boolArg, objOf, collOf, isEmptyGuid, bad, unset, siFull, Skel, rigState, ROW, num,
} from './rigScriptsB15eKit';

const len = (b: X3DObject) => Number(b.val('length') ?? 1);

// ------------------------------------------------------------------ 3.1 MakeRigIcon
const NAMED_ICONS: Record<number, string> = { 9: 'CurveSphere', 10: 'EyeArrow', 11: 'LookAt', 12: 'Pin', 13: 'AngleSurvey', 14: 'Eyeball', 15: 'Tooth', 16: 'RightTriangle', 17: 'RAKHead' };
/** Polylines (local points, closed flag) of an icon type. Types 0-8 follow the note; the fixed unit shapes of 9-17 are stand-ins. */
function iconCurves(type: number, X: number, Y: number, Z: number): { pts: THREE.Vector3[]; closed: boolean }[] | null {
  const sq = (a: (u: number, v: number) => THREE.Vector3) => [a(-.5, -.5), a(.5, -.5), a(.5, .5), a(-.5, .5), a(-.5, -.5)];
  switch (type) {
    case 0: return [{ pts: sq((u, v) => v3(0, u * Y, v * Z)), closed: false }];
    case 1: return [{ pts: sq((u, v) => v3(u * X, 0, v * Z)), closed: false }];
    case 2: return [{ pts: boxPts(X, Y, Z).map(p => p.add(v3(0, Y / 2, 0))), closed: true }];
    case 3: return [{ pts: boxPts(X, Y, Z), closed: true }];
    case 4: case 5: { const c = type === 5 ? -Y / 2 : 0; const a = [v3(-X / 2, c, -Z / 2), v3(X / 2, c, -Z / 2), v3(X / 2, c, Z / 2), v3(-X / 2, c, Z / 2)]; const t = v3(0, c + Y, 0);
      return [{ pts: [a[0], a[1], t, a[2], a[3], t, a[0], a[3], a[2], a[1]], closed: true }]; }
    case 6: case 8: { const c = type === 6 ? Y / 2 : 0; const t = v3(0, c + Y / 2, 0), b = v3(0, c - Y / 2, 0);
      const r = [v3(X / 2, c, 0), v3(0, c, Z / 2), v3(-X / 2, c, 0), v3(0, c, -Z / 2)];
      return [{ pts: [t, r[0], b, r[1], t, r[2], b, r[3], t, r[0], r[1], r[2], r[3]], closed: true }]; }
    case 7: { const bp = boxPts(X, Y / 2, Z).map(p => p.add(v3(0, Y / 4, 0))); return [{ pts: [...bp, v3(0, Y, 0)], closed: true }]; }
    case 15: return [{ pts: [v3(-X / 2, 0, 0), v3(-X / 4, Y, 0), v3(0, Y / 2, 0), v3(X / 4, Y, 0), v3(X / 2, 0, 0)], closed: false }];
    case 9: return [0, 1, 2].map(k => ({ pts: circlePts(0.75, 16).map(p => (k === 0 ? p : k === 1 ? v3(p.y, p.x, p.z) : v3(p.x, p.z, p.y)).multiply(v3(X, Y, Z))), closed: true }));
    case 10: case 11: case 12: case 13: case 14: case 16: case 17:
      return [{ pts: circlePts(0.5, 12).map(p => p.multiply(v3(X, Y, Z))), closed: true }, { pts: [v3(0, 0, 0), v3(0, 0, Z)], closed: false }];
    default: return null;
  }
}
export function makeRigIcon(app: App, a: { Parent?: any; Type?: any; X?: any; Y?: any; Z?: any; Xlength?: any; Ylength?: any; Zlength?: any; Color?: any; Name?: any; XOffset?: any; YOffset?: any; ZOffset?: any }): X3DObject | undefined {
  const parent = isEmptyGuid(a.Parent) ? null : objOf(app, a.Parent);
  const type = intArg(a.Type, 5); const at = v3(numArg(a.X, 0), numArg(a.Y, 0), numArg(a.Z, 0));
  let X = numArg(a.Xlength, 1), Y = numArg(a.Ylength, 1), Z = numArg(a.Zlength, 1);
  const color = intArg(a.Color, 65); let name = unset(a.Name) ? '' : String(a.Name);
  const off = v3(numArg(a.XOffset, 0), numArg(a.YOffset, 0), numArg(a.ZOffset, 0));
  const multi = type >= 9 && type !== 15 && type <= 17;
  if (multi) { if (!X) X = 1; if (!Y) Y = 1; if (!Z) Z = 1; if (!name) name = NAMED_ICONS[type]; }
  const curves = iconCurves(type, X, Y, Z); if (!curves) return undefined;   // any other Type creates nothing
  if (multi && type !== 9) logNya(app, 'MakeRigIcon', `the fixed unit shape of icon type ${type} (${NAMED_ICONS[type]}); a circle plus a line is used`);
  const useOff = off.x !== 0 && off.y !== 0 && off.z !== 0;   // only when all three offsets are non-zero
  const o = mkCurve(app, name || NAMED_ICONS[type] || 'RigIcon', parent, curves[0].pts.map(p => (useOff ? p.clone().add(off) : p)), { degree: 1, closed: curves[0].closed });
  if (curves.length > 1) { (o as any).extraCurves = curves.slice(1).map(c => c.pts.map(p => (useOff ? p.clone().add(off) : p))); setP(o, 'curveCount', curves.length); }
  setPs(o, { xlength: X, ylength: Y, zlength: Z }); if (!multi || color !== 0) setColor(o, color);
  setGlobalPos(o, at);   // global transform = pure translation to (X, Y, Z)
  return o;
}

// ------------------------------------------------------------------ 3.21 MakeHip
export const hipIconParams = (top: THREE.Vector3, side: THREE.Vector3) => ({
  spine_pointx: top.x, spine_pointy: top.y, spine_pointz: top.z, leg_pointx: side.x, leg_pointy: side.y, leg_pointz: side.z,
  height: 1.3, indent_height: 0.5, top_height: 0.4, socket_height: 0.3, socket_depth: 0.5, socket_width: 0.5, depth: 0.4, cap_width: 0.25, width: 0.7,
});
export function makeHip(app: App, a: Record<string, any>): X3DObject | undefined {
  let guide = objOf(app, a.GuideObj);
  let top = v3(numArg(a.TopX, 0), numArg(a.TopY, 0), numArg(a.TopZ, 0)); const side = v3(numArg(a.SideX, 1), numArg(a.SideY, 1), numArg(a.SideZ, 1));
  if (!guide) {
    guide = app.selectedObjects[0] ?? null;
    if (!guide) { logError(app, 'Hip Maker Cancel, Requires and Object Selection to define Hip Transform'); return undefined; }
    logNya(app, 'MakeHip', 'interactive PickPosition ("Pick Top of Hip Position" / "Pick Side of Hip Position"); the Top / Side arguments are used (stand-in)');
  }
  const plate = mkCurve(app, 'HipPlate', null, circlePts(1, 16), { degree: 1, closed: true, color: 49 });
  copyXform(plate, guide);
  applyOp(app, plate, 'HipIcon', hipIconParams(top, side));
  return plate;
}

// ------------------------------------------------------------------ 3.16 MakeBicepRoll / 3.17 MakeForearmRoll
export function makeBicepRoll(app: App, a: { Bicep?: any; Prefix?: any; NbDivisions?: any }) {
  const bicep = objOf(app, a.Bicep); const p = unset(a.Prefix) ? '' : String(a.Prefix); const n = intArg(a.NbDivisions, 3);
  if (!bicep) { logError(app, 'makeBicepRoll: no bicep bone'); return undefined; }   // note: no validation; a missing bone cannot be used
  const L = (n + 1) / (n + 2); const parent = bicep.parentObj ?? app.scene.root; const div: X3DObject[] = [];
  for (let i = 1; i <= n; i++) {
    const nl = mkNull(app, `${p}Roll${i}`, parent, gpos(bicep).lerp(gpos(bicep).add(v3(len(bicep), 0, 0)), L * (i - 1) / n), 0.3, 421);
    applyOp(app, nl, 'FirstBoneRollDivisionRO', { length_perc: L * (i - 1) / n, mySlerp: i / (n + 2) }, [nl, bicep]);
    div.push(nl);
  }
  const last = mkNull(app, `${p}Roll_${n + 1}`, bicep, null, 0.3, 421);
  setP(last, 'posx_expression', String(len(bicep) * L)); last.kinematics.local.set('posx', len(bicep) * L);
  div.push(last);
  return { Nb: n, Divisions: div };
}
export function makeForearmRoll(app: App, a: Record<string, any>) {
  const names = ['Bicep', 'Forearm', 'ArmEff', 'HandEff', 'HandBone']; const o = names.map(k => objOf(app, a[k])); let ok = true;
  o.forEach((x, i) => { if (!x) { logError(app, `makeForearmRoll: argument ${i} is invalid`); ok = false; } });
  if (!ok) return undefined;
  const [bicep, fore, armEff, handEff, handBone] = o as X3DObject[];
  const p = unset(a.Prefix) ? '' : String(a.Prefix); const n = intArg(a.NbDivisions, 3); const roll = numArg(a.RollOffset, 0);
  const sl = customProp(app, handBone, 'Roll_Compensation'); const rp = sl.add(num('roll_offset', 0, 'roll_offset', { min: -360, max: 360, uimin: -180, uimax: 180 })); rp.value = roll;
  const div: X3DObject[] = [];
  for (let i = 0; i < n; i++) {
    const nl = mkNull(app, i === 0 ? `${p}Elbow` : `${p}ForearmRoll`, fore, null, 0.3, 544);
    applyOp(app, nl, 'ForeArmRollDivision', { blend: 1 - i / n, compensation: roll }, [nl, bicep, fore, armEff, handEff, handBone]);
    setP(nl, 'posx_expression', String(len(fore) * i / n)); nl.kinematics.local.set('posx', len(fore) * i / n);
    div.push(nl);
  }
  return { Sliders: sl, RollOffset: rp, Nb: n, Divisions: div };
}

// ------------------------------------------------------------------ 3.18 Make2PointSlide / 3.19 MakeThighSlide
export function make2PointSlide(app: App, a: Record<string, any>) {
  const p = unset(a.Prefix) ? '' : String(a.Prefix);
  const objs = ['GuidePoint1', 'GuidePoint2', 'Parent1', 'Parent2'].map(k => objOf(app, a[k])); let ok = true;
  objs.forEach((x, i) => { if (!x) { logError(app, `make2PointSlide: argument ${i + 1} is invalid`); ok = false; } });
  if (!ok) return undefined;
  const [g1, g2, p1, p2] = objs as X3DObject[]; const up = objOf(app, a.UpVector), bv = objOf(app, a.BoundingVolume);
  const d = dist(g1, g2);
  const bind = mkNull(app, `${p}Bind`, p1, gpos(g1).lerp(gpos(g2), 0.5), d * 0.1, 748);
  const top = mkNull(app, `${p}Top`, p1, g1, d * 0.05, 472), base = mkNull(app, `${p}Base`, p2, g2, d * 0.05, 472);
  const cns = constrain(app, bind, 'TwoPoints', [top, base]);
  if (bv) constrain(app, bind, 'BoundingVolume', [bv], { type: 1 });
  if (up && cns) link(cns as any, 'UpVectorReference', up);
  const model = p1.model; const h = hideSetup(app, model, [top, base], [bind]);
  return { model, Hidden: [top, base], Envelope: [bind], BindNull: bind, TopNull: top, BaseNull: base, Constraint: cns, ...h };
}
export function makeThighSlide(app: App, a: Record<string, any>) {
  const p = unset(a.Prefix) ? '' : String(a.Prefix); const gs = collOf(app, a.GuideObjectCollection);
  const upper = objOf(app, a.UpperParent), lower = objOf(app, a.LowerParent);
  if (!gs.length) { logError(app, 'makeThighSlide: argument 1 is invalid'); return undefined; }
  if (!upper) { logError(app, 'makeThighSlide: argument 2 is invalid'); return undefined; }
  if (!lower) { logError(app, 'makeThighSlide: argument 3 is invalid'); return undefined; }
  if (gs.length < 5) { logError(app, `makeThighSlide: argument 1 is invalid (needs 5 guides, has ${gs.length})`); return undefined; }
  const [top, bot, hip, legStart, knee] = gs.map(gpos);
  const mid = top.clone().lerp(bot, 0.5); const nrm = knee.clone().sub(legStart).normalize();
  const hp = hip.clone().sub(nrm.clone().multiplyScalar(hip.clone().sub(mid).dot(nrm)));   // hip side projected on the plane normal to the thigh
  const dx = mid.x - hp.x; const x0 = Math.abs(dx) > 1e-9 ? hp.clone().lerp(mid, -hp.x / dx) : mid.clone();   // that line meets the X = 0 plane (inferred line)
  const centre = hp.clone().add(x0).multiplyScalar(0.5); const radius = Math.max(centre.distanceTo(mid), 1e-3);
  logNya(app, 'MakeThighSlide', 'the exact line used for the X = 0 intersection of the volume centre');
  const vol = mkImplicit(app, `${p}ThighVolume`, lower, 'Sphere', centre, radius, 728);
  const sc = vol.kinematics.local; sc.set('sclx', centre.distanceTo(hip) / radius); sc.set('scly', 2); sc.set('sclz', 1);
  const s = make2PointSlide(app, { Prefix: p, GuidePoint1: gs[0], GuidePoint2: gs[1], Parent1: upper, Parent2: lower, UpVector: upper, BoundingVolume: vol });
  return { Guides: gs, Pos: gs.map(gpos), Volume: vol, BindNull: s?.BindNull, TopNull: s?.TopNull, BaseNull: s?.BaseNull };
}

// ------------------------------------------------------------------ 3.20 MakeJointCompression
export function makeJointCompression(app: App, a: Record<string, any>) {
  const p = unset(a.Prefix) ? '' : String(a.Prefix); const upper = objOf(app, a.UpperBone), lower = objOf(app, a.LowerBone); const gs = collOf(app, a.GuideObjectCollection);
  if (!upper) { logError(app, 'makeJointCompression: argument 1 is invalid'); return undefined; }
  if (!lower) { logError(app, 'makeJointCompression: argument 2 is invalid'); return undefined; }
  if (gs.length < 4) { logError(app, 'makeJointCompression: argument 3 is invalid'); return undefined; }
  const [ut, lt, ct, cc] = gs; const divs = a.RollDivisionCollection ? collOf(app, a.RollDivisionCollection) : [];
  const centre = gpos(cc), target = gpos(ct); const radius = Math.max(centre.distanceTo(target), 1e-3);
  const vol = mkImplicit(app, `${p}BendVolume`, lower, 'Sphere', centre.clone().add(centre.clone().sub(target).multiplyScalar(0.25)), radius, 728);
  const parent = divs.length ? divs.reduce((b, d) => (dist(d, ut) < dist(b, ut) ? d : b), divs[0]) : upper;   // LowerBone is never a parent
  const size = dist(ut, lt) * 0.4;
  const mk = (name: string, g: X3DObject) => {
    const n = mkNull(app, name, parent, g, size, 748); setPs(n.kinematics.local, { sclx: 1, scly: 1, sclz: 1 });
    constrain(app, n, 'Pose', [parent], { compensation: true }); constrain(app, n, 'BoundingVolume', [vol]); return n;
  };
  const uj = mk(`${p}UpperJoint`, ut), lj = mk(`${p}LowerJoint`, lt);
  const model = upper.model; const h = hideSetup(app, model, [], [uj, lj]);
  return { UpperBone: upper, LowerBone: lower, UpperTarget: ut, LowerTarget: lt, CurveTarget: ct, CurveCenter: cc, model, Envelope: [uj, lj], Volume: vol, UpperJoint: uj, LowerJoint: lj, envGroup: h.envGroup };
}

// ------------------------------------------------------------------ 3.15 MakeBelly
export function makeBelly(app: App, a: Record<string, any>) {
  const hip = objOf(app, a.HipObject), vert = objOf(app, a.VertebraObject); const gs = collOf(app, a.GuideObjectCollection); const perc = numArg(a.ForwardRotationPerc, 0.25);
  if (!hip) { logInfo(app, 'makeBelly: argument 0 is invalid'); return undefined; }
  if (!vert) { logInfo(app, 'makeBelly: argument 1 is invalid'); return undefined; }
  if (gs.length !== 2) { logInfo(app, `makeBelly: Guide collection needs 2 objects. Collection has ${gs.length} objects`); throw new Error("makeBelly: 'undefined' is undefined"); }   // the script then returns an undefined variable
  const hp = gpos(hip), vp = gpos(vert), lp = gpos(gs[0]), up = gpos(gs[1]);
  const minLen = (start: THREE.Vector3, parentPos: THREE.Vector3, end: THREE.Vector3) => { const d = start.distanceTo(end); if (d <= 0.05) { const toward = parentPos.clone().sub(end).normalize(); return start.clone().add(toward.multiplyScalar(d <= 0.01 ? 0.015 : 0.015)); } return start; };
  const sLow = minLen(hp.clone().lerp(lp, perc), hp, lp), sUp = minLen(vp.clone().lerp(up, perc), vp, up);
  const belly = mkChain(app, ['BellyRoot', 'Belly', 'BellyEff'], [lp, up], null, { type: 1 });
  const upperS = mkChain(app, ['UpperBellyRoot', 'UpperBellyBone', 'UpperBellyEff'], [sUp, up], vert, { type: 3 });
  const lowerS = mkChain(app, ['LowerBellyRoot', 'LowerBellyBone', 'LowerBellyEff'], [sLow, lp], hip, { type: 3 });
  const springLen = (dist(sUp, up) + dist(sLow, lp)) / 2; const scale = springLen * 0.1, sScale = scale * 0.4;   // belly scale x2, spring scale x0.4 (as read)
  setChainScale(belly, scale * 2); setChainScale(upperS, sScale); setChainScale(lowerS, sScale);
  for (const x of belly.all) setP(x, 'shadow_icon', 6); for (const x of [...upperS.all, ...lowerS.all]) setP(x, 'shadow_icon', 7);
  for (const s of [upperS, lowerS]) for (const x of s.all) { setP(x, 'spring', true); }
  reparent(belly.root, lowerS.eff);
  link(belly.bones[0], 'UpVectorReference', hip);
  constrain(app, belly.eff, 'Position', [upperS.eff]);
  const hidden = [belly.root, belly.eff, upperS.root, upperS.eff, lowerS.root, lowerS.eff];
  const model = hip.model; const h = hideSetup(app, model, hidden, [belly.bones[0]]);
  if (app.commands.get('ApplySpringOp')) { for (const s of [upperS, lowerS]) { try { app.run('ApplySpringOp', { eff: s.eff, root: s.root }); } catch (e: any) { logInfo(app, `makeBelly: ApplySpringOp failed: ${e?.message ?? e}`); } } }
  else logNya(app, 'makeBelly', 'ApplySpringOp is not on the bus (spring operators not applied)');
  return { Guides: gs, Hip: hip, Vertebra: vert, Model: model, Perc: perc, Hidden: hidden, Envelope: [belly.bones[0]], hipPos: hp, vertPos: vp, lowerPos: lp, upperPos: up, startLower: sLow, startUpper: sUp,
    BellyRoot: belly.root, BellySkel: belly.all, BellyEff: belly.eff, BellyBone: belly.bones[0], UpperRoot: upperS.root, UpperSkel: upperS.all, UpperEff: upperS.eff, UpperBone: upperS.bones[0],
    LowerRoot: lowerS.root, LowerSkel: lowerS.all, LowerEff: lowerS.eff, LowerBone: lowerS.bones[0], Scale: scale, SpringScale: sScale, ...h, HiddenGroup: h.HiddenGroup };
}

// ------------------------------------------------------------------ 3.22 MakeShadowChain
export function makeShadowChain(app: App, a: Record<string, any>) {
  const src = collOf(app, a.Chain); const parent = objOf(app, a.ShadowParent);
  if (!parent) { logInfo(app, 'makeShadowChain: argument 0 is invalid'); return undefined; }
  if (src.length < 2) { logInfo(app, 'makeShadowChain: argument 0 is invalid'); return undefined; }
  const si3d = boolArg(a.SI3DStyleChain, false); let scale = numArg(a.IconScale, 1); const nullShadow = intArg(a.ShadowType, 0) !== 0; const cs = unset(a.ShadowCharacterSetName) ? '' : String(a.ShadowCharacterSetName);
  if (scale === 0) { logWarn(app, 'makeShadowChain: shadow scale cannot be zero, using scale of 1.0'); scale = 1; }
  const model = parent.model; let shadows: X3DObject[] = []; let root: X3DObject; let hidden: X3DObject[] = [], env: X3DObject[] = [];
  if (nullShadow) {   // null trace: one null per source bone, nested, Pose-constrained (not compensated)
    let par: X3DObject = parent;
    for (const s of src) { const n = mkNull(app, s.name, par, s, scale * 0.3, 381); constrain(app, n, 'Pose', [s], { compensation: false }); markingSet(app, n, false, true, '', cs); shadows.push(n); par = n; }
    root = shadows[0]; env = shadows.slice(); hidden = [];
  } else {
    const names = src.map(s => s.name); const sk = mkChain(app, names, src.slice(1).map(gpos), parent, { type: src.length > 4 && Number(src[0].val('chntype')) === 2 ? 2 : 3, color: 805 });
    setChainScale(sk, scale);
    if (si3d) { setP(sk.eff, 'cnsori', false); setP(sk.eff, 'cnspos', false); const last = sk.bones[sk.bones.length - 1]; if (last) reparent(sk.eff, last); }
    sk.bones.forEach((b, i) => { constrain(app, b, 'Pose', [src[1 + i]], { compensation: true }); markingSet(app, b, false, true, '', cs); });
    shadows = sk.all; root = sk.root; hidden = [sk.root, sk.eff]; env = sk.bones;
    for (let i = 0; i < Math.min(src.length, sk.all.length); i++) if (src[i].val('pref_relRoot') !== undefined && src[i].val('pref_relRoot')) { setP(sk.all[i], 'pref_relRoot', true); setP(sk.all[i], 'resplane', 1); }
  }
  const h = hideSetup(app, model, hidden, env, true);
  return { Hidden: hidden, Envelope: env, Scale: scale, ShadowModel: model, ShadowCharacterSetName: cs, Chain: src, Parent: parent, SI3D: si3d, ShadowEnds: [shadows[shadows.length - 1]], Shadows: shadows, ShadowStart: root, Root: root, Skel: shadows, ...h };
}

// ------------------------------------------------------------------ 3.23 MakeShadowSpine
export function makeShadowSpine(app: App, a: Record<string, any>) {
  const spline = objOf(app, a.Spline), base = objOf(app, a.Base), verts = collOf(app, a.Vertebra), top = objOf(app, a.TopVertebra);
  let ok = true; [spline, base, verts.length ? verts : null, top].forEach((x, i) => { if (!x) { logError(app, `makeShadowSpine: argument ${i} is invalid`); ok = false; } });
  if (!ok) return undefined;
  const parent = objOf(app, a.ShadowParent) ?? app.scene.root; const chestTop = objOf(app, a.ChestTop); let scale = numArg(a.IconScale, 1); const type = intArg(a.ShadowType, 1);
  const cs = unset(a.ShadowCharacterSetName) ? '' : String(a.ShadowCharacterSetName); if (scale === 0) scale = 1;
  const model = parent.model; const out: Record<string, any> = { Base: base, Spline: spline, Vertebra: verts, TopVertebra: top, Parent: parent, ShadowModel: model, RigModel: base!.model, ChestTop: chestTop, Scale: scale, ShadowCharacterSetName: cs, ShadowEnds: [], Root: null, Skel: [], Root2: null, Skel2: [], UpVectors: [], ShadowStart: null, Shadows: [], Hidden: [], Envelope: [] };
  let hidden: X3DObject[] = [], env: X3DObject[] = [];
  if (type === 1 || type === 2) {
    const n = verts.length + 1 + (chestTop ? 0 : 1);
    const crv = spline!.primitive?.operators.map((o: any) => (o.data && o.data.cvs ? o.data : null)).filter(Boolean).slice(-1)[0] as any;
    let pts: THREE.Vector3[];
    if (crv) { const M = spline!.globalMatrix(); pts = sampleCurve(crv, n).map(q => new THREE.Vector3(q[0], q[1], q[2]).applyMatrix4(M)); }
    else { pts = [gpos(base!), ...verts.map(gpos), gpos(top!)].slice(0, n); while (pts.length < n) pts.push(gpos(top!)); }   // no curve data: guides stand in
    const sep = !!chestTop && verts.length > 1; const nb = pts.length - 1;
    const names = ['SpineRoot', ...Array.from({ length: nb }, (_, i) => (i === nb - 1 && !sep ? 'Chest' : `Spine${i + 1}`)), 'ChestEffector'];
    const sk = mkChain(app, names, pts, parent, { type: 2, color: 805 }); setChainScale(sk, scale);
    const si3d = type === 1; if (si3d) { setP(sk.eff, 'cnsori', false); setP(sk.eff, 'cnspos', false); }
    sk.bones.forEach((b, i) => { const c = constrain(app, b, 'Path', [spline], { perc: 100 * i / Math.max(1, nb), locked: true }); void c; markingSet(app, b, false, true, '', cs); });
    constrain(app, sk.eff, si3d ? 'Position' : 'Pose', [top]);
    const ups: X3DObject[] = []; [...verts, top!].forEach((v, i) => { const u = mkNull(app, 'Shadow_upVa', v, gpos(v).add(v3(0, scale * 0.1, 0)), scale * 0.1); ups.push(u); const b = sk.bones[Math.min(i, sk.bones.length - 1)]; if (b) link(b, 'UpVectorReference', u); });
    out.UpVectors = ups; out.Root = sk.root; out.Skel = sk.all; hidden = [sk.root, sk.eff]; env = sk.bones.slice(); let shadows = sk.all.slice(); let ends = [sk.eff];
    if (sep) {
      const lastB = sk.bones[sk.bones.length - 1];
      const c2 = mkChain(app, ['ChestRoot', 'Chest', 'ChestEffector'], [gpos(lastB).add(v3(0, 0.001, 0)), gpos(chestTop!)], lastB, { type: 3, color: 805 }); setChainScale(c2, scale);
      constrain(app, c2.root, 'Position', [top]); constrain(app, c2.bones[0], 'Pose', [top]); markingSet(app, c2.bones[0], false, true, '', cs);
      out.Root2 = c2.root; out.Skel2 = c2.all; hidden.push(c2.root, c2.eff); env.push(c2.bones[0]); shadows = [...shadows, ...c2.all]; ends = [c2.eff];
    }
    out.Shadows = shadows; out.ShadowEnds = ends; out.ShadowStart = sk.root;
  } else if (type === 3) {
    let par: X3DObject = base!; const ns: X3DObject[] = [];
    [base!, ...verts, top!].forEach((s, i) => { const n = mkNull(app, s.name, i === 0 ? base! : par, s, scale * 0.3, 381); constrain(app, n, 'Pose', [s]); ns.push(n); par = n; });
    out.Shadows = ns; out.ShadowStart = ns[0]; out.ShadowEnds = [ns[ns.length - 1]]; env = ns.slice();
  }   // other values build nothing
  const h = hideSetup(app, model, hidden, env, true);
  out.ShadowHidden = hidden; out.ShadowEnvelope = env; out.Hidden = hidden; out.Envelope = env; Object.assign(out, h);
  return out;
}

// ------------------------------------------------------------------ 3.24 / 3.25 character key sets
const SUBSETS: Record<'Biped' | 'Quadruped', [string, string[]][]> = {
  Biped: [['Upper', ['R_Arm', 'L_Arm', 'R_Hand', 'L_Hand', 'Torso', 'Head_Neck']], ['Lower', ['L_Leg', 'R_Leg']]],
  Quadruped: [['Upper', ['Torso', 'Head_Neck']], ['Lower', ['L_Leg', 'R_Leg', 'BL_Leg', 'BR_Leg', 'Tail']]],
};
const clearKeyable = (root: X3DObject, includeRoot: boolean) => {
  for (const o of [...(includeRoot ? [root] : []), ...root.descendants()]) {
    const l = o.kinematics.local; for (const k of ['pos', 'rot', 'scl']) for (const ax of ['x', 'y', 'z']) { const p = l.get(k + ax); if (p) p.def.keyable = false; }
    for (const p of o.properties) if (p.type === 'posecns') for (const q of p.params) q.def.keyable = false;
  }
};
const ksApi = (app: App) => (app as any).characterKeySets as { create(owner?: X3DObject | null, name?: string, cur?: boolean): Property; addProxies(ks: Property, params: any): any; setCurrent(x: any): void };
const nestedOf = (p: any): Property[] => (Array.isArray(p?.nested) ? p.nested : []);

function makeKeySet(app: App, fn: string, kind: 'Biped' | 'Quadruped', a: Record<string, any>) {
  const root = objOf(app, a.RootObject);
  if (!root) { logInfo(app, `${fn}: argument 0 is invalid`); return undefined; }
  const name = unset(a.CharacterKeySetName) || a.CharacterKeySetName === '' ? 'CharSet' : String(a.CharacterKeySetName);
  const del = boolArg(a.DeleteMarkingSet, false); const pre = unset(a.Prefix) ? '' : String(a.Prefix), suf = unset(a.Suffix) ? '' : String(a.Suffix);
  const model = root.model;
  if (model) clearKeyable(model, false);
  const auto = (app as any).autoInspect; (app as any).autoInspect = false;
  try {
    app.select([]);
    const top = ksApi(app).create(root, pre + name + suf, true);
    const used: { owner: X3DObject; set: Property }[] = [];
    const populate = () => {
      for (const { owner, set } of marksOf(model)) {
        const csp = set.get('CharacterKeySet');
        if (!csp) { logInfo(app, `MarkingSet - ${siFull(owner)}.${set.name} - not included in Character Key Set`); continue; }
        const path = String(csp.value ?? ''); const masters = set.params.filter(p => (p as any).proxied).map(p => (p as any).proxied);
        for (const m of masters) m.def.keyable = true;   // the listed rot / pos parameters become keyable
        if (path.startsWith('None')) { used.push({ owner, set }); continue; }   // only scheduled for deletion
        const segs = path.split('.').filter(Boolean); let cur: Property = top; let i = 0;
        if (segs.length && cur.name.includes(segs[0]) && !nestedOf(cur).some(n => n.name === pre + segs[0] + suf)) i = 1;   // plain name = the current set
        let found = true;
        for (; i < segs.length; i++) { const nx = nestedOf(cur).find(n => n.name === pre + segs[i] + suf || n.name === segs[i]); if (!nx) { found = false; break; } cur = nx; }
        if (!found) { logInfo(app, `Error setting CharacterSubSet - ${path}`); continue; }
        try { ksApi(app).addProxies(cur, masters); used.push({ owner, set }); } catch (e: any) { logInfo(app, `Error setting CharacterSubSet - ${e?.message ?? e}`); }
      }
    };
    for (const [up, kids] of SUBSETS[kind]) {
      const sub = app.run('CreateSubCharacterKeySet', { CharacterKeySet: top, InputObjs: [], Name: pre + up + suf }) as Property[] | undefined; const upper = sub?.[0] ?? null;
      if (!upper) continue;
      for (const k of kids) app.run('CreateSubCharacterKeySet', { CharacterKeySet: upper, InputObjs: [], Name: pre + k + suf });
    }
    populate();
    if (del) for (const u of used) { const p = u.set; app.record('Delete MarkingSet', () => u.owner.removeProperty(p), () => u.owner.addProperty(p)); }
    ksApi(app).setCurrent(top.fullName.replace(/^Scene\.Scene_Root\./, ''));
    return top;
  } finally { (app as any).autoInspect = auto; }
}
export const makeBipedKeySet = (app: App, a: Record<string, any>) => makeKeySet(app, 'makeBipedCharacterKeySet', 'Biped', a);
export const makeQuadrupedKeySet = (app: App, a: Record<string, any>) => makeKeySet(app, 'makeQuadrupedCharacterKeySet', 'Quadruped', a);
export function setKeyableRig(app: App, a: Record<string, any>) {
  const root = objOf(app, a.RootObject);
  if (!root) { logInfo(app, 'makeBipedCharacterKeySet: argument 0 is invalid'); return undefined; }
  clearKeyable(root, false);
  for (const { owner, set } of marksOf(root.model)) {
    for (const p of set.params) { const m = (p as any).proxied; if (m) m.def.keyable = true; }
    app.record('Delete MarkingSet', () => owner.removeProperty(set), () => owner.addProperty(set));   // all marking sets are deleted
  }
  return undefined;
}
export { Group, rigState, ROW, setVisible };
