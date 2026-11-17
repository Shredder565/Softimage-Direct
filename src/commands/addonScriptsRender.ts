// Ledger row CMD-B7c, Render Manager / render tree user tools / Polygonizer add-ons.
// Brief: docs/ghidra/cmd-b7c-addon-scripts.md, "Wire contract: RenderManager", "RTUserTools", "Polygonizer".
// Original code written from that contract only.
//
//   OpenOutputFormatPreferences, OverrideMarkedPassParameters, DeleteUnusedShaders, RTShaderSetCategories,
//   Create_Polygonizer_Polymesh
//
// Seams:
//  * Shader graph. The build's render tree is a tree hanging off its material (no unconnected nodes, no
//    compounds, no image clips nested in a container), so DeleteUnusedShaders reads the graph through
//    `shaderGraph` below; objects of other kinds can describe themselves with the lower-case members
//    documented on `RtGraphObject`.
//  * Shader definitions. `GetShaderDef` is not on the bus; the definitions live in `state.shaderDefs`, filled
//    from the build's own SPDL shader list on first use.
//  * Overrides. `SIAddEntryToOverride` is not on the bus; the entries are kept on the override property.
import { App } from '../core/commands';
import { Node, Property, Material, Shader, Pass, Light, Camera } from '../core/scene';
import { SI_SHADERS } from '../core/shaders';
import {
  addonScriptsState as state, listOf, fullNameOf, typeOf, delegate, trace, inspect, logWarning, logNya, type ShaderDefRec,
} from './addonScriptsShared';
import { SHADER_CATEGORY_ROWS } from './addonScriptsShaderCategories';

// ------------------------------------------------------------------ RenderManager

const className = (x: any): string => {
  if (x instanceof Property) return /^custom/i.test(x.type) ? 'CustomProperty' : 'Property';   // inferred: how the build's property types map to class names
  return x == null ? '' : String(x.ClassName ?? '');
};
const parentOf = (x: any): any => (x instanceof Node ? x.parent : x?.Parent);
const isPassType = (x: any): boolean => x instanceof Pass || typeOf(x) === 'Pass';

function overrideMarkedPassParameters(app: App): void {
  const sel: any = app.selection[0];
  if (sel === undefined) {
    // inferred (Q4): with an empty selection the entry test raises and, under error suppression, at most a warning shows.
    logWarning(app, 'Please select a pass global renderer'); return;
  }
  const cls = className(sel);
  if (!(cls === 'Property' || (cls === 'CustomProperty' && isPassType(parentOf(sel))))) { logWarning(app, 'Please select a pass global renderer'); return; }
  // GetMarking: the marked parameters, as script names relative to the selection.
  const marked = [...app.anim.marked];
  const own = marked.filter(p => p.owner === sel);
  const entries = (own.length ? own : marked).map(p => p.name);   // inferred: a parameter of another owner is given by its script name alone
  if (!entries.length || entries[0] === '') { logWarning(app, 'Please mark some parameters on pass global renderer'); return; }
  const pass = parentOf(sel);
  if (!isPassType(pass)) { logWarning(app, 'Please select a pass global renderer'); return; }
  let override: Property | undefined = (pass as any).passOverride;
  if (!override) {
    trace('AddProp', ['Override', fullNameOf(pass), '', 'PassOverride'], 'stand-in');   // preset Override, not branched, named PassOverride
    override = new Property('PassOverride', 'Override', []);
    override.parent = pass as any;
    (override as any).entries = [];
    (pass as any).passOverride = override;
  }
  for (const e of entries) {
    const path = `${fullNameOf(sel)}.${e}`;
    const r = delegate(app, 'OverrideMarkedPassParameters', 'SIAddEntryToOverride', { Override: override, Parameter: path }, [fullNameOf(override), path]);
    if (!r.done) { const list: string[] = ((override as any).entries ??= []); if (!list.includes(path)) list.push(path); }
  }
  inspect(app, override);
}

// ------------------------------------------------------------------ DeleteUnusedShaders

/**
 * What an object that is not one of the build's own render-tree classes can carry to take part in
 * DeleteUnusedShaders (all optional except `Type`).
 */
