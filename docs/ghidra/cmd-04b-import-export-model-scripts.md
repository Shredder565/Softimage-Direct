# CMD-04b: import / export and model script commands

Row: **CMD-04b** (split from CMD-04 File, plus one uncategorised name). Status: **SPEC**.
Run: 2026-11-16, `si-analyst`, unattended.

13 script-implemented commands that sit in front of the file translators and
the referenced-model machinery. This note specifies the **command layer**
only: arguments, option properties, dialogs, and which lower-level command or
object-model call does the work and with which values. What the translators
write to or read from disk is SYS-03.

| Command | Display name | Implemented in | Procedure |
|---------|--------------|----------------|-----------|
| `ObjExport` | OBJ Export... / OBJ Export Proc | `Application\DSScripts\importexport.vbs` | `WavefrontExport` (dialog) and `WavefrontExportProc` (worker) |
| `SI_InspectWavefrontImportOptions` | Inspect OBJ-Import Options | same | `InspectWavefrontImportOptions` |
| `SetupDisplacement` | Setup Displacement | same | `SetupDisplacementProc` |
| `BiovisionImport` | Biovision Import... | same | `BiovisionImportSub` |
| `AcclaimImport` | Acclaim Import... | same | `AcclaimImportSub` |
| `ImportDotXSI` | Import .xsi | `Application\DSScripts\Model.vbs` | `ImportDotXSIProc` |
| `ExportDotXSI` | Export .xsi | same | `ExportDotXSIProc` |
| `ImportIges` | Import IGES FIle (sic) | same | `ImportIgesProc` |
| `CreateRefModel` | CreateRefModel | same | `CreateRefModelProc` |
| `CreateModelAndConvertToRef` | CreateModelAndConvertToRef | same | `CreateModelAndConvertToRefProc` |
| `ToggleReferencedModel` | ToggleReferencedModel | same | `ToggleReferencedModelProc` |
| `RemoveUnusedDeltas` | RemoveUnusedDeltas | same | `RemoveUnusedDeltas` |
| `SearchAndReplacePath` | Search And Replace Paths | `Application\DSScripts\Scene.vbs` | `GetInputAndReplacePathProc` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display name, scripting name, arguments, defaults, in/out flags, `return_value`, category, script procedure |
| (S) | `importexport.vbs` (25,075 bytes), `Model.vbs` (38,062 bytes), `Scene.vbs` (6,177 bytes), the procedures above and every helper they call, read in full from the install | steps, option properties built on the fly, messages, constants |
| (D) | `Application\Dictionary\en\XSISCRIPTS.dict`, `XSI_3DOBJECT2.dict` | translated titles and prompts |
| (P) | `data/spdl/spdl.json` (`BiovisionImport_{9B57DBD1-…}.spdl`, `AcclaimImport_{294D1664-…}.spdl`, `C3DdotXSIImportOpt.spdl`, `C3DdotXSIExportOpt.spdl`) | parameters, defaults and layouts of the SPDL-based option properties |
| - | REA / Ghidra | not used: every command in this batch is script-implemented. The C++ commands they call are listed under "Dependencies" |
| - | XSIBATCH goldens | not run |

No script text is reproduced. Names, defaults, labels, message ids and strings
are recorded as facts.

## Shared facts

### Translated strings (D)

| Dictionary | Id | Text | Used as |
|------------|---:|------|---------|
| `XSISCRIPTS` | 1078 | Wavefront OBJ Export | title of the OBJ export dialog |
| `XSISCRIPTS` | 1079 | Wavefront OBJ Import | title of the OBJ import dialog |
| `XSISCRIPTS` | 1080 | Biovision Import | title of the BVH dialog |
| `XSISCRIPTS` | 1081 | Acclaim Import | title of the Acclaim dialog |
| `XSISCRIPTS` | 1129 | Search and Replace | title of the search-and-replace dialog |
| `XSI_3DOBJECT2` | 10010 | This operation is destructive and not undoable. The file used by the referenced model will be overwritten. Do you want to proceed? | `ToggleReferencedModel` confirmation |

