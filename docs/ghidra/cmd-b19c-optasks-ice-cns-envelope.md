# CMD-B19c: optasks.dll static ICE attributes, ICE compounds, constraints, envelope locks, operator order (+ ophost / shadertasks / propertytasks / selectionmgr rows)

Row: **CMD-B19c**. Status: **SPEC** (14 names), **SPEC-PARTIAL** (11 names), **LOCK** (1 name).
Run: 2026-11-20, si-analyst worker batch 19 (binary first, REA + Ghidra 12.1.4 on the PC, unattended).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

## Binaries

| DLL | image base | sha256 |
|-----|-----------|--------|
| `Application\bin\optasks.dll` | `0x180000000` | `bd94e0d535c21eeedc7b827512d61e0ba4f328d37ea7ed26af43c1aa5bf5c61f` |
| `Application\bin\propertytasks.dll` | `0x180000000` | `1ab76e3621d5523e13f0fd396a818bb10c766b2f572e5826d203e8c38010e243` |
| `Application\bin\shadertasks.dll` | `0x180000000` | `ef5c3ba68c4ba34423566ef96e5e575fe070f72cfb6f9a6b23b653835c5353c5` |
| `Application\bin\ophost.dll` | `0x180000000` | `7a934b9da8d0da542e88497e25e68f754676342a68347dc975952eb2013a72ea` |
| `Application\bin\selectionmgr.dll` | `0x180000000` | `77d0a1e7bcba8ca784da3b1838121bb36bff17be6d896351f1a5d1deeb3c3bc9` |
| `Application\bin\scriptedopeditor.dll` | not opened (budget) | — |

## Method

- optasks: `DllGetClassObject` (`0x180011e30`) decompiled once; every handler CLSID of this group is one inline
  two-qword compare followed by its factory vtable. Factory vtable slot 6 = create (operator new + task
  constructor); the constructor gives the task vtable (slot 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg,
  15 own worker) and, for the "helper" layout, a sub-object vtable at task `+0x38` whose slot 9 is the worker.
  Vtables read from two 90 000-byte `.rdata` dumps (`0x1800d5000`..). Workers, UnPackArgs and the shared
  helpers listed below were decompiled; GUIDs at referenced `.rdata` addresses decoded locally.
- propertytasks / shadertasks / selectionmgr: same chain from the DLL's `DllGetClassObject`. shadertasks' Do and
  worker entry stubs have no Ghidra function; they were disassembled locally (capstone) from a raw `.text` dump.
- ophost: string `ConstructionMode` → xrefs → the two scripted-op UnPackArgs only (budget).
- Arguments and defaults: `data/command_registry.json` (via `/tmp/.../group_c.json`). Message ids are
  `XSIOPTASKS` / `XSIPROPERTYTASKS` dictionary ids (texts not in the repo). Constants named
  `siComponentData*` are the values in the repo's enum tables.
- Facts reused: CMD-B12a (compound interface `fbf83198-…`, lock rule), CMD-B12c (`LockEnvelopeWeights`, lock
  operator `c3dlockenvelopeweightsop` `55f8fa6e-…`), CMD-B16c (`DeleteObj` `dd531990-…`), CMD-B15b
  (propertytasks chain), CMD-B19b (selection sub-task classes), CMD-B9f (`SetValue` `c089b901-…`,
  `ApplyOperator` `46cee370-…`).

## 1. Handler table