export interface RtGraphObject {
  Type: string;
  Parent?: any;
  /** `siShader`, `siShaderCompound`, or another shader type (comments and so on). */
  ShaderType?: string;
  /** GetAllShaders(): every shader the container owns. */
  shaders?: any[];
  /** AllImageClips of a container. */
  imageClips?: any[];
  /** Owners of every target of every output parameter (for a clip: of its shader-parameter targets). */
  targets?: any[];
  /** Owners of the sources of the typed input parameters that have one. */
  sources?: any[];
  /** Remove a shader or clip from this container (what DisconnectAndDeleteOrUnnestShaders ends in). */
  remove?(x: any): void;
}
const rtType = (x: any): string => x instanceof Material ? 'material' : x instanceof Shader ? 'Shader' : x instanceof Pass ? 'Pass' : x instanceof Light ? 'light' : x instanceof Camera ? 'camera' : typeOf(x);
const rtShaderType = (x: any): string => x instanceof Shader ? 'siShader' : String(x?.ShaderType ?? '');
function buildShaders(root: Shader | null): Shader[] {
  const out: Shader[] = [];
  const walk = (s: Shader) => { if (out.includes(s)) return; out.push(s); for (const c of s.inputs.values()) walk(c); };
  if (root) walk(root);
  return out;
}
const shaderGraph = {
  allShaders(c: any): any[] {
    if (c instanceof Material) return buildShaders(c.surface);
    if (c instanceof Light) return buildShaders(c.shader);
    if (c instanceof Shader) return buildShaders(c).slice(1);
    return [...listOf(c?.shaders)];
  },
  imageClips(c: any): any[] { return c instanceof Node ? [] : [...listOf(c?.imageClips)]; },
  targets(x: any): any[] { return x instanceof Shader ? (x.parent ? [x.parent] : []) : [...listOf(x?.targets)]; },
  sources(x: any): any[] { return x instanceof Shader ? [...x.inputs.values()] : x instanceof Node ? [] : [...listOf(x?.sources)]; },
  /** The build's own removal: unplug the shader from whatever it feeds. */
  remove(c: any, x: any): boolean {
    if (typeof c?.remove === 'function') { c.remove(x); return true; }
    if (x instanceof Shader) {
      const p: any = x.parent;
      if (p instanceof Shader) { for (const [port, s] of p.inputs) if (s === x) p.connect(port, null); return true; }
      if (p instanceof Material && p.surface === x) { p.setSurface(null); return true; }
    }
    return false;
  },
};
const WALK_END = new Set(['material', 'light', 'camera', 'pass']);

function deleteUnusedShadersIn(app: App, original: any): void {
  let container = original;
  const t = rtType(container), parent = parentOf(container);
  if ((t === 'light' && rtType(parent) === 'light') || (t === 'camera' && rtType(parent) === 'camera')) container = parent;
  if (!['light', 'camera', 'material', 'Pass', 'Shader'].includes(rtType(container))) return;   // any other type is skipped silently

  const containerIsCompound = rtType(container) === 'Shader' && rtShaderType(container) === 'siShaderCompound';
  const fedByContainer = (shader: any): boolean => {
    const seen = new Set<any>();
    const up = (x: any): boolean => {
      if (seen.has(x)) return false; seen.add(x);
      for (const s of shaderGraph.sources(x)) if (s === container || up(s)) return true;
      return false;
    };
    return up(shader);
  };
  const rootsOf = (shader: any): Set<any> => {
    const roots = new Set<any>(); const seen = new Set<any>();
    const walk = (x: any) => {
      if (seen.has(x)) return; seen.add(x);
      if (x === container || WALK_END.has(rtType(x).toLowerCase())) { roots.add(x); return; }
      const st = rtShaderType(x);
      if (rtType(x) !== 'Shader' || (st !== 'siShader' && st !== 'siShaderCompound')) return;   // not a shader, or a comment-like node: no root
      const targets = shaderGraph.targets(x);
      if (!targets.length) { roots.add(x); return; }
      for (const tg of targets) walk(tg);
    };
    walk(shader);
    return roots;
  };
  /** DisconnectAndDeleteOrUnnestShaders <x>, <c>; true when `x` is gone from the container afterwards. */
  const remove = (x: any, c: any, list: () => any[]): boolean => {
    delegate(app, 'DeleteUnusedShaders', 'DisconnectAndDeleteOrUnnestShaders', { Shaders: x, Containers: c }, [fullNameOf(x), fullNameOf(c)]);
    if (!list().includes(x)) return true;
    if (shaderGraph.remove(c, x) && !list().includes(x)) return true;   // the bus command does not edit the graph in this build
    logNya(app, 'DeleteUnusedShaders', `removing ${fullNameOf(x)} from ${fullNameOf(c)} (the shader delete command does not edit this container in this build)`, 'Dependencies');
    return false;
  };

  // Pass 1: unconnected shader trees, until a full scan deletes nothing.
  for (let guard = 0; guard < 1000; guard++) {
    let deleted = false;
    for (const shader of shaderGraph.allShaders(container)) {
      if (containerIsCompound && fedByContainer(shader)) continue;
      const roots = rootsOf(shader);
      roots.delete(container);
      for (const r of roots) {
        const rt = rtType(r);
        if (rt !== 'Shader' && rt !== 'ImageClip') continue;
        if (remove(r, container, () => shaderGraph.allShaders(container))) deleted = true;
      }
      if (deleted) break;   // restart with a fresh shader list
    }
    if (!deleted) break;
  }
  // Pass 2: image clips no shader of the container uses, from last to first.
  const owned = new Set(shaderGraph.allShaders(container));
  const clips = shaderGraph.imageClips(container);
  for (let i = clips.length - 1; i >= 0; i--) {
    const clip = clips[i];
    if (shaderGraph.targets(clip).some(tg => owned.has(tg))) continue;
    remove(clip, original, () => shaderGraph.imageClips(container));   // the original argument, not the resolved parent
  }
}

