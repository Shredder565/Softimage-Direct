# CMD-01d: character key set, paint shape key and physical sky commands

Row: **CMD-01d** (split from CMD-01, uncategorised). Status: **SPEC**.
Run: 2026-11-16, `si-analyst`, unattended.

20 script-implemented commands. None has a category in the registry.

| Group | Implemented in | Command | Script procedure |
|-------|----------------|---------|------------------|
| A. Character key sets | VBScript, `Application\DSScripts\CharacterKeySets.vbs` | `GetCurrentCharacterKeySet` | `GetCurrentCharacterKeySetCommand` |
| | | `GetAllCharacterKeySets` | `GetAllCharacterKeySetsCommand` |
| | | `CreateSubCharacterKeySet` | `CreateSubCharacterSetCommand` |
| | | `AddProxyParamToCharacterKeySet` | `AddProxyParameterToCharacterKeySetCommand` |
| | | `SaveKeyOnCharacterKeySet` | `SaveKeyOnCharacterKeySetCommand` |
| | | `SaveZeroKeyOnCharacterKeySet` | `SaveZeroKeyOnCharacterKeySetCommand` |
| | | `RemoveKeyOnCharacterKeySet` | `RemoveKeyOnCharacterKeySetCommand` |
| | | `InspectCurrentCharacterKeySet` | `InspectCurrentCharacterKeySetCommand` |
| | | `OpenAnimationEditorOnCurrentCharacterKeySet` | `OpenAnimationEditorOnCurrentCharacterKeySetCommand` |
| | | `DeleteCurrentCharacterKeySet` | `DeleteCurrentCharacterKeySetCommand` |
| | | `SelectObjectsFromCharacterKeySet` | `SelectObjectsFromCharacterKeySetCommand` |
| B. FX paint shape keys | JScript, `Application\DSScripts\fxscripts.js` | `FirstPaintShapeKey` | `FirstPaintShapeKeyProc` |
| | | `PrevPaintShapeKey` | `PrevPaintShapeKeyProc` |
| | | `ClosestPaintShapeKey` | `ClosestPaintShapeKeyProc` |
| | | `NextPaintShapeKey` | `NextPaintShapeKeyProc` |
| | | `LastPaintShapeKey` | `LastPaintShapeKeyProc` |
| | | `DeletePaintShapeKey` | `DeletePaintShapeKeyProc` |
| | | `SavePaintShapeKey` | `SavePaintShapeKeyProc` |
| | | `PaintShapeManipTool` | `PaintShapeManipToolProc` |
| C. Physical sky | JScript self-installing plug-in, `Application\Plugins\AddPhysicalSky.js` (plug-in `AddPhysicalSkyPlugin` 1.0) | `AddPhysicalSky` | `AddPhysicalSky_Execute` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display name, scripting name, arguments, defaults, argument handlers, `return_value`, key-assignable flag, description |
| (S) | the three script files above, read in full from the install (18,448 / 4,294 / 10,919 bytes) | every step, constant and message of the 20 commands and their helpers |
| (D) | `Application\Dictionary\en\XSISCRIPTS.dict` (ids are big-endian, text UTF-16LE) | texts of ids 1051, 1052, 1172, 1173, 1515 |
| (P) | `data/spdl/spdl.json` | existence of the `IsCharacterKeySet` custom-property parameter and the scene parameter `CurrentCharacterKeySet` |
| - | REA / Ghidra | not needed: no command in this batch is native. The native commands they call are listed under "Depends on" |
| - | XSIBATCH goldens | not run |

No script text is reproduced here. Names, constants, ids and message strings are
recorded as facts.

## Shared facts

### Registry flags (R)

