# CMD-B11d: B10 confirmations read from `tasks.dll` (NavigateNode, folders, UV pinning, GetSize, MoveComponent, Tag / Untag)

Row: **CMD-B11d** (confirmation of row CMD-B10, answers to `b10_questions.md` Q1, Q8, Q11, Q12, Q13, Q14).
Status: **SPEC** (11 names incl. the `SelectNeighborObj` comparison), **SPEC-PARTIAL** (2 names: `MoveToFolder`; `MoveComponent`, not implemented in this DLL). Per command below.
Run: 2026-11-18, si-analyst worker, unattended, batch 11 (binary first, REA + Ghidra 12.1.4 on the PC)
No XSIBATCH golden: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\tasks.dll`, image base `0x180000000`, sha256 `d760b7aad9b433e4b40448aff1030b87cbcdee596f99fbf13212b4214fde9914`.
Method: CLSID byte search in `.rdata`, xrefs into `DllGetClassObject` (`0x180009700`, inline
two-qword compares, one block per CLSID), class factory vtables (slot 6 = create), task
constructors and task vtables read with `read_bytes`; Ghidra decompilation of the UnPackArg,
Do and worker functions listed below. Message texts from `data/si/dict.json` (`XSITASKS`).
Everything is behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

In `tasks.dll` the factory is a small object whose vtable has 7 slots (QI, AddRef, Release,
CreateInstance `0x180004fd0`, LockServer, destructor, **create**). The create slot allocates the
task and calls the constructor. In these tasks the `C3DCoreBaseTask` part is at object offset
`0` (not `+0x18`): the "task vtable" is the primary vtable, slot 5 Do, 6 Undo, 7 Redo,
8 UnPackArg, 9 RePackArg/output. A `CDSCOMObject` part sits at `+0x20`, and a worker sub-object
at `+0x38` whose vtable slot 9 (`+0x48`) is the worker that Do calls.

| Command(s) | CLSID (rdata) | DllGetClassObject block | Factory vtable -> create -> ctor (size) | Task vtable | Do / worker | UnPackArg | Undo / Redo |
|---|---|---|---|---|---|---|---|
| `NavigateNode` | `74debd17-439a-11d4-b49e-00d0b71903e4` (`0x18009c668`) | `0x18000b68f` | `0x1800a2a80` -> `0x180008820` -> `0x180088fd0` (0x80) | `0x1800b7420` | Do `0x18008c630` -> worker `0x18008b890` (scripted variant `0x18008bf10`) | `0x18008c830` (filter setter `0x18008c780`) | both `0x18000e460` (no-op) ; slot 9 `0x18008c6f0` |
| `SelectNeighborObj` | `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9` (`0x18009c778`) | `0x18000a095` | `0x1800a1460` -> `0x180008f80` -> `0x18003fd30` (0x48) | task part at `+0x18`, vtable `0x1800acf40` (Do/Undo/Redo all `0x18000e460`) | execute `0x18003fe50` = run the command's script | none | n/a |
| `CreateFolder` | `c0cd68b0-2832-11d4-b6a3-006094eb029c` (`0x18009c538`) | `0x18000b21b` | `0x1800a2818` -> `0x180007860` -> `0x1800858a0` (0x178) | `0x1800b6bc0` | Do `0x180085fb0` -> worker `0x180085bf0` | `0x1800862d0` | Undo `0x1800860a0`, Redo `0x180086030` |
| `MoveToFolder` | `a907fa52-2cb9-11d4-b6a3-006094eb029c` (`0x18009c568`) | `0x18000b28d` | `0x1800a2850` -> `0x1800087e0` -> `0x1800863d0` (0x108) | `0x1800b6e10` | Do `0x180088980` -> worker `0x180086c10` | `0x1800877a0` | Undo `0x180087330`, Redo `0x180087220` |
| `RemoveFromFolder` | `2c1c6594-2dba-11d4-b6a4-006094eb029c` (`0x18009c598`) | `0x18000b2ff` | `0x1800a2888` -> `0x180008c60` -> `0x1800882b0` (0x108) | `0x1800b71a0` | Do `0x180088980` (shared) -> worker `0x1800885e0` | `0x180088f40` | Undo `0x180088b50`, Redo `0x1800889b0` |
| `PinUVComponents`, `UnPinUVComponents`, `PinAllUVComponents`, `UnPinAllUVComponents` | `00bef78c-5d15-4cec-8038-d31c6c7f4fb2` (`0x18009bf08`) | `0x18000ca43` | `0x1800a37f0` -> `0x180009480` -> `0x180055bd0` (200) | `0x1800af6c0` | Do `0x1800562d0` -> worker `0x180056570` | `0x180056fa0` | Undo `0x1800564a0`, Redo `0x180056440` |
| `GetSize` | `af3e86ea-eb7c-490c-a557-8462c690f428` (`0x18009d168`) | `0x18000b5ab` | `0x1800a2a10` -> `0x180008210` -> `0x180037710` (0x68) | `0x1800aaef0` | Do `0x180037950` -> worker `0x180037880` | `0x180037b00` | both `0x18000e460` (no-op); output writer slot 9 `0x180037a30` |
| `Lock`, `Unlock`, `Tag`, `Untag` | `b3c0b1a1-0a4c-11d4-b980-009027bc3e07` (`0x18009c3e8`) | `0x18000b1a9` | `0x1800a27e0` -> `0x180008660` -> `0x18007ecd0` (0xd0) | `0x1800b6260` | Do `0x180080990` -> `0x180080080` -> `0x18007f4d0`; tag path `0x1800821f0` (add `0x1800805b0`, remove `0x1800828c0`) | `0x180082e00` | Undo `0x180081ea0`, Redo `0x180081e20` |
| `MoveComponent` | `da55a811-5f86-11d2-b11c-00a0c906811e` (`0x18009dea8`) | **none** | not created by `tasks.dll` | - | - | - | - |

`MoveComponent`'s CLSID has a single reference in `tasks.dll`, inside `0x18005ed60` (a consumer
that uses the CLSID, not a factory). `tasks.dll` does not implement it; see 3.10.

## 2. Shared facts

- Arguments are read by name (`F3DGetArgPtrValueFromName2`, `C3DExecContextHelper::GetArgValueFromName`,
  `SICmdGetStringArgFromName`); an object argument that is missing or of the wrong interface
  makes UnPackArg fail, so the command fails before Do.
- Element arguments (`Target`, `Source`) are element references (interface `{…de88}` /
  `{…dfa8}` list); the task asks the element for its component hierarchy plus the element's
  position in it (element slot `+0x200`), then queries the hierarchy for the interface it needs.
- Invalid enum values return `E_INVALIDARG` (`0x80070057`); null pointers `E_POINTER`
  (`0x80004003`). `S_FALSE` (1) is "nothing to do / not found".
- Undo data of the folder and tag tasks is kept as soft object references
  (`F3DCreateObjectReference`) or a snapshot object made with `SICreateInstance`.
- Interfaces / classes named below (GUIDs as stored at the listed `.rdata` addresses):
  folder class `d83a01b2-3b11-11d4-b6a4-006094eb029c` (`0x18009d8e8`); interface returned for the
  new folder `8444d440-1f69-11d4-b981-009027bc3e07` (`0x18009d828`); "insert child" hierarchy
  interface used by CreateFolder `d9347b2a-2b64-11d4-b6a3-006094eb029c` (`0x18009d838`); folder
  membership interface used by Move/RemoveFromFolder `6be9263a-3aee-11d4-b6a4-006094eb029c`
  (`0x18009d808`); parameter container `2babed40-b813-11cf-b646-00a024191ae0` (`0x18009da38`);
  Name parameter id `2b91c031-677a-11d1-b0cf-00a024c79287` (`0x18009c5f8`).

## 3. Contracts

### 3.1 `NavigateNode`: SPEC

Purpose: return the element reached from `Source` by one navigation step in the Source's
component hierarchy (explorer-style tree), optionally restricted to elements of a type.

**Wire contract**
- Args: `Source` (element, required; missing -> `0x80070057`), `NavDirection` (int, default 1),
  `NavLoop` (bool, default false), `NavFilter` (int, default 11), `NavSubFilter` (int, default 1),
  `OutputObj` (out). Each scalar must have the declared variant type (VT_INT for the three
  ints, VT_BOOL for NavLoop), otherwise `0x80070057`.
- `NavDirection` accepted range **1..6**; 0 or >6 -> `0x80070057`:
  - 1 = **parent**: one level up; when Source is at the top of a nested sub-hierarchy, the
    step goes to the element that owns that sub-hierarchy; none -> not found.
  - 2 = **child**: first child; when the element has no direct child but owns nested
    sub-hierarchies, the step enters the first one and takes its root element; none -> not found.
  - 3 = **next**, 4 = **previous** (sibling order; the next/previous polarity is
    (inferred) from the helper pairing: 3 and 6 use the same step helper, 4 and 5 the other).
    For an element below the root the step moves among its siblings; for an element at the
    root level the step is a depth-first (pre-order) walk of the whole hierarchy that
    descends into children and continues until an element passes the filter; reaching the
    starting element again ends with "not found".
  - 5 = **first sibling**, 6 = **last sibling**: repeat step 4 (resp. 3) until no further
    element, the last one reached is the result; then, while that element is flagged
    "skip" (element flag bit `0x8`), step back in the opposite direction.
- After every step the element's flags are read; an element with flag bit `0x8` is skipped
  (the step is repeated from it) (inferred: hidden / non-navigable entries).
- `NavFilter`: 1..9 = only elements whose element-ref type code (E3DELEMREFTYPE) equals the
  value are accepted; **10 = no filter**; **11 = same type as Source** (the Source's own type is
  read at UnPackArg); 0 or >11 -> `0x80070057`.
- `NavSubFilter`: 1 = also require the same object sub-class code as Source (a code derived
  from the element's class id, e.g. light / camera / null variants); 0 = type only; any other
  value leaves the previous setting (default 1).
- Element type 5 with sub-class code other than `0x56` uses a separate pair of step helpers
  (inferred: elements whose children are not plain scene children).
- `NavLoop` is read and stored (bool); it is consumed by the sibling step helpers
  (inferred: wrap around at the first / last sibling instead of stopping).
- Result: `OutputObj` = a new element reference (created with `F3DCreateElemRef`) to the
  element reached. **When nothing is found the result is the Source element itself** (the
  starting position is restored), not empty.
- Undo / Redo are no-ops; no scene change.

### 3.2 `SelectNeighborObj` (comparison only): SPEC (for what tasks.dll holds)

`tasks.dll` registers this CLSID but its object is a script-backed command: the only real
entry runs the command's script implementation (`SIRunScriptFromCommand`, `S_FALSE`
mapped to 1); Do / Undo / Redo of its task part are no-ops. There is no native
direction table in `tasks.dll`, so the 0-based registry presets of `SelectNeighborObj`
(`NavigDirection` 0..5) cannot be mapped from this DLL. They are a different encoding from
`NavigateNode`, which is 1-based (1..6).

### 3.3 `CreateFolder`: SPEC

- Args: `Target` (element, required), `Name` (string, default "Folder"), `Folder` (out).
- UnPackArg: Target's hierarchy must expose the insert interface `d9347b2a…`, else the
  command fails (`E_NOINTERFACE`-class error). Target's position in that hierarchy is kept.
- Do: creates one new folder object (class `d83a01b2-3b11-11d4-b6a4-006094eb029c`), inserts it
  into Target's hierarchy at Target's position (as a child of Target) (inferred: "child");
  if `Name` is non-empty, sets the folder's Name parameter (`2b91c031…`) to it verbatim.
  No suffixing / uniqueness logic in the task (inferred: any de-duplication is done by the
  object's own naming). An empty Name leaves the class default name.
- Output `Folder` = the new folder.
- First run stores soft references to the folder for Undo (removes it) and Redo (re-inserts).

### 3.4 `MoveToFolder`: SPEC-PARTIAL

- Args: `Target` (element, required), `InputObjs` (list, required).
- UnPackArg: Target's hierarchy is queried for the folder membership interface
  `6be9263a-3aee-11d4-b6a4-006094eb029c`; **if it does not support it, UnPackArg fails and the
  command fails** (no partial change). Then reads `InputObjs`.
- Do: passes the input list to the folder's membership interface (add members); first run
  stores two soft references to the folder for Undo / Redo.
- Missing: Ghidra dropped most of the worker's blocks, so whether members are also removed
  from a previous folder, and per-item error handling, were not read.
- Returns no value.

### 3.5 `RemoveFromFolder`: SPEC

- Args: `Target` (element, required), `InputObjs` (list, required). UnPackArg only reads them.
- Do: resolves Target's hierarchy, queries the folder membership interface `6be9263a…`;
  **fails if absent**; then removes the listed objects from the folder; first run stores
  the undo data (state of the folder before the change). Returns no value.

### 3.6 `PinUVComponents` / `UnPinUVComponents` / `PinAllUVComponents` / `UnPinAllUVComponents`: SPEC

One task; the behaviour is chosen by the invoked script name: Pin = 1, PinAll = 2, UnPin = 3,
UnPinAll = 4; any other name does nothing.
- Args: `UVProp` (required, else `0x80070057` raised), `UVComponents` (array of int; for
  Pin / UnPin an empty or missing array raises `0x80070057` at UnPackArg).
- If Pin/UnPin receive an empty list at Do -> `S_FALSE`, nothing changes.
- If UVProp is locked (lock check with level 4) -> lock error raised, `0x80070005`.
- `UVComponents` are **element indices of the cluster the UV property lives on** (the
  UVProp's parent cluster element count is the bound). For the usual complete sample
  cluster these are sample indices (inferred). Any index < 0 or >= element count -> the
  whole command fails with `0x80070057`. A cluster with 0 elements -> `S_FALSE`.
- State: the pinned flags are a bit array (one bit per cluster element) stored with the UV
  data as a binary stream. Pin ORs the given bits in, UnPin clears them, PinAll sets every
  bit, UnPinAll clears every bit. The new array is written through a data-setting
  sub-command (undoable; kept for Undo on the first run) and the UVProp is then notified.

### 3.7 `GetSize`: SPEC

- Args: `InputObjs` (list, required), outputs `StaticSize`, `DynamicSize`, `Value`.
- Do: only when the list holds **exactly one** object (list count == 1) it runs the imported
  `C3DInfoReportTraverser` on it and calls its `GetSize`, which returns static size, dynamic
  size and a total; StaticSize = static, DynamicSize = dynamic, Value = total
  (inferred: total = static + dynamic; units bytes, the same traverser feeds
  `GenerateInfoReport`). The definition of "static" vs "dynamic" belongs to that imported
  traverser and is not in `tasks.dll`.
- With 0 or more than 1 object the outputs keep their initial value 2^64-1, written out as
  the double 1.8446744073709552e19.
- Outputs are written as doubles. Do returns `S_OK` in all non-error cases. Undo/Redo no-ops.

### 3.8 `Tag` / `Untag` (with `Lock` / `Unlock`): SPEC

One task for four commands; `SubType` selects: 0 = lock, 1 = unlock, 1 with `RemoveAll` true
-> 2 = unlock all, **3 = tag, 4 = untag**.
- Args: `InputObjs` (list, required), `Level` (int bitmask; registry default the enum constant
  `siTagAll` of `siTags`), `SubType`; Lock/Unlock also `Password`, `RemoveAll`.
- Tag / Untag: `Level` 0 -> error raised `0x80070057`, message XSITASKS 1073 "The tag level %d is
  invalid". For each input element: if it has no component id (inferred: the object itself
  rather than a parameter) a warning (XSITASKS 1069) is logged and it is skipped; otherwise a
  lock-info record {component id, level = Level bits, type = 2 (tag)} is **added** (Tag) or
  **removed** (Untag) on the element's hierarchy. Tags are the lock mechanism with lock type
  2; Level is a bitmask of tag levels, not a name.
- No element processed -> `S_FALSE`. On first run a snapshot of the input list is kept for Undo.
- Lock path (for completeness): Level 0 -> error "Cannot lock or unlock with level set to
  siLockLevelNone."; unlock-all requires Level = siLockLevelAll (`0xffff`) else error; Level > 8
  (other than `0xffff`) or lock type > 4 -> nothing; system-locked / inherited locks -> messages
  XSITASKS 1066 / 1067; runs inside a global notification bracket.

### 3.9 `MoveComponent`: not implemented in tasks.dll

The CLSID is only referenced by `0x18005ed60` in `tasks.dll`. The implementing DLL is one
of the other three that carry the bytes: **`transformmanager.dll`** (inferred, it hosts the
transform tool tasks), else `viewinteraction.dll` / `imageclipeditor.dll`. Stopped here per task;
Q12 must be answered from that DLL.

## Open questions

- NavigateNode: the next/previous polarity of 3/4 is from helper pairing (inferred); NavLoop
  wrap semantics not read in the step helpers `0x180089bc0` / `0x18008a9e0`.
- MoveToFolder worker `0x180086c10`: whether objects leave their previous folder.
- GetSize: exact static/dynamic definitions live in the DLL exporting `C3DInfoReportTraverser`.
- MoveComponent: read `transformmanager.dll` `DllGetClassObject` for CLSID `da55a811…`.
