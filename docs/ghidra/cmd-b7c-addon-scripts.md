# CMD-B7c: script commands of the shipped add-ons (Cache Manager, Render Manager, render tree user tools, Lagoa, ICE flow builder, SDK UI helpers, Polygonizer)

Row: **CMD-B7c** (batch grouped by add-on). Status: **SPEC** for 27 commands,
**SPEC-PARTIAL** for 2 (`GetShaderDefHelper`, `GetWizardParamTab`: the template
files their code generators expand are not in the staged install).
Run: 2026-11-17, `si-analyst`, unattended.

29 scripting names, each implemented in JScript or VBScript inside a
self-installing plug-in under `Addons\<addon>\Application\Plugins`. Every
plug-in registers its items in `XSILoadPlugin`; a command `X` is described by
`X_Init` (arguments, flags) and run by `X_Execute`.

| Command | Add-on | File | Language | Returns |
|---------|--------|------|----------|---------|
| `AddToList` | CacheManager | `CacheManager.js` | JScript | nothing |
| `GetItemsAsString` | CacheManager | `CacheManager.js` | JScript | string |
| `GetObjectsFromSource` | CacheManager | `CacheManager.js` | JScript | array of 3 strings |
| `ReadCachesFile` | CacheManager | `CacheManager.js` | JScript | nothing (empty stub) |
| `RefreshCachesPathProp` | CacheManager | `CacheManager.js` | JScript | nothing |
| `RemoveFromList` | CacheManager | `CacheManager.js` | JScript | nothing |
| `RemoveNumbering` | CacheManager | `CacheManager.js` | JScript | string |
| `SelectionValueToItemName` | CacheManager | `CacheManager.js` | JScript | array of strings |
| `UpdateCacheManager` | CacheManager | `CacheManager.js` | JScript | nothing |
| `WriteCachesFile` | CacheManager | `CacheManager.js` | JScript | nothing (writes a file) |
| `GetCacheOnFile` | CacheManager | `CacheManagerVBS.vbs` | VBScript | collection of ICE nodes |
| `OpenOutputFormatPreferences` | RenderManager | `RenderManager.vbs` | VBScript | true |
| `OverrideMarkedPassParameters` | RenderManager | `RenderManager.vbs` | VBScript | true |
| `DeleteUnusedShaders` | RTUserTools | `RTUserTools.js` | JScript | nothing |
| `RTShaderSetCategories` | RTUserTools | `RTShaderCategories.js` | JScript | true, or nothing |
| `LagoaDisplayType` | Lagoa | `Lagoa_Commands.js` | JScript | nothing |
| `LagoaEmitMPVolume` | Lagoa | `Lagoa_Commands.js` | JScript | true |
| `LagoaTagCollisionObject` | Lagoa | `Lagoa_Commands.js` | JScript | nothing |
| `LagoaSetupAdvectMesh` | ICEFlowBuilder | `ICEfxBuilder.vbs` | VBScript | true |
| `LagoaSetupClothMesh` | ICEFlowBuilder | `ICEfxBuilder.vbs` | VBScript | true |
| `ICEFlowInsertSimulationRoot` | ICEFlowBuilder | `ICEFlowInsertSimulationRoot.vbs` | VBScript | true, or nothing on early exit |
| `SIGetExternalFilesViewerProp` | sdkui | `ExternalFileListViewer.js` | JScript | custom property |
| `SISetExternalFilesManagerTarget` | sdkui | `ExternalFileListViewer.js` | JScript | nothing |
| `ConnectToWorkgroupUI` | sdkui | `PluginTreeActions.js` | JScript | path string, `""`, or nothing |
| `GetShaderDefHelper` | sdkui | `ShaderDefHelper.js` | JScript | helper object |
| `GetWizardParamTab` | sdkui | `WizardParamTab.js` | JScript | helper object |
| `PPGLayoutControl` | sdkui | `PPGLayoutControl.js` | JScript | helper object |
| `SDKGetScriptGenerator` | sdkui | `SDKScriptGenerator.js` | JScript | writer object, or nothing |
| `Create_Polygonizer_Polymesh` | Polygonizer | `Create_Polygonizer_PolymeshPlugin.vbs` | VBScript | true |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | scripting / display names, arguments and defaults, argument handlers, `return_value`, key-assignable flag, description, category (`Custom` for all 29), handler name |
| (S) | the shipped plug-in scripts under `Softimage 2015 SP2\Addons\`, read on 2026-11-17: `CacheManager\…\CacheManager.js` (35,585 bytes), `CacheManagerVBS.vbs` (1,640), `RenderManager\…\RenderManager.vbs` (15,079), `RTUserTools\…\RTUserTools.js` (14,726), `RTShaderCategories.js` (25,787), `Lagoa\…\Lagoa_Commands.js` (6,552), `ICEFlowBuilder\…\ICEfxBuilder.vbs` (66,371; registration, the two command procedures), `ICEFlowInsertSimulationRoot.vbs` (6,423), `ICEFlowCommonTools.js` (only the three helper methods the in-scope commands call), `sdkui\…\ExternalFileListViewer.js` (52,811; registration, the two commands, property definition, layout, grid fill), `PluginTreeActions.js` (63,592; registration, the command and its dialog helpers), `ShaderDefHelper.js` (62,512), `WizardParamTab.js` (42,152), `PPGLayoutControl.js` (29,096), `SDKScriptGenerator.js` (44,996), `SDKWizards.js` (four small grid helpers only), `Polygonizer\…\Create_Polygonizer_PolymeshPlugin.vbs` (2,061) | everything in the contracts below |
| - | binaries | not used; nothing here is implemented in C++ |
| - | XSIBATCH golden | not run |
| - | `XSIPLUGINUI` / `XSISCRIPTS` / `EXTPOLYGONIZER` dictionaries | not decoded for this batch; translated texts are given by id or by key, with the English text only where a script comment states it |

No script text is reproduced. Names, ids, message strings, parameter script
names, values and written file layouts are recorded as facts. Items marked
*(inferred)* follow from language or object-model rules, not from a run.

## Plug-in registration

| Plug-in file | Plug-in name, version, author | Commands (display name → scripting name) | Properties | Menus (anchor → menu handler) | Events |
|--------------|-------------------------------|------------------------------------------|------------|-------------------------------|--------|
| `CacheManager\…\CacheManager.js` | "Cache Manager" 1.0, Softimage | "Update Cache Manager" → `UpdateCacheManager`; "Refresh CachesPathProp" → `RefreshCachesPathProp`; `WriteCachesFile`; `ReadCachesFile`; `RemoveFromList`; `GetItemsAsString`; `AddToList`; `RemoveNumbering`; `SelectionValueToItemName`; `GetObjectsFromSource` | `CachesPathProp`, `CacheOnFileListProp` | `siMenuTbAnimateToolsPlotID` → `OpenCacheManager` (one callback item "Cache Manager...") | - |
| `CacheManager\…\CacheManagerVBS.vbs` | "CacheManagerVBS" 1.0, Softimage | `GetCacheOnFile` | - | - | - |
| `RenderManager\…\RenderManager.vbs` | "RenderManager" 1.0, Softimage | "Update Render Manager" → `UpdateRenderManager`; "Make Renderer Local to Pass" → `MakeRendererLocalToPass`; "Make Pass Renderer Global" → `MakePassRendererGlobal`; "Override Marked Pass Parameters" → `OverrideMarkedPassParameters`; "Render Current Frame" → `RenderCurrentFrame`; "Render Current Frame All Passes" → `RenderCurrentFrameAllPasses`; "Copy Render Options " (trailing space) → `CopyRenderOptions`; "Open Rendering Preferences" → `OpenRenderingPreferences`; "Open Output Format Preferences" → `OpenOutputFormatPreferences` | `CopyPassOptions` | `siMenuTbRenderRenderID` → `OpenRenderManager`; `siMenuTbRenderRegionID` → `RegionCopyOptions` | - |
| `RTUserTools\…\RTUserTools.js` | "RTUserTools" 1.1, Softimage | `DeleteUnusedShaders` | - | `siMenuRenderTreeToolsID` → `RTUserTools_Menu` | `OnCreateShader` on `siOnCreateShader` |
| `RTUserTools\…\RTShaderCategories.js` | "RTShaderCategories" 1.1, Softimage | `RTShaderSetCategories` | - | - | `RTShaderSetCategoriesEvent` on `siOnStartup` |
| `Lagoa\…\Lagoa_Commands.js` | "Lagoa MP plugin" 1.0, Lagoa Technologies | `LagoaEmitMPVolume`; "Lagoa Display Type" → `LagoaDisplayType`; `LagoaTagCollisionObject` | - | - | - |
| `ICEFlowBuilder\…\ICEfxBuilder.vbs` | "ICEfxBuilder" 1.0, Autodesk | `LagoaSetupAdvectMesh`; `LagoaSetupClothMesh` | - | 26 dynamic, non-submenu menus on the ICE toolbar anchors (table in "Not covered") | - |
| `ICEFlowBuilder\…\ICEFlowInsertSimulationRoot.vbs` | "ICEFlowInsertSimulationRoot" 1.0, Softimage | `ICEFlowInsertSimulationRoot` | - | `siMenuICENodeContextID` → `ICETreeContextMenu_Menu` (dynamic) | - |
| `sdkui\…\ExternalFileListViewer.js` | "External Files Manager" 2.1, Alain Dessureaux - Softimage | `SIGetExternalFilesViewerProp`; `SISetExternalFilesManagerTarget` | `CExternalFilesViewer`, `CCopyFilesDialog`, `CSearchAndReplaceDialog` | - | - |
| `sdkui\…\PluginTreeActions.js` | "PluginTreeActions Plug-in" 1.0, Softimage | `ConnectToWorkgroupUI` | - | 20 menus on the Plug-in Manager, Workgroup Manager and property-page context anchors, plus `siMenuTbAnimateCreateParameterCustomPSetID` → `CustomPSetWizardInAnimateParameter` (table in "Not covered") | - |
| `sdkui\…\ShaderDefHelper.js` | "ShaderDefHelper" 1.0, Autodesk | `GetShaderDefHelper` | - | - | - |
| `sdkui\…\WizardParamTab.js` | "WizardParamTab" 1.0, Softimage | `GetWizardParamTab` (registered with one name only) | - | - | - |
| `sdkui\…\PPGLayoutControl.js` | "PPGLayoutControl" 1.0, Softimage | `PPGLayoutControl` | - | - | - |
| `sdkui\…\SDKScriptGenerator.js` | "SDK Script Generator" 1.1, Softimage; plug-in and item category "Wizard" | `SDKGetScriptGenerator` | - | - | - |
| `Polygonizer\…\Create_Polygonizer_PolymeshPlugin.vbs` | "Create_Polygonizer_PolymeshPlugin" 1.0, Eric Mootz | `Create_Polygonizer_Polymesh` | - | `siMenuTbModelCreatePolygonMeshID` → `Create_Polygonizer_Polymesh_Menu` (one command item, label = key "Polygonizer" of dictionary `EXTPOLYGONIZER`, runs the command) | - |

Unload: `RenderManager` logs `<plug-in name> has been updated.` (verbose);
`RTUserTools`, `RTShaderCategories`, `Lagoa MP plugin`, `ICEfxBuilder`,
`ICEFlowInsertSimulationRoot` log `<plug-in name> has been unloaded.`
(verbose); the others log nothing.

## Shared facts

### Command flags (S, R)

| Command | Logging | Key-assignable | Return flag | Notes |
|---------|---------|----------------|-------------|-------|
| `UpdateCacheManager`, `RefreshCachesPathProp`, `GetItemsAsString`, `RemoveNumbering`, `SelectionValueToItemName`, `GetObjectsFromSource`, `GetCacheOnFile` | off (`siNoLogging`) | no | yes | - |
| `AddToList`, `RemoveFromList` | off | no | **no** | - |
| `WriteCachesFile` | on | no | yes | procedure returns nothing |
| `ReadCachesFile` | on | default | yes | registry lists it as not key-assignable |
| `OpenOutputFormatPreferences` | off | yes | yes | - |
| `OverrideMarkedPassParameters` | on | yes | yes | no `_Init` procedure in the file; all flags are defaults |
| `DeleteUnusedShaders` | on | yes | yes | `_Init` only adds the argument |
| `RTShaderSetCategories` | off | yes | yes | - |
| `LagoaEmitMPVolume`, `LagoaTagCollisionObject`, `LagoaDisplayType` | off | yes | yes | - |
| `LagoaSetupAdvectMesh`, `LagoaSetupClothMesh`, `ICEFlowInsertSimulationRoot`, `Create_Polygonizer_Polymesh` | on | yes | yes | - |
| `SIGetExternalFilesViewerProp`, `SISetExternalFilesManagerTarget`, `GetShaderDefHelper`, `GetWizardParamTab`, `PPGLayoutControl`, `SDKGetScriptGenerator` | off | no | yes | - |
| `ConnectToWorkgroupUI` | off | yes | yes | also `siCannotBeUsedInBatch`; description "Ask user to pick a workgroup and connect to it" (the only non-empty description of the 29) |

All arguments are plain inputs (direction flag 2). None of the commands has an
enable condition.

### List-box item convention of the Cache Manager helpers (S)

Five Cache Manager commands (`AddToList`, `RemoveFromList`, `GetItemsAsString`,
`SelectionValueToItemName`, `RemoveNumbering`) work on the `UIItems` of a
list-box layout item: a flat array of label / value pairs. They keep the pairs
in the numbered form

- label: `<n> : <text>` (number, space, colon, space, text),
- value: `<n>:` (number, colon),

with `n` counting from 0 in list order. A multi-selection in such a list box
is the string of selected values joined by `;` (example given in the script:
selection `0:;1:` stands for the labels `0 : Cone` and `1 : Cube`).

### Translated texts referred to by id (S)

| Dictionary | Id / key | Constant | English text (only where the script states it) | Used by |
|------------|----------|----------|-----------------------------------------------|---------|
| `XSIPLUGINUI` | 7158 | - | "This workgroup directory does not exist" + newline + path | `ConnectToWorkgroupUI` |
| `XSIPLUGINUI` | 7164 | `IDS_WORKGROUP_CHANGE_NEED_XSI_RESTART` | not stated | `ConnectToWorkgroupUI` |
| `XSIPLUGINUI` | 7191 | `IDS_ACTION_FAILED_MSG` | not stated (takes the error description) | `ConnectToWorkgroupUI` |
| `XSIPLUGINUI` | keys "Connect to Workgroup", "This workgroup is already in the list", "Pick the root location of an existing workgroup", "Directory", "Try SDK Example Workgroup", "Connect...", "Insert Simulation Root" | - | the key is the English text | `ConnectToWorkgroupUI`, `ICEFlowInsertSimulationRoot` menu |
| `XSIPLUGINUI` | 7214, 7216, 7217 | `IDS_STRING_SEARCH_REPLACE_TITLE`, `IDS_SEARCH_STRING_IN_FILE_PATHS`, `IDS_REPLACE_STRING_IN_FILE_PATHS` | not stated | Cache Manager and External Files search-and-replace dialog |
| `XSIPLUGINUI` | 8000 to 8005 | `IDS_USER_PATH`, `IDS_FILE_TYPE`, `IDS_STATUS`, `IDS_RESOLVED_PATH`, `IDS_ALIENBRAIN`, `IDS_OWNER` | not stated (grid column headers) | `CExternalFilesViewer` |
| `XSIPLUGINUI` | 7203 to 7211 | `IDS_SPECIFY_ITEM_NAME_MSG`, `IDS_SPECIFY_UNIQUE_ITEM_NAME_MSG`, `IDS_ITEM_NOT_FOUND_IN_SCENE_MSG`, `IDS_INVALID_RANGE_MSG`, `IDS_DEFAULT_CANNOT_LESS_THAN_MIN_MSG`, `IDS_DEFAULT_CANNOT_GREATER_THAN_MAX_MSG`, `IDS_UIMIN_CANNOT_LESS_THAN_MIN_MSG`, `IDS_UIMAX_CANNOT_GREATER_THAN_MAX_MSG`, `IDS_UIMAX_MUST_GREATER_THAN_UIMIN_MSG` | not stated | `GetWizardParamTab` object |
| `XSIPLUGINUI` | 7120, 7123, 7223, 7229 to 7243 | `IDS_NAME`, `IDS_TYPE`, `IDS_NO_PARAMETER_DEFINED_MSG`, `IDS_GRID_DEFAULT_LABEL`, `IDS_DESCR_LABEL` (7230), `IDS_TEXTURABLE` (7231), `IDS_ANIMATABLE` (7232), `IDS_INSPECTABLE` (7233), `IDS_HLMIN_LABEL` (7234), `IDS_HLMAX_LABEL` (7235), `IDS_SLMAX_LABEL` (7236), `IDS_SLMIN_LABEL` (7237), `IDS_ATTRIB_LABEL` (7238), `IDS_NO_OPTION_DEFINED_MSG` (7239), `IDS_VALUE` (7240), `IDS_ATTRIB_VALUE_LABEL` (7241), `IDS_MAIN` (7242), `IDS_READONLY` (7243) | not stated | `GetShaderDefHelper` object |
| `XSISCRIPTS` | 1183, 1188 | `IDS_DEL_UNCONNECTED_NODE_MENU`, `IDS_CREATE_SSS_LIGHTMAP_MENU` | not stated | render tree Tools menu items |

## Wire contract: CacheManager

### `RemoveNumbering` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `inString` | none | a list label, normally `<n> : <text>` |

Returns the label without its number prefix.

1. Find the first `:` in the string. Take the characters before it, minus the
   last one (the space), and read them as an integer.
2. If that integer is 0 or more, return everything starting two characters
   after the colon (so `3 : Cone` gives `Cone`).
3. Otherwise (no colon, no leading number, negative number) return the input
   unchanged.

Errors: a non-string argument is a script error *(inferred)*.

### `AddToList` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `PPG` | none | the property page; only refreshed |
| `dataArray` | none | array of texts to add (numbered or not) |
| `ppgItem` | none | the layout item object of the list box (not its name) |
| `multiInstance` | none | true: allow a text that is already in the list |

Steps:

1. Read the current pairs from `ppgItem.UIItems`.
2. Decide which texts are new. If the list already has entries: each element of
   `dataArray` is kept unless `multiInstance` is false and its un-numbered text
   equals the un-numbered label of an existing entry. If the list is empty,
   every element is kept. Kept texts are un-numbered with the `RemoveNumbering`
   rule. Duplicates inside `dataArray` itself are not filtered.
3. Append one pair per kept text, numbering on from the current pair count:
   label `<n> : <text>`, value `<n>:`.
4. Write the array back to `ppgItem.UIItems` and call `PPG.Refresh`.

Returns nothing. No guards: a wrong `ppgItem` is a script error.

### `RemoveFromList` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `PPG` | none | the property page |
| `in_FromList` | none | script name of the list-box item / parameter |
| `selected` | none | values to remove, joined by `;`. When null, the value of parameter `in_FromList` on the first inspected object (`PPG.Inspected(0)`) is used |

Steps:

1. Read the pairs of layout item `in_FromList`.
2. If the selection string is empty, stop (list untouched, no refresh).
3. Keep every pair whose value is not one of the selected values. Renumber the
   kept pairs from 0: label `<k> : <un-numbered old label>`, value `<k>:`.
4. Write the new array to the item's `UIItems`, `PPG.Refresh`.

Returns nothing. Every failure inside the procedure is swallowed silently.

### `GetItemsAsString` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `PPG` | none | the property page |
| `in_ItemName` | none | script name of the list-box item |

Returns the un-numbered labels of the list, in list order, joined by `,` (no
space). An empty list, or a failure to read the item, gives an empty string.

### `SelectionValueToItemName` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `PPG` | none | the property page |
| `in_splitSel` | none | array of selected values (the selection string already split on `;`) |
| `in_FromList` | none | script name of the list-box item |

Returns an array with, for each element of `in_splitSel` in order, the label
(number prefix **kept**) of the first pair whose value equals it. Values with
no matching pair contribute nothing. A missing item is a script error (no
guard).

### `GetObjectsFromSource` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `inSource` | none | a cache source object (an owner of a "Caches" external file) |

Returns a three-element array: `[0]` full name of the source, `[1]` full names
of the mixer cache clips that use a source of that name, joined by `;`, `[2]`
the objects those clips drive, joined by `;`. `[1]` and `[2]` are empty strings
when no clip is known.

Steps:

1. The mixer is the source's `Parent`.
2. Two lookup tables are kept at plug-in level: mixers already scanned (by
   mixer name) and per-source results (by source **name**). They are created
   here if absent.
3. If the parent's type is `Mixer` and that mixer name has not been scanned:
   mark it scanned, then for every clip of the mixer whose type is
   `mixercacheclip`: start from the entry already stored for the clip's source
   name (if any), append the clip's full name to the clip list, and for each
   mapped item of the clip append the parent of the item's destination to the
   object list; store the entry under the clip's source name.
4. Look the result up under `inSource.Name`.

The tables are emptied by the Cache Manager grid fill (which resets them before
and discards them after each fill) but not by the command itself: a direct
second call for a source under an already scanned mixer returns the stored
answer without looking at the scene again. Because the key is the source name,
sources of the same name under different mixers share one entry *(inferred)*.

### `WriteCachesFile` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `FileName` | none | full path of the file to write |
| `objects` | none | object names in one string, separated by `,` |
| `StartFrame`, `EndFrame`, `Step` | none | written as given |
| `Type` | none | written as given |
| `ResolvedPath` | none | written as given |

Creates (or overwrites) `FileName` as a non-Unicode text file through
`Scripting.FileSystemObject`, one item per line, in this layout:

| Line | Content |
|------|---------|
| 1 | `[General]` |
| 2 | `Start=<StartFrame>` |
| 3 | `End=<EndFrame>` |
| 4 | `Step=<Step>` |
| 5 | `Type=<Type>` |
| 6 | `Path=<ResolvedPath>` |
| 7 | `[Parts]` |
| 8… | one line per piece of `objects` split on `,`: `<piece>=<piece>` (pieces are not trimmed) |

Lines end with the file object's `WriteLine` terminator (carriage return +
line feed *(inferred)*). Returns nothing. Errors: an unwritable path or a
non-string `objects` is a script error; nothing is caught.

### `ReadCachesFile` (SPEC)

Same seven arguments as `WriteCachesFile` (`FileName`, `objects`,
`StartFrame`, `EndFrame`, `Step`, `Type`, `ResolvedPath`; no defaults). The
procedure body is empty: nothing is read, nothing is changed, nothing is
returned.

### `RefreshCachesPathProp` (SPEC)

No arguments. Refills the grid of the plug-in's current `CachesPathProp`
instance (the one created by the "Cache Manager..." menu item or by
`UpdateCacheManager`). If no instance exists the call ends in a script error
*(inferred: no guard)*. Returns nothing. The page is not refreshed by the
command.

**`CachesPathProp`** (custom property "Scene Animation Cache Path"):

- one grid parameter `CachePathGrid`, 7 columns: 0 "Objects", 1 "User Path
  (Usr)", 2 "Valid", 3 "Resolved Path (Res)", 4 "Guid", 5 "Source", 6 "Clip";
  row label of row 0 is four spaces;
- layout: an unnamed group with six buttons, each 130 wide, the first five
  continuing on the same line: `BntSelectSceneObjects` "Select Scene
  Objects", `BntOpenMixer` "Open Mixer", `BntBrowse` "Browse Selected Path",
  `BntSearchAndReplace` "Search and Replace", `BntDelete` "Delete
  Sources/Clips", `BntDeleteUnusedSource` "Delete Unused Sources"; then the
  grid without label, header selection mode, read-only columns
  `1:0:1:1:1:1:1` (only the user path is editable), shown columns
  `1:1:1:1:0:0:0`.

**Grid fill.** Rows are cleared, then one row is added for each entry of the
active scene's `ExternalFiles` whose `FileType` is `Caches` and which still has
a first owner. Per row:

| Column | Value |
|--------|-------|
| 1 | the file's `Path` (if not empty) |
| 3 | `ResolvedPath`, or the first file of the sequence when the entry is a sequence of more than one file |
| 2 | `valid` if the file exists, else `invalid` |
| row colour | exists: RGB 166, 168, 171; missing: RGB 184, 137, 137 |
| 0, 5, 6 | from `GetObjectsFromSource` on the first owner: objects, source full name, clips (column 6 is written only when the source name is not empty) |
| 4 | the file's `GUID` |

**Page behaviour** (for the view, not part of the command): opening fills the
grid and refreshes; editing a user path writes it to the external file with
that GUID and rebuilds the row; "Select Scene Objects" selects the objects
named in column 0 of the selected rows; "Open Mixer" does the same and opens
the view "Animation Mixer"; "Browse Selected Path" asks for a file (dialog
title "Select a File", initial folder of the last selected row) and assigns it
to every selected row; "Search and Replace" opens the
`CSearchAndReplaceDialog` property modally (name "Search and Replace Strings in
Paths", title id 7214) over the selected rows, or all rows when none is
selected (placeholder row "No Files Selected..." when there are none), then
runs `SearchAndReplacePath` and logs `Failed to perform SearchAndReplacePath -
<reason>` on failure; "Delete Sources/Clips" deletes the objects named in
column 5 of the selected rows; "Delete Unused Sources" runs
`DeleteUnusedCacheSources`; the last three refill the grid.

### `UpdateCacheManager` (SPEC)

No arguments, returns nothing. For **every** view of the active layout whose
type is `Cache Manager`, in this order:

| Step | Sub-view of the Cache Manager | `targetcontent` attribute set to |
|------|-------------------------------|----------------------------------|
| 1 | `WriteAnimationTab` | full name of the scene object found under the name `WriteAnimation`, or empty string if there is none |
| 2 | `ReadAnimationPPG` | same for `ReadAnimation` |
| 3 | `CachesPathPPG` | full name of the plug-in's `CachesPathProp` instance; created first (stand-alone, named "Scene Animation Cache Path") if none exists yet |
| 4 | `SimulationPPG` | if `Environments.Environment.simtimectrl` exists: first set `Environments.Environment.simtimectrl.cacheppg` to true, then its full name; otherwise empty string |
| 5 | `CacheOnFilePPG` | full name of the plug-in's `CacheOnFileListProp` instance; created first (named "Scene Simulation Cache on File nodes") if none exists yet |

With no Cache Manager view open nothing happens. The menu item "Cache
Manager..." discards both property instances, creates fresh ones with the same
names and opens the view `Cache Manager`.

**`CacheOnFileListProp`**: one grid `CachePathGrid`, 2 columns ("Cache On
File", "Resolved Path (Res)"); layout group "Cache On File nodes" with button
`BntSelectSceneObjects` labelled "Inspect" (130 wide) and the grid (no label,
header selection, both columns read-only and shown). On open the grid gets one
row per node returned by `GetCacheOnFile`: column 0 the node's full name,
column 1 the value of its `ResolvedFilePath` parameter. "Inspect" opens a
property page on the nodes named in the selected rows.

### `GetCacheOnFile` (SPEC)

No arguments. Returns a new collection of ICE nodes.

1. Get every ICE tree of the scene (`FindObjects2` with `siICETreeID`).
2. Walk each tree depth-first, starting with the tree itself: a node whose
   `Name` is exactly `Cache on File` and whose `filemode` parameter value is
   **2** (read mode, per the script comment) is added; any node that is a node
   container (`siICENodeContainerID`) has its `Nodes` walked the same way.
3. Return the collection (empty when there is no tree).

## Wire contract: RenderManager

### `OpenOutputFormatPreferences` (SPEC)

No arguments. Opens a property page on `preferences.output_format`
(`InspectObj`, default mode) and returns true.

### `OverrideMarkedPassParameters` (SPEC)

No arguments. Works on the first selected object and the current parameter
marking. All errors are suppressed for the whole procedure. Always returns
true.

1. Entry test on the first selected object: its class is `Property`, **or**
   its class is `CustomProperty` and its parent's type is `Pass`. (The parent
   test only binds to the second alternative.) If the test fails: warning
   `Please select a pass global renderer`, done.
2. Read the marked parameters (`GetMarking`). If the first entry is empty:
   warning `Please mark some parameters on pass global renderer`, done.
3. If the parent of the selected property is not of type `Pass`: warning
   `Please select a pass global renderer`, done.
4. The pass is that parent. Look up the object `<pass>.PassOverride`. If the
   lookup fails, add a property from preset `Override` to the pass, not
   branched, named `PassOverride`.
5. For each marked entry, in order: `SIAddEntryToOverride <override>,
   "<selected property>.<entry>"`.
6. Open a property page on the override property.

Notes: the "lookup failed" test reads the script error state, which is not
cleared beforehand, so an error raised earlier in the procedure also leads to
the "add property" branch *(inferred)*. With an empty selection the entry test
itself raises; under error suppression the statements of the first branch then
run and fail one by one *(inferred)*, so the visible result is at most a
warning.

## Wire contract: RTUserTools

### `DeleteUnusedShaders` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `container` | none (null) | one object or a list of shader containers; null means the current selection |

Returns nothing. Each container is processed independently, in order.

**Container resolution.** If the object's type is `light` and its parent's type
is `light`, or `camera` under `camera`, the parent is used. The resulting
container must be of type `light`, `camera`, `material`, `Pass` or `Shader`;
any other type is skipped silently.

**Pass 1, unconnected shader trees.** Repeat until a full scan deletes nothing:

1. Enumerate every shader owned by the container (`GetAllShaders`).
2. Skip a shader that is fed, directly or through any chain of upstream
   shaders, by an input of the container itself. This test only applies when
   the container is a shader compound (`Shader` with shader type
   `siShaderCompound`); it walks every input parameter that has a known type
   and a source.
3. Collect the shader's **roots** (unique): follow every target of every
   output parameter downstream, recursively. A walk ends at the container
   itself; at any object of type `material`, `light`, `camera` or `pass`
   (lower-case comparison); or at a shader with no outgoing connection, which
   is itself a root. A shader that exposes no output parameter and is a plain
   shader (`siShader`) is walked through its single unnamed output. Objects
   that are not shaders, and shaders that are neither plain nor compound (for
   example comments), end the walk without becoming roots.
4. Remove the container from the root set. For every remaining root of type
   `Shader` or `ImageClip`: `DisconnectAndDeleteOrUnnestShaders <root>,
   <container>`.
5. If anything was deleted, restart the scan from step 1 with a fresh shader
   list.

**Pass 2, image clips.** For every clip of the container's `AllImageClips`,
from last to first: if none of the clip's shader-parameter targets belongs to
a shader owned by the container (list taken once, after pass 1), run
`DisconnectAndDeleteOrUnnestShaders <clip>, <container>`. Here the container
passed is the **original argument**, not the resolved parent.

Menu: the render tree Tools menu gets two callback items separated by a
separator, labelled by `XSISCRIPTS` ids 1183 and 1188. The first runs the
command on the container shown in the render tree view (view attribute
`container`). The second (not a command) creates a writable image source
(path `.\Render_Pictures\.sss_lightmap_[Host].#.map`, name
`sss_lightmap_source`, 1024 × 512, colour channel type, not reusing an
existing one), a clip `sss_lightmap_clip` on it, sets the source's `BitDepth`
to 21 and `WriteToDisk` to true, and nests the clip in the container.

