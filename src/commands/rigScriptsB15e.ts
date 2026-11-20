// Ledger row CMD-B15e (Character Rigging script commands), part 3: the rig assemblers and the row's registration.
//   MakeBiped MakeBipedDogLeg MakeQuadruped (+ registerRigScriptsB15eCommands for all 26 names of the row)
// Brief: docs/ghidra/cmd-b15e-character-rigging-scripts.md §3.2-3.6 ("Wire contract") and docs/re/WIRE_CORRECTIONS_B15.md
// items 35-37. Original code written from that prose only.
//
//  * Each of the three names is registered twice in Softimage (JScript builder and VBScript "UI" wrapper; which one is
//    live depends on plug-in load order, note §4 Q2). The bus holds one definition per name: the JScript builder's
//    argument list is registered (for MakeBiped both lists are identical). The VBScript wrappers (MakeBipedUI /
//    MakeBipedDogLegUI unread, SPEC-PARTIAL) are not separate commands here.
//  * SelectUsingUI false (the default) shows the modal dialog and ignores the other arguments (item 35). The dialog is
//    `app.rigB15e.hooks.dialog`; without it the run logs "not yet attested: dialog" and uses the dialog defaults, so a
//    default-argument run still builds a rig when a guide exists.
//  * This build's GetProportionalGuide makes an old-style proportional guide (flag `isGuide`, default name
//    `Biped_Guide`). Such a model is treated as the old guide (`BipedPropGuide`): warning + CreateRigFromGuide (inferred
//    mapping, the guide layouts differ).
import { App } from '../core/commands';
import { X3DObject, Model, Property } from '../core/scene';
import { ParamDef, num, int, bool, str } from '../core/params';
import { siString } from '../ui/si';
import {
  CAT, v3, wpos, objArg, intArg, numArg, boolArg, logError, logInfo, logWarn, logNya, rigState, place, mkNull, customProp, setP, cns,
  modelGroup, findGroup, addToGroup, markingSet, rigIcon, childNamed, progress, runDialog, reparent, buildSampleGuide, hideObj, rigIconCurves,
  wireColor, opsOn, skeletonOf, markingSetsOf,
} from './rigScriptsB15eShared';
import { registerRigScriptsB15ePartCommands } from './rigScriptsB15eParts';
import { registerRigScriptsB15eLimbCommands, storePose } from './rigScriptsB15eLimbs';

type ArgSpec = [string, any];
const BIPED_ARGS: ArgSpec[] = [['TorsoType', 1], ['TorsoStretch', 0], ['TorsoDivisions', 3], ['IconType', 0], ['MakeBelly', false], ['BellySlide', 0], ['BellyCenterPercentage', 0.25], ['HeadType', 0], ['HeadStretch', 0], ['HeadDivisions', 3], ['Ears', false], ['RotationOrder', 0], ['ArmSymmetry', 0], ['ArmAttachment', 0], ['FingerType', 0], ['ForeArmRoll', false], ['ForeArmDivisions', 3], ['BicepRoll', false], ['BicepDivisions', 3], ['ThighRoll', false], ['ThighDivisions', 3], ['ArmPitSlide', false], ['HipSlide', false], ['ThighSlide', false], ['ElbowsJoint', false], ['KneeJoint', false], ['ShadowType', 0], ['ShadowHands', 0], ['OneModel', false], ['IndependentLower', false], ['ThreeBoneToes', true], ['CreateShadowCharacterKeySet', false], ['SelectUsingUI', false]];
const DOGLEG_ARGS: ArgSpec[] = BIPED_ARGS.filter(([n]) => n !== 'KneeJoint' && n !== 'ThreeBoneToes').map(([n, d]) => [n === 'CreateShadowCharacterKeySet' ? 'CreateShadowKeySet' : n, d] as ArgSpec);
const QUAD_ARGS: ArgSpec[] = [['TorsoType', 1], ['TorsoStretch', 0], ['TorsoDivisions', 3], ['IconType', 0], ['MakeBelly', false], ['BellySlide', 0], ['BellyCenterPercentage', 0.25], ['HeadType', 0], ['HeadStretch', 0], ['HeadDivisions', 3], ['Ears', false], ['MakeTail', false], ['TailDivisions', 6], ['FrontRoll', false], ['FrontRollDivisions', 3], ['BackRoll', false], ['BackRollDivisions', 3], ['ShadowType', 0], ['CreateShadowKeySet', false], ['SelectUsingUI', false]];
const argDefs = (l: ArgSpec[]) => l.map(([name, d]) => ({ name, default: d }));

/** Dialog definitions: one parameter per option (TorsoType stored 0-based), with the dialog's own defaults. */
function dialogDefs(list: ArgSpec[], over: Record<string, any> = {}): ParamDef[] {
  return list.filter(([n]) => n !== 'SelectUsingUI' && n !== 'CreateShadowCharacterKeySet' && n !== 'CreateShadowKeySet').map(([n, d0]) => {
    const d = n in over ? over[n] : n === 'TorsoType' ? Number(d0) - 1 : d0;
    return typeof d === 'boolean' ? bool(n, d, n) : Number.isInteger(d) ? int(n, d, n) : num(n, d, n);
  });
}
/** The option values: the arguments (SelectUsingUI true) or the dialog (false). Null = cancelled. */
function options(app: App, cmd: string, title: string, list: ArgSpec[], a: any, over: Record<string, any> = {}): { UI: Record<string, any>; dialog: boolean } | null {
  const UI: Record<string, any> = {};
  if (boolArg(a.SelectUsingUI, false)) { for (const [n, d] of list) UI[n] = typeof d === 'boolean' ? boolArg(a[n], d) : numArg(a[n], d); return { UI, dialog: false }; }
  const v = runDialog(app, cmd, title, dialogDefs(list, over));
  if (!v) return null;
  for (const [n, d] of list) UI[n] = n in v ? v[n] : d;
  UI.TorsoType = Number(v.TorsoType) + 1; UI.SelectUsingUI = false;
  if ('CreateShadowCharacterKeySet' in UI) UI.CreateShadowCharacterKeySet = false; if ('CreateShadowKeySet' in UI) UI.CreateShadowKeySet = false;
  return { UI, dialog: true };
}
const text = (id: number, fallback: string) => siString('XSISCRIPTS', id) ?? fallback;

