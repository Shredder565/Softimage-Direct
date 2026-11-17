# CMD-B6a: `uixsiscripts.vbs` commands, part a (material inspect / store properties, containers, key saving, unused source / clip / material deletion, MergeScene, Align, ApplyPath, CreateCurve, AssembleNurbsMesh, AddComponentTool, OffsetValueMap, ToggleContinuousDraw)

Row: **CMD-B6a** (batch grouped by implementing script). Status: **SPEC** (25 names). `SaveKeyOnMarkedKeyable` was SPEC-PARTIAL until 2026-11-17; Q1 is closed by [cmd-b8a-fcurve-keys-binary.md](./cmd-b8a-fcurve-keys-binary.md) (registry hidden argument `MarkedOnly`, default `True` for `SaveKeyOnMarkedKeyable` and `False` for `SaveKeyOnKeyable`; native contract and the `mohelper.dll` keyable / marked helper).
Run: 2026-11-17, `si-analyst`, unattended.

25 scripting names (28 script registry entries) implemented in VBScript in
`Application\DSScripts\uixsiscripts.vbs`. Almost all are UI wrappers: they
read a preference or the timeline key marker, optionally show a dialog, call a
lower-level command (usually an `SI...` or same-named native command) and then
select / inspect the result. The contracts below give the call shape and the
surrounding logic.

| Command | Category | Procedure |
|---------|----------|-----------|
| `InspectMaterial` | Rendering | `InspectMaterial` |
| `StoreGeomApproxProperties` | Property | `StorePropertiesProc` |
| `StoreMaterialProperties` | Property | `StorePropertiesProc` |
| `StoreVisibilityProperties` | Property | `StorePropertiesProc` |
| `AddToContainer` | (none) | `AddToContainer` |
| `RemoveFromContainer` | (none) | `RemoveFromContainer` |
| `SaveActionKey` | Animation | `SaveKeyProc` |
| `SaveKeyOnMarkedKeyable` | Animation | `SaveKeyOnKeyableProc` |
| `SaveShapeKey` | Animation, Deformation | `SaveShapeKeyProc` |
| `OffsetValueMap` | Animation Mixer | `OffsetValueMapProc` |
| `SaveOffsetKeys` | Animation Mixer | `SaveOffsetKeysProc` |
| `DeleteUnusedCacheSources` | Source | `CleanCacheSourceProc` |
| `DeleteUnusedImageSources` | File, Texturing | `CleanImageSourceProc` |
| `DeleteUnusedImageClips` | File, Texturing | `CleanImageClipProc` |
| `DeleteUnusedAnimationSources` | Source | `CleanAnimationSourceProc` |
| `DeleteUnusedAudioSources` | Source | `CleanAudioSourceProc` |
| `DeleteUnusedMaterials` | File, Texturing | `RemoveUnusedMaterialsProc` |
| `DeleteAllUnusedMaterials` | File, Texturing | `RemoveAllUnusedMaterialsProc` |
| `MergeScene` | File | `MergeSceneProc` |
| `Align` (2 entries) | Manipulation, Transform | `GetInputAndAlignProc` (key-assignable UI entry), `AlignProc` (scripted) |
| `ApplyPath` (2 entries) | Animation | `GetInputAndApplyPathProc` (key-assignable UI entry), `ApplyPathProc` (scripted) |
| `CreateCurve` | Drawing | `CreateCurve` |
| `AssembleNurbsMesh` (2 entries) | Modeling, Generator | `AssembleNurbsMeshProc` (dialog), `ScriptAssembleNurbsMeshProc` (scripted) |
| `AddComponentTool` | Modeling, Drawing | `InsertCompoOnSelectionProc` |
| `ToggleContinuousDraw` | Viewing | `ToggleValueProc` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display names, arguments, defaults, argument handlers, direction flags, `return_value`, key-assignable flag, description; also the argument lists of the commands the handlers call |
| (S) | `uixsiscripts.vbs`: the listed procedures and their local helpers (`SIMsgBox`, `SetSoloIndexIfRequired`, `DeleteSourcesClips`, `FFilterUnwantedOwners`, `FGetImageClipRealOwners`, `FGetParentObj`, `FCountItems`, `FWizardDialog`, `FIsComponent`, `StoreProperties`) and the `IDS_` constants at the top of the file | steps, constants, logged texts, called commands |
| (D) | decoded table of `Application\Dictionary\en\XSISCRIPTS.dict` | texts for the numeric ids |
| - | binaries, XSIBATCH goldens, SDK reference pages | not used for this batch |

No script text is reproduced. Names, ids, message strings and values are
recorded as facts.

## Shared facts

### Registry flags (R)

Argument direction: 2 = input, 4 = output, 6 = in/out.