Event `OnCreateShader`: when a shader with ProgID
`softimage.txt2d-image-explicit.1.0` (compared in lower case) is created inside
a container and its `tex` parameter has no source, the scene's default image
clip is nested in the container and connected to `tex`. Returns true.

### `RTShaderSetCategories` (SPEC)

No arguments. Rewrites the category, display name and thumbnail of the factory
shader definitions. The same procedure runs from the start-up event
`RTShaderSetCategoriesEvent`.

1. If the environment variable `XSI_NO_DEFAULT_SHADERS` is set (non-empty),
   do nothing and return nothing.
2. For each row of the table below, in table order: get the shader definition
   with ProgID `Softimage.<shader name>.1.0` (`GetShaderDef`). If there is
   none, log the error `Shader 'Softimage.<shader name>.1.0' not found.` and go
   to the next row. Otherwise:
   - set its `Category` to the table value;
   - if the row has a strip rule, delete every match from the current
     `DisplayName`;
   - if the row has a display name, set `DisplayName` to it (this replaces the
     stripped name);
   - if the row has a thumbnail, set the definition attribute `Thumbnail` to
     that file name.
3. Return true.

Strip rules (case-sensitive, all occurrences): **M** = one white-space
character followed by `Math`; **T** = `mib`, one white-space character,
`Texture`, one white-space character.

Category strings are paths of `/`-separated levels; a level may carry an
`@<number>` suffix, and a level may consist of the suffix alone. The meaning of
the suffix (sort weight / unnamed sub-section, *inferred*) is Q7.

