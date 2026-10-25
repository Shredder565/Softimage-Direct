# SR-28 — GetEnabled call-path sketch (headless)

## Softimage API (sicoresdk.dll)

### `CXSICommandCore::GetEnabled` (`1800708c0`)

1. Null-check out-bool → `CSIErrorHandling::Raise` on fail.
2. Resolve inner object via vtable `this+0x198`.
3. Call inner `+0x28` → read flags dword.
4. `*out = !(flags & 1)` — **bit0 cleared means enabled**.

### `CXSICommandCore::PutEnabled` (`180071a40`)

1. Resolve same inner object (`+0x198`).
2. `CanBeModified(this-0x78)`; else access denied.
3. Write via `inner+0x30`: enable → `flags & ~1`; disable → `flags | 1`.

### `CXSIMenuItemCore::GetEnabled` (`18012ac10`)

Validates menu item then delegates to linked command `GetEnabled`.

## mcp.dll

- **No** direct import of `GetEnabled` from sicoresdk.
- Greys via `CSIUITkMenu::EnableMenuItem` / `USER32!EnableWindow` + COM command objects.

## Direct mapping

- `CommandDef.canRun` = dynamic enable flag (GetEnabled analogue).
- Optional `supported` = static wire presence.
- MCP matrix overlay: XSIBATCH `Command.Enabled` bools; null → canRun (`mcpEnableMatrix.ts`).
- Live HWND Enabled: **LOCK** until Script Editor paste JSON (no Desktop takeover).

## Residual chrome math

Animate GetEnabled expand shipped (#51). Remaining approximate greys are only where dump cell is null — do not invent Softimage Enabled bits.