| Command | Scripting name | DLL | Handler (CLSID; factory vt → create → ctor (size); task vt; Do / UnPack / worker) | Status |
|---|---|---|---|---|
| Add Static ICE Attribute | `AddStaticICEAttribute` | optasks | `a3386f3d-…`; `0x1800ddc60` → `0x18000e170` → `0x1800a4070` (0xd0); vt `0x1800f03f0`; Do `0x1800a5140`, Undo `0x1800a64a0`, Redo `0x1800a5fe0`, UnPack `0x1800a6c30` | SPEC |
| Remove Static ICE Attribute | `RemoveStaticICEAttribute` | optasks | `ba2015ca-…`; `0x1800ddc98` → `0x18000f730` → `0x1800a4250` (0xc8); vt `0x1800f0520`; Do `0x1800a5690`, UnPack `0x1800a73b0` (check `0x1800a7550`) | SPEC |
| Rename Static ICE Attribute | `RenameStaticICEAttribute` | optasks | `4758bede-…`; `0x1800ddcd0` → `0x18000f770` → `0x1800a42d0` (0xd8); vt `0x1800f0650`; Do `0x1800a5d30` (rename `0x1800a4c40`), UnPack `0x1800a73e0` | SPEC |
| Set Static ICE Attribute Type | `SetStaticICEAttributeType` | optasks | `bf1968c3-…`; `0x1800ddd08` → `0x18000e470` → `0x1800a41a0` (0xf8); vt `0x1800f0710`; Do `0x1800a5320`, UnPack `0x1800a7150` | SPEC |
| Toggle ICE Attribute Always Evaluated | `ToggleICEAttributeAlwaysEvaluated` | optasks | `c98dd3f8-…`; `0x1800ddd40` → `0x18000f9f0` → `0x1800a4370` (0xa8); vt `0x1800f07d0`; Do `0x1800a5fb0` → `0x1800a4ed0`; Undo = Redo `0x1800a6490`; UnPack `0x1800a6f40` (shared base) | SPEC |
| Create ICE Compound Node | `CreateICECompoundNode` | optasks | `63e1ca40-…`; `0x1800dc9b8` → `0x18000e970` → `0x1800ae650` (0x108); vt `0x1800f1670`; Do `0x1800affd0`, UnPack `0x1800b00a0`, worker slot 15 `0x1800aed70` | SPEC-PARTIAL |
| Explode ICE Compound Node | `ExplodeICECompoundNode` | optasks | `b1be0f7b-…`; `0x1800dc9f0` → `0x18000edb0` → `0x1800b61d0` (0x58); vt `0x1800f26a0`; Do `0x1800b6be0`, UnPack `0x1800b6c70`, worker `0x1800b6360` | SPEC-PARTIAL |
| Export ICE Compound | `ExportICECompoundNode` | optasks | `01b0b17d-…`; `0x1800dcd00` → `0x18000edf0` → `0x1800b6e80` (0xa8); vt `0x1800f2830`; Do `0x1800b7640`, UnPack `0x1800b7840`, worker `0x1800b70c0` | SPEC |
| Edit Compound Properties | `EditICECompoundProperties` | optasks | `3e56120d-…`; `0x1800dcc58` → `0x18000ecf0` → `0x1800b3c30` (0x1d8); vt `0x1800f20a0`; Do `0x1800b44b0` (no body), UnPack `0x1800b5410`, worker `0x1800b3fa0` → apply `0x1800b4ba0` | SPEC |
| Remove Constraints By Type | `RemoveCnsType` | optasks | `f65e43d2-…`; `0x1800dce18` → `0x18000f530` → `0x18003bf60` (0x58); vt `0x1800e4bc0`; Do `0x18003c200`, UnPack `0x18003c2d0`, worker `0x18003c080` (collect `0x18003a380`, check `0x180039090`) | SPEC |
| Remove Constraints | `RemoveCns` | optasks | `f65e43d3-…`; `0x1800dce50` → `0x18000f4b0` → `0x18003b3b0` (0x98); vt `0x1800e49a0`; Do `0x18003b860`, UnPack `0x18003be80`, RePack `0x18003bdd0`, worker `0x18003b580` | SPEC-PARTIAL |
| Get Constrained Objects from Constraining | `GetConstrainedObjects` | optasks | `06c26ea2-…`; `0x1800dc360` → `0x18000ef30` → `0x180039210` (0x58, COM-object-first; task vt `0x1800e45b0`); Do `0x180039370`, UnPack `0x180039760`, RePack `0x1800396e0` | SPEC |
| Lock Envelope Point Weights | `LockEnvelopePointWeights` | optasks | `7eab797e-…`; `0x1800dd2e8` → `0x18000f230` → `0x18007ba80` (0x128, derived from `0x18007bae0`); vt `0x1800ec8f0`; Do `0x18007d540`, UnPack `0x18007e440`, worker (helper `+0x118`, vt `0x1800ec9e0` slot 9) `0x18007c8f0` | SPEC |
| Clear Envelope Weight Locks | `ClearEnvelopeWeightLocks` | optasks | `119de848-…`; `0x1800dd358` → `0x18000e4f0` → `0x18007b9c0` (0x128); vt `0x1800ecb70`; Do `0x18007d4c0`, UnPack `0x18007dd00`, worker `0x18007c230` | SPEC |
| Remove Flexible Envelope | `RemoveFlexEnv` | optasks | `936e8bd0-…`; `0x1800dd3c8` → `0x18000f5b0` → `0x180084df0` (0x58); vt `0x1800ed520`; Do `0x180085920`, UnPack `0x180085a50`, worker `0x180084f40` | SPEC-PARTIAL |
| SwapOperators | `SwapOperators` | optasks | `3fb6dc06-…`; `0x1800dd668` → `0x18000f970` → `0x180033b90` (0x58); vt `0x1800e3940`; Do `0x1800341a0`, Undo `0x180034200`, UnPack `0x180034410`, worker slot 15 `0x180033e70` | SPEC |
| Connect Map | `ConnectMap` | optasks | `c70b63f3-…`; `0x1800dd780` → `0x18000e6b0` → `0x18002c150` (0xb0, COM-object-first; task vt `0x1800e1fe0`); Do `0x18002c5d0`, UnPack `0x18002c870`, worker `0x18002c380` | SPEC |
| Delete Motion Derivator | `DeleteMotionDerivator` | optasks | `38b25a31-…`; `0x1800dd550` → `0x18000eab0` → `0x18005b3f0` (0x68); vt `0x1800e8440`; Do `0x18005bc60` (no body), UnPack `0x18005bdc0`, worker `0x18005b590` | SPEC |
| Remove Proxy Param | `RemoveProxyParam` | propertytasks | `d3520b6e-…`; factory `0x1800667f0` → `0x180041130` → `0x18002ee00` (0x88); vt `0x180062270`; Do `0x18002f6a0` → slot 16 `0x18002f540`; filter slot 15 `0x18002fab0`; UnPack `0x180030420`; Undo `0x18002f6e0` | SPEC-PARTIAL |
| RendertreeDeleteShaders | `DisconnectAndDeleteShaders` | shadertasks | `16e87237-…`; factory `0x180067b28` → `0x180003bf0` → `0x18004c3f0` (0x98, COM-object-first; task vt `0x180083c90`); Do `0x18004c750` → helper vt `0x180083d40` slot 9 `0x18004c650`; UnPack `0x18004c880` | SPEC-PARTIAL |
| Create and connect file-based scripted operator | `AddScriptedOpFromFile` | ophost | `7fba5233-…`; chain not walked; scripted-op UnPack bases `0x18000bb00` / `0x18000c870` | SPEC-PARTIAL |
| ConvertScriptedOp | `ConvertScriptedOp` | scriptedopeditor | `532b8303-…`; DLL not opened | LOCK |
| Select Branch / Tree / Chain / Model | `SelectBranch`, `SelectTree`, `SelectChain`, `SelectModel` | **selectionmgr** | `79581ba0-…` (= `SelectObj` class); `DllGetClassObject 0x180005ef0`, factory vt `0x18001d5a0` swapped to `0x18001d5d8` after construction; create/ctor not walked | SPEC-PARTIAL |