| # | Shader name | Category | Display name | Thumbnail | Strip |
|---|-------------|----------|--------------|-----------|-------|
| 1 | `material-phong` | `Illumination@100/@100` | - | `ML_phong_apple.bmp` | - |
| 2 | `material-lambert` | `Illumination@100/@100` | - | `ML_lambert_apple.bmp` | - |
| 3 | `mia_material_phen` | `Illumination@100/@100` | `Architectural` | - | - |
| 4 | `material-blinn` | `Illumination@100/@100` | `Blinn` | `ML_blinn_apple.bmp` | - |
| 5 | `material-cooktorr` | `Illumination@100/@100` | `Cook-Torrance` | `ML_cooktorrance_apple.bmp` | - |
| 6 | `material-strauss` | `Illumination@100/@100` | `Strauss` | `ML_strauss_apple.bmp` | - |
| 7 | `material-ward` | `Illumination@100/@100` | `Anisotropic` | `ML_anisotropic_apple.bmp` | - |
| 8 | `material-constant` | `Illumination@100/@100` | `Constant` | `ML_consant_apple.bmp` | - |
| 9 | `misss_fast_simple_phen` | `Illumination@100/@200` | `Fast Simple (misss)` | - | - |
| 10 | `misss_fast_skin_phen` | `Illumination@100/@200` | `Fast Skin (misss)` | - | - |
| 11 | `material-moviescreen` | `Illumination@100/@400` | `Flat Light` | `ML_Flat_Light_Apple.bmp` | - |
| 12 | `sib_incidence_v3` | `Illumination@100/@400` | `Incidence` | `ML_incidence_apple.bmp` | - |
| 13 | `sib_photon_matte` | `Illumination@100/@400` | `Photon Irradiance` | `photon_irradiance.bmp` | - |
| 14 | `sib_illum_shadowmaterial` | `Illumination@100/@400` | `Shadow` | `shadow.bmp` | - |
| 15 | `sib_shadow_basic` | `Illumination@100/@400` | `Simple Shadow` | `shadow.bmp` | - |
| 16 | `sib_illum_moviescreen` | `Illumination@100/@400` | `Flat Light Shading` | `ML_Flat_Light_Apple.bmp` | - |
| 17 | `XSIAmbientOcclusion` | `Illumination@100/@400` | - | - | - |
| 18 | `rh_renderer` | `Illumination@100/@500` | - | - | - |
| 19 | `sib_geo_hair_illum` | `Illumination@100/@500` | - | - | - |
| 20 | `mip_card_opacity` | `Illumination@100/@600` | `Card/Opacity (mip)` | - | - |
| 21 | `mip_matteshadow` | `Illumination@100/@600` | `Matte Shadow (mip)` | - | - |
| 22 | `mi_car_paint_phen` | `Illumination@100/@600` | `Car Paint` | - | - |
| 23 | `mia_material` | `Illumination@100/@600` | `Architectural (Multi-out)` | - | - |
| 24 | `txt2d-image-explicit` | `Texture@100/@100` | `Image` | `Image_Lookup.bmp` | - |
| 25 | `txt2d-scalarimage-explicit` | `Texture@100/@100` | `Scalar Image` | `Image_Lookup.bmp` | - |
| 26 | `mip_cameramap` | `Texture@100/@100` | `Camera Map (mip)` | `Image_Lookup.bmp` | - |
| 27 | `mia_light_surface` | `Texture@100/@100` | `Light Surface (mia)` | `light.bmp` | - |
| 28 | `sib_sprite` | `Texture@100/@100` | `Sprite` | `Sprite.bmp` | - |
| 29 | `txt3d-cellular_v3` | `Texture@100/@200` | - | `cell.bmp` | - |
| 30 | `BA_cell_scl` | `Texture@100/@200` | - | `cell.bmp` | - |
| 31 | `txt3d-checkerboard` | `Texture@100/@200` | - | `checker.bmp` | - |
| 32 | `txt3d-cloud` | `Texture@100/@200` | - | `cloud.bmp` | - |
| 33 | `txt2d-fabric` | `Texture@100/@200` | - | `fabric.bmp` | - |
| 34 | `txt3d-flagstone_v3` | `Texture@100/@200` | - | `flagstone.bmp` | - |
| 35 | `txt3d-fractal_v3` | `Texture@100/@200` | - | `fractal.bmp` | - |
| 36 | `BA_fractal4d2_scl` | `Texture@100/@200` | - | `fractal.bmp` | - |
| 37 | `txt2d-gradient_v2` | `Texture@100/@200` | - | `gradien.bmp` | - |
| 38 | `txt2d-grid` | `Texture@100/@200` | - | `grid.bmp` | - |
| 39 | `txt3d-marble` | `Texture@100/@200` | - | `marble.bmp` | - |
| 40 | `txt2d-ripple_v3` | `Texture@100/@200` | - | `ripple.bmp` | - |
| 41 | `txt3d-rock_v3` | `Texture@100/@200` | - | `rock.bmp` | - |
| 42 | `txt3d-snow` | `Texture@100/@200` | - | `snow.bmp` | - |
| 43 | `txt2d-terrain` | `Texture@100/@200` | - | `terrain.bmp` | - |
| 44 | `txt3d-vein_v3` | `Texture@100/@200` | - | `vein.bmp` | - |
| 45 | `txt3d-wood` | `Texture@100/@200` | - | `wood.bmp` | - |
| 46 | `XSIModelMap` | `Texture@100/@200` | - | - | - |
| 47 | `XSIVDM` | `Texture@100/@300` | - | - | - |
| 48 | `BA_particle_density3` | `Particle@100/@100` | - | `particle.bmp` | - |
| 49 | `BA_particle_gradient_phen` | `Particle@100/@100` | - | `particles.bmp` | - |
| 50 | `BA_particle_gradientcontrol` | `Particle@100/@100` | - | `particles.bmp` | - |
| 51 | `BA_particle_info` | `Particle@100/@100` | - | `particles.bmp` | - |
| 52 | `BA_volume_cloud` | `Particle@100/@100` | - | `particle.bmp` | - |
| 53 | `sitoon_host` | `Toon@100/@100` | - | `ML_toon_apple.bmp` | - |
| 54 | `sitoon_paint` | `Toon@100/@100` | - | `ML_toon_apple.bmp` | - |
| 55 | `sitoon_paint_and_host` | `Toon@100/@100` | - | `ML_toon_apple.bmp` | - |
| 56 | `sitoon_paint_ambient` | `Toon@100/@100` | - | `ML_toon_apple.bmp` | - |
| 57 | `sitoon_paint_rounded` | `Toon@100/@100` | - | `ML_toon_apple.bmp` | - |
| 58 | `sitoon_paint_rimlight` | `Toon@100/@100` | - | `ML_toon_apple.bmp` | - |
| 59 | `sitoon_paint_highlight` | `Toon@100/@100` | - | `ML_toon_apple.bmp` | - |
| 60 | `sitoon_ink` | `Toon@100/@200` | `Toon Ink Lens` | `ML_toon_apple.bmp` | - |
| 61 | `GLSLProgram` | `Realtime@200/OpenGL` | - | `glsl.bmp` | - |
| 62 | `GLSLUniform` | `Realtime@200/OpenGL` | - | `glslu.bmp` | - |
| 63 | `OGL13Texture` | `Realtime@200/OpenGL` | - | `OGL.bmp` | - |
| 64 | `OGLParticle` | `Realtime@200/OpenGL` | - | `particle.bmp` | - |
| 65 | `sib_zbump` | `Bump@300` | - | `bump.bmp` | - |
| 66 | `sib_bumpmap_gen` | `Bump@300` | - | `bump.bmp` | - |
| 67 | `sib_bump` | `Bump@300` | - | `bump.bmp` | - |
| 68 | `XSINormalMap3` | `Bump@300` | - | `bump.bmp` | - |
| 69 | `mia_roundcorners` | `Bump@300` | `Round Corners (mia)` | `bump.bmp` | - |
| 70 | `sib_env_cubic1` | `Environment@300` | `Cubic Mapping 1` | `cubic.bmp` | - |
| 71 | `mip_grayball` | `Environment@300` | `Gray Ball (mip)` | - | - |
| 72 | `mip_mirrorball` | `Environment@300` | `Mirror Ball (mip)` | - | - |
| 73 | `sib_env_spherical` | `Environment@300` | `Spherical Mapping` | `spherical.bmp` | - |
| 74 | `mia_envblur` | `Environment@300` | `Environment Blur (mia)` | - | - |
| 75 | `sib_environment` | `Environment@300` | `Environment` | `spherical.bmp` | - |
| 76 | `sib_env_cubic6` | `Environment@300` | `Cubic Mapping 6` | `cubic6.bmp` | - |
| 77 | `mia_physicalsky` | `Environment@300` | `Physical Sky (mia)` | - | - |
| 78 | `mia_physicalsun` | `Light@300/@100` | `Physical Sun (mia)` | `light.bmp` | - |
| 79 | `mia_portal_light` | `Light@300/@100` | `Portal Light (mia)` | `light.bmp` | - |
| 80 | `soft_light` | `Light@300/@200` | `Soft Light` | `light.bmp` | - |
| 81 | `Bionic_Light_lit` | `Light@300/@200` | `Fast Light Effects` | `light.bmp` | - |
| 82 | `sib_slide_proj_light` | `Light@300/@200` | `Slide Projector` | `light.bmp` | - |
| 83 | `dense_vol` | `Volume@300` | - | `Volume.bmp` | - |
| 84 | `Bionic_Volume_vol` | `Volume@300` | `Fast Volume Effects` | `Volume.bmp` | - |
| 85 | `soft_fog` | `Volume@300` | `Fog` | `Volume.bmp` | - |
| 86 | `soft_layered_fog` | `Volume@300` | `Layered Fog` | `Volume.bmp` | - |
| 87 | `sib_lightning` | `Volume@300` | - | `Volume.bmp` | - |
| 88 | `smoke_vol` | `Volume@300` | `Smoke` | `Volume.bmp` | - |
| 89 | `March_Fractal_vol` | `Volume@300` | `Volume Effects` | `Volume.bmp` | - |
| 90 | `Lume_Beam` | `Volume@300` | `Lume Beam` | `Volume.bmp` | - |
| 91 | `mia_lens_bokeh` | `Lens@300/@100` | `Bokeh (mia)` | `lens.bmp` | - |
| 92 | `Lume_Distortion` | `Lens@300/@100` | - | `lens.bmp` | - |
| 93 | `mia_exposure_photographic` | `Lens@300/@100` | `Photographic Exposure (mia)` | `lens.bmp` | - |
| 94 | `mia_exposure_simple` | `Lens@300/@100` | `Simple Tone Mapping (mia)` | `lens.bmp` | - |
| 95 | `Cylindric_len` | `Lens@300/@200` | `Panoramic` | `lens.bmp` | - |
| 96 | `sib_dof` | `Lens@300/@200` | - | `lens.bmp` | - |
| 97 | `sib_fisheye` | `Lens@300/@200` | - | `lens.bmp` | - |
| 98 | `sib_fx_lens` | `Lens@300/@200` | `Lens Effects` | `lens.bmp` | - |
| 99 | `NSTEREO_LEN` | `Lens@300/@200` | `Steroscopic` | `lens.bmp` | - |
| 100 | `sib_lens_depth` | `Lens@300/@200` | `Z Depth` | `lens.bmp` | - |
| 101 | `mib_lookup_background` | `Lens@300/@200` | `Camera Projection` | `lens.bmp` | - |
| 102 | `mip_motionblur` | `Output@300/@100` | `2D Motion Blur` | `output.bmp` | - |
| 103 | `sib_flatten_depth` | `Output@300/@100` | `Flatten Depth` | `output.bmp` | - |
| 104 | `mip_motion_vector` | `Output@300/@100` | `Motion Vector (mip)` | `output.bmp` | - |
| 105 | `sib_lightmap_color_sampler` | `Lightmap@300/@100` | - | - | - |
| 106 | `misss_lightmap_write` | `Lightmap@300/@200` | `Sub-Surface Lightmap Write` | - | - |
| 107 | `sib_attribute_boolean` | `Data@400/Attribute` | - | - | - |
| 108 | `sib_attribute_color` | `Data@400/Attribute` | - | - | - |
| 109 | `sib_attribute_integer` | `Data@400/Attribute` | - | - | - |
| 110 | `sib_attribute_scalar` | `Data@400/Attribute` | - | - | - |
| 111 | `sib_attribute_transform` | `Data@400/Attribute` | - | - | - |
| 112 | `sib_attribute_vector` | `Data@400/Attribute` | - | - | - |
| 113 | `sib_boolean_storeinchannel` | `Data@400/Render Channel` | `Store Boolean in Channel` | - | - |
| 114 | `sib_color_storeinchannel` | `Data@400/Render Channel` | `Store Color in Channel` | - | - |
| 115 | `sib_integer_storeinchannel` | `Data@400/Render Channel` | `Store Integer in Channel` | - | - |
| 116 | `sib_scalar_storeinchannel` | `Data@400/Render Channel` | `Store Scalar in Channel` | - | - |
| 117 | `sib_vector_storeinchannel` | `Data@400/Render Channel` | `Store Vector in Channel` | - | - |
| 118 | `mib_texture_lookup` | `Data@400/Map Lookup` | `Image Lookup` | `Image_Lookup.bmp` | - |
| 119 | `map_lookup_boolean` | `Data@400/Map Lookup` | - | `Map_Lookup.bmp` | - |
| 120 | `map_lookup_color` | `Data@400/Map Lookup` | - | `Map_Lookup.bmp` | - |
| 121 | `map_lookup_integer` | `Data@400/Map Lookup` | - | `Map_Lookup.bmp` | - |
| 122 | `map_lookup_scalar` | `Data@400/Map Lookup` | - | `Map_Lookup.bmp` | - |
| 123 | `map_lookup_vector` | `Data@400/Map Lookup` | - | `Map_Lookup.bmp` | - |
| 124 | `sib_vertex_color_alpha` | `Data@400/Map Lookup` | - | `Map_Lookup.bmp` | - |
| 125 | `sib_state_scalar` | `Data@400/Shading State/@100` | - | `State.bmp` | - |
| 126 | `sib_state_vector` | `Data@400/Shading State/@100` | - | `State.bmp` | - |
| 127 | `sib_savestate_color` | `Data@400/Shading State/@200` | - | `State.bmp` | - |
| 128 | `sib_savestate_scalar` | `Data@400/Shading State/@200` | - | `State.bmp` | - |
| 129 | `sib_savestate_vector` | `Data@400/Shading State/@200` | - | `State.bmp` | - |
| 130 | `sib_channel_picker` | `Processing@400/Color Channels/@100` | `Picker` | `Color_Channel.bmp` | - |
| 131 | `sib_color_split` | `Processing@400/Color Channels/@100` | `RGBA Split` | `Color_Channel.bmp` | - |
| 132 | `sib_color_transparency_matte` | `Processing@400/Color Channels/@200` | - | `Color_Matte.bmp` | - |
| 133 | `sib_scalar_transparency_matte` | `Processing@400/Color Channels/@200` | - | `Scalar_Matte.bmp` | - |
| 134 | `sib_hlsa_combine` | `Processing@400/Color Channels/@300` | `HLSA Combine` | `Color_Channel.bmp` | - |
| 135 | `sib_hsva_combine` | `Processing@400/Color Channels/@300` | `HSVA Combine` | `Color_Channel.bmp` | - |
| 136 | `sib_color_combine` | `Processing@400/Color Channels/@300` | `RGBA Combine` | `Color_Channel.bmp` | - |
| 137 | `mib_color_alpha` | `Processing@400/Color Channels/@400` | `Color to Alpha` | `Color_Channel.bmp` | - |
| 138 | `sib_color_correction` | `Processing@400/Image Processing/@100` | - | `Im_Pro_Correct.bmp` | - |
| 139 | `sib_color_balance` | `Processing@400/Image Processing/@100` | - | - | - |
| 140 | `sib_color_hls_adjust` | `Processing@400/Image Processing/@100` | `HLS Adjust` | - | - |
| 141 | `rgba_keyer` | `Processing@400/Image Processing/@100` | `RGBA Keyer` | `Im_Pro_Keyer.bmp` | - |
| 142 | `mib_color_intensity` | `Processing@400/Image Processing/@100` | `Intensity` | `Im_Pro_Intensity.bmp` | - |
| 143 | `sib_color_invert` | `Processing@400/Image Processing/@100` | `Invert` | `Im_Pro_Invert.bmp` | - |
| 144 | `sib_scalar_invert` | `Processing@400/Image Processing/@100` | `Scalar Invert` | `Im_Pro_Scal_Invert.bmp` | - |
| 145 | `XSIColorMixer` | `Processing@400/Mixers/@100` | - | `Mixer.bmp` | - |
| 146 | `sib_color_gradient` | `Processing@400/Mixers/@100` | `Gradient` | `gradien.bmp` | - |
| 147 | `sitoon_node_mix` | `Processing@400/Mixers/@100` | `Toon Mix` | `Mixer.bmp` | - |
| 148 | `sib_color_2mix` | `Processing@400/Mixers/@200` | `Mix 2 Colors` | `Mixer.bmp` | - |
| 149 | `sib_color_8mix` | `Processing@400/Mixers/@200` | `Mix 8 Colors` | `Mixer.bmp` | - |
| 150 | `sib_boolean_to_color` | `Processing@400/Conversion/@100` | - | - | - |
| 151 | `sib_color_to_boolean` | `Processing@400/Conversion/@200` | - | `CV_Color_Boolean.bmp` | - |
| 152 | `sib_color_to_scalar` | `Processing@400/Conversion/@200` | - | `CV_Color_Scalar.bmp` | - |
| 153 | `sib_color_to_scalars` | `Processing@400/Conversion/@200` | - | `CV_Color_Scalar.bmp` | - |
| 154 | `sib_color_to_vector` | `Processing@400/Conversion/@200` | - | `CV_Color_Vector.bmp` | - |
| 155 | `sib_color_rgb_to_hsv` | `Processing@400/Conversion/@220` | - | `CV_Rgb_hsv.bmp` | - |
| 156 | `sib_color_hsv_to_rgb` | `Processing@400/Conversion/@220` | - | `CV_Hsv_rgb.bmp` | - |
| 157 | `sib_integer_to_color` | `Processing@400/Conversion/@300` | - | - | - |
| 158 | `sib_integer_to_scalar` | `Processing@400/Conversion/@300` | - | `CV_Integer_Scalar.bmp` | - |
| 159 | `sib_scalar_to_boolean` | `Processing@400/Conversion/@400` | - | `CV_Scalar_Boolean.bmp` | - |
| 160 | `sib_scalar_to_color` | `Processing@400/Conversion/@400` | - | `CV_Scalar_Color.bmp` | - |
| 161 | `sib_scalar_to_integer` | `Processing@400/Conversion/@400` | - | `CV_Scalar_Integer.bmp` | - |
| 162 | `sib_scalars_to_vector` | `Processing@400/Conversion/@400` | - | `CV_Scalar_Vector.bmp` | - |
| 163 | `sib_vector_to_color` | `Processing@400/Conversion/@500` | - | `CV_Vector_Color.bmp` | - |
| 164 | `sib_vector_to_scalar` | `Processing@400/Conversion/@500` | - | `CV_Vector_Scalar.bmp` | - |
| 165 | `sib_vector_to_scalars` | `Processing@400/Conversion/@500` | - | `CV_Vector_Scalar.bmp` | - |
| 166 | `sib_space_conversion` | `Processing@400/Conversion/@500` | `Vector Coordinate Convertor` | `CV_Vector_Coord.bmp` | - |
| 167 | `sib_dielectric_ior` | `Processing@400/Raytracing/@100` | - | `RayTrace.bmp` | - |
| 168 | `mib_opacity` | `Processing@400/Raytracing/@100` | `Opaque` | `RayTrace.bmp` | - |
| 169 | `mib_photon_basic` | `Processing@400/Raytracing/@100` | `Photon` | `RayTrace.bmp` | - |
| 170 | `sib_illum_photon` | `Processing@400/Raytracing/@100` | `Photon Render Tree` | `RayTrace.bmp` | - |
| 171 | `mib_reflect` | `Processing@400/Raytracing/@100` | `Reflection` | `RayTrace.bmp` | - |
| 172 | `sib_diffuse_reflection` | `Processing@400/Raytracing/@100` | `Reflection Diffuse` | `RayTrace.bmp` | - |
| 173 | `mib_refract` | `Processing@400/Raytracing/@100` | `Refraction` | `RayTrace.bmp` | - |
| 174 | `sib_diffuse_refraction_phen` | `Processing@400/Raytracing/@100` | `Refraction Diffuse` | `RayTrace.bmp` | - |
| 175 | `sib_transparency` | `Processing@400/Raytracing/@100` | - | `RayTrace.bmp` | - |
| 176 | `sib_color_math_basic` | `Processing@400/Math/@100` | - | `Math.bmp` | M |
| 177 | `sib_color_math_curve` | `Processing@400/Math/@100` | - | `Math.bmp` | M |
| 178 | `sib_color_math_exponent` | `Processing@400/Math/@100` | - | `Math.bmp` | M |
| 179 | `sib_color_inrange` | `Processing@400/Math/@100` | - | `Math.bmp` | M |
| 180 | `sib_color_math_logic` | `Processing@400/Math/@100` | - | `Math.bmp` | M |
| 181 | `sib_color_math_unary` | `Processing@400/Math/@100` | - | `Math.bmp` | M |
| 182 | `sib_color_smoothrange` | `Processing@400/Math/@100` | - | `Math.bmp` | M |
| 183 | `mib_color_average` | `Processing@400/Math/@100` | `Color Average` | `Math.bmp` | - |
| 184 | `sib_scalar_math_basic` | `Processing@400/Math/@200` | - | `Math.bmp` | M |
| 185 | `sib_scalar_math_curve` | `Processing@400/Math/@200` | - | `Math.bmp` | M |
| 186 | `sib_scalar_math_exponent` | `Processing@400/Math/@200` | - | `Math.bmp` | M |
| 187 | `sib_scalar_inrange` | `Processing@400/Math/@200` | - | `Math.bmp` | M |
| 188 | `sib_scalar_math_logic` | `Processing@400/Math/@200` | - | `Math.bmp` | M |
| 189 | `sib_scalar_math_unary` | `Processing@400/Math/@200` | - | `Math.bmp` | M |
| 190 | `sib_scalar_smoothrange` | `Processing@400/Math/@200` | - | `Math.bmp` | M |
| 191 | `BA_fast_math` | `Processing@400/Math/@200` | - | `Math.bmp` | M |
| 192 | `sib_interp_linear` | `Processing@400/Math/@200` | - | `Math.bmp` | M |
| 193 | `sib_atten_exp` | `Processing@400/Math/@250` | `Exponent Falloff` | `Math.bmp` | - |
| 194 | `sib_atten_linear` | `Processing@400/Math/@250` | `Linear Falloff` | `Math.bmp` | - |
| 195 | `sib_boolean_math_logic` | `Processing@400/Math/@300` | - | `Math.bmp` | M |
| 196 | `sib_boolean_negate` | `Processing@400/Math/@300` | - | `Math.bmp` | M |
| 197 | `sib_vector_math_scalar` | `Processing@400/Math/@400` | - | `Math.bmp` | M |
| 198 | `sib_vector_math_vector` | `Processing@400/Math/@400` | - | `Math.bmp` | M |
| 199 | `mib_twosided` | `Processing@400/Switch/@100` | `Front-Back Switch` | `Switch.bmp` | - |
| 200 | `sib_color_rayswitch` | `Processing@400/Switch/@100` | `Ray Type Switch` | `Switch.bmp` | - |
| 201 | `sib_color_switch` | `Processing@400/Switch/@200` | `Color Switch` | `Switch.bmp` | - |
| 202 | `sib_scalar_switch` | `Processing@400/Switch/@200` | - | `Switch.bmp` | - |
| 203 | `sib_vector_switch` | `Processing@400/Switch/@200` | - | `Switch.bmp` | - |
| 204 | `sib_color_multi_switch` | `Processing@400/Switch/@300` | - | `Switch.bmp` | - |
| 205 | `sib_scalar_multi_switch` | `Processing@400/Switch/@300` | - | `Switch.bmp` | - |
| 206 | `sib_vector_multi_switch` | `Processing@400/Switch/@300` | - | `Switch.bmp` | - |
| 207 | `mib_texture_checkerboard` | `Texture Generators@500/@100` | - | `checker.bmp` | T |
| 208 | `mib_texture_polkadot` | `Texture Generators@500/@100` | - | `2D_Dot.bmp` | T |
| 209 | `sib_texture2d_fabric` | `Texture Generators@500/@100` | - | `fabric.bmp` | T |
| 210 | `sib_texture2d_grid` | `Texture Generators@500/@100` | - | `grid.bmp` | T |
| 211 | `txt2d-image` | `Texture Generators@500/@100` | `Image Implicit` | `Image_Lookup.bmp` | - |
| 212 | `sib_texture2d_ripple` | `Texture Generators@500/@100` | - | `ripple.bmp` | T |
| 213 | `sib_texture2d_terrain` | `Texture Generators@500/@100` | - | `terrain.bmp` | T |
| 214 | `sib_texture_cell` | `Texture Generators@500/@200` | - | `cell.bmp` | T |
| 215 | `sib_texture_cloud` | `Texture Generators@500/@200` | - | `cloud.bmp` | T |
| 216 | `sib_texture_flagstone` | `Texture Generators@500/@200` | - | `flagstone.bmp` | T |
| 217 | `sib_texture_fractal` | `Texture Generators@500/@200` | - | `fractal.bmp` | T |
| 218 | `sib_texture_lattice` | `Texture Generators@500/@200` | - | `3d_lattice.bmp` | T |
| 219 | `sib_texture_marble` | `Texture Generators@500/@200` | - | `marble.bmp` | T |
| 220 | `sib_texture_rock` | `Texture Generators@500/@200` | - | `rock.bmp` | T |
| 221 | `sib_texture_snow` | `Texture Generators@500/@200` | - | `snow.bmp` | T |
| 222 | `mib_texture_turbulence` | `Texture Generators@500/@200` | - | `3d_turbulance.bmp` | T |
| 223 | `sib_texture_vein` | `Texture Generators@500/@200` | - | `vein.bmp` | T |
| 224 | `mib_texture_wave` | `Texture Generators@500/@200` | - | `3d_wave.bmp` | T |
| 225 | `sib_texture_wood` | `Texture Generators@500/@200` | - | `wood.bmp` | T |
| 226 | `sib_texture3Dwarp` | `Texture Space Controllers@500` | - | `Text_Spc_Ctrlr.bmp` | - |
| 227 | `sib_txt2dremap_kalid` | `Texture Space Controllers@500` | - | `Text_Spc_Ctrlr.bmp` | - |
| 228 | `mib_texture_remap` | `Texture Space Controllers@500` | `Edit UV` | `Text_Spc_Ctrlr.bmp` | - |
| 229 | `mib_texture_vector` | `Texture Space Generators@500` | `Texture Space Generator` | `Text_Spc_Gen.bmp` | - |
| 230 | `sib_texproj_lookup` | `Texture Space Generators@500` | - | `Text_Spc_Gen.bmp` | - |