All 20 are enabled. Key-assignable: all except `GetCurrentCharacterKeySet` and
`GetAllCharacterKeySets`. Return a value: `GetCurrentCharacterKeySet`,
`GetAllCharacterKeySets`, `CreateSubCharacterKeySet`, `AddPhysicalSky` (flag set,
but see C). All arguments are inputs (flags 2) except `Name` of
`CreateSubCharacterKeySet` and `Time` of `SavePaintShapeKey`, which are in/out (6).

Display names: "Get Current Character Key Set", "Get All Character Key Sets",
"Create Sub-Character Key Set", "Add Proxy Parameter To Character Key Set",
"Save Key On Character Key Set", "Save Zero Key On Character Key Set",
"Remove Key On Character Key Set", "Inspect Current Character Key Set",
"Open Animation Editor On Current Character Key Set", "Delete Current Character
Key Set", "Select Objects From Character Key Set", "First / Previous / Closest /
Next / Last Paint Shape Key", "Delete Paint Shape Key", "Save Paint Shape Key",
"Paint Shape Manipulator Tool", "AddPhysicalSky".

### What a character key set is (S, P)

- A character key set is a custom property created from the preset
  `Custom_parameter_list` whose boolean parameter `IsCharacterKeySet` is true.
  Its members are proxy parameters. A sub key set is the same kind of property
  nested under another key set (property under property).
- The current key set is stored as text (the full name of the property) in the
  parameter `CurrentCharacterKeySet` of the active scene object
  (`<ActiveScene>.CurrentCharacterKeySet`). Empty text means none.
- Default names: `CharKeySet` for a key set, `SubCharKeySet` for a sub key set.
- Property propagation used at creation: `siNodePropagation`.

### Messages

| Id (dictionary `XSISCRIPTS`) | Text | Used by |
|---|---|---|
| 1051 | New Character Key Set | title of the name prompt |
| 1052 | Name for New Character Key Set | prompt text of the name prompt |
| 1172 | Check out this layout created from scripting | title of the Sky Shader Setup inspector (sic) |
| 1173 | Select light | both pick prompts of the sky Pick button |
| 1515 | Use exposure shader on lens | label of the `UseToneMap` checkbox |

Untranslated log texts (literal): `Must receive Character Set as first parameter`,
`Type was <type name>`, `No current character key set for SaveKey` (severity
error), `Made <parameter> Keyable`, `Deleting key: <key>`.

### Shared helper behaviour (S)

**H1. Resolve the current key set.** Read the scene text parameter, trim it. If it
is not empty, look the name up in the scene dictionary without raising on failure.
The result counts only if it is a custom property; otherwise the result is
"nothing". The `IsCharacterKeySet` flag is not re-checked.

**H2. Resolve a `CharacterKeySet` argument** (used by `CreateSubCharacterKeySet`,
`AddProxyParamToCharacterKeySet`, `SelectObjectsFromCharacterKeySet`). Errors
while resolving are swallowed.

| Argument value | Result |
|---|---|
| non-empty text | the object with that full name |
| empty text (the default) | the current key set (H1) |
| a collection item | the object named by the item |
| an object | used as is |

**H3. Name prompt.** If the name argument is empty, a modal input box is shown
(title 1051, prompt 1052, pre-filled with the default name). Its text is the name;
an empty answer or Cancel aborts the command silently with no result.

**H4. Parameters to add for a set of objects.** Depends on the current marking:

- Nothing marked: all parameters of the objects that have the keyable
  capability (`siKeyable`), with no marking filter. Scaling parameters are not
  excluded.
- Something marked: the marked parameters of the objects (marking names joined
  with commas), restricted to persistable ones (`siPersistable`). Each of them
  that is a plain parameter, animatable and not keyable is made keyable unless it
  carries the "non-keyable visible" capability; in both sub-cases the line
  `Made <parameter> Keyable` is logged for every animatable non-keyable
  parameter found.

**H5. Objects of one model.** From a collection, keep the entries that belong to
a given model: a model entry is kept only when it is that model itself; any other
entry is kept when its owning model is that model.

### Depends on (commands called)

