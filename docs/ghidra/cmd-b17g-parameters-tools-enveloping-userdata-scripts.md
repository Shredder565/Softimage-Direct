# CMD-B17g: parameter / wire-colour tool / envelope / user-data script commands (`parameters.vbs`, `tools.vbs`, `enveloping.vbs`, `UserDataScripts.vbs`)

Row: **CMD-B17g**. Status: **SPEC** for 8 commands, **SPEC-PARTIAL** for `SampleParameterValues`.
Run: 2026-11-20, si-analyst worker, unattended, batch 17
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none (script commands, handler CLSID `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9`). Sources read with REA raw-6502
`read_bytes`; procedures located with `search_bytes`, then their regions read.

| File (`Application\DSScripts\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `parameters.vbs` | 33840 | `74a93086` | partly (0x0a00–0x2044, 0x4a80–0x5ffc) | 3 |
| `tools.vbs` | 10428 | `b4cedca7` | partly (0x0000–0x0500 constants, 0x0500–0x12d4, 0x2580–end) | 3 |
| `enveloping.vbs` | 23250 | `b058e12e` | partly (0x4780–end) | 2 |
| `UserDataScripts.vbs` | 15235 | `b692d4ae` | partly (0x0920–0x14d8) | 2 |

Earlier contracts reused: `cmd-b5f-misc-dsscripts.md` (`CreateUserDataMap` → `CreateUserDataMapFunc`, `SIInspectUserData`
→ `InspectUserDataSub`, other tools.vbs tools), `cmd-01d-keysets-paintkeys-sky.md` (`AddProxyParam`),
`cmd-b14c-fr-eyes-jaw-regions.md` (`CreateWeightMap`, `PaintTool`), `cmd-01c-texture-layers.md` (`MakeLocal`).

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `RandomizeParameters` (6 entries) | parameters.vbs | `RandomizeParamsProc` | SPEC |
| `CreateDisplayInfo` | parameters.vbs | `CreateDisplayInfoFromMarkedParametersProc` | SPEC |
| `SampleParameterValues` (2 entries) | parameters.vbs | `SampleParamValuesProc`, `GetInputAndSampleParamValuesProc` | SPEC-PARTIAL |
| `PaintPushTool` | tools.vbs | `PaintPushTool` | SPEC |
| `ColorizeObject` (15 entries) | tools.vbs | `ColorizeObjectTool` | SPEC |
| `ShadeObject` (8 entries) | tools.vbs | `ShadeObjectTool` | SPEC |
| `SelectDeformersFromEnvelope` | enveloping.vbs | `SelectDeformersFromEnvelopeProc` | SPEC |
| `AssociateEnvelopeBoundingVolume` (4 entries) | enveloping.vbs | `EnvelopeAssociateBoundingVolumesProc` | SPEC |
| `CreateUserDataMapAndPickTemplate` | UserDataScripts.vbs | `CreateUserDataMapAndPickTemplateFunc` | SPEC |
| `InspectUserData` | UserDataScripts.vbs | `InspectUserDataFromObjListSub` | SPEC |

## 2. Wire contract, parameters.vbs (category Property)

### `RandomizeParameters`
Args: `params` (marked parameters, f 0x10042), `percentage` (dbl), `relative` (bool), `seed` (int, 0). Entries:
0.5 absolute, 0.1 / 0.25 / 0.5 relative, 0.75 / 1.0 absolute.
1. Empty params string → log (info) `No valid parameter marking selection`, raise `siErrCancelled`.
2. Params are turned into a parameter collection (`XSI.Collection.SetAsText`).
3. Seed: 0 → reseed from the clock (fully random); < 0 → seed the generator with that value then reseed with −seed
   (repeatable sequence); > 0 → no reseed (next numbers in the sequence).
4. For each parameter: get its UI range (helper `GetParamRange`, (inferred) suggested min/max, falling back to hard
   min/max). range = percentage × (max − min), half = range × 0.5.
   - Boolean (value type 11): value = random > 0.5.
   - Otherwise r = random in [−1, 1); base = current value when relative, else (min + max) / 2; new = r × half + base,
     clamped to [min, max] (strictly inside kept, below min → min, otherwise max).
No return value.

### `CreateDisplayInfo`
Args: `InputObj` (objects), `PsetName` (str, `DisplayInfoMarkedParams`), `ShowDisplayInfo` (bool, True); return
collection of created property sets.
1. Read the marking (`GetMarking`). Nothing marked → returns an empty collection, nothing else.
2. For each input object (errors ignored): `SIAddProp("Custom_parameter_list", obj, siNodePropagation, PsetName)`;
   if that failed (object is not a 3D object or cluster) the property is added on `Scene_Root` instead. The set is added
   to the return collection, then `AddProxyParam <set>, "<obj>.<marked param>"` for every marked parameter.
3. `SetValue "Camera.camvis.custominfo", <ShowDisplayInfo>` (custom display info visible in the output camera).
4. Returns the collection.

### `SampleParameterValues` (SPEC-PARTIAL)
Args: `InputObj`, `SamplingMethod` (int 0), `NbSamples` (3), `Percentage` (0.25), `Relative` (False), `Seed` (8457),
`CaptureMethod` (str "0"), `CaptureName` (`C:\Temp\sample`), `CaptureSize` (100), `RetrieveResult` (False),
`ResultId` (1); return Value (number of samples taken, starts 0). `GetInputAndSampleParamValuesProc` is the UI entry
(not read).
Read so far:
1. Display params flag = (CaptureMethod is the "capture" method constant); when not Relative the percentage is forced
   to 1.0.
2. A temporary display-info set is created with `CreateDisplayInfo(InputObj, "DisplayInfoBracketParams", flag)`;
   its first property holds the proxies of the marked parameters.
3. Frame = `PlayControl.Current`; capture options prepared (helper `PrepareSampleParamSnapshot`(method, size, frame):
   sets up capture options, keeping the previous values).
4. RetrieveResult: parameter values are first restored from the values stored by the previous run (module-level array);
   otherwise the current values are stored, the expected number of takes is computed (×2 per boolean, ×NbSamples per
   other parameter) and an `XSIUIToolkit.ProgressBar` is created.
5. Bracket method: per parameter min/max = current ± range × percentage × 0.5 (clamped to the UI range) when Relative,
   else the UI range; NbSamples steps per parameter (2 for booleans); progress bar caption `Generating Bracket
   Samples`, max = predicted takes; then a recursive "combine" helper walks every combination, capturing each.
6. Randomize method: progress caption `Generating Random Samples`, max = NbSamples; per take
   `RandomizeParameters , Percentage, Relative, −Seed` for the first take then seed 1 (continue sequence) …
   (rest not read: capture per take, restore, return count).
Constant values for SamplingMethod (bracket vs randomize) and CaptureMethod (capture / capture plain / render) were not
read.

## 3. Wire contract, tools.vbs

Translated texts (`XSISCRIPTS.dict`): 1152 pick-object-to-colour message (left/node), 1153 branch message (middle).
Both colour and shade tools use these two ids.

### `ColorizeObject` (category Viewing)
Args: `Red`, `Green`, `Blue` (dbl). Entries: Wire Color Tool / Default (0,0,0), Red (0.878,0,0), Yellow (0.878,0.878,0),
Green (0,0.251,0), Blue (0,0.125,0.627), Purple (0.376,0,0.251), Light Green (0.125,0.878,0.125), Brown
(0.376,0.125,0), Orange (0.878,0.251,0), Pink (0.878,0.251,0.627), Teal (0.125,0.878,0.753), Fuschia (0.878,0,0.502),
Gold (0.878,0.753,0.251).
Pick loop until cancelled: `PickObject(text 1152, text 1153)`; button 0 (right / Esc) ends; button 1 → node
propagation, 2 → branch propagation. Picked element filtered with `SIFilter(…, "SceneObject", True)`; nothing →
log (info) `Please select an object`. Otherwise `MakeLocal "<obj>.display", <propagation>` (fallback to the existing
display property when MakeLocal returns nothing) and `SetValue "<obj>.display.wirecolorr/g/b"` = Red / Green / Blue.

### `ShadeObject` (category Viewing)
Args: `ShadeModeId` (int). Entries: tool / Default 8, Shaded 1, Wireframe 0, Hidden Line 6, Textured 4, Bounding Box 5,
Constant 7. Same pick loop and MakeLocal; sets on `<obj>.display` all nine view-mode parameters to ShadeModeId:
`staticsel`, `intsel`, `playbacksel`, `staticunselnear`, `intunselnear`, `playbackunselnear`, `staticunselfar`,
`intunselfar`, `playbackunselfar`.

### `PaintPushTool` (category Modeling, Paint; no args)
1. `CreateWeightMap(, , "PushMap")` on the selection.
2. For each created map: `weightmapop.weight` 0.0, `weightmapop.wmin` −1.0, `weightmapop.wmax` 1.0; map colour
   `red` 70, `green` 70, `blue` 177; `ApplyOp("Push", map)` and on the returned op `ampl` = 2.0.
3. `PaintTool`; `SetValue "BrushProperties.Radius", 1.0`.

## 4. Wire contract, enveloping.vbs (category Animation, Deformation)

### `SelectDeformersFromEnvelope`
Args: `InputObjs`. For each input: its active primitive geometry; if any, every point cluster (`Clusters.Filter("pnt")`)
→ each envelope on the cluster → each deformer, collected (duplicates possible). Count > 0 → `SelectObj
<deformers>`; else log (info) `No envelope deformers found`.

### `AssociateEnvelopeBoundingVolume`
Args: `InputObjs`, `BndVolType` (str: `Inclusive` default and for the Inclusive entry, `Exclusive`, `Limit`).
1. Expanded selection = `SelectChildNodes(InputObjs, False)`; deformers = `SIFilter(…, "chain_element")`.
2. Deformers found → pick loop for bounding objects: `PickElement "implicit"` (left / middle texts from dictionary)
   until button 0; for each deformer the group `<deformer>.BoundVol.<BndVolType>`: left click → `SIAddToGroup
   <group>, <picked>`; middle click → `RemoveFromGroup <group>, <picked fullname>`.
3. No deformers but implicit objects (`SIFilter(…, "implicit")`) → pick loop for deformers: `PickElement
   "chain_element"`; group `<picked>.BoundVol.<BndVolType>`; left → `SIAddToGroup <group>, <implicits>`; middle →
   `RemoveFromGroup <group>, <implicits>`.
4. Neither → nothing.

## 5. Wire contract, UserDataScripts.vbs (category Property)

### `CreateUserDataMapAndPickTemplate`
Args: `InputObj`, `PropertyName` (str, `UserData`); return collection.
1. `PickElement "property"` with the user-data pick-template text (dictionary) for left and middle.
2. Nothing picked → log (info) `You haven't picked a template (make sure to pick the name not the icon)`; return an
   empty collection.
3. Picked item type not `customparamset` → log (info) `Wrong type of property for a template`; empty collection.
4. Otherwise returns `CreateUserDataMap(InputObj, PropertyName, <template>)` (see `cmd-b5f`).

### `InspectUserData`
Args: `InputObjs` (unused: the procedure scans the global **Selection**).
1. In the selection: last `CollectionItem` gives the sub-component; last `UserDataMap` item is the map.
2. No sub-component → log (siError) `No components have been selected`, stop.
3. No map → find one from the sub-component (helper `FindUDM`, not read; (inferred) a user-data map on a cluster of
   that sub-component); none → log (siError) `No suitable User Data Map could be found`, stop.
4. `InspectUserDataSub(map, subcomponent)` (same as `SIInspectUserData`, see `cmd-b5f`).

## 6. Open questions
- SampleParameterValues: rest of the randomize loop, capture / restore steps, method constants, the UI entry.
- `GetParamRange`, `FindUDM` helpers not read.

## 7. Corrections for the wire agent
- `InspectUserData` reads the global selection, not its `InputObjs` argument.
- `ShadeObject` writes nine `display` view-mode parameters (sel / unselnear / unselfar × static / interactive /
  playback), after making the display property local with node or branch propagation per mouse button.
- `CreateDisplayInfo` falls back to `Scene_Root` when the property cannot be added to an input item.
