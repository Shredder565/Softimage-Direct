# CMD-B20b: groups, partitions, environments, skeleton / joint, vertex colours, cluster copy, path keys (grouptask, environments, viewinteraction, gap, siclustertasks, pathanimtask)

Row: **CMD-B20b** (closes the CMD-B19-NEXT leftovers listed below). Status over the 13 required names:
**SPEC** 4 (`AddToPartition`, `SICreateGroup`, `SetCurrentEnvironment`, `CopyCluster`), **SPEC-PARTIAL** 9.
Confirmations: `SetInstanceGroup`, `RemoveInstanceGroup` (CMD-B7a contracts stand, creation-function address
corrected), `AddGroup` (new contract, SPEC-PARTIAL). One handler-DLL correction: `SICreateSkeleton` is served by
**viewinteraction.dll** (registry lists `sicoresdk.dll` first).
Run: 2026-11-21, si-analyst batch 20 (binary first, REA + Ghidra 12.1.4 on the PC).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binaries (opened one at a time, each closed afterwards; image base `0x180000000` for all):
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\grouptask.dll`, sha256
  `a64a3c40c491e361e5245aa22c38806f2d19b4b8a0e635588fba89b7fae4ad52` (same build as CMD-B7a).
- `...\bin\environments.dll`, sha256 `fca52f0c7310761d76e9ffd7ec74842534a3d2dc377eca5319a638842b8fdaf5` (same as CMD-B19b).
- `...\bin\viewinteraction.dll`, sha256 `1c94d24c3bd9bc01e94164b19e7c4848851316d5cb5b29a0a0843c004bee6f71`.
- `...\bin\gap.dll`, sha256 `d3ab9b2645cbd3126b9446124d057a1f277808267067bf22ed02c3a46d565646`.
- `...\bin\siclustertasks.dll`, sha256 `181811fa53efd74c4e4fd877bfc93f99b2f6261235666270e7e815c0151e609b` (same as CMD-B7a).
- `...\bin\pathanimtask.dll`, sha256 `0f53f5b10e54a28ac91794a5e054a6eab31105ca1fe35a03859177a52e4d034a`.

Method: each handler CLSID was located either by reading the inline 64-bit compare chain of `DllGetClassObject`
(grouptask `0x18000b710`, environments `0x1800158e0`, gap `0x18002bc90`, pathanimtask `0x180007590`) or by
`search_bytes` on the CLSID's first 8 little-endian bytes and following the reference into the dispatch
(viewinteraction `0x180025140` uses an IsEqualGUID chain with a templated factory constructor; siclustertasks
reference `0x180010fae`). Factory vtable slot 6 = create; create → constructor (object size) → task vtable
(slots 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg) and worker vtable. Statements are behaviour read from the
binary unless marked `(inferred)`.

## 1. Handler table

| Command | DLL | Handler (CLSID short; factory vtable → create → ctor (size); task vtable Do / UnPack / RePack; worker) | Status |
|---|---|---|---|
| `AddToPartition` | grouptask | `4e021856…` fvt `0x180017140` → `0x18000b420` → `0x180002bd0` (0xe8); tvt `0x1800116d0` Do `0x180009cf0` (no Ghidra function; shared with RemoveFromPartition) / Undo `0x180003040` / Unpack `0x1800031e0`; worker vt `0x180011740` slot 9 `0x180002e30`; helpers `0x18000bd90` (split args), `0x18000c060` (source partition), `0x18000bd80`→`0x18000c730` (apply, mode 1) | SPEC |
| `RemoveFromPartition` | grouptask | `4e021857…` fvt `0x180017178` → `0x18000b520` → `0x180009a00` (0xa8); tvt `0x180015e50` Do `0x180009cf0` / Undo `0x180009d10` / Unpack `0x18000a270`; worker vt `0x180015ec0` slot 9 `0x180009be0`; helpers `0x180009e80` (partition from objects), `0x18000bfc0` (remove) | SPEC-PARTIAL |
| `SIAddToGroupLowLevel` | grouptask | `0b9f8320…` fvt `0x1800170d0` → `0x18000b460` → `0x180003360` (0xe0; base `0x1800054d0`, group-type filter = 3); command vtable `0x180011eb0`: slot 8 `0x180006760` (store refs), 9 `0x1800066a0` (resolve refs), 11 `0x1800063d0` (gather input), 12 `0x180005ac0` (find target), 15 `0x1800044e0` (applicability test); the add itself is in an imported base class | SPEC-PARTIAL |
| `SIRemoveFromGroup` | grouptask | `0b9f8322…` fvt `0x180017108` → `0x18000b560` → `0x180008050` (0xe0; base `0x180006880`, filter = 3); command vtable `0x1800153a0`: slot 11 `0x180006b00` (find target); removal in the imported base | SPEC-PARTIAL |
| `SICreateGroup` | grouptask | `03f2fdf0…` fvt `0x180017098` → `0x18000b4e0` → `0x180007460` (0xe8, task-first); tvt `0x180014920` Do `0x1800079b0` / Undo `0x180007aa0` / Redo `0x180007a20` / Unpack `0x180007ed0` / RePack `0x180007b80`; worker vt `0x1800149e0` slot 9 `0x180007740` | SPEC |
| `AddGroup` (confirm) | grouptask | `06af33ae…` fvt `0x1800171b0` → `0x18000b3e0` → `0x180001000` (0xd0, task-first); tvt `0x180010e50` Do `0x180001f20` / Undo `0x180001f80` / Unpack `0x1800027f0`; worker vt `0x180010f10` slot 9 `0x180001ac0`; helpers `0x180002870` (filter groups), `0x180001410` (move) | SPEC-PARTIAL |
| `SetInstanceGroup` (+ `AssignObjectGroup`, `SetParTypeInstanceGroup`) (confirm) | grouptask | `e0717f47…` the factory is built with vtable `0x1800171e8` and then **re-pointed to `0x180017220`**: effective create `0x18000b2e0` (CMD-B7a's `0x18000b4a0` is the overwritten base slot); same ctor `0x180004800` (0x138), then the object's init slot 7 runs and a failure releases the object | as CMD-B7a (SPEC-PARTIAL) |
| `RemoveInstanceGroup` (+ `UnassignObjectGroup`, `RemoveParTypeInstanceGroup`) (confirm) | grouptask | `d534de9f…` vtable `0x180017258` re-pointed to `0x180017290`: effective create `0x18000b360` (B7a: `0x18000b5a0`); ctor `0x18000a400` (0xe8) + init | as CMD-B7a (SPEC-PARTIAL) |
| `SetCurrentEnvironment` | environments | `9b4cc51c…` fvt `0x1800259a0` → `0x1800156f0` → `0x180011590` (0xe0); tvt `0x1800239f0` Do `0x180011b70` (guard stub, tail-jumps to worker `0x180011960`) / Undo `0x180011c90` / Redo `0x180011b90` / Unpack `0x180011ee0` | SPEC |
| `SIStoreEnvironmentCacheToMixer` | environments | `8ffda6cb…` fvt `0x180025930` → `0x180015770` → `0x1800131c0` (0xd0); tvt `0x180024b60` Do `0x1800146d0` / Undo `0x180014750` / Redo `0x180014700` / Unpack `0x180014b30` / RePack `0x1800148d0`; worker `0x1800134a0` | SPEC-PARTIAL |
| `MoveJoint` | viewinteraction | `ca6a8073…` factory ctor `0x18002a6e0` (vt `0x1802226b8`) → create `0x18003c850` → `0x180153560` (0xa8, class string `C3DMoveJointTask`); tvt `0x18024bc90` Do `0x180153d50` / Undo `0x180153ed0` / Redo `0x180154660` / Unpack `0x180154760` / RePack `0x180154a60`; worker vt `0x18024bd50` slot 9 `0x180153740` (slot 10 = pre-move snapshot) | SPEC-PARTIAL |
| `SICreateSkeleton` | **viewinteraction** | `59c1e31b…` factory ctor `0x180029de0` (vt `0x1802224f8`) → create `0x18003c070` → `0x18017a530` (0x200). Not a classic task: QueryInterface `0x18017a800` exposes only private interface `59c1e31a-bdf1-11d2-8433-00a0c961747d` (and `b394fc31-166f-11d2-ac38-00a02485cecb`) at `+0x18` (vt `0x180250e30`); execute-from-context `0x18017a920`; chain builder (interface slot 11) `0x18017cec0` (not read) | SPEC-PARTIAL |
| `CreateVertexColorSupport` | gap | `ab483760…` fvt `0x180049cc8` → `0x18002b740` → `0x180018150` (0x70, task at `+8`); tvt `0x18003cf70` Do `0x180019820` / Undo `0x18001e5f0` / Redo `0x180019890` / Unpack `0x1800199f0` / RePack `0x180019920`; worker vt `0x18003d020` slot 4 `0x1800194d0`, slot 3 `0x1800192d0` (per-object create, not read) | SPEC-PARTIAL |
| `PaintVertexColors` | gap | `17007160…` fvt `0x180049d00` → `0x18002b8c0` → `0x180019d90` (0x1a8, task at `+8`); tvt `0x18003db00` Do `0x18001b3a0` / Undo `0x18001b4c0` / Redo `0x18001b490` / Unpack `0x18001bb40` / RePack `0x18001b5b0`; work function (object slot 10) `0x18001af70` | SPEC-PARTIAL |
| `CopyCluster` | siclustertasks | `88f1aa51…` fvt `0x18001c810` → `0x180010960` → `0x180005370` (0xa8, task-first); tvt `0x180017890` Do `0x180005fc0` / Undo `0x180006040` / Redo `0x180005ff0` / Unpack `0x1800061c0` / RePack `0x1800082c0`; worker vt `0x180017950` slot 9 `0x180005930`; per-target copy `0x1800055b0` | SPEC |
| `SaveKeyOnPath` (2 registry entries) | pathanimtask | `aef278f7…` (only CLSID in the DLL) fvt `0x18000ca08` → `0x180007420` → `0x180001000` (0x80); tvt `0x180009c20` Do `0x180001690` / Undo `0x180001700` / Redo `0x1800016f0` / Unpack `0x1800017e0` / RePack stub; worker vt `0x180009c90` slot 9 `0x180001460`, slot 10 `0x180001310` → per-object key task ctor `0x1800019d0` (0xb0); X/Y/Z parser `0x180001180` | SPEC-PARTIAL |

## 2. Shared facts

### 2.1 Interfaces and constants (grouptask)
- Group `b0cbf80e-c0d5-11d0-a586-00a0c91412de`; group-kind interface `eff95861-6291-11d1-be9e-00a024ee478d`, slot 8 =
  get kind. Kind values seen: **3** = ordinary group, **4..6** = partition-like (any of 4, 5, 6 is accepted as an
  implicit target), **5 or 6** = the only kinds AddToPartition / RemoveFromPartition accept as Target (the two
  partition kinds; which is object vs light is not established, (inferred)).
- Group container (model / scene) `3ded5562-0bb6-11d3-ac82-00a02485cecb`; model `6b579d20-3dc5-11d0-9449-00aa006d3165`;
  object reference `102dcd80-4228-11d0-8463-00a024c7919c`; named object `9ee6ddb1-65cc-11d1-b0ce-00a024c79287`
  (slot 6 get name, slot 8 set name); pass-owner lookup `d233acd7-b2f5-4f26-9847-4752712f9260` (the owner both
  partitions must share, (inferred) the pass).
- New-group class `9d0673c2-6741-11d1-be9f-00a024ee478d`; list class `f49f6471-4211-11d0-8463-00a024c7919c` / list
  interface `f49f6470-…`; undo object-list class `a5dc1e66-4d0a-11d2-a5ca-00a0c91412de`.
- Group-argument splitting (helper `0x18000bd90`, used by both partition commands): walk InputObjs; an item of kind 8
  (group-like) whose group kind is 4..6 becomes the Target **if Target was not given and none was found yet**; a kind-3
  group is **expanded** into its members; kind-2 items (objects) are kept. Other items are ignored.
- `0x562e80c7` is treated as a neutral status that never overrides a real one; `0x562e80d2` (a success code) = "nothing
  to do".

### 2.2 Handler-DLL corrections
- `SICreateSkeleton`: registry `handler_dlls` = [sicoresdk, viewinteraction]; the CLSID is in viewinteraction's class
  dispatch and the object reads the command's arguments by name. sicoresdk was not opened.
- All other names: the first-listed DLL serves the CLSID (grouptask, environments, viewinteraction for MoveJoint, gap,
  siclustertasks, pathanimtask).
- Sub-tasks run by these handlers, mapped through `data/command_registry.json`: `CreateVertexColorSupport` (`ab483760`,
  run by PaintVertexColors), `AddFileCacheSource` (`5b3f5d9d`), `AddClip` (`67b8773b`), `SetValue` (`c089b901`),
  `DeleteObj` (`dd531990`) (run by SIStoreEnvironmentCacheToMixer), `CreateClusterFromSubComponent` (`5f1f5163`, run by
  CopyCluster).

## 3. Wire contracts

### `AddToPartition`: SPEC
Args: `Target` (group), `InputObjs` (list).
1. UnPack: Target is read as a group; "argument not found" (`0x80020008`) is accepted. InputObjs is split as in 2.1
   (implicit target, kind-3 groups expanded to members). No Target at the end → `0x80070057`. The Target's kind must be
   5 or 6, else `0x80070057`; no kind interface → `0x80004002`.
2. Do / worker: on first execution, look up the pass owning the Target; find the partition (of kind 5 or 6, in that same
   pass) that currently holds the objects. Every object must be kind 2 (else `0x80070057`), and all objects must come
   from **one** partition; when no source partition is found or they come from different partitions, raise
   `0x80070057`, severity 2, message `0x93` and stop.
3. Add the objects to the Target (apply mode 1). The membership change moves them out of their previous partition of
   the same pass (inferred: partitions of a pass are exclusive).
4. First execution keeps a copy of the object list, a soft reference to the source partition and one to the Target.
   Undo / Redo replay the same move (Undo = Redo entry `0x180003040`).
**Wire contract:** `AddToPartition(Target, InputObjs)` moves objects from their current partition of the pass into
the Target partition; Target may be given inside InputObjs; groups in InputObjs contribute their members; undoable.

### `RemoveFromPartition`: SPEC-PARTIAL
Args as AddToPartition. UnPack: same splitting; when no Target was given or found, the partition is derived from the
objects (helper `0x180009e80`); if that fails → `0x80070057`. Target kind 5/6 check as above.
Worker: remove the objects from the partition (helper `0x18000bfc0`); on first execution keep the object list and a
soft reference to the partition; returns 0 on first execution, 1 on replays. Where the removed objects go (the
pass's background partition) was not read, (inferred).
**Wire contract:** `RemoveFromPartition(Target?, InputObjs)` takes the objects out of the partition (given, found in
InputObjs, or derived from the objects); undoable.

### `SIAddToGroupLowLevel`: SPEC-PARTIAL
Args: `Target`, `InputObjs`, `OutputObj` (out), all untyped (vt 9). Command object with group-kind filter **3**.
- Target resolution (`0x180005ac0`): if `Target` is given, it is taken as a group. Otherwise the first InputObjs item
  that is a group of kind 3 becomes the Target and is removed from the member list. Items that are groups of another
  kind are skipped. A group without kind interface → `0x8000ffff`.
- Input gathering (`0x1800063d0`): InputObjs from the context; the command is applicable only when a Target was found.
- Applicability test (`0x1800044e0`) counts groups versus addable members in the selection (inferred: menu enable).
- The add itself, and the `OutputObj` value, are done by an imported base class (not in grouptask). Soft references to
  the Target, a soft list of the members and the output are kept for undo.
**Wire contract:** `SIAddToGroupLowLevel(Target?, InputObjs)` adds the members to an ordinary group; when Target is
empty the first group in InputObjs is the target; undoable.

### `SIRemoveFromGroup`: SPEC-PARTIAL
Args: `Target`, `InputObjs`. Filter kind 3. Target resolution (`0x180006b00`):
- An InputObjs item that is a kind-3 group becomes the Target (removed from the list).
- Otherwise every member's groups are inspected: the kind-3 group holding the first member is the candidate; if any
  other member's kind-3 group differs, there is **no** target (the command does nothing).
- Removal is in the imported base class.
**Wire contract:** `SIRemoveFromGroup(Target?, InputObjs)` removes members from one ordinary group: the given one, a
group listed in InputObjs, or the single group all members share; undoable.

### `SICreateGroup`: SPEC
Args: `Name` (string, ""), `Parent`, `Value` (out).
1. UnPack: `Name` must be a string (vt 8), else `0x80070057`. `Parent` is resolved and asked for the group-container
   interface; if Parent is missing or is not a container, the **current scene model** is used (no error).
2. Worker: if the container reports that it may not receive groups (container slot 21 returns 1), log a warning
   (severity 2, dictionary `XSIGROUPTASKS` string 11, composed with the container's name) and create nothing.
3. Otherwise create a new group object (class `9d0673c2-…`); if a Name was given set it (empty → the container's
   default naming, (inferred)); set the group flag at kind-interface slot 12 to 1; add the group to the container;
   record it for undo.
4. RePack writes `Value` = the new group (vt 13). Undo removes it from the container (only after a first execution,
   else `0x8000ffff`).
**Wire contract:** `SICreateGroup(Name="", Parent=current model)` creates an empty ordinary group under Parent and
returns it; refused (warning, no group) when the container does not accept groups; undoable.

### `AddGroup` (confirmation): SPEC-PARTIAL
Args: `Target` (group container), `InputObjs` (list). UnPack reads both.
- Target lock: if the Target is locked, raise the lock error and return `0x80070005`.
- Filter (`0x180002870`): empty InputObjs → `0x80004005`. Each kind-8 item is tested for being movable into the Target;
  an item that is not is logged (severity 4, message `0x34`, with its full name) and dropped. Nothing left →
  `0x562e80d2` (no-op).
- For each remaining group: find its current owning container, then move the groups into the Target (`0x180001410`);
  referenced-locked members are collected separately (not decoded). First execution stores both lists for undo and a
  soft reference to the Target; Undo moves them back (`0x180002130`).
**Wire contract:** `AddGroup(Target, InputObjs)` re-parents the listed groups under the Target model; groups that
cannot move are skipped with a warning; undoable.

### `SetInstanceGroup` / `RemoveInstanceGroup` (confirmation)
CMD-B7a contracts confirmed unchanged (same ctor, same Do/worker). Only the creation function differs: the class
factory's vtable is overwritten after construction, so the live create functions are `0x18000b2e0` / `0x18000b360`,
which build the same object and additionally run the object's init slot, releasing it and returning the error if
init fails.

### `SetCurrentEnvironment`: SPEC
Args: `InputObj` (list). UnPack: first item asked for environment interface `925a08ae-9427-46bf-828b-82bb83841bec`;
failure is returned. Do: no environment → `0x80004003`. Worker: get the environment container
(`F3DGetEnvironmentContainer`, interface `5f65436d-5fac-45e0-bd68-c0aff8737837`); remember its current environment
(slot 3); set the new one current (slot 4). First execution keeps soft references to the new and the previous
environment. Undo sets the previous one back; Redo repeats the switch.
**Wire contract:** `SetCurrentEnvironment(InputObj)` makes that simulation environment the current one; undoable.

### `SIStoreEnvironmentCacheToMixer`: SPEC-PARTIAL
Args: `EnvironmentCache` (object), `Name` ("SimulationRun"), `AddClip` (false), `Action` (out).
1. UnPack: EnvironmentCache asked for interface `12a3ef95-e543-11d2-b352-00105a1e6ce9`; Name and AddClip read as
   string / boolean.
2. Worker: first execution remembers the cache's full name. Among the cache's children find the one that is an
   environment item (interface `925a08ae…`). Create a new action source from the cache (into `Action`).
3. Empty Name → `"SimulationRun"`; set the action's name. Read the simulation time range (start / end frames) from the
   environment's time-control property (kind 6), convert to seconds and set the action's start and end parameters.
4. For each cached item (24-word records) build the target path `<model>.<item>`; for items of type `0x15` with no
   explicit file name, build it from a template helper with tokens `object`, `model`, `version`; a `#` in the result
   is replaced by the frame range `[%d..%d]` (start, start+count). Each item becomes an `AddFileCacheSource` sub-task
   (`5b3f5d9d…`) on the action; items that fail are removed from the action.
