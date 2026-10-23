// FCurves: keys on a parameter, evaluated per frame. Mirrors Softimage's "fcurve" animation source.
import { Parameter } from './params';

export interface Key { time: number; value: number; }

export class FCurve {
  keys: Key[] = [];
  constructor(readonly param: Parameter) {}
  addKey(time: number, value: number) {
    const k = this.keys.find(k => k.time === time);
    if (k) k.value = value; else { this.keys.push({ time, value }); this.keys.sort((a, b) => a.time - b.time); }
  }
  removeKey(time: number) { this.keys = this.keys.filter(k => k.time !== time); }
  hasKey(time: number) { return this.keys.some(k => k.time === time); }
  eval(time: number): number {
    const ks = this.keys;
    if (!ks.length) return this.param.value;
    if (time <= ks[0].time) return ks[0].value;
    if (time >= ks[ks.length - 1].time) return ks[ks.length - 1].value;
    for (let i = 0; i + 1 < ks.length; i++) {
      const a = ks[i], b = ks[i + 1];
      if (time >= a.time && time <= b.time) {
        const t = (time - a.time) / (b.time - a.time);
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
