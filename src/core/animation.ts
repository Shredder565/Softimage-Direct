// FCurves: keys on a parameter, evaluated per frame. Mirrors Softimage's "fcurve" animation source.
import { Parameter } from './params';

/** Softimage key: time/value plus optional per-key interpolation (siInterpolation*). */
export interface Key { time: number; value: number; left?: number; right?: number; interp?: number; }

/** Softimage FCurve defaults from PC dump (`si_anim_fcurve_golden.json`): extrap=1, key interp=3 (spline). */
export const SI_FCURVE_EXTRAP_CONSTANT = 1;
export const SI_KEY_INTERP_SPLINE = 3;

export class FCurve {
  keys: Key[] = [];
  /** Softimage FCurve.extrapolation (1 = constant / default in golden dump). */
  extrap = SI_FCURVE_EXTRAP_CONSTANT;
  /** Default key interpolation when a key omits `interp` (3 = spline). */
  interp = SI_KEY_INTERP_SPLINE;
  constructor(readonly param: Parameter) {}
  addKey(time: number, value: number, extra?: Partial<Key>) {
    const k = this.keys.find(k => k.time === time);
    if (k) { k.value = value; if (extra) Object.assign(k, extra); }
    else { this.keys.push({ time, value, left: value, right: value, interp: this.interp, ...extra }); this.keys.sort((a, b) => a.time - b.time); }
  }
  removeKey(time: number) { this.keys = this.keys.filter(k => k.time !== time); }
  hasKey(time: number) { return this.keys.some(k => k.time === time); }
  /** Softimage-style dump used by compare_fcurves.mjs. */
  dump() {
    return { name: 'FCurve', extrap: this.extrap, key_count: this.keys.length, keys: this.keys.map(k => ({ time: k.time, value: k.value, left: k.left ?? k.value, right: k.right ?? k.value, constr: null, interp: k.interp ?? this.interp })) };
  }
  eval(time: number): number {
    const ks = this.keys;
    if (!ks.length) return this.param.value;
    if (time <= ks[0].time) return ks[0].value;
    if (time >= ks[ks.length - 1].time) return ks[ks.length - 1].value;
    for (let i = 0; i + 1 < ks.length; i++) {
      const a = ks[i], b = ks[i + 1];
      if (time >= a.time && time <= b.time) {
        const t = (time - a.time) / (b.time - a.time);
        const kind = a.interp ?? this.interp;
        // Softimage siInterpolation*: 0 constant/step, 1 linear, 3 spline (default golden)
        if (kind === 0) return a.value;
        if (kind === 1) return a.value + (b.value - a.value) * t;
        if ((this as any)._interpName === 'step') return a.value;
        if ((this as any)._interpName === 'linear') return a.value + (b.value - a.value) * t;
        const s = t * t * (3 - 2 * t); // smoothstep ~ default spline ease
        return a.value + (b.value - a.value) * s;
      }
    }
    return ks[ks.length - 1].value;
  }
}

export class AnimationManager {
  readonly fcurves = new Map<Parameter, FCurve>();
  private _frame = 1;
  startFrame = 1;
  endFrame = 100;
  /** Global (scene) range shown in the Timerange panel; the play range is a sub-range of it. */
  globalStart = 1;
  globalEnd = 100;
  fps = 30;
  playing = false;
  /** Playback menu: Play All Frames (false) or Real-Time Playback at `speed` (1, .75, .5, .25). */
  realtime = true; speed = 1;
  /** Loop button / Playback Options: 'loop' | 'once' | 'bounce'. */
  loopMode: 'loop' | 'once' | 'bounce' = 'loop'; private dir = 1;
  playbackView = 'All Views'; updateMode = 'Update All';
  /** Marked parameters (Animation > Parameters, keying panel marks) and named marking sets. */
  readonly marked = new Set<Parameter>(); readonly markingSets = new Map<string, Parameter[]>();
  /** Expressions: param -> source text, evaluated every frame with Fc (current frame) like Softimage's expression language subset. */
  readonly expressions = new Map<Parameter, { text: string; fn: (fc: number, t: number) => number }>();
  private listeners = new Set<(frame: number) => void>();

  get frame() { return this._frame; }
  set frame(f: number) {
    this._frame = f;
    for (const [p, fc] of this.fcurves) if (fc.keys.length) p.value = fc.eval(f);
    for (const [p, ex] of this.expressions) { try { const v = ex.fn(f, f / this.fps); if (Number.isFinite(v)) p.value = v; } catch { /* bad expression: leave the value */ } }
    for (const l of this.listeners) l(f);
  }
  onFrame(l: (f: number) => void) { this.listeners.add(l); return () => this.listeners.delete(l); }
  fcurve(p: Parameter, create = false): FCurve | undefined {
    let fc = this.fcurves.get(p);
    if (!fc && create) { fc = new FCurve(p); this.fcurves.set(p, fc); }
    return fc;
  }
  isAnimated(p: Parameter) { return (this.fcurves.get(p)?.keys.length ?? 0) > 0; }
  setKey(p: Parameter, time = this._frame, value = p.value) { this.fcurve(p, true)!.addKey(time, Number(value)); }
  removeKey(p: Parameter, time = this._frame) { this.fcurves.get(p)?.removeKey(time); }
  removeAnimation(p: Parameter) { this.fcurves.delete(p); this.expressions.delete(p); }
  /** Softimage expression subset: Fc, T, cond(), sin/cos/..., other parameters by script name are resolved by `lookup`. */
  setExpression(p: Parameter, text: string, lookup: (name: string) => Parameter | undefined) {
    const refs: Parameter[] = []; const src = text.replace(/\b([A-Za-z_][\w.]*\.[\w.]+)\b/g, (m) => { const q = lookup(m); if (!q) return m; refs.push(q); return `__r[${refs.length - 1}].value`; });
    const fn = new Function('Fc', 'T', '__r', 'with (Math) { const cond = (c, a, b) => c ? a : b; const PI = Math.PI; return (' + src + '); }') as any;
    this.expressions.set(p, { text, fn: (fc, t) => fn(fc, t, refs) }); this.fcurves.delete(p); this.frame = this._frame;
  }
  expression(p: Parameter) { return this.expressions.get(p)?.text; }
  /** All key times on a set of parameters, sorted. */
  keyTimes(params: Iterable<Parameter>) { const s = new Set<number>(); for (const p of params) for (const k of this.fcurve(p)?.keys ?? []) s.add(k.time); return [...s].sort((a, b) => a - b); }

  private timer: number | null = null;
  play() {
    if (this.playing) return;
    this.playing = true;
    let last = performance.now();
    const step = () => {
      if (!this.playing) return;
      const now = performance.now();
      const dt = this.realtime ? 1000 / (this.fps * this.speed) : 0;
      if (now - last >= dt) {
        const steps = this.realtime ? Math.max(1, Math.floor((now - last) / dt)) : 1; last = now;
        let f = this._frame + steps * this.dir;
        if (this.loopMode === 'bounce') { if (f > this.endFrame) { f = this.endFrame; this.dir = -1; } else if (f < this.startFrame) { f = this.startFrame; this.dir = 1; } }
        else if (f > this.endFrame) { if (this.loopMode === 'once') { this.frame = this.endFrame; this.stop(); return; } f = this.startFrame; }
        this.frame = f;
      }
      this.timer = requestAnimationFrame(step);
    };
    this.timer = requestAnimationFrame(step);
  }
  stop() { this.playing = false; if (this.timer !== null) cancelAnimationFrame(this.timer); this.timer = null; }
}
