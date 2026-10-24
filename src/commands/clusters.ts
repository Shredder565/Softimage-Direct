// Clusters: named component sets on an object (Edit > Create Cluster, Ctrl+L). Softimage names them after the
// component kind ("Point", "Edge", "Polygon") and keeps weight maps / vertex colours / texture projections on them.
import { App } from '../core/commands';
import { X3DObject, Cluster, Property } from '../core/scene';

const KIND: Record<string, 'pnt' | 'edge' | 'poly'> = { point: 'pnt', edge: 'edge', polygon: 'poly' };
const LABEL: Record<string, string> = { pnt: 'Point', edge: 'Edge', poly: 'Polygon', sample: 'Sample' };
const compKindOf = (c: Cluster) => c.compKind === 'pnt' ? 'point' : c.compKind === 'edge' ? 'edge' : 'polygon';

export function clusterOf(app: App): Cluster | undefined { return app.selection.find((n): n is Cluster => n instanceof Cluster); }
/** The cluster to hang a map on: a selected cluster, else a complete point cluster of the object (created on demand, like Softimage's "Point" cluster). */
export function mapCluster(app: App, o: X3DObject, kind: 'pnt' | 'poly' | 'sample' = 'pnt'): Cluster {
  const sel = clusterOf(app); if (sel && sel.obj === o && sel.compKind === kind) return sel;
  let c = o.clusters.find(c => c.compKind === kind && c.isComplete); if (c) return c;
  const m = o.primitive?.mesh();
  let n = 0;
  if (m) {
    if (kind === 'poly') n = m.polygons.length;
    else if (kind === 'sample') n = m.polygons.reduce((s, f) => s + f.length, 0);
    else n = m.positions.length / 3;
  }
  c = new Cluster(uniqueClusterName(o, LABEL[kind] ?? 'Sample'), kind, new Set(Array.from({ length: n }, (_, i) => i))); c.set('alwayscomplete', true);
  const cc = c; app.record('Create Cluster', () => o.addCluster(cc), () => o.removeCluster(cc)); return c;
}
function uniqueClusterName(o: X3DObject, base: string) { let n = base, i = 1; while (o.clusters.some(c => c.name === n)) n = `${base}${i++}`; return n; }

function allComponents(o: X3DObject, kind: 'pnt' | 'edge' | 'poly' | 'sample'): Set<number | string> {
  const m = o.primitive?.mesh(); if (!m) return new Set();
  if (kind === 'pnt') return new Set(Array.from({ length: m.positions.length / 3 }, (_, i) => i));
  if (kind === 'poly') return new Set(Array.from({ length: m.polygons.length }, (_, i) => i));
  if (kind === 'sample') return new Set(Array.from({ length: m.polygons.reduce((s, f) => s + f.length, 0) }, (_, i) => i));
  const seen = new Set<string>(); const out = new Set<number | string>(); let id = 0; const map = new Map<string, number>();
  for (const f of m.polygons) for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length]; const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!seen.has(key)) { seen.add(key); map.set(key, id); out.add(id); id++; }
  }
  return out;
}