`AddProp`, `AddProxyParam`, `SetValue`, `GetValue`, `GetMarking`,
`SaveKeyOnKeyable`, `RemoveKeyOnKeyable`, `InspectObj`, `OpenAnimationEditor`,
`DeleteObj`, `SetCurrentCharacterKeySet` (same file; writes its argument as text
to the scene parameter), `SelectObj`, `DeselectAll`, `LogMessage`; native paint
commands `GetFirstPaintShapeKey`, `GetPrevPaintShapeKey`,
`GetClosestPaintShapeKey`, `GetNextPaintShapeKey`, `GetLastPaintShapeKey`,
`SavePaintShapeKey` (native overload), `SetMarking`; for the sky: `GetPrimLight`,
`GetPrim`, `CreateShaderFromProgID`, `SIConnectShaderToCnxPoint`, `ParentObj`,
`ApplyCns`, `Translate`, `SIAddArrayElement`, `ApplySunDirectionOp`,
`PickElement`.

## Wire contract

### A1. `GetCurrentCharacterKeySet`

No arguments. Returns the current key set property per H1, or "nothing" (a null
object, not an error) when the scene parameter is empty, names something that
does not exist, or names something that is not a custom property. No side
effects, nothing logged.

### A2. `GetAllCharacterKeySets`

No arguments. Returns a collection (not marked unique) of every key set in the
scene, in this order:

1. Custom properties directly on the scene root whose `IsCharacterKeySet` is
   true, in property order; each is followed immediately by its nested key sets
   (depth first).
2. Then, for each model returned by the scene root's model list, the same for
   that model's own properties.

Nested search rule: among the nested objects of a key set, every custom property
is visited; it is added when its `IsCharacterKeySet` is true, and its own nested
objects are searched whenever it has any, whether or not it was added. A
top-level custom property that is not a key set is not searched. Properties on
non-model objects are never found. Empty collection when there is none.

### A3. `CreateSubCharacterKeySet`

| Argument | Type | Default | Notes |
|---|---|---|---|
| `CharacterKeySet` | text or object | `""` | parent key set, resolved by H2 |
| `InputObjs` | collection | selection (collection handler) | objects whose parameters go into the new set |
| `Name` | text, in/out | `""` | empty opens the name prompt H3 with default `SubCharKeySet` |

Returns a collection holding the new property.

Steps:

1. Resolve the parent (H2). If the result is missing or not a custom property,
   log `Must receive Character Set as first parameter` and `Type was <type>`
   (plain info lines) and stop with no result.
2. Obtain the name (H3); stop silently if empty.
3. Add a `Custom_parameter_list` property with that name **on the parent key
   set property** (node propagation) and set its `IsCharacterKeySet` to true.
4. From `InputObjs` keep the objects of the parent key set's model (H5). If any
   remain, compute their parameters (H4) and, if there are any, add them to the
   new property as proxy parameters with `AddProxyParam`. Parameters are not
   removed from the parent set.
5. Make the new property the current key set (its full name is written to the
   scene parameter).

Errors after step 1 are swallowed (the procedure continues past failures), so a
failure in step 4 still leaves the property created and current *(inferred from
the error mode, which is switched on at entry and never off)*.

`CreateCharacterKeySet` (already in the registry as present; same file) follows
the same pattern per model of the input objects, with default name `CharKeySet`,
the property on each model (or on the scene root when there are no input
objects), a `Created <list>` log line, and the first new set made current.

### A4. `AddProxyParamToCharacterKeySet`

| Argument | Type | Default | Notes |
|---|---|---|---|
| `CharacterKeySet` | text or object | `""` | resolved by H2 |
| `InputObjs` | marked parameters | marked parameters of the selection (`MarkedParameters` handler) | parameters to add |

No return value. Resolves the key set (H2); if missing or not a custom property,
logs the same two lines as A3 step 1 and stops. Otherwise calls
`AddProxyParam <key set>, <InputObjs>` once. No keyable changes, no change of
current key set. Errors are swallowed.