5. No item kept → mark "nothing stored" (Undo will not delete the action). Otherwise add the action to the model's
   mixer container (`F3DGetModelNLEContainer`). If `AddClip`: an `AddClip` sub-task at the start time, weight 1.0;
   then, when the time control says so, a `SetValue` sub-task (type `0x402`, id 5, value false) (inferred: switch the
   live simulation off so the clip drives the result).
6. RePack writes `EnvironmentCache` (re-resolved by name) and `Action`. Undo: undo sub-tasks, then delete the action
   with a `DeleteObj` sub-task unless nothing was stored.
**Wire contract:** `SIStoreEnvironmentCacheToMixer(EnvironmentCache, Name="SimulationRun", AddClip=false)` turns a
simulation cache into a mixer action source of file-cache items covering the simulation range, optionally adds a
clip, and returns the action; undoable.

### `MoveJoint`: SPEC-PARTIAL
Args: `InputObjs`, `X`, `Y`, `Z` (doubles, 0), `MoveJointBranch` (false), `MoveJointBone` (false).
- UnPack resolves InputObjs to one chain element (helper `0x18014cbe0`; failure returned), reads X/Y/Z and the two flags.
- Do: on first execution worker slot 10 snapshots the chain (element, branch flag, bone flag); then worker slot 9:
  validate (helper `0x180150eb0`, non-zero → returned); referenced-model lock → raise, `0x80070005`; optional
  pre-step `0x180157690`; move the element to the global position (X,Y,Z) with the branch / bone options
  (`0x18014cf60`); apply (`0x1801566a0`). First execution stores the final position.
