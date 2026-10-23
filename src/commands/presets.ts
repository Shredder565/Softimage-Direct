// Get > Primitive > Model presets. The geometry/hierarchy of Softimage's XSI_SAMPLES/Models/*.emdl presets was
// exported by the real application (tools/si_export_models.js) to public/si/models/*.json.gz and is rebuilt here:
// models, nulls, polygon meshes (frozen), chains (root/bones/effector), curves, implicit controls, materials.
import { App } from '../core/commands';
import { X3DObject, Model, Null, Primitive, Operator, makeDisplay, makeGeomApprox, makePhong } from '../core/scene';
import { ChainRoot, Bone, Effector, makeImplicit } from '../core/scene2';
import { fromPolys } from '../core/topology';
import { makeCurve } from '../core/curves';

export const PRESET_MODELS: Record<string, string> = {
  'Skeleton - Man - Basic': 'ManSkeleton_Basic', 'Skeleton - Man - Complete': 'ManSkeleton_Complete', 'Skeleton - Woman - Basic': 'WomanSkeleton_Basic', 'Skeleton - Woman - Complete': 'WomanSkeleton_Complete',
  'Biped - Box': 'Biped_Box', 'Biped - SI|3D Skeleton': 'Biped_XSISkeleton', 'Biped - Skeleton': 'Biped_Skeleton', 'Biped - Rig': 'Biped_Rig', 'Quadruped - Rig': 'Quadruped_Rig',
  'Body - Man': 'Man', 'Body - Woman': 'Woman', 'Face - Man': 'Man_Face', 'Face - Woman': 'Woman_Face', 'Character - Man': 'Man_Character',
  'Mesh - Bull': 'Bull', 'Mesh - Car': 'Car', 'Mesh - Fish': 'Fish', 'Mesh - Horse': 'Horse', 'Mesh - Lizard': 'Lizard', 'Mesh - Male': 'Male', 'Mesh - T.rex': 'Trex',
};
type PNode = { name: string; type: string; parent: string | null; xf: { pos: number[]; rot: number[]; scl: number[]; rotorder: number }; mesh?: { points: number[]; polys: number[][] }; material?: { diffuse: number[] | null; name: string } | null; length?: number; size?: number; curve?: { degree: number; closed: boolean; cps: number[] }; nurbs?: any };
type PData = { preset: string; file: string; model: string; nodes: PNode[] };

class FrozenGeom extends Operator { constructor(readonly data: any, label = 'Frozen Geometry') { super(label, 'geom', []); } apply() { return this.data; } }
const cache = new Map<string, Promise<PData>>();
/** Fetch a .json.gz: some hosts serve it with Content-Encoding (already inflated), others as raw gzip bytes. */
export async function fetchMaybeGzip(url: string): Promise<string> {
  let res = await fetch(url);
  if (!res.ok && url.endsWith('.gz')) res = await fetch(url.slice(0, -3)); // hosts that do not serve .gz get the plain file
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) { const ds = new DecompressionStream('gzip'); return await new Response(new Blob([buf]).stream().pipeThrough(ds)).text(); }
  return new TextDecoder().decode(buf);
}
async function loadPreset(file: string): Promise<PData> {
  if (!cache.has(file)) cache.set(file, (async () => {
    return JSON.parse(await fetchMaybeGzip(`si/models/${file}.json.gz`)) as PData;
  })());
  return cache.get(file)!;
}

