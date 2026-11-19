# CMD-B12a: ICE compound editing commands read from `optasks.dll` (AddExposedParamToICECompoundNode, EditExposedParamInICECompoundNode, RemoveExposedParamFromICECompoundNode, RemoveExposedPortPassThrough, GetICECompoundPortProperties, MoveICECompoundPort, MoveICECompoundPortsAndLayoutGroups, CreateLayoutGroupInICECompoundNode, RenameICEPPGLayoutGroup, HideAllPortValues, PrivateGetCompoundConstructionMode, ReplaceICECompoundNode)

Row: **CMD-B12a**. Status: **SPEC** (9 names), **SPEC-PARTIAL** (3 names); per command below (3 promoted in batch 13, see addendum).
Run: 2026-11-19, si-analyst worker, unattended, batch 12 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\optasks.dll`, image base `0x180000000`,
sha256 `bd94e0d535c21eeedc7b827512d61e0ba4f328d37ea7ed26af43c1aa5bf5c61f`.
Method: CLSID → factory → constructor → task vtable map built by a sibling worker from
`DllGetClassObject` (`0x180011e30`); Ghidra decompilation of the task vtable slots
(slot 0 destructor, slot 5 Do(undoable flag), slot 6 Undo, slot 7 Redo, slot 8 UnPackArg,
slot 9 RePackArg / QueryInterface), the per-task worker (task vtable slot 15, or slot 9 of a
helper sub-object at task offset `+0x38` with its own vtable), and `read_bytes` of vtables.
Arguments and defaults come from `data/command_registry.json`. Message ids are
`XSIOPTASKS` dictionary ids (texts not in the repo). All statements are behaviour read from
the binary unless marked `(inferred)`.

## 1. Handler table

| Command | CLSID | Constructor | Do (slot 5) | Worker |
|---------|-------|-------------|-------------|--------|
| `AddExposedParamToICECompoundNode` | `26cb16ed-194a-4427-b56a-be703f019673` | `0x180093050` | `0x180093f00` | helper slot 9 (not read) |
| `EditExposedParamInICECompoundNode` | `60381d74-bde7-4980-82d4-a48f6f5780c5` | `0x1800b5650` | `0x1800b5c60` | task slot 15 (not read) |
| `RemoveExposedParamFromICECompoundNode` | `bf8f591a-6c3e-417c-a2ff-25e6f765f374` | `0x1800bdaa0` | `0x1800bff80` | helper slot 9 `0x1800be4c0` |
| `RemoveExposedPortPassThrough` | `a91d22e2-c883-41ab-9330-4e1a317f56b5` | `0x1800bdb30` | `0x1800bffd0` (no Ghidra function) | helper slot 9 `0x1800bf860` |
| `GetICECompoundPortProperties` | `55fec68a-1300-4425-af00-52a29fca153d` | `0x1800b7b30` | `0x1800b80c0` | task slot 15 (not read) |
| `MoveICECompoundPort` | `f1b5f0c8-a84f-431b-9581-a64349401c84` | `0x1800b98b0` | `0x1800b9df0` (no Ghidra body) | helper slot 9 `0x1800b9b20` |
| `MoveICECompoundPortsAndLayoutGroups` | `7713d549-6ba4-4cbc-b57a-7f182e778408` | `0x180005120` | `0x180005580` | helper slot 9 `0x1800053c0` |
| `CreateLayoutGroupInICECompoundNode` | `e6a70747-727c-4c59-8967-df7e35f45e4d` | `0x1800010f0` | `0x180001750` | helper slot 9 `0x180001550` |
| `RenameICEPPGLayoutGroup` | `6c0a3174-80f4-4e8b-b6d2-2b617206c665` | `0x180004a10` | `0x180004e50` | task slot 15 `0x180004ca0` |
| `HideAllPortValues` | `a7c8afef-aabf-4bc6-a6cb-505e4065327c` | `0x1800ba0d0` | `0x1800ba750` | `0x1800ba4a0` / `0x1800ba5b0` |
| `PrivateGetCompoundConstructionMode` | `fc8efed4-79b8-48be-90ca-e44cddd8feb7` | `0x1800a8530` | `0x1800aa710` | `0x1800a8af0` (path resolver) |
| `ReplaceICECompoundNode` | `ce6ac9da-b883-4129-a6c4-2ba96eee4bce` | `0x1800c2340` | `0x1800c3b30` | helper slot 9 (not read) |

UnPackArg (slot 8) / RePackArg (slot 9) addresses: Rename `0x180005000` / `0x180004f30`;
MovePortsAndLayoutGroups `0x180005780`; CreateLayoutGroup `0x1800019d0` / `0x180001930`;
MoveICECompoundPort `0x1800b9fe0`; HideAllPortValues `0x1800baca0`;
PrivateGetCompoundConstructionMode `0x1800aac00` / `0x1800aa9b0`; AddExposedParam `0x1800944d0`;
EditExposedParam `0x1800b6010`; GetICECompoundPortProperties `0x1800b87c0`;
RemoveExposedParam `0x1800c06c0`; RemoveExposedPortPassThrough `0x1800c07e0`; Replace `0x1800c4050`.

## 2. Shared facts

- **Compound interface.** Every command resolves its compound / node argument to the ICE
  compound-node interface `fbf83198-8578-43ed-ae60-ca56d84d25c0` (queried through the object's
  generic "get interface" method). An object that does not have it, or whose "is read-only /
  is a reference" test (interface method `0xf8`) is true, is dropped; UnPackArg then fails
  with `0x80004005` (E_FAIL).
- **Lock check.** Before changing a compound the worker builds a lock status on the compound
  and tests every lock level (`0xffff`). A locked compound raises the lock error and the
  command returns `0x80070005` (E_ACCESSDENIED).
- **Undo record.** When the Do flag (undoable) is set and the change succeeded, the worker
  stores a soft reference to the compound (`F3DCreateObjectReference`) plus the state the
  compound method hands back (a "was-new" flag and an opaque undo blob); Undo calls the
  inverse compound method with that state, Redo re-runs the worker. Undo / Redo before a
  successful Do return `0x8000FFFF`; a missing compound returns `0x80004003`.
- **Argument errors** inside workers are `0x80070057` (E_INVALIDARG).
- **Graph update bracket.** Port / node edits run inside an "ICE graph update" bracket so the
  tree is re-evaluated once after the edit.
- The actual compound edits are methods of the compound object implemented outside
  `optasks.dll` (ICE core, inferred); the contracts below give the method's role.

## 3. Contracts

### `RenameICEPPGLayoutGroup`: SPEC

Wire contract:
- Args: `Compound` (required ICE compound node), `Name` (current group name), `NewName`
  (in / out string).
- Fails `0x80004005` in UnPackArg when `Compound` is not an editable compound.
- Worker: fails `0x80070057` when the compound is missing or read-only or `Name` is empty.
  When `Name` equals `NewName` ignoring case, nothing happens and the command returns `1`
  (S_FALSE). Otherwise lock check, then the compound renames the PPG layout group `Name` to
  `NewName`; the compound may adjust the name (made unique, inferred) and the final name is
  written back to the `NewName` argument (RePackArg).
- Undo: the compound's "undo rename layout group" method with the stored names and state.

### `CreateLayoutGroupInICECompoundNode`: SPEC

Wire contract:
- Args: `Compound` (required), `Names` (array of strings: exposed port names and/or existing
  group names to put in the group; must be an array, else `0x80070057`), `Group` (default
  `"Group"`), output `Value` (string).
- An empty `Group` is replaced by `"Group"`.
- Worker: fails `0x80070057` when the compound is missing / read-only or `Names` is empty.
  Lock check. The compound creates a layout group named `Group` containing the listed items,
  in list order; the name actually used (made unique by the compound, inferred) is returned
  in `Value`.
- Undo: when `Names` has exactly one entry the undo renames the group back to an empty name
  (the one-item case behaves as a rename of an existing group, inferred); with two or more
  entries the compound's "undo create group" method restores the previous layout from the
  stored blob (the blob is only recorded when there are 2+ names).

### `MoveICECompoundPortsAndLayoutGroups`: SPEC-PARTIAL

Wire contract:
- Args: `Compound` (required), `Names` (array of port / group names; must be an array,
  else `0x80070057`), `Marker` (name of the reference item, required non-empty),
  `MoveAction` (integer, default 1).
- Worker: fails `0x80070057` when the compound is missing / read-only, `Names` is empty or
  `Marker` is empty. Lock check. The compound moves the named items, keeping their order,
  relative to `Marker` according to `MoveAction`. Undo restores the previous layout order.
- Missing: the `MoveAction` numbering is interpreted inside the compound method; by analogy
  with the other move commands 0 = before, 1 = after (inferred, default 1 = after).

### `MoveICECompoundPort`: SPEC

Wire contract:
- Args: `InputObj` (required: an exposed port of a compound), `Step` (integer, default 1).
- UnPackArg: `Step` = 0 fails `0x80070057`.
- Worker: fails `0x80070057` when the port has no owning compound or the owner is read-only;
  lock check on the owner (`0x80070005`). It lists the compound's exposed ports on the
  port's side (inputs or outputs), finds the port's current position (0-based); if the port
  is not in the list, `0x80004005`. It then moves the port by `Step` positions (negative =
  towards the top, positive = towards the bottom, inferred from the sign) within that side.
- Undo moves it back from the new position by the inverse step.

### `GetICECompoundPortProperties`: SPEC (promoted batch 13, see addendum)

Wire contract:
- Args: `Parameter` (an exposed port / parameter of a compound, required), output
  `OutputArgs` (variant array).
- UnPackArg resolves the compound from `Parameter`; none → `0x80004005`.
- Do runs the query worker; failures are passed on, success returns `S_OK`. Not undoable.
- Missing: the list and order of values written to `OutputArgs`. By the matching
  `EditExposedParamInICECompoundNode` arguments they are Name, Min, Max, Picking,
  Description, ExposeType, Enum, PPGLayoutGroup (inferred).

### `EditExposedParamInICECompoundNode`: SPEC (promoted batch 13, see addendum)

Wire contract:
- Args: `Parameter` (exposed port, required), `Name`, `Min`, `Max`, `Picking`,
  `Description` (strings, default empty), `ExposeType` (integer, default 0), `Enum` (string),
  `PPGLayoutGroup` (string).
- UnPackArg resolves the compound from `Parameter`; none → `0x80004005`. All other
  arguments are copied as given (strings, so `Min` / `Max` are textual values).
- Do: the worker applies the new properties to the exposed port of the compound.
- Missing: which empty strings mean "leave unchanged", the `ExposeType` values and the
  `Enum` string format (worker slot 15 not read).

### `AddExposedParamToICECompoundNode`: SPEC-PARTIAL

Wire contract:
- Args: `Parameter` (the inner node port to expose, required), `Compound` (required
  compound), `ExistingPort` (optional existing exposed port to connect to instead of
  creating one), `Name` (default empty = automatic name), outputs `Operator`, `NewPort`.
- UnPackArg: no editable compound → `0x80004005`.
- Do resets three output slots to -1 and calls the worker with (Parameter, Compound, Name,
  ExistingPort, undoable flag); the worker creates (or reuses) the exposed port and connects
  the inner port to it, returning the new exposed port.
- Missing: worker not read (naming rule, error cases, how `Operator` is filled).

### `RemoveExposedParamFromICECompoundNode`: SPEC

Wire contract:
- Args: `Parameter` (exposed port, required), `Compound` (required).
- UnPackArg: no editable compound → `0x80004005`.
- Steps (shared "remove exposed port" worker, called with: no reconnection of other
  instances, delete the exposed port, connect-through on, keep pass-through nodes,
  clean-up on):
  1. Clears pending sub-tasks. A null `Parameter` or compound raises message `0x111`
     (severity 2) and returns `0x80070057`.
  2. Inside a graph-update bracket, disables the compound's evaluation notifications.
  3. Finds where the exposed port is connected inside the compound (input side first, then
     output side). The inner connection is removed and, for each inner port that was fed by
     the exposed port, the value / connection is pushed back onto that inner port (a
     "set value / reconnect" sub-task per port), so the inner graph keeps its current value.
  4. Removes the exposed port from the compound (sub-task). When the compound reports the
     port cannot be removed (`E_POINTER` from the remover) the command raises message
     `0x174` (severity 2) and returns `0x80070057`.
  5. Clean-up: when the removed port was the last port of a layout group, the empty group
     is removed (sub-task, inferred); the compound's notifications are re-enabled.
- Every step is recorded as a sub-task when undoable, so Undo replays them in reverse.

### `RemoveExposedPortPassThrough`: SPEC

Wire contract:
- Args: `Port` (required; an exposed port of a compound). A port whose owner is not a
  compound is dropped and UnPackArg returns `1` (S_FALSE: nothing to do).
- Steps:
  1. Finds the node inside the compound that is attached to the exposed port and tests
     whether it is a pass-through node (interface `41c1a19e-e731-4f98-a68c-c992b8389fe6`
     test). Not a pass-through → nothing.
  2. Finds the pass-through's upstream source and walks downstream from it until it reaches
     the port that belongs to the compound.
  3. Reconnects the upstream source directly to that downstream port (connect sub-task),
     then disconnects the pass-through's input (disconnect sub-task) and deletes the
     pass-through node (delete sub-task, flag `0x10`).
- Each step is recorded as a sub-task when undoable.

### `HideAllPortValues`: SPEC (promoted batch 13, see addendum)

Wire contract:
- Args: `InputObjs` (list; default selection). Only items that are ICE nodes
  (interface `9baa676e-c3a0-420f-91e2-13f1559a2f50`) are kept; if none, Do returns `1`
  (S_FALSE) and does nothing.
- Do: inside a graph-update bracket, for each node: a node that belongs to a referenced
  model is skipped with warning `XSIOPTASKS 0x425` (severity 2); otherwise all its port
  value displays are hidden. When undoable, a soft list reference of the nodes is kept.
  Afterwards, if the task's "refresh" flag is set, the ICE tree viewer is refreshed.
- Undo: the same walk with the "restore" flag, then the same refresh.
- Missing: the per-node hide step (`0x1800ba5b0`) did not decompile cleanly; whether it
  hides the value display of every input port or only of unconnected ones is not read.

### `PrivateGetCompoundConstructionMode`: SPEC

Wire contract:
- Args: `File` (compound file path, default empty), output `Mode` (integer).
- Path: if `File` exists it is used as is; otherwise the name is looked up through the
  compound search-path resolver (data-folder lookup), and failure gives `0x80004005`.
- The compound file header is read with the compound-file reader object; a read failure
  gives `0x80004005`. On success the header's construction-mode field is returned in `Mode`
  and the command returns `1` (S_FALSE, the success value of this task).
- Not undoable. `Mode` values follow the compound's construction-mode setting
  (`siConstructionMode` numbering, inferred).

### `ReplaceICECompoundNode`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (list of compound nodes; non-compound items dropped), `Version`
  (string, default empty).
- `Version` is a comma-separated list, one item per compound in list order; each item is
  `major.minor` (both parsed as integers). An item without `.` (or a missing item) gives
  major = minor = -1, meaning "latest version" (inferred).
- For each compound the replace worker swaps the node for the compound definition of that
  version, undoable as one task per node. With no compound in `InputObjs`, Do returns
  `0x80004005`.
- Missing: replace worker (helper slot 9) not read: how the definition is located, how
  connections and values are carried over.

## Open questions

1. `MoveICECompoundPortsAndLayoutGroups` `MoveAction` numbering (compound method).
2. `GetICECompoundPortProperties` `OutputArgs` layout; `EditExposedParamInICECompoundNode`
   "unchanged" rule, `ExposeType` and `Enum` formats (task slot 15 of each).
3. `AddExposedParamToICECompoundNode` and `ReplaceICECompoundNode` helper workers.
4. `HideAllPortValues` per-node rule; XSIOPTASKS 0x425, 0x111, 0x174 texts.
5. `CreateLayoutGroupInICECompoundNode` one-name undo path (rename to empty).

## Addendum 2026-11-19 (batch 13): PR #185 answers

Run: si-analyst worker, REA + Ghidra 12.1.4 on the PC, same binary (sha256 above). Answers to the wire
agent's questions on this row. No decompiler output reproduced; behaviour described in prose.

**Q1 `MoveICECompoundPortsAndLayoutGroups` `MoveAction`: OPEN (not in optasks).** UnPackArg
(`0x180005780`) reads `MoveAction` as an unsigned integer with no range check and stores it; the worker
(`0x1800053c0`) hands it unchanged to the compound's "move ports / groups" method (compound interface
slot `0x1e0`, together with the name list, the marker and an out "was-changed" flag and undo blob). The
numbering is decided in the ICE core, not here. Keep the existing 0 = before, 1 = after reading as
`(inferred)`; values above 1 are not rejected by the command.

**Q2a `GetICECompoundPortProperties` `OutputArgs`: ANSWERED.** Task slot 15 is `0x1800b7f90`; the
property reader `0x1800c4b20` fills a property record and RePackArg (`0x1800b8100`, task slot 9) writes
`OutputArgs` as an 8-element variant array (VT_ARRAY|VT_VARIANT), in this order:
0 `Name` (BSTR), 1 `Min` (BSTR), 2 `Max` (BSTR), 3 `Picking` (BSTR), 4 `Description` (BSTR),
5 `ExposeType` (VT_I4), 6 `Enum` (BSTR), 7 `PPGLayoutGroup` (BSTR).
The names are certain: the record offsets read here are the same offsets
`EditExposedParamInICECompoundNode`'s UnPackArg (`0x1800b6010`) fills from those argument names.
- `Name` is the exposed port's display name; when that is empty, the port's internal name is returned.
- `Enum` is rebuilt from the port's enum item list as `first,second;` per item, every item followed by
  `;` (so a non-empty result always ends with `;`).
- Errors: null port or compound → message `0x111` (severity 2), `0x80070057`; the port cannot be found
  in the compound → `0x80004005`; null output → `0x80004003`.

**Q2b `EditExposedParamInICECompoundNode` "unchanged" rule: ANSWERED.** Worker `0x1800b59f0`
(task slot 15), apply step `0x1800c4e60`:
1. Clears sub-tasks; null port / compound → `0x111`, `0x80070057`. Lock check on the compound
   (`0x80070005`). Port not found in the compound → `0x80004005`.
2. When the run is undoable, the current properties are read first (kept for undo), and each field is
   applied **only when it differs from the current value**. When the run is not undoable there is no
   "current" record, so every field counts as changed.
3. `Name` is the only field where empty means "leave unchanged": it is applied only when non-empty
   (and different). Every other string field (`Min`, `Max`, `Picking`, `Description`, `Enum`,
   `PPGLayoutGroup`) is applied when it differs, **including to an empty value** (passing "" clears it,
   inferred for `Min` / `Max` / `PPGLayoutGroup`, which the record passes without a change bit).
   Change bits handed to the compound: Name `0x8`, Picking `0x1`, ExposeType `0x2`, Description `0x10`.
4. `ExposeType` is an opaque integer passed through to the compound (no range check in optasks); its
   numbering is in the ICE core (still OPEN; keep it a stored integer).
5. `Enum` parsing: the string is split on `;`; each item is split at its first `,` into two parts;
   items without a `,` or with an empty part are dropped silently; the last item may omit the trailing
   `;`. The two parts keep their order (the same `first,second` order `GetICECompoundPortProperties`
   returns).
6. When undoable, the properties after the edit are re-read and kept for Redo; Undo re-applies the
   saved "before" record (inferred: Undo body not read this batch).

**Q4a `HideAllPortValues` per-node rule: ANSWERED.** Per node (`0x1800ba5b0`):
1. A node inside a referenced model → warning `XSIOPTASKS 0x425` (severity 2) and that node returns
   `0x80070005`.
2. The hide step (`0x1800baa10`) does nothing for a read-only / referenced compound, nor for a node
   whose "can show values" query (node slot `0xb8`) is false. Otherwise it lists the node's ports and,
   for every port entry the node marks as value-displayable (entry flag at `+0x18`, inferred meaning),
   sets that port's "show value" flag to the target state when it differs; any change sets the task's
   refresh flag (so the tree view is only refreshed when something changed). **Connectedness is not
   tested**: all listed ports are hidden.
3. If the node is a compound, the same walk is applied recursively to its inner nodes
   (`0x1800ba4a0`).
4. Undo runs the walk with target state "shown" for every listed port: it does not remember which
   ports were already hidden before the command, so it shows all of them (observed: no per-port state
   is stored, only the node list).

**Q4b `CreateLayoutGroupInICECompoundNode` one-name undo: not re-read this batch** (contract already
SPEC; the one-name "rename back to empty" path stands as written).

**Promoted SPEC-PARTIAL → SPEC:** `GetICECompoundPortProperties`, `EditExposedParamInICECompoundNode`,
`HideAllPortValues`. Still SPEC-PARTIAL: `MoveICECompoundPortsAndLayoutGroups` (Q1),
`AddExposedParamToICECompoundNode`, `ReplaceICECompoundNode`.
