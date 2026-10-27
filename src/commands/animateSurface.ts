// Animate-tab commands attested by the committed command table (name, category, argument contract).
// Behavioral goldens are used where the dumps and the existing animation model already agree.
// A name with only an argument list is registered and recorded; no solver is invented for it.
import gap from '../data/si/animate_command_gap.json';
import { App } from '../core/commands';
import { FCurve, type Key } from '../core/animation';
import { Parameter } from '../core/params';
import {
  Constraint, DEFORM_TYPES, Property, X3DObject,
  mixerOf, syncMixer, type MixerClip,
} from '../core/scene';
import { mapSetCurveTypeToInterp } from '../core/mixer';
import { findParam } from './index';
import { keyMappingTargets, keyTargets } from './anim';

type GapArg = { name: string; default: unknown };
type GapCommand = {
  scripting_name: string;
  label: string;
  category: string;
  description: string;
  args: GapArg[];
};

const COMMANDS = (gap as { commands: GapCommand[] }).commands;

type Args = Record<string, any>;
type Handler = (app: App, a: Args) => unknown;

const STRIP_DEFORM = new Set<string>([
  ...Object.values(DEFORM_TYPES),
  'lattice', 'wave', 'crvdeform', 'deformbyspineop2',
]);

type KeyClip = { name: string; time: number; value: number; left?: number; right?: number; interp?: number };
let keyClip: KeyClip[] = [];

const paramColor = new WeakMap<Parameter, unknown>();

function contract(app: App, name: string, args: Args) {
  app.logMsg('info', `${name}: attested command (no behavioral golden in the committed Animate dumps)`);
  return { command: name, args };
}

function enumToken(value: unknown): string {
  const m = String(value ?? '').match(/:([A-Za-z0-9_]+):/);
  return m ? m[1] : '';
}

function objectOf(p: Parameter): X3DObject | null {
  let n: any = p.owner;
  while (n && !(n instanceof X3DObject)) n = n.parent;
  return n instanceof X3DObject ? n : null;
}

function listedParams(app: App, spec: unknown): Parameter[] {
  if (spec instanceof Parameter) return [spec];
  if (spec == null || spec === '') return [];
  const out: Parameter[] = [];
  for (const part of String(spec).split(/[;,]/).map(s => s.trim()).filter(Boolean)) {
    const p = findParam(app, part);
    if (p) { out.push(p); continue; }
    const o = app.scene.find(part);
    if (o) out.push(...o.kinematics.local.params.filter(x => x.animatable && !x.def.readOnly));
  }
  return out;
}

/** Null or empty uses the marked set when it has entries, otherwise the Save Key mapping. */
function paramsFrom(app: App, spec: unknown): Parameter[] {
  if (spec instanceof Parameter) return [spec];
  if (spec == null || spec === '') {
    const marked = [...app.anim.marked];
    return marked.length ? marked : keyMappingTargets(app);
  }
  const listed = listedParams(app, spec);
  return listed.length ? listed : paramsFrom(app, null);
}

function keyableOf(app: App, spec: unknown): Parameter[] {
  return paramsFrom(app, spec).filter(p => p.keyable);
}

function markedKeyable(app: App): Parameter[] {
  const marked = [...app.anim.marked].filter(p => p.keyable);
  return marked.length ? marked : keyMappingTargets(app).filter(p => p.keyable);
}

function keyId(p: Parameter, time: number) { return `${p.fullName}@${time}`; }

function curvesOf(app: App, params: Parameter[]): { p: Parameter; fc: FCurve }[] {
  const out: { p: Parameter; fc: FCurve }[] = [];
  for (const p of params) {
    const fc = app.anim.fcurve(p);
    if (fc) out.push({ p, fc });
  }
  return out;
}

function touchKeys(app: App, label: string, fc: FCurve, mutate: (keys: Key[]) => Key[]) {
  const old = fc.keys.map(k => ({ ...k }));
  app.record(label, () => {
    fc.keys = mutate(fc.keys.map(k => ({ ...k }))).sort((a, b) => a.time - b.time);
  }, () => { fc.keys = old; });
}

function inSpan(time: number, start: number, end: number) { return time >= start && time <= end; }

function spanBounds(a: Args): [number, number] {
  return [Number(a.StartFrame ?? 1), Number(a.EndFrame ?? 100)];
}

function selectedOnly(a: Args, p: Parameter, time: number, app: App) {
  return !a.SelectedKeysOnly || app.anim.selectedKeys.has(keyId(p, time));
}

function copySpan(app: App, params: Parameter[], a: Args) {
  const [start, end] = spanBounds(a);
  keyClip = [];
  for (const { p, fc } of curvesOf(app, params)) {
    for (const k of fc.keys) {
      if (!inSpan(k.time, start, end) || !selectedOnly(a, p, k.time, app)) continue;
      keyClip.push({ name: p.def.name, time: k.time, value: k.value, left: k.left, right: k.right, interp: k.interp });
    }
  }
  return keyClip.length;
}

