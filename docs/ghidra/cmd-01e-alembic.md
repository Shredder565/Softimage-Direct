# CMD-01e: Alembic import / export commands (`AbcImportExport.dll`)

Row: **CMD-01e** (split from CMD-01, uncategorised). Status: **SPEC** (command layer).
Run: 2026-11-16, `si-analyst`, unattended.

Five self-installed C++ commands that sit in front of the Alembic reader and
writer. This note is the command layer only: arguments, validation, dialogs,
option properties, what is handed on, return values and errors. What an `.abc`
file contains and how objects are rebuilt from it is SYS-03.

| Command | Implemented in | Handler (image address) |
|---------|----------------|-------------------------|
| `AbcExport` | `Application\Plugins\AbcImportExport.dll` | `AbcExport_Execute` `0x180002640` |
| `AbcImport` | same | `AbcImport_Execute` `0x180003290` |
| `AbcVer` | same | `AbcVer_Execute` `0x180003bd0` |
| `OnAbcExportMenu` | same | `OnAbcExportMenu_Execute` `0x180005bb0` |
| `OnAbcImportMenu` | same | `OnAbcImportMenu_Execute` `0x180006950` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | names, arguments, defaults, return flag, descriptions |
| (B) | REA + Ghidra 12.1.4 on `AbcImportExport.dll` (sha256 `0dd9d96b4c89017f…`, file version 13.2.163.0); the five `_Execute` exports and the two `_Define` exports (`ImportAbcOptions_Define` `0x180005610`, `ExportAbcOptions_Define` `0x180004110`) | everything in the contract below |
| (T) | string table of the same DLL | UI labels, log texts, attribute lists, names of things the plug-in registers |
| - | XSIBATCH goldens, SDK command reference | not used |

No decompiler output or disassembly is reproduced here. Items marked
*(inferred)* are reasoned from call shape or string tables, not read step by step.

## Shared facts

### What the plug-in registers (T, B)