- Meaning of the flags (inferred): `MoveJointBranch` moves the whole downstream branch rigidly; `MoveJointBone` keeps
  the bone lengths (moves the bone instead of stretching).
**Wire contract:** `MoveJoint(InputObjs, X, Y, Z, MoveJointBranch=false, MoveJointBone=false)` moves a skeleton joint
to a global position and adapts the adjacent bones; undoable.

### `SICreateSkeleton`: SPEC-PARTIAL
Args: `Rx,Ry,Rz` (0), `Ex,Ey,Ez` (1,0,0), `Nx,Ny,Nz` (0,0,1), `ViewType` (3), `Bone`/`Effector` (out),
`SkeletonType` (2), `AlignRootToFirstBone` (false), `Value` (out).
- Reads `SkeletonType` (I4): value **2 → builder mode 1** (and only then `ViewType` is read); any other value → mode 2
  with view type −1. Reads the nine doubles in the order R, E, N and `AlignRootToFirstBone`.
- Calls the builder with root position R, an identity rotation, effector E, normal N, the mode, the first-execution flag,
  the view type and the align flag; outputs root, first bone, effector.
- Writes `Value` = root, `Bone` = first bone, `Effector` = effector (vt 13), each only when non-null.
- Builder internals (bone orientation from N / ViewType, align) not read.
**Wire contract:** `SICreateSkeleton(R, E, N, ViewType, SkeletonType, AlignRootToFirstBone)` creates a one-bone chain
from R to E in the plane given by N and returns root / bone / effector.

