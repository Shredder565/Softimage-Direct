# Wire corrections from analyst batch 16 (2026-11-20)

Read from the binaries (REA + Ghidra); no XSIBATCH golden. They confirm or correct the commands the wire agent
registered by inference in PR #193 (CMD-B15-ELSE) and a few older inferred names. Details and evidence are in the
notes named per section. Items marked `(inferred)` in the notes stay inferred.

## Tool activation commands, `toolmanager.dll` (cmd-b16a)

1. In `data/command_registry.json`, for `vt` 72 (VT_CLSID) arguments the field `handler_clsid` is the argument's
   **default CLSID**, not an argument handler. Translate = `3a711ff0…`, Rotation = `ecbad3a0…`, Scaling =
   `f500bd80…`, MoveComponent Tool = `da55a810…`, Modify Projection = `0bf11154…`, LastTool = GUID_NULL.
2. All 68 `0461b2c6` commands: the tool class comes from the `Clsid` argument (the command GUID is not used);
   GUID_NULL = "last auxiliary tool" (nothing recorded → no-op). No undo, no log line, no return value; an
   uncreatable class is silently ignored.
3. Already current: nothing happens unless the preference `Interaction.stickytoggle` is on (then toggled off) or
   modifier bit 0x10 is set (restart). Key-down (context flags 4|2) activates in supra mode, except: with
   `Interaction.stickykeys` off for Translate / Rotate / Scale; with stickykeys on for every tool but Maya Zoom.
   Key-up makes the tool sticky or deactivates it.
4. Excluded from "last auxiliary tool": selection `11778840`, Translate, Rotate, Scale, Manipulate `36ad0600`,
   Navigation `988e8c81`, 3ds Max Navigation `a31f01db`, `d97e3888`. `inferredB10Views.ts` sets `lastAux` for
   `ManipulateTool`: wrong.
5. `DoNothing` is not a no-op: it activates the inert tool class `2b2ffb2e`, which ends the current tool.
6. `MoveComponent Tool` activates `da55a810`, not the Tweak class `9eebc290` (delegating to TweakTool is a stand-in).
7. `Pick Session Tool` becomes the current tool even outside a pick session (class `cf80cbc3` is exempt from the
   tool-state refusal).
8. `XYZ Transform `: a notification relay. `Property` must be one of `SI3D_SUPRA_COMMAND_ACTIVATED`,
   `SI3D_SUPRA_COMMAND_DEACTIVATED`, `SI3D_STICKY_COMMAND_ACTIVATED`, `SI3D_STICKY_COMMAND_DEACTIVATED`,
   `SI3D_COMMAND_EXECUTED`, else E_INVALIDARG `0x80070057`; then fires that event with GUID `b4238eb0`.
9. `Transform Set New ` has a null handler CLSID and no DLL: inert; drop the "what it creates" log.
10. `Add Surface Point Tool`, `Delete Components`, `Paint Tool` {cf80cbc2} (`0461b2bd`) use the session dispatcher:
    start on key-down, end otherwise; the `CmdID` argument is ignored (the command id comes from the context).
11. `TranslateTool`, `RotationTool`, `ScalingTool` (`src/commands/ui.ts`) need the `Clsid` argument with the
    registry defaults; an explicit `Clsid` overrides the class. `TweakTool`, `MovePointTool`, `PropTransformTool`
    have `Clsid` default `''` in the wire; use `9EEBC290…`, `F500BD81…`, `BB67E5D2…`.
12. Do not disable any tool command on the registry `flags`; no handler reads them.

## Shader creation, array elements, Append Bone (cmd-b16b)

13. `sicoresdk.dll`, `shaderhelper.dll` and `xgs.dll` serve none of these commands (they only run them). The
    `bbbbee29` family and `SIAddArrayElement` / `SIRemoveArrayElement` / `SISwapArrayElements` are in
    **`shadertasks.dll`** (batch 12 missed them: its `DllGetClassObject` compares CLSIDs as two 64-bit values).
    `SIAppendBone` is in **`viewinteraction.dll`**.
