// Softimage operator/property definitions, extracted from the real application
// (Application/spdl/*.spdl + a runtime dump of every Model-menu command). See tools/build_opdefs.py.
import raw from '../data/opdefs.json';
import type { ParamDef } from './params';

export interface LayoutNode { group?: string; row?: string; tab?: string; items?: LayoutNode[]; param?: string; opts?: string[] }
interface SiParam { sn: string; label: string; type: string; default: any; min?: number; max?: number; uimin?: number; uimax?: number; items?: [string, any][]; anim?: boolean; ro?: boolean; desc?: string }
interface SiDef { type: string; name: string; spdl?: string | null; params: SiParam[]; layout?: LayoutNode[]; source?: string }
const data = raw as unknown as { ops: Record<string, SiDef>; prims: Record<string, SiDef>; byMenu: Record<string, { type: string; values: Record<string, any> }>; primStats: Record<string, any> };

export function siDef(key: string): SiDef | undefined { return data.ops[key] ?? data.prims[key]; }
export function siName(key: string, fallback: string) { return siDef(key)?.name ?? fallback; }
export function siLayout(key: string): LayoutNode[] | undefined { return siDef(key)?.layout; }
export const primStats = data.primStats;
export function menuDefaults(label: string) { return data.byMenu[label]; }

/** Softimage-side parameter definitions as our ParamDefs. Parameters bound to fcurve profiles are skipped. */
export function siParamDefs(key: string, overrides: Record<string, any> = {}, extra: Partial<ParamDef> = {}): ParamDef[] {
  const d = siDef(key); if (!d) return [];
  const out: ParamDef[] = [];
  for (const p of d.params) {
    if (p.default === 'FCurve' || p.sn === 'Name') continue;
    if (p.type === 'vector') continue;
    let type: ParamDef['type'] = p.type as any;
    let value = p.sn in overrides ? overrides[p.sn] : p.default;
    if (type === 'enum') value = Number.isFinite(Number(value)) ? Number(value) : value;
    if (type === 'color' && Array.isArray(value)) value = value.slice(0, 3);
    if (value === null || value === undefined) value = type === 'double' || type === 'int' ? 0 : type === 'bool' ? false : type === 'string' ? '' : value;
    const def: ParamDef = { name: p.sn, label: p.label, type, value, animatable: p.anim ?? (type === 'double' || type === 'int'), readOnly: p.ro, ...extra };
    if (p.min !== undefined) def.min = p.min; if (p.max !== undefined) def.max = p.max;
    if (p.uimin !== undefined) def.uimin = p.uimin; if (p.uimax !== undefined) def.uimax = p.uimax;
    if (p.items) def.items = p.items.map(([label, v]) => ({ label, value: v }));
    if (p.desc) def.desc = p.desc;
    out.push(def);
  }
  return out;
}

/** Group assignment derived from the SPDL layout (for the fallback grouped PPG rendering). */
export function siGroups(key: string): Record<string, string> {
  const lay = siLayout(key); const map: Record<string, string> = {}; if (!lay) return map;
  const walk = (nodes: LayoutNode[], g: string) => { for (const n of nodes) { if (n.param) map[n.param.toLowerCase()] = g; else if (n.items) walk(n.items, n.group ?? n.tab ?? g); } };
  walk(lay, 'General'); return map;
}