`sitoon_ink` is listed once (Toon); `sib_color_gradient` once (Mixers);
`mib_texture_lookup` once (Map Lookup). A later row for the same shader would
simply overwrite the earlier values; there is none.

## Wire contract: Lagoa

All three take `SelectionList` through the `Collection` argument handler, so an
omitted value is the current selection *(inferred from the handler)*. Object
types are compared exactly (`polymsh`, `pointcloud`).

### `LagoaEmitMPVolume` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `SelectionList` | selection | objects; only polygon meshes are used |

With no polygon mesh in the list: warning `No polymesh objects in selection`,
return true. Otherwise (n = number of meshes):

1. Create a point cloud primitive: `GetPrim "PointCloud", "Lagoa_MP_Cloud"`.
2. Add a `Display Property` to the cloud and set `wirecolorr` 0.2,
   `wirecolorg` 0.3, `wirecolorb` 1.
3. `CreateSimulatedICETree <cloud>, siNode`.
4. Add five compounds to the tree with `AddICECompoundNode`, in this order:
   `Lagoa Emit Volume`, `Lagoa Simulate Multiphysics`, `Lagoa Main Material`,
   `Lagoa Add Forces`, `Lagoa Phase`.
5. Add ports with `AddPortToICENode <path>,
   siNodePortDataInsertionLocationAfter`:
   - n = 1: four calls on the tree, paths `<tree>.port1` … `<tree>.port4`;
   - n > 1: n + 2 calls on the tree (`<tree>.port1` … `<tree>.port<n+2>`),
     then n − 1 calls on the emit compound with the paths `<emit>.Emitter In
     Name1` … `<emit>.Emitter In Name<n−1>` (the name is written with spaces).
6. For each mesh, in list order: log its full name (information), add a
   `GetDataNode`, set its `reference` parameter to the mesh's full name, and
   `ConnectICENodes "<emit>.Emitter_In_Name", "<get data>.outname"`. Every
   mesh is connected to the **same** destination path (Q3).
7. Connect, in this order (destination, source):
   `<tree>.Port1` ← `<emit>.Execute`; `<tree>.Port2` ← `<forces>.Execute`;
   `<tree>.Port3` ← `<phase>.Execute`; `<phase>.Execute1` ←
   `<material>.Execute`; `<tree>.Port5` ← `<simulate>.Execute`. `Port4` is
   left free.
8. Return true.

### `LagoaTagCollisionObject` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `SelectionList` | selection | objects; only polygon meshes are used |
| `arg1` | 1 | not used |

For each polygon mesh, in order: `ApplyOp "ICETree", <object>, siNode, , , 0`;
add the compound `Lagoa Set Collision Data` to the new tree; connect
`<tree>.Port1` ← `<compound>.Execute`; log (information) `Object --><object>
tagged with Set Collision Data node, inspect ICEtree`; remember the compound.

Then, **always** (even when nothing was tagged): open a property page on the
remembered compounds, and log the warning `Objects tagged! Make sure these
objects are added to the collision ports on the Lagoa Framework`. Returns
nothing.

### `LagoaDisplayType` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `SelectionList` | selection | objects; only point clouds are used |
| `arg1` | 1 | point size |
| `arg2` | 1 | display type |

For each point cloud: on its property named `Particle Display` set
`displaytype` = `arg2`, then `pointsize` = `arg1`. Returns nothing. A cloud
without that property is a script error (no guard). The meaning of the
`displaytype` values is Q8.

## Wire contract: ICEFlowBuilder

### `LagoaSetupAdvectMesh` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `inspectPPG` | true | passed on to the preset command |

1. Take the selected geometries from the ICE flow helper object
   (`ICEFLowCommonTools` → `GetGeometries`): selected objects of type `polymsh`
   or `surfmsh`, and selected groups whose members are all of that type.
2. If there is none: error log `You need to Select a Polygon Mesh Object !`,
   return true.
3. Otherwise: create a simulated ICE tree on the first geometry
   (`CreateSimulatedICETree <geometry>, siNode`) and delete it again at once
   (this leaves the simulation environment / stack markers in place,
   *inferred*).
4. Call `ICEFlow_CreateParticlesFromPreset "Lagoa Setup Advect Mesh",
   "Execute", "Emitter In Name", "Passive Body In Name", false, <null>, false,
   <inspectPPG>` (preset name, out port name, emitter input name, collider
   input name, explode compound, shader preset name, emit-input-is-geometry
   flag, inspect flag).
5. Return true.

### `LagoaSetupClothMesh` (SPEC)

No arguments. Acts only when something is selected **and** the first selected
object has an active primitive; otherwise does nothing. In order:

1. `ResetTransform , siCtr, siSRT, siXYZ` (objects omitted, so the selection).
2. `ICEFlow_CreateParticlesFromPreset "Lagoa Setup Cloth Mesh", "Execute",
   " ", "Passive Body In Name", False` (the emitter input name is a single
   space; the remaining arguments keep their defaults: no shader preset,
   emit-input flag false, inspect true).

Returns true in every case. No message when nothing is done.

### `ICEFlowInsertSimulationRoot` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `in_ICETree` | none | an ICE tree (object or name) |

Inserts the compound `Simulation Root` between the tree's root ports and what
is plugged into them. Errors are suppressed for the whole procedure. Uses the
global variable `SimulateParticlesPortIndex` (`GetGlobal` / `SetGlobal`).

1. If the global is empty, set it to 99.
2. Look for nodes named `Simulation Root` directly in the tree (not inside
   compounds).
3. **None found:** add the compound `Simulation Root` to the tree. Then look
   at the **first** input port of the tree only: if the port plugged into it
   is named `Emit`, continue; if not, log the warning `Unable to connect
   Simulation Root as no Emit output plugged in to the ICETree node` and stop
   (no return value; the compound just added stays in the tree, unconnected).
4. **Found:** look at the first input port only: if the node plugged into it
   is of type `Simulation_Root`, use the first node found in step 2 and
   continue; otherwise stop silently.
5. For each input port of the tree, in port order (list read before step 3),
   first matching rule wins:

   | Condition on the port | Action |
   |-----------------------|--------|
   | not connected | skip |
   | connected node type is `Simulation_Root` | skip |
   | connected port name is `Emit` | connect `<root>.Emitter` ← `<tree>.<connected node type>.Emit`; if that worked, connect `<tree>.<port name>` ← `<root>.Execute` |
   | connected port name is `simulate` | store the port's number (the port name without its first four characters) in the global; disconnect the tree port; connect `<root>.Simulate` ← `<node>.simulate` |
   | connected node type is `Add_Forces` | disconnect the tree port; connect `<root>.Forces` ← `<node>.Execute` |
   | connected node type is `State_Machine` | nothing (left as it is) |
   | anything else | remember the connected port's name; disconnect the tree port; if the port's number is greater than the global, take a free `PostSimExecute` input of the root, else a free `Execute` input; connect it ← `<node>.<remembered name>` |