function deleteSpan(app: App, params: Parameter[], a: Args) {
  const [start, end] = spanBounds(a);
  const ripple = !!a.Ripple;
  let n = 0;
  for (const { p, fc } of curvesOf(app, params)) {
    const drop = new Set(fc.keys.filter(k => inSpan(k.time, start, end) && selectedOnly(a, p, k.time, app)).map(k => k.time));
    if (!drop.size) continue;
    n += drop.size;
    touchKeys(app, 'DeleteKeys', fc, keys => {
      const kept = keys.filter(k => !drop.has(k.time));
      if (!ripple) return kept;
      const shift = -(end - start);
      return kept.map(k => k.time > end ? { ...k, time: k.time + shift } : k);
    });
    for (const t of drop) app.anim.selectedKeys.delete(keyId(p, t));
  }
  return n;
}

function mapTime(time: number, pivot: number, scale: number, offset: number) {
  return Math.round((time - pivot) * scale + pivot + offset);
}

function sequenceParams(app: App, a: Args): Parameter[] {
  const token = enumToken(a.Type);
  if (token === 'siAllAnimParams' || token === 'siAnimatedParameters') {
    const host = app.targets(a.InputObjs);
    const out: Parameter[] = [];
    for (const [p, fc] of app.anim.fcurves) {
      if (!fc.keys.length) continue;
      const owner = objectOf(p);
      if (host.length && owner && !host.includes(owner)) continue;
      out.push(p);
    }
    if (out.length) return out;
  }
  return paramsFrom(app, a.InputObjs);
}

function sequenceCurves(app: App, a: Args, ripple: boolean, selected: boolean) {
  const start = Number(a.StartFrame ?? 1);
  const end = Number(a.EndFrame ?? 100);
  const pivot = Number(a.Pivot ?? start);
  const scale = Number(a.Scale ?? 1);
  const offset = Number(a.Offset ?? 0);
  const edge = mapTime(end, pivot, scale, offset) - end;
  let n = 0;
  for (const { p, fc } of curvesOf(app, sequenceParams(app, a))) {
    touchKeys(app, 'Sequence', fc, keys => keys.map(k => {
      const take = (!selected || app.anim.selectedKeys.has(keyId(p, k.time))) && inSpan(k.time, start, end);
      if (take) { n++; return { ...k, time: mapTime(k.time, pivot, scale, offset) }; }
      if (ripple && k.time > end && edge) return { ...k, time: k.time + edge };
      return k;
    }));
  }
  app.events.emit('params');
  return n;
}

function layerIndex(app: App, layer: unknown): number {
  const n = app.anim.layers.length;
  const i = Number(layer);
  if (i === -1) return app.anim.currentLayer >= 0 ? app.anim.currentLayer : n - 1;
  return i;
}

function withLayers(app: App, label: string, mutate: () => void) {
  const old = app.anim.layers.map(l => ({ ...l }));
  const oldCur = app.anim.currentLayer;
  app.record(label, mutate, () => {
    app.anim.layers.splice(0, app.anim.layers.length, ...old.map(l => ({ ...l })));
    app.anim.currentLayer = oldCur;
  });
}

function mixHost(app: App, modelArg: unknown) {
  if (typeof modelArg === 'string' && modelArg) {
    const found = app.scene.find(modelArg);
    if (found) return found.model ?? found;
  }
  return app.selectedObjects[0]?.model ?? app.scene.root;
}

function clipsOf(mix: { } & object): MixerClip[] {
  const s = mix as { clips?: MixerClip[] };
  return s.clips ?? (s.clips = []);
}

function trackRowsOf(mix: object): { name: string; type: string; insertPosition: number }[] {
  const s = mix as { trackRows?: { name: string; type: string; insertPosition: number }[] };
  return s.trackRows ?? (s.trackRows = []);
}

function clipBySpec(clips: MixerClip[], spec: unknown): MixerClip | undefined {
  if (spec && typeof spec === 'object' && 'start' in (spec as object)) return spec as MixerClip;
  if (spec == null || spec === '') return clips[clips.length - 1];
  const name = String(spec);
  return clips.find(c => c.name === name || c.source === name);
}

function storeOverlapping(a: Args): Args {
  const out: Args = {};
  for (const key of ['Model', 'InputObj', 'InputObjs', 'Mode', 'Name', 'RemoveAnim', 'StartFrame', 'EndFrame', 'Consider Time', 'Ripple', 'AddClip', 'ClipOffset', 'IncludeAnimLayers']) {
    const v = a[key];
    if (v === undefined || v === null || v === '') continue;
    out[key] = v;
  }
  if (out.InputObj == null && a.InputObjs != null && a.InputObjs !== '') out.InputObj = a.InputObjs;
  if (out.InputObjs == null && a.InputObj != null && a.InputObj !== '') out.InputObjs = a.InputObj;
  return out;
}

