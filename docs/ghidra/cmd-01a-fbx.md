# CMD-01a: FBX import / export command family (`FBXXSI.64.dll`)

Row: **CMD-01a** (split from CMD-01, uncategorised). Status: **SPEC-PARTIAL**.
Run: 2026-11-12, `si-analyst`, unattended.

40 commands, all registered by the self-installing plug-in
`Application\Plugins\FBXXSI.64.dll` (sha256 `7986a68b…dabd7a8`), plug-in name
"FBX-XSI import/export Plug-in", plug-in version 5.5.

This note specifies the **command surface**: arguments, defaults, return values,
which option parameter each command reads or writes, menus, dialogs and error
paths. What the exporter/importer actually writes into or reads from an `.fbx`
file belongs to SYS-03 and is not specified here.

## How it was attested

| Source | What it gave |
|--------|--------------|
| `data/commands_full.json` | name, scripting name, argument names, handlers, defaults, description, `return_value`, `key_assignable`, category (empty) for all 40 |
| Shipped data files | Nothing: the family has no SPDL, no script file and no command-map entry. Menus and the two option property sets are built in code by the plug-in |
| SDK header `XSISDK\include\xsi_decl.h` | `siMenuAnchorPoints`, `siMenuItemStyle`, `siCapabilities` values |
| Public documentation | **Not reached this run.** The install ships no local docs (`Doc\en` only has links to the online guides) and the online SDK command reference could not be fetched from this session. See open question Q1 |
| REA + Ghidra 12.1.4 on `FBXXSI.64.dll` | Everything marked (B) below. Function addresses are image addresses (base `0x180000000`) |

Functions read: `XSILoadPlugin` `0x18007c100`; every `<Name>_Init` / `<Name>_Execute`
export; option accessor `0x180094ec0` (index to parameter), get `0x1800946b0`,
set `0x1800947a0`; import-mode text mapping `0x180094820` / `0x180094900`;
unit index helper `0x180094c50`; group lookup `0x1800fe340`; file browser
helper `0x18007ba50`; run wrapper `0x180121480`; `ExportFBXOptions_Define`
`0x18008a000`; `ImportFBXOptions_Define`; both `_PPGEvent` handlers (string
references only).

No decompiler output is reproduced here. Raw output stays outside git.

## Shared model

### Registration (B)

Each command is registered as *scripting name* → *command name*. They are the
same except:

| Scripting name | Command name |
|----------------|--------------|
| `FBXImport` | `FBXFileImport` |
| `FBXExport` | `FBXFileExport` |
| `FBXInjectInOriginal` | `FBXFileInjectInOriginal` |
| `FBXInjectInCopy` | `FBXFileInjectInCopy` |
| `FBXImportProtectExprDrivenFC` | `FBXImportProtectExprDriven` |
| `FBXImportSkeletonsAsNulls` | `FBXImportSkeletonAsNulls` |

The plug-in also registers three custom properties: `ExportFBXOptions`,
`ImportFBXOptions`, `FBXWarningDialogData`.

Menus (anchor values from `xsi_decl.h`):

| Menu | Anchors | Content |
|------|---------|---------|
| `FBXSeparator` | `siMenuMainFileCrosswalkID` (1015), `siMenuMainFileExportID` (1002), `siMenuMainFileImportID` (1003) | one item, label `" "`, style `siMenuItemSeparator` (3) |
| `FBXFileImport` | 1015, 1003 | command item "Import FBX..." → `FBXFileImport` |
| `FBXFileExport` | 1015, 1002 | command item "Export FBX..." → `FBXFileExport` |

Registration order within each anchor is separator first, then the item.

### Option storage (B)

All option commands read and write parameters of two custom properties that
live **directly under the active scene root**:

- export options: property named `ExportFBXOptions`
- import options: property named `ImportFBXOptions`

Lookup is by name on the scene root. If the property does not exist it is
created with `AddProperty(<type name>)` (branch flag false, default name) and
then used. So the first option command run in a scene has a visible side
effect: a new property under the scene root. Values persist with the scene.

`ExportFBXOptions` parameters, in definition order (types are `siDataType`
values: 11 bool, 4 float, 3 int4, 8 string):

