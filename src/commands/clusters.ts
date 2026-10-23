// Clusters: named component sets on an object (Edit > Create Cluster, Ctrl+L). Softimage names them after the
// component kind ("Point", "Edge", "Polygon") and keeps weight maps / vertex colours / texture projections on them.
import { App } from '../core/commands';
import { X3DObject, Cluster, Property } from '../core/scene';

const KIND: Record<string, 'pnt' | 'edge' | 'poly'> = { point: 'pnt', edge: 'edge', polygon: 'poly' };
const LABEL: Record<string, string> = { pnt: 'Point', edge: 'Edge', poly: 'Polygon' };
const compKindOf = (c: Cluster) => c.compKind === 'pnt' ? 'point' : c.compKind === 'edge' ? 'edge' : 'polygon';

export function clusterOf(app: App): Cluster | undefined { return app.selection.find((n): n is Cluster => n instanceof Cluster); }
/** The cluster to hang a map on: a selected cluster, else a complete point cluster of the object (created on demand, like Softimage's "Point" cluster). */
export function mapCluster(app: App, o: X3DObject, kind: 'pnt' | 'poly' | 'sample' = 'pnt'): Cluster {
  const sel = clusterOf(app); if (sel && sel.obj === o && sel.compKind === kind) return sel;
  let c = o.clusters.find(c => c.compKind === kind && c.isComplete); if (c) return c;
  const m = o.primitive?.mesh(); const n = m ? (kind === 'poly' ? m.polygons.length : m.positions.length / 3) : 0;
  c = new Cluster(uniqueClusterName(o, LABEL[kind] ?? 'Sample'), kind, new Set(Array.from({ length: n }, (_, i) => i))); c.set('alwayscomplete', true);
  const cc = c; app.record('Create Cluster', () => o.addCluster(cc), () => o.removeCluster(cc)); return c;
}
function uniqueClusterName(o: X3DObject, base: string) { let n = base, i = 1; while (o.clusters.some(c => c.name === n)) n = `${base}${i++}`; return n; }

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
  app.register({
    name: 'SIAddToCluster', label: 'Add to Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }, { name: 'Components', default: '' }],
    execute(app, a) { const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); const cs = app.compSel; if (!c || !cs || cs.obj !== c.obj) throw new Error('Select a cluster and components of its object'); const items = [...(cs.kind === 'point' ? cs.points : cs.kind === 'edge' ? cs.edges : cs.polygons)] as (number | string)[]; const added = items.filter(i => !c.elements.has(i)); app.record('Add to Cluster', () => added.forEach(i => c.elements.add(i)), () => added.forEach(i => c.elements.delete(i))); return c; },
  });
  app.register({
    name: 'RemoveFromCluster', label: 'Remove from Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }, { name: 'Components', default: '' }],
    execute(app, a) { const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); const cs = app.compSel; if (!c || !cs || cs.obj !== c.obj) throw new Error('Select a cluster and components of its object'); const items = ([...(cs.kind === 'point' ? cs.points : cs.kind === 'edge' ? cs.edges : cs.polygons)] as (number | string)[]).filter(i => c.elements.has(i)); app.record('Remove from Cluster', () => items.forEach(i => c.elements.delete(i)), () => items.forEach(i => c.elements.add(i))); return c; },
  });
  app.register({
    name: 'SelectClusterComponents', label: 'Select Cluster Components', category: 'Select', args: [{ name: 'Cluster', default: '' }], undoable: false,
    execute(app, a) { const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); if (!c?.obj) throw new Error('Select a cluster'); app.setSelMode(compKindOf(c)); app.selectComponents(c.obj, compKindOf(c), [...c.elements]); return c; },
  });
  app.register({
    name: 'DeleteCluster', label: 'Delete Cluster', category: 'Edit', args: [{ name: 'Cluster', default: '' }],
    execute(app, a) { const c = (a.Cluster && findCluster(app, a.Cluster)) || clusterOf(app); const o = c?.obj; if (!c || !o) throw new Error('Select a cluster'); app.record('Delete Cluster', () => o.removeCluster(c), () => o.addCluster(c)); app.select([o]); return null; },
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
