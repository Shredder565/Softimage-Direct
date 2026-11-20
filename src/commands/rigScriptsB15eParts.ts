// Ledger row CMD-B15e (Character Rigging script commands), part 1: the small builders and the key-set commands.
//   MakeRigIcon MakeHip MakeBicepRoll MakeForearmRoll Make2PointSlide MakeThighSlide MakeJointCompression MakeBelly
//   MakeShadowChain MakeShadowSpine MakeBipedCharacterKeySet MakeQuadrupedCharacterKeySet SetKeyableRig GetSkeleton
// Brief: docs/ghidra/cmd-b15e-character-rigging-scripts.md §3.1, §3.15-3.25 ("Wire contract") and
// docs/re/WIRE_CORRECTIONS_B15.md items 35-37. GetSkeleton (kinechain.dll, C++) is wired from what the notes state
// about it (cmd-b5f §AppendBone and §3.22 here): the skeleton collection of a chain element and the element's index.
// Original code written from that prose only; see rigScriptsB15eShared.ts for the mapping onto this build.
import { App } from '../core/commands';
import { X3DObject, Property } from '../core/scene';
import { Parameter, num } from '../core/params';
import { circleCurve } from '../core/curves';
import {
  CAT, THREE, Vec, v3, wpos, translation, frame, setGlobal, objArg, objsArg, strArg, numArg, intArg, boolArg, logError, logInfo, logWarn,
  logNya, rigState, mkNull, curveObj, implicitObj, customProp, setP, setColor, cns, scriptOp, hideSetup, modelOf, markingSet,
  drawChain, setChainScale, colorChain, skeletonOf, boneLength, rigIcon, expression, upVector, reparent, pickPosition, markingSetsOf,
  setKeyable, curvePoint, addProxy,
} from './rigScriptsB15eShared';

const G = '{F1D7703B-083A-42B9-841D-49FE3779CECD}';

// ------------------------------------------------------------------ shared pieces used by the limb builders too
/** HipPlate: circle curve (colour 49) with the HipIcon operator (note §3.7 / §3.21 parameter values). */
export function hipPlate(app: App, command: string, parent: X3DObject | null, M: THREE.Matrix4, top: Vec, side: Vec): X3DObject {
  const hp = curveObj(app, 'HipPlate', parent, [circleCurve(1)], M); setColor(hp, 49);
  const inv = hp.globalMatrix().invert(); const t = top.clone().applyMatrix4(inv), s = side.clone().applyMatrix4(inv);
  scriptOp(app, command, 'HipIcon', hp, [], {
    spine_pointx: t.x, spine_pointy: t.y, spine_pointz: t.z, leg_pointx: s.x, leg_pointy: s.y, leg_pointz: s.z,
    height: 1.3, indent_height: 0.5, top_height: 0.4, socket_height: 0.3, socket_depth: 0.5, socket_width: 0.5, depth: 0.4, cap_width: 0.25, width: 0.7,
  });
  return hp;
}

/** MakeShadowChain core (note §3.22). */
export function makeShadowChain(app: App, chainIn: X3DObject[], shadowParent: X3DObject | null, si3d: boolean, iconScale: number, nullShadow: boolean, keySet: string): any {
  const C = 'makeShadowChain';
  if (!shadowParent) { logInfo(app, `${C}: argument 0 is invalid`); return undefined; }
  let scale = iconScale; if (scale === 0) { logWarn(app, `${C}: shadow scale cannot be zero, using scale of 1.0`); scale = 1.0; }
  let chain = chainIn; if (chain.length === 1) chain = skeletonOf(chain[0]) ?? chain;
  const out: any = { Hidden: [], Envelope: [], Scale: scale, ShadowModel: modelOf(shadowParent), ShadowCharacterSetName: keySet, Chain: chain, Parent: shadowParent, SI3D: si3d, ShadowEnds: [], Shadows: [] };
  const bonesSrc = chain.filter(e => e.type === 'bone');
  if (!nullShadow) {
    const root0 = chain[0]; const zAxis = new THREE.Vector3().setFromMatrixColumn(root0.globalMatrix(), 2);
    const pts = [...bonesSrc, chain[chain.length - 1]].map(wpos);   // joint positions (the root sits at the first bone)
    const c = drawChain(app, null, pts, zAxis, 3, { root: root0.name, bones: bonesSrc.map(b => b.name), eff: chain[chain.length - 1].name });
    reparent(app, c.root, shadowParent);
    if (bonesSrc[0]) setGlobal(c.bones[0], bonesSrc[0].globalMatrix());
    colorChain(c, 805); setChainScale(c, scale);
    if (si3d) { setP(c.eff, 'cnsori', false); setP(c.eff, 'cnspos', false); }
    if (chain.length > 4 && Number(bonesSrc[0]?.get('chntype')?.value ?? 0) === 2) c.bones.forEach((b, i) => { setP(b, 'chntype', Number(bonesSrc[i]?.get('chntype')?.value ?? 0)); for (const a of ['x', 'y', 'z']) setP(b, 'prefrot' + a, Number(bonesSrc[i]?.get('prefrot' + a)?.value ?? 0)); });
    c.bones.forEach((b, i) => { if (bonesSrc[i]) cns(app, b, 'Pose', [bonesSrc[i]], true); markingSet(app, b, false, true, '', keySet); });
    out.Hidden.push(c.root, c.eff); out.Envelope.push(...c.bones);
    Object.assign(out, { Root: c.root, Skel: c.skel, ShadowStart: c.root, ShadowEnds: [c.bones[c.bones.length - 1]], Shadows: c.skel });
  } else {
    let parent: X3DObject = shadowParent; const nulls: X3DObject[] = [];
    for (const b of bonesSrc) {
      const n = mkNull(app, b.name, parent, b.globalMatrix(), { color: 381, size: scale * 0.3 });
      cns(app, n, 'Pose', [b], false); markingSet(app, n, false, true, '', keySet); nulls.push(n); parent = n;
    }
    out.Envelope.push(...nulls);
    Object.assign(out, { Root: nulls[0] ?? null, Skel: nulls, ShadowStart: nulls[0] ?? null, ShadowEnds: nulls.length ? [nulls[nulls.length - 1]] : [], Shadows: nulls });
  }
  Object.assign(out, hideSetup(app, out.ShadowModel, out.Hidden, out.Envelope, true));
  return out;
}