/** Rebuild the exported hierarchy under the scene root (synchronous, so it is undoable/loggable like any command). */
export function buildPresetModel(app: App, data: PData, nameOverride?: string): X3DObject {
  const made = new Map<string, X3DObject[]>(); const objs: X3DObject[] = []; let top: X3DObject | null = null;
  const matCache = new Map<string, any>();
  const chainOf = new Map<X3DObject, ChainRoot>();
  for (const n of data.nodes) {
    let o: X3DObject;
    const parent = n.parent ? (made.get(n.parent) ?? []).slice(-1)[0] ?? null : null;
    const pchain = parent ? chainOf.get(parent) : undefined;
    switch (n.type) {
      case '#model': o = new Model(top ? n.name : app.scene.uniqueName(nameOverride ?? n.name)); break;
      case 'polymsh': { o = new X3DObject(n.name, 'polymsh'); const prim = new Primitive('Polygon Mesh', 'polymsh'); const pts = n.mesh!.points; const verts: [number, number, number][] = []; for (let i = 0; i < pts.length; i += 3) verts.push([pts[i], pts[i + 1], pts[i + 2]]); prim.addOperator(new FrozenGeom(fromPolys(verts, n.mesh!.polys))); o.setPrimitive(prim); o.addProperty(makeDisplay()); o.addProperty(makeGeomApprox());
        if (n.material?.diffuse) { const key = n.material.name + n.material.diffuse.join(','); let mat = matCache.get(key); if (!mat) { const sh = makePhong('Phong'); sh.set('diffuse', n.material.diffuse); mat = app.scene.newMaterial(n.material.name || o.name + '_Mat', sh); matCache.set(key, mat); } o.setMaterial(mat); } break; }
      case 'root': { const r = new ChainRoot(n.name); o = r; chainOf.set(r, r); break; }
      case 'bone': { const b = new Bone(n.name, n.length ?? 1); o = b; if (pchain) { chainOf.set(b, pchain); pchain.bones.push(b); } break; }
      case 'eff': { const e = new Effector(n.name); o = e; if (pchain) pchain.effector = e; break; }
      case 'crvlist': { o = new X3DObject(n.name, 'crvlist'); const prim = new Primitive('NURBS Curve List', 'crvlist'); if (n.curve?.cps?.length) { const c = n.curve.cps; const pts: [number, number, number][] = []; for (let i = 0; i < c.length; i += 3) pts.push([c[i], c[i + 1], c[i + 2]]); prim.addOperator(new FrozenGeom(makeCurve(pts, n.curve.degree || 3, !!n.curve.closed))); } o.setPrimitive(prim); o.addProperty(makeDisplay()); break; }
      case 'cube': case 'sphere': case 'cylinder': case 'cone': case 'torus': case 'grid': case 'square': case 'circle': case 'disc': { o = makeImplicit(n.name, n.type[0].toUpperCase() + n.type.slice(1)); if (n.size !== undefined) o.primitive!.set('size', n.size); break; }
      case 'null': default: { o = new Null(n.name); if (n.size !== undefined && o.get('size')) o.set('size', n.size); break; }
    }
    const l = o.kinematics.local; const { pos, rot, scl, rotorder } = n.xf;
    l.set('posx', pos[0]); l.set('posy', pos[1]); l.set('posz', pos[2]); l.set('rotx', rot[0]); l.set('roty', rot[1]); l.set('rotz', rot[2]); l.set('sclx', scl[0]); l.set('scly', scl[1]); l.set('sclz', scl[2]); if (l.get('rotorder')) l.set('rotorder', rotorder ?? 0);
    if (parent) parent.addChild(o); else if (!top) top = o;
    if (!made.has(n.name)) made.set(n.name, []); made.get(n.name)!.push(o); objs.push(o);
  }
  if (!top) throw new Error('Empty preset'); const root = top as X3DObject;
  app.record('Get Preset Model ' + root.name, () => app.scene.root.addChild(root), () => app.scene.root.removeChild(root));
  app.select([root]); return root;
}

export function registerPresetModels(app: App) {
  app.register({ name: 'ImportPresetModelData', label: 'Import Preset Model Data', category: 'Primitive', args: [{ name: 'Data', default: null }, { name: 'Name', default: '' }], execute: (app, a) => buildPresetModel(app, a.Data, a.Name || undefined) });
  app.register({
    name: 'GetPresetModel', label: 'Get Preset Model', category: 'Primitive', args: [{ name: 'ModelName', default: 'Bull' }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }, { name: 'PsetName', default: '' }], undoable: false,
    canRun: (a) => { const k = a.ModelName ?? a.PresetObj; return !!PRESET_MODELS[k] || Object.values(PRESET_MODELS).includes(String(k).replace(/\.emdl$/i, '').replace(/_Generated$/, '')); },
    execute(app, a) {
      const k = a.ModelName ?? a.PresetObj; const file = PRESET_MODELS[k] ?? String(k).replace(/\.emdl$/i, '').replace(/_Generated$/, ''); // the menu loads the *_Generated rig files; the exported rigs are the same hierarchies
      if (!Object.values(PRESET_MODELS).includes(file)) throw new Error(`Preset model "${k}" is not bundled`);
      app.logMsg('info', `Loading preset model ${file}.emdl …`);
      const p = loadPreset(file).then(data => { const m = app.run('ImportPresetModelData', { Data: data, Name: a.Name }); app.events.emit('scene'); return m; }).catch(e => app.logMsg('error', `GetPresetModel: ${e?.message ?? e}`));
      (app as any).pending = p; return p;
    },
  });
}
