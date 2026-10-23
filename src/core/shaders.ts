// Shader nodes built from Softimage's own phenolib SPDL definitions (data/si/shaders → src/data/si/shaders.json):
// material-phong / lambert / blinn / cooktorr / constant / strauss / ward, soft_light, image / procedural textures,
// mixers… Each node carries its SPDL parameters (labels, defaults, UI ranges, enum items) and its "Default" PPG
// layout, and texturable inputs can be connected to other shader nodes (the Render Tree).
import shaders from '../data/si/shaders.json';
import type { ParamDef } from './params';

export type SiShaderParam = { sn: string; label?: string; type?: string; value?: any; items?: [string, any][]; uirange?: [number, number]; range?: [number, number]; inspectable?: boolean; texturable?: boolean; dir: 'input' | 'output' };
export type SiShaderDef = { file: string; propset: string; title: string; output: string | null; params: SiShaderParam[]; layout?: any[]; rtlayout?: any[] };
export const SI_SHADERS = shaders as unknown as Record<string, SiShaderDef>;

/** Material presets as the Get > Material menu names them → SPDL key. */
export const MATERIAL_PRESETS: Record<string, string> = { Phong: 'material-phong', Lambert: 'material-lambert', Blinn: 'material-blinn', 'Cook-Torrance': 'material-cooktorr', Constant: 'material-constant', Strauss: 'material-strauss', Anisotropic: 'material-ward', Ward: 'material-ward' };
/** Texture / utility nodes offered by the Render Tree "Nodes" menu. */
export const TEXTURE_NODES: Record<string, string> = { 'Image': 'txt2d-image-explicit', 'Checkerboard': 'txt3d-checkerboard', 'Grid': 'txt2d-grid', 'Fractal': 'txt3d-fractal_v3', 'Marble': 'txt3d-marble', 'Wood': 'txt3d-wood', 'Cloud': 'txt3d-cloud', 'Gradient': 'txt2d-gradient_v2', 'Mix 2 Colors': 'sib_color_2mix', 'Color Math Basic': 'sib_color_math_basic', 'Scalar Math Basic': 'sib_scalar_math_basic', 'Invert': 'sib_color_invert', 'Bump Map Generator': 'sib_bumpmap_gen', 'Incidence': 'sib_incidence_v3', 'Environment': 'sib_environment', 'Vertex Color': 'sib_vertex_color_alpha', 'Gradient (color)': 'sib_color_gradient', 'HLS Adjust': 'sib_color_hls_adjust', 'Scalar to Color': 'sib_scalar_to_color', 'Texture Space Generator': 'sib_uvwgen' };

function defOf(p: SiShaderParam): ParamDef | null {
  const t = p.type ?? ''; const v = p.value;
  const base = { name: p.sn, label: p.label ?? p.sn, animatable: true, uimin: p.uirange?.[0], uimax: p.uirange?.[1], min: p.range?.[0], max: p.range?.[1] } as Partial<ParamDef>;
  if (t === 'color') return { ...base, type: 'color', value: Array.isArray(v) ? v.slice(0, 3) : [0.5, 0.5, 0.5] } as ParamDef;
  if (t === 'scalar') return { ...base, type: 'double', value: typeof v === 'number' ? v : 0, uimin: p.uirange?.[0] ?? 0, uimax: p.uirange?.[1] ?? (typeof v === 'number' && v > 1 ? 100 : 1) } as ParamDef;
  if (t === 'integer') { if (p.items?.length) return { ...base, type: 'enum', value: typeof v === 'number' ? v : p.items[0][1], items: p.items.map(([label, value]) => ({ label, value })) } as ParamDef; return { ...base, type: 'int', value: typeof v === 'number' ? v : 0, uimin: p.uirange?.[0] ?? 0, uimax: p.uirange?.[1] ?? 10 } as ParamDef; }
  if (t === 'boolean') return { ...base, type: 'bool', value: v === 'on' || v === true, animatable: false } as ParamDef;
  if (t === 'string' || t === 'image' || t === 'texture' || t === 'texturespace') return { ...base, type: 'string', value: typeof v === 'string' ? v : '', animatable: false } as ParamDef;
  if (t === 'vector') return { ...base, type: 'string', value: Array.isArray(v) ? v.join(' ') : '1 1 1', animatable: false } as ParamDef;
  return null;
}

export function toLayout(nodes: any[]): any[] { return nodes.map(n => n.param !== undefined ? { param: n.param === 'Name' ? '__name' : n.param, opts: n.opts } : n.row !== undefined ? { row: true, items: toLayout(n.items ?? []) } : { group: n.group ?? n.tab ?? '', tab: n.tab, items: toLayout(n.items ?? []) }); }

/** Parameter definitions + layout for an SPDL key (material-phong…) or a Get > Material preset name (Phong…). */
export function siShaderDefs(key: string): { defs: ParamDef[]; spdl: SiShaderDef; type: string; title: string; layout?: any[] } | null {
  const k = MATERIAL_PRESETS[key] ?? TEXTURE_NODES[key] ?? key; const d = SI_SHADERS[k]; if (!d) return null;
  const defs: ParamDef[] = [];
  for (const p of d.params) { if (p.dir !== 'input' || p.inspectable === false) continue; const def = defOf(p); if (def) defs.push(def); }
  const type = Object.entries(MATERIAL_PRESETS).find(([, v]) => v === k)?.[0] ?? d.title;
  return { defs, spdl: d, type, title: d.title, layout: d.layout ? toLayout(d.layout) : undefined };
}
export function shaderKeys(): { key: string; title: string; output: string | null }[] { return Object.entries(SI_SHADERS).map(([key, d]) => ({ key, title: d.title, output: d.output })); }