/** Build the main model + GlobalSRT + groups and (optionally) the shadow model (step 1). */
function rigHierarchy(app: App, o: { cmd: string; modelName: string; keySet: string; shadowKeySet: string; scale: number; gsrtSize: number; shadowType: number; oneModel: boolean; help: string; controlsGroup: boolean; shadowGroupNames: [string, string]; shadowModelName: string; shadowIcon?: (st: number) => [number, number] }) {
  const model = place(app, new Model(o.modelName), null);
  const gsrt = rigIcon(app, o.cmd, model, 4, v3(), [o.gsrtSize, o.gsrtSize, o.gsrtSize], 893, 'GlobalSRT')!;
  markingSet(app, gsrt, true, true, '', o.keySet);
  const controls = customProp(app, model, 'Controls'); (controls as any).help = o.help;
  const hidden = modelGroup(app, model, 'hidden', true), env = modelGroup(app, model, 'envelope_group');
  const cg = o.controlsGroup ? modelGroup(app, model, 'controls_group') : null; if (cg) addToGroup(app, cg, [gsrt]);
  let sModel: X3DObject | null = null, sHidden = null, sEnv = null, sG: X3DObject | null = null;
  if (o.shadowType !== 0) {
    sModel = o.oneModel ? model : place(app, new Model(o.shadowModelName), null);
    sHidden = modelGroup(app, sModel, o.shadowGroupNames[0], true); sEnv = modelGroup(app, sModel, o.shadowGroupNames[1]);
    const col = o.shadowType <= 2 ? 805 : o.shadowType === 3 ? 380 : 479;
    if (o.shadowIcon) { const [type, c] = o.shadowIcon(o.shadowType); sG = rigIcon(app, o.cmd, sModel, type, v3(), [o.scale * 0.07, o.scale * 0.07, o.scale * 0.07], c, o.oneModel ? 'Shadow_GlobalSRT' : 'GlobalSRT')!; }
    else { sG = mkNull(app, o.oneModel ? 'Shadow_GlobalSRT' : 'GlobalSRT', sModel, gsrt.globalMatrix(), { size: o.scale * (o.shadowType === 3 || o.oneModel ? 0.08 : 0.07), icon: 8, color: col }); }
    markingSet(app, sG, true, true, '', o.shadowKeySet); cns(app, sG, 'Pose', [gsrt], true);
  }
  return { model, gsrt, controls, hidden, env, cg, sModel, sHidden, sEnv, sG };
}
function synoptic(app: App, owner: X3DObject, file: string) { const p = customProp(app, owner, 'Synoptic'); p.add(str('path', `$SI_HOME/Data/XSI_SAMPLES/Synoptic/Rig/${file}`, 'Path')); return p; }
const shadowSynoptic = (base: string, st: number) => (st === 1 || st === 2 ? `Skeleton${base}Synoptic.htm` : st === 3 ? `Null${base}Synoptic.htm` : `Box${base}Synoptic.htm`);
function defaultPose(app: App, cmd: string, owner: X3DObject, root: X3DObject, name: string) {
  const objs = [root, ...root.descendants()]; const items = objs.flatMap(o => o.kinematics.local.params.filter(p => p.keyable).map(p => ({ obj: o, p: p.name, v: Number(p.value) })));
  storePose(app, cmd, owner, name, items);
}
/** The guide of MakeBiped / MakeBipedDogLeg. */
function findGuide(app: App, guideName: string): X3DObject | null {
  const sel = app.selectedObjects[0]; const m = sel ? (sel instanceof Model ? sel : sel.model) : null;
  if (m && m !== app.scene.root && findGroup(app, m, 'DetailedGuide')) return m;
  const g = app.scene.root.children.find(c => c.name === guideName) ?? null;
  return g && !(g as any).isGuide ? g : null;
}
const propGuide = (app: App, name: string) => app.scene.root.children.find(c => c.name === name || (c as any).isGuide) ?? null;
const all = (guide: X3DObject, names: string[]) => names.map(n => childNamed(guide, n)).filter((x): x is X3DObject => !!x);