### `CreateVertexColorSupport`: SPEC-PARTIAL
Args: `PresetObj` (string, ColorAtVertices preset), `PropertyName` ("Vertex_Color"), `InputObjs`, `Value` (out).
- UnPack reads only `InputObjs` and `PropertyName` (a string replaces the default). **PresetObj is not read.**
- Do: InputObjs empty → returns 1 (nothing done). Worker: make the property name unique (`0x180018b00`, writes the
  final name back); for each item that is a 3D object with a geometry, create the colour-at-vertices property
  (worker slot 3) and append it, wrapped as an element reference, to the output list.
- Nothing created → `0x80020005`. RePack writes `PropertyName` (final) and `Value` (list). Undo through the base.
**Wire contract:** `CreateVertexColorSupport(PresetObj, PropertyName="Vertex_Color", InputObjs)` adds a colour-at-
vertices property per geometric object and returns the list; error when none could be created.

### `PaintVertexColors`: SPEC-PARTIAL
Args: `InputObj`, `Polynodes` (array), `Colors` (array), `Mode` (I4, 0), `OutputObj` (out).
- UnPack: first InputObj item is asked, in order, for the vertex-colour property interface
  `baa31600-97d7-11d4-b916-0800690c8bd0`, then cluster `9af45fc0-8dc4-11d4-b915-0800690c8bd0`, else 3D object
  (`6b579d20…`): for an object the current-time colour cluster is looked up; for a cluster its owning object.
  Soft references to property, object, cluster. Positional args 1 (Polynodes) and 2 (Colors) must be non-empty, else
  `0x80070057`; arg 3 (Mode) is converted to I4.
