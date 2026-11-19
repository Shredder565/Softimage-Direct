// Ledger row CMD-B12c (optasks.dll), part 3: proportional volume queries / toggle and automatic UVs.
//   InspectPropVolume GetConnectedPropVolume TogglePropVolume GenerateAutomaticUVs
// Brief: docs/ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md, section 3. Original code from that prose only.
//
// The proportional volume operator (c3dpropvolumeop) of this build is the "by Volume" reference deformer that
// ApplyPropVolumeOp puts on a mesh (src/core/scene2.ts RefDeformOperator).
import { App, CommandDef } from '../core/commands';
import { X3DObject, Cluster, Operator, Property } from '../core/scene';
import { RefDeformOperator } from '../core/scene2';
import { enumP } from '../core/params';
import {
  S_OK, S_FALSE, E_INVALIDARG, E_POINTER,
  fail, setStatus, warn, errorMsg, logNya, stateOf, unset, nodeOf, collectionItems, objectsOf, meshOf, uniqueClusterName,
} from './optasksB12cShared';

const isPropVolume = (op: Operator): op is RefDeformOperator => op instanceof RefDeformOperator && op.preset === 'by Volume';
/** Input objects with deformable (polygon mesh) geometry; unset = the selection. */
const deformableInputs = (app: App, v: any): X3DObject[] => objectsOf(collectionItems(app, v)).filter(o => !!meshOf(o));
/** The proportional-volume operators of an object's stack, in stack order. */
const propVolumesOf = (o: X3DObject): RefDeformOperator[] => (o.primitive?.operators ?? []).filter(isPropVolume);
function keepSelection<T>(app: App, f: () => T): T {
  const sel = [...app.selection]; const comp = app.compSel; const mode = app.selMode;
  try { return f(); } finally { app.selection = sel; app.compSel = comp; app.selMode = mode; app.events.emit('selection'); }
}

function getConnectedPropVolume(app: App, a: Record<string, any>) {
  const C = 'GetConnectedPropVolume';
  const out: Operator[] = [];
  for (const o of deformableInputs(app, a.InputObjs)) out.push(...propVolumesOf(o));
  a.OutputObjs = out; setStatus(app, C, S_FALSE);
  return out;
}
function inspectPropVolume(app: App, a: Record<string, any>) {
  const C = 'InspectPropVolume';
  const list: Operator[] = app.run('GetConnectedPropVolume', { InputObjs: a.InputObjs }) ?? [];
  if (list.length) {
    // InspectObj with (list, keywords empty, title empty, modal 1). The bus InspectObj of this build resolves scene
    // objects only, so the selection is kept and the property editor is opened on the operator directly.
    keepSelection(app, () => app.run('InspectObj', { InputObjs: list, Keywords: '', Title: '', Mode: 1 }));
    app.events.emit('inspect', list[0]);
    (stateOf(app) as any).lastInspected = list;
  }
  setStatus(app, C, S_FALSE);
  return undefined;
}

function togglePropVolume(app: App, a: Record<string, any>) {
  const C = 'TogglePropVolume';
  const st = stateOf(app);
  for (const o of deformableInputs(app, a.InputObjs)) {
    const ops = propVolumesOf(o);
    // 1. the object's enable state (boolean parameter id 2; stand-in: kept per object, initially "on" when an
    //    unmuted proportional-volume operator is present) -- inferred
    const enabled = st.propVolumeEnabled.get(o) ?? ops.some(op => !op.val('mute'));
    const off = enabled;
    // 2. every proportional-volume operator: its first input's object is collected when switching off; the operator
    //    is updated (inferred: muted when switching off, unmuted when switching on)
    const collected: X3DObject[] = [];
    for (const op of ops) {
      if (off && op.refs[0]) collected.push(op.refs[0]);
      const p = op.get('mute'); if (p) app.setParam(p, off, C);
    }
    if (collected.length) logNya(app, C, `what is done with the collected volume object(s) ${collected.map(c => c.name).join(', ')} (helper 0x180061fb0)`, 'open question 6');
    // 3. none found and switching on: create / initialise one (Initialize PropVolume Task)
    if (!ops.length && !off) {
      keepSelection(app, () => app.run('ApplyPropVolumeOp', { ConnectionSet: o.fullName }));
      logNya(app, C, `the initialisation values of the new proportional volume on ${o.name} (0x180063800 / 0x1800622d0); the operator defaults are kept`, 'open question 6');
    }
    // 4. the new enable state (inferred: the parameter id 2 written by 0x180064710; kept in the stand-in)
    const had = st.propVolumeEnabled.has(o); const old = st.propVolumeEnabled.get(o);
    app.record(C, () => st.propVolumeEnabled.set(o, !off), () => { if (had) st.propVolumeEnabled.set(o, old!); else st.propVolumeEnabled.delete(o); });
    logNya(app, C, `the object parameter id 2 that holds the proportional-volume state of ${o.name}; the state is kept outside the scene (${off ? 'off' : 'on'})`, 'open question 6');
  }
  setStatus(app, C, S_OK);
  return undefined;
}