function namedObject(app: App, spec: unknown): X3DObject | undefined {
  if (spec == null || spec === '') return undefined;
  if (spec instanceof X3DObject) return spec;
  return app.targets(spec)[0];
}

function shapeKeys(o: X3DObject | undefined, names: unknown): Property[] {
  if (!o) return [];
  const all = o.properties.filter(p => p.type === 'shapekey');
  if (names == null || names === '') return all;
  const want = new Set(String(names).split(/[;,]/).map(s => s.trim()).filter(Boolean));
  return all.filter(p => want.has(p.name));
}

function cloneShape(dst: X3DObject, sk: Property) {
  const copy = new Property(sk.name, sk.type, sk.params.map(x => ({ ...x.def, value: x.value })));
  dst.addProperty(copy);
  return copy;
}

function externalConstraints(app: App, input: unknown): { obj: X3DObject; cns: Constraint }[] {
  const out: { obj: X3DObject; cns: Constraint }[] = [];
  for (const o of app.targets(input)) {
    for (const pr of o.properties) {
      if (!(pr instanceof Constraint)) continue;
      if (pr.targets.some(t => t.model !== o.model)) out.push({ obj: o, cns: pr });
    }
  }
  return out;
}

function activateCurves(app: App, params: Parameter[], a: Args) {
  const active = a.Activate !== false && a.Activate !== 0 && a.Activate !== '0';
  let n = 0;
  for (const p of params) {
    const fc = app.anim.fcurve(p);
    if (!fc) continue;
    fc.muted = !active;
    if (a.StartFrame != null && a.EndFrame != null) {
      fc.activeStart = Number(a.StartFrame);
      fc.activeEnd = Number(a.EndFrame);
    }
    n++;
  }
  return n;
}

function removeKeyNear(app: App, params: Parameter[], a: Args) {
  const time = a.Time == null ? app.anim.frame : Number(a.Time);
  const tol = Number(a.Tolerance);
  let n = 0;
  for (const { p, fc } of curvesOf(app, params)) {
    const drop = fc.keys.filter(k => tol >= 0 ? Math.abs(k.time - time) <= tol : k.time === time).map(k => k.time);
    if (!drop.length) continue;
    n += drop.length;
    const gone = new Set(drop);
    touchKeys(app, 'RemoveKey', fc, keys => keys.filter(k => !gone.has(k.time)));
    for (const t of drop) app.anim.selectedKeys.delete(keyId(p, t));
  }
  app.events.emit('params');
  return n;
}

function keyParams(app: App, params: Parameter[], time: number, value?: unknown) {
  let n = 0;
  for (const p of params) {
    const v = value == null ? p.value : Number(value);
    app.anim.setKey(p, time, v);
    n++;
  }
  app.events.emit('params');
  return n;
}