### A5. `SaveKeyOnCharacterKeySet`

No arguments, no return value.

1. Resolve the current key set (H1).
2. Read the key time from `Project.Data.PlayControl.Key` (as a double).
3. If there is a current key set, read the preference
   `preferences.animation.savekeymodified` and call `SaveKeyOnKeyable` with:
   input = the key set property, time = the key time, value / tolerance / layer
   omitted (defaults), `ModifiedOnly` = the preference value.
4. If there is none, log `No current character key set for SaveKey` as an
   error; the command itself does not fail.

### A6. `SaveZeroKeyOnCharacterKeySet`

Same as A5 except the `Value` argument of `SaveKeyOnKeyable` is `0`, so every
keyable parameter of the key set gets a key of value 0 at the key time (subject
to `ModifiedOnly`). Same error line, including the word "SaveKey".

### A7. `RemoveKeyOnCharacterKeySet`

No arguments, no return value. Resolve the current key set; read the key time
from `Project.Data.PlayControl.Key`; if there is a key set call
`RemoveKeyOnKeyable <key set>, <key time>` (default tolerance and layer). With no
current key set nothing happens and nothing is logged.

### A8. `InspectCurrentCharacterKeySet`

No arguments. If there is a current key set, open it with `InspectObj` (all
other arguments default). Otherwise silent no-op.

### A9. `OpenAnimationEditorOnCurrentCharacterKeySet`

No arguments. If there is a current key set, call `OpenAnimationEditor` with the
first argument omitted and the key set as second argument. Otherwise silent
no-op.

### A10. `DeleteCurrentCharacterKeySet`

No arguments. If there is a current key set: delete it with `DeleteObj` (nested
sub key sets go with it, being nested properties), then call
`SetCurrentCharacterKeySet ""`, which clears the scene parameter. No fallback to
a parent or sibling set. Otherwise silent no-op.

### A11. `SelectObjectsFromCharacterKeySet`

| Argument | Type | Default |
|---|---|---|
| `CharacterKeySet` | text or object | `""` (current key set, H2) |

No return value.

1. Resolve the key set (H2). There is no type check here.
2. Build a unique collection: for every parameter of the key set that is a
   proxy parameter, add the 3D object that owns its master parameter; then do
   the same recursively for every nested custom property (sub key sets).
3. If the collection is not empty, select exactly those objects (`SelectObj`);
   if it is empty, including when no key set was resolved, call `DeselectAll`.

Side effect: each parameter visited is written to the log, and for proxies the
master parameter as well (two info lines per proxy, one per non-proxy). Errors
are swallowed.

### B. Paint shape key navigation: `FirstPaintShapeKey`, `PrevPaintShapeKey`, `ClosestPaintShapeKey`, `NextPaintShapeKey`, `LastPaintShapeKey`

| Command | Arguments | Native lookup called |
|---|---|---|
| `FirstPaintShapeKey` | `Shape` (collection handler) | `GetFirstPaintShapeKey(Shape)` |
| `PrevPaintShapeKey` | `Shape`, `Time` (frame handler: default current frame) | `GetPrevPaintShapeKey(Shape, Time)` |
| `ClosestPaintShapeKey` | `Shape`, `Time` | `GetClosestPaintShapeKey(Shape, Time)` |
| `NextPaintShapeKey` | `Shape`, `Time` | `GetNextPaintShapeKey(Shape, Time)` |
| `LastPaintShapeKey` | `Shape` | `GetLastPaintShapeKey(Shape)` |

No return value. Each calls the native lookup; if it returns a key object, the
key's `time` parameter is read and written to
`Project.Data.PlayControl.Current` (the timeline jumps to the key). If no key is
returned nothing changes. The lookups themselves are native (not in this row).

### B6. `DeletePaintShapeKey`

