// CMD-B15f part 3: UpgradeShaders (UpgradeShaders.vbs, note section 3.12) and WIRE_CORRECTIONS_B15 item 38
// (a colour-to-scalar port transfer always fails as shipped).
// Stand-in: this build's SPDL data has neither the 16 obsolete `sib_*` shaders nor the replacement presets
// (Mix_8colors, Scalar_Math_Logic, ...). Shader nodes are recognised by their `type` (the shader's scripting name)
// or the first eight hex digits of a `clsid` field; a replacement is built here as a plain Shader of the preset's
// name whose parameters are created on demand by the port transfer (types: the source parameter's, except where the
// note names a conversion). Branches the note does not specify log "not yet attested".
import { App } from '../core/commands';
import { Shader, Material, Node } from '../core/scene';
import { containerShaders, allMaterials, layersOf, nestShader } from '../core/textureLayers';
import { ParamDef } from '../core/params';
import { regB15f, warn, nya } from './miscScriptsB15fShared';

type K = 'mix8' | 'mixcolor' | 'mixscalar' | 'colorXcolor' | 'addclip' | 'hair' | undefined;
interface Fam { type: string; prefix: string; preset: string; ports: [string, string, string?][]; consts?: Record<string, any>; kind?: K }
const P = (s: string): [string, string][] => s.split(' ').map(x => { const [a, b] = x.split('>'); return [a, b ?? a]; });
const FAMILIES: Fam[] = [
  { type: 'sib_color_mix8', prefix: '7C4301B1', preset: 'Mixers\\Mix_8colors', ports: [['base_color', 'base_color'], ...[1, 2, 3, 4, 5, 6, 7].flatMap(i => (['mode', 'color', 'weight', 'alpha'] as const).map(n => [`${n}${i}`, `${n}${i}`] as [string, string]))], kind: 'mix8' },
  { type: 'sib_color_mix_color', prefix: '86C2DE3E', preset: 'Mixers\\Mix_2colors', ports: P('color1>base_color color2>color1'), consts: { alpha1: false, mode1: 1 }, kind: 'mixcolor' },
  { type: 'sib_scalar_mix_color', prefix: '86EB6638', preset: 'Mixers\\Mix_2colors', ports: P('color1>base_color color2>color1'), consts: { alpha1: false, mode1: 1 }, kind: 'mixscalar' },
  { type: 'sib_color_invert', prefix: '87AEE70C', preset: 'Image_Processing\\Invert', ports: P('input alpha') },
  { type: 'sib_scalar_invert', prefix: '875B74BE', preset: 'Math\\Scalar_Invert', ports: P('input') },
  { type: 'sib_color_bias', prefix: '876C2534', preset: 'Math\\Color_Math_Exponent', ports: P('input bias>factor alpha'), consts: { op: 2 } },
  { type: 'sib_scalar_bias', prefix: '8725CFD5', preset: 'Math\\Scalar_Math_Exponent', ports: P('input bias>factor'), consts: { op: 2 } },
  { type: 'sib_color_gain', prefix: '878EB74D', preset: 'Math\\Color_Math_Exponent', ports: P('input gain>factor alpha'), consts: { op: 3 } },
  { type: 'sib_scalar_gain', prefix: '87426C0D', preset: 'Math\\Scalar_Math_Exponent', ports: P('input gain>factor'), consts: { op: 3 } },
  { type: 'sib_color_X_color', prefix: '8645B2C9', preset: 'Math\\Color_Math_Basic', ports: [], consts: { op: 2 }, kind: 'colorXcolor' },
  { type: 'sib_color_X_scalar', prefix: '862451DD', preset: 'Math\\Color_Math_Basic', ports: P('color>input1 scalar>input2 alpha'), consts: { op: 2 } },
  { type: 'sib_color_to_boolean', prefix: '22C05651', preset: 'Math\\Color_Math_Logic', ports: P('input>input1 threshold>input2 alpha'), consts: { op: 2 } },
  { type: 'sib_scalar_to_boolean', prefix: '22C05658', preset: 'Math\\Scalar_Math_Logic', ports: P('input>input1 threshold>input2'), consts: { op: 2 } },
  { type: 'sib_color_switch_opp', prefix: '85E2C132', preset: 'Switch\\Boolean_switch', ports: P('input1>input2 input2>input1 switch') },
  { type: 'sib_color_add_clipping', prefix: '491EEA85', preset: 'Mixers\\Mix_2colors', ports: P('input1>base_color input2>color1'), consts: { weight1: [1, 1, 1, 1], alpha1: false, mode1: 0 }, kind: 'addclip' },
  { type: 'sib_render_hair', prefix: '1F51ED00', kind: 'hair', preset: 'Hair_Renderer', ports: [...P('material diffuse_root>DiffuseRoot diffuse_tip1>DiffuseTipA diffuse_tip2>DiffuseTipB diffuse_balance>TipBalance diffuse_crossover_point>DiffuseCrossoverCenter diffuse_crossover_range>DiffuseCrossoverRange color_varation>DiffuseVariation specular_inuse specular specular_decay transparency_inuse transparency_root transparency_tip transparency_crossover_point>TransparencyCrossoverCenter transparency_crossover_range>TransparencyCrossoverRange radiance>Irradiance')] },
];
const famOf = (s: Shader): Fam | undefined => {
  const t = String(s.type).toLowerCase(); const c = String((s as any).clsid ?? '').replace(/[{}]/g, '').slice(0, 8).toUpperCase();
  return FAMILIES.find(f => f.type.toLowerCase() === t || (c !== '' && f.prefix === c));
};

