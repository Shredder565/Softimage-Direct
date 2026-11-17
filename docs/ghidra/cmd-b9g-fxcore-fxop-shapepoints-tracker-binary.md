# CMD-B9g: FX Tree commands read from `fxcore.dll` (operator creation, clipboard, connection flags, 2D shape points, tracker areas)

Row: **CMD-B9g**. Status: **SPEC** (12 names), **SPEC-PARTIAL** (2 names); per command below.
Run: 2026-11-17, `si-analyst`, unattended, batch 9 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLL).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\fxcore.dll`, image base `0x180000000`, sha256 `45985d1dfcfe90ba1b1f58dbdde77f4928f3a89526f849edf16a95af7434b41c`.
Method: `DllGetClassObject` (`0x180002f90`) compares the requested CLSID inline against
constants in `.rdata`; each match builds a class factory whose slot 6 is the creation
function. Factories, constructors, vtables, small thunks and constants were read locally
(pefile + capstone); 33 task methods / workers were read through Ghidra. Statements are
behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

All tasks derive from `CDSCOMObject` + `sitaskcore.dll!C3DCoreBaseTask`. "Task vtable" is the
`C3DCoreBaseTask` interface vtable (slot 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg,
13 release-arguments). Most classes also carry a small private worker interface (last
column of the object) whose slot 3 (and 4, 5 for the tracker) is the actual worker; Do only
forwards the stored arguments to it. The worker's first integer argument is the "first
execution" flag: non-zero on Do, and it decides whether undo data / sub-tasks are recorded.

| Command(s) | Handler CLSID | Creation function (ctor) | Task vtable | Do / worker | Undo / Redo | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|---|
| `AddFxOp` | `88f181e0-1e0b-11d5-b93e-0800690c8bd0` | `0x180002810` (`0x180075b20`) | `0x18010a180` | Do `0x180075fb0` -> worker `0x180075da0` | `0x1800760c0` / `0x180076010` | `0x1800762f0` | `0x180076280` -> `0x180071d30` |
| `AddImageClipFxOp` | `27f96e05-1e1b-45bc-aaa5-266606670ad3` | `0x1800027d0` (`0x1800748d0`) | `0x180109820` | Do `0x180075670` -> worker `0x180074cb0` | `0x1800757d0` / `0x1800756f0` | `0x180075a70` | `0x1800759e0` -> `0x180071d30` |
| `SetFxOpCnxFlag` | `dec69f6f-79bf-4720-843c-77ba07a9d75a` | `0x180002c10` (`0x18007a5c0`) | `0x18010dfb0` | Do `0x18007a770` -> worker `0x18007a860` | imported `UndoTasks` / `RedoTasks` | `0x18007aac0` | base (no output) |
| `CutFxOp`, `CopyFxOp`, `PasteFxOp` | `0322d097-8d58-411b-95ee-a3fb0707052a` | `0x18007bff0` (`0x18007b440`), factory built by `0x18007bf30` | `0x18010f1a0` | Do `0x18007c030` -> copy/cut worker `0x18007b6e0` or paste worker `0x18007c160` | `0x18007c0f0` / `0x18007c080` | `0x18007cd60` | base (no output) |
| `Move2DShapePoint`, `Move2DShapeLHandle`, `Move2DShapeRHandle` | `52af562a-62c6-4dcd-a493-b2f4db352668` | `0x180002b50` (`0x180073410`) | `0x180108790` | Do `0x180073b30` -> worker `0x1800735a0` | imported `UndoTasks` / `RedoTasks` | `0x180073c20` | base |
| `Delete2DShapePoint` | `0d017291-4351-471e-87fd-b78f80d97ea5` | `0x180002a10` (`0x180072450`) | `0x180107720` | Do `0x180072840` -> worker `0x180072660` | `0x1800728f0` / `0x180072860` | `0x180072b00` | base |
| `Key2DShapePoints` | `b91ef230-1686-434d-b61e-de0ab8815012` | `0x180002ad0` (`0x180072c10`) | `0x180107f70` | Do `0x180073030` -> worker `0x180072de0` (key helper `0x180073100`) | imported `UndoTasks` / `RedoTasks` | `0x1800731c0` | base |
| `SetFxTrackerTrackedPoint`, `SetFxTrackerTemplateArea`, `SetFxTrackerSearchArea` | `f010c658-5a8e-4754-a9e0-097bc43f9c00` | `0x180002c90` (`0x18007d010`) | `0x180110110` | Do `0x18007d1c0` -> workers `0x18007d8c0` (point), `0x18007d7f0` (template), `0x18007d720` (search) -> per-value helper `0x18007d3f0`, then `0x18007d2f0` | imported `UndoTasks` / `RedoTasks` | `0x18007d9c0` | base |

The CLSID file offsets given in the batch JSON (`0xdc110`, `0xdc1d0`, `0xdc200`, `0xdc270`,
`0xdb950`, `0xdb990`, `0xdb9b0`, `0xdc430`) are the `.rdata` constants (RVA = offset + `0x1000`)
that `DllGetClassObject` compares against.

## 2. Shared facts

### 2.1 Argument access

- Arguments are read **by position**, not by name, with `FxCoreHelper.dll` helpers
  `fx_cmd::GetArgUnknownFromIdx(ctx, index, iid, &out)` and
  `fx_cmd::GetArgStringFromIdx(ctx, index, &CString)`, or by asking the exec context for the
  raw variant at an index. Scalar values are mostly taken from the variant as delivered
  (the command definition's declared type does the coercion); explicit conversions are
  noted per command.
- Classes that serve several commands ask the exec context (interface
  `26444edd-799f-11d2-8733-00a0c906816c`) for the GUID of the command being executed and
  compare it with fixed constants (tables below).
- Argument errors are raised with `CSIErrorHandling::Raise(0x80070057, severity 2, text)`
  using English literals embedded in the DLL (quoted per command), and UnPackArg returns
  `0x80070057`.

### 2.2 Interfaces and helper classes seen

| GUID | Role (from use) |
|---|---|
| `694e8500-1c07-11d5-b93e-0800690c8bd0` | FxTree ("EffectsTree") object interface. Slots used: 3 add an existing operator object to the tree, 4 create operator by class id, 5 create operator by type name, 7 and 8 node-layout access (8 returns the operator's layout rectangle record). |
| `473feb00-64ed-11d1-84c6-00a0243e3543` | FX operator ("image operator") interface used to type-check `FxOp` arguments. |
| `ab7fc1ae-411c-4f7c-b460-2cb0cb99b9f1` | FX operator identity interface used by cut / copy / paste to filter list members. |
| `7aa64ec7-27e1-4ffa-b5db-16fe50d9766f` | Operator connection interface: slot 8 number of inputs, slot 14 source connected to input *n*. |
| `ab819dc0-4418-11d5-b947-0800690c8bd0` | Operator connection-flag capability: slot 7 "input *n* has a Select flag", slot 9 "input *n* has an Invert flag". |
| `af1c239d-292c-4d68-b0fb-91e5968a73e6` | 2D shape interface. Slots used: 3 shape kind (0 = points with handles), 8 insert point, 9 remove point, 10 point count, 14 parameter ids of a point component, 15 companion query. |
| `a6e13336-563a-4af3-82e1-fe7ffdabd695` / `2238300c-54d6-4d32-96c4-239d5606fd8b` | The two concrete 2D shape storages: point records of 56 bytes (7 doubles: point plus handles) and of 16 bytes (2 doubles) respectively. |
| `52550102-260d-44c2-8f62-477076de4f7f` | Tracker operator interface: slot 3 maps (row index, component) to a parameter id, slot 5 "tracker data changed" notification. |
| `22c3e8f9-ccea-11d2-b35b-00105a1e70de` | Image clip interface (type check of `ImageClip`). |
| class `c089b901-8481-11d2-b118-00a024c79287` | SetValue task (slot 10 = set a parameter value at a time, with a "do" flag). |
| class `5ad1fd80-5d5d-11d2-8082-00a0c955b335` | SaveKey task (see CMD-B8a). |
| class `dd531990-ccc2-11d2-ac73-00a02485cecb` | DeleteObj task (slot 9 = delete a list of objects with flags). |
| class `f49f6471-4211-11d0-8463-00a024c7919c` | Object list (I3DList). |
| class `107dcd80-4228-11d0-8463-00a024c7919c` | Element reference wrapper (`872903d0-3ef3-11d0-8463-00a024c7919c`). |

### 2.3 Return-value helper `0x180071d30`

Used by `AddFxOp` and `AddImageClipFxOp` to fill the output argument named `Value`. For an
object result it stores a `VT_DISPATCH` variant: the object's own `IDispatch` if it has
one; otherwise the object is wrapped in an element reference (class `107dcd80-...`) and the
dispatch of that wrapper is stored. A null result stores a null-object variant.

### 2.4 Parameter addressing by index

`SetFxOpCnxFlag` and the tracker commands address operator parameters with a two-field
descriptor `{0x402, n}` (kind `0x402` = "parameter by numeric index") handed to the SetValue
/ SaveKey tasks, not by script name.

## 3. Contracts

### `AddFxOp`: SPEC-PARTIAL

- Purpose: create one FX operator of a named type inside an FX tree and return it.
- Arguments (by position): 0 `FxTree` must expose the FxTree interface, else error
  "Argument 1 must be an EffectsTree object"; 1 `PresetName` string (registry default `""`),
  a failure to read it gives "Argument 2 must be an image operator type name (ex : "blur"";
  2 `Value` output.
- Do: calls the tree's "create operator by type name" method (slot 5) with the string. A
  negative status is returned unchanged and nothing else happens. On success the new
  operator is kept as the result, and soft references to the tree and to the new operator
  plus the type name are stored for undo / redo.
- Return: `Value` = the new operator (dispatch object, see 2.3).
- Undo: resolves the stored operator reference, puts it in a new object list and runs a
  DeleteObj task on that list with flags `0x10`.
- Redo: resolves the tree reference and creates the operator again by the stored name
  (a new object; references are refreshed).
- Not read: the tree method that maps the type name to an operator class (valid names,
  whether a preset file path is accepted, default node position, behaviour for an unknown
  name). That is why this is SPEC-PARTIAL.

### `AddImageClipFxOp`: SPEC-PARTIAL

- Purpose: bring an image clip into an FX tree as a pair of clip operators and return the
  first of them.
- Arguments: 0 `FxTree` (error "Argument 1 must be an EffectsTree object"); 1 `ImageClip`
  must expose the image clip interface (error "Argument 2 must be an image clip");
  2 `Value` output.
- Do, in order:
  1. Create operator A by class id `68cb0090-3ae7-4951-a12a-178d1d44d961` and operator B by
     class id `4288036e-a57b-4c17-98f7-c4f394c5aaec` in the tree (tree slot 4). `data/spdl`
     gives `4288036E-...` as the reference GUID of both `C3DFxClipInOp.spdl` and
     `C3DFxClipOutOp.spdl`; which of ClipIn / ClipOut A is was not settled.
  2. Ask the clip for its companion object (clip slot 10; `(inferred)` the image source) and
     for one of its nested objects (property id `0x27`), which is wrapped in an element
     reference.
  3. Two connection-style calls on a helper object (class `85ad2212-d8cb-11d2-ac75-00a02485cecb`)
     attach that element reference to A (mode 1) and to B (mode 2).
  4. Connect A to B with the internal connect routine `0x18000fc60` (same routine the paste
     command uses).
  5. Bind the clip data: A receives the companion object, B receives the clip itself
     (operator interface `da3ff6e6-33f1-4168-9476-16c0ec5c40a3`, slot 3).
  6. Read the clip's name (`0x180010190`) and set parameter `98ebebb4-138c-4797-8aae-2b4ded082a2d`
     (`ClipName`, "Image Clip Name" `(inferred from the spdl)`) to that string on both A and
     B, with SetValue tasks at the current time.
  7. Read clip property id `0x1c`; when its integer value is non-zero, write value 0 to clip
     parameter `1ed647ee-1f72-11d3-826f-00a0c9ed6e30` with a SetValue task (the previous
     value is kept in the task). Meaning of that clip parameter: open question 2.
  8. Keep A as the result; store soft references to tree, clip, A and B.
- Return: `Value` = operator A.
- Undo: resolves A and B, deletes both through one DeleteObj task (flags `0x10`). The clip
  parameter changed in step 7 is not restored by the undo code read.
- Redo: resolves tree and clip and runs the whole Do sequence again.
- Errors: any failing creation step returns its status; nothing is rolled back.

### `SetFxOpCnxFlag`: SPEC

- Purpose: switch the "Select" or "Invert" flag of one input connection of an FX operator.
- Arguments: 0 `FxOp` must be an FX operator ("Argument must be an image operator");
  1 `Connection` string, resolved with `fx_cmd::GetConnectionFromName` to an input index
  (name or number; a failure or an "is output" result gives "Argument 2 is not a valid
  connection name or number"); 2 `FlagName` string, lower-cased, only its first three
  characters are compared: `sel...` -> Select, `inv...` -> Invert, otherwise "Argument 3
  must the known flags "Select" or "Invert""; 3 `Value` boolean, anything that is not a
  `VT_BOOL` counts as true (registry default true).
- Do: the operator must expose the connection-flag capability, else `0x80070057`. The
  capability is asked whether input *n* has the requested flag; "no" returns `0x80070057`.
  Otherwise one SetValue task writes the boolean at the current time to the operator
  parameter with numeric index `n + 5` (Select) or `n + 13` (Invert). The task is recorded
  as a sub-task on first execution.
- Undo / Redo: the base class replays the SetValue sub-task.
- No return value.

### `CopyFxOp` / `CutFxOp`: SPEC

- Purpose: serialise the given FX operators to the Windows clipboard; Cut also deletes them.
- Class dispatch by command GUID: `e357f49c-...` Cut (mode 0), `190bc26a-...` Copy (mode 1),
  `33b0184b-...` Paste (mode 2). A fourth GUID `75a2d141-b9e1-4a49-a1a7-3722127b6c02`
  (mode 3) is also accepted and treated as a paste variant; it is not in the command
  registry.
- Argument: `InputObj` is taken with `F3DCmdGetInputObjects` (object list; selection when
  omitted `(inferred)`); failure raises "Argument must be a list of Fx Operators".
- Do:
  1. Count the list members that are FX operators. None -> `0x80070057`, clipboard untouched.
  2. Open a memory stream wrapped by the scene persistence service (generic object
     `b54dca74-e452-11d1-8873-00a024ee6238`, writer class `531dfcf1-984a-11d1-8873-00a024ee6238`,
     current scene as context).
  3. Stream layout: a 32-bit operator count; then one chunk per operator (chunk id = its
     0-based position among the copied operators, tag `0x31303030`) holding the operator
     persisted by the standard object writer; then one chunk with id `0x636e785f` (bytes
     `_xnc`), tag `0x31303030`, containing the 16-byte GUID `0322d097-8d58-411b-95ee-a3fb0707052a`
     followed, per operator, by its input count and, per input, two 32-bit integers: the
     position (in this copy set) of the operator feeding that input or `-1` when the source
     is not part of the set, and the source-side index reported by the connection interface.
  4. The stream is placed on the clipboard as an `IStream` medium in the registered format
     named `Persisted Softimage|FX Operators`.
  5. Cut only: a DeleteObj task (flags `0x10`) deletes the input list and is recorded as a
     sub-task.
- Undo: Cut replays the delete sub-task backwards (operators come back); Copy does nothing.
  The clipboard is not restored. Redo: Cut replays the delete.
- No return value.

### `PasteFxOp`: SPEC

- Argument: 0 `FxTree` must be an FxTree object, else "Argument must be a FxTree object".
- Do:
  1. Attach to the clipboard; if the format `Persisted Softimage|FX Operators` is not
     available as a stream the command returns `0x80004005`.
  2. Read the operator count; zero means nothing to do (returns `0x80004005` through the
     same exit).
  3. For each operator chunk: load the object with the scene persistence reader, add it to
     the target tree, then offset its node layout rectangle by +64 horizontally and +32
     vertically (both corners), mark the layout record as explicitly positioned, and push
     it back to the operator. A load failure aborts with that status (operators already
     added stay).
  4. Read the `_xnc` chunk; only when its GUID equals the handler CLSID are the saved
     connections replayed: every input whose saved source position is valid and points to
     a pasted operator is reconnected to that pasted operator (connections to operators
     outside the copied set are dropped).
  5. First execution: the pasted operators are collected in a list and a soft list
     reference is stored for undo.
- Undo: a DeleteObj task deletes the pasted list (flags 0, with the task's "keep for redo"
  argument set). Redo: that delete task is undone, bringing the same operators back.
- No return value; the selection is not changed by the code read.

### `Move2DShapePoint` / `Move2DShapeLHandle` / `Move2DShapeRHandle`: SPEC

- One class; the component is chosen by command GUID: `be0175d5-...` point (0),
  `4ecc87cc-...` left handle (1), `36c2ad98-...` right handle (2). Any other GUID fails
  with `0x80070057`.
- Arguments: 0 `Shape` must expose the 2D shape interface ("Argument 1 must be a 2D
  shape"); 1 `index` (integer, default 0); 2 `x`, 3 `y` (doubles, default 0). Missing
  scalar arguments give `0x80070057` without a message.
- Do:
  1. Auto-key decision: true when the ambient value `FXSH_AUTOKEY_PTS` is a true boolean,
     otherwise the preference `animation.autokey`.
  2. Ask the shape for the parameter ids of (point `index`, component); a failure is
     returned (this is where a bad index is rejected). A second shape query for the same
     pair must also succeed.
  3. Two SetValue tasks write `x` and `y` (as `VT_R8`) to the two parameters at the current
     time.
  4. When auto-key is on, two SaveKey tasks key the same two parameters at the current time
     with the same values.
  5. On first execution all tasks are recorded as sub-tasks (order: set x, key x, set y, key y).
- The values are absolute positions, not deltas. Undo / Redo replay the sub-tasks.
- No return value.

### `Delete2DShapePoint`: SPEC

- Arguments: 0 `Shape` (2D shape, same error text); 1 `index` (integer, default 0).
- Do: `index` must satisfy `0 <= index < point count`, else `0x80070057`. On first execution
  the point's raw record is saved (56-byte record for handle shapes, 16-byte record for
  plain point shapes; a shape of neither storage gives `0x8000ffff`). The point is then
  removed through the shape interface, and a soft reference to the shape is stored.
- Undo: resolve the shape, insert a point at `index`, then overwrite the inserted point's
  record with the saved one. Redo: resolve the shape and remove the point again.
- Animation on the removed point's parameters is not handled by this task. No return value.

### `Key2DShapePoints`: SPEC

- Arguments: 0 `Shape` (2D shape, same error text); 1 `index`: when it converts to a
  non-empty array (`fx_cmd::GetAsSafeArray`), each element is converted to a 32-bit
  integer and used as a point index; otherwise (missing, scalar, empty array) **all**
  points are keyed. An element that cannot be converted gives `0x80070057`.
- Do: for each selected point, ask the shape for the parameter ids of the point component;
  points for which that query does not return success are skipped silently. A SaveKey task
  keys the x and the y parameter at the current time using the parameter's current value
  (no value is supplied). When the shape kind is 0 (points with handles) the left-handle
  and right-handle x / y parameters are keyed the same way, so 2 or 6 keys per point.
  Tasks are recorded as sub-tasks on first execution.
- Undo / Redo replay the SaveKey sub-tasks. No return value.

### `SetFxTrackerTrackedPoint` / `SetFxTrackerTemplateArea` / `SetFxTrackerSearchArea`: SPEC

- One class; command GUID selects the mode: `59112326-...` tracked point (2 values),
  `770dd7e0-...` template area (4 values), `ed45def7-...` search area (4 values). Other
  GUIDs fail with `0x80070057`.
- Arguments: 0 `FxOp` must be an FX operator ("Argument must be a tracker operator");
  1 `Time` converted to a double (frames); 2 `Tracker` converted to a 32-bit integer
  (default 0); then the float values converted to `VT_R4` in order (`x, y` or
  `x1, y1, x2, y2`, default 0).
- Do:
  1. Any sub-tasks from a previous run are cleared.
  2. `Time` is converted to seconds with the current time format.
  3. For value number `k` (0-based) the tracker interface is asked for the parameter at row
     `Tracker + base`, component `k`; components the operator does not have are skipped.
     Bases: template area 0, search area 8, tracked point 20 and then 12 (the same `x, y`
     pair is written to both rows, row 20 first).
  4. For each parameter found: a SetValue task writes the float at `Time`, then a SaveKey
     task keys the parameter at `Time` with that value; the SaveKey task is recorded as a
     sub-task.
  5. The operator's "tracker data changed" notification is called.
- Status: success on first execution; the same worker returns status 1 when called with the
  first-execution flag clear. An operator that is an FX operator but not a tracker is not
  rejected by UnPackArg; the missing tracker interface is not checked before use.
- Undo / Redo replay the recorded sub-tasks. No return value.

## Open questions

1. `AddFxOp`: the FxTree "create by type name" method (tree interface slot 5) was not
   located; valid type names, preset-file handling (`fx_cmd::IsPresetFileName` is imported
   by the DLL) and the error for an unknown name are unread.
2. `AddImageClipFxOp`: identity of clip property ids `0x27` and `0x1c`, of clip parameter
   `1ed647ee-1f72-11d3-826f-00a0c9ed6e30`, and which of the two created classes is the
   ClipIn and which the ClipOut operator.
3. Cut / copy stream: the second integer stored per input (value from connection-interface
   slot 12) is taken to be the source output index `(inferred)`; the argument order of the
   connect routine `0x18000fc60` on paste was not recovered.
4. Command GUID `75a2d141-b9e1-4a49-a1a7-3722127b6c02` (paste variant, mode 3): no registry
   entry; the flag it passes to the paste worker is not used by the worker code read.
5. Tracker rows: what rows `Tracker + 0`, `+ 8`, `+ 12`, `+ 20` are called in the tracker
   operator's parameter set (spdl not checked), and the maximum tracker count implied by
   the spacing of 8 / 4.
6. In the tracker per-value helper the SaveKey sub-task is registered twice (before and
   after it is run) while the SetValue task is not registered; effect on undo not verified.
7. `Move2DShape*`: the purpose of the second shape query (slot 15) whose result is unused.

## New ledger rows

- FxTree object interface `694e8500-1c07-11d5-b93e-0800690c8bd0` (create by name / by class
  id, add existing operator, node layout records) in `fxcore.dll`.
- FX clip operators `C3DFxClipInOp` / `C3DFxClipOutOp` (class ids `4288036e-...`,
  `68cb0090-...`), parameter `ClipName`.
- Clipboard format `Persisted Softimage|FX Operators` and its stream layout (operator
  chunks + `_xnc` connection chunk).
- 2D shape object (`af1c239d-...`) with its two storages and per-point parameter ids;
  ambient value `FXSH_AUTOKEY_PTS`.
- Tracker operator interface `52550102-260d-44c2-8f62-477076de4f7f` and its row layout.
- `FxCoreHelper.dll` exports not opened: `fx_cmd::GetConnectionFromName`,
  `fx_cmd::GetAsSafeArray`, `fx_cmd::GetArgUnknownFromIdx`, `fx_cmd::CreateListAddToList`.
- Internal connect routine `fxcore.dll!0x18000fc60` and clip-name reader `0x180010190`.