6. Set the global back to 99 and return true.

"Take a free input" is the helper method `GetUnconnectedInputPorts(node,
name)`: among the node's input ports whose name, digits removed, equals `name`
without regard to case, the first unconnected one; if all are connected, a new
port added after the last of them (`AddPortToICENode <port>,
siNodePortDataInsertionLocationAfter`).

Because the global starts at 99, ports met before the `simulate` port go to
`Execute`, ports after it to `PostSimExecute`.

Menu: on the ICE node context menu (`siMenuICENodeContextID`, rebuilt on each
open) one callback item, label = key "Insert Simulation Root" of
`XSIPLUGINUI`, added only when the menu target's class is `ICETree`; it runs
the command on the target.

## Wire contract: sdkui

### `SIGetExternalFilesViewerProp` (SPEC)

No arguments. Returns the plug-in's single `CExternalFilesViewer` property
instance, creating it on first use (stand-alone property named "External Files
Manager"). The instance is dropped when the plug-in unloads.

**Property definition (S).**

| Parameter | Type | Initial value | Notes |
|-----------|------|---------------|-------|
| `Target` | string | `Scene` | added with the read-only flag; text of the scene or model being listed |
| `FileType` | string | `All` | filter |
| `ShowRecords` | string | `All` | grid height choice |
| `Validateondisk` | boolean | true | "View Resolved Paths" |
| `RefreshMe` | boolean | - | hidden toggle; any change refills the grid |
| `Files` | grid, 9 columns | - | 0 text 8000 (user path), 1 text 8001 (file type), 2 text 8002 (status), 3 text 8003 (resolved path), 4 text 8004 (Alienbrain), 5 "Guid", 6 text 8005 (owner), 7 "Reference", 8 "Local To Project"; row 0 label four spaces |
| `FilesCache` | grid, 1 column | - | copy of each row's path, for change detection |

The grid is filled once at definition time.

**Layout.** Group with `Target` labelled "External Files For: " (width 20 %).
A row holding: group "Options" (`FileType` combo, 100 wide, label / value
pairs All, Actions, Audio, Caches, Deltas, Models, "Material Lib" / `MatLib`,
Pictures, Render_Pictures, Scenes, Scripts, Synoptic, Thumbnails;
`Validateondisk` check box "View Resolved Paths"; `ShowRecords` combo "Grid
size", 100 wide: "Show All" / `All`, 10, 25, 50); group "Actions" (two rows of
130-wide buttons: `BntBrowse` "Browse Selected Path...", `BntSearchAndReplace`
"Search and Replace..."; `BntSort` "Sort Selected Column",
`BntCopyUnderProject` "Copy Files to Project..."); group "Cleanup" (210-wide
buttons `BntDeleteAllMat` "Delete Unused Materials",
`BntDeleteImagesSourcesAndClips` "Delete Unused Image Sources and Clips",
`BntDeleteAnimationSources` "Delete Unused Animation Sources",
`BntDeleteAudioSources` "Delete Unused Audio Sources", `BntDeleteCacheSources`
"Delete Unused Cache Sources"); only when the COM object
`NxNNamespace.NxNNamespaceHelper` can be created, group "AlienBrain"
(110-wide buttons `BntAddToAB` "Add to Alienbrain", `BntGetLatest` "Get
Latest", a row with `BntCO` "Check out" and `BntUNDOCO` "Undo Check out",
`BntCI` "Check in"); button `BntHelp` "Help". Below the row, the `Files` grid:
no label, header selection, read-only columns `0:1:1:0:1:1:1:1:1`, shown
columns `1:1:1:1:0:0:1:0:0` (`1:1:1:1:1:0:1:0:0` with Alienbrain).

**Grid fill.** Both grids are emptied. The target is the first object named by
`Target`: the text `Scene` or an object of type `Scene` lists the active
scene's `ExternalFiles`; an object of type `#model` lists that model's
`ExternalFiles`. Files are kept when `FileType` is `All` or equals the file's
`FileType`. Per kept file:

| Column | Value |
|--------|-------|
| 0 | `Path` |
| 1 | `FileType` |
| 2 | `valid` / `invalid` (file exists or not); row colour RGB 166, 168, 171 / 184, 137, 137 |
| 3 | with `Validateondisk`: `ResolvedPath` (first file of a multi-file sequence); without: `?` |
| 4 | with `Validateondisk`: Alienbrain version (suffix ` (checked-out)` when locked), `not in project`, `Alienbrain is not installed`, or `Alienbrain integration needs update`; without: `?` |
| 5 | `GUID` |
| 7 | true when any owner has lock type `siLockTypeRefModel`, else false |
| 6 | owners as text, plus ` (ref lock)` when column 7 is true |
| 8 | true when the resolved path starts with the active project path (with a trailing separator), else false |
| cache grid, 0 | `Path` |

When the fill runs from the open page, the grid height is set from
`ShowRecords`: `All`, or fewer rows than the number, removes the fixed height;
otherwise height = 21 × number + 21.

On opening the page, a `Target` that no longer resolves is reset to `Scene`
and the grid is refilled; changing `Target`, `Validateondisk`, `FileType`,
`ShowRecords` or `RefreshMe` refills it and refreshes the page.

### `SISetExternalFilesManagerTarget` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `Target` | `""` | text for the viewer's `Target` parameter (`Scene` or a model name) |

Acts on the instance held by `SIGetExternalFilesViewerProp`.

- `Target` not empty: set the viewer's `Target` to it (which refills the grid
  through the page logic when the page is open).
- `Target` empty: check that the current `Target` text still resolves to
  objects; if resolving raises, set `Target` to `Scene`. Then flip the
  `RefreshMe` toggle to force a refill.

Any failure (including "no viewer instance yet") logs `Error running
SISetExternalFilesManagerTarget. Try re-opening the view` at information level.
Returns nothing.

### `ConnectToWorkgroupUI` (SPEC)

No arguments. Interactive; flagged as not usable in batch.

1. Show the dialog (below). Cancel, or an empty directory: stop, returning
   nothing.
2. If the chosen path, after `XSIUtils.ResolvePath`, is not an existing
   folder: message box with text id 7158 and the path, then back to step 1
   (the dialog reopens pre-filled with the last path).
3. Trim the path (`TrimString`).
4. If the resolved path equals an entry of `Application.Workgroups` (exact
   text comparison): message box "This workgroup is already in the list",
   return `""`.
5. `Application.AddWorkgroup <path>`; then log text id 7164 as a warning. If
   adding raises: message box with text id 7191 and the error description,
   return `""`.
6. Refresh the Plug-in Manager: on the first view of type `Plugin Manager` in
   the active layout, set the attribute `refresh` to an empty string (nothing
   if no such view).
7. Return the path.

**Dialog.** A temporary stand-alone custom property named `ConnectWorkgroup`
with a string parameter `Directory`, pre-set to the last path entered in this
session (initially empty). Layout dictionary `XSIPLUGINUI` (so labels are
translated automatically): one group with the static text "Pick the root
location of an existing workgroup" and `Directory` as a folder control without
label. If the SDK example workgroup folder
(`<factory path>\XSISDK\examples\workgroup`) exists and is not connected yet,
a hidden string parameter `SDKExampleWorkgroupPath` holding that path, a
spacer and a button `SDKWorkgroup` labelled "Try SDK Example Workgroup" are
added; the button copies the path into `Directory`. Shown modally with title
"Connect to Workgroup". On OK the directory is remembered as the last path.
The property is deleted afterwards.

The command is reachable from the Workgroup Manager File menu as the command
item "Connect...".

### `SDKGetScriptGenerator` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `Language` | none | `VBScript`, `JScript`, `Python`, `Cpp`, `C#`, `HLSL`, `CGFX` (or `PerlScript`, see below) |

Returns a writer object for that language. Any other value returns nothing.
`PerlScript` selects a writer that the file does not define under the name it
uses, so the call ends in a script error *(inferred)*; the Perl writer is
marked incomplete in the file.

**One buffer for all writers.** Text is appended to a single buffer held by
the plug-in, shared by every writer object ever returned. `Clear()` empties
it, `Append(text)` adds raw text, `GetWriterString()` returns it. Callers
clear before use.

**Members common to all writers** (a language may replace them, next table):

| Member | Behaviour |
|--------|-----------|
| `Type` | `SDK Script Generator` |
| `Language` | the language name as passed |
| `StrConst(s)` | `s` in double quotes; nothing is escaped |
| `StripType(x)` | for a string: its last space-separated word (`CValue & x` → `x`); for an array: every string element replaced in place, array returned |
| `StripVar(x)` | for a string: its first space-separated word; other values unchanged |
| `CallbackSuccess` | `true` |
| `LogMessage(text)` | emits an object-model call `Application.LogMessage` with the arguments `text` and `siVerbose` |
| `BeginStdFn(name)` | begins a function `name` with the single argument `in_ctxt` |
| `NestingPrefix(n)` | `n` tab characters |
| `UseConstant(text, prefix)` | returns `text`. Raises the text `Prefix is not defined. Prefix should be the name of the enum. C# needs it` when `prefix` is missing or empty |
| `BeginClass(name, base)`, `EndClass()` | return an empty string, emit nothing |
| `BoolStr(v)` | `true` / `false` |

**Emitted text per language.** `⇥` is one tab, `⏎` a line feed. Argument
lists given as arrays are joined with `,` and no space; a single string is
used as it is; null means no arguments. A null element of an argument array
is written as the word `null` in the JScript, C++, C# and Python writers
*(inferred from string conversion)*. `[…]` marks an optional part.

| Method | JScript | Cpp | C# | VBScript | Python |
|--------|---------|-----|----|----------|--------|
| `BeginFn(ret, name, args)` | `function name( args )⏎{⏎`; types stripped from args; without args `function name( )` | `SICALLBACK name( args )⏎{⏎`; `ret` ignored, args kept as given | `⇥public ret name( args )⏎⇥{⏎` | `function name( args )⏎`; types stripped | `def name( args ):⏎`; types stripped; without args `def name( ):` |
| `EndFn(name, retval[, isObject])` | [`⇥return retval;⏎`] `}⏎⏎` | same as JScript | [`⇥⇥return retval;⏎`] `⇥}⏎⏎` | [`⇥[set ]name = retval⏎`] `end function⏎⏎` (`set` when `isObject`) | [`⇥return retval⏎`] `⏎` |
| `VarDecl(vars)` | `⇥var names;⏎` (types stripped, one line) | one line per variable: `⇥decl;⏎` (type kept) | one line per variable `Type name`: `⇥⇥Type name = null;⏎` | `⇥dim names⏎` (types stripped) | emits nothing |
| `FnCall(ret, fn, args, isObject, declare)` | `⇥[[var ]ret = ]fn(args);⏎` (`var` when `declare`) | `⇥[[type ]ret = ]fn(args);⏎` (`declare` is the type text) | `⇥⇥[[type ]ret = ]fn(args);⏎` | with `ret`: `⇥[dim ret : ][set ]ret = fn(args)⏎`; without: `⇥fn args⏎` (space, no brackets) | `⇥[ret = ]fn(args)⏎` |
| `OMCall(ret, obj, method, args, isObject, declare)` | `FnCall` on `obj.method` | same | same; with a null `obj`, a plain call of `method` | same | same |
| `OMAssignProp(obj, prop, val, isObject)` | `⇥obj.prop = val;⏎` | `⇥obj.Putprop(val);⏎` | `⇥⇥obj.prop = val;⏎` | `⇥[set ]obj.prop = val⏎` | `⇥obj.prop = val⏎` |
| `OMReadProp(ret, obj, prop, isObject, type)` | `⇥ret = obj.prop;⏎` (type stripped from `ret`) | `⇥[type ]ret = obj.Getprop();⏎` | `⇥⇥ret = [(type)]obj.prop;⏎` | `⇥[set ]ret = obj.prop⏎` | `⇥ret = obj.prop⏎` |
| `Comment(lines, nesting)` | each line: nesting tabs, `// `, text | same | same | prefix `' ` | prefix `# ` |
| `StrCat(parts)` (returns text) | joined with ` + ` | same | same | joined with ` & ` | each part wrapped as `str(part)`, joined with ` + ` |
| `ToStr(expr)` (returns text) | unchanged | unchanged | unchanged | `cstr(expr)` | `str(expr)` |
| `ORSyntax` | ` \| ` | ` \| ` | ` \| ` | ` OR ` | ` + ` |
| `StrConst(s)` | `"s"` | `L"s"` | `"s"` | `"s"` | `"s"` |
| `BoolStr(v)` | `true` / `false` | same | same | `True` / `False` | `True` / `False` |
| `CallbackSuccess` | `true` | `CStatus::OK` | `true` | `true` | `true` |
| `UseConstant(text, prefix)` | `text` | `text` | `prefix.text` | `text` | `constants.text` |
| `LogMessage(text)` | `⇥Application.LogMessage(text,siVerbose);⏎` | `⇥Application().LogMessage(text,siVerboseMsg);⏎` | `⇥⇥Log(text);⏎` | `⇥Application.LogMessage text,siVerbose⏎` | `⇥Application.LogMessage(text,constants.siVerbose)⏎` |
| `BeginStdFn(name)` | `BeginFn` with `in_ctxt` | `SICALLBACK name( CRef& in_ctxt )⏎{⏎⇥Context ctxt( in_ctxt );⏎` | `⇥public bool name( Context in_ctxt )⏎⇥{⏎` | `BeginFn` with `in_ctxt` | `BeginFn` with `in_ctxt` |
| extra members | - | `BeginLocalFn(ret, name, args)`: `ret name( args )⏎{⏎` | `BeginClass(name, base)`: `⏎public class name[ : base]⏎{⏎`; `EndClass()`: `}⏎` | `BeginSub(name, args)`: `sub name( args )⏎`; `EndSub()`: `end sub⏎⏎` | - |

VBScript `FnCall` argument arrays: a null element is written as nothing;
trailing null elements are dropped together with their commas; other elements
are separated by `,`.

A `FnCall` whose argument value is neither null, a string nor an array logs
`Error call to JS_FnCall <ret> <fn> <args>` (resp. `CPP_FnCall`, `CS_FnCall`,
`Python_FnCall`) and still emits the call with an empty argument list.

**HLSL and CGFX writers.** `Comment`, `VarDecl`, `BeginFn`, `EndFn`,
`BeginLocalFn` and `StrCat` behave as in the Cpp writer; `ToStr` returns its
argument; `CallbackSuccess` is `true`; `ORSyntax` ` | `. There is no `FnCall`,
`OMCall`, `OMAssignProp` or `OMReadProp` (so `LogMessage` cannot be used
*(inferred)*). Additional members, all returning text:

| Member | HLSL | CGFX |
|--------|------|------|
| `UIParamDeclTempl()` | `rtshader_uiparam_decl.hlsl.template` | same |
| `UIParamColorDeclTempl()` | `rtshader_color_uiparam_decl.hlsl.template` | same |
| `UIParamTex2DDeclTempl()` | `rtshader_texture_uiparam_decl.hlsl.template` | same |
| `SemanticParamDeclTempl()` | `rtshader_semantic_param_decl.hlsl.template` | same |
| `SASParamDeclTempl()` | `rtshader_sas_param_decl.hlsl.template` | same |
| `GlobalDeclTempl()` | `rtshader_global_decl.hlsl.template` | same |
| `ShaderFuncDeclTempl()` | `rtshader_shaderfunc_decl.hlsl.template` | `rtshader_shaderfunc_decl.cgfx.template` |
| `MatrixDeclTempl()` | `rtshader_matrix_decl.hlsl.template` | same |
| `UIParamNoMinMaxDeclTempl()` | `rtshader_uiparam_nominmax_decl.hlsl.template` | same |
| `Extension()` | `.fx` | `.cgfx` |
| `StructMember(kind)` | by `kind` without regard to case: `position` → `float4 position : POSITION0;`; `normal` → `float4 normal : NORMAL;`; `color` → `float4 color : COLOR0;`; `binormal` → `float4 binormal : BINORMAL0;`; `tangent` → `float4 tangent : TANGENT0;`; a name starting with `texcoord` → `float4 <lower-case name> : <UPPER-CASE NAME>;`; otherwise `undefined HLSL struct data member;` | same |

### `PPGLayoutControl` (SPEC)