| Parameter | Type | Default |
|-----------|------|---------|
| Automatic | bool | true |
| MasterScale | float | 1.0 |
| MasterUnitIndex | int4 | index of centimetres in the unit table (see Units); one capability flag set |
| ExportSelection | bool | false |
| ExportGeometry | bool | true |
| ExportCameras | bool | true |
| ExportLights | bool | true |
| ExportShapes | bool | true |
| ExportSkins | bool | true |
| ExportHardEdges | bool | true |
| ExportAnimation | bool | true |
| ResamplingRate | float | 30.0 |
| AsciiFBX | bool | false |
| EmbedTextures | bool | false |
| ConvertImageFormat | bool | false; one capability flag set |
| ImageFormat | string | "tiff"; one capability flag set |
| ShowWarningDialog | bool | true |
| BindPose | bool | true |
| ExportShowWarningDialog | bool | true |
| ExportKeepXsiEffectors | bool | false |
| ExportDeformerAsSkeleton | bool | false |
| ExportFilename | string | "" |
| BoneSize | float | 10.0 |
| Info | int4 | 0 |
| GeometryCacheFile | bool | false |
| GroupToCache | int4 | no explicit default; one capability flag set |
| FBXSDKVersion | string | "FBX201400" |
| ExportOneClickMode | bool | false |
| ExportVisibilityAsShow | bool | false |
| (grid parameter) | grid | added after ExportVisibilityAsShow; addressed as `Grid` by the accessor |
| ExportShapeNamespace | bool | false |

`ImportFBXOptions` parameters, in definition order:

| Parameter | Type | Default |
|-----------|------|---------|
| UseMatrixFromBindPose | bool | false |
| LoadMode | int4 | 2 |
| Automatic | bool | true |
| FileScaleFactor | float | computed at definition time (Q5) |
| MasterScale | float | 1.0 |
| MasterUnitIndex | int4 | index of centimetres; one capability flag set |
| ImportCameras | bool | true |
| ImportLights | bool | true |
| ImportMaterialsAndTextures | bool | true |
| ImportAnimation | bool | true |
| ShowWarningDialog | bool | true |
| ResamplingRate | float | 30.0 |
| ConstantKeyReducer, KeyReducer, KeySync, KeysOnFrame, UnRoll, UnRollPath, Character | bool | not read (Q5) |
| KeyReducerPrecision, UnRollQuality | float | not read (Q5) |
| ImportSkelsAsNulls | bool | true |
| KeepXsiEffectors | bool | true |
| ImportSkins | bool | true |
| ForceWeightNormalize | bool | false |
| ProtectExpressionFCurve | bool | false |
| NameSpaceReplacement | string | not read (Q5) |
| ImportFilename | string | "" |
| Take | int4 | 1 |
| Info | int4 | 0 |
| (grid parameter) | grid | addressed as `Grid` |
| ImportHardEdges | bool | false |
| GeometryCacheFile | bool | true |
| ImportFrameRate | bool | false |
| ImportFillTimeline | bool | false |
| ImportOneClickMerge | bool | false |
| ImportMudboxMergeTexture | bool | false |
| ImportOneClickAdd | bool | false |
| ImportOneClickMode | bool | false |
| ImportNullsAsModels | bool | false |
| StripShapeNamespace | bool | false |
| UnbiasNormalMaps | bool | true |

### Get / set convention for option commands (B)

Every option command takes one argument with an **empty default** and has its
return value enabled.

- Argument empty (omitted, or its text form is the empty string): nothing is
  written; the command returns the current value of its parameter.
- Argument supplied: it is converted to the command's type, written to the
  parameter with `PutValue`, and the converted value is returned.

No option command validates its input, none reports an error, and all return
status OK. If the parameter cannot be resolved the write is silently skipped
and a read returns an empty value.

### Units (B, with FBX SDK public semantics)

The unit commands use the FBX SDK 2015.0 table of 9 predefined
`FbxSystemUnit` values, indexed 0..8, and compare the argument
case-insensitively against each unit's plural name as returned by the FBX SDK
(`GetScaleFactorAsString_Plurial`). The table and the names live in the FBX
SDK, not in this plug-in; their order was not read (Q2).

Reading the stored index: if it is outside 0..8 it is replaced by the index of
centimetres and written back before use.

## Wire contract

Common to all 40: language CPP, category empty, `key_assignable` true,
return value enabled, always enabled (no enable condition is registered).

### File commands

#### FBXExport (`FBXFileExport`)

