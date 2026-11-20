// Ledger row CMD-B15e: whole-rig builders (note sections 3.2-3.6): MakeBiped, MakeBipedDogLeg, MakeQuadruped, plus the
// stand-in guide models (Biped_Guide, Biped_DogLeg_Guide, Quadruped_Guide) with the guide names the note lists.
// WIRE_CORRECTIONS_B15 item 35: SelectUsingUI false (default) = the modal dialog (stand-in here: the arguments are ignored
// and the default option values are applied, logged; inferred). The VBScript UI wrapper entries (MakeBipedUI /
// MakeBipedDogLegUI / MakeQuadrupedUI) are registered as the same builder; which of the two registrations is live is not
// stated (SPEC-PARTIAL for the biped files): this build keeps one registration per name.
// Item 36: MakeBiped passes its HeadType as MakeHead's AssemblyType. Item 37: MakeDogLeg / MakeQuadruped call MakeFoot
// without ThreeBoneToe (two-bone toes).
import { App } from '../core/commands';
import { Model } from '../core/scene';
import {
  THREE, X3DObject, v3, gpos, dist, setP, setPs, setVisible, setGlobalPos, mkNull, mkModel, mkGroup, groupOf, constrain, customProp, markingSet, logError, logInfo, logWarn, logNya, dialogStandIn,
  numArg, intArg, boolArg, objOf, unset, guideLookup, guideModels, rigState, siFull, neutralPose, Property,
} from './rigScriptsB15eKit';
import { makeRigIcon, makeBelly, make2PointSlide, makeThighSlide, makeJointCompression, makeBipedKeySet, makeQuadrupedKeySet, setKeyableRig, makeShadowChain } from './rigScriptsB15eLeaf';
import { makeTorso, makeHead, makeHand, makeArm, makeLeg, makeFoot, makeDogLeg } from './rigScriptsB15eLimbs';

type Kind = 'biped' | 'dog' | 'quad';
const sides = ['R', 'L'] as const;