| Command (display name) | Key-assignable | Returns a value |
|------------------------|----------------|-----------------|
| `InspectMaterial` (Modify Shader) | no | no |
| `StoreGeomApproxProperties` (Store Geometry Approx. Properties) | no | no |
| `StoreMaterialProperties` (Store Material Properties) | no | no |
| `StoreVisibilityProperties` (Store Visibility Properties) | no | no |
| `AddToContainer` (Add to Container), `RemoveFromContainer` (Remove from Container) | yes | no |
| `SaveActionKey` (Save Action Key) | yes | no |
| `SaveKeyOnMarkedKeyable` (Save Key On Marked Keyable) | yes | no |
| `SaveShapeKey` (Save Shape Key) | yes | yes |
| `OffsetValueMap` (Set Value Map Offset) | yes | no |
| `SaveOffsetKeys` (Save offset keys) | yes | no |
| the five `DeleteUnused...Sources` / `...Clips`, `DeleteUnusedMaterials`, `DeleteAllUnusedMaterials` (display name = scripting name) | no | no |
| `MergeScene` (Merge Scene) | yes | yes |
| `Align` (Align Objects), UI entry / scripted entry | yes / no | no |
| `ApplyPath` (Apply Path), UI entry / scripted entry | yes / no | no |
| `CreateCurve` (Create Curve) | no | no (object returned through the `Value` output argument) |
| `AssembleNurbsMesh` (Assemble Surface Mesh), both entries | no | no |
| `AddComponentTool` (Add Component Tool) | yes | no |
| `ToggleContinuousDraw` (Continuous Draw) | no | no |

All are enabled with no enable condition in the registry.

### Script entry and native twin (R)

Five names exist twice in the registry: a key-assignable script entry (the one
specified here, arguments without handlers) and a native entry with no script
handler and typed arguments: `SaveActionKey`, `SaveKeyOnMarkedKeyable`,
`SaveShapeKey`, `OffsetValueMap`, `SaveOffsetKeys`. The script procedures call
the command of the same name with a recomputed time; that inner call reaches
the native entry *(inferred: otherwise the script would recurse; for
`SaveActionKey` the inner call also has only the four arguments of the native
entry)*. The native entries are the "delegates" of this row and are not
specified here.

Native argument defaults relevant to callers (R): `SaveActionKey(InputObjs
[AnimatableParameters], Time [Frame], Value [NaN], Tolerance = -1)`;
`SaveKeyOnMarkedKeyable` / `SaveKeyOnKeyable(InputObjs [Collection], Time
[Frame], Value [NaN], Tolerance = -1, Layer = -1, ModifiedOnly = False,
AutokeyScope = 0, Source = "FCurve")`; `OffsetValueMap(InputObjs
[AnimatableParameters], Type = siSelectedParams, Time [Frame], Value [NaN])`;
`SaveOffsetKeys(InputObjs [AnimatableParameters], Type = siSelectedParams,
Time [Frame])`.

### Key time comes from the timeline key marker (S)

Every key-saving wrapper of this row ignores the `Time` it receives as the key
time. It reads `Project.Data.PlayControl.Key`, converts it to a double, and
uses that as the time of the key. `SaveShapeKey`, `OffsetValueMap` and
`SaveOffsetKeys` then compare the incoming `Time` with that value and, when
they differ, write the key time back into the `Time` in/out argument and set
`Project.Data.PlayControl.Current` to it (the timeline jumps to the key
frame). `SaveActionKey` and `SaveKeyOnMarkedKeyable` do not move the current
frame and do not write `Time` back, although the registry marks it in/out.

### Message box helper `SIMsgBox` (S)

In an interactive session it shows a standard message box (prompt, buttons,
title) and returns the pressed button. When `Application.Interactive` is
false it logs `<title>: <prompt>` as plain info and returns the default
answer supplied by the caller. Defaults used in this row: OK for the shape
authoring warning and the Align warning.

### Translated texts (D), dictionary `XSISCRIPTS`

| Id (constant) | Text | Used by |
|---------------|------|---------|
| 1008 (`IDS_SHAPE_AUTHORING`) | Shapes only store deformations you applied while in a shape modeling construction mode. / (blank line) / You are not in a shape modeling mode. This suggest that you might have applied deformations in another node, causing your shape to contain no deformation. / (blank line) / For more information, look up 'construction modes' in the online help. (spelling as shipped) | `SaveShapeKey` |
| 1009 (`IDS_DELETE_SOURCES_CLIPS`) | Muliple Selection. Please make a choice: / (blank line) / Yes : Delete all, used OR unused, %s / No : Delete unused %s only / Cancel : Do not delete any %s (spelling as shipped) | shared delete helper; never shown from the commands of this row |
| 1013 (`IDS_SELECT_TWO_OBJECTS`) | Please select at least 2 Objects first | `Align` UI entry |

Texts looked up by English key rather than by id (`Warning`, `Align`, `Set
Path`): the English key is the lookup string; the dictionary records for
string keys were not decoded, the displayed text is assumed equal to the key
*(inferred)*.

## Wire contract

### `InspectMaterial`