Plug-in name `Abc Import/Export Plug-in`, author `Softimage`. It registers the
five commands above, two custom properties `ImportAbcOptions` and
`ExportAbcOptions`, and one event `DragDropAbcFile` (a drag-and-drop handler
that claims files with extension `.abc`; its action is not specified here, see
Q3). All five commands are enabled, key-assignable, uncategorised (R).
`OnAbcImportMenu` and `OnAbcExportMenu` are the File menu entry points
(descriptions "Prompt to set options and import an Alembic file" / "… export
an Alembic file").

All user-visible texts are passed through the dictionary `ABCIMPORTEXPORT`
with the English text as key, so the English text is the fallback.

### Status codes

| Value | Meaning here |
|-------|--------------|
| `0` | OK |
| `0x80004004` | aborted: the user cancelled the options dialog |
| `0x80004005` | generic failure |
| `0x80070057` | invalid argument |

### `ImportAbcOptions` property (B)

Lives directly under the active scene root, found by name, created on demand
with `AddProperty("ImportAbcOptions")` (no branch flag, default name).

| Parameter | Type (`siDataType`) | Default | Label |
|-----------|--------------------|---------|-------|
| `CreateModel` | bool (11) | false | Import under newly created Model |
| `CreateICETreeMode` | int4 (3) | 0 | Create ICETree per Object or single one to drive all Objects |

Both are persistable only (capability 4). Layout (T): one group `Options`;
`CreateModel` as a check box; `CreateICETreeMode` as a combo labelled
`ICE Trees for Importing` with items `Multiple - One per Object` and
`Single - One driving all Objects` (values 0 and 1 in that order, *inferred*).

### `ExportAbcOptions` property (B)

Same placement and creation rule, type name `ExportAbcOptions`.

| Parameter | Type | Default | Label |
|-----------|------|---------|-------|
| `StartFrame` | double (5) | 1.0 | Start Frame |
| `EndFrame` | double (5) | 100.0 | End Frame |
| `IncludeParentHier` | bool (11) | false | Include hierarchy up to Scene Root |
| `ArchiveFormat` | string (8) | `Ogawa` | Archive Format |
| `IncludeAttributesPointcloud` | string (8) | the point-cloud default list below | Included ICE Attributes for Pointclouds |
| `IncludeAttributesPolymesh` | string (8) | the polygon-mesh default list below | Included ICE Attributes for Polymeshes |
| `IncludeAttributesOtherPrim` | string (8) | `""` | Included ICE Attributes for other primitives |

Default attribute lists (comma + space separated text, T):

- point clouds: `Color, Scale, Size, PointVelocity, Orientation, AngularVelocity, Shape, StrandPosition, StrandVelocity, StrandDeform, StrandOrientation, StrandUpVector, StrandColor, StrandSize, ColorAlongStrands`
- polygon meshes: `Materials, MaterialID, PointUserMotions`

Two more lists exist in the binary and are not user-editable; by their content
they are the attributes that are always written (*inferred*): for point clouds
`PointPosition, Size, PointVelocity, ID, EmitLocation, LocalTime`, for polygon
meshes `PointPosition, NodeUserNormal, LocalTime, Topology, PolygonalDescription`.

Layout (T): group `Time Range` (`StartFrame`, `EndFrame`);
`IncludeParentHier`; combo `Archive Format` with items `Ogawa`, `HDF5`; group
`ICE Attributes for Pointclouds` with the note "PointPosition and ID will
always be exported", the text field and two buttons `Delete All`
(`ClearAttributesPointcloud`) and `Add Default Attributes`
(`AddDefaultAttributesPointcloud`); group `ICE Attributes for Polygon Meshes`
with the same pair (`ClearAttributesPolymesh`, `AddDefaultAttributesPolymesh`);
group `ICE Attributes for other primitives` with `Delete All`
(`ClearAttributesOtherPrim`). Button behaviour as named: clear the text, or
put the default list back (*inferred*; the event handler was not read, Q2).

## Wire contract

### `AbcVer`

No arguments, no return value. If the Alembic framework library can be
loaded, logs one message: `Using Alembic Framework ` + the framework's
version text + ` with ` + a second text supplied by the framework (the
underlying Alembic library description). If it cannot be loaded nothing is
logged by the command itself (the loader reports "Unable to load the Alembic
Framwork library" or "Unable to get an Alembic Framework Interface",
*inferred*). Status is always OK. The two version texts come from
`AbcFramework.dll` and were not read (Q1).

### `AbcImport`

| # | Argument | Type | Default |
|---|----------|------|---------|
| 0 | `FilePathName` | string | `""` |
| 1 | `ImportAnimation` | bool | true |
| 2 | `StartTime` | double | -1.0 |
| 3 | `EndTime` | double | -1.0 |
| 4 | `PadShapeClips` | bool | true |
| 5 | `FitTimeRange` | int | 0 (valid 0, 1, 2) |
| 6 | `AnimationImportMode` | int | 0 (valid 0, 1) |
| 7 | `Parent` | object | registered default `SingleObj` (one object taken from the selection, *inferred*) |
| 8 | `CreateModel` | bool | false |
| 9 | `CreateICETreeMode` | int | 0 |

Returns a bool: true when the import succeeded.

Observable steps:

1. Resolve the parent. If `Parent` is not a valid 3D object: take the first
   selected item when the selection is not empty and that item is of class id
   `0x48`; otherwise the active scene root.
2. Validate. `FitTimeRange` above 2 (or negative) logs
   `Invalid FitTimeRange argument` and fails with `0x80004005`.
   `AnimationImportMode` above 1 (or negative) logs
   `Invalid AnimationImportMode argument` and fails the same way. In both
   cases no return value is set.
3. Log `AbcImport_Execute called`.
4. Configure an importer in this order, stopping at the first step that
   fails: open the file; animation options (`ImportAnimation`, `StartTime`,
   `EndTime`, `FitTimeRange`); `AnimationImportMode`; then `PadShapeClips`,
   `CreateModel`, the parent and `CreateICETreeMode`; then run the import.
5. Return value = true only if every step of 4 succeeded. The command status
   is OK either way, so a failed import does **not** raise a script error; the
   caller must test the return value.

`StartTime` / `EndTime` of -1 mean "use the file's range" (*inferred* from the
defaults). The meaning of the `FitTimeRange` and `AnimationImportMode` values
is importer behaviour (SYS-03, Q4).

### `AbcExport`

| # | Argument | Type | Default |
|---|----------|------|---------|
| 0 | `FilePathName` | string | `""` |
| 1 | `StartFrame` | integer | 1 |
| 2 | `EndFrame` | integer | 100 |
| 3 | `InputObjs` | collection | none |
| 4 | `IncludeParentHier` | bool | false |
| 5 | `Storage` | string | `Ogawa` |
| 6 | `AttributesPointcloud` | string | `""` |
| 7 | `AttributesPolymesh` | string | `""` |
| 8 | `AttributesOtherPrim` | string | `""` |

Returns a bool: true when the export succeeded.

Observable steps:

1. Log `AbcExport_Execute called`.
2. `Storage` is compared without regard to case: `HDF5` selects archive type
   0, `Ogawa` selects 1. Any other text fails with `0x80070057`; no return
   value is set.
3. Frame range check against the `Play Control` property of the active
   project: it must hold that `In` ≤ `StartFrame` ≤ `EndFrame` ≤ `Out`.
   Otherwise fail with `0x80070057`, no return value. So a range outside the
   current timeline is rejected, not clamped.
4. Create an exporter for the file with `IncludeParentHier` and the archive
   type, give it the three attribute lists, and export `InputObjs` over the
   frame range.
5. For every requested attribute that could not be written, log one line:
   the translation of `Attribute not exported`, a separator, and the
   attribute name.
6. Return value = true when step 4 succeeded. Unlike `AbcImport`, the command
   status **is** the export status, so a failed export also raises.

Exporter messages (T, SYS-03 detail): `No supported object found to export`,
`Attribute data type is not supported`, progress captions
`Caching objects...` and `Caching instanced geometries...`.

### `OnAbcImportMenu`

One argument `FilePathName` (string, default `""`). No return value.

1. Find `ImportAbcOptions` under the scene root, creating it if missing.
2. Run `InspectObj "ImportAbcOptions", , "Alembic Import", 4, false`
   (mode 4 = modal). If it reports cancel, stop with status `0x80004004`.
3. If `FilePathName` is empty, open the standard file browser
   (`XSI.UIToolkit` `FileBrowser`): filter `Alembic Files(*.abc)|*.abc||`,
   title `Alembic Import`, base name empty, initial directory = the directory
   of the last file picked by this command in this session, or the active
   project path the first time; shown as an Open dialog. An empty result ends
   the command with status OK and nothing imported. Otherwise the picked
   directory is remembered.
4. Run `AbcImport` with the file as argument 0 and `CreateModel`,
   `CreateICETreeMode` from the property as arguments 8 and 9. All other
   arguments are left unset, so they take the registered defaults.
5. Status OK when `AbcImport` returned true, `0x80004005` otherwise.

Note the order: the options dialog comes **before** the file browser, also
when a file name was passed in.

### `OnAbcExportMenu`

No arguments, no return value.

1. Find `ExportAbcOptions` under the scene root. When it has to be created,
   its `StartFrame` and `EndFrame` are initialised from the current time range
   (the timeline in / out, *inferred*) rather than left at 1 and 100.
2. Set the PPG view size on the property's layout (height 559; width not
   recovered, Q5).