// ------------------------------------------------------------------ stand-in guides
/** Creates a guide model with the guide names the note lists (positions are an original proportional layout). */
export function makeRigGuide(app: App, kind: Kind, name?: string): Model {
  const nm = name ?? (kind === 'biped' ? 'Biped_Guide' : kind === 'dog' ? 'Biped_DogLeg_Guide' : 'Quadruped_Guide');
  const model = new Model(nm); app.scene.root.addChild(model); app.record('Add guide', () => {}, () => {});
  const put = (n: string, x: number, y: number, z: number) => { const o = mkNull(app, n, model, v3(x, y, z), 0.2); return o; };
  if (kind === 'quad') {
    put('SpineBase', 0, 5, -3); put('SpineHipDepth', 0, 5.1, -2.5); put('SpineChestDepth', 0, 5.2, 2); put('RibCageEnd', 0, 5.3, 3); put('RibCageStart', 0, 5.2, 2.5);
    put('Neck', 0, 6.3, 4); put('Head', 0, 6.5, 5.2);
    put('LowerStomach', 0, 4.2, -1); put('UpperStomach', 0, 4.2, 1.5);
    [0, 1, 2, 3].forEach((i, k) => put(['TailStart', 'TailStartDepth', 'TailEndDepth', 'TailEnd'][k], 0, 5 - i * 0.2, -3.5 - i * 1.2));
    for (const [s, x] of [['L', 0.8], ['R', -0.8]] as [string, number][]) {
      put(`${s}Femur`, x, 4.6, -3); put(`B${s}Tibia`, x, 3, -2.7); put(`B${s}Metarsal`, x, 1.8, -3.2);
      put(`B${s}Pivot`, x, 0, -3.3); put(`B${s}PivotRight`, x - 0.3, 0, -3.2); put(`B${s}PivotLeft`, x + 0.3, 0, -3.2);
      for (let i = 1; i <= 6; i++) put(`B${s}HindClaw${i}`, x, 0.6 - i * 0.1, -3.3 + i * 0.4);
      put(`${s}ShoulderStart`, x * 0.5, 5.2, 2.5); put(`${s}Shoulder`, x, 4.5, 2.6); put(`${s}Ulna`, x, 2.7, 2.7);
      put(`F${s}Pivot`, x, 0, 2.9); put(`F${s}PivotRight`, x - 0.3, 0, 2.9); put(`F${s}PivotLeft`, x + 0.3, 0, 2.9);
      for (let i = 1; i <= 4; i++) put(`F${s}Claw${i}`, x, 0.9 - i * 0.2, 2.7 + (i - 1) * 0.35);
      put(`${s}Belly1`, x * 0.5, 4.2, -1); put(`${s}Belly2`, x * 0.5, 4.2, 1.5);
    }
    return model;
  }
  const leg = kind === 'dog' ? 'Femur' : 'Leg';
  put('SpineBase', 0, 5.5, 0); put('SpineHipDepth', 0, 5.4, -0.5); put('SpineChestDepth', 0, 7.5, -0.5); put('RibCageEnd', 0, 8.4, 0); put('RibCageStart', 0, 7.9, 0);
  put('Neck', 0, 9.2, 0.1); put('Head', 0, 10, 0.2); put('REar1', -0.6, 9.8, 0); put('LEar1', 0.6, 9.8, 0); put('REar2', -0.9, 10.3, 0); put('LEar2', 0.9, 10.3, 0);
  put('LowerStomach', 0, 6, 0.3); put('UpperStomach', 0, 7, 0.3);
  for (const [s, x] of [['L', 1], ['R', -1]] as [string, number][]) {
    put(`${s}${leg}`, x * 0.5, 5.2, 0); put(`${s}ShoulderStart`, x * 0.4, 8.2, 0); put(`${s}Shoulder`, x * 1.2, 8.1, 0); put(`${s}Elbow`, x * 3, 8.1, -0.2);
    put(`${s}Hand`, x * 4.8, 8.1, 0); put(`${s}HandEnd`, x * 5.6, 8.1, 0);
    for (const [fi, f] of ['Pinky', 'Ring', 'Middle', 'Index', 'Thumb'].entries()) {
      for (let j = 1; j <= 3; j++) put(`${s}${f}${j}`, x * (5.6 + j * 0.4), 8.1, -0.4 + fi * 0.25);
      put(`${s}${f}_fingerBlade`, x * 5.8, 8.2, -0.4 + fi * 0.25);
    }
    put(`${s}ArmPitTop`, x * 1, 8, 0); put(`${s}ArmPitBase`, x * 1, 7, 0); put(`${s}HipTop`, x * 0.8, 5.6, 0); put(`${s}HipBottom`, x * 0.8, 4.8, 0);
    put(`${s}Rear1`, x * 0.5, 5, -0.5); put(`${s}LowerThigh`, x * 0.5, 4.5, -0.4);
    put(`${s}ElbowJoint2`, x * 3, 8.3, -0.3); put(`${s}ElbowJoint1`, x * 3, 8.3, 0.3); put(`${s}ForeArmSquash`, x * 3.4, 8.2, 0.2); put(`${s}ForeArmCenter`, x * 3.4, 8.1, 0);
    put(`${s}Belly1`, x * 0.4, 6, 0.4); put(`${s}Belly2`, x * 0.4, 7, 0.4);
    if (kind === 'biped') {
      put(`${s}Knee`, x * 0.5, 3, 0.2); put(`${s}Foot1`, x * 0.5, 0.6, 0); put(`${s}Foot2`, x * 0.5, 0.2, 0.7); put(`${s}Foot3`, x * 0.5, 0.1, 1.2); put(`${s}Foot4`, x * 0.5, 0.1, 1.5);
      put(`${s}Pivot`, x * 0.5, 0, 0.1); put(`${s}PivotRight`, x * 0.2, 0, 0.5); put(`${s}PivotLeft`, x * 0.8, 0, 0.5);
      put(`${s}ThighBack1`, x * 0.5, 4.5, -0.5); put(`${s}ThighBack2`, x * 0.5, 4.2, -0.5); put(`${s}CalfBack`, x * 0.5, 2.5, -0.4); put(`${s}CalfCenter`, x * 0.5, 2.5, 0);
    } else {
      put(`${s}Tibia`, x * 0.5, 3.2, 0.2); put(`${s}Metarsal`, x * 0.5, 1.8, -0.2);
      put(`${s}Pivot`, x * 0.5, 0, 0.1); put(`${s}PivotRight`, x * 0.2, 0, 0.5); put(`${s}PivotLeft`, x * 0.8, 0, 0.5);
      for (let i = 1; i <= 6; i++) put(`${s}Foot${i}`, x * 0.5, 0.6 - i * 0.1, i * 0.3);
      put(`${s}ThighBack1`, x * 0.5, 4.5, -0.5); put(`${s}ThighBack2`, x * 0.5, 4.2, -0.5);
    }
  }
  return model;
}

