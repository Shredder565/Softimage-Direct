# CMD-B16e: optasks.dll re-check (SITransferShapeAnimation, TransferAllPropertiesAcrossGenOp, PaintWeights, CopyPaste), actioncore.dll shot clips (AddShotClip, GetShotClip), gap.dll (PaintWeights)

Row: **CMD-B16e**. Status: **SPEC** (0 names), **SPEC-PARTIAL** (4 names: `TransferAllPropertiesAcrossGenOp`,
`AddShotClip`, `GetShotClip`, `PaintWeights`). Not served by the binaries read: `SITransferShapeAnimation`,
`CopyPaste` (optasks only uses them), `CreateEnvironmentCache` (not reached, see 4).
Run: 2026-11-20, si-analyst worker, unattended, batch 16 (binary first, REA + Ghidra 12.1.4).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binaries (opened one at a time, all closed):
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\optasks.dll`, image base `0x180000000`,
  sha256 `bd94e0d535c21eeedc7b827512d61e0ba4f328d37ea7ed26af43c1aa5bf5c61f`.
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\actioncore.dll`, image base `0x180000000`,
  sha256 `c3976b5d3ef05eed9ef9d0721d48936800c38aa75eddbdafa5e694e8b483f75d`.
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\gap.dll`, image base `0x180000000`,
  sha256 `d3ab9b2645cbd3126b9446124d057a1f277808267067bf22ed02c3a46d565646`.

Method: for each CLSID, `search_bytes` on its **first 8 bytes only** (little-endian), which finds every `.rdata`
copy the compare chains load as two 64-bit values; `xrefs` on each copy and `resolve_containing_procedure` on each
reference to tell a `DllGetClassObject` compare (handler) from a use (sub-task creation / table). For served CLSIDs:
the compare block in `DllGetClassObject` assembly gives the factory vtable; factory slot 6 = create; constructor gives
task / worker vtables; Do (task slot 5), UnPackArg (task slot 8), worker slot 9 and RePack were decompiled.
UnPackArg reads exactly the registry argument names in every case, which confirms the mapping.
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | CLSID | DLL | `DllGetClassObject` compare | Factory vtable | Create (slot 6) | Constructor (size) | Do (slot 5) | Worker | UnPackArg |
|---|---|---|---|---|---|---|---|---|---|
| `TransferAllPropertiesAcrossGenOp` | `e73d3b5a-354e-466b-b12b-e666f3a560f5` | optasks | `0x1800148a2` (GUID copy `0x1800d8218`) | `0x1800dd9c0` | `0x18000fa70` | `0x1800648f0` (0x80, COM-object-first; task vtable `0x1800e9cd0`, worker `0x1800e9d40`) | `0x180065640` | `0x180064d60` (slot 9) | `0x180065800` |
| `AddShotClip` | `65cfe35a-a90c-4786-8d8c-b87a128004fb` | actioncore | `0x180005622` (copy `0x18006c330`) | `0x180066df8` | `0x180003a60` | `0x1800401b0` (0x158, COM-object-first; task vtable `0x18008ab20`, worker `0x18008ab90`) | `0x1800439e0` | `0x180040a10` (slot 9) | `0x180043df0` |
| `GetShotClip` | `fd3d98b2-7b7b-4246-9a2f-9abcdc2583c1` | actioncore | `0x18000569f` (copy `0x18006c350`) | `0x180066e30` | `0x1800041a0` | `0x1800599f0` (0x70, task-first; vtable `0x180090d00`) | `0x180059ba0` (does the work itself) | none | `0x180059eb0`; RePack `0x180059db0` (slot 9) |
| `PaintWeights` | `73c34ae0-9d75-11d4-b918-0800690c8bd0` | **gap** | `0x18002bffe` in `DllGetClassObject` `0x18002bc90` (copy `0x180048ce0`) | `0x180049d38` | `0x18002b940` | `0x18001c950` (0x170; task at +8, vtable `0x18003e480`) | `0x18001d600` | `0x18001d230` (object vtable `0x18003e420` slot 9) | `0x18001d820` |

## 2. Shared facts / re-check results

- **optasks.dll does not serve `SITransferShapeAnimation`, `PaintWeights` or `CopyPaste`.** Each CLSID has exactly
  one `.rdata` copy in optasks and none of its references is in `DllGetClassObject` (`0x180011e30`–`0x180015417`):
  `3b019512-…` (copy `0x1800d9048`) is used only by `0x18006a820` (the `TransferShapeAnimationAcrossGenOp` worker,
  sub-task creation, as batch 12e said); `73c34ae0-…` (copy `0x1800d7a88`) only by `0x18007a2b0` and `0x18008ffb0`
  (sub-task uses); `2c8a5f31-…` `CopyPaste` (copy `0x1800d73d8`) only by `0x180068eb0` (sub-task use). Batch 12's
  "not in optasks' chain" is confirmed for these three by the stronger method.
- **`TransferAllPropertiesAcrossGenOp` is served by optasks.dll** (batch 12e had only seen its CLSID in the table at
  `0x1800d8218`). The same table holds its sub-task CLSIDs: `81f70f51-067c-42c9-8a7b-3db10ace0688`
  (`SIBasicTransferClustersAcrossGenOp`, `0x1800d81f8`), `edca5404-3e79-4ede-b59a-d438b050c362`
  (`TransferPropertiesAcrossGenOp`, `0x1800d8208`), `f00335b8-9ed0-4595-93f5-886e7f2aa73d`
  (`TransferClusterPropertiesAcrossGenOp`, `0x1800d8228`).
- **`SIRebindByNameUserData` (`4a1613c1-…`) is used as a sub-task by optasks** (copy `0x1800d7458`) from
  `TransferAllPropertiesAcrossGenOp`; it is implemented in shadertasks.dll (batch 12f). Its SPEC-PARTIAL gap (the
  name-matching rule) is in shadertasks.dll and was not closed here (not cheap from these binaries).
- **`PaintWeights` is in gap.dll** (registry candidates optasks / gap / sicoresdk).
- **`F3DGetGlobalFrameSetFromSequencerRange` is not exported by actioncore.dll**: its export table has 4 entries
  (the COM entry points only). PR #180 Q10 stays open; candidates are the DLL that action.dll imports it from.
- **Camera-sequencer objects seen in actioncore.dll** (constants, names `(inferred)`): shot clip class
  `bddf3311-94f8-4b33-821e-588671859804` (the object `AddShotClip` creates); shot-track class
  `79f6f946-a257-4e5c-b27e-a727b5a0ee91`; sub-object lookup GUID `2320122b-d1b9-11d2-b34b-00105a1e6ce9`; the
  sequencer service `b51855f2-283c-44f9-a831-b8f325837092` (queried with `DSQueryGenericObject` by `GetShotClip`);
  sub-tasks `6d89e10a-ec1d-11d2-b353-00105a1e6ce9` (get / create the model's mixer container, as in batch 15d) and
  `67b8773c-e316-11d2-b350-00105a1e6ce9` (`AddTrack`); command `CutClip` (command GUID
  `44132ed4-4dd0-11d4-b4ac-00d0b7142c4a`, run through `F3DExecuteCmd` with `Mode` = 3 = `siTrimAfter`).
- Frames ↔ seconds: both shot-clip commands convert frame arguments with `SIFramesToSeconds` / `SISecondsToFrames`
  (current frame rate).

## 3. Contracts

### `TransferAllPropertiesAcrossGenOp`: SPEC-PARTIAL

**Wire contract:** transfer every property (or every property of one category) that a generator operator's inputs
carry onto the generated `Object`, by running the per-kind transfer sub-tasks, then rebind materials; returns the
collection of transferred items in `Value`.
- Args: `Operator` (required), `Object` (required), `PropertyTransferType` (string, default ""), `ShareProperty`
  (bool, default true), `IncludeAllClusters` (bool, default false), output `Value`.
- UnPackArg: `PropertyTransferType` "" → no category (= all). A non-empty name is looked up in a name → category
  map provided by the operator's transfer helper (interface `e83d2063-2cf6-4ff8-adfe-d7e7b3d494ac`); an unknown name
  fails with `0x80070057`. The category GUID is stored (category names are not in the binary as literals).
- Do: null `Operator` / `Object` / output → `0x80004003`. Validation as batch 12e section 2: `0x111` (operator /
  object pair), `0x115` (category check), `0x112` (object interface), each severity 2 → `0x80070057`.
- Creates the output collection, then asks the operator's transfer helper for the list of transferable items
  (`IncludeAllClusters` passed as the include-all flag), groups them by category.
- "All" mode = no category, or the category is the material category (`F3DGetMaterialCatID`). Categories
  `806385b5-0c0c-11d2-b84b-08003648ce03` and `c57a3140-e82b-11d0-996d-00a0243f0e60` are always skipped; in
  single-category mode only that category is processed.
- For every item of a processed category, classified by the shared helper (batch 12e "classification helper"):
  kind 0 → `SIBasicTransferClustersAcrossGenOp` (Operator, Object, item, item name); kind 1 →
  `TransferClusterPropertiesAcrossGenOp` (Operator, Object, item, name, `RebindClusterProperties` false); a
  `0x80070057` from it is tolerated (item skipped); kind 2 → `TransferPropertiesAcrossGenOp` (Operator, Object,
  item, name, `ShareProperty`, `TransferClusterProperties` false); any other kind → `0x8000FFFF`. Each sub-task is
  added to the undo list when undo is on; each returned object is appended to `Value`.
- In "all" mode, after the transfers: for each material entry of the material category, one
  **`SIRebindByNameUserData`** sub-task (material, source user-data list, target user-data list) is run (recorded
  for undo).
- Return `S_OK` with `Value`.
- Missing: the classification helper and the material / user-data list construction (`0x180048670`,
  `0x1800489e0`).

### `AddShotClip`: SPEC-PARTIAL

**Wire contract:** create a camera shot clip (class `bddf3311-…`) on a shot track of the Camera Sequencer; returns it
in `Clip`.
- Args: `Track` (object), `Name` (default ""), `Parent` (default ""), `Frame` (number, **required**), `StartFrame`,
  `EndFrame` (default 100), output `Clip`.
- UnPackArg: `Track` is not used directly: among the objects under it the one of shot-track class `79f6f946-…` is
  taken (none → no track, see below). `Frame`, `StartFrame`, `EndFrame` are read in frames and stored in seconds.
  `Frame` missing → stays "unset" and the command fails (worker check). When a track was found, the free slot is
  computed with `GetInsertedClipBounds(track, start = Frame + 1 frame, length = (EndFrame − StartFrame) − 1 frame)`;
  success → `Frame` becomes (returned start − 1 frame), i.e. the clip is moved to the first free position at or
  after `Frame` that fits a length of `EndFrame − StartFrame`; failure → error message `XSIACTIONCORE` 0x18
  (severity 2) and the command fails.
- Worker order: (1) `Frame` unset → fail; `EndFrame` given and < `StartFrame` → fail. (2) Track given: lock check
  (level 1), locked → lock error. (3) `Parent` is resolved by helper `0x1800407c0` to a name; failure → message
  `XSIACTIONCORE` 0x27 (severity 2), fail. (4) With locks suspended: no track → the scene model's mixer container
  (sub-task `6d89e10a-…`), an existing shot track in it (helper `0x180040530`), else a new one with **`AddTrack`**
  (sub-tasks recorded for undo); with a track → its container; container locked (any lock but ref-model) → lock
  error. (5) Create the shot clip; name = `Name`, or **"Shot"** when empty; the clip parameter id 9 is set to the
  resolved `Parent` name (the clip's camera reference, `(inferred)`). (6) Time control: start = `Frame`; clip-in =
  `StartFrame` and clip-out = `EndFrame` when given; scale 1. (7) If the track already has clips and the new clip
  would overlap the next one, the clip is added and then cut with **`CutClip`** (`Mode` 3 = `siTrimAfter`, `Time` =
  the free end, in frames), and a verbose message 0x69 (severity 8: new end, old end, name) is logged `(inferred
  reading of the time values)`; otherwise the clip is added to the track. (8) With undo: `Name`, `Parent` and soft
  references to the track, container and clip are kept.
- Return: the clip in `Clip`.
- Missing: helpers `0x1800407c0` (Parent resolution: what a non-camera / empty `Parent` gives), `0x180040530`; whether
  clip-in / clip-out are inclusive (the overlap test uses a length of `EndFrame − StartFrame`, not `+1`).

### `GetShotClip`: SPEC-PARTIAL

**Wire contract:** query the Camera Sequencer for the shot clip at a sequence frame; not a scene change.
- Args: `Frame` (default 0, sequence frame), `GlobalFrame` (in/out, default −1), outputs `Clip`, `DirectlyOver`,
  `ActiveCamera`.
- Do: gets the sequencer service (`b51855f2-…`); converts `Frame` to seconds and asks the service for the clip at
  that time (returns the clip and a "directly over" flag). `GlobalFrame` is **not an input frame**: when it is −1 (the
  default) no global time is computed; when it is anything else, the service also returns the matching scene
  (global) time and `GlobalFrame` is overwritten with it in frames. The `ActiveCamera` output is the clip's camera
  (the clip queried for its camera interface `0x180091690`, `(inferred)` from the argument name).
- RePack: `Clip` set when a clip was found; `DirectlyOver` always set; `GlobalFrame` set when ≠ −1; `ActiveCamera` set
  when non-null.
- Missing: which clip the service returns between clips / before the first clip (decided in the service's DLL, not
  actioncore.dll). Open.

### `PaintWeights`: SPEC-PARTIAL

**Wire contract:** set per-point weights on an object's envelope / weight-paint data, undoable.
- Args: `InputObj` (required object), `Indices` (int or array of ints, required), `Weights` (array of doubles,
  required), `Flags` (int, default 0), `Deformer` (int, default 0), `Normalize` (bool, default true), output
  `OutputObj`.
- UnPackArg: on `InputObj`'s first primitive it looks for two sub-objects: class
  `052f8861-9d51-11d4-b918-0800690c8bd0` (weight-paint data, `(inferred)`) and class
  `a3fe3cf0-14c2-11d1-805a-00a0248f9397` (the envelope, `(inferred)`; also keeps its deformer list `(inferred)`).
  Neither found → `0x80070057`. Missing `Indices` or `Weights` → `0x80070057`. A missing `Deformer` value means
  **−1 = all deformers**. Count rule: `Deformer` ≥ 0 → number of weights must equal number of indices;
  `Deformer` = −1 → number of weights must be a multiple of the number of indices (one weight per deformer per point);
  otherwise `0x80070057`. A scalar (non-array) `Weights` stores no values (then fails as empty, see below).
- Worker order: `InputObj`'s envelope locked (any lock but ref-model) → lock error, `0x80070005`. With undo the
  arrays, `Flags`, `Deformer`, `Normalize` and the envelope reference are stored for redo. If no weight-paint data
  exists: no envelope → `0x80070057`; else it is created on the envelope (helper `0x18001d0a0`, `(inferred)`).
  Empty `Indices` or `Weights` → `0x8000FFFF`. With undo the old weights of those points are saved, then the weights
  are written with (`Deformer`, indices, weights, `Flags`, `Normalize`); the envelope is then marked for update
  (slot call with 1, `(inferred)`). Any failure undoes the sub-tasks already run.
- Missing: the meaning of `Flags` bits, the normalisation rule and the `OutputObj` value (inside the weight-paint
  object, not read).

## 4. Not reached (time budget)

- `CreateEnvironmentCache` (`3d2a7149-320c-49a4-9625-8d61bda0c60c`): environments.dll / simulationop.dll not opened.
- `SITransferShapeAnimation` (`3b019512-…`): not in optasks (section 2); action.dll not opened (next candidate).

## Corrections for the wire agent

1. `operatorsScripts.ts` (DuplicateUsingGeomApprox) delegates `TransferAllPropertiesAcrossGenOp` with
   `{ Operator, Target, PropertiesToTransfer, Delete }`: the real arguments are `Operator`, `Object`,
   `PropertyTransferType` (""), `ShareProperty` (true), `IncludeAllClusters` (false); output `Value`. The script line
   `TransferAllPropertiesAcrossGenOp <op>, <new object>, , True` maps to `PropertyTransferType` "" (all) and
   `ShareProperty` true.
2. `TransferAllPropertiesAcrossGenOp` is a composition of `SIBasicTransferClustersAcrossGenOp` /
   `TransferClusterPropertiesAcrossGenOp` / `TransferPropertiesAcrossGenOp` per item, plus `SIRebindByNameUserData`
   per material in "all" mode; the stand-in that copies the material and object properties should call those
   sub-commands (cluster properties included), not copy directly.
3. `AddShotClip` (`inferredB10CamSeq.ts`): `Frame` is required (missing → failure, not "after the last clip"); the
   clip is moved to the first free slot at or after `Frame` (`GetInsertedClipBounds`), and an overlap with the next
   clip is trimmed with `CutClip` Mode 3 (`siTrimAfter`).
4. `AddShotClip`: default name is "Shot" (correct), but no unique-name loop was seen in the binary (the name is set as
   given; uniqueness, if any, is the scene's naming rule, `(inferred)`).
5. `AddShotClip`: the occupied sequence length used by the overlap test is `EndFrame − StartFrame`, not
   `EndFrame − StartFrame + 1`; keep the `+1` only if a golden shows it.
6. `AddShotClip`: `Track` names / contains a shot track; with no track the command finds or creates (`AddTrack`) the
   shot track under the scene model's mixer; a missing `Track` does not mean "Shot_Track" by name.
7. `AddShotClip`: `EndFrame < StartFrame` fails (correct); also fail when `Parent` cannot be resolved (message 0x27).
8. `GetShotClip`: `GlobalFrame` is an output flag, not an alternative input: always query at `Frame`; when the
   incoming `GlobalFrame` ≠ −1, return the scene frame of `Frame` in `GlobalFrame`. The "previous clip between clips"
   rule remains unverified.
9. `PaintWeights` (`inferredB15.ts`): `Deformer` −1 (or no value) means all deformers with `Weights` laid out
   per point × deformer (count must be a multiple of the index count); for `Deformer` ≥ 0 the counts must be equal,
   otherwise error `0x80070057` (the wire pads with the last weight instead).
10. `PaintWeights`: empty `Indices` / `Weights` → error (`0x8000FFFF`), not a no-op; a locked envelope → access
    denied.
11. `PaintWeights` targets the envelope / weight-paint data of `InputObj`'s primitive; a plain weight-map property
    as `InputObj` is not what the binary looks for (it reads sub-objects of the object's primitive).

## Open questions

1. `SIRebindByNameUserData` name-matching rule (shadertasks.dll, unchanged).
2. `GetShotClip` between clips / outside all clips (sequencer service `b51855f2-…`, DLL unknown).
3. `F3DGetGlobalFrameSetFromSequencerRange`: exporting DLL (not actioncore.dll).
4. `PaintWeights` `Flags` values and the `Normalize` rule.
5. `AddShotClip` `Parent` resolution and clip-in / clip-out inclusivity.
6. `CreateEnvironmentCache`, `SITransferShapeAnimation`: not read this run.
