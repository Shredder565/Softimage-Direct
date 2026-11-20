// Ledger row CMD-B15b, retarget commands of propertytasks.dll (note section 3):
//   siCreateRetargetMapping siWriteRetargetMapping siWriteRetargetComponentData
// Original code from the note's prose. Stand-in model (the note gives slots, not the property's identity): per object a
// "Retarget Mapping" property (type RetargetMapping) holding the two transforms as the nine S/R/T parameters (the
// "mapping" transform = slot 9) and the nine P2M_ parameters (slot 7); a "Retarget Structure" property (type
// RetargetStructure) holding `components`, the list of records the component-data string adds (slot 8).
// Not attested (logged): which of the two transforms siCreateRetargetMapping writes to which slot (here the owner-relative-to-
// rig transform goes to the P2M_ set, the item-relative-to-owner one to the S/R/T set, in the note's order), the identity of
// the category / property GUIDs, the "excluded character" stripped from the component string (here only the whitespace around
// tokens is trimmed), and the handling of a malformed record (logged and ignored).
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Property, threeOrder } from '../core/scene';
import { num } from '../core/params';
import {
  S_OK, E_INVALIDARG, E_POINTER, fail, setStatus, logNya, trace, unset, listOf, nodeArg, toNumber, ownerObject,
} from './propertyTasksB15bShared';

const AXES = ['Sx', 'Sy', 'Sz', 'Rx', 'Ry', 'Rz', 'Tx', 'Ty', 'Tz'] as const;
export const MAPPING_NAME = 'Retarget Mapping', STRUCTURE_NAME = 'Retarget Structure';
const SCALE_FLOOR = 1e-12;

function objectOf(app: App, C: string, v: any): X3DObject {
  if (unset(v)) throw fail(E_POINTER, `${C}: InputObjs is required`);
  const n = nodeArg(app, listOf(v)[0]);
  const o = n instanceof X3DObject ? n : ownerObject(n);
  if (!o) throw fail(E_INVALIDARG, `${C}: the first InputObjs item does not resolve to an object`);
  return o;
}
function ensureProperty(app: App, o: X3DObject, name: string, type: string, defs: any[]): Property {
  const found = o.properties.find(p => p.type === type); if (found) return found;
  const p = new Property(name, type, defs);
  app.record(`Add ${name}`, () => o.addProperty(p), () => o.removeProperty(p));
  return p;
}
const mappingDefs = () => ['', 'P2M_'].flatMap(pre => AXES.map(ax => num(pre + ax, ax[0] === 'S' ? 1 : 0, pre + ax)));
const mappingOf = (app: App, o: X3DObject) => ensureProperty(app, o, MAPPING_NAME, 'RetargetMapping', mappingDefs());

/** S/R/T of a matrix: scale, rotation in degrees (Softimage XYZ order, 0), translation. */
export function toSRT(m: THREE.Matrix4): Record<typeof AXES[number], number> {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
  const e = new THREE.Euler().setFromQuaternion(q, threeOrder(0)), r = 180 / Math.PI;
  return { Sx: s.x, Sy: s.y, Sz: s.z, Rx: e.x * r, Ry: e.y * r, Rz: e.z * r, Tx: p.x, Ty: p.y, Tz: p.z };
}
function writeSet(app: App, prop: Property, prefix: '' | 'P2M_', v: Record<string, number>) {
  const ps = AXES.map(ax => prop.get(prefix + ax)!); const old = ps.map(p => p.value); const nv = AXES.map(ax => v[ax]);
  app.record('Write Retarget Mapping', () => ps.forEach((p, i) => { p.value = nv[i]; }), () => ps.forEach((p, i) => { p.value = old[i]; }));
}
const floorScale = (s: number) => (Math.abs(s) < SCALE_FLOOR ? (s < 0 ? -SCALE_FLOOR : SCALE_FLOOR) : s);

// ------------------------------------------------------------------ siCreateRetargetMapping
function createMapping(app: App, C: string, a: Record<string, any>) {
  if (unset(a.InputObjs)) throw fail(E_POINTER, `${C}: InputObjs is required (the rig reference first)`);
  const items = listOf(a.InputObjs).map(x => nodeArg(app, x)).filter((n): n is X3DObject => n instanceof X3DObject);
  if (!items.length) throw fail(E_INVALIDARG, `${C}: InputObjs holds no 3D object`);
  const root = items[0].globalMatrix().clone();
  { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); root.decompose(p, q, s); root.compose(p, new THREE.Quaternion(), s); }   // rotation zeroed
  const rootInv = root.clone().invert();
  logNya(app, C, 'slot assignment of the two computed transforms and the identity of the mapping property (note "Missing")');
  for (const it of items) {
    const g = it.globalMatrix().clone();
    const owner: X3DObject | null = it.parentObj ? (it.parentObj.model ?? null) : null;   // first primary owner of the model category
    const og = owner ? owner.globalMatrix().clone() : new THREE.Matrix4();
    const ownerRel = rootInv.clone().multiply(og);                        // owner relative to the rig root
    const itemRel = og.clone().invert().multiply(g);                      // item relative to the owner
    const prop = mappingOf(app, it);
    writeSet(app, prop, 'P2M_', toSRT(ownerRel));
    writeSet(app, prop, '', toSRT(itemRel));
  }
  trace(app, 'siCreateRetargetMapping');
  app.events.emit('scene'); setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ siWriteRetargetMapping