// ------------------------------------------------------------------ MakeBiped / MakeBipedDogLeg (§3.2, §3.3)
function makeBipedRig(app: App, a: any, dog: boolean): any {
  const C = dog ? 'makeBipedDogLeg' : 'makeBiped'; const CMD = dog ? 'MakeBipedDogLeg' : 'MakeBiped';
  const list = dog ? DOGLEG_ARGS : BIPED_ARGS;
  const opt = options(app, CMD, dog ? text(1165, 'Make Biped Dog Leg') : text(1164, 'Make Biped'), list, a);
  if (!opt) { logInfo(app, `${C}: cancelled`); return undefined; }
  const UI = opt.UI; const step = (s: string) => { if (opt.dialog) progress(app, `${dog ? 'Make Biped Dog Leg' : 'Make Biped'}: ${s}`); };
  const guideName = dog ? 'Biped_DogLeg_Guide' : 'Biped_Guide';
  const guide = findGuide(app, guideName);
  if (!guide) {
    const pg = propGuide(app, 'BipedPropGuide');
    if (pg) { logWarn(app, `This biped guide is not compatible with ${CMD} (XSI v4.0), using CreateRigFromGuide`); app.run('CreateRigFromGuide', { Guide: pg }); return undefined; }
    logError(app, `${C}: No Biped Guide Found`); return undefined;
  }
  const g = (n: string) => childNamed(guide, n);
  const RH = g('RHand'), LH = g('LHand'); if (!RH || !LH) { logNya(app, CMD, 'a guide without RHand / LHand (the scale is read from them)'); return undefined; }
  const scale = wpos(RH).distanceTo(wpos(LH)) / 1.25; const sym = intArg(UI.ArmSymmetry, 0) === 0 ? 1 : 0;   // inverted internally (0 → 1)
  const st = intArg(UI.ShadowType, 0); const oneModel = !!UI.OneModel; const kset = dog ? 'Biped_DogLeg' : 'Biped';
  const out: any = { UI: { ...UI, CreateShadowKeySet: UI.CreateShadowCharacterKeySet ?? UI.CreateShadowKeySet }, modelString: kset, GuideModel: guide, keyWords: ['L', 'R'], pos: wpos(guide), Scale: scale };
  // 1. hierarchy
  step('hierarchy');
  const h = rigHierarchy(app, { cmd: C, modelName: kset, keySet: kset, shadowKeySet: 'ShadowBiped', scale, gsrtSize: scale * 0.09, shadowType: st, oneModel, help: dog ? 'animtoolbar61.htm' : 'animtoolbar48.htm', controlsGroup: !dog, shadowGroupNames: dog ? ['hidden', 'envelope_group'] : ['Shadow_hidden', 'Shadow_envelope_group'], shadowModelName: `${kset}_Shadow`, shadowIcon: dog ? (t => (t <= 2 ? [7, 805] : t === 3 ? [6, 380] : [2, 479])) : undefined });
  Object.assign(out, { model: h.model, GlobalSRT: h.gsrt, Sliders: h.controls, HiddenGroup: h.hidden, EnvGroup: h.env, ControlsGroup: h.cg, ShadowModel: h.sModel, ShadowHiddenGroup: h.sHidden, ShadowEnvGroup: h.sEnv, ShadowGlobalSRT: h.sG });
  const toControls = (objs: (X3DObject | null | undefined)[]) => { if (h.cg) addToGroup(app, h.cg, objs.filter((x): x is X3DObject => !!x)); };
  // 2. torso
  step('torso');
  const leg = dog ? 'Femur' : 'Leg';
  const tg = all(guide, ['SpineBase', 'SpineHipDepth', 'SpineChestDepth', 'RibCageEnd', `L${leg}`, 'LShoulderStart', 'LShoulder', `R${leg}`, 'RShoulderStart', 'RShoulder', 'RibCageStart']);
  const torso = app.run('MakeTorso', { Parent: h.gsrt, NbDivisions: UI.TorsoDivisions, StretchType: UI.TorsoStretch, GuideObjectCollection: tg, ControlType: UI.IconType, SpineType: UI.TorsoType, Sliders: h.controls, ShadowType: st, ShadowParent: h.sG, NegativeScale: sym });
  if (!torso) { logError(app, `${C}: torso could not be built`); return out; }
  const chestBone: X3DObject = torso.Spine?.TopVertebra ?? torso.spineEnd;
  Object.assign(out, { Torso: torso, ChestBone: chestBone, UpperBody: torso.UpperBody, SpineCurve: torso.Spine?.Curve ?? null, HipBone: torso.HipBone, RShoulderEff: torso.REff, LShoulderEff: torso.LEff, ShadowHip: torso.ShadowStart ?? null });
  toControls([torso.UpperBody, ...(intArg(UI.TorsoType, 1) !== 2 ? [torso.HipDepth, torso.ChestDepth, torso.Hip, torso.Chest] : [])]);
  addToGroup(app, h.hidden, [torso.rroot, torso.lroot]);
  const tse = (i: number): X3DObject | null => torso.ShadowEnds?.[i] ?? h.sG ?? null;
  const head = () => {
    step('head');
    const ears = UI.Ears ? all(guide, ['REar1', 'LEar1']) : []; const earsOk = ears.length === 2 ? ears : [];
    out.Head = app.run('MakeHead', { Parent: chestBone, GuideObjectCollection: all(guide, ['RibCageEnd', 'Neck', 'Head']), Prefix: '', AssemblyType: UI.HeadType, HeadType: 0, NbDivisions: UI.HeadDivisions, StretchType: UI.HeadStretch, Sliders: h.controls, EarGuideCollection: earsOk, ShadowType: st, ShadowParent: tse(0) });
  };
  if (!dog) head();
  // 4. hands (left then right)
  step('hands');
  const fingerNames = ['Pinky', 'Ring', 'Middle', 'Index', 'Thumb'];
  for (const s of ['L', 'R'] as const) {
    const pairs = fingerNames.map(f => [g(`${s}${f}1`), g(`${s}${f}_fingerBlade`)]).filter(([f, b]) => f && b) as X3DObject[][];
    const hand = app.run('MakeHand', { HandParent: torso.UpperBody, FingerGuideCollection: pairs.map(p => p[0]), BladeGuideCollection: pairs.map(p => p[1]), HandGuideCollection: all(guide, [`${s}Hand`, `${s}HandEnd`]), Prefix: s, FingerBoneType: UI.FingerType, ShadowType: st + (UI.ShadowHands ? 8 : 0), ShadowParent: tse(0), NegativeScale: s === 'L' ? 0 : sym });
    out[`${s}Hand`] = hand; toControls([hand?.Claw]);
  }
  // 5. arms (right then left)
  step('arms');
  const armSt = st === 5 || st === 7 ? 1 : st;
  for (const s of ['R', 'L'] as const) {
    const shEff = s === 'R' ? torso.REff : torso.LEff; const attach = intArg(UI.ArmAttachment, 0);
    const hand = out[`${s}Hand`];
    const arm = app.run('MakeArm', { ArmParent: attach === 0 ? shEff : torso.UpperBody, GuideObjectCollection: all(guide, [`${s}Shoulder`, `${s}Elbow`, `${s}Hand`]), Prefix: s, ArmRootConstrainingObj: attach === 0 ? null : shEff, NbForearmDivisions: UI.ForeArmRoll ? UI.ForeArmDivisions : 0, NbBicepDivisions: UI.BicepRoll ? UI.BicepDivisions : 0, ShadowType: armSt, ShadowParent: tse(s === 'R' ? 1 : 2), HandRoot: hand?.Root ?? null, NegativeScale: s === 'R' ? sym : 0 });
    out[`${s}Arm`] = arm; if (!arm) continue;
    if (hand?.Root) reparent(app, hand.Root, arm.Eff);
    if (hand?.ShadowStart && arm.ShadowEnds?.[0]) reparent(app, hand.ShadowStart, arm.ShadowEnds[0]);
    if (intArg(UI.RotationOrder, 0) === 0) setP(arm.Skel[1].kinematics.local, 'rotorder', 3);
    toControls([arm.Eff, arm.UpV]);
  }
  // 6. legs and feet / dog legs
  const legSt = st === 6 || st === 7 ? 1 : st;
  let legShadowParent: X3DObject | null = torso.ShadowStart ?? h.sG;
  if (!dog && UI.IndependentLower && st !== 0) {
    const n = mkNull(app, torso.HipBone.name, torso.ShadowStart ?? h.sG, torso.HipBone.globalMatrix(), { icon: 4, size: 1.2, color: 805 }); setP(n, 'frozen', true); cns(app, n, 'Pose', [torso.HipBone], true); legShadowParent = n;
  }
  const dogLegs = () => {
    step('dog legs');
    for (const s of ['L', 'R'] as const) {
      const toes = Array.from({ length: 6 }, (_, i) => g(`${s}Foot${i + 1}`)).filter((x): x is X3DObject => !!x);
      out[`${s}DogLeg`] = app.run('MakeDogLeg', { Model: guide, Parent: torso.HipBone, FootParent: h.gsrt, GuideObjectCollection: [...all(guide, [`${s}Femur`, `${s}Tibia`, `${s}Metarsal`, `${s}Pivot`, `${s}PivotRight`, `${s}PivotLeft`]), ...toes], ShortPrefix: s, FullPrefix: s === 'L' ? 'Left' : 'Right', Sliders: h.controls, NbThighDivisions: UI.ThighDivisions, ShadowType: st, ShadowParent: torso.ShadowStart ?? h.sG });
    }
  };
  if (!dog) {
    step('legs');
    for (const s of ['L', 'R'] as const) {
      const lg = app.run('MakeLeg', { Model: guide, Parent: torso.HipBone, Prefix: s, GuideObjectCollection: all(guide, [`${s}Leg`, `${s}Knee`, `${s}Foot1`]), UpVectorBehindLeg: 1, NbThighDivisions: UI.ThighRoll ? UI.ThighDivisions : 0, ShadowType: legSt, ShadowParent: legShadowParent });
      out[`${s}Leg`] = lg;
      const ft = app.run('MakeFoot', { Model: guide, Parent: h.gsrt, ShortPrefix: s, FullPrefix: s === 'L' ? 'Left' : 'Right', GuideObjectCollection: all(guide, [`${s}Pivot`, `${s}PivotRight`, `${s}PivotLeft`, `${s}Foot1`, `${s}Foot2`, `${s}Foot3`, `${s}Foot4`]), Sliders: h.controls, Extension: 0, ShadowType: st, ShadowParent: lg?.ShadowEnds?.[0] ?? legShadowParent, ThreeBoneToe: UI.ThreeBoneToes });
      out[`${s}Foot`] = ft;
      if (lg && ft) { reparent(app, ft.Root, lg.Eff); cns(app, lg.Eff, 'Position', [ft.BaseGuide]); }
      toControls([lg?.upV, ft?.Foot, ft?.Roll, ft?.Tip, ft?.toeOffsets?.[0]]);
    }
  } else { dogLegs(); head(); }
  // key sets / synoptic for the dog-leg order come before slides (§3.3); the biped does them after the belly
  const keySets = () => {
    step('character key sets');
    app.run('MakeBipedCharacterKeySet', { RootObject: h.gsrt, CharacterKeySetName: kset, DeleteMarkingSet: true, Prefix: '', Suffix: '' });
    if (h.sG) { if (out.UI.CreateShadowKeySet) app.run('MakeBipedCharacterKeySet', { RootObject: h.sG, CharacterKeySetName: kset, DeleteMarkingSet: true, Prefix: 'Shadow', Suffix: '' }); else app.run('SetKeyableRig', { RootObject: h.sG }); }
    step('synoptic');
    synoptic(app, h.gsrt, 'BipedSynoptic_CDK1.htm'); if (h.sG) synoptic(app, h.sG, shadowSynoptic('Biped', st));
  };
  if (dog) keySets();
  // 7. slides, 8. joints
  step('slides');
  for (const s of ['R', 'L'] as const) {
    const arm = out[`${s}Arm`]; const bicep = arm?.Skel?.[1], forearm = arm?.Skel?.[2];
    const thigh = dog ? out[`${s}DogLeg`]?.Skel?.[1] : out[`${s}Leg`]?.Skel?.[1];
    if (UI.ArmPitSlide && bicep) out[`${s}Armpit`] = app.run('Make2PointSlide', { Prefix: `${s}ArmPit`, GuidePoint1: g(`${s}ArmPitTop`), GuidePoint2: g(`${s}ArmPitBase`), Parent1: bicep, Parent2: chestBone, UpVector: chestBone, BoundingVolume: null });
    if (UI.HipSlide && thigh) out[`${s}Hip`] = app.run('Make2PointSlide', { Prefix: `${s}Hip`, GuidePoint1: g(`${s}HipTop`), GuidePoint2: g(`${s}HipBottom`), Parent1: torso.HipBone, Parent2: thigh, UpVector: torso.HipBone, BoundingVolume: null });
    if (UI.ThighSlide && thigh) out[`${s}Thigh`] = app.run('MakeThighSlide', { Prefix: s, GuideObjectCollection: all(guide, dog ? [`${s}Rear`, `${s}LowerThigh`, `${s}HipBottom`, `${s}Femur`, `${s}Tibia`] : [`${s}Rear1`, `${s}LowerThigh`, `${s}HipBottom`, `${s}Leg`, `${s}Knee`]), UpperParent: torso.HipBone, LowerParent: thigh });
    if (UI.ElbowsJoint && bicep) out[`${s}Elbow`] = app.run('MakeJointCompression', { Prefix: `${s}Elbow`, UpperBone: bicep, LowerBone: forearm, GuideObjectCollection: all(guide, [`${s}ElbowJoint2`, `${s}ElbowJoint1`, `${s}ForeArmSquash`, `${s}ForeArmCenter`]), RollDivisionCollection: arm?.BicepRoll?.Divisions ?? null });
    if (!dog && UI.KneeJoint && thigh) out[`${s}Knee`] = app.run('MakeJointCompression', { Prefix: `${s}Knee`, UpperBone: thigh, LowerBone: out[`${s}Leg`]?.Skel?.[2], GuideObjectCollection: all(guide, [`${s}ThighBack1`, `${s}ThighBack2`, `${s}CalfBack`, `${s}CalfCenter`]), RollDivisionCollection: null });   // shipped: LegDivisions undefined → always null
  }
  // 9. belly
  if (UI.MakeBelly) {
    step('belly');
    const firstVert = torso.Spine?.Vertebra?.[0] ?? chestBone;
    out.Belly = app.run('MakeBelly', { HipObject: torso.HipBone, VertebraObject: firstVert, GuideObjectCollection: all(guide, ['LowerStomach', 'UpperStomach']), ForwardRotationPerc: UI.BellyCenterPercentage });
    if (UI.BellySlide && out.Belly) for (const s of ['L', 'R'] as const) out[`${s}BellySlide`] = app.run('Make2PointSlide', { Prefix: s, GuidePoint1: g(`${s}Belly1`), GuidePoint2: g(`${s}Belly2`), Parent1: out.Belly.BellyBone, Parent2: torso.HipBone, UpVector: torso.HipBone, BoundingVolume: null });
  }
  if (!dog) keySets();
  // 12. default pose
  step('default pose');
  defaultPose(app, CMD, h.model, h.gsrt, 'DefaultPose'); if (h.sG) defaultPose(app, CMD, h.model, h.sG, 'ShadowDefaultPose');
  app.select([h.model]);
  return out;
}