### Temporary option property pattern (S)

Five commands (`ObjExport` dialog form, `SI_InspectWavefrontImportOptions`,
`BiovisionImport`, `AcclaimImport`, `SearchAndReplacePath` without a search
string) share one pattern:

1. A property is added under the **scene root** (name in each contract).
2. It is inspected **modally** with a translated title.
3. Cancel: the property is deleted and the command ends with no other effect;
   in/out arguments keep the values they came in with.
4. OK: values are read from the property, the work is done, the in/out
   arguments are filled with the values actually used (so the logged command
   line shows them), and the property is deleted.

The property never survives the command. (inferred) In batch mode the modal
inspection fails like a cancel, so these dialog forms do nothing there.

### File browser used by the OBJ commands (S)

Title "Select a .OBJ file", initial directory the user path
(`siUserPath`), filter `Wavefront (*.obj)|*.obj|All Files (*.*)|*.*||`,
shown as a save browser for export and an open browser for import. The result
is the chosen full path, or empty when cancelled.

### Dependencies (commands these scripts call)

| Called | Kind | Called by |
|--------|------|-----------|
| `SIObjExport`, `ObjImport` | C++, `customcommands.dll` (TODO in CMD-01) | `ObjExport`; the File > Import > OBJ menu procedure |
| `BiovisionImport`, `AcclaimImport` (second registry entries, "… function", `simocaputils.dll`) | C++ | the script entries of the same name |
| `SIImportDotXSIFile`, `SIExportDotXSIFile`, `SIImportIges` | C++ | `ImportDotXSI`, `ExportDotXSI`, `ImportIges` |
| `CreateImportCrosswalkOptions`, `ImportCrosswalk` | C++, `dotXSIConverter.64.dll` (TODO in CMD-01) | `ImportDotXSI` |
| `SICreateRefModel`, `CreateEmptyRefModel`, `ConvertToRefModel`, `MakeModelLocal`, `CreateModel`, `GetMaster` | C++ / script | reference-model commands |
| `SelectChildNodes`, `SIFilter`, `SelectObj`, `AutoInspect`, `InspectObj`, `DeleteObj`, `MakeLocal`, `AddImageSource`, `AddImageClip`, `SetValue`, `GetValue`, `FindObjects`, `SIAddProp`, `SIAddCustomParameter` | existing | several |

## Wire contract

### `ObjExport`

Exports geometry objects to Wavefront `.obj` files, optionally one file per
object and / or per frame. The scripting name is registered **twice** with the
same 15 arguments: "OBJ Export..." shows the options dialog and then runs the
worker; "OBJ Export Proc" is the worker alone. Both: category File,
key-assignable, no return value, all arguments in/out.

| # | Argument | Default | Meaning |
|---|----------|---------|---------|
| 1 | `FileName` | `""` | output path; a trailing `.obj` is stripped before suffixes are added |
| 2 | `FilePerObject` | 0 | 0 = all objects in one file, 1 = one file per object |
| 3 | `FilePerFrame` | False | export a frame range |
| 4–6 | `StartFrame`, `EndFrame`, `StepFrame` | 1, 100, 1 | range used when `FilePerFrame` is true |
| 7–10 | `Polymsh`, `Surfmsh`, `Crvlist`, `Cloud` | True, False, False, False | which object types are kept |
| 11 | `CoordinateSystem` | True (registry); 0 in the dialog | 0 = global coordinates, 1 = local coordinates; passed through to `SIObjExport` |
| 12 | `Tesselation` | 0 | passed through ("Export Render Tesselation") |
| 13–15 | `Material`, `UV`, `UserNormal` | True, True, True | passed through |

**Worker ("OBJ Export Proc")**, observable steps:

1. Candidate objects: the current selection expanded to its child nodes; if
   that is empty, every object in the scene. The selection itself is not
   changed. The candidates are reduced to geometry objects, then to those whose
   type is `polymsh`, `surfmsh`, `crvlist` or `cloud` **and** whose matching
   flag (arguments 7–10) is true.
2. Nothing left: error log line `Nothing to export...`, end. Otherwise the
   list of kept objects is logged as an information line.
3. Base name = `FileName` with everything from the last `.obj` removed.
4. File name passed to `SIObjExport` (which adds its own extension):

   | `FilePerFrame` | `FilePerObject` | Calls | Name |
   |----------------|-----------------|-------|------|
   | false | 0 | one, all objects | `<base>` |
   | false | 1 | one per object | `<base>_<object full name>` |
   | true | 0 | one per frame, all objects | `<base>.<frame>` |
   | true | 1 | one per frame and object | `<base>_<object full name>.<frame>` |

5. With `FilePerFrame`, for each frame from `StartFrame` to `EndFrame` in
   steps of `StepFrame` the current frame (`PlayControl.Current`) is **set**
   to that frame before exporting. The current frame is not restored
   afterwards: it stays on the last exported frame.
6. Each `SIObjExport` call receives: objects, name, `CoordinateSystem`,
   `Tesselation`, `Material`, `UV`, `UserNormal`, in that order.

**Dialog form ("OBJ Export...")**: follows the temporary option property
pattern with a custom property named `Wavefront_Export`.

| Parameter | Type | Default | Range | Initially enabled | Label / control |
|-----------|------|---------|-------|-------------------|-----------------|
| `Filename` | string | `""` | | yes | file-path control, save mode, need not exist, initial directory `project`, filter `Wavefront OBJ Files (*.obj)|*.obj|All Files (*.*)|*.*||` |
| `FilePerObject` | int | 0 | 0..1 | yes | radio "Hierarchy": "Merge all objects into one file" 0, "Separate files per object" 1 |
| `FilePerFrame` | bool | false | | yes | "Separate Files Per Frame" |
| `StartFrame`, `EndFrame`, `StepFrame` | int | 0, 100, 1 | −100000..100000 | **no** | "Start", "End", "Step" on one row |
| `Polymsh` | bool | true | | yes | "Polygon Meshes" |
| `Surfmsh` | bool | false | | **no** | "Nurbs Meshes" |
| `Crvlist` | bool | false | | **no** | "Curve Lists" |
| `UserNormal` | bool | false | | yes | "User Normals" |
| `Cloud` | bool | false | | yes | not placed in the layout |
| `Tesselation` | bool | false | | **no** | "Export Render Tesselation" |
| `Material` | bool | true | | yes | "Export Material" |
| `uv` | bool | true | | yes | "Export Current UV Set" |
| `CoordinateSystem` | int | 0 | 0..1 | yes | combo "Vertices": "Global Coordinates" 0, "Local Coordinates" 1 |

None is animatable. Layout: tab "File Output" with group "File" (`Filename`,
`FilePerObject`) and group "Sequence" (`FilePerFrame`, then the three frame
fields); tab "Geometry Options" with group "Hierarchy" (a three-way radio
bound to a parameter `hrc` that this property does **not** have, items "No
Hierarchy" 0, "Null as Parent" 1, "Model as Parent" 2; (inferred) it draws
nothing or an inert control), group "Geometry" (`Polymsh` + `Surfmsh` on one
row, `UserNormal` + `Crvlist` on one row), group "Triangulation"
(`Tesselation`, `CoordinateSystem`), group "Material" (`Material`, `uv`).
Help topic `xsidocs.chm::/menubar14.htm`. Layout logic: when `FilePerFrame`
changes, the three frame fields are enabled exactly when it is true.

Dialog steps: create the property; set `StartFrame`, `EndFrame`, `StepFrame`
from `PlayControl.In`, `.Out`, `.Step`; set `Filename` from the incoming
`FileName`; inspect modally with title 1078. On OK, if `Filename` is empty the
save browser (shared facts) is shown, and an empty result ends the command
like a cancel. Then the worker runs with the property's values and all 15
arguments are written back from the property. Incoming arguments other than
`FileName` are ignored by the dialog form.