/** Message ids of GenerateAutomaticUVs (dictionary XSIOPTASKS assumed). */
const MSG_GEN_MISMATCH = 0x111, MSG_NOT_3DOBJECT = 0x112, MSG_UV_EXISTS = 0x162;
/** inferred default UV property name when ClusterPropertyName is empty (open question 7). */
const DEFAULT_UV_NAME = 'Texture_Projection';
function generateAutomaticUVs(app: App, a: Record<string, any>) {
  const C = 'GenerateAutomaticUVs';
  const opNode = nodeOf(app, a.Operator); const objNode = nodeOf(app, a.Object);
  if (!opNode || !objNode) throw fail(E_POINTER, `${C}: ${!opNode ? 'no Operator' : 'no Object'}`);
  // the generator must belong to the object (inferred reading of the matching helper 0x18004b920)
  const owner = objNode instanceof X3DObject ? objNode : null;
  if (!(opNode instanceof Operator) || !owner || !owner.primitive?.operators.includes(opNode)) { errorMsg(app, C, MSG_GEN_MISMATCH); throw fail(E_INVALIDARG, `${C}: the operator is not a generator of the object`); }
  if (!meshOf(owner)) { errorMsg(app, C, MSG_NOT_3DOBJECT); throw fail(E_INVALIDARG, `${C}: ${owner.name} is not a polygon mesh object`); }
  let name = unset(a.ClusterPropertyName) ? '' : String(a.ClusterPropertyName);
  if (!name) { name = DEFAULT_UV_NAME; logNya(app, C, `the default property name when ClusterPropertyName is empty; "${name}" is used`, 'open question 7'); }
  const existing = owner.clusters.filter(c => c.compKind === 'sample').flatMap(c => c.properties).find(p => p.type === 'uvprojection' && p.name === name);
  if (existing) { warn(app, C, MSG_UV_EXISTS, `${owner.name} already has the UV property "${name}"`); a.Value = existing; setStatus(app, C, S_OK); return existing; }
  // the cluster (0x18005dfc0) and the automatic UV cluster property from the generator (0x18005ded0)
  const m = meshOf(owner)!; const n = m.polygons.reduce((s, f) => s + f.length, 0);
  const cl = new Cluster(uniqueClusterName(owner, 'Texture_Coordinates_AUTO'), 'sample', new Set(Array.from({ length: n }, (_, i) => i))); cl.set('alwayscomplete', true);   // inferred cluster name
  const p = new Property(name, 'uvprojection', [enumP('kind', 'Unique UVs', [{ label: 'Unique UVs', value: 'Unique UVs' }], 'Projection')]);
  (p as any).generator = opNode; (p as any).automatic = true;
  app.record('Generate Automatic UV Cluster Property', () => { owner.addCluster(cl); cl.addProperty(p); }, () => { cl.removeProperty(p); owner.removeCluster(cl); });
  logNya(app, C, `how the generator computes the automatic UVs of ${owner.name}; the property holds no coordinates`, 'open question 7');
  a.Value = p; setStatus(app, C, S_OK);
  return p;
}

export function registerOptasksB12cVolumeCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);
  reg({
    name: 'InspectPropVolume', label: 'Inspect PropVolume', category: 'Edit', description: 'Inspect PropVolume Task', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute: (app, a) => inspectPropVolume(app, a),
  });
  reg({
    name: 'GetConnectedPropVolume', label: 'Get Connected PropVolume', category: 'Edit', description: 'Get Connected PropVolume Task', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute: (app, a) => getConnectedPropVolume(app, a),
  });
  reg({
    name: 'TogglePropVolume', label: 'Toggle PropVolume', category: 'Edit', description: 'Toggle PropVolume Task',
    args: [{ name: 'InputObjs', default: null }],
    execute: (app, a) => togglePropVolume(app, a),
  });
  reg({
    name: 'GenerateAutomaticUVs', label: 'Generate an automatic UV cluster property', category: 'Modeling|Generator', description: 'Generate Automatic UV Cluster Property',
    args: [{ name: 'Operator', default: null }, { name: 'Object', default: null }, { name: 'ClusterPropertyName', default: '' }],
    execute: (app, a) => generateAutomaticUVs(app, a),
  });
}