## 2. Shared facts

- **Static ICE attribute tasks (5 commands)** share UnPack base `0x1800a6f40`: `Object` is resolved to the
  geometry (interface `6de1b670-…`); when it is a 3D object (component hierarchy `6b579d20-…`) its active
  primitive's geometry is used. A soft reference to it is kept for undo. `AttributeName` is split on `,` into a
  list of names (no trimming). Attribute definitions are looked up in the geometry's attribute-definition table
  (case-sensitive name equality). "Static" = the definition is **persisted** (`IsPersisted`).
- Edits run inside an ICE graph-update bracket; after the loop the geometry is marked dirty (method `0x388`, arg 1)
  and `F3DClearEvolveOpCache` is called.
- Per-attribute error messages are logged at severity 2 with text `<geometry full name>.<attribute>` composed into
  the XSIOPTASKS id: `0x434` attribute not found / not static, `0x435` attribute already exists,
  `0x437` attribute cannot be removed (owner count ≠ 1, see Remove), `0x438` invalid new name. Plain messages
  (no name) `0x431` invalid AttributeType, `0x432` invalid AttributeContext, `0x433` invalid
  AttributeStructure. All these make UnPackArg return `0x80070057`; Do then never runs.
- **Type/context/structure validation** (Add and SetType UnPack): a value must be a single bit. AttributeType must
  be in mask `0xfcbff` (Bool 1 … Color4 512, Location 2048, Rotation 16384, Shape 32768, String 65536,
  CustomType 131072, 0x40000, 0x80000) — Geometry 1024, Execute 4096 and Reference 8192 are rejected.
  AttributeContext in mask `0x10003f` (Singleton 1, Component0D 2, 1D 4, 2D 8, 0D2D 16, 32, 0x100000).
  AttributeStructure in mask `3` (Single 1, Array 2). For SetType the value `0` (`…None`) is also accepted and
  means "keep the current value". A String type (bit 16) marks the type's sub-type list as "string".