// ------------------------------------------------------------------ defaults / dialog stand-in
const BIPED_DEFAULTS: Record<string, any> = { TorsoType: 1, TorsoStretch: 0, TorsoDivisions: 3, IconType: 0, MakeBelly: false, BellySlide: 0, BellyCenterPercentage: 0.25, HeadType: 0, HeadStretch: 0, HeadDivisions: 3, Ears: false, RotationOrder: 0, ArmSymmetry: 0, ArmAttachment: 0, FingerType: 0, ForeArmRoll: false, ForeArmDivisions: 3, BicepRoll: false, BicepDivisions: 3, ThighRoll: false, ThighDivisions: 3, ArmPitSlide: false, HipSlide: false, ThighSlide: false, ElbowsJoint: false, KneeJoint: false, ShadowType: 0, ShadowHands: 0, OneModel: false, IndependentLower: false, ThreeBoneToes: true, CreateShadowCharacterKeySet: false };
const QUAD_DEFAULTS: Record<string, any> = { TorsoType: 1, TorsoStretch: 0, TorsoDivisions: 3, IconType: 1, MakeBelly: false, BellySlide: 0, BellyCenterPercentage: 0.25, HeadType: 0, HeadStretch: 0, HeadDivisions: 3, Ears: false, MakeTail: true, TailDivisions: 6, FrontRoll: false, FrontRollDivisions: 3, BackRoll: false, BackRollDivisions: 3, ShadowType: 0, CreateShadowKeySet: false };
const TITLE: Record<Kind, string> = { biped: 'Make Biped', dog: 'Make Biped Dog Leg', quad: 'Make Quadruped' };

const armShadow = (st: number, quad = false) => (st === 5 || st === 7 ? 1 : st === 6 ? 4 : st) as number;
const legShadow = (st: number) => (st === 6 || st === 7 ? 1 : st === 5 ? 4 : st) as number;

/** Finds the guide model as the note's lookup rule states; returns null (after logging) when there is none. */
function findGuide(app: App, kind: Kind, fn: string): Model | null {
  if (kind !== 'quad') {
    const m = app.selectedObjects[0]?.model ?? (app.selectedObjects[0] instanceof Model ? app.selectedObjects[0] : null);
    if (m && m !== (app.scene.root as any) && groupOf(app, m, 'DetailedGuide')) return m;
  }
  const name = kind === 'biped' ? 'Biped_Guide' : kind === 'dog' ? 'Biped_DogLeg_Guide' : 'Quadruped_Guide';
  const g = guideModels(app, name); if (g) return g;
  const prop = guideModels(app, kind === 'quad' ? 'Quadruped_PropGuide' : 'BipedPropGuide');
  if (prop) {
    logWarn(app, kind === 'quad' ? `${fn}: This quadruped guide is not compatible with MakeQuadruped, using CreateRigFromQuadruped` : `${fn}: This biped guide is not compatible with ${fn.replace('make', 'Make')} (XSI v4.0), using CreateRigFromGuide`);
    try { app.run(kind === 'quad' ? 'CreateRigFromQuadruped' : 'CreateRigFromGuide', { Guide: prop }); } catch (e: any) { logInfo(app, `${fn}: ${e?.message ?? e}`); }
    return null;
  }
  logError(app, `${fn}: No ${kind === 'quad' ? 'Quadruped' : 'Biped'} Guide Found`);
  return null;
}