- Do (current time): if no property exists, a `CreateVertexColorSupport` sub-task named `"Vertex_Color"` is created on
  the object (recorded on first execution). On first execution the old colours are snapshotted for undo.
  `Mode` 0 → write one colour per listed polynode, weight 1.0; `Mode` 1 → the alternative array form (weight 1.0);
  any other Mode → sub-tasks undone and cleared (nothing painted). Exact array layouts (RGBA per node) (inferred).
**Wire contract:** `PaintVertexColors(InputObj, Polynodes, Colors, Mode=0)` writes colours into the polynodes of the
object's vertex-colour property, creating "Vertex_Color" if needed; undoable.

### `CopyCluster`: SPEC
Args: `Cluster` (object), `Target` (list).
1. UnPack: Cluster must expose the cluster interface `a244f0d0-1e1d-11d0-aa2e-00a0243e34c4`; Target is a list.
2. Worker (current time): read the source cluster's geometry. For each Target item resolve its 3D object (directly,
   through its primitive, or through an owner). Per target (`0x1800055b0`):
   - the target geometry must support the cluster's type, else raise `0x80004005`, severity 2, message `0x62`;
   - the target's component count must be at least the cluster's element count and every element index must be below
     it, else raise `0x80004005`, severity 2, message `0x61`;
   - create the copy with a `CreateClusterFromSubComponent` sub-task (`5f1f5163…`) on the target, same type and
     indices, then set the new cluster's flag at slot `0x130` to 3; recorded on first execution.
