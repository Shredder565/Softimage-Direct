# CMD-B9f: FX Tree commands read from `fxcore.dll` (2D shapes, operator connection / attribute, pass input, tracker transport)

Row: **CMD-B9f**. Status: **SPEC** (9 names), **SPEC-PARTIAL** (5 names); per command below.
Run: 2026-11-17, `si-analyst`, unattended, batch 9 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLL).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\fxcore.dll`, image base `0x180000000`, sha256 `45985d1dfcfe90ba1b1f58dbdde77f4928f3a89526f849edf16a95af7434b41c`.
Method: the handler CLSIDs are matched by inline compares in `DllGetClassObject` (`0x180002f90`); class factory
vtables, creation functions, constructors and task vtables were read locally (pefile + capstone); the Do / worker /
UnPackArg functions were decompiled in Ghidra (24 functions), small thunks (Do forwarders, Undo / Redo, RePackArg)
were read locally. Message text comes from `Application\Dictionary\en\XSIFXCORE.dict`, parameter names from
`data/spdl/spdl.json`. All statements are behaviour read from the binary unless marked `(inferred)`.

Commands covered (14): `Add2DShape`, `Add2DShapePoint`, `Add2DShapePointArray`, `Insert2DShapePoint`, `Move2DShape`,
`Move2DShapePin`, `Scale2DShape`, `Set2DShapeRotation`, `AddPassInputFxOp`, `ConnectFxOp`, `SetFxOpAttrib`,
`CurrentFxTracking`, `StartFxTracking`, `StepFxTracking`.

## 1. Handler table

Task vtable = the `C3DCoreBaseTask` part of the object (object offset `+0x18`); slots 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg.
"Worker" is the method the Do forwards to (slot 3 of a small private interface at object `+0x40`, or slot 9 of the object's primary vtable).

| Command(s) | Handler CLSID | Factory vtable / creation function (ctor) | Task vtable | Do -> worker | Undo / Redo | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|---|
| `Add2DShape` | `205f3d8b-57c3-42e5-818d-639784adc23d` | `0x1800d0f18` / `0x1800028d0` (ctor `0x180071840`, size `0xe8`) | `0x180106dd0` | `0x180072030` -> `0x180071ab0` | `0x180072100` / `0x180072060` | `0x180072300` | `0x1800722a0` -> `0x180071d30` |
| `Add2DShapePoint`, `Add2DShapePointArray`, `Insert2DShapePoint` | `c7d2cdbd-86cb-49e3-bf9d-2512b7b52dd7` | `0x1800d0f50` / `0x180002890` (ctor `0x180070bf0`, size `0xe8`) | `0x180106520` | `0x180071080` -> single point `0x180070e90`, array `0x180070f70` | `0x180071210` / `0x180071110` | `0x1800713f0` | `0x180071350` |
| `Move2DShape`, `Scale2DShape`, `Move2DShapePin`, `Set2DShapeRotation` | `2bda6dc3-a2e7-4938-a5ce-1cdc64748587` | `0x1800d0f88` / `0x180002dd0` (ctor `0x180073ee0`, size `0x78`) | `0x180108fd0` | `0x180074080` -> `0x180074150` | imported `C3DCoreBaseTask::UndoTasks` / `RedoTasks` (thunks `0x180073b70`, `0x180073060`) | `0x180074660` | none (returns 0) |
| `AddPassInputFxOp` | `cee1c8a0-803d-11d5-a279-00d0b7190223` | `0x1800d0cb0` / `0x180002350` (ctor `0x1800763e0`, size `0x138`) | `0x18010aac0` | `0x180076d40` -> `0x180076740` | `0x180076e60` / `0x180076d70` | `0x180077110` | `0x180077070` -> `0x180071d30` |
| `ConnectFxOp` | `6a122800-4e2c-11d5-b953-0800690c8bd0` | `0x1800d0d20` / `0x180002990` (ctor `0x180077640`, size `0x130`) | `0x18010b310` | `0x180077e70` -> `0x180077930` -> connect helper `0x18000fc60` | `0x180077ef0` / `0x180077eb0` | `0x180078150` | none |
| `SetFxOpAttrib` | `b345b4dc-7ad5-46aa-8028-1d231fea6180` | `0x1800d0e00` / `0x180002bd0` (ctor `0x180079ad0`, size `0x110`) | `0x18010d700` | `0x180079dd0` -> `0x180079fb0` (name table lookup `0x18007cf10`) | `0x180079ed0` / `0x180079e50` | `0x18007a490` | none |
| `StartFxTracking`, `CurrentFxTracking`, `StepFxTracking` | `f8fb7cca-a7cc-4800-8249-1cb690e2e521` | `0x1800d0ee0` / `0x180002d90` (ctor `0x18007dcc0`, size `0x78`) | `0x180110a50` | `0x18007e2c0` -> `0x18007e600` / `0x18007e5f0` / `0x18007e610` -> shared `0x18007e1e0` (helpers `0x18007e420`, `0x18007df50`) | both return `0x80004001` (`0x180018740`) | `0x18007e6c0` | none |

Note: the factory vtable following `ConnectFxOp`'s in the table (`0x1800d0d58`, creation `0x180002a50`, ctor
`0x1800788d0`) belongs to `DisconnectFxOp` (`c8530d7d-...`), not to this row; see "New ledger rows".

## 2. Shared facts

### 2.1 Dispatch and the "first run" flag

- All seven classes derive from `C3DCoreBaseTask` (`sitaskcore.dll`) and `CDSCOMObject`. The Do slot receives a
  second argument that the Do forwards unchanged to the worker; Redo calls the same worker with that argument
  forced to 0. In the workers a non-zero value means "first execution": only then are soft references
  (`mohelper.dll!F3DCreateObjectReference`) recorded for undo and sub-tasks registered with
  `C3DCoreBaseTask::AddTask`. The value the framework passes on a normal command execution was not read in
  `sitaskcore.dll`; the contracts assume it is non-zero `(inferred: otherwise no undo data would ever be recorded)`.
- Classes that serve several commands ask the execution context (interface `26444edd-799f-11d2-8733-00a0c906816c`)
  for the GUID of the running command and compare it with the command GUIDs listed in each contract.
- Arguments are read **by position**, with helpers imported from `FxCoreHelper.dll`:
  `fx_cmd::GetArgUnknownFromIdx(ctx, index, iid, &out)`, `fx_cmd::GetArgStringFromIdx`, `fx_cmd::GetAsSafeArray`,
  `fx_cmd::GetConnectionFromName(op, name, &index, &isOutput)`, `fx_cmd::CreateListAddToList`. Their bodies were not opened.
- Argument errors are raised with `CSIErrorHandling::Raise(0x80070057, severity 2, <literal English text>)`; the
  texts are literals in the DLL (quoted in the contracts), not dictionary ids.

### 2.2 Interfaces and classes seen

| GUID | What it is (from use) |
|---|---|
| `af1c239d-292c-4d68-b0fb-91e5968a73e6` | 2D shape interface. Slots used: 8 add / insert point (x, y, position, out index), 9 remove point (index), 10 point count, 12 read transform block. |
| `197ad418-fa6d-40f1-86a8-f6f7491fe399` | 2D shape list interface. Slot 9 = add a shape to the list. |
| `e0ca3fde-9f35-4c18-9a9d-5f355b3f87ca` | Bezier shape class (`C3DFxShapeBezier.spdl`, property set `Bezier`). |
| `810998a1-1512-431e-98d3-b5bf95fc13c3` | Point shape class (`C3DFxShapePoint.spdl`, property set `PointShape`; `Type` combo: 0 Closed BSpline, 1 Open BSpline, 2 Closed Polygon, 3 Open Polygon). |
| `2238300c-54d6-4d32-96c4-239d5606fd8b` | Point-shape interface; slot 17 sets the shape type. |
| `ab7fc1ae-411c-4f7c-b460-2cb0cb99b9f1` | FX image operator (the type `ConnectFxOp` requires for `Op1` / `Op2`). Slot 6 returns the operator's graph node. |
| `7aa64ec7-27e1-4ffa-b5db-16fe50d9766f` | Graph node of an operator. Slots: 10 "input index is connected", 16 get the source of an input (node + output index), 17 set the source of an input, 18 disconnect an input. |
| `ab819dc0-4418-11d5-b947-0800690c8bd0` | Per-input information interface of an operator (slots 7, 8, 10, 11 used, see `ConnectFxOp`). |
| `473feb00-64ed-11d1-84c6-00a0243e3543` | Generic scene-object interface accepted by `SetFxOpAttrib` for a single operator. |
| `f49f6470-4211-11d0-8463-00a024c7919c` / class `f49f6471-...` | `I3DList` / list class. |
| `694e8500-1c07-11d5-b93e-0800690c8bd0` | FX tree interface (`AddPassInputFxOp` argument 1; also the owner type looked up by `SetFxOpAttrib`). Slot 3 = add an operator to the tree; slot 8 returns a pointer to the node rectangle (4 floats). |
| `d233acd7-b2f5-4f26-9847-4752712f9260`, `b287db40-69f3-47ef-89a7-fa1f9e86a139` | Render pass interfaces (argument type, and the one used to read the frame range and the framebuffers). |
| `ca6f7760-1b1a-11d5-b93d-0800690c8bd0` (interface `6de1b670-8072-11d5-aeed-0090275802c9`) | Operator class created by `AddPassInputFxOp` `(inferred: the File Input operator, `C3DFxFileInputOp.spdl`)`. |
| `4aeaeaea-1a43-11d2-8d66-00a0c982a649` | Component-hierarchy interface used as parameter owner and for soft references. |
| `c089b901-8481-11d2-b118-00a024c79287` (`c089b902-...`) | `SetValue` task class, used as sub-task. |
| `5ad1fd80-5d5d-11d2-8082-00a0c955b335` (`34962451-7e64-11d2-808e-00a0c955b335`) | `SaveKey` task class (`fcurve.dll`), used as sub-task. |
| `dd531990-ccc2-11d2-ac73-00a02485cecb` (`dd531992-...`) | `DeleteObj` task class, used for undo of created objects (list, flags `0x10`, 0). |
| `79581ba0-99bb-11d2-8bbb-00aa00135f7b` (`46931bb0-946b-11d2-8bbb-00aa00135f7b`) | `SelectObj` family task class, used by `Add2DShape`. |

### 2.3 Messages

`XSIFXCORE` dictionary id `0x2d` = "Only passes set to render sequences can be added as input clips." (logged by
`AddPassInputFxOp` with severity 4).

## 3. Contracts

### `Move2DShape` / `Scale2DShape` / `Move2DShapePin` / `Set2DShapeRotation`: SPEC

- Purpose: set the transform parameters of one 2D shape to the given values, undoably, with optional auto-key.
- Command selection by GUID: `4500a3a6-fa56-4ae8-a2c2-dbd33e404be3` Move2DShape = mode 0;
  `96ff186a-4365-41de-b20b-d1ddc99b2138` Scale2DShape = mode 1; `1200058d-aecb-46bf-bf81-20270b87e94c`
  Move2DShapePin = mode 2; `0b6bd7b1-48d0-46bc-a0bb-8b98888f9946` Set2DShapeRotation = mode 3.
- Arguments (by position): 0 `Shape` (must expose the 2D shape interface `af1c239d-...`); 1 `x` (double, default 0;
  for mode 3 this is `angle`); 2 `y` (double, default 0; not read in mode 3, stored as 0). The numeric values are
  taken from the variant as doubles without a type conversion.
- Errors: shape argument not a 2D shape, or an unknown command GUID: `0x80070057` with the text
  "Argument 1 must be a 2D shape". A failure reading `x` / `y` returns `0x80070057` without text. In the worker:
  the shape not exposing `4aeaeaea-...` gives `0x8000ffff`; a mode outside 0..3 gives `0x8000ffff`.
- Values are **absolute**, not deltas: the command writes the given numbers into the parameters.
- Parameters written (parameter key = pair `(0x402, n)`):

  | Mode | Command | n for first value | n for second value | SPDL names `(inferred from the shape property page order PosX, PosY, SclX, SclY, PinX, PinY, Rotate)` |
  |---|---|---|---|---|
  | 0 | Move2DShape | 3 | 4 | `PosX`, `PosY` |
  | 1 | Scale2DShape | 5 | 6 | `SclX`, `SclY` |
  | 2 | Move2DShapePin | 7 | 8 | `PinX`, `PinY` |
  | 3 | Set2DShapeRotation | 9 | (none) | `Rotate` |

- Steps:
  1. Auto-key decision: on when the preference `animation.autokey` is true, or when the ambient value
     `FXSH_AUTOKEY_PTS` (read through `CDSCPMHelper::GetAmbientValue`) is a boolean true.
  2. For each value (two, or one for rotation) a `SetValue` sub-task is created; when auto-key is on a `SaveKey`
     sub-task is created as well. A creation failure returns that HRESULT.
  3. The current time is read (`SIGetCurrentTime`).
  4. Per value: the `SetValue` sub-task is initialised with (shape as owner, parameter key, value as `VT_R8`,
     current time, first-run flag, 0); with auto-key the `SaveKey` sub-task is initialised with (owner, parameter
     key, current time, value, first-run flag).
  5. On the first run every sub-task is added to the command task (`AddTask`), `SetValue` before `SaveKey` for each value.
- Return value: none (no output argument). Worker result 0 on success.
- Undo / Redo: the base `UndoTasks` / `RedoTasks`, i.e. the sub-tasks are undone / redone; the command stores no state of its own.

### `Add2DShapePoint` / `Insert2DShapePoint`: SPEC

- Purpose: add one point to a 2D shape, at the end (`Add2DShapePoint`) or at a given position (`Insert2DShapePoint`).
- Command GUIDs: `c7d2cdbd-86cb-49e3-bf9d-2512b7b52dd7` Add2DShapePoint; `7827f403-bf42-44be-8530-6fa9c1c63f67` Insert2DShapePoint.
- Arguments by position. Add: 0 `Shape`, 1 `x`, 2 `y`. Insert: 0 `Shape`, 1 `position` (integer), 2 `x`, 3 `y`.
  `x` / `y` are read as doubles without conversion. For Add the position is fixed to `-1` (append).
- Errors: shape not a 2D shape (interface `af1c239d-...`) or unknown command GUID: `0x80070057`, text
  "Argument 1 must be a 2D shape". Failure reading a numeric argument: `0x80070057` without text.
- Do: calls the shape's add-point method (slot 8) with (x, y, position, &index). A failure is returned as is.
  On the first run a soft reference to the shape is stored for undo / redo. The index returned by the shape is kept.
- Output: `Value` (`VT_I4`) = the index returned by the shape **plus 1**.
- Undo: resolves the shape reference and calls remove-point (slot 9) with the stored index.
- Redo: resolves the shape reference and repeats the add with the same x, y, position (the stored index is refreshed).
- What the shape does with a position outside its range was not read (it is inside the shape class).

### `Add2DShapePointArray`: SPEC

- Purpose: append several points to a 2D shape in one command.
- Command GUID `5ac7a778-477b-4b8b-ae00-1d8b84894e95` (same class as above, array mode).
- Arguments: 0 `Shape` (2D shape), 1 `points` (array). The array is converted with `fx_cmd::GetAsSafeArray`; its
  element count must be non-zero and even. Each element is converted to a double (`VT_R8`); the flat array is
  read as x0, y0, x1, y1, ...
- Errors: `0x80070057` with "Argument 1 must be a 2D shape" when the shape is wrong; `0x80070057` without text
  when the array is missing, empty, of odd length, or an element cannot be converted to a number.
- Do: on the first run the shape's current point count is stored (this is the index of the first new point);
  then each pair is appended with the add-point method using position `-1`; the first failing add aborts and
  returns its HRESULT (points already appended stay). On the first run a soft reference to the shape is stored.
- Output: none (`Value` is not written in array mode; RePackArg returns 0 immediately).
- Undo: removes (number of pairs) points, each time at the stored first-new-point index.
- Redo: appends the same pairs again.

### `Add2DShape`: SPEC

- Purpose: create a new 2D shape (Bezier, B-spline or polygon) in a shape list and select it.
- Arguments by position: 0 `ShapeList` (must expose the shape-list interface `197ad418-...`); 1 `ShapeType` (string).
- `ShapeType` is lower-cased and only its **first three characters** are compared: `bez` = 0 (Bezier),
  `bsp` = 1 (B-spline), `pol` = 2 (polygon). So "Bezier", "BSpline", "Polygon" and any string starting the same way are accepted.
- Errors (`0x80070057`): "Argument 1 must be a 2D shape list"; "Argument 2 must be \"Bezier\", \"BSpline\" or
  \"Polygon\" " (the default empty string therefore fails).
- Do:
  1. Create the shape object: type 0 -> class `e0ca3fde-...` (Bezier shape); type 1 or 2 -> class `810998a1-...` (point shape).
  2. For a point shape set its type through interface `2238300c-...` slot 17: value 0 for B-spline, 2 for polygon
     `(inferred from the SPDL combo: 0 Closed BSpline, 2 Closed Polygon)`.
  3. Add the shape to the list (list slot 9). A failure is returned.
  4. Create a `SelectObj`-family task (`79581ba0-...`) and initialise it with (a list holding the new shape, 0, 0)
     `(inferred: the new shape becomes the selection)`. This task is executed inline and is **not** added as a sub-task.
  5. First run only: store soft references to the list and to the new shape.
  6. The new shape is the result.
- Output: `Value` (`VT_UNKNOWN` / object) = the new shape.
- Undo: resolves the new shape's reference, puts it in a list and runs a `DeleteObj` task on it (list, flags `0x10`, 0).
  The selection change is not reverted by this command.
- Redo: resolves the shape-list reference and runs the Do steps again, which creates a **new** shape object.

### `ConnectFxOp`: SPEC

- Purpose: connect the output of operator `Op1` to an input of operator `Op2`.
- Arguments by position: 0 `Op1`, 1 `Op2` (both must expose the image operator interface `ab7fc1ae-...`);
  2 `Connection` (string, default "").
- `Connection` handling: if it equals "AllInputs" (case-insensitive) the "all inputs" flag is set and the name is
  not resolved; otherwise `fx_cmd::GetConnectionFromName(Op2, name, &index, &isOutput)` resolves a connection
  name or number on **Op2** (resolution rules live in `FxCoreHelper.dll`, not read; behaviour for the default
  empty string is therefore not established).
- Errors, all `0x80070057`: `Op1` or `Op2` not an image operator: "Argument must be an image operator"; name not
  resolved: "Argument 3 is not a valid connection name or number"; the resolved connection is an output:
  "Argument 3 must be an input port".
- Do, when the "all inputs" flag is set: **nothing is done** and success is returned (the worker's whole body is skipped).
- Do, otherwise (input index `i` on Op2):
  1. Obtain both operators' graph nodes; any missing interface gives `0x8000ffff`.
  2. If Op2's per-input interface (`ab819dc0-...`) slot 10 answers false for `i`: when input `i` of Op2 is already
     connected, remember the existing source (node soft reference + its output index, first run only) and
     disconnect input `i`; remember whether there was a previous connection. When slot 10 answers true this
     step is skipped (meaning of that query not established; see open question 3).
  3. Connect: the helper `0x18000fc60` finds Op1's output index (`0x1800104a0`, not opened) and sets the source
     of Op2's input `i` to (Op1 node, that output). If the helper reports failure the command returns `0x80070057`.
  4. First run: store soft references to both nodes.
  5. If Op2's per-input interface slot 7 answers true and slot 8 answers false for `i`, and slot 11 yields a
     parameter key for `i`: a `SetValue` sub-task sets that parameter of Op2 to boolean **True** at the current
     time, and is added as a sub-task on the first run `(inferred: the input has an associated on/off parameter
     that is switched on when something is connected)`.
- Return: no output argument.
- Undo: disconnects input `i` of Op2; if a previous connection was recorded, restores it (previous node and
  output index); then undoes the sub-tasks.
- Redo: repeats the Do steps with the first-run flag off.

### `SetFxOpAttrib`: SPEC-PARTIAL

- Purpose: set a UI attribute of FX operator(s). Only the attribute `Rect` has an effect.
- Arguments by position: 0 `Op`: either a list (`I3DList`) or a single object (interface `473feb00-...`), which is
  wrapped in a one-element list; 1 `Attrib` (string); 2 `Value` (variant, kept as given).
- Attribute name table (`0x18015bad0`, compared case-insensitively after conversion to a narrow string):
  `Rect` = 1, `ShowThumbnail` = 2, `List` = 0, `Help` = 0, `?` = 0. Names with id 0 and unknown names are rejected.
- Errors (`0x80070057`): "Argument 1 must be one or more fx operator"; "Argument 2 must be an attribute name".
- Do (worker `0x180079fb0`), any failed check returns `0x80070057`:
  1. `Value` must convert to an array (`fx_cmd::GetAsSafeArray`) whose element count equals **4 x the number of
     operators** in the list. This check applies to both `Rect` and `ShowThumbnail`.
  2. For each operator: fetch its sub-object identified by `18222980-26f6-11d5-b942-0800690c8bd0`, find that
     object's primary owner of type `694e8500-...` (`mohelper.dll!F3DGetPrimaryOwnerOf`) and ask it (slot 8) for
     the node rectangle, a block of 4 floats `(r0, r1, r2, r3)`.
  3. `Rect`: `Value` itself must be an array of **exactly 4** elements, each convertible to a double (so in
     practice the command works for one operator at a time). The four numbers are written as floats into the
     rectangle, then normalised: if `r3 < r1` they are swapped; if `r2 < r0` they are swapped; if `r3 - r1 < 25`
     then `r3 = r1 + 25`; if `r2 - r0 < 60` then `r3 = r1 + 100` (as coded: the width test changes `r3`).
     Then the notification `FX_FXTOBJ_VISUALCHG` is fired through the task's notifier helper.
     On the first run the previous four values are saved (array of 4 doubles) for undo.
  4. `ShowThumbnail`: the per-operator lookups of step 2 run but nothing is written (no effect in this DLL).
  5. First run: the attribute name and the value are stored in the task.
- After the worker returns, the Do releases the operator list held by the task.
- Return: no output argument.
- Not established: Undo (`0x180079ed0`) and Redo (`0x180079e50`) call the same worker with the saved old values /
  the same values, but pass the list pointer that the Do has already released; the reference-resolution slots
  of this class are stubs that return 0. Whether undo works or faults was not determined (open question 4).
  The meaning of the four rectangle numbers (left, bottom, right, top versus another order) is inferred only
  from the normalisation (`r0 <= r2`, `r1 <= r3`).

### `AddPassInputFxOp`: SPEC-PARTIAL

- Purpose: add to an FX tree an input operator that reads the rendered image sequence of a render pass framebuffer.
- Arguments by position: 0 `FxTree` (interface `694e8500-...`), 1 `RenderPass` (interface `d233acd7-...`),
  2 `Framebuffer` (string, default ""; empty means "Main").
- Errors: a wrong `FxTree` or `RenderPass` returns the HRESULT of `fx_cmd::GetArgUnknownFromIdx` with no message text.
- Do (worker `0x180076740`):
  1. Null tree or pass: `0x80004003`.
  2. Read the pass's render range block (pass interface `b287db40-...`, slot 28): two integers `a`, `b` and a
     kind field. If the kind is not 1, log dictionary message `XSIFXCORE` `0x2d` ("Only passes set to render
     sequences can be added as input clips.") with severity 4 and return status **1** (no operator is created,
     the command does not fail).
  3. Framebuffer lookup: iterate the pass's framebuffers (slot 22 count, slot 23 item), compare each name
     (named-entity interface `9ee6ddb1-65cc-11d1-b0ce-00a024c79287`) case-insensitively with the requested name.
     No framebuffer or no match: `0x80070057`.
  4. Ask the framebuffer (slot 4, called with the "undefined" time constant and two zero flags) for a string
     `(inferred: the framebuffer's resolved output file name / sequence path)`.
  5. Create an operator of class `ca6f7760-1b1a-11d5-b93d-0800690c8bd0` and add it to the tree (tree slot 3).
  6. Set three parameters of the new operator, addressed by small integer ids: id 2 = the string of step 4;
     id 4 = `a`; id 5 = `b` `(inferred: file name, start frame, end frame)`.
  7. First run: store soft references to the tree, the pass and the new operator.
- Output: `Value` (`VT_UNKNOWN` / object) = the new operator.
- Undo: resolves the new operator, wraps it in a list and runs a `DeleteObj` task. Redo: resolves tree and pass
  and repeats the Do steps (a new operator object is created).
- Missing: the names of operator parameters 2, 4, 5 and the exact meaning of `a` / `b` (the operator's SPDL
  `C3DFxFileInputOp.spdl` has no parameter list in `data/spdl/spdl.json`); the pass and framebuffer methods are
  in other DLLs and were identified by use only.

### `StartFxTracking` / `CurrentFxTracking` / `StepFxTracking`: SPEC-PARTIAL

- Purpose: run the FX tracker of the inspected tracker operator(s) by driving the transport: from the start
  frame, from the current frame, or for one frame.
- Command GUIDs: `5d8144dd-a57a-4c55-8d04-b1f95cc9ac8f` StartFxTracking (mode 0);
  `dce412eb-891f-430f-9e2e-74b595c1de37` CurrentFxTracking (mode 1); `f9adae40-2ba8-4b34-9073-52f223420496`
  StepFxTracking (mode 2).
- Argument 0 `InspectedObjectsArray`: read as a variant. If it is an array, every element of type object
  (`VT_UNKNOWN`) is wrapped in an element reference and appended to a new list; other elements are ignored.
  An empty array or a non-array leaves the task without a list.
- Errors: unknown command GUID or any failure while building the list: `0x80070057` with the text
  "Argument must be a tracker operator". No list at Do time: `0x80004003`.
- Do (shared `0x18007e1e0`):
  1. For every operator in the list: fetch its sub-object `6de1b670-8072-11d5-aeed-0090275802c9`, get that
     object's parameter container, and if the container has the parameter with GUID
     `1569f817-8c17-4a80-a424-8b598cd4c9b9`, set it to boolean **True** and send a change notification for it
     `(inferred: the tracker's "tracking in progress" switch; its SPDL name was not resolved)`.
  2. Store a soft list reference to the operators (replacing any earlier one).
  3. Execute a transport command through `F3DCreateExecContext` / `F3DExecuteCmd` (command group
     `50830560-31b5-11d0-82e7-00a0243e268d`), with default arguments:
     mode 0 -> `PlayForwardsFromStart` (`080f8d80-842d-11d4-b7fc-0008c7a011a6`);
     mode 1 -> `PlayForwards` (`925347ac-6bc9-11d3-b7bd-0008c7a011a6`);
     mode 2 -> `NextFrame` (`e7ea7c32-24c9-11d3-bffa-00a0248f9397`). All three are `mcp.dll` commands.
  4. Register listeners: on each operator (slot 31 then slot 30 `(inferred: unregister, then register)`, masks `0x8000`, `0x80`,
     sink interface `dd50738a-32eb-11d2-8d70-00a0c982a649`), and on the application service object
     `3e57caba-2b4c-438b-89aa-eee5fe5bbf38` (sink `7265ae91-1263-11d0-a520-00a02419032e`)
     `(inferred: playback / transport notifications)`.
  5. Return status **1** (success, not `S_OK`).
- End of tracking (callbacks on the task object, not part of the command call):
  - service notification with flag bit 0 set and bit 16 clear (`0x18007e620`): the list reference is resolved,
    the parameter of step 1 is set back to **False** on every operator, and all listeners are removed;
  - operator notification with flag `0x80` (`0x18007e150`): the listeners are removed (the parameter is not touched there).
- Undo / Redo: not supported (`0x80004001`); command flags `0x800000`.
- Missing: the tracking computation itself (it happens in the tracker operator during playback, not in this
  command); the SPDL name of parameter `1569f817-...`; the exact events behind the two notification masks.

## Open questions

1. Value of the Do slot's second argument on a normal execution (assumed non-zero = first run); it is supplied by `sitaskcore.dll`.
2. `fx_cmd::GetConnectionFromName` (`FxCoreHelper.dll`): accepted names / numbers, and the result for an empty `Connection` string in `ConnectFxOp`.
3. `ConnectFxOp`: meaning of the per-input queries on interface `ab819dc0-...` (slot 10 guards the "disconnect the previous source" step; slots 7 / 8 / 11 select and test the boolean parameter that is switched on). Why "AllInputs" is accepted but does nothing.
4. `SetFxOpAttrib`: do Undo / Redo work, given that the Do releases the operator list before they can use it? Order of the 4 `Rect` numbers. Is `ShowThumbnail` handled elsewhere (it is a no-op here)?
5. `AddPassInputFxOp`: names of the File Input operator parameters with ids 2, 4, 5; what the framebuffer returns for the "undefined" time (frame padding token?); layout of the pass range block (slot 28).
6. Tracking: SPDL name of parameter `1569f817-8c17-4a80-a424-8b598cd4c9b9` (candidates in `Tracking_IllFx.spdl` are symbolic GUID names such as `GUID_ILLFX_Tracker_RetrackOnProcess`; not resolved).
7. 2D shape transform keys `(0x402, 3..9)`: the name mapping to `PosX .. Rotate` is inferred from the property page order, not from a GUID table.
8. `Add2DShapePoint` / `Insert2DShapePoint`: confirm on a golden that the returned `Value` is 1-based (binary adds 1 to the shape's index).

## New ledger rows

- 2D shape classes: Bezier shape `e0ca3fde-9f35-4c18-9a9d-5f355b3f87ca`, point shape `810998a1-1512-431e-98d3-b5bf95fc13c3`; shape interface `af1c239d-...` (add / remove point, count, transform), shape list `197ad418-...`. Their implementation (point storage, insert position rules) was not opened.
- `FxCoreHelper.dll` exports `fx_cmd::GetArgUnknownFromIdx`, `GetArgStringFromIdx`, `GetAsSafeArray`, `GetConnectionFromName`, `CreateListAddToList`: not opened.
- FX operator graph node interface `7aa64ec7-...` and per-input interface `ab819dc0-...`; output lookup helper `fxcore.dll!0x1800104a0`: not opened.
- File Input operator class `ca6f7760-1b1a-11d5-b93d-0800690c8bd0` and its parameter ids.
- Tracker operator: parameter `1569f817-...`, the tracking evaluation, and the listener interfaces (`dd50738a-...`, `7265ae91-...`, service `3e57caba-...`).
- Ambient value `FXSH_AUTOKEY_PTS` and preference `animation.autokey` (auto-key of shape transforms).
- Notification `FX_FXTOBJ_VISUALCHG` (FX tree node visual change).
- `DisconnectFxOp` (`c8530d7d-aecc-4232-b272-c50455c05f8a`, another worker's row): its class was opened by accident and these facts were read: creation `0x180002a50`, ctor `0x1800788d0`, task vtable `0x18010c4d0`, Do `0x180078ce0` -> worker `0x180078b40`, Undo `0x180078d40`, UnPackArg `0x180078f30`. Argument 0 must expose `473feb00-...`; argument 1 "AllInputs" or "All" set flags and make the worker do nothing; otherwise the name is resolved with `GetConnectionFromName`; an unconnected input returns `0x80020003`; the previous source is remembered and the input disconnected; Undo reconnects it. Errors (`0x80070057`): a wrong argument 0 raises the text "Argument 2 is not a valid connection name or number" (the "Argument must be an image operator" text is selected only by a state that cannot occur); an unresolved name or an output port returns `0x80070057` without text.