- Purpose: export the scene (or selection, per options) to an FBX file.
- Arguments: `FilePathName` string, default `""`.
- Behaviour (B):
  1. `FilePathName` equal to `options` (case-insensitive): ensure
     `ExportFBXOptions` exists under the scene root, then stop with status OK.
     No return value is set and nothing is exported. No property page is
     opened by the command itself.
  2. `FilePathName` empty: show the file browser (see below) in **save** mode,
     title "Export FBX file" (passed through the `XSIXSI` translation
     dictionary), filter `FBX (*.fbx)|*.fbx||`. Cancel → return false, status OK.
  3. Run the exporter on the path. The exporter is created "quiet" when the
     application is not interactive **or** the caller supplied the path;
     it is non-quiet only when interactive and the path came from the browser.
- Return: bool. true when the run wrapper reports success; otherwise false
  **and** the command status is failure (`E_FAIL`, `0x80004005`).
- Side effects: writes the file; writes a log named `fbxxsi.log` (location Q6);
  may create `ExportFBXOptions`; may show the warning dialog (below).
- Golden: with a path, in batch → returns true and file exists; with
  `"options"` → `ExportFBXOptions` exists under scene root and no file written;
  bad path → false + command failure.

#### FBXImport (`FBXFileImport`)

- Arguments: `FilePathName` string `""`; `TakeNb` integer, default `-1`.
- Behaviour (B): same three steps as export with `ImportFBXOptions`, title
  "Import FBX file", browser in **open** mode with filter
  `FBX (*.fbx)|*.fbx|Autocad DXF (*.dxf)|*.dxf|Alias OBJ (*.obj)|*.obj|3D Studio 3DS (*.3ds)|*.3ds|Collada DAE (*.dae)|*.dae||`.
- Take: if `TakeNb` is empty the importer receives −1 (no explicit take);
  otherwise it receives `TakeNb − 1` (the argument is 1-based; it is read as a
  16-bit integer). Note the registered default −1 therefore reaches the
  importer as −2 (Q7).
- Return / errors: as export.
- Golden: import a file exported by FBXExport in the same session; returns
  true; scene content per `ImportFBXOptions.LoadMode`.

#### FBXInjectInOriginal (`FBXFileInjectInOriginal`)

