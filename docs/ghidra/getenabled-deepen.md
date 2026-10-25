# GetEnabled deepen — CanBeModified gate

**Date:** 2026-10-24  
**Prior:** [getenabled-callpath.md](./getenabled-callpath.md)  
**Decomps:** softimage-pc `internal/ghidra/decomp/sicoresdk.dll__enable__*`

## Flag model (unchanged)

`GetEnabled` → `!(flags & 1)` on inner object from vtable `this+0x198`, getter `+0x28`.  
`PutEnabled(bool)` → `CanBeModified` then setter `+0x30` (`flags & ~1` / `flags | 1`).

## `CXSICommandCore::CanBeModified` (`18006f710`) — pin

```
if (*(this+0x80) != 0) return true;          // override / unlocked marker
resolve via (this+0x78)->vt+0x198
if null → false
call (this+0x78)->vt+0x130 → out char
return out == 0;
```

`PutEnabled` calls `CanBeModified`; fail → access-denied HRESULT.

**Callers of CanBeModified (same DLL):** `PutArguments`, `PutCode`, `PutDescription`, **`PutEnabled`**, `PutFileName`, `PutHandler`, `PutLanguage`, `PutName`, `PutScriptingName`, `PutTooltip`.

## mcp.dll deepen

- Still **no** import of `GetEnabled` / `PutEnabled` / `CXSICommandCore`.
- `OnUpdateUI` → EXTERNAL `sitaskcore!C3DCoreBaseTask::OnUpdateUI`.
- Greying: task OnUpdateUI → UITk/`EnableMenuItem`/`EnableWindow` + Command.Enabled via COM.

## Direct wire (portable, no HWND)

| Item | Class |
|------|-------|
| Command.Enabled bit / canRun | DONE (#51) — matches `!(flags&1)` model |
| `CommandDef.canBeModified` + `putCommandEnabled` / `PutEnabled` cmd | **WIRE** — gates Enabled override; default modifiable |
| Live MCP HWND Enabled matrix | **LOCK** — needs Script Editor paste / interactive contexts |

**Do not invent** Softimage Enabled bits for null matrix cells.
