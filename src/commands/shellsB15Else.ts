// CMD-B15-ELSE: built-in commands whose handler the analyst has not located yet. INFERRED registrations so the names
// are on the bus; each logs "not yet attested" for the part no note covers.
//   MarkObjectDirty           registry CLSID all zeros (no handler DLL named)            -> logs, returns nothing
//   (AddShaderAttachedComment moved to shadertasksB16b.ts, row CMD-B16b)
//   GetSkeleton               kinechain.dll (cmd-b5f mentions it; no contract)           -> chain root, bones, effector
import { App } from '../core/commands';
import { X3DObject } from '../core/scene';
import { ChainRoot, Bone, Effector } from '../core/scene2';

const TAG = 'inferred, CMD-B15-ELSE';
const nya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${TAG})`);
const objOf = (app: App, v: any): X3DObject | null => {
  if (v instanceof X3DObject) return v;
  if (Array.isArray(v)) return objOf(app, v[0]);
  if (typeof v === 'string' && v) return (app.scene.find(v.split(',')[0].trim()) as X3DObject) ?? null;
  return null;
};
const state = (app: App) => ((app as any).shellsB15Else ??= { lastGetSkeleton: null as null | { Index: number; ChainElements: X3DObject[] } });

/** inferred: the skeleton an object belongs to, as root, bones..., effector. */
function skeletonOf(o: X3DObject | null): X3DObject[] | null {
  let n: any = o;
  if (n instanceof Effector || n instanceof Bone) { while (n && !(n instanceof ChainRoot)) n = n.parent; }
  if (!(n instanceof ChainRoot)) {
    // an effector may sit outside its root's branch: look for the root that owns it
    if (o instanceof Effector) for (const r of (o as any).scene?.allObjects?.() ?? []) if (r instanceof ChainRoot && r.effector === o) n = r;
  }
  if (!(n instanceof ChainRoot)) return null;
  return [n, ...n.bones, ...(n.effector ? [n.effector] : [])];
}

export function registerShellsB15ElseCommands(app: App) {
  // inferred
  app.register({ name: 'MarkObjectDirty', label: 'MarkObjectDirty', category: '', undoable: false,
    args: [{ name: 'Object', default: null }],
    execute(app, a) {
      const o = objOf(app, a.Object) ?? app.selectedObjects[0] ?? null;
      nya(app, 'MarkObjectDirty', `what marking ${o?.fullName ?? 'the object'} dirty does (registry CLSID names no handler DLL)`);
      return undefined;
    } });

  // inferred
  app.register({ name: 'GetSkeleton', label: 'Get Skeleton', category: 'Animation', undoable: false,
    description: 'Gets the components of the skeleton this object pertains to and its index among them',
    args: [{ name: 'InputObj', default: null }, { name: 'Index', default: 0 }, { name: 'ChainElements', default: null }],
    execute(app, a) {
      const o = objOf(app, a.InputObj) ?? app.selectedObjects[0] ?? null;
      const skel = skeletonOf(o);
      if (!skel) { nya(app, 'GetSkeleton', 'the result for an object that is not a chain element (empty collection returned)'); state(app).lastGetSkeleton = { Index: -1, ChainElements: [] }; return []; }
      state(app).lastGetSkeleton = { Index: skel.indexOf(o!), ChainElements: skel };
      return skel;
    } });
}
