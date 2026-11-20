# CMD-B17h: command-editor, spine rig, character tagging / guide script commands (`command.js`, `rigs.vbs`, `Charac_Tools.js`, `Charac_LoadBipedGuide.vbs`) and LOCKs (`duplicate.vbs`, `Charac_HierachyFromBiped.vbs`)

Row: **CMD-B17h**. Status: **SPEC** for 4 commands, **SPEC-PARTIAL** for 2 (`command.js`), **LOCK** for 2.
Run: 2026-11-20, si-analyst worker, unattended, batch 17
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none (script commands, handler CLSID `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9`). Sources read with REA raw-6502
`read_bytes` (all files sit directly in `Application\DSScripts\`).

| File (`Application\DSScripts\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `command.js` | 44423 | `2fffc9d8` | partly (0x8400–0x9724 EditCommandProc start, 0xaad0–end) | 2 |
| `rigs.vbs` | 10618 | `20c070a4` | partly (0x0260–end: CreateSpineFunc and its helpers) | 1 |
| `Charac_Tools.js` | 8074 | `b61e9a75` | whole | 2 |
| `Charac_LoadBipedGuide.vbs` | 3237 | `24c1721f` | whole | 1 |
| `duplicate.vbs` | 132049 | `757cfdf3` | no (> 64 KB) | 1 |
| `Charac_HierachyFromBiped.vbs` | 77740 | `5ab0a474` | no (> 64 KB) | 1 |

Earlier contracts reused: `cmd-b17f-primitives-particle-scripts.md` (`GetPresetModel`), `cmd-b8e-primtasks-prims-binary.md`
(`SIInstantiate`), `cmd-b6e-duplicate-rendering-simulation-scripts.md` (other duplicate.vbs commands),
`cmd-b15e-character-rigging-scripts.md` (biped guides / rigs).

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `EditCommand` | command.js | `EditCommandProc` | SPEC-PARTIAL |
| `CreateAndEditCommand` | command.js | `CreateAndEditCommand` | SPEC-PARTIAL |
| `CreateSpine` | rigs.vbs | `CreateSpineFunc` | SPEC |
| `TagObject` (4 entries) | Charac_Tools.js | `tagObjectProc` | SPEC |
| `TagStepMarks` | Charac_Tools.js | `TagStepMarksProc` | SPEC |
| `GetProportionalGuide` (3 entries) | Charac_LoadBipedGuide.vbs | `load_biped_guide` | SPEC |
| `Instantiate` (4 entries) | duplicate.vbs | `InstanceProc`, `InstanceWizardProc` | LOCK |
| `CreateHierarchyFromBiped` (2 entries) | Charac_HierachyFromBiped.vbs | `HierachyFromBipedProc` | LOCK |

## 2. Wire contract, command.js (category Customization)

### `EditCommand` (SPEC-PARTIAL)
Args: `CommandName` (str, ""); return bool (True = user cancelled, False = OK), default True.
1. Look the command up by name in `Application.Commands`; if not found, by scripting name
   (`GetCommandByScriptingName`). Still not found → log (siWarning) `'<name>' is not an editable command.`, return False.
2. Set `preferences.scripting.cmdlog` False (logging off while editing).
3. Build an unattached `CustomProperty` named after the command: one parameter per command property (name, type,
   current value; read-only when the property or the command is read-only; built-in commands are read-only), plus
   `Embedded` (siInt4, 1, range 0–10), `Builtin` (bool = command's BuiltIn, read-only), `CodeBackup` (string).
4. A grid parameter `Arguments` with 4 columns: Name, Type (combo: Input = siArgumentInput, Output = siArgumentOutput,
   Input/Output = siArgumentInputOutput, "" = −1), Default Value, Handler (combo of the argument-handler list); one row
   per command argument (name, flags, value, handler index); grid hidden when the command has no arguments.
5. Layout starts with tab `Description` (LongName shown as `Name`, ScriptingName, …).
Not read: rest of the layout, the modal inspect, writing changes back, cmdlog restore.

### `CreateAndEditCommand` (SPEC-PARTIAL)
No args; return bool. Creates a command with `Application.CreateCommand(<unique name based on "NewCommand">)` and
returns the result of editing it (helper `EditNewCommand`, not read; (inferred) the same editor as EditCommand, which
adds the command on OK).

## 3. Wire contract, rigs.vbs

### `CreateSpine` (category Animation)
Args: `Hip`, `Chest` (objects, f 0x10046), `NumVertebrae` (int, 3), `ImplicitVertebrae` (bool, False), `Interactive`
(bool, True); return Value (the `Spine_Control` property).
1. Interactive: pick the hip, then the chest (`PickElement` with dictionary texts); right-click on either → return
   (Empty). Then a modal dialog: temporary `Custom_parameter_list` `Spine_Maker Keys` on the scene root with
   `NumberOfVertebra` (siInt4, default 3, range 1–100, UI 1–20) and `ImplicitVertebra` (bool, 0); cancel → delete it,
   return; else read both and delete the property.
2. Save and set user prefs: `siAutoInspect` False, `SI3D_CONSTRAINT_COMPENSATION_MODE` 0.
3. Curve: hip and chest global positions P0, P3; P1 = lerp 0.40, P2 = lerp 0.60; scene-root NURBS curve
   `spineCurve` through the four points (default curve options); null `hipDepth` under the hip at P1, null
   `chestDepth` under the chest at P2 (global transform); dist = |P0 − P3|.
4. Bind: on the curve, `Custom_parameter_list` `Spine_Control` with `scale` (siDouble, visualization class,
   animatable, default 1, range 0.01–10000, UI 0.01–10); operator `SpineCurve` on curve, hip, hipDepth, chestDepth,
   chest; `lgoal` = curve length; expression `lScale` = the scale parameter.
5. Top vertebra: cube `vertebra` under the curve, length = dist / N × 0.8, path-constrained to the curve (no
   compensation, tangent on, `upvct_active` on); operator `FixedLength` on (top vertebra, curve), `init_length` =
   curve length, expression `lScale` = scale.
6. N vertebrae (i = 0 … N−1): cube `vertebra` under the curve, implicit (`AddPrimitive "Cube"`) when
   ImplicitVertebrae else polygon mesh (`AddGeometry "Cube", "MeshSurface"`); length = dist / N × 0.6; path constraint
   (tangent, upvct_active); expression on `perc` = `<top constraint>.perc * k` with k = (i+1)/(N+1) rounded to 6
   decimals, written with a `.` decimal separator. Then per vertebra operator `SpinePointAt` (vertebra, chest, hip)
   with `slider` = 1 − i/(N+1) − 1/(N+1); top vertebra `SpinePointAt` with `slider` 0.
7. Restore both prefs; return `Spine_Control`; Interactive → `InspectObj` it; the Interactive argument is set False
   (by reference) so a logged replay does not prompt.

## 4. Wire contract, Charac_Tools.js (category Property, Animation)

### `TagObject`
Args: `InputObj` (Collection), `TagStr` (str: `Tag`, `CenterOfGravity`, `LeftFoot`, `RightFoot` per entry).
First item missing → log (siWarning) `Please select an object to tag first`, stop. For each input: if it has no
property named TagStr → `AddProperty("Custom_parameter_list", False, TagStr)`, log (info) `<obj> tagged as <tag>`;
else log `<obj> already tagged as <tag>`.

### `TagStepMarks`
Args: `InputObj` (ignored; the global selection is used).
1. Model = scene root when nothing selected, the first selected item if it is a `#model`, else its model. Recursively
   find objects carrying a property named `RightFoot`, `LeftFoot`, `CenterOfGravity`; the first of each is used. Logs
   `RFoot: …`, `LFoot: …`, `cog: …`.
2. Dialog: temporary `Custom_parameter_list` `Test_step_detection` on the scene root: `Start` (siInt4, default
   `Project.Data.PlayControl.In`), `End` (siInt4, default `…PlayControl.Out`), `velocity_threshold` (siDouble, 0.2,
   0–100); modal inspect titled with dictionary id 1050; cancel → delete, log (siError) `Command was cancelled !`
   (the procedure still continues with no frame range, so nothing is created except the top null). Property deleted.
3. Null `Foot_Steps` under the scene root.
4. For the right foot, then the left foot, frames Start…End: global translation per frame. At the first and the last
   frame a marker pair is created at that frame's position. In between, a frame whose displacement from the previous
   frame is shorter than the threshold extends the current "locked" span (the second frame counts double);
   the first moving frame after a locked span closes it with a marker pair from the span's first position to the
   current position.
5. Marker pair (under `Foot_Steps`): cube `StartStep` (length 0.1) at the start position and cube `EndStep`
   (length 0.1) at the end position, each with a display property wire colour 302; a linear 2-point NURBS curve
   between them (knots 0, 1, open, non-uniform parameterization, SI NURBS) with wire colour 1022.

## 5. Wire contract, Charac_LoadBipedGuide.vbs (category Primitive)

### `GetProportionalGuide`
Args: `ModelName` (str: `BipedPropGuide` for "Get Skeleton Biped Guide", `Biped_Guide` for the proportional guide,
`Biped_DogLeg_Guide` for the dog-leg guide), `GuideStyle` (int 0), `GuideSymmetry` (int 0), `UseDialog` (int: 0 for
the first entry, 1 for the others). No value is returned (the procedure is a Sub).
1. UseDialog: temporary property `BipedGuide` (preset) on the scene root, modal inspect titled with dictionary id 1047;
   cancel/error → delete and stop; else GuideStyle = its `Style`, GuideSymmetry = its `Symmetry`; delete.
2. `GetPresetModel(ModelName, ModelName)` (see `cmd-b17f`).
3. viewvis = 2 when GuideStyle is 0, else 0. Old guide (`BipedPropGuide`): `SetValue <guide>.DetailedGuideVisible.viewvis`;
   others: `<guide>.DetailedGuide.viewvis`.
4. Symmetry removal (deletes every `symmetrycns` constraint found among the constraint sources animating the given
   object's parameters): 1 → on children `RibCageEnd`, `RArmPitTop`, `LArmPitTop`, `RArmPitBase`; 2 → `LLeg`, `RLeg`,
   `RLowerThigh`, `RHipBottom`, `RHipTop`, `RKnee`, `RFemur`, `RTibia`, `RMetatarsal`, `RFoot1`–`RFoot4`; 3 → on the
   guide model itself.
5. `DeselectAll`.

## 6. LOCK entries

### `Instantiate` (duplicate.vbs, 132049 bytes, not read)
Category Edit. Entries: "Instantiate" (`InstanceProc`; options from the duplicate preferences: Hierarchy
`siNoParent` / Grouping `siNoGrouping` / Selection `siSetSelection` / Xfrom `siGlobalXForm` as enum strings),
"Instantiate Single" (`InstanceProc`, enum args −1 = use preferences), "Instantiate Single w/o Options"
(`InstanceProc`, S 1, R 0, T 0, TrackXform False), "Instantiate Multiple" (`InstanceWizardProc`, wizard dialog for
NbItems and the per-copy transform). Args: `InputObjs`, `NbItems` (1), `Hierarchy`, `Grouping`, `Selection`, `Xfrom`,
`Sx/Sy/Sz`, `Rx/Ry/Rz`, `Tx/Ty/Tz`, `TrackXform` (strings); return Value. (inferred) Wraps `SIInstantiate`
(`cmd-b8e`) the same way `Duplicate` wraps `SIDuplicate`.

### `CreateHierarchyFromBiped` (Charac_HierachyFromBiped.vbs, 77740 bytes, not read)
Category Primitive. Display "Create Hierachy from Biped" (sic). Args: `GuideName` (str), `HierarchyStyle` (int 0),
`UseDialog` (int: 1 on entry `7471daac…`, 0 on `f1305cea…`), `IndependentLower` (bool False); return Value.
(inferred) Builds a skeleton/null hierarchy from a biped guide (picked or named), style chosen in a dialog when
UseDialog is 1.

## 7. Open questions
- command.js editor apply path, `EditNewCommand`, `GetUniqueCommandName`, `IsReadOnly`, `CreateParamDataArray` not read.
- duplicate.vbs and Charac_HierachyFromBiped.vbs need a > 64 KB reader.

## 8. Corrections for the wire agent
- `GetProportionalGuide` returns nothing (its procedure is a Sub) although the registry declares a return value.
- `TagStepMarks` ignores `InputObj` and works from the global selection's model and the `RightFoot` / `LeftFoot` tag
  properties.
- `CreateSpine` writes its `Interactive` argument back as False.