// ------------------------------------------------------------------ MakeQuadruped (§3.4)
function makeQuadrupedRig(app: App, a: any): any {
  const C = 'makeQuadruped', CMD = 'MakeQuadruped';
  const opt = options(app, CMD, text(1170, 'Make Quadruped'), QUAD_ARGS, a, { IconType: 1, MakeTail: true, TailDivisions: 6 });
  if (!opt) { logInfo(app, `${C}: cancelled`); return undefined; }
  const UI = opt.UI; const step = (s: string) => { if (opt.dialog) progress(app, `Make Quadruped: ${s}`); };
  const guide = app.scene.root.children.find(c => c.name === 'Quadruped_Guide') ?? null;
  if (!guide) {
    const pg = app.scene.root.children.find(c => c.name === 'Quadruped_PropGuide') ?? null;
    if (pg) { logWarn(app, 'This quadruped guide is not compatible with MakeQuadruped (XSI v4.0), using CreateRigFromQuadruped'); app.run('CreateRigFromQuadruped', { Guide: pg }); return undefined; }
    logError(app, `${C}: No Quadruped Guide Found`); return undefined;
  }
  const g = (n: string) => childNamed(guide, n);
  const rc = g('RibCageEnd'), sb = g('SpineBase'); if (!rc || !sb) { logNya(app, CMD, 'a guide without RibCageEnd / SpineBase (the scale is read from them)'); return undefined; }
  const scale = wpos(rc).distanceTo(wpos(sb)) / 1.25; const st = intArg(UI.ShadowType, 0);
  const out: any = { UI, ModelString: 'Quadruped', GuideModel: guide, keyWords: ['L', 'R', 'BL', 'BR'], pos: wpos(guide), Scale: scale };
  step('hierarchy');
  const h = rigHierarchy(app, { cmd: C, modelName: 'Quadruped', keySet: 'Quadruped', shadowKeySet: 'ShadowQuadruped', scale, gsrtSize: scale * 0.2, shadowType: st, oneModel: false, help: 'animtoolbar34.htm', controlsGroup: false, shadowGroupNames: ['Shadow_hidden', 'Shadow_envelope_group'], shadowModelName: st <= 2 ? 'Quadruped_Skeleton' : st === 3 ? 'Quadruped_Null' : 'Quadruped_Box', shadowIcon: t => (t <= 2 ? [7, 805] : t === 3 ? [6, 380] : [2, 479]) });
  Object.assign(out, { Model: h.model, GlobalSRT: h.gsrt, Sliders: h.controls, HiddenGroup: h.hidden, EnvGroup: h.env, ShadowModel: h.sModel, ShadowHiddenGroup: h.sHidden, ShadowEnvGroup: h.sEnv, ShadowGlobalSRT: h.sG });
  step('torso');
  const torso = app.run('MakeTorso', { Parent: h.gsrt, NbDivisions: UI.TorsoDivisions, StretchType: UI.TorsoStretch, GuideObjectCollection: all(guide, ['SpineBase', 'SpineHipDepth', 'SpineChestDepth', 'RibCageEnd', 'LFemur', 'LShoulderStart', 'LShoulder', 'RFemur', 'RShoulderStart', 'RShoulder']), ControlType: UI.IconType, SpineType: UI.TorsoType, Sliders: h.controls, ShadowType: st, ShadowParent: h.sG, NegativeScale: 0 });
  if (!torso) { logError(app, `${C}: torso could not be built`); return out; }
  const chestBone: X3DObject = torso.Spine?.TopVertebra ?? torso.spineEnd;
  Object.assign(out, { Torso: torso, ChestBone: chestBone, UpperBody: torso.UpperBody, SpineCurve: torso.Spine?.Curve ?? null, HipBone: torso.HipBone, RShoulderEff: torso.REff, LShoulderEff: torso.LEff });
  const tss = torso.ShadowStart ?? h.sG, tse = (i: number) => torso.ShadowEnds?.[i] ?? h.sG;
  step('hind legs');
  for (const s of ['L', 'R'] as const) {
    const claws = Array.from({ length: 6 }, (_, i) => g(`B${s}HindClaw${i + 1}`)).filter((x): x is X3DObject => !!x);
    out[`${s}DogLeg`] = app.run('MakeDogLeg', { Model: guide, Parent: torso.HipBone, FootParent: h.gsrt, GuideObjectCollection: [...all(guide, [`${s}Femur`, `B${s}Tibia`, `B${s}Metarsal`, `B${s}Pivot`, `B${s}PivotRight`, `B${s}PivotLeft`]), ...claws], ShortPrefix: `B${s}`, FullPrefix: `B${s === 'L' ? 'Left' : 'Right'}`, Sliders: h.controls, NbThighDivisions: UI.BackRoll ? UI.BackRollDivisions : 0, ShadowType: st, ShadowParent: tss });
  }
  step('front legs');
  const legSt = st === 5 || st === 7 ? 1 : st;
  for (const s of ['L', 'R'] as const) {
    const lg = app.run('MakeLeg', { Model: guide, Parent: s === 'L' ? torso.LEff : torso.REff, Prefix: s, GuideObjectCollection: all(guide, [`${s}Shoulder`, `${s}Ulna`, `F${s}Claw1`]), UpVectorBehindLeg: 0, NbThighDivisions: UI.FrontRoll ? UI.FrontRollDivisions : 0, ShadowType: legSt, ShadowParent: tse(s === 'R' ? 1 : 2) });
    const ft = app.run('MakeFoot', { Model: guide, Parent: h.gsrt, ShortPrefix: s, FullPrefix: s === 'L' ? 'Left' : 'Right', GuideObjectCollection: all(guide, [`F${s}Pivot`, `F${s}PivotRight`, `F${s}PivotLeft`, `F${s}Claw1`, `F${s}Claw2`, `F${s}Claw3`, `F${s}Claw4`]), Sliders: h.controls, Extension: 0, ShadowType: st, ShadowParent: lg?.ShadowEnds?.[0] ?? tse(0), ThreeBoneToe: false });
    out[`${s}Leg`] = lg; out[`${s}Foot`] = ft;
    if (lg && ft) { reparent(app, ft.Root, lg.Eff); cns(app, lg.Eff, 'Position', [ft.BaseGuide]); }
  }
  if (UI.MakeTail) { step('tail'); logNya(app, CMD, 'MakeTail (the tail builder is outside this row, note §4 Q3); no tail built'); out.Tail = null; }
  step('head');
  out.Head = app.run('MakeHead', { Parent: chestBone, GuideObjectCollection: all(guide, ['RibCageEnd', 'Neck', 'Head']), Prefix: '', AssemblyType: UI.HeadType, HeadType: 1, NbDivisions: UI.HeadDivisions, StretchType: UI.HeadStretch, Sliders: h.controls, EarGuideCollection: UI.Ears ? all(guide, ['REar1', 'LEar1']) : [], ShadowType: st, ShadowParent: tse(0) });
  if (UI.MakeBelly) {
    step('belly');
    const bg = all(guide, ['LowerStomach', 'UpperStomach']);
    if (bg.length === 2) {
      out.Belly = app.run('MakeBelly', { HipObject: torso.HipBone, VertebraObject: torso.Spine?.Vertebra?.[0] ?? chestBone, GuideObjectCollection: bg, ForwardRotationPerc: UI.BellyCenterPercentage });
      if (UI.BellySlide && out.Belly) for (const s of ['L', 'R'] as const) out[`${s}BellySlide`] = app.run('Make2PointSlide', { Prefix: s, GuidePoint1: g(`${s}Belly1`), GuidePoint2: g(`${s}Belly2`), Parent1: out.Belly.BellyBone, Parent2: torso.HipBone, UpVector: torso.HipBone, BoundingVolume: null });
    } else logWarn(app, 'makeQuadruped: no belly guides: belly slide will not be created');
  }
  step('character key sets');
  app.run('MakeQuadrupedCharacterKeySet', { RootObject: h.gsrt, CharacterKeySetName: 'Quadruped', DeleteMarkingSet: true, Prefix: '', Suffix: '' });
  if (h.sG) { if (UI.CreateShadowKeySet) app.run('MakeQuadrupedCharacterKeySet', { RootObject: h.sG, CharacterKeySetName: 'Quadruped', DeleteMarkingSet: true, Prefix: 'Shadow', Suffix: '' }); else app.run('SetKeyableRig', { RootObject: h.sG }); }
  step('synoptic');
  synoptic(app, h.gsrt, 'QuadSynoptic_IK1.htm'); if (h.sG) synoptic(app, h.sG, shadowSynoptic('Biped', st));
  step('default pose');
  // shipped quirk (note §3.4): the default pose is stored on `model` while the model is kept as `Model` → undefined owner
  logNya(app, CMD, 'default pose: StoreAction on an undefined model (shipped model/Model mismatch, note §3.4); not stored');
  app.select([h.model]);
  return out;
}