function writeMapping(app: App, C: string, a: Record<string, any>) {
  const o = objectOf(app, C, a.InputObjs);
  const v: Record<string, number> = {}, w: Record<string, number> = {};
  for (const ax of AXES) {
    v[ax] = toNumber(a[ax], ax[0] === 'S' ? 1 : 0); w[ax] = toNumber(a['P2M_' + ax], ax[0] === 'S' ? 1 : 0);
    if (ax[0] === 'S') { v[ax] = floorScale(v[ax]); w[ax] = floorScale(w[ax]); }
  }
  const prop = mappingOf(app, o);
  writeSet(app, prop, '', v);       // slot 9 <- the S/R/T transform
  writeSet(app, prop, 'P2M_', w);   // slot 7 <- the P2M_ transform
  trace(app, 'siWriteRetargetMapping');
  app.events.emit('scene'); setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ siWriteRetargetComponentData
export interface RetargetRecord { name0: string; name1: string; chainType: number; items: { objectName: string; role: number }[] }
const CHAIN: Record<string, number> = { ik: 2, ik_contact: 3, fk: 6 };
const ROLE: Record<string, number> = { root: 1, fk: 2, ik_effector: 3, ik_contact: 4, upvector: 5 };
function writeComponentData(app: App, C: string, a: Record<string, any>) {
  const o = objectOf(app, C, a.InputObjs);
  const raw = a['Parameter list'];
  if (raw !== undefined && raw !== null && typeof raw !== 'string') throw fail(E_INVALIDARG, `${C}: "Parameter list" must be a string`);
  const text = String(raw ?? '').trim();
  const prop = ensureProperty(app, o, STRUCTURE_NAME, 'RetargetStructure', []);
  const list: RetargetRecord[] = ((prop as any).components ??= []);
  const old = [...list];
  if (text.toLowerCase() === 'clear') {
    app.record('Clear Retarget Component Data', () => { list.length = 0; }, () => { list.splice(0, list.length, ...old); });
  } else {
    const tok = text.split(',').map(s => s.trim());
    if (tok[tok.length - 1] === '') tok.pop();
    const count = Number(tok[3]);
    if (tok.length < 4 || !Number.isInteger(count) || count < 0 || tok.length < 4 + 2 * count) {
      logNya(app, C, `a malformed component record "${text}" (the note gives the record layout only); nothing added`);
      setStatus(app, C, S_OK); return;
    }
    const items: RetargetRecord['items'] = [];
    for (let i = 0; i < count; i++) items.push({ objectName: tok[4 + 2 * i], role: ROLE[tok[5 + 2 * i].toLowerCase()] ?? 2 });
    const rec: RetargetRecord = { name0: tok[0], name1: tok[1], chainType: CHAIN[tok[2].toLowerCase()] ?? 1, items };
    app.record('Add Retarget Component Data', () => { list.push(rec); }, () => { list.splice(0, list.length, ...old); });
  }
  trace(app, 'siWriteRetargetComponentData');
  app.events.emit('scene'); setStatus(app, C, S_OK);
}

export function registerPropertyTasksB15bRetarget(app: App) {
  app.register({
    name: 'siCreateRetargetMapping', label: 'Set Retarget Mapping Properties', category: 'Animation', description: 'Set Retarget Mapping Properties',
    args: [{ name: 'InputObjs', default: null }], execute: (app, a) => createMapping(app, 'siCreateRetargetMapping', a),
  });
  const triple = (pre: string) => ['Sx', 'Sy', 'Sz'].map(n => ({ name: pre + n, default: 1 })).concat(['Rx', 'Ry', 'Rz', 'Tx', 'Ty', 'Tz'].map(n => ({ name: pre + n, default: 0 })));
  app.register({
    name: 'siWriteRetargetMapping', label: 'Set Retarget Mapping Properties', category: 'Animation', description: 'Set Retarget Mapping Properties',
    args: [{ name: 'InputObjs', default: null as any }, ...triple(''), ...triple('P2M_')], execute: (app, a) => writeMapping(app, 'siWriteRetargetMapping', a),
  });
  app.register({
    name: 'siWriteRetargetComponentData', label: 'Set Retarget Component Information', category: 'Animation', description: 'Set Retarget Component Information',
    args: [{ name: 'InputObjs', default: null }, { name: 'Parameter list', default: '' }], execute: (app, a) => writeComponentData(app, 'siWriteRetargetComponentData', a),
  });
}
