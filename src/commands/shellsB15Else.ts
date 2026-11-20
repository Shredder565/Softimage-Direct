// CMD-B15-ELSE: built-in commands whose handler the analyst has not located yet. INFERRED registrations so the names
// are on the bus; each logs "not yet attested" for the part no note covers.
//   MarkObjectDirty           CMD-B16d: null handler CLSID, no task class anywhere      -> logs "no handler", returns nothing
//   AddShaderAttachedComment  shader-creation task bbbbee29 (handler DLL not located)    -> logs, creates nothing
//   GetSkeleton               CMD-B16d: kinechain.dll C3DGetSkeletonInfoTask (SPEC)      -> output args Index, ChainElements
import { App } from '../core/commands';
import { X3DObject } from '../core/scene';
import { ChainRoot, Bone, Effector } from '../core/scene2';
import { SiStatusError } from './alembicSeqCam';

const E_INVALIDARG = 0x80070057;

const TAG = 'inferred, CMD-B15-ELSE';
const nya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${TAG})`);
const objOf = (app: App, v: any): X3DObject | null => {
  if (v instanceof X3DObject) return v;
  if (Array.isArray(v)) return objOf(app, v[0]);
  if (typeof v === 'string' && v) return (app.scene.find(v.split(',')[0].trim()) as X3DObject) ?? null;
  return null;
};
/** Output arguments of the last run (RePackArg), keyed by command: `app.shellsB15Else.out.GetSkeleton`. */
const state = (app: App) => ((app as any).shellsB15Else ??= { out: {} as Record<string, Record<string, any>> });

/** The skeleton an object belongs to, as root, bones..., effector (inferred: C3DSkeletonBrowser order, cmd-b16d Q6). */
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
  // CMD-B16d (SPEC): no task class; the command manager hands a null-handler command to the DS base ExecuteCmd.
  // A no-op that returns nothing, kept on the bus so scripts do not fail.
  app.register({ name: 'MarkObjectDirty', label: 'MarkObjectDirty', category: '', undoable: false, description: 'MarkObjectDirty',
    args: [{ name: 'Object', default: null }],
    execute(app, a) {
      const o = objOf(app, a.Object) ?? app.selectedObjects[0] ?? null;
      app.logMsg('info', `MarkObjectDirty: no handler (null CLSID); nothing done for ${o?.fullName ?? 'the object'} (CMD-B16d)`);
      return undefined;
    } });

  // inferred
  app.register({ name: 'AddShaderAttachedComment', label: 'Add Shader Attached Comment', category: 'Rendering', undoable: false,
    args: [{ name: 'Container', default: null }],
    execute(app, a) {
      const c = objOf(app, a.Container);
      nya(app, 'AddShaderAttachedComment', `the attached comment of the shader-creation task bbbbee29 on ${c?.fullName ?? 'the container'}; nothing is created`);
      return null;
    } });

  // CMD-B16d (SPEC, correction 36): InputObj must be a 3D object in a skeleton, else E_INVALIDARG. Outputs (RePackArg):
  // Index (VT_I4, the object's index among the skeleton elements) and ChainElements (object collection, written only
  // when the list exists). They are written back into the argument record and kept in
  // `app.shellsB15Else.out.GetSkeleton`; the call returns them as the output-argument collection (inferred: the public
  // SDK's ISIVTCollection for a command with output arguments and no return value). Not undoable.
  app.register({ name: 'GetSkeleton', label: 'C3DGetSkeletonInfoTask', category: '', undoable: false,
    description: 'Gets the components of the skeleton this object pertains to and its index among them',
    args: [{ name: 'InputObj', default: null }, { name: 'Index', default: 0 }, { name: 'ChainElements', default: null }],
    execute(app, a) {
      const o = objOf(app, a.InputObj) ?? (a.InputObj === null || a.InputObj === undefined || a.InputObj === '' ? app.selectedObjects[0] ?? null : null);
      if (!o) throw new SiStatusError(E_INVALIDARG, 'GetSkeleton: InputObj is not a 3D object');
      const skel = skeletonOf(o);
      if (!skel) throw new SiStatusError(E_INVALIDARG, `GetSkeleton: ${o.fullName} is not part of a skeleton`);
      const out = { Index: skel.indexOf(o), ChainElements: skel };
      a.Index = out.Index; a.ChainElements = out.ChainElements;
      state(app).out.GetSkeleton = out;
      return out;
    } });
}