// ------------------------------------------------------------------ returned members (note §3, "Returns ... object")
const W = (s: string) => s.split(/\s+/).filter(Boolean);
/** The members each builder's returned object carries (absent ones are null, as an unset JScript member reads back). */
export const MEMBERS: Record<string, string[]> = {
  MakeBiped: W('UI modelString GuideModel keyWords pos Scale model GlobalSRT Sliders HiddenGroup EnvGroup ControlsGroup ShadowModel ShadowHiddenGroup ShadowEnvGroup ShadowGlobalSRT ShadowHip Torso ChestBone UpperBody SpineCurve HipBone RShoulderEff LShoulderEff Head LHand RHand RArm LArm LLeg RLeg LFoot RFoot'),
  MakeBipedDogLeg: W('UI modelString GuideModel keyWords pos Scale model GlobalSRT Sliders HiddenGroup EnvGroup ControlsGroup ShadowModel ShadowHiddenGroup ShadowEnvGroup ShadowGlobalSRT ShadowHip Torso ChestBone UpperBody SpineCurve HipBone RShoulderEff LShoulderEff Head LHand RHand RArm LArm LDogLeg RDogLeg'),
  MakeQuadruped: W('UI ModelString GuideModel keyWords pos Scale Model GlobalSRT Sliders HiddenGroup EnvGroup ShadowModel ShadowHiddenGroup ShadowEnvGroup ShadowGlobalSRT Torso ChestBone UpperBody SpineCurve HipBone RShoulderEff LShoulderEff LDogLeg RDogLeg LLeg RLeg LFoot RFoot Tail Head Belly LBellySlide RBellySlide'),
  MakeTorso: W('parent nb stretch ribCage controlType NegativeScaling CharacterSetName ShadowCharacterSetName Hidden Envelope ShadowType SpineType ShadowParent guides model sliders pos lpos rpos torsoObjs TailObjs TailPos scale HipPos BaseTrans TopTrans HipBone spineStart UpperBody Hip Chest spineEnd HipDepth ChestDepth Spine rroot lroot RSkel LSkel REff LEff ShadowStart ShadowEnds Shadows RSkelShadow LSkelShadow ChestMarker SideMarker BottomMarker Tail HiddenGroup envGroup'),
  MakeSpine: W('Envelope Hidden nb parent sliders stretch Type vertebraName CharacterSetName ShadowCharacterSetName ShadowType ShadowParent base top baseDepth topDepth chestTop pos objList Curve ShadowCurve length Root Skel Eff TopVertebra Vertebra scaleSlider volumeSlider CurveOp ShadowCurveOp vertDist boneIcon pathCns lengthOp ShadowSpine Shadows ShadowStart ShadowEnds HiddenGroup envGroup'),
  MakeArm: W('parent guides prefix constrainObj NegativeScaling ForearmDivisions BicepDivisions ShadowType ShadowParent HandRoot Hidden Envelope CharacterSetName ShadowCharacterSetName pos objs scale pushBack normalPlane Root Skel Eff elbow normal vecBack roll UpVpos UpVParent UpV BicepRoll ForeArmRoll ShadowEnvelope ArmShadow ShadowStart Shadows ShadowEnds ShadowForeArmRoll HiddenGroup envGroup'),
  MakeHand: W('parent model Prefix FingerType CharacterSetName ShadowCharacterSetName FingerGuides BladeGuides HandGuides ShadowType ShadowParent NegativeScaling Hidden Envelope markers blades foundKeyWords handRoot handEnd Finger positions mirrorPlane bone Root skel Eff scale Claw HandShadow FingerShadows ShadowStart Shadows ShadowEnds FingerRoots HiddenGroup envGroup'),
  MakeLeg: W('model parent prefix upVBehind CharacterSetName ShadowCharacterSetName guides ThighDivisions ShadowType ShadowParent Hidden Envelope pos scale Root Skel Eff pushBack knee normal vecBack proj_knee proj_upv roll upVpos upV ThighRoll ShadowEnds Shadows ShadowHidden ShadowEnvelope LegShadow ShadowStart HiddenGroup envGroup'),
  MakeFoot: W('model makeExtension prefix fullPrefix CharacterSetName ShadowCharacterSetName sliderPage Parent guideObjs ShadowType ShadowParent FootPos pivots Envelope Hidden scale Root Skel eff Foot Tip Roll Extension toeOffsets bindSquares PivotBase PlacePivot PivotRight PivotLeft FootGuides lastGuide toeGuide lastOffset FootEff ArmShadow ShadowStart Shadows ShadowEnds BaseGuide HiddenGroup envGroup'),
  MakeDogLeg: W('model prefix fullPrefix CharacterSetName ShadowCharacterSetName sliderPage Hidden Envelope parent FootAttachPoint guides ThighDivisions ShadowParent ShadowType FootShadowType pos objs footObjs scale Root Skel eff upPos UpVec upParent Knee Tarsus ArmShadow ShadowStart Shadows ShadowEnds Foot FootControl dogLeg ThighRoll HiddenGroup envGroup'),
  MakeHead: W('parent guides prefix CharacterSetName ShadowCharacterSetName ShadowType ShadowParent Type Ears inNbDivisions Stretch Sliders AssemblyType Hidden Envelope pos objs JawPos JawObjs scale normalPlane Root Skel Head HeadScale NeckBase BaseDepth TopDepth Spine EarChains JawRoot JawSkel HeadShadow JawShadow ShadowStart ShadowEnds Shadows HiddenGroup envGroup'),
  MakeBelly: W('Guides Hip Vertebra Model Perc Hidden Envelope hipPos vertPos lowerPos upperPos startLower startUpper BellyRoot BellySkel BellyEff BellyBone UpperRoot UpperSkel UpperEff UpperBone LowerRoot LowerSkel LowerEff LowerBone Scale SpringScale HiddenGroup envGroup'),
  MakeBicepRoll: W('Nb Divisions'),
  MakeForearmRoll: W('Sliders RollOffset Nb Divisions'),
  Make2PointSlide: W('model Hidden Envelope BindNull TopNull BaseNull Constraint HiddenGroup envGroup'),
  MakeThighSlide: W('Guides Pos Volume BindNull TopNull BaseNull'),
  MakeJointCompression: W('UpperBone LowerBone UpperTarget LowerTarget CurveTarget CurveCenter model Envelope Volume UpperJoint LowerJoint envGroup'),
  MakeShadowChain: W('Hidden Envelope Scale ShadowModel ShadowCharacterSetName Chain Parent SI3D ShadowEnds Shadows ShadowStart Root Skel HiddenGroup envGroup'),
  MakeShadowSpine: W('ShadowHidden ShadowEnvelope Hidden Envelope Base Spline Vertebra TopVertebra Parent ShadowModel RigModel ChestTop Scale ShadowCharacterSetName ShadowEnds Root Skel Root2 Skel2 UpVectors ShadowStart Shadows HiddenGroup envGroup'),
};
const fillMembers = (r: any, list: string[]) => { if (r && typeof r === 'object' && !Array.isArray(r) && Object.getPrototypeOf(r) === Object.prototype) for (const k of list) if (!(k in r) || r[k] === undefined) r[k] = null; return r; };

