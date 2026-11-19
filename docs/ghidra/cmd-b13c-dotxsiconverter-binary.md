# CMD-B13c: Crosswalk dotXSI/COLLADA converter plug-in commands, read from `dotXSIConverter.64.dll` (CreateExportCrosswalkOptions, CreateExportFTKOptions, CreateImportCrosswalkOptions, CreateImportFTKOptions, CrosswalkExportMatLib, CrosswalkImportMatLib, CrosswalkVersion, ExportCrosswalk, ExportFTK, ImportCrosswalk, ImportFTK)

Row: **CMD-B13c**. Status: **SPEC** (5 names: CreateExportCrosswalkOptions, CreateExportFTKOptions, CreateImportCrosswalkOptions, CreateImportFTKOptions, CrosswalkVersion), **SPEC-PARTIAL** (6 names: ExportCrosswalk, ExportFTK, ImportCrosswalk, ImportFTK, CrosswalkExportMatLib, CrosswalkImportMatLib - the dispatch, options and conversion phase order are read; the per-phase scene-to-file and file-to-scene converters of the bundled Crosswalk/FTK library were not).
Run: 2026-11-19, si-analyst worker, unattended, batch 13 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\Plugins\dotXSIConverter.64.dll` (PDB `dotXSIConverter.64.pdb`), image base `0x180000000`, 1439048 bytes,
sha256 `25f78fe83625167c7da53c9d90907b719b3b4c2c101247f2ce503f5e6792596c` (export-directory timestamp 1442479085 = 2015-09-17).
Method: `inspect_native_exports` (1960 named exports: the plug-in callbacks plus the statically linked Crosswalk SDK `CSL*`/`CdotXSI*`/`CCOLLADA*` classes), then Ghidra 12.1.4 decompilation of
`XSILoadPlugin`, every row `_Init`/`_Execute`, the FTK aliases, the converter-event handlers `CrosswalkExportCustomFile` / `CrosswalkImportCustomFile`, the version helpers `0x18005cf20` / `0x18005e1b0`,
`CrosswalkExport_Internal` / `CrosswalkImport_Internal` (read for option use and phase order only), the two option `_Define`s and the export layout helper `0x180054290` (for enum values).
A byte read of `0x18015700c..f` gave the static initial values of the version-gate flags. String searches gave the file-type labels and file-dialog filters.
Arguments cross-checked against `data/commands_full.json` (all 11 entries carry `file` = this DLL; names and defaults agree).
Statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

Display name = scripting name for every command (registered with identical name pairs).

| Command (scripting name) | Display name | _Init | _Execute | key helpers |
|---|---|---|---|---|
| `ExportCrosswalk` | ExportCrosswalk | `0x18006ac20` | `0x18006a5a0` | `0x18005e1b0` (event-path gate), `0x18005cf20` (app version), runs `ExportCustomFile`; `CrosswalkExportCustomFile` `0x18005f6a0`; `CrosswalkExport_Internal` `0x180061000` |
| `ExportFTK` | ExportFTK | `0x18006ac20` (same function as `ExportCrosswalk_Init`) | `0x18006ac00` (thunk to `ExportCrosswalk_Execute`) | as ExportCrosswalk |
| `ImportCrosswalk` | ImportCrosswalk | `0x18006c0f0` | `0x18006bb50` | runs `ImportCustomFile`; `CrosswalkImportCustomFile` `0x180062770`; `CrosswalkImport_Internal` `0x180063f30` |
| `ImportFTK` | ImportFTK | `0x18006c2c0` (thunk to `ImportCrosswalk_Init`) | `0x18006c2a0` (thunk to `ImportCrosswalk_Execute`) | as ImportCrosswalk |
| `CreateExportCrosswalkOptions` | CreateExportCrosswalkOptions | `0x18005e7a0` | `0x18005e4a0` | - |
| `CreateExportFTKOptions` | CreateExportFTKOptions | `0x18005ec20` | `0x18005e920` | - |
| `CreateImportCrosswalkOptions` | CreateImportCrosswalkOptions | `0x18005f0a0` | `0x18005eda0` | - |
| `CreateImportFTKOptions` | CreateImportFTKOptions | `0x18005f520` | `0x18005f220` | - |
| `CrosswalkExportMatLib` | CrosswalkExportMatLib | `0x180060de0` | `0x180060400` | Crosswalk exporter object `0x18004bca0`, write `0x18004edc0` / `0x180050910` |
| `CrosswalkImportMatLib` | CrosswalkImportMatLib | `0x180063db0` | `0x180063150` | read `0x18004fd70`, convert `0x18004f0c0` |
| `CrosswalkVersion` | CrosswalkVersion | `0x180066970` | `0x1800668b0` | - |

## 2. Shared facts

### 2.1 Plug-in registration (`XSILoadPlugin` `0x18006d0f0`)

- Author `Softimage`; name `Crosswalk dotXSI/COLLADA Plug-in`; version parsed from the literal `2015.0` (major 2015, minor 0).
- Menus (all anchor `0x3f7`, non-dynamic): `Import`, `Separator`, `Export`, `ExportMax`, `ExportMaya`.
- Commands in order: `ExportCrosswalk`, `ImportCrosswalk`, `CreateExportCrosswalkOptions`, `CreateImportCrosswalkOptions`, `CrosswalkVersion`, then (after the converter events) `CrosswalkExportMatLib`, `CrosswalkImportMatLib`, `ExportFTK`, `ImportFTK`, `CreateExportFTKOptions`, `CreateImportFTKOptions`. All 11 row names are registered in this DLL.
- Properties: `ExportCrosswalkOptions`, `ImportCrosswalkOptions`, `ExportFTKOptions`, `ImportFTKOptions`, `ExportdotXSI5Options`, `ImportdotXSI5Options` (the last two have no exported `_Define` in this DLL; they are registered names only).
- Converter events, only when the event-path gate (2.2) is on: export event `0x20510027` for extensions `DAE` (`CrosswalkExportCustomFileDAE`), `XML`, `XSI`; import event `0x20510026` for `DAE`, `XML`, `XSI`, `XSIML`. All export handlers alias `CrosswalkExportCustomFile`; all import handlers alias `CrosswalkImportCustomFile`.

### 2.2 Version gate (`0x18005e1b0`, `0x18005cf20`)

`0x18005cf20` splits `Application.Version` on "." and, when it has exactly 4 fields, parses them as floats (major, minor, build, sub). `0x18005e1b0` decides whether the "converter event" path is used; the flag starts true (static byte 1). It is turned off only for application major < 7, and for 7.0.x / 7.1.x with sub 0; it stays on for 7.5.0 and for every major > 7. So on Softimage 2015 (major 13) the event path is used: `ExportCrosswalk` / `ImportCrosswalk` run `ExportCustomFile` / `ImportCustomFile`, which fire the registered converter events, which in turn run the internal converter. With the gate off they call the internal converter directly.

The same version tuple selects the argument layout passed to `ExportCustomFile` / `ImportCustomFile`: "old" layout for 7.x builds older than 7.5 / build 718 sub ≤ 1028 (inferred reading of the comparison), "new" layout otherwise (2015 uses the new layout).

### 2.3 `ExportCrosswalkOptions` / `ExportFTKOptions` (`_Define` `0x180066a30`; FTK `_Define` `0x18006abc0` calls the same function)

All parameters capability 4 (persistable) unless noted. Script name = parameter name except `ShapeAnim`.

| Parameter | Type | Value set at creation | Notes |
|---|---|---|---|
| `Filename` | string | last used import/export file name if any this session, else `<active project>\dotXSI\` | |
| `Format` | uint4 (a string `Format` is attempted first, see 4) | 0 | enum: 0 `.XSI 5.0 (text)`, 2 `.XSI 5.0 (binary)`, 1 `COLLADA 1.4.1`, 3 `.XSI 6.0 (text)`, 4 `.XSI 6.0 (binary)` (combo "Crosswalk File Type") |
| `Verbose` | bool | true | |
| `ExportXSIExtra` | bool | true | shown only for COLLADA ("Export XSI Extra") |
| `ExportSelectionOnly` | bool | false | "Selection Only" |
| `ExportMaterials` | bool | true | |
| `ExportImageClips` | bool | true | |
| `ExportUsedMaterialsAndImagesOnly` | bool | true | |
| `ExportGeometries` | bool | true | "Polygon Meshes (Nulls exported when off)" |
| `ApplySubdivisionToGeometry` | bool | false | |
| `Triangulate` | bool | false | "Convert Meshes To Triangles" |
| `ExportTangentsAsVtxColor` | bool | false | |
| `ShapeAnim` (description `Shapes`) | uint4 | 1 | enum: 1 `Export Shapes`, 0 `Plot all deformations` |
| `PlotAnimation` | bool | false | "Plot All Animation" |
| `PlotNonFCurveActionSources` | bool | false | |
| `PlotStartFrame` | int4 | `Play Control.In` of the active project (1 if not found), truncated to int | one extra capability flag set (unresolved) |
| `PlotEndFrame` | int4 | `Play Control.Out` (100 if not found) | same |
| `PlotStepFrame` | float | 1.0 | same |
| `PlotInterpolation` | int1 | 0 | enum: 0 Use Existing FCurve Interpolation, 1 Constant, 2 Linear, 3 Cubic |
| `PlotFit` | bool | true | "Filter keys" |
| `PlotFitTolerance` | float | 1.0 | "% Tolerance" |
| `PlotProcessRotation` | bool | true | "Make rotations continuous" |
| `ExportXSINormals` | bool | false | |
| `PreserveIK` | bool | false | "Preserve IK Chains" |
| `Target` | uint4 (a string `Target` is attempted first) | 0 | enum: 0 Softimage to Max, 1 Softimage to Maya, 2 Softimage to Softimage, 3 Custom |
| `InfoGrid` | grid | filled by `0x1800582f0` (export flavour) | target capability table (columns "200:50:290" or "200:50:50:290") |
| `PathRelative` | bool | true | "Keep Referenced Paths Relative" |
| `ExportAllActionSources` | bool | true | |
| `Models` | string | "" | extra capability flag set |
| `ActionSourceExportTable` | grid | empty | extra capability flag set |
| `MatLib_ExportUsedImageClipsOnly` | bool | false | |

Layout (helper `0x180054290`): tabs/groups "Crosswalk" (version text `2015.0`, button `CheckForUpdates` "Check For Updates"), "Crosswalk File Type" (`Format` combo), "Export" (`Filename` file widget whose filter is `dotXSI format (*.xsi)|*.xsi|COLLADA  (*.dae *.xml)|*.dae:*.xml|All Files (*.*)|*.*||`, COLLADA first when `Format` = 1), "Export Options", "Exported Data", "Exported Polygon Mesh Data", "Animation" (Shapes, "Animation Plotting", "Timeline Animation Plotting Range", "Animation Resampling"), "Action Sources" (`RefreshActionSources` "Refresh", `ResetActionSources` "Reset All"), "Info" (`Target` combo, `InfoGrid`); help `<FactoryPath>/Doc/<DocLangPref>/xsidocs.chm::/menubar20.htm`.

### 2.4 `ImportCrosswalkOptions` / `ImportFTKOptions` (`_Define` `0x18006b080`; FTK `0x18006c260` calls it)

| Parameter | Type | Value | Notes |
|---|---|---|---|
| `Filename` | string | last used file name, else `<active project>\dotXSI\` | |
| `Verbose` | bool | true | |
| `OptimizeForXSI` | bool | true | |
| `ImportTimelineSettings` | bool | default 1 (true) | |
| `Target` | uint4 (string attempted first) | 0 | |
| `InfoGrid` | grid | filled by `0x1800582f0` (import flavour) | |

Import dialog filter: `All Supported Files (*.xsi *.dae *.xml *.xsiml)|...|dotXSI format (*.xsi)|*.xsi|COLLADA  (*.dae *.xml)|*.dae:*.xml|Material Library (*.xsiml)|*.xsiml|All Files (*.*)|*.*||`.

### 2.5 Internal converters (format facts)

- File formats: dotXSI 5.0 or 6.0, text or binary (`.xsi`); COLLADA 1.4.1 (`.dae` or `.xml`); material library (`.xsiml`, import only through the event). `.XSI 5.0, 6.0, COLLADA (.dae) 1.4.x, .XSIML` is the import description string.
- Export (`CrosswalkExport_Internal`): reads its option property from the `Arguments` (gate off) or `UserData` (event path) context attribute; reads `Verbose`, `Format`, `ExportMaterials`, `ExportImageClips`, `ExportUsedMaterialsAndImagesOnly`, `ExportGeometries`, `ExportAnimation`, `PreserveIK`, `PlotAnimation` and more; runs phases in this order (progress texts): Set version, Converting scene info, Converting environment, Converting environment animations, Converting image clips, Converting image clip animations, Converting materials, Converting material animations, Filtering pass, Converting hierarchy - first pass, (hierarchy / primitive / envelope / IK / shape converters), Converting mixers, Writing file, Export completed. Failures of a phase are reported through `0x180051330` with status `0x80004005`.
- Import (`CrosswalkImport_Internal`): takes `Filename`; treats the file as COLLADA when its extension (after the last ".") contains `dae`/`DAE`/`xml`/`XML`, else dotXSI; remembers the file name for the next options property; reads `Verbose`, `OptimizeForXSI`; phases: Reading file, Converting scene info, Converting environment, Converting environment animation, Converting image clips, Converting image clip animation, Converting materials, Converting material animation, Converting hierarchies and primitives, Resolving instances, Converting hierarchy node data and animation, Import completed. When `ImportTimelineSettings` is on, the file's frame format/rate are applied to `PlayControl.Format` / `PlayControl.Rate`; otherwise the current values are kept (read before, restored after). Errors include "The FTK has raised an exception while attempting to read the file" and "Invalid COLLADA file. Import aborted.".

## 3. Contracts

### `CreateExportCrosswalkOptions`: SPEC
Wire contract:
- Args: `arg0` default "" (object path), `arg1` default `ExportCrosswalkOptions` (property name).
- Return: the new property (an invalid/empty reference when not created).
- Steps: if `arg1` is empty it is treated as `ExportCrosswalkOptions`. If `arg0` is empty, add an `ExportCrosswalkOptions` property to the active scene root; otherwise resolve `arg0` as an object path and, if it is a valid 3D object, add the property to it (an unresolvable path creates nothing and still returns success). If a property was created, rename it to the name argument (inferred: the decompiler's rename argument is the property-name argument). Parameters per 2.3.
- Errors: none; always returns success.

### `CreateExportFTKOptions`: SPEC
Same as `CreateExportCrosswalkOptions` with property type `ExportFTKOptions` and default name `ExportFTKOptions` (same parameter set, 2.3).

### `CreateImportCrosswalkOptions`: SPEC
Same as `CreateExportCrosswalkOptions` with property type and default name `ImportCrosswalkOptions` (parameters 2.4).

### `CreateImportFTKOptions`: SPEC
Same with `ImportFTKOptions` (parameters 2.4).

### `CrosswalkVersion`: SPEC
Wire contract: no args; returns the string `2015.0`. No side effects.

### `ExportCrosswalk`: SPEC-PARTIAL (file writers unread)
Wire contract:
- Args: `arg0` default "" (path of an `ExportCrosswalkOptions`/`ExportFTKOptions` property).
- Return: none set by this handler (return value enabled).
- Steps (event path, 2.2):
  1. Resolve `arg0` as a property; invalid: log "Invalid export properties: <" + arg + ">" (closing ">" inferred), return `0x80070057`.
  2. Read `Filename` and `Format`. For formats 0, 2, 3, 4 append `.xsi` unless the name already ends in `.xsi` (case-insensitive). For format 1 append `.dae` unless it ends in `.dae` or `.xml`. Other values: name kept.
  3. Runs `ExportCustomFile(filename, <empty>, <original argument array>)` (old 7.x layout inserts one more empty argument). Status of that command is returned.
  4. The export converter event (`CrosswalkExportCustomFile`): if the event's `FileType` attribute is 2 it delegates to `CrosswalkExportCustomFileFromModel` (unread). Otherwise it pre-processes `UserData` (`CrosswalkPreProcessUserDataOnExport`, unread), resolves the options property from `UserData[0]`, and if `ExportSelectionOnly` is on and the event `Target` is a list (type `0x29b`) whose items are not exactly the selection, it saves the selection, selects the target items, exports, then restores the original selection; then runs the internal exporter (2.5).
- Gate off: calls the internal exporter directly with the command arguments.
- SPEC-PARTIAL: the dotXSI/COLLADA scene converters and writers are only named by phase.

### `ExportFTK`: SPEC-PARTIAL
Same as `ExportCrosswalk` (the `_Init` is the same function and the `_Execute` calls `ExportCrosswalk_Execute`). Normally given an `ExportFTKOptions` property.

### `ImportCrosswalk`: SPEC-PARTIAL (file readers unread)
Wire contract:
- Args: `ppg` default "" (path of an `ImportCrosswalkOptions`/`ImportFTKOptions` property), `parent` (no default; parent object for the import).
- Return: none set.
- Steps (event path): resolve `ppg` as a property; invalid: log "Invalid import properties: <" + arg + ">", return `0x80070057`. Runs `ImportCustomFile(Filename, parent full name, 0, <empty>, <empty>, <original argument array>)` (old 7.x layout drops one empty slot). The import event (`CrosswalkImportCustomFile`): `FileType` 2 delegates to `CrosswalkImportCustomFileFromModel` (unread); otherwise pre-processes `UserData` (`CrosswalkPreProcessUserDataOnImport`, unread) and on success runs the internal importer (2.5).
- Gate off: internal importer directly.

### `ImportFTK`: SPEC-PARTIAL
Same as `ImportCrosswalk` (both `_Init` and `_Execute` are thunks to the Crosswalk ones).

### `CrosswalkExportMatLib`: SPEC-PARTIAL (writer unread)
Wire contract:
- Args: `Filename` default "", `MatLib` default "", `Binary` default false, `ExportUsedImageClipsOnly` default true.
- Return: none set.
- Steps:
  1. Adds a temporary `ExportCrosswalkOptions` property to the scene root; sets `Filename`; sets `Format` = 4 (`.XSI 6.0 (binary)`) when `Binary`, else 3 (`.XSI 6.0 (text)`); sets `MatLib_ExportUsedImageClipsOnly` = `ExportUsedImageClipsOnly`. (No `.xsi` extension is forced on this path.)
  2. Looks up the scene material library by name `MatLib`. Not found: deletes the temporary property, logs "Invalid material library: <" + name + ">", returns `0x80070057`.
  3. Exports only that library: verbose on, phases Set version, Converting scene info, environment, image clips (+ animations), materials (+ animations), Writing file, Export completed.
  4. Deletes the temporary property (runs `DeleteObj`) and returns the converter status.

### `CrosswalkImportMatLib`: SPEC-PARTIAL (reader unread)
Wire contract:
- Args: `Filename` default "", `MatLib` default "".
- Return: none set.
- Steps: adds a temporary `ImportCrosswalkOptions` property to the scene root with `Filename` and `ImportTimelineSettings` = false; looks up the scene material library named `MatLib` and hands it to the importer as the destination (not validated; behaviour with no such library unread); passes the command arguments as originator info; verbose off; phases Reading file, Converting scene info, image clips (+ animation), materials (+ animation), material-library pass, Import completed. Saves `PlayControl.Format` and `PlayControl.Rate` before and writes them back after (timeline unchanged). Deletes the temporary property; returns the converter status.

## 4. Open questions

- `Format` and `Target` are each added twice in `ExportCrosswalkOptions_Define` (first as string, then as uint4); presumably the second add is the one that sticks or the first fails on the duplicate name. The decompiler also leaves it unclear which parameter some `PutValue` calls land on (for example the `Filename` path value); the table follows the evident intent.
- Which capability flag is set on `PlotStartFrame` / `PlotEndFrame` / `PlotStepFrame` / `Models` / `ActionSourceExportTable` was not resolved.
- `CrosswalkExportCustomFileFromModel`, `CrosswalkImportCustomFileFromModel` (FileType 2, model import/export) and the user-data pre-processors were not decompiled.
- The CSL phase converters (hierarchy, primitives, envelopes, shapes, mixers) and the dotXSI/COLLADA writers/readers were not read; record layouts of `.xsi`/`.dae` are not described here.
- The menus `Import`, `Export`, `ExportMax`, `ExportMaya`, `Separator` and the PPG event handlers (`CheckForUpdates`, action-source buttons) are outside this row.
- `ExportdotXSI5Options` / `ImportdotXSI5Options` are registered without `_Define` exports in this DLL; their definition source is unknown.