export function registerClusterCommands(app: App) {
  app.register({
    name: 'CreateCluster', label: 'Create Cluster', category: 'Edit', description: 'Creates a cluster from the selected components (Ctrl+L).',
    args: [{ name: 'InputObjs', default: '' }, { name: 'Name', default: '' }, { name: 'AlwaysComplete', default: false }],
    execute(app, a) {
      const cs = app.compSel; if (!cs) throw new Error('Select components (T / E / Y) first');
      const kind = KIND[cs.kind]; const items: Set<number | string> = cs.kind === 'point' ? new Set(cs.points) : cs.kind === 'edge' ? new Set(cs.edges) : new Set(cs.polygons);
      if (!items.size) throw new Error('No components selected');
      const o = cs.obj; const c = new Cluster(uniqueClusterName(o, a.Name || LABEL[kind]), kind, items); if (a.AlwaysComplete) c.set('alwayscomplete', true);
      app.record('Create Cluster', () => o.addCluster(c), () => o.removeCluster(c)); app.select([c]); return c;
    },
  });
  // Softimage aliases used by scripts / PE handlers
  app.register({ name: 'SICreateCluster', label: 'Create Cluster', category: 'Edit', args: [{ name: 'InputObjs', default: '' }, { name: 'Name', default: '' }], execute: (app, a) => app.run('CreateCluster', a) });
  app.register({ name: 'CreateClusterFromSubComponent', label: 'Create Cluster', category: 'Edit', args: [{ name: 'InputObjs', default: '' }, { name: 'Name', default: '' }], execute: (app, a) => app.run('CreateCluster', a) });
  app.register({
    name: 'SIAddToCluster', label: 'Add to Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }, { name: 'Components', default: '' }],
    execute(app, a) { const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); const cs = app.compSel; if (!c || !cs || cs.obj !== c.obj) throw new Error('Select a cluster and components of its object'); const items = [...(cs.kind === 'point' ? cs.points : cs.kind === 'edge' ? cs.edges : cs.polygons)] as (number | string)[]; const added = items.filter(i => !c.elements.has(i)); app.record('Add to Cluster', () => added.forEach(i => c.elements.add(i)), () => added.forEach(i => c.elements.delete(i))); return c; },
  });
  app.register({ name: 'AddToCluster', label: 'Add to Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }, { name: 'Components', default: '' }], execute: (app, a) => app.run('SIAddToCluster', a) });
  app.register({
    name: 'RemoveFromCluster', label: 'Remove from Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }, { name: 'Components', default: '' }],
    execute(app, a) { const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); const cs = app.compSel; if (!c || !cs || cs.obj !== c.obj) throw new Error('Select a cluster and components of its object'); const items = ([...(cs.kind === 'point' ? cs.points : cs.kind === 'edge' ? cs.edges : cs.polygons)] as (number | string)[]).filter(i => c.elements.has(i)); app.record('Remove from Cluster', () => items.forEach(i => c.elements.delete(i)), () => items.forEach(i => c.elements.add(i))); return c; },
  });
  app.register({ name: 'SIRemoveFromCluster', label: 'Remove from Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }, { name: 'Components', default: '' }], execute: (app, a) => app.run('RemoveFromCluster', a) });
  app.register({
    name: 'SelectClusterComponents', label: 'Select Cluster Components', category: 'Select', args: [{ name: 'Cluster', default: '' }], undoable: false,
    execute(app, a) { const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); if (!c?.obj) throw new Error('Select a cluster'); app.setSelMode(compKindOf(c)); app.selectComponents(c.obj, compKindOf(c), [...c.elements]); return c; },
  });
  app.register({
    name: 'DeleteCluster', label: 'Delete Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }],
    execute(app, a) { const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); const o = c?.obj; if (!c || !o) throw new Error('Select a cluster'); app.record('Delete Cluster', () => o.removeCluster(c), () => o.addCluster(c)); app.select([o]); return null; },
  });
  app.register({ name: 'RemoveCluster', label: 'Remove Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }], execute: (app, a) => app.run('DeleteCluster', a) });
  app.register({
    name: 'CopyCluster', label: 'Copy Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }, { name: 'Name', default: '' }],
    execute(app, a) {
      const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); const o = c?.obj; if (!c || !o) throw new Error('Select a cluster');
      const copy = new Cluster(uniqueClusterName(o, a.Name || c.name), c.compKind, new Set(c.elements));
      if (c.val('alwayscomplete')) copy.set('alwayscomplete', true);
      for (const p of c.properties) { const np = new Property(p.name, p.type, p.params.map((x: any) => ({ ...x.def, value: x.value }))); if ((p as any).values) (np as any).values = new Map((p as any).values); if ((p as any).normals) (np as any).normals = new Map((p as any).normals); if ((p as any).uvs) (np as any).uvs = (p as any).uvs; copy.addProperty(np); }
      app.record('Copy Cluster', () => o.addCluster(copy), () => o.removeCluster(copy)); app.select([copy]); return copy;
    },
  });
  /** Softimage workflow: invert the cluster's membership (components of the same kind that are not in the cluster). */
  app.register({
    name: 'InvertCluster', label: 'Invert Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }],
    execute(app, a) {
      const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); const o = c?.obj; if (!c || !o) throw new Error('Select a cluster');
      const all = allComponents(o, c.compKind); const before = new Set(c.elements);
      const next = new Set([...all].filter(i => !before.has(i)));
      app.record('Invert Cluster', () => { c.elements.clear(); for (const i of next) c.elements.add(i); }, () => { c.elements.clear(); for (const i of before) c.elements.add(i); });
      app.select([c]); return c;
    },
  });
  app.register({
    name: 'AddPropToCluster', label: 'Add Property to Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }, { name: 'Preset', default: 'Weight Map' }],
    execute(app, a) { const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); if (!c) throw new Error('Select a cluster'); const p = app.run('AddProp', { PresetObj: a.Preset, InputObjs: c.obj ? [c.obj] : '' }) as Property | undefined; if (p && c.obj) { c.obj.removeProperty(p); c.addProperty(p); } return p ?? null; },
  });
}
function findCluster(app: App, path: string): Cluster | undefined {
  const [objName, clName] = String(path).split('.').slice(-2);
  for (const o of app.scene.allObjects()) if (!clName || o.name === objName) { const c = o.clusters.find(c => c.name === (clName ?? objName)); if (c) return c; }
  return undefined;
}