- **Missing object** on Do of any ICE attribute task → `0x80004003`.
- **Compound tasks** use the CMD-B12a compound interface `fbf83198-8578-43ed-ae60-ca56d84d25c0` and lock rule
  (locked → lock error raised, `0x80070005`). Missing compound in a worker → raise `0x80070057`, message `0x111`.
- **Constraint helpers**: constraints of an object are read from its kinematics constraint container (interface
  pair `7be8`/`7bc8` in `.rdata`), counted (slot 7) and enumerated by index (slot 8); a constraint's type id is
  its slot-3 value (`tagE3DKINECNSID`, from `SIGetKineCnsIDFromName`). Deletion is always one `DeleteObj`
  sub-task (`dd531990-…`) over the collected list, queued for undo when undoable.
- **Envelope lock tasks** (Lock/Clear here and CMD-B12c `LockEnvelopeWeights`) share base class `0x18007bae0`,
  helper `0x18007c090` (find the lock operator on the envelope property) and the creation path: if none, an
  `ApplyOperator` sub-task (`46cee370-…`) applies `c3dlockenvelopeweightsop` (`55f8fa6e-b829-443c-8477-1c4c71234b5a`)
  with the property as input (port-group list `ce9a5031-…`, connect mode 3); the apply is queued for undo.
  The lock interface of the operator is `188ca993-f2a0-4a45-bf20-92c12ba3f82f`.

## 3. Wire contracts

### AddStaticICEAttribute — SPEC
- Args: `Object` (required), `AttributeName` (comma list, default ""), `AttributeType` (default Float 4),
  `AttributeContext` (default Singleton 1), `AttributeStructure` (default Single 1). Returns nothing.
- UnPack: base resolve (§2); for each name: if a definition with that name exists and is persisted, or is
  non-persisted but already owned by the geometry's data (the enumerator check) → message `0x435`, `0x80070057`.
  Then validate type, context, structure (§2) in that order.
- Do: if structure is not 1/2 or context not in {1,2,4,8,16,32,0x100000}: nothing happens, return 0. Otherwise for
  each name: ensure the geometry's multi-data container exists (create on demand), call the attribute-define
  method with (name, descriptor). First failure aborts and is returned. Then dirty + op-cache clear.
- Undo `0x1800a64a0` removes the added names; Redo `0x1800a5fe0` re-adds (inferred from slot roles).

### RemoveStaticICEAttribute — SPEC
- Args: `Object`, `AttributeName` (comma list).
- UnPack: base, then each name must exist and be persisted (`0x434`) and the attribute's owner/reference count
  (definition table slot 14) must be exactly 1 (`0x437`), else `0x80070057`.
- Do: for each name whose current type (or type before reset, when the current one is not fully defined) is a
  valid defined type, remove the definition (attribute interface `ab4dbd45-…` slot 10) and remember name + old
  descriptor for undo (re-add). Names without a valid type are skipped silently. Dirty + cache clear.

### RenameStaticICEAttribute — SPEC
- Args: `Object`, `AttributeName` (must be exactly one name), `NewName`.
- UnPack: more than one / zero names → `0x80070057` (no message). Old name must exist and be persisted (`0x434`).
  `NewName` is normalised with `F3DNormalizeAttrName`; failure → `0x438`; an attribute already named
  `NewName` → `0x435`. All → `0x80070057`.
- Do: no object → `0x80004003`; re-checks one name, new name free, old exists; keeps the old attribute's
  descriptor (its type, or type-before-reset when the type is not defined) and renames (define under new name,
  remove old; worker `0x1800a4c40`). Undo renames back.

### SetStaticICEAttributeType — SPEC
- Args: `Object`, `AttributeName` (comma list), `AttributeType`, `AttributeContext`, `AttributeStructure`
  (defaults `…None` = 0 = keep).
