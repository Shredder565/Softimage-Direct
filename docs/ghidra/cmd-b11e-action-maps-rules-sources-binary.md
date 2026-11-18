# CMD-B11e: connection / value maps, mapping rules and action-source utilities read from `action.dll` (CreateConnectionMap, CreateEmptyConnectionMap, CreateValueMap, CreateEmptyValueMap, AddMappingRule, DeleteMappingRule, GetMappingRule, GetNumMappingRules, SetMappingRule, RemoveActionItem, GetStoreActionDefaults, LoadActionPreset, CopySourceActionToFolder, AddPoseActionItems, MergeClips)

Row: **CMD-B11e**. Status: **SPEC** (9 names), **SPEC-PARTIAL** (6 names); per command below.
Run: 2026-11-18, si-analyst worker, unattended, batch 11 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\action.dll`, image base `0x180000000`, sha256 `71769ec1ceb40c1d2c46b810af8284f18f1dab8317361beac5c8efcf7ce85f86`.
Method: Ghidra decompilation of `DllGetClassObject`, the 13 class-factory create slots,
13 constructors, the Do / UnPackArg / RePackArg / some Undo methods and the worker
methods they call; `read_bytes` of the factory vtables, task vtables and worker vtables.
Command arguments and defaults come from `data/command_registry.json`. Message ids are
error-handling ids of the task (dictionary presumably `XSIACTION2`, texts not in the repo).
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

`DllGetClassObject` (`0x1800a4ae0`) is one long chain of inline CLSID compares (two
8-byte compares per CLSID, about 75 classes). Each hit allocates a 0x48-byte class factory
with its own vtable; factory slot 6 (0-based, offset `+0x30`) allocates and constructs the
task, exactly as in `tasks.dll`. Factory slots 0-2 are shared (`0x1800a4630`,
`0x1800a0dd0`, `0x1800a4730`).

Two object layouts occur:

- Layout A (most tasks): `CDSCOMObject` at `+0`, `C3DCoreBaseTask` at `+0x18`, a worker
  sub-object at `+0x90` (= task `+0x78`). Do calls slot 9 (`+0x48`) of that worker.
- Layout B (`CopySourceActionToFolder`, `MergeClips`, `RemoveActionItem`):
  `C3DCoreBaseTask` at `+0`, `CDSCOMObject` at `+0x78`, worker at `+0x90`; Do again calls
  worker slot 9.

Task vtable = the vtable at the `C3DCoreBaseTask` part; slot 5 Do, 6 Undo, 7 Redo,
8 UnPackArg, 9 RePackArg. `0x180027ae0` is a shared stub used as "no RePackArg" and as
the no-op Undo / Redo of the query commands.

| Command(s) | Handler CLSID | Factory vtable -> create -> constructor (size) | Task vtable | Do -> worker (slot 9) | UnPackArg / RePackArg | Undo / Redo |
|---|---|---|---|---|---|---|
| `CreateConnectionMap`, `CreateEmptyConnectionMap` | `004f7514-fcbd-11d2-bdfe-00a0243e3543` | `0x180127178` -> `0x1800a3100` -> `0x1800285b0` (0x108), A | `0x180117990` | `0x180029780` -> `0x180029630` (full map `0x1800288a0`, empty map `0x180029430`) | `0x180029ac0` / `0x1800299f0` | `0x180029830` / `0x1800297b0` |
| `CreateValueMap`, `CreateEmptyValueMap` | `004f7515-fcbd-11d2-bdfe-00a0243e3543` | `0x1801271b0` -> `0x1800a3280` -> `0x180030fc0` (0x118), A | `0x180118d40` | `0x180032750` -> `0x180032600` (full map `0x1800314b0`, empty map `0x1800313a0`) | `0x180032ac0` / `0x1800329e0` | `0x180032820` / `0x1800327a0` |
| `AddMappingRule` | `280a45b1-4422-11d3-9c67-0060970a2bc8` | `0x1801274c0` -> `0x1800a2e00` -> `0x180001070` (0x110), A | `0x180115020` | `0x180001480` -> `0x180001320` | `0x1800016e0` / stub | `0x1800015a0` / `0x180001500` |
| `SetMappingRule` | `fd595ace-c3d9-11d3-b38d-00105a1e6ce9` | `0x1801274f8` -> `0x1800a3c00` -> `0x18005ff30` (0x140), A | `0x18011dad0` | `0x180060470` -> `0x1800601e0` | `0x1800608c0` / stub | `0x1800606a0` / `0x180060510` |
| `DeleteMappingRule` | `87eab571-443d-11d3-9c67-0060970a2bc8` | `0x180127530` -> `0x1800a3380` -> `0x180036140` (0x110), A | `0x1801194e0` | `0x180036530` -> `0x1800363a0` | `0x18003dbd0` (shared with GetMappingRule) / stub | `0x1800365a0` / `0x180036550` |
| `GetNumMappingRules` | `bdd3f140-4446-11d3-9c67-0060970a2bc8` | `0x180127568` -> `0x1800a3540` -> `0x18003dcb0` (0xb0), A | `0x18011a760` | `0x18003dea0` -> `0x18003de40` | `0x18003dfb0` / `0x18003df50` | stub / stub |
| `GetMappingRule` | `9b4b0f32-4456-11d3-9c67-0060970a2bc8` | `0x1801275a0` -> `0x1800a3500` -> `0x18003d6d0` (0xd8), A | `0x18011a5b0` | `0x18003da30` -> `0x18003d8c0` | `0x18003dbd0` / `0x18003db40` | stub / stub |
| `RemoveActionItem` | `0be818ac-36cd-400f-a05c-e622a8a24e55` | `0x180127808` -> `0x1800a39c0` -> `0x180056420` (0x138), B | `0x18011c850` | `0x180056e30` -> `0x180056a40` | `0x180057170` / stub | `0x180056ed0` / `0x180056e60` |
| `GetStoreActionDefaults` | `12a3efcd-e543-11d2-b352-00105a1e6ce9` | `0x180126d18` -> `0x1800a3d80` -> `0x180062cd0` (0x178), A | `0x18011e2c0` | `0x1800652d0` -> `0x180063c90` | `0x180066c70` / `0x180066a70` | `0x1800655a0` / `0x180065460` |
| `LoadActionPreset` | `12a3efcf-e543-11d2-b352-00105a1e6ce9` | `0x180126dc0` -> `0x1800a35c0` -> `0x18003e6e0` (0x128), A | `0x18011abd0` | `0x180040c10` -> `0x18003f510` | `0x180041150` / `0x180041060` | `0x180040e60` / `0x180040d30` |
| `CopySourceActionToFolder` | `600255c0-46ac-11d4-b4ab-00d0b7142c4a` | `0x1801275d8` -> `0x1800a30c0` -> `0x180027d10` (0xc8), B | `0x180117690` | `0x180028310` -> `0x180027ee0` | `0x180028500` / stub | `0x180028390` / `0x180028350` |
| `AddPoseActionItems` | `9e1ddb90-ead8-11d3-b395-00105a1e6ce9` | `0x180127220` -> `0x1800a2e40` -> `0x180001800` (0xc8), A | `0x180115420` | `0x180001dc0` -> `0x180001d20` -> `0x180001a20` | `0x180002020` / `0x1800140f0` | `0x180001ea0` / `0x180001e40` |
| `MergeClips` | `eb00f267-d99b-46a3-ae61-7d8b923b5f59` | `0x180127728` -> `0x1800a3700` -> `0x180042d00` (0xf8), B | `0x18011b0d0` | `0x180044bb0` -> `0x180044210` | `0x1800454d0` / `0x1800453e0` | `0x180044c70` / `0x180044bf0` |

## 2. Shared facts

- Interfaces asked of argument objects (through the object's "get interface" method):
  mapping template `12a3ef9a-e543-11d2-b352-00105a1e6ce9`; action source
  `12a3ef95-e543-11d2-b352-00105a1e6ce9`; action folder / container
  `fe2c4320-c53d-11d2-b34a-00105a1e6ce9` (CopySourceActionToFolder targets);
  `GetStoreActionDefaults` first tries `6b579d20-3dc5-11d0-9449-00aa006d3165` on `Model`.
- Mapping template methods used (by vtable slot of the rule-list interface): slot 3
  insert N rules at position (From[], To[]), slot 4 remove N rules at position, slot 5
  set N rules at position, slot 6 rule count, slot 7 get N rules at position (strings
  are task-memory allocated). A second interface on the template (rule flags) gives
  slot 8 "get Active / PoseOffset for N rules", slot 17 "set Active", slot 23
  "set PoseOffset".
- **Rule index convention** (all rule commands): `Index` is 1-based; 0 is treated as 1.
  For Add / Set / Delete the resulting 0-based position is clamped to the rule count
  (`pos = min(max(Index,1) - 1, count)`). GetMappingRule instead fails when
  `Index > count`.
- Every rule command, on Do, first clears its sub-task list; when the "record undo" flag
  passed into Do is set, it keeps a soft reference to the template and the old values for
  Undo.
- Map creation goes through `F3DGetModelNLEContainer` on the `Obj1` model (creates the
  model's mixer if needed; the creation sub-task is added to this task for undo), creates
  a mapping template object with `SICreateInstance` and appends it to the mixer
  container (position -1 = end). Class ids: connection map
  template `0x1801352c8`, value map template `0x1801352e8` (16-byte constants not
  read; inferred names `MappingTemplate` classes).
- Lock rule for map creation: when `Obj1` is locked (any lock bit `0xffff`) and is not a
  locked referenced model, the lock error is raised and `0x80070005` is returned.
- HRESULTs: `0x80004003` (E_POINTER) for missing required pointers;
  `0x80070057` raised with a message id (see each command); `0x80070005` for locked
  objects; `0x8007000e` out of memory; `S_FALSE` (1) when nothing was done.

## 3. Contracts

### `CreateConnectionMap`: SPEC-PARTIAL

Wire contract:
- Args: `Obj1` (model, required), `Obj2` (model, optional at the binary level), output
  `MappingTemplate`.
- Shares CLSID and task with `CreateEmptyConnectionMap`; the only difference is whether
  `Obj2` is resolved. UnPackArg resolves each object through a generic object resolver
  (`DSQueryGenericObject`) to a model; when `Obj2` is absent or empty the empty-map path
  is used.
- With both models: an object list is collected from each model (helper `0x1800292e0`,
  not read), the empty connection map is created on the `Obj1` model's mixer (as for
  `CreateEmptyConnectionMap`) and one rule per pair is appended in list order:
  From = full name of the i-th object of `Obj1`'s list, To = full name of the i-th
  object of `Obj2`'s list.
- Returns the new template as `MappingTemplate`.
- Missing: which objects / parameters the per-model collector lists and how unequal list
  lengths are handled.

### `CreateEmptyConnectionMap`: SPEC

Wire contract:
- Args: `Obj1` (model), output `MappingTemplate`.
- Lock check on `Obj1` (see 2), then get / create the model's mixer, create a connection
  mapping template, append it to the mixer, return it. No rules.

### `CreateValueMap`: SPEC-PARTIAL

Wire contract:
- Args: `Obj1`, `Obj2` (models), `Mode` (default 4), `Scope` (default 1), `UseNames`
  (default false), output `MappingTemplate`. Same task as `CreateEmptyValueMap`; no
  `Obj2` -> empty value map.
- `Mode` is translated into a transform-channel bit mask: 0 -> 0, 1 -> 1, 2 -> 2,
  3 -> 4, 4 -> 7 (all); other values leave the mask unchanged (0). The three bits select
  scaling / rotation / translation channel groups (inferred from the nine-entry
  channel tables that start at `kine.local.sclx` / `kine.global.sclx`).
- `Scope` -> bit mask: 0 -> 2, 1 -> 1, 2 -> 3. Bit 1 selects the `kine.local.*`
  channels, bit 2 the `kine.global.*` channels; so 0 = global only, 1 = local only
  (default), 2 = both.
- Collects one object list per model (helper `0x180031250`, not read; `UseNames`
  presumably makes it match objects by name instead of order, inferred). The two lists
  must have the same length, otherwise nothing is created (error code not read).
- For each object pair and each selected channel, a rule `<object>.<channel>` ->
  expression is appended to a new value map template. The expression is
  `this + <difference>` printed with `%lf`, or empty when the absolute difference is
  below `1e-9`.
- Returns the new template as `MappingTemplate`.
- Missing: the object collector, the direction of the difference, error code for list
  length mismatch.

### `CreateEmptyValueMap`: SPEC

Wire contract:
- Args: `Obj1` (model), output `MappingTemplate`. Same as `CreateEmptyConnectionMap`
  but creates a value map template.

### `AddMappingRule`: SPEC

Wire contract:
- Args: `MappingTemplate` (required), `From` (string), `To` (string), `Index`
  (default 0).
- Fails with `0x80004003` when the template, From or To is missing.
- Inserts one rule (From, To) at position `min(max(Index,1)-1, count)`; with the
  default 0 the rule goes first.
- Undo removes one rule at the recorded position; Redo re-inserts it.

### `SetMappingRule`: SPEC

Wire contract:
- Args: `MappingTemplate`, `From`, `To`, `Index` (default 0), `Active` (default -1),
  `PoseOffset` (default -1).
- Position as for AddMappingRule. Reads and keeps the current From / To and the current
  Active / PoseOffset flags of that rule.
- If the template supports rule flags: `Active >= 0` sets the active flag, then
  `PoseOffset >= 0` sets the pose-offset flag; -1 leaves a flag unchanged.
- Then replaces the rule's From / To with the given strings (empty strings are written
  as given).
- Undo restores the old strings and the old flag values.

### `DeleteMappingRule`: SPEC

Wire contract:
- Args: `MappingTemplate`, `Index` (default 0 -> first rule).
- Position clamped as above; keeps the rule's From / To for undo, then removes one rule.
- `0x80004003` when the template is missing.

### `GetNumMappingRules`: SPEC

Wire contract:
- Args: `MappingTemplate`; returns `Value` = number of rules (written by RePackArg
  `0x18003df50`).
- No scene change; Undo / Redo are no-ops.

### `GetMappingRule`: SPEC

Wire contract:
- Args: `MappingTemplate`, `Index` (default 0 -> rule 1); outputs `From`, `To`
  (strings), `Active`, `PoseOffset` (booleans) written by RePackArg `0x18003db40` in that
  order.
- Fails when `Index` is greater than the rule count.
- When the template has no rule-flag interface, `Active` and `PoseOffset` are false.
- No scene change.

### `RemoveActionItem`: SPEC

Wire contract:
- Args: `Source` (action source, required), `Name` (string, comma-separated item names).
- If the source is a keying-layer action (source type 6) whose layer is locked: logs
  `XSIACTION2` message 0x447 (layer clip path, source path) at severity 2 and returns
  `0x80070005`.
- For undo, keeps a soft reference to the source and a copy of its item list and
  related data.
- `Name` empty: calls the source's "remove all items" method (inferred meaning of slot 9).
  Otherwise splits `Name` on `,` and removes each named item in order; the first name
  that cannot be removed raises `0x80070057` with message id 0x9f (item name) and the
  command returns `0x80020009`.

### `GetStoreActionDefaults`: SPEC-PARTIAL

Wire contract:
- Args: `Model`, `InputObj` (list), `Mode` (default 1), outputs `From`, `To` (double),
  `Size` (long), `Type` (default `ReturnOnly`).
- The task is the generic "store action" task: UnPackArg reads `Type`: `ReturnOnly` ->
  query mode; `TransientAction` -> storage kind 2; `UnownedAction` -> storage kind 0;
  anything else -> storage kind 1. In query mode only `InputObj` and `Mode` are read.
- `Mode` -> parameter-class mask: 0 -> 0, 1 -> 1, 2 -> 2, 3 -> 4, 4 -> 8, 5 -> 0xe,
  6 -> 0xf.
- Do in query mode runs the store worker with no model and no name, so nothing is
  created; RePackArg writes `From`, `To` and `Size` (the frame range and item count the
  store would use, inferred).
- Missing: how the worker computes From / To / Size for the filtered parameters.

### `LoadActionPreset`: SPEC-PARTIAL

Wire contract:
- Args: `Model`, `FileName`, `Name` (default empty), `ActionStorage` (default 0),
  output `Action`.
- Validates `FileName` against the extensions `.Preset`, `.xsi`, `.eani`; an invalid
  file raises `0x80070057` with message id 0x33.
- Gets / creates the model's mixer, stores the file's folder under the registry key
  `Nle\animmix\action`, enables the mixer on a locked referenced model.
- By extension: `.Preset` -> preset loader `0x18003f0f0`; `.xsi` -> scene-source loader
  `0x18003f1e0`; `.eani` -> fires file event `0x20510015` (type 10), then loader
  `0x18003edc0`. Other extensions load nothing.
- If `ActionStorage != -1` the source's storage property (id 7) is set to it; when it is
  0 the source's file path property (id 8) is cleared.
- The source is named `Name`, or the file's base name when `Name` is empty; a newly
  loaded source is appended to the mixer. Returns the source as `Action`.
- Missing: the three format loaders and the item post-processing after the add.

### `CopySourceActionToFolder`: SPEC

Wire contract:
- Args: `InputObj` (list of action sources), `Target` (list of folders / containers).
- For every target (as interface `fe2c4320-...`) and every input source, a copy of the
  source is made through a helper task (class `0x180135018`, mode 2) and appended to
  the target's list; the helper task is kept as a sub-task when undo is recorded.
- `0x80004003` if either list is missing; returns `S_FALSE` when nothing was copied.

### `AddPoseActionItems`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (action sources), `Name` (default `OFFSET_ROOT`).
- Builds nine item names from `Name` plus nine fixed suffixes (inferred: the scale /
  rotation / position x, y, z channels). For each input that is an action source and has
  no conflicting entry (check through the source's slot 13, meaning not read), writes
  the nine values 1, 1, 1, 0, 0, 0, 0, 0, 0 (identity pose) as the pose items.
- Keeps a list reference and the name for undo.
- Missing: the suffix strings and the exact meaning of the per-source check.

### `MergeClips`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (clips), output `Value` (new source).
- Collects the clips and their overall time span (helper `0x180044d60`); when the
  helper reports an invalid selection, raises `0x80070057` with message id 0xe3.
- Creates a new action source named `MergedClips`, gets / creates the mixer of the
  clips' model, converts every clip into source items (helper `0x1800430e0`), skipping
  clips that give no item.
- If no item is left: logs message id 0xe4 at severity 4 and returns `S_FALSE`.
- Otherwise adds the items, sets the source's start to the span start and its end to
  span end minus 1, appends the source to the mixer and returns it as `Value`.
- Missing: the clip collection rules and the per-clip item conversion.

## Open questions

- Class ids of the connection / value map templates and of the copy helper (16-byte
  constants at `0x1801352c8`, `0x1801352e8`, `0x180135018` were not read).
- The object collectors of the full map commands (`0x1800292e0`, `0x180031250`) and the
  effect of `UseNames`.
- Error code returned by `GetMappingRule` for an out-of-range index (not recoverable from
  the decompile).
- `GetStoreActionDefaults` range computation inside the store worker `0x180063c90`.
