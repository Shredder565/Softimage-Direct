// Softimage operator/property definitions, extracted from the real application
// (Application/spdl/*.spdl + a runtime dump of every Model-menu command). See tools/build_opdefs.py.
import raw from '../data/opdefs.json';
import type { ParamDef } from './params';
import genopChrome from '../data/si/genop_inputs_buttons.json';

export interface LayoutNode {
  group?: string; row?: string; tab?: string; items?: LayoutNode[]; param?: string; opts?: string[];
  /** Softimage SPDL Button id (GenOpInputsButtonsDisplay) — text-only chrome, has_layout:false. */
  button?: string; label?: string; command?: string;
}
interface SiParam { sn: string; label: string; type: string; default: any; min?: number; max?: number; uimin?: number; uimax?: number; items?: [string, any][]; anim?: boolean; ro?: boolean; desc?: string }
interface SiDef { type: string; name: string; spdl?: string | null; params: SiParam[]; layout?: LayoutNode[]; source?: string }
const data = raw as unknown as { ops: Record<string, SiDef>; prims: Record<string, SiDef>; byMenu: Record<string, { type: string; values: Record<string, any> }>; primStats: Record<string, any> };

import propsets from '../data/si/propsets.json';
type SiProp = { sn: string; label: string; type: string; default: any; items?: [string, any][]; min?: number; max?: number; uimin?: number; uimax?: number; desc?: string };
export const SI_PROPSETS = propsets as unknown as Record<string, { label: string; params: SiProp[]; layout: any[] }>;
const SETS = SI_PROPSETS;
const GENOP_INLINE = new Set((genopChrome as { inline_opdefs: string[] }).inline_opdefs);

/** ParamDefs for a Softimage property set from its SPDL (C3DKineState, C3DVisibilityAndDisplay, C3DPrefsDisplay…). */
export function siPropDefs(key: string, overrides: Record<string, any> = {}): ParamDef[] {
  const s = SETS[key]; if (!s) return [];
  return s.params.map(p => { const d: ParamDef = { name: p.sn, label: p.label, type: p.type as any, value: p.sn in overrides ? overrides[p.sn] : p.default, animatable: false }; if (p.items) d.items = p.items.map(([label, value]) => ({ label, value })); if (p.min !== undefined) d.min = p.min; if (p.max !== undefined) d.max = p.max; if (p.uimin !== undefined) d.uimin = p.uimin; if (p.uimax !== undefined) d.uimax = p.uimax; if (p.desc) d.desc = p.desc; return d; });
}
export function siPropLayout(key: string): any[] | undefined { return SETS[key]?.layout?.length ? SETS[key].layout : undefined; }
export function siPropLabel(key: string) { return SETS[key]?.label ?? key; }

export function siDef(key: string): SiDef | undefined { return data.ops[key] ?? data.prims[key]; }
export function siName(key: string, fallback: string) { return siDef(key)?.name ?? fallback; }

/** Attested GenOpInputsButtonsDisplay groups (Hide/Unhide + Delete), pruned to params the op actually has. */
export function genopInputsChrome(sns: Iterable<string>): LayoutNode[] {
  const have = new Set([...sns].map(s => s.toLowerCase()));
  const out: LayoutNode[] = [];
  for (const g of (genopChrome as { groups: LayoutNode[] }).groups) {
    const items: LayoutNode[] = [];
    for (const it of g.items ?? []) {
      if (it.button) items.push({ button: it.button, label: it.label, opts: it.opts, command: it.command });
      else if (it.param && have.has(String(it.param).toLowerCase())) items.push({ param: it.param, opts: it.opts });
    }
    if (items.length) out.push({ group: g.group, opts: g.opts, items });
  }
  return out;
}

function layoutHasGenopChrome(lay?: LayoutNode[]): boolean {
  return !!lay?.some(n => n.group === 'Inputs' && (n.items ?? []).some(i => i.button === 'HideInputs'));
}

/** SPDL layout, with GenOp Hide/Delete button chrome prepended for Softimage inline consumers. */
export function siLayout(key: string): LayoutNode[] | undefined {
  const d = siDef(key); const base = d?.layout;
  if (!GENOP_INLINE.has(key)) return base;
  if (layoutHasGenopChrome(base)) return base;
  const chrome = genopInputsChrome((d?.params ?? []).map(p => p.sn));
  if (!chrome.length) return base;
  return [...chrome, ...(base ?? [])];
}
export const primStats = data.primStats;
export function menuDefaults(label: string) { return data.byMenu[label]; }
export const GENOP_HAS_LAYOUT = !!(genopChrome as { has_layout?: boolean }).has_layout;

/**
 * C3DGenerator.spdl `inputreadregion` (Construction Mode). Committed opdefs already carry it for the
 * parametric generators; these types include C3DGenerator.spdl and the opdef omitted the combo.
 */