// ------------------------------------------------------------------ the builder (biped / biped dog leg / quadruped)
function buildRig(app: App, kind: Kind, a: Record<string, any>): any {
  const fn = kind === 'biped' ? 'makeBiped' : kind === 'dog' ? 'makeBipedDogLeg' : 'makeQuadruped';
  const useArgs = boolArg(a.SelectUsingUI, false);
  let U: Record<string, any>;
  if (useArgs) { U = { ...(kind === 'quad' ? QUAD_DEFAULTS : BIPED_DEFAULTS) }; for (const k of Object.keys(U)) if (a[k] !== undefined && a[k] !== null && !(k === 'CreateShadowCharacterKeySet' && a[k] === undefined)) U[k] = a[k]; if (kind === 'dog') delete U.KneeJoint, delete U.ThreeBoneToes; if (kind === 'dog' && a.CreateShadowKeySet !== undefined) U.CreateShadowKeySet = a.CreateShadowKeySet; }
  else {
    U = { ...(kind === 'quad' ? QUAD_DEFAULTS : BIPED_DEFAULTS) }; if (kind === 'dog') { delete U.KneeJoint; delete U.ThreeBoneToes; }
    dialogStandIn(app, TITLE[kind], U);   // SelectUsingUI false: the dialog is shown and the other arguments are ignored
  }
  if (kind !== 'quad') U.CreateShadowKeySet = !!(useArgs ? (a.CreateShadowKeySet ?? a.CreateShadowCharacterKeySet) : false);
  const guideModel = findGuide(app, kind, fn); if (!guideModel) return undefined;
  const G = guideLookup(guideModel); const quad = kind === 'quad', dog = kind === 'dog';
  const need = (names: string[], what: string): X3DObject[] | null => { const out: X3DObject[] = []; for (const n of names) { const g = G.get(n); if (!g) { logError(app, `${fn}: guide ${n} not found (${what})`); return null; } out.push(g); } return out; };
  const legName = quad ? 'Femur' : dog ? 'Femur' : 'Leg';
  const torsoGuides = need(['SpineBase', 'SpineHipDepth', 'SpineChestDepth', 'RibCageEnd', `L${legName}`, 'LShoulderStart', 'LShoulder', `R${legName}`, 'RShoulderStart', 'RShoulder'], 'torso');
  if (!torsoGuides) return undefined;
  const cDist = quad ? dist(G.get('RibCageEnd')!, G.get('SpineBase')!) : (G.get('RHand') || G.get('LHand')) ? 0 : 0;
  let Scale: number;
  if (quad) Scale = cDist / 1.25; else { const rh = G.get('RHand'), lh = G.get('LHand'); if (!rh || !lh) { logError(app, `${fn}: guide RHand/LHand not found`); return undefined; } Scale = dist(rh, lh) / 1.25; }
  const rigName = quad ? 'Quadruped' : dog ? 'Biped_DogLeg' : 'Biped'; const shadowType = intArg(U.ShadowType, 0); const oneModel = !!U.OneModel && !quad;
  const out: Record<string, any> = { UI: U, modelString: '', ModelString: '', GuideModel: guideModel, keyWords: [], pos: torsoGuides.map(gpos), Scale };
  // ---- step 1: hierarchy
  const model = mkModel(app, rigName);
  const GlobalSRT = makeRigIcon(app, { Parent: model, Type: 4, X: 0, Y: 0, Z: 0, Xlength: Scale * (quad ? 0.2 : 0.09), Ylength: Scale * (quad ? 0.2 : 0.09), Zlength: Scale * (quad ? 0.2 : 0.09), Color: 893, Name: 'GlobalSRT' })!;
  setP(GlobalSRT, 'size', Scale * (quad ? 0.2 : 0.09)); markingSet(app, GlobalSRT, true, true, '', rigName);
  const Controls = customProp(app, model, 'Controls', { help: quad ? 'animtoolbar48.htm' : 'animtoolbar48.htm' });
  const hiddenG = mkGroup(app, model, 'hidden', false), envG = mkGroup(app, model, 'envelope_group'); const ctrlG = quad ? null : (dog ? null : mkGroup(app, model, 'controls_group'));
  if (ctrlG) ctrlG.members.push(GlobalSRT);
  let shModel: X3DObject | null = null, shHidden: any = null, shEnv: any = null, shSRT: X3DObject | null = null;
  const shKey = quad ? 'ShadowQuadruped' : dog ? 'ShadowBiped_DogLeg' : 'ShadowBiped';
  if (shadowType !== 0) {
    shModel = quad ? mkModel(app, shadowType === 1 || shadowType === 2 ? 'Quadruped_Skeleton' : shadowType === 3 ? 'Quadruped_Null' : 'Quadruped_Box') : (oneModel ? model : mkModel(app, `${rigName}_Shadow`));
    const sh = shadowType <= 2 ? 'skel' : shadowType === 3 ? 'null' : 'box';
    shHidden = mkGroup(app, shModel, quad || dog ? 'hidden' : 'Shadow_hidden', false); shEnv = mkGroup(app, shModel, quad || dog ? 'envelope_group' : 'Shadow_envelope_group');
    const color = sh === 'skel' ? 805 : sh === 'null' ? 380 : 479;
    if (quad || dog) { shSRT = makeRigIcon(app, { Parent: shModel, Type: sh === 'skel' ? 7 : sh === 'null' ? 6 : 2, X: 0, Y: 0, Z: 0, Xlength: Scale * 0.08, Ylength: Scale * 0.08, Zlength: Scale * 0.08, Color: color, Name: 'GlobalSRT' })!; }
    else { shSRT = mkNull(app, oneModel ? 'Shadow_GlobalSRT' : 'GlobalSRT', shModel, v3(), Scale * (sh === 'null' || oneModel ? 0.08 : 0.07), color); setP(shSRT, 'primary_icon', 8); }
    markingSet(app, shSRT, true, true, '', shKey); constrain(app, shSRT, 'Pose', [GlobalSRT], { compensation: true });
  }
  const SRT = shSRT; const shParentFor = (o: X3DObject | null | undefined) => (shadowType ? o ?? SRT : null);
  // ---- step 2: torso
  const gl = (n: string) => G.get(n)!;
  const torsoArgs = [...torsoGuides, ...(G.get('RibCageStart') ? [gl('RibCageStart')] : [])];
  const torso: any = makeTorso(app, { Parent: GlobalSRT, NbDivisions: U.TorsoDivisions, StretchType: U.TorsoStretch, GuideObjectCollection: torsoArgs, ControlType: U.IconType, SpineType: quad ? Math.min(U.TorsoType, 2) : U.TorsoType, Sliders: Controls, ShadowType: shadowType, ShadowParent: SRT, NegativeScale: !quad ? (intArg(U.ArmSymmetry, 0) === 0 ? 1 : 0) : 0 });
  if (!torso) { logInfo(app, `${fn}: cancelled`); return undefined; }
  const ctrlAdd = (os: (X3DObject | null | undefined)[]) => { if (ctrlG) for (const o of os) if (o && !ctrlG.members.includes(o)) ctrlG.members.push(o); };
  ctrlAdd([torso.UpperBody, ...(U.TorsoType !== 2 ? [torso.HipDepth, torso.ChestDepth, torso.Hip, torso.Chest] : [])]); hiddenG.members.push(torso.rroot, torso.lroot);
  Object.assign(out, { model, Model: model, GlobalSRT, Sliders: Controls, HiddenGroup: hiddenG, EnvGroup: envG, ControlsGroup: ctrlG, ShadowModel: shModel, ShadowHiddenGroup: shHidden, ShadowEnvGroup: shEnv, ShadowGlobalSRT: shSRT, ShadowHip: null,
    Torso: torso, ChestBone: torso.ChestBone ?? torso.Spine?.TopVertebra ?? torso.Chest, UpperBody: torso.UpperBody, SpineCurve: torso.Spine?.Curve ?? null, HipBone: torso.HipBone, RShoulderEff: torso.REff, LShoulderEff: torso.LEff });
  const chestBone = (out.ChestBone ?? torso.UpperBody) as X3DObject;
  const shEnd = (i: number) => torso.ShadowEnds?.[i] ?? null;
  // ---- hands / arms (biped, dog leg)
  const arm: Record<string, any> = {}, handO: Record<string, any> = {};
  if (!quad) {
    for (const s of ['L', 'R']) {
      const fin: X3DObject[] = [], bl: X3DObject[] = [];
      for (const f of ['Pinky', 'Ring', 'Middle', 'Index', 'Thumb']) { const g = G.get(`${s}${f}1`), b = G.get(`${s}${f}_fingerBlade`); if (g && b) { fin.push(g); bl.push(b); } }
      const hg = need([`${s}Hand`, `${s}HandEnd`], `${s} hand`); if (!hg) continue;
      handO[s] = makeHand(app, { HandParent: torso.UpperBody, FingerGuideCollection: fin, BladeGuideCollection: bl, HandGuideCollection: hg, Prefix: s, FingerBoneType: U.FingerType, ShadowType: armShadow(shadowType) + (U.ShadowHands ? 8 : 0), ShadowParent: shParentFor(shEnd(s === 'R' ? 1 : 2)), NegativeScale: s === 'R' && intArg(U.ArmSymmetry, 0) === 0 });
      if (handO[s]?.Claw) ctrlAdd([handO[s].Claw]);
    }
    for (const s of ['R', 'L']) {
      const ag = need([`${s}Shoulder`, `${s}Elbow`, `${s}Hand`], `${s} arm`); if (!ag) continue;
      const eff = s === 'R' ? torso.REff : torso.LEff; const att = intArg(U.ArmAttachment, 0);
      arm[s] = makeArm(app, { ArmParent: att === 0 ? eff : torso.UpperBody, GuideObjectCollection: ag, Prefix: s, ArmRootConstrainingObj: att === 0 ? null : eff, NbForearmDivisions: U.ForeArmRoll ? U.ForeArmDivisions : 0, NbBicepDivisions: U.BicepRoll ? U.BicepDivisions : 0, ShadowType: armShadow(shadowType), ShadowParent: shParentFor(shEnd(s === 'R' ? 1 : 2)), HandRoot: handO[s]?.Root ?? null, NegativeScale: s === 'R' && intArg(U.ArmSymmetry, 0) === 0 });
      if (!arm[s]) continue;
      if (handO[s]) { handO[s].Root.parentObj !== arm[s].Eff && (setGlobalPos as any); const hr = handO[s].Root as X3DObject; const g = gpos(hr); arm[s].Eff.addChild(hr); setGlobalPos(hr, g); if (arm[s].ShadowEnds?.[0] && handO[s].ShadowStart) { const hs = handO[s].ShadowStart as X3DObject; const gg = gpos(hs); arm[s].ShadowEnds[0].addChild(hs); setGlobalPos(hs, gg); } }
      if (intArg(U.RotationOrder, 0) === 0) arm[s].Skel[1].kinematics.local.set('rotorder', 3);   // YZX on the biceps
      ctrlAdd([arm[s].Eff, arm[s].UpV]);
    }
  }
  // ---- legs / feet / dog legs
  const legO: Record<string, any> = {}, footO: Record<string, any> = {};
  const legSh = legShadow(shadowType); let legShParent: X3DObject | null = shParentFor(shEnd(0)); let shadowHip: X3DObject | null = null;
  if (kind === 'biped' && shSRT && U.IndependentLower) {
    shadowHip = mkNull(app, torso.HipBone.name, torso.ShadowStart ?? shSRT, torso.HipBone, 1.2, 805); setP(shadowHip, 'primary_icon', 4); setP(shadowHip, 'frozen', true); constrain(app, shadowHip, 'Pose', [torso.HipBone]); legShParent = shadowHip; out.ShadowHip = shadowHip;
  }
  if (kind === 'biped') {
    for (const s of ['L', 'R']) {
      const lg = need([`${s}Leg`, `${s}Knee`, `${s}Foot1`], `${s} leg`); if (!lg) continue;
      legO[s] = makeLeg(app, { Model: model, Parent: torso.HipBone, Prefix: s, GuideObjectCollection: lg, UpVectorBehindLeg: true, NbThighDivisions: U.ThighRoll ? U.ThighDivisions : 0, ShadowType: legSh, ShadowParent: legShParent });
      const fg = need([`${s}Pivot`, `${s}PivotRight`, `${s}PivotLeft`, `${s}Foot1`, `${s}Foot2`, `${s}Foot3`, `${s}Foot4`], `${s} foot`); if (!fg || !legO[s]) continue;
      footO[s] = makeFoot(app, { Model: model, Parent: GlobalSRT, ShortPrefix: s, FullPrefix: s === 'L' ? 'Left' : 'Right', GuideObjectCollection: fg, Sliders: Controls, Extension: false, ShadowType: shadowType, ShadowParent: legO[s].ShadowEnds?.[0] ?? shParentFor(null), ThreeBoneToe: U.ThreeBoneToes });
      if (footO[s]) { const r = footO[s].Root as X3DObject; const g = gpos(r); legO[s].Eff.addChild(r); setGlobalPos(r, g); constrain(app, legO[s].Eff, 'Position', [footO[s].BaseGuide]); ctrlAdd([legO[s].upV, footO[s].Foot, footO[s].Roll, footO[s].Tip, footO[s].toeOffsets[0]]); }
    }
  } else if (dog || quad) {
    for (const s of ['L', 'R']) {
      const pre = quad ? `B${s}` : s;
      const dg = need(quad ? [`${s}Femur`, `B${s}Tibia`, `B${s}Metarsal`, `B${s}Pivot`, `B${s}PivotRight`, `B${s}PivotLeft`, ...[1, 2, 3, 4, 5, 6].map(i => `B${s}HindClaw${i}`)] : [`${s}Femur`, `${s}Tibia`, `${s}Metarsal`, `${s}Pivot`, `${s}PivotRight`, `${s}PivotLeft`, ...[1, 2, 3, 4, 5, 6].map(i => `${s}Foot${i}`)], `${s} dog leg`); if (!dg) continue;
      legO[s] = makeDogLeg(app, { Model: model, Parent: torso.HipBone, FootParent: GlobalSRT, GuideObjectCollection: dg, ShortPrefix: pre, FullPrefix: quad ? `B${s === 'L' ? 'Left' : 'Right'}` : (s === 'L' ? 'Left' : 'Right'), Sliders: Controls, NbThighDivisions: quad ? (U.BackRoll ? U.BackRollDivisions : 0) : (U.ThighRoll ? U.ThighDivisions : 0), ShadowType: shadowType, ShadowParent: shParentFor(shEnd(0)) });
      if (legO[s]) ctrlAdd([legO[s].UpVec, legO[s].FootControl]);
    }
  }
  const front: Record<string, any> = {}, frontFoot: Record<string, any> = {};
  if (quad) {
    for (const s of ['L', 'R']) {
      const eff = s === 'R' ? torso.REff : torso.LEff; const fg = need([`${s}Shoulder`, `${s}Ulna`, `F${s}Claw1`], `${s} front leg`); if (!fg) continue;
      front[s] = makeLeg(app, { Model: model, Parent: eff, Prefix: s, GuideObjectCollection: fg, UpVectorBehindLeg: false, NbThighDivisions: U.FrontRoll ? U.FrontRollDivisions : 0, ShadowType: legSh, ShadowParent: shParentFor(shEnd(s === 'R' ? 1 : 2)) });
      const ff = need([`F${s}Pivot`, `F${s}PivotRight`, `F${s}PivotLeft`, ...[1, 2, 3, 4].map(i => `F${s}Claw${i}`)], `${s} front foot`); if (!ff || !front[s]) continue;
      frontFoot[s] = makeFoot(app, { Model: model, Parent: GlobalSRT, ShortPrefix: s, FullPrefix: s === 'L' ? 'Left' : 'Right', GuideObjectCollection: ff, Sliders: Controls, Extension: false, ShadowType: shadowType, ShadowParent: front[s].ShadowEnds?.[0] ?? null });   // ThreeBoneToe omitted: two-bone toes
      if (frontFoot[s]) { const r = frontFoot[s].Root as X3DObject; const g = gpos(r); front[s].Eff.addChild(r); setGlobalPos(r, g); constrain(app, front[s].Eff, 'Position', [frontFoot[s].BaseGuide]); }
    }
  }
  // ---- tail (quadruped), head
  let tail: any = null;
  if (quad && U.MakeTail) { logNya(app, fn, 'MakeTail (not in this row): the tail chain is not built'); }
  const hg = need(['RibCageEnd', 'Neck', 'Head'], 'head'); let head: any = null;
  if (hg) head = makeHead(app, { Parent: chestBone, GuideObjectCollection: hg, Prefix: '', AssemblyType: U.HeadType, HeadType: quad ? 1 : 0, NbDivisions: U.HeadDivisions, StretchType: U.HeadStretch, Sliders: Controls, EarGuideCollection: U.Ears && G.get('REar1') && G.get('LEar1') ? [G.get('REar1'), G.get('LEar1')] : [], ShadowType: shadowType, ShadowParent: shParentFor(shEnd(0)) });
  // ---- step: slides / joints / belly
  const extra: Record<string, any> = {};
  const L = (s: string) => legO[s]?.Skel?.[1] as X3DObject | undefined;
  if (!quad) for (const s of ['R', 'L']) {
    const bicep = arm[s]?.Skel?.[1] as X3DObject | undefined, fore = arm[s]?.Skel?.[2] as X3DObject | undefined; const hip = torso.HipBone as X3DObject; const thigh = L(s);
    if (U.ArmPitSlide && bicep) { const g = need([`${s}ArmPitTop`, `${s}ArmPitBase`], 'armpit'); if (g) extra[`${s}Armpit`] = make2PointSlide(app, { Prefix: `${s}ArmPit`, GuidePoint1: g[0], GuidePoint2: g[1], Parent1: bicep, Parent2: chestBone, UpVector: chestBone }); }
    if (U.HipSlide && thigh) { const g = need([`${s}HipTop`, `${s}HipBottom`], 'hip'); if (g) extra[`${s}Hip`] = make2PointSlide(app, { Prefix: `${s}Hip`, GuidePoint1: g[0], GuidePoint2: g[1], Parent1: hip, Parent2: thigh, UpVector: hip }); }
    if (U.ThighSlide && thigh) { const g = need([`${s}Rear1`, `${s}LowerThigh`, `${s}HipBottom`, `${s}${legName}`, `${s}${dog ? 'Tibia' : 'Knee'}`], 'thigh slide'); if (g) extra[`${s}Thigh`] = makeThighSlide(app, { Prefix: s, GuideObjectCollection: g, UpperParent: hip, LowerParent: thigh }); }
    if (U.ElbowsJoint && bicep && fore) { const g = need([`${s}ElbowJoint2`, `${s}ElbowJoint1`, `${s}ForeArmSquash`, `${s}ForeArmCenter`], 'elbow joint'); if (g) extra[`${s}Elbow`] = makeJointCompression(app, { Prefix: `${s}Elbow`, UpperBone: bicep, LowerBone: fore, GuideObjectCollection: g, RollDivisionCollection: arm[s]?.BicepRoll?.Divisions ?? null }); }
    if (kind === 'biped' && U.KneeJoint && thigh) { const g = need([`${s}ThighBack1`, `${s}ThighBack2`, `${s}CalfBack`, `${s}CalfCenter`], 'knee joint'); if (g && legO[s]) extra[`${s}Knee`] = makeJointCompression(app, { Prefix: `${s}Knee`, UpperBone: thigh, LowerBone: legO[s].Skel[2], GuideObjectCollection: g, RollDivisionCollection: null }); }   // LegDivisions is undefined in the script: always null
  }
  let belly: any = null; const bg = [G.get('LowerStomach'), G.get('UpperStomach')];
  if (U.MakeBelly) {
    if (bg[0] && bg[1]) {
      belly = makeBelly(app, { HipObject: torso.HipBone, VertebraObject: torso.Spine?.Vertebra?.[0] ?? torso.Spine?.Skel?.[1] ?? chestBone, GuideObjectCollection: bg, ForwardRotationPerc: U.BellyCenterPercentage });
      if (belly && U.BellySlide) for (const s of ['L', 'R']) { const g = [G.get(`${s}Belly1`), G.get(`${s}Belly2`)]; if (g[0] && g[1]) extra[`${s}BellySlide`] = make2PointSlide(app, { Prefix: s, GuidePoint1: g[0], GuidePoint2: g[1], Parent1: belly.BellyBone, Parent2: torso.HipBone, UpVector: torso.HipBone }); }
    } else if (quad) logWarn(app, 'makeQuadruped: no belly guides: belly slide will not be created');
    else logError(app, `${fn}: belly guides not found`);
  }
  // ---- key sets, synoptic, default pose
  const kset = quad ? makeQuadrupedKeySet : makeBipedKeySet;
  kset(app, { RootObject: GlobalSRT, CharacterKeySetName: rigName, DeleteMarkingSet: true, Prefix: '', Suffix: '' });
  if (shSRT) { if (U.CreateShadowKeySet) kset(app, { RootObject: shSRT, CharacterKeySetName: rigName, DeleteMarkingSet: true, Prefix: 'Shadow', Suffix: '' }); else setKeyableRig(app, { RootObject: shSRT }); }
  const syn = (o: X3DObject, file: string) => customProp(app, o, 'Synoptic', { path: `$SI_HOME/Data/XSI_SAMPLES/Synoptic/Rig/${file}` });
  syn(GlobalSRT, quad ? 'QuadSynoptic_IK1.htm' : dog ? 'BipedSynoptic_CDK1.htm' : 'BipedSynoptic_CDK1.htm');
  if (shSRT) syn(shSRT, shadowType <= 2 ? 'SkeletonBipedSynoptic.htm' : shadowType === 3 ? 'NullBipedSynoptic.htm' : 'BoxBipedSynoptic.htm');
  // default pose (stand-in): the keyable values of the GlobalSRT branch are stored on the main model (not StoreAction)
  const snapshot = (root: X3DObject) => [root, ...root.descendants()].flatMap(o => ['pos', 'rot', 'scl'].flatMap(k => ['x', 'y', 'z'].map(ax => { const p = o.kinematics.local.get(k + ax); return p && p.def.keyable ? [siFull(o) + '.' + k + ax, p.value] : null; }))).filter(Boolean);
  if (quad) logInfo(app, 'makeQuadruped: the default pose is stored on an undefined owner (model / Model member mismatch of the script); nothing is stored (inferred)');
  else { (model as any).storedActions = { DefaultPose: snapshot(GlobalSRT), ...(shSRT ? { ShadowDefaultPose: snapshot(shSRT) } : {}) }; logNya(app, fn, 'StoreAction("DefaultPose") is kept as a stored value list on the model (no mixer source)'); }
  app.select([model]);
  Object.assign(out, { Head: head, LHand: handO.L, RHand: handO.R, RArm: arm.R, LArm: arm.L, LLeg: kind === 'biped' ? legO.L : quad ? front.L : null, RLeg: kind === 'biped' ? legO.R : quad ? front.R : null, LFoot: footO.L ?? frontFoot.L ?? null, RFoot: footO.R ?? frontFoot.R ?? null,
    LDogLeg: legO.L && !(kind === 'biped') ? legO.L : null, RDogLeg: legO.R && !(kind === 'biped') ? legO.R : null, Tail: tail, ...(quad ? {} : { RArmpit: extra.RArmpit, LArmpit: extra.LArmpit, RHip: extra.RHip, LHip: extra.LHip, RThigh: extra.RThigh, LThigh: extra.LThigh, LElbow: extra.LElbow, RElbow: extra.RElbow, ...(kind === 'biped' ? { LKnee: extra.LKnee, RKnee: extra.RKnee } : {}) }),
    Belly: belly, LBellySlide: extra.LBellySlide, RBellySlide: extra.RBellySlide });
  if (kind !== 'quad') { out.modelString = rigName; delete out.ModelString; delete out.Model; } else { out.ModelString = rigName; delete out.modelString; delete out.model; }
  if (quad) { delete out.model; }
  rigState(app).last[fn] = out;
  return out;
}
export const makeBiped = (app: App, a: Record<string, any>) => buildRig(app, 'biped', a);
export const makeBipedDogLeg = (app: App, a: Record<string, any>) => buildRig(app, 'dog', a);
export const makeQuadruped = (app: App, a: Record<string, any>) => buildRig(app, 'quad', a);
export { Property, makeShadowChain, numArg, unset, objOf, setPs, setVisible, neutralPose };