14. `CreateShaderFromCLSID`: remove the CLSID→ProgID table and the "not known in this build" failure; create the
    shader from the parsed CLSID; default name from the SPDL default; a non-empty `Name` wins.
15. All `bbbbee29` modes: locked container → lock error and `0x80070005` before anything is created; a compound that
    refuses the shader → E_FAIL with XSISHADERTASKS `0xd2`.
16. `CreateShaderFromProgID`: unknown ProgID → E_FAIL (already right); default name = the shader definition's name.
17. `CreateShadersFromMaterialPreset`: a non-material preset → E_FAIL. For a material preset add only the shaders
    plugged into its ports, with their connections to each other; no material values, no connections to the
    container's ports. Drop the "not yet attested" log.
18. `AddShaderAttachedComment` (`shellsB15Else.ts`): create an object from `Comment.Preset` (class
    `77db4b2d-9e05-462c-a7c9-ed91d7783133`), attach it to the container, return it, record undo. A second
    comment on the same container → E_FAIL.
19. `SISwapArrayElements`: negative index or index ≥ element count → E_INVALIDARG when arguments are read; equal
    indices = no-op; connections move with the elements; non-array `Object` → E_INVALIDARG.
20. `SIRemoveArrayElement`: `Object` is the element itself; `Index` is ignored; its connections are cut first.
21. `SIAppendBone`: `InputObjs` must hold exactly one item, else S_FALSE and nothing; any chain element accepted;
    referenced model → E_ACCESSDENIED; `Pin` true keeps the effector's global pose; root alignment happens inside
    the task only for a 3D chain with Pin on (do not run `AlignRootToFirstBone`); the new bone is returned as `Value`.

## `tasks.dll` (cmd-b16c)

22. `Undo` / `Redo` (`src/commands/index.ts`): add `Repetitions` (default 1), perform up to N steps and write back
    the count done.
23. `EndUndo` with no open group does nothing (no throw). `BeginUndo` with empty `Name` labels the group
    "No-name operation".
24. `DeleteCurrentLayer` (`inferredB15.ts`) is the DeleteObj handler (`dd531990`) on `InputObj` default
    `{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:Layers.Current`, not `DeleteLayer`. `DeleteCurrentPass`
    (`moduleToolbar.ts`) likewise deletes `…:Passes.Current` through DeleteObj (not "pop the last pass"); add the
    `InputObj` argument.
25. `RunPerformanceTest`: Type 0 / 2 playback tests, 1 / 3 drawing tests (2 / 3 without instrumentation); other
    Type → header with "unknown", nothing runs; report appended to `FileName` with a fixed header (TEST / Date /
    Duration / system info); file cannot be opened → no test runs.
26. `CopyPaste`: `Mode` 0..3 (≥ 4 → E_INVALIDARG); neither `Source` nor `FileName` → E_INVALIDARG, both →
    E_UNEXPECTED; `Target` required; modes 1 / 2 / 3 are distinct paste operations (codes 8 / 4 / 2).
27. `DelayedRefresh`, `SetDropMessage`, `ResetDirectX`, `RefreshCustomPreferences`: wiring matches; drop the
    `inferred` markers. `SetDropMessage` ignores a non-string `Message`.
28. `Add3DObjectToScene` and `SetReference2` are in `tasks.dll` (fix the comments in `modelTasksB15aShared.ts` and
    `shadertasksB12Shared.ts`). `Add3DObjectToScene`: `Parent` defaults to the scene model; a locked parent raises
    `0x80070005` (message 0x57).

## `scnmgr.dll`, `rendercore.dll`, `kinechain.dll` (cmd-b16d)

29. `Mesh Filter`, `Dice Object/Polygons`, `Delete Selected`, `Duplicate/Extrude Single|Multiple`,
    `Invert Polygons`, `Subdivide`, `Move Component Tool` (handler `48becc30`) are run by scnmgr's generic
    filter-map executor: groups of (`SelFilter`, `OnFilterCmdMapClient`, `OnFilterCmdID`, `InputObjsArgName`)
    from the command's own registry arguments, applied in order to the remaining input; each non-empty match runs
    its target command; an empty `SelFilter` is a catch-all only as the last group; empty input = current
    selection. Replace the hand-written choices; a mixed selection can run several targets.
