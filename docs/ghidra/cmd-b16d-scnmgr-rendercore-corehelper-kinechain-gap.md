# CMD-B16d: selection-filter command maps (`scnmgr.dll`), `CopyPartition` / `RegenerateMaps` (`rendercore.dll`), `CreateEnvironmentCache` (`corehelper.dll`), `GetSkeleton` (`kinechain.dll`), `PaintWeights` (`gap.dll`)

Row: **CMD-B16d**. Status: **SPEC** 2 (`MarkObjectDirty`, `GetSkeleton`), **SPEC-PARTIAL** 10 (the 8 filter-mapped
commands `Mesh Filter`, `Dice Object/Polygons`, `Delete Selected` (filter row), `Duplicate/Extrude Single`,
`Duplicate/Extrude Multiple`, `Invert Polygons`, `Move Component Tool`, `Subdivide`; `CopyPartition`, `RegenerateMaps`),
**handler not located** 1 (`CreateEnvironmentCache`: not in `corehelper.dll`), **not examined** 1 (`PaintWeights`, time).
Run: 2026-11-20, si-analyst worker, unattended, batch 16 (binary first, REA + Ghidra).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binaries (opened one at a time, each closed):
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\scnmgr.dll`, sha256
  `f0aaf17d262f7517c9e4e2ff0f68f6acc93a80acbab94d9a7e3d8ecbb4d4b07e`.
- `...\bin\rendercore.dll`, sha256 `df47a0fda7b38ceb2533e487469f9ad331068de9797c7d8e2116f41efb7ec167`.
- `...\bin\corehelper.dll`, sha256 `efc253f355c553d81cdee4ef6f60693e2aafb9ab4896bc9743bad5f2ee52f112`.
- `...\bin\kinechain.dll`, sha256 `16c9b8c56671ccfc5ad2fb57a6afe4cb7e65c313545fa8acec57f871591897c8`.
- `gap.dll`: not opened (time budget).

Method: byte search of each handler CLSID (and of its first 8 bytes, for DLLs that compare two 64-bit values loaded
from an `.rdata` GUID copy), xrefs of every hit, `resolve_containing_procedure` to tell a `DllGetClassObject` compare
from a mere use; decompilation of `DllGetClassObject` (scnmgr `0x18000ca40`, kinechain `0x1800124b0`) or paging of
its assembly (rendercore `0x18009fb90`); `read_bytes` of factory vtables (slot 6 = create), task vtables (slot 5 = Do,
slot 8 = UnPackArg, slot 9 = RePackArg) and worker vtables; decompilation of create / constructor / UnPackArg /
RePackArg / worker. For the filter-mapped commands: string xrefs of `OnFilterCmdID` / `InputObjsArgName` led to the
command manager's filter-map executor; the per-command filter tables come from `data/command_registry.json` (the
registry arg defaults, decoded below). All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | scripting name | DLL | Handler | Status |
|---|---|---|---|---|
| `Mesh Filter`, `Dice Object/Polygons`, `Delete Selected` (row `70a823e0`), `Duplicate/Extrude Single`, `Duplicate/Extrude Multiple`, `Invert Polygons`, `Move Component Tool`, `Subdivide` | (none) | `scnmgr.dll` (command manager, not a COM class) | pseudo-handler CLSID `48becc30-5e5e-11d4-8c2c-009027bc3a0e`, recognised by the command dispatcher `0x180031ac0` and executed by the filter-map executor `0x1800330a0` (vtable slot `0x88` of the manager vtable at `0x18007ab70`) | SPEC-PARTIAL |
| `MarkObjectDirty` | (none) | `scnmgr.dll` dispatcher → base `CDSBaseCmdMapClient2::ExecuteCmd` (imported) | all-zero handler CLSID, branch slot `0x90` = `0x180032fa0` | SPEC |
| `Copy Partition` | `CopyPartition` | `rendercore.dll` | CLSID `0ee6c6df-96f5-4b4d-ac9b-f5053b033157` (GUID copy `0x1800ebbd0`), factory vtable `0x1800ef9c0`, create `0x18009ea60` (0x68 bytes), ctor `0x180081590`, task vtable `0x1800e74d0` (Do `0x180087e40`, no Ghidra function; UnPackArg `0x18008a2d0`), worker vtable `0x1800e7540`, worker slot 9 `0x180084290` | SPEC-PARTIAL |
| `RegenerateMaps` | `RegenerateMaps` | `rendercore.dll` | CLSID `81518c0b-2be4-46b8-a5d2-624edc7d71ab` (GUID copy `0x1800ebc70`), factory vtable `0x1800ef918`, create `0x18009ed20` (0x98 bytes), ctor `0x180081c10`, task vtable `0x1800e7170` (Do `0x180088210`, no Ghidra function; UnPackArg `0x18008bff0`), worker vtable `0x1800e71e0`, worker slot 9 `0x180086d70` | SPEC-PARTIAL |
| `CreateEnvironmentCache` | `CreateEnvironmentCache` | **not `corehelper.dll`** (no `DllGetClassObject`; it only *calls* the task) → `environments.dll` or `simulationop.dll` (inferred) | CLSID `3d2a7149-320c-49a4-9625-8d61bda0c60c` | not located |
| `C3DGetSkeletonInfoTask` | `GetSkeleton` | `kinechain.dll` | CLSID `9dc2d898-a3b8-11d3-a4f7-009027bc6584` (last compare of `DllGetClassObject`), factory vtable `0x18003bdb8`, create `0x180012200` (0x60 bytes), ctor `0x180001cc0`, task vtable `0x1800345e0` (Do `0x1800023c0`, UnPackArg `0x1800025f0`, RePackArg `0x180002490`, Undo/Redo `0x180009da0` = `E_NOTIMPL`), worker vtable `0x1800346a0`, worker slot 9 `0x1800021a0` | SPEC |
| `Paint Weights` | `PaintWeights` | `gap.dll` (registry candidate, not opened) | CLSID `73c34ae0-9d75-11d4-b918-0800690c8bd0` | not examined |

## 2. Shared facts

- **`48becc30` is not a COM class.** scnmgr's `DllGetClassObject` compares 13 CLSIDs and `48becc30` is not one of them
  (nor is it in any other DLL's factory chain as far as this row looked). The only reference to the `.rdata` copy of
  `48becc30` (`0x180070a18`) is in the command manager's execute dispatcher `0x180031ac0`, which reads the handler CLSID
  of the command being executed and branches:
  - `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9` (scripted / preset commands) → slot `0x80` (`0x1800339b0`), with a
    re-entrancy counter when the app is in a particular mode;
  - `48becc30-5e5e-11d4-8c2c-009027bc3a0e` → slot `0x88` = the **filter-map executor** `0x1800330a0`;
  - `83ff9126-2c3b-11d4-…` → slot `0x60`;
  - all zeros → slot `0x90` = `0x180032fa0` (see `MarkObjectDirty`);
  - anything else → slot `0x78` (`0x180033f30`, the normal COM-task path).
  Return codes `0x562e80c7` / `0x562e8005` from a branch set the context's state to 2; `0x562e80c7` additionally
  raises the `simsgcat` message 0x1e with the script name and the first keyword, HRESULT `0x800a04c7`.
- **The filter map lives in the command's own registry arguments, not in a `.DSCommandMap` file.** Argument list
  layout (checked by the executor): argument 0 is the input (`InputObjs`, or `InputObj` if there is no `InputObjs`),
  followed by `n` groups of exactly four arguments, in this order and with these exact names:
  `SelFilter`, `OnFilterCmdMapClient`, `OnFilterCmdID`, `InputObjsArgName`. The argument count must be at least 5 and
  `(count − 1)` divisible by 4, otherwise nothing runs. Every group in the shipped registry uses map client
  `{50830560-31b5-11d0-82e7-00a0243e268d}` (the standard command map).
- **Shared contract of the filter-map executor (`0x1800330a0`)**, applies to every 48becc30 command:
  1. A pre-step (`0x180035930`) runs first; if it returns `0x562e80c7` the command stops. The manager's pre-execute
     notification (`+0x60` slot `0x40`, event 5) can also cancel (returns 1).
  2. The input argument must be an object / dispatch value holding a collection (interface `0x180070198`); if the
     collection is **empty**, the global selection list is used instead (`DSQueryGenericObject` on the selection
     service; item 0 of it is taken as the list) `(inferred: "empty input = current selection")`.
  3. For each group `k` (in registry order): `SelFilter` is a filter object (the registry default strings
     `{1128E000-DBE2-11d2-8BCF-00AA006130EF}:<filtername>` are filter references). If the value is non-empty the
     filter (interface `0x18006f818`, slot 4) is applied to the **remaining** input list and returns the matching
     subset. If the value is **empty**, the group is a catch-all and is accepted only when it is the **last** group;
     its subset is the whole remaining input list. A filter call error ends the loop.
  4. If the subset is non-empty `(inferred: the list's slot 23 returns 1 for "has items")`, a new exec context is
     created for (`OnFilterCmdMapClient`, `OnFilterCmdID`) with `F3DCreateExecContext`; if `InputObjsArgName` is
     non-empty the subset is passed in the argument of that name (`ConnectionSet`, `InputObjs`, `InputObj` …); if it is
     empty no input argument is set (tools). A flag of the outer context (slot 0x38) is copied to the new one
     `(inferred: undo / logging mode)`. Then `F3DExecuteCmd` runs the target command, and the dispatched subset is
     passed to the remaining input list's slot 8 `(inferred: removed from the remainder, so later groups only see
     what earlier groups did not take)`.
  5. An empty subset skips the group. Processing continues until all groups are tested.
  Consequence `(inferred from 3–5)`: a mixed selection can run more than one target command (e.g. polygons and edges
  for `Mesh Filter`), in group order; the final empty-filter group is the "everything else" fallback.
- **Target commands per name** (registry `OnFilterCmdID` decoded and matched to registry GUIDs; all are
  `ApplyTopoOp` presets unless stated):

| Command | group: SelFilter → target command (scripting name) → input arg |
|---|---|
| `Mesh Filter` | `polygon` → **Filter Polygons** `1067d621-…` → `ConnectionSet`; `edge` → **Filter Edges** `053894c2-…` → `ConnectionSet`; `polygon_mesh` → **Filter Polygons** → `ConnectionSet` |
| `Dice Object/Polygons` | `polygon` → **Dice Polygons** `86b4db7e-…`; `object` → **Dice Object** `6af65230-…`; both → `ConnectionSet` |
| `Delete Selected` (row `70a823e0-5997-11cf-…`) | `UserCluster` → **Delete Selected** `6561fca0-…` (`DeleteObj`) → `InputObj`; `Polygon` → **Delete Component** `c163c9a8-…` → `ConnectionSet`; `MeshComponent` → **Dissolve & Clean Adjacent Vertices** `1d09de94-…`; `NurbsCurveCV` → **Nurbs Curve Delete Point** `2861bc85-…`; `NurbsCurvePoint` → **Set Curve Knot Multiplicity** `90ff723c-…` (`SetCurveKnotMultiplicity`); `UKnotCurve` / `VKnotCurve` → **Remove Surface Knot** `9b22a592-…`; `ParticlePoint` → **Delete Particle** `e8cd3e2b-…`; (empty, last) → **Delete Selected** `6561fca0` (`DeleteObj`) → `InputObj` |
| `Duplicate/Extrude Single` | `MeshComponent` → **Duplicate Single Mesh Component** `af4edb50-…` (`DuplicateMeshComponent`) → `ConnectionSet`; (empty) → **Duplicate Single** `c718c4e0-…` (`Duplicate`) → `InputObjs` |
| `Duplicate/Extrude Multiple` | `MeshComponent` → **Duplicate Multiple Mesh Component** `6f74fac0-…` (`DuplicateMeshComponent`) → `ConnectionSet`; (empty) → **Duplicate Multiple** `c718c4e2-…` (`Duplicate`) → `InputObjs` |
| `Invert Polygons` | `polygon` → **Invert Selected Polygons** `11beb110-…` → `ConnectionSet`; (empty) → **Invert All Normals** `2861bc71-…` → `ConnectionSet` |
| `Subdivide` | `polygon` → **Subdivide Polygon** `bc8cceef-…`; `edge` → **Subdivide Edge** `8f1fa2af-…`; `polygon_mesh` → **Subdivide Polygon**; all → `ConnectionSet` |
| `Move Component Tool` | `CurveOrAnytingOnACurve` (sic) → **Direct Manip Tool** `5c960195-…` (`DirectManipTool`); (empty) → **Tweak Tool** `0d41ff0c-…` (`TweakTool`); `InputObjsArgName` empty in both → no input passed |

## 3. Contracts

### `Mesh Filter`: SPEC-PARTIAL
Filter-map command (shared contract, section 2). Polygons → `Filter Polygons`, edges → `Filter Edges`, a selected
polygon mesh → `Filter Polygons` on the object. No catch-all group: anything else (points, non-meshes) runs nothing.
Gap: the filter object's matching rules (what `polygon_mesh` accepts) are in the filter DLL, not read.
**Wire contract:** args `InputObjs` + 3 groups as in the registry; run `Filter Polygons` with the polygon subset and/or
`Filter Edges` with the edge subset, `Filter Polygons` with selected meshes; empty input = current selection; no
fallback group.

### `Dice Object/Polygons`: SPEC-PARTIAL
Polygons → `Dice Polygons` (`ConnectionSet` = polygon subset); objects → **`Dice Object`** (a separate preset, not
`Dice Polygons` on the whole mesh). No catch-all.
**Wire contract:** as above; selecting a mesh object runs `Dice Object`.

### `Delete Selected` (filter row `70a823e0`): SPEC-PARTIAL
Eight typed groups plus a catch-all `DeleteObj` on the remainder (table above). Note there is a second `Delete
Selected` row (`6561fca0`, scripted handler `5c0cf8b6`, `DeleteObj` = `uixsiscripts.vbs DeleteObjProc`): that is the
catch-all target, not the key-bound entry.
**Wire contract:** route by component type (user clusters → `DeleteObj`; polygons → `Delete Component`; other mesh
components → `Dissolve & Clean Adjacent Vertices`; curve CVs → `Nurbs Curve Delete Point`; curve knots → `Set Curve
Knot Multiplicity`; surface knot curves → `Remove Surface Knot`; particles → `Delete Particle`; rest → `DeleteObj`).

### `Duplicate/Extrude Single`: SPEC-PARTIAL
Mesh components → `Duplicate Single Mesh Component` (`DuplicateMeshComponent`, extrude); anything else →
`Duplicate Single` (`Duplicate`) with `InputObjs`.
**Wire contract:** components → `DuplicateMeshComponent` single preset; objects → `Duplicate` (single preset).

### `Duplicate/Extrude Multiple`: SPEC-PARTIAL
Mesh components → `Duplicate Multiple Mesh Component`; anything else → `Duplicate Multiple` (`c718c4e2`).
**Wire contract:** as above; the multiple-copies count comes from the target command's own preset, not from this
command (inferred).

### `Invert Polygons`: SPEC-PARTIAL
Selected polygons → `Invert Selected Polygons`; everything else (objects) → `Invert All Normals`, both with
`ConnectionSet` (matches the registry description).
**Wire contract:** as above.

### `Subdivide`: SPEC-PARTIAL
Polygons → `Subdivide Polygon`; edges → `Subdivide Edge`; meshes → `Subdivide Polygon`. No catch-all.
**Wire contract:** as above.

### `Move Component Tool`: SPEC-PARTIAL
Anything on a curve → `DirectManipTool`; otherwise → `TweakTool`. No input argument is passed to either tool
(`InputObjsArgName` empty); input is still read from `InputObj` (single-object argument name) for filtering.
**Wire contract:** curve / curve components selected → `DirectManipTool`, else `TweakTool`.

### `MarkObjectDirty`: SPEC
Not implemented by any task class: its registry handler CLSID is all zeros, the string `MarkObjectDirty` does not occur
in `scnmgr.dll`, and the command manager routes a null-handler command (slot `0x90`, `0x180032fa0`) to the generic base
`CDSBaseCmdMapClient2::ExecuteCmd` (imported from the DS core, not read), after the same pre-step / pre-execute
notification as other commands. No scene change attributable to it was found `(inferred: a notification-only command
other code listens for)`.
**Wire contract:** no-op that returns nothing; command flags 4; arg `Object` (VT_UNKNOWN). Keep it on the bus so
scripts do not fail.

### `CopyPartition`: SPEC-PARTIAL
- Args: `Target` (list), `InputObjs` (list). UnPackArg builds two lists (class/IID `0x1800eafb0` / `0x1800eb010`):
  targets = items of `Target` that support interface `d233acd7-b2f5-4f26-9847-4752712f9260` `(inferred: pass)`;
  inputs = items of `InputObjs` that support interface `eff95861-6291-11d1-be9e-00a024ee478d` and whose kind value
  (slot 0x40) is **5 or 6** `(inferred: the two partition kinds, object / light)`. Missing context → `E_POINTER`
  (`0x80004003`). No fallback to the current pass or to all passes.
- Worker (`0x180084290`, args: targets, inputs, undo flag): on the undo run it keeps copies of both lists. Gets the
  pass container (`F3DGetPassContainer`, `8131b9be-b850-42ba-96c5-75ac8910db23`); none → `E_POINTER`. For each input
  partition (interface `b0cbf80e-c0d5-11d0-a586-00a0c91412de`), for each target pass:
  1. duplicate the partition with **`Low Level Duplicate`** (`747d257f-d01b-11d2-80c4-00a0c9ac19a9`, slot 0x48, on its
     `4aeaeaea-…` component interface);
  2. detach the new object from any owner the pass container reports for it;
  3. add the copy to the target pass (pass slot 3);
  4. read the copy's member list (slot 0x50), write it back (slot 0x40), and run task class
     `1c7c2c98-dd95-45c5-802b-3c7334b7edc0` (the class the registry uses as handler of `Move Objects To Layer`) on
     (copy, members) `(inferred: re-parents the members into the new partition)`;
  5. run **`SetValue`** (`c089b901`) on the copy's parameter `2b91c031-677a-11d1-b0cf-00a024c79287` `(inferred: Name)`
     with the **source partition's name** (string, VT_BSTR).
  With undo on, each sub-task is recorded with `AddTask`. Any failure stops everything and returns that HRESULT;
  a source partition without the name interface → `E_FAIL` (`0x80004005`).
- A same-named partition already in the target pass is **not merged into**: a new copy is always added.
- Gap: Do `0x180087e40` is not a Ghidra function (forwarding stub, not decoded); the exact meaning of kinds 5/6 and of
  task `1c7c2c98`.
**Wire contract:** `CopyPartition(Target=passes, InputObjs=partitions)`: for every partition × pass, add a
duplicate (same name, same parameters, same members) to the pass; undoable; returns nothing (inferred).

### `RegenerateMaps`: SPEC-PARTIAL
- Args: `Properties` (list, required), `TileSize` (VT_UI4, default **32** set in the constructor). UnPackArg: no
  `Properties` → `E_INVALIDARG` (`0x80070057`). If `TileSize` is outside **[8, 512]** it is clamped (below 8 → 8,
  above 512 → 512) and a message (catalog `XSIRENDERCORE` id 0x59, formatted with the clamped value) is logged with
  severity 4.
- Worker (`0x180086d70`): an empty list → returns `0x562e80d2` (nothing done). Builds a render-map job from the list
  (`0x18008e260`, not read). Sets the ambient value **`PATH_TEMPLATE_SYSTEM_TIME`** to the current local time (as a
  FILETIME) for the run and clears it at the end. With a UI: opens a progress bar (range 0–100) bound to the task.
  Runs the job (prepare, then render with the multithreaded-rendering active-data lock released); returns the job's
  failure HRESULT, else 0. Progress bar closed at the end. Undo not supported (inferred from the registry flags /
  no undo storage).
- Gap: which properties are accepted (job builder), file naming, tile use; the rendering itself is the renderer.
**Wire contract:** validate `Properties` non-empty; clamp `TileSize` to 8..512 with a log line; set
`PATH_TEMPLATE_SYSTEM_TIME` during the run; without a renderer, log and return.

### `CreateEnvironmentCache`: handler not located
`corehelper.dll` has no `DllGetClassObject`. Its only references to `3d2a7149` are in `F3DAddEvolveOpIfNotThere`
(`0x18002c6e0`) and `F3DAddToEnvironment` (`0x18002d460`), which **create the task directly** (`SICreateInstance`,
IID `0x18007a630`) and call it with (model, environment, out cache) when the environment's cache list has no entry for
the model (`F3DGetEnvironmentContainer`, lookup slot 0x20), then use the returned cache as input of the evolve
operator they apply. So the command's direct contract is: in `Model`, in `Environment`, out the cache (`Source`).
Handler DLL: `environments.dll` or `simulationop.dll` (registry candidates, not opened).
**Wire contract (provisional):** args `Model`, `Environment`, output `Source` = the new cache; called by
`F3DAddToEnvironment` / evolve-op setup only when the model has no cache in that environment.

### `GetSkeleton` (`C3DGetSkeletonInfoTask`): SPEC
- UnPackArg: `InputObj` read as an object (IID `0x18003ad00`) and queried for the 3D object interface
  `6b579d20-3dc5-11d0-9449-00aa006d3165`; failure → raises `E_FAIL` with message id 0x39 and returns
  `0x80070057`.
- Do → worker slot 9 (`0x1800021a0`): a `C3DSkeletonBrowser` is initialised on the object; it returns the object's
  index among the skeleton elements. Initialize result 1 (object is not part of a skeleton) → raises and returns
  **`E_INVALIDARG`** (`0x80070057`, message 0x39); other failure → `E_FAIL` (message 1000). Otherwise a new object list
  (class `0x18003ad60`) is filled with `GetObject(0 … N−1)` of the browser, in browser order `(inferred: chain root,
  bones, effector)`.
- **PR #193 Q2 — outputs.** RePackArg (`0x180002490`) writes them back as **output arguments**: `Index` is written as
  **VT_I4** (the browser index) and `ChainElements` as an **object collection** (written with VT_UNKNOWN through the
  object-list writer), only when the list exists. They are not the command's return value; scripting sees them as
  the output arguments (`Index` flags 4 = in/out, `ChainElements` flags 512 = output).
- Undo / Redo: `E_NOTIMPL` (slots 6/7). Command flags `0x800002`.
**Wire contract:** `GetSkeleton(InputObj)` → outputs `{ Index: int, ChainElements: collection }`; a non-skeleton
object raises `E_INVALIDARG` (no empty result); not undoable.

### `PaintWeights`: not examined
`gap.dll` was not opened within the time budget. Registry: 7 args (`InputObj`, `Indices`, `Weights`, `Flags` = 0,
`Deformer` = 0, `Normalize` = true, output `OutputObj`).

## 4. Corrections for the wire agent

1. `Mesh Filter`, `Dice Object/Polygons` (`src/commands/inferredB15.ts`): replace the hand-written choice with the
   generic filter-map executor of section 2 (iterate the registry groups, filter the remaining input, run
   `OnFilterCmdID`'s command with the subset in `InputObjsArgName`); a mixed selection runs several targets.
2. `Dice Object/Polygons`: an object selection runs the **`Dice Object`** preset, not `Dice Polygons` on the mesh.
3. Empty `InputObjs` = current selection for every 48becc30 command (already roughly what the wire does).
4. `Delete Selected`, `Duplicate/Extrude Single|Multiple`, `Move Component Tool` (`src/ui/keymap.ts`, `menubar.ts`)
   are bound straight to `DeleteObj` / `Duplicate` / `TweakTool`; they should go through the filter map (component
   selections run `Delete Component` / `Dissolve & Clean Adjacent Vertices` / `DuplicateMeshComponent`; curves run
   `DirectManipTool`). `Duplicate/Extrude Multiple` targets the `Duplicate Multiple` preset, not `NbCopies: 3`.
5. `Invert Polygons` and `Subdivide` (filter rows `8de9e423`, `60d7df7e`) are not registered as such; add them as
   filter-map commands (polygons → `Invert Selected Polygons`, else `Invert All Normals`; polygons/meshes →
   `Subdivide Polygon`, edges → `Subdivide Edge`).
6. `CopyPartition`: drop both fallbacks (no current-pass partitions, no "all passes"): `Target` and `InputObjs` are
   used as given, filtered to passes / partitions.
7. `CopyPartition`: never merge into an existing same-named partition; always add a new duplicate (Low Level
   Duplicate) named like the source.
8. `CopyPartition`: return value is not a count (inferred: nothing).
9. `RegenerateMaps`: clamp `TileSize` to 8..512 with a logged message; empty `Properties` is a no-op returning the
   `0x562e80d2` status, missing `Properties` is `E_INVALIDARG`. The `rendermap` type filter and selection fallback are
   wire assumptions not seen in the binary (the registry arg has the selection handler `7834cb8c`, so the bus fills
   it).
10. `CreateEnvironmentCache`: add the output argument `Source` (registry flags 513) and return the cache through it;
    the handler is not in corehelper (leave inferred).
11. `GetSkeleton` (`src/commands/shellsB15Else.ts`): write `Index` (int) and `ChainElements` (collection) as output
    arguments, not via a side `state`; an object that is not in a skeleton must raise `E_INVALIDARG`, not return an
    empty collection with `Index -1`.
12. `MarkObjectDirty`: the wire no-op is right; the "not yet attested" log can say "no handler (null CLSID)".

## 5. Open questions

1. Filter-map executor: after a successful dispatch the group index is advanced on a different path than after a
   non-match (assembly at `0x1800337f2`/`0x1800337f4`); whether a group is re-tested on the remainder (harmless if the
   matched items are removed) was not settled.
2. Semantics of the filter interface (`0x18006f818` slot 4) and of the list's slot 8 after dispatch (assumed:
   "filter remaining", "remove dispatched").
3. `CopyPartition`: partition kinds 5 / 6 and task `1c7c2c98` (handler class of `Move Objects To Layer`).
4. `RegenerateMaps`: the job builder `0x18008e260` (accepted property types, output paths).
5. `CreateEnvironmentCache`: open `environments.dll` / `simulationop.dll`.
6. `GetSkeleton`: `C3DSkeletonBrowser` element order.
7. `PaintWeights` in `gap.dll` still open.