3. Each new cluster is appended (element reference) to the output list, returned by RePack. Undo = undo sub-tasks.
**Wire contract:** `CopyCluster(Cluster, Target)` creates on each target object a cluster with the same type and
component indices and returns the list; index-out-of-range or unsupported type raises an error; undoable.

### `SaveKeyOnPath`: SPEC-PARTIAL
Args (entry 259 "Save Key on Path"): `InputObj` (list), `Time` (frames), `X`, `Y`, `Z`, `Locked` (false).
Entry 260 "Save Locked Key on Path" is the **same handler and scripting name**: its arguments are plain variants (vt 0,
no argument handlers) and `Locked` defaults to **true**; entry 259 attaches interactive argument handlers (time
`e9bae81a…`, number `8dff97d6…`) for menu use. Behaviour differs only through `Locked`.
- UnPack: InputObj from the context; `Time` must be readable (error returned) and is converted frames → seconds; X, Y, Z
  are each optional (an empty variant means "not given"; given values are converted to double and flagged bits 1/2/4);
  `Locked` boolean.
- Do → worker: clear sub-tasks; prepare; for every input object get its path constraint data (slot `0x200`) and
  create a per-object key task (`0x1800019d0`) with the time, the given coordinates (null for missing ones) and the
  locked flag; it is recorded as a sub-task on first execution only when it succeeded with S_OK.