### `SI_InspectWavefrontImportOptions`

Shows the OBJ import options dialog and hands the choices back. It imports
nothing. Uncategorised, not key-assignable, no return value; 12 in/out
arguments.

| Argument | Registry default | Filled from property parameter |
|----------|------------------|--------------------------------|
| `FileName` | `""` | `Filename` (also the initial value shown) |
| `Group` | 0 | `Group` |
| `hrc` | 0 | `hrc` |
| `Material` | False | `Material` |
| `UV` | False | `uv` |
| `UVwrapping` | False | `uvWrapping` |
| `UserNormal` | False | `UserNormal` |
| `DisplImage` | `""` | `DisplImage` |
| `DisplDepth` | 0.5 | `DisplDepth` |
| `DisplFlipVert` | True | `DisplFlipVert` |
| `DisplViewDep` | False | `DisplViewDep` |
| `DisplSubDLevel` | 1 | `DisplSubDLevel` |

Temporary option property pattern with a custom property `Wavefront_Import`:

| Parameter | Type | Default | Range | Label / control |
|-----------|------|---------|-------|-----------------|
| `Filename` | string | `""` | | file-path control, open mode, must exist, initial directory `project`, same filter as export |
| `Group` | int | **1** | 0..1 | radio in group "Group": "Import as Clusters" 0, "Import as Objects" 1 |
| `hrc` | int | 0 | 0..2 | radio in group "Hierarchy": "No Hierarchy" 0, "Null as Parent" 1, "Model as Parent" 2 |
| `UserNormal` | bool | false | | "Import Normals as User Normals" |
| `Material` | bool | true | | group "Material": "Import Material" |
| `uv` | bool | true | | "Import UV" |
| `uvWrapping` | bool | true | | "UV wrapping" |
| `DisplImage` | string | `""` | | tab "Displacement Options": "Image", image file-path control, open mode, must exist |
| `DisplDepth` | float | 0.5 | 0..100 | "Alpha Depth Factor" |
| `DisplFlipVert` | bool | false | | "Flip Image Vertically" |
| `DisplViewDep` | bool | false | | "View Dependent Refinement" |
| `DisplSubDLevel` | int | 1 | 0..8 | "Subdivision level" |

The dialog always opens with the property defaults above, not with the
incoming argument values; only `FileName` is carried in. Help topic
`xsidocs.chm::/menubar10.htm`. Layout logic: when `Filename` changes, the
initial directory of the `DisplImage` browser becomes the folder of the chosen
file and the page is refreshed.

On OK with an empty `Filename` the open browser (shared facts) is shown; an
empty result ends like a cancel. Otherwise the 12 arguments are filled and the
property is deleted.

Caller (S): the File > Import > OBJ menu procedure in the same file turns
command logging off around this command (preference
`preferences.scripting.cmdlog`, restored afterwards if it was on), then, when
a file name came back, calls `ObjImport(FileName, Group, hrc, Material, UV,
UserNormal, UVwrapping)` and, when `DisplImage` is not empty,
`SetupDisplacement` on the objects `ObjImport` returned with the four
displacement values. Under the "Avid 3D" licence no dialog is shown: the open
browser result goes straight to `ObjImport(file, 1, 2, true, true, false)`.

### `SetupDisplacement`

Connects an image as displacement on each object and sets the geometry
approximation for fine displacement. Category File, no return value.

| Argument | Default | Meaning |
|----------|---------|---------|
| `InputObjs` | (collection, required) | objects to set up |
| `FileName` | `""` | image file |
| `DisplDepth` | 0.5 | total displacement depth D |
| `FlipVert` | True | flip the image vertically |
| `DisplViewDep` | True | view-dependent fine refinement |
| `DisplSubDLevel` | 1 | subdivision level |

For each object, in order:

