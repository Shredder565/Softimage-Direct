// Softimage Simulate cloth PPG — dump-backed C3DClothProp / C3DClothOp (SPDL layouts).
// No invent Syflex client GDI. FROST cloth (src/frost/) stays parallel.
import { App } from '../core/commands';
import { Operator, Property, X3DObject } from '../core/scene';
import type { ParamDef } from '../core/params';
import clothChrome from '../data/si/cloth_ppg_chrome.json';

type ClothParam = {
  sn: string;
  label: string;
  type: string;
  default: unknown;
  min?: number;
  max?: number;
  uimin?: number;
  uimax?: number;
  desc?: string;
};

type ClothPropset = {
  label: string;
  params: ClothParam[];
  layout: unknown[];
  layout_groups?: (string | null)[];
  param_sns?: string[];
  n_params?: number;
};

const CHROME = clothChrome as typeof clothChrome & {
  propsets: Record<string, ClothPropset>;
  syflex_client_gdi?: { status: string };
  property_editor_shell?: { defaultsize: number[] };
};

function toDefs(params: ClothParam[]): ParamDef[] {
  return params.map(p => {
    const type = p.type as ParamDef['type'];
    let value = p.default;
    if (value === null || value === undefined) {
      value = type === 'double' || type === 'int' ? 0 : type === 'bool' ? false : '';
    }
    const def: ParamDef = {
      name: p.sn,
      label: p.label,
      type,
      value,
      animatable: type === 'double' || type === 'int',
    };
    if (p.min !== undefined) def.min = p.min;
    if (p.max !== undefined) def.max = p.max;
    if (p.uimin !== undefined) def.uimin = p.uimin;
    if (p.uimax !== undefined) def.uimax = p.uimax;
    if (p.desc) def.desc = p.desc;
    return def;
  });
}

/** Softimage C3DClothProp property (ApplyCloth / SyCreateCloth → ApplyCloth). */
export function makeClothProperty(name = 'Cloth'): Property {
  const set = CHROME.propsets.C3DClothProp;
  const p = new Property(name, 'cloth', toDefs(set.params));
  p.layout = set.layout as any;
  return p;
}

/** Softimage C3DClothOp operator chrome on the construction stack (pass-through geom; no invent solver). */
export function makeClothOperator(): Operator {
  const set = CHROME.propsets.C3DClothOp;
  const op = new Operator(set.label || 'ClothOp', 'clothop', toDefs(set.params));
  op.layout = set.layout as any;
  return op;
}

/** Apply Softimage Cloth property + ClothOp stack chrome to selected objects (dump-attested PPG only). */
export function applyClothToObjects(app: App, objs: X3DObject[]): Property | null {
  if (!objs.length) throw new Error('Select one or more objects');
  const out: Property[] = [];
  for (const o of objs) {
    let prop = o.properties.find(x => x.type === 'cloth');
    if (!prop) {
      prop = makeClothProperty('Cloth');
      const clothProp = prop;
      app.record('Apply Cloth', () => o.addProperty(clothProp), () => o.removeProperty(clothProp));
    }
    const prim = o.primitive;
    if (prim && !prim.operators.some(op => op.type === 'clothop')) {
      const op = makeClothOperator();
      app.record('Add ClothOp', () => prim.addOperator(op), () => prim.removeOperator(op));
    }
    out.push(prop);
  }
  if (out.length) app.select(out);
  return out[0] ?? null;
}

export function clothPpgAudit(): Record<string, unknown> {
  const prop = CHROME.propsets.C3DClothProp;
  const op = CHROME.propsets.C3DClothOp;
  const pe = CHROME.property_editor_shell;
  return {
    status: 'SPDL',
    softimage: (CHROME as any).softimage,
    propsets: Object.keys(CHROME.propsets),
    clothPropTabs: (prop.layout as { tab?: string }[]).map(t => t.tab).filter(Boolean),
    clothOpTabs: (op.layout as { tab?: string }[]).map(t => t.tab).filter(Boolean),
    clothPropParamCount: prop.params.length,
    clothOpParamCount: op.params.length,
    clothPropParamSns: prop.params.map(p => p.sn),
    clothOpParamSns: op.params.map(p => p.sn),
    layoutGroupsProp: prop.layout_groups ?? ['General', 'Presets'],
    layoutGroupsOp: op.layout_groups ?? ['Simulation', 'Collisions', 'Stitching', 'Forces'],
    propertyEditorDefaultsize: pe?.defaultsize ?? [50, 50, 125, 265],
    syflexClientGdi: CHROME.syflex_client_gdi?.status ?? 'LOCK',
    frostUntouched: true,
  };
}

export const CLOTH_PPG_CHROME = CHROME;