Argument `InputObjs` (Collection handler, selection when empty, in).

Calls `SIGetMaterialShader <InputObjs>, siMaterialPortSurface` and opens the
returned connection list with `InspectObj <list>, "Rendering"` (second
argument is the keyword set; no title, no mode, so the default non-modal
property editor). No return value, no selection change. What
`SIGetMaterialShader` returns for objects without a surface shader, or with a
shared material, is that command's contract.

### `StoreGeomApproxProperties`, `StoreMaterialProperties`, `StoreVisibilityProperties`

One procedure; the three commands differ only in the default of `Name`.

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection | selection | in |
| `Name` | - | `GeomApprox` / `Material` / `visibility` | in |

Purpose: copy the named property of an object (typically a group, layer or
partition; the script does not check the type) into that object's `Override`
property.

1. Input not an object, or empty: return silently.
2. For each input object, in order:
   1. If `<object>.Override` does not resolve, create it with
      `SIAddProp "Override", <object>, 0`.
   2. Build a property list from the wildcard `<object>.*.<Name>` (the named
      property on every direct sub-item) plus `<object>.<Name>` itself when it
      resolves. Resolution failures are swallowed.
   3. Keep only local properties: `FilterPset(<list>, siLocalPset, True)`.
      Shared instances are dropped.
   4. If anything is left, call `SIStoreProp <list>, "<object>.Override"`.
      If nothing is left, nothing is stored, but the `Override` property
      created in step 2.1 stays.
   5. If `<object>.Override` resolves (it always does after 2.1 unless the
      creation failed), open it with `InspectObj` (no keywords, default mode).

So one property editor is opened per input object. No return value. Which
parameters `SIStoreProp` writes into the override is that command's contract.

"Resolves" means: the string can be assigned to an `XSI.CollectionItem` and
reads back non-empty.

### `AddToContainer`, `RemoveFromContainer`

| Argument | Default | Dir |
|----------|---------|-----|
| `Target` | `""` | in |
| `InputObjs` | `""` | in |

`Target` is looked up by name in the scene dictionary. If the resulting object
is a `Group` (object model type name), the group command is used; for anything
else the folder command is used. `InputObjs` is passed through untouched (no
argument handler, so an empty string stays an empty string and the default of
the called command applies: its Collection handler takes the selection).

| Command | Target is a Group | otherwise |
|---------|-------------------|-----------|
| `AddToContainer` | `SIAddToGroup <target>, <InputObjs>` | `MoveToFolder <target>, <InputObjs>` |
| `RemoveFromContainer` | `RemoveFromGroup <target>, <InputObjs>` | `RemoveFromFolder <target>, <InputObjs>` |

No return value. An unknown `Target` name makes the dictionary lookup fail and
the command ends with that error (no message of its own).

### `SaveActionKey` (script entry "Save Action Key")

| Argument | Default | Dir |
|----------|---------|-----|
| `InputObjs` | none | in |
| `Time` | none (ignored, see shared facts) | in/out |
| `Value` | none | in |
| `Tolerance` | none | in |
| `Layer` | 0 | in |
| `ModifiedOnly` | `False` | in |
| `AutokeyScope` | 0 | in |
| `Source` | `"Action"` | in |

The procedure is the common "save key" dispatcher (the three `SaveKey`
registry entries use it too, with a different `Source` default). It reads the
key time *T* from `Project.Data.PlayControl.Key` and the preference
`preferences.animation.save_key_command`, then branches on `Source` (exact,
case-sensitive string compare):

| `Source` | Preference value | Call |
|----------|------------------|------|
| `"Action"` | not consulted | native `SaveActionKey <InputObjs>, T, <Value>, <Tolerance>` |
| `"FCurve"` | 1 | `SaveKeyOnKeyable <InputObjs>, T, <Value>, <Tolerance>, <Layer>, <ModifiedOnly>, <AutokeyScope>, "FCurve"` |
| `"FCurve"` | 2 | `SaveKeyOnMarkedKeyable` with the same eight arguments |
| `"FCurve"` | 3 | `SaveKeyOnCharacterKeySet` with no arguments (see `cmd-01d-keysets-paintkeys-sky.md`) |
| `"FCurve"` | any other value | `SaveKey` with the same eight arguments |
| anything else | - | raise `siErrCancelled` |

With the registry default (`"Action"`) the command is therefore: save an
action key on the given parameters at the key-marker time; `Layer`,
`ModifiedOnly` and `AutokeyScope` are unused. The current frame is not
changed. No return value.

### `SaveKeyOnMarkedKeyable` (script entry "Save Key On Marked Keyable")

Arguments (R): `InputObjs`, `Time` (in/out, ignored), `Value`, `Tolerance`,
`Layer` (all without default), `ModifiedOnly` = `False`, `AutokeyScope` = 0,
`Source` = `"FCurve"`.

