# CMD-B9b: 2D paint / FX paint shape commands read from `xsipaint.dll` (add shapes, brush stroke, clear image, point and handle edits)

Row: **CMD-B9b**. Status: **SPEC** (12 names), **SPEC-PARTIAL** (3 names); per command below.
Run: 2026-11-17, `si-analyst`, unattended, batch 9 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLL with `pefile` / `capstone`).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\xsipaint.dll`, image base `0x180000000`,
sha256 `068ecf61ee1102a4edc5c2ead0a64b47c65e4194493b3cf34e6b99745c64526d`.
Method: `DllGetClassObject` (`0x180001820`) compare chain read locally to map each handler
CLSID to its class-factory constructor; class-factory and task vtables read locally; the
task methods (UnPackArg, workers, Undo) decompiled in Ghidra (30 functions); the small Do /
RePackArg / Redo thunks read locally as instruction listings. Parameter names and enum
items come from the paint SPDLs in `data/spdl/spdl.json`. All statements are behaviour read
from the binary unless marked `(inferred)`.

## 1. Handler table

All seven classes are `C3DCoreBaseTask` subclasses. Task vtable slots: 5 Do, 6 Undo, 7 Redo,
8 UnPackArg, 9 RePackArg. Do is a short thunk that forwards the stored arguments to a
worker reached through a secondary interface of the task object (at task + 0x28).

| Command(s) | Handler CLSID | Class factory ctor / instance creator / task ctor | Task vtable | Do -> worker | Undo / Redo | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|---|
| `AddColorPaintShape`, `AddFxMaskShape`, `AddFloodFillPaintShape`, `AddAlphaFloodFillPaintShape`, `AddBoundaryFillPaintShape` | `6ca3aa0b-9967-40a8-ad6c-ff1644ad1539` | `0x18003dfa0` / `0x18003e060` / `0x18003d890` | `0x180073bc0` | `0x18003e0a0` -> `0x18003dbc0` | `0x18003e150` / `0x18003e0c0` | `0x18003e4a0` | `0x18003e480` -> `0x18003bea0` |
| `AddBrushStroke` | `e890d4ec-48cd-4abc-9a37-11a9ddca18d9` | `0x18003bd50` / `0x18003c440` / `0x18003ac90` | `0x180072830` | `0x18003c480` -> `0x18003b0d0` (stroke reuse test `0x18003c1d0`) | `0x18003c5c0` / `0x18003c4f0` | `0x18003cad0` | `0x18003ca30` -> `0x18003bea0` |
| `ClearImage`, `DeleteAllPaintShapes`, `AddClearImageShape` | `e2252486-5ef1-44cc-8703-d311971256f0` | `0x180043120` / `0x1800434e0` / `0x180042680` | `0x180076f30` | `0x180043520` -> `0x180042e80` (ClearImage) / `0x1800431a0` (DeleteAll) / `0x180042a80` (AddClearImageShape) | `0x180043620` / `0x180043560` | `0x180043ac0` | `0x180043a90` -> `0x18003bea0` |
| `DeletePaintShapePoints` | `7ae8bd3a-9a52-4a45-bdb5-31217e3d0bed` | `0x18003e9e0` / `0x18003ec10` / `0x18003e6a0` | `0x1800745a0` | `0x18003ec50` -> `0x18003ea60` | `0x18003ed20` / `0x18003ec80` | `0x18003ee60` | none (`0x180047050` returns 0) |
| `AddRectanglePaintShape`, `AddEllipsePaintShape` | `48d67c0e-b397-4c62-80fe-304a6253a46d` | `0x180049d80` / `0x180049e40` / `0x1800495d0` | `0x18007c350` | `0x180049e80` -> `0x180049910` (geometry builders `0x18000f270` rectangle, `0x18000f0c0` ellipse) | `0x180049fb0` / `0x180049ee0` | `0x18004a300` -> `0x18004a400` | `0x18004a2e0` -> `0x18003bea0` |
| `TranslatePaintShapePoint` | `65aff90b-a34e-40fa-92bd-386c90116b78` | `0x18004c570` / `0x18004c630` / `0x18004c260` | `0x18007e9f0` | `0x18004c670` -> `0x18004c850` | `0x18004c790` / `0x18004c6d0` | `0x18004c9b0` | none (`0x180047050`) |
| `MovePaintShapeHandle`, `SetPaintShapeHandle` | `ff7c5cd6-d75d-445c-81ba-93db1f591c65` | `0x180041a10` / `0x180041ad0` / `0x1800417d0` | `0x180076470` | `0x180041c80` -> `0x180041b10` (Move) / `0x180041f30` (Set) | `0x180041db0` / `0x180041cf0` | `0x1800420c0` | none (`0x180047050`) |

Shared helpers: `0x18003b5f0` (prepare a shape list before a new shape is appended),
`0x18003bea0` (store an object into the `Value` output argument), `0x180003520` (fetch /
create the paint tool settings object), `0x180043be0` (raster undo snapshot writer).

## 2. Shared facts

### 2.1 Classes and interfaces

| GUID | What | Source |
|---|---|---|
| `dfdc2884-7530-4011-b17c-f0ea3c9ca382` | Paint shape list interface. Every `ShapeList` argument must expose it. | read |
| `097675e8-b6d9-4fa1-bfaf-f8ec032b64f7` | Shape list class `FxPaintShapeList` (SPDL property set `PaintShapes`; parameter `ListType`: 0 Paint Shapes, 1 Mask Shapes, 2 Paint Selection; `InvertShapes`). | DllGetClassObject + SPDL |
| `38cdb432-012f-45d5-aa9f-f797f3519346` | Paint shape interface. Every `Shape` argument must expose it; every created shape is requested through it. | read |
| `ab681861-3bd1-4a98-b28d-bec570d29f2b` | `ColorShape` class (`FxPaintColorShapeObj`). Equal to the `AddColorPaintShape` command GUID. | DllGetClassObject + SPDL |
| `2476b3ca-48df-408b-ad33-f737e774ac37` | `FloodFill` class (`FxPaintFloodFillRGBObj`). Equal to the `AddFloodFillPaintShape` command GUID. | same |
| `bd8b8f3a-fa84-4e4e-9c2b-a67485dae837` | `StrokeShape` class (`FxPaintStrokeShapeObj`); stroke interface `4e454da8-36e4-41e2-935f-f372a51afc57`. | same |
| `dbdcb5d7-6771-4e38-9825-cc781eac971f` | `WipeShape` class (`FxPaintClearImageShapeObj`; Color RGBA, MaskSource). | same |
| `27b19bc3-3ba4-445d-8cf4-e34900dda81e` | `SimpleCommand` class (`FxPaintSimpleCommandObj`; parameter `Command`: 0 Clear Stencil, 1 Invert Stencil); interface `f3b799e0-5d35-4fc3-ae35-e8b47f88f5a5`; list item interface `6799ddf0-632d-4a28-a9c6-0cb1006f7f19`. | same |
| `e068b6f5-cc79-48c4-92b1-1a265aca7190` (interface `2da18cf0-2bc2-4911-a215-a60245f63187`) | Paint tool settings object, stored in the 3D content container `cdca9820-c753-11d2-b926-00a024c78ee3` and created on first use (`0x180003520`). | read |
| `158929f4-87ec-47fa-a601-e3e3ef4edcc4` (interface `dccd437d-574d-4a92-933e-5eb5363c540f`) | Paint session singleton, obtained with `DSQueryGenericObject`; gives the current paint raster, the current view target and the foreground / background colours. Probably the class named `FxPaintEngine` in the string table `(inferred)`. | read |
| `dd531990-ccc2-11d2-ac73-00a02485cecb` | `DeleteObj` task (slot 9 takes a list and flags; flags `0x10` used here). | read, name from CMD-B8e |
| `747d257f-d01b-11d2-80c4-00a0c9ac19a9` | `SIDuplicate` task. | read, name from the registry |
| `26444edd-799f-11d2-8733-00a0c906816c` | Exec-context interface that returns the GUID of the command being run and the argument count. | read |

### 2.2 One class, several commands

The Add family, the ClearImage family, the Rectangle / Ellipse class and the handle class
ask the exec context for the running command GUID and branch on it:

- Add family: the command GUID is kept and later used **as the CLSID of the shape to
  create** (`SICreateInstance(command GUID, shape interface)`). `xsipaint.dll` itself serves
  only two of the five: `ab681861...` (ColorShape) and `2476b3ca...` (FloodFill). The GUIDs
  `a566f19f-8b81-47b0-8881-edaa5f3e477a` (AddFxMaskShape),
  `b782e121-111a-47d6-b83d-50bedc63f001` (AddAlphaFloodFillPaintShape) and
  `37ef12d9-7824-4e73-a0ea-e46e42d4178c` (AddBoundaryFillPaintShape) are not in its
  `DllGetClassObject` chain; the last two do not occur anywhere in the DLL image.
- ClearImage family: `97e7739c...` ClearImage, `36be596a...` DeleteAllPaintShapes,
  `839fc9d7...` AddClearImageShape; any other GUID is rejected with `0x80070057`.
- Rectangle / Ellipse: `3849c00a...` rectangle (kind 0), `a7db1b28...` ellipse (kind 1); any
  other GUID is rejected with `0x80070057`.
- Handles: `e5c6254e...` selects the Set variant; anything else is the Move variant.

### 2.3 Argument reading

- Object arguments are read by position with `FxCoreHelper.dll!fx_cmd::GetArgUnknownFromIdx`
  (index 0), asking for the list or the shape interface. Scalars are read by position as
  variants; reals arrive as doubles and are narrowed to 32-bit floats inside the task.
- Error raising: `CSIErrorHandling::Raise(0x80070057, severity 2, text)`; the texts are
  literal strings in the DLL (quoted per command). UnPackArg returns `0x80070057` in every
  failure case, with or without a message.

### 2.4 Preparing the list before a shape is appended (`0x18003b5f0`)

Called by every command that appends a shape (Add family, AddClearImageShape,
AddBrushStroke, Rectangle / Ellipse) with the list and the current time
(`SIGetCurrentTime`). It returns an integer tag that the caller writes into the new shape
(shape slot 49), optionally one auto-created object, and optionally a list of duplicates.

1. If the list does not expose the list interface: tag -1, nothing else.
2. Case A, taken when the list's kind query (list slot 8) answers 0 **and** the list has at
   least one item at the current time **and** the last item is not a SimpleCommand whose
   command value is 0 (Clear Stencil): a new `SimpleCommand` object is created, its command
   set to 0 (Clear Stencil), it is appended to the list and handed back to the caller; tag
   is -1. If creating or initialising it fails, nothing is appended.
3. Case B, every other situation (kind not 0, empty list, or last item already a Clear
   Stencil command): the list's "item at this time" query (slot 11) gives a reference
   item; its tag is read (shape slot 48, or slot 7 of interface
   `c028c42f-53cb-4a86-a955-90275ee24d33` when the shape's slot-4 flag is set). The items
   at the current time are scanned from the end towards the start until one carries that
   tag. Every item after the match is duplicated with the `SIDuplicate` task, each
   duplicate is appended to the list and collected into the returned list. The returned
   tag is the tag of the last item of the list. With no reference item the tag stays -1
   and all items are after "the match".

What the tag means (stacking group, key, undo position) was not established: see Open
question 1.

### 2.5 Undo bookkeeping shared by the shape-creating commands

On the first run (Do passes a non-zero flag, Redo passes 0) the worker stores soft
references (`mohelper.dll!F3DCreateObjectReference` / `F3DCreateListReference`) to: the
list, the new shape, the auto-created Clear Stencil command if any, and the list of
duplicates if any. A reference that cannot be created fails the command with that status.

Undo resolves them and, in this order: deletes the new shape with the `DeleteObj` task
(flags `0x10`); deletes the auto-created Clear Stencil command the same way if it still
resolves; deletes the duplicates the same way if that list is non-empty. Redo resolves the
list reference and runs the worker again with the first-run flag clear (so new objects are
created again and no references are rewritten).

### 2.6 `Value` output (`0x18003bea0`)

The created or reused shape is written to the argument named `Value` as an object
variant: the object's `IDispatch` is used when it has one, otherwise it is wrapped through
the scripting object factory (`107dcd80-4228-11d0-8463-00a024c7919c`, interface
`872903d0-3ef3-11d0-8463-00a024c7919c`) and the wrapper's `IDispatch` is stored.

### 2.7 Shape interface slots used (interface `38cdb432...`, ColorShape vtable `0x1800634c0`)

Slot numbers are zero-based vtable indices; meanings are from how the callers use them.

| Slot | Use |
|---|---|
| 6 | initialise a freshly created shape |
| 7 | clear the shape's points (argument 0) |
| 12 / 13 | build rectangle / build ellipse (ColorShape) |
| 20 | point count |
| 26 | shape kind; 0 is required by the handle commands (Bezier) |
| 29 | read a handle position: (1 left / 2 right, point index) |
| 31 | sub-stroke query: (stroke index) -> first point index and point count |
| 46 | set the selected-point index array (indices, count) |
| 47 | get the selected-point index array and its count |
| 48 / 49 | get / set the integer tag of section 2.4 |
| 53 | insert points: (insert index, -1 = append; count; positions; left handle offsets; right handle offsets; one more optional array) |
| 54 | append a stroke: (point count, positions, three optional arrays, out: stroke index) |
| 55 | set stroke pressures: (stroke index, count, pressures) |
| 58 | move components: (0 point / 1 left handle / 2 right handle; relative flag; index array; count; one x,y pair; optional buffer receiving the old values; trailing flag 1) |
| 59 | move one handle with a mode: (1 left / 2 right; point index; mode 0..3; x,y pair; flag 1) |
| 60 / 61 | delete points (indices, count, out: undo blob) / restore points from that blob |

List interface slots used: 7 and 8 kind queries, 10 items at a time (time, out array,
flag), 11 item at a time, 12 append item.

## 3. Contracts

### `AddColorPaintShape` / `AddFloodFillPaintShape`: SPEC

Arguments: `ShapeList` (object list handler, required), `Value` (output). The flood fill
form adds `SeedX`, `SeedY` (doubles, default 0) between them.

- UnPackArg:
  1. Reads the running command GUID and keeps it.
  2. Argument 0 must expose the paint shape list interface, otherwise error
     `0x80070057`, text `Argument 1 must be a paint shape list`.
  3. The list's kind (list slot 7) must be 0. A non-zero kind returns `0x80070057`
     without a message.
  4. If the command has exactly 4 arguments (the flood fill forms), arguments 1 and 2 are
     read as the seed position and narrowed to floats, and a "has seed" flag is set. With
     any other argument count there is no seed. A failed seed read gives `0x80070057` with
     the text of step 2.
- Do (worker `0x18003dbc0`), in order:
  1. Reads the current time and prepares the list (section 2.4).
  2. Obtains the paint session singleton; if that fails the command returns its status
     and nothing else happens (the objects created by step 1 stay in the list).
  3. Creates an object whose CLSID is the command GUID (ColorShape for
     AddColorPaintShape, FloodFill for AddFloodFillPaintShape), initialises it, appends it
     to the list and writes the tag from step 1 into it. The creation result is not
     checked before use.
  4. First run only: records the undo references (section 2.5).
  5. If a seed was read: inserts one point at the end of the shape at (SeedX, SeedY), no
     handles.
  6. Keeps the shape as the result.
- No parameter of the new shape is set by the command; colours, fill style and tolerance
  come from the class defaults / tool settings applied by the shape's own initialisation
  `(inferred: slot 6 was not opened)`.
- Return: `Value` = the new shape object (section 2.6). Undo / Redo: section 2.5.

### `AddAlphaFloodFillPaintShape` / `AddBoundaryFillPaintShape`: SPEC-PARTIAL

- Same handler, same UnPackArg and same Do steps as `AddFloodFillPaintShape` (4 arguments,
  so the seed point is always inserted); the only difference is the CLSID created in
  step 3: `b782e121-111a-47d6-b83d-50bedc63f001` and
  `37ef12d9-7824-4e73-a0ea-e46e42d4178c`.
- Missing: neither CLSID is served by `xsipaint.dll` (the bytes are absent from the
  image), so the class that gets created, its parameters and whether it is registered at
  all were not read. If creation fails the worker uses the null result (no check).

### `AddFxMaskShape`: SPEC-PARTIAL

- Same handler as `AddColorPaintShape`, 2 arguments (`ShapeList`, `Value`), no seed. The
  shape CLSID would be the command GUID `a566f19f-8b81-47b0-8881-edaa5f3e477a`, which
  `xsipaint.dll` does not serve.
- UnPackArg as read: after the list-interface check, when the command is AddFxMaskShape
  and the list kind (slot 7) is not 1 the command fails with `0x80070057`, text
  `Argument 1 must be a mask shape list`. When the kind is 1 the next test still requires
  kind 0, so the command returns `0x80070057` without a message. As read, no list kind
  lets this command reach Do.
- Missing: what list slot 7 returns for each `ListType` was not read (it is implemented by
  the list class), so the "always rejected" reading is not confirmed against the list
  implementation; and the class behind `a566f19f...` was not located.

### `AddClearImageShape`: SPEC

Arguments: `ShapeList` (required), `Value` (output).

- UnPackArg: argument 0 must expose the list interface, else `0x80070057` (no message).
- Do (worker `0x180042a80`), in order:
  1. If the list does not expose the list interface: `0x8000ffff`.
  2. If the list's kind (slot 8) is 0 and the paint tool settings flag at offset 0x48 of
     its settings block is false: all shapes currently in the list are deleted first,
     exactly as `DeleteAllPaintShapes` does (its "nothing to delete" status is accepted);
     a failure aborts.
  3. Reads the current time, prepares the list (section 2.4).
  4. Creates a `WipeShape` (`dbdcb5d7...`); failure to create gives `0x8007000e`.
     Initialises it, appends it to the list, writes the tag.
  5. First run: records the undo references.
- Return: `Value` = the WipeShape. Undo: section 2.5, then the nested delete task of step 2
  is undone (`UndoTasks`). Redo: nested tasks are cleared and the worker runs again.

### `DeleteAllPaintShapes`: SPEC

Argument: `ShapeList` (required).

- UnPackArg: argument 0 must expose the list interface, else `0x80070057` (no message).
- Do (worker `0x1800431a0`): takes the list's items at the current time (flag 0), puts
  every non-null item into a new object list and runs the `DeleteObj` task on it with
  flags `0x10`. On the first run the delete task is registered as a sub-task of this
  command (`C3DCoreBaseTask::AddTask`).
- Return: 0. If the list has no items the worker returns the positive status `0x562e8005`
  and deletes nothing. A failing list build or delete task returns that failure.
- Undo / Redo: `UndoTasks` / `RedoTasks` of the registered delete task.

### `ClearImage`: SPEC

No arguments.

- UnPackArg: accepts the command without reading anything.
- Do (worker `0x180042e80`), in order:
  1. Obtains the paint session singleton (failure is returned), then from it the current
     view target (interface `4112f688-05b3-425e-b880-dffb8ecbdbc9`) and the current paint
     raster. If either is missing: `0x80004005`.
  2. Creates a temporary `WipeShape` with its class defaults and initialises it. It is
     never added to a list.
  3. Builds a render context for the current time on that raster (with the session's
     current mask / stencil source).
  4. First run: snapshots the whole raster for undo (section below).
  5. Renders the WipeShape into the raster. If rendering reports failure: `0x80004005`.
  6. If the changed rectangle is defined, tells the view target to refresh that rectangle.
- Return: 0. No scene object is created or changed; only pixels of the current paint
  raster.
- Undo: reloads the snapshot, copies it back into the current raster at the saved limits
  and refreshes that rectangle. Redo: runs the worker again (no new snapshot).
- Undo snapshot (`0x180043be0`): a file in the Windows temp folder created with prefix
  `SRHUNDO_`, written as a 24-byte header of six 32-bit values (the four raster limits,
  the buffer size in bytes, the pixel type) followed by the raw raster buffer. If the file
  cannot be written the snapshot is kept in memory as a raster copy instead. A previous
  snapshot of the same task is freed / deleted first.

### `AddBrushStroke`: SPEC

Arguments: `ShapeList` (required), `Points`, `Pressure`, `index` (output, long), `Value`
(output).

- UnPackArg (every failure: `0x80070057`, text `Argument 1 must be a 2D paint shape list`):
  1. Argument 0 must expose the list interface.
  2. `Points` must convert to an array with a non-zero, even number of elements. Each
     element is coerced to a 32-bit float; elements are x, y, x, y, ... giving
     count / 2 points.
  3. `Pressure`: empty -> one pressure value 1.0; a single real (float or double) -> that
     one value; otherwise it must be an array whose length equals the number of points,
     each element coerced to float.
  4. The `index` argument is not read as input.
- Do (worker `0x18003b0d0`), in order:
  1. Fetches the paint tool settings object, its current brush object and that brush's
     identifier, and the settings block.
  2. Reads the current time and prepares the list (section 2.4).
  3. Reuse test (`0x18003c1d0`): the list's item at the current time is reused when it is
     a stroke shape and all of these match the current state: its brush identifier; its
     two stored colours against the session's colour 1 and colour 2; its 16-byte stroke
     setting against the settings block (offsets 0x28 / 0x30); three shape draw settings
     (an integer and two flags) against the settings block (offsets 0x24, 0x48, 0x49).
  4. If nothing is reused: the paint session singleton is obtained (failure returned), a
     `StrokeShape` is created (`0x8007000e` if that fails), initialised, appended to the
     list, given the current brush identifier and the tag of step 2; the task remembers
     that it created the shape.
  5. First run: records the undo references (list, stroke shape, auto Clear Stencil
     command, duplicates).
  6. Appends the points to the stroke shape as one new sub-stroke (shape slot 54) and
     receives that sub-stroke's index; then sets its pressures (slot 55) with the pressure
     array (1 or N values).
- Return: `Value` = the stroke shape (new or reused); `index` (argument 3) = the
  sub-stroke index as a long.
- Undo (`0x18003c5c0`): if the shape was reused, the points of the added sub-stroke are
  removed by running the `DeletePaintShapePoints` task class on the shape with the
  consecutive point indices reported for that sub-stroke; if the shape was created by the
  command it is deleted with `DeleteObj` (flags `0x10`). Then the auto Clear Stencil
  command and the duplicates are deleted as in section 2.5. Redo: resolves the list and
  runs the worker again.

### `AddRectanglePaintShape` / `AddEllipsePaintShape`: SPEC

Arguments: `ShapeList` (required), `X1`, `Y1`, `X2`, `Y2` (floats, default 0),
`FromCenter` (boolean, default True), `Value` (output).

- UnPackArg: picks rectangle or ellipse from the command GUID (section 2.2); argument 0
  must expose the list interface; arguments 1 to 4 are taken as 32-bit floats, argument 5
  as a boolean (non-zero = true). Any failure: `0x80070057`, no message.
- Do (worker `0x180049910`), in order:
  1. Reads the current time, prepares the list (section 2.4).
  2. Obtains the paint session singleton; failure is returned.
  3. Creates a `ColorShape` (`ab681861...`), initialises it, appends it to the list, writes
     the tag.
  4. First run: records the undo references.
  5. Builds the geometry and names the shape:
     - Rectangle (`0x18000f270`), name `Rectangle`. With `FromCenter` true, (X1, Y1) is the
       centre and (X2, Y2) one corner: the corners become (X1 - dx, Y1 - dy) and
       (X1 + dx, Y1 + dy) with dx = X2 - X1, dy = Y2 - Y1. With `FromCenter` false the two
       points are opposite corners as given. The shape's spline type field is set to 2,
       existing points are cleared, and four points are appended in the order
       (x1, y1), (x2, y1), (x2, y2), (x1, y2) with no handles; the shape is marked closed.
     - Ellipse (`0x18000f0c0`), name `Ellipse`. With `FromCenter` true the centre is
       (X1, Y1); with false it is the midpoint of the two points. Radii: rx = |X2 - cx|,
       ry = |Y2 - cy|. The spline type field is set to 0, existing points are cleared and
       four Bezier points are appended in the order (cx, cy - ry), (cx + rx, cy),
       (cx, cy + ry), (cx - rx, cy). Handle offsets (relative to each point) use
       k = 0.551915: left handles (-k rx, 0), (0, -k ry), (k rx, 0), (0, k ry); right
       handles (k rx, 0), (0, k ry), (-k rx, 0), (0, -k ry). The shape is marked closed.
- Return: `Value` = the ColorShape; 0 on success. Undo / Redo: section 2.5.

### `DeletePaintShapePoints`: SPEC

Arguments: `Shape` (required), `index` (optional).

- UnPackArg (every failure: `0x80070057`, text `Argument 1 must be a 2D paint shape`):
  argument 0 must expose the shape interface. `index`: empty -> the shape's currently
  selected point indices; a long -> that single index; otherwise it must convert to a
  non-empty array whose elements are coerced to longs.
- Do (worker `0x18003ea60`), in order: frees any earlier undo blob; saves the shape's
  current point selection; clears the selection; asks the shape to delete the listed
  points and to hand back an undo blob (shape slot 60); on the first run stores a soft
  reference to the shape.
- Return: 0 (a failing soft reference returns its status). No output argument.
- Undo: resolves the shape, restores the deleted points from the blob (slot 61) and
  restores the saved selection. Redo: runs the worker again.

### `TranslatePaintShapePoint`: SPEC

Arguments: `Shape` (required), `x`, `y` (doubles, default 0), `Delta` (siDeltaMode,
default siRelative).

- UnPackArg: argument 0 must expose the shape interface, else `0x80070057` with text
  `Argument 1 must be a 2D paint shape`. `x` and `y` are narrowed to floats. `Delta` is
  stored as a flag (true when its integer value is greater than 0). The shape's currently
  selected point indices are copied into the task. A failed scalar read returns
  `0x80070057` without a message.
- Do: skipped (returns 0) when the base task field at offset 0x34 is non-zero; otherwise
  the worker `0x18004c850` runs: a null shape gives `0x80070057`; on the first run a
  buffer for the old positions of the selected points is allocated; the shape moves the
  selected points (component 0) by (x, y); on the first run a soft reference to the shape
  and a private copy of the index array are stored.
- The move is always issued as a relative translation: the worker passes the relative
  flag as the constant "true" and never reads the stored `Delta` flag. So
  `Delta = siAbsolute` behaves like siRelative as read.
- With no selected points the shape is called with an empty index array (no change
  `(inferred)`).
- Return: 0. Undo: resolves the shape and issues one component-move call with the saved
  data (argument decoding not read; restores the old positions `(inferred)`). Redo: runs
  the worker again.

### `MovePaintShapeHandle` / `SetPaintShapeHandle`: SPEC

Move arguments: `Shape`, `Point` (long), `Handle` (long), `x`, `y` (doubles), `Mode`
(long). Set arguments: `Shape`, `Point` (long), `lhx`, `lhy`, `lrx`, `lry` (doubles). All
defaults 0.

- UnPackArg (all errors `0x80070057`):
  1. Variant chosen by the command GUID (section 2.2).
  2. Argument 0 must expose the shape interface and the shape's kind (slot 26) must be 0,
     else text `Argument 1 must be a 2D bezier paint shape`.
  3. Move: `Handle` must be 1 (left) or 2 (right), else text
     `Handle must be 1 for left or 2 for right`; `Mode` must be 0, 1, 2 or 3, else text
     `Invalid mode`. `x`, `y` are narrowed to floats.
  4. Set: (`lhx`, `lhy`) is the left handle value, (`lrx`, `lry`) the right handle value,
     narrowed to floats.
  5. `Point` must satisfy 0 <= Point < point count, else text `Point index out of range`
     (the same text is raised when a scalar argument cannot be read).
- Do, Move (worker `0x180041b10`): re-validates shape, point, handle and mode
  (`0x80070057` on violation); on the first run saves the current left and right handle
  values of the point; asks the shape to move the chosen handle of that point with
  (x, y) and the mode (shape slot 59); on the first run stores a soft reference to the
  shape.
- Do, Set (worker `0x180041f30`): re-validates shape and point; on the first run saves
  both handle values; sets the left handle (component 1) and then the right handle
  (component 2) of that single point to the given values with the relative flag false
  (absolute values in the shape's handle convention); on the first run stores the soft
  reference.
- Return: 0. No output argument.
- Undo: resolves the shape and issues two component-move calls (left, right) from the
  saved values. Redo: runs the same worker again.
- The effect of each `Mode` value (0..3) is decided inside the shape (slot 59) and was not
  read: Open question 3.

## Open questions

1. Meaning of the integer tag handled in section 2.4 (shape slots 48 / 49, interface
   `c028c42f-53cb-4a86-a955-90275ee24d33` slot 7) and why items after the reference item
   are duplicated before a new shape is appended.
2. `AddFxMaskShape`: what list slot 7 returns per `ListType`, and which DLL (if any)
   serves CLSID `a566f19f-8b81-47b0-8881-edaa5f3e477a`. As read the command cannot pass
   UnPackArg.
3. `MovePaintShapeHandle`: semantics of `Mode` 0..3 and whether x, y are absolute or
   relative for each mode (shape slot 59).
4. Which DLL serves `b782e121-111a-47d6-b83d-50bedc63f001` (alpha flood fill) and
   `37ef12d9-7824-4e73-a0ea-e46e42d4178c` (boundary fill), and their parameters.
5. What the shape's initialisation (slot 6) copies from the tool settings into a new
   ColorShape / FloodFill / StrokeShape / WipeShape (colours, fill style, tolerances,
   opacity), and the difference between list slot 7 and list slot 8 (both are kind
   queries compared with 0).
6. `SetPaintShapeHandle`: whether the handle values are offsets from the point or absolute
   image positions (the ellipse builder passes offsets to the insert call; the convention
   of the component-move call was not read).
7. `TranslatePaintShapePoint`: the base task field at offset 0x34 that makes Do a no-op,
   and the exact arguments of the Undo call.
8. The paint tool settings flag at settings offset 0x48 that suppresses the automatic
   "delete all shapes" step of `AddClearImageShape` (also compared by the brush stroke
   reuse test).
9. Names of the temp-file fields "pixel type" values (`ufolib.dll` raster API) if the
   snapshot format ever needs to be reproduced.

## New ledger rows

- `FxPaintShapeList` object (`097675e8...`, list interface `dfdc2884...`): list slots 7,
  8, 10, 11, 12 and the `ListType` / `InvertShapes` parameters.
- Paint shape classes served by `xsipaint.dll`: ColorShape `ab681861...`, SelShape
  `bfdd2f91...`, SimpleCommand `27b19bc3...`, StrokeShape `bd8b8f3a...`, WipeShape
  `dbdcb5d7...`, FloodFill `2476b3ca...`, MagicWand `7141681c...`, Brush `e74e26ec...`
  (and `20d8a705...`), PaintShapeKey `d5566c29...`, tool settings `e068b6f5...`
  (and `79eebe8e...`), FloodFillTemplate `ee641152...`, DropShadow `62614b0a...`, plus
  `79b85547...`, `eb07aa30...` (not identified).
- Paint session singleton `158929f4-87ec-47fa-a601-e3e3ef4edcc4` (current raster, view
  target, colours 1 and 2, mask source).
- Shape render context helpers `0x18001a500`, `0x18001c790`, `0x18001d280` (render one
  shape into a raster and report the changed rectangle), not opened.
- `FxCoreHelper.dll` exports used: `fx_cmd::GetArgUnknownFromIdx`, `fx_cmd::GetAsSafeArray`,
  `fx_cmd::CreateListAddToList`, `fx_cmd::AddToList`.
- `ufolib.dll` raster exports used by the undo snapshot: `ufoRasterGetLimits`,
  `ufoRasterGetBufferSize`, `ufoRasterGetPixelType`, `ufoRasterGetBufferAddress`,
  `ufoRasterAllocCopy`, `ufoRasterAllocCopyPart`, `ufoRasterCopyPart`, `ufoRasterFree`.
- Other task classes in the same `DllGetClassObject` chain, not in this batch's list:
  `bab9aa0e...`, `6ffabcb8...`, `b0cead3d...`, `ccce0968...`, `56cf0363...`, `e75d6028...`,
  `9da75f7c...`, `414b4ea8...`, `2612bc0f...`, `30274025...`, `46f73afb...`, `fd108e2b...`,
  `722fb33e...`, `6a95269b...`, `e9fc9ffe...`, `2bd686e4...`, `9de75182...`, `65996f6b...`,
  `d0d02c17...`, `275f2c85...`.