30. `Dice Object/Polygons`: an object runs the **Dice Object** preset, not Dice Polygons on the whole mesh.
31. `keymap.ts` / `menubar.ts` send `Delete Selected`, `Duplicate/Extrude Single|Multiple`, `Move Component Tool`
    straight to DeleteObj / Duplicate / TweakTool; route them through the filter map (component selections run
    Delete Component, Dissolve & Clean Adjacent Vertices or DuplicateMeshComponent; curves run DirectManipTool).
    `Duplicate/Extrude Multiple` runs the "Duplicate Multiple" preset, not `NbCopies: 3`.
32. Register `Invert Polygons` (polygons → Invert Selected Polygons, else Invert All Normals) and `Subdivide`
    (polygons / meshes → Subdivide Polygon, edges → Subdivide Edge) as filter-map commands.
33. `CopyPartition` (`rendercore.dll`): drop both fallbacks (current-pass partitions, all passes); use `Target` and
    `InputObjs` as given; never merge into a same-named partition, always add a copy (Low Level Duplicate) named
    like the source; returns nothing (inferred).
34. `RegenerateMaps` (`rendercore.dll`): clamp TileSize to 8–512 with a log message; missing `Properties` →
    E_INVALIDARG; empty list → nothing, returns `0x562e80d2`; sets `PATH_TEMPLATE_SYSTEM_TIME` while running. The
    rendermap-type filter and selection fallback are not in the binary.
35. `CreateEnvironmentCache`: not in `corehelper.dll` (only a caller); add the output argument `Source` (registry
    flags 513). Serving DLL still unlocated (environments.dll / simulationop.dll not opened).
36. `GetSkeleton` (`kinechain.dll`): `Index` (VT_I4) and `ChainElements` (collection, written only when present) are
    output arguments, not side state; an object not in a skeleton → E_INVALIDARG.
37. `MarkObjectDirty`: null handler CLSID, no task class anywhere; keep the no-op and log "no handler".

## `optasks.dll`, `actioncore.dll`, `gap.dll` (cmd-b16e)

38. `TransferAllPropertiesAcrossGenOp` is served by `optasks.dll` (batch 12 said otherwise). Arguments:
    `Operator`, `Object`, `PropertyTransferType` (""), `ShareProperty` (true), `IncludeAllClusters` (false), out
    `Value` (`operatorsScripts.ts` uses wrong names). Per item it runs `SIBasicTransferClustersAcrossGenOp`,
    `TransferClusterPropertiesAcrossGenOp` or `TransferPropertiesAcrossGenOp`; in "all" mode then
    `SIRebindByNameUserData` per material.
39. `AddShotClip`: `Frame` required; clip moved to the first free slot at or after `Frame`; an overlap with the next
    clip is trimmed with `CutClip` Mode 3 (`siTrimAfter`); overlap length `EndFrame − StartFrame` (no +1); default
    name "Shot", no unique-name loop; shot track (class `79f6f946-…`) found under `Track` or found / created via
    `AddTrack` under the scene model's mixer; unresolved `Parent` → failure (XSIACTIONCORE 0x27).
40. `GetShotClip`: the query is always at `Frame`; `GlobalFrame` is an output (overwritten with the scene frame when
    not −1), not an alternative input.
41. `PaintWeights` is in **`gap.dll`**: `Deformer` −1 / empty = all deformers and the weight count must be a multiple
    of the index count; `Deformer` ≥ 0 needs equal counts; else `0x80070057` (no padding); empty `Indices` /
    `Weights` → `0x8000FFFF`; locked envelope → `0x80070005`; writes the envelope / weight-paint sub-objects of
    `InputObj`'s primitive (classes `052f8861-…`, `a3fe3cf0-…`), not a plain weight-map property.
42. `CopyPaste`, `SITransferShapeAnimation`, `PaintWeights` are confirmed **not** served by `optasks.dll`;
    `SITransferShapeAnimation` is probably `action.dll` (not opened).