1. The object's material is made local (`MakeLocal` on `<obj>.material`).
2. On that material's `displacement` parameter a shader
   `Softimage.sib_interp_linear.1` is connected; on that shader's `input` a
   shader `Softimage.txt2d-image-explicit.1` is connected.
3. On the linear-interpolation shader `newrange_min` = −D/2 and
   `newrange_max` = +D/2.
4. An image source and then an image clip are created from `FileName`, both
   named after the file's base name (no folder, no extension). A new source
   and clip are made for **every** object, even for the same file.
5. On the clip `ImageDefinitionType` is set to 0 (always), and `FlipY` to true
   when `FlipVert` is true.
6. The clip becomes the source of the image shader's `tex` parameter.
7. The object's geometry approximation is made local with default propagation
   (`MakeLocal <obj>.geomapprox, siDefaultPropagation`). On the property
   "Geometry Approximation": `gapproxmaxdisp` = D/2, `gapproxrdangdep` = 3
   (fine displacement), `gapproxrdfinevwdep` = true only when `DisplViewDep`
   is true (otherwise untouched), `gapproxmosl` = `gapproxmordrsl` =
   `DisplSubDLevel`.

Nothing is selected or inspected. An empty or invalid `FileName` is not
checked here; (inferred) the failure comes from the image source command.

### `BiovisionImport`

