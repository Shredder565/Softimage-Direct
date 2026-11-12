# CMD-01b: script-implemented SDK helper commands

Row: **CMD-01b** (split from CMD-01, uncategorised). Status: **SPEC-PARTIAL**.
Run: 2026-11-12, `si-analyst`, unattended.

17 commands registered by four self-installing script plug-ins that ship as
plain text in the install:

| Plug-in name (as registered) | File | Language | Commands |
|------------------------------|------|----------|----------|
| `SDKHelpers` 1.0 | `Application\Commands\SDKHelpers.js` | JScript | `ShowFileForEdit`, `ShowFileInShaderCodeEditor`, `CreateAddonDirectories`, `CreateWorkgroupDirectories`, `PackageAddon`, `PackageAddonUI`, `SpdlCheck`, `FindFilesInFolder` |
| `SDKVBHelpers` 1.0 | `Application\Commands\SDKVBHelpers.vbs` | VBScript | `XSIInputBox`, `StringSearch`, `TrimString`, `XSIRound` |
| `Global Script Variable Support` 1.0 | `Application\Commands\GlobalVarPlugin.js` | JScript | `GetGlobal`, `SetGlobal`, `SetGlobalObject` |
| `SimplePropertiesPlugin` 1.1 | `Application\Properties\SimpleProperties.js` | JScript | `LargeMsgBox`, `PickFolder` (plus properties `CustomColor`, `TextProp`, see the end of this note) |

All four plug-ins give "Softimage" as author. For every command the command
name and the scripting name are identical.

