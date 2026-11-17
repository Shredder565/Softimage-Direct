# CMD-B9c: 2D paint commands read from `xsipaint.dll` (paint masks, shape point selection, paint colours, brush, raster line / flood fill, Matador shape list import)

Row: **CMD-B9c**. Status: **SPEC** (14 names), **SPEC-PARTIAL** (1 name: `FloodFillRaster`); per command below.
Run: 2026-11-17, `si-analyst` worker, unattended, batch 9 (binary first: REA + Ghidra 12.1.4 on the PC, plus local static reads of the same DLL with `pefile` / `capstone`).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\xsipaint.dll`, image base `0x180000000`, sha256 `068ecf61ee1102a4edc5c2ead0a64b47c65e4194493b3cf34e6b99745c64526d` (PDB reference `XSIPaint.pdb`, not loaded).
Method: CLSID compare chain in `DllGetClassObject` (`0x180001820`) -> class-factory creator -> instance creation (factory vtable slot 6) -> constructor -> task vtable; then Ghidra decompilation of Do / Undo / Redo / UnPackArg / RePackArg and the worker methods (50 functions decompiled; two tiny ones, a thunk and a stub, read by local disassembly). All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

All eight classes derive from `CDSCOMObject` + `sitaskcore.dll!C3DCoreBaseTask`. Object layout: COM object vtable at +0x00, **task vtable at +0x18**, `I3DTask` vtable at +0x38, a class-specific worker interface at +0x40. Task vtable slots: 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg, 13 ReleaseWorkingData.

| Command(s) | Handler CLSID | Factory creator / instance creation / ctor | Task vtable | Do / Undo / Redo | UnPackArg | RePackArg | Workers |
|---|---|---|---|---|---|---|---|
| `RectangularPaintMask`, `EllipticalPaintMask`, `MagicWandPaintMask`, `AddPaintMaskShape` | `ccce0968-ef9e-4828-b55a-b4c37b22bde0` | `0x180045be0` / `0x180045f10` / `0x180045690` | `0x180078c60` | `0x180045f50` / `0x180046120` / `0x180046030` | `0x180046590` -> `0x1800468f0` (rect, ellipse), `0x1800467b0` (wand), `0x1800466c0` (shape) | `0x18004a2e0` -> `0x18003bea0` | worker vtable `0x180078d18`: `0x180046240` (rect / ellipse), `0x180045ca0` (wand), `0x1800458f0` (lasso shape); clear-selection helper `0x180045b30`; current-list lookup `0x180003340` |
| `SetPaintColor`, `ResetPaintColor`, `SwapPaintColors` | `46f73afb-6e8a-41f6-adba-0f74f5a0d698` | `0x18004ad40` / `0x18004ae00` / `0x18004ab90` | `0x18007d6f0` | `0x18004ae40` / `0x18004afe0` / `0x18004af10` | `0x18004b400` | imported base | `0x18004b2e0` (set), `0x18004b140` (reset), `0x18004b370` (swap), `0x18004b220` (restore both, not decompiled); colour-holder lookup `0x180003520` |
| `SelectPaintShapePoint`, `TogglePaintShapePointSelection`, `AddToPaintShapePointSelection` | `e9fc9ffe-c411-4119-8868-f9a497d86908` | `0x1800440c0` / `0x180044180` / `0x180043dd0` | `0x1800778e0` | `0x1800441c0` / `0x1800442d0` / `0x180044220` | `0x1800446c0` | `0x180047050` (returns 0) | `0x180044500` (select / add), `0x1800445e0` (toggle), selection snapshot `0x180044420` |
| `FloodFillRaster` | `2612bc0f-435a-425d-8f43-a2e80a3ece66` | `0x180047890` / `0x180047c10` / `0x1800476c0` | `0x18007a770` | `0x180047c50` / `0x180047c90` / `0x180047c70` | `0x180047e70` | imported base | `0x180047910` |
| `PaintRasterLine` | `414b4ea8-91f3-43fe-b78d-104e5bd27bb7` | `0x1800482a0` / `0x180048360` / `0x180047fa0` | `0x18007b080` | `0x1800483a0` / `0x180048460` / `0x180048400` | `0x1800488e0` | imported base | `0x1800485b0` |
| `ImportMatadorShapeList` | `6a95269b-c073-495e-a535-ec1d42364afd` | `0x18003f620` / `0x180040570` / `0x18003f1c0` | `0x180074ee0` | `0x1800405b0` / `0x1800406f0` (stub) / `0x180040630` | `0x180040e30` | `0x180047050` (returns 0) | parser `0x18003fa30`; ReleaseWorkingData `0x1800407d0` |
| `InsertPaintShapePoint` | `b0cead3d-6d8f-4348-a4da-e50cd799e5f8` | `0x180041260` / `0x180041410` / `0x180040fd0` | `0x180075b00` | `0x180041450` / `0x180041510` / `0x180041480` | `0x1800416c0` | `0x180041630` | `0x1800412e0` |
| `SetPaintBrush` | `fd108e2b-b7bb-4cd0-8d9e-c7a9d40afede` | `0x18004a750` / `0x18004a810` / `0x18004a560` | `0x18007ccf0` | `0x18004a850` / `0x18004a920` / `0x18004a8c0` | `0x18004ab10` | imported base | `0x18004aa30` |

## 2. Shared facts

### 2.1 Dispatch and argument reading

- Arguments are read **by position** (exec-context slot 16, "get argument by index") in the order of the registry argument list, not by name. Object arguments go through `FxCoreHelper.dll!fx_cmd::GetArgUnknownFromIdx(ctx, index, IID, out)`; strings through `fx_cmd::GetArgStringFromIdx`; arrays through `fx_cmd::GetAsSafeArray`.
- Classes that serve several commands ask the exec context (interface `26444edd-799f-11d2-8733-00a0c906816c`, slot 15) for the GUID of the running command and compare it with constants.
- Every worker takes a "first run" flag. Do forwards the value it receives from the base task (non-zero on a normal execution `(inferred)`); Undo / Redo pass an explicit constant, noted per command. The flag decides whether undo data (old values, raster copies, object references) is captured.

### 2.2 Objects and interfaces used

| GUID | Role (as used here) |
|---|---|
| object `158929f4-87ec-47fa-a601-e3e3ef4edcc4`, interface `dccd437d-574d-4a92-933e-5eb5363c540f` | The **paint manager**, a generic (singleton) object fetched with `DSQueryGenericObject`. Methods used: slot 4 = get the current paint target as a given interface; slot 5 = current destination raster (a `ufolib` raster); slot 7 = a second raster used by the fill renderer (mask raster `(inferred)`); slot 12 = prepare / sync before raster access `(inferred)`; slot 16 = set the current brush id; slots 19 / 20 = set / get a paint context value saved and re-applied around a stroke. The class itself is served by `xsipaint.dll`. |
| `ab7fc1ae-411c-4f7c-b460-2cb0cb99b9f1` | Current paint target (paint clip / operator) as returned by manager slot 4; its slot 10 gives an object whose interface `694e8500-1c07-11d5-b93e-0800690c8bd0` (slot 9) returns the item valid at a given time. |
| `4112f688-05b3-425e-b880-dffb8ecbdbc9` | Current paint target as "raster owner": slot 22 takes an integer rectangle and marks it damaged / refreshes it. |
| `dfdc2884-7530-4011-b17c-f0ea3c9ca382` | **Paint shape list** (also the type required for `ImportMatadorShapeList.ShapeList`): slot 12 = append a shape. |
| `38cdb432-012f-45d5-aa9f-f797f3519346` | **2D paint shape** interface (required type of every `Shape` argument). Slots used: 5 set shape type, 7 set point count, 8 set a per-point float-pair array (0 positions, 1 and 2 tangents), 9 set per-point RGBA, 10 set per-point type bytes, 12 set rectangle, 13 set ellipse, 20 point count, 35 per-point 16-bit flag array, 46 set point selection, 51 set key at frame `(inferred)`, 53 add points, 56 insert point, 57 undo insert. |
| `c028c42f-53cb-4a86-a955-90275ee24d33` | Mask-shape properties: slot 6 takes (SelectionAction, AntiAliased, Feather). |
| `9ee6ddb1-65cc-11d1-b0ce-00a024c79287` | Naming interface: slot 8 sets the object name. |
| class `bfdd2f91-3616-4f4e-b3cc-2e90147a8e53` | Mask shape used for rectangle, ellipse and lasso masks (class served by `xsipaint.dll`). |
| class `7141681c-b014-4c06-b300-ea659cbe784f` | Magic-wand mask shape (the DLL carries the strings `FxMagicWandFillObj` / `FxMagicWandFillObj.spdl`). |
| class `2476b3ca-48df-408b-ad33-f737e774ac37` | Flood-fill shape (same CLSID as the registry handler of `AddFloodFillPaintShape`). |
| class `ab681861-3bd1-4a98-b28d-bec570d29f2b` | Colour paint shape (same CLSID as the registry handler of `AddColorPaintShape`). |
| class `56cf0363-eba7-49d0-be96-8861004dbeb7`, interface `a72f9ef5-0fe9-4a99-a3bd-ed13866b831c` | The `ClearPaintSelection` command task, instantiated directly as a nested task. |
| class `dd531990-ccc2-11d2-ac73-00a02485cecb`, interface `dd531992-ccc2-11d2-ac73-00a02485cecb` | The `DeleteObj` task class (outside this DLL), used for mask undo. |
| class `e068b6f5-cc79-48c4-92b1-1a265aca7190`, interface `2da18cf0-2bc2-4911-a215-a60245f63187` | **Paint colour holder**, looked up in (or created into) the 3D content container (`ut.dll!SIGet3DContentContainer`). Slots: 9 get foreground, 10 get background, 11 set foreground, 12 set background; each colour is four floats (R, G, B, A). |
| object `8b72a420-74cb-11ce-90a9-00aa006297d6`, interface `9ad72910-d69a-11cf-b64a-00a024191ae0` | Generic notification object; slot 6 is called with the string `WSZ_FXPAINT_COLOR_CH` after every colour change. |

### 2.3 "Current mask shape list" lookup (`0x180003340`)

Used by the four mask commands. Steps: read the current time (`SIGetCurrentTime`); ask the paint manager for the current paint target (`ab7fc1ae-...`); from it get the time-indexed container and the item for the current time; query that item for the requested interface (here the shape list `dfdc2884-...`). If any link is missing the lookup yields nothing and the caller fails with `0x80004005`. Which list (mask list versus colour shape list of the clip) the paint target returns is decided inside the paint target object and was not read.

### 2.4 Error strings carried by the DLL (raised through `CSIErrorHandling::Raise`, severity 2)

`Argument 1 must be a 2D paint shape`; `Argument 1 must be a paint shape list`; `Argument 2 a file name`; `Matador shape list file "%s" not found`; `File "%s" is not a Matador shape list file`; `Error reading Matador shape list file "%s"`.

## 3. Contracts

### `RectangularPaintMask` / `EllipticalPaintMask` / `MagicWandPaintMask` / `AddPaintMaskShape`: SPEC

- Purpose: create one mask (selection) shape in the mask shape list of the current paint target at the current time and return it. One class; the variant is chosen by command GUID: `59e137b7-...` rectangle (type 0), `bcb28e7d-...` ellipse (type 1), `63d89390-...` magic wand, `6f6aef02-...` free ("lasso") shape. Any other GUID fails with `0x80070057`.
- Arguments (by position):
  - Rectangle / ellipse: `X1`, `Y1`, `X2`, `Y2` (floats), `FromCenter` (bool; registry default False for rectangle, True for ellipse), `SelectionAction` (int, default 0), `AntiAliased` (bool; default False rectangle, True ellipse), `Feather` (int, default 0).
  - Magic wand: `SeedX`, `SeedY` (floats), `SelectionAction`, `AntiAliased` (default True), `Feather`.
  - AddPaintMaskShape: `SelectionAction`, `AntiAliased` (default True), `Feather`.
  - `SelectionAction` is clamped: any value above 3 (unsigned compare, so negatives too) becomes 0.
  - Any failed argument read returns `0x80070057`.
- Do, in order:
  1. If `SelectionAction == 0`: create the `ClearPaintSelection` task, execute it, and when it returns exactly `S_OK` on a first run attach it as a sub-task (so it is undone with this command). A failure aborts with that status. For actions 1 to 3 the existing mask is kept.
  2. Create the shape object: class `bfdd2f91-...` for rectangle, ellipse and lasso; class `7141681c-...` for magic wand.
  3. Look up the current mask shape list (2.3). None: return `0x80004005`.
  4. Append the shape to the list.
  5. On a first run store an object reference to the new shape in the task (for Undo). Failure returns that status.
  6. Geometry and name: rectangle -> shape "set rectangle" with (X1, Y1, X2, Y2, FromCenter), name `RectSelect`; ellipse -> "set ellipse" with the same five values, name `EllipseSelect`; magic wand -> add exactly one point (SeedX, SeedY), name `MagicWand`; AddPaintMaskShape -> no geometry at all (an empty shape to be filled by the point commands), name `Lasso`.
  7. Apply (SelectionAction, AntiAliased, Feather) through the mask-properties interface.
  8. Keep the shape as the result.
- Return: output argument `Value` = the created shape as an object (dispatch). If no shape was produced the argument is written as an empty object.
- Undo: resolve the stored shape reference, put it in a one-item list, run the `DeleteObj` task class on that list (flag value `0x10`), then undo and drop the attached sub-tasks (which restores the cleared selection). Redo: runs the worker again as a first run (a new shape is created and referenced again).
- Not established: meaning of SelectionAction 1, 2, 3 (replace is 0; the others are presumably add / subtract / intersect) and how FromCenter interprets the two corner points; both live in the shape / mask classes.

### `SelectPaintShapePoint` / `AddToPaintShapePointSelection` / `TogglePaintShapePointSelection`: SPEC

- Purpose: change which points of one 2D paint shape are selected.
- Variant by command GUID: `e6234ebc-...` Toggle, `75f4c2b1-...` AddTo, anything else (i.e. `9614edb8-...`) plain Select.
- Arguments: `Shape` (index 0) must expose the paint-shape interface `38cdb432-...`; otherwise error `0x80070057` is raised with the text `Argument 1 must be a 2D paint shape`. `Indices` (index 1): when it is an array, every element is converted to a 32-bit integer and stored as the index list; when it is not an array the index list is left empty and the command still succeeds. A failed element conversion returns `0x80070057` (no message).
- Do:
  1. Null shape: `0x80070057`.
  2. On a first run snapshot the current selection: walk the shape's per-point flag array (one 16-bit word per point) and record the indices whose bit `0x100` is set. Bit `0x100` is therefore the "point selected" flag.
  3. Call the shape's "set point selection" method with (index list, count, mode): mode **0** = replace the selection (Select), **2** = add to the selection (AddTo), **1** = toggle the listed points (Toggle).
  4. On a first run store an object reference to the shape.
- Return value: none (RePackArg is a no-op returning 0).
- Undo: resolve the shape reference and replace the selection (mode 0) by the snapshot taken in step 2. Redo: resolve the reference and repeat step 3 with the original arguments, without a new snapshot.
- Indices are not range-checked in the command; out-of-range handling is inside the shape.

### `InsertPaintShapePoint`: SPEC

- Purpose: insert one point into a contour of a 2D paint shape and return its index.
- Arguments: `Shape` (index 0, paint-shape interface), `InsertPosition` (double, default 0.0), `Contour` (int, default 0). Any failed read (shape of the wrong type, or either scalar) raises `0x80070057` with `Argument 1 must be a 2D paint shape`.
- Do: discard any undo record kept from an earlier run; call the shape's "insert point" method with (Contour, InsertPosition) which returns the new point index and hands back an undo record kept in the task; on a first run store an object reference to the shape.
- Return: output argument `Value` (VT_I4) = the index returned by the shape.
- Undo: resolve the shape reference; if an undo record exists, call the shape's "undo insert" method. Redo: resolve the reference and insert again (treated as a first run; the returned index is not re-published).
- `InsertPosition` is passed through unchanged as a double; it is a position along the contour (parametric: integer part = segment, fraction = position inside it) `(inferred from the name; the shape method was not read)`.

### `SetPaintColor` / `ResetPaintColor` / `SwapPaintColors`: SPEC

- One class; mode by command GUID: `186d895a-...` set (0), `c7c4e657-...` reset (1), `bd58dd33-...` swap (2).
- Arguments: only `SetPaintColor` reads arguments: `Red`, `Green`, `Blue`, `Alpha` as four floats (defaults 0.0), no clamping in the command.
- All three work on the paint colour holder (2.2). If it cannot be obtained the worker returns `0x8000ffff`.
- `SetPaintColor`: on a first run save the current foreground colour; set the foreground colour to (Red, Green, Blue, Alpha). The background colour is untouched.
- `ResetPaintColor`: on a first run save foreground and background; set foreground to (1, 1, 1, 1) and background to (0, 0, 0, 0).
- `SwapPaintColors`: read foreground and background and write them back exchanged.
- After any successful Do / Undo / Redo the notification object is told `WSZ_FXPAINT_COLOR_CH` (colour changed; the UI colour selector listens `(inferred)`).
- Undo: set -> restore the saved foreground; reset -> restore saved foreground and background `(inferred from the argument list of 0x18004b220, which was not decompiled)`; swap -> swap again. Redo: repeat without re-saving.
- No return value. An unknown mode returns `0x80004005`.

### `SetPaintBrush`: SPEC

- Argument: `Brush` (string, default empty) = brush name.
- Do: on a first run read the current brush id (`matador.dll!PubInqEnvCurrentBrush`) and keep it; convert the name to a narrow string and look it up with `matador.dll!PubInqBrushIDFromName`; an id below 1 (unknown name, or empty name) returns `0x80004005` with no message; otherwise tell the paint manager to make that id the current brush (missing manager: `0x8000ffff`).
- Undo: tell the paint manager to make the saved id current. Redo: repeat the lookup and set (returns status 1 instead of 0).
- No return value.

### `PaintRasterLine`: SPEC

- Purpose: paint one straight brush stroke segment into the current paint raster.
- Arguments: `x1`, `y1`, `p1`, `x2`, `y2`, `p2` (floats, default 0.0): the two end points in raster pixels and a per-end value passed in the third slot of the stroke point structure (pressure `(inferred from the name and position)`). A failed read returns `0x80070057`.
- The class recognises a second command GUID, `bd0841de-4047-439b-a0c9-1b7c7dc900a4` (not present in the command registry): for it no arguments are read and Do / Redo return success without doing anything. Any other GUID: `0x80070057`.
- Do:
  1. Get the paint manager, its current paint context value, the current paint target (raster owner) and, after the manager's prepare call, the current destination raster. No target or no raster: `0x80004005`.
  2. Re-apply the context value, then compute the integer rectangle touched by the stroke from the two end points (helper `0x1800481b0`, uses the current brush footprint `(inferred)`). An empty result: `0x80004005`.
  3. On a first run copy that rectangle of the raster (`ufolib.dll!ufoRasterAllocCopyPart`) and title the copy `PaintRasterLine Undo`.
  4. Paint with `matador.dll!PubPaintLine(point1, point2)` using the current brush, colour and paint settings of the Matador paint environment.
  5. Tell the paint target that the rectangle changed.
- Undo: copy the saved raster part back into the current destination raster at its own limits and signal that rectangle. Redo: steps 1, 2, 4, 5 without taking a new copy.
- No return value.

### `FloodFillRaster`: SPEC-PARTIAL

- Arguments: `xSeed`, `ySeed` (floats, default 0.0). A failed read returns `0x80070057`.
- Do (read):
  1. Paint manager, context value, current paint target and destination raster as for `PaintRasterLine`; missing target or raster: `0x80004005`.
  2. Create a temporary flood-fill shape (class `2476b3ca-...`), initialise it and give it exactly one point, the seed.
  3. Build a shape renderer for the current time and the paint context, give it the destination raster and the manager's second raster.
  4. First run: render the shape with undo capture (a raster copy is kept in the task) and fetch the modified rectangle. Redo: render without capture.
  5. Renderer failure: `0x80004005`. If the modified rectangle is defined, tell the paint target it changed.
- Undo: identical to `PaintRasterLine` (copy the saved part back, signal the rectangle).
- No return value. The temporary shape is not added to any shape list: the fill is burnt into the raster.
- **Missing**: the renderer (`0x18001a500`, `0x18001c9c0`, `0x18001c790`, `0x18001d280`) and the flood-fill shape class were not read, so the fill rule (tolerance, which colour / opacity is written, connectivity, anti-aliasing, whether the mask is obeyed) is not established.

### `ImportMatadorShapeList`: SPEC

- Purpose: read a Matador `.sl` text file and append its shapes to a paint shape list.
- Arguments: `ShapeList` (index 0) must expose the shape-list interface `dfdc2884-...`, else `0x80070057` raised with `Argument 1 must be a paint shape list`; `FileName` (index 1) must be non-empty, else `0x80070057` raised with `Argument 2 a file name`; `DestWidth`, `DestHeight` (doubles, default 0.0); a failed read of either returns `0x80070057` without a message.
- File format as parsed (text, whitespace-separated tokens read with C `scanf` conversions; file opened in text read mode):
  1. First integer. If it equals **2302941** (`0x2323dd`) the file is the animated layout: the rest of that line (up to 200 characters) is skipped and the next integer is the version field. Otherwise the first integer is itself the version field and the file is the single-key layout. The version field is stored negated: `version = -field`.
  2. `version >= 5`: two integers, source width and height. When `DestWidth` and `DestHeight` are both non-zero, x coordinates are multiplied by `DestWidth / width` and y coordinates by `DestHeight / height`; otherwise no scaling.
  3. `version >= 7`: one integer; the value 3 switches the shape-kind mapping below.
  4. Animated layout only: key count (must be `>= 1`).
  5. Per key: (animated layout only) the key frame as an integer; then the shape count. After the shapes of a key, one more integer is read and ignored.
  6. Per shape: point count and a type code. Type codes: 1 -> kind 2, flag on; 5 -> kind 2, flag off; 3 -> kind 1 (kind 0 when the step-3 value is 3), flag on; 4 -> same kind choice, flag off; any other code is a read error. (The kind / flag pair is handed to the shape's "set type" method; their meaning, e.g. curve type and closed / open, was not read.) `version >= 8`: two more text lines follow, the first holding an integer, the second the shape name; the name defaults to `Shape<index>`. The parsed name is not applied to the shape in the code read.
  7. Per point: x, y, point type (an extra float between y and the type is skipped when `version < 2`); a point type outside 1..3 becomes 1. Then `version >= 6`: four floats (two tangent pairs) followed by three floats R G B; `version` 3 to 5: three floats R G B; `version` 2: three integers R G B divided by 255; `version < 2`: colour (1, 1, 1). Alpha is always 1; tangents are 0 below version 6. Only x and y are scaled; tangent values are stored as read.
- Do: open the file. The shape objects (class `ab681861-...`, colour paint shape) are created once, when the first key is read, one per shape of that key. For every shape of every key: set type, point count, positions, the two tangent arrays, per-point colours and per-point types; in the animated layout also set a key on the shape at that key's frame `(inferred from the call taking the frame)`; while reading the first key append the shape to `ShapeList`.
- Errors: file cannot be opened -> `0x80030002` raised with `Matador shape list file "<name>" not found`; first integer (or the version after the magic) unreadable -> raised as `0x80004005` with `File "<name>" is not a Matador shape list file`; any later read failure, unknown type code or key count below 1 -> `0x80004005` with `Error reading Matador shape list file "<name>"`. Shapes appended before an error stay in the list.
- Return value: none. **Undo is a stub that returns success without removing anything.** Redo resolves a stored shape-list reference and runs the import again (see open question 6).

## Open questions

1. `SelectionAction` values 1, 2, 3 of the mask commands: the command only clamps to 0..3 and treats 0 as "clear first"; the combine modes are implemented in the mask shape / compositor.
2. Which shape list of the current paint target the lookup in 2.3 returns, and what happens when the current viewer is not a paint clip (the lookup simply fails with `0x80004005`).
3. `FloodFillRaster` fill rule and inputs (see the contract).
4. `PaintRasterLine`: the stroke rectangle helper `0x1800481b0` and `matador.dll!PubPaintLine` were not read (brush stamping, spacing, pressure mapping).
5. `InsertPaintShapePoint.InsertPosition` units; shape methods 56 / 57 not read.
6. `ImportMatadorShapeList` Redo resolves an object reference that the code read never stores; whether redo works or fails was not determined. Meaning of the shape kind / flag pair and of the point type values 1..3 (corner / smooth variants presumably).
7. The unregistered command GUID `bd0841de-4047-439b-a0c9-1b7c7dc900a4` accepted by the `PaintRasterLine` class as a no-op.
8. Whether Do's flag argument is literally "first run" or the exec-context pointer; either way it is non-zero on a normal execution.

## New ledger rows

- Paint manager generic object `158929f4-87ec-47fa-a601-e3e3ef4edcc4` (served by `xsipaint.dll`): current target, rasters, current brush, paint context.
- Paint colour holder class `e068b6f5-cc79-48c4-92b1-1a265aca7190` (foreground / background RGBA; defaults after reset: white opaque / black transparent) and the `WSZ_FXPAINT_COLOR_CH` notification.
- Paint shape classes served by `xsipaint.dll`: mask shape `bfdd2f91-...`, magic-wand shape `7141681c-...` (`FxMagicWandFillObj.spdl`), flood-fill shape `2476b3ca-...`, colour shape `ab681861-...`; the 2D paint shape interface `38cdb432-...` (about 58 methods) and the shape-list interface `dfdc2884-...`.
- Shape renderer `0x18001a500` family (used by flood fill; probably shared with the vector paint operator).
- `matador.dll` paint engine exports used here: `PubPaintLine`, `PubInqBrushIDFromName`, `PubInqEnvCurrentBrush`; `ufolib.dll` raster helpers `ufoRasterAllocCopyPart`, `ufoRasterCopyPart`, `ufoRasterGetLimits`, `ufoRasterSetTitle`.
- `FxCoreHelper.dll!fx_cmd::*` argument helpers (`GetArgUnknownFromIdx`, `GetArgStringFromIdx`, `GetAsSafeArray`, `CreateListAddToList`).
- Matador `.sl` shape list file format (versions 1 to 8, single-key and animated layouts) as recorded above.
