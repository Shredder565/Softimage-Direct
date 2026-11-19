// Row CMD-B10 (INFERRED batch): scene-side commands of the registry categories Navigation (folders, NavigateNode,
// environments), Manipulation (UVW transforms, TranslatePivot), Texturing, Camera Sequencer, Scripting, Selection,
// Source, Customization, General, Transform and file that were missing from the command bus.
// See inferredB10Shared.ts for the sources. Registrations marked `// inferred` are reasoned; those marked `// B11d §…` /
// `// B11i §…` follow the wire contracts of docs/ghidra/cmd-b11d-tasks-b10-confirmations-binary.md (tasks.dll) and
// docs/ghidra/cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md (transformmanager.dll), digest
// docs/re/WIRE_CORRECTIONS_B11.md; what those notes mark (inferred) or leave open keeps `// inferred` and its log.
import { App } from '../core/commands';
import { Node, X3DObject, Model, Property, Material, Operator, Camera } from '../core/scene';
import type { Parameter } from '../core/params';
import { str, num as numP, bool } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { projectionOf, sampleOffsets, sampleUVs } from '../core/texturing';
import { findParam } from './index';
import { B10_ARGS } from './inferredB10Args';
import {
  b10, regB10, logNyaB10, unset, num, boolA, constName, listOf, findObj, objsOf, topMoveComponentOp,
  fail, setStatus, E_INVALIDARG, E_ACCESSDENIED, S_FALSE, NAN_SIZE,
} from './inferredB10Shared';
import { registerInferredB10CamSeq } from './inferredB10CamSeq';

const B11D = 'CMD-B11d', B11I = 'CMD-B11i';
const E_NOINTERFACE = 0x80004002;

// ====================================================================== stand-in models
/** Explorer folder (Softimage "Folder" under an object / model): a named list of member nodes. */
export class FolderNode extends Node {
  readonly members: Node[] = [];
  owner: Node | null = null;
  constructor(name: string) { super(name, 'Folder', 'folder'); }
  explorerChildren(): Node[] { return [...this.members]; }
}
export const foldersOf = (n: Node): FolderNode[] => ((n as any).folders ??= []);

/** Source library (materials or image clips). */
export class LibraryNode extends Node {
  readonly items: Node[] = [];
  constructor(name: string, readonly libType: number) { super(name, 'Library', 'folder', [str('Name', name, 'Name')]); }
  explorerChildren(): Node[] { return [...this.items]; }
}
interface LibState { libraries: LibraryNode[]; current: LibraryNode | null }
function libs(app: App): LibState {
  const s = app.scene as any;
  if (!s.libraryState) { const d = new LibraryNode('DefaultLib', 1); d.parent = app.scene; s.libraryState = { libraries: [d], current: d } as LibState; }
  const st = s.libraryState as LibState;
  // every scene material not in another library belongs to the default one
  const def = st.libraries[0]; const owned = new Set(st.libraries.slice(1).flatMap(l => l.items));
  def.items.splice(0, def.items.length, ...app.scene.materials.filter(m => !owned.has(m)));
  return st;
}

/** Camera Sequencer commands: inferredB10CamSeq.ts. */

/** Operator whose evaluation is a script (AddScriptedOp / AddCustomOp); passes geometry through in this build. */
export class ScriptedOperatorB10 extends Operator {
  constructor(name: string, type: string, code: string, language: string, readonly outputs: Node[], readonly inputs: Node[]) {
    super(name, type, [str('Code', code, 'Code'), str('Language', language, 'Language'), bool('Mute', false, 'Mute')]);
  }
}

