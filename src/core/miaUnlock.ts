// Softimage Mental Ray material unlock — absolute .Preset + SIApplyShader nested OM only
// (unlock_render_mia_probe.json + closer95 Car_Paint SIApplyShader). Short-name FAIL under
// Softimage headless does not block Softimage menu aliases / absolute .Preset unlock.
import mia from '../data/si/render_mia_unlock.json';
import { num, int, bool, str, color, type ParamDef } from './params';

export type MiaUnlockPack = typeof mia;
export const MIA_UNLOCK = mia as MiaUnlockPack;

export const UNLOCK_OK_MR_SHADERS = MIA_UNLOCK.unlocked_shaders as readonly string[];

/** Softimage Get > Material Name aliases → dump-proven shader ScriptName. */
export const MIA_SOFTIMAGE_ALIASES = MIA_UNLOCK.softimage_aliases as Record<string, string>;

/** Unproven / short-name FAIL — do not invent OM (never blocks dump-proven shader keys). */
export const MIA_STILL_LOCK = new Set(
  (MIA_UNLOCK.still_lock_short_or_unproven as string[]).map(s => s.toLowerCase()),
);

/** Strip Softimage PresetObj path / DSPRESETS / Materials\\ prefix to a basename. */
export function normalizePresetToken(preset: string): string {
  let p = String(preset ?? '').trim();
  if (!p) return '';
  p = p.replace(/\//g, '\\');
  p = p.replace(/^\$XSI_DSPRESETS\\?/i, '');
  // Basename of absolute / relative Softimage preset paths
  const parts = p.split('\\').filter(Boolean);
  let base = parts[parts.length - 1] || p;
  base = base.replace(/\.Preset$/i, '');
  return base;
}

/** Resolve PresetObj to a dump-proven mia_* / Metallic / Car_Paint shader key, or null if LOCK invent. */
export function resolveMiaUnlockKey(preset: string): string | null {
  const token = normalizePresetToken(preset);
  if (!token) return null;
  const aliasKey =
    MIA_SOFTIMAGE_ALIASES[token] != null
      ? token
      : Object.keys(MIA_SOFTIMAGE_ALIASES).find(k => k.toLowerCase() === token.toLowerCase());
  const aliased = (aliasKey ? MIA_SOFTIMAGE_ALIASES[aliasKey] : null) ?? token;
  const presets = MIA_UNLOCK.presets as Record<string, unknown>;
  if (presets[aliased]) return aliased;
  const hit = Object.keys(presets).find(k => k.toLowerCase() === aliased.toLowerCase());
  if (hit) return hit;
  // Only after unlock miss — residual short-name FAIL / unproven.
  if (MIA_STILL_LOCK.has(token.toLowerCase())) return null;
  return null;
}

export function isMiaUnlockPreset(preset: string): boolean {
  return resolveMiaUnlockKey(preset) != null;
}

/** ParamDefs from attested nested OM (Parameter.Name = sn). Null ports → empty read-only string slots. */
export function miaUnlockDefs(shaderKey: string): ParamDef[] | null {
  const pack = (MIA_UNLOCK.presets as Record<string, { defs: { sn: string; type: string; value: any; label?: string; value_rgba?: number[] }[] }>)[shaderKey];
  if (!pack?.defs?.length) return null;
  const out: ParamDef[] = [];
  for (const d of pack.defs) {
    const lab = d.label ?? d.sn;
    if (d.type === 'null') {
      out.push(str(d.sn, '', lab, { readOnly: true }));
      continue;
    }
    if (d.type === 'bool') {
      out.push(bool(d.sn, !!d.value, lab));
      continue;
    }
    if (d.type === 'int') {
      out.push(int(d.sn, Number(d.value) || 0, lab));
      continue;
    }
    if (d.type === 'double') {
      out.push(num(d.sn, Number(d.value) || 0, lab));
      continue;
    }
    if (d.type === 'color') {
      const src = Array.isArray(d.value) ? d.value : [0, 0, 0];
      const rgb: [number, number, number] = [Number(src[0]) || 0, Number(src[1]) || 0, Number(src[2]) || 0];
      out.push(color(d.sn, rgb, lab));
      continue;
    }
    out.push(str(d.sn, d.value == null ? '' : String(d.value), lab, { readOnly: d.sn === 'name' }));
  }
  return out;
}

export function miaUnlockParamCount(shaderKey: string): number {
  const pack = (MIA_UNLOCK.presets as Record<string, { param_count?: number }>)[shaderKey];
  return Number(pack?.param_count ?? 0);
}

export function miaUnlockAbsolutePreset(shaderKey: string): string | null {
  const pack = (MIA_UNLOCK.presets as Record<string, { absolute_preset?: string }>)[shaderKey];
  return pack?.absolute_preset ?? null;
}
