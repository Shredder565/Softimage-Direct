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
  fps = 30;
  playing = false;
  private listeners = new Set<(frame: number) => void>();

  get frame() { return this._frame; }
  set frame(f: number) {
    this._frame = f;
    for (const [p, fc] of this.fcurves) if (fc.keys.length) p.value = fc.eval(f);
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
  removeAnimation(p: Parameter) { this.fcurves.delete(p); }

  private timer: number | null = null;
  play() {
    if (this.playing) return;
    this.playing = true;
    let last = performance.now();
    const step = () => {
      if (!this.playing) return;
      const now = performance.now();
      if (now - last >= 1000 / this.fps) {
        last = now;
        let f = this._frame + 1;
        if (f > this.endFrame) f = this.startFrame;
        this.frame = f;
      }
      this.timer = requestAnimationFrame(step);
    };
    this.timer = requestAnimationFrame(step);
  }
  stop() { this.playing = false; if (this.timer !== null) cancelAnimationFrame(this.timer); this.timer = null; }
}
