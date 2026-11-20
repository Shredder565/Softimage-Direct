# CMD-B15e: Character Rigging script commands (`Application\DSScripts\CharacterRigging\*.js`, `Charac_RigFromBiped.vbs`, `Charac_RigFromQuadruped.vbs`)

Row: **CMD-B15e** (closes ledger row **CMD-B11-RIG** for the rig builders listed below). Status: **SPEC** (24 names /
26 registrations), **SPEC-PARTIAL** (2 registrations: the `Charac_RigFromBiped.vbs` entries of `MakeBiped` and
`MakeBipedDogLeg`, file too large to read, see 4).
Run: 2026-11-19, si-analyst worker, unattended, batch 15 (binary first, REA + Ghidra)
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Source files (install root `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\DSScripts\`), read whole with
REA `open_binary(format=raw-binary, architecture=6502, entry_point=0x0)` + `read_bytes`:

| File | Bytes | sha256 (prefix) | Commands |
|---|---|---|---|
| `CharacterRigging\makeRigIcon.js` | 33070 | `97e88b1f` | MakeRigIcon |
| `CharacterRigging\makeBiped.js` | 48528 | `42628785` | MakeBiped (JScript entry) |
| `CharacterRigging\makeBipedDogLeg.js` | 44298 | `03393577` | MakeBipedDogLeg (JScript entry) |
| `CharacterRigging\makeQuadruped.js` | 31196 | `eada7dad` | MakeQuadruped (JScript entry) |
| `CharacterRigging\makeTorso.js` | 40898 | `08dc071f` | MakeTorso |
| `CharacterRigging\makeSpine.js` | 28198 | `79f4efad` | MakeSpine |
| `CharacterRigging\makeArm.js` | 26599 | `a1249a36` | MakeArm |
| `CharacterRigging\makeHand.js` | 29993 | `9c121cc8` | MakeHand |
| `CharacterRigging\makeLeg.js` | 21009 | `1b970917` | MakeLeg |
| `CharacterRigging\makeFoot.js` | 39204 | `ef5ee086` | MakeFoot |
| `CharacterRigging\makeDogLeg.js` | 37405 | `b503a266` | MakeDogLeg |
| `CharacterRigging\makeHead.js` | 31482 | `27b015a7` | MakeHead |
| `CharacterRigging\makeBelly.js` | 11500 | `732ebe75` | MakeBelly |
| `CharacterRigging\makeBicepRoll.js` | 2238 | `2fb0798b` | MakeBicepRoll |
| `CharacterRigging\makeForearmRoll.js` | 3450 | `bb11adec` | MakeForearmRoll |
| `CharacterRigging\make2PointSlide.js` | 4781 | `5e829350` | Make2PointSlide |
| `CharacterRigging\makeThighSlide.js` | 9041 | `a25f1f7c` | MakeThighSlide |
| `CharacterRigging\makeJointCompression.js` | 6689 | `e357d8f7` | MakeJointCompression |
| `CharacterRigging\makeHip.js` | 3130 | `caa9a6ac` | MakeHip |
| `CharacterRigging\makeShadowChain.js` | 11423 | `ea3729b2` | MakeShadowChain |
| `CharacterRigging\makeShadowSpine.js` | 20052 | `ba983bc7` | MakeShadowSpine |
| `CharacterRigging\makeCharacterKeySet.js` | 13027 | `db3c7441` | MakeBipedCharacterKeySet, MakeQuadrupedCharacterKeySet, SetKeyableRig |
| `Charac_RigFromQuadruped.vbs` | 56886 | `459fff6a` | MakeQuadruped (VBScript entry `MakeQuadrupedUI`) (+ CreateRigFromQuadruped, not in this row) |
| `Charac_RigFromBiped.vbs` | 220070 | `0d4d6f50` | MakeBiped / MakeBipedDogLeg (VBScript entries `MakeBipedUI` / `MakeBipedDogLegUI`), **not read** |

Method: each file opened as a headerless 6502 image (file offset 0 at 0x0) and read in one `read_bytes` (all <64 KB
except `Charac_RigFromBiped.vbs`); size of the biped `.vbs` from `inspect_byte_entropy`. The 6502 loader refuses an
image >0x10000 bytes and the m68k raw load is rejected by the Ghidra provider for reads, so `Charac_RigFromBiped.vbs`
(220070 bytes) could not be read. Arguments / defaults from `data/commands_full.json` (every entry for these names,
duplicates included). No earlier `docs/ghidra` note covers these scripts.

## 1. Handler table

There is no CLSID / factory / vtable for script commands: the "handler" is the script function the registry names.

| Command | Language / file | Handler function | Status |
|---|---|---|---|
| `MakeRigIcon` | JScript `makeRigIcon.js` | `makeRigIcon` | SPEC |
| `MakeBiped` (entry 1) | JScript `makeBiped.js` | `makeBiped` | SPEC |
| `MakeBiped` (entry 2) | VBScript `Charac_RigFromBiped.vbs` | `MakeBipedUI` | SPEC-PARTIAL (file unread; inferred same as `MakeQuadrupedUI`) |
| `MakeBipedDogLeg` (entry 1) | JScript `makeBipedDogLeg.js` | `makeBipedDogLeg` | SPEC |
| `MakeBipedDogLeg` (entry 2) | VBScript `Charac_RigFromBiped.vbs` | `MakeBipedDogLegUI` | SPEC-PARTIAL (as above) |
| `MakeQuadruped` (entry 1) | JScript `makeQuadruped.js` | `makeQuadruped` | SPEC |
| `MakeQuadruped` (entry 2) | VBScript `Charac_RigFromQuadruped.vbs` | `MakeQuadrupedUI` | SPEC |
| `MakeTorso` | JScript | `makeTorso` | SPEC |
| `MakeSpine` | JScript | `makeSpine` | SPEC |
| `MakeArm` | JScript | `makeArm` | SPEC |
| `MakeHand` | JScript | `makeHand` | SPEC |
| `MakeLeg` | JScript | `makeLeg` | SPEC |
| `MakeFoot` | JScript | `makeFoot` | SPEC |
| `MakeDogLeg` | JScript | `makeDogLeg` | SPEC |
| `MakeHead` | JScript | `makeHead` | SPEC |
| `MakeBelly` | JScript | `makeBelly` | SPEC |
| `MakeBicepRoll` | JScript | `makeBicepRoll` | SPEC |
| `MakeForearmRoll` | JScript | `makeForearmRoll` | SPEC |
| `Make2PointSlide` | JScript | `make2PointSlide` | SPEC |
| `MakeThighSlide` | JScript | `makeThighSlide` | SPEC |
| `MakeJointCompression` | JScript | `makeJointCompression` | SPEC |
| `MakeHip` | JScript | `makeHip` | SPEC |
| `MakeShadowChain` | JScript | `makeShadowChain` | SPEC |
| `MakeShadowSpine` | JScript | `makeShadowSpine` | SPEC |
| `MakeBipedCharacterKeySet` | JScript `makeCharacterKeySet.js` | `makeBipedCharacterKeySet` | SPEC |
| `MakeQuadrupedCharacterKeySet` | JScript `makeCharacterKeySet.js` | `makeQuadrupedCharacterKeySet` | SPEC |
| `SetKeyableRig` | JScript `makeCharacterKeySet.js` | `setKeyableRig` | SPEC |

## 2. Shared facts (apply to every builder; later sections say "standard")

- **Argument passing.** Object arguments come through the `Collection` arg handler, so the scripts take item 0 of
  each object argument (`"{F1D7703B-…}"` default = empty). The registry GUID default means "nothing"; a missing
  required object makes the command log `"<fn>: argument N is invalid"` (mostly `siError`) and return nothing
  (`undefined`, i.e. no return value / `Empty`). Guide collections stay collections.
- **Return value.** Every builder returns a plain JScript object (or the created X3DObject for `MakeRigIcon` /
  `MakeHip`); member names are listed per command. Script commands return it as a dispatch object; a VBScript caller
  can read the members by name.
- **Component-to-component calls.** Builders call the other rig commands by their command names (MakeTorso →
  MakeSpine → MakeShadowSpine, etc.); the order is given per command.
- **"Hidden"/"Envelope" collections.** Each component collects objects to hide and objects to envelope. Standard
  hide setup: if the parent's model has a group named `Hidden` (case-insensitive lookup by `Groups.Item`), the hidden
  objects are added to it, else each gets `visibility.viewvis = false`; if the model has a group `Envelope_group`, the
  envelope objects are added to it. Shadow components instead look for a group whose FullName contains
  `Shadow_hidden` / `Shadow_envelope_group` under the shadow model.
- **Standard marking set** (`addMarkingSet(obj, pos, rot, single, keySetName)`): adds a `Custom_parameter_list`
  property named `MarkingSet` on the object; for pos (posx/posy/posz) and rot (rotx/roty/rotz) it either marks the
  `kine.local.*` parameters keyable and adds proxy parameters to the MarkingSet, or clears their keyable attribute;
  optional single extra `kine.local.<single>` proxy; scl x/y/z always cleared from keyable; finally a string parameter
  `CharacterKeySet` holding the key-set path (e.g. `Upper.Torso`, `Lower.L_Leg`, `ShadowUpper.ShadowR_Arm`, `None`).
  `MakeShadowSpine`'s copy differs: it does not touch keyable attributes, and a non-empty single adds the same proxy
  three times.
- **Character key-set path names used by components** (prefix = side, e.g. `L`, `R`, `BL`):
  Torso `Upper.Torso` / `ShadowUpper.ShadowTorso`; Arm `Upper.<p>_Arm` / `ShadowUpper.Shadow<p>_Arm`; Hand
  `Upper.<p>_Hand` / `ShadowUpper.Shadow<p>_Hand`; Leg, Foot, DogLeg `Lower.<p>_Leg` / `ShadowLower.Shadow<p>_Leg`;
  Head `Upper.<p>Head_Neck` / `ShadowUpper.Shadow<p>Head_Neck`; quadruped tail `Lower.Tail` / `ShadowLower.ShadowTail`;
  controls that must only become keyable (effectors, up vectors) use `None`; root controls use the rig name
  (`Biped`, `Biped_DogLeg`, `Quadruped`, `ShadowBiped`, `ShadowQuadruped`) or `Upper` / `Lower`.
- **Shadow type enum** (rig-level `ShadowType`): 0 none, 1 SI|3D skeleton, 2 XSI skeleton, 3 null hierarchy,
  4 box, 5 box with IK arms, 6 box with IK legs, 7 box with IK arms and legs. Components treat 1–3 as "skeleton
  shadow" (via MakeShadowChain / MakeShadowSpine) and >3 as box shadows; biped/quadruped map 5/7 to type 1 for arms
  (and quadruped front legs) and 6/7 to type 1 for legs. `MakeHand` adds 8 to mean "no shadow fingers".
- **Box shadow**: a `Cube` MeshSurface named after the part, global transform of the start object, `Pose`
  constraint (no compensation) to the start object, operator applied with `ApplyOp`: `Connector_Box` (start, end) /
  `Connector_T` (base, side, top) / `Connector_L` (start, end) / `Connector_Head`, parameters `topWidth`, `topDepth`
  (= width × 0.6, 0.75, 0.8 or 0.3 depending on component), `bottomWidth`/`bottomDepth` (× taper), `topOffset_z` /
  `bottomOffset_z` (usually 90), optional `topOffset_x` spin, `split` true for split boxes, `invert` true on spine
  boxes; a Phong material diffuse (0.741, 0.653, 0.603), ambient (0.845, 0.496, 0.300); Display property wirecol 479;
  and a rot-only marking set with the shadow key-set name.
- **Chain helpers.** Chains are drawn with `Add2DChain(start, end, normal, type)` (type 3 for most, 1 for hand bone
  and belly, 2 for shadow spine) / `Add3DChain` (dog leg), extra bones with `AddBone(pos, 2, name)`. After drawing,
  "AlignFirstBone" flips the first bone 180° about its local X when its Y axis points away (dot < −1e-6) from the
  root Y axis. "setChainScale(skel, s)": every element `shadow_icon = 1`, `primary_icon = 0`; root and effector get
  shadow_scaleX/radius/shadow_scaleZ = s × k_end, bones get radius/shadow_scaleZ = s × k_bone (per-component k listed
  where they differ from 0.5 / 1.0).
- **Rig icons**: curve controls are linear NURBS curves (`AddNurbsCurve`, degree 1, non-uniform, siSINurbs) with a
  Display property `wirecol`; colors used throughout: 49 spine/hip bones, 253 chest/upper/up-vectors, 770 hip/lower,
  489 effectors, 805 skeleton shadows, 381/380 null shadows, 479 box shadows, 607 guide nulls, 507 foot up-vector
  nulls, 748 slide/joint nulls, 728 bounding volumes, 893 GlobalSRT.
- **Scripted operators referenced by name** (all from the Character Rigging plug-in, applied with `ApplyOp` or
  `AddCustomOp`): `HipIcon`, `chestBone`, `SpineCurve`, `FixedLength`, `SpinePointAt`, `ClusterCenter` (built-in),
  `RIG_stretchVertebraOp`, `RIG_grabOp`, `RIG_twoBoneToes`, `ToeGuide`, `DogLeg`, `FirstBoneRollDivisionRO`,
  `ForeArmRollDivision`, `Connector_*`, `ApplySpringOp` (command). Their own math is out of scope here.

## 3. Commands

### 3.1 MakeRigIcon

Args: `Parent` (obj, default none → scene root), `Type` = 5, `X`,`Y`,`Z` = 0.0 (world position), `Xlength`,
`Ylength`, `Zlength` = 1.0, `Color` = 65, `Name` = "", `XOffset`,`YOffset`,`ZOffset` = 0.0.

Creates one NURBS-curve icon under Parent, named `Name`, whose global transform is a pure translation to (X,Y,Z);
adds a Display property with `wirecol = Color` (for types 9–14, 16, 17 only when Color is non-zero). The offset is
added to every point but only when all three offsets are non-zero. Type values: 0 right square (Y×Z plane, uses
Ylength/Zlength, centered), 1 top square (X×Z), 2 cube resting on its base (Y from 0 to Ylength), 3 centered cube,
4 pyramid with base at 0, 5 centered pyramid, 6 diamond, 7 cube with a peak (box to Ylength/2, apex at Ylength),
8 centered diamond, 9 curve sphere (three closed cubic circles of radius 0.75, scaled by the lengths), 10 eye-arrow,
11 look-at, 12 pin, 13 angle survey, 14 eyeball, 15 tooth, 16 right-triangle, 17 "RAKHead". Types 9–14, 16, 17 are
multi-curve lists (`AddNurbsCurveList2`) of fixed unit shapes scaled per axis and default their name to the shape
name and lengths to 1 when 0/empty; types 0–8 and 15 are single linear curves (open for 0–1, closed polyline
sequences for the rest). Any other Type creates nothing and returns undefined.
Returns: the created curve X3DObject.
**Wire contract**: `MakeRigIcon(Parent, Type, X, Y, Z, Xl, Yl, Zl, Color, Name, Ox, Oy, Oz)` → X3DObject; no error
path (parent defaults to scene root).

### 3.2 MakeBiped (JScript `makeBiped`)

Args (33, all with defaults): `TorsoType`=1, `TorsoStretch`=0, `TorsoDivisions`=3, `IconType`=0, `MakeBelly`=false,
`BellySlide`=0, `BellyCenterPercentage`=0.25, `HeadType`=0, `HeadStretch`=0, `HeadDivisions`=3, `Ears`=false,
`RotationOrder`=0, `ArmSymmetry`=0, `ArmAttachment`=0, `FingerType`=0, `ForeArmRoll`=false, `ForeArmDivisions`=3,
`BicepRoll`=false, `BicepDivisions`=3, `ThighRoll`=false, `ThighDivisions`=3, `ArmPitSlide`, `HipSlide`,
`ThighSlide`, `ElbowsJoint`, `KneeJoint` = false, `ShadowType`=0, `ShadowHands`=0, `OneModel`=false,
`IndependentLower`=false, `ThreeBoneToes`=true, `CreateShadowCharacterKeySet`=false, `SelectUsingUI`=false.

Enum meanings (from the dialog): TorsoType 1 quaternion spine (implicit vertebrae), 2 skeleton spine, 3 world-axis
aligned quaternion spine, 4 near-axis aligned quaternion spine (the dialog stores 0–3 and adds 1); TorsoStretch
0 fixed length, 1 stretch to chest; IconType 0 square, 1 cube controls; HeadType 0 skeleton head, 1 spine head;
RotationOrder 0 YZX, 1 XYZ; ArmSymmetry 0 symmetric (right arm scaled −1), 1 both positive; ArmAttachment 0 arms
children of shoulder effectors, 1 children of UpperBody with a position constraint to the shoulder effector;
FingerType 0 2D finger chains, 1 3D; ShadowHands 0 hands and fingers, 1 no shadow fingers.

**The last argument decides the mode**: when `SelectUsingUI` is false (default) the command builds a modal dialog
(temporary `Custom_parameter_list` "Make Biped" on the scene root, title string id 1164 from XSISCRIPTS, help
`animtoolbar28.htm`), and the other 32 arguments are ignored; Cancel → logs `"makeBiped: cancelled"` and returns.
When true, the arguments are used directly. `CreateShadowCharacterKeySet` is forced false in dialog mode.

Guide lookup: if the selection's model (or the selected model) has a group `DetailedGuide` and is not the scene
root, it is the guide; else the scene-root child named `Biped_Guide`. No guide → retry with `BipedPropGuide`; if that
exists logs warning "This biped guide is not compatible with MakeBiped (XSI v4.0), using CreateRigFromGuide" and runs
the `CreateRigFromGuide` command; else logs `"makeBiped: No Biped Guide Found"` (siError). Either way returns nothing.
Scale = distance(RHand, LHand)/1.25 (guide children `RHand`, `LHand`). ArmSymmetry is inverted internally (0→1).

Steps (progress bar "Make Biped", 13 steps, visible only in dialog mode; Cancel at any step deletes the new model
branch and logs "makeBiped: cancelled"):
1. Model `Biped` under the scene root; `GlobalSRT` = MakeRigIcon type 4 (pyramid), size Scale×0.09, color 893;
   marking set pos+rot, key set `Biped`. `Controls` custom property on the model (help `animtoolbar48.htm`); groups
   `hidden` (viewvis 0), `envelope_group`, `controls_group` (GlobalSRT added). With ShadowType ≠ 0: a second model
   `Biped_Shadow` (or the same model when OneModel), groups `Shadow_hidden` (viewvis 0) and
   `Shadow_envelope_group`, a shadow GlobalSRT null (named `GlobalSRT`, or `Shadow_GlobalSRT` when OneModel; size
   Scale×0.07 (0.08 for null/OneModel), primary_icon 8, color 805 skeleton / 380 null / 479 box), marking set key set
   `ShadowBiped`, `Pose` constraint (compensated) to GlobalSRT.
2. Torso: MakeTorso(GlobalSRT, TorsoDivisions, TorsoStretch, guides, IconType, TorsoType, Controls, ShadowType,
   ShadowGlobalSRT, ArmSymmetry). Guides in order: `SpineBase`, `SpineHipDepth`, `SpineChestDepth`, `RibCageEnd`,
   `LLeg`, `LShoulderStart`, `LShoulder`, `RLeg`, `RShoulderStart`, `RShoulder`, `RibCageStart`. Controls group gets
   UpperBody (and HipDepth, ChestDepth, Hip, Chest unless TorsoType 2); hidden gets both shoulder roots.
3. Head: MakeHead(ChestBone, [RibCageEnd, Neck, Head], "", HeadType, 0, HeadDivisions, HeadStretch, Controls, ears
   [REar1, LEar1 when Ears and both exist], ShadowType, torso shadow end 0).
4. Hands (left then right): MakeHand(UpperBody, fingers, blades, [<s>Hand, <s>HandEnd], side, FingerType,
   ShadowType (+8 when ShadowHands), torso shadow end, symmetry (left always 0)). Fingers are guides
   `<s>Pinky1`, `<s>Ring1`, `<s>Middle1`, `<s>Index1`, `<s>Thumb1` with blades `<s><Finger>_fingerBlade`, only pairs
   that both exist. Claws added to controls group.
5. Arms (right then left): MakeArm(shoulder effector or UpperBody per ArmAttachment, [<s>Shoulder, <s>Elbow,
   <s>Hand], side, constraint object (null or shoulder effector), ForeArmDivisions (0 unless ForeArmRoll),
   BicepDivisions (0 unless BicepRoll), arm shadow type, torso shadow end 1/2, hand root, symmetry). Hand roots are
   re-parented under the arm effectors, shadow hands under the arm shadow ends; RotationOrder 0 sets `rotorder = 3`
   (YZX) on both biceps; arm effectors and up vectors added to controls group.
6. Legs: MakeLeg(guide, HipBone, side, [<s>Leg, <s>Knee, <s>Foot1], 1, ThighDivisions (0 unless ThighRoll), leg
   shadow type, shadow parent). With IndependentLower and a shadow rig, a null named like the hip bone (primary_icon
   4, size 1.2, frozen, Pose-constrained to HipBone, color 805) is made under the torso shadow start and used as the
   legs' shadow parent. Feet: MakeFoot(guide, GlobalSRT, side, "Left"/"Right", [<s>Pivot, <s>PivotRight,
   <s>PivotLeft, <s>Foot1..4], Controls, 0, ShadowType, leg shadow end, ThreeBoneToes); foot root under the leg
   effector; leg effector `Position` constraint to the foot's BaseGuide. Up vectors, Foot, Roll, Tip and first toe
   offset go to controls group.
7. Slides: ArmPitSlide → Make2PointSlide("RArmPit"/"LArmPit", <s>ArmPitTop, <s>ArmPitBase, bicep, ChestBone,
   ChestBone); HipSlide → Make2PointSlide("RHip"/"LHip", <s>HipTop, <s>HipBottom, HipBone, thigh, HipBone);
   ThighSlide → MakeThighSlide(side, [<s>Rear1, <s>LowerThigh, <s>HipBottom, <s>Leg, <s>Knee], HipBone, thigh).
8. Joints: ElbowsJoint → MakeJointCompression("<s>Elbow", bicep, forearm, [<s>ElbowJoint2, <s>ElbowJoint1,
   <s>ForeArmSquash, <s>ForeArmCenter], bicep roll divisions or null); KneeJoint → same for "<s>Knee" with
   [<s>ThighBack1, <s>ThighBack2, <s>CalfBack, <s>CalfCenter] (divisions read from an undefined `LegDivisions`, so
   always null).
9. Belly (MakeBelly): MakeBelly(HipBone, first spine vertebra, [LowerStomach, UpperStomach], BellyCenterPercentage);
   BellySlide → Make2PointSlide("L"/"R", <s>Belly1, <s>Belly2, belly bone, HipBone, HipBone).
10. Key sets: MakeBipedCharacterKeySet(GlobalSRT, "Biped", true, "", ""); with a shadow rig either
    MakeBipedCharacterKeySet(ShadowGlobalSRT, "Biped", true, "Shadow", "") when CreateShadowKeySet, else
    SetKeyableRig(ShadowGlobalSRT).
11. Synoptic property on GlobalSRT, path `$SI_HOME/Data/XSI_SAMPLES/Synoptic/Rig/BipedSynoptic_CDK1.htm`; shadow
    GlobalSRT gets `SkeletonBipedSynoptic.htm` (types 1, 2), `NullBipedSynoptic.htm` (3) or `BoxBipedSynoptic.htm`.
12. Default pose: select GlobalSRT branch and child nodes, keep the keyable parameters, `StoreAction(model, params,
    1, "DefaultPose", true, 1, 5)`; shadow rig likewise "ShadowDefaultPose" (stored on the main model).

Returns the biped object with members: `UI` (all the option values above plus `CreateShadowKeySet`), `modelString`,
`GuideModel`, `keyWords`, `pos`, `Scale`, `model`, `GlobalSRT`, `Sliders`, `HiddenGroup`, `EnvGroup`,
`ControlsGroup`, `ShadowModel`, `ShadowHiddenGroup`, `ShadowEnvGroup`, `ShadowGlobalSRT`, `ShadowHip`, `Torso`,
`ChestBone`, `UpperBody`, `SpineCurve`, `HipBone`, `RShoulderEff`, `LShoulderEff`, `Head`, `LHand`, `RHand`, `RArm`,
`LArm`, `LLeg`, `RLeg`, `LFoot`, `RFoot`, `RArmpit`, `LArmpit`, `RHip`, `LHip`, `RThigh`, `LThigh`, `LElbow`,
`RElbow`, `LKnee`, `RKnee`, `Belly`, `LBellySlide`, `RBellySlide` (optional ones only when the option is on).
**Wire contract**: 33 positional args as above; SelectUsingUI=false → modal dialog, true → args; returns biped
object or nothing (no guide / cancel).

### 3.3 MakeBipedDogLeg (JScript `makeBipedDogLeg`)

Args: same as MakeBiped minus `KneeJoint` and `ThreeBoneToes`, and the key-set flag is named `CreateShadowKeySet`
(31 args, last `SelectUsingUI`=false). Same as MakeBiped except: guide `Biped_DogLeg_Guide` (fallback
`BipedPropGuide` → `CreateRigFromGuide`); model `Biped_DogLeg`, GlobalSRT key set `Biped_DogLeg`, help
`animtoolbar61.htm`, dialog title id 1165 ("Make Biped Dog Leg"); no `controls_group`; shadow groups renamed `hidden`
/ `envelope_group`; shadow GlobalSRT is a MakeRigIcon (type 7 color 805 skeleton, type 6 color 380 null, type 2
color 479 box). Torso mirror guides use `Femur` instead of `Leg`. Step order: hierarchy, torso, hands, arms,
**dog legs**, head, key sets, synoptic, slides + joints, belly, default pose (11 steps).
Dog legs: MakeDogLeg(guide, HipBone, GlobalSRT, [<s>Femur, <s>Tibia, <s>Metarsal, <s>Pivot, <s>PivotRight,
<s>PivotLeft, <s>Foot1..6], side, "Left"/"Right", Controls, ThighDivisions, ShadowType, torso shadow start) →
members `LDogLeg`, `RDogLeg` (no LLeg/RLeg/feet members). Hip slide uses the dog-leg thigh; thigh slide guides
[<s>Rear, <s>LowerThigh, <s>HipBottom, <s>Femur, <s>Tibia]; no knee joint. Key sets use name `Biped_DogLeg`.
**Wire contract**: as MakeBiped with the arg list above.

### 3.4 MakeQuadruped (JScript `makeQuadruped`)

Args (20): `TorsoType`=1, `TorsoStretch`=0, `TorsoDivisions`=3, `IconType`=0, `MakeBelly`=false, `BellySlide`=0,
`BellyCenterPercentage`=0.25, `HeadType`=0, `HeadStretch`=0, `HeadDivisions`=3, `Ears`=false, `MakeTail`=false,
`TailDivisions`=6, `FrontRoll`=false, `FrontRollDivisions`=3, `BackRoll`=false, `BackRollDivisions`=3,
`ShadowType`=0, `CreateShadowKeySet`=false, `SelectUsingUI`=false. Dialog ("Make Quadruped", id 1170, help
`animtoolbar34.htm`) offers TorsoType quaternion/skeleton only (stored +1), IconType default 1, MakeTail default 1,
TailDivisions default 6.

Guide: scene-root child `Quadruped_Guide` (no selection lookup); fallback `Quadruped_PropGuide` → warning and runs
`CreateRigFromQuadruped`; else `"makeQuadruped: No Quadruped Guide Found"`. Scale = distance(RibCageEnd,
SpineBase)/1.25. Steps (11): model `Quadruped`, GlobalSRT MakeRigIcon type 4 size Scale×0.2 color 893, key set
`Quadruped`, `Controls` property; shadow model `Quadruped_Skeleton` (icon type 7, 805) / `Quadruped_Null` (6, 380) /
`Quadruped_Box` (2, 479) with key set `ShadowQuadruped` and Pose constraint → torso (guides `SpineBase`,
`SpineHipDepth`, `SpineChestDepth`, `RibCageEnd`, `L/RFemur`, `L/RShoulderStart`, `L/RShoulder`; 10 guides, no chest
bone; negative scaling 0) → hind legs MakeDogLeg(guide, HipBone, GlobalSRT, [<s>Femur, B<s>Tibia, B<s>Metarsal,
B<s>Pivot, B<s>PivotRight, B<s>PivotLeft, B<s>HindClaw1..6], "BL"/"BR", "BLeft"/"BRight", Controls,
BackRollDivisions, ShadowType, torso shadow start) → front legs MakeLeg(guide, shoulder effector, side,
[<s>Shoulder, <s>Ulna, F<s>Claw1], 0, FrontRollDivisions, leg shadow type, torso shadow end) and MakeFoot(guide,
GlobalSRT, side, "Left"/"Right", [F<s>Pivot, F<s>PivotRight, F<s>PivotLeft, F<s>Claw1..4], Controls, 0, ShadowType,
leg shadow end) with no ThreeBoneToes argument, i.e. two-bone toes → tail when MakeTail = 1: MakeTail(HipBone,
[TailStart, TailStartDepth, TailEndDepth, TailEnd], TailDivisions, ShadowType, torso shadow start, "Lower.Tail",
"ShadowLower.ShadowTail") → head MakeHead(ChestBone, [RibCageEnd, Neck, Head], "", HeadType, **1** (quadruped head),
…) → belly (missing belly guides log warning "makeQuadruped: no belly guides: belly slide will not be created") →
MakeQuadrupedCharacterKeySet / SetKeyableRig as for biped → synoptic `QuadSynoptic_IK1.htm` (shadow synoptics as
biped) → default pose.
Returns the quadruped object: `UI`, `ModelString`, `GuideModel`, `keyWords`, `pos`, `Scale`, `Model`, `GlobalSRT`,
`Sliders`, `HiddenGroup`, `EnvGroup`, `ShadowModel`, `ShadowHiddenGroup`, `ShadowEnvGroup`, `ShadowGlobalSRT`,
`Torso`, `ChestBone`, `UpperBody`, `SpineCurve`, `HipBone`, `RShoulderEff`, `LShoulderEff`, `LDogLeg`, `RDogLeg`,
`LLeg`, `RLeg`, `LFoot`, `RFoot`, `Tail`, `Head`, `Belly`, `LBellySlide`, `RBellySlide`.
Quirk: cancel and default-pose code use the member `model` (lower case) while the model is stored as `Model`, so the
default-pose actions are stored on an undefined owner and cancel deletes nothing (inferred effect; not executed).
**Wire contract**: 20 positional args; returns quadruped object or nothing.

### 3.5 MakeQuadruped (VBScript `MakeQuadrupedUI`, `Charac_RigFromQuadruped.vbs`)

Args (19): as the JScript entry without `CreateShadowKeySet`; registry `MakeTail` default 0, `TailDivisions` 3.
All arguments are in/out. It always calls the JScript `MakeQuadruped` with SelectUsingUI = **false** (so the dialog
is always shown and incoming values are ignored) and an uninitialised shadow-key-set value; on success copies every
`quadruped.UI` value back into the output arguments, sets the last argument to true, inspects `quadruped.Sliders`
and returns the quadruped object (errors suppressed with On Error Resume Next). Purpose (header comment): JScript
cannot write output arguments, so this VBScript wrapper records the chosen options in the command log.
**Wire contract**: `MakeQuadruped` (UI entry) = run the dialog version, write the options back to the args, return the
quadruped object. Which of the two `MakeQuadruped` registrations wins at load time is not stated in the files.

### 3.6 MakeBiped / MakeBipedDogLeg (VBScript entries, `Charac_RigFromBiped.vbs`)

Handlers `MakeBipedUI` / `MakeBipedDogLegUI` (registry args: same lists as the JScript entries). **SPEC-PARTIAL**:
the file is 220070 bytes and could not be loaded (6502 raw image limit 64 KB). By the registry handler names and the
quadruped file (which states it is the "UI version" pattern) these are inferred to be the same output-argument
wrappers around the JScript builders. Same file also holds `CreateRigFromGuide` (old guide builder, not this row).

### 3.7 MakeTorso

Args: `Parent` (obj, required), `NbDivisions`=3, `StretchType`=0, `GuideObjectCollection` (10 or 11 guides),
`ControlType`=0 (0 square, 1 cube controls), `SpineType`=0 (0 quaternion spine with polygon vertebrae, 1 implicit
vertebrae, 2 skeleton spine, 3 world-aligned, 4 near-axis aligned), `Sliders` (obj), `ShadowType`=0,
`ShadowParent` (obj, default scene root), `NegativeScale`=0 (0 none, 1 right shoulder mirrored, 2 left).
Guides: spine base, hip depth, chest depth, spine end; L leg start, L shoulder start, L shoulder end; R same; optional
11th = chest bone position (rib cage start). Errors: count ≠ 10/11 → "makeTorso: guide collection (argument 1) needs
10 or 11 objects. Contains N objects" (siError); no parent → "makeTorso: required argument 0 is invalid".
Build: scale = |spineBase − spineEnd|/1.25; hip position 60% from the leg-start midpoint toward the spine base; spine
orientation Y along the spine (types 3/4 zero the Z or the nearest-axis component), X toward global X.
`HipPlate` circle curve under Parent (color 49) with operator `HipIcon` (spine_point / leg_point from guides in local
space, height 1.3, indent_height 0.5, top_height 0.4, socket_height 0.3, socket_depth 0.5, socket_width 0.5, depth
0.4, cap_width 0.25, width 0.7); null `SpineStart` (hidden). Controls: `UpperBody` (square 2s / cube 0.8s, color
253, neutral pose, key set `Upper`), `Hip` (1.5s / 0.6s, 770, key set `Lower`) and `Chest` (2s / 0.8s, 253, `Upper`,
neutral pose) under UpperBody; null `SpineEnd` under Chest; HipPlate re-parented under Hip. Ring nulls `HipDepth`
(under Hip, 770) and `ChestDepth` (under Chest, 253), pos-only marking sets. MakeSpine(model, HipPlate, Nb,
SpineType, Stretch, SpineStart, SpineEnd, HipDepth, ChestDepth, chest-bone guide or null, Sliders, ShadowType,
ShadowParent, "SpineVertebra", "Upper.Torso", "ShadowUpper.ShadowTorso"); skeleton spine (2) moves HipPlate under
UpperBody and deletes Hip and Chest. Shoulders: 2D chains (normal +Y) from the spine top vertebra to shoulder start/
end (mirrored with `DuplicateSymmetry` for the negative-scaled side), names `<s>ShoulderRoot`, `<s>Shoulder`,
`<s>ShoulderEff`, scale s×0.3 (ends ×0.2), bone color 489, rot-only marking sets. Skeleton shadows (1–3): null
`UpperBody` under ShadowParent Pose-constrained to Hip (UpperBody for skeleton spine) + MakeShadowChain for both
shoulders; box shadows: `Chest` T-connector, `UpperBody` T-connector (split) with side/bottom marker nulls, shoulder
boxes (spin ±45). Tail: if the spine-base guide has numbered duplicates (`<name>1`, `<name>2`, …; up to 40), ≥3 of
them → MakeTail(HipPlate, duplicates, count+2, min(ShadowType,4), shadow start, key-set names); 1–2 → warning
"MakeTorso: Not enough guide points to generate a tail: 3 or more guide objects are needed."
Returns torso object: `parent`, `nb`, `stretch`, `ribCage`, `controlType`, `NegativeScaling`, `CharacterSetName`,
`ShadowCharacterSetName`, `Hidden`, `Envelope`, `ShadowType`, `SpineType`, `ShadowParent`, `guides`, `model`,
`sliders`, `pos`, `lpos`, `rpos`, `torsoObjs`, `TailObjs`, `TailPos`, `scale`, `HipPos`, `BaseTrans`, `TopTrans`,
`HipBone`, `spineStart`, `UpperBody`, `Hip`, `Chest`, `spineEnd`, `HipDepth`, `ChestDepth`, `Spine` (MakeSpine
object), `rroot`, `lroot`, `RSkel`, `LSkel`, `REff`, `LEff`, `ShadowStart`, `ShadowEnds` (0 chest/spine end, 1 right,
2 left, 3 tail), `Shadows`, `RSkelShadow`, `LSkelShadow`, `ChestMarker`, `SideMarker`, `BottomMarker`, `Tail`,
`HiddenGroup`, `envGroup`.
**Wire contract**: positional args as listed; returns torso object or nothing on the two errors.

### 3.8 MakeSpine

Args: `Model`, `Parent` (required), `NbVertebrae`=3, `SpineType`=0, `Stretchy`=false, `SpineBaseObject` (req.),
`SpineTopObject` (req.), `BottomDepthObject` (req.), `TopDepthObject` (req.), `ChestTop`, `Sliders`, `ShadowType`=1,
`ShadowParent`, `VertebraeName`="", `CharacterSetName`="", `ShadowCharacterSetName`="". Missing required →
"makeSpine: argument N is invalid" (siError, all listed, then return). (Depth objects are required by the check
even though an internal fallback would create `BaseDepth`/`TopDepth` nulls at 40% / 60%.)
Curve `spinecurve` (cubic, 4 CVs base, base depth, top depth, top; created under the scene root, length read, then
parented under Parent, color 49 unless skeleton). Skeleton type (2): chain of Nb bones sampled along the curve
(+1 bone to ChestTop), normal +X; names root `SpineEff`, bones `Lumbar<i>`, effector `SpineRoot` (sic), scale
length×0.4; `Vertebra` = bones from index 2; curve deleted. Other types: sliders page (given, or a new
`Spine_Control` property on the curve) gets `spine_scale` (1, range 0.01–10000, UI 0.01–10) and `volume_factor` (0,
±10000, UI 0–10); non-stretchy → operator `SpineCurve` (curve, base, base depth, top depth, top) with `lgoal` = length
and `lScale` driven by spine_scale; stretchy → four `ClusterCenter` operators (point i to base / depths / top).
Top vertebra: with ChestTop a `ChestBone` circle under Parent with operator `chestBone` (width 0.4, depth 0.4,
tip_height 0.15, upx 1, top_point = chest top in local space), else implicit cube `TopVertebra` (length =
length/Nb×0.5) under the curve; path constraint to the curve (tangent on, up vector on, dir (0,1,0), up (0,0,−1),
point-at (0,0,−1), locked); non-stretchy → operator `FixedLength` (init_length, lScale from spine_scale); stretchy →
perc 100 and spine_scale expression = centre distance(top, base)/length. Scale X/Z of top and each vertebra driven by
spine_scale^(−volume_factor). Vertebrae: Nb cubes (implicit for type ≠ 0, mesh for type 0) named VertebraeName,
path-constrained with perc = top perc × (i+1)/(Nb+1), operator `SpinePointAt` (vertebra, top, base) with slider
1 − (i+1)/(Nb+1); top gets SpinePointAt slider 0. Shadows: skeleton/null types → for skeleton spine MakeShadowChain,
else a second curve `shadowspinecurve` bound the same way (SpineCurve lScale linked to the main op) and
MakeShadowSpine(…, length×0.4, …); stretchy adds `RIG_stretchVertebraOp` custom ops driving each shadow bone length
by curve percentage; box type → `Lumbar<i>` connector boxes base→vertebrae→top (scale length×0.3, invert on).
Returns spine object: `Envelope`, `Hidden`, `nb`, `parent`, `sliders`, `stretch`, `Type`, `vertebraName`,
`CharacterSetName`, `ShadowCharacterSetName`, `ShadowType`, `ShadowParent`, `base`, `top`, `baseDepth`, `topDepth`,
`chestTop`, `pos`, `objList`, `Curve`, `ShadowCurve`, `length`, `Root`, `Skel`, `Eff`, `TopVertebra`, `Vertebra`,
`scaleSlider`, `volumeSlider`, `CurveOp`, `ShadowCurveOp`, `vertDist`, `boneIcon`, `pathCns`, `lengthOp`,
`ShadowSpine`, `Shadows`, `ShadowStart`, `ShadowEnds`, `HiddenGroup`, `envGroup`.
**Wire contract**: positional args as listed; returns spine object.

### 3.9 MakeArm

Args: `ArmParent` (req.), `GuideObjectCollection` (3: shoulder end, elbow, hand), `Prefix`="",
`ArmRootConstrainingObj`, `NbForearmDivisions`=0, `NbBicepDivisions`=0, `ShadowType`=0, `ShadowParent`, `HandRoot`
(chain element; needed for forearm roll), `NegativeScale`=false. Errors (logged without severity): "makeArm: argument
0 is invalid"; "makeArm: Guide collection needs 3 objects. Collection has N objects".
Build: scale = |shoulder − hand|; 2D chain (normal +Y) under parent through the 3 guides (NegativeScale: drawn
mirrored in X then `DuplicateSymmetry` and re-parented); names `<p>Root`, `<p>Bicep`, `<p>Forearm`, `<p>ArmEff`;
chain scale s×0.15 (ends ×0.5), effector shadow_icon 4 / radius s×0.18, color 489; root hidden; bicep, forearm
enveloped and rot-marked (`Upper.<p>_Arm`); effector pos-marked (`None`); optional `Position` constraint of the root
to ArmRootConstrainingObj. Up vector: pyramid `<p>ArmUpV` under the root at shoulder + (0,0,−scale), size s×0.1,
color 253, neutral pose, pos-marked `None`; bicep `roll` set from the projected elbow angle (sign by side, negated
for negative scale, +180° when the elbow angle < 90°) and `UpVectorReference` = UpV. Rolls: bicep divisions →
MakeBicepRoll(bicep, "<p>Bicep", n) (dividers size s×0.05 replace the bicep in the envelope); forearm divisions with a
hand root → MakeForearmRoll(bicep, forearm, eff, hand bone 2, hand bone 1, prefix, n, ±90 depending on arm direction
vs +X). Shadows: 1–3 MakeShadowChain(skel, parent, type==1, s×0.15, type==3, shadow key set); >3 box chain
(`<p>Bicep` split box or one box per bicep division, then forearm boxes; taper 0.65). For shadow types 2, 5, 7 the
shadow bicep/forearm get matching roll nulls (color 805, Pose-constrained, `UserDataBlob` "bone") and the shadow
envelope group is updated. Standard hide setup.
Returns arm object: `parent`, `guides`, `prefix`, `constrainObj`, `NegativeScaling`, `ForearmDivisions`,
`BicepDivisions`, `ShadowType`, `ShadowParent`, `HandRoot`, `Hidden`, `Envelope`, `CharacterSetName`,
`ShadowCharacterSetName`, `pos`, `objs`, `scale`, `pushBack`, `normalPlane`, `Root`, `Skel`, `Eff` (= Skel(3)),
`elbow`, `normal`, `vecBack`, `roll`, `UpVpos`, `UpVParent`, `UpV`, `BicepRoll`, `ForeArmRoll`, `ShadowEnvelope`,
`ArmShadow`, `ShadowStart`, `Shadows`, `ShadowEnds`, `ShadowForeArmRoll`, `HiddenGroup`, `envGroup`.
**Wire contract**: positional args as listed; returns arm object or undefined on the two errors.

### 3.10 MakeHand

Args: `HandParent` (req.), `FingerGuideCollection` (first joint of each finger), `BladeGuideCollection` (same
order), `HandGuideCollection` (hand start, hand end), `Prefix`="", `FingerBoneType`=0 (0 2D, 1 3D), `ShadowType`=0
(+8 = no shadow fingers), `ShadowParent`, `NegativeScale`=false. Error: "makeHand: argument 0 is invalid".
Each finger guide is extended with its numbered duplicates; fewer than 2 joints → log "Not enought guide elements
found to make finger for guide: <guide>" and skip. Finger chains are 2D chains whose plane normal comes from the
blade curve's points (negated); type 1 sets the first bone `chntype` 2, other bones 0 and pref rotations (0,0,3).
Hand bone: 2D chain type 1 from hand start to end, fingers parented under the hand bone; NegativeScale mirrors and
rebuilds via DuplicateSymmetry. Names `<p><Finger>Root`, `<p><Finger><n>`, `<p><Finger>Effector`, `<p>HandRoot`,
`<p>Hand`, `<p>HandEffector` (finger keyword = guide name minus prefix and trailing digit). Scale: 4 × first-segment
length of the last finger ÷ finger count (the sum is overwritten each loop) — fingers that scale, hand bone ×2. Claw:
implicit cube `<hand bone>_grab` under the hand bone at the effector, length = scale, rot-marked; posx/posy/posz/rotx/
roty expressions cleared/zeroed; neutral pose on all finger bones; every finger bone gets an fcurve on rotz and a
`RIG_grabOp` custom op (outputs: finger `pcrotz` params, input: claw rotz) named `grabOp` with `Direction` = −1.
Shadows: 1–3 MakeShadowChain for the hand and (unless +8) each finger; >3 boxes (`<p>Hand` split box, finger boxes
taper from 0.6). Standard hide setup. Sliders: `<p>hand_sliders` custom property on the hand root with a proxy of
each finger bone's rotz renamed `<Finger><n>`. Poses: `StoreAction` on the hand root of the rotx/y/z of all
enveloped bones: `<p>Hand_Spread` (current), `<p>Hand_Relaxed` (+20° rotz on finger bones), `<p>Hand_Fist` (+40°
more); then applies the spread action.
Returns hand object: `parent`, `model`, `Prefix`, `FingerType`, `CharacterSetName`, `ShadowCharacterSetName`,
`FingerGuides`, `BladeGuides`, `HandGuides`, `ShadowType`, `ShadowParent`, `NegativeScaling`, `Hidden`, `Envelope`,
`markers`, `blades`, `foundKeyWords`, `handRoot`, `handEnd`, `Finger` (array of skeleton collections), `positions`,
`mirrorPlane`, `bone`, `Root`, `skel`, `Eff`, `scale`, `Claw`, `HandShadow`, `FingerShadows`, `ShadowStart`,
`Shadows`, `ShadowEnds`, `FingerRoots`, `HiddenGroup`, `envGroup`.
**Wire contract**: positional args as listed; returns hand object or undefined.

### 3.11 MakeLeg

Args: `Model`, `Parent` (req.), `Prefix`="", `GuideObjectCollection` (3: top, knee, ankle), `UpVectorBehindLeg`=false
(0 up vector at +Z, 1 at −Z), `NbThighDivisions`=3, `ShadowType`=0 (0 none, 1 skeleton, 2 null, 3 box per header;
code uses the standard 1–3 / >3 split), `ShadowParent`. Errors: "makeLeg: argument 1 is invalid" (siError);
"makeLeg: Guide collection needs 3 objects. Collection has N objects".
Build: scale = |top − ankle|; 2D chain with a zero normal through the 3 guides; bone 2 named `<p>Foreleg` then names
`<p>Root`, `<p>Thigh`, `<p>Shin`, `<p>legEff`; thigh preferred axis relative to root with pref (1,0,0); chain scale
s×0.15; effector shadow_icon 4, scales 0.18/0.18/0.09, color 489; shin pref rotations (0,0,3); root and effector
hidden, thigh and shin enveloped. Up vector pyramid `<p>legUpV` under the root at top ± (0,0,s), size s×0.1, color
253, neutral pose, pos-marked; thigh UpVectorReference = up vector, `roll` = projected knee angle in degrees + 180.
Thigh divisions > 0 → MakeBicepRoll(thigh, "<p>Thigh", n). Shadows: 1–3 MakeShadowChain (s×0.15); >3 boxes
`<p>Thigh` (per division or split) and `<p>Foreleg` (taper 0.65, start spin −45/+45 by side); roll nulls copied to
the shadow (as MakeArm) when divisions > 0. Standard hide setup.
Returns leg object: `model`, `parent`, `prefix`, `upVBehind`, `CharacterSetName`, `ShadowCharacterSetName`, `guides`,
`ThighDivisions`, `ShadowType`, `ShadowParent`, `Hidden`, `Envelope`, `pos`, `scale`, `Root`, `Skel`, `Eff`
(= Skel(3)), `pushBack`, `knee`, `normal`, `vecBack`, `proj_knee`, `proj_upv`, `roll`, `upVpos`, `upV`, `ThighRoll`,
`ShadowEnds`, `Shadows`, `ShadowHidden`, `ShadowEnvelope`, `LegShadow`, `ShadowStart`, `HiddenGroup`, `envGroup`.
**Wire contract**: positional args as listed; returns leg object or undefined.

### 3.12 MakeFoot

Args: `Model` (req.), `Parent` (req.; null → scene root), `ShortPrefix`="", `FullPrefix`="",
`GuideObjectCollection` (mid pivot, right pivot, left pivot, then ≥3 toe-line guides), `Sliders`, `Extension`=false,
`ShadowType`=0, `ShadowParent`, `ThreeBoneToe`=true. Errors: "makeFoot: required argument N is invalid" (siError).
Empty prefix → modal dialog "Foot_Maker" (id 1168) with short "BL" / long "BLeft"; cancel returns nothing.
ThreeBoneToe false (also when omitted by a caller) removes the last guide (two-bone toes).
Build: scale = |toe0 − toe2|/1.25; 2D chain (normal +X) along the toe guides, first bone chntype 2, others 0, names
`<p>FootRoot`, `<p>FootBone<n>`, `<p>FootEff`; scale ×0.3 / ×0.6. Controls (cube curves, oriented along the foot):
`<full>Foot` (0.7s×2s×2s, 253) under Parent, `<full>Tip` (0.4s, 250) under Foot, `<full>Roll` (0.6s×1.2s×1.2s, 770)
under Tip, optional `<full>Extension` (0.7s×1.6s×1.6s, 746) under Tip; marking sets (Foot, Tip pos+rot; Roll,
Extension rot). Toe offsets `<p>ToeOffset<i>` (offset cubes, color 107, rot-marked) and bind squares
`<p>FootBind<i>` (color 730, hidden). Guide nulls under Tip (color 607, size 0.15s): `<p>PivotBase`,
`<p>PlacePivot`, `<p>PivotRight`, `<p>PivotLeft` (rotations zeroed) and `<p>FootGuide1..n` from toe tip back,
chained under PivotBase. Bind squares rotx = −(matching FootGuide rotx) by expression; foot bones 2.. Position-
constrained to the bind squares; toe offsets local pos fixed to 0 by expressions and interleaved under bind squares.
Operator: three-bone → `ToeGuide` (PivotBase, FootGuide1–3, Roll, PivotLeft, PivotRight, PlacePivot) with R1 15, R2
20, R3 30; two-bone → custom operator `RIG_twoBoneToes` (outputs PivotBase local kine, FootGuide1/2 rotx; inputs Roll
rotx/rotz, PivotLeft/Right/PlacePivot local kine). Up-vector nulls `<p>FootUpV<i>` (color 507, size 0.1s) below each
bone, set as each bone's UpVectorReference. Shadows: 1–3 MakeShadowChain (s×0.6); >3 `Connector_L` box for the first
bone (spin 60) plus box connectors (taper 0.8). `BaseGuide` = last FootGuide. Standard hide setup. Sliders: given
page or new `<p>FootRoll_Controls` on the parent's model; proxies of the toe operator's `R1`, `R2` renamed
`<p>_Foot Roll 1/2` (range 0–360).
Returns foot object: `model`, `makeExtension`, `prefix`, `fullPrefix`, `CharacterSetName`, `ShadowCharacterSetName`,
`sliderPage`, `Parent`, `guideObjs`, `ShadowType`, `ShadowParent`, `FootPos`, `pivots`, `Envelope`, `Hidden`,
`scale`, `Root`, `Skel`, `eff`, `Foot`, `Tip`, `Roll`, `Extension`, `toeOffsets`, `bindSquares`, `PivotBase`,
`PlacePivot`, `PivotRight`, `PivotLeft`, `FootGuides`, `lastGuide`, `toeGuide`, `lastOffset`, `FootEff`,
`ArmShadow`, `ShadowStart`, `Shadows`, `ShadowEnds`, `BaseGuide`, `HiddenGroup`, `envGroup`.
**Wire contract**: positional args as listed; returns foot object or nothing.

### 3.13 MakeDogLeg

Args: `Model`, `Parent`, `FootParent` (all three required), `GuideObjectCollection` (femur, tibia, metatarsal, mid/
right/left pivots, ≥3 toe guides), `ShortPrefix`="", `FullPrefix`="", `Sliders`, `NbThighDivisions`=3,
`ShadowType`=0, `ShadowParent`. Errors "makeDogLeg: required argument N is invalid"; empty prefix → dialog
"Dog_Leg_Maker" (id 1167, "BL"/"BLeft"). ShadowType 6 or 7 → leg shadow 1 with box feet (4).
Build: scale = |femur − toe line start|; 3D chain femur→tibia→metatarsal→toe start, bones `<p>Femur`, `<p>Tibia`,
`<p>Metarsal`, root `<p>LegRoot`, effector `<p>LegEff` (scale ×0.07 / ×0.1); up vector pyramid `<p>UpVector` under the
root at femur + (0,0,−s), pos-marked, inside a null `<p>UpVectorParent` (hidden); guide nulls `<p>kneeGuide`,
`<p>tarsusGuide` under the root (size s×0.02, color 607). Shadows built before the foot (skeleton: MakeShadowChain
s×0.15; boxes `<p>Thigh` taper 0.8, spin ±45). Foot: MakeFoot(model, FootParent, prefix, fullPrefix, toe guides,
Sliders, 1, foot shadow type, leg shadow end) (two-bone toes; Extension created); foot root under the leg effector;
tibia/metatarsal/effector Position-constrained to knee guide / tarsus guide / foot BaseGuide. Operator `DogLeg`
(knee guide, tarsus guide, up vector, root, foot BaseGuide, foot Extension): length1/2/3 = bone lengths,
initial_percentage = |tibia→toe start| / (len2+len3), roll and secondRoll from projected up-vector angles,
lock_percentage 0.97. Up vectors: femur UpVectorReference = UpVector; nulls `baseNull` (behind the metatarsal by 2×
its distance to the foot control) and `lastboneUpV` (TwoPoints constraint between baseNull and UpVector) under the
foot control; metatarsal UpVectorReference = lastboneUpV. Thigh divisions → MakeBicepRoll(femur, "<p>Thigh", n).
Standard hide setup; sliders page (given or `<p>DogLeg_Controls` on the root's model) gets a proxy of the DogLeg
`lock_percentage` named `<p>_lock percentage` (0.001–1).
Returns dog-leg object: `model`, `prefix`, `fullPrefix`, `CharacterSetName`, `ShadowCharacterSetName`, `sliderPage`,
`Hidden`, `Envelope`, `parent`, `FootAttachPoint`, `guides`, `ThighDivisions`, `ShadowParent`, `ShadowType`,
`FootShadowType`, `pos`, `objs`, `footObjs`, `scale`, `Root`, `Skel`, `eff`, `upPos`, `UpVec`, `upParent`, `Knee`,
`Tarsus`, `ArmShadow`, `ShadowStart`, `Shadows`, `ShadowEnds`, `Foot` (MakeFoot object), `FootControl`, `dogLeg`
(operator), `ThighRoll`, `HiddenGroup`, `envGroup`.
**Wire contract**: positional args as listed; returns dog-leg object or nothing.

### 3.14 MakeHead

Args: `Parent` (req.), `GuideObjectCollection` (exactly 3: neck base, neck/jaw guide, head), `Prefix`="",
`AssemblyType`=0 (0 skeleton head and neck, 1 spine head and neck), `HeadType`=0 (0 biped, 1 quadruped; box shadow
only), `NbDivisions`=3 (0 → 2), `StretchType`=0, `Sliders`, `EarGuideCollection` (first ear guides; empty = no ears),
`ShadowType`=0, `ShadowParent`. Errors: count ≠ 3 → "makeHead: guide collection (argument 1) needs 3 objects.
Contains N objects" (siError); "makeHead: required argument 0 is invalid".
Extra guides: numbered duplicates of the head guide lengthen the head chain; duplicates of the second guide make a
jaw/snout chain. Skeleton assembly: 2D chain (normal +Y) through all head points, scale ×0.3; names `HeadRoot`,
`Neck` (first bone, chntype 2), `Neck` (middle bones), `Head` (last bone), `HeadEff`; rot-marked. Spine assembly
(≥2 points): cube `Head` control (size from the head span, color 253, pos+rot marked), null `NeckBase` (color 484)
and depth nulls `BaseDepth` (770) / `TopDepth` (253) placed 25% along the L-shaped guide (or the 2nd/3rd points when
there are ≥4), then MakeSpine(…, NbDivisions, 1, Stretch, NeckBase, Head, BaseDepth, TopDepth, null, Sliders,
ShadowType, ShadowParent, "NeckVertebra", head key-set names). Ears: for each ear guide plus duplicates (≥2 points)
MakeTail(Head, ear guides, max(4, round(n/1.5 − 1)), 0, scene root, key-set names). Jaw (≥2 duplicates): 2D chain
under the head bone, names `JawRoot`, `JawNeck`, `JawEff`. Shadows: skeleton → MakeShadowChain for head (spine
assembly reuses the spine's shadow) and jaw; box → `Neck` boxes, a `Head` box with operator `Connector_Head`, `Jaw`
boxes. Standard hide setup.
Returns head object: `parent`, `guides`, `prefix`, `CharacterSetName`, `ShadowCharacterSetName`, `ShadowType`,
`ShadowParent`, `Type`, `Ears`, `inNbDivisions`, `Stretch`, `Sliders`, `AssemblyType`, `Hidden`, `Envelope`, `pos`,
`objs`, `JawPos`, `JawObjs`, `scale`, `normalPlane`, `Root`, `Skel`, `Head`, `HeadScale`, `NeckBase`, `BaseDepth`,
`TopDepth`, `Spine`, `EarChains`, `JawRoot`, `JawSkel`, `HeadShadow`, `JawShadow`, `ShadowStart`, `ShadowEnds`,
`Shadows`, `HiddenGroup`, `envGroup`.
**Wire contract**: positional args as listed; returns head object or nothing.

### 3.15 MakeBelly

Args: `HipObject` (req.), `VertebraObject` (req.), `GuideObjectCollection` (2: lower stomach, upper stomach),
`ForwardRotationPerc`=0.25. Errors: "makeBelly: argument 0|1 is invalid" (no severity); guide count ≠ 2 → message
"makeBelly: Guide collection needs 2 objects…" and then a script error (it returns an undefined variable).
Build: spring start points interpolated Perc from hip→lower guide and vertebra→upper guide (minimum bone length
enforced: 0.015 toward the parent when ≤0.01 / ≤0.05). Belly chain (2D, type 1, normal (0,90,0)) from lower to
upper guide under the scene root; spring chains under the vertebra (upper) and hip (lower) with roots oriented −Y
toward the next point; belly root re-parented under the lower spring effector; belly bone UpVectorReference = hip;
belly effector Position-constrained to the upper spring effector. Names `BellyRoot`/`Belly`/`BellyEff`,
`UpperBellyRoot`/`UpperBellyBone`/`UpperBellyEff`, `LowerBellyRoot`/`LowerBellyBone`/`LowerBellyEff`; roots and
effectors hidden, belly bone enveloped. Scale = average spring bone length ×0.1 (belly ×2), spring scale ×0.4;
shadow_icon 6 (belly) / 7 (springs). Hide setup on the hip's model. `ApplySpringOp(eff,root)` on both springs.
Returns belly object: `Guides`, `Hip`, `Vertebra`, `Model`, `Perc`, `Hidden`, `Envelope`, `hipPos`, `vertPos`,
`lowerPos`, `upperPos`, `startLower`, `startUpper`, `BellyRoot`, `BellySkel`, `BellyEff`, `BellyBone`, `UpperRoot`,
`UpperSkel`, `UpperEff`, `UpperBone`, `LowerRoot`, `LowerSkel`, `LowerEff`, `LowerBone`, `Scale`, `SpringScale`,
`HiddenGroup`, `envGroup`.
**Wire contract**: positional args as listed; returns belly object.

### 3.16 MakeBicepRoll

Args: `Bicep` (chain bone), `Prefix`="", `NbDivisions`=3. No validation. With L = (n+1)/(n+2): n nulls
`<p>Roll<i>` (i = 1..n) under the bicep's parent, each with operator `FirstBoneRollDivisionRO` (divider, bicep),
`length_perc` = L×(i−1)/n and `mySlerp` = i/(n+2), color 421, size 0.3; then one more null `<p>Roll_<n+1>` as a child
of the bicep at local zero with posx expression = bicep bone length × L, color 421. Returns `{Nb, Divisions}`
(Divisions holds n+1 nulls).
**Wire contract**: `MakeBicepRoll(bone, prefix, n)` → object with Nb, Divisions.

### 3.17 MakeForearmRoll

Args: `Bicep`, `Forearm`, `ArmEff`, `HandEff`, `HandBone` (all required), `Prefix`="", `NbDivisions`=3,
`RollOffset`=0.0. Error: "makeForearmRoll: argument N is invalid" (siError) for each missing, then return.
Adds `Roll_Compensation` custom property on HandBone with `roll_offset` (double, default 0, range ±360, UI ±180),
set to RollOffset. n nulls under the forearm: first `<p>Elbow`, others `<p>ForearmRoll`; each gets operator
`ForeArmRollDivision` (division, bicep, forearm, arm eff, hand eff, hand bone) with `blend` = 1 − i/n and
`compensation` driven by roll_offset; local posx expression = forearm bone length × i/n, posy/posz "0"; color 544.
Returns `{Sliders, RollOffset (the parameter), Nb, Divisions}`.
**Wire contract**: positional args as listed; returns that object or nothing.

### 3.18 Make2PointSlide

Args: `Prefix`="", `GuidePoint1`, `GuidePoint2`, `Parent1`, `Parent2` (four required), `UpVector`, `BoundingVolume`.
Error: "make2PointSlide: argument N is invalid" (siError). Creates nulls `<p>Bind` and `<p>Top` under Parent1 and
`<p>Base` under Parent2; Top/Base take the guides' global transforms; colors 748 / 472 / 472; sizes = guide
distance ×0.1 / ×0.05 / ×0.05. Bind gets a `TwoPoints` constraint to (Top, Base); optional `BoundingVolume`
constraint (type 1) to BoundingVolume; optional constraint UpVectorReference = UpVector. Top and Base hidden, Bind
enveloped (standard hide setup on Parent1's model).
Returns `{model, Hidden, Envelope, BindNull, TopNull, BaseNull, Constraint, HiddenGroup, envGroup}`.
**Wire contract**: positional args as listed.

### 3.19 MakeThighSlide

Args: `Prefix`="", `GuideObjectCollection` (5: back slide top, back slide bottom, hip side, leg start, knee),
`UpperParent`, `LowerParent` (required). Error: "makeThighSlide: argument N is invalid" (siError).
Computes a volume centre halfway between the hip-side point projected on the plane normal to the thigh (through the
back-slide midpoint) and that line's intersection with the X = 0 plane; creates implicit sphere `<p>ThighVolume`
under LowerParent, radius = distance to the back-slide midpoint, oriented by the two directions, scaling (|centre −
hip side|/radius, 2, 1), color 728. Then Make2PointSlide(prefix, guide 0, guide 1, UpperParent, LowerParent,
UpperParent, volume). Returns `{Guides, Pos, Volume, BindNull, TopNull, BaseNull}`.
**Wire contract**: positional args as listed.

### 3.20 MakeJointCompression

Args: `Prefix`="", `UpperBone`, `LowerBone` (req.), `GuideObjectCollection` (req.; 4: upper target, lower target,
curve target, curve centre), `RollDivisionCollection` (optional). Error "makeJointCompression: argument N is
invalid" (siError). Implicit sphere `<p>BendVolume` under LowerBone, radius = |centre − curve target|, placed at
centre + 0.25 × (centre − target), color 728. Parent of both joint nulls: the roll division closest to the upper
target when divisions are given, else UpperBone (LowerBone is not used as a parent). Nulls `<p>UpperJoint` and
`<p>LowerJoint` at the target transforms with scaling reset to 1, Pose constraint (compensated) to the parent and
BoundingVolume constraint to the sphere, color 748, size = target distance ×0.4, both enveloped (Envelope_group of
UpperBone's model).
Returns `{UpperBone, LowerBone, UpperTarget, LowerTarget, CurveTarget, CurveCenter, model, Envelope, Volume,
UpperJoint, LowerJoint, envGroup}`.
**Wire contract**: positional args as listed.

### 3.21 MakeHip

Args: `GuideObj`, `TopX`,`TopY`,`TopZ` = 0.0, `SideX`,`SideY`,`SideZ` = 1.0. With a guide object: transform = the
guide's global transform, top/side points from the args. Without: uses the first selected object's transform (empty
selection → "Hip Maker Cancel, Requires and Object Selection to define Hip Transform", siError) and two interactive
`PickPosition` picks ("Pick Top of Hip Position", "Pick Side of Hip Position"; cancel aborts). Creates `HipPlate`
circle curve under the scene root (color 49) with operator `HipIcon`, same parameter values as MakeTorso
(spine_point = top, leg_point = side, in local space). Returns the HipPlate X3DObject.
**Wire contract**: positional args as listed; returns X3DObject or nothing.

### 3.22 MakeShadowChain

Args: `Chain` (skeleton collection as from GetSkeleton), `ShadowParent` (req.), `SI3DStyleChain`=false,
`IconScale`=1.0, `ShadowType`=0 (the script treats this argument as "null shadow": non-zero → null hierarchy),
`ShadowCharacterSetName`="". Scale 0 → warning "makeShadowChain: shadow scale cannot be zero, using scale of 1.0";
missing parent → "makeShadowChain: argument 0 is invalid" (no severity).
Skeleton trace: 2D chain under the scene root through the chain's joint positions with the normal = Z axis of the
source root, re-parented under ShadowParent, first bone aligned with the source first bone; elements colored 805,
scale; SI|3D style: effector cnsori/cnspos off and parented under the last bone; names copied from the source; 3D
source chains (> 4 elements, chntype 2) copy chntype and preferred rotations; each bone Pose-constrained
(compensated) to its source bone and enveloped; preferred-axis settings copied when the source uses pref_relRoot
(resplane 1). Null trace: one null per source bone, named like it, color 381, size scale×0.3, Pose-constrained (not
compensated), nested. Shadow hide setup; rot marking sets with the shadow key set.
Returns `{Hidden, Envelope, Scale, ShadowModel, ShadowCharacterSetName, Chain, Parent, SI3D, ShadowEnds, Shadows,
ShadowStart, Root, Skel, HiddenGroup, envGroup}`.
**Wire contract**: positional args as listed.

### 3.23 MakeShadowSpine

Args: `Spline`, `Base`, `Vertebra` (collection), `TopVertebra` (four required), `ShadowParent`, `ChestTop`,
`IconScale`=1.0, `ShadowType`=1 (1 SI|3D skeleton, 2 XSI skeleton, 3 null; other values build nothing),
`ShadowCharacterSetName`="". Error "makeShadowSpine: argument N is invalid" (siError).
Types 1/2: chain (type 2, plane +X) under ShadowParent through points sampled evenly along the spline (vertebra
count + 1 points; + one more without a chest top); names `SpineRoot`, `Spine<i>`, `Chest`, `ChestEffector`. With a
chest top and > 1 vertebra a separate FK chain `ChestRoot`/`Chest`/`ChestEffector` is grown from the last spine
bone to the chest top (root and chest Position/Pose constrained to TopVertebra). Bones are Path-constrained to the
spline at even percentages (locked), the end Position- (or Pose-) constrained to TopVertebra, up-vector nulls
`Shadow_upVa` under each vertebra and the top vertebra (offset +Y, size scale×0.1) set as UpVectorReference; SI|3D
style effector handling as MakeShadowChain; color 805; rot marking sets. Type 3: nulls traced from Base, each
vertebra and TopVertebra (first null created under Base itself), color 381, size scale×0.3, Pose constraints.
Returns `{ShadowHidden, ShadowEnvelope, Hidden, Envelope, Base, Spline, Vertebra, TopVertebra, Parent, ShadowModel,
RigModel, ChestTop, Scale, ShadowCharacterSetName, ShadowEnds, Root, Skel, Root2, Skel2, UpVectors, ShadowStart,
Shadows, HiddenGroup, envGroup}`.
**Wire contract**: positional args as listed.

### 3.24 MakeBipedCharacterKeySet / MakeQuadrupedCharacterKeySet

Args: `RootObject` (req.), `CharacterKeySetName`="CharSet", `DeleteMarkingSet`=false, `Prefix`="", `Suffix`="".
Error: "make<Biped|Quadruped>CharacterKeySet: argument 0 is invalid" (no severity).
Steps: clear keyable on `kine.local.scl`, `kine.local.ori`, `kine.local.pos`, `kine.posecns` of every child of the
root's model; save `preferences.Interaction.autoinspect`, set it false; deselect; `CreateCharacterKeySet(root,
Prefix+Name+Suffix)`; populate it; create empty sub-sets (`CreateSubCharacterKeySet`, then remove all parameters):
biped `Upper` with `R_Arm`, `L_Arm`, `R_Hand`, `L_Hand`, `Torso`, `Head_Neck`, and `Lower` with `L_Leg`, `R_Leg`;
quadruped `Upper` with `Torso`, `Head_Neck`, and `Lower` with `L_Leg`, `R_Leg`, `BL_Leg`, `BR_Leg`, `Tail` (every
name wrapped in Prefix…Suffix); populate after each level; restore autoinspect.
Populate: collects the model's custom properties (class `{76332571-D242-11D0-B69C-00AA003B3EA6}`) whose name contains
`MarkingSet`; a set without `CharacterKeySet` parameter is skipped with log "MarkingSet - <set> - not included in
Character Key Set"; its proxy parameters' master parameters make the list; `kine.local.ori.euler` /
`kine.local.pos` of the owner become keyable when rot / pos are listed; names starting `None` are only scheduled for
deletion; a dotted name `A.B` is added (`AddProxyParamToCharacterKeySet`) to sub-set `<current set>.B<suffix>` when
the current set's FullName contains `A`; a plain name is added to the current set when its FullName contains it;
failures log "Error setting CharacterSubSet - …". With DeleteMarkingSet the used marking sets are deleted.
Returns the top character key set.
**Wire contract**: positional args as listed.

### 3.25 SetKeyableRig

Args: `RootObject` (req.; error text reuses "makeBipedCharacterKeySet: argument 0 is invalid"). Clears the keyable
attributes above on the children of RootObject itself, then for every marking set of RootObject's model marks the
listed rot/pos parameters keyable (as Populate) and deletes **all** marking sets. Returns nothing.
**Wire contract**: `SetKeyableRig(root)`; no return value.

## 4. Open questions

1. `Charac_RigFromBiped.vbs` (220070 bytes) could not be read (raw 6502 image limited to 64 KB; m68k raw image not
   readable by the provider). `MakeBiped` / `MakeBipedDogLeg` VBScript entries (`MakeBipedUI`,
   `MakeBipedDogLegUI`) are inferred to mirror `MakeQuadrupedUI`. Needs another reader (staging or a device shell).
2. Each of `MakeBiped`, `MakeBipedDogLeg`, `MakeQuadruped` is registered twice (JScript builder and VBScript UI
   wrapper) with different argument lists; which registration is live is decided by plug-in load order (not in the
   files).
3. The scripted operators (`HipIcon`, `SpineCurve`, `DogLeg`, `ToeGuide`, `Connector_*`, `RIG_*` custom ops, …) and
   `MakeTail` / `MakeControlSplines` / `CreateRigFromGuide` / `CreateRigFromQuadruped` are outside this row.
4. Observed script defects to keep in mind for a faithful port (inferred effects, nothing executed): MakeQuadruped
   `model`/`Model` mismatch (default pose and cancel), MakeBelly guide-count error path returns an undefined variable,
   MakeHand finger scale uses only the last finger, MakeBiped knee joints never get roll divisions, MakeHead spine
   assembly passes an undefined model to MakeSpine and the jaw uses an unset plane normal.
