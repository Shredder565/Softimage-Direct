# CMD-B9a: 2D paint commands read from `xsipaint.dll` (shape points and weights, shape key navigation, raster rectangle / ellipse, paint stores, stencil)

Row: **CMD-B9a**. Status: **SPEC** (13 names), **SPEC-PARTIAL** (2 names); per command below.
Run: 2026-11-17, `si-analyst`, unattended, batch 9 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLL).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\xsipaint.dll`, image base `0x180000000`,
sha256 `068ecf61ee1102a4edc5c2ead0a64b47c65e4194493b3cf34e6b99745c64526d`.
Method: CLSID bytes -> `DllGetClassObject` (`0x180001820`) -> class factory -> creation
function -> constructor -> vtables (local static, pefile + capstone); the task methods and
workers were then read in Ghidra (38 functions decompiled); small accessors, Do / Undo /
Redo trampolines and vtable tables were read locally. SPDL files
`FxPaintShapeKey.spdl`, `FxPaintSimpleCommandObj.spdl`, `FxPaintSelShapeObj.spdl`,
`FxPaintColorShapeObj.spdl` (from `Application\spdl`) were used for parameter names only.
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

All seven task classes derive from `sitaskcore.dll!C3DCoreBaseTask` (not the iterator
task). Object layout: `CDSCOMObject` at +0, task base at +0x18 (task vtable), a private
worker interface at +0x40 (+0x38 for the two argument-less commands). The task vtable has
14 slots: 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg, 11 ResolveRefForUndo,
12 ResolveRefForRedo, 13 release-references.

| Command(s) | Handler CLSID | Creation function (ctor, size) | Task vtable | Do / worker | Undo / Redo | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|---|
| `GetFirstPaintShapeKey`, `GetPrevPaintShapeKey`, `GetClosestPaintShapeKey`, `GetNextPaintShapeKey`, `GetLastPaintShapeKey` | `2bd686e4-d548-4a00-b317-0ae5cfbb23bb` | `0x18004d4c0` (ctor `0x18004cc00`, 0x70) | `0x18007f330` | Do `0x18004d700` -> worker interface `0x18007f3f0`: First `0x18004d440`, Prev `0x18004d7f0`, Closest `0x18004ce90`, Next `0x18004d500`, Last `0x18004d460`; shared bodies `0x18004cf50` (First / Last) and `0x18004d0d0` (Prev / Closest) | both `0x18004d7e0` (nothing to undo) | `0x18004d920` | `0x18004d8b0` -> `0x18003bea0` |
| `SetPaintStore`, `SetPaintMergeStore`, `SetPaintMaskStore` | `9da75f7c-ffaa-47a4-906f-846e6c223995` | `0x180044ea0` (ctor `0x180044970`, 0x180) | `0x1800781e0` | Do `0x180044ee0` -> `0x1800452f0` | Undo `0x180044f20`, Redo `0x180044f00` -> `0x1800452f0` | `0x180045570` | imported base |
| `RectanglePaintRaster`, `EllipsePaintRaster` | `30274025-9dd5-490c-b0e1-eae8e11b0a1f` | `0x180048dc0` (ctor `0x180048af0`, 0x280) | `0x18007b9e0` | Do `0x180048e00` -> `0x180049040` | Undo `0x180048ea0`, Redo `0x180048e50` -> `0x180049040` | `0x180049380` -> `0x180049480` | imported base |
| `IncPaintShapePointWeight`, `DecPaintShapePointWeight` | `722fb33e-7c86-4e27-a546-bf0514acba09` | `0x18004bc80` (ctor `0x18004b5d0`, 0xe8) | `0x18007e0a0` | Do `0x18004bcc0` -> Inc `0x18004bac0` / Dec `0x18004b940` | Undo `0x18004bde0` -> `0x18004bf30`, Redo `0x18004bd20` | `0x18004c0d0` | imported base |
| `ClearPaintSelection` | `56cf0363-eba7-49d0-be96-8861004dbeb7` | `0x180046f50` (ctor `0x180046aa0`, 0x48) | `0x180079580` | Do `0x180046f90` -> `0x180046c30` | imported `C3DCoreBaseTask::UndoTasks` / `RedoTasks` | none (returns 0) | imported base |
| `AddPaintShapePoint` | `6ffabcb8-27fc-4d19-8e9a-a5deffda85a0` (same as the command GUID) | `0x18003d340` (ctor `0x18003ced0`, 0x120) | `0x180073230` | Do `0x18003d380` -> `0x18003d190` -> shape method `0x18000d0e0` | Undo `0x18003d4b0`, Redo `0x18003d3e0` | `0x18003d630` | `0x18003d5a0` |
| `InvertPaintStencil` | `e75d6028-3a67-492c-9663-90ecfb0ff853` | `0x180047510` (ctor `0x180047060`, 0x88) | `0x180079e50` | Do `0x180046f90` -> `0x1800472d0` | Undo `0x180047560`, Redo `0x180047550` (re-runs Do) | none (returns 0) | imported base |

## 2. Shared facts

### 2.1 Telling commands apart

Three classes serve several commands. Their UnPackArg asks the exec context (interface
`26444edd-799f-11d2-8733-00a0c906816c`) for the GUID of the running command and stores a
mode number:

| Class | Command GUID | Command | Mode |
|---|---|---|---|
| shape key | `296043e1-521c-4032-8378-2b31c0582361` | GetFirstPaintShapeKey | 0 |
| shape key | `045cfb19-768c-4942-b476-fd28a04e60d4` | GetPrevPaintShapeKey | 1 |
| shape key | `190c7c43-67c6-4ad6-a98e-abe67fb170db` | GetClosestPaintShapeKey | 2 |
| shape key | `8308b7ea-7f68-4879-a3b1-0f94ec711d0b` | GetNextPaintShapeKey | 3 |
| shape key | `b53fd94f-df38-4795-a8c2-5388c4e1cd6b` | GetLastPaintShapeKey | 4 |
| store | `a6e3d0b2-79d4-45d6-aade-10cdf437e40f` | SetPaintStore | 0 |
| store | `d954c4ba-d743-42a7-a207-578b056abd2e` | SetPaintMergeStore | 1 |
| store | `e9a18d48-45a5-45a4-a998-24d67ad4cff2` | SetPaintMaskStore | 2 |
| raster | `2d94721a-a71c-4e1b-9f77-2c58536a52b9` | RectanglePaintRaster | 0 |
| raster | `d9fd3ed9-f25a-4809-a53e-2df6ae19afd8` | EllipsePaintRaster | 1 |
| weight | `e5a9fe03-cf96-4075-8db6-d1337385c2b4` | IncPaintShapePointWeight | 0 |
| weight | `58c5ac78-1eaf-4a75-9203-1e84c5ebd252` | DecPaintShapePointWeight | 1 |

For the raster class an unknown command GUID makes UnPackArg fail with `0x80070057`; the
other classes keep the constructor default mode.

### 2.2 First run versus redo

Every worker takes a "first run" flag. Do forwards the flag it receives; Redo calls the
same worker with the flag cleared (`InvertPaintStencil` is the exception: its Redo
re-enters Do with the flag set to 1). On the first run the worker records what Undo
needs (soft references made with `mohelper.dll!F3DCreateObjectReference`, saved values,
saved pixels); on redo it only repeats the edit.

### 2.3 Argument reading

- Object arguments are read by position with
  `FxCoreHelper.dll!fx_cmd::GetArgUnknownFromIdx(context, index, iid, &out)`.
  A "2D paint shape" is any object answering interface
  `38cdb432-012f-45d5-aa9f-f797f3519346`; an "fxtree operator" is any object answering
  `ab7fc1ae-411c-4f7c-b460-2cb0cb99b9f1` (this IID also occurs in `fxcore.dll`).
- When the object argument is not of the required kind the task raises (severity 2,
  code `0x80070057`) the literal message `Argument 1 must be a 2D paint shape` or
  `Argument 1 must be an fxtree operator` and UnPackArg returns `0x80070057`.
- Scalar arguments are read by position (exec context method at vtable offset 0x80) as
  variants; the tasks take the raw payload without converting the variant type
  (4 bytes for the `VT_R4` / `VT_I4` / `VT_BOOL` arguments, 8 bytes for `VT_R8` and `Time`).

### 2.4 Paint object model seen from these commands

- **Paint engine** singleton: generic object CLSID `158929f4-87ec-47fa-a601-e3e3ef4edcc4`
  (registered by this DLL under the name `FxPaintEngine`), interface
  `dccd437d-574d-4a92-933e-5eb5363c540f`, obtained with `dssdk10.dll!DSQueryGenericObject`.
  It holds three **store slots**, indexed 0 = paint store, 1 = merge store, 2 = mask
  store. Engine methods used: set slot (index, operator); get slot (index, iid, &out);
  get the raster of a slot (index); a getter at vtable offset 0xa0 whose result feeds the
  raster render context (not identified; `(inferred)` the current paint tool settings).
- **Current paint frame**: helper `0x180003340` takes the operator in store slot 0, asks
  it for its paint clip, asks the clip (interface `694e8500-1c07-11d5-b93e-0800690c8bd0`)
  for the element list of the frame at the current scene time (`sigeneral`
  `SIGetCurrentTime`), and returns that list under a requested interface. No paint store,
  no clip -> the helper returns nothing and the caller fails with `0x80004005`.
- **Paint elements** all answer interface `6799ddf0-632d-4a28-a9c6-0cb1006f7f19`. Its
  slot 4 is the "belongs to the stencil / selection" test: always true for
  `FxPaintSimpleCommandObj`; for shape objects true when the shape category field is 2,
  which the constructors of `FxPaintSelShapeObj` (CLSID `bfdd2f91-3616-4f4e-b3cc-2e90147a8e53`)
  and `FxMagicWandFillObj` (CLSID `7141681c-b014-4c06-b300-ea659cbe784f`) set.
- **`FxPaintSimpleCommandObj`** (CLSID `27b19bc3-3ba4-445d-8cf4-e34900dda81e`, SPDL
  `FxPaintSimpleCommandObj.spdl`): one integer parameter `Command`, 0 = "Clear Stencil",
  1 = "Invert Stencil"; element kind 3.
- **Shape** (interface `38cdb432-...`; classes `FxPaintColorShapeObj` CLSID
  `ab681861-3bd1-4a98-b28d-bec570d29f2b`, `FxPaintSelShapeObj`, `FxPaintStrokeShapeObj`
  and others share the implementation). Facts read:
  - a point count; per point a 16-bit record whose low byte is the **weight** and whose
    bit `0x100` marks the point as selected `(inferred: the bit selects the points the
    weight commands act on)`;
  - a curve type field: 0 for the ellipse (bezier with handles), 2 for the rectangle
    (straight segments) `(meaning of the numbers inferred from those two uses)`;
  - a "closed" flag;
  - a list of sub-shape start indices;
  - **shape keys**: child objects of class `FxPaintShapeKey` (CLSID
    `d5566c29-8e65-4c29-aea4-bdf99eb37b5b`, interface `a8dda35e-8e0c-4a58-bf86-bc20752367cf`)
    each with a `Time` parameter (`VT_R8`). Shape method `0x18000a340` collects the keys
    and sorts them by ascending time.
- Deletion is delegated to the `DeleteObj` task object (CLSID
  `dd531990-ccc2-11d2-ac73-00a02485cecb`, interface `dd531992-ccc2-11d2-ac73-00a02485cecb`),
  run on an object list with flags `0x10`.

## 3. Contracts

### `GetFirstPaintShapeKey` / `GetLastPaintShapeKey`: SPEC

- Purpose: return the first / last shape key of a 2D paint shape.
- Arguments: `Shape` (position 0; must be a 2D paint shape, see 2.3). Return: `Value`.
- Steps: collect the shape's keys sorted by time. No keys: `Value` is a null object.
  Otherwise the key at index 0 (First) or index count-1 (Last) is returned.
- `Value` is written by RePackArg as an automation object (`VT_DISPATCH`): the key's own
  `IDispatch` if it has one, otherwise the standard SDK wrapper created for it (CLSID
  `107dcd80-4228-11d0-8463-00a024c7919c`).
- The task also records the key time internally (a "no key" marker of the most negative
  double when the shape has no keys); it is not returned to the script.
- Nothing in the scene changes; Undo and Redo do nothing. Do returns status 1 (success,
  non-zero) in the normal case.
- Errors: wrong `Shape` -> message `Argument 1 must be a 2D paint shape`, `0x80070057`.

### `GetPrevPaintShapeKey` / `GetNextPaintShapeKey` / `GetClosestPaintShapeKey`: SPEC

- Arguments: `Shape` (position 0), `Time` (position 1, read as a double; argument handler
  `e9bae81a-9d13-11d3-8107-00a0c9ac19a9`). Return: `Value` (the key object, as above).
- Comparison uses the key `Time` values directly against the argument with a tolerance
  `eps = 1e-6`. Keys are in ascending time order; `n` = key count.
- No keys: `Value` is a null object.
- **Prev**: the last key whose time is less than `Time - eps`. If no key is earlier, the
  **first** key is returned (never an empty result while keys exist).
- **Next**: the first key whose time is greater than `Time + eps`. If no key is later,
  the **last** key is returned.
- **Closest**: candidate A = the last key with time less than `Time + eps` (i.e. at or
  before `Time`; the first key if none); candidate B = the first key with time greater
  than `Time - eps` (i.e. at or after `Time`; the last key if none). A is returned only
  when it is strictly nearer to `Time` than B; on a tie B (the later one) is returned.
- Read-only command, no undo data, Do status 1 on success.
- Errors: wrong `Shape`, or the `Time` argument cannot be fetched -> message
  `Argument 1 must be a 2D paint shape` (same text in both cases), `0x80070057`.

### `SetPaintStore` / `SetPaintMergeStore` / `SetPaintMaskStore`: SPEC

- Purpose: make an FxTree operator the paint engine's paint store (slot 0), merge store
  (slot 1) or mask store (slot 2).
- Argument: `FxOp` (position 0; must answer the fxtree operator interface, else message
  `Argument 1 must be an fxtree operator`, `0x80070057`). No return value.
- Do, first run:
  1. get the paint engine singleton (failure status is returned as is);
  2. read the current occupants of **all three** slots and keep them for undo: a soft
     reference per occupied slot plus an "was occupied" flag per slot; also keep a soft
     reference to `FxOp`;
  3. set the slot selected by the command to `FxOp`.
- Redo: step 3 only (after re-resolving `FxOp` from its soft reference).
- Undo: for each of the three slots that **was occupied** before the command, set it
  back to the previous occupant. A slot that was empty before is left as the command
  set it (it is not cleared). Returns 0.
- What the engine does when a slot changes (notifications such as the
  `FXPAINT_STORE_CHG` string present in the DLL, viewer refresh) is inside the engine's
  setter and was not read.

### `RectanglePaintRaster` / `EllipsePaintRaster`: SPEC-PARTIAL

- Purpose: rasterise a filled rectangle / ellipse straight into the raster of the
  current paint store (a destructive pixel edit, not a new vector shape in the list).
- Arguments (positions 0..4): `X1`, `Y1`, `X2`, `Y2` (single floats, default 0),
  `FromCenter` (boolean, default True; non-zero = true). No return value.
  Any argument that cannot be fetched -> `0x80070057`.
- Geometry (shape methods `0x18000f270` and `0x18000f0c0`, exact):
  - Rectangle, `FromCenter` false: corners `(X1,Y1)` and `(X2,Y2)`.
    `FromCenter` true: `(X1,Y1)` is the centre and `(X2,Y2)` one corner, so the opposite
    corner is `(2*X1 - X2, 2*Y1 - Y2)`.
    Four points in the order `(xa,ya)`, `(xb,ya)`, `(xb,yb)`, `(xa,yb)`, no handles, curve
    type 2, closed.
  - Ellipse, `FromCenter` true: centre `(X1,Y1)`; false: centre is the midpoint of the
    two input points. Radii `rx = |X2 - cx|`, `ry = |Y2 - cy|`. Four bezier points in the
    order `(cx, cy-ry)`, `(cx+rx, cy)`, `(cx, cy+ry)`, `(cx-rx, cy)` with handle offsets of
    `k = 0.551915` times the radius: first handle array `(-k*rx,0)`, `(0,-k*ry)`,
    `(k*rx,0)`, `(0,k*ry)`; second handle array the negatives of those. Curve type 0,
    closed.
- Do, first run:
  1. get the paint engine; get the operator in store slot 0 (interface
     `4112f688-05b3-425e-b880-dffb8ecbdbc9`); none -> `0x80004005`;
  2. create a temporary `FxPaintColorShapeObj`, initialise it, give it the geometry above
     (the temporary shape is never added to the clip);
  3. build a render context for the current scene time and render the shape into the
     store raster, capturing the pixels that were overwritten;
  4. keep the captured raster for undo: in memory when its buffer size is at most
     `0x40000` bytes, otherwise written to a temporary file and freed
     (`ufolib` raster API);
  5. if the changed pixel rectangle is defined, notify the store operator of that
     rectangle (operator method at vtable offset 0xb0).
  Result: 0 on success; `0x80004005` when the render reports failure; status 1 when the
  render produced no captured raster (nothing drawn).
- Redo: repeats steps 1-3 and 5 without capturing pixels.
- Undo: reload the saved raster (memory or file), copy it back over the same limits of
  the slot-0 raster, notify the store operator with that rectangle. Returns 0.
- **Not read (why PARTIAL)**: the renderer itself (`0x18001c790` was read only at
  dispatch level; `0x18001a500`, `0x18001db40`, `0x18001d8b0`, `0x18001e1d0`,
  `0x18001d570`, `0x18001e320` not opened). So the fill colour, opacity, fill style, edge
  blur, merge / mask use and stencil interaction of the drawn pixels are not established;
  `(inferred)` they come from the new colour shape's defaults and the engine's current
  tool settings. Read at dispatch level: nothing is drawn when the shape is disabled or
  its opacity is below 0.001.
- Coordinate space of `X1..Y2` (raster pixels versus normalised) was not established.

### `IncPaintShapePointWeight` / `DecPaintShapePointWeight`: SPEC

- Purpose: step the weight of the selected points of a paint shape up or down by one.
- Argument: `Shape` (position 0; 2D paint shape, else message
  `Argument 1 must be a 2D paint shape`, `0x80070057`). No return value.
- UnPackArg copies the shape's selected point index list (points whose record has bit
  `0x100`) into the task; the command acts on that snapshot.
- Do: for every index in the list read the point weight; **Inc**: if the weight is below
  3 write weight + 1; **Dec**: if the weight is above 1 write weight - 1. So the weight is
  kept inside 1..3 and points already at the limit are untouched. Each write triggers the
  shape's change notification. On the first run the previous weight of every listed point
  and a soft reference to the shape are saved. Do always returns 0.
- Undo: resolve the shape and write the saved weights back for the listed indices
  (helper `0x18004bf30`, read only partly). Redo: resolve the shape and repeat the
  step with the first-run flag cleared.
- An empty selection is not an error: nothing changes, 0 is returned.

### `AddPaintShapePoint`: SPEC

- Purpose: insert one point into a 2D paint shape.
- Arguments: `Shape` (position 0), `InsertPosition` (position 1, integer, default -1),
  `x`, `y` (positions 2, 3), `lhx`, `lhy` (4, 5), `rhx`, `rhy` (6, 7): doubles, default 0,
  narrowed to single floats. Return: `Value` (integer, `VT_I4`).
- Errors: wrong `Shape` or any argument that cannot be fetched -> message
  `Argument 1 must be a 2D paint shape`, `0x80070057`.
- Do calls the shape's insert-points method with one point: position `(x,y)`, first
  handle `(lhx,lhy)`, second handle `(rhx,rhy)`. Behaviour of that method
  (`0x18000d0e0`):
  - if `InsertPosition` is negative or greater than the current point count, the point
    is appended and the effective position is the old point count;
  - `Value` = the effective insertion index;
  - the point is inserted into the base point set, or, when the shape has shape keys,
    into **every** key at the same index;
  - the per-point record array gets a new entry at that index and the point count grows
    by one;
  - if the shape was empty and had no sub-shape list, a first sub-shape starting at
    index 0 is created; for a true insertion (not an append) every sub-shape start index
    at or after the insertion index is shifted by one;
  - the shape recomputes and notifies.
- On the first run a soft reference to the shape is saved. Do returns 0 (or the failure
  of creating that reference).
- Redo: resolve the shape and insert the same point at the same requested position
  again.
- **Undo does not remove the point**: it only resolves the shape reference and returns
  0 (read in full, `0x18003d4b0`). After Undo then Redo the shape therefore holds the
  point twice.

### `ClearPaintSelection`: SPEC

- Purpose: delete every stencil / selection element from the current paint frame.
- No arguments, no return value.
- Do:
  1. get the element list of the current paint frame (2.4); none -> `0x80004005`;
  2. enumerate its paint elements (enumerator CLSID
     `b5151190-5549-11d1-84c3-00a0243e3543`, filtered on the element interface) and
     collect those whose "stencil / selection" test is true: selection shapes, magic
     wand fills and simple commands (Clear Stencil / Invert Stencil entries);
  3. none collected: return status `0x562e8005` (non-negative, nothing done);
  4. otherwise run the `DeleteObj` task object on the collected list with flags `0x10`
     and, on the first run, register it as a sub-task of this command.
- Undo / Redo: the base task undoes / redoes the registered delete sub-task, i.e. the
  deleted elements come back / are deleted again.
- Colour shapes, strokes and other non-stencil elements are never touched.

### `InvertPaintStencil`: SPEC

- Purpose: append an "Invert Stencil" entry to the current paint frame.
- No arguments, no return value.
- Do:
  1. get the element list of the current paint frame under interface
     `dfdc2884-7530-4011-b17c-f0ea3c9ca382`; none -> `0x80004005`;
  2. create an `FxPaintSimpleCommandObj`, set its `Command` to 1 (Invert Stencil) and its
     name to `InvertStencil`;
  3. add it to the frame's element list (at the end `(inferred)`);
  4. on the first run (and again on every redo) store a soft reference to the new
     object.
  Returns 0, or the failing status of creation / naming / referencing.
- Undo: resolve the reference and delete that object through the `DeleteObj` task
  object (flags `0x10`, not registered as a sub-task).
- Redo: runs Do again, which creates a **new** simple command object.
- The stencil itself is not recomputed by the command; the inversion happens when the
  frame's element list is evaluated `(inferred from the element being a list entry)`.

## Open questions

1. Unit of `Time` in the three key navigation commands and of the key `Time` parameter
   (frames or seconds). The task compares the two raw doubles; the conversion, if any,
   is in the argument handler `e9bae81a-...` outside this DLL.
2. Renderer for `RectanglePaintRaster` / `EllipsePaintRaster`: fill colour, opacity,
   style, blur, merge / mask stores, stencil (functions listed in the contract).
3. Coordinate space of the raster command arguments and of `AddPaintShapePoint`
   (`x`, `y`, handles: absolute or relative to the point). The ellipse builder passes
   handle values that are offsets from the point, which suggests relative handles.
4. Meaning of point weight values 1, 2, 3 for the curve evaluation.
5. Paint engine setter side effects (events, viewer refresh, validation of the operator
   type for each slot).
6. `AddPaintShapePoint` Undo is empty in this build; whether Softimage relies on another
   mechanism to restore the shape was not found in this DLL.
7. The exact status value Do receives as "first run" flag from the task framework
   (`sitaskcore.dll`), assumed non-zero on the first execution.
8. Default / omitted-argument behaviour of the `Shape` and `FxOp` arguments (object
   handler `7834cb8c-5252-11d2-a5cc-00a0c91412de`, outside this DLL).

## New ledger rows

- `FxPaintEngine` generic object (CLSID `158929f4-87ec-47fa-a601-e3e3ef4edcc4`,
  interface `dccd437d-574d-4a92-933e-5eb5363c540f`): store slots 0 / 1 / 2, slot rasters,
  tool settings.
- Paint element classes registered by `xsipaint.dll` with their SPDL: `FxPaintShapeList`
  (`097675e8-b6d9-4fa1-bfaf-f8ec032b64f7`), `FxPaintColorShapeObj`, `FxPaintSelShapeObj`,
  `FxPaintSimpleCommandObj`, `FxPaintStrokeShapeObj` (`bd8b8f3a-fa84-4e4e-9c2b-a67485dae837`),
  `FxPaintClearImageShapeObj` (`dbdcb5d7-6771-4e38-9825-cc781eac971f`), `FxFloodFillRGBObj`
  (`2476b3ca-48df-408b-ad33-f737e774ac37`), `FxMagicWandFillObj`, `FxPaintBrushObj`
  (`e74e26ec-fe10-4384-8aae-08300106c6e3`), `FxPaintShapeKey`, `FxPaintToolSettings`
  (`79eebe8e-0aba-4240-a033-6b02858250d9`), `FxPaintClip`
  (`79b85547-dc6c-477e-a61b-0deeaacc70c0`), `FxClipCache`
  (`eb07aa30-c011-4d53-bbf1-5747528bd3ec`), `FxPaintDropShadow`
  (`62614b0a-11ce-485b-83c3-4d01676d281c`).
- Paint shape interface `38cdb432-012f-45d5-aa9f-f797f3519346` (65 methods; read here:
  rectangle `0x18000f270`, ellipse `0x18000f0c0`, get / set point weight `0x180009610` /
  `0x18000c3a0`, selected point list `0x18000a250`, key list `0x18000a340`, insert
  points `0x18000d0e0`).
- Paint raster render context and renderers (`0x18001a500`, `0x18001c790` and callees),
  undo raster store helpers (`0x180042e10` in memory, `0x180043be0` on disk).
- Helpers of other DLLs relied on by name: `FxCoreHelper.dll!fx_cmd::GetArgUnknownFromIdx`,
  `fx_cmd::CreateListAddToList`, `fx_cmd::AddToList`; `mohelper.dll!F3DCreateObjectReference`,
  `F3DResolveObjectReference`; `ufolib.dll` raster functions.