// ------------------------------------------------------------------ RTShaderSetCategories

/** The shader definition of a ProgID, or undefined. */
export function shaderDef(app: App, progId: string): ShaderDefRec | undefined {
  if (!(state as any).shaderDefsSeeded) {
    (state as any).shaderDefsSeeded = true;
    // inferred: an SPDL shader of the build is the definition `Softimage.<name>.1.0`, its title the display name.
    for (const [key, d] of Object.entries(SI_SHADERS)) {
      const id = `Softimage.${key}.1.0`;
      if (!state.shaderDefs.has(id)) state.shaderDefs.set(id, { ProgID: id, Category: '', DisplayName: d.title, attributes: {} });
    }
  }
  if (app.commands.has('GetShaderDef')) { const r = app.run('GetShaderDef', { ProgID: progId }); return r ?? undefined; }
  return state.shaderDefs.get(progId);
}
const STRIP: Record<string, RegExp> = { M: /\sMath/g, T: /mib\sTexture\s/g };

function rtShaderSetCategories(app: App): true | undefined {
  if (state.env.XSI_NO_DEFAULT_SHADERS) return undefined;
  for (const row of SHADER_CATEGORY_ROWS) {
    const id = `Softimage.${row.shader}.1.0`;
    const def = shaderDef(app, id);
    if (!def) { app.logMsg('error', `Shader '${id}' not found.`); continue; }
    def.Category = row.category;
    if (row.strip) def.DisplayName = String(def.DisplayName).replace(STRIP[row.strip], '');
    if (row.displayName) def.DisplayName = row.displayName;
    if (row.thumbnail) (def.attributes ??= {}).Thumbnail = row.thumbnail;
  }
  return true;
}

// ------------------------------------------------------------------ registration

export function registerRenderAddonCommands(app: App) {
  const CAT = 'Custom';

  app.register({
    name: 'OpenOutputFormatPreferences', label: 'Open Output Format Preferences', category: CAT, description: '',
    args: [], undoable: false, noLog: true,
    execute(app2) { inspect(app2, 'preferences.output_format'); return true; },
  });

  app.register({
    name: 'OverrideMarkedPassParameters', label: 'Override Marked Pass Parameters', category: CAT, description: '',
    args: [], undoable: false,
    execute(app2) {
      try { overrideMarkedPassParameters(app2); } catch { /* all errors are suppressed for the whole procedure */ }
      return true;
    },
  });

  app.register({
    name: 'DeleteUnusedShaders', label: 'DeleteUnusedShaders', category: CAT, description: '',
    args: [{ name: 'container', default: null }],
    execute(app2, a) {
      const list = a.container === null || a.container === undefined ? [...app2.selection] : listOf(a.container);
      for (const c of list) deleteUnusedShadersIn(app2, c);
    },
  });

  app.register({
    name: 'RTShaderSetCategories', label: 'RTShaderSetCategories', category: CAT, description: '',
    args: [], undoable: false, noLog: true,
    execute(app2) { return rtShaderSetCategories(app2); },
  });

  app.register({
    name: 'Create_Polygonizer_Polymesh', label: 'Create_Polygonizer_Polymesh', category: CAT, description: '',
    args: [],
    execute(app2) {
      const remembered = [...app2.selection];
      // SIGetPrim "EmptyPolygonMesh", "Polygonizer": the new object is the command's output argument.
      let mesh: any;
      if (app2.commands.has('SIGetPrim')) { const r = delegate(app2, 'Create_Polygonizer_Polymesh', 'SIGetPrim', { PresetObj: 'EmptyPolygonMesh', Name: 'Polygonizer' }, ['EmptyPolygonMesh', 'Polygonizer']).result; mesh = Array.isArray(r) ? r.find(x => x instanceof Node) : r?.Value ?? r; }
      else { trace('SIGetPrim', ['EmptyPolygonMesh', 'Polygonizer'], 'stand-in'); mesh = app2.run('GetPrim', { PresetObj: 'EmptyPolygonMesh', Name: 'Polygonizer' }); }
      if (!(mesh instanceof Node)) throw new Error('script error: the empty polygon mesh was not created');   // inferred text
      delegate(app2, 'Create_Polygonizer_Polymesh', 'DeselectAll', {}, []);
      const names = [mesh, ...remembered].map(fullNameOf).join(',');
      delegate(app2, 'Create_Polygonizer_Polymesh', 'SelectObj', { InputObjs: names }, [names]);
      delegate(app2, 'Create_Polygonizer_Polymesh', 'ApplyPolygonizer', {}, []);
      delegate(app2, 'Create_Polygonizer_Polymesh', 'DeselectAll', {}, []);
      delegate(app2, 'Create_Polygonizer_Polymesh', 'SelectObj', { InputObjs: fullNameOf(mesh) }, [fullNameOf(mesh)]);
      return true;
    },
  });
}