This batch is 17 rather than 20+ because it is the complete set of helper
commands in these four files; the remaining uncategorised commands belong to
other families.

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | argument names, defaults, `return_value`, `key_assignable`, description. Agrees with (S) for all 17 |
| (S) | The four script files above, read in full from the install | registration, flags, argument types, every execution step, log and error texts |
| (D) | `Application\Dictionary\en\XSISCRIPTS.dict` (254 records) | text of the translated message ids |
| (H) | `XSISDK\include\xsi_decl.h` | numeric values of the enums the scripts use |
| (L) | Directory listing of `Application\bin` | `spdlcheck.exe` exists (42,824 bytes) |
| (B) | REA + Ghidra 12.1.4 on `Application\bin\xsiutils.dll` (sha256 `fc8c8206…7290c23`) | behaviour of `XSIUtils.Translate` (function at image address `0x1800086c0`), and which imports back `LaunchProcess` / `EnsureFolderExists` |
| (V) | VBScript / JScript language semantics (public Microsoft language reference, from memory, not re-fetched) | `InStr`, `Trim`, `Round`, `InputBox`, JScript `String.search` |
| - | Softimage SDK command reference (online) | **Not reached.** `Doc\` holds only links to the online guides, and the fetch of `download.autodesk.com` was not permitted in this unattended session. See Q1 |

No script text, decompiler output or disassembly is reproduced here. The
behaviour is described in prose and tables. Message strings, ids and enum
values are recorded as facts.

Side finding: `tools/parse_dict.py` drops records. Each record in a `.dict`
file is padded to a 4-byte boundary after its terminating null; the parser
does not skip the padding and recovers only 132 of the 254 records in
`XSISCRIPTS.dict` (ids 1174, 1190, 1192, 1193 were among those lost). Ledger
row TOOL-01 tracks the fix. The ids below were read with the padding handled.

## Shared facts

### Enum values used (H)

| Name | Value |
|------|------:|
| `siArgumentInput` | 2 |
| `siSupportsKeyAssignment` (command capability) | 8 |
| `siCannotBeUsedInBatch` | 256 |
| `siUndoable` | 262144 |
| `siNoLogging` | 8388608 |
| `siError` / `siWarning` / `siInfo` / `siVerbose` (log severity) | 2 / 4 / 8 / 16 |
| `siMsgCritical` (message box flag) | 16 |
| `siModal` (inspect mode) | 4 |
| `siNormal` (view state) | 0 |
| `siUserPath` / `siUserAddonPath` (installation path ids) | 1 / 5 |

### Command flags (S, R)

"Key" = can be bound to a key. "Logged" = appears in the command history.
"Batch" = allowed in batch mode.

| Command | Returns a value | Key | Logged | Batch | Other |
|---------|:---:|:---:|:---:|:---:|-------|
| `ShowFileForEdit` | yes | no | no | yes | |
| `ShowFileInShaderCodeEditor` | yes | no | no | yes | no help page registered |
| `CreateAddonDirectories` | yes | no | **yes** | yes | |
| `CreateWorkgroupDirectories` | yes | no | **yes** | yes | |
| `PackageAddon` | yes | no | **yes** | yes | no description set |
| `PackageAddonUI` | yes | **yes** | no | **no** | no help page registered |
| `SpdlCheck` | yes | no | **yes** | yes | |
| `FindFilesInFolder` | yes | no | no | yes | |
| `XSIInputBox` | yes | no | no | yes | |
| `StringSearch` | yes | no | no | yes | |
| `TrimString` | yes | no | no | yes | |
| `XSIRound` | yes | no | no | yes | |
| `GetGlobal` | yes | no | no | yes | `siUndoable` explicitly cleared |
| `SetGlobal` | no | no | no | yes | `siUndoable` explicitly cleared |
| `SetGlobalObject` | no | no | no | yes | `siUndoable` left at its default |
| `LargeMsgBox` | yes | **yes** | no | yes | |
| `PickFolder` | yes | **yes** | no | yes | |

Every other command sets a help page built from its own name with
`XSIUtils.BuildHtmlHelpURL(<name>)`.

All arguments are input arguments (direction 2). None uses an argument handler.

### Translated messages (D)

Looked up with `XSIUtils.Translate(<id>, "XSISCRIPTS")`.

| Id | English text |
|---:|--------------|
| 1174 | Please select something and try again |
| 1190 | This is a compiled C++ plug-in.⏎⏎To edit this plug-in it is necessary to load ⏎the original source code rather than the .dll or .so file. |
| 1191 | No addon directory specified |
| 1192 | Source Add-on Directory does not exist |
| 1193 | Source directory must be a directory within the Addons folder |
| 1194 | Spdlcheck only works on files with the .spdl extension |
| 1532 | **not present in the English dictionary** (Q2) |

(⏎ marks a line break in the stored string.)

### `XSIUtils.Translate` (B)

Arguments: the key, the dictionary name, then up to three optional
substitution strings. Result: a string.

1. Missing dictionary name or missing result slot: fails as an invalid pointer.
2. If the key is a string, the lookup is by string key. Otherwise the key is
   converted to an unsigned 32-bit integer and the lookup is by id. A key that
   cannot be converted fails as an invalid argument.
3. Both lookups are imported from `sigeneral.dll` (`DictLoadString`,
   `DictLoadIdstring`). If the lookup yields nothing, the call fails with a
   generic failure, which a script sees as an error. Whether the lookup itself
   falls back to another source for an id missing from the `.dict` file was
   not followed into `sigeneral.dll` (Q2).
4. With no first substitution string (absent or empty) the looked-up text is
   returned unchanged.
5. With a first substitution string the text is used as a printf-style format.
   All three substitutions are applied only when all three are non-empty. In
   every other case only the first is applied, even if a second was given.

Also from the import table of `xsiutils.dll`: process launching uses
`CreateProcessW` with `WaitForSingleObject` / `GetExitCodeProcess` available
for the blocking form, and folder creation goes through `DSCreateDirectories`
in `dssdk10.dll`. The individual `LaunchProcess` and `EnsureFolderExists`
methods were not traced (Q3).

## Wire contract

### `GetGlobal`, `SetGlobal`, `SetGlobalObject`

Purpose: a session-wide key/value store shared by all scripting languages.

| Command | Arguments (default, type) | Returns |
|---------|---------------------------|---------|
| `GetGlobal` | `in_VariableName` ("", string) | stored value, or null when the name was never set |
| `SetGlobal` | `in_VariableName` ("", string); `in_Value` (no default, any) | nothing |
| `SetGlobalObject` | `in_VariableName` ("", string); `in_Value` (default 0, declared as an object reference) | nothing |

Storage model:

- One dictionary (a Windows `Scripting.Dictionary`) held in the `UserData` of
  the plug-in named "Global Script Variable Support". It is created on first
  use by any of the three commands.
- Lifetime is the Softimage session. It is not saved with the scene and does
  not change on New Scene or scene load. It is lost if the plug-in is unloaded
  or reloaded.
- Reading a name that does not exist returns null and does **not** create an
  entry.
- Setting an existing name replaces the value. Setting null stores null; the
  key then exists but reads back as null.
- Key comparison is whatever `Scripting.Dictionary` does by default, which is
  case-sensitive (V).
- `SetGlobal` and `SetGlobalObject` do the same thing. The only difference is
  the declared type of `in_Value`, which lets script-created objects pass
  through the command layer.

Errors: an empty name raises a script error. Text is "Invalid argument to
GetGlobal" for `GetGlobal` and "Invalid argument to SetGlobal" for both
setters (`SetGlobalObject` reuses the `SetGlobal` text).

Enable conditions: none. Nothing in the scene changes.

Golden: set, get, overwrite, get of unknown name (null, and the key count does
not grow), empty-name error text for all three, value survives New Scene, and
none of the three appears in the command log.

### `XSIInputBox`

Arguments: `Prompt` (""), `Title` (""), `Default` ("") — all strings.

- Interactive: shows the VBScript input box with these three values. Returns
  the typed string. Cancel returns an empty string.
- Batch (`Application.Interactive` false): no UI, returns `Default`.

Golden (batch): returns the default unchanged.

### `StringSearch`

Arguments: `SearchTarget` (no default), `SearchStr` (no default),
`CaseSensitive` (true, bool), `StartPos` (0, int4).

Returns the zero-based index of the first occurrence of `SearchStr` in
`SearchTarget` at or after `StartPos`, or −1 when there is none.

Defined as VBScript `InStr(StartPos + 1, SearchTarget, SearchStr, mode) − 1`,
with binary comparison when `CaseSensitive` is true and text comparison
otherwise. The edge cases therefore follow `InStr` (V):

| Case | Result |
|------|-------:|
| not found | −1 |
| `SearchTarget` empty | −1 |
| `SearchStr` empty | `StartPos` |
| `StartPos` beyond the end of `SearchTarget` | −1 |
| either string Null | Null |
| `StartPos` negative (so the `InStr` start is below 1) | script error |

Golden: one row per line of the table, plus a case-insensitive hit and a hit
found only because of `StartPos`.

### `TrimString`

Arguments: `StringToTrim` (no default), `TrimLeft` (true), `TrimRight` (true).

| `TrimLeft` | `TrimRight` | Result |
|:---:|:---:|--------|
| true | true | both ends trimmed |
| true | false | leading only |
| false | true | trailing only |
| false | false | input returned unchanged, and a warning is logged: "TrimString has no effect when both TrimLeft,TrimRight are false" |

Only space characters are removed. Tabs and line breaks are kept (the script
itself notes this limit; V).

Golden: the four rows, and a string with leading tab and trailing newline.

### `XSIRound`

Arguments: `in_Expression` (no default), `in_NumDecimals` (0).

Returns VBScript `Round(in_Expression, in_NumDecimals)`. That is round half to
even (V): 2.5 → 2, 3.5 → 4, 0.125 at 2 decimals → 0.12, −2.5 → −2.

Golden: those four values and one ordinary value such as 1.2345 at 2 → 1.23.

### `LargeMsgBox`

Arguments: `Text` (no default), `Title` ("Info", string).

- Batch: returns true immediately, no side effects.
- Interactive:
  1. Adds a `TextProp` property named `Text` directly under the active scene
     root (branch flag false).
  2. Sets its `Text` parameter to the `Text` argument.
  3. Opens it as a modal property page with the given title.
  4. Deletes the property.
  5. Returns true if the page was closed with OK, false if cancelled.

Golden (batch): returns true and the scene root has no new property.
Open: whether the temporary add/delete lands on the undo stack (Q4).

### `PickFolder`

Arguments: `Title` (""), `HelpText` (""), `DefaultValue` ("") — all strings.

- Interactive:
  1. Adds a plain `CustomProperty` named `PickFolder` under the active scene
     root (branch flag false).
  2. Adds a string parameter `Directory` and sets it to `DefaultValue`.
  3. Replaces the layout with: one unnamed group holding a static text line
     (`HelpText`) and the `Directory` parameter shown with the folder-picker
     control and no label.
  4. Opens it modally with `Title`.
  5. Result is the `Directory` value on OK, or an empty string on cancel.
  6. Deletes the property and returns the result.
- Batch: the script's batch branch refers to a variable whose name differs in
  letter case from the argument, so it is undefined. As written this raises a
  JScript runtime error instead of returning `DefaultValue`. Treat "errors in
  batch" as the Softimage behaviour until a golden says otherwise (Q5).

### `ShowFileForEdit`

Arguments: `FileName` ("", string), `LineNumber` (−1, int4).

Order of steps:

1. Empty `FileName`: log an error "No file specified in call to
   ShowFileForEdit" and return nothing.
2. `FileName` ends in `.dll` or `.so` (lower case only; `.DLL` passes): show a
   message box with text 1190 and return null.
3. Read the preference `preferences.scripting.externaleditor` and trim it with
   `TrimString`. If it is not empty:
   - If it contains `%s`: replace the first `%s` with the file name (no quotes
     added). If it also contains `%l`, replace the first `%l` with the line
     number, using 1 when `LineNumber` ≤ 0.
   - Otherwise the command line is the editor string, a space, then the file
     name in double quotes.
   - Log "Launching <command line>" at verbose level, launch the process
     without waiting, return null.
   - If launching throws: log a warning "Problem launching external editor:
     <error description>" and continue with step 4.
4. Collect views of the active layout: first those of type "Script Editor",
   then those of type "Text Editor".
5. Walk the list in that order. Remember the first view that is visible. For
   each view read its `files` attribute; if the requested file is found in it:
   - set attribute `errorlinenum` to the line when `LineNumber` > 0,
   - set attribute `activetab` to the file name as given,
   - make the view visible, return null.
6. Not found but a visible view was remembered: open the file in that view
   (see "Opening a file in a view") and return null.
7. Otherwise create a new view of type "Text Editor" named "Text Editor" in
   the active layout, open the file in it, and return that view object.

How step 5 compares: both the view's file list and the file name have
backslashes turned into forward slashes and are lower-cased. The file name is
then used as a **regular-expression pattern** searched for anywhere in the
list (V). So the match is a case-insensitive substring match in which regex
characters in the path keep their regex meaning (`.` matches any character; a
path containing `(`, `+` or `[` can fail to match or raise an error).

Opening a file in a view (shared with the shader editor command):

1. If a parser name was supplied, set attribute `parser`.
2. Set attribute `filename` to the file. This is what loads it; a dirty buffer
   causes the editor's own save prompt.
3. If the line is > 0, set attribute `errorlinenum`.
4. Set the view state to normal (0) and make it visible.

Return value summary: a View object only when a new floating editor was
created; null on every other completed path; nothing after the empty-name
error.

Golden: needs the UI, so headless coverage is limited to step 1 (error text)
and step 2 (not testable without a message box). Q6.

### `ShowFileInShaderCodeEditor`

Arguments: `FileName` ("", string), `Parser` ("", string), `LineNumber` (−1, int4).

Same as `ShowFileForEdit` with these differences:

- The empty-name error text is "No file specified in call to
  ShowFileInShaderCodeEditor".
- No external-editor step.
- Only views of type "Shader Code Editor" are considered.
- A new view, when needed, has type and name "Shader Code Editor".
- `Parser` is applied (step 1 of "Opening a file in a view") **only when a new
  view is created**. When an existing visible view is reused the file is
  opened without setting the parser.

### `CreateAddonDirectories`

Arguments: `RootPath`, `AddonName` (no defaults). Returns a string: empty on
success, otherwise an error message.

1. Add-on root = `RootPath\Addons\AddonName`, unless `RootPath` already ends
   in "Addons" (any letter case, and only when there is no trailing
   separator), in which case it is `RootPath\AddonName`.
2. Create that folder, including missing parents. On failure return
   "Problem creating directory⏎<add-on root>⏎<error description>" and stop.
3. Create the standard sub-folders below it, in this order:

| # | Relative path |
|--:|---------------|
| 1 | `Application/Plugins` |
| 2 | `Application/layouts` |
| 3 | `Application/toolbars` |
| 4 | `Application/views` |
| 5 | `Application/spdl` |
| 6 | `Application/bin/nt-x86-64` (platform "Win64"; `nt-x86` for "Win32", `linux` otherwise) |
| 7 | `Data/Scripts` |
| 8 | `Data/Preferences/Keymaps` |
| 9 | `Data/DSPresets/Operators` |
| 10 | `Data/DSPresets/Shaders/Realtime` |
| 11 | `Data/DSPresets/Shaders/Texture` |
| 12 | `Data/DSPresets/Shaders/Geometry` |
| 13 | `Data/DSPresets/Shaders/Light` |
| 14 | `Data/DSPresets/Shaders/Lens` |
| 15 | `Data/DSPresets/Shaders/Volume` |

4. Return "".

A failure while creating a sub-folder is not caught and surfaces as a command
error. The command is logged. Existing folders are left alone.

Golden: run against a temp folder with and without a trailing "Addons";
compare the resulting tree (16 folders) and the "" return.

### `CreateWorkgroupDirectories`

Argument: `WorkgroupPath` (no default). Returns "" or an error message.

Creates `WorkgroupPath` itself (same error text shape as above, with the
workgroup path), then the same 15 sub-folders directly under it. It does not
check or change which workgroups Softimage is connected to.

### `FindFilesInFolder`

Arguments: `Directory` ("", string), `RegularExpression` (".*", string),
`FindAllMatches` (false, bool), `ReturnFullPath` (true, bool).

- Looks only at files directly in `Directory`. No recursion, folders are never
  returned.
- The pattern is a JScript regular expression, case-insensitive when the file
  system is (always on Windows).
- A file matches when the pattern matches **starting at the first character**
  of the file name. It need not reach the end: `abc` matches `abcdef.txt`, and
  `.*\.js` matches `a.json`.
- Each result is the bare file name, or `Directory` joined with the name when
  `ReturnFullPath` is true.
- `FindAllMatches` false: returns the first match in directory enumeration
  order, or "" when none.
- `FindAllMatches` true: returns a JScript array of all matches (empty array
  when none).
- `Directory` cannot be opened: logs an error "FindFilesInFolder - problem with
  argument <Directory> : <error description>" and returns "" or an empty
  array according to `FindAllMatches`.

Open: enumeration order is that of the Windows file-system object and is not
defined by the script (Q7).

Golden: a temp folder with a handful of files; the four flag combinations; the
prefix-match examples above; a missing folder.

### `SpdlCheck`

Arguments: `strFilePath` (no default), `in_WithUI` (true, bool).

1. Missing or empty path: log an error "Invalid empty path argument to
   SpdlCheck", return nothing.
2. Path does not end in `.spdl` (any case): when `in_WithUI`, show a message
   box with text 1194. Return the string "Failure: Not a SPDL File".
3. Run, and wait for,
   `spdlcheck -nologo -noverbose -out "<user path>\spdlcheckoutput.tmp" "<strFilePath>"`,
   where the user path is installation path id 1.
4. Read the whole temp file as text, then delete it.
5. When `in_WithUI`, show the text with `LargeMsgBox(text, "SPDLCheck Results")`.
6. Return the text.

The tool is `Application\bin\spdlcheck.exe` (L). On success its output starts
with "Compilation succeeded" (noted in the script; the checker's own messages
were not examined, Q8). A missing temp file (tool failed to start) is not
handled and surfaces as a command error.

### `PackageAddon`

Arguments: `SrcDir` (no default), `DestinationPath` ("", string),
`Overwrite` (true), `ExcludeDirs` ("", string; names separated by `;`).

Returns a string: empty on success, otherwise the reason. It does not raise.

Steps, in order. Any step that fails ends the command with the quoted message,
which is also logged as an error.

1. **Source.** If `SrcDir` is an existing folder, use it. Otherwise try
   `<user path>\Addons\<SrcDir>`; if that is missing: "no such folder: <that path>".
   The parent folder of the source must be named "addons" (any case), else
   "Invalid Source Directory argument - must be a directory within the Addons folder".
   The add-on's sub-directory name is the source folder's own name.
2. **Destination.**
   - `DestinationPath` empty: the parent folder path with the sub-directory
     name appended **with no separator between them** (for `…\Addons\MyTool`
     this gives `…\AddonsMyTool`). This is what the script does; confirm with
     a golden before copying it (Q9).
   - `DestinationPath` is an existing folder: that folder joined with the
     sub-directory name.
   - Otherwise `DestinationPath` as given.
   - Append `.xsiaddon` unless the path already ends with it (any case).
   - File exists and `Overwrite`: delete it, or fail with
     "Failed to delete existing file <path>".
   - File exists and not `Overwrite`: "File already exists <path>".
   - File does not exist: create missing parent folders, or fail with
     "Unable to create destination directory - <error description>".
3. **Exclusions.** Empty or null means none. Otherwise split on `;`. An entry
   excludes any folder whose **name** equals it (not its path), ignoring case
   on Windows. No trimming, no wildcards.
4. **Details.** Best effort; a failure here is logged at verbose level as
   "Error setting addon details: <description>" and packaging continues. If
   the add-on's detail file exists in the source root, every key/value in it
   becomes an add-on detail. If the description file exists, its text becomes
   the "Description" detail. File names come from the `AddonDoc` helper (Q10).
5. Log "Packaging: <source>" and "Destination: <destination>".
6. Show the progress bar: caption "Packaging Addon", cancel disabled, maximum
   200000, step 1.
7. **Collect files.** Depth first from the source root: all files of a folder,
   then each sub-folder that is not excluded. Each file is added as an "other"
   item with its full path and a target directory equal to its folder's path
   relative to the source root (empty for the root, otherwise beginning with
   the path separator). Progress status is a tab followed by "adding: <path>"
   per file and "Skipping <path>" per excluded folder, one increment each.
8. No files: "No .xsiaddon file was created because no files were found to package".
9. Set the add-on's default installation path to the user add-on path (id 5)
   and its sub-directory to the name from step 1.
10. Status "Compressing and saving to disk", one increment, then save to the
    destination. Failure: "Error saving addon - <error description>".
11. Log "Packaging of <n> files complete (<seconds> seconds)".

Always, at the end: hide the progress bar. An unexpected script error anywhere
returns "Unexpected error packaging addon - <description>" (this one is not
logged).

The content of the `.xsiaddon` file is produced by the application's add-on
object and belongs to SYS-13, not to this row.

Golden: error strings for a bad source, a source outside an `Addons` folder,
an existing destination with `Overwrite` false, an empty source; the two log
lines; default-destination path (Q9); file count with and without `ExcludeDirs`.

### `PackageAddonUI`

Argument: `Source` ("", string). Not available in batch.

1. `Source` empty: both the source and the destination fields start as the
   user add-on path. Otherwise `Source` must be an existing folder, else log an
   error "PackageAddonUI - Problem with path argument <Source> : <description>"
   and return nothing. The destination field starts as
   `<parent of Source>\<name of Source>.xsiaddon`.
2. Build a stand-alone custom property (not placed in the scene) named
   `PackageLocationOptions`:

| Parameter | Type | Initial value |
|-----------|------|---------------|
| `Source` | string | from step 1 |
| `Destination` | string | from step 1 |
| `Overwrite` | bool | true (not animatable) |
| `ExcludeDir` | string | the session's remembered exclude list, initially `src;Debug;Ship` |
| `Platforms` | string | empty; never shown or used |
| `AuthorName` | string | empty |
| `AuthorEmail` | string | empty |
| `Company` | string | empty |
| `URL` | string | empty |
| `Description` | string | empty |

3. Layout, top to bottom:

| Item | Detail |
|------|--------|
| static text | "Use this dialog to build an .xsiaddon file containing all the files⏎at the Source directory, including subdirectories." |
| spacer | |
| group "Input" | `Source` labelled "Source", folder-picker control; `ExcludeDir` labelled "Directories to Exclude" |
| group "Output" | `Destination` labelled "Destination", file-path control with filter `xsiaddon (*.xsiaddon)\|*.xsiaddon\|\|`; `Overwrite` labelled "Overwrite existing .xsiaddon" |
| group "Author" | `AuthorName` labelled "Name"; `AuthorEmail` labelled "Email"; `Company`; `URL` |
| group "Description" | `Description` as a multi-line string, no label (requested height 200) |

   Help page: `XSIUtils.BuildHtmlHelpURL("cus_addons_PackageLocation")`.
   Page logic (JScript): when `Source` changes, reload the author fields and
   description as in step 4.
4. Pre-fill from the source folder: if its detail file exists, copy the keys
   `AuthorName`, `AuthorEMail`, `Company`, `URL` into the matching fields and
   keep the whole detail dictionary in the global `PackageAddon_DetailDict`
   (via `SetGlobal`); otherwise set that global to null. If its description
   file exists, load it into `Description`. Failures are logged at verbose
   level only.
5. Loop: open the property modally, title = translated id 1532 (Q2). Cancel
   returns false. On OK read `Source`, `Destination`, `ExcludeDir` (which
   becomes the remembered list for the rest of the session) and `Overwrite`,
   then validate, in this order, showing a critical message box and reopening
   the page on failure:
   - `Source` empty → text 1191
   - `Source` is not an existing folder → text 1192
   - parent folder of `Source` is not named "addons" (any case) → text 1193
6. Save the author fields back into the detail dictionary (key names as in
   step 4) and write the detail file; write the description file when
   `Description` is not empty. Failures are logged at verbose level as
   "Failed to remember addon details <description>" and do not stop the command.
7. Run the `PackageAddon` command (so it is logged) with the four values. A
   non-empty result is shown in a critical message box.
8. Set the global `PackageAddon_DetailDict` to null.
9. Return value: false. The script never sets it to true, so success and a
   packaging failure both return false.

### Enable conditions

None of the 17 commands has an enable condition; all are always enabled (R).
`PackageAddonUI` is refused in batch mode by its capability flag.

## Related: `CustomColor` and `TextProp` properties (same plug-in)

Found while reading `SimpleProperties.js`; `LargeMsgBox` depends on `TextProp`.

| Property | Parameters | Layout | Help topic |
|----------|------------|--------|-----------|
| `CustomColor` | `Color_R`, `Color_G`, `Color_B`, `Color_A`: double, default 0, range 0..1, suggested range 0..1, persistable and animatable | one colour control bound to `Color_R`, label "Color", with alpha | `<FactoryPath>/Doc/<DocLangPref>/xsidocs.chm::/property8539.htm` |
| `TextProp` | `Text`: string | one multi-line string control, height 275 pixels, no label | `…/xsidocs.chm::/property8541.htm` |

Each registers a menu at anchor `siMenuTbGetPropertyPSetID` (the property
section of Get > Property) with one item labelled with the property name. The
item: if nothing is selected, shows a message box with text 1174 and stops;
otherwise adds the property to the **first** selected object and inspects it.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | Cross-check against the SDK command reference pages for these commands | needs web access to the Autodesk online SDK guide, or a local copy of `xsisdk.chm` |
| Q2 | Id 1532 (`PackageAddonUI` dialog title) is not in the English `XSISCRIPTS.dict`. Does the id lookup fall back to another source, and what is the title? | follow `DictLoadIdstring` in `sigeneral.dll`, or dump `XSIUtils.Translate(1532,"XSISCRIPTS")` through XSIBATCH |
| Q3 | Exact `XSIUtils.LaunchProcess` (blocking flag, working directory, window) and `EnsureFolderExists` (second argument) semantics | trace the two methods in `xsiutils.dll`; SDK object-model reference |
| Q4 | Do the temporary properties of `LargeMsgBox` / `PickFolder` reach the undo stack or mark the scene dirty? | interactive check, or XSIBATCH dirty-flag dump after a scripted call |
| Q5 | `PickFolder` in batch mode: error (as the script reads) or `DefaultValue`? | XSIBATCH golden |
| Q6 | View attribute names `files`, `activetab`, `filename`, `errorlinenum`, `parser` on the text / script / shader editors: exact format of `files` | view definitions and `scripthostui.dll` / `shadercodeeditor.dll` |
| Q7 | File enumeration order for `FindFilesInFolder` | XSIBATCH golden on a fixed folder |
| Q8 | `spdlcheck.exe` output format beyond the "Compilation succeeded" prefix | run the tool on a shipped SPDL (headless, read-only) |
| Q9 | `PackageAddon` default destination: is the missing separator real? | XSIBATCH golden with an empty `DestinationPath` |
| Q10 | Detail and description file names and format, from `GetAddonDocHelper` (`Addons\sdkui\Application\Plugins\AddonDoc.js`) and `WizardHelper` (`…\SDKWizards.js`) | read those two scripts; they are a separate batch |

No XSIBATCH golden was run for this row.
