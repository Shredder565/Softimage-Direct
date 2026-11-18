// Row CMD-B10 (INFERRED batch): scene-side commands of the registry categories Navigation (folders, NavigateNode,
// environments), Manipulation (UVW transforms, TranslatePivot), Texturing, Camera Sequencer, Scripting, Selection,
// Source, Customization, General, Transform and file that were missing from the command bus.
// See inferredB10Shared.ts for the sources. All registrations below are `// inferred`.
import { App } from '../core/commands';
import { Node, X3DObject, Model, Property, Material, Operator, Camera } from '../core/scene';
import type { Parameter } from '../core/params';
import { str, num as numP, bool } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { projectionOf, sampleOffsets, sampleUVs } from '../core/texturing';
import { findParam } from './index';
import { cameraSequencer, type ClipX } from '../core/mixerActionScripts';
import { B10_ARGS } from './inferredB10Args';
import {
  b10, regB10, logNyaB10, unset, num, boolA, constName, listOf, findObj, objsOf, topMoveComponentOp,
} from './inferredB10Shared';

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

/** Camera Sequencer: the shot tracks of the existing stand-in (`cameraSequencer(root)`, src/core/mixerActionScripts.ts):
 *  a shot clip `{ name, source: camera, start: sequence frame, duration, type: 'camerashotclip', timectrl.clipin }` covers
 *  the sequence frames [start, start + duration) and maps them to the scene frames from clipin. */