Shows the BVH import options and runs the C++ importer. Two registry entries
share the scripting name: this script entry ("Biovision Import...", category
File, key-assignable, all arguments in/out) and the C++ worker ("Biovision
Import function", `simocaputils.dll`, `FileName` input only). The script calls
the worker by the same name. No return value.

| Argument | Default |
|----------|---------|
| `FileName` | `""` |
| `InserMotion` (sic) | False |
| `NullsHierarchy` | False |
| `GaplessSkeleton` | False |
| `SI3DChains` | False |
| `GroupAnimObjs` | False |

Incoming argument values are **ignored**: the dialog always opens with the
property defaults. Temporary option property pattern with the SPDL property
type `BiovisionImport` (P), added as `Biovision_Import`, title 1080:

| Parameter | Type | Default | Label |
|-----------|------|---------|-------|
| `FileName` | string | `""` | File Name |
| `NullsHierarchy` | int | 0 | group "Skeleton Description Mode" (value only) |
| `GaplessSkeleton` | int | 0 | "Hierarchy", group "Bones Skeleton Options" |
| `SI3DChains` | int | 1 | "Chains", same group |
| `InsertMotion` | bool | true | Add motion action to Mixer |
| `GroupAnimObjs` | bool | true | Group Animated Objects |

Help topic `xsidocs.chm::/menubar18.htm`. On OK:

1. Empty `FileName`: an open browser titled "Select a .BVH file", initial
   directory the user path, filter `Biovision (*.bvh)|*.bvh|All Files
   (*.*)|*.*||`; an empty result ends like a cancel.
2. Two values are **inverted** on the way to the worker: gapless = true
   exactly when the `GaplessSkeleton` parameter is 0, SI|3D chains = true
   exactly when the `SI3DChains` parameter is 0. With the defaults that gives
   gapless true, SI|3D chains false.
3. The worker is called with: file, `InsertMotion`, `NullsHierarchy` (as
   boolean), gapless, SI|3D chains, `GroupAnimObjs`.
4. The six arguments are written back with those same six values.

### `AcclaimImport`

Same shape as `BiovisionImport` for Acclaim skeleton (ASF) + motion (AMC)
files. Script entry "Acclaim Import..." (File, key-assignable, all in/out) in
front of the C++ worker "Acclaim Import function" (`simocaputils.dll`). No
return value.

| Argument | Default | From property parameter |
|----------|---------|-------------------------|
| `SkeletonFileName` | `""` | `ASFFile` |
| `MotionFileName` | `""` | `AMCFile` |
| `CropMotionValuesToLimit` | False | `ApplyLimits` |
| `OverrideBoneLengthMultiplier` | False | `OverrideLength` |
| `BoneLengthMultiplier` | 1.0 | `LengthMultiplier` |
| `InserMotion` (sic) | False | `InsertMotion` |
| `NullsHierarchy` | False | `NullsHierarchy` |
| `GaplessSkeleton` | False | inverted `GaplessSkeleton` |
| `SI3DChains` | False | inverted `SI3DChains` |
| `GroupAnimObjs` | False | `GroupAnimObjs` |

SPDL property type `AcclaimImport` (P), added as `Acclaim_Import`, title 1081:

| Parameter | Type | Default | Label / group |
|-----------|------|---------|---------------|
| `FileDoc` | string | "Make sure that both the ASF and AMC files are compatible..." | group "File Input", value only (a static warning) |
| `ASFFile` | string | `""` | Skeleton File |
| `AMCFile` | string | `""` | Motion File |
| `NullsHierarchy` | int | 0 | group "Skeleton Description Mode" |
| `GaplessSkeleton` | int | 0 | "Hierarchy", group "Bones Skeleton Options" |
| `SI3DChains` | int | 1 | "Chains", same group |
| `ApplyLimits` | bool | false | "Crop Motion Values to Limits", group "Import Options" |
| `OverrideLength` | bool | false | Override Bone Length Multiplier |
| `LengthMultiplier` | double | 1.0, minimum 0.005 | Length Multiplier |
| `InsertMotion` | bool | true | Add motion action to Mixer |
| `GroupAnimObjs` | bool | true | Group Animated Objects |

Help topic `xsidocs.chm::/menubar17.htm`. On OK: an empty `ASFFile` opens a
browser titled "Select a .ASF file" (user path, filter `ASF (*.asf)|*.asf|All
Files (*.*)|*.*||`), empty result ends like a cancel. An empty `AMCFile` is
passed on as is (skeleton only). The same two inversions as `BiovisionImport`
apply. The worker gets the ten values in registry order and the ten arguments
are written back with them. Incoming argument values are ignored.

### `ImportDotXSI`

Imports a `.xsi` / Crosswalk file, choosing the legacy dotXSI importer or the
Crosswalk importer from the file. Category File, key-assignable, no return
value.

| Argument | Default | Meaning |
|----------|---------|---------|
| `FileName` | `""` | file to import |
| `Parent` | `""` | parent for the imported hierarchy, passed through |

Decision, in order:

| Condition | Action |
|-----------|--------|
| licence is "Avid 3D" | `SIImportDotXSIFile FileName, Parent`, no dialog |
| file does not exist | legacy path (below); the importer then reports the missing file |
| lower-cased `FileName` contains `.xml` or `.dae` anywhere | Crosswalk path |
| otherwise read the first text line: characters 5 to 8 are the format version (the dotXSI header is `xsi ` followed by a four-digit version); version ≥ 500 | Crosswalk path |
| version < 500 | legacy path |

Legacy path: the scene's `dotXSIImportOptions` property is inspected modally
with title ".xsi Import Options" (P: `anim_import` true, `classical_scaling`
true, `mat_import` true, `txt_import` true, `norm_import` false, `raw_fcurves`
false, hidden `import_path`; tab "Import"; help `menubar15.htm`). OK runs
`SIImportDotXSIFile FileName, Parent`; cancel does nothing.

Crosswalk path: **no dialog**. If the scene root already owns a property
named `ImportCrosswalkOptions` it is reused, otherwise
`CreateImportCrosswalkOptions` makes one. Its `Filename` parameter is set to
`FileName`, then `ImportCrosswalk <property>, Parent` runs. The property stays
in the scene.

A binary dotXSI file is still read as text for the version test; (inferred)
the same header position holds for binary files.

### `ExportDotXSI`

Exports models to a legacy dotXSI file. Category File, key-assignable, no
return value.

| Argument | Default | Meaning |
|----------|---------|---------|
| `Model` | (collection) empty | what to export |
| `FileName` | `""` | output file |

The scene's `dotXSIExportOptions` property is inspected modally with title
".xsi Export Options" (P: `output_file_format` 1 = Ascii / 0 = Binary,
`output_file_format_version` 300 / 350 / 360, default 300, and the geometry
filters listed in the SPDL). Cancel: nothing. OK: when `Model` is empty the
scene root is used instead; then `SIExportDotXSIFile <models>, FileName`.

### `ImportIges`

Imports an IGES file. Category File, key-assignable; registry `return_value`
false, result through the output argument.

| Argument | Flags | Meaning |
|----------|-------|---------|
| `FileName` | in/out, `""` | file |
| `Parent` | in, `""` | accepted but **not used** |
| `Value` | out | the imported object |

Calls `SIImportIges(FileName)` and takes its `Value` output. If an object came
back it is selected in branch mode and auto-inspected on its "General" page
(`AutoInspect <obj>, , , "General"`, so only when auto-inspect is on).

### `CreateRefModel`

Creates a referenced model, from a file or empty. Category File,
key-assignable, returns the model.

| Argument | Default | Meaning |
|----------|---------|---------|
| `FileName` | `""` | `.emdl` (or other source) file |
| `ModelName` | `""` | name of the new model |
| `ResolutionName` | `""` | name of the resolution created for the file |
| `Parent` | `""` | parent |
| `Activate` | True | make the new resolution active |
| `CreateFile` | False | passed to the file-backed creator |
| `ExternalCnxMappingTemplate` | `""` | connection mapping template |
| `ShareOptions` | 65535 | sharing bit mask (all on) |

- `FileName` not empty **and** the file exists on disk: `SICreateRefModel`
  with all eight arguments in order.
- Otherwise (empty name or missing file): `CreateEmptyRefModel` with the same
  arguments except `CreateFile`, which is dropped. The file name is still
  recorded on the resolution, so the model can be resolved later.
- If a model came back: select it in branch mode, auto-inspect its "General"
  page. Return the model (nothing when creation failed).

### `CreateModelAndConvertToRef`

Wraps objects in a new model and turns it into a referenced model. Category
File, key-assignable, registry says it returns a value; the procedure yields
none, so the result is empty.

| Argument | Default |
|----------|---------|
| `Objects` | (collection) selection |
| `FileName` | `""` |

Steps: `CreateModel Objects` (default name and parent; it leaves the new model
selected), then `ConvertToRefModel <first selected object>, FileName`. With an
empty `FileName`, `ConvertToRefModel` behaves as it does on its own
(same as `ConvertToRefModel`).

### `ToggleReferencedModel`

Switches each given model between referenced and local. Category File,
key-assignable; yields no value.

| Argument | Default | Meaning |
|----------|---------|---------|
| `Model` | (collection) selection | models, or objects inside models |
| `ShowWarnings` | True | ask before overwriting the reference file |

For each item, in order:

1. Resolve the model: a non-model item stands for the model that owns it; a
   model that is an **instance** (has a master) stands for the model that owns
   it; any other model stands for itself. An item with no owning model logs
   error `Object <item> is not a 3D object` and **stops the whole loop**.
2. The scene root: warning `Cannot toggle the active SceneRoot!`, next item.
3. Model currently referenced (`referenced_model` true): `MakeModelLocal
   <model>` with default arguments.
4. Model currently local:
   - `active_resolution` ≤ 0: error `You cannot toggle this model. It has not
     been a referenced model before.`
   - Otherwise take the `file` of the active entry under
     `<model>.resolutions` and look for the first of the model's external
     files whose path equals that file, either as stored or after
     `XSIUtils.ResolvePath`. No match: nothing happens, silently.
   - Match: with `ShowWarnings` a Yes / No message box, text 10010, caption
     `Toggling <model name>`; without it, Yes is assumed. On Yes:
     `ConvertToRefModel <model>, <resolved path of that external file>`
     (which overwrites the file). On No: nothing.

Only the first matching external file is considered per model. The procedure
also walks up through the owning models after each switch but takes no action
from that walk.

### `RemoveUnusedDeltas`

Deletes model deltas whose target model no longer exists. No arguments;
category File, key-assignable; yields no value.

1. All delta objects in the scene are collected with `FindObjects` on class id
   `{6D906778-A713-40E3-A5FB-0F5CA3361370}`.
2. For each, its `target` parameter (a model name) is looked up in the scene.
   If no object of that name exists the delta is deleted; a failing delete is
   ignored. Deltas with a live target are left alone.

Nothing is logged and the selection is unchanged.

### `SearchAndReplacePath`

Replaces a substring in the paths of the scene's external files. Category
File, not key-assignable, no return value.

| Argument | Default | Meaning |
|----------|---------|---------|
| `Category` | `"All"` | external file type to touch (for example `Pictures`), or all |
| `OldString` | `""` | text to find |
| `NewString` | `""` | replacement |
| `CaseSensitive` | False | binary compare when true, text compare otherwise |
| `Files` | none | list of external file entries; default is the whole project list |

**`OldString` not empty** (direct form):

1. File list = `Files` when given, otherwise the value of
   `Project.ExternalFilesList`.
2. An entry is processed when `Category` is exactly `All`, `all` or `ALL`, or
   equals the entry's file type (exact comparison).
3. Every occurrence of `OldString` in the entry's path is replaced by
   `NewString`. If the path changed, it is assigned back and an information
   line `Changing <old path> To <new path as stored>` is logged. Unchanged
   paths are neither written nor logged.

An empty `NewString` is allowed here (it removes the text).

**`OldString` empty** (dialog form): temporary option property pattern with a
custom parameter set `Search_And_Replace` under the scene root, title 1129.
The other incoming arguments are ignored.

| Parameter | Type | Label | Initial value |
|-----------|------|-------|---------------|
| `File_Category` | string | File Category | `All` |
| `Old_String` | string | Old String | `old string` |
| `New_String` | string | New String | `new string` |
| `Case_Sensitive` | bool | Case Sensitive | false |

On OK the values are checked in this order, each failure logging an error and
ending the command (property deleted):

| Empty value | Error text |
|-------------|------------|
| `File_Category` | Parameter Type Parameter is empty. script command not completed |
| `Old_String` | Parameter Old String is empty. script command not completed |
| `New_String` | Parameter New String is empty. script command not completed |

Otherwise the command calls **itself** in direct form with the four values and
the whole project list, so a second `SearchAndReplacePath` line is logged.
The property is deleted on every path, including cancel.

## Enable conditions and errors

All 13 are enabled in the registry with no enable condition. Errors raised by
the called C++ commands propagate unchanged except where a contract says a
failure is ignored (`RemoveUnusedDeltas`) or treated as cancel (modal
inspection).

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | `ObjExport` registry default `CoordinateSystem` = True versus the dialog's 0 / 1 enum: what does `SIObjExport` do with True (−1)? | read `SIObjExport` in `customcommands.dll` (CMD-01 TODO) |
| Q2 | Does the `hrc` radio on the export dialog draw at all, given the property has no such parameter? | interactive look, or PPG layout reading in `uiut` |
| Q3 | Combo items of `NullsHierarchy`, `GaplessSkeleton`, `SI3DChains` on the two mocap properties (the SPDL data in the repo holds no item lists) | re-parse the two SPDL files with their layout items; `simocaputils.dll` |
| Q4 | Batch-mode behaviour of the five dialog forms (assumed: modal inspect fails, treated as cancel) | XSIBATCH golden |
| Q5 | `CreateModelAndConvertToRef`: registry says a value is returned; the procedure produces none | XSIBATCH golden |
| Q6 | Behaviour of the C++ workers named under "Dependencies" that are not yet specified (`SIObjExport`, `ObjImport`, both mocap workers, `SIImportIges`, `SICreateRefModel`, `CreateEmptyRefModel`) | their own rows; file content is SYS-03 |