- What the key task writes (path percentage key at the time, locked key flag) (inferred).
**Wire contract:** `SaveKeyOnPath(InputObj, Time, [X], [Y], [Z], Locked=false)` keys each object's path position at
Time, optionally at a given global position, as a locked or normal key; undoable.

## 4. Open questions
1. grouptask base classes for SIAddToGroupLowLevel / SIRemoveFromGroup (imported) — who fills `OutputObj`.
2. Partition kinds 5 vs 6 naming; where RemoveFromPartition puts the objects.
3. XSIGROUPTASKS string 11 / message ids `0x34`, `0x93`, `0x61`, `0x62` texts (dictionaries not read in this run).
4. SICreateSkeleton builder `0x18017cec0`; sicoresdk.dll copy (if any) not checked.
5. MoveJoint branch/bone semantics; PaintVertexColors Mode 1 array layout; SaveKeyOnPath key task `0x1800019d0`.
6. SIStoreEnvironmentCacheToMixer template helper (`25e08` class) tokens beyond object/model/version.

## 5. Corrections for the wire agent
1. `AddToPartition` (`src/commands/moduleToolbar.ts` 281): Target is optional — take the first partition found in
   InputObjs; expand ordinary groups in InputObjs to members; require Target kind partition (else invalid-argument);
   require all objects to sit in one partition of the same pass (else error message 0x93); it is a **move** from that
   partition, recorded for undo (src only `members.add`, no undo).