// ------------------------------------------------------------------ registration of the whole row
export function registerRigScriptsB15eCommands(app: App) {
  registerRigScriptsB15ePartCommands(app);
  registerRigScriptsB15eLimbCommands(app);
  app.register({ name: 'MakeBiped', label: 'Make Biped', category: CAT, description: 'Create Biped Rig (makeBiped.js; SelectUsingUI false shows the dialog)', args: argDefs(BIPED_ARGS), execute: (app, a) => makeBipedRig(app, a, false) });
  app.register({ name: 'MakeBipedDogLeg', label: 'Make Biped Dog Leg', category: CAT, description: 'Create Biped Dog Leg Rig', args: argDefs(DOGLEG_ARGS), execute: (app, a) => makeBipedRig(app, a, true) });
  app.register({ name: 'MakeQuadruped', label: 'Make Quadruped', category: CAT, description: 'Create Quadruped Rig', args: argDefs(QUAD_ARGS), execute: (app, a) => makeQuadrupedRig(app, a) });
  for (const [n, list] of Object.entries(MEMBERS)) { const d = app.commands.get(n); if (!d) continue; const ex = d.execute.bind(d); d.execute = (ap, a) => fillMembers(ex(ap, a), list); }
  // helpers for the check script and scripts (not Softimage commands)
  (app as any).rigScriptsB15e = {
    members: MEMBERS, state: () => rigState(app), buildSampleGuide: (kind: 'biped' | 'dogleg' | 'quadruped') => buildSampleGuide(app, kind), wireColor, opsOn, skeletonOf, markingSetsOf, rigIconCurves,
    hideObj: (o: X3DObject) => hideObj(app, o), groupsOf: (m: X3DObject) => app.scene.groupList.filter(gr => gr.parent === m), isProperty: (p: any) => p instanceof Property,
  };
}