The procedure is shared with `SaveKeyOnKeyable` and takes **nine** parameters:
the eight above plus a trailing boolean "marked only". The registry entry
lists only eight arguments, so the value of the ninth is not visible in the
inputs of this row (Q1).

Behaviour: read the key time *T* from the key marker; when "marked only" is
true call native `SaveKeyOnMarkedKeyable <InputObjs>, T, <Value>,
<Tolerance>, <Layer>, <ModifiedOnly>, <AutokeyScope>, "FCurve"`, otherwise
native `SaveKeyOnKeyable` with the same arguments. The incoming `Source` is
ignored (always `"FCurve"`). The current frame is not changed. No return
value.

Expected binding *(inferred from the command names)*: "marked only" is true
for `SaveKeyOnMarkedKeyable` and false for `SaveKeyOnKeyable`.

### `SaveShapeKey` (script entry "Save Shape Key")

| Argument | Default | Dir |
|----------|---------|-----|
| `InputObj` | none | in |
| `Compound`, `Track` | none | in |
| `Time` | none (ignored as key time) | in/out |
| `Duration`, `Mode`, `Name`, `Overwrite` | none | in |
| `RefMode` | `siShapeLocalReferenceMode` (`siShapeReferenceMode`) | in/out |

Order of observable steps:

1. Read `context.constructionmode`. If it is neither
   `siConstructionModePrimaryShape` nor `siConstructionModeSecondaryShape`,
   show an OK/Cancel information box with text 1008 and title `Warning`
   (non-interactive: logged, answer OK). Cancel raises `siErrCancelled`
   before anything is changed.
2. If the preference `preferences.modeling.constructionmodeautoupdate` is on
   and the mode is not `siConstructionModePrimaryShape`, set
   `context.constructionmode` to `siConstructionModePrimaryShape`. Note that
   this also switches away from the secondary shape mode.
3. Read the key time *T* from the key marker.
4. **`RefMode` is overwritten** with the preference
   `Preferences.shape_animation.ShapeReference`; the caller's value is never
   used and the preference value is what comes back in the in/out argument.
5. Exactly one input item:
   - `StoreShapeKey <item>, <Name>, <RefMode>` gives the shape key;
   - `ApplyShapeKey <key>, <Compound>, <Track>, T, <Duration>, <Mode>,
     <Name>, <Overwrite>` gives the clip;
   - solo-index fix (below) on the item;
   - `AutoInspect <key>`.
   Nothing is assigned to the return value in this branch, although the
   registry says the command returns one.
6. Several input items:
   - for each item whose type is not `pntSubComponent`: `StoreShapeKey <item>,
     <Name>, <RefMode>`; point sub-component items are skipped entirely;
   - then for each stored key: `ApplyShapeKey <key>, , , T, <Duration>,
     <Mode>, , <Overwrite>` (compound, track and name are deliberately left
     to the command's defaults);
   - then the solo-index fix on each kept item;
   - one `AutoInspect` on the collection of keys;
   - the return value is the collection of clips.
7. If the incoming `Time` differs from *T*: write *T* to `Time` and set
   `Project.Data.PlayControl.Current` to *T*.

Solo-index fix: find the primitive of the item (the item itself if it is a
primitive; the owning object's active primitive for a sub-component
selection; the cluster's grandparent for a cluster; otherwise the object's
active primitive), look up `<primitive full name>.ClusterShapeCombiner`, and
when its `ShowResult` parameter is false set its `SoloIndex` parameter to the
combiner's number of instances in port group 2 (so the newly keyed shape is
the one shown while soloing). The script assumes the combiner exists after
the apply.

`StoreShapeKey` and `ApplyShapeKey` called here each have a script entry in
the same file plus a native twin; they are outside this package.

### `OffsetValueMap` (script entry "Set Value Map Offset")

Arguments `InputObjs`, `Type`, `Time` (all in/out, no default), `Value` (in).

1. Read the key time *T* from the key marker.
2. Native `OffsetValueMap <InputObjs>, <Type>, T, <Value>` (`Type` is a
   `siEffectInputType`, native default `siSelectedParams`).
3. If the incoming `Time` differs from *T*: write *T* to `Time`, set
   `Project.Data.PlayControl.Current` to *T*.

No return value.

### `SaveOffsetKeys` (script entry "Save offset keys")

Arguments `InputObjs`, `Type`, `Time` (all in/out, no default).

1. Read the key time *T* from the key marker.
2. Native `SaveOffsetKeys <InputObjs>, <Type>, T`.
3. If the incoming `Time` differs from *T*: write *T* to `Time`, issue a
   `Refresh`, then set `Project.Data.PlayControl.Current` to *T*. The refresh
   comes first on purpose (effect curves are otherwise not re-evaluated by the
   time change).

No return value.

### `DeleteUnusedCacheSources`, `DeleteUnusedImageSources`, `DeleteUnusedImageClips`, `DeleteUnusedAnimationSources`, `DeleteUnusedAudioSources`