const HANDLERS: Record<string, Handler> = {
  ClearMarking(app) {
    const prev = [...app.anim.marked];
    app.record('ClearMarking', () => app.anim.marked.clear(), () => { app.anim.marked.clear(); prev.forEach(p => app.anim.marked.add(p)); });
    app.events.emit('params');
    return 0;
  },
  SetMarking(app, a) {
    const next = a.PathList == null ? keyTargets(app, 'All').filter(p => p.keyable)
      : a.PathList === '' ? [] : listedParams(app, a.PathList);
    const prev = [...app.anim.marked];
    app.record('SetMarking', () => { app.anim.marked.clear(); next.forEach(p => app.anim.marked.add(p)); }, () => { app.anim.marked.clear(); prev.forEach(p => app.anim.marked.add(p)); });
    app.events.emit('params');
    return next.map(p => p.fullName);
  },
  AddToMarking(app, a) {
    const add = a.PathList == null ? keyTargets(app, 'All').filter(p => p.keyable) : listedParams(app, a.PathList);
    for (const p of add) app.anim.marked.add(p);
    app.events.emit('params');
    return add.length;
  },
  RemoveFromMarking(app, a) {
    if (a.PathList === '') { app.anim.marked.clear(); app.events.emit('params'); return 0; }
    const drop = a.PathList == null ? keyTargets(app, 'All').filter(p => p.keyable) : listedParams(app, a.PathList);
    for (const p of drop) app.anim.marked.delete(p);
    app.events.emit('params');
    return drop.length;
  },
  GetMarking(app) { return [...app.anim.marked].map(p => p.fullName); },

  DeleteKeys: (app, a) => deleteSpan(app, paramsFrom(app, a.InputObjs), a),
  CopyKeys: (app, a) => copySpan(app, paramsFrom(app, a.InputObjs), a),
  CutKeys(app, a) {
    const params = paramsFrom(app, a.InputObjs);
    const n = copySpan(app, params, a);
    deleteSpan(app, params, a);
    return n;
  },
  PasteKeys(app, a) {
    const params = paramsFrom(app, a.InputObjs);
    if (!keyClip.length) return 0;
    const [start, end] = spanBounds(a);
    const minT = Math.min(...keyClip.map(k => k.time));
    const shift = a.Offset ? start - minT : 0;
    const relative = Number(a.Relative ?? 0);
    const pasted = keyClip.map(k => ({ ...k, time: k.time + shift, value: k.value + relative }));
    const span = Math.max(...pasted.map(k => k.time)) - Math.min(...pasted.map(k => k.time));
    let n = 0;
    for (const p of params) {
      const mine = pasted.filter(k => k.name === p.def.name);
      if (!mine.length) continue;
      const fc = app.anim.fcurve(p, true)!;
      touchKeys(app, 'PasteKeys', fc, keys => {
        let next = keys;
        if (!a.Merge) next = next.filter(k => !inSpan(k.time, start, end));
        if (a.Ripple && span) next = next.map(k => k.time >= start ? { ...k, time: k.time + span } : k);
        for (const k of mine) {
          const at = next.find(x => x.time === k.time);
          if (at) Object.assign(at, { value: k.value, left: k.left ?? k.value, right: k.right ?? k.value, interp: k.interp });
          else next.push({ time: k.time, value: k.value, left: k.left ?? k.value, right: k.right ?? k.value, interp: k.interp });
          n++;
        }
        return next;
      });
    }
    app.events.emit('params');
    return n;
  },
  SelectKeysInTimespan(app, a) {
    const params = paramsFrom(app, a.InputObjs);
    const mode = String(a.Mode ?? '');
    const op = /Toggle/i.test(mode) ? 'toggle' : /Remove/i.test(mode) ? 'remove' : /Add/i.test(mode) ? 'add' : 'set';
    const lo = a.StartFrame == null ? -Infinity : Number(a.StartFrame);
    const hi = a.EndFrame == null ? Infinity : Number(a.EndFrame);
    if (op === 'set') app.anim.selectedKeys.clear();
    let n = 0;
    for (const { p, fc } of curvesOf(app, params)) {
      for (const k of fc.keys) {
        if (k.time < lo || k.time > hi) continue;
        const id = keyId(p, k.time);
        if (op === 'remove') app.anim.selectedKeys.delete(id);
        else if (op === 'toggle') { if (app.anim.selectedKeys.has(id)) app.anim.selectedKeys.delete(id); else app.anim.selectedKeys.add(id); }
        else app.anim.selectedKeys.add(id);
        n++;
      }
    }
    return n;
  },
  DeselectAllKeys(app) { app.anim.selectedKeys.clear(); return 0; },
  GetKeyInfo(app, a) {
    const p = paramsFrom(app, a.InputObj)[0];
    const fc = p && app.anim.fcurve(p);
    const k = fc?.keys[Number(a.Index) || 0];
    if (!p || !fc || !k) return null;
    return {
      Parameter: k.time,
      LeftValue: k.left ?? k.value,
      RightValue: k.right ?? k.value,
      LeftTanParam: 0, LeftTanValue: 0, RightTanParam: 0, RightTanValue: 0,
      RightSegKind: k.interp ?? fc.interp,
    };
  },
  EvalFCurve(app, a) {
    const p = paramsFrom(app, a.InputObj)[0];
    if (!p) return null;
    const fc = app.anim.fcurve(p);
    const time = a.Time == null ? app.anim.frame : Number(a.Time);
    return fc ? fc.eval(time) : p.value;
  },
  GetFCurveInfo(app, a) {
    const p = paramsFrom(app, a.InputObj)[0];
    const fc = p && app.anim.fcurve(p);
    if (!p || !fc) return null;
    return {
      CurveKind: fc.interp,
      ValueWhenNoKey: p.value,
      NbKeys: fc.keys.length,
      ExtrapolationKind: fc.extrap,
      DefaultSegKind: fc.interp,
      LowClamp: 0,
      HighClamp: 0,
    };
  },
  AddFCurve(app, a) {
    const params = paramsFrom(app, a.InputObjs);
    for (const p of params) app.anim.fcurve(p, true);
    return params.length;
  },
  SetCurveType(app, a) {
    const interp = mapSetCurveTypeToInterp(Number(a.Interpolation) || 0);
    let n = 0;
    for (const { fc } of curvesOf(app, paramsFrom(app, a.InputObjs))) {
      fc.interp = interp;
      for (const k of fc.keys) k.interp = interp;
      n++;
    }
    return n;
  },
  ActivateFCurve: (app, a) => activateCurves(app, paramsFrom(app, a.InputObjs), a),
  ActivateFCurveOnKeyable: (app, a) => activateCurves(app, keyTargets(app, 'All').filter(p => p.keyable), a),
  ActivateFCurveOnMarkedKeyable: (app, a) => activateCurves(app, markedKeyable(app), a),
  Sequence: (app, a) => sequenceCurves(app, a, false, false),
  SISequence: (app, a) => sequenceCurves(app, a, false, false),
  ScaleAndOffset: (app, a) => sequenceCurves(app, a, !!a.Ripple, !!a.SelectedKeysOnly),
  MakeRotationsContinuous: (app) => app.run('MakeRotationKeysContinuous'),
  ConvertQuatToEuler: (app) => app.run('ConvertQuaternionToEuler'),
  ConvertEulerToQuat: (app) => app.run('ConvertEulerToQuaternion'),
  SaveKeyOnMarkedKeyable(app, a) {
    const time = a.Time == null ? app.anim.frame : Number(a.Time);
    let params = markedKeyable(app);
    if (a.ModifiedOnly) params = params.filter(p => app.anim.fcurve(p)?.eval(time) !== p.value);
    return keyParams(app, params, time, a.Value);
  },
  SaveKeyAtMultipleFrames(app) {
    return keyParams(app, [...app.anim.marked], app.anim.frame);
  },
  SaveActionKey(app, a) {
    const time = a.Time == null ? app.anim.frame : Number(a.Time);
    const params = paramsFrom(app, a.InputObjs).filter(p => app.anim.fcurve(p)?.keys.length && !app.anim.expression(p));
    return keyParams(app, params, time, a.Value);
  },
  SavePivotKey(app, a) {
    const time = a.Time == null ? app.anim.frame : Number(a.Time);
    const token = enumToken(a.Type);
    const chans = token === 'siScaling' ? ['scl'] : token === 'siRotation' ? ['rot'] : token === 'siTranslation' ? ['pos'] : ['pos', 'rot', 'scl'];
    const params: Parameter[] = [];
    for (const o of app.targets(a.InputObjs)) for (const ch of chans) for (const ax of ['x', 'y', 'z']) {
      const p = o.kinematics.local.get(ch + ax); if (p) params.push(p);
    }
    return keyParams(app, params, time);
  },
  RemoveKeyOnKeyable: (app, a) => removeKeyNear(app, keyTargets(app, 'All').filter(p => p.keyable), a),
  RemoveKeyOnMarkedKeyable: (app, a) => removeKeyNear(app, markedKeyable(app), a),
  RemoveAllAnimation(app, a) {
    const token = enumToken(a.ParameterMask);
    const branch = enumToken(a.BranchFlag);
    const anySource = enumToken(a.SourceMask) === 'siAnySource';
    const objs = app.targets(a.InputObjs);
    const walk = branch === 'siBranch' || branch === 'siNode';
    const all: X3DObject[] = [];
    const seen = new Set<X3DObject>();
    const push = (o: X3DObject) => { if (seen.has(o)) return; seen.add(o); all.push(o); if (walk) o.children.forEach(push); };
    objs.forEach(push);
    let n = 0;
    const time = a.Time == null ? null : Number(a.Time);
    for (const o of all) {
      const params = /Transform|SRT/i.test(token) || token === 'siTransformParam'
        ? o.kinematics.local.params.filter(p => p.keyable)
        : o.kinematics.local.params.filter(p => p.animatable);
      for (const p of params) {
        const fc = app.anim.fcurve(p);
        if (fc && !a.StaticFCurves && fc.keys.length && fc.keys.every(k => k.value === fc.keys[0].value)) continue;
        if (time != null && fc) { removeKeyNear(app, [p], { Time: time, Tolerance: -1 }); n++; continue; }
        if (fc || (anySource && app.anim.expression(p))) { app.anim.removeAnimation(p); n++; }
      }
    }
    app.events.emit('params');
    return n;
  },
  SetKeyableAttributes(app, a) {
    const listed = listedParams(app, a.Params);
    const params = listed.length ? listed : keyableOf(app, a.InputObjs);
    const keyable = !/NonKeyable|siKeyableAttributeNon/i.test(String(a.Attribute ?? ''));
    for (const p of params) p.def.keyable = keyable;
    app.events.emit('params');
    return params.length;
  },

  AddAnimationLayer(app, a) {
    const name = String(a.Name ?? '');
    const make = a.MakeCurrent !== false && a.MakeCurrent !== 0;
    let index = -1;
    withLayers(app, 'AddAnimationLayer', () => {
      app.anim.layers.push({ name, locked: false });
      index = app.anim.layers.length - 1;
      if (make) app.anim.currentLayer = index;
    });
    return { name, index };
  },
  DeleteAnimationLayer(app, a) {
    const i = layerIndex(app, a.Layer);
    if (i < 0 || i >= app.anim.layers.length) return null;
    withLayers(app, 'DeleteAnimationLayer', () => {
      app.anim.layers.splice(i, 1);
      if (app.anim.currentLayer >= app.anim.layers.length) app.anim.currentLayer = app.anim.layers.length - 1;
    });
    return i;
  },
  DuplicateAnimationLayer(app, a) {
    const i = layerIndex(app, a.Layer);
    const src = app.anim.layers[i];
    if (!src) return null;
    withLayers(app, 'DuplicateAnimationLayer', () => {
      app.anim.layers.splice(i + 1, 0, { name: src.name, locked: false });
    });
    return { name: src.name, index: i + 1 };
  },
  LockAnimationLayer(app, a) {
    const i = layerIndex(app, a.Layer);
    const layer = app.anim.layers[i];
    if (!layer) return null;
    withLayers(app, 'LockAnimationLayer', () => { app.anim.layers[i].locked = true; });
    return true;
  },
  UnlockAnimationLayer(app, a) {
    const i = layerIndex(app, a.Layer);
    const layer = app.anim.layers[i];
    if (!layer) return null;
    withLayers(app, 'UnlockAnimationLayer', () => { app.anim.layers[i].locked = false; });
    return true;
  },
  IsAnimationLayerLocked(app, a) {
    const layer = app.anim.layers[layerIndex(app, a.Layer)];
    return !!layer?.locked;
  },
  SetCurrentAnimationLayer(app, a) {
    let i = Number(a.Layer);
    if (a.CreateLayer && (i < 0 || i >= app.anim.layers.length)) {
      withLayers(app, 'SetCurrentAnimationLayer', () => {
        app.anim.layers.push({ name: '', locked: false });
        app.anim.currentLayer = app.anim.layers.length - 1;
      });
      return app.anim.currentLayer;
    }
    if (i === -1) i = app.anim.currentLayer >= 0 ? app.anim.currentLayer : app.anim.layers.length - 1;
    if (i < 0 || i >= app.anim.layers.length) return null;
    app.anim.currentLayer = i;
    return i;
  },
  GetCurrentAnimationLayer: (app) => app.anim.currentLayer,
  GetNumberOfAnimationLayers: (app) => app.anim.layers.length,

  AddTrack(app, a) {
    const mix = mixerOf(mixHost(app, a.Model));
    const rows = trackRowsOf(mix);
    const row = { name: String(a.Name ?? ''), type: String(a.Type ?? '4294967295'), insertPosition: Number(a.InsertPosition ?? -1) };
    const at = row.insertPosition;
    if (at >= 0 && at < rows.length) rows.splice(at, 0, row);
    else rows.push(row);
    syncMixer(mix);
    return { name: row.name, type: row.type };
  },
  AddMarker(app, a) {
    const mix = mixerOf(mixHost(app, a.Model));
    let list: { name: string; time: number; duration: number }[] = [];
    try {
      const parsed = JSON.parse(String(mix.val('markers') || '[]'));
      if (Array.isArray(parsed)) list = parsed;
    } catch { list = []; }
    list.push({ name: String(a.Name ?? ''), time: a.Time == null ? app.anim.frame : Number(a.Time), duration: Number(a.Duration ?? 0) });
    mix.set('markers', JSON.stringify(list));
    return list.length;
  },
  TrimBefore(app, a) {
    const mix = mixerOf(mixHost(app, null));
    const clip = clipBySpec(clipsOf(mix), a.Clip);
    if (!clip) return null;
    const time = a.Time == null ? app.anim.frame : Number(a.Time);
    if (time > clip.start) {
      clip.duration = Math.max(0, clip.duration - (time - clip.start));
      clip.start = time;
    }
    syncMixer(mix);
    return { start: clip.start, duration: clip.duration };
  },
  TrimAfter(app, a) {
    const mix = mixerOf(mixHost(app, null));
    const clip = clipBySpec(clipsOf(mix), a.Clip);
    if (!clip) return null;
    const time = a.Time == null ? app.anim.frame : Number(a.Time);
    if (time > clip.start) clip.duration = time - clip.start;
    syncMixer(mix);
    return { start: clip.start, duration: clip.duration };
  },
  ClipMatch(app, a) {
    const mix = mixerOf(mixHost(app, null));
    const clips = clipsOf(mix);
    let first: MixerClip | undefined;
    let second: MixerClip | undefined;
    if (a.InputObj == null || a.InputObj === '') {
      first = clips[clips.length - 2];
      second = clips[clips.length - 1];
    } else {
      first = clipBySpec(clips, a.InputObj);
      const i = first ? clips.indexOf(first) : -1;
      second = i >= 0 ? clips[i + 1] : undefined;
    }
    if (!first || !second) return null;
    second.start = first.start + first.duration;
    syncMixer(mix);
    return { start: second.start };
  },
  CreateOffsetEffect(app, a) {
    const mix = mixerOf(mixHost(app, null));
    const clip = clipBySpec(clipsOf(mix), a.Clip);
    if (!clip) return null;
    clip.offsetEffect = true;
    syncMixer(mix);
    return { name: clip.name, offsetEffect: true };
  },
  CreateScaleEffect(app, a) {
    const mix = mixerOf(mixHost(app, null));
    const clip = clipBySpec(clipsOf(mix), a.Clip);
    if (!clip) return null;
    clip.scaleEffect = true;
    syncMixer(mix);
    return { name: clip.name, scaleEffect: true };
  },
  RemoveEffect(app, a) {
    const mix = mixerOf(mixHost(app, null));
    const clip = clipBySpec(clipsOf(mix), a.Clip);
    if (!clip) return null;
    clip.offsetEffect = false;
    clip.scaleEffect = false;
    clip.weightKeys = undefined;
    syncMixer(mix);
    return { name: clip.name };
  },
  ResetOffset(app, a) { return resetClipCurves(app, a.InputObjs ?? a.Clip); },
  ResetEffectAtFrame(app, a) { return resetClipCurves(app, a.Clip); },
  ResetAllEffectCurves(app, a) { return resetClipCurves(app, a.Clip); },
  ResetSelectedEffectCurves(app, a) { return resetClipCurves(app, a.Clip); },
  GetStoreActionDefaults(app) {
    const animated = [...app.anim.fcurves.values()].filter(fc => fc.keys.length).length;
    return { From: app.anim.startFrame, To: app.anim.endFrame, Size: animated };
  },
  CollapseLayers(app, a) {
    const stored = app.run('StoreAction', storeOverlapping(a));
    if (app.anim.layers.length > 1) {
      withLayers(app, 'CollapseLayers', () => { app.anim.layers.splice(1); app.anim.currentLayer = app.anim.layers.length ? 0 : -1; });
    }
    return { stored: stored && stored.name, layers: app.anim.layers.length };
  },
  GetDrivingActions(app, a) {
    const clips = clipsOf(mixerOf(mixHost(app, a.Model)));
    const time = a.Time == null ? app.anim.frame : Number(a.Time);
    const consider = a['Consider Time'] === true || a['Consider Time'] === 1;
    const keepInactive = a['Keep Inactive Actions'] === true;
    return clips.filter(c => (keepInactive || !c.mute) && (!consider || (time >= c.start && time < c.start + c.duration))).map(c => c.source);
  },
  RemoveActionItem(app, a) {
    const name = String(a.Name || a.Source || '');
    if (!name) return null;
    const mix = mixerOf(mixHost(app, null));
    const clips = clipsOf(mix);
    const i = clips.findIndex(c => c.name === name || c.source === name);
    if (i < 0) return null;
    clips.splice(i, 1);
    syncMixer(mix);
    return name;
  },

  SaveShapeKey: (app, a) => app.run('StoreShapeKey', { InputObj: a.InputObj, Name: a.Name, Frame: a.Time }),
  CopyShape(app, a) {
    const src = namedObject(app, a.Source);
    const dst = namedObject(app, a.Target);
    if (!src || !dst) {
      app.logMsg('info', 'CopyShape: Source and Target are required');
      return null;
    }
    const keys = src.properties.filter(p => p.type === 'shapekey');
    for (const sk of keys) cloneShape(dst, sk);
    app.events.emit('scene');
    return keys.length;
  },
  TransferShapeAnimation(app, a) { return transferShapes(app, a); },
  SITransferShapeAnimation(app, a) { return transferShapes(app, a); },
  StripDeformOperators(app, a) {
    let n = 0;
    for (const o of app.targets(a.InputObj)) {
      const prim = o.primitive; if (!prim) continue;
      for (const op of [...prim.operators]) {
        if (!STRIP_DEFORM.has(op.type) || op.type === 'shapblend') continue;
        prim.removeOperator(op);
        n++;
      }
    }
    app.events.emit('scene');
    return n;
  },

  ApplyPath(app, a) {
    if (a.Path == null || a.Path === '') { app.logMsg('info', 'ApplyPath: Path is required'); return null; }
    const pathObj = app.targets(a.Path)[0];
    if (!pathObj) { app.logMsg('info', 'ApplyPath: Path is required'); return null; }
    const created = app.run('ApplyCns', { Preset: 'Path', InputObjs: a.InputObjs, Target: pathObj });
    const list = (Array.isArray(created) ? created : created ? [created] : []) as Constraint[];
    const nKeys = Number(a.NbKeys ?? 0);
    const start = Number(a.StartFrame ?? 0);
    const end = Number(a.EndFrame ?? 0);
    for (const c of list) {
      if (!c?.get) continue;
      if (c.get('tangent')) c.set('tangent', !!a.Tangent);
      const perc = c.get('perc');
      if (!perc || nKeys <= 0) continue;
      for (let i = 0; i < nKeys; i++) {
        const t = nKeys === 1 ? start : start + ((end - start) * i) / (nKeys - 1);
        const v = nKeys === 1 ? 0 : (100 * i) / (nKeys - 1);
        app.anim.setKey(perc, t, v);
      }
      if (a.Linear) {
        const fc = app.anim.fcurve(perc);
        const interp = mapSetCurveTypeToInterp(2);
        if (fc) { fc.interp = interp; for (const k of fc.keys) k.interp = interp; }
      }
    }
    return { path: pathObj.name, count: list.length };
  },
  SelectExternalConstraints(app, a) {
    const found = externalConstraints(app, a.InputObj);
    app.select(found.map(x => x.cns));
    return found.length;
  },
  ActivateExternalConstraints(app, a) {
    let n = 0;
    for (const { cns } of externalConstraints(app, a.InputObj)) {
      const p = cns.get('active'); if (p) app.setParam(p, true); n++;
    }
    return n;
  },
  DeactivateExternalConstraints(app, a) {
    let n = 0;
    for (const { cns } of externalConstraints(app, a.InputObj)) {
      const p = cns.get('active'); if (p) app.setParam(p, false); n++;
    }
    return n;
  },
  RemoveExternalConstraints(app, a) {
    let n = 0;
    for (const { obj, cns } of externalConstraints(app, a.InputObj)) { obj.removeProperty(cns); n++; }
    app.events.emit('scene');
    return n;
  },

  SceneRefresh(app) {
    app.setTool(null);
    app.events.emit('scene');
    return null;
  },
  SetParameterColor(app, a) {
    const params = paramsFrom(app, a.InputObjs);
    for (const p of params) paramColor.set(p, a.Value);
    return params.length;
  },
  ClearParameterColor(app, a) {
    const params = paramsFrom(app, a.InputObjs);
    for (const p of params) paramColor.delete(p);
    return params.length;
  },
  ToggleBooleanUserPrefProc(app, a) {
    if (String(a.UserPref) === '3D_TRANSFO_PROPORTIONAL_CHANGED') {
      app.proportional.on = !app.proportional.on;
      app.events.emit('selection');
      return app.proportional.on;
    }
    return contract(app, 'ToggleBooleanUserPrefProc', a);
  },
  SIAddCustomParam(app, a) {
    if (a.InputObj) app.run('SelectObj', { InputObjs: a.InputObj });
    return app.run('AddCustomParameter', {
      Name: a.ScriptName || 'ParamName',
      Default: a.DefaultValue, Min: a.MinValue, Max: a.MaxValue,
    });
  },
};

