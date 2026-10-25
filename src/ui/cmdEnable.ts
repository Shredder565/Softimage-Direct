// Softimage-faithful command enable helpers (clean-room).
//
// Ghidra (sicoresdk): CXSIMenuItemCore::GetEnabled → linked CXSICommandCore::GetEnabled
// which returns !(innerFlags & 1). PutEnabled sets that bit (CanBeModified gated).
// mcp.dll greys via UITk/USER32 EnableMenuItem/EnableWindow, not a direct GetEnabled import —
// chrome still tracks the same command enable bit.
//
// Direct maps that bit onto CommandDef.canRun (dynamic) and optional .supported (static
// "in this build"). PutEnabled → putCommandEnabled (CanBeModified gate). No Softimage binary copied.

import type { App } from '../core/commands';
import { matrixCommandEnabled } from './mcpEnableMatrix';

/** Softimage CanBeModified analogue — definition mutators / PutEnabled require true (default). */
export function commandCanBeModified(app: App, name: string): boolean {
  const def = app.commands.get(name);
  if (!def) return false;
  return def.canBeModified !== false;
}

/**
 * Softimage PutEnabled analogue. Fails when CanBeModified is false (sicoresdk access denied).
 * Stores Enabled bit on CommandDef.enabledOverride; does not invent HWND greying.
 */
export function putCommandEnabled(app: App, name: string, enabled: boolean): boolean {
  const def = app.commands.get(name);
  if (!def) return false;
  if (def.canBeModified === false) return false;
  def.enabledOverride = !!enabled;
  return true;
}

/** Static availability: command exists and preset/build supports it (menu "wired"). */
export function commandSupported(app: App, name: string, args: Record<string, any> = {}): boolean {
  const def = app.commands.get(name);
  if (!def) return false;
  if (def.supported) return !!def.supported(args);
  // Legacy: canRun alone meant "in this build" (preset known). Keep that for walks.
  return !def.canRun || !!def.canRun(args);
}

/**
 * Softimage GetEnabled analogue: supported and canRun (if any) both pass.
 * When `supported` is set, `canRun` is the dynamic enable flag (selection / context).
 * Softimage-pc matrix (XSIBATCH Command.Enabled) overrides when the dump has a bool;
 * null dump cells keep the Ghidra/canRun model from #18.
 * PutEnabled override (enabledOverride) applies after matrix when set.
 */
export function commandEnabled(app: App, name: string, args: Record<string, any> = {}): boolean {
  const def = app.commands.get(name);
  if (!def) return false;
  if (def.supported && !def.supported(args)) return false;
  const attested = matrixCommandEnabled(app, name);
  if (attested !== null) return attested;
  if (def.enabledOverride != null) return !!def.enabledOverride;
  return !def.canRun || !!def.canRun(args);
}

/** MCP Sample filter / ICE point-cloud selection mode — not a CommandCore leaf. */
export function mcpSampleEnabled(app: App): boolean {
  const sel = app.selectedObjects;
  if (sel.some(o => o.type === 'pointcloud' || o.type === 'particlecloud')) return true;
  const f = String((app as any).selFilter ?? '').toLowerCase();
  if (['sample', 'samplepoint', 'sampledpoint', 'particlepoint'].includes(f)) return true;
  return false;
}
