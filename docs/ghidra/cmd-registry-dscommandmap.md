# CMD-REGISTRY: the built-in command registry (`XSI.DSCommandMap`) and the command → handler binding

Row: CMD-REGISTRY. Status: **SPEC** (file format and binding rule), with open items below.
Run: 2026-11-17, `si-analyst`, unattended. No decompiler output is reproduced here.

## What was found

The table that binds every factory command to the code that executes it is the file
`Application\CommandMaps\XSI.DSCommandMap` (1,740,172 bytes in 2015 SP2). The previous run
looked for the scripting names inside `Application\bin` and concluded the binding lived in the
Windows registry; that was wrong. The names are UTF-16 text in this file, and each command
record carries the CLSID of the COM class that executes it.

How it was attested: the file was read directly (hex, then the parser
`tools/parse_dscommandmap.py`); the handler CLSIDs were then searched as 16 raw bytes in the
282 staged binaries of `Application\bin`, `Application\Plugins` and the add-ons; for five DLLs
the class behind the CLSID was followed in Ghidra (see
[cmd-b7a-uitasks-group-view-binary.md](./cmd-b7a-uitasks-group-view-binary.md)).
`bin\runonce.bat` registers the COM servers with `cmdreg.exe -f XSICOMDLLs.lst` (171 DLLs);
`cmdreg.exe` only loads each DLL and calls its `DllRegisterServer`.

## File layout (little endian)

| Offset | Content |
|--------|---------|
| 0x00 | magic `10mc` |
| 0x04 | u32 section count = 6 |
| 0x08 | 6 × (u32 offset, u32 record count, u32 record size) |
| 0x50 | u32 file size |

| Section | Records | Size | Content |
|---------|--------:|-----:|---------|
| 0 | 1 | 0x1c | map identity: GUID `{50830560-31b5-11d0-82e7-00a0243e268d}`, u32 1, u32 0, u32 0x28 |
| 1 | 2397 | 0x90 | commands |
| 2 | 13735 | 0x20 | arguments |
| 3 | 452 | 0x20 | pairs (command GUID, second GUID); several rows per command (for example six for `SICreateMaterial`). Meaning of the second GUID not established |
| 4 | 1 | 892,778 | string pool, UTF-16LE, NUL-terminated; every string reference in sections 1–2 is an offset **in UTF-16 code units** from the start of this pool; 0 = empty |
| 5 | 1 | 48,122 | bitmap pool (concatenated `BM` files, 28×28 24-bit seen first) |

### Command record (0x90 bytes)

| Offset | Type | Field |
|--------|------|-------|
| 0x00 | GUID | command id (unique for all 2397) |
| 0x10 | GUID | always null |
| 0x20 | GUID | **handler CLSID**: the COM class that executes the command |
| 0x30 | str | display name |
| 0x34 | str | description |
| 0x38 | str | scripting name (empty for 100 UI-only entries) |
| 0x3c | str | tooltip / short label |
| 0x40 | str | label when disabled (11 commands) |
| 0x44 | str | category; several joined with `\|` (`Property\|Edit`) |
| 0x48 | str | compatibility keywords joined with `\|`: `RenderingIncompatible` (161), `CreationCompatible`, `PickingCompatible`, `CreationIncompatible` |
| 0x4c–0x60 | u32 × 6 | sparse (0x50: 20 commands, 0x5c: 5, 0x60: 9); not decoded |
| 0x64 | u32 | flags (bit 1 set on 2196; bits 3, 7, 18, 23, 29 common; meaning not established) |
| 0x68 | u32 | sparse (150 commands), not decoded |
| 0x6c | u32 | sparse (222 commands), not decoded |
| 0x70 | u32 | index of the first argument in section 2 |
| 0x74 | u32 | argument count |
| 0x78–0x8f | | zero |

### Argument record (0x20 bytes)

| Offset | Type | Field |
|--------|------|-------|
| 0x00 | str | argument name |
| 0x04 | u32 | flags (bit 1 set on most; bit 0 5011; bit 7 3070; bit 16 always with type 72; bit 9 911, seen on output / return arguments such as `Value` 0x201; meaning otherwise not established) |
| 0x08 | u32 | VARIANT type: 8 string, 11 boolean, 3 / 2 / 19 / 22 / 23 integers, 5 double, 4 float, 9 object, 13 unknown, 0 empty, 0x200c / 0x200d arrays, 72 = argument handler given by CLSID, 96 seen 109 times |
| 0x0c | u32 | zero |
| 0x10 | 16 bytes | default: string reference (type 8), 0/1 (type 11), integer, IEEE double, or the **argument-handler CLSID** (type 72; 55 distinct, the commonest `{7834cb8c-5252-11d2-a5cc-00a0c91412de}` on 976 arguments such as `InputObjs`) |

## Binding rule

- **Script commands** (1259): handler CLSID `{5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9}` (bytes present in `tasks.dll`, `scnmgr.dll`, `xsievents.dll`), and three hidden trailing arguments `_ScriptEngine` (`VBScript` / `JScript`), `_ScriptName` (file under `Application\DSScripts`, or a DLL name for `customcommands.dll`) and `_ScriptProcedure` (procedure to call). The visible arguments are passed to that procedure in order. Arguments named `Value` with flags 0x201 are the return value.
- **Native commands** (1138, 690 distinct CLSIDs): the handler CLSID is a COM class in one of the registered DLLs. In the five DLLs opened this run the CLSID is compared inside `DllGetClassObject`; the matching class factory creates a task object whose vtable slot 5 performs the command (6 undo, 7 redo, 8 reads the arguments by name from the execution context). One class can serve several commands; it tells them apart by the command GUID.
- 767 native commands have a handler CLSID found in exactly one binary (that DLL implements it). For the rest the CLSID bytes also occur in client DLLs; `data/command_registry.json` lists all of them in `handler_dlls`, a `*task*` DLL first *(inferred ordering)*. Six commands carry a CLSID that is not specific (null-like, present in 262 binaries); `CopyStyle` and `DisposeRenderingCache` have a CLSID found in no staged binary.
- Commands of self-installing plug-ins (FBX, Alembic, Syflex, Face Robot, …) are **not** in this file; they register at plug-in load. 279 of the 915 names still missing in AfterImage are of that kind.

## Wire contract

1. A command registry entry has: GUID, scripting name, display name, description, tooltip, categories (split on `|`), compatibility keywords, ordered arguments (name, type, default, flags), and either a script binding (engine, file, procedure) or a native handler.
2. `data/command_registry.json` is the authoritative list for the 2397 factory commands: use its argument order and defaults in place of the earlier dump where they differ (the earlier dump lacks script procedures and hidden arguments).
3. Duplicated scripting names are distinct records (different GUIDs, usually different argument lists or UI variants); keep every record.

## Open questions

1. Meaning of the flag bits (command 0x64, argument 0x04) and of the sparse words at 0x4c–0x6c.
2. Section 3 second GUID (probably object-type or menu association).
3. Exact implementing DLL of the 371 native commands whose CLSID occurs in more than one binary: settle by opening the first candidate and checking `DllGetClassObject`.
4. The other `*.DSCommandMap` files (53, per view / tool) use the same magic *(inferred, not parsed)*; they hold view-local commands and key bindings.