- Purpose (from the registered description): `FBXInjectInOriginal <fbx file> <object>`.
- Arguments: `FilePathName` string `""`; `Objects` with the `Collection`
  argument handler (so a string list, a collection or, when omitted, the
  handler's default resolution).
- Behaviour (B): empty path → browser titled "Inject FBX file" in **save**
  mode with the FBX-only filter; cancel → false. Then an injector is run with
  the object list and with the output path set to the same file as the input.
  Quiet rule, return value and failure status as for export. There is no
  `options` keyword.

#### FBXInjectInCopy (`FBXFileInjectInCopy`)

- Arguments: `SourceFilePathName` string `""`; `Objects` (`Collection`
  handler); `OutputFilePathName` string `""`.
- Behaviour (B): empty source → browser "Inject source FBX file", **open**
  mode, multi-format filter. If that succeeded and the output is empty →
  browser "Inject output FBX file", **save** mode, FBX-only filter. Either
  cancel → false, status OK. Then the injector runs reading the source and
  writing the output. Return and failure as for export.

#### File browser (B)

`XSI.UIToolkit.FileBrowser` with `Filter`, `DialogTitle`, `InitialDirectory`,
`FileBaseName` = `""`, then `ShowOpen` or `ShowSave`. The result is
`FilePathName`; empty means cancelled. `InitialDirectory` is the directory of
the last file picked through this helper during the session (kept in memory,
shared by all four file commands), or the active project path if none yet.

#### After a run (B)

The run wrapper names the operation `Import`, `Export` or `Inject`, runs it,
and afterwards may show the plug-in's warning dialog (`FBXWarningDialogData`).
The dialog is shown when (the run is not quiet, or it is quiet and the
one-click option `ImportOneClickMode` / `ExportOneClickMode` is true) and the
corresponding option `ImportFBXOptions.ShowWarningDialog` /
`ExportFBXOptions.ExportShowWarningDialog` is true; inject has no such option
and uses only the first condition. (The "quiet" reading of the wrapper's flag
is inferred from how the flag is constructed; Q8.)

Worker result codes seen by the wrapper: `-1` success; `0xb`, `0xc` (adds the
file name to the notification), `0xd` (adds the take number) are failures;
`0xe` is mapped to success (meaning not attested; Q8).

### Information commands

| Command | Args | Return (B) |
|---------|------|------------|
| `FBXGetPluginVersion` | none | string `"2015.0"` |
| `FBXGetSDKVersion` | none | the integer 7400 converted to a string: `"7400"` |
| `FBXExportConvert2Tif` | none registered | nothing. Both Init and Execute are empty: no description, no arguments, no return value, no effect. Wire as an accepted no-op |

### Export option commands

All: one argument, empty default, get/set convention above, target property
`ExportFBXOptions`.

| Command | Arg | Type | Parameter | Default of parameter |
|---------|-----|------|-----------|----------------------|
| `FBXExportAscii` | State | bool | AsciiFBX | false |
| `FBXExportAutomaticUnit` | State | bool | Automatic | true |
| `FBXExportAnimation` | State | bool | ExportAnimation | true |
| `FBXExportCameras` | State | bool | ExportCameras | true |
| `FBXExportLights` | State | bool | ExportLights | true |
| `FBXExportSelection` | State | bool | ExportSelection | false |
| `FBXExportGeometries` | State | bool | ExportGeometry | true |
| `FBXExportSkins` | State | bool | ExportSkins | true |
| `FBXExportShapes` | State | bool | ExportShapes | true |
| `FBXExportHardEdges` | State | bool | ExportHardEdges | true |
| `FBXExportCacheFile` | State | bool | GeometryCacheFile | false |
| `FBXExportKeepXSIEffectors` | State | bool | ExportKeepXsiEffectors | false |
| `FBXExportDeformerAsSkeleton` | State | bool | ExportDeformerAsSkeleton | false |
| `FBXExportEmbedMedias` | State | bool | EmbedTextures | false |
| `FBXExportFrameRate` | Value | float (read as double) | ResamplingRate | 30.0 |
| `FBXExportUnit` | Unit | string | MasterUnitIndex (+ MasterScale) | centimetres |
| `FBXExportGroupAsCache` | Group | string | GroupToCache | unset |

Special cases (B):

- **FBXExportEmbedMedias**, set path only: after writing `EmbedTextures` it
  also updates one capability flag on `ConvertImageFormat` and on
  `ImageFormat` of the scene-root `ExportFBXOptions` (this is the PPG
  enable/disable of the image-conversion controls). Which flag and which
  polarity were not resolved (Q3). The stored values of those two parameters
  are not changed.
- **FBXExportUnit**, set path: find the unit whose plural name equals the
  argument (case-insensitive). If found, write its index to `MasterUnitIndex`
  and write `MasterScale` = the FBX SDK conversion factor from centimetres to
  that unit. If no unit matches, nothing is written and no error is raised.
  Both paths then return the plural name of the unit currently stored (after
  the 0..8 clamp), **not** the argument text.
- **FBXExportGroupAsCache**, set path: the argument is compared
  (case-insensitive) with the **full name** of every Group in the scene, in
  the order returned by `FindObjects` for the Group class id
  `{9D0673C2-6741-11d1-BE9F-00A024EE478D}`. The 0-based position of the match
  is written to `GroupToCache`; no match writes 0. The command returns the
  argument string as given. Get path: returns the stored parameter value
  converted to a string, i.e. the index, not a group name (exact text form Q4).
- `FBXExportScaleFactor` (already named in `src/`, not part of this batch) is
  read-only: it ignores its argument and returns `MasterScale`.

### Import option commands

All: one argument, empty default, get/set convention, target `ImportFBXOptions`.

| Command | Arg | Type | Parameter | Default of parameter |
|---------|-----|------|-----------|----------------------|
| `FBXImportAutomaticUnit` | State | bool | Automatic | true |
| `FBXImportAnimation` | State | bool | ImportAnimation | true |
| `FBXImportCameras` | State | bool | ImportCameras | true |
| `FBXImportLights` | State | bool | ImportLights | true |
| `FBXImportSetEnvelopes` | State | bool | ImportSkins | true |
| `FBXImportHardEdges` | State | bool | ImportHardEdges | false |
| `FBXImportCacheFile` | State | bool | GeometryCacheFile | true |
| `FBXImportFrameRate` | State | bool | ImportFrameRate | false |
| `FBXImportFillTimeline` | State | bool | ImportFillTimeline | false |
| `FBXImportSkeletonsAsNulls` | State | bool | ImportSkelsAsNulls | true |
| `FBXImportKeepXSIEffectors` | State | bool | KeepXsiEffectors | true |
| `FBXImportForceNormEnvelope` | State | bool | ForceWeightNormalize | false |
| `FBXImportProtectExprDrivenFC` | State | bool | ProtectExpressionFCurve | false |
| `FBXImportNamespaceReplacement` | Regex | string | NameSpaceReplacement | Q5 |
| `FBXImportUnit` | Unit | string | MasterUnitIndex (+ MasterScale) | centimetres |
| `FBXImportMode` | Mode | string | LoadMode | 2 |

Note `FBXImportFrameRate` is a **bool** switch (use the file's frame rate),
unlike `FBXExportFrameRate` which is a rate.

Special cases (B):

- **FBXImportUnit**, set path: same name match as export. If found, write the
  index to `MasterUnitIndex` and write `MasterScale` = FBX SDK conversion
  factor from a unit whose scale factor is the current `FileScaleFactor`
  (multiplier 1.0) to the chosen unit. Return is the plural name of the stored
  unit, as for export.
- **FBXImportMode**: `LoadMode` is an integer 0..3. Text ↔ value:

  | Value | Text returned on get | Texts accepted on set (case-insensitive) |
  |-------|----------------------|------------------------------------------|
  | 0 | `Update animation` | `Exclusive merge`, `Update animation` |
  | 1 | `Add and update animation` | `Merge`, `Add and update animation` |
  | 2 | `Add` | **any other non-empty text** |
  | 3 | `Import as Action Source` | `Import Action Only`, `Import as Action Source` |

  Set returns the argument text as given (not the canonical text). The
  registered description advertises `kExclusiveMerge | kMerge | kCreate`, but
  those three tokens are not in the accepted list, so each of them selects 2
  (`Add`). Wire the table, not the description.

### What a golden should check (suggested `si_fbx_cmds_dump.js`, XSIBATCH)

1. New scene: no `ExportFBXOptions` / `ImportFBXOptions` under the scene root.
   Call any getter → property now exists; dump all parameter values and
   compare with the default tables above (this also answers Q5).
2. For each bool command: get, set false, get, set true, get; compare with the
   mapped parameter read through `GetValue`.
3. `FBXImportMode` with each accepted text plus `kMerge` and `xyz`; record
   returned text and `LoadMode`.
4. `FBXExportUnit` / `FBXImportUnit` with the nine FBX plural names and one
   bad name; record return, `MasterUnitIndex`, `MasterScale` (answers Q2).
5. `FBXExportGroupAsCache` with two groups, a match and a miss (answers Q4).
6. `FBXGetPluginVersion`, `FBXGetSDKVersion`, `FBXExportConvert2Tif`.
7. `FBXExport` to a temp path, then `FBXImport` of it; record return values.

## Open questions

- **Q1** Public command reference pages for this family were not consulted
  (no local docs; online fetch unavailable in this run). Cross-check
  descriptions and any documented value lists next run.
- **Q2** Order and plural names of the 9 FBX SDK predefined units (expected
  from the public FBX SDK: millimetres, decimetres, centimetres, metres,
  kilometres, inches, feet, yards, miles in some order). Needs golden 4 or a
  read of the FBX SDK library.
- **Q3** Which `siCapabilities` flag the plug-in sets on `MasterUnitIndex`,
  `ConvertImageFormat`, `ImageFormat`, `GroupToCache`, and the flag and
  polarity changed by `FBXExportEmbedMedias`. The values were not recoverable
  from the pseudo-code; needs instruction-level reading or a parameter
  capability dump.
- **Q4** Text returned by `FBXExportGroupAsCache` on the get path (integer
  parameter converted to string).
- **Q5** Defaults of the import parameters marked "not read", and of
  `FileScaleFactor`.
- **Q6** Directory in which `fbxxsi.log` is written.
- **Q7** Effect of take index −2 (omitted `TakeNb` with its registered default)
  versus −1 in the importer.
- **Q8** Meaning of worker result codes `0xb`–`0xe`, and confirmation that the
  wrapper flag used for the warning dialog is the quiet flag.
- **Q9** The command flag changed by `SetFlag(…, false)` in the Init of the
  four file commands (value not recovered).
- PPG layout and `OnChanged` logic of `ExportFBXOptions`, `ImportFBXOptions`
  and `FBXWarningDialogData` are not specified here (new ledger row PROP-FBX).
