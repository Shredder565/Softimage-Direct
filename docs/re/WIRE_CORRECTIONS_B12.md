# Wire corrections from analyst batch 12 (2026-11-19)

Answers to the "Questions for the analyst" of wire PR #183, read from `tasks.dll` and
`action.dll` (REA + Ghidra). Each item says where the wired (inferred) behaviour is wrong or
now confirmed. Full answers, with attestation, are in the "Batch 12 answers" sections of the
`docs/ghidra/cmd-b11*.md` notes. No XSIBATCH golden.

## Promoted to SPEC this run (14)

`SetReferencePlane`, `SaveSceneAs`, `SICreateRefPlane`, `CollapseOp`,
`CacheObjectsIntoFile_Private` (per-sample writer still inferred), `CreateConnectionMap`,
`CreateValueMap`, `GetStoreActionDefaults`, `AddPoseActionItems`, `FreezeLipSync`,
`CreateShapeGroup`, `ResetOffset`, `CutClipInSpace`, `PlotCamSeqShape`.

## B11a (`tasks.dll`)

- `FindObjects`: the skip rule is "the owning model's flag parameter has bit 0x8 set", not
  "referenced model". `Type` must be a class-id string (no class-name lookup); a failed
  conversion returns 1 (S_FALSE) and writes no list. 0x3eb is an error code raised with
  severity 2 and a literal text, not a dictionary id.
- `SetCurrentParType`: `Type` values outside 0..3 are not rejected when the arguments are
  read; Do returns 0x8000FFFF and changes nothing. Only Type 0 (passes) fires the two change
  events; Type 2 sets the object current in a sub-container of the scene content container
  (class `a15b3913`, environment class `(inferred)`), with no pass events.
- Cache path templates 0..4 confirmed (`simulation.cachetemplate{projectpath, localpath,
  patha, pathb, pathc}`, order inferred from string order); PathID 5 = `AlternativePath`;
  PathID ≥ 6 fails with 0x80070057. `ResolvedPath` joins per-object names with `,` (no
  trailing comma). `CacheObjectsIntoFile_Private` honours a per-object samples-per-frame
  setting (default 1).
- `CollapseOp`: per-point offsets = operator output − last input; silent stop when point
  counts differ; offsets rotated into local frames when `Relative`; a point cluster and a
  shape key named `Offsets` are created (mode 1 Relative, 2 otherwise), then connected through
  a shape combiner and the operator removed `(inferred)`.
- `SetDefaultKeyMap`: writes preference `Interaction.defaultkeymap`; an unknown name gives no
  error.
- `FilterPSet` bits 1/2/4: **not attested**; `tasks.dll` only ANDs `Relationship` with a
  property parameter. Keep marked inferred. `ReorderSceneItem` MoveAction numbering: neither
  confirmed nor contradicted (only 1 and 2 use `Marker`, consistent with the guess).

## B11b / B11d (`tasks.dll`)

- `UpdateExternalReference`: a path-count mismatch returns 1 with no change (not 0x80070057);
  a resolution count of 0 is success with no change; message 0x42f + success-with-no-change
  happens when the sub-object **is** found (earlier note was inverted); an S_FALSE path lookup
  counts as invalid.
- `SetReferencePlane`: element kinds 2 object, 6 component, 7 component through a
  cluster-style sub-element; other kinds return 1 with no change. U = X, V = Z confirmed, but
  values are **half** extents with a minimum of 2.0. NULL target or no plane property →
  0x80070057.
- `GetCurvePercentageAtKnotIndex`: knot index runs across all sub-curves; out of range leaves
  the output at 0.0. Percentage passed through unscaled.
- `NavigateNode`: 3 = next / 4 = previous confirmed. Below the root a leaf Source steps to the
  next / previous leaf; a Source with children steps to the next / previous element at the same
  depth (not plain sibling order). NavLoop wraps over the whole tree. Flag 0x8 repeats the step.
  At the root the step walks nested sub-hierarchies and applies NavFilter / NavSubFilter.
- `Tag` / `Untag`: message 1069 (0x42d) is severity 4; level stored as 16 bits. Lock-info
  record = component id, lock level (16 bit), tag level (16 bit), lock type; tag records use
  type 2 with lock level 0.
- `MoveToFolder`: one membership call on the folder; NULL folder returns 1. Whether items leave
  their old folder is decided outside `tasks.dll` (still open).

## B11c (`tasks.dll`)

1. `SaveSceneAs` with an empty `SceneFileName` saves to the current scene path; the
   normalised name is written back into the argument.