type T = 'color' | 'scalar' | 'integer' | 'boolean';
const typeOf = (s: Shader, n: string): T | null => { const t = s.get(n)?.def.type; return t === 'color' ? 'color' : t === 'double' ? 'scalar' : t === 'int' || t === 'enum' ? 'integer' : t === 'bool' ? 'boolean' : null; };
const defOf = (name: string, t: T, v: any): ParamDef => t === 'color' ? { name, type: 'color', value: v, animatable: false } : { name, type: t === 'scalar' ? 'double' : t === 'integer' ? 'int' : 'bool', value: v };
function ensure(s: Shader, name: string, t: T, v: any) { if (!s.get(name)) s.add(defOf(name, t, v)); else if (v !== undefined) s.set(name, v); }
const rgba = (v: any, a = 0): number[] => Array.isArray(v) ? [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? a] : [v, v, v, v];

/** Port transfer rules (note "Port transfer rules"). Returns false on failure. */
function transfer(app: App, old: Shader, nw: Shader, src: string, dst: string, destType?: T): boolean {
  const st = typeOf(old, src);
  if (!st) { warn(app, `Cannot transfer ${old.name}.${src} to ${nw.name}.${dst}: Unknown type(s)`); return false; }
  const dt = destType ?? st; const shaded = old.inputs.get(src) ?? null; const v = old.val(src);
  if (st === dt) {
    ensure(nw, dst, dt, Array.isArray(v) ? [...v] : v);
    if (shaded) nw.connect(dst, shaded);
    return true;
  }
  if (st === 'scalar' && dt === 'color') {
    ensure(nw, dst, 'color', rgba(v));
    if (shaded) { const c = new Shader(`${nw.name}_${dst}_Scalar2color`, 'Scalar2color', []); ensure(c, 'input', 'scalar', v); ensure(c, 'alpha', 'scalar', v); c.connect('input', shaded); c.connect('alpha', shaded); nw.connect(dst, c); }
    return true;
  }
  if (st === 'integer' && dt === 'scalar') {
    ensure(nw, dst, 'scalar', Number(v));
    if (shaded) { const c = new Shader(`${nw.name}_${dst}_Integer2scalar`, 'Integer2scalar', []); ensure(c, 'input', 'integer', v); c.connect('input', shaded); nw.connect(dst, c); }
    return true;
  }
  if (st === 'color' && dt === 'scalar') {   // as shipped (reversed test in the script): the converter is applied, then the transfer reports failure
    ensure(nw, dst, 'scalar', 0);
    return false;
  }
  warn(app, `Cannot convert ${st} to ${dt}`); return false;
}
const copyPorts = (app: App, old: Shader, nw: Shader, ports: [string, string, string?][]): boolean => ports.every(([s, d, t]) => transfer(app, old, nw, s, d, t as T | undefined));
const setConsts = (nw: Shader, c?: Record<string, any>) => { for (const [k, v] of Object.entries(c ?? {})) ensure(nw, k, typeof v === 'boolean' ? 'boolean' : Array.isArray(v) ? 'color' : Number.isInteger(v) ? 'integer' : 'scalar', v); };

