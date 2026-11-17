# CMD-B7a: built-in task commands read from the binaries (UI attributes, object groups, explorer views, cluster helpers, active elements)

Rows: built-in commands whose handler is a native task class in
`siuitasks.dll`, `grouptask.dll`, `siviewtasks.dll`, `siclustertasks.dll`,
`selectionmgr.dll`.
Status: per command below (`SPEC` or `SPEC-PARTIAL`).
Run: 2026-11-17, `si-analyst`, unattended. `simeshtasks.dll` was not opened
(budget).

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/command_registry.json` | names, command GUIDs, handler CLSIDs, arguments, defaults, flags |
| (B) | REA + Ghidra 12.1.4, one DLL at a time (file version 13.2.163.0) | the contracts below |
| (L) | local static reads of the same DLLs (PE tables, vtables, GUID bytes, strings, import thunks) | vtable slots, GUID values, argument-name strings |
| (D) | `Application\Dictionary\en\XSITASKUI.dict`, `XSIGROUPTASKS.dict` | dialog texts |
| - | XSIBATCH goldens | **no XSIBATCH golden**; nothing here was executed |

DLL sha256 (first 8 hex): `siuitasks` `07b753a5`, `grouptask` `a64a3c40`,
`siviewtasks` `06a2faac`, `siclustertasks` `181811fa`, `selectionmgr` `77d0a1e7`.

How handlers were located: the handler CLSID bytes are compared inline in
`DllGetClassObject`; the matching branch builds a class factory whose vtable
slot 6 is the *creation function*; that function allocates the task and runs
its constructor, which installs the task vtable. The command is carried out by
slot 5 of the task vtable (`Do`, takes a "first execution" flag), which calls a
worker through a private interface (slot 9). No decompiler output or
disassembly is reproduced here.

## Shared facts (all five DLLs)

Task vtable layout (the part deriving from `C3DCoreBaseTask`), slots named
from the import thunks sitting in the unoverridden slots (L): 1 `OnCreateMsgMap`,
2 `GetCatalogName`, 3 `LogMessage`, 4 `GetMsgMapKey`, **5 Do(flag)**,
**6 Undo**, **7 Redo**, **8 `UnPackArg`(exec context)**, 9 `RePackArg`(exec
context), 10 `OnUpdateUI`, 11 `ResolveRefForUndo`, 12 `ResolveRefForRedo`,
13 release working data. Names of 5/6/7/13 are *(inferred)* from behaviour.

- Arguments are fetched **by name** from the exec context
  (`F3DGetArgPtrValueFromName2` for object lists, `SICmdGet…ArgFromName` for
  scalars, or the context's own "get value by name" method at slot 13).
- One class serves several commands by asking the exec context for the
  **command GUID** (interface `{26444edd-799f-11d2-8733-00a0c906816c}`, method
  slot 15) and comparing it with constants; the GUIDs equal the registry
  `guid` values.
- An object list is `{f49f6470-4211-11d0-8463-00a024c7919c}`; list class
  `{f49f6471-4211-11d0-8463-00a024c7919c}`. List slot 23 is used as an
  emptiness test (0 = empty, 1 = not empty) *(inferred from every use)*;
  slot 13 gives an enumerator; slot 15 gives the count.
- Each list item is resolved to *(owner hierarchy, component descriptor)* with
  interface `{4aeaeaea-1a43-11d2-8d66-00a0c982a649}`.
- Status codes seen: `0` OK; `1` OK/nothing to do (also returned by tasks that
  have nothing to undo); `0x562e80c7` success-class "cancelled by user";
  `0x80004003` null pointer; `0x80070057` invalid argument; `0x8000ffff`
  unexpected; `0x80004005` fail.
- Error/log calls go through `CSIErrorHandling::Raise(status, severity, msgId, …)`
  and `Log(severity, msgId, …)`; message ids are recorded, texts were not
  resolved (Q1).

## Handlers

| Command | DLL | Handler CLSID | Creation function | Execute (`Do` / worker) |
|---------|-----|---------------|-------------------|--------------------------|
| `SetThumbnail` | siuitasks | `{ddf4ad89-1d37-4eec-aba9-fbc84c4e9cd7}` | `0x180005070` | `0x18000a510` / `0x180009d70` |
| `SetThumbnailFromRegion` | siuitasks | `{952aa171-49de-40f3-b3ff-565314eb67cd}` | `0x180005030` | `0x1800098e0` / `0x180008ea0` |
| `ClearThumbnail` | siuitasks | `{2b61e9cd-3527-46dd-9b23-b9a100e08869}` | `0x180004eb0` | `0x180008b10` / `0x180008910` |
| `SetParameterColor` | siuitasks | `{b0d51e06-6f16-4367-95ae-8af737383c48}` | `0x180004ff0` | `0x18000b760` / `0x18000b3f0` |
| `ClearParameterColor` | siuitasks | `{bc8144ed-b483-47f7-ba2d-1464cfbfd816}` | `0x180004e70` | `0x18000b0b0` / `0x18000aed0` |
| `SetUserKeyword`, `SetUserTab` | siuitasks | `{c2791895-146a-4852-b1e8-ceaae0c5dbed}` | `0x1800050b0` | `0x18000e570` / `0x18000e6c0` |
| `GetUserKeyword`, `GetUserTab` | siuitasks | `{77651a51-cf4a-451f-ad0b-9f85ebee705a}` | `0x180004f70` | `0x18000d1d0` / `0x18000cea0` |
| `ClearUserKeyword`, `ClearUserTab` | siuitasks | `{49b512d9-908b-430e-bb33-b3b9b6735fd4}` | `0x180004ef0` | `0x18000c710` / `0x18000c530` |
| `RemoveUserKeyword`, `RemoveUserTab` (+ `AddUserKeyword`, `AddUserTab`) | siuitasks | `{f4b294dd-2e8f-422a-a10f-f0e9a1c6ee4c}` | `0x180004fb0` | `0x18000d830` / `0x18000d8c0` |
| `AssignObjectGroup`, `SetParTypeInstanceGroup` (+ `SetInstanceGroup`) | grouptask | `{e0717f47-0ac4-4faa-b35a-7c56951e6ddf}` | `0x18000b4a0` | `0x180004ee0` / `0x180004c60` |
| `UnassignObjectGroup`, `RemoveParTypeInstanceGroup` (+ `RemoveInstanceGroup`) | grouptask | `{d534de9f-55e4-41c2-a5ca-2cfbe354d3e6}` | `0x18000b5a0` | `0x18000a820` / `0x18000a650` |
| `OpenAttachments` (2 entries) | siviewtasks | `{3ed92c6a-f846-11d4-beaf-00a0c982ddd4}` | `0x180006430` | `0x180002e00` |
| `OpenTransientExplorer` | siviewtasks | `{195a46e3-72e7-4f8a-85c9-760722adf1d2}` | `0x180006470` | `0x1800047f0` |
| `OpenXSIExplorer` | siviewtasks | `{f83e86ca-f591-4cd6-9c9c-4d8a153131c4}` | `0x1800064b0` | `0x180005540` / `0x180005190` |
| `ClusterNonOverlapEnforcement` | siclustertasks | `{58a6bf38-4adf-424f-ae59-da5ee9f9baf4}` | `0x180010a60` | `0x18000ae60` / `0x180009d10` |
| `SITogglePolygonVisibility` | siclustertasks | `{a4f80d1c-8a95-4d64-b44b-ed9ed673d41d}` | `0x180010b20` | `0x18000f310` / `0x18000d9f0` |
| `SetActiveElements` | selectionmgr | `{9dcec2b0-d336-11d2-8bcf-00aa006130ef}` | `0x180005990` | `0x180017160` / `0x180017080` |
| `SetAndToggleActiveElements` | selectionmgr | `{9dcec2b1-d336-11d2-8bcf-00aa006130ef}` | `0x180005a20` | `0x180012110` / `0x180011ea0` |
| `ActivateElements` | selectionmgr | `{9dcec2b2-d336-11d2-8bcf-00aa006130ef}` | `0x180005530` | `0x180012110` / `0x1800100e0` |
| `DeactivateElements` | selectionmgr | `{9dcec2b3-d336-11d2-8bcf-00aa006130ef}` | `0x180005810` | `0x180017020` / `0x180016f10` |
| `ToggleActiveElements` | selectionmgr | `{9dcec2b4-d336-11d2-8bcf-00aa006130ef}` | `0x1800056e0` | `0x180012110` / `0x180011b80` |
| `ActivateSampledPointSelTool`, `…WithNoObjStateChange` (and all `Activate…SelTool` entries) | selectionmgr | `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` | `0x180005660` | `0x18000e260` |

`siuitasks.dll` also registers the class names (strings in
`DllRegisterServer`): "SetUserKeyword Task", "GetUserKeyword Task",
"ClearUserKeyword Task", "ModifyUserKeyword Task", "SetThumbnail Task", etc.

---

## Wire contract: `siuitasks.dll`

All nine classes store their data as **persistable component attributes** on
the target (set with `F3DSetPersistableComponentAttribute`, removed with
`F3DResetPersistableComponentAttribute`, read through hierarchy slot 20).
After each write the owner hierarchy is told it changed (interface
`{6de1b670-8072-11d5-aeed-0090275802c9}`, slot 26).

| Attribute | GUID | Value type |
|-----------|------|------------|
| user keywords | `{fd1a0da8-ae6f-4580-9367-b5bc1f112880}` | string, comma separated |
| user tabs | `{732ad5de-b58e-4468-9f13-60c2deccf1a1}` | string, comma separated |
| parameter colour | `{65703160-f700-4c49-a83e-cd2a3d23945f}` | unsigned 32-bit |
| thumbnail | `{e7016efe-6e64-4977-bab1-ac08191bac4e}` | object (thumbnail object `{d992711c-0842-44ed-b0e6-7fb7c8f9d446}`, interface `{2bc9f66a-9cc2-479b-b095-07ac9c4f79c2}`) |

Common pattern: `InputObjs` null gives `0x80004003`; empty `InputObjs` returns
`1` and changes nothing. On first execution the task records, per target, a
soft reference plus the old attribute value; **Undo** puts the old value back
(or removes the attribute when there was none) ; **Redo** runs the worker
again without re-recording. Keyword/tab/colour tasks additionally broadcast a
property-changed notification whose name is the attribute GUID as text
(`CDSNotifierHelper::PropertyChanged`).

### `SetUserKeyword` / `SetUserTab`: SPEC

Args: `InputObjs` (list), `Keywords` (string, default empty). No return value.
The command GUID `492ce486-2251-4331-aebd-33d398f00347` (`SetUserTab`)
switches the attribute to *user tabs*; anything else uses *user keywords*.

1. `Keywords` empty:
   - no UI (batch): raise `0x80070057`, severity 2, message `0x3eb`; stop.
   - with UI: read the current merged keywords of `InputObjs` (through an
     internal `GetUserKeyword` task), show the modal dialog "User Keyword(s)"
     / "Please enter the User Keywords (comma separated)" (dialog resource
     `0xca`) pre-filled with them. OK takes the typed text; Cancel (or an
     empty result) logs message `0x1e` at severity 4 and returns `0x562e80c7`.
     The pre-fill always reads the *keyword* attribute, also for `SetUserTab`.
2. Every space character is removed from `Keywords` (`CSIString::Exclude(" ")`).
3. Old values are recorded for undo.
4. If the string is now empty: an internal `ClearUserKeyword` task is run on
   `InputObjs` and attached as sub-task. That sub-task is created without the
   command GUID, so it clears the *keyword* attribute even under `SetUserTab`
   (as read; Q2).
5. Otherwise the attribute of every target is **replaced** by the string
   (no merge with the previous value).
6. `RePackArg` writes the final string back into `Keywords`, so a logged
   command shows what was typed.

### `GetUserKeyword` / `GetUserTab`: SPEC

Args: `InputObjs`; output/return `Keywords`. Command GUID
`d21bc660-755f-4868-876c-8d7cdccc9402` (`GetUserTab`) selects user tabs.
Reads the attribute string of every target, splits on `,`, merges the tokens
into one list **without duplicates, case-insensitively**, in first-seen order.
The result is returned as a collection object (class
`{c5c11542-5471-11d2-ba4f-00a0c982a112}`, interface `{c5c11541-…}`) to which
each token is added (collection slot 14, token used as both key and value);
it is stored in argument `Keywords` as an object (VT 9). Nothing is modified;
`Do` returns `1`. With no keywords the collection is empty.

### `ClearUserKeyword` / `ClearUserTab`: SPEC

Arg: `InputObjs`. Command GUID `bf0df5a2-323c-4b04-83df-93db62c16af9`
(`ClearUserTab`) selects user tabs. Removes the attribute from every target;
undo restores the previous strings.

### `RemoveUserKeyword` / `RemoveUserTab` (and `AddUserKeyword` / `AddUserTab`): SPEC

Args: `InputObjs`, `Keywords` (string, default empty). One class, four command
GUIDs:

| Command GUID | Command | Attribute | Mode |
|--------------|---------|-----------|------|
| `3149f7b6-3191-4fff-bade-eb075f0f1111` | `RemoveUserKeyword` | keywords | remove |
| `57c1eccb-ae1a-4802-8d5e-56d659a865f7` | `RemoveUserTab` | tabs | remove |
| `ef8004ef-45a9-42a7-b4b5-2c7826a2aaa0` | `AddUserKeyword` | keywords | add |
| `32b277b6-923c-4ea9-81cc-7c63d5d31069` | `AddUserTab` | tabs | add |

Empty `InputObjs` or empty `Keywords` returns `1`. `Keywords` is split on `,`
(unique, case-insensitive; spaces are **not** stripped here). Per target: take
the existing token list; *remove* drops each given token, *add* appends each
given token (a target without the attribute starts from an empty list in add
mode and is left untouched in remove mode). If the resulting list is empty the
attribute is removed, otherwise it is rewritten as the joined list. Undo as in
the common pattern.

### `SetParameterColor`: SPEC

Args: `InputObjs`, `Value`. `Value` is used only if it converts to an unsigned
32-bit integer whose top byte is zero (`0x00000000`..`0x00ffffff`); empty,
float, double and boolean values are ignored. Layout `0x00BBGGRR` *(inferred:
the value is handed unchanged to the Windows-style colour dialog)*.
Without a usable `Value`: no UI raises `0x80070057`, message `0x3eb`; with UI
the colour editor (`DSCtlOpenColorEditorDlg`) opens, initialised with the
current colour of the first target (`SIGetParameterColor`, type 0) or `0xff`;
cancel logs message `0x1e` and returns `0x562e80c7`. The colour is written to
every target; `RePackArg` stores the chosen number back into `Value`.

### `ClearParameterColor`: SPEC

Arg: `InputObjs`. Removes the colour attribute from every target.

### `ClearThumbnail`: SPEC

Arg: `InputObjs`. Removes the thumbnail attribute from every target. For undo
it records the previous thumbnail's file name (read from the thumbnail object,
slot 6) or the marker `__NOTHUMBNAIL__`.

### `SetThumbnail`: SPEC-PARTIAL

Args: `InputObjs`, `Pathname` (string, default empty).

1. `InputObjs` is copied and filtered: an item is dropped when it does not
   expose interface `{9ee6ddb1-65cc-11d1-b0ce-00a024c79287}`, or when its
   current thumbnail attribute holds an object exposing
   `{80802a4c-cad1-4a3d-a35e-593039afedef}`. Nothing left gives `0x80070057`,
   raised with message `0x6f`.
2. The project's thumbnail folder is asked from the content container
   (`SIGet3DContentContainer` `{e88cea1d-175c-11d3-b987-00a02403987d}`, path
   kind `0x17`) and created if missing.
3. `Pathname` empty: no UI raises `0x80004005` message `0x17`; with UI a file
   browser opens (kind `0x17`, title "Browse for Thumbnail", image file
   filters from the registered parsers, starting in the thumbnail folder);
   cancel raises `0x80004005` message 1000. The chosen full path becomes
   `Pathname` (also written back by `RePackArg`).
4. Path handling: no directory part (or `.`): the file must already exist in
   the thumbnail folder, else `0x80004005` message `0x17`. Directory equal to
   the thumbnail folder: only the file name is kept. Any other directory: the
   file must be readable (else message `0x17`); if a file of that name already
   exists in the thumbnail folder raise `0x80070005` message `0x3b`; otherwise
   copy it there (no overwrite), log message `0x26` (source, destination), and
   keep the file name.
5. For each remaining target a new thumbnail object is created, initialised
   with the target and the file name *(inferred from two init calls)*, and
   stored as the thumbnail attribute.

Missing: exact return codes on the early exits (lost by the decompiler); what
interface `{80802a4c-…}` denotes (Q3).

### `SetThumbnailFromRegion`: SPEC-PARTIAL

Args: `InputObjs`, `FileName` (string, default empty), `Overwrite` (bool,
default false).

1. Finds the view that currently has a render region: enumerates view ids
   from generic object `{62338901-ba7c-11d0-b182-0800360bff02}` and asks each
   view (via `{6ffcf551-f75b-46ba-8494-02bde7d6a996}`) a yes/no question
   (slot 7); the first "yes" wins *(meaning inferred)*. None: nothing happens.
2. Thumbnail folder as above.
3. `FileName` empty: no UI logs message `0x3eb` and stops. With UI a
   save-style browser opens (title "Enter the Thumbnail filename"), default
   name `<name of first target>.jpg`, falling back to `Thumbnail.jpg`. If the
   user picks another folder an error box shows "The thumbnail file MUST be
   saved in the 'Thumbnails' sub-folder of the current project." and the
   browser reopens in the thumbnail folder. Cancel logs message `0x1e`. When
   the chosen file already exists, overwrite is switched on.
   `FileName` given: only its file-name part is used.
4. Final path = thumbnail folder + file name (resolved); it is written back
   to `FileName`. If the file exists and overwrite is off: raise `0x80004005`
   message `0x3b`.
5. Runs an internal task `{8ab0e935-9a8d-4027-9d44-f78e8b0edfad}` with (view
   id, path, 1) which is expected to write the region image *(inferred)*; if
   the file is then unreadable raise message `0x17`. Then runs an internal
   `SetThumbnail` task on (`InputObjs`, path). Both are attached as sub-tasks,
   so undo/redo is theirs.

Missing: the region-capture task itself (other DLL), exact status codes.

---

## Wire contract: `grouptask.dll`

A "group container" is any object exposing interface
`{35c3e1e5-2696-46ca-9568-1e7c9f7bc7f5}` with indexed group slots: slot 3 get
group at index, slot 4 set group at index, slot 5 clear index; the same object
answers "is this index usable" through `{6de1b670-8072-11d5-aeed-0090275802c9}`
slot 30. A group is `{b0cbf80e-c0d5-11d0-a586-00a0c91412de}`.

### `AssignObjectGroup` / `SetParTypeInstanceGroup` (/ `SetInstanceGroup`): SPEC-PARTIAL

Registered args: (`Object` | `ParType`), `Group`. The handler asks the context
for the names **`Object`** and **`Group`** only.

1. `Object`: empty list gives `0x8000ffff`. The first item is resolved to a
   group container plus a component index (descriptor type `0x402`, index in
   the descriptor). If the item is not itself a container, a nested object of
   that kind is looked up on it (item slot 43) and index 0 is used; none gives
   `0x80070057`.
2. `Group`: first item resolved to a group; its type (interface
   `{eff95861-6291-11d1-be9e-00a024ee478d}`, slot 8) must be `3`, else raise
   `0x80004005`, severity 2, message `0x6f`.
3. Do: if the container says the index is not usable, nothing happens.
   On first execution soft references to container(+index) and new group are
   stored. The group currently at the index (if any) is remembered, then the
   new group is set at the index.
4. Undo: restore the remembered group, or clear the index if there was none.

Missing: how the `ParType` argument name reaches the handler (it only asks
for `Object`; Q4); meaning of group type `3`.

### `UnassignObjectGroup` / `RemoveParTypeInstanceGroup` (/ `RemoveInstanceGroup`): SPEC-PARTIAL

Registered arg: (`Object` | `ParType`); read as `Object`. Resolution as step 1
above but without the nested-object fallback (`0x80070057` if the item is not
a container). Do: if the index is usable and holds a group, remember it and
clear the index. Undo: set the remembered group back. Same Q4.

---

## Wire contract: `siviewtasks.dll`

None of the three tasks records undo data; `Do` returns `1`.

### `OpenXSIExplorer`: SPEC

Args: `Scope` (enum, default `siExplorerScopeDefault`), `Viewer` (string),
`InputObjs`, `ShowToolbar` (bool, default true), `Title` (string), `Reuse`
(bool, default true); output `Value`.

- `Viewer` is turned into a view GUID with `DSFindViewFromName`; failure gives
  `0x80070057`.
- `Scope` is read as an unsigned number and mapped to the explorer's internal
  scope: 1→1, 2→2, 4→4, 5→5, 6→6, 7→7, 8→8, 9→10, 10→12, 11→13, 12→14, 13→15,
  14→16, 15→17, 16→18, 17→19, 18→20, 19→21; every other value (0, 3, >19) →3.
- Do: `DSCreateView` of the explorer view class
  `{ba75acc4-5ef1-4052-b1c1-7b4698a3175b}` with `Reuse` as its last argument;
  set the scope; set the toolbar flag; if `InputObjs` is non-empty the listed
  objects are handed to the view one by one (as root/selected content; the
  view chooses between two modes by its own slot 5 answer); if a viewer GUID
  was found it is given to the view; a non-empty `Title` is applied.
- `RePackArg` stores the view object in `Value` (object, VT 13).

### `OpenTransientExplorer`: SPEC

Args: `InitObjects`, `Filter` (enum, default `siSEFilterAllNodes`),
`ExpandLevel` (int, 0), `Sort` (bool, true), `MultiSelect` (bool, false);
output `Value`.

- `Filter` number → node filter mask: 0→`0xffff`, 1→`0xf7ff`, 2→`0x44f`,
  3→`0x443`, 4→`0x5d3`, 5→`0x47b`, 6→`0x5eb`, 7→`0x401`, 8→`0x443`,
  9→ "only objects exposing `{22c3e8f9-ccea-11d2-b35b-00105a1e70de}`";
  other values → empty filter.
- Do: opens the transient (pop-up) explorer with `F3DShowTransient` (style
  word `0x12b1`, `ExpandLevel`, single-select unless `MultiSelect`, sorted if
  `Sort`, `InitObjects` as initial content) with a picking session
  (`{113dedff-f858-447e-9de8-dfe5c0fd317f}`) wired to the task, then **blocks**
  in a sub-message loop until the registered window message
  `TransientPickingSessionTerminated` arrives.
- Picking notifications update the result list: "set" replaces it, "add"
  appends, "remove" removes, "toggle" removes items already present and adds
  the others.
- `RePackArg` stores the result list in `Value` (VT 9); an empty list if
  nothing was picked.

### `OpenAttachments`: SPEC-PARTIAL

Args: `Target`; second registry entry adds `ForceExplorer` (bool, default
true). `Target` may be a list or a single object (wrapped into a list); an
empty list counts as "no target". Missing `ForceExplorer` reads as false.

1. If the transient explorer is currently shown: hide it and stop (toggle).
2. `ForceExplorer` true or no target: show the transient explorer (all-nodes
   filter, 300×300, mode 9 with a target / 3 without).
3. Otherwise, for the single target: gather attachment entries from its
   nested annotation/attachment containers (`{eff95863-…}` / `{eff95865-6291-11d1-be9e-00a024ee478d}`),
   producing three parallel comma-separated strings. If any entry exists, a
   NetView-style viewer (`{f2d93252-ecd7-11d4-beae-00a0c982ddd4}`) is reused
   for the target's full name or created and loaded with the three strings
   plus the name.
4. No entries: if the target has annotations (`SIGetAnnotations`), run
   `InspectObj` (command GUID `e2d3c14a-20e8-11d3-80e6-00a0c9ac19a9`) with
   `InputObjs` = the first annotation. Otherwise log message `0x79`
   (severity 16) or `0x7a` (severity 4) and fall back to step 2.

Missing: what the three strings hold and how entries are ordered.

---

## Wire contract: `siclustertasks.dll`

### `SITogglePolygonVisibility`: SPEC-PARTIAL

Arg: `InputObjs`. Each item must be of kind 7, or of kind 6 with component
type `{3df7f9e2-89ee-11d0-9964-00a0243f0e60}` (polygons); anything else gives
`0x80070057`.

1. Items on the same object are merged into one polygon set per object.
2. Per object, the polygon cluster named `InvisiblePolygons`
   (`siInvisiblePolygonsClusterName`) is looked up; **if the object has no
   such cluster nothing is done for it** (as read; Q5).
3. Toggle rule: if at least one selected polygon is not in the cluster, all
   selected non-members are **added** (members stay); only when every selected
   polygon is already a member are they all **removed**.
4. Adding/removing is delegated to internal tasks
   `{5f1f5165-8b90-11d2-a93c-00a024190119}` (add elements) and
   `{5f1f5167-8b90-11d2-a93c-00a024190119}` (remove elements), attached as
   sub-tasks; Undo/Redo simply undo/redo the sub-tasks.

### `ClusterNonOverlapEnforcement`: SPEC-PARTIAL

Args: `InputObjs` (every item must be kind 6, else `0x80070057`), `Property`,
`ActionWhenLocalMaterialsOverlap` (default `siRemoveFromSelectedClusters`);
output `OutputObj`. An unregistered argument `CategoryID` is tried first.

- Category: from `CategoryID` if present; else from `Property` (a property
  exposing `{cdea6777-415b-11d0-aa40-00a0243e34c4}`, or an object/list whose
  nested property of that kind is taken); none gives `0x80070057`. The
  category is passed through `F3DTranslateMaterialCATID`.
- Action number → behaviour: `1` remove the overlapping elements from the
  **input** clusters; `2` remove them from the **other existing** clusters
  holding a property of the category; `4` only detect. Any other value gives
  `0x80070057`. (Enum member names for 2 and 4 not read; 1 matches the default
  name.)
- Removal uses the internal remove-elements task above as sub-tasks; on
  failure all sub-tasks are undone. Overlapped clusters are appended to the
  list returned in `OutputObj` (object list, VT 13) *(inferred)*.

Missing: exact overlap test and the precise content of `OutputObj`.

---

## Wire contract: `selectionmgr.dll`

The "active list" is owned by generic object
`{a003cac3-e4f3-11d1-84c6-00aa00135f7b}` (interface `{a003cac2-…}`): slot 32
add, slot 33 remove, slot 34 set. Add/set hand back two lists (newly
activated, newly deactivated) for which internal tasks
`{38eddd00-d255-11d2-8bcf-00aa006130ef}` / `{38eddd02-…}` are run and attached
as sub-tasks.

Common to the five active-elements commands (all SPEC-PARTIAL: the list
manager and the partition helper `0x180010940` live outside what was read):

- Args: `SelectionList` (registered); plus unregistered optional
  `HierarchyLevel` (integer 0..7, else `0x80070057`; default 0) and, for
  `ActivateElements` / `ToggleActiveElements`, `CheckObjectSelectability`
  (bool, default false).
- The list is expanded for the hierarchy level by the selection service
  `{24be99c0-5eb6-11d2-8bb0-00aa00135f7b}` (slot 29), then filtered item by
  item (items the active list cannot hold are dropped).
- First execution saves the current active list; **Undo** undoes sub-tasks
  and sets the saved list back; **Redo** re-applies.
- `HierarchyLevel` 4 is rejected (`0x80070057`) by Activate, Toggle and
  SetAndToggle.

| Command | Effect |
|---------|--------|
| `SetActiveElements` | active list := filtered list (empty/null list clears it); returns `0x562e80c7` when nothing changed |
| `ActivateElements` | filtered list is added to the active list (honours `CheckObjectSelectability`) |
| `DeactivateElements` | expanded list is removed from the active list (no filter step) |
| `ToggleActiveElements` | filtered list is split into "currently active" and "not active"; the first part is removed, the second added |
| `SetAndToggleActiveElements` | list is split with the helper in its other mode; a non-empty second part gives `0x8000ffff`; otherwise active list := first part (exact split rule not read, Q6) |

### `ActivateSampledPointSelTool` / `ActivateSampledPointSelToolWithNoObjStateChange`: SPEC-PARTIAL

One class serves every `Activate…SelTool` entry; the two commands differ only
in registry defaults (`DeselectOnNewFilter` true / false; `SelFilter`
`…:SampledPoint`, `SelRegionMode` 1).

- Args (all optional by name): `SelFilter` (filter object
  `{af5d00d4-ecdc-11d0-a595-00a0c91412de}`), `DeselectOnNewFilter` (bool),
  `GroupMode` (bool), `SelRegionMode` (integer 1..6, else `0x80070057`).
  `DeselectOnNewFilter` is forced to false when the tool manager reports that
  the tool `{cf80cbc3-984e-11d1-96e7-00a024191bac}` is not the current one.
- Do, in order: (a) with `SelFilter`: run internal set-filter task
  `{91d68770-dbe9-11d2-8bcf-00aa006130ef}` (filter, `DeselectOnNewFilter`) as
  sub-task; (b) with `GroupMode`: set ambient value `SI3D_GROUP_SEL_MODE` if
  different, remembering the old one; (c) with `SelRegionMode`: set ambient
  value `SI3D_RECTSEL_REGION_MODE` if different; (d) activate the selection
  tool `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` through the tool manager
  `{e99d46d0-b9bc-11d1-9153-00a0c9612e3a}` unless it is already current.
- The task behaves differently for "sticky/supra" key invocations (exec
  context flag bits 2 and 4) and restores `SI3D_GROUP_SEL_MODE` when such a
  temporary activation ends.

Missing: the key-mode branches in detail, and what "previously tagged
components are selected" (registry description) maps to; it is not done in
this class's visible code and presumably happens in the set-filter task.

---

## Open questions

- **Q1** Message texts for ids `0x17`, `0x1e`, `0x26`, `0x3b`, `0x6f`, `0x79`,
  `0x7a`, `0x3eb`, 1000: the catalog/key used by `CSIErrorHandling` was not
  resolved (`XSIMSGCAT.dict` does not index them directly).
- **Q2** `SetUserTab` with an empty/blank string, and its dialog pre-fill, act
  on the *keyword* attribute (sub-tasks created without the tab switch). Read
  as such; needs a live check before being reproduced as a quirk.
- **Q3** Interface `{80802a4c-cad1-4a3d-a35e-593039afedef}` on an existing
  thumbnail makes `SetThumbnail` skip the target: what kind of thumbnail is it?
- **Q4** `SetParTypeInstanceGroup` / `RemoveParTypeInstanceGroup` register the
  argument as `ParType` but the handler asks for `Object`. Either
  `F3DGetArgPtrValueFromName2` falls back (to position?) or these commands
  fail; not established.
- **Q5** `SITogglePolygonVisibility` when no `InvisiblePolygons` cluster
  exists: no cluster creation was seen in the worker (a helper at
  `0x1800030b0` was not read).
- **Q6** `selectionmgr.dll` helper `0x180010940` (split of a list against the
  active list, two modes) and the active-list manager methods (other module).
- **Q7** Enum numeric values of `siExplorerScope`, `siTransientExplorerFilter`,
  `siActionWhenLocalMaterialsOverlap` are taken as the numbers the handlers
  compare against; the name ↔ number mapping is not in these DLLs.
- **Q8** `simeshtasks.dll` (11 commands) not analysed in this run.