| Argument | Default | Meaning |
|----------|---------|---------|
| `LayoutList` | none | string parameter shown as a list box; its value is the selected list entry |
| `LayoutListUI` | none | the layout item (list-box control) of that parameter |
| `LayoutString` | none | string parameter that stores the layout in encoded form |
| `errorReporter` | registered default 0 (registry shows none) | object with a `Warning(text)` method; when null, a built-in reporter that logs `LayoutControl: <text>` as a warning |

Returns a controller object, `Type` `LayoutControl`. It edits a nested
tab / group / row layout for the SDK wizards.

**Encoded layout (`LayoutString`).** Entries joined by `|`. An entry is either
a parameter name, or a marker: `T:<name>` / `t:<name>` open / close a tab,
`G:<name>` / `g:<name>` a group, `R:<name>` / `r:<name>` a row. An empty
string is an empty layout. Raw item = `{type, id}` where `type` is the marker
letter (empty for a parameter) and `id` the name.

**List box content.** After each change the list box `UIItems` are rebuilt,
one label / value pair per entry, plus a final empty pair (`""`, `""`) so that
"insert before selection" can address the end:

- label: two spaces of indentation per open block, then `Tab "<name>" {`,
  `Group "<name>" {`, `Row {`, `}` for any close marker, or the parameter
  name. A label that already occurred gets trailing spaces appended (one more
  for each repeat) to stay unique;
- value: the entry's id; the 2nd, 3rd… entry with the same id gets the suffix
  `_1`, `_2`… (a close marker shares its id with its open marker, so it
  carries `_1`).

The "selected index" is the position of the pair whose value equals the
`LayoutList` value, or −1.