function resetClipCurves(app: App, spec: unknown) {
  const mix = mixerOf(mixHost(app, null));
  const clip = clipBySpec(clipsOf(mix), spec);
  if (!clip) return null;
  clip.weightKeys = undefined;
  syncMixer(mix);
  return { name: clip.name };
}

function transferShapes(app: App, a: Args) {
  const src = namedObject(app, a.SourceObject);
  const dst = namedObject(app, a.DestinationObject);
  if (!src || !dst) { app.logMsg('info', 'TransferShapeAnimation: SourceObject and DestinationObject are required'); return null; }
  const keys = shapeKeys(src, a.SourceShapeKeys);
  for (const sk of keys) cloneShape(dst, sk);
  app.events.emit('scene');
  return keys.length;
}

const PLOT_TO_STORE = new Set([
  'PlotToAction', 'PlotToActions', 'PlotAndApplyActions', 'PlotKeyableToActions',
  'PlotConstrainedTransformsToActions', 'PlotFrameSetToActions',
  'GetInputAndStoreAction', 'GetInputAndStoreAction2', 'SIStoreAction',
]);

for (const name of PLOT_TO_STORE) {
  HANDLERS[name] = (app, a) => {
    const stored = app.run('StoreAction', storeOverlapping(a));
    const apply = name === 'PlotAndApplyActions' && (a.Apply === true || a.Apply === 1 || a.Apply === '1');
    if (apply) app.run('ApplyAction', stored?.name ? { Source: stored.name } : {});
    return stored?.name ? { name: stored.name, applied: apply } : null;
  };
}

export function registerAnimateSurfaceCommands(app: App) {
  for (const spec of COMMANDS) {
    if (app.commands.has(spec.scripting_name)) continue;
    const name = spec.scripting_name;
    const query = /^(Get|Is|Eval)/.test(name) || name === 'SceneRefresh';
    app.register({
      name,
      label: spec.label || name,
      category: spec.category || 'Animation',
      description: spec.description || undefined,
      args: spec.args.map(arg => ({ name: arg.name, default: arg.default })),
      undoable: !query,
      execute: HANDLERS[name] ?? ((host, args) => contract(host, name, args)),
    });
  }
}