No arguments, no return value. Each builds a candidate list and hands it to
the shared delete helper in "force clean, never ask" mode.

| Command | Candidate list | Kind label |
|---------|----------------|------------|
| `DeleteUnusedCacheSources` | `EnumElements "Sources.FileCaches", True, 0` | `Cache Source` |
| `DeleteUnusedImageSources` | `EnumElements "Sources.Image", True, 0` | `Image Source` |
| `DeleteUnusedImageClips` | `EnumElements "Clips.Image", True, 0` | `Image Clip` |
| `DeleteUnusedAnimationSources` | for each element of `EnumElements "Sources.Animation", True, 0` (one per model): the elements of its nested object `List`, concatenated in order | `Animation Source` |
| `DeleteUnusedAudioSources` | `EnumElements "Sources.Audio", True, 0` | `Audio Source` |

A missing container (enumeration gives nothing) ends the command silently,
except in `DeleteUnusedAnimationSources`, which iterates the result directly.

Owners of a candidate: for an image clip (class `siImageClipID`), its nesting
owners (`EnumElements <clip>, False`) followed by the shader parameters it is
connected to (`GetShaderParameterTargets`); for everything else, its nesting
owners only.

A candidate is **used** when at least one owner passes the test for its kind:

| Kind | An owner counts as a user when |
|------|--------------------------------|
| `Image Source` | the owner's parent container (owner of the owner's first owner) is `<active scene>.Clips`, that is, the owner is an image clip of the scene |
| `Image Clip` | the owner is anything other than `<active scene>.Clips.Image` (the clip container itself) |
| `Animation Source` | the owner's type is not `model_delta` and its object model type name is `CollectionItem` |
| `Cache Source` | its object model type name is `CollectionItem` |
| `Audio Source` | its object model type name is `Clip` |

Deletion, with the mode used by these five commands:

| Candidates | Effect |
|------------|--------|
| 0 | nothing |
| exactly 1 | used: nothing; unused: `DeleteObj <the candidate>` |
| 2 or more, none used | one `DeleteObj` on the whole list |
| 2 or more, some used | one `DeleteObj` on the unused ones only (also issued when that sub-list is empty) |

No dialog is ever shown and nothing is logged by the script; used items are
never deleted. The helper's interactive paths (a Yes/No "Deleting the <kind>
..." confirmation for a single used item, and the Yes/No/Cancel box with text
1009 and title `Multiple Delete <kind>` for a mixed list) belong to the
interactive `Delete...` commands of other rows and are unreachable here.

Consequence worth knowing: `DeleteUnusedImageClips` and
`DeleteUnusedImageSources` are independent passes; a source whose only clip
was just removed needs a second command to go.

### `DeleteUnusedMaterials`

Argument `InputObjs` (Collection handler, selection when empty, in). Only the
**first** item is used and it must be a material library (the script reads its
`Items`; anything else fails with an object model error).

1. Walk the library's items in index order. Keep an item when its type is
   `material`, it has exactly one owner (the library itself), and it is not
   locked (`IsLocked` false).
2. If at least one was kept: log `deleting those <comma list of the kept
   materials>` (plain info), then one `DeleteObj` on the list.
3. Otherwise log `Nothing to delete` (plain info).

No return value.

### `DeleteAllUnusedMaterials`

No arguments. Expands `Sources.Materials.*` and, for each element whose
object model type name is `MaterialLibrary`, in order, performs the
`DeleteUnusedMaterials` behaviour on that library. One log line per library
(`deleting those ...` or `Nothing to delete`). Non-library elements are
skipped. No return value.

### `MergeScene`

| Argument | Default | Dir |
|----------|---------|-----|
| `FileName` | `""` | in/out |
| `Name` | `""` | in |
| `Parent` | `""` | in |
| `ShareOptions` | `siImportShareOptionsAll` (`siImportShareOptions`) | in |
| `CreatedObj` | (registry lists a fifth entry with default `VBScript` and flags -1; the procedure has only four parameters, so this is a registry artefact, not an argument) | - |

1. `SIMergeScene <FileName>, <Name>, <Parent>, <ShareOptions>`; its
   `CreatedObj` output (the model that holds the merged scene) is the return
   value. `SIMergeScene`'s `FileName` argument has the FileName handler, so an
   empty name opens the file browser there *(inferred from the handler
   name)*; the chosen name comes back through the in/out argument.
2. If a model was created: `SelectObj <model>, "NODE"`.

No inspection is done (the script comment mentions it, the body does not).
If `SIMergeScene` fails or is cancelled its error ends the command.

### `Align`

| Argument | Handler | Default | Dir (UI / scripted) |
|----------|---------|---------|---------------------|
| `InputObjs` | Collection | selection | in |
| `AlignAxes` | - | `siY` (`siAxesFilter`) | in/out / in |
| `PosX`, `PosY`, `PosZ` | - | `siAlignGMIDDLE` (`siAlignModes`) | in/out / in |
| `RefX`, `RefY`, `RefZ` | - | `siAlignGMIDDLE` | in/out / in/out |
| `AllObjects` | - | `True` | in/out / in |