type ShotClip = ClipX;
const seqIn = (c: ShotClip) => Number(c.start);
const seqOut = (c: ShotClip) => Number(c.start) + Number(c.duration);   // exclusive
const sceneFrame = (c: ShotClip, f: number) => Number(c.timectrl?.clipin ?? c.start) + (f - seqIn(c));   // inferred: no time scaling
const shotTracks = (app: App) => cameraSequencer(app.scene.root).tracks;
/** Sampled plots of PlotCamSeqToActions (no action sources in this build). */
export function camSeqPlots(app: App): { name: string; frames: number[]; curves: Record<string, number[]> }[] { return ((app as any).camSeqPlotsB10 ??= []); }
function clipAt(app: App, f: number): ShotClip | null {
  for (const t of shotTracks(app)) for (const c of t.clips) if ((c.type ?? 'camerashotclip') === 'camerashotclip' && f >= seqIn(c) && f < seqOut(c)) return c;
  return null;
}
/** Scene frame for each sequence frame of [s, e]; a gap keeps the sequence frame itself unless gaps are dropped (inferred). */
function frameSet(app: App, s: number, e: number, withoutGaps: boolean): { seq: number; scene: number; clip: ShotClip | null }[] {
  const out: { seq: number; scene: number; clip: ShotClip | null }[] = [];
  for (let f = Math.ceil(s); f <= e; f++) { const c = clipAt(app, f); if (c) out.push({ seq: f, scene: sceneFrame(c, f), clip: c }); else if (!withoutGaps) out.push({ seq: f, scene: f, clip: null }); }
  return out;
}

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
  regB10(app, 'CreateFolder', { // inferred: a named folder under Target (the selection's first object, else the scene root)
    execute(app, a) {
      const target = nodeOf(app, a.Target) ?? app.selection[0] ?? app.scene.root;
      const list = foldersOf(target); const base = String(a.Name || 'Folder');
      let name = base, i = 1; while (list.some(f => f.name === name)) name = `${base}${i++}`;
      const f = new FolderNode(name); f.owner = target; f.parent = target;
      app.record('CreateFolder', () => list.push(f), () => list.splice(list.indexOf(f), 1));
      return f;
    },
  });
  regB10(app, 'MoveToFolder', { // inferred: adds InputObjs to the folder Target (they leave any other folder)
    execute(app, a) {
      const f = nodeOf(app, a.Target); if (!(f instanceof FolderNode)) throw new Error('MoveToFolder: Target is not a folder');
      const items = nodesOf(app, a.InputObjs).filter(n => n !== f);
      for (const n of items) {
        const prev = [...app.scene.allObjects()].flatMap(o => foldersOf(o)).concat(foldersOf(app.scene.root)).find(g => g.members.includes(n));
        app.record('MoveToFolder', () => { if (prev) prev.members.splice(prev.members.indexOf(n), 1); if (!f.members.includes(n)) f.members.push(n); },
          () => { f.members.splice(f.members.indexOf(n), 1); if (prev) prev.members.push(n); });
      }
      return items.length;
    },
  });
  regB10(app, 'RemoveFromFolder', { // inferred
    execute(app, a) {
      const f = nodeOf(app, a.Target); if (!(f instanceof FolderNode)) throw new Error('RemoveFromFolder: Target is not a folder');
      const items = nodesOf(app, a.InputObjs).filter(n => f.members.includes(n));
      for (const n of items) { const i = f.members.indexOf(n); app.record('RemoveFromFolder', () => f.members.splice(f.members.indexOf(n), 1), () => f.members.splice(i, 0, n)); }
      return items.length;
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
  regB10(app, 'NavigateNode', { // inferred: NavDirection as SelectNeighborObj (0 parent, 1 child, 2 previous, 3 next sibling; 4 first, 5 last sibling)
    undoable: false,
    execute(app, a) {
      const src = objsOf(app, a.Source)[0]; if (!src) return null;
      const dir = num(a.NavDirection, 1); const loop = boolA(a.NavLoop);
      if (num(a.NavFilter, 11) !== 11 || num(a.NavSubFilter, 1) !== 1) logNyaB10(app, 'NavigateNode', `NavFilter ${a.NavFilter} / NavSubFilter ${a.NavSubFilter}; every object is accepted`);
      const parent = src.parentObj; const sibs = parent ? parent.children : [src]; const i = sibs.indexOf(src);
      let r: X3DObject | null | undefined = null;
      if (dir === 0) r = parent; else if (dir === 1) r = src.children[0];
      else if (dir === 2) r = i > 0 ? sibs[i - 1] : loop ? sibs[sibs.length - 1] : null;
      else if (dir === 3) r = i < sibs.length - 1 ? sibs[i + 1] : loop ? sibs[0] : null;
      else if (dir === 4) r = sibs[0]; else if (dir === 5) r = sibs[sibs.length - 1];
      else logNyaB10(app, 'NavigateNode', `NavDirection ${dir}`);
      return r ?? null;
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
  const axesOf = (v: any) => { const s = String(constName(v) ?? 'siUVW').replace(/^si/, '').toUpperCase(); return { u: s.includes('U'), v: s.includes('V') }; };
  const uvw = (name: 'TranslateUVW' | 'RotateUVW' | 'ScaleUVW') => regB10(app, name, { // inferred: edits the per-sample UVs of the texture projection
    execute(app, a) {
      const items = uvItems(app, a.InputObjs); let n = 0;
      const abs = constName(a.Delta) === 'siAbsolute'; const ax = axesOf(a.AxesFilter);
      if (abs && name !== 'TranslateUVW') logNyaB10(app, name, 'absolute (siAbsolute) delta; relative is used');
      if (name === 'TranslateUVW' && boolA(a.SplitLocalComponents)) logNyaB10(app, name, 'SplitLocalComponents');
      if (num(a.Z) !== (name === 'ScaleUVW' ? 1 : 0)) logNyaB10(app, name, 'the W coordinate (this build keeps 2D UVs)');
      for (const it of items) {
        const pr = !unset(a.TextureProjection) ? uvPropOf(app, a.TextureProjection) : null;
        const prop = pr && pr.obj === it.obj ? pr.prop : projectionOf(it.obj); if (!prop) continue;
        const cur = sampleUVs(it.obj); if (!cur) continue;
        const before = (prop as any).uvs as Float32Array | undefined; const uv = new Float32Array(cur);
        const ids = it.samples ?? Array.from({ length: uv.length / 2 }, (_, i) => i);
        if (!ids.length) continue;
        let pu = 0, pv = 0;
        if (boolA(a.Pivot)) { pu = num(a.PivotU); pv = num(a.PivotV); } else { for (const i of ids) { pu += uv[i * 2]; pv += uv[i * 2 + 1]; } pu /= ids.length; pv /= ids.length; }
        const ar = num(a.AspectRatio, 1) || 1; const r = num(a.Z) * Math.PI / 180; const cs = Math.cos(r), sn = Math.sin(r);
        for (const i of ids) {
          let u = uv[i * 2], v = uv[i * 2 + 1];
          if (name === 'TranslateUVW') { if (ax.u) u = abs ? num(a.X) : u + num(a.X); if (ax.v) v = abs ? num(a.Y) : v + num(a.Y); }
          else if (name === 'ScaleUVW') { if (ax.u) u = pu + (u - pu) * num(a.X, 1); if (ax.v) v = pv + (v - pv) * num(a.Y, 1); }
          else { const du = (u - pu) * ar, dv = v - pv; u = pu + (du * cs - dv * sn) / ar; v = pv + du * sn + dv * cs; } // inferred: rotation in the UV plane is the Z angle
          uv[i * 2] = u; uv[i * 2 + 1] = v;
        }
        if (name === 'RotateUVW' && (num(a.X) !== 0 || num(a.Y) !== 0)) logNyaB10(app, name, 'rotation about U / V (out of the UV plane)');
        app.record(name, () => { (prop as any).uvs = uv; app.events.emit('scene'); }, () => { (prop as any).uvs = before; app.events.emit('scene'); });
        n += ids.length;
      }
      return n;
    },
  });
  uvw('TranslateUVW'); uvw('RotateUVW'); uvw('ScaleUVW');
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
  const pinCmd = (name: string, pin: boolean, all: boolean) => regB10(app, name, { // inferred: pinned samples stay fixed when UVs are relaxed
    execute(app, a) {
      const t = uvPropOf(app, a.UVProp); if (!t) throw new Error(`${name}: UVProp is not a texture projection`);
      const m = t.obj.primitive?.mesh(); const total = m ? sampleOffsets(m).total : 0;
      const ids = all ? Array.from({ length: total }, (_, i) => i) : intList(a.UVComponents).filter(i => i >= 0 && i < total);
      const set: Set<number> = ((t.prop as any).pinnedSamples ??= new Set<number>()); const before = new Set(set);
      app.record(name, () => { for (const i of ids) pin ? set.add(i) : set.delete(i); }, () => { set.clear(); for (const i of before) set.add(i); });
      return ids.length;
    },
  });
  pinCmd('PinUVComponents', true, false); pinCmd('UnPinUVComponents', false, false); pinCmd('PinAllUVComponents', true, true); pinCmd('UnPinAllUVComponents', false, true);
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

  // ---------------------------------------------------------------- Camera Sequencer
  regB10(app, 'AddShotClip', { // inferred: Parent names the shot camera; Frame is the sequence position, StartFrame..EndFrame the scene frames
    execute(app, a) {
      const tracks = shotTracks(app); const tname = unset(a.Track) ? 'Shot_Track' : String(listOf(a.Track)[0]).split('.').pop()!;
      let track = tracks.find(t => t.name === tname); const made = !track;
      if (!track) track = { name: tname, clips: [] };
      const cam = unset(a.Parent) ? [...app.scene.allObjects()].find(o => o instanceof Camera || o.type === 'camera') : findObj(app, String(a.Parent));
      const start = unset(a.StartFrame) ? app.anim.startFrame : num(a.StartFrame); const end = num(a.EndFrame, 100);
      if (end < start) throw new Error('AddShotClip: EndFrame is before StartFrame');
      const at = unset(a.Frame) ? (track.clips.length ? Math.max(...track.clips.map(seqOut)) : start) : num(a.Frame);
      const base = String(a.Name || 'Shot'); let name = base, i = 1; while (track.clips.some(c => c.name === name)) name = `${base}${i++}`;
      const clip: ShotClip = { name, source: cam?.name ?? '', start: at, duration: end - start + 1, type: 'camerashotclip', timectrl: { clipin: start, clipout: end } };
      const t = track;
      app.record('AddShotClip', () => { if (made && !tracks.includes(t)) tracks.push(t); t.clips.push(clip); }, () => { t.clips.splice(t.clips.indexOf(clip), 1); if (made) tracks.splice(tracks.indexOf(t), 1); });
      return clip;
    },
  });
  regB10(app, 'GetShotClip', { // inferred: GlobalFrame >= 0 is used instead of Frame; between clips the previous clip, not directly over
    undoable: false,
    execute(app, a) {
      const f = num(a.GlobalFrame, -1) >= 0 ? num(a.GlobalFrame) : num(a.Frame);
      let clip = clipAt(app, f); const over = !!clip;
      if (!clip) { let best: ShotClip | null = null; for (const t of shotTracks(app)) for (const c of t.clips) if ((c.type ?? 'camerashotclip') === 'camerashotclip' && seqOut(c) <= f && (!best || seqOut(c) > seqOut(best))) best = c; clip = best; }
      const cam = clip ? findObj(app, String(clip.source)) ?? null : null;
      return outputs({ Clip: clip, DirectlyOver: over, ActiveCamera: cam });
    },
  });
  regB10(app, 'GetSceneFrameSetFromCamSeq', { // inferred
    undoable: false,
    execute(app, a) { return frameSet(app, num(a.StartFrame, 1), num(a.EndFrame, 100), boolA(a.PlotWithoutGaps)).map(x => x.scene); },
  });
  const sample = (app: App, params: Parameter[], set: { scene: number }[]) => {
    const A = app.anim; const saved = A.frame; const curves: Record<string, number[]> = {};
    for (const p of params) curves[p.fullName] = [];
    for (const x of set) { A.frame = x.scene; for (const p of params) curves[p.fullName].push(Number(p.value)); }
    A.frame = saved; return curves;
  };
  regB10(app, 'PlotCamSeqToActions', { // inferred: samples the parameters at the scene frame of each sequence frame; unset InputObjs = every animated parameter (what the sequencer drives)
    execute(app, a) {
      const params = unset(a.InputObjs) ? [...app.anim.fcurves.keys()].filter(p => app.anim.isAnimated(p)) : paramsOfArg(app, a.InputObjs); const set = frameSet(app, num(a.StartFrame, 1), num(a.EndFrame, 100), boolA(a.PlotWithoutGaps));
      if (!params.length || !set.length) { app.logMsg('info', 'PlotCamSeqToActions: nothing to plot'); return null; }
      const act = { name: String(a.ActionName || 'CamSeq_PlotAction'), frames: set.map(x => x.seq), curves: sample(app, params, set) };
      const cs = camSeqPlots(app); app.record('PlotCamSeqToActions', () => cs.push(act), () => cs.splice(cs.indexOf(act), 1));
      logNyaB10(app, 'PlotCamSeqToActions', 'creating the action source / mixer clip and the Apply / Delete / fit options; the sampled curves are kept on the sequencer stand-in (app.camSeqPlotsB10)');
      return [];   // no action source is made in this build, so callers get an empty collection (the sampling is in camSeqPlots)
    },
  });
  regB10(app, 'PlotCamSeqShape', { // inferred: the shape-key counterpart of PlotCamSeqToActions
    execute(app, a) {
      const o = objsOf(app, a.InputObjs)[0]; const set = frameSet(app, num(a.StartFrame, 1), num(a.EndFrame, 100), boolA(a.PlotWithoutGaps));
      if (!o || !set.length) { app.logMsg('info', 'PlotCamSeqShape: nothing to plot'); return null; }
      logNyaB10(app, 'PlotCamSeqShape', `storing shape keys of ${o.name} (Mode / Content / RefMode); the frame set is returned`);
      return set.map(x => x.scene);
    },
  });

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
  regB10(app, 'GetSize', { // inferred: byte estimate of this build's data (static = parameters, dynamic = geometry)
    undoable: false,
    execute(app, a) {
      let s = 0, d = 0; for (const n of nodesOf(app, a.InputObjs)) { const r = sizeOf(n); s += r.stat; d += r.dyn; }
      return outputs({ StaticSize: s, DynamicSize: d, Value: s + d });
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
  const tags = (): Map<Parameter, Set<string>> => ((app.anim as any).paramTagsB10 ??= new Map());
  for (const name of ['Tag', 'Untag'] as const) {
    regB10(app, name, { // inferred: tags are a per-parameter set of level names; siTagAll addresses every level
      execute(app, a) {
        const lv = String(constName(a.Level) ?? 'siTagAll'); const ps = paramsOfArg(app, a.InputObjs); const T = tags();
        const before = new Map(ps.map(p => [p, new Set(T.get(p) ?? [])]));
        app.record(name, () => { for (const p of ps) { const s = T.get(p) ?? new Set<string>(); if (name === 'Tag') s.add(lv); else if (lv === 'siTagAll') s.clear(); else s.delete(lv); if (s.size) T.set(p, s); else T.delete(p); } },
          () => { for (const [p, s] of before) { if (s.size) T.set(p, new Set(s)); else T.delete(p); } });
        if (num(a.SubType, name === 'Tag' ? 3 : 4) !== (name === 'Tag' ? 3 : 4)) logNyaB10(app, name, `SubType ${a.SubType}`);
        return ps.length;
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
