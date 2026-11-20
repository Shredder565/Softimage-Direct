# CMD-B15f: remaining script-implemented commands (sdkui wizards, Evolver lip-sync, UpgradeShaders, Syflex paint/map pickers, particle types, OBJ import, default camera, zero-key hot key, GPUSurfaceFX)

Row: **CMD-B15f** (closes most of ledger row **CMD-B13-SCRIPTS**). Status: **SPEC** for 19 commands,
**SPEC-PARTIAL** for 4 (`CreateMRShaderWizard`, `GenNormalMap`, `GenDiffuseMap`, `Save Zero Key Hot Key`; see each
section and section 5).
Run: 2026-11-19, si-analyst worker, unattended, batch 15 (binary first, REA + Ghidra)
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none. Every command here is a script procedure; there is no CLSID / factory / vtable. Sources were read from
the install `C:\Program Files\Autodesk\Softimage 2015 SP2\` with REA
`open_binary(format=raw-binary, architecture=6502, entry_point=0x0)` + `read_bytes` (file offset 0 at 0x0; whole file in
one read), sizes and sha256 from `inspect_byte_entropy` / `open_binary`:

| File | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `Addons\sdkui\Application\Plugins\CommandWizard.js` | 40586 | `f47cfd3d` | whole | GenerateCommandPlugin, CreateCommandWizard, AddCommandToPlugin |
| `Addons\sdkui\Application\Plugins\ToolbarWizard.js` | 12782 | `36d98dfb` | whole | CreateToolbarWizard, SIGenerateToolbar |
| `Addons\sdkui\Application\Plugins\PluginWizard.js` | 8984 | `dc9db6ca` | whole | SIGeneratePlugin, CreatePluginWizard |
| `Addons\sdkui\Application\Plugins\TemplateWizard.js` | 22160 | `eea0adf3` | whole | CreateTemplateWizard |
| `Addons\sdkui\Application\Plugins\SDKWizards.js` | 53358 | `a88c7d9a` | whole (generator methods only used here) | helper `WizardHelper()` code generators (closes CMD-01-ADDONDOC Q3 for the parts used below) |
| `Addons\sdkui\Application\Plugins\ShaderWizard.js` | 75743 | `54125106` | **no** (>64 KB, 6502 load refused; opening it as a JavaScript artifact works but no provider can list or read it) | CreateMRShaderWizard |
| `Application\DSScripts\EvolverLipSync.js` | 15133 | `8277281f` | whole | GenerateLipSync |
| `Application\DSScripts\UpgradeShaders.vbs` | 61538 | `b0997c61` | whole | UpgradeShaders |
| `Addons\Syflex30X50\Application\Plugins\cache.vbs` | 1990 | `63d180b6` | whole | syCachePaint1, syCachePaint2 |
| `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | 6368 | `1a886e25` | whole | SyGetMassMap, SyGetSpringMap |
| `Application\DSScripts\primitives.vbs` | 36199 | `4131cd15` | whole | "Get default camera" |
| `Application\DSScripts\importexport.vbs` | 25075 | `61b54f39` | whole | "OBJ Import..." |
| `Application\DSScripts\particle.vbs` | 44291 | `2b1925c2` | not re-read (size matches the copy read for CMD-03b) | CreateInspectParticleType{Sphere,Blob,Billboard} |
| `Application\DSScripts\uixsiscripts.vbs` | 462005 | `13c6a20b` | **no** (>64 KB) | "Save Zero Key Hot Key" |
| `GPUSurfaceFX.js` | - | - | **not found** | GenNormalMap, GenDiffuseMap |

`GPUSurfaceFX.js` is not in `Application\DSScripts`, not in `Application\Plugins`, not in `Addons\GPUSurfaceFX\`
(that add-on folder holds only a `presets` directory). The registry (`data/command_registry.json` entries 379 / 380)
gives a bare `ScriptName` `GPUSurfaceFX.js` (engine JScript, procedures `XSI_GenerateDiffuseMap` /
`XSI_GenerateNormalMap`).

Method: read whole files as text in a scratch directory outside the repo, then described each handler procedure and
every helper it calls. Arguments and defaults from `data/commands_full.json`; flags set inside self-installed plug-ins
(`_Init` callbacks) from the scripts themselves. Earlier notes reused: `cmd-01-addondoc-wizardhelper.md`
(`WizardHelper`, `CreateXMLDoc`), `cmd-03b-particle-scripts.md` (`CreatePTypeProc`), `cmd-04b-import-export-model-scripts.md`
(`SI_InspectWavefrontImportOptions`, OBJ menu procedure), `cmd-b5f-misc-dsscripts.md` (`GetPrimCameraWithoutInterest`),
`cmd-b8e-primtasks-prims-binary.md` (`SIGetPrimCamera`).

## 1. Handler table

| Command | Language / file | Handler procedure | Status |
|---|---|---|---|
| `CreateInspectParticleTypeSphere` | VBScript `particle.vbs` | `CreatePTypeProc` | SPEC (same as CMD-03b) |
| `CreateInspectParticleTypeBlob` | VBScript `particle.vbs` | `CreatePTypeProc` | SPEC (same as CMD-03b) |
| `CreateInspectParticleTypeBillboard` | VBScript `particle.vbs` | `CreatePTypeProc` | SPEC (same as CMD-03b) |
| `CreateCommandWizard` | JScript `CommandWizard.js` | `CreateCommandWizard_Execute` | SPEC |
| `AddCommandToPlugin` | JScript `CommandWizard.js` | `AddCommandToPlugin_Execute` | SPEC |
| `GenerateCommandPlugin` | JScript `CommandWizard.js` | `GenerateCommandPlugin_Execute` | SPEC |
| `CreatePluginWizard` | JScript `PluginWizard.js` | `CreatePluginWizard_Execute` | SPEC |
| `SIGeneratePlugin` | JScript `PluginWizard.js` | `SIGeneratePlugin_Execute` | SPEC |
| `CreateToolbarWizard` | JScript `ToolbarWizard.js` | `CreateToolbarWizard_Execute` | SPEC |
| `SIGenerateToolbar` | JScript `ToolbarWizard.js` | `SIGenerateToolbar_Execute` | SPEC |
| `CreateTemplateWizard` | JScript `TemplateWizard.js` | `CreateTemplateWizard_Execute` | SPEC |
| `CreateMRShaderWizard` | JScript `ShaderWizard.js` | `CreateMRShaderWizard_Execute` | SPEC-PARTIAL (file unread) |
| `GenerateLipSync` | JScript `EvolverLipSync.js` | `GenerateLipSyncProc` | SPEC |
| `UpgradeShaders` | VBScript `UpgradeShaders.vbs` | `UpgradeShaders` | SPEC |
| `syCachePaint1` ("Paint Map1") | VBScript Syflex `cache.vbs` | `PaintMap1_Execute` | SPEC |
| `syCachePaint2` ("Paint Map2") | VBScript Syflex `cache.vbs` | `PaintMap2_Execute` | SPEC |
| `SyGetMassMap` ("Get Mass Map") | VBScript Syflex `cloth.vbs` | `GetMassMap_Execute` | SPEC |
| `SyGetSpringMap` ("Get Spring Map") | VBScript Syflex `cloth.vbs` | `GetSpringMap_Execute` | SPEC |
| "Get default camera" (no scripting name) | VBScript `primitives.vbs` | `GetPrimCameraDefaultProc` | SPEC |
| "OBJ Import..." (no scripting name) | VBScript `importexport.vbs` | `WavefrontImport` | SPEC (same as CMD-04b caller description) |
| "Save Zero Key Hot Key" (no scripting name) | VBScript `uixsiscripts.vbs` | `SaveZeroKeyHotKeyProc` | SPEC-PARTIAL (file unread) |
| `GenNormalMap` | JScript `GPUSurfaceFX.js` | `XSI_GenerateNormalMap` | SPEC-PARTIAL (file not shipped) |
| `GenDiffuseMap` | JScript `GPUSurfaceFX.js` | `XSI_GenerateDiffuseMap` | SPEC-PARTIAL (file not shipped) |

## 2. Shared facts

### 2.1 sdkui wizard plug-ins

| Plug-in (file) | Registered name / author / version | Items registered (all category "Wizard") | Help |
|---|---|---|---|
| `CommandWizard.js` | "Command Wizard", Softimage, 2.1, url `http://www.softimage.com` | property `CCmdWizard`; commands `CreateCommandWizard`, `AddCommandToPlugin`, `GenerateCommandPlugin` | help topic `cus_cmds_wizard` (built with `XSIUtils.BuildHtmlHelpURL`) |
| `PluginWizard.js` | "PluginWizard", Softimage, 1.0, same url, email `mbelzile@softimage.com` | property `PluginWizardProp`; commands `CreatePluginWizard`, `SIGeneratePlugin` | `cus_self_PluginWizard` |
| `ToolbarWizard.js` | "ToolbarWizard", Softimage, 1.0, same url and email | property `ToolbarWizardProp`; commands `CreateToolbarWizard`, `SIGenerateToolbar` | layout help file `<FactoryPath>/Doc/<DocLangPref>/xsidocs.chm::/userprefs527.htm` |
| `TemplateWizard.js` | "Template Wizard", Softimage, 2.1, same url | property `TemplateWizard`; command `CreateTemplateWizard` | none |