`AlignAxes` is a bit mask: `siX` = 1, `siY` = 2, `siZ` = 4.

**Scripted entry (the alignment itself).** Empty input: return silently.

1. Bounding boxes are taken with `GetBBox <items>, True` (outputs
   `LowerBoundX/Y/Z`, `UpperBoundX/Y/Z`): once for the whole input list
   (global box, G) and once for the first item (F). Both are measured before
   anything moves.
2. Reference coordinate, per axis, from the `Ref` mode of that axis:

| `Ref` mode | Reference |
|------------|-----------|
| `siAlignGMAX` | G maximum |
| `siAlignGMIN` | G minimum |
| `siAlignGMIDDLE` | G centre, (min + max) / 2 |
| `siAlignFMAX` | F maximum |
| `siAlignFMIN` | F minimum |
| any other value (`siAlignFMIDDLE`) | F centre |

3. For each item in list order (the first item only when `AllObjects` is
   true): take the item's own box (the first item reuses F; the others are
   measured at that moment with `GetBBox <item>, True`). For each axis
   enabled in `AlignAxes`, the displacement is the reference minus the
   item's anchor, where the anchor comes from the `Pos` mode of that axis:
   `siAlignGMAX` gives the item's maximum, `siAlignGMIN` its minimum, **every
   other value** (including the three F modes) its centre. Disabled axes get
   displacement 0.
4. `Translate <item>, dx, dy, dz, 1, , , <AlignAxes>`: one relative translate
   per item (fifth argument 1 = relative delta; reference frame and centre
   mode left to defaults; the axes mask is passed as the eighth argument but
   the script author notes the translate does not depend on it). A translate
   is issued even when all three displacements are 0.

No return value; selection unchanged. One undoable `Translate` per moved
item.

**UI entry ("Align Objects", key-assignable).**

1. Empty input: raise `siErrCancelled`.
2. Fewer than two items: log text 1013 as a warning (severity 4), show an OK
   exclamation box with text 1013 and title `Warning`, raise
   `siErrCancelled`.
3. Options property: look for a property named `Align` on the active scene
   root.
   - Not present: add the `AlignWizard` property (factory preset with its own
     SPDL layout) to `Scene_Root` under the name `Align`, and initialise its
     parameters from the arguments: `doX`, `doY`, `doZ` (the three bits of
     `AlignAxes`), `posX`, `posY`, `posZ`, `doAllObj`, `refX`, `refY`, `refZ`.
   - Present: it is used as is; **the command arguments are ignored** and the
     values of the previous use are shown.
4. Show that property modally with title `Align` (`InspectObj <property>, ,
   "Align", siModal`). Cancel (any error from the modal inspect) raises
   `siErrCancelled`; the property stays on the scene root.
5. On OK: read the ten parameters back, rebuild `AlignAxes` as 1 * doX + 2 *
   doY + 4 * doZ, write all values to the in/out arguments, and run the
   scripted behaviour above. The `Align` property is kept on the scene root
   so that the options persist with the scene.

### `ApplyPath`

| Argument | UI entry default / handler | Scripted entry default / handler | Dir (UI / scripted) |
|----------|---------------------------|----------------------------------|---------------------|
| `InputObjs` | none / - | selection / Collection | in |
| `Path` | none / - | none / Collection | in/out |
| `StartFrame` | none | 0.0 | in/out / in |
| `EndFrame` | none | 0.0 | in/out / in |
| `NbKeys` | 2 | 2 | in/out / in |
| `Linear` | `False` | `False` | in/out / in |
| `Tangent` | `False` | `False` | in/out / in |

**Scripted entry.** Silent return (no message, no error) when `InputObjs` is
empty, when `Path` is empty, or when `NbKeys` is less than 2. `EndFrame` may
be smaller than `StartFrame` (allowed on purpose).

For each input object, in order:

1. `SIApplyCns "Path", <object>, <Path>, <user preference
   SI3D_CONSTRAINT_COMPENSATION_MODE>` gives the path constraint.
2. `NbKeys` keys on `<constraint>.perc`, evenly spaced: key *k* (0-based) at
   time `StartFrame + k * (EndFrame - StartFrame) / (NbKeys - 1)` with value
   `k * 100 / (NbKeys - 1)`. Each is one `SaveKey <param>, <time>, <value>, ,
   0` (tolerance omitted, layer 0). With the default 2 keys: 0 at the start
   frame, 100 at the end frame.
3. If `Linear` is true: `SetCurveType "<constraint>.perc", 2` (2 = linear
   interpolation).
4. `SetValue "<constraint>.tangent", <Tangent>` (always, also when false).

After the loop, one `AutoInspect` on the collection of constraints. No return
value. The path object is the same for every input object.

**UI entry ("Apply Path", key-assignable).**

