# CMD-B8c: Animation copy / paste, key clipboard, key selection, rotation conversion, sequencing read from `fcurve.dll`

Row: **CMD-B8c**. Status: **SPEC** (17 names), **SPEC-PARTIAL** (0 names); per command below.
Batch 9 (2026-11-17): `CopyAnimContainer` and `Sequence` / `SISequence` / `ScaleAndOffset` closed after reading `0x180011090`, `0x180010500`, `0x180010e70`, `0x180010ad0`, `0x1800109c0`, `0x1800405b0`, `0x18003fe20`, `0x18003faa0`, `0x1800421b0`, `0x180042d20`, `0x180043030`, `0x180042670`, `0x180043390`.
Run: 2026-11-17, `si-analyst`, unattended, batch 8 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLLs).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\fcurve.dll` (sha256 `70778c1a…`, image base `0x180000000`).
Marks: (R) registry, (B) read in Ghidra, (L) local static read of the same DLL
(vtables, GUID bytes, strings, import thunks, instruction listing where Ghidra
dropped blocks), *(inferred)* = not read directly. No decompiler output or
disassembly is reproduced.

## 1. Handler table

| Command(s) | Handler CLSID | Creation function | Task vtable | Do / worker | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|
| `CopyAnimContainer` | `{0e765af2-7b31-11d3-b4a2-00a02485cecb}` | `0x180049d80` | `0x18005c5c0` | Do `0x180011530` / worker `0x1800113f0` (private iface vtable `0x18005c680` slot 9) | `0x180011660` | base |
| `CopyAllAnimation`, `CopyAnimation` | `{77f8d68e-8f15-11d4-be8e-00a0c982ddd4}` | `0x180049d40` | `0x18005d0a0` | Do `0x180013a40` / worker `0x180012ed0` | `0x1800144e0` | base |
| `PasteAllAnimation`, `PasteAnimation` | `{77f8d68f-8f15-11d4-be8e-00a0c982ddd4}` | `0x18004a480` | `0x18005d1d0` | Do `0x180013a70` / worker `0x1800138d0` -> per target `0x180013da0` -> per parameter `0x180012570`; Undo `0x180013d60`, Redo `0x180013a90` | `0x180014630` | base |
| `CopyKeys` | `{cc482f24-4e8a-11d4-b270-00a0c9a8ad15}` | `0x18004a240` | `0x180064880` | Do `0x180025a00` / per parameter `0x180023b30` (private vtable `0x180064940` slot 10) | `0x180028b30` | base |
| `CutKeys`, `DeleteKeys` | `{cc482f25-4e8a-11d4-b270-00a0c9a8ad15}` | `0x18004a280` | `0x1800649a0` | Do `0x180025bb0` / per parameter `0x1800246b0` (private vtable `0x180064a60` slot 9), per fcurve `0x180023230` (slot 10); Undo `0x180026ac0`, Redo `0x1800264d0` | `0x180028c50` | base |
| `PasteKeys` | `{cc482f26-4e8a-11d4-b270-00a0c9a8ad15}` | `0x18004a2c0` | `0x180064ac0` | Do `0x180025da0` / per parameter `0x180025350` (private vtable `0x180064b80` slot 9) -> per target `0x180027290` -> key insertion `0x1800270c0` / `0x180021ed0` / `0x180021950`; Undo `0x180026e30`, Redo `0x180026810` | `0x180028da0` | `0x180027ab0` |
| `SelectKeysInTimespan`, `DeselectAllKeys` | `{1ca27ec8-31a3-4487-9d28-98c689ac500d}` | `0x18004a300` | `0x1800668e0` | Do `0x18002dd80` / private vtable `0x1800669a0`: slot 9 deselect-all `0x18002d9f0`, slot 10 add `0x18002ecc0`, slot 11 remove `0x18002dce0`, slot 12 toggle `0x18002ed60`, common `0x18002e5a0`; Undo `0x18002e1c0`, Redo `0x18002e0d0` | `0x18002ee00` | base |
| `ConvertEulerToQuat` | `{a12faa27-9db9-402d-bd47-6bf3f1a44e98}` | `0x180049c80` | `0x18005a0a0` (task part at object+0x18; the locator's first pick `0x18005a050` is the COM-object vtable) | Do `0x18000d790` / per object `0x18000c3f0`, port hookup `0x18000c140`; Undo `0x18003e150` (per object `0x18003e3a0`); Redo `0x1800374f0` (re-enters Do) | `0x18000d9c0` | none (`0x1800381c0`) |
| `ConvertQuatToEuler` | `{a2fd91a0-c55e-4b68-ba16-d1aa1ab9da15}` | `0x18004a600` | `0x18006b7f0` | Do `0x18003df60` / per object `0x18003cb40`; Undo `0x18003e150`; Redo `0x1800374f0` | `0x18000d9c0` | none |
| `MakeRotationsContinuous` | `{b862933c-f2ae-4c9e-98d3-2b3d705b40d9}` | `0x18004a400` | `0x180068b20` | Do `0x1800373c0` / list walk `0x180036c20` -> per object `0x180036d50` -> per rotation triple `0x180037520` (undo restore `0x1800381d0`); Undo `0x180037500`; Redo `0x1800374f0` | `0x18000d9c0` | none |
| `Sequence` (registry index with handler `63b4d611`), `SISequence`, `ScaleAndOffset` | `{63b4d611-38cd-11d4-8bdb-009027bc381b}` | `0x18004a680` | `0x18006ca20` (task part at object+0x18) | Do `0x180041da0` / private vtable `0x18006ca90`: slot 10 list worker `0x1800405b0`, slot 9 per parameter `0x18003fb10`, per fcurve `0x18003fe20`; Undo `0x180041f30`, Redo `0x180041e60` | `0x1800439f0` | base |

Note (R): the registry holds three further entries whose scripting name is also
`Sequence` (command GUIDs `8ed0c4cc/cd/ce-b5c9-11d4-be07-00a0c961747d`, handler
`{5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9}`). That CLSID is **not** served by
`fcurve.dll` (absent from the locator output) and is not covered here.

## 2. Shared facts

- Object list interface `{f49f6470-4211-11d0-8463-00a024c7919c}`, list class
  `{f49f6471-…}`; element reference `{872903d0-3ef3-11d0-8463-00a024c7919c}`
  (class `{107dcd80-4228-11d0-8463-00a024c7919c}`); component hierarchy
  `{4aeaeaea-1a43-11d2-8d66-00a0c982a649}`. An element reference resolves to
  *(owner hierarchy, component descriptor)* through its slot 64 (B).
- Animation source of a parameter is fetched from the owner with
  "get connected source (component, interface id)". Interface ids used:
  `{c1afbd50-debf-11cf-8290-00a0243f1013}` (animation source / fcurve object,
  used by the copy-animation and rotation commands),
  `{481262ff-7ddb-11d0-a57f-00a0c91412de}` (second source kind tried by
  `CopyAnimation` when the first yields nothing; expression *(inferred)*),
  `{01dfa2a0-6962-11ce-b8ac-00aa005c18ec}` (fcurve interface used by the key
  commands and `Sequence`).
- **Animation clipboard** (`CopyAnimation` / `PasteAnimation`): a process-wide
  generic object `{8689f1d1-71a5-11d1-b6fd-00aa003b3ea6}`, interface
  `{cdef26c6-8fb8-11d4-be8e-00a0c982ddd4}` (slot 4 = clear, slot 3 = get the
  record list). Each record = *(parameter path relative to the copied object,
  parameter leaf name, duplicated source object, layer index)*.
- **Key clipboard** (`CopyKeys` / `CutKeys` / `PasteKeys`): a lazily created
  process singleton (global `0x18008f820`, an app-notify sink, 0x50 bytes) with
  two record lists (+0x30 and +0x40). The key commands always set their
  "use list +0x30" flag, so they share one buffer. Each record = *(soft
  reference to the source parameter, parameter name, list of key records,
  start frame, end frame, key type)*.
- `Type` (the parameter-scope argument of the key commands) is read as a long:
  `3` = ignore `InputObjs` and operate on **every fcurve of the scene**
  (`F3DCollectAllFCurvesFromActiveDB` with the task as callback); `2` = expand
  each input into its animated parameters (only `CutKeys`/`DeleteKeys`,
  `SelectKeysInTimespan` and `Sequence` do this expansion on the paths read);
  anything else = use `InputObjs` as given. `UnPackArg` pre-loads `1` before
  reading. Symbol mapping `siInputParams`=1, `siAnimatedParameters`=2, "all"=3
  is *(inferred)* from the registry defaults.
- `CompensateForClip` (key commands): when true the frame range is converted
  to seconds, passed through local helper `0x18000e1e0(owner, 2, range)` (maps
  the range through the owning clip's time control *(inferred)*) and converted
  back before use.
- Lock check used by the key commands and `Sequence`: `CSILockStatus` on the
  parameter; "locked at level 2 and not reference-model locked" makes the
  command call `CSILockStatus::RaiseError`. `CutKeys` then returns
  `0x80070005`, `PasteKeys` skips the target with status `1`, `Sequence` drops
  the parameter from its list.
- Time conversion uses `SIFramesToSeconds` / `SISecondsToFrames`.
- Message catalogue for these tasks is `XSIFCURVE` (ids `0x24`, `0x3a`), plus
  message id `0x3eb` (invalid argument, argument name as insert).

---

### `CopyAnimContainer`: SPEC

**Wire contract** (collection and apply routines read 2026-11-17, batch 9)

- Purpose (R): copy the animation of one container onto another container,
  matching parameters by name.
- Arguments: `InputObj` (in, object; handler `55f36231…`), `Target` (in,
  object list). No return value.
- UnPackArg (B): `InputObj` is fetched as a bare object. If it is already an
  object list it is used directly; otherwise it must be an element reference
  or a component hierarchy, which is wrapped in a fresh one-item list (a
  hierarchy is first wrapped in a new element reference). Neither ->
  `0x80070057`. `Target` is fetched as an object list.
- Do (B) forwards *(InputObj list, Target list, firstExecution)* to the worker:
  1. fails with `0x8000ffff` if the task already holds working data;
  2. computes a "multiple" flag = InputObj count >= 2, or Target count >= 2;
  3. collects the source animation (`0x180011090`);
  4. if anything was collected, applies it to the targets (`0x180010500`).
- Name key of a parameter (B, `0x180010e70`), used on both sides: the names
  (property `{fe15f21c-48c0-11d2-8d73-00a0c982a649}`, string) of the parameter
  and of each of its parents are joined with `.`, **leaf first**, walking up
  to but not including the container item itself; when the "multiple" flag is
  set the container's own name is appended as the last segment. The result is
  converted to upper case, so matching is case-insensitive. Example: parameter
  `posx` in `pos` in `local` under the container gives `POSX.POS.LOCAL`.
- Collection (B), for each item of the `InputObj` list: its direct children
  are walked in order. For a child that has a connected source (first kind
  `{c1afbd50-…}` fcurve-type source, else `{481262ff-…}`, expression
  *(inferred)*) the name key is built and *(key -> source)* is stored in the
  task's map; an existing key is kept (first one wins). A child without a
  source (or with an empty key) that has children of its own is descended
  into recursively, the key root staying the original container item.
- Apply (B), for each item of the `Target` list: its children are walked the
  same way. A child whose capability flags lack bit 0 (not an animatable
  parameter) is descended into when it has children. For each animatable
  parameter the name key is built and looked up:
  - **found**: the stored source is duplicated with the low-level duplicate
    task `{747d257f-d01b-11d2-80c4-00a0c9ac19a9}` and the duplicate is
    connected to the target parameter with the nested `ConnectSource` task
    `{ec7663e9-2f0b-11d3-bffd-00a0248f9397}` (which first removes whatever
    animated the target, see cmd-b8b); the `ConnectSource` task is attached as
    a sub-task on first execution;
  - **not found**: the nested `RemoveAnimation` task
    `{5ad1fd7e-5d5d-11d2-8082-00a0c955b335}` is run on that single parameter
    (second argument 0, as `ConnectSource` passes it: the current time
    *(inferred)*; source mask 4 = any) and attached as a sub-task. So
    after the command every animatable parameter of the target carries
    exactly the animation of the same-named source parameter, or none.
- Sources are copied, not shared: each target gets its own duplicate. Only
  directly connected sources are copied; animation-layer and mixer content is
  not looked at by this command.
- Undo / Redo (B): `C3DCoreBaseTask::UndoTasks` / `RedoTasks` only, so every
  change is made by nested tasks.
- Errors: null list `0x80004003`; a failing nested task or tree-walk call
  aborts the walk with its status.

### `CopyAllAnimation` / `CopyAnimation`: SPEC

**Wire contract**

- Purpose: put a copy of the animation sources found under one object /
  parameter set into the animation clipboard.
- Arguments (R, names confirmed in UnPackArg): `InputObjs` (in, list),
  `UseFCurves` (bool, true), `UseExpressions` (bool, true), `RemoveAnimation`
  (bool, false), `BaseAnimation` (bool, true), `LayerAnimation` (bool, true).
  No return value.
- Difference between the two names: none in the class (no command-GUID test).
  Only the registry differs: `CopyAllAnimation` resolves `InputObjs` with the
  generic object handler (`7834cb8c…`), `CopyAnimation` with the
  marked/animatable-parameter handler (`fa0b5d32…`).
- UnPackArg (B): takes **only the first item** of `InputObjs` (returns `1`,
  nothing to do, when the list is empty); null context -> `0x80070057`.
- Worker (B + L; Ghidra dropped the record-building blocks, they were read
  from the local listing):
  1. full name of the input is taken; its owner / component are resolved;
  2. source-kind mask: `0xA` when `UseFCurves`, OR `0xC` when
     `UseExpressions` (both -> `0xE`, neither -> `0`);
  3. `motionhelp!F3DGetAllAnimationComponents(owner, component, mask, false,
     true, false, null, list)` returns the animated parameters beneath it;
  4. the clipboard is **cleared once**, just before the first found parameter
     is processed (so a copy that finds nothing leaves the clipboard intact);
  5. per parameter: its full name with the input's prefix (and the separating
     dot) removed gives the relative path; the leaf name is what remains after
     stripping every leading `name.` segment that resolves to an object having
     an ancestor of kind `{6b579d20-3dc5-11d0-9449-00aa006d3165}`;
  6. if `BaseAnimation` and the parameter has a source (first kind
     `c1afbd50…`, else `481262ff…`): the source is duplicated with the
     duplicate task `{747d257f-d01b-11d2-80c4-00a0c9ac19a9}`, the duplicate is
     parked in the transient-object container
     (`ut!F3DAddObjectToTransientObjectContainer`), flagged, and a record with
     **layer index 0** is appended to the clipboard;
  7. if `LayerAnimation`: every animation layer of the parameter
     (`C3DComponentLayerEnum`) is visited and, where the layer holds a source
     of kind `c1afbd50…`, the same duplication is done and a record with that
     layer's index is appended.
- `RemoveAnimation` is read into the task and passed to the worker, but the
  worker never uses it (L): the source animation is not removed.
- Undo / Redo: both slots are the shared "return 0" stub; the command is not
  undoable.
- Status: `1` is returned after a normal walk (success class).

### `PasteAllAnimation` / `PasteAnimation`: SPEC

**Wire contract**

- Purpose: apply the animation clipboard to the given objects / parameters.
- Arguments (R): `InputObjs` (in, list), `UsePosition` (bool; default false
  for `PasteAllAnimation`, **true** for `PasteAnimation`). No return value.
  There is no paste-mode, ripple or offset argument on these two commands.
- Difference between the two names: registry only (argument handler
  `7834cb8c…` vs `fa0b5d32…`, and the `UsePosition` default).
- Do (B): for **each** item of `InputObjs` the per-target routine runs against
  the clipboard record list:
  1. the target's full name is taken; whether the target has an ancestor of
     kind `{6b579d20-…}` decides which record string is used: with such an
     ancestor the **relative path**, without it the **leaf name**;
  2. for every clipboard record: if that string is empty the target itself is
     used, provided its capability flags mark it as an animatable parameter;
     otherwise `"<target full name>.<string>"` is resolved. On success the
     per-parameter paste runs;
  3. if **nothing** was pasted by name and `UsePosition` is true, a positional
     paste is done: `F3DGetAllAnimationComponents(target, mask 1, …)` lists
     the target's parameters and clipboard records are dealt onto them in
     order; consecutive records with the same path, same leaf name and a
     strictly increasing layer index stay on the same target parameter;
  4. the pending layer batch (below) is committed.
- Per-parameter paste (B), *(target parameter, clipboard source, layer index)*:
  the clipboard source is duplicated again (so the clipboard can be pasted
  repeatedly), then
  - **layer 0**: the nested `ConnectSource` task
    `{ec7663e9-2f0b-11d3-bffd-00a0248f9397}` connects the duplicate to the
    target parameter; both nested tasks are added as sub-tasks on first
    execution;
  - **layer N > 0**: while the owner has no more than N keying layers
    (`F3DGetNbKeyingLayers`), the nested `AddAnimationLayer` task
    `{18b7bbf8-9f0d-4690-b04f-23876a305985}` is run; the layer clip is fetched
    (`F3DGetKeyingLayerClip`), the parameter's name relative to its model is
    computed (`F3DDereferenceProxyParameter`,
    `F3DActionGetStrippedParameterName`), the existing item of that name is
    removed from the layer and the duplicate is added under that name through
    a batch object `{42eb14da-bcab-4e24-bee6-b8a0bb496c3a}`; a *(layer clip
    reference, name, source)* record is kept for redo. If the layer is locked
    (`F3DIsKeyingLayerLocked`) a warning (severity 4, `XSIFCURVE` id `0x3a`,
    inserts: layer path, parameter path) is logged.
- Undo (B): the layer batch object is rolled back and released, then
  `UndoTasks`. Redo (B): `RedoTasks`, then the recorded layer edits are
  replayed (remove by name, re-add a fresh duplicate) and committed.
- Errors: null list `0x80004003`; null context `0x80070057`; batch object
  creation failure `0x8007000e`.

### `CopyKeys`: SPEC

**Wire contract**

- Arguments (R, confirmed): `InputObjs` (in), `StartFrame` (double, 1.0),
  `EndFrame` (double, 100.0), `Reset` (bool, true), `SelectedKeysOnly` (bool,
  false), `Type` (default `siInputParams`), `CompensateForClip` (bool, false).
  `InputObjs` is not fetched when `Type` is 3. No return value.
- Do (B): if `Reset` and the key clipboard exists, the clipboard list is
  emptied first. `Type` 3 -> all scene fcurves; otherwise one worker call per
  input parameter.
- Per parameter (B): optional clip compensation of the range; the fcurve is
  fetched (`01dfa2a0…`); a soft reference to the parameter is created
  (`F3DCreateObjectReferenceEx`); the keys inside *[StartFrame, EndFrame]*
  (only selected ones when `SelectedKeysOnly`) are gathered by `0x180028560`
  into a record carrying the range and key type; the record is appended to
  the key clipboard (the singleton is created and registered with
  `CSIAppNotifySink::Advise(1)` on first use). The fcurve is not modified.
- For fcurves whose key kind is `0x28` a per-task set of already visited
  curve objects prevents the same underlying curve being recorded twice.
- Undo / Redo: stub (returns 1); not undoable.

### `CutKeys` / `DeleteKeys`: SPEC

**Wire contract**

- Arguments (R, confirmed): `InputObjs`, `StartFrame` (1.0), `EndFrame`
  (100.0), `Reset`, `Ripple`, `SelectedKeysOnly` (false), `Type`,
  `PutKeysInBuffer`, `CompensateForClip` (false). No return value.
- Difference between the two names: none in code. The registry defaults carry
  it: `CutKeys` = `Reset` true, `Ripple` true, `PutKeysInBuffer` true;
  `DeleteKeys` = `Reset` false, `Ripple` false, `PutKeysInBuffer` false.
- Do (B): if `Reset`, the key clipboard is emptied. `Type` 3 -> all scene
  fcurves; otherwise per input parameter (with `Type` 2 each input is first
  expanded to its animated parameters).
- Per parameter / fcurve (B), in order: lock check (`0x80070005` on a locked
  parameter); keys in the range are gathered (as `CopyKeys`); a soft reference
  is recorded for undo; the gathered keys are removed from the fcurve
  (`0x180027d50`); when `Ripple`, the keys after the range are shifted earlier
  by the removed span, i.e. by `StartFrame - EndFrame - 1` frames
  (`0x180023670`: fcurve scale-and-offset with scale 1 from `EndFrame`
  onward); when `PutKeysInBuffer`, the removed keys are appended to the key
  clipboard; finally the fcurve's end-of-edit notification is sent.
- Undo `0x180026ac0` / Redo `0x1800264d0` exist and work from the recorded
  per-fcurve data *(inferred: not read)*.
- Errors: null owner `0x80004003`; "nothing in range" from the gatherer is
  tolerated (`0x80004005` with an empty result is skipped).

### `PasteKeys`: SPEC

**Wire contract**

- Arguments (R, confirmed): `InputObjs`, `StartFrame` (double, 1.0),
  `EndFrame` (double, 100.0), `Ripple` (bool, true), `Merge` (bool, true),
  `Type`, `CompensateForClip` (bool, false), `Offset` (**output**, double),
  `Relative` (bool, false), `LeftContinuity` (long, 0), `RightContinuity`
  (long, 0).
- UnPackArg (B): if `EndFrame < StartFrame`, or `EndFrame` equals the smallest
  positive double, `EndFrame` is set to `StartFrame` and a "no explicit range"
  flag is raised. `Offset` is not read.
- Do (B): previous undo records are dropped; `Type` 3 -> all scene fcurves;
  otherwise one worker call per input parameter. Nothing happens (status 0)
  when the key clipboard is empty.
- Matching clipboard records to targets (B):
  - exactly **one** record in the clipboard -> it is pasted on every target;
  - several records -> each record whose original parameter can still be
    resolved is compared with each target (kind compatibility `0x180023770`,
    then parameter-name equality, names being computed on demand by
    `0x180023010`); only matching pairs are pasted.
- Per target (B), in order:
  1. lock check (locked -> error raised, target skipped, status 1);
  2. `Merge` false (replace) and target not yet cleared in this run: a nested
     `CutKeys`-class task (`{cc482f25-…}`) removes the existing keys with
     ripple off, selected-only off, put-in-buffer off, over
     *[StartFrame, EndFrame]*; when there is no explicit range and `Ripple` is
     off the cleared range is instead *[StartFrame + (first copied key -
     copied start), StartFrame + (last copied key - copied start)]*; it runs
     only when that range is non-empty;
  3. the target fcurve is fetched; if the parameter has none and is
     animatable, a new fcurve is created on it
     (`{ceb464fa-00f9-11cf-80f1-00aa006297e2}`); still none -> status 1;
  4. paste span = `EndFrame - StartFrame + 1` frames, or, when the two are
     equal, `copied end - copied start + 1`;
  5. `Ripple` true: existing keys from `StartFrame` on are pushed later by the
     paste span before insertion;
  6. insertion (`0x1800270c0`): with no explicit range, or a single-key record
     with a zero-length range, keys are inserted **unscaled**, time-shifted by
     `StartFrame - copied start` (`0x180021ed0`); otherwise they are
     **time-scaled to fit** the range (factor = requested span / copied span,
     about the centres of the two ranges, `0x180021950`);
  7. `Relative` true: every pasted key value is shifted by *(value of the
     existing curve at the first pasted key's time - first copied key's
     value)*;
  8. `LeftContinuity` acts on the first pasted key, `RightContinuity` on the
     last: `0` = keep the copied value; `1` = use the existing curve's value
     at that time; any other non-zero value = average of the copied value and
     the existing curve's value;
  9. pasted keys are marked selected; an undo record is stored; for a
     reference-model-locked target an extra nested task
     `{d8b3c0e0-49cf-4f6c-b008-3c24ee218e1b}` is recorded.
- RePackArg (B): `Offset` is set to the time offset applied, if it is the same
  (within 1e-6) for every pasted fcurve; otherwise `0`.
- Undo `0x180026e30` / Redo `0x180026810` present (not read).
- Errors: null context `0x80004003`; fcurve creation failure `0x80004005`.

### `SelectKeysInTimespan` / `DeselectAllKeys`: SPEC

**Wire contract**

- `SelectKeysInTimespan` arguments (R, confirmed): `InputObjs`, `Mode`
  (`siFCurveKeySelectionMode`, default `siSetKeySelection`), `StartFrame`
  (variant, default empty), `EndFrame` (variant, default empty), `Type`,
  `CompensateForClip` (false). `DeselectAllKeys` has no arguments.
- How the class tells them apart (B): UnPackArg asks the exec context for the
  command GUID; `{04c0a00e-61a3-44a1-920b-9195f2df993e}` (`DeselectAllKeys`)
  selects internal operation 1 and reads nothing else.
- `Mode` values (B): `1` = set (deselect everything, then select), `2` = add
  to the selection, `3` = remove from the selection, `4` = toggle. Any other
  value raises `0x80070057` (severity 2, message `0x3eb`, insert `Mode`).
  Names for 2..4 are *(inferred)* from the operations.
- `StartFrame` / `EndFrame`: an **empty** variant for either means "whole
  curve" (all keys); a non-numeric variant raises `0x80070057` (`0x3eb`,
  insert = argument name). Values are converted to seconds.
- Do (B): `Type` 3 -> the working list is filled with every scene fcurve;
  `Type` 2 -> each input is replaced by its animated parameters
  (`SIIsAnimated`). Then by operation:
  - deselect all: every fcurve in the key-selection cache
    (`SIGetFCurveKeySelectionCache`) has the selected flag of each selected
    key cleared and its "has selected keys" state reset; the cache is cleared;
    on first execution the previously selected key indices are saved per
    fcurve as bit vectors for undo;
  - set: a nested task of the same class performs "deselect all" (added as a
    sub-task on first execution), then "add" runs;
  - add / remove / toggle: for each parameter of the list its fcurve is
    resolved, the range optionally clip-compensated, the first and last key
    indices inside the range found, and the selected flag of each key in that
    index range set / cleared / inverted; the fcurve is added to or dropped
    from the key-selection cache accordingly; the range and a soft reference
    to the list are stored for undo.
  - In every case the notification `GK_KEYSELECTION_CHANGED` is broadcast at
    the end of Do.
- Undo `0x18002e1c0` / Redo `0x18002e0d0` present (restore from the saved bit
  vectors *(inferred)*).

### `ConvertEulerToQuat`: SPEC

**Wire contract**

- Argument: `InputObjs` (in, object list). No return value. Each list item
  yields a 3D object and a "branch" flag; when the flag is 1 the object's
  children are processed recursively.
- Per object (B): the local kinematics property
  (`{783879e2-5300-11d2-8b57-00a024ee586f}`) is fetched and three rotation
  parameters are located, in this order: Euler **X, Y, Z** = component ids
  `0x10`, `0x11`, `0x12` of the kinematic state selected with index 2. If none
  of the three carries an animation source, the alternative triple with ids
  `0x0b`, `0x0c`, `0x0d` of the state selected with index 1 is used instead.
  (For objects exposing a custom transform interface
  `{092fa96b-2a4d-41ea-9518-946eb18c3cfb}` the three ids are taken from that
  interface's entries 3, 4, 5.)
- What happens to the fcurves, in order (B):
  1. the union of the key times of the X, Y and Z fcurves is built (a time is
     added once), then sorted;
  2. one **quaternion fcurve object** is created
     (`{395e5259-183f-4ddb-82c5-472e42282a98}`);
  3. with no key at all, the three current parameter values (degrees ->
     radians) are stored as the quaternion curve's constant value; otherwise,
     for every key time, each Euler curve that has a key at that time supplies
     its value (the others keep the last value used), the triple is converted
     to radians and added as one quaternion key (tolerance 1e-6);
  4. the animation on the three Euler parameters is removed with the nested
     `RemoveAnimation` task `{5ad1fd7e-5d5d-11d2-8082-00a0c955b335}`;
  5. the single quaternion fcurve is connected to X, Y and Z through its
     outputs **0, 1 and 2** respectively: for each parameter an intermediate
     port object `{3a9e3aff-9773-493c-a375-840456d73477}` is created and wired
     both ways (`F3DBiDirConnectPorts`); a parameter that already has a source
     makes this step fail with `0x80004005`.
  So after the command the three Euler rotation parameters share one
  quaternion-interpolated source; no separate quaternion parameters are
  created.
- If no object could be converted: error `0x80004005`, severity 2, text
  `XSIFCURVE` id `0x24`.
- Undo (B): for every input object (and children when branch) the animation
  now on the three rotation parameters is removed, then the saved nested tasks
  are undone in reverse order (restoring the original Euler fcurves). Redo
  re-runs Do.

### `ConvertQuatToEuler`: SPEC

**Wire contract**

- Argument: `InputObjs`; traversal and parameter lookup identical to
  `ConvertEulerToQuat`.
- What happens to the fcurves, in order (B):
  1. for each of the three rotation parameters (X, Y, Z) the keys of its
     current (quaternion-driven) source are walked and a list of *(time,
     value)* pairs is recorded per axis, the value being that axis' output at
     the key time;
  2. the animation is removed from the three parameters (`RemoveAnimation`
     task as above);
  3. for each axis a new standard fcurve is created on the parameter (task
     virtual slot 9) and filled: with no recorded pair the current value is
     set as a constant, otherwise one key per recorded pair. The axes are
     written in the code order Y, Z, X.
- Failure message, Undo and Redo: as `ConvertEulerToQuat`.

### `MakeRotationsContinuous`: SPEC

**Wire contract**

- Argument: `InputObjs`; same traversal (branch flag -> children).
- Per object (B): the Euler rotation parameters X, Y, Z (ids `0x10`, `0x11`,
  `0x12`) and the rotation-order parameter (id `0x2e`; values 0..5, anything
  else treated as 0) of the local kinematics are read; the alternative triple
  (`0x0b`, `0x0c`, `0x0d`, rotation order 0) is processed as well. A triple
  with no fcurve on any axis is skipped.
- Per triple (B): the union of key times of the three fcurves is sorted. The
  first key time only seeds the running reference angles. For each following
  key time: the X/Y/Z values at that time (an axis without a key there keeps
  its previous value) are converted to radians, turned into a rotation matrix
  with the rotation order (`F3DEulerToMat`) and converted back with
  `F3DMatToEulerUsingTarget`, the target being the previous key's result, i.e.
  the equivalent Euler triple closest to the previous key. When any component
  changes by 1e-12 or more, the old *(time, x, y, z)* is saved for undo and
  each axis fcurve that has a key at that time gets the new value (radians ->
  degrees). The result becomes the next reference.
- If nothing was processed: error `0x80004005`, severity 2, `XSIFCURVE` id
  `0x24`.
- Undo (B): the saved key values are written back (`0x1800381d0`). Redo
  re-runs Do.

### `Sequence` / `SISequence` / `ScaleAndOffset`: SPEC

**Wire contract** (scene walk, per-fcurve routine and clip helpers read 2026-11-17, batch 9)

- Purpose (R): offset and scale fcurves (and, depending on `Mode`, action
  sources and mixer clips) about a pivot inside a frame range.
- Arguments read by UnPackArg (B), by name: `InputObjs`, `Scale` (double),
  `Ripple` (bool), `Discrete Time` (bool), `Type` (long), `Offset` (double,
  frames), `StartFrame`, `EndFrame`, `Pivot` (frames), `Mode` (long); then,
  with failures ignored, `SelectedKeysOnly` (bool) and `Layer` (long).
  Registry defaults: `Offset` 0, `Scale` 1, `StartFrame` 1, `EndFrame` 100,
  `Pivot` 1, `Ripple` true, `Discrete Time` false, `Mode`
  `siFCurvesAnimationSources`.
- Difference between the three names: none in the class. Registry only:
  `Sequence` / `SISequence` default `Type` = `siAllAnimParams` and do not
  declare `SelectedKeysOnly` / `Layer` (`Sequence` additionally declares
  `AllLayers`, default true, which this class **never reads**);
  `ScaleAndOffset` defaults `Type` = `siAnimatedParameters`, declares
  `SelectedKeysOnly` (false) and `Layer` (-1), and takes `InputObjs` through
  the generic object handler.
- Transform (B): a time *t* becomes `(t - Pivot) * Scale + Pivot + Offset`.
  Offset, range and pivot are held in seconds.
- Do (B): returns `1` (nothing to do) when `|Scale - 1| < 1e-6` and
  `|Offset| < 1e-6`; `0x80004005` when `|Scale| < 1e-6`. Then by `Type`:
  `1` = the input list as given; `2` = each input expanded to its animated
  parameters; `3` = scene-wide walk (below, `InputObjs` not used); other ->
  `0x80004005`. (`siMarkedParams`=1, `siAnimParams`=2, `siAllAnimParams`=3
  *(inferred)*.) `Mode` is used **only** with `Type` 3.
- `Type` 1 / 2, per list item (B): items that are not parameter references
  are ignored; the parameter must pass a filter (`0x18003f9e0`, not read;
  the fcurve-level twin `0x18003faa0` asks the curve object the same
  question, vtable offset `0x298`, that `ActivateFCurve` uses for its scene
  walk); then the per-parameter routine runs. A locked parameter
  (`0x80070005`) is removed from the working list.
- Per parameter (B): every animation layer of the parameter is visited
  (`C3DComponentLayerEnum`, base included); `Layer` < 0 = all layers,
  otherwise only the layer with that index. The fcurve is fetched, the range
  and pivot are clip-compensated, and the per-fcurve routine runs.
- `Type` 3, scene walk (B). `Mode` values as tested by the code:

  | `Mode` | Plain fcurves (not owned by an action source) | Fcurves inside action sources | Action sources and their clips | Clips moved as units | Mixer markers |
  |---|---|---|---|---|---|
  | 1 | yes | no | no | no | no |
  | 2 (`siFCurvesAnimationSources`, registry default) | yes | yes | yes | no | yes |
  | 3 | yes | no | no | yes | yes |
  | 4 | no | yes | yes | no | yes |
  | 5 | no | no | no | yes | yes |

  Names for 1, 3, 4, 5 were not read (fcurves only / fcurves and clips /
  animation sources only / clips only *(inferred from the behaviour)*).
  Order and detail:
  1. Modes 3 and 5, for every `Mixer Action Clip` of the scene (class
     `{12a3efc6-e543-11d2-b352-00105a1e6ce9}`), on its time control
     (`C3DTimeControl`): `scale` is divided by `|Scale|`; `startoffset`
     (frames) is transformed with the formula above (for a non-positive
     `Scale` the value transformed is `endtime`, and the result is stored as
     the new `startoffset`); `extrapbef_timehold` and `extrapaft_timehold`
     are multiplied by `|Scale|`. For a negative `Scale` `dowarp` is set to
     true and the clip's warp fcurve is reversed through its curve object
     (method at offset `0x1e8`, then helper `0x180043420`, not read).
  2. Two sets of fcurves are gathered: those owned by action sources (class
     `{12a3efc5-…}`, `C3DAction`) and those owned by mixer transitions (class
     `{d8d203a5-e13d-11d2-b34f-00105a1e6ce9}`). Transition fcurves are
     **never** transformed.
  3. Modes 1 to 4: every fcurve object of the scene (classes
     `{e2a86051-f669-11d1-8d60-080036f3cc02}` and
     `{3a9e3aff-9773-493c-a375-840456d73477}`) is visited and transformed
     with the per-fcurve routine according to the table; plain fcurves must
     additionally pass the `0x298` curve filter, action-source fcurves need
     not.
  4. Modes 2 and 4: for every action source, `AnimStart` and `AnimEnd`
     (`TimeStart` / `TimeEnd`) are transformed with the formula and stored
     smaller first (`0x180043030`); then for every `Mixer Action Clip` the
     time control gets (`0x180042670`): `startoffset` transformed (base value
     `endtime` for a non-positive `Scale`); `clipin` / `clipout` transformed
     and stored smaller / larger, `clipin` only when `cliptoparentstart` is
     false and `clipout` only when `cliptoparentend` is false; both hold
     times multiplied by `|Scale|`; a negative `Scale` again calls
     `0x180043420`.
  5. Modes 2 to 5: every `Mixer Marker` (class
     `{d8d203a9-e13d-11d2-b34f-00105a1e6ce9}`) has its start transformed and
     its duration multiplied by the scale (for a negative scale the start is
     moved back by the new duration) (`0x180042d20`; pivot handling there
     *(inferred to follow the same formula)*).
- Per fcurve (B, `0x18003fe20`), in order:
  1. lock / keying-layer-lock check (locked: `0x80070005`; status 1 = skip);
  2. raw curves of kind `0x28` are processed once per underlying curve
     object (per-task visited set);
  3. first execution: a copy of the curve is saved. Later passes (undo /
     redo): while saved copies remain, the next one is assigned back to the
     curve instead of recomputing, and the routine ends;
  4. range snapping: with the frame bounds of `StartFrame` and `EndFrame`
     (`DSGetAnimationTimeAndBounds`), the first key at or after the lower
     bound of the start frame and the last key at or before the upper bound
     of the end frame are located. If no key falls inside the range (and the
     key gather, which honours `SelectedKeysOnly`, finds nothing) the curve
     is left alone with status 0. Otherwise the start is moved onto that
     first key when the key lies inside the start frame before the given
     start (when the pivot coincides with a range end: whenever the key is
     inside that frame and not exactly at the start), and symmetrically the
     end onto the last key. A pivot that coincided (within 1e-7) with the
     start or the end follows the snapped value; a pivot within 1e-7 of the
     first or last key is set exactly onto it;
  5. anchor side: `2` when the pivot is nearer the range end than the range
     start, `4` otherwise. When the scale is not 1, a range end was snapped
     and the pivot sits on the anchored end, the scale is recomputed so that
     the far snapped end lands where the unsnapped far end would have landed;
  6. the curve's own scale-and-offset method (curve object, offset `0x1f0`)
     is called with *(start, end, pivot, scale, offset, ripple, pass flag,
     anchor side, selected-only)*. Ripple rules: `Ripple` is dropped when the
     anchor side is 2 and the scale is not 1. With `Ripple` on and a
     **negative** offset (or when the task's internal flag at offset `0xec`
     is set) the edit is split in two calls: first scale only (offset 0),
     then, on the scaled range `[(start - pivot) * scale + pivot,
     (end - pivot) * scale + pivot]` (ends ordered), offset only (scale 1,
     pivot 0, ripple off). In every other case one call does both. A zero
     answer from the method gives `0x80004005`;
  7. `Discrete Time` true: after the transform the fcurve (interface
     `31ca7790-…`) method at offset `0x190` is called with (0, 0): the keys
     are put back on whole frames *(inferred from the argument name)*; a
     failure aborts;
  8. the fcurve's end-of-edit notification is sent (and a refresh on
     interface `{9a0d12a9-ae9e-45c2-a5c9-2bf123c45e1c}` when present); on first execution
     the effective parameters are remembered for undo.
- Return: `0` when at least one fcurve was transformed, else `1`. On first
  execution the arguments and a soft reference to the working list are stored
  (`Type` 2 is stored as 1 because the list is already expanded).
- Undo (B): the list worker is re-run with offset `-Offset`, scale
  `1 / Scale`, the transformed range (ends swapped if needed) and pivot
  `Pivot + Offset`; saved fcurve copies are assigned back first (step 3).
  Redo re-runs the original parameters.
- Not part of the command's Do (B): the class's third private method
  `0x180043390` applies the clip time-control transform of step 4
  (`0x180042670`) to every image clip (class
  `{22c3e8f8-ccea-11d2-b35b-00105a1e70de}`, child 1) and every audio clip
  (class `{d39d0046-ed33-11d2-b353-00105a1e6ce9}`, child `0xb`). It has no
  caller inside `fcurve.dll` (only the vtable entry), so it is reached only
  through the interface by other modules.

## Open questions

1. **Closed 2026-11-17 (batch 9).** `0x180011090` builds a map from an
   upper-case, leaf-first dotted name key to the connected source;
   `0x180010500` connects a duplicate of the matching source to each target
   parameter (`ConnectSource`) and runs `RemoveAnimation` on unmatched ones.
2. `CopyAnimation`: second source interface `{481262ff-…}` is assumed to be
   the expression source; the meaning of mask bits `0xA` / `0xC` inside
   `motionhelp!F3DGetAllAnimationComponents` was not checked.
3. Object kind `{6b579d20-3dc5-11d0-9449-00aa006d3165}` (decides relative-path
   vs leaf-name matching in copy / paste animation) is not identified.
4. `CutKeys` Undo `0x180026ac0` / Redo `0x1800264d0`, `PasteKeys` Undo
   `0x180026e30` / Redo `0x180026810`, key-selection Undo `0x18002e1c0` / Redo
   `0x18002e0d0` were not read.
5. `PasteKeys`: pre-scan in Do `0x180025da0` tests the inputs for two type
   GUIDs (`{77f74c81-7010-11d1-…}`, `{7abf1486-448d-11d0-…}`) and sets an
   internal flag (task+0x71); its effect on name matching (`0x1800238f0`,
   `0x180023770`) was not followed.
6. Symbolic names of the numeric `Type` / `Mode` values (`siParameterScope`,
   `siSequenceType`, `siSequenceMode`, `siFCurveKeySelectionMode` beyond
   `siSetKeySelection`) are inferred, not read from a type library.
7. **Closed 2026-11-17 (batch 9).** `Type` 3 walk, `Mode` 1 to 5 table, clip /
   action / marker helpers and the per-fcurve snapping and ripple rules are
   in the contract; `0x180043390` has no caller in `fcurve.dll`.
8. Rotation commands: which kinematic state the "index 1 / ids 0x0b-0x0d"
   triple is, and the custom-transform interface `{092fa96b-…}` path.
9. Text of `XSIFCURVE` dictionary ids `0x24` and `0x3a` not resolved.
10. `Sequence`: helper `0x180043420` (negative scale on a clip time control),
    parameter filter `0x18003f9e0`, the curve methods at offsets `0x1f0`
    (scale-and-offset), `0x190` (`Discrete Time`) and `0x298` (filter) are
    known only by their call sites; symbolic names of `Mode` 1, 3, 4, 5.