// ====================================================================== helpers
const outputs = (pairs: Record<string, any>): any[] & Record<string, any> => Object.assign(Object.values(pairs), pairs);
function nodeOf(app: App, x: any): Node | undefined {
  if (x instanceof Node) return x;
  if (typeof x !== 'string' || !x) return undefined;
  const o = findObj(app, x); if (o && (o.fullName === x || o.name === x)) return o;
  const m = app.scene.materials.find(k => k.name === x || k.name === x.split('.').pop()); if (m) return m;
  const ls = libs(app).libraries.find(l => l.name === x || l.name === x.split('.').pop()); if (ls) return ls;
  for (const n of [...app.scene.allObjects()]) for (const f of foldersOf(n)) if (f.name === x || `${n.fullName}.${f.name}` === x) return f;
  if (o) { const rest = x.split('.').slice(1).join('.'); const p = o.allProperties().find(q => q.name === rest || q.type === rest || q.name === rest.split('.').pop()); if (p) return p; }
  return o;
}
const nodesOf = (app: App, arg: any): Node[] => unset(arg) ? [...app.selection] : listOf(arg).map(x => nodeOf(app, x)).filter((n): n is Node => !!n);
/** Integer list from numbers, "1,2,5-7" or "obj.sample[1,2,5-7]". */
function intList(v: any): number[] {
  if (unset(v)) return [];
  if (typeof v === 'number') return [v];
  if (Array.isArray(v)) return v.flatMap(intList);
  const s = String(v); const inner = /\[([^\]]*)\]/.exec(s)?.[1] ?? s; const out: number[] = [];
  for (const part of inner.split(',').map(t => t.trim()).filter(Boolean)) { const m = /^(-?\d+)\s*-\s*(-?\d+)$/.exec(part); if (m) { for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i); } else if (/^-?\d+$/.test(part)) out.push(Number(part)); }
  return out;
}
/** UV property named by an argument: the property itself, "obj..." (its projection) or the first selected object's. */
function uvPropOf(app: App, arg: any): { obj: X3DObject; prop: Property } | null {
  if (arg instanceof Property) { let n: any = arg.parent; while (n && !(n instanceof X3DObject)) n = n.parent; return n ? { obj: n, prop: arg } : null; }
  const o = unset(arg) ? app.selectedObjects[0] : findObj(app, String(arg));
  const p = o ? projectionOf(o) : undefined;
  return o && p ? { obj: o, prop: p } : null;
}
/** Element of a NavigateNode Source: a scene object named exactly (path or name). */
function elementOf(app: App, x: any): X3DObject | undefined {
  if (x instanceof X3DObject) return x;
  const s = String(x ?? ''); const o = findObj(app, s);
  return o && (o.name === s || o.fullName === s || `Scene_Root.${o.name}` === s) ? o : undefined;
}
/** A parameter (an element with a component id) of a Tag / Untag input; objects and unknown names give undefined. */
function paramOfArg(app: App, x: any): Parameter | undefined {
  if (x && typeof x === 'object' && 'def' in x && 'owner' in x) return x as Parameter;
  if (x instanceof Node) return undefined;
  const s = String(x ?? ''); const o = findObj(app, s);
  if (o && (o.name === s || o.fullName === s)) return undefined;
  return findParam(app, s);
}
/** Lock-info records (B11d §3.8): per element, { level bits, type } with type 2 = tag. Shared stand-in for the lock task. */
export function lockRecords(app: App): Map<any, { level: number; type: number }[]> { return ((app as any).lockRecordsB11 ??= new Map()); }
/** Lock check at a level (B11d §3.6 uses level 4): any non-tag record on the element with that bit (or siLockLevelAll). */
export function isLocked(app: App, n: any, level: number): boolean { return (lockRecords(app).get(n) ?? []).some(r => r.type !== 2 && (r.level === 0xffff || !!(r.level & level))); }

/** Parameters of an AnimatableParameters argument: full parameter paths, or the keyable local transform of objects. */
function paramsOfArg(app: App, arg: any): Parameter[] {
  const out: Parameter[] = [];
  const add = (p: Parameter | undefined) => { if (p && !out.includes(p)) out.push(p); };
  if (unset(arg)) { for (const p of app.anim.marked) add(p); if (!out.length) for (const o of app.selectedObjects) o.kinematics.local.params.filter(p => p.keyable).forEach(add); return out; }
  for (const x of listOf(arg)) {
    if (x && typeof x === 'object' && 'def' in x && 'owner' in x) { add(x as Parameter); continue; }
    const s = String(x); const o = findObj(app, s);
    if (o && (o.name === s || o.fullName === s)) o.kinematics.local.params.filter(p => p.keyable).forEach(add);
    else add(findParam(app, s));
  }
  return out;
}