1. Read the timeline range `Project.Data.PlayControl.In` and `.Out`.
2. Add a custom parameter set named `ApplyPath` to the active scene root
   (`SIAddProp "Custom_parameter_list"`), with four parameters added through
   `SIAddCustomParameter`, all with capabilities `siPersistable + siSilent`:

| Parameter | Type | Initial value | Range | UI range | Label / description |
|-----------|------|---------------|-------|----------|---------------------|
| `Start` | `siDouble` | timeline In | -1000000 .. 1000000 | In .. Out | `Start` / `Start Frame` |
| `End` | `siDouble` | timeline Out | -1000000 .. 1000000 | In .. Out | `End` / `End Frame` |
| `Linear` | `siBool` | the **`Tangent`** argument | 0 .. 1 | 0 .. 1 | `Linear` / `Linear` |
| `Tangent` | `siBool` | the **`Linear`** argument | 0 .. 1 | 0 .. 1 | `Tangent` / `Tangent` |

   The two boolean initial values are crossed as shipped. With both defaults
   false this is invisible. The incoming `StartFrame` / `EndFrame` are not
   used to initialise the dialog.
3. Show the set modally with title `Set Path`.
4. OK: read `Start`, `End`, `Tangent`, `Linear` back (each from its own
   parameter, not crossed) into the in/out arguments, run the scripted
   behaviour with them and with `InputObjs`, `Path`, `NbKeys` as received,
   then `DeleteObj` the parameter set.
5. Cancel: `DeleteObj` the parameter set, raise `siErrCancelled`.

The UI entry does not pick a path itself: it has no argument handlers, so
`InputObjs` and `Path` must be supplied by the caller (menu / pick session
outside this script); if either is empty the dialog still appears and OK then
does nothing. `NbKeys` is not exposed in the dialog.

### `CreateCurve`

| Argument | Default | Dir |
|----------|---------|-----|
| `Degree` | 3 | in |
| `CurveType` | 0 | in |
| `Points` | `""` | in |
| `Local` | `False` | in |
| `Value` | - | out |

Tooltip (R): `CreateCurve <degree>, <interpolated>, '(x0,y0,z0),(xn,yn,zn)...'`.

1. `SICreateCurve , <Degree>, <CurveType>` (name omitted, so the default
   curve name) gives the new curve object; it is written to the `Value`
   output.
2. `SISetCurvePoints <curve>, <Points>, <Local>`.