const GENERATOR_BASE_TYPES = new Set(['mergemesh', 'blendcrv', 'mergecrv', 'crvnet']);
const CONSTRUCTION_MODE: ParamDef['items'] = [
  { label: 'Modeling', value: 0 },
  { label: 'Shape Modeling', value: 1 },
  { label: 'Animation', value: 2 },
  { label: 'Secondary Shape (Result)', value: 3 },
];

function constructionMode(): ParamDef {
  return { name: 'inputreadregion', label: 'Construction Mode', type: 'enum', value: 0, items: CONSTRUCTION_MODE, animatable: false };
}

/** curvenetop.spdl + C3DParametricSurfaceGenerator.spdl. No opdef row was committed for `crvnet`. */
function curveNetContract(): ParamDef[] {
  return [
    { name: 'tol', label: 'Tolerance', type: 'double', value: 0.1, animatable: true },
    { name: 'featurematch', label: 'Feature Match', type: 'bool', value: true, animatable: false },
    { name: 'subdivu', label: 'U abs', type: 'int', value: 8, min: 1, max: 1000, animatable: true },
    { name: 'subdivv', label: 'V abs', type: 'int', value: 8, min: 1, max: 1000, animatable: true },
    { name: 'subdivuperspan', label: 'U span', type: 'int', value: 8, min: 1, max: 100, animatable: true },
    { name: 'subdivvperspan', label: 'V span', type: 'int', value: 8, min: 1, max: 100, animatable: true },
    { name: 'subdivtype', label: 'Subdivision Type', type: 'enum', value: 0, items: [{ label: 'Per Span', value: 0 }, { label: 'Absolute', value: 1 }], animatable: false },
    { name: 'ignoresub', label: 'Ignore Subdivision OBSOLETE. Use subdivtype field', type: 'bool', value: false, animatable: false },
    constructionMode(),
  ];
}

function withGeneratorBase(key: string, out: ParamDef[]): ParamDef[] {
  if (key === 'crvnet' && !out.length) out.push(...curveNetContract());
  if (GENERATOR_BASE_TYPES.has(key) && !out.some(d => d.name === 'inputreadregion')) out.push(constructionMode());
  return out;
}

/** Softimage-side parameter definitions as our ParamDefs. Parameters bound to fcurve profiles are skipped. */
export function siParamDefs(key: string, overrides: Record<string, any> = {}, extra: Partial<ParamDef> = {}): ParamDef[] {
  const d = siDef(key); if (!d) return withGeneratorBase(key, []);
  const out: ParamDef[] = [];
  for (const p of d.params) {
    if (p.default === 'FCurve' || p.sn === 'Name') continue;
    if (p.type === 'vector') continue;
    let type: ParamDef['type'] = p.type as any;
    let value = p.sn in overrides ? overrides[p.sn] : p.default;
    if (type === 'enum') value = Number.isFinite(Number(value)) ? Number(value) : value;
    if (type === 'color' && Array.isArray(value)) value = value.slice(0, 3);
    if (value === null || value === undefined) value = type === 'double' || type === 'int' || type === 'enum' ? 0 : type === 'bool' ? false : type === 'string' ? '' : value;
    // Softimage dump paths are host-local; keep basename / empty for portable defaults.
    if (typeof value === 'string' && /^[A-Za-z]:[\\/]/.test(value)) value = value.replace(/^.*[\\/]/, '') || '';
    const def: ParamDef = { name: p.sn, label: p.label, type, value, animatable: p.anim ?? (type === 'double' || type === 'int'), readOnly: p.ro, ...extra };
    if (p.min !== undefined) def.min = p.min; if (p.max !== undefined) def.max = p.max;
    if (p.uimin !== undefined) def.uimin = p.uimin; if (p.uimax !== undefined) def.uimax = p.uimax;
    if (p.items) def.items = p.items.map(([label, v]) => ({ label, value: v }));
    if (p.desc) def.desc = p.desc;
    out.push(def);
  }
  return withGeneratorBase(key, out);
}

/** Merge Softimage opdef params with local overrides (by script name). Softimage values win unless overridden. */
export function withOp(key: string, ours: ParamDef[] = []): ParamDef[] {
  const si = siParamDefs(key); const mine = new Map(ours.map(d => [d.name, d]));
  const out = si.map(d => mine.get(d.name) ? { ...d, ...mine.get(d.name)!, value: mine.get(d.name)!.value !== undefined ? mine.get(d.name)!.value : d.value } : d);
  for (const d of ours) if (!si.some(x => x.name === d.name)) out.push(d);
  return out;
}

/** Group assignment derived from the SPDL layout (for the fallback grouped PPG rendering). */
export function siGroups(key: string): Record<string, string> {
  const lay = siLayout(key); const map: Record<string, string> = {}; if (!lay) return map;
  const walk = (nodes: LayoutNode[], g: string) => { for (const n of nodes) { if (n.param) map[n.param.toLowerCase()] = g; else if (n.items) walk(n.items, n.group ?? n.tab ?? g); } };
  walk(lay, 'General'); return map;
}