Arguments `Shape` (collection), `Time` (frame). No return value.

1. Find the key closest to `Time` with `GetClosestPaintShapeKey(Shape, Time)`.
2. If one is found, compare its `time` with the **current frame**
   (`Project.Data.PlayControl.Current`, not the `Time` argument). If they differ
   by less than 0.001, log `Deleting key: <key>` and delete the key with
   `DeleteObj`. Otherwise do nothing.

So a key is deleted only when the timeline sits on it.

### B7. `SavePaintShapeKey` (script entry)

Arguments `Shape`, `Time` (in/out in the registry). No return value.

1. Read the key time from `Project.Data.PlayControl.Key`.
2. Save a shape key for `Shape` at that key time by calling `SavePaintShapeKey`
   with two arguments. The registry holds a second, native entry with the same
   scripting name (collection and frame handlers); the call is taken to reach
   that native entry *(inferred; otherwise the script would recurse)*.
3. If the `Time` argument differs from the key time, set
   `Project.Data.PlayControl.Current` to the key time. The `Time` argument is not
   written back to the caller (JScript procedures cannot return in/out values).

### B8. `PaintShapeManipTool`

No arguments. Sets the marking to `PosX,PosY,SclX,SclY,PivX,PivY,RotZ` and sets
`PaintTool.CurrentTool` to `80` (the select-shape tool of FX paint).

### C. `AddPhysicalSky`

| Argument | Type | Default | Notes |
|---|---|---|---|
| `Pass` | pass object | none (required) | its full name is used for every path below |
| `LightName` | text | none | name of the sun light, searched under the scene root |
| `ConstrainLight` | boolean | none | only used when the light is created |
| `UseToneMap` | boolean | none | add and configure the photographic exposure lens shader |

The command is registered with logging off (`siNoLogging`) and the return-value
flag on, but the procedure hands back nothing (undefined).

Steps:

1. Look for a descendant of the scene root called `LightName`.
2. **If no such object exists**, with the auto-inspect preference
   (`preferences.Interaction.autoinspect`) switched off for the duration and
   restored afterwards:
   1. create an infinite light named `LightName` (`GetPrimLight
      "Infinite.Preset"`); from here on the light's actual full name is used;
   2. create a shader `Softimage.mia_physicalsun.1.0` owned by the light
      primitive and connect it to both the `LightShader` and `PhotonShader`
      parameters of the light primitive (`SIConnectShaderToCnxPoint`, third
      argument true);
   3. if `ConstrainLight`: create a null `XSI_Center_Of_World`, set its
      `visibility.viewvis`, `visibility.rendvis` and `visibility.selectability`
      to false, parent the light under it, apply a `Direction` constraint from
      the light to the null, set the constraint's `dirx, diry, dirz` to
      `0, 0, -1`, then translate the light by `(0, 3, -19)`. The null is
      addressed by its literal name.
3. Append an element to the pass's `EnvironmentShaderStack`
   (`SIAddArrayElement`), create a shader `Softimage.mia_physicalsky.1.0` owned
   by the pass, and connect it to the new stack element (third argument false).
4. If `UseToneMap`: append an element to the pass's `LensShaderStack`, create
   `Softimage.mia_exposure_photographic.1.0` on the pass and connect it there.
5. Drive the sun shader from the sky shader with expressions. For each pair the
   expression is put on the sun parameter and reads the sky parameter, and the
   pair is skipped silently when either parameter is missing:

   | Sky parameter (source) | Sun parameter (driven) |
   |---|---|
   | `multiplier` | `mulitplier` (as spelt; no such parameter is expected, so this link is normally skipped) |
   | `haze` | `haze` |
   | `redblueshift` | `redblueshift` |
   | `saturation` | `saturation` |
   | `horizon_height` | `horizon_height` |
   | `rgb_unit_conversion` | `rgb_unit_conversion`, per component `red`, `green`, `blue`, `alpha` |