function special(app: App, f: Fam, old: Shader, nw: Shader): boolean {
  const plain = (n: string) => !old.inputs.has(n);
  switch (f.kind) {
    case 'mix8': {
      if (!copyPorts(app, old, nw, f.ports)) return false;
      const count = old.get('count'); if (!count) { warn(app, `Cannot transfer ${old.name}.count: no such parameter`); return false; }
      const shaded = old.inputs.get('count');
      let conv: Shader | null = null;
      if (shaded) { conv = new Shader(`${nw.name}_count_Integer2scalar`, 'Integer2scalar', []); ensure(conv, 'input', 'integer', old.val('count')); conv.connect('input', shaded); }
      for (let i = 1; i <= 7; i++) {
        if (!conv) { ensure(nw, `inuse${i}`, 'boolean', i <= Number(old.val('count'))); continue; }
        const l = new Shader(`${nw.name}_inuse${i}_Scalar_Math_Logic`, 'Scalar_Math_Logic', []); ensure(l, 'op', 'integer', 4); ensure(l, 'input2', 'scalar', i); l.connect('input1', conv);
        ensure(nw, `inuse${i}`, 'boolean', false); nw.connect(`inuse${i}`, l);
      }
      return true;
    }
    case 'mixcolor': case 'mixscalar': {
      if (!copyPorts(app, old, nw, f.ports)) return false;
      const alphaFlag = !!old.val('alpha'); const mixShaded = old.inputs.get('mix'); const mix = old.val('mix');
      if (!plain('alpha')) { nya(app, 'UpgradeShaders', `${old.name}: an alpha flag driven by a shader (Boolean_switch / Scalar_switch insertion not modelled)`); }
      if (!mixShaded) { const m = Array.isArray(mix) ? mix : [mix, mix, mix, mix]; ensure(nw, 'weight1', 'color', [m[0], m[1], m[2], alphaFlag ? (m[3] ?? m[0]) : 0]); return true; }
      ensure(nw, 'weight1', 'color', [0, 0, 0, 0]);
      let drive: Shader = mixShaded;
      if (f.kind === 'mixscalar') { const c = new Shader(`${nw.name}_mix_Scalar2color`, 'Scalar2color', []); ensure(c, 'input', 'scalar', mix); c.connect('input', mixShaded); if (alphaFlag) c.connect('alpha', mixShaded); drive = c; }
      if (!alphaFlag) { const z = new Shader(`${nw.name}_mix_Color_Math_Basic`, 'Color_Math_Basic', []); ensure(z, 'op', 'integer', 2); ensure(z, 'input2', 'color', [1, 1, 1, 0]); z.connect('input1', drive); drive = z; }
      nw.connect('weight1', drive); return true;
    }
    case 'colorXcolor': {
      const s1 = old.inputs.get('color1'), s2 = old.inputs.get('color2');
      const side = (n: string, dst: string, s?: Shader) => { if (!old.get(n)) { warn(app, `Cannot transfer ${old.name}.${n} to ${nw.name}.${dst}: Unknown type(s)`); return false; } if (s) { ensure(nw, dst, 'color', rgba(old.val(n))); nw.connect(dst, s); } else ensure(nw, dst, 'color', [...rgba(old.val(n)).slice(0, 3), 0]); return true; };
      if (!side('color1', 'input1', s1) || !side('color2', 'input2', s2)) return false;
      ensure(nw, 'alpha', 'boolean', !s2);
      if (s1 && s2) { const z = new Shader('Zero_Alpha', 'Color_Math_Basic', []); ensure(z, 'op', 'integer', 2); ensure(z, 'input2', 'color', [1, 1, 1, 0]); ensure(z, 'alpha', 'boolean', true); z.connect('input1', s1); nw.connect('input1', z); }
      return true;
    }
    default: return copyPorts(app, old, nw, f.ports);
  }
}

