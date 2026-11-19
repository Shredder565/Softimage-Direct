# CMD-B13a: Behavior export plug-in commands, read from `bvrexport.dll` (BvrAddBVHAction, BvrAddColSphere, BvrAddFloor, BvrAddJointLimit, BvrGenerateActor, BvrGenerateRenderSetup, BvrGotoHome, BvrImportBVHAction, BvrInitActor, BvrMakeLoop, BvrMakeSkill, BvrRemoveCOG, BvrRemoveFloor, BvrRemoveFoot, BvrRemoveJointLimit, BvrRenderSetup, BvrSetCOG, BvrSetCollisionOnly, BvrSetDefault, BvrSetFoot, BvrSetHome, BvrSetVisualOnly; extras BvrLoadActor, BvrSaveActor, BvrImportBVHActor)

Row: **CMD-B13a**. Status: **SPEC** (17 names), **SPEC-PARTIAL** (5 names: BvrAddBVHAction, BvrGenerateActor, BvrGenerateRenderSetup, BvrMakeSkill, BvrSetHome). Extras (not in the row list): BvrLoadActor, BvrSaveActor, BvrImportBVHActor, all SPEC-PARTIAL.
Run: 2026-11-19, si-analyst worker, unattended, batch 13 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\Plugins\bvrexport.dll` (internal name `BvrExport.dll`, PDB `BvrExport.pdb`), image base `0x180000000`, 517448 bytes,
sha256 `5a317b1b43645fc21a65e7a6cab493a6faa7c94997799cb7af61d38b9aa89588`.
Method: `inspect_native_exports` (70 named exports, ordinals 33-38 unnamed), then Ghidra 12.1.4 decompilation of
`XSILoadPlugin`, the shared `_Init` and the two argument-bearing `_Init`s, every `_Execute`, the per-command worker
each `_Execute` calls, the shared helpers they use (actor-model lookup, actor-root resolution, property lookup,
wire-colour helper, home-pose store/apply, command-log toggle, InspectObj wrapper) and the six `<Prop>_Define`
callbacks. String searches confirmed BVH keywords and skill-type labels. The deep algorithm bodies of actor
generation, skill creation/transfer, BVH parsing and render-setup file writing were not decompiled (listed per command).
Arguments are cross-checked against `data/commands_full.json` (all 25 `Bvr*` entries carry `file` = this DLL; names agree).
Statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

All `_Init` exports except two alias one function, `Initialize_Init` at `0x180007e10`.

| Command (scripting name) | Display name | _Init | _Execute | key helpers |
|---|---|---|---|---|
| `BvrInitActor` | Initialize | `0x180007e10` | `0x180006b80` | `0x1800044d0` → `0x180004190`, `0x18003c5b0`, `0x180038220`, `0x180004940`, `0x180002130` |
| `BvrSetHome` | Set Home | `0x180007e10` | `0x1800081d0` | `0x1800051f0` → `0x180004be0`, `0x180001000`, `0x18003d6d0`, `0x180002970` (unread) |
| `BvrGotoHome` | Goto Home | `0x180007e10` | `0x180006850` | `0x180003e60` → `0x1800032d0`, `0x1800036b0` |
| `BvrGenerateActor` | Generate | `0x180007e10` | `0x1800066e0` (export `Generate_Execute`) | `0x180014e60` → `0x18000f790`, `0x1800105c0`, `0x18000f470`, `0x180017750` (unread) |
| `BvrSetCOG` | Set COG | `0x180007e10` | `0x180007af0` | `0x1800259b0` |
| `BvrSetFoot` | Set Foot | `0x180007e10` | `0x180008030` | `0x180026240`, `0x180024530` |
| `BvrAddColSphere` | Add Col Sphere | `0x180007e10` | `0x180005aa0` | `0x180023770`, `0x180024fc0` |
| `BvrAddFloor` | Add Floor | `0x180007e10` | `0x180005c40` | `0x180023d70`, `0x180024d10` (unread) |
| `BvrSetCollisionOnly` | Set Collision Only | `0x180007e10` | `0x180007c80` | `0x180025ea0` |
| `BvrSetVisualOnly` | Set Visual Only | `0x180007e10` | `0x180008370` | `0x1800268f0` |
| `BvrSetDefault` | Set Default | `0x180007e10` | `0x180007ea0` | `0x180026070` |
| `BvrAddJointLimit` | Add Joint Limit | `0x180007e10` | `0x180005dd0` | `0x18001b770` |
| `BvrMakeSkill` | Make Skill | `0x180007e10` | `0x180007080` | `0x1800340d0` → `0x18002e6d0`, `0x180033a30`, `0x1800360b0`, `0x18000f980` (unread) |
| `BvrSaveActor` (extra) | Save Actor | `0x180007e10` | `0x180007980` | `0x18000ba60` |
| `BvrLoadActor` (extra) | Load Actor | `0x180007e10` | `0x180006d20` | `0x18000b280`, `0x180009080` (unread) |
| `BvrRenderSetup` | Render Setup | `0x180007e10` | `0x180007950` | `0x180029200` |
| `BvrImportBVHActor` (extra) | Import BVH Actor | `0x180007e10` | `0x180006b50` | `0x18001b180` → `0x180040450` (unread) |
| `BvrImportBVHAction` | Import BVH Action | `0x180007e10` | `0x1800069e0` | `0x18001a9a0` (runs `BvrAddBVHAction`) |
| `BvrAddBVHAction` | AddBVHAction | `0x180005750` | `0x1800053c0` | `0x18003f0d0` (unread) |
| `BvrMakeLoop` | Make Loop | `0x180007e10` | `0x180006d70` | `0x18001f770` |
| `BvrRemoveCOG` | Remove COG | `0x180007e10` | `0x180007390` | `0x180025210` |
| `BvrRemoveFoot` | Remove Foot | `0x180007e10` | `0x180007670` | `0x1800254b0` |
| `BvrRemoveFloor` | Remove Floor | `0x180007e10` | `0x180007500` | `0x180025350` |
| `BvrRemoveJointLimit` | Remove Joint Limit | `0x180007e10` | `0x1800077e0` | `0x180025870` |
| `BvrGenerateRenderSetup` | GenerateRenderSetup | `0x1800063e0` | `0x180005f40` | `0x180027b40` (unread) |

`RenderSetup_Init` and `RenderSetup_Execute` are the command `BvrRenderSetup`. `RenderSetup_Define/_DefineLayout/_PPGEvent`
are the custom property `RenderSetup`, which has the same name. The handler for `BvrInitActor` is exported as
`Initialize_*` and the one for `BvrGenerateActor` as `Generate_*`.

## 2. Shared facts

### 2.1 Plug-in registration (`XSILoadPlugin` 0x180008500)
- Author `Softimage Corp`, plug-in name `Behavior Export Command Plugin`, version 1.0 (major 1).
- 25 commands are registered in this order, each as (display name, scripting name): Initialize/BvrInitActor, Set Home/BvrSetHome,
  Goto Home/BvrGotoHome, Generate/BvrGenerateActor, Set COG/BvrSetCOG, Set Foot/BvrSetFoot, Add Col Sphere/BvrAddColSphere,
  Add Floor/BvrAddFloor, Set Collision Only/BvrSetCollisionOnly, Set Visual Only/BvrSetVisualOnly, Set Default/BvrSetDefault,
  Add Joint Limit/BvrAddJointLimit, Make Skill/BvrMakeSkill, Save Actor/BvrSaveActor, Load Actor/BvrLoadActor,
  Render Setup/BvrRenderSetup, Import BVH Actor/BvrImportBVHActor, Import BVH Action/BvrImportBVHAction,
  AddBVHAction/BvrAddBVHAction, Make Loop/BvrMakeLoop, Remove COG/BvrRemoveCOG, Remove Foot/BvrRemoveFoot,
  Remove Floor/BvrRemoveFloor, Remove Joint Limit/BvrRemoveJointLimit, GenerateRenderSetup/BvrGenerateRenderSetup.
- 6 custom properties are registered: `BehaviorJL`, `Skill`, `BehaviorGen`, `BVHActor`, `LoopSkill`, `RenderSetup`.
- No menus, operators or events are registered. `XSIUnloadPlugin` is at 0x180008fc0 (not read).

### 2.2 `_Init` behaviour
- The shared `_Init` (0x180007e10) only calls `Command::SetFlag(0x00800000, true)`. (inferred: the constant is
  `siNoLogging`.) It declares no arguments.
- `AddBVHAction_Init`: same flag, then 8 arguments `arg0`…`arg7`, all with empty `CValue` defaults (this matches commands_full.json).
- `GenerateRenderSetup_Init`: same flag, then 7 arguments `filename`, `target`, `start`, `end`, `domap`, `classname`,
  `doui`, all with empty defaults (this matches commands_full.json).

### 2.3 Common Execute shape
- Every `_Execute` returns `CStatus` OK (0), including on every error path. None of them sets a return value, so scripting callers get an empty value.
- **Selection gate** (all commands except LoadActor, RenderSetup, ImportBVHActor, AddBVHAction, GenerateRenderSetup):
  the selection must hold exactly 1 item that is a valid X3DObject. MakeSkill and MakeLoop also accept a single
  ActionSource. Otherwise a message box titled `Behavior Export` (OK button) says
  `The <Action> action requires selecting a single node in the actor description.` The `<Action>` names are: Initialize, Set Home, Goto Home,
  Generate, Set COG, Set Foot, Add Col Sphere, Add Floor, Set Collision Only, Set Visual Only, Set Default, Add Joint
  Limit, Save Actor, Remove COG, Remove Foot, Remove Floor, Remove Joint Limit. Exceptions to this wording:
  MakeLoop says `The Loop Locomotion action ...`. MakeSkill says `... a single node or action source ...`.
  ImportBVHAction says `The Import BVH Action command requires selecting a single node in the target actor description.`
- **Shift key**: Initialize, SetHome and SetFoot read the Shift key state (`GetKeyState(VK_SHIFT)`) at execution.
  Initialize passes "Shift held" to its worker. SetHome and SetFoot pass "Shift not held".
- **Command-log suppression** (helper 0x18003d090): the helper reads `preferences.scripting.cmdlog` through the
  `GetValue` command, writes the requested value through `SetValue`, and returns the previous value. These commands set it to false
  around their worker and restore it afterwards: Initialize, SetHome, GotoHome, SetCOG, SetFoot,
  AddColSphere, AddFloor, SetCollisionOnly, SetVisualOnly, SetDefault and AddBVHAction. MakeSkill, Generate and ImportBVHActor
  do the same inside their workers.
- Message boxes use Win32 style values: 0 = OK, 1 = OK/Cancel (result 2 = Cancel aborts), 4 = Yes/No (result 7 = No).
  The title is always `Behavior Export`.

### 2.4 Shared helpers
- **Find property by name** (0x18003afc0): scans `SceneItem::GetProperties` for an exact name match. Tag properties are
  matched by name only.
- **Actor model** (0x18003bac0): walks up the parents from the node to the first Model (class id 0x4a). The
  error is `Failed to find the actor model.`. If that model is the scene root the error is
  `Actor descriptions must be contained by a single model (scene root not supported).` (the text varies slightly per command).
- **Actor root** (0x18003bc50, called with "report" true by most commands): the model must have exactly one
  X3DObject child that is not a light or camera (class ids 0x50, 0x51, 0x54, 0x55 are excluded). That child is the actor root.
  On failure, with "report" true, a message lists the candidate nodes: `For a model to convert to an actor, the model must
  have a single child node (lights and cameras don't count). One of the following nodes needs to be lower in the tree:`
  followed by `node - <name>` lines. **Side effect**: if that single child has a polygon mesh with ≥1 triangle,
  a Null named `GlobalSRT` is added under the model and the child is reparented under it. The GlobalSRT becomes the actor root.
- **Nested-model check** (0x180038650): any Model in the root's subtree gives the error
  `Actor descriptions must be contained by a single model (embedded models not supported).`
- **COG resolution** (0x18003b4c0): looks at the X3DObject children of the actor root. If one carries an `RTKCogNode` property it is the COG.
  Otherwise there must be exactly one child that is not a light or camera. If there are none: `For a model to convert to an actor, the actor root node must
  have one child node (e.g. a COG node).` If there are several, a message names the root, lists `node - <name>` lines and ends with
  `The other option is to mark one of the nodes as the COG node.`
- **Wire colour** (0x18003d1f0): adds a local `DispProp` preset property named `Display Property` to the node and
  sets its `wirecol` parameter. The colour values used are:
  0x200 = default/initialized, 0x334 = visual-only, 0xf9 = collision-only, 0x12e = foot, 0x1ef = collision sphere.
- **Ensure RTKNode** (0x180038220): if `RTKNode` is absent it adds `Custom_parameter_list` preset `RTKNode` with bools
  `VisualizationOnly` and `CollisionOnly` (both default false, capability 4) and sets wire colour 0x200.
- **Temp-object purge** (0x18003c5b0): walks the model subtree with progress increments. A node that carries an
  `RTKHandle` or `TmpRTKBndCylinder` property, or a `TmpRTKPose` property, is itself removed with `DeleteObj` and its children are not visited.
  Other nodes recurse.
- **Home pose store** (0x180001000, recursive over X3DObject children): skips nodes tagged `RTKSphere`. It ensures
  `RTKHomePose` (float params `px py pz` with suggested range ±100, `rx ry rz sx sy sz` with suggested range ±200, hard range ±FLT_MAX,
  default 0, capability 6) and writes the node's **global** translation, XYZ Euler rotation and scaling into them.
- **Home pose apply** (0x1800036b0, recursive): for each node with `RTKHomePose`, rebuilds the global transform from
  px..sz and puts it. One pass skips class 0x4d nodes. The other pass skips class 0x4e nodes and applies
  class-0x4d nodes through the `Rotate` command (args: full name, rx·k, ry·k, rz·k, 0, 1, where k is the double at 0x18007d000).
  (inferred: 0x4d/0x4e are chain element classes and k converts radians to degrees.)
- **Scale check** (0x18003d6d0): recursive. A node fails when its local scaling differs from 1 by more than 1e-7 on any axis
  and it has no envelopes (nodes tagged `RTKEnd` are skipped unless the "include end" flag is set). The error is
  `The scaling on the actor node <name> must be (1,1,1) for a valid <action>.` followed by
  `Generate the actor to freeze all the scaling in the description.`
- **InspectObj wrapper** (0x18003c340): runs `InspectObj(name, "", title, mode, throw)` and returns true unless the
  command returned true (that is, the user cancelled).
- **RTKActor fit** (0x180002130): ensures `RTKActor` on the actor root with floats `Radius` (default 1), `Height`
  (default 1) and `MeanDistance` (default 0), each with range [0, FLT_MAX], suggested [0, 100], capability 6. When asked to fit, it computes
  the subtree bounding box (0x180038b60, unread). It sets Height = maxY − minY and Radius = the largest XZ distance from the root's
  global position to the four XZ corners of the box.
- **Tag properties** (all `Custom_parameter_list` presets added by the commands): `RTKNode`, `RTKEnd` (no params),
  `RTKCogNode` (no params), `RTKHomePose`, `RTKActor`, `RTKFixHomeBase` (no params), `RTKFloor` (`Top`), `RTKSphere`
  (`Radius`), `RTKEffector` (`Contact` siInt4 capability 5, default 0, range 0..1. `Anchor` siBool capability 6, default false).
  Other names seen: `RTKBasePose`, `BasePoseScale`, `StorePose` (users not read).
  Capability values come from the SDK enum (inferred): 4 = persistable, 5 = persistable|animatable, 6 = persistable|read-only.

### 2.5 Registered custom properties (from the `_Define` callbacks)
Each parameter is listed as name: type, default, [hard min, max], {suggested min, max}. All have capability 4 unless stated.

- **BehaviorJL** (`BehaviorJL_Define` 0x18001bc50): `MinX MaxX MinY MaxY MinZ MaxZ`: siFloat, 0, [−360, 360], {−360, 360}.
  `IK`: siBool, false.
- **Skill** (0x180036810): `Source`: siInt4, 0, [0, 200], {0, 200}. `Skill`: siInt4, 0, [0, 3], {0, 3}.
  `Threshold`: siFloat, 0.2, [0, 1], {0, 1}. `Transfer`: siBool, false. Layout enum labels include
  `Default - untouched motion data` and `Locomotion` (inferred: Skill 0 = default, 2 = locomotion. Labels for 1 and 3 not read).
- **BehaviorGen** (0x18000db10): `Envelope` bool false. `Box` bool true. `RemoveExtra` bool true. `RemovePoly` bool false.
  `Skill` bool true. `Factor` siFloat 0.2 [0, 1]. `Cog` bool false.
- **BVHActor** (0x1800196a0): `BVHFile` siString "". `Mode` siInt4 default 0 (description slot `Radio Button`, other
  CValues 0 and 222). `Box` bool true. `Scale` siFloat 0.125, [0.0001, 1]. `ActorName` string `Actor`. `Filter` string "".
  `Remove` string "". `Root` bool true. `ActionName` string `Mocap`. `Optimize` bool true.
- **LoopSkill** (0x18001fbc0): `Source` siInt4 0, [−2147483647, 2147483647], {0, 2147483647}. `Start` and `End` siInt4 0,
  [±2147483647]. `Smooth` siInt4 10, [0, 2147483647]. `Loco` bool true. `PrevSource`, `PrevStart`, `PrevEnd` siInt4 0.
- **RenderSetup** (0x1800293d0): `RenderFile` string "". `Start` siInt4 1, [±2147483647], {1, 200}. `End` siInt4 1, same
  ranges. `Target` siInt4 0, [0, 2147483647]. `Enable` bool false. `Actor` string "".
- `_DefineLayout` and `_PPGEvent` callbacks were not read (`RenderSetup_DefineLayout` is the same function as `LoopSkill_DefineLayout`, 0x1800206c0).

### 2.6 File formats
- **Actor files**: dotXSI scene files (`Actor (*.xsi)|*.xsi||`) written with `SIExportDotXSIFile` and read with
  `SIImportDotXSIFile`.
- **Weight-map sidecar `.wgmp`** (binary, little-endian): its path is the actor path with the last three characters (`xsi`)
  replaced by `wgmp`. Layout: int32 recordCount, then for each record: int32 n, n × 4-byte values (array A), n × 4-byte
  values (array B). It is written only when weight data was collected. (inferred: A = point indices, B = weights.)
- **BVH**: Biovision text format, file filter `Biovision BVH Files (*.bvh)|*.bvh:*.BVH|`. The binary contains the keywords
  `HIERARCHY`, `JOINT`, `OFFSET`, `CHANNELS`, ` Site { OFFSET %f %f %f }`, `MOTION`, ` Frames: %d Frame Time: %f` and
  `Xrotation`. The parser body (0x180040450, 0x18003f0d0) was not read.
- **ActorFile** custom property on the scene root: `InitDir` siString, capability 2, initialised from
  `Application::GetInstallationPath`. It remembers the last directory used by Load/Save.

## 3. Contracts

### `BvrInitActor`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: single selected X3DObject (§2.3).
- Steps: the command log is turned off. The worker finds the actor model and shows a progress bar (`Initializing Actor`, cancel enabled,
  maximum = node count (inferred)). It then checks: not the scene root, actor root resolved (may insert `GlobalSRT`), no nested models, and the COG resolved.
- Purge temporary objects over the model (§2.4). Ensure `RTKNode` on the actor root (wire 0x200).
- Over the COG subtree (recursive, skipping lights and cameras): ensure `RTKNode` (wire 0x200), delete any existing `RTKEnd`, and
  add `RTKEnd` to every node with no children.
- If Shift was held: ensure `RTKActor` on the actor root and fit Radius/Height (§2.4).
- Errors: model, root, nested-model and COG messages from §2.4. Each aborts silently after its message.

### `BvrSetHome`: SPEC-PARTIAL
Wire contract:
- Args: none. Return: empty. Gate: §2.3. Progress caption `Storing Home Pose`.
- Model, scene root, actor root, nested-model and COG checks as in Initialize.
- If Shift is **not** held and `RTKActor` exists on the root, the scale check runs (§2.4, action name `Set Home action`, "include end"
  set). If it passes, helper 0x180002970 runs (unread. inferred: re-bases the actor root).
- `RTKFixHomeBase` on the root: if Shift is not held and it is absent, it is added. If Shift is held and it is present, it is deleted.
- If `RTKActor` exists: refit Radius/Height. Then re-run Initialize without the Shift behaviour. Then store the home pose for
  the whole model subtree (§2.4: `RTKHomePose` with global SRT on every non-sphere node).
- Partial: 0x180002970 unread.

### `BvrGotoHome`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: §2.3. Progress caption `Applying Home Pose`.
- Model, scene root and actor root checks. If the actor root has no `RTKHomePose`, nothing happens.
- If the root has `RTKHomePose` but no `RTKActor`, and the root has animation (`IsAnimated` type 9), an OK/Cancel box asks
  `Is it okay to remove the embedded FCurves on the rig (the FCurves conflict with the Goto Home action)?`.
  Cancel aborts. OK removes the animation through helper 0x1800388b0 (inferred).
- Apply the home pose (§2.4) over the model. With `RTKActor` present: one pass that skips class 0x4d nodes. Without it: that pass, then
  a pass with class-0x4d nodes rotated, then the first pass again, then the second again (four passes).

### `BvrGenerateActor`: SPEC-PARTIAL
Wire contract:
- Args: none. Return: empty. Gate: §2.3. First runs `DeselectAll`.
- Checks: model (scene root gives `The source actor description must be contained by a single model (scene root not
  supported).`), actor root, nested models, COG, and `RTKNode` on the root (`The source actor description must be initialized.`).
- Ensures `BehaviorGen` on the actor root, then runs a modal `InspectObj` titled `Generate Actor` (mode 4). Cancel ends the command.
- Reads `Envelope`, `Box`, `RemoveExtra`, `Cog`, `Factor`, `Skill`, `RemovePoly`. The command log is turned off. Progress caption
  `Generating Actor`.
- If the root is animated: OK/Cancel `Is it okay to remove the embedded FCurves on the rig?`. Cancel aborts.
- Builds a new actor (0x1800105c0, unread) with factor·0.5. Then it initializes the generated actor
  (`Initializing Generated Actor`), shows `Cleaning Up`, and fits `RTKActor` on the new root. If the source had `RTKHomePose`,
  it runs SetHome on the new actor, with Shift-held behaviour unless the source has `RTKFixHomeBase`. If `Skill` is set, it transfers
  the sources (0x18000f470, 0x180017750, unread).
- Partial: generation, envelope transfer and skill transfer bodies unread.

### `BvrSetCOG`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: §2.3.
- Model check (`Failed to find the actor model.`). Scene root check (`The actor description must be contained by a single model
  (scene root not supported).`). Actor root check. Nested-model check (`The source description must be contained by a single model
  (embedded models not supported).`).
- The node must not be a light or camera (`The COG node can not be a light or camera.`). The node's parent's parent must be the
  model (`The COG node must be two levels below the model.`).
- Adds an empty `RTKCogNode` tag to the node if it is absent.

### `BvrSetFoot`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: §2.3. Behaviour depends on Shift.
- Requires `RTKHomePose` on the selected node (`The Set Foot action can not be applied to an actor whose Home pose is not
  set. Please set the Home pose and try again.`). The node's parent must not be a Model (`The Set Foot action can not be
  applied to the root node of an actor.`).
- If `RTKEffector` is absent, adds it (`Contact`, `Anchor`, §2.4). Sets wire colour 0x12e.
- If Shift is **not** held: when a direct child already carries `RTKSphere`, a message says `The foot node already has a
  collision sphere as a child. You will need to add additional collision spheres manually.` Otherwise two
  collision spheres are created (0x180024530). One is placed under the foot node and one under its lowest descendant (the lowest global Y).
  Each sphere is built like AddColSphere without opening the inspector. Radius = 0.25 × home `py`, or 0.25 if the node has no `RTKHomePose`.
  Both spheres are lowered by the same amount (radius + (globalY − home py)). When the foot has no lower descendant,
  the second sphere is offset by home `py` in Z. Both spheres are temporarily parented to the scene root and then put back.
  (inferred: these are heel and toe spheres. The bound helpers 0x18003d2e0, 0x18003b0a0, 0x18000d070 and 0x18003ca80 are unread.)

### `BvrAddColSphere`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: §2.3.
- The node's parent must not be a Model (`The Add Collision Sphere action can not be applied to the root node of an actor.`).
- Adds a `Sphere` primitive named `<node>_CS` as a child of the node. Its global translation is set to the node's global
  translation. Its `radius` = |node global Y − min Y of the node's geometry| (helper 0x180024d10, unread), or 1.0 when
  no bound is found.
- Ensures `RTKNode` on the sphere. Adds `RTKSphere` with `Radius` (siFloat, default = computed radius, [0, FLT_MAX],
  {0, 100}, capability 6). Sets wire colour 0x1ef.
- Opens `InspectObj("<sphere fullname>.Sphere", "", "Collision Sphere", 3, true)`.

### `BvrAddFloor`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: §2.3.
- Requires `RTKNode` (`The Add Floor action requires the selected node to be initialized. Please initialize the actor and
  try again.`). If the parent is a Model, it shows `The Add Floor action can not be applied to the root node of an actor.` **but does not
  abort** (observed: execution continues).
- Requires a polygon mesh with at least 1 triangle (`The Add Floor action can not be applied to a node without an associated
  polygon mesh.`). If a direct child carries `RTKFloor`: `A floor node already exists under the selected node.`
- Adds a Null `Floor` under the node. Its local transform is identity with translation (0, minY, 0), where minY and maxY come
  from helper 0x180024d10. Ensures `RTKNode` on the null (wire 0x200). Adds `RTKFloor` with `Top` (siFloat, default
  maxY − minY, or 0 if no bound, [0, FLT_MAX], {0, 100}, capability 6).

### `BvrSetCollisionOnly`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: §2.3. Requires `RTKNode` (`The Set Collision Only action requires the selected node
  to be initialized. Please initialize the actor and try again.`).
- Sets `RTKNode.VisualizationOnly` and `RTKNode.CollisionOnly` (inferred values: false and true). If the node has no `RTKEffector`, sets wire colour 0xf9.

### `BvrSetVisualOnly`: SPEC
Wire contract:
- Same as SetCollisionOnly with the `Set Visual Only` message. Values (inferred): VisualizationOnly true, CollisionOnly false.
  Wire colour 0x334 when there is no `RTKEffector`.

### `BvrSetDefault`: SPEC
Wire contract:
- Same as SetCollisionOnly with the `Set Default` message. Values (inferred): both false. Wire colour 0x200 when there is no `RTKEffector`.
- (The inferred values follow from RemoveFoot's colour mapping: VisualizationOnly gives 0x334, CollisionOnly gives 0xf9, otherwise 0x200.)

### `BvrAddJointLimit`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: §2.3. The command log is not suppressed.
- Requires `RTKNode` on the node (`To add a Behavior Joint Limit, the actor must first be initialized.`) and `RTKHomePose` on the node
  (`... the actor home pose must be set (Set Home).`). Model check. Actor root check. `RTKActor` on the root
  (`The actor must be properly generated before a Behavior Joint Limit can be added. Please try the Generate action and try again.`).
- Adds a `BehaviorJL` property to the node if it is absent. Then `InspectObj(<prop>, "", "Behavior Joint Limit", 1, true)`.

### `BvrMakeSkill`: SPEC-PARTIAL
Wire contract:
- Args: none. Return: empty. Gate: a single X3DObject, or a single ActionSource (then the worker runs on the source's model, and the
  source index is found by name match in `Model::GetSources`).
- Model and scene root checks. Actor root check. The model must have sources (`The Make Skill action requires the actor to have
  associated action sources.`). `RTKNode` on the root (`... requires the actor to be initialized. ...`). `RTKHomePose` on the root
  (`... requires the actor home pose being set (Set Home).`).
- Ensures `Skill` on the actor root. Sets `Source` (inferred: the selected source index). Runs a modal InspectObj `Make Skill` (mode 4).
- On OK: reads `Threshold`, `Skill` and `Transfer`, and turns the command log off. Collects foot tags (0x18003aa30. inferred: nodes with `RTKEffector`).
  If Skill = 2 and Transfer is off and there are no foot tags: `To create a locomotion skill the actor must have foot tags. Please tag
  the feet and try again.`
- Otherwise it sets the source's `type` parameter (value unread).
  - **Transfer on**: an OK/Cancel box about source FCurves if animated. Then `PickObject("Select Target Model", "Select Target Model")`.
    Errors: same model (`The target actor for a skill transfer cannot be the same as the source actor.`), bad root (`The target for the
    skill transfer is not a valid actor (bad root node).`), target root without `RTKNode` (`... is not initialized for Behavior.`).
    An OK/Cancel box about target FCurves. A locomotion transfer requires target foot tags. It reads the source's `FrameStart` and `FrameEnd`.
    Progress `Transferring Skill`. Transfer core 0x18000f980 (unread). `Cleanup` (0x180004690, unread).
  - **Transfer off**: requires `RTKActor` and Skill > 0. An OK/Cancel box about rig FCurves (Cancel disables the conversion).
    Skill 1 runs 0x18002e6d0, 2 runs 0x180033a30 (with Threshold), 3 runs 0x1800360b0 (all unread).
- Always deletes the `Skill` property at the end, including after Cancel.

### `BvrMakeLoop`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: as MakeSkill (X3DObject or ActionSource).
- Model, scene root and actor root checks. The model must have sources (`The Loop Skill action requires the actor to have associated
  action sources.`).
- Ensures `LoopSkill` on the actor root. Sets `Source` (inferred: the selected source index). Then
  `InspectObj(<prop>, "", "Loop Skill", 1, false)`. The looping itself is done by `LoopSkill_PPGEvent` (not read).
  Its messages include `The range given for making the motion loopable is invalid.`

### `BvrRenderSetup`: SPEC
Wire contract:
- Args: none. No selection is needed. Ensures a `RenderSetup` property on the scene root, then
  `InspectObj(<prop>, "", "Render Setup", 3, false)`. Further work is done by `RenderSetup_PPGEvent` (not read).

### `BvrImportBVHAction`: SPEC
Wire contract:
- Args: none. Return: empty. Gate: §2.3 (target actor node).
- Model and scene root checks. Ensures `BVHActor` on the **model**. Sets `Mode` (inferred: the action mode). Sets the PPG help attribute
  to `<FactoryPath>/Doc/<DocLangPref>/xsidocs.chm::/behave12.htm`. Runs a modal InspectObj `Import BVH Action` (mode 4).
- On OK: runs `BvrAddBVHAction(model, BVHFile, ActionName, Scale, Optimize, Filter, Remove, Root)`.

### `BvrAddBVHAction`: SPEC-PARTIAL
Wire contract:
- Args (positional, no defaults): arg0 model (siRef), arg1 BVH file path (siString), arg2 action name (siString),
  arg3 scale (siDouble exactly), arg4 optimize (siBool). arg5 filter (string, optional, default ""), arg6 remove (string, optional,
  default ""), arg7 root (siBool, optional, default true).
- If arg0..arg4 do not have exactly these types, it returns OK silently and does nothing.
- With the command log off, runs the BVH action importer 0x18003f0d0(model, file, name, (float)scale, optimize, filter, remove, root) (unread).
  (inferred: it creates an action source named arg2 on the model from the BVH MOTION block.)

### `BvrRemoveCOG`: SPEC
Wire contract: Gate §2.3. If the node has `RTKCogNode`, runs `DeleteObj` on that property. Otherwise nothing.

### `BvrRemoveFoot`: SPEC
Wire contract:
- Gate §2.3. Without `RTKEffector`, nothing happens. Otherwise it deletes `RTKEffector`. If `RTKNode` exists it resets the wire colour to 0x334 if
  VisualizationOnly, 0xf9 if CollisionOnly, otherwise 0x200.
- Collects every X3DObject in the node's subtree (including the node itself) that carries `RTKSphere`. If there are any, a Yes/No box asks
  `Do you want to remove the collision spheres under the foot node?`. Unless the answer is No, each is removed with `DeleteObj`.

### `BvrRemoveFloor`: SPEC
Wire contract: Gate §2.3. Runs `DeleteObj` on every X3DObject in the node's subtree, including the node itself, that carries
`RTKFloor`. There is no confirmation.

### `BvrRemoveJointLimit`: SPEC
Wire contract: Gate §2.3. If the node has `BehaviorJL`, runs `DeleteObj` on that property.

### `BvrGenerateRenderSetup`: SPEC-PARTIAL
Wire contract:
- Args: `filename` (siString, required), `target` (siRef to a Group, required), `start` (siInt4, required), `end`
  (siInt4, required), `domap` (siBool, required), `classname` (any value converted to a string, optional, default ""), `doui` (bool,
  optional, default false).
- Validation is in order. The first missing or wrong-typed argument logs `RenderSetupGenerate command missing <x> parameter (<i>).`, where x and i are
  `filename (0)`, `target group (1)`, `start (2)`, `end (3)` or `domap (4)`. The command then returns OK and does nothing.
- Runs the writer 0x180027b40(filename, group, start, end, domap, classname, doui). The file layout was not read.

### Extras
- `BvrSaveActor` (SPEC-PARTIAL): gate §2.3. Model, scene root and actor root checks. Progress `Scanning Hierarchy`. Purge temporary objects. Nested-model and COG checks.
  Requires `RTKActor` (`The actor must be properly generated before it can be saved. Please try the Generate action and save the
  resultant actor.`). Scale check (`Save action`). Prepares the rig (0x18000d070, 0x18000ce30, unread). Collects weight maps
  (`Processing Weight Map`, 0x18000d250). If sources exist, runs 0x180004690. Applies the home pose (one pass). Deletes `LoopSkill`. Runs `SelectObj` on the model.
  Sets `dotXSIExportOptions`: output_file_format_version 360, tesselation true, polymesh true, nrbscrv true, animall true,
  custompset true, animplot false, textures true, txtfiles true, txtformat 5, txtresizex 0, txtresizey 0, txtabsolute false,
  txtsequences false. Opens a save dialog `Save Actor` (filter `Actor (*.xsi)|*.xsi||`, initial directory `ActorFile.InitDir`). Cancel ends the command.
  Stores the directory back. Runs `SIExportDotXSIFile(model, path)`. Writes the `.wgmp` sidecar when weights exist.
- `BvrLoadActor` (SPEC-PARTIAL): no selection is needed. Opens a dialog `Load Actor` with the same filter and InitDir. Reads the `.wgmp` sidecar if present.
  Runs `SIImportDotXSIFile(path, scene root)`. If the root gained a child, the child at the old count index is treated as the actor model:
  temporary objects are purged and the weight maps are applied (0x180009080, unread). Then runs `DeselectAll`.
- `BvrImportBVHActor` (SPEC-PARTIAL): no selection is needed. Ensures `BVHActor` on the scene root. Help attribute `.../behave11.htm`. Sets `Mode`.
  Runs a modal InspectObj `Import BVH Actor`. On OK it reads BVHFile, ActorName, Filter, Remove, Root, Box and Scale, and turns the command log off.
  Builds the actor model from the BVH (0x180040450, unread). Runs 0x180039200 (unread). Then Initialize on the new model with Shift-held
  behaviour (adds and fits `RTKActor`), then SetHome without Shift (adds `RTKFixHomeBase` and stores the home pose).

## 4. Open questions
1. Exact `PutParameterValue` constants that the decompiler dropped: the VisualizationOnly/CollisionOnly values in the Set* commands,
   `Mode` in ImportBVHActor/ImportBVHAction, the `Source` index in MakeSkill/MakeLoop, and the source `type` in MakeSkill.
   These need a disassembly read of the immediate operands.
2. Unread algorithm bodies: actor generation (0x1800105c0 and callees), skill conversion (0x18002e6d0, 0x180033a30,
   0x1800360b0), skill transfer (0x18000f980), cleanup (0x180004690), BVH actor/action readers (0x180040450, 0x18003f0d0),
   render-setup writer (0x180027b40), home re-base (0x180002970), bound helpers (0x180024d10, 0x180038b60), and weight-map
   apply/collect (0x180009080, 0x18000d250).
3. Class ids 0x4d/0x4e/0x50/0x51/0x54/0x55 are taken from `IsA` calls. Their SDK names (chain/light/camera kinds) are inferred from the messages.
4. `_DefineLayout` and `_PPGEvent` callbacks of the six properties (UI layout, LoopSkill looping, RenderSetup buttons) were not read.
5. Init flag 0x00800000 is assumed to be `siNoLogging`. This should be confirmed against the SDK header enum.