// ====================================================================== registration
export function registerInferredB10Scene(app: App) {
  // Tag is not on the bus either; Untag needs its counterpart, so it is registered here with the registry arguments.
  B10_ARGS.Tag ??= [{ name: 'InputObjs', default: null }, { name: 'Level', default: ':siTagAll:siTags' }, { name: 'SubType', default: 3 }];

  // ---------------------------------------------------------------- folders
  // ---------------------------------------------------------------- folders (B11d §3.3–3.5)
  /** inferred: the hierarchies that take the folder insert interface are those of scene objects (models and the root included). */
  regB10(app, 'CreateFolder', { // B11d §3.3: one new folder inserted under Target; Name set verbatim (no suffixing)
    execute(app, a) {
      if (unset(a.Target)) throw fail('CreateFolder', E_INVALIDARG, 'Target is required');
      const target = nodeOf(app, a.Target);
      if (!(target instanceof X3DObject)) throw fail('CreateFolder', E_NOINTERFACE, `${a.Target} cannot hold a folder`);
      const list = foldersOf(target);
      const f = new FolderNode(String(a.Name ?? '') || 'Folder'); // empty Name: the class default name (inferred: "Folder")
      f.owner = target; f.parent = target;
      app.record('CreateFolder', () => list.push(f), () => list.splice(list.indexOf(f), 1));
      return f;
    },
  });
  /** The folder of a Target, or a plain error naming the command (the message text predates B11d and other checks rely on it). */
  const folderTarget = (C: string, t: any): FolderNode => {
    const f = nodeOf(app, t);
    if (!(f instanceof FolderNode)) throw Object.assign(new Error(`${C}: Target is not a folder`), { status: E_NOINTERFACE });
    return f;
  };
  regB10(app, 'MoveToFolder', { // B11d §3.4 (SPEC-PARTIAL): a non-folder Target fails before any change; InputObjs become members; no return value
    execute(app, a) {
      const f = folderTarget('MoveToFolder', a.Target);
      if (unset(a.InputObjs)) throw fail('MoveToFolder', E_INVALIDARG, 'InputObjs is required');
      const items = nodesOf(app, a.InputObjs).filter(n => n !== f);
      for (const n of items) {
        // inferred (unread worker): members leave the folder they were in
        const prev = [...app.scene.allObjects()].flatMap(o => foldersOf(o)).concat(foldersOf(app.scene.root)).find(g => g !== f && g.members.includes(n));
        if (prev) logNyaB10(app, 'MoveToFolder', `whether ${n.name} leaves its previous folder ${prev.name} (taken out here)`, B11D);
        app.record('MoveToFolder', () => { if (prev) prev.members.splice(prev.members.indexOf(n), 1); if (!f.members.includes(n)) f.members.push(n); },
          () => { f.members.splice(f.members.indexOf(n), 1); if (prev) prev.members.push(n); });
      }
    },
  });
  regB10(app, 'RemoveFromFolder', { // B11d §3.5: a non-folder Target fails at Do (nothing changed); listed members are removed; no return value
    execute(app, a) {
      if (unset(a.Target)) throw fail('RemoveFromFolder', E_INVALIDARG, 'Target is required');
      if (unset(a.InputObjs)) throw fail('RemoveFromFolder', E_INVALIDARG, 'InputObjs is required');
      const f = folderTarget('RemoveFromFolder', a.Target);
      const items = nodesOf(app, a.InputObjs).filter(n => f.members.includes(n));
      for (const n of items) { const i = f.members.indexOf(n); app.record('RemoveFromFolder', () => f.members.splice(f.members.indexOf(n), 1), () => f.members.splice(i, 0, n)); }
    },
  });
  regB10(app, 'RemoveFolder', { // inferred: deletes the folder; its members stay in the scene
    execute(app, a) {
      const f = nodeOf(app, a.InputObjs) ?? app.selection.find(n => n instanceof FolderNode);
      if (!(f instanceof FolderNode) || !f.owner) throw new Error('RemoveFolder: input is not a folder');
      const list = foldersOf(f.owner); const i = list.indexOf(f);
      app.record('RemoveFolder', () => list.splice(list.indexOf(f), 1), () => list.splice(i, 0, f));
      return true;
    },
  });

  // ---------------------------------------------------------------- NavigateNode / environments
  // B11d §3.1: one navigation step from Source in its element hierarchy (here: the scene object tree, models included)
  regB10(app, 'NavigateNode', { // B11d §3.1: NavDirection 1 parent, 2 child, 3 next, 4 previous (polarity inferred), 5 first, 6 last sibling
    undoable: false,
    execute(app, a) {
      const C = 'NavigateNode';
      const src = unset(a.Source) ? undefined : elementOf(app, a.Source);
      if (!src) throw fail(C, E_INVALIDARG, 'Source is not an element');
      const intArg = (v: any, d: number, what: string) => { if (unset(v)) return d; const n = Number(typeof v === 'boolean' ? NaN : v); if (!Number.isInteger(n)) throw fail(C, E_INVALIDARG, `${what} must be an integer`); return n; };
      const dir = intArg(a.NavDirection, 1, 'NavDirection'); if (dir < 1 || dir > 6) throw fail(C, E_INVALIDARG, `NavDirection ${dir} is not 1..6`);
      const filt = intArg(a.NavFilter, 11, 'NavFilter'); if (filt < 1 || filt > 11) throw fail(C, E_INVALIDARG, `NavFilter ${filt} is not 1..11`);
      const sub = intArg(a.NavSubFilter, 1, 'NavSubFilter'); const subOn = sub === 0 ? false : true; // other values keep the previous setting (default 1)
      const loop = boolA(a.NavLoop);
      if (filt <= 9) logNyaB10(app, C, `NavFilter ${filt}: the element-ref type code numbering (E3DELEMREFTYPE); every scene object counts as Source's type`, B11D);
      // filter: NavFilter 10 = none; 11 / 1..9 = same element type (all scene objects here) and, with NavSubFilter 1, the same sub-class (object type)
      const accept = (e: X3DObject) => filt === 10 || !subOn || e.type === src.type;
      // inferred: element flag 0x8 ("skip") is not modelled, nothing is skipped; type 5 elements' separate step helpers are not modelled
      let r: X3DObject | null = null;
      if (dir === 1) r = src.parentObj ?? null; // inferred: the filter applies to the sibling / walk steps only
      else if (dir === 2) r = src.children[0] ?? null;
      else if (!src.parentObj) { // the hierarchy root: depth-first (pre-order) walk of the whole hierarchy until an element passes the filter
        if (dir === 3 || dir === 4) {
          const order: X3DObject[] = []; const walk = (o: X3DObject) => { order.push(o); o.children.forEach(walk); }; walk(src);
          const n = order.length; const i0 = order.indexOf(src);
          for (let k = 1; k < n; k++) { const e = order[(i0 + (dir === 3 ? k : n - k)) % n]; if (accept(e)) { r = e; break; } }
        }
      } else { // below the root: siblings, wrapping with NavLoop (inferred) for next / previous
        const sibs = src.parentObj.children; const n = sibs.length; const i0 = sibs.indexOf(src);
        if (dir === 3 || dir === 4) {
          const s = dir === 3 ? 1 : -1;
          for (let k = 1; k < n; k++) { const j = i0 + s * k; if (!loop && (j < 0 || j >= n)) break; const e = sibs[(j % n + n) % n]; if (accept(e)) { r = e; break; } }
        } else { // 5 first / 6 last: repeat the step until there is no further element
          const s = dir === 6 ? 1 : -1;
          for (let j = i0 + s; j >= 0 && j < n; j += s) if (accept(sibs[j])) r = sibs[j];
        }
      }
      return r ?? src; // nothing found: Source itself
    },
  });
  regB10(app, 'SetCurrentEnvironment', { // inferred: the simulation environment new simulated objects join
    execute(app, a) {
      const env = objsOf(app, a.InputObj)[0];
      if (!env || !env.get('simenv')) throw new Error('SetCurrentEnvironment: input is not a simulation environment');
      const s = app.scene as any; const old = s.currentEnvironment ?? null;
      app.record('SetCurrentEnvironment', () => { s.currentEnvironment = env; }, () => { s.currentEnvironment = old; });
      return env;
    },
  });

  // ---------------------------------------------------------------- UVW transforms
  type Item = { obj: X3DObject; samples: number[] | null };
  /** InputObjs → objects with the samples the components address (null = all samples). */
  const uvItems = (app: App, arg: any): Item[] => {
    const out: Item[] = [];
    const list = unset(arg) ? (app.compSel ? [app.compSel] : app.selectedObjects) : listOf(arg);
    for (const x of list as any[]) {
      if (x && typeof x === 'object' && 'obj' in x && 'kind' in x) { // the component selection
        const m = x.obj.primitive?.mesh(); if (!m) continue; const { start } = sampleOffsets(m); const s: number[] = [];
        if (x.kind === 'polygon') for (const p of x.polygons) m.polygons[p]?.forEach((_: number, k: number) => s.push(start[p] + k));
        else { const pts = x.kind === 'point' ? x.points : new Set([...x.edges].flatMap((e: string) => e.split('-').map(Number))); m.polygons.forEach((f: number[], pi: number) => f.forEach((v: number, k: number) => { if (pts.has(v)) s.push(start[pi] + k); })); }
        out.push({ obj: x.obj, samples: s }); continue;
      }
      if (x instanceof X3DObject) { out.push({ obj: x, samples: null }); continue; }
      const t = String(x); const o = findObj(app, t); if (!o) continue;
      const kind = /\.(sample|pnt|poly|edge)\[/.exec(t)?.[1];
      if (!kind) { out.push({ obj: o, samples: null }); continue; }
      const m = o.primitive?.mesh(); if (!m) continue; const { start } = sampleOffsets(m); const ids = intList(t); const s: number[] = [];
      if (kind === 'sample') s.push(...ids);
      else if (kind === 'poly') for (const p of ids) m.polygons[p]?.forEach((_, k) => s.push(start[p] + k));
      else { const set = new Set(kind === 'pnt' ? ids : []); if (kind === 'edge') logNyaB10(app, 'UVW', 'edge components (edge index → points); use points, polygons or samples'); m.polygons.forEach((f, pi) => f.forEach((v, k) => { if (set.has(v)) s.push(start[pi] + k); })); }
      out.push({ obj: o, samples: s });
    }
    return out;
  };
  /** siUVWAxesFilter is a bit field (B11i §2.3): siU 1, siV 2, siW 4 (siUV 3, siUW 5, siVW 6, siUVW 7 = also when absent). */
  const UVW_BITS: Record<string, number> = { siU: 1, siV: 2, siW: 4, siUV: 3, siUW: 5, siVW: 6, siUVW: 7 };
  const axesOf = (v: any) => {
    const c = constName(v); const bits = c === null ? 7 : typeof c === 'number' ? c : UVW_BITS[c] ?? (Number.isFinite(Number(c)) ? Number(c) : 7);
    return { u: !!(bits & 1), v: !!(bits & 2), w: !!(bits & 4) };
  };
  /** siDeltaMode is read as a boolean (B11i §2.1): siAbsolute 0, siRelative 1; absent = 0 in the reader, the registry default is siRelative. */
  const relative = (v: any) => { const c = constName(v); if (c === null) return true; if (typeof c === 'number') return c !== 0; return c === 'siAbsolute' ? false : c === 'siRelative' ? true : boolA(c); };
  const uvw = (name: 'TranslateUVW' | 'RotateUVW' | 'ScaleUVW') => regB10(app, name, { // B11i §TranslateUVW / RotateUVW / ScaleUVW (SPEC-PARTIAL): argument decoding read; the per-sample apply step is inferred
    execute(app, a) {
      const items = uvItems(app, a.InputObjs); let n = 0;
      const abs = !relative(a.Delta); const ax = axesOf(a.AxesFilter);
      if (abs && name !== 'TranslateUVW') logNyaB10(app, name, 'absolute (siAbsolute) rotate / scale (apply step unread); relative is used', B11I);
      if (name === 'TranslateUVW' && boolA(a.SplitLocalComponents)) logNyaB10(app, name, 'SplitLocalComponents (reference mode 6: moved samples split from shared neighbours)', B11I);
      const z = name === 'ScaleUVW' ? (ax.w ? num(a.Z, 1) : 1) : num(a.Z);
      if (name !== 'RotateUVW' && z !== (name === 'ScaleUVW' ? 1 : 0)) logNyaB10(app, name, 'the W coordinate (this build keeps 2D UVs); the U / V part is applied', B11I);
      // ScaleUVW: X / Y / Z read only for set axis bits (others 1.0); |f| < 1e-12 -> ±1e-12 (0 -> +1e-12)
      const clamp = (f: number) => Math.abs(f) < 1e-12 ? (f < 0 || Object.is(f, -0) ? -1e-12 : 1e-12) : f;
      const sx = clamp(ax.u ? num(a.X, 1) : 1), sy = clamp(ax.v ? num(a.Y, 1) : 1);
      for (const it of items) {
        const pr = !unset(a.TextureProjection) ? uvPropOf(app, a.TextureProjection) : null;
        const prop = pr && pr.obj === it.obj ? pr.prop : projectionOf(it.obj); if (!prop) continue;
        const cur = sampleUVs(it.obj); if (!cur) continue;
        const before = (prop as any).uvs as Float32Array | undefined; const uv = new Float32Array(cur);
        const ids = it.samples ?? Array.from({ length: uv.length / 2 }, (_, i) => i);
        if (!ids.length) continue;
        let pu = 0, pv = 0;
        if (boolA(a.Pivot)) { pu = num(a.PivotU); pv = num(a.PivotV); } else { for (const i of ids) { pu += uv[i * 2]; pv += uv[i * 2 + 1]; } pu /= ids.length; pv /= ids.length; } // inferred: default reference = centre of the samples
        const ar = !unset(a.TextureProjection) && pr ? (num(a.AspectRatio, 1) || 1) : 1; // AspectRatio only with a resolved TextureProjection
        const r = num(a.Z) * Math.PI / 180; const cs = Math.cos(r), sn = Math.sin(r);
        for (const i of ids) {
          let u = uv[i * 2], v = uv[i * 2 + 1];
          if (name === 'TranslateUVW') { if (ax.u) u = abs ? num(a.X) : u + num(a.X); if (ax.v) v = abs ? num(a.Y) : v + num(a.Y); } // inferred: AxesFilter / absolute in the apply step
          else if (name === 'ScaleUVW') { u = pu + (u - pu) * sx; v = pv + (v - pv) * sy; }
          else { const du = (u - pu) * ar, dv = v - pv; u = pu + (du * cs - dv * sn) / ar; v = pv + du * sn + dv * cs; } // Z = the in-plane rotation (B11i); inferred: aspect-corrected
          uv[i * 2] = u; uv[i * 2 + 1] = v;
        }
        if (name === 'RotateUVW' && (num(a.X) !== 0 || num(a.Y) !== 0)) logNyaB10(app, name, 'rotation about U / V (out of the UV plane, changes W); this build keeps 2D UVs', B11I);
        app.record(name, () => { (prop as any).uvs = uv; app.events.emit('scene'); }, () => { (prop as any).uvs = before; app.events.emit('scene'); });
        n += ids.length;
      }
      return n; // inferred: the number of samples changed (the note gives no return value)
    },
  });
  uvw('TranslateUVW'); uvw('RotateUVW'); uvw('ScaleUVW');
  // B11i: TranslatePivot is not implemented in transformmanager.dll (registry: tasks.dll / viewinteraction.dll, unread)
  regB10(app, 'TranslatePivot', { // inferred: X / Y / Z are added to the transform pivot (local pivot position); the pose is not changed
    execute(app, a) {
      const objs = objsOf(app, a.InputObjs);
      for (const o of objs) (['x', 'y', 'z'] as const).forEach((k, i) => { const p = o.kinematics.local.get('ppos' + k); if (p) app.setParam(p, Number(p.value) + num([a.X, a.Y, a.Z][i]), 'TranslatePivot'); });
      return objs.length;
    },
  });

  // ---------------------------------------------------------------- texturing
  for (const name of ['InspectUVW', 'InspectAllUVW'] as const) {
    regB10(app, name, { // inferred: opens the texture projection property page(s) of the input
      undoable: false,
      execute(app, a) {
        const props = objsOf(app, a.InputObjs).map(o => projectionOf(o)).filter((p): p is Property => !!p);
        const pick = name === 'InspectUVW' ? props.slice(0, 1) : props;
        for (const p of pick) app.events.emit('inspect', p);
        if (!pick.length) app.logMsg('info', `${name}: no texture projection on the input`);
        return pick.length;
      },
    });
  }
  /** Pinned flags of a UV property: one bit per element of the cluster it lives on (B11d §3.6). `pinnedSamples` is a derived view. */
  const pinBits = (prop: Property, total: number): Uint8Array => {
    const P = prop as any;
    if (!P.pinnedBits || P.pinnedBits.length !== Math.ceil(total / 8)) P.pinnedBits = new Uint8Array(Math.ceil(total / 8));
    if (!Object.getOwnPropertyDescriptor(P, 'pinnedSamples')) Object.defineProperty(P, 'pinnedSamples', { get() { const s = new Set<number>(); const b: Uint8Array = this.pinnedBits ?? new Uint8Array(0); for (let i = 0; i < b.length * 8; i++) if (b[i >> 3] & (1 << (i & 7))) s.add(i); return s; } });
    return P.pinnedBits;
  };
  const pinCmd = (name: string, mode: 1 | 2 | 3 | 4) => regB10(app, name, { // B11d §3.6: Pin 1, PinAll 2, UnPin 3, UnPinAll 4 on the UVProp's per-element bit array
    execute(app, a) {
      if (unset(a.UVProp)) throw fail(name, E_INVALIDARG, 'UVProp is required');
      const t = uvPropOf(app, a.UVProp); if (!t) throw fail(name, E_INVALIDARG, 'UVProp is not a texture projection');
      const ids = mode === 1 || mode === 3 ? intList(a.UVComponents) : [];
      if ((mode === 1 || mode === 3) && !ids.length) throw fail(name, E_INVALIDARG, 'UVComponents is empty');
      if (isLocked(app, t.prop, 4)) throw fail(name, E_ACCESSDENIED, `${t.prop.name} is locked`);
      const m = t.obj.primitive?.mesh(); const total = m ? sampleOffsets(m).total : 0; // inferred: the complete sample cluster (element = sample)
      if (!total) { setStatus(app, name, S_FALSE); return; }
      if (ids.some(i => !Number.isInteger(i) || i < 0 || i >= total)) throw fail(name, E_INVALIDARG, `UVComponents index out of 0..${total - 1}`);
      const before = new Uint8Array(pinBits(t.prop, total)); const after = new Uint8Array(before);
      if (mode === 2) { after.fill(0xff); } else if (mode === 4) after.fill(0);
      else for (const i of ids) { if (mode === 1) after[i >> 3] |= 1 << (i & 7); else after[i >> 3] &= ~(1 << (i & 7)); }
      app.record(name, () => { (t.prop as any).pinnedBits = new Uint8Array(after); app.events.emit('params'); }, () => { (t.prop as any).pinnedBits = new Uint8Array(before); app.events.emit('params'); });
      setStatus(app, name, 0);
    },
  });
  pinCmd('PinUVComponents', 1); pinCmd('UnPinUVComponents', 3); pinCmd('PinAllUVComponents', 2); pinCmd('UnPinAllUVComponents', 4);
  regB10(app, 'ConnectMap', { // inferred: connects a map property (weight map / texture map / vertex colours) to the Target operator or property
    execute(app, a) {
      const map = nodeOf(app, a.PropObj); const tgt = nodeOf(app, a.Target);
      if (!(map instanceof Property)) throw new Error('ConnectMap: PropObj is not a map property');
      if (!tgt) throw new Error('ConnectMap: no Target');
      const old = (tgt as any).connectedMap ?? null;
      app.record('ConnectMap', () => { (tgt as any).connectedMap = map; }, () => { (tgt as any).connectedMap = old; });
      logNyaB10(app, 'ConnectMap', `how ${tgt.name} evaluates the connected map`);
      return map;
    },
  });

  // ---------------------------------------------------------------- Camera Sequencer, AddToTOC (inferredB10CamSeq.ts)
  registerInferredB10CamSeq(app);


  // ---------------------------------------------------------------- scripted / custom operators
  const addScripted = (C: string, a: Record<string, any>, code: string, type = 'ScriptedOp') => {
    const outs = nodesOf(app, a.OutputObjs); if (!outs.length) throw new Error(`${C}: no output`);
    const ins = unset(a.InputObjs) || /^\{7834CB8C/i.test(String(a.InputObjs)) ? [] : nodesOf(app, a.InputObjs);
    const lang = String(a.Language || 'JScript');
    const op = new ScriptedOperatorB10(String(a.Name || type), type, code, lang, outs, ins);
    const host = outs.find((n): n is X3DObject => n instanceof X3DObject && !!n.primitive);
    if (host?.primitive) { const prim = host.primitive; app.record(C, () => prim.addOperator(op), () => prim.removeOperator(op)); }
    else { const list: Operator[] = ((app as any).scriptedOpsB10 ??= []); app.record(C, () => list.push(op), () => list.splice(list.indexOf(op), 1)); }
    if (!unset(a.ConstructionMode)) logNyaB10(app, C, 'ConstructionMode placement');
    logNyaB10(app, C, `running the ${lang} Update code (the operator is connected and passes its input through)`);
    return op;
  };
  regB10(app, 'AddScriptedOp', { execute: (app, a) => addScripted('AddScriptedOp', a, String(a.Code ?? '')) }); // inferred
  regB10(app, 'AddScriptedOpFromFile', { // inferred
    execute(app, a) { const f = String(a.FileName ?? ''); if (!f) throw new Error('AddScriptedOpFromFile: FileName is required'); return addScripted('AddScriptedOpFromFile', { ...a, Language: a.Language || (/\.(py)$/i.test(f) ? 'Python' : /\.vbs$/i.test(f) ? 'VBScript' : 'JScript') }, hostFs.readFile(f)); },
  });
  regB10(app, 'AddCustomOp', { // inferred: an operator of a registered custom type; no plug-in types exist in this build
    execute(app, a) { if (unset(a.Type)) throw new Error('AddCustomOp: Type is required'); logNyaB10(app, 'AddCustomOp', `the plug-in operator type ${a.Type}`); return addScripted('AddCustomOp', a, '', String(a.Type)); },
  });
  regB10(app, 'ConvertScriptedOp', { // inferred: makes a scripted operator into a self-installed (plug-in) operator definition
    execute(app, a) {
      const n = nodeOf(app, a.Source) ?? app.selection[0];
      const op = n instanceof ScriptedOperatorB10 ? n : (n instanceof X3DObject ? n.primitive?.operators.find(o => o instanceof ScriptedOperatorB10) : undefined);
      if (!op) throw new Error('ConvertScriptedOp: Source is not a scripted operator');
      logNyaB10(app, 'ConvertScriptedOp', 'writing the plug-in file for the converted operator');
      return op.name;
    },
  });

  // ---------------------------------------------------------------- selection: sizes
  const sizeOf = (o: Node) => {
    const stat = o.params.length * 16 + (o instanceof X3DObject ? o.kinematics.local.params.length * 16 + o.allProperties().reduce((s, p) => s + p.params.length * 16, 0) : 0);
    let dyn = 0; const m = o instanceof X3DObject ? o.primitive?.mesh() : null;
    if (m) dyn = m.positions.length * 4 + m.polygons.reduce((s, f) => s + f.length * 4 + 4, 0);
    return { stat, dyn };
  };
  regB10(app, 'GetSize', { // B11d §3.7: exactly one object, else all three outputs are 2^64-1; outputs are doubles
    undoable: false,
    execute(app, a) {
      if (unset(a.InputObjs)) throw fail('GetSize', E_INVALIDARG, 'InputObjs is required');
      const ns = Array.isArray(a.InputObjs) && !a.InputObjs.length ? [] : nodesOf(app, a.InputObjs);
      if (ns.length !== 1) return outputs({ StaticSize: NAN_SIZE, DynamicSize: NAN_SIZE, Value: NAN_SIZE });
      const r = sizeOf(ns[0]);
      logNyaB10(app, 'GetSize', 'the static / dynamic size definitions of C3DInfoReportTraverser (imported); this build\'s parameter / geometry byte estimate is used', B11D);
      return outputs({ StaticSize: r.stat, DynamicSize: r.dyn, Value: r.stat + r.dyn }); // inferred: total = static + dynamic
    },
  });
  regB10(app, 'GenerateInfoReport', { // inferred
    undoable: false,
    execute(app, a) {
      const ns = nodesOf(app, a.InputObjs);
      const lines = ['Name\tStatic\tDynamic', ...ns.map(n => { const r = sizeOf(n); return `${n.fullName}\t${r.stat}\t${r.dyn}`; })];
      const text = lines.join('\n') + '\n';
      if (!unset(a.FileName)) hostFs.writeFile(String(a.FileName), text); else app.logMsg('info', text);
      return text;
    },
  });

  // ---------------------------------------------------------------- source libraries
  regB10(app, 'CreateLibrary', { // inferred: Type 1 = material library (other types are kept as given)
    execute(app, a) {
      const st = libs(app); const base = String(a.Name || 'MaterialLibrary'); let name = base, i = 1;
      while (st.libraries.some(l => l.name === name) || app.scene.materials.some(m => m.name === name)) name = `${base}${i++}`;
      const lib = new LibraryNode(name, num(a.Type, 1)); lib.parent = app.scene;
      if (num(a.Type, 1) !== 1) logNyaB10(app, 'CreateLibrary', `library Type ${a.Type}`);
      app.record('CreateLibrary', () => st.libraries.push(lib), () => st.libraries.splice(st.libraries.indexOf(lib), 1));
      return lib;
    },
  });
  regB10(app, 'MoveToLibrary', { // inferred
    execute(app, a) {
      const st = libs(app); const lib = nodeOf(app, a.Target);
      if (!(lib instanceof LibraryNode)) throw new Error('MoveToLibrary: Target is not a library');
      const items = nodesOf(app, a.InputObjs).filter((n): n is Material => n instanceof Material);
      for (const m of items) {
        const from = st.libraries.find(l => l !== st.libraries[0] && l.items.includes(m)) ?? null;
        app.record('MoveToLibrary', () => { if (from) from.items.splice(from.items.indexOf(m), 1); if (lib !== st.libraries[0] && !lib.items.includes(m)) lib.items.push(m); },
          () => { if (lib.items.includes(m) && lib !== st.libraries[0]) lib.items.splice(lib.items.indexOf(m), 1); if (from) from.items.push(m); });
      }
      libs(app); return items.length;
    },
  });
  regB10(app, 'SetCurrentMaterialLibrary', { // inferred: new materials are listed under the current library
    execute(app, a) {
      const st = libs(app); const lib = nodeOf(app, a.InputObj);
      if (!(lib instanceof LibraryNode)) throw new Error('SetCurrentMaterialLibrary: input is not a library');
      const old = st.current; app.record('SetCurrentMaterialLibrary', () => { st.current = lib; }, () => { st.current = old; });
      return lib;
    },
  });

  // ---------------------------------------------------------------- customization
  regB10(app, 'EditCommand', { // inferred: opens the command editor on CommandName
    undoable: false,
    execute(app, a) {
      const n = String(a.CommandName ?? ''); const def = app.commands.get(n);
      if (!def) { app.logMsg('error', `EditCommand: no command named ${n || '(empty)'}`); return false; }
      logNyaB10(app, 'EditCommand', 'the command editor dialog');
      return true;
    },
  });
  regB10(app, 'CreateAndEditCommand', { // inferred: opens the command editor on a new, empty command
    undoable: false,
    execute(app) { logNyaB10(app, 'CreateAndEditCommand', 'the command editor dialog'); return false; },
  });

  // ---------------------------------------------------------------- general
  regB10(app, 'ReconnectModel', { // inferred
    execute(app, a) {
      const m = objsOf(app, a.Model)[0]; if (!(m instanceof Model)) throw new Error('ReconnectModel: Model is not a model');
      logNyaB10(app, 'ReconnectModel', `restoring the external connections of ${m.name} from "${a.ExternalCnxMappingTemplate ?? ''}"`);
      return 0;
    },
  });
  // B11d §3.8: Tag / Untag are the lock task with SubType 3 / 4; a tag is a lock record of type 2 whose Level is a bitmask of siTags
  const TAG_BITS: Record<string, number> = { siTagNone: 0, siTag1: 1, siTag2: 2, siTag3: 4, siTag4: 8, siTag5: 16, siTag6: 32, siTag7: 64, siTag8: 128, siTag9: 256, siTag10: 512, siTagAll: 1023 }; // public SDK siTags
  const tagLevel = (v: any): number => {
    const c = constName(v); if (c === null) return TAG_BITS.siTagAll; if (typeof c === 'number') return c;
    return String(c).split(/[|+]/).map(t => t.trim()).reduce((m, t) => m | (TAG_BITS[t] ?? (Number.isFinite(Number(t)) ? Number(t) : 0)), 0);
  };
  for (const name of ['Tag', 'Untag'] as const) {
    regB10(app, name, { // B11d §3.8
      execute(app, a) {
        if (unset(a.InputObjs)) throw fail(name, E_INVALIDARG, 'InputObjs is required');
        const sub = Math.trunc(num(a.SubType, name === 'Tag' ? 3 : 4));
        if (sub !== 3 && sub !== 4) { logNyaB10(app, name, `SubType ${sub} (${['lock', 'unlock', 'unlock all'][sub] ?? 'unknown'}: the lock path of this task is not modelled here)`, B11D); return; }
        const level = tagLevel(a.Level);
        if (!level) throw fail(name, E_INVALIDARG, `The tag level ${level} is invalid`); // XSITASKS 1073
        const R = lockRecords(app); const done: Parameter[] = [];
        for (const x of listOf(a.InputObjs)) {
          const p = paramOfArg(app, x);
          if (!p) { app.logMsg('info', `${name}: Warning: XSITASKS 1069: ${x?.fullName ?? x} has no component id; skipped`); continue; }
          done.push(p);
        }
        if (!done.length) { setStatus(app, name, S_FALSE); return; }
        const before = new Map(done.map(p => [p, (R.get(p) ?? []).map(r => ({ ...r }))]));
        app.record(name, () => {
          for (const p of done) {
            const list = R.get(p) ?? []; let tag = list.find(r => r.type === 2);
            if (sub === 3) { if (!tag) list.push(tag = { level: 0, type: 2 }); tag.level |= level; }
            else if (tag) { tag.level &= ~level; if (!tag.level) list.splice(list.indexOf(tag), 1); }
            if (list.length) R.set(p, list); else R.delete(p);
          }
        }, () => { for (const [p, l] of before) { if (l.length) R.set(p, l.map(r => ({ ...r }))); else R.delete(p); } });
        setStatus(app, name, 0);
      },
    });
  }

  // ---------------------------------------------------------------- transform
  regB10(app, 'DeleteMotionDerivator', { // inferred: removes the simulation motion derivator operator(s) of the input
    execute(app, a) {
      let n = 0;
      for (const o of objsOf(app, a.InputObj)) {
        const prim = o.primitive; if (!prim) continue;
        for (const op of prim.operators.filter(q => /motion ?deriv/i.test(q.type) || /motion ?deriv/i.test(q.name))) { const i = prim.operators.indexOf(op); app.record('DeleteMotionDerivator', () => prim.removeOperator(op), () => { prim.operators.splice(i, 0, op); op.parent = prim; (prim as any).dirty = true; }); n++; }
      }
      return n;
    },
  });
  // B11d §3.9 / B11i: MoveComponent is implemented neither in tasks.dll nor in transformmanager.dll (Q12 open; next viewinteraction.dll)
  regB10(app, 'MoveComponent', { // inferred: the transform tool's component move: a Move Component operator on top of each object's stack
    execute(app, a) {
      const named = unset(a.InputObjs) ? (app.compSel ? [app.compSel.obj] : app.selectedObjects) : listOf(a.InputObjs).map(x => findObj(app, x)).filter((o): o is X3DObject => !!o);
      const ops = [...new Set(named)].map(o => topMoveComponentOp(app, o)).filter(Boolean);
      if (boolA(a.SlideComponents)) logNyaB10(app, 'MoveComponent', 'SlideComponents');
      if (boolA(a.PropTagOnly)) logNyaB10(app, 'MoveComponent', 'PropTagOnly (proportional modelling inputs)');
      return outputs({ CreatedObjs: ops, DeletedObjs: [] });
    },
  });

  // ---------------------------------------------------------------- custom preferences
  const customPrefs = (): Map<string, Property> => ((app as any).customPreferencesB10 ??= new Map());
  regB10(app, 'InstallCustomPreferences', { // inferred: a custom property becomes a preference category under Name
    execute(app, a) {
      const p = nodesOf(app, a.InputObjs).find((n): n is Property => n instanceof Property);
      if (!p) throw new Error('InstallCustomPreferences: input is not a custom property');
      const name = String(a.Name || p.name); const M = customPrefs(); const old = M.get(name);
      app.record('InstallCustomPreferences', () => M.set(name, p), () => { if (old) M.set(name, old); else M.delete(name); });
      return name;
    },
  });
  regB10(app, 'RefreshCustomPreferences', { // inferred: re-reads the installed custom preferences
    undoable: false,
    execute(app) { const M = customPrefs(); for (const p of M.values()) app.events.emit('params', p.params[0]); return M.size; },
  });
}