2. `CopyExtFiles` 1 and 2 both run `CopyExtFilesIntoProject` (`Models` "",
   `UpdateSourcePaths` true); 2 also sets `ConsiderOnlyFilesUnderProject`. NULL path →
   0x80004003, mode 0 → 0x80070057.
3. `GetUserPref`: the remapped name is used for the CPM fallback too, which also runs on
   S_FALSE.
4. `InspectExternalReference`: joins names with "," (no space); holder order expression →
   nested operator → operator port.
5. `SICreateRefPlane`: container `C3DRefPlaneFolder`, class `C3DReferencePlane`; apply the
   `SetReferencePlane` behaviour once per created plane.
6. `EvaluateCurveAt`: `Value` is 0..1 when `Local`, an arc length (divided by total length)
   otherwise; never 0..100. Result always global.
7. `SILoadPreset` appends `.Preset` when the name has no extension; falls back to
   `SIFindPresetPath` when the file does not exist.
8. `InspectBrowse` modes 3 and 4 ignore `Length`. `siPresetLocation` 0 default, 1 factory,
   2 user, 3 workgroup, 4 project (0 and 1 both the factory path): wire numbering correct.

## B11e (`action.dll`)

- `CreateConnectionMap`: rule From = the **Obj2** object, To = the **Obj1** object (reversed
  from the earlier note). Unequal lists: silent success, no output. Collectors list the model
  first, then all descendants depth first.
- `CreateValueMap`: unequal lists fail with 0x8000FFFF; difference = Obj1 − Obj2; From =
  `<Obj1 object>.<channel>`, To = `this + %lf`; global channels before local.
  `UseNames`: the Obj1 partner is the first object whose full name **contains** the
  (remapped) Obj2 name; no partner → no rule.
- `GetMappingRule`: returns 1 (S_FALSE) on success too; past the end returns 1 with no
  outputs. `SetMappingRule` clamps to the rule count. Only NULL strings are rejected
  (0x80004003). New rules keep the template default flags.
- `GetStoreActionDefaults`: mask bits 1 static values, 2 fcurves, 4 expressions, 8
  constraints / driving operators (3 items each in query mode). From / To = union of stored
  fcurve key ranges, else scene span when expression / constraint stored, 1 / 5 when only
  static values, 0 / 0 when nothing.
- `AddPoseActionItems`: suffixes `.kine.local.{scl,rot,pos}{x,y,z}` confirmed; sources that
  already have pose items are skipped silently; items are added, then values written.
- `LoadActionPreset`: folder + `\` (only if missing) + file; case-insensitive extension test;
  `.eani` fires post-load event 0x20510016.

## B11f / B11g (`action.dll`)

- `CutClipInSpace` = duplicate the source, AddTrack (animation track at the end), then
  CopyClipToTrack with the duplicate at the clip start. Not "copy source + add clip".
- `FreezeLipSync`: deletes an existing fcurve (DeleteObj flag 0x10), creates a new one that the
  speech item fills, then AddFCurve connects it; the source is deleted only if at least one item
  was frozen. Not "one key".
- `CreateShapeGroup`: empty `Name` sets no name; all keys must be shape keys of one owner
  (0x80070057), a key without owner 0x80004003; a taken name is made unique.
- `ResetOffset`: SaveKey on the item offset at `Time` with value 0 (confirmed).
- `StoreViseme`: capability bit 0x2 also needs the attribute 0x10 override check.
- Item kind 0x1a = speech channels: confirmed.
- Evolver mapping file: XML, root `PhonemeVisemeMappingProfile`, `Phoneme` entries with hex
  `Unicode`, `FonixCode` (appended as `_` + text), `PhonemeType` 0..2 (clamped), `Shape` with
  `name` / `weight`. Load failure 0x80004005, missing profile 0x8000FFFF.
- `PlotCamSeqShape`: empty `InputObjs` re-plots every object already driven by a
  `C3DShapeActionClip` (old clips marked for deletion); default name `SQ_PlotShape`; source on a
  new `C3DShapeActionTrack`, compound at frame 1; with `ApplyKeys`, one clip per key from
  `StartFrame` in 1-frame steps, then StripDeformOperators.

## Still open (not answerable from these DLLs)

`SIMatchSubComponent` test (`mohelper.dll`), `siPSetRelationship` values, `DumpCacheHeader`
XML (`mohelper.dll`), XSITASKS 0x42f / 0x128 / 1069 and XSIACTION2 0x445 / 0x446 texts
(dictionary not in the repo), EnumElements Capabilities, `TestPluginHost` DLL, knot count
semantics (geometry DLL), registry flag 0x80, MoveComponent / TranslatePivot
(`viewinteraction.dll`), vm.dll items of B11h.