Every plug-in also has an unload callback that just succeeds. Message boxes use `XSIUIToolkit.MsgBox` with texts from
dictionary `XSIPLUGINUI`. Message ids used here:

| Id | Meaning (from the constant name) | Used by |
|---|---|---|
| 7165 | specify a command name | Command wizard Generate button |
| 7166 | command name clashes with a built-in / add-on / factory command | Command wizard |
| 7167 | command name clashes with a user command (arg: that command's file) | Command wizard |
| 7168 / 7169 / 7170 | no command name / no script name / no plug-in name | GenerateCommandPlugin |
| 7171 | command wizard error (arg: exception text) | GenerateCommandPlugin, script languages |
| 7172 | specify a destination | Cpp / C# command generation, SIGeneratePlugin, SIGenerateToolbar |
| 7173 / 7174 | C++ / C# code generation error (arg: exception text) | GenerateCommandPlugin |
| 7176 | failed to create output directory (arg: exception text) | SIGeneratePlugin, SIGenerateToolbar, WriteAndLoadScriptPlugin |
| 7177 | source generation error (arg) | SIGeneratePlugin |
| 7194 | specify a plug-in name | SIGeneratePlugin |
| 7195 | a plug-in with that name already exists (arg: its file) | SIGeneratePlugin |
| 7196 | same-name plug-in exists elsewhere (arg: its file) | WriteAndLoadScriptPlugin |
| 7197 | target script file exists, overwrite? (yes/no; arg: path) | WriteAndLoadScriptPlugin |
| 7198 | script generation error (arg) | WriteAndLoadScriptPlugin |
| 7199 | script registration (load) error | WriteAndLoadScriptPlugin |
| 7200 | target C++ / C# file exists, overwrite? (yes/no; arg: path) | GenerateCppProject, GenerateCSProject |
| 7201 | specify a toolbar name | SIGenerateToolbar |
| 7202 | toolbar generation error (arg: error text) | SIGenerateToolbar |
| 7213 | "Custom Command Wizard" dialog title | AddCommandToPlugin |
| 7218 | Plug-in Wizard dialog title | CreatePluginWizard |
| 7219 | Toolbar Wizard dialog title | CreateToolbarWizard |
| 7220 / 7221 | Load-template browser title / file filter | Template wizard |

### 2.2 WizardHelper code generators (from `SDKWizards.js`; answers CMD-01-ADDONDOC Q3 for these methods)

Names as in `cmd-01-addondoc-wizardhelper.md`. Templates live in the folder `Templates` next to the "SDK Wizard
Helpers" plug-in file.

- `GetCurrentUserLogin`: environment `USERNAME` on Windows, `LOGNAME` elsewhere.
- `GetDefaultVCCompiler` returns `VS2012`. `GetSupportedVCCompilerArray` gives the combo items "Visual Studio 2010" →
  `VS2010`, "Visual Studio 2012" → `VS2012`. `GetCppCompilerInfo(v)`: `VS2010` → VS2010 info, anything else → VS2012;
  both use project extension `.vcxproj`.
- `GetScriptExtension`: VBScript `.vbs`, JScript `.js`, Python `.py`, PerlScript `.pls`, Cpp `.cpp`, C# `.cs`.
- `CreateMenuIDArray`: first item "None" (value −1); then, when `xsi_decl.h` is found (under `%XSISDK_ROOT%\include`,
  else `<Factory>\include\Rayflex`), every `si…ID` member of enum `siMenuAnchorPoints` except obsolete ones and
  `siMenuUndefinedID`, with its value; cached for the session. Without the SDK only "None" is offered.
- `ShowMenuAnchorPointsInNetview`: opens HTML help topic `siMenuAnchorPoints`.
- `StandardIncludes(lang)`: Cpp: the four standard SDK headers (application, context, plugin registrar, status);
  C#: `System` and the three Softimage namespaces (XSIOM, XSIMath, XSIUtil); Python: COM client import, `constants`
  import and aliases `null`/`false`/`true`; others: nothing.
- `GeneratePluginFile(lang, comment, includes, author, pluginName, registerCode, callbacks)`: all seven arguments
  required (else raises "Invalid arg to GeneratePluginFile"). Produces, in the target language through the
  `SDKGetScriptGenerator` writer: a header comment (plug-in name; "Initial code generated by Softimage SDK Wizard";
  "Executed <local date> by <login>"), the extra comment, a fixed standard header comment (C++/C# vs script variant),
  the standard includes, the extra includes; for Cpp a `using namespace XSI` line, for C# a sample `Base` class from
  template `base.cs.template`; then the load callback (C#: class `XSIPlugin : Base`, method `Load`; others:
  `XSILoadPlugin`) that sets Author and Name, version 1.0 (Cpp through `PutVersion(1,0)`, others Major/Minor), the
  register code, then a tab plus the registration insertion comment, returning success; then the unload callback
  (`Unload` / `XSIUnloadPlugin`) that logs "<plug-in name> has been unloaded."; then the callbacks text.
- `WriteAndLoadScriptPlugin(dir, rootName, lang, source, pluginName)` → bool: ensure `dir` exists (failure: 7176,
  false); target `dir\rootName<ext>`; if a loaded plug-in named `pluginName` lives in another file: box 7196,
  false; if the target exists: yes/no box 7197, No → false, Yes → unload that file; write the source (failure:
  7198, false); `ShowFileForEdit(target)`; `LoadPlugin(target)` (failure: box 7199 but still true); true.
- `GenerateCppProject(dir, projName, cppText, compilerParam)`: ensure `dir`; write `dir\projName.cpp` (if it exists:
  yes/no 7200, No aborts everything); log "Writing C++ file...", then "Writing Visual Studio .vcxproj file..." and write
  `dir\projName.vcxproj` from template `Plugin.VS2012.vcxproj.template` (VS2012) or `Plugin.vcxproj.template` (VS2010),
  tokens `%%projname%%` and `%%cpp_files%%` (one `ClCompile` entry per cpp); write `dir\GNUmakefile` from
  `GNUmakefile.template` with the same project name and a backslash-continued list of source stems; then
  `ShowFileForEdit` on each cpp. Nothing is compiled or loaded.
- `GenerateCSProject(dir, projName, csText)`: ensure `dir`; write `dir\projName.cs` (overwrite check 7200); log
  "Writing C# file...", "Writing Visual Studio .csproj file..."; write `dir\projName.csproj` from
  `Plugin.csproj.template` (token `%%projname%%`); `ShowFileForEdit(.cs)`. No Linux makefile.

### 2.3 Syflex plug-ins

`cache.vbs` registers plug-in "syCache" (author "Syflex", 1.0, empty email/url) with commands "Create Cache"
(`syCreateCache`), "Paint Map1" (`syCachePaint1`), "Paint Map2" (`syCachePaint2`). `cloth.vbs` registers "syCloth"
(Syflex 1.0) with Create Cloth / Skin / Flesh, Get/Set Spring Map, Get/Set Mass Map, Clear All Cache, Clear Cache,
Save Cache. Messages come from dictionary `EXTSYFLEX`: 1002 "select cloth", 1003 "select polymesh", 1004 "select
syCache". The Create Cloth / Skin / Flesh commands (not in this row) build a point cluster renamed `ClothCls` holding
weight maps `MassMap`, `StiffMap` (Flesh also `WrinkleMap`) at weight 1, then apply operator `syCloth`; Create Cache
builds a cluster with weight maps `Map1`, `Map2` and applies `syCache`. The paint / get commands below rely on those
names.

## 3. Commands

### 3.1 `CreateInspectParticleTypeSphere`, `CreateInspectParticleTypeBlob`, `CreateInspectParticleTypeBillboard`

Same as `cmd-03b-particle-scripts.md`, section "`CreateInspectParticleTypeBillboard`, `CreateInspectParticleTypeSphere`,
`CreateInspectParticleTypeBlob`": one in-argument `renderType` (registry defaults `siSphereType`, `siBlobType`,
`siBillboardType`), all three run `CreatePTypeProc`: `CreateParticleType <renderType>` then `AutoInspect` the new type.
No return value. Key-assignable, category Simulation.

**Wire contract**: register three VBScript-style commands bound to one implementation that creates a particle type of
the given render type and opens its property page; no return.

### 3.2 `CreateCommandWizard`

Args: `DestinationDir` (string, default `""`). Return value on (returns the wizard property). Flags: logged (logging is
deliberately left on), cannot be used in batch; registry: key-assignable, category Custom.

Steps:
1. `WizardHelper().CreateWizard("CCmdWizard")` (no reuse: always a new `CCmdWizard` property under model
   `SDK_Wizards`, see CMD-01-ADDONDOC).
2. `DestDir` = `DestinationDir` when non-empty, else `<UserPath>\Application\Plugins`.
3. `InspectObj` the property, title "Custom Command Wizard", mode `siLock` (non-modal, locked).
4. Return the property. All further work happens in the property page (below) and in `GenerateCommandPlugin`.

**`CCmdWizard` property** (parameters in definition order):

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `AppendMode` | bool | false | true only when created by `AddCommandToPlugin` |
| `PluginName` | string | `<ScriptingName>Plugin` | |
| `Author` | string | current login | |
| `ScriptLanguage` | string | `Python` | |
| `CompilerVersion` | string | `VS2012` | hidden unless language is Cpp |
| `MenuID` | string | `None` | |
| `MenuLabel` | string | `""` | |
| `DestDir` | string | `""` (set by the command) | |
| `ScriptingName` | string | unique name from base `NewCommand` (below) | |
| `Description`, `ToolTip` | string | `""` | |
| `SupportsKeyAssignment` | bool | true | not animatable (same for the next bools) |
| `CannotBeUsedInBatch` | bool | false | |
| `NotLogged` | bool | false | |
| `ReturnValue` | bool | **true** (defined false, then set true) | |
| `UndoRedoSupport` | bool | false | disabled unless language is Cpp |
| `Arguments` | grid | 0 rows, 3 columns | columns "Name", "Default Value", "Handler" (labels translated in `XSISPDLFILE`); column 2 is a combo |

Handler combo items (label → index): "None" 0 (no handler), "Animatable Marked Parameters" 1 (`AnimatableParameters`),
"Collection/Selection" 2 (`Collection`), "SingleObj" 3, "Frame" 4, "Frame Rate" 5 (`FrameRate`), "Marked Parameters"
6 (`MarkedParameters`).

Unique name: shows a 3-step progress bar "Finding unique command name"; collects the numeric suffix of every existing
command whose Name or ScriptingName is `NewCommand` followed by digits only; none → `NewCommand`; otherwise the
largest suffix + 1 (an empty suffix counts as 0, giving `NewCommand1`).

**Layout** (rebuilt on init and after argument add/remove; label width 140 px / 40 %). When not in append mode: tab
"Plug-in Definition" with a group: `ScriptingName` "Command Name", `PluginName` "Plug-in Name", `Author`,
`ScriptLanguage` enum "Coding Language" (C#, Cpp, JScript, Python, VBScript; no C# off Windows), on Windows
`CompilerVersion` enum "C++ Compiler Version", a row with `MenuID` enum "Add to Menu" (sorted anchor-point names,
value = name) and button `BtnHelpMenu` "?", `MenuLabel` "Menu Label" (enabled only when MenuID ≠ None); group "Output
Directory" with `DestDir` folder control without label; button `Generate` "Generate Code"; then tab "Command
Definition". Always: group "Command" with `ScriptingName` "Command Name", `Description`, `ToolTip`,
"Supports Key Assignment", "Cannot Be Used In Batch", "Not Logged", "Return Value", `UndoRedoSupport`
"Undo/Redo Callbacks (C++ only)"; group "Arguments" with a row of buttons `BtnAddArgument` "Add",
`BtnRemoveArgument` "Remove" and, when the grid has rows, the grid (no label, column widths `25:80:125:100`, header
selection); outside append mode a second button `Generate2` "Generate Code".

**Callbacks**: Add appends row `Arg<n>` (n = new row index), empty default, handler 0. Remove deletes the selected rows.
Changing `ScriptingName` strips spaces into it and sets `PluginName` = typed text + `Plugin` and `MenuLabel` = typed
text. Changing `ScriptLanguage` logs "CCmdWizard_ScriptingLanguage_OnChanged", enables `UndoRedoSupport` only for Cpp
and shows `CompilerVersion` only for Cpp. Changing `MenuID` toggles `MenuLabel`. `?` opens the anchor-point help.
**Generate / Generate2**: empty command name → box 7165, stop; a command with the same Name or ScriptingName exists →
box 7166 when it is built-in or from an add-on / factory path, otherwise 7167 with its file name; stop. Else log
"Now generating the custom command plug-in file..." and run `GenerateCommandPlugin(<this property>)`.

**Wire contract**: `CreateCommandWizard(DestinationDir="") → CCmdWizard property`, creates and shows the wizard,
generates nothing itself.

### 3.3 `GenerateCommandPlugin`

Args: `Wizard` (object, handler SingleObj). No return value. Not key-assignable; logged.

Builds a generator from the property; a property whose type is not `CCmdWizard` raises "Bad Argument to
GenerateCommandObj". Command name = ScriptingName with spaces replaced; plug-in name as given; a menu is added when
MenuID ≠ None, menu item name `<command>_Menu`.

Checks: empty command name → 7168; empty script name → 7169; empty plug-in name → 7170 (each: box, nothing written).

- **Script languages** (JScript, Python, VBScript): source = `GeneratePluginFile` with the pieces below;
  `WriteAndLoadScriptPlugin(DestDir, <plug-in name>, lang, source, <plug-in name>)` → file
  `<DestDir>\<PluginName>.<js|py|vbs>` loaded immediately. On success, if a command named after the new command now
  exists, it is **executed once** (to get it into the command map). Any exception → box 7171.
- **Cpp**: empty DestDir → 7172; generation exception → 7173; else `GenerateCppProject(DestDir, <command name>, …)`:
  writes `<command>.cpp`, `<command>.vcxproj`, `GNUmakefile`. Not loaded.
- **C#**: empty DestDir → 7172; exception → 7174; else `GenerateCSProject(DestDir, <command name>, …)`: writes
  `<command>.cs`, `<command>.csproj`. Not loaded.

Generated content (behaviour level):
- Includes: Cpp adds the argument and command headers, plus the menu header when a menu is requested.
- Registration: one RegisterCommand(<name>, <name>); with a menu also RegisterMenu(<anchor constant>, `<name>_Menu`,
  false, false).
- Init callback (`<name>_Init`; C# class `<name>` method `Init`): reads the command from the context; sets
  Description; Tooltip only when non-empty; SetFlag for each of: key assignment off (when unchecked), cannot-be-used-in-
  batch (when checked), no-logging (when checked); return value (Cpp via `EnableReturnValue`); when the grid has rows,
  gets the argument list and adds one argument per row: with a handler → AddWithHandler(name, handler[, default]),
  without → Add(name[, siArgumentInput unless Cpp][, default]); C# always passes `null` as default and, for Add,
  `siEmpty` as type. Non-empty defaults: unquoted non-boolean strings are quoted; Cpp numbers get the `l` suffix.
  Returns success.
- Execute callback (`<name>_Execute`; C# `Execute`): VBScript with return value off → a Sub taking the argument names;
  Cpp → reads the argument array from the context into one local per argument; C# → `Execute(Context)`; others → a
  function taking the argument names. Body logs "<name>_Execute called" and a TODO comment. Cpp with return value adds
  an example of setting the ReturnValue attribute and a "return CStatus::Fail…" comment; Cpp with undo/redo adds an
  example storing an incrementing `UndoRedoData` id and logging it. Ends returning success.
- Menu callback (when MenuID ≠ None): `<name>_Menu_Init` (C# class `<name>_Menu` method `Init`) adds a command item
  labelled MenuLabel (or the command name when empty) running the command; Cpp also declares a MenuItem.
- Cpp with undo/redo: `<name>_Undo`, `<name>_Redo`, `<name>_TermUndoRedo` stubs that log the stored id.

**Wire contract**: `GenerateCommandPlugin(Wizard)` → no return; writes the files listed per language into DestDir and,
for script languages, loads the plug-in and runs the new command once.

### 3.4 `AddCommandToPlugin`

Args: `ScriptEditView` (dispatch, default 0). Return value on, but always returns **false**. No logging; not
key-assignable.

1. The argument must be an object whose view type is "Text Editor" or "Script Editor", else raises "Bad argument -
   expect a Text Editor View".
2. Create a `CCmdWizard` (reuse on), set `AppendMode` true, set `ScriptLanguage` from the view's `filename` attribute
   via `GetLangFromExtension`.
3. `InspectObj` modal, title 7213. Cancel (an exception) silently skips step 4.
4. Generate registration code and callbacks (as in 3.3) and edit the view's `text` attribute: when the language's
   registration insertion comment is found, the registration lines are inserted before it (comment kept, preceded by a
   tab); otherwise, only for Cpp / C#, the registration line is appended at the end with the instruction "PUT THIS LINE
   IN YOUR XSILOADPLUGIN IMPLEMENTATION:" (C#: "…XSIPlugin.Load IMPLEMENTATION:") (inferred: for script languages
   without the marker the text variable is left unset, producing "undefined" + callbacks). The callbacks are appended.
5. Delete the wizard property; return false.

In append mode the layout shows only the "Command" and "Arguments" groups (no tabs, no Generate buttons).

**Wire contract**: `AddCommandToPlugin(ScriptEditView)` → false; modifies the text of the given editor view.

### 3.5 `CreatePluginWizard`

Args: `in_dest` (input, no default). Return value on. Flags: no logging, cannot be used in batch; key-assignable.

1. `CreateWizard("PluginWizardProp", reuse=true)`.
2. `DestDir` = `in_dest` when given and non-empty, else `<UserPath>\Application\Plugins`.
3. Loop: `InspectObj` modal titled 7218; cancel → return false; else call `SIGeneratePlugin(prop)`; a truthy result →
   return true; otherwise show the dialog again.

`PluginWizardProp`: `PluginName` string "New Plugin", `Author` string (current login), `ScriptLanguage` string
"Python", `CompilerVersion` string `VS2012` (hidden), `DestDir` string. Layout (140 px / 50 %): group with
`PluginName` "Plug-in Name", `Author`, `ScriptLanguage` enum "Language" (C#, Cpp, JScript, Python, VBScript; no C# off
Windows), on Windows `CompilerVersion` enum "C++ Compiler Version", items `Url` and `Email` "Author Email" (these two
parameters are not defined on the property; inferred to show nothing); group "Output Directory" with `DestDir` folder
control without label. Changing `ScriptLanguage` shows `CompilerVersion` only for Cpp.

**Wire contract**: `CreatePluginWizard(in_dest) → bool` (true once a plug-in was generated, false on cancel).

### 3.6 `SIGeneratePlugin`

Args: `in_Prop` (input). Return value on. No logging; not key-assignable.

1. Trimmed `PluginName` empty → box 7194, return false.
2. A loaded plug-in with that name exists → box 7195 (with its file), return false.
3. Trimmed `DestDir` empty → box 7172, return *empty* (falsy).
4. Ensure the folder exists (failure → 7176, return empty).
5. Root file name = plug-in name with spaces → `_`. Source = `GeneratePluginFile(lang, "", "", author, name, "", "")`
   (an empty plug-in: no items registered).
6. Cpp → `GenerateCppProject(dir, root, source, CompilerVersion)` (`<root>.cpp`, `<root>.vcxproj`, `GNUmakefile`);
   C# → `GenerateCSProject` (`<root>.cs`, `<root>.csproj`); script languages → `WriteAndLoadScriptPlugin(dir, root,
   lang, source, name)` (`<root>.py|.js|.vbs`, loaded); a false result → return false.
7. Exceptions → box 7177, return false. Otherwise return true.

**Wire contract**: `SIGeneratePlugin(in_Prop) → bool` (empty on the two directory errors).

### 3.7 `CreateToolbarWizard`

Args: `in_dest` (input). Return value on. No logging, cannot be used in batch; key-assignable.

Same loop as 3.5 with property `ToolbarWizardProp`, default destination `<UserPath>\Application\toolbars`, dialog
title 7219, generator `SIGenerateToolbar`.

`ToolbarWizardProp`: `ToolbarName` string "NewToolbar", `AddCommands` bool true (not animatable), `DestDir` string.
Layout (140 px / 50 %): group with `ToolbarName` "Toolbar Name" and `AddCommands` "Populate with Commands from this
location"; group "Output Directory" with folder control `DestDir` without label; help file as in 2.1.

**Wire contract**: `CreateToolbarWizard(in_dest) → bool`.

### 3.8 `SIGenerateToolbar`

Args: `in_Prop`. Return value on. No logging; not key-assignable.

1. Trimmed `ToolbarName` empty → 7201, false. Trimmed `DestDir` empty → 7172, return empty. Ensure folder (failure 7176,
   return empty).
2. File = `<DestDir>\<ToolbarName with spaces→_>.xsitb`.
3. Build the toolbar XML (with `CreateXMLDoc`):
   - root `xsi_file`, attributes `type="Shelf"`, `xsi_version=<Application.Version()>`, `syntax_version="1.0"`;
   - child `shelf_view` with `name=<ToolbarName>`, `clsid=<new GUID>`;
     - `properties` → `showtabs` text `false`;
     - `definition` with `maxinstances=10000`, `acceptfocus=true`, `private=false`, `defaultsize="0,100,200,300"`,
       `cmdmap="{00000000-0000-0000-0000-000000000000}"`, `supportedtypes=6`, `category=""`;
     - `tabs` with `layout="top"`, `active="DS Toolbar"` → one `tab` `label="DS Toolbar"`, `type="toolbar"` →
       `properties` with `id=<new GUID>`, `name=""`, `display_preset_as_small=false`, `display_as_text_only=false`;
       then the button items (below) as further children of the tab.
4. When `AddCommands` is on: find `<slash>Application<slash>` in DestDir (none → no buttons); root = text before it;
   for every command of category "Custom" that is not from the factory or add-on path, whose origin path starts with
   the root and that supports key assignment, add an `item` with `type="script"`, `name=<command name>`,
   `label=<command name>`; when the label has no space a `userwidth` is set: 80, or 40 × ceil(length / 5) when the label
   is longer than 10 characters.
5. Save (".xsitb" appended if missing, case-insensitive); a non-empty error → 7202 with the text, false.
6. `ShowFileForEdit(file)`; create a view from the file in the active layout (`CreateViewFromDefinitionFile(file,
   ToolbarName)`); return true.

**Wire contract**: `SIGenerateToolbar(in_Prop) → bool`; writes one `.xsitb` file and opens it as a floating toolbar.

### 3.9 `CreateTemplateWizard`

Args: `DefaultDest` (string, default `""`). Return value on (returns the property). No logging, cannot be used in batch;
key-assignable.

1. Find child model `SDK_Wizards` of the scene root; when missing create it (empty collection) and set its
   `Visibility.viewvis` false.
2. Add a new `TemplateWizard` property to it (always new).
3. `Template_DestDir` = `DefaultDest` when non-empty, else `<UserPath>` (no sub-folder).
4. `InspectObj` titled "Template Wizard", `siLock`; return the property.

`TemplateWizard` property: `TemplateShortName` "MyTemplate", `TemplateLongName` "My New Template",
`TemplateDescription` "", `TemplateType` "Addon" (not animatable), `TemplateImage`, `Template_DestDir`; content-item
editor fields `ParamTitle` "Content Title", `ParamDesc`, `ParamScript`, `ParamImage` (strings), `ParamMenu` bool true
(not animatable); grid `ParamList` with 5 columns Name, Desc, Script, Image, Menu.

Layout (140 px / 50 %): tab "Template Information": group "Template Name" (button `LoadExisting` "Load Existing",
`TemplateShortName` "Short Name", `TemplateLongName` "Long Name", multi-line "Description" height 200, `TemplateImage`
"Image" file control: open, image file, must exist); group "Template Type" (enum "Type": Addon → `addon`, Training →
`training`; note the parameter default "Addon" matches neither value, inferred to show blank until chosen); group
"Template Generation" (`Template_DestDir` "Output Directory" folder control, button `Generate` "Generate Template").
Tab "Add Content Item": group "Content Item" (`ParamTitle` "Name", multi-line `ParamDesc` "Description" height 150,
spacer, multi-line `ParamScript` "Script" 150, spacer, `ParamImage` "Image" file control as above, `ParamMenu`
"Create Menu Item"); button `AddUpdateParam` labelled "Update Content Item" when a grid row is named like
`ParamTitle`, else "Add Content Item"; group "Content Item List": text "No content defined." when empty, else the grid
(no label, header selection, read-only columns mask `1:0:0:1:1`) and buttons `EditParam` "Edit Selected",
`RemoveParam` "Delete Selected".

Callbacks: Add/Update writes the five fields into the matching row or a new one (row label two spaces) and, for a new
row, increments a trailing number in `ParamTitle` (or appends `1`). Edit: no selection → warning "TemplateWizard:
Nothing selected."; several → "TemplateWizard: Multiple items selected."; else copy the row into the editor fields
(empty Menu → "0"). Delete removes selected rows. Load Existing: open browser (title 7220, initial dir
`Template_DestDir`, filter 7221); cancel → nothing; else `Template_DestDir` = chosen folder; parse the file (parse
error raises "load failed<reason>"; no root raises "load failed: this is not a xsitemplate file."); copy root children
`ShortName`, `LongName`, `Description`, `Image`, and rebuild the grid from `Content/Item` children (`Name`,
`Description`, `Script`, `Image`, `Menu` default "0").

Generate: errors logged with prefix "TemplateWizard: " and severity error, then stop: empty short name "Template name
is empty"; empty grid "No content items defined."; empty folder "No output directory specified."; folder creation
failure "Unable to create an output folder in '<dir>'". Logs "Generating template files in '<dir>'...", writes
`<dir>\<ShortName>.xsitemplate`: root `xsi_template` (`xsi_version`, `syntax_version="1.0"`, `Date` = local date
string), children `ShortName`, `LongName`, `Description`, `Image`, `Type` (text = parameter values), then `Content` with
one `Item` per row containing `Name`, `Description`, `Script`, `Image`, `Menu`. Then `ShowFileForEdit` and log
"TemplateWizard: Done.". (This answers CMD-01-ADDONDOC Q2 for the `.xsitemplate` schema.)

**Wire contract**: `CreateTemplateWizard(DefaultDest="") → TemplateWizard property`.

### 3.10 `CreateMRShaderWizard` (SPEC-PARTIAL)

Args: `DefaultDest` (string, default `""`). Return value on; key-assignable; category Custom. `ShaderWizard.js` is
75,743 bytes and could not be read. Inferred from the sibling wizards: creates and shows a mental ray shader wizard
property under `SDK_Wizards` with output directory `DefaultDest` or a user-path default and returns it. Property
layout and generated files (SPDL, C++ source, project) are unknown.

### 3.11 `GenerateLipSync`

Args (registry): `InputObjs` (Collection), `AudioFileName` "", `TextFileName` "", `Language` "en", `Resolutions`
"hmlc", `MappingProfilePath` "". Return value on: the speech clip. Category Animation; not key-assignable.

Constants: offset 0 frames, silence duration 10. Messages: `XSIMSGCAT` 23 file not found (arg path), 28 selected
object is not a model, 1020 invalid argument (followed by ` "<value>"`); `XSISCRIPTS` 1520 command cancelled (warning);
`XSIACTION2` 1088 audio import failed, 1089 speech action creation failed, 1090 phoneme recognition failed, 1091 face
mesh resolution not found (arg mesh name or resolution string). Errors are raised as script errors with
severity error.

Interactive session:
1. Model = first model in `InputObjs` (model filter). If none: pick session "Select Model" (translated in
   `XSISCENEEXPLORER`); not left button → warning 1520, return nothing; picked non-model → raise 28.
2. Empty `AudioFileName`: file browser "Select a file", initial dir `<Factory>\FaceRobot\Data\FaceRobot\Audio`, filter
   "Wav Files (*.wav)"; cancel → warning 1520, return. A missing file → raise 23.
Batch: `InputObjs` must be a collection whose first item is a model, else raise 1020; audio must be an existing path,
else raise 1020.
3. `TextFileName`: empty → none; non-existent → raise 23. `MappingProfilePath`: empty →
   `<Factory>\Application\rsrc\DefaultPhonVisMapping.xml` (must exist, else 23); non-existent → 23.
4. `Language`: missing → "en"; non-string → 1020; lower-cased; only `en` or `jp`, else 1020.
5. `Resolutions`: missing → "hmlc"; non-string → 1020; must contain at least one of h, m, l, c (inferred: the test is a
   loose search), lower-cased.
6. For h, m, l, c in that order, when requested: if `<model>.H_DDS_HighRes` / `H_DDS_MidRes` / `H_DDS_LowRes` /
   `H_DDS_CrowdRes` exists the letter joins the compact resolution string, else warning 1091 with the mesh name.
7. Base shape clips: for every mixer track, every clip that is a clip container, every track inside, the first clip
   when its name contains one of `SH_CH`, `UW_U`, `_S_`, `RRR`, `UH_OO`, `MPB`, `AO_a`, `LLL`, `KG`, `TD_I`, `H_EST`,
   `FV`, `AE_AA` and its first `_`-separated token is a single letter contained in the compact string.
8. `SetupEvolverVisemes(model, clips, mappingProfile)` → key list. Empty → raise 1091 with `Resolutions`.
9. Speech action and clip, action name `EvolverSpeechAction_<compact>`:
   - `ImportAudio(model, audio)`; failure → raise 1088.
   - Track set: `AddTrack` animation track (type 0) `Phoneme_Speech` (keywords "Phoneme,Speech") and audio track
     (type 2) `Phoneme_Audio` (keywords "Phoneme,Audio") on the model's mixer.
   - `AddAudioClip` on the audio track at offset 0; from its time control compute rounded start offset, clip-in and
     clip-out (clip-in/out shifted by the start offset); set `PlayControl.Out` = clip-out and `PlayControl.In` =
     clip-in − 1.
   - `CreateEvolverSpeechAction(model, name, keys)`; failure → delete track set and audio source, raise 1089.
   - `AddClip` of the action on the speech track at offset 0; set its `actionclip.timectrl.clipin` / `clipout` to the
     audio values.
   - Text: contents of `TextFileName` when it exists, `;` replaced by spaces.
   - `ExtractPhonemesToSpeechOpJapanese` (language jp) or `ExtractPhonemesToSpeechOp` (clip, audio, text, 0, 10); then
     `AddClipRelation` between the speech and audio clips. Any failure → delete action, track set, audio source and
     raise 1090.
10. Return the speech clip.

**Wire contract**: `GenerateLipSync(InputObjs, AudioFileName="", TextFileName="", Language="en", Resolutions="hmlc",
MappingProfilePath="") → speech clip`; creates two mixer tracks, an audio source + clip, an Evolver speech action +
clip, a clip relation, and changes the play range.

### 3.12 `UpgradeShaders`

No arguments; returns true when at least one shader was replaced, else false. Category Rendering; not key-assignable.

Runs passes until a pass changes nothing, at most 16 passes. Each pass, in this order, finds all instances by shader
CLSID and upgrades them:

| Obsolete shader (CLSID) | Replacement preset (family) | Port mapping / values |
|---|---|---|
| sib_color_mix8 `{7C4301B1-42E0-11D3-811D-00A0C983039A}` | `Mixers\Mix_8colors` (Texture Shaders) | base_color; mode/color/weight/alpha 1–7 one-to-one; `inuse<i>` = (i ≤ count) when `count` is a plain value, else an `Integer2scalar` shader fed by count drives a `Scalar_Math_Logic` (op 4 "≥", input2 = i) on each `inuse<i>` |
| sib_color_mix_color `{86C2DE3E-BCFA-11D1-90E9-0000F804EB21}` | `Mixers\Mix_2colors` | color1→base_color, color2→color1, mix→weight1 (alpha component only when the old `alpha` flag is true, else 0; animated/shaded cases inserted through `Color_Math_Basic` multiply by (1,1,1,0) or a `Boolean_switch` on the alpha flag); `alpha1` false, `mode1` 1 (Mix) |
| sib_scalar_mix_color `{86EB6638-…}` | `Mixers\Mix_2colors` | as above with scalar mix copied into all weight channels, or through `Scalar2color` (and a `Scalar_switch` with scalar1 0 when the alpha flag is driven); `alpha1` false, `mode1` 1 |
| sib_color_invert `{87AEE70C-…}` | `Image_Processing\Invert` | input, alpha |
| sib_scalar_invert `{875B74BE-…}` | `Math\Scalar_Invert` | input |
| sib_color_bias `{876C2534-…}` | `Math\Color_Math_Exponent` | input, bias→factor, alpha; op 2 (Bias) |
| sib_scalar_bias `{8725CFD5-…}` | `Math\Scalar_Math_Exponent` | input, bias→factor; op 2 |
| sib_color_gain `{878EB74D-…}` | `Math\Color_Math_Exponent` | input, gain→factor, alpha; op 3 (Gain) |
| sib_scalar_gain `{87426C0D-…}` | `Math\Scalar_Math_Exponent` | input, gain→factor; op 3 |
| sib_color_X_color `{8645B2C9-…}` | `Math\Color_Math_Basic` | color1→input1, color2→input2 (when a side has no shader its RGB are copied and its alpha set 0; `alpha` true only when color2 is the plain side); both shaded → an extra `Color_Math_Basic` named `Zero_Alpha` on input1 multiplying color1 by (1,1,1,0) with alpha on; op 2 (Multiply) |
| sib_color_X_scalar `{862451DD-…}` | `Math\Color_Math_Basic` | color→input1, scalar→input2, alpha; op 2 |
| sib_color_to_boolean `{22C05651-FEAE-11D1-8A0D-00A0C9892542}` | `Math\Color_Math_Logic` | input→input1, threshold→input2, alpha; op 2 (input1 > input2) |
| sib_scalar_to_boolean `{22C05658-…}` | `Math\Scalar_Math_Logic` | input→input1, threshold→input2; op 2 |
| sib_color_switch_opp `{85E2C132-…}` | `Switch\Boolean_switch` | input1→input2, input2→input1, switch |
| sib_color_add_clipping `{491EEA85-AA7D-11D2-AFD4-00A024191B9D}` | `Mixers\Mix_2colors` | input1→base_color, input2→color1; weight1 = (1,1,1,1); `alpha1` false; `mode1` 0 (Blend) |
| sib_render_hair `{1F51ED00-474B-4860-9428-447E9D4BFB74}` | `Hair_Renderer` (Material Shaders) | material, diffuse_root→DiffuseRoot, diffuse_tip1/2→DiffuseTipA/B, diffuse_balance→TipBalance, diffuse_crossover_point/range→DiffuseCrossoverCenter/Range, color_varation→DiffuseVariation, specular_inuse, specular, specular_decay, transparency_inuse/root/tip, transparency_crossover_point/range→…Center/Range, radiance→Irradiance |

(The CLSIDs in rows 3–15 share the suffix shown in the first row of their family.)

Per instance: a shader in a stack (a parent port holding more than one item) is skipped with the log "Cannot upgrade
<shader>: shader is in a shader stack.  Please obsolete manually."; otherwise "Upgrading <shader>" is logged, the
replacement is created from the preset with the old shader's name, ports are transferred, and on success the old
shader's output connections are moved to the new shader and the old one is deleted. A failed step logs "Failed to
upgrade <shader>" (warning) and leaves the new shader in place (inferred, it is not deleted). Hair: only when every
output goes to a material: the old shader is removed, the new one is connected to the material's Surface, Shadow,
Volume and PhotonVolume, log "Upgraded <name> to new hair shader. Shading model was changed to 'Fur'."; otherwise it
counts as failed.

Port transfer rules: data type from the parameter's type attribute (color, float/double = scalar, integer, boolean;
other → warning "Cannot transfer … : Unknown type(s)", fail). A shader on the source port is temporarily removed, the
value plus any animation/expression is copied (copy/paste animation), the shader is reconnected to the destination and
also put back on the source. Scalar→color: shaded source goes through a `Scalar2color` shader on the destination
(input and alpha), plain source fills R, G, B, A. Integer→scalar goes through `Integer2scalar`. Color→scalar: as
shipped the converter is applied and the transfer then reports failure (a reversed test in the script; inferred, so
such upgrades always fail). Any other combination: warning "Cannot convert <type> to <type>", fail. Preset-creation
failures log "FCreateShader: could not create preset …" / "could not create object from preset …" and
"FApplyShaderToCnxPoint: could not create …" (warnings).

**Wire contract**: `UpgradeShaders() → bool`; replaces the 16 obsolete shader kinds in the scene as tabled.

### 3.13 `syCachePaint1`, `syCachePaint2`

No arguments; registry return value on, but the procedure returns nothing (empty). Key-assignable; category Custom.

Select the children of the selection (`SelectChildNodes`), then select `<first selected>.*.cls.Point*.Map1`
(`Map2` for `syCachePaint2`), i.e. the syCache weight map. If that selection fails: log message 1004 ("select
syCache", `EXTSYFLEX`) and stop. It does not start the paint tool itself (inferred: the user paints the selected
weight map).

**Wire contract**: selects the `Map1` / `Map2` weight map of the selected syCache object.

### 3.14 `SyGetMassMap`, `SyGetSpringMap`

No arguments; registry return value on, returns nothing. Key-assignable; category Custom.

`SelectChildNodes`, then select `<first selected>.*.cls.ClothCls*.MassMap*` (`StiffMap*` for `SyGetSpringMap`);
failure → log 1002 ("select cloth", `EXTSYFLEX`) and stop.

**Wire contract**: selects the mass (resp. stiffness / spring) weight map of the selected Syflex cloth.

### 3.15 "Get default camera" (`GetPrimCameraDefaultProc`)

Args (registry): `PresetObj` (preset handler, default "Camera"), `Name` "", `Parent` "", outputs `Primitive`,
`3DObjCamera`, `3DObjCameraInterest`. Return value: the camera root. No scripting name; not key-assignable.

1. Empty `Name` → "Camera".
2. `SIGetPrim("CameraRoot", "<Name>_Root", Parent, 1)` → root null.
3. `SIGetPrimCamera(PresetObj, Name, "<Name>_Interest", Parent)` → camera, interest, camera primitive (outputs
   `3DObjCamera`, `3DObjCameraInterest`, `PrimObjCamera`).
4. Move the root's global position to the camera's global position.
5. Parent the camera and the interest under the root.
6. Return the root; outputs: primitive, camera, interest.

No selection, no inspection. (`GetPrimCamera` = this, then select the root as branch with conditional object filter and
`AutoInspect` the camera on tab "General".)

**Wire contract**: `GetPrimCameraDefault(Preset="Camera", Name="", Parent="") → <Name>_Root` with children
`<Name>` and `<Name>_Interest`.

### 3.16 "OBJ Import..." (`WavefrontImport`)

Same as the "Caller" paragraph of `SI_InspectWavefrontImportOptions` in `cmd-04b-import-export-model-scripts.md`
(verified in this read): under licence "Avid 3D" the open browser ("Select a .OBJ file", user path, filter
"Wavefront (*.obj)|*.obj|All Files (*.*)") goes straight to `ObjImport(file, 1, 2, true, true, false)` with no empty
check; otherwise command logging is switched off around `SI_InspectWavefrontImportOptions` (restored by setting the
preference true twice), then when a file name came back `ObjImport(FileName, Group, hrc, Material, UV, UserNormal,
UVwrapping)` and, for a non-empty displacement image, `SetupDisplacement` on the returned objects. No arguments, no
return; key-assignable; category File.

**Wire contract**: menu entry that shows the OBJ import options and imports.

### 3.17 "Save Zero Key Hot Key" (`SaveZeroKeyHotKeyProc`, SPEC-PARTIAL)

No arguments, no return; key-assignable; category Animation. `uixsiscripts.vbs` (462,005 bytes) could not be read and
no earlier note covers this procedure. Inferred from the name and from `SaveZeroKeyOnCharacterKeySet` (CMD-01d A6):
keys the current keyable parameters at the current frame with value 0. Unverified.

### 3.18 `GenNormalMap`, `GenDiffuseMap` (SPEC-PARTIAL)

Registry only. `GenNormalMap`: `PSet` (SingleObj), `InputObj` (SingleObj), optional bools `GenNormalMapM`,
`GenNormalMapT`, `GenTangents` (default false); return value on; procedure `XSI_GenerateNormalMap`. `GenDiffuseMap`:
`PSet`, `InputObj`; return value on; procedure `XSI_GenerateDiffuseMap`. Category Property|Rendering; not
key-assignable. The script file is not shipped in this install, so invoking either command would fail to find its
script (inferred). Behaviour unknown beyond the descriptions ("Generates the normal / surface map of a low resolution
model based on a group of high resolution models").

## 4. Enable conditions and errors

No command here has an enable condition. Script errors are raised only where stated (AddCommandToPlugin bad view,
GenerateCommandPlugin bad property, GenerateLipSync validation, TemplateWizard Load Existing parse errors, generator
argument check). Every other failure is a message box or a log line and the command returns normally.

## 5. Open questions

| # | Question | How to close |
|---|---|---|
| Q1 | `ShaderWizard.js` (75,743 B) unread: `CreateMRShaderWizard` property, layout, generated files | read with a loader that admits >64 KB, or connect the install folder |
| Q2 | `SaveZeroKeyHotKeyProc` in `uixsiscripts.vbs` (462,005 B) unread | same |
| Q3 | `GPUSurfaceFX.js` absent from the install: confirm the commands fail, or locate the script (user / workgroup add-on) | XSIBATCH: run `GenNormalMap` and read the error |
| Q4 | Color→scalar port transfer in UpgradeShaders always fails as shipped (reversed test) | golden with a sib_color_X_scalar driven by a color-to-scalar connection |
| Q5 | Exact text of the `XSIPLUGINUI` / `EXTSYFLEX` / `XSIACTION2` messages | read the dictionaries |
| Q6 | Plug-in Wizard layout items `Url` / `Email` refer to undefined parameters: hidden or error? | open the wizard in a golden |