3. Run `InspectObj "ExportAbcOptions", , "Alembic Export", 4, false`. Cancel
   stops with `0x80004004`.
4. File browser as for import, but a Save dialog, title `Alembic Export`, and
   its own remembered directory (import and export directories are separate).
   Empty result: status OK, nothing exported.
5. Run `AbcExport` with: the file; `StartFrame`, `EndFrame`,
   `IncludeParentHier`, `ArchiveFormat`, `IncludeAttributesPointcloud`,
   `IncludeAttributesPolymesh`, `IncludeAttributesOtherPrim` from the property
   (arguments 1, 2, 4, 5, 6, 7, 8); and the **current selection** as
   `InputObjs`.
6. Status OK when `AbcExport` returned true, `0x80004005` otherwise.

Because `AbcExport` rejects a range outside the timeline, a stale
`ExportAbcOptions` whose range no longer fits the timeline makes the menu
command fail after the file has been chosen.

### Enable conditions

None in the registry. The menu commands need an interactive session (modal
dialog and file browser); in batch they are not usable (*inferred*).

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | Exact texts logged by `AbcVer` | read the two version getters in `Application\bin\AbcFramework.dll`, or run `AbcVer` through XSIBATCH |
| Q2 | `ExportAbcOptions_PPGEvent` (`Delete All` / `Add Default Attributes`): exact text written, and whether "add" appends to or replaces the field | read the export at its address in the same DLL |
| Q3 | `DragDropAbcFile_OnEvent`: which command a dropped `.abc` runs and with which arguments | read the export |
| Q4 | Meaning of `FitTimeRange` 0/1/2, `AnimationImportMode` 0/1, `CreateICETreeMode` 0/1 and `PadShapeClips` in the importer; class id `0x48` by name | importer setters at `0x18002a390`, `0x18002a070`, `0x18002a0a0`, `0x18002a370`; `xsi_decl.h` |
| Q5 | Width passed to `SetViewSize` in `OnAbcExportMenu`; exact source of the initial `StartFrame` / `EndFrame` (helper `0x1800222e0`) | instruction-level read |
| Q6 | No golden | `AbcExport` then `AbcImport` of a cube through XSIBATCH; check return values and the three failure codes |