6. Call `ApplySunDirectionOp` with input `<light>.kine.global` and outputs
   `<pass>.<sky shader name>.sun_direction.x`, `.y`, `.z`.
7. Set values:

   | `UseToneMap` | Parameter | Value |
   |---|---|---|
   | true | sky `multiplier` | 1.0 |
   | true | sky `rgb_unit_conversion.red/green/blue` | 0.318 each |
   | true | pass `OverrideCameraLensShaders` | 3 |
   | true | exposure `f_number` | 16 |
   | true | exposure `cm2_factor` | 1 |
   | true | exposure `burn_highlights` | 0.02 |
   | true | exposure `gamma` | 1 |
   | false | sky `multiplier` | 0.01 |
   | false | sky `rgb_unit_conversion.red/green/blue` | 0.001 each |

**When the light already exists**, step 2 is skipped entirely, so no sun shader
is created by this call. Steps 5 and 6 then have no sun shader to work with and
the script fails at step 5 with a script error, after the pass shaders of steps
3 and 4 have been added *(inferred from the reading; needs a golden, Q3)*.

Menu and dialog (same plug-in, recorded for PROP rows):

- Menu item "Initialize Sky Shader" on the pass editor menu anchor
  `siMenuTbRenderPassEditID`.
- It adds a transient custom property `Sky_Shader_Setup` on the scene root and
  inspects it modeless in recycle mode with title id 1172.

  | Parameter | Type | Default | Control |
  |---|---|---|---|
  | `EnumCtrl` | int4 | 0 | combo "Pass": one entry per scene pass, label = pass name, value = pass index |
  | `UseToneMap` | bool | last value used, initially true | checkbox, label id 1515 |
  | `LightName` | string | last name used, initially `XSI_Physical_Sun` | text "Sun Name", followed on the same row by button `Pick` |
  | `LightConstrain` | bool | last value used, initially true | checkbox "If creating new light, constrain direction to World center" |

  Groups: "Please select the render pass for the Sky Shader:" (combo, tone map
  checkbox) and "Sun:" (static text "If the specified light does not exist, it
  will be created.", name + Pick, constrain checkbox); then buttons `Apply` and
  `Cancel` on one row.
- `Pick`: pick session with the light filter, both prompts id 1173; the picked
  element's full name goes into `LightName`.
- `Apply`: remembers the three settings for the session (an empty light name
  keeps the previous one), runs `AddPhysicalSky <pass at index>, <name>,
  <constrain>, <tone map>`, deletes the property and closes the inspector.
- `Cancel`: deletes the property and closes the inspector.

## Enable conditions and errors

No command in this batch has an enable condition; all are always enabled. Group
A commands never raise: failures are logged or swallowed as described. Group B
raises only what the native lookups raise. `AddPhysicalSky` raises script errors
for a missing pass or the existing-light case above.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | Does the two-argument call in B7 reach the native `SavePaintShapeKey` entry (registry has two entries with this scripting name), and what does the native entry do with the frame | find the native registration in the FX paint binary; or golden |
| Q2 | Behaviour of the five native lookups (`Get…PaintShapeKey`) and the meaning of tool id 80 among the `PaintTool.CurrentTool` values | native FX paint commands are still TODO in CMD-01 |
| Q3 | `AddPhysicalSky` when the named light already exists: confirm the script error and what is left in the pass | XSIBATCH golden with a pre-existing light |
| Q4 | `ApplySunDirectionOp` (`Application\Plugins\SunDirectionOp.js`) is not in the registry dump; its operator maths is not specified here | read that plug-in (2,588 bytes); new row |
| Q5 | A1: when the stored name resolves to nothing, does the dictionary lookup log a warning in the history | golden |
| Q6 | A3/A4 with a `CharacterKeySet` that is a non-key-set custom property: accepted (only the type is checked). Confirm no later rejection by `AddProxyParam` | golden |