2. `RemoveFromPartition` (same file 295): Target optional (from InputObjs or derived from the objects); undo record
   missing.
3. `SIAddToGroupLowLevel` (`src/commands/selectionGroupLayer.ts` 428): with empty Target the first ordinary group in
   InputObjs is the target (src throws Unattested); only kind-3 groups qualify (not partitions / layers).
4. `SIRemoveFromGroup` (same file 441): with empty Target remove from the single group all members share (or a group
   given inside InputObjs); src removes from **every** group holding them.
5. `SICreateGroup` (same file 445): a Parent that is not a group container falls back to the current scene model
   (src throws); Name must be a string; container refusal = warning and no group; output via `Value`.
6. `AddGroup` (same file 459): locked Target → access-denied error; empty InputObjs → error; non-movable items warned
   (message 0x34) and dropped; all dropped → silent no-op.
7. `SetInstanceGroup` / `RemoveInstanceGroup` are registered twice (`uiGroupViewTasks.ts` 544/547 and
   `selectionGroupLayer.ts` 478/487); the later one's hair-name test is not in the binary (CMD-B7a: kind-3 group,
   container + index).
8. `SIStoreEnvironmentCacheToMixer`: not registered (only probed in `duplicateRenderingSimulationScriptsSimulation.ts`
   35); implement per §3 and return the Action.
9. `MoveJoint` (`src/commands/model.ts` 323): src only arms the translate tool; the command is an undoable task that
   moves the joint to (X,Y,Z); add `MoveJointBranch` / `MoveJointBone`; locked referenced model → access-denied.
10. `SICreateSkeleton` (`src/commands/chainsModelB17b.ts` 142): ViewType is consulted only when SkeletonType = 2 (else
    view type −1); other SkeletonType values are not an error at this level.
11. `CreateVertexColorSupport` (`src/commands/model.ts` 520): add `PresetObj`, `PropertyName` (default "Vertex_Color",
    made unique, written back) and `Value` (list of created properties); empty input = no-op; none created → type-
    mismatch error.
12. `PaintVertexColors` (`src/commands/model2.ts` 571): src only arms the paint tool (`undoable:false`); the command is
    an undoable write of Colors into Polynodes, auto-creating "Vertex_Color"; empty Polynodes/Colors → invalid-arg;
    Mode 0/1 only.
13. `CopyCluster` (`src/commands/clusters.ts` 75): args are `Cluster`, `Target` (list of objects), not `Name`; the copy
    goes onto each target object (same type and indices) with range/type errors 0x61/0x62; returns the list; src
    copies the cluster inside its own object.
14. `SaveKeyOnPath` (`src/commands/anim.ts` 308): add optional `X`, `Y`, `Z`; Time is required and in frames; the
    second registry entry ("Save Locked Key on Path") defaults `Locked` to true; key every input object, not only the
    first.