`CurveType` is the "interpolated" switch of the tooltip (0 = control points,
non-zero = the curve passes through the points) *(inferred from the tooltip
and the procedure's parameter name)*. `Points` is one string of parenthesised
triples; parsing is `SISetCurvePoints`'s. No selection or inspection by the
script.

### `AssembleNurbsMesh`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObj` | Collection | selection | in |
| `Tolerance` | - | 0.15 | in |
| `CopyUserCluster` | - | `False` | in |
| `CopyMaterial` | - | `False` | in |
| `CenterGeomCenter` | - | `True` | in |

Both registry entries have identical argument lists and neither is
key-assignable; they differ only in the procedure.

**Scripted entry (`ScriptAssembleNurbsMeshProc`).**

1. `SIAssembleNurbsMesh <InputObj>, <Tolerance>, <CopyUserCluster>,
   <CopyMaterial>, <CenterGeomCenter>`; read its `OutputObj` output.
2. If an object came back: `SelectObj <object>` then `AutoInspect <object>`.

**Dialog entry (`AssembleNurbsMeshProc`).**

1. Count the surface meshes in the input (`SIFilter <InputObj>,
   "surface_mesh", , siQuickSearch`). None: return silently.
2. Create the dialog object `TaskUI.SCMDialog`, load its `Tolerance`,
   `CopyClusterFlag`, `CopyMaterialFlag`, `CenterGeomCenterFlag` from the
   arguments, and show it. Cancel: return silently (no error raised).
3. OK: read the four values back and run the scripted behaviour with them.
   **As shipped, the object list passed on is not the command's `InputObj`
   but an unset variable**, so `SIAssembleNurbsMesh` receives an empty first
   argument and its Collection handler falls back to the current selection
   *(inferred: fallback behaviour of the handler)*. The result is the same as
   long as the input was the selection, which is the menu case.

No return value from either entry.

### `AddComponentTool`

Argument `InputObjs` (Collection handler, selection when empty, in). Chooses
an interactive tool from the kind of objects in the input, first match wins:

| Test (`SIFilter <InputObjs>, <type>` non-empty) | Action |
|--------------------------------------------------|--------|
| `polygon_mesh` | `SplitEdgeTool` |
| `curve` | `AddPointOnCurveTool` |
| `surface_mesh` | nothing (no tool exists for surfaces) |
| none of the above (including an empty selection) | `SplitEdgeTool` |

A mixed selection containing a polygon mesh always gets the split edge tool.
Both tool commands are called without arguments. No return value.

### `ToggleContinuousDraw`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `ParamName` | - | `ContinuousDraw` | in |
| `InputObjs` | Collection | `Views` | in |

Generic "toggle a boolean on several objects" procedure, registered here with
fixed defaults.

1. Split `ParamName` on commas (case-insensitive compare is irrelevant; no
   trimming of spaces).
2. Read `<first input object>.<first parameter name>` with `GetValue`; the new
   value is the negation of "that value equals True".
3. For every input object and every parameter name, in that nesting order:
   `SetValue "<object>.<name>", <new value>`.

With the defaults this reads `Views.ContinuousDraw`, and writes its negation
back: one `SetValue`. All targets get the same value, taken from the first
target only (the command synchronises as well as toggles). No return value.

## Enable conditions and errors

None of the commands has a registry enable condition.

| Situation | Result |
|-----------|--------|
| `SaveActionKey` with `Source` other than `"Action"` / `"FCurve"` | `siErrCancelled` |
| `SaveShapeKey` outside a shape construction mode, user presses Cancel | `siErrCancelled`, nothing changed |
| `Align` UI entry: empty input | `siErrCancelled` |
| `Align` UI entry: fewer than two objects | warning log + box (text 1013), `siErrCancelled` |
| `Align` / `ApplyPath` UI entries: dialog cancelled | `siErrCancelled` (`ApplyPath` deletes its temporary property first) |
| `ApplyPath` scripted: no objects, no path or `NbKeys` < 2 | silent no-op |
| `AssembleNurbsMesh` dialog entry: no surface mesh in input, or dialog cancelled | silent no-op |
| `Store...Properties`: empty input | silent no-op |
| `DeleteUnused...`: nothing unused | silent no-op (materials: logs `Nothing to delete`) |
| `AddToContainer` / `RemoveFromContainer`: unknown target name | error of the dictionary lookup |

Dialog-based paths (`Align` and `ApplyPath` UI entries, `AssembleNurbsMesh`
dialog entry) need a user session; under XSIBATCH the modal inspect is
expected to fail and be treated as Cancel *(inferred; no XSIBATCH run)*. The
`SaveShapeKey` warning is the only box routed through the non-interactive
fallback (logged, answered OK) besides the `Align` warning.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 (closed 2026-11-17, see cmd-b8a) | `SaveKeyOnMarkedKeyable` / `SaveKeyOnKeyable` script entries: the shared procedure takes a ninth "marked only" parameter that the registry dump does not list. Where does its value come from (hidden fixed argument in the command definition)? Expected true / false respectively. | command definition in the binary that registers the script commands, or a golden: log which native command runs |
| Q2 | Do the inner same-named calls (`SaveActionKey`, `SaveKeyOnMarkedKeyable`, `OffsetValueMap`, `SaveOffsetKeys`, `StoreShapeKey`, `ApplyShapeKey`) resolve to the native entry, as assumed? | golden with command logging; binary pass on command lookup order |
| Q3 | Numeric values of `siAlignModes` (`siAlignGMIN` .. `siAlignFMAX`, six values) and the parameter layout of the `AlignWizard` preset | type library / `AlignWizard` SPDL |
| Q4 | Values of `preferences.animation.save_key_command` are read as 1, 2, 3, other; the preference's UI labels and default are not in the script | preference SPDL |
| Q5 | `SaveShapeKey` single-item branch assigns no return value although the registry declares one: what does the caller receive? Also the value set of `Preferences.shape_animation.ShapeReference` versus `siShapeReferenceMode` | golden; preference SPDL |
| Q6 | `AssembleNurbsMesh` dialog entry passes an unset object list: confirm `SIAssembleNurbsMesh` then uses the selection | golden or binary pass on `SIAssembleNurbsMesh` |
| Q7 | `TaskUI.SCMDialog` layout and value limits (tolerance range) | dialog resource in the TaskUI binary |
| Q8 | `MergeScene` fifth registry argument (`CreatedObj`, default `VBScript`, flags -1): confirm it is a dump artefact of the return-value slot | registry decoder review |
| Q9 | Contracts of the delegated commands: native `SaveActionKey`, `SaveKeyOnMarkedKeyable`, `SaveKeyOnKeyable`, `SaveShapeKey`, `OffsetValueMap`, `SaveOffsetKeys`, `SIGetMaterialShader`, `SIStoreProp`, `SIMergeScene`, `SIAssembleNurbsMesh`, `SICreateCurve`, `SISetCurvePoints`, `SIApplyCns`, `MoveToFolder`, `RemoveFromFolder`, `SplitEdgeTool`, `AddPointOnCurveTool` (the last has no registry entry in the dump) | their own rows |
| Q10 | Translated texts for the string-keyed lookups (`Warning`, `Align`, `Set Path`) were not decoded | finish the dictionary decode |

Q1 is the only point where the script-level behaviour of a command of this
row is not fully determined by what was read; the others concern values or
delegated commands outside this script.