/** MakeBicepRoll core (note §3.16). */
export function makeBicepRoll(app: App, bicep: X3DObject, prefix: string, n: number) {
  const L = (n + 1) / (n + 2); const len = boneLength(bicep); const divs: X3DObject[] = [];
  for (let i = 1; i <= n; i++) {
    const perc = L * (i - 1) / n; const M = bicep.globalMatrix().multiply(translation(v3(len * perc, 0, 0)));
    const d = mkNull(app, `${prefix}Roll${i}`, bicep.parentObj, M, { color: 421, size: 0.3 });
    scriptOp(app, 'makeBicepRoll', 'FirstBoneRollDivisionRO', d, [d, bicep], { length_perc: perc, mySlerp: i / (n + 2) });
    divs.push(d);
  }
  const last = mkNull(app, `${prefix}Roll_${n + 1}`, bicep, bicep.globalMatrix(), { color: 421, size: 0.3 });
  expression(app, last, 'posx', `${bicep.fullName}.bone.length * ${L}`, len * L);
  divs.push(last);
  return { Nb: n, Divisions: divs };
}

// ------------------------------------------------------------------ registration
export function registerRigScriptsB15ePartCommands(app: App) {
  // ---------------------------------------------------------------- MakeRigIcon (§3.1)
  app.register({
    name: 'MakeRigIcon', label: 'Make Rig Icon', category: CAT, description: 'Create Rig Icon',
    args: [{ name: 'Parent', default: G }, { name: 'Type', default: 5 }, { name: 'X', default: 0.0 }, { name: 'Y', default: 0.0 }, { name: 'Z', default: 0.0 }, { name: 'Xlength', default: 1.0 }, { name: 'Ylength', default: 1.0 }, { name: 'Zlength', default: 1.0 }, { name: 'Color', default: 65 }, { name: 'Name', default: '' }, { name: 'XOffset', default: 0.0 }, { name: 'YOffset', default: 0.0 }, { name: 'ZOffset', default: 0.0 }],
    execute(app, a) {
      const o = rigIcon(app, 'MakeRigIcon', objArg(app, a.Parent), intArg(a.Type, 5), v3(numArg(a.X, 0), numArg(a.Y, 0), numArg(a.Z, 0)), [numArg(a.Xlength, 1), numArg(a.Ylength, 1), numArg(a.Zlength, 1)], intArg(a.Color, 65), strArg(a.Name), [numArg(a.XOffset, 0), numArg(a.YOffset, 0), numArg(a.ZOffset, 0)]);
      if (o) app.select([o]);
      return o;
    },
  });

  // ---------------------------------------------------------------- MakeHip (§3.21)
  app.register({
    name: 'MakeHip', label: 'Make Hip', category: CAT, description: 'Create Hip Icon',
    args: [{ name: 'GuideObj', default: G }, { name: 'TopX', default: 0.0 }, { name: 'TopY', default: 0.0 }, { name: 'TopZ', default: 0.0 }, { name: 'SideX', default: 1.0 }, { name: 'SideY', default: 1.0 }, { name: 'SideZ', default: 1.0 }],
    execute(app, a) {
      const C = 'MakeHip'; const guide = objArg(app, a.GuideObj);
      let M: THREE.Matrix4, top: Vec, side: Vec;
      if (guide) { M = guide.globalMatrix(); top = v3(numArg(a.TopX, 0), numArg(a.TopY, 0), numArg(a.TopZ, 0)); side = v3(numArg(a.SideX, 1), numArg(a.SideY, 1), numArg(a.SideZ, 1)); }
      else {
        const sel = app.selectedObjects[0];
        if (!sel) { logError(app, 'Hip Maker Cancel, Requires and Object Selection to define Hip Transform'); return undefined; }
        M = sel.globalMatrix();
        const t = pickPosition(app, C, 'Pick Top of Hip Position'); if (!t) return undefined;
        const s = pickPosition(app, C, 'Pick Side of Hip Position'); if (!s) return undefined;
        top = t; side = s;
      }
      return hipPlate(app, 'makeHip', null, M, top, side);
    },
  });

  // ---------------------------------------------------------------- MakeBicepRoll (§3.16)
  app.register({
    name: 'MakeBicepRoll', label: 'Make Bicep Roll', category: CAT, description: 'Create Two Point Slide',
    args: [{ name: 'Bicep', default: G }, { name: 'Prefix', default: '' }, { name: 'NbDivisions', default: 3 }],
    execute(app, a) {
      const bicep = objArg(app, a.Bicep);
      // No validation in the script: a missing bone is a script error.
      if (!bicep) throw new Error('MakeBicepRoll: script error: the Bicep argument is not an object (the script does not validate it)');
      return makeBicepRoll(app, bicep, strArg(a.Prefix), Math.max(0, intArg(a.NbDivisions, 3)));
    },
  });

  // ---------------------------------------------------------------- MakeForearmRoll (§3.17)
  app.register({
    name: 'MakeForearmRoll', label: 'Make Forearm Roll', category: CAT, description: 'Create Forearm Roll Divisions',
    args: [{ name: 'Bicep', default: G }, { name: 'Forearm', default: G }, { name: 'ArmEff', default: G }, { name: 'HandEff', default: G }, { name: 'HandBone', default: G }, { name: 'Prefix', default: '' }, { name: 'NbDivisions', default: 3 }, { name: 'RollOffset', default: 0.0 }],
    execute(app, a) {
      const objs = [a.Bicep, a.Forearm, a.ArmEff, a.HandEff, a.HandBone].map(x => objArg(app, x));
      let bad = false; objs.forEach((o, i) => { if (!o) { logError(app, `makeForearmRoll: argument ${i} is invalid`); bad = true; } });
      if (bad) return undefined;
      const [bicep, forearm, armEff, handEff, handBone] = objs as X3DObject[]; const prefix = strArg(a.Prefix); const n = Math.max(1, intArg(a.NbDivisions, 3));
      const sliders = customProp(app, handBone, 'Roll_Compensation', [num('roll_offset', 0, 'roll_offset', { min: -360, max: 360, uimin: -180, uimax: 180 } as any)]);
      const roll = sliders.get('roll_offset')!; roll.value = numArg(a.RollOffset, 0);
      const len = boneLength(forearm); const divs: X3DObject[] = [];
      for (let i = 0; i < n; i++) {
        const d = mkNull(app, i === 0 ? `${prefix}Elbow` : `${prefix}ForearmRoll`, forearm, forearm.globalMatrix().multiply(translation(v3(len * i / n, 0, 0))), { color: 544 });
        scriptOp(app, 'makeForearmRoll', 'ForeArmRollDivision', d, [d, bicep, forearm, armEff, handEff, handBone], { blend: 1 - i / n, compensation: roll.value });
        expression(app, d, 'posx', `${forearm.fullName}.bone.length * ${i}/${n}`, len * i / n); expression(app, d, 'posy', '0', 0); expression(app, d, 'posz', '0', 0);
        divs.push(d);
      }
      return { Sliders: sliders, RollOffset: roll, Nb: n, Divisions: divs };
    },
  });

  // ---------------------------------------------------------------- Make2PointSlide (§3.18)
  const make2PointSlide = (app: App, prefix: string, g1: X3DObject | null, g2: X3DObject | null, p1: X3DObject | null, p2: X3DObject | null, upv: X3DObject | null, vol: X3DObject | null) => {
    let bad = false; [g1, g2, p1, p2].forEach((o, i) => { if (!o) { logError(app, `make2PointSlide: argument ${i + 1} is invalid`); bad = true; } });
    if (bad) return undefined;
    const d = wpos(g1!).distanceTo(wpos(g2!));
    const top = mkNull(app, `${prefix}Top`, p1, g1!.globalMatrix(), { color: 472, size: d * 0.05 });
    const base = mkNull(app, `${prefix}Base`, p2, g2!.globalMatrix(), { color: 472, size: d * 0.05 });
    const bind = mkNull(app, `${prefix}Bind`, p1, translation(wpos(g1!).add(wpos(g2!)).multiplyScalar(0.5)), { color: 748, size: d * 0.1 });
    const c = cns(app, bind, '2 Points', [top, base]);
    if (vol) cns(app, bind, 'Bounding Volume', [vol]).set('blendweight', 1);
    if (vol) (bind.properties[bind.properties.length - 1] as any).bndType = 1;
    if (upv) (c as any).UpVectorReference = upv;
    const model = modelOf(p1);
    const hs = hideSetup(app, model, [top, base], [bind]);
    return { model, Hidden: [top, base], Envelope: [bind], BindNull: bind, TopNull: top, BaseNull: base, Constraint: c, ...hs };
  };
  app.register({
    name: 'Make2PointSlide', label: 'Make Two Point Slide', category: CAT, description: 'Create Two Point Slide',
    args: [{ name: 'Prefix', default: '' }, { name: 'GuidePoint1', default: G }, { name: 'GuidePoint2', default: G }, { name: 'Parent1', default: G }, { name: 'Parent2', default: G }, { name: 'UpVector', default: G }, { name: 'BoundingVolume', default: G }],
    execute: (app, a) => make2PointSlide(app, strArg(a.Prefix), objArg(app, a.GuidePoint1), objArg(app, a.GuidePoint2), objArg(app, a.Parent1), objArg(app, a.Parent2), objArg(app, a.UpVector), objArg(app, a.BoundingVolume)),
  });

  // ---------------------------------------------------------------- MakeThighSlide (§3.19)
  app.register({
    name: 'MakeThighSlide', label: 'Make Thigh Slide', category: CAT, description: 'Create Thigh Slide',
    args: [{ name: 'Prefix', default: '' }, { name: 'GuideObjectCollection', default: G }, { name: 'UpperParent', default: G }, { name: 'LowerParent', default: G }],
    execute(app, a) {
      const prefix = strArg(a.Prefix); const guides = objsArg(app, a.GuideObjectCollection); const up = objArg(app, a.UpperParent), lo = objArg(app, a.LowerParent);
      let bad = false;
      if (guides.length < 5) { logError(app, 'makeThighSlide: argument 1 is invalid'); bad = true; }
      if (!up) { logError(app, 'makeThighSlide: argument 2 is invalid'); bad = true; }
      if (!lo) { logError(app, 'makeThighSlide: argument 3 is invalid'); bad = true; }
      if (bad) return undefined;
      const P = guides.slice(0, 5).map(wpos); const mid = P[0].clone().add(P[1]).multiplyScalar(0.5);
      const d = P[4].clone().sub(P[3]).normalize();
      const proj = P[2].clone().sub(d.clone().multiplyScalar(P[2].clone().sub(mid).dot(d)));
      // that line (projected hip-side point → back-slide midpoint) meets the X = 0 plane (inferred reading, see the report)
      const dir = mid.clone().sub(proj); const t = Math.abs(dir.x) > 1e-9 ? -proj.x / dir.x : 0; const onX0 = proj.clone().add(dir.multiplyScalar(t));
      const centre = proj.clone().add(onX0).multiplyScalar(0.5); const radius = Math.max(1e-4, centre.distanceTo(mid));
      const M = frame(centre, P[2].clone().sub(centre), d);
      const vol = implicitObj(app, `${prefix}ThighVolume`, 'Sphere', lo, M, radius);
      vol.kinematics.local.set('sclx', centre.distanceTo(P[2]) / radius); vol.kinematics.local.set('scly', 2); vol.kinematics.local.set('sclz', 1); setColor(vol, 728);
      const s = app.run('Make2PointSlide', { Prefix: prefix, GuidePoint1: guides[0], GuidePoint2: guides[1], Parent1: up, Parent2: lo, UpVector: up, BoundingVolume: vol });
      return { Guides: guides, Pos: P, Volume: vol, BindNull: s?.BindNull, TopNull: s?.TopNull, BaseNull: s?.BaseNull };
    },
  });

  // ---------------------------------------------------------------- MakeJointCompression (§3.20)
  app.register({
    name: 'MakeJointCompression', label: 'Make Joint Compression', category: CAT, description: 'Create Joint Compression',
    args: [{ name: 'Prefix', default: '' }, { name: 'UpperBone', default: G }, { name: 'LowerBone', default: G }, { name: 'GuideObjectCollection', default: G }, { name: 'RollDivisionCollection', default: G }],
    execute(app, a) {
      const prefix = strArg(a.Prefix); const ub = objArg(app, a.UpperBone), lb = objArg(app, a.LowerBone); const guides = objsArg(app, a.GuideObjectCollection); const rolls = objsArg(app, a.RollDivisionCollection);
      let bad = false;
      if (!ub) { logError(app, 'makeJointCompression: argument 1 is invalid'); bad = true; }
      if (!lb) { logError(app, 'makeJointCompression: argument 2 is invalid'); bad = true; }
      if (guides.length < 4) { logError(app, 'makeJointCompression: argument 3 is invalid'); bad = true; }
      if (bad) return undefined;
      const [ut, lt, ct, cc] = guides.map(wpos);
      const vol = implicitObj(app, `${prefix}BendVolume`, 'Sphere', lb, translation(cc.clone().add(cc.clone().sub(ct).multiplyScalar(0.25))), cc.distanceTo(ct)); setColor(vol, 728);
      let parent: X3DObject = ub!;
      if (rolls.length) parent = rolls.reduce((b, r) => (wpos(r).distanceTo(ut) < wpos(b).distanceTo(ut) ? r : b), rolls[0]);
      const size = ut.distanceTo(lt) * 0.4; const mk = (nm: string, g: X3DObject) => {
        const m = g.globalMatrix(); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
        const n = mkNull(app, nm, parent, new THREE.Matrix4().compose(p, q, v3(1, 1, 1)), { color: 748, size });
        cns(app, n, 'Pose', [parent], true); cns(app, n, 'Bounding Volume', [vol]); return n;
      };
      const uj = mk(`${prefix}UpperJoint`, guides[0]), lj = mk(`${prefix}LowerJoint`, guides[1]);
      const model = modelOf(ub); const hs = hideSetup(app, model, [], [uj, lj]);
      return { UpperBone: ub, LowerBone: lb, UpperTarget: guides[0], LowerTarget: guides[1], CurveTarget: guides[2], CurveCenter: guides[3], model, Envelope: [uj, lj], Volume: vol, UpperJoint: uj, LowerJoint: lj, envGroup: hs.envGroup };
    },
  });

  // ---------------------------------------------------------------- MakeBelly (§3.15)
  app.register({
    name: 'MakeBelly', label: 'Make Belly', category: CAT, description: 'Create Belly Rig',
    args: [{ name: 'HipObject', default: G }, { name: 'VertebraObject', default: G }, { name: 'GuideObjectCollection', default: G }, { name: 'ForwardRotationPerc', default: 0.25 }],
    execute(app, a) {
      const hip = objArg(app, a.HipObject), vert = objArg(app, a.VertebraObject); const guides = objsArg(app, a.GuideObjectCollection); const perc = numArg(a.ForwardRotationPerc, 0.25);
      if (!hip) { logInfo(app, 'makeBelly: argument 0 is invalid'); return undefined; }
      if (!vert) { logInfo(app, 'makeBelly: argument 1 is invalid'); return undefined; }
      if (guides.length !== 2) { logInfo(app, `makeBelly: Guide collection needs 2 objects. Collection has ${guides.length} objects`); throw new Error('MakeBelly: script error: the guide-count error path returns an undefined variable (shipped defect, note §4 item 4)'); }
      const hipPos = wpos(hip), vertPos = wpos(vert), lowerPos = wpos(guides[0]), upperPos = wpos(guides[1]);
      const startOf = (from: Vec, to: Vec) => { const s = from.clone().lerp(to, perc); const l = s.distanceTo(to); if (l <= 0.05) s.add(from.clone().sub(s).normalize().multiplyScalar(0.015)); return s; };
      const startLower = startOf(hipPos, lowerPos), startUpper = startOf(vertPos, upperPos);
      const belly = drawChain(app, null, [lowerPos, upperPos], v3(0, 90, 0), 1, { root: 'BellyRoot', bones: ['Belly'], eff: 'BellyEff' });
      const upper = drawChain(app, vert, [startUpper, upperPos], null, 3, { root: 'UpperBellyRoot', bones: ['UpperBellyBone'], eff: 'UpperBellyEff' });
      const lower = drawChain(app, hip, [startLower, lowerPos], null, 3, { root: 'LowerBellyRoot', bones: ['LowerBellyBone'], eff: 'LowerBellyEff' });
      reparent(app, belly.root, lower.eff); upVector(app, belly.bones[0], hip); cns(app, belly.eff, 'Position', [upper.eff]);
      const scale = (boneLength(upper.bones[0]) + boneLength(lower.bones[0])) / 2 * 0.1; const springScale = scale * 0.4;
      setChainScale(belly, scale * 2); setChainScale(upper, springScale); setChainScale(lower, springScale);
      belly.skel.forEach(e => setP(e, 'shadow_icon', 6)); [...upper.skel, ...lower.skel].forEach(e => setP(e, 'shadow_icon', 7));
      const hidden = [belly.root, belly.eff, upper.root, upper.eff, lower.root, lower.eff]; const env = [belly.bones[0]];
      const model = modelOf(hip); const hs = hideSetup(app, model, hidden, env);
      for (const s of [upper, lower]) { try { app.run('ApplySpringOp', { InputObjs: [s.eff, s.root] }); } catch { logNya(app, 'MakeBelly', 'ApplySpringOp on the spring chain (this build\'s ApplySpringOp refused the effector/root pair)'); } }
      return {
        Guides: guides, Hip: hip, Vertebra: vert, Model: model, Perc: perc, Hidden: hidden, Envelope: env, hipPos, vertPos, lowerPos, upperPos, startLower, startUpper,
        BellyRoot: belly.root, BellySkel: belly.skel, BellyEff: belly.eff, BellyBone: belly.bones[0], UpperRoot: upper.root, UpperSkel: upper.skel, UpperEff: upper.eff, UpperBone: upper.bones[0],
        LowerRoot: lower.root, LowerSkel: lower.skel, LowerEff: lower.eff, LowerBone: lower.bones[0], Scale: scale, SpringScale: springScale, ...hs,
      };
    },
  });

  // ---------------------------------------------------------------- MakeShadowChain (§3.22)
  app.register({
    name: 'MakeShadowChain', label: 'Make Shadow Chain', category: CAT, description: 'Create Shadow Chain',
    args: [{ name: 'Chain', default: G }, { name: 'ShadowParent', default: G }, { name: 'SI3DStyleChain', default: false }, { name: 'IconScale', default: 1.0 }, { name: 'ShadowType', default: 0 }, { name: 'ShadowCharacterSetName', default: '' }],
    execute(app, a) {
      const chain = objsArg(app, a.Chain); const parent = objArg(app, a.ShadowParent);
      if (!chain.length && parent) { logInfo(app, 'makeShadowChain: argument 0 is invalid'); return undefined; }
      // WIRE_CORRECTIONS_B15 item 37: the registry's ShadowType means "null shadow" (non-zero → null hierarchy).
      return makeShadowChain(app, chain, parent, boolArg(a.SI3DStyleChain, false), numArg(a.IconScale, 1), numArg(a.ShadowType, 0) !== 0, strArg(a.ShadowCharacterSetName));
    },
  });

  // ---------------------------------------------------------------- MakeShadowSpine (§3.23)
  app.register({
    name: 'MakeShadowSpine', label: 'Make Shadow Spine', category: CAT, description: 'Create Shadow Spine',
    args: [{ name: 'Spline', default: G }, { name: 'Base', default: G }, { name: 'Vertebra', default: G }, { name: 'TopVertebra', default: G }, { name: 'ShadowParent', default: G }, { name: 'ChestTop', default: G }, { name: 'IconScale', default: 1.0 }, { name: 'ShadowType', default: 1 }, { name: 'ShadowCharacterSetName', default: '' }],
    execute(app, a) {
      const spline = objArg(app, a.Spline), base = objArg(app, a.Base), verts = objsArg(app, a.Vertebra), top = objArg(app, a.TopVertebra);
      let bad = false; [spline, base, verts.length ? verts[0] : null, top].forEach((o, i) => { if (!o) { logError(app, `makeShadowSpine: argument ${i} is invalid`); bad = true; } });
      if (bad) return undefined;
      const parent = objArg(app, a.ShadowParent) ?? app.scene.root; const chestTop = objArg(app, a.ChestTop); const scale = numArg(a.IconScale, 1); const type = intArg(a.ShadowType, 1); const ks = strArg(a.ShadowCharacterSetName);
      const out: any = { ShadowHidden: [], ShadowEnvelope: [], Hidden: [], Envelope: [], Base: base, Spline: spline, Vertebra: verts, TopVertebra: top, Parent: parent, ShadowModel: modelOf(parent), RigModel: modelOf(spline), ChestTop: chestTop, Scale: scale, ShadowCharacterSetName: ks, ShadowEnds: [], UpVectors: [], Shadows: [] };
      if (type === 1 || type === 2) {
        const count = verts.length + 1 + (chestTop ? 0 : 1);
        const pts = Array.from({ length: count }, (_, i) => curvePoint(spline!, i / Math.max(1, count - 1)));
        const nb = pts.length - 1; const boneNames = Array.from({ length: nb }, (_, i) => (!chestTop && i === nb - 1 ? 'Chest' : `Spine${i + 1}`));
        const c = drawChain(app, parent, pts, v3(1, 0, 0), 2, { root: 'SpineRoot', bones: boneNames, eff: 'ChestEffector' });
        colorChain(c, 805); setChainScale(c, scale);
        c.bones.forEach((b, i) => { const pc = cns(app, b, 'Curve (Path)', [spline!]); pc.set('perc', (100 * i) / nb); (pc as any).locked = true; markingSet(app, b, false, true, '', ks, 'shadowSpine'); });
        cns(app, c.eff, chestTop ? 'Position' : 'Pose', [top!]);
        if (type === 1) { setP(c.eff, 'cnsori', false); setP(c.eff, 'cnspos', false); }
        const ups: X3DObject[] = [];
        [...verts, top!].forEach((vtx, i) => { const u = mkNull(app, 'Shadow_upVa', vtx, vtx.globalMatrix().multiply(translation(v3(0, scale, 0))), { size: scale * 0.1 }); ups.push(u); if (c.bones[i]) upVector(app, c.bones[i], u); });
        out.Hidden.push(...ups, c.root, c.eff); out.Envelope.push(...c.bones);
        Object.assign(out, { Root: c.root, Skel: c.skel, UpVectors: ups, ShadowStart: c.root, ShadowEnds: [c.bones[c.bones.length - 1]], Shadows: [...c.skel] });
        if (chestTop && verts.length > 1) {
          const last = c.bones[c.bones.length - 1]; const c2 = drawChain(app, last, [wpos(c.eff), wpos(chestTop)], v3(1, 0, 0), 2, { root: 'ChestRoot', bones: ['Chest'], eff: 'ChestEffector' });
          colorChain(c2, 805); setChainScale(c2, scale); cns(app, c2.root, 'Position', [top!]); cns(app, c2.bones[0], 'Pose', [top!], true); markingSet(app, c2.bones[0], false, true, '', ks, 'shadowSpine');
          out.Hidden.push(c2.root, c2.eff); out.Envelope.push(c2.bones[0]);
          Object.assign(out, { Root2: c2.root, Skel2: c2.skel, ShadowEnds: [c2.bones[0]] }); out.Shadows.push(...c2.skel);
        }
      } else if (type === 3) {
        const src = [base!, ...verts, top!]; const nulls: X3DObject[] = []; let p: X3DObject = base!;
        for (const s of src) { const n = mkNull(app, s.name, p, s.globalMatrix(), { color: 381, size: scale * 0.3 }); cns(app, n, 'Pose', [s], false); nulls.push(n); p = n; }
        out.Envelope.push(...nulls); Object.assign(out, { Root: nulls[0], Skel: nulls, ShadowStart: nulls[0], ShadowEnds: [nulls[nulls.length - 1]], Shadows: nulls });
      }
      out.ShadowHidden = out.Hidden; out.ShadowEnvelope = out.Envelope;
      Object.assign(out, hideSetup(app, out.ShadowModel, out.Hidden, out.Envelope, true));
      return out;
    },
  });

  // ---------------------------------------------------------------- GetSkeleton (kinechain.dll; facts from cmd-b5f / §3.22)
  app.register({
    name: 'GetSkeleton', label: 'Get Skeleton', category: CAT, description: 'Gets the components of the skeleton this object pertains to and its index among them',
    args: [{ name: 'InputObj', default: null }, { name: 'Index', default: 0 }, { name: 'ChainElements', default: null }],
    undoable: false,
    execute(app, a) {
      const o = objArg(app, a.InputObj) ?? app.selectedObjects[0] ?? null;
      const skel = skeletonOf(o);
      if (!skel) { logNya(app, 'GetSkeleton', 'the result for an object that is not a chain element (empty collection returned)'); rigState(app).lastGetSkeleton = { Index: -1, ChainElements: [] }; return []; }
      const idx = skel.indexOf(o!); rigState(app).lastGetSkeleton = { Index: idx, ChainElements: skel };
      return skel;
    },
  });

  // ---------------------------------------------------------------- character key sets (§3.24, §3.25)
  const KS_FLAGS = ['kine.local.scl', 'kine.local.ori', 'kine.local.pos', 'kine.posecns'];
  const clearKeyable = (app: App, objs: X3DObject[]) => {
    for (const o of objs) { const l = o.kinematics.local; for (const n of ['sclx', 'scly', 'sclz', 'rotx', 'roty', 'rotz', 'posx', 'posy', 'posz']) setKeyable(app, l.get(n), false); for (const c of o.properties) if (c.type === 'posecns') for (const p of c.params) setKeyable(app, p, false); }
    void KS_FLAGS;
  };
  const markListed = (app: App, ms: Property) => {
    const owner = ms.parent as X3DObject; const masters = ms.params.map(p => (p as any).proxied as Parameter | undefined).filter((p): p is Parameter => !!p);
    if (masters.some(p => /^rot[xyz]$/.test(p.name))) for (const n of ['rotx', 'roty', 'rotz']) setKeyable(app, owner.kinematics.local.get(n), true);
    if (masters.some(p => /^pos[xyz]$/.test(p.name))) for (const n of ['posx', 'posy', 'posz']) setKeyable(app, owner.kinematics.local.get(n), true);
    return masters;
  };
  const allMarkingSets = (model: X3DObject) => [model, ...model.descendants()].flatMap(markingSetsOf);
  const deleteMarkingSets = (app: App, sets: Property[]) => { for (const ms of sets) { const o = ms.parent as X3DObject; if (o) app.record('DeleteObj MarkingSet', () => o.removeProperty(ms), () => o.addProperty(ms)); } };
  const keySetApi = (app: App) => (app as any).characterKeySets as { create(owner: X3DObject, name: string, cur?: boolean): Property; addProxies(ks: Property, p: any): Parameter[]; siName(x: any): string; lookup(n: string): any };
  /** AddProxyParamToCharacterKeySet for each master (once per key set; proxy naming as src/commands/characterKeySets.ts). */
  const proxyInto = (ks: Property, masters: Parameter[]) => {
    const api = keySetApi(app);
    for (const m of masters) { if (ks.params.some(p => (p as any).proxied === m)) continue; const px = addProxy(ks, m, api.siName(m).replace(/[^\w]/g, '_')); app.record('AddProxyParam', () => { if (!ks.params.includes(px)) { ks.params.push(px); (ks as any).byName?.set(px.name, px); } }, () => { ks.params.splice(ks.params.indexOf(px), 1); (ks as any).byName?.delete(px.name); }); }
  };
  const populate = (app: App, cmd: string, model: X3DObject, set: Property, used: Set<Property>, toDelete: Set<Property>, suffix: string) => {
    const api = keySetApi(app); const full = api.siName(set);
    for (const ms of allMarkingSets(model)) {
      const ksp = ms.get('CharacterKeySet');
      if (!ksp) { logInfo(app, `MarkingSet - ${ms.fullName} - not included in Character Key Set`); continue; }
      const masters = markListed(app, ms); const name = String(ksp.value ?? '');
      if (name.startsWith('None')) { toDelete.add(ms); continue; }
      const dot = name.indexOf('.');
      if (dot >= 0) {
        const A = name.slice(0, dot), B = name.slice(dot + 1);
        if (!full.includes(A)) continue;
        const subName = `${full}.${B}${suffix}`; const sub = api.lookup(subName);
        if (!sub) { logInfo(app, `Error setting CharacterSubSet - ${subName}`); continue; }
        proxyInto(sub, masters); used.add(ms);
      } else if (full.includes(name)) { proxyInto(set, masters); used.add(ms); }
    }
    void cmd;
  };
  const makeKeySet = (app: App, cmd: string, a: any, quad: boolean) => {
    const root = objArg(app, a.RootObject);
    if (!root) { logInfo(app, `${cmd}: argument 0 is invalid`); return undefined; }
    const api = keySetApi(app); if (!api) { logNya(app, cmd, 'character key sets (CMD-01d helpers are not loaded)'); return undefined; }
    const pre = strArg(a.Prefix), suf = strArg(a.Suffix); const nm = (n: string) => pre + n + suf;
    const model = root.model ?? app.scene.root;
    clearKeyable(app, [...model.descendants()]);
    const saved = app.autoInspect; app.autoInspect = false; app.select([]);
    const top = api.create(model, nm(strArg(a.CharacterKeySetName, 'CharSet')), true); (top as any).rigRootObject = root;
    const used = new Set<Property>(), toDelete = new Set<Property>();
    populate(app, cmd, model, top, used, toDelete, suf);
    const tree: [string, string[]][] = quad ? [['Upper', ['Torso', 'Head_Neck']], ['Lower', ['L_Leg', 'R_Leg', 'BL_Leg', 'BR_Leg', 'Tail']]] : [['Upper', ['R_Arm', 'L_Arm', 'R_Hand', 'L_Hand', 'Torso', 'Head_Neck']], ['Lower', ['L_Leg', 'R_Leg']]];
    const level1: Property[] = [];
    for (const [n] of tree) { const r = app.run('CreateSubCharacterKeySet', { CharacterKeySet: top, InputObjs: null, Name: nm(n) }); const ks = Array.isArray(r) ? r[0] : r; if (ks) { dropProxies(ks); level1.push(ks); } }
    tree.forEach(([, kids], i) => { const parent = level1[i]; if (!parent) return; for (const k of kids) { const r = app.run('CreateSubCharacterKeySet', { CharacterKeySet: parent, InputObjs: null, Name: nm(k) }); const ks = Array.isArray(r) ? r[0] : r; if (ks) dropProxies(ks); } });
    for (const ks of level1) populate(app, cmd, model, ks, used, toDelete, suf);
    app.autoInspect = saved;
    if (boolArg(a.DeleteMarkingSet, false)) deleteMarkingSets(app, [...used, ...toDelete]);
    return top;
  };
  /** "then remove all parameters": the proxies CreateSubCharacterKeySet may have added. */
  function dropProxies(ks: Property) { for (const p of [...ks.params]) if ((p as any).proxied) { ks.params.splice(ks.params.indexOf(p), 1); (ks as any).byName?.delete(p.name); } }
  const ksArgs = [{ name: 'RootObject', default: G }, { name: 'CharacterKeySetName', default: 'CharSet' }, { name: 'DeleteMarkingSet', default: false }, { name: 'Prefix', default: '' }, { name: 'Suffix', default: '' }];
  app.register({ name: 'MakeBipedCharacterKeySet', label: 'Make Biped Character Key Set', category: CAT, description: 'Creates a Character Key Set hierarchy', args: ksArgs, execute: (app, a) => makeKeySet(app, 'makeBipedCharacterKeySet', a, false) });
  app.register({ name: 'MakeQuadrupedCharacterKeySet', label: 'Make Quadruped Character Key Set', category: CAT, description: 'Creates a Character Key Set hierarchy', args: ksArgs, execute: (app, a) => makeKeySet(app, 'makeQuadrupedCharacterKeySet', a, true) });
  app.register({
    name: 'SetKeyableRig', label: 'Set Keyable Rig', category: CAT, description: 'Sets the keyable parameters from the marking sets on a rig.',
    args: [{ name: 'RootObject', default: G }],
    execute(app, a) {
      const root = objArg(app, a.RootObject);
      if (!root) { logInfo(app, 'makeBipedCharacterKeySet: argument 0 is invalid'); return undefined; }
      clearKeyable(app, [...root.descendants()]);
      const model = root.model ?? app.scene.root; const sets = allMarkingSets(model);
      for (const ms of sets) markListed(app, ms);
      deleteMarkingSets(app, sets);
      return undefined;
    },
  });
}