- UnPack: each name must exist and be persisted (`0x434`); type/context/structure validated, 0 accepted.
- Do: for each persisted attribute: new descriptor = current with each non-zero argument substituted (String type
  marks the sub-type list); if it differs from the current one (structure, type, string sub-type, context, or —
  when context ≠ Singleton — the context's secondary field), redefine via the define method; when undoable,
  record name, new and old descriptor. Dirty + cache clear. Returns 0.

### ToggleICEAttributeAlwaysEvaluated — SPEC
- Args: `Object`, `AttributeName` (comma list). UnPack = base only (no static check: works on any attribute).
- Do: no object → `0x80004003`. For each name that has a definition: ensure the multi-data container, then flip
  its "force evaluation" flag (`C3DMultiData::IsForceEvaluationAttribute` → `SetForceEvaluationAttribute(!old)`).
  Unknown names skipped. Dirty + cache clear. Undo and Redo are the same toggle.

### CreateICECompoundNode — SPEC-PARTIAL
- Args: `InputObj` (ICE nodes), `Name` (default "" → `CompoundNode`), output `Operator` (the new compound).
- UnPack resolves the node list and the containing graph (interface `e65eb163-…` / `fbf83198-…`).
- Worker: no nodes or no container → raise `0x80070057` message `0x173`. Inside a graph-update bracket: gather
  the nodes (`0x1800aea50`), create the compound with the `AddICENode` sub-task (`2ca63f7d-…`, node class
  `d33b77cb-8926-463d-b08b-8769a968e690`) in the container; set its persisted name attribute (`68d24266-…`) to
  `Name`; move the nodes inside; expose every connection that crosses the boundary with
  `AddExposedParamToICECompoundNode` sub-tasks (`26cb16ed-…`) and remove obsolete ones with
  `RemoveExposedParamFromICECompoundNode` (`bf8f591a-…`), and reconnect through sub-task `749dcc61-…`
  (unread). All sub-tasks queued for undo. Exact port naming/ordering not read (Q1).

### ExplodeICECompoundNode — SPEC-PARTIAL
- Args: `InputObj` (compound), output `OutputObjs` (variant array).
- UnPack: input that is not a compound → raise `0x80004005`, message `0x1c3`. Worker: none → `0x111`.
- Worker: removes every exposed parameter of the compound (`RemoveExposedParam…` sub-tasks, inputs then outputs),
  reconnects the inner nodes to the outer graph (sub-task `749dcc61-…`), moves inner nodes to the parent and
  deletes the compound with `DeleteObj`. Output = the moved nodes (inferred).

### ExportICECompoundNode — SPEC
- Args: `Compound` (exactly one item, else nothing is exported), `FullPath`, `Directory`, `Name`, `Version`
  (`"major.minor"`), `Private` (bool), `ForceEmbedded` (bool), output `Output` (written path).
- `Private` true in a restricted application mode (`SIGetAppMode` slot 10 true; inferred: the non-commercial
  edition) → warning message box `0x427`, return `0x80004021`; nothing written.
- Path rules when `FullPath` is empty: Directory default = user preference path (2, 0x19) (inferred: the user
  Compounds folder); Name default = compound name; version default = the compound's current major.minor.
  A `Name` different from the compound name (case-insensitive) **renames the compound** (persisted name
  attribute). A different version is written to the compound. Path = `Directory` + `\` (if missing) + `Name`
  + (`"." + major.minor` unless the version is 1.0) + `.xsicompoundp` when Private else `.xsicompound`.
  When `FullPath` is given it is used as is (no renaming / version change).
- Write: compound export (slot 19, args path, private, forceEmbedded). `0x80004005` → raise message `0x422`,
  `E_FAIL`. Success: two compound refresh calls, `Output` = path, the compound library is rescanned
  (generic object `8eeaf99d-…` slot 6 (1,1), inferred: preset-manager refresh). Not undoable.

### EditICECompoundProperties — SPEC
- Args: `Compound`, `Name`, `Category`, `Tasks`, `Author`, `Description`, `URL`, `VersionMajor`, `VersionMinor`,
  `VersionTag`, `ModeForApplyICEOp` (default 4), `BackgroundColor` (default 6732954 = `0x66bc9a`), `PPGLogic`,
  `PPGLogicLanguage`, `SetMask` (default 0).
- UnPack: `Compound` must expose the compound interface and not be read-only (slot `0xf8` false), else
  nothing to edit. Worker: none → `0x111`; locked → lock error `0x80070005`.
- When undoable the old values of every field are captured first (defaults when absent: mode 4, colour
  `0x66bc9a`). Apply only fields selected by `SetMask` (0 = all) **and** different from the old value:
  `0x2` Name (persisted name attribute, via a `SetValue` sub-task on the name), `0x4` Category, `0x8` Tasks,
  `0x10` Author, `0x20` Description, `0x40` URL, `0x80` VersionMajor+VersionMinor (compound slot 35),
  `0x100` VersionTag, `0x200` ModeForApplyICEOp, `0x400` BackgroundColor, `0x800` PPGLogic, `0x1000`
  PPGLogicLanguage. Bit `0x1` unused. `PPGLogicLanguage` must be empty, `VBScript`, `JScript` (case-insensitive)
  or contain `Python`; otherwise message `0x1a6` (args `EditICECompoundProperties`, the value) at severity 4 and
  the language is left unchanged (other fields still applied).

### RemoveCnsType — SPEC
- Args: `Type` (constraint type name, string), `ConstrainedObj` (list).
- UnPack: `Type` not a string (and not empty) → `0x80070057`; name → id with `SIGetKineCnsIDFromName` (failure
  returned).
- Worker: type id 0, 17 or 29, or an empty list → `0x80070057`; every item must be a 3D object (kind 2) else
  `0x80070057`. Collect, over all objects, every constraint whose type id equals `Type`. None → nothing
  (status 1). Otherwise one `DeleteObj` of the list.

### RemoveCns — SPEC-PARTIAL
- Args: `ConstrainedObj` (list), `ConstrainingObj` (list, default empty), `ForceDeletion` (default false).
- Worker: both lists non-empty → remove the constraints of the constrained objects whose constraining input is
  one of `ConstrainingObj` (`0x180039e30`). Constraining list empty: more than one constrained object → all
  their constraints; exactly one → its constraints, but when `ForceDeletion` is false and the collector flags
  the case (inferred: several constraints / ambiguous) an interactive **pick session** starts (prompt
  XSIOPTASKS `0x3ef`, pick the constraining object), skipped when running without UI. Nothing collected →
  status 1. Else one `DeleteObj`. RePack stores `ConstrainingObj` back (picked object). Collector rules for
  kinds 2 vs 5 constraints (`0x18003a5c0`, `0x18003a7b0`) unread (Q3).

### GetConstrainedObjects — SPEC
- Args: `InputObj` (one 3D object), output `OutputObjs` (collection). Null context → `0x80004003`.
- Do: create an empty collection; ask the object for the list of objects constrained by it (kinematics query
  slot 18 then slot 14); append each as an element reference in that order. Not undoable (flags).

### LockEnvelopePointWeights — SPEC
- Args: `PropObj` (envelope weight property, optional), `SubComp` (point sub-component), `Locked` (default true),
  output `OutputObj` (lock operator).
- UnPack: `Locked` coerced to bool. `SubComp` empty → warning `0x6f` (severity 4), status 1 (no-op). The first
  item that is a point cluster (kind 6, sub-component type `3df7f9e0-…` point) or a point sub-component
  selection (kind 7) gives the point indices; other component types → warning `0x80`, status 1. Missing
  `PropObj` → the envelope weight property of the points' geometry at the current frame (inferred: first one).
- Worker: no property / null index array → `0x80004003`; zero points → status 1. Undoable: previous lock state
  recorded first. Find the lock operator, applying it if absent (§2). At the current time map each point index
  through the envelope's point table (points not in the envelope are skipped) and set them locked / unlocked
  (`Locked`) on all deformers. `OutputObj` = the lock operator.

### ClearEnvelopeWeightLocks — SPEC
- Args: `PropObj`, output `OutputObj`. Same lock-operator lookup/apply as above, then "clear all locks"
  (lock interface slot 6). Undo restores the saved locks.

### RemoveFlexEnv — SPEC-PARTIAL
- Args: `InputObjs` (objects or clusters). Expanded through the generic object expander
  (`24be99c0-…`, slot 26).
- Worker: for each 3D object (kind 2): on its primitive, the first Envelope operator (`c3denvelopop`
  `470cf890-d3aa-11d0-996c-00a0243f0e60`) is located; the object it reaches through interface `c76e55b0-…`
  (inferred: the envelope weight property / assignment side) is added to a delete list and its envelope
  operators too. For a cluster (kind 6) the same through its geometry (`a244f0d0-…`). Then one `DeleteObj` of
  the list (undoable). Precise list membership unverified (Q4).

### SwapOperators — SPEC
- Args: `Object`, `Operator1`, `Operator2` (operator interface `473feb00-…`). UnPack failure returned as is.
- Do: `F3DSwapPortConnections(Object, Op1, Op2, reverse=false)`. Errors: `0x80070005` → raise message `0x5c`,
  return `0x80004005`; `0x8000000a` → `0x5d`, `0x80004005`; `0x80004001` → `0x5e`, `0x80004001`;
  `0x80070057` → `0x60`, `0x80070057`. Result 1 (nothing to swap) → warning `0x5f` (severity 4), status 1.
  Undoable: soft references to the two operators are kept; Undo = same call with reverse=true.

### ConnectMap — SPEC
- Args: `PropObj` (map property), `Target`.
- Worker: null either → nothing. If `Target` (its slot-34 accessor) already exposes interface
  `6466031e-6786-4de2-8b2c-8518e604fa5a` → nothing. Otherwise `ApplyOperator` a **Map Component operator**
  (`C3DMapCompOp.spdl`, `c70b63f1-2d25-11d5-bdeb-00a0c9615daf`) with inputs [`PropObj`, `Target`], connect
  mode 2; when undoable the created operator is referenced for undo.

### DeleteMotionDerivator — SPEC
- Args: `InputObj` (list). Null list → `0x80004003`.
- Worker: for each object take its global kinematic state (`C3DKineState` `f75293a0-…`), enumerate its
  operators; the **first** operator of class `2b107ce1-93d0-11d0-be4e-00a024ee478d` (the Motion Derivator,
  inferred) is added to a delete list, and the kine-state parameter index `0x1b` (inferred `velaccactive`, the
  27th `C3DKineState` parameter) to a second list. Then `DeleteObj` on the first list and `SetValue`
  (`c089b901-…`) value 0 (`VT_UI2`) on the second (i.e. velocity/acceleration output turned off). Both queued
  for undo when undoable.

### RemoveProxyParam — SPEC-PARTIAL
- Args: `InputObjs` (list). Empty list → warning `XSIPROPERTYTASKS 0x2b` (severity 4), status `0x562e80d2`.
- Filter (slot 15): keep only items that are proxy parameters (slot `0x240` test); any non-proxy → final status
  `0x562e80d2` but the proxies are still removed. When undoable the proxy definitions (target, name, owning
  custom property) are saved; Undo recreates each proxy on its custom property with the saved name. Removal
  step `0x18002fcf0` unread; failure → raise `E_FAIL` message `0x2b`.

### DisconnectAndDeleteShaders — SPEC-PARTIAL
- Args: `Shaders` (list), `Containers` (list, handler `f1d7703b-…`). Both converted to shader-port reference
  lists; either empty → `0x80070057`.
- Worker: any null / invalid entry → `0x80004005`; any shader or container locked → lock error, `0x80004005`.
  Then: disconnect each shader from other shaders inside the containers (`0x18004d510`), queue an internal
  update sub-task `1ffd73c3-…` (inferred: "Override Update Task", CMD-B15b), and delete the shaders
  (`0x18004cd50`, which classifies items by interface and handles ICE/compound nodes separately).

### AddScriptedOpFromFile — SPEC-PARTIAL
- ophost UnPack base `0x18000c870` reads `Name` (must be a string, else `0x80070057`), `Language` (string, same),
  `InputObjs`, `OutputObjs`, `ConstructionMode` (coerced to I4, failure `0x80070057`). The `FileName` read and
  the Do were not reached (Q5). Sibling base `0x18000bb00` reads `Name`, `Type` instead of `Language`.

### ConvertScriptedOp — LOCK
- scriptedopeditor.dll not opened (budget). Handler CLSID `532b8303-b52e-11d5-81a9-00a0c9ac19a9`.

### SelectBranch / SelectTree / SelectChain / SelectModel — SPEC-PARTIAL
- Served by selectionmgr.dll as the `SelectObj` class (`79581ba0-…`). Same as `SelectObj` with
  `HierarchyLevel` = `BRANCH` / `TREE` / `CHAIN` / `MODEL` (the registry default carries the level, prefixed by
  the hierarchy-level enum GUID `0907f360-b147-11d2-8bc8-00aa006130ef`) and `CheckObjectSelectability`
  (default false) (inferred from the registry; the UnPack was not read).

## 4. Open questions

- Q1 CreateICECompoundNode: exposed port names / order, role of sub-task `749dcc61-…`, the node gatherer.
- Q2 Explode output list content.
- Q3 RemoveCns collector rules (`0x18003a5c0`, `0x18003a7b0`) and the exact pick trigger.
- Q4 RemoveFlexEnv: what interface `c76e55b0-…` slot 7 returns.
- Q5 AddScriptedOpFromFile Do; ConvertScriptedOp entirely; Select* UnPack of `HierarchyLevel`.
- Q6 RemoveProxyParam removal step; DisconnectAndDeleteShaders disconnect rule details.
- Message texts for all XSIOPTASKS ids above.

## 5. Corrections for the wire agent

1. `AddStaticICEAttribute` / `Remove…` / `Rename…` / `SetStaticICEAttributeType` / `Toggle…`
   (`src/commands/iceModule.ts` 418–500): they ignore `Object` and act on `app.selectedObjects`; they model
   attributes as properties. Binary: attributes live on the **geometry** of `Object`; `AttributeName` is a
   comma list; strict validation and error ids (§2); Add rejects existing names (`0x435`); Remove/Rename/
   SetType require a persisted attribute (`0x434`); Rename requires exactly one name and a free, normalised
   new name; SetType's `None` values mean keep; Toggle flips per attribute (no property created).
2. `ExportICECompoundNode` (iceModule 358): writes `.icetree.json`. Binary path rule `Directory\Name[.maj.min].xsicompound(p)`,
   renames compound when `Name` differs, sets `Output` to the path; Private refusal `0x427`.
3. `CreateICECompoundNode` (iceModule 301): adds a Comment node with default name `Compound`; binary default
   name is `CompoundNode`, a real compound containing the input nodes, missing nodes → `0x80070057` / `0x173`.
4. `ExplodeICECompoundNode` (iceModule 346): log only; binary removes the compound and moves nodes out.
5. `EditICECompoundProperties`: no direct registration (only used by the PPG-logic script path); add it with the
   `SetMask` bit table and language check (`0x1a6`).
6. `RemoveCns` (`src/commands/constraints.ts:79`): wired with args `InputObjs`, `Type` and removes only the
   last constraint. Binary args are `ConstrainedObj`, `ConstrainingObj`, `ForceDeletion`; removes all
   constraints (or those to `ConstrainingObj`); may start a pick session for one object.
7. `RemoveCnsType` (`viewEditPropertyMore.ts:224`): empty Type is a log-and-return; binary: non-string → E_INVALIDARG,
   unknown name → `SIGetKineCnsIDFromName` error, ids 0/17/29 and non-object items → E_INVALIDARG; one undoable
   `DeleteObj`.
8. `RemoveFlexEnv` (`rigging.ts:61`): deletes envelope op + property directly; binary goes through `DeleteObj`
   of the envelope-related objects and accepts clusters too.
9. `LockEnvelopePointWeights` / `ClearEnvelopeWeightLocks` (`rigging.ts:66-67`): use selection, ignore
   `PropObj`/`SubComp`; binary creates the lock operator on demand, returns it as `OutputObj`, warnings `0x6f` /
   `0x80` with status 1, skips points outside the envelope.
10. `DeleteMotionDerivator` (`inferredB10Scene.ts:523`): searches the primitive stack by name; binary searches
    the global kinematic state's operators by class, deletes only the first per object, and sets
    kine-state `velaccactive` (index 0x1b, inferred) to 0.
11. `ConnectMap` (`inferredB10Scene.ts:364`): should apply a `MapComponentOp` (`c70b63f1-…`) with inputs
    [PropObj, Target], mode 2, and do nothing if Target already has one.
12. `RemoveProxyParam` (`anim.ts:273`): removes any proxied/expression param of the first custom set of selected
    objects; binary removes only the listed proxy parameters, empty list → warning `0x2b` status `0x562e80d2`.
13. `SwapOperators` (`viewEditProperty.ts:486`): check that the four error mappings and the status-1 warning
    `0x5f` (nothing swapped) exist.
14. `GetConstrainedObjects` (`viewEditPropertyMore.ts:237`): output should be an `OutputObjs` collection in the
    kinematics' order; matches otherwise.