| Method | Behaviour | Returns |
|--------|-----------|---------|
| `addParameter(name)` | inserts `name` before the selected entry, rebuilds the list. With nothing selected the entry lands before the last existing entry *(inferred from the array insert rule; the file's header text says "at the end")* | true |
| `addTab(name)` | empty name: nothing. A tab of that name exists: warning `A Tab with the same name already exists.`. Otherwise scan backwards from the entry before the selection for a tab marker: an open marker → warning `A new Tab cannot be enclosed in another Tab.`; a close marker → start just after it; none → start at 0. Scan forwards from the selection: a close marker → warning `Something odd going on.`; an open marker → end just before it; none → end of list. Insert `T:name` at the start and `t:name` at the end (after the shift), rebuild | true if added, else false |
| `addGroup(name)` | empty name: nothing. Existing `G:name`: warning `A Group with the same name already exists.`. Otherwise insert `G:name` and `g:name` as two adjacent entries before the selection (at positions 0 and 1 when nothing is selected), rebuild | true / false |
| `addRow()` | picks the first unused name `row0`, `row1`…; inserts `R:` and `r:` markers like `addGroup`, rebuilds | true |
| `moveSelected(dir)` | only `dir` = +1 or −1; needs a selection and a target inside the list; a marker cannot move onto another marker. Swaps the entry with its neighbour, stores, rebuilds | true if the stored string changed, else false |
| `deleteSelected()` | needs a selection. Removes the entry; for a marker also removes its partner (same letter in the other case, same name; if none is found logs the warning `LayoutList_FindPartner: Unmatched grouping!`). Rebuilds, then selects the entry now at the old position, the one before when the last was removed, or the first when that fails | true / false |
| `updateList(validNames)` | empty layout: false. Removes every parameter entry whose name is not in `validNames` (markers stay). Rebuilds the list if something was removed or if the list box was empty | true if rebuilt |
| `getLayout(indent)` | array of text lines in SPDL layout syntax: `Tab "<name>"`, `{`, …, `}`; `Group "<name>"`, `{`, …, `}`; `Row`, `{`, …, `}`; parameter `<name>;`. Each open block adds one `indent` to the following lines. `indent` must be supplied (the header's "default one tab" is not implemented, *inferred*) | array |
| `getLayoutRawData()` | array of raw items `{type, id}` in order | array |
| `generateLayoutMethod(writer, wizard, objName, objType)` | emits a `_DefineLayout` callback into the script-generator buffer, below | nothing |

**`generateLayoutMethod`.** `writer` is a `SDKGetScriptGenerator` object,
`wizard` the wizard property (its grid `Params` with columns `Name` and `Type`
is read), `objName` the plug-in item name; `objType` is not used. Emitted, in
order:

1. A two-line comment: `Tip: Use the "Refresh" option on the Property Page
   context menu to ` / `reload your script changes and re-execute the
   DefineLayout callback.`
2. A standard callback begin named `<objName>_DefineLayout` (C#:
   `DefineLayout`).
3. Variable declarations `PPGLayout oLayout` and `PPGItem oItem`.
4. Read of property `Source` of the context (`in_ctxt`; `ctxt` for Cpp) into
   `oLayout`, as an object assignment, cast to `PPGLayout` for C# only.
5. Call `oLayout.Clear`.
6. Layout calls. With an **empty** layout: one parameter block (below) per row
   of the wizard's `Params` grid, in grid order. Otherwise per raw item:
   `G` → `oLayout.AddGroup("<name>")` (C#: arguments `"<name>"`, true, 0);
   `g` → `oLayout.EndGroup`; `T` → `oLayout.AddTab("<name>")`; `t` → nothing;
   `R` → `oLayout.AddRow`; `r` → `oLayout.EndRow`; parameter → its type is
   looked up by name in the grid and a parameter block is emitted; a name not
   in the grid logs the warning `Unexpected: parameter <name> found in layout
   but not in parameter list` and is skipped.
7. Function end returning the writer's `CallbackSuccess`.

Parameter block by grid type:

| Type | Emitted calls |
|------|---------------|
| `Button` | `oLayout.AddButton("<name>")` (C#: second argument `null`) |
| `Grid`, `FCurve` | `oLayout.AddGroup("<name>")` (C#: `"<name>"`, true, 0); `oItem = oLayout.AddItem("<name>")` as an object assignment (C#: two extra null arguments); `oItem.SetAttribute(siUIValueOnly, true)` (Cpp: `PutAttribute`; the constant goes through `UseConstant`); `oLayout.EndGroup` |
| `Color` | `oLayout.AddColor("<name>_R", "<name>", true)` |
| anything else | `oLayout.AddItem("<name>")` (C#: two extra null arguments) |

For Cpp the `UseConstant` call is made without a prefix, which makes the
writer raise its "Prefix is not defined…" text; generating a Cpp layout with a
grid or curve parameter therefore fails *(inferred)*.

### `GetWizardParamTab` (SPEC-PARTIAL)

| Argument | Default | Meaning |
|----------|---------|---------|
| `in_Type` | `""` | `CustomProperty`, `CustomOperator` or `CustomPrimitive` |

Returns a helper object for the "Add Parameter" tab shared by the custom
property, operator and primitive wizards. It holds a `WizardHelper` object and
the type text. Missing for SPEC: the text of the two template files used for
compiled languages (`PPGEvent.cpp.template`, `PPGEvent.cs.template`).

| Method | Behaviour |
|--------|-----------|
| `AddParameters(prop)` | adds the wizard's working parameters to `prop` (table below) and sets `ParamType` = `siInt4`, `ParamName` = `Param` |
| `BuildParamTabLayout(layout, paramType, genButtonText, existingCount)` | adds the tab "Add Parameter" (below) |
| `UIRange_OnChanged(ppg)` | enables (when `UIRange` is true) or disables the six parameters `UIMinInt4`, `UIMinUByte`, `UIMinFloat`, `UIMaxInt4`, `UIMaxUByte`, `UIMaxFloat` |
| `AddParam_OnClicked(ppg)` | validates and appends one row to the `Params` grid (below) |
| `PopulateParamListFromExistingPSet(ppg, objectName)` | fills the grid from an existing scene object (below) |
| `GenerateDefineMethod(writer, wizardProp, objName)` | emits the `_Define` callback (below) |
| `GenerateLogicCallbacks(writer, lang, wizardProp, objName)` | emits page-event callbacks (below) |
| `SupportsReadOnly(type)` | false for `Button`, else true |
| `SupportsAnimatable(type)` | false for `Button`, `Grid`, `FCurve`, `String`; else true |
| `IncrementParameterName(param)` | a value ending in digits gets that number plus one; otherwise `1` is appended |
| `TestRanges(default, min, max, uiMin, uiMax, useUI)` | first failing test shows a message box and returns false: min ≥ max (7206); default < min (7207); default > max (7208); with `useUI`: uiMin < min (7209); uiMax > max (7210); uiMax ≤ uiMin (7211). Else true |
| `SetRange(grid, row, default, min, max, uiMin, uiMax, useUI)` | writes `Default`, `Min`, `Max`; `UIMin` / `UIMax` get the UI values, or min / max when `useUI` is false |
| `ReasonableNumber(n)` | undefined when n < −100000 or n > 100000, else n |
| `StrFromVariantType(t)` | name of the `siVariantType` value for `siEmpty`, `siInt2`, `siInt4`, `siFloat`, `siDouble`, `siString`, `siDispatch`, `siBool`, `siUnknown`, `siByte`, `siUByte`, `siUInt2`, `siUInt4`, `siWStr`; other values unchanged |
| `GenerateAddParamCall`, `GenerateAddParamCallLowLevel`, `GeneratePropAddParamCallLowLevel`, `GenerateOpAddParamCallLowLevel`, `GenerateLogicCallbacksScripting`, `GenerateLogicCallbacksCompiled` | internal steps of the two generators, described with them |

**Working parameters added by `AddParameters`.**

| Parameter | Type | Default | Min / max | UI min / max |
|-----------|------|---------|-----------|--------------|
| `Params` | grid, 11 columns: `Type`, `Name`, `Callback`, `Read-Only`, `Animatable`, `Keyable`, `Default`, `Min`, `Max`, `UIMin`, `UIMax` | - | - | - |
| `ParamType`, `ParamName`, `DefaultString` | string | none | - | - |
| `ReadOnly`, `Animatable` | boolean | none | - | - |
| `Keyable`, `Callback` | boolean | true | - | - |
| `DefaultBool`, `UIRange` | boolean | false | - | - |
| `DefaultInt4`, `MinInt4`, `UIMinInt4` | 32-bit integer | 0 | none | −500 / 500 |
| `MaxInt4`, `UIMaxInt4` | 32-bit integer | 100 | none | −500 / 500 |
| `DefaultUByte`, `MinUByte`, `UIMinUByte` | unsigned byte | 0 | 0 / 255 | 0 / 255 |
| `MaxUByte`, `UIMaxUByte` | unsigned byte | 255 | 0 / 255 | 0 / 255 |
| `DefaultFloat`, `MinFloat`, `UIMinFloat` | float | 0 | none | −1 / 1 |
| `MaxFloat`, `UIMaxFloat` | float | 1 | none | −1 / 1 |
| `DefaultColorR`, `DefaultColorG`, `DefaultColorB`, `DefaultColorA` | double | 0 | 0 / 1 | 0 / 1 |

The float range parameters also serve the `siDouble` type.

**Tab "Add Parameter".** Group "Define Item": combo on `paramType` (label /
value: Boolean / `siBool`, Button / `Button`, "Color (with Alpha)" / `Color`,
"Double Precision Number" / `siDouble`, "Floating Point Number" / `siFloat`,
FCurve / `FCurve`, "Grid Control" / `Grid`, Integer / `siInt4`, "Small
Integer" / `siUByte`, Text / `siString`; for `CustomOperator` the float, curve
and grid entries are absent); `ParamName` labelled "Name/Label"; `ReadOnly`
unless the type is `Button`; `Animatable` and `Keyable` when the type supports
animation; `Callback` unless the helper type is `CustomPrimitive`; then by
type: `siString` → `DefaultString` "Default"; `siInt4`, `siUByte`, `siFloat` /
`siDouble` → the matching default "Default", group "Value Range" (min "Min",
max "Max"), group "UI Value Range" (`UIRange`, UI min "UI Min", UI max "UI
Max"); `siBool` → `DefaultBool` "Default"; `Color` → colour control on
`DefaultColorR` labelled "Default", with alpha. Group "Parameters": a row with
buttons `AddParam` "Add Item" and `RemoveParam` "Delete Selected"; then the
static text "No parameters defined" when `existingCount` is 0, otherwise the
`Params` grid (no label, header selection). Last, button `Generate2` labelled
with `genButtonText`.

**`AddParam_OnClicked`.**

1. Empty `ParamName`: message box 7203, stop.
2. Name = `ParamName` trimmed with spaces replaced by `_` (`RemoveSpaces`).
3. A grid row already has that name: message box 7204, stop.
4. For `siInt4`, `siUByte`, `siFloat` / `siDouble`: `TestRanges` on the
   matching parameters; stop on failure.
5. Append a row: `Type` = `ParamType`; `Name`; `Callback`, `Read-Only`,
   `Animatable`, `Keyable` as the texts `true` / `false`; ranges through
   `SetRange` (float values rounded to three decimals); `Color` → `Default` =
   the four components joined by `,`; `siBool` → `Default` = `true` / `false`;
   `siString` → `Default` = `DefaultString`. Row label two spaces.
6. Increment the name in `ParamName`.

**`PopulateParamListFromExistingPSet`.** Empty name: return false. Object not
found: message box 7205 (with the name), return false. Otherwise the grid is
overwritten with one row per parameter of the object: `Type` = variant type
name (`Grid` when the value is a grid data object, the value's class name for
other object values, for example `FCurve`); `Name` = script name; `Callback` =
`true`; `Read-Only`, `Animatable`, `Keyable` from the capability flags
`siReadOnly`, `siAnimatable`, `siKeyable`; for string and object parameters
`Default` = the default (strings only) and the four range cells left unset;
for the others `Default` = the default and `Min`, `Max`, `UIMin`, `UIMax` =
the parameter's limits passed through `ReasonableNumber`. No return value on
success.

**`GenerateDefineMethod`.** The object variable is `o` + type (for example
`oCustomProperty`). Emitted through the writer, in order:

1. Standard callback begin `<objName>_Define` (C#: `Define`).
2. Declaration `<type> o<type>`; for Cpp also `Parameter oParam`.
3. For `CustomOperator` / `CustomPrimitive`: declaration `CRef oPDef` (C#:
   `ParamDef oPDef`), and for Cpp the raw line `⇥Factory oFactory =
   Application().GetFactory();`.
4. Read of the context's `Source` into the object variable (object
   assignment; cast for C#).
5. Per grid row, the add-parameter calls below.
6. For `CustomOperator` only: an empty line, then assignments
   `AlwaysEvaluate` = the wizard's `AlwaysEval` value as `true` / `false`, and
   `Debug` = 1.
7. Function end returning `CallbackSuccess`.

Add-parameter calls for one row. Capabilities text = `siPersistable`, plus
`siReadOnly`, `siAnimatable`, `siKeyable` for each `true` cell, joined with
the writer's `ORSyntax`; each constant passes through `UseConstant` with the
prefix `(int)siCapabilities`. Classification = `siClassifUnknown` (prefix
`siParamClassification`). Unset grid cells count as null.

| Row type | Property flavour (`CustomProperty`) | Operator flavour (`CustomOperator`, `CustomPrimitive`) |
|----------|-------------------------------------|---------------------------------------------------------|
| `Button` | nothing | nothing |
| `Color` | four numeric calls named `<name>_R`, `_G`, `_B`, `_A`, type `siDouble`, defaults from the comma-separated cell, min 0, max 1, UI 0 to 1 | same, operator flavour |
| `Grid` | `o<type>.AddGridParameter("<name>")` | `oPDef = <factory>.CreateGridParamDef("<name>")`, then the add call |
| `FCurve` | `o<type>.AddFCurveParameter("<name>")` | `oPDef = <factory>.CreateFCurveParamDef("<name>")`, then the add call |
| `siString` | scripting: `AddParameter2("<name>", type constant, "<default>", null, null, null, null, classification, capabilities)` (C#: three more nulls). Cpp: `AddParameter(L"<name>", CValue::siString, capabilities, L"", L"", L"<default>", oParam)` | scripting: `oPDef = <factory>.CreateParamDef2("<name>", type constant, "<default>", null, null)` as an object assignment. Cpp: `oPDef = oFactory.CreateParamDef(L"<name>", CValue::siString, L"<default>")`. Then the add call |
| numeric | scripting: `AddParameter2("<name>", type constant, default, min, max, uiMin, uiMax, classification, capabilities)` (C#: three more nulls). Cpp: `AddParameter(L"<name>", CValue::<type>, capabilities, L"", L"", default, min, max, uiMin, uiMax, oParam)` | scripting: `oPDef = <factory>.CreateParamDef("<name>", type constant, classification, capabilities, "", "", default, min, max, uiMin, uiMax)` as an object assignment. Cpp: `oPDef = oFactory.CreateParamDef(L"<name>", CValue::<type>, capabilities, L"", L"", default, min, max, uiMin, uiMax)`. Then the add call |

`<factory>` is `XSIFactory` (scripting), `GetFactory()` (C#) or `oFactory`
(Cpp). The add call is `o<type>.AddParameter(oPDef)` (Cpp: `(oPDef, oParam)`).
In Cpp output the type `siUByte` is written `siUInt1`, whole numbers get the
suffix `l`, and null values become `CValue()`. A null string default stays
unquoted.

**`GenerateLogicCallbacks`.**

- Scripting languages: a function `<objName>_OnInit` and one
  `<objName>_OnClosed`, each logging `<function name> called`. Then, for every
  grid row whose `Callback` is `true`: `Button` → `<objName>_<name>_OnClicked`
  logging `… called`; `Color` → four functions `<objName>_<name>_R_OnChanged`,
  `_G_`, `_B_`, `_A_`, each logging; other types → `<objName>_<name>_OnChanged`
  which logs, declares `oParam`, reads `PPG.<name>` into it (object
  assignment), then for `Grid` declares `oGridData` and reads `oParam.Value`
  into it (object), for `FCurve` the same with `oFCurve`, otherwise declares
  `paramVal`, reads `oParam.Value` into it and logs the concatenation of the
  constant `New value: ` and `paramVal`. Functions are begun without arguments
  and ended without a return value.
- `Cpp` / `C#`: the template `PPGEvent.cpp.template` (C#:
  `PPGEvent.cs.template`) from the wizard template folder is expanded with the
  tokens `%%plugin%%` → `objName` and `%%objtype%%` → the helper type, and the
  result appended to the buffer.

### `GetShaderDefHelper` (SPEC-PARTIAL)

| Argument | Default | Meaning |
|----------|---------|---------|
| `wiz` | none | the wizard custom property; must already have a `Language` parameter |

Returns a helper object shared by the shader definition, hardware shader and
mental ray shader wizards. On creation it stores `wiz`, a `WizardHelper`
object and a `SDKGetScriptGenerator` writer for `wiz.Language`. Missing for
SPEC: the text of the template files it expands (prefixes `shaderdef_reg`,
`shaderdef_defineinfo_attrib`, `shaderdef_defineinfo_CB`,
`shaderdef_define_CB`, `shaderdef_input_paramdef`,
`shaderdef_input_paramdef_default`, `shaderdef_input_paramdef_attrib`,
`shaderdef_output_paramdef`, `shaderdef_rendereroption`,
`shaderdef_rendereroptions_def`, `shaderdef_rendererdef`,
`shaderparserdef_reg`, `shaderparserdef_CB`, `hwshader_CB`; the template
folder is not in the staged install).

| Method | Behaviour |
|--------|-----------|
| `CreateShaderDefParams()` | adds the shader-definition parameters to the wizard (tables below) |
| `CreateShaderParserParams()` | adds three string parameters without defaults: `ShaderParserName`, `ShaderParserFolder`, `ShaderParserExt` |
| `BuildShaderDefLayout()` | adds the tabs "Definition" and "Parameters" (below) |
| `BuildParserLayout()` | adds the tab "Parser": `ShaderParserName` "Name"; `ShaderParserFolder` "Directory" as a folder control starting in `<user path>\Application\Plugins`; `ShaderParserExt` "File Extension"; button `GenerateCode` "Generate Code" |
| `AddInputParamToGrid()` | appends the input parameter being edited to `InParamGrid` (below); returns the new row index, or nothing when a default image is missing |
| `AddOutputParamToGrid()` | appends a row to `OutParamGrid`: unique name, type, description (`OutParamLongName`), main flag as writer boolean text; returns the row index |
| `AddRendererOptionToGrid()` | empty `ShaderDefRendOptionName`: error log `No option specified.`, returns −1. Otherwise appends name (made unique within the grid) and `ShaderDefRendOptionVal`; returns the row index |
| `OnButtonClick(button)` | see table below |
| `OnParamChanged(name)` | see table below |
| `GenerateShaderDefRegisterCode()` | expands template `shaderdef_reg` for the wizard language with `%%shaderclass%%`, `%%major%%`, `%%minor%%`; returns the text |
| `GenerateRegisterParserCode()` | when `ShaderParserName` is not empty: expands `shaderparserdef_reg` with `%%parser_name%%`; otherwise returns nothing |
| `GenerateShaderDefCallback()` | returns the DefineInfo text followed by the Define text (below) |
| `GenerateParserCallback()` | when `ShaderParserName` is not empty: expands `shaderparserdef_CB` with `%%parser_name%%`, `%%folder%%`, `%%ext%%`; otherwise nothing |
| `GenerateHWShaderCode()` | returns a two-element array (file name, code), both empty unless `ShaderDefRendShaderType` is `hwshader`. If the renderer name is empty or `Mental ray`, or the symbol is empty: logs `Wrong Renderer name or symbol name specified.` and returns the empty pair. Otherwise file name = class name with spaces replaced + `_shader`; code = template `hwshader_CB` (always the Cpp one) with `%%symbol%%`, `%%major%%`, `%%minor%%`, `%%renderername%%` (renderer name in lower case), `%%shadername%%` |
| `ShaderDefCppIncludeFiles()` | returns six include lines, one per line, for the headers `xsi_factory.h`, `xsi_shaderdef.h`, `xsi_shaderparamdefoptions.h`, `xsi_shaderparamdefcontainer.h`, `xsi_metashaderrendererdef.h`, `xsi_valuemap.h` (angle-bracket form) |

Templates are located as `<template folder><prefix>` + `.py.template`,
`.js.template`, `.cpp.template` or `.vbs.template` by language (the
`WizardHelper` rule).

**Parameters added by `CreateShaderDefParams`.**

| Parameter | Type | Default |
|-----------|------|---------|
| `ShaderDefClassName` | string | `MyShader` |
| `ShaderDefMajor` / `ShaderDefMinor` | integer | 1 / 0 |
| `ShaderDefFamily` | string | `siShaderFamilyTexture` |
| `ShaderDefCategory` | string | `My Shader Category` |
| `ShaderDefDisplayName` | string | `My Shader` |
| `ShaderDefAttrib`, `ShaderDefAttribVal` | string | none |
| `InParamName`, `InParamLongName` | string | `input` |
| `InParamType` | string | `siShaderDataTypeScalar` |
| `InParamTexturable`, `InParamAnimatable`, `InParamInspectable` | boolean | true |
| `InParamReadOnly` | boolean | false |
| `InParamHardLimitMinI` / `MaxI`, `InParamSoftLimitMinI` / `MaxI` | integer | 0 / 1, 0 / 1 |
| `InParamHardLimitMinF` / `MaxF`, `InParamSoftLimitMinF` / `MaxF` | float | 0 / 1, 0 / 1 |
| `InParamAttrib`, `InParamAttribVal` | string | none |
| `InParamDefaultValBool` | boolean | none |
| `InParamDefaultValInt` | integer | none |
| `InParamDefaultValScalar1` … `Scalar4`, `InParamDefaultValColorR` / `G` / `B` / `A` | float | none |
| `InParamDefaultValImage` | string | none |
| `InParamDefaultValDisabled` | string | none; created disabled |
| `InParamGrid` | grid, 14 columns: 0 name (7120), 1 type (7123), 2 description (7230), 3 texturable (7231), 4 animatable (7232), 5 inspectable (7233), 6 read-only (7243), 7 hard min (7234), 8 hard max (7235), 9 soft min (7237), 10 soft max (7236), 11 attribute (7238), 12 attribute value (7241), 13 default (7229) | - |
| `OutParamName`, `OutParamLongName` | string | `out` |
| `OutParamType` | string | `siShaderDataTypeScalar` |
| `OutParamMain` | boolean | false |
| `OutParamGrid` | grid, 4 columns: name (7120), type (7123), description (7230), main (7242) | - |
| `ShaderDefRendName` | string | `OpenGL` |
| `ShaderDefRendSymbol` | string | `MyShader` |
| `ShaderDefRendCodePath`, `ShaderDefRendShaderType` | string | empty |
| `ShaderDefRendOptionName`, `ShaderDefRendOptionVal` | string | none |
| `RendOptionGrid` | grid, 2 columns: name (7120), "Value" | - |
| `ParamNameSuffix` | integer | none; counter for unique names |

**Enumerations offered** (each shown as an alphabetically sorted combo, label
= value):

| Use | Values |
|-----|--------|
| Shader family | `siShaderFamilyCntContrast`, `siShaderFamilyCntMat`, `siShaderFamilyCntStore`, `siShaderFamilyData`, `siShaderFamilyEnvironment`, `siShaderFamilyGeometry`, `siShaderFamilyLens`, `siShaderFamilyLight`, `siShaderFamilyLightmap`, `siShaderFamilyOutput`, `siShaderFamilyPhenomMat`, `siShaderFamilyPhotonLight`, `siShaderFamilyPhotonMat`, `siShaderFamilyPhotonVolume`, `siShaderFamilyShadowMat`, `siShaderFamilyState`, `siShaderFamilySurfaceMat`, `siShaderFamilyTexture`, `siShaderFamilyVolume`, `siShaderFamilyRTShader` |
| Input data type | `siShaderDataTypeArray`, `…Boolean`, `…Color3`, `…Color4`, `…Custom`, `…Gradient`, `…Image`, `…Integer`, `…Matrix33`, `…Matrix44`, `…ProfileCurve`, `…Property`, `…Quaternion`, `…Reference`, `…Scalar`, `…String`, `…Structure`, `…Vector2`, `…Vector3`, `…Vector4`, and `siHWShaderPortType` |
| Output data type | the input list without `…Array`, `…Image`, `…Structure` |
| Input attribute name | `siReferenceFilterAttribute`, `siPropertyFilterAttribute`, `siCustomTypeNameAttribute`, `siShaderFamilyAttribute`, `siDefaultConnectionAttribute`, `siWritableImageAttribute`, `siWritableImageTypeAttribute`, `siRenderTreeNodeColorRAttribute`, `siRenderTreeNodeColorGAttribute`, `siRenderTreeNodeColorBAttribute` |
| Value for `siReferenceFilterAttribute` | `siObjectReferenceFilter`, `siCameraReferenceFilter`, `siLightReferenceFilter`, `siMaterialReferenceFilter`, `siShaderReferenceFilter`, `siGeometryReferenceFilter`, `siUserDataBlobReferenceFilter` |
| Value for `siPropertyFilterAttribute` | `siAnyPropertyFilter`, `siAnyVertexMapPropertyFilter`, `siUVPropertyFilter`, `siCAVPropertyFilter`, `siWeightMapPropertyFilter`, `siTextureMapPropertyFilter`, `siNormalPropertyFilter` |
| Value for `siCustomTypeNameAttribute` | `siMentalRayLightmapPortType`, `siMentalRayGeometryPortType`, `siMentalRayContourStorePortType`, `siMentalRayContourContrastPortType`, `siMentalRayPhenomenonMaterialPortType`, `siXGSRealTimePortType` |
| Renderer name | `OpenGL`, `DirectX9`, `Mental Ray` |

**Layout built by `BuildShaderDefLayout`** (labels 140 px minimum, 50 %):

- Tab "Definition": a row with buttons `HWShaderPreset` "Hardware Shader
  Preset" and `MRShaderPreset` "Mental ray Preset"; group "Shader" (class name
  "Name", "Major Version", "Minor Version", family combo "Family", "Category",
  "Display Name", "Attribute Name", "Attribute Value"); group "Renderer"
  (renderer combo "Name", "Symbol", "Code Path" with the open-file attribute,
  nested group "Options": option "Name" and "Value", a row with buttons
  `AddRendererOptionBtn` "Add" and `RemoveRendererOptionBtn` "Remove
  Selected", then text 7239 when the option grid is empty or the grid without
  label and with header selection); button `GenerateCode` "Generate Code".
- Tab "Parameters": group "Input Parameters" ("Name", type combo "Type",
  "Description", "Animatable", "Inspectable", "Texturable", "ReadOnly"; a
  "Default Value" control chosen by type: boolean, integer, first scalar,
  image file path (image-file and open-file attributes), or the disabled
  placeholder for all other types; group "Hard Limit Values" ("Min", "Max")
  and group "Soft Limit Values" ("Min", "Max") on the integer parameters for
  the integer type and the float ones otherwise, enabled only for scalar and
  integer types; group "Attribute" (attribute combo "Name"; "Value" as a combo
  of the matching list for the three filter / custom-type attributes, a plain
  field otherwise); an unnamed group with a row of buttons `InParamAddBtn`
  "Add" and `InParamRemoveBtn` "Remove Selected" and then text 7223 or the
  grid). Group "Output Parameters" ("Name", type combo "Type", "Description",
  "Main"; buttons `OutParamAddBtn` "Add", `OutParamRemoveBtn` "Remove
  Selected"; text 7223 or the grid). Button `GenerateCode` "Generate Code".

**`AddInputParamToGrid`.** The default-value text depends on the type:

- `siShaderDataTypeImage` with a non-empty default: the file is looked for as
  given (absolute path), then as `<user path>\Application\fxtextures\<value>`.
  Not found: error log `Selected image doesn't exist: <path>`, nothing added.
  If the file is not already in that `fxtextures` folder it is copied there
  (folder created as needed) and `Selected image has been copied to: <path>`
  is logged. The parameter and the grid then hold the bare file name;
- boolean: the writer's boolean text; integer: the value; scalar: the value
  rounded to three decimals; other types: empty.

The name is made unique across both grids without regard to case: on a clash
`ParamNameSuffix` is increased by one and appended to the name. The new row
gets name, type, description, the four flags as writer boolean text, hard and
soft limits (scalar: rounded to three decimals; integer: as they are; other
types: unset), default text, attribute name and value, and a two-space row
label.

**`OnButtonClick(button)`.**

| Button | Action | Returns |
|--------|--------|---------|
| `InParamRemoveBtn`, `OutParamRemoveBtn`, `RemoveRendererOptionBtn` | delete the selected rows of the matching grid | remaining row count |
| `HWShaderPreset` | clear the three grids; renderer name `OpenGL`, code path = the wizard's `PluginName`, shader type `hwshader`, family `siShaderFamilyRTShader`; add an output parameter `out` of type `siHWShaderPortType`, then blank the output edit fields; add the renderer option `siHWShaderVersionAttribute` = `siHWShaderV1`, then blank the option fields | 0 |
| `MRShaderPreset` | clear the three grids; renderer name `Mental ray`, code path `{LIBS}/xsibase.{EXT}`, shader type `mentalray`, family `siShaderFamilyTexture`; output edit fields set to type `siShaderDataTypeColor3`, name `out`, description `out` (no row added); option fields blanked | 0 |
| anything else | nothing | −1 |

"Clear" uses the wizard helper's grid clear, which removes row `i` for `i`
counting up while rows shift down, so a grid with several rows is not fully
emptied *(inferred)*.

**`OnParamChanged(name)`** returns true when it handled the name:

| Name | Action |
|------|--------|
| `InParamType` | blank `InParamAttrib` and `InParamAttribVal` |
| `OutParamType` | `OutParamMain` = false |
| `InParamAttrib` | `InParamAttribVal` = false |
| `ShaderDefClassName` | replace spaces in the class name; copy it to `ShaderDefRendSymbol` |
| `Language` | disable `ShaderDefRendCodePath` for `Cpp`, enable otherwise |
| other | nothing, returns false |

**`GenerateShaderDefCallback`.**

1. Optional attribute fragment: when attribute name and value are both set,
   template `shaderdef_defineinfo_attrib` with `%%attrib%%`, `%%attrib_val%%`.
2. DefineInfo text: template `shaderdef_defineinfo_CB` with `%%plugin%%`
   (wizard `PluginName`), `%%shaderclass%%`, `%%major%%`, `%%minor%%`,
   `%%category%%`, `%%displayname%%`, `%%attrib%%`, `%%attribcall%%` (the
   fragment).
3. Define text: template `shaderdef_define_CB` with `%%plugin%%`,
   `%%shaderclass%%`, `%%major%%`, `%%minor%%`, `%%shader_family%%` (family
   through `UseConstant`), `%%parameter_definitions%%`,
   `%%renderer_definition%%`.
4. Parameter definitions = for each input grid row, template
   `shaderdef_input_paramdef` with `%%param_name%%`, `%%param_type%%` (through
   `UseConstant`), `%%descr%%`, `%%animatable%%`, `%%inspectable%%`,
   `%%texturable%%`, `%%default%%`, `%%attrib%%`, `%%readonly%%`; followed by,
   for each output grid row, template `shaderdef_output_paramdef` with
   `%%param_name%%`, `%%param_type%%`, `%%descr%%`, `%%mainport%%`.
   - `%%default%%`: for integer and scalar rows, template
     `shaderdef_input_paramdef_default` with `%%hlmin%%`, `%%hlmax%%`,
     `%%slmin%%`, `%%slmax%%`, `%%default_val%%`; for an image row with a
     default, template `shaderdef_input_paramdef_attrib` with `%%attribname%%`
     = `DefaultTextureFilename` and `%%attribval%%` = the file name; otherwise
     empty.
   - `%%attrib%%`: when the row has attribute name and value, the same attrib
     template with those; otherwise empty.
5. Renderer definition: empty when the renderer name is empty. Otherwise each
   option row → template `shaderdef_rendereroption` with `%%option%%`,
   `%%value%%` (both as string constants; for shader type `hwshader` the
   **first** row's name and value go through `UseConstant` instead); a
   non-empty option text is wrapped by template
   `shaderdef_rendereroptions_def` (`%%options%%`); finally template
   `shaderdef_rendererdef` with `%%name%%`, `%%symbol%%`, `%%code_path%%`,
   `%%renderoptions%%`.

## Wire contract: Polygonizer

### `Create_Polygonizer_Polymesh` (SPEC)

No arguments. Returns true.

1. Remember the current selection.
2. Create an empty polygon mesh: `SIGetPrim "EmptyPolygonMesh", "Polygonizer"`
   (the new object is taken from the command's fifth, output, argument).
3. `DeselectAll`.
4. Select, in one `SelectObj` call, the comma-separated list: the new mesh's
   full name first, then the full name of every remembered object in its
   original order.
5. Run `ApplyPolygonizer` (no arguments; it works on the selection).
6. `DeselectAll`, then select the new mesh only.

No guards: with an empty selection the operator is applied to the new mesh
alone, and whatever `ApplyPolygonizer` does then applies (Q9).

## Errors and guards (summary)

| Command | Condition | Result |
|---------|-----------|--------|
| `RemoveFromList` | any failure | swallowed, nothing changes |
| `GetItemsAsString` | item unreadable | empty string |
| `SISetExternalFilesManagerTarget` | any failure | information log, text above |
| `OverrideMarkedPassParameters`, `ICEFlowInsertSimulationRoot` | any failure | suppressed; next statement runs |
| `OverrideMarkedPassParameters` | wrong selection / nothing marked | warning, returns true |
| `ICEFlowInsertSimulationRoot` | first root port not fed by an `Emit` port | warning, stops, no return value |
| `LagoaEmitMPVolume` | no polygon mesh | warning, returns true |
| `LagoaSetupAdvectMesh` | no geometry selected | error log, returns true |
| `LagoaSetupClothMesh` | nothing usable selected | silent, returns true |
| `RTShaderSetCategories` | a definition is missing | error log per missing shader, continues |
| `DeleteUnusedShaders` | container of another type | skipped silently |
| `ConnectToWorkgroupUI` | missing folder / duplicate / add failure | message box; loop, `""`, `""` |
| `SDKGetScriptGenerator` | unknown language | returns nothing |
| all others | bad argument | unguarded script error |

## Not covered

Registered by the same plug-ins but outside this row.

**RenderManager.vbs**

| Item | Kind | One-line role |
|------|------|---------------|
| `UpdateRenderManager` | command | points the panes of every open "Render Manager" view at the current pass and its renderer property |
| `MakeRendererLocalToPass` | command | makes a selected shared renderer property local to its pass |
| `MakePassRendererGlobal` | command | deletes a selected pass-local renderer property |
| `RenderCurrentFrame` | command | renders the current pass at the current frame |
| `RenderCurrentFrameAllPasses` | command | same for every pass |
| `CopyRenderOptions` | command | opens the view "Copy Render Options" |
| `OpenRenderingPreferences` | command | opens `preferences.rendering` |
| `CopyPassOptions` | property | two strings `CopySource`, `CopyTarget`; layout with one tab "PPG" |
| `OpenRenderManager` | menu | items "Copy Render Options..." and "Render Manager..." (separator between) |
| `RegionCopyOptions` | menu | sub-menu "Region Copy" with four viewport / pass copy items |

Neither in-scope command calls a helper of that file.

**Other files**

| File | Items not covered |
|------|-------------------|
| `ICEfxBuilder.vbs` | 26 menus: `Create_Particles`, `Create_Lagoa_Particles`, `Create_Strands`, `Create_Polygonizer` (`siMenuTbICEParticlesCreateID`); `OnEmission_Particles`, `OnEmission_Lagoa_Particles`, `OnEmission_Strands` (`siMenuTbICEParticlesOnEmissionID`); `AfterEmission_Particles`, `AfterEmission_Lagoa_Particles`, `AfterEmission_Strands` (`siMenuTbICEParticlesAfterEmissionID`); `Forces_Particles`, `Forces_Lagoa_Particles`, `Forces_Strands`, `Forces_Syflex` (`siMenuTbICEParticlesForceID`); `Collision_Particles`, `Collision_Lagoa_Particles`, `Collision_Strands`, `Collision_Syflex` (`siMenuTbICEParticlesCollisionID`); `Simulation` (`siMenuTbICEParticlesSimulationID`); `Model_Library`, `Model_Library_Lagoa_Particles`, `Model_Library_Strands` (`siMenuTbICEParticlesModelLibraryID`); `Deform_Create` (`siMenuTbICEDeformCreateID`); `Deform_Simulate` (`siMenuTbICEDeformSimulateID`); `Kinematics_Effects` (`siMenuTbICEKinematicsEffectsID`); `Kinematics_Constrain` (`siMenuTbICEKinematicsConstrainID`); and their callbacks |
| `PluginTreeActions.js` | menus `PTNodePlugin_Menu`, `PTNodePluginItem_Menu`, `PTNodeAddon_Menu`, `PTNodePlugins_Menu`, `PTNodeSPDLs_Menu`, `PTNodeViews_Menu`, `PTNodeToolbars_Menu`, `PTNodeView_Menu`, `PTNodeToolbar_Menu`, `PTNodeUserRoot_Menu`, `PTNodeFactoryRoot_Menu`, `PTNodeWorkgroupRoot_Menu`, `PTNodeCustomLocation_Menu`, `PluginTreeFile_Menu`, `PluginTabFile_Menu`, `SPDLFile_Menu`, `SPDLContext_Menu`, `WorkgroupFile_Menu`, `WorkgroupSelection_Menu`, `PPGContext_Menu`, `CustomPSetWizardInAnimateParameter`, and a debug-only set of test menus |
| `ExternalFileListViewer.js` | button logic of `CExternalFilesViewer` (browse, search and replace, sort, copy to project, clean-up, Alienbrain actions, help), and the properties `CCopyFilesDialog`, `CSearchAndReplaceDialog` |
| `CacheManager.js` | nothing further (properties and menu summarised above) |

## Dependencies

Commands, compounds, presets and objects the contracts call and that have no
contract in this project yet (checked against `docs/ghidra` and
`docs/re/COMMAND_DLL_MAP.md`):

| Kind | Names | Used by |
|------|-------|---------|
| ICE commands | `CreateSimulatedICETree`, `AddICECompoundNode`, `AddICENode`, `AddPortToICENode`, `ConnectICENodes`, `DisconnectICENodePort` | Lagoa commands, `LagoaSetupAdvectMesh`, `ICEFlowInsertSimulationRoot` |
| ICE flow add-on | `ICEFlow_CreateParticlesFromPreset` (8 arguments: `presetName`, `outPortName`, `emitterInputName`, `colliderInputName`, `ExplodeCompound` = false, `ShaderPresetName`, `EmitInputIsGeomType` = false, `inspectPPG` = true); `ICEFLowCommonTools` (helper object; only `GetGeometries`, `FindICENodesByName`, `GetUnconnectedInputPorts` are described here) | `LagoaSetupAdvectMesh`, `LagoaSetupClothMesh`, `ICEFlowInsertSimulationRoot` |
| ICE compounds | `Lagoa Emit Volume`, `Lagoa Simulate Multiphysics`, `Lagoa Main Material`, `Lagoa Add Forces`, `Lagoa Phase`, `Lagoa Set Collision Data`, `Simulation Root`; presets `Lagoa Setup Advect Mesh`, `Lagoa Setup Cloth Mesh`; node `GetDataNode`; node name `Cache on File` | Lagoa and ICE flow commands, `GetCacheOnFile` |
| Shader commands | `DisconnectAndDeleteOrUnnestShaders`, `GetShaderDef`, `NestShaders`, `SIConnectShaderToCnxPoint`, `AddWritableImageSource`, `AddImageClip` | `DeleteUnusedShaders` and its menu / event, `RTShaderSetCategories` |
| Pass / property commands | `SIAddEntryToOverride`, `GetMarking`; preset `Override` | `OverrideMarkedPassParameters` |
| Primitive / selection / general | `GetPrim`, `SIGetPrim`, `ApplyOp`, `ApplyPolygonizer` (compiled, `Polygonizer.64.dll`), `ResetTransform`, `SelectObj`, `DeselectAll`, `DeleteObj`, `InspectObj`, `OpenView`, `GetValue`, `SetValue` | several |
| Object model | `Application.AddWorkgroup`, `Application.Workgroups`, `Scene.ExternalFiles` / `GetExternalFile`, view attributes `targetcontent` and `refresh`, `XSIUtils.ResolvePath` | `ConnectToWorkgroupUI`, Cache Manager, External Files viewer |
| Views | `Cache Manager` (sub-views `WriteAnimationTab`, `ReadAnimationPPG`, `CachesPathPPG`, `SimulationPPG`, `CacheOnFilePPG`), `Animation Mixer`, `Plugin Manager` | Cache Manager commands, `ConnectToWorkgroupUI` |
| Template files | the `shaderdef_*`, `shaderparserdef_*`, `hwshader_CB`, `PPGEvent.*` and `rtshader_*` templates of the SDK wizard template folder | `GetShaderDefHelper`, `GetWizardParamTab`, `SDKGetScriptGenerator` (names only) |

Already specified elsewhere: `WizardHelper` (CMD-01-ADDONDOC; its grid helpers
`DeleteSelectedRows`, `ClearGrid`, `GetNullOrValue`, `BuildCSVarType` are only
summarised there), `TrimString`, `GetGlobal`, `SetGlobal` (CMD-01b),
`SearchAndReplacePath` (CMD-04b), `DeleteUnusedCacheSources` (CMD-B6a).

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | No golden for any of the 29. In particular the exact bytes of the `WriteCachesFile` output (line terminator, code page) | XSIBATCH: call it, read the file back |
| Q2 | `RefreshCachesPathProp_Init` assigns a value to the name of `UpdateCacheManager`'s init procedure instead of its own. Does this change the flags of either command at registration? The registry dump shows both as non-logged, not key-assignable, returning a value | registration trace, or accept the registry values |
| Q3 | `LagoaEmitMPVolume`: names of the ports that `AddPortToICENode` creates on the tree (the contract assumes `Port1` … `Port5` exist afterwards) and on the emit compound, and what `ConnectICENodes` does when several get-data nodes are connected to the one path `Emitter_In_Name` | golden with one and with three meshes; contract of `AddPortToICENode` / `ConnectICENodes` |
| Q4 | `OverrideMarkedPassParameters`: behaviour with an empty selection and with a stale error state (both inferred from error-suppression rules) | interactive / XSIBATCH run |
| Q5 | `ICEFlowInsertSimulationRoot`: port names of the `Simulation Root` compound (`Emitter`, `Execute`, `Simulate`, `Forces`, `PostSimExecute`) and the node type strings (`Simulation_Root`, `Add_Forces`, `State_Machine`) come from the script only | read the compound file; golden |
| Q6 | Text of the `XSIPLUGINUI` ids 7164, 7191, 7203 to 7211, 7214 to 7217, 7223 to 7243, 8000 to 8005, of `XSISCRIPTS` 1183 / 1188 and of `EXTPOLYGONIZER` "Polygonizer" | decode the dictionaries |
| Q7 | Meaning of the `@<number>` suffixes and of bare `@<number>` levels in shader category strings (sort weight, unnamed separator group) | render tree preset-list code; compare with the shipped UI |
| Q8 | `Particle Display` `displaytype` value meanings and range | SPDL of the property |
| Q9 | `ApplyPolygonizer` contract (compiled) and the result of `Create_Polygonizer_Polymesh` with an empty selection | binary pass on `Polygonizer.64.dll` |
| Q10 | `PPGLayoutControl.addParameter` with nothing selected: before the last entry (as inferred) or at the end? Also `getLayout` without an indent argument | run the wizard page, or a JScript 5.x check of the array insert rule |
| Q11 | Template file contents for `GetShaderDefHelper` and `GetWizardParamTab` (the template folder is absent from the staged install) | stage `Addons\sdkui\Application\Plugins\Templates` (or wherever `WizardHelper.GetTemplateFolder` points) and record the layouts |
| Q12 | `SDKGetScriptGenerator("PerlScript")`: script error as inferred? | one call under XSIBATCH |
| Q13 | `GetObjectsFromSource` called directly twice: stale lookup tables as inferred? | golden: call, add a clip, call again |

Q1 to Q13 concern goldens, dictionary texts, delegated commands and template
files. The script-level behaviour of all 29 commands has been read in full.

## Index rows

| Command | File | Handler | Row | Note | Status |
|---------|------|---------|-----|------|--------|
| `AddToList` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `AddToList_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `GetItemsAsString` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `GetItemsAsString_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `GetObjectsFromSource` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `GetObjectsFromSource_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `ReadCachesFile` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `ReadCachesFile_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `RefreshCachesPathProp` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `RefreshCachesPathProp_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `RemoveFromList` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `RemoveFromList_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `RemoveNumbering` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `RemoveNumbering_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `SelectionValueToItemName` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `SelectionValueToItemName_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `UpdateCacheManager` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `UpdateCacheManager_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `WriteCachesFile` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `WriteCachesFile_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `GetCacheOnFile` | `Addons\CacheManager\Application\Plugins\CacheManagerVBS.vbs` | `GetCacheOnFile_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `OpenOutputFormatPreferences` | `Addons\RenderManager\Application\Plugins\RenderManager.vbs` | `OpenOutputFormatPreferences_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `OverrideMarkedPassParameters` | `Addons\RenderManager\Application\Plugins\RenderManager.vbs` | `OverrideMarkedPassParameters_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `DeleteUnusedShaders` | `Addons\RTUserTools\Application\Plugins\RTUserTools.js` | `DeleteUnusedShaders_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `RTShaderSetCategories` | `Addons\RTUserTools\Application\Plugins\RTShaderCategories.js` | `RTShaderSetCategories_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaDisplayType` | `Addons\Lagoa\Application\Plugins\Lagoa_Commands.js` | `LagoaDisplayType_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaEmitMPVolume` | `Addons\Lagoa\Application\Plugins\Lagoa_Commands.js` | `LagoaEmitMPVolume_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaTagCollisionObject` | `Addons\Lagoa\Application\Plugins\Lagoa_Commands.js` | `LagoaTagCollisionObject_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaSetupAdvectMesh` | `Addons\ICEFlowBuilder\Application\Plugins\ICEfxBuilder.vbs` | `LagoaSetupAdvectMesh_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaSetupClothMesh` | `Addons\ICEFlowBuilder\Application\Plugins\ICEfxBuilder.vbs` | `LagoaSetupClothMesh_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `ICEFlowInsertSimulationRoot` | `Addons\ICEFlowBuilder\Application\Plugins\ICEFlowInsertSimulationRoot.vbs` | `ICEFlowInsertSimulationRoot_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `SIGetExternalFilesViewerProp` | `Addons\sdkui\Application\Plugins\ExternalFileListViewer.js` | `SIGetExternalFilesViewerProp_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `SISetExternalFilesManagerTarget` | `Addons\sdkui\Application\Plugins\ExternalFileListViewer.js` | `SISetExternalFilesManagerTarget_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `ConnectToWorkgroupUI` | `Addons\sdkui\Application\Plugins\PluginTreeActions.js` | `ConnectToWorkgroupUI_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `GetShaderDefHelper` | `Addons\sdkui\Application\Plugins\ShaderDefHelper.js` | `GetShaderDefHelper_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC-PARTIAL |
| `GetWizardParamTab` | `Addons\sdkui\Application\Plugins\WizardParamTab.js` | `GetWizardParamTab_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC-PARTIAL |
| `PPGLayoutControl` | `Addons\sdkui\Application\Plugins\PPGLayoutControl.js` | `PPGLayoutControl_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `SDKGetScriptGenerator` | `Addons\sdkui\Application\Plugins\SDKScriptGenerator.js` | `SDKGetScriptGenerator_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `Create_Polygonizer_Polymesh` | `Addons\Polygonizer\Application\Plugins\Create_Polygonizer_PolymeshPlugin.vbs` | `Create_Polygonizer_Polymesh_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