function consumersOf(app: App, old: Shader): { shaders: [Shader, string][]; materials: Material[] } {
  const shaders: [Shader, string][] = []; const materials: Material[] = [];
  for (const m of allMaterials(app.scene)) {
    if (m.surface === old) materials.push(m);
    for (const s of containerShaders(m)) for (const [port, x] of s.inputs) if (x === old) shaders.push([s, port]);
  }
  return { shaders, materials };
}
const inStack = (app: App, old: Shader): boolean => {
  for (const m of allMaterials(app.scene)) for (const s of [m as Node, ...containerShaders(m)]) { const ls = layersOf(s); if (ls.length > 1 && ls.some(l => [...l.inputs.values()].includes(old))) return true; }
  return false;
};
const containerOf = (app: App, old: Shader): Material | null => allMaterials(app.scene).find(m => containerShaders(m).includes(old)) ?? null;

function upgradeOne(app: App, old: Shader, f: Fam): boolean {
  if (inStack(app, old)) { app.logMsg('info', `Cannot upgrade ${old.name}: shader is in a shader stack.  Please obsolete manually.`); return false; }
  app.logMsg('info', `Upgrading ${old.name}`);
  const home = containerOf(app, old); const cons = consumersOf(app, old);
  const nw = new Shader(old.name, f.preset.split('\\').pop()!, []); (nw as any).preset = f.preset;
  let ok = false;
  try { ok = f.kind === 'hair' ? copyPorts(app, old, nw, f.ports) : special(app, f, old, nw); if (ok) setConsts(nw, f.consts); } catch (e: any) { warn(app, `FCreateShader: could not create object from preset ${f.preset}: ${e?.message ?? e}`); ok = false; }
  if (f.kind === 'hair' && ok) {
    if (cons.shaders.length || !cons.materials.length) ok = false;   // only when every output goes to a material
    else {
      for (const m of cons.materials) { m.setSurface(nw); for (const port of ['shadow', 'volume', 'photonvolume']) m.portConnections.set(port, 'out'); }
      app.logMsg('info', `Upgraded ${old.name} to new hair shader. Shading model was changed to 'Fur'.`);
      return true;
    }
  }
  if (!ok) { warn(app, `Failed to upgrade ${old.name}`); if (home) nestShader(home, nw); return false; }   // the new shader stays in place
  for (const [s, port] of cons.shaders) s.connect(port, nw);
  for (const m of cons.materials) m.setSurface(nw);
  for (const [port] of [...old.inputs]) old.inputs.delete(port);   // the old shader is deleted
  return true;
}

export function upgradeShaders(app: App): boolean {
  let any = false; const failed = new Set<Shader>();   // a shader that failed is not retried by later passes
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (const f of FAMILIES) {
      const found = new Set<Shader>();
      for (const m of allMaterials(app.scene)) for (const s of containerShaders(m)) if (famOf(s) === f) found.add(s);
      for (const old of found) { if (failed.has(old)) continue; if (upgradeOne(app, old, f)) changed = true; else failed.add(old); }
    }
    if (!changed) break;
    any = true;
  }
  if (any) app.events.emit('scene');
  return any;
}

export function registerMiscB15fShaderCommands(app: App) {
  regB15f(app, {
    name: 'UpgradeShaders', label: 'Upgrade Shaders', category: 'Rendering', description: 'Replace obsolete shaders by their current equivalents', args: [{ name: 'Result', default: null }], undoable: false,
    execute: app2 => upgradeShaders(app2),
  });
  // for the compare script: the port transfer on its own (colour -> scalar always fails as shipped, item 38)
  (app as any).miscScriptsB15f.upgrade = { families: FAMILIES.map(f => f.type), transfer: (o: Shader, n: Shader, s: string, d: string, t?: T) => transfer(app, o, n, s, d, t) };
}
export const UPGRADE_FAMILIES = FAMILIES.map(f => f.type);
