// Softimage Animation Mixer evaluation: clip weights + transition crossfades → blended action values.
// Nested Sources/Tracks/Transitions/Compounds live on the Mixer property (see makeMixer / syncMixer).
import type { Parameter } from './params';
import { Property, type MixerClip, type MixerTransition, mixerOf, syncMixer, type X3DObject } from './scene';
import { FCurve } from './animation';

/** Minimal app surface used by mixer eval (avoids circular import with commands.ts). */
export type MixerHost = {
  anim: { frame: number; onFrame(l: (f: number) => void): () => void };
  scene: {
    root: { properties: Property[]; property(t: string): Property | undefined; addProperty(p: Property): Property };
    find(name: string): X3DObject | undefined;
    allObjects?(): Iterable<X3DObject>;
  };
  selectedObjects: { model?: { properties: Property[]; property?(t: string): Property | undefined; addProperty?(p: Property): Property } | null }[];
  events: { emit(e: string, d?: any): void };
};

export type ClipWeight = { clip: MixerClip; weight: number; localTime: number };

/** Softimage-like clip weight at `frame`, with standard/bridge crossfade over transition.length ending at the destination clip start. */
export function clipWeightsAt(frame: number, clips: MixerClip[], transitions: MixerTransition[]): ClipWeight[] {
  const byName = new Map(clips.map(c => [c.name, c]));
  const out: ClipWeight[] = [];
  for (const clip of clips) {
    if (clip.mute) continue;
    const end = clip.start + clip.duration;
    let w = frame >= clip.start && frame < end ? 1 : 0;
    let localTime = frame - clip.start;
    for (const tr of transitions) {
      if (tr.from !== clip.name && tr.to !== clip.name) continue;
      const to = byName.get(tr.to); if (!to) continue;
      const len = Math.max(1, Number(tr.length) || 1);
      const t0 = to.start - len;
      const t1 = to.start;
      if (frame < t0 || frame >= t1) continue;
      const u = (frame - t0) / len;
      if (tr.kind === 'timewarp') {
        // Time-warp: stretch local time of `from` into the transition window, fade to `to`.
        if (clip.name === tr.from) { w = 1 - u; localTime = u * clip.duration; }
        else if (clip.name === tr.to) { w = u; localTime = frame - clip.start; }
      } else {
        // standard + bridge: linear crossfade
        if (clip.name === tr.from) w = 1 - u;
        else if (clip.name === tr.to) { w = Math.max(w, u); if (frame < clip.start) localTime = 0; }
      }
    }
    w *= Number(clip.weight ?? 1);
    if (w > 1e-8) out.push({ clip, weight: w, localTime });
  }
  // Normalize non-additive clips per track; additive clips keep raw weight (layer on top).
  const byTrack = new Map<number, ClipWeight[]>();
  for (const x of out) {
    const t = x.clip.track ?? 0;
    if (!byTrack.has(t)) byTrack.set(t, []);
    byTrack.get(t)!.push(x);
  }
  const normed: ClipWeight[] = [];
  for (const group of byTrack.values()) {
    const replace = group.filter(x => !x.clip.additive);
    const add = group.filter(x => x.clip.additive);
    const sum = replace.reduce((s, x) => s + x.weight, 0);
    if (sum > 0) for (const x of replace) x.weight /= sum;
    normed.push(...replace, ...add);
  }
  return normed;
}

function actionPayload(src: Property): { values: Record<string, number>; fcurves: Record<string, { time: number; value: number; interp?: number; left?: number; right?: number }[]> } {
  let values: Record<string, number> = {}; let fcurves: any = {};
  try { values = JSON.parse(src.val('data') || '{}'); } catch { /* */ }
  try { fcurves = JSON.parse(src.val('fcurves') || '{}'); } catch { /* */ }
  return { values, fcurves };
}

function sampleSource(src: Property, localTime: number, lookup: (path: string) => Parameter | undefined): Record<string, number> {
  const { values, fcurves } = actionPayload(src);
  const out: Record<string, number> = { ...values };
  for (const [path, keys] of Object.entries(fcurves)) {
    if (!keys?.length) continue;
    const t0 = keys[0].time;
    const fc = new FCurve(lookup(path) ?? ({ value: keys[0].value, def: { name: path } } as any));
    fc.keys = keys.map(k => ({ time: k.time, value: k.value, left: k.left ?? k.value, right: k.right ?? k.value, interp: k.interp ?? 3 }));
    // Action local time 0 maps to first key time (Softimage clip-relative sampling).
    out[path] = fc.eval(t0 + localTime);
  }
  return out;
}

export type MixerEvalResult = { frame: number; weights: ClipWeight[]; values: Record<string, number> };

function resolveParam(app: MixerHost, path: string): Parameter | undefined {
  // Paths from StoreAction are Parameter.fullName, e.g. "cube.kine.local.posx".
  const scene = app.scene as MixerHost['scene'] & { allObjects?: () => Iterable<X3DObject> };
  let obj: X3DObject | undefined = app.scene.find(path.split('.')[0]);
  if (!obj && scene.allObjects) {
    for (const o of scene.allObjects()) {
      if (path === o.fullName || path.startsWith(o.fullName + '.')) { obj = o; break; }
    }
  }
  if (!obj) return undefined;
  const rest = path.startsWith(obj.fullName + '.') ? path.slice(obj.fullName.length + 1) : path.slice(path.indexOf('.') + 1);
  const name = rest.split('.').pop()!;
  const rl = rest.toLowerCase();
  if (rl.includes('kine.local.') || rl.includes('kinematics.local.')) return obj.kinematics.local.get(name);
  if (rl.includes('kine.global.') || rl.includes('kinematics.global.')) return obj.kinematics.global.get(name);
  return obj.kinematics.local.get(name);
}

/** Evaluate the mixer at `frame` and optionally write blended values onto scene parameters. */
export function evaluateMixer(app: MixerHost, frame = app.anim.frame, apply = true): MixerEvalResult {
  const host = (app.selectedObjects[0]?.model as any) ?? app.scene.root;
  const mix = mixerOf(host);
  if (!mix.val('Active')) return { frame, weights: [], values: {} };
  const clips: MixerClip[] = (mix as any).clips ?? [];
  const transitions: MixerTransition[] = (mix as any).transitions ?? [];
  const weights = clipWeightsAt(frame, clips, transitions);
  const sources = new Map<string, Property>();
  for (const p of [...(host.properties ?? []), ...app.scene.root.properties]) if (p.type === 'actionsource') sources.set(p.name, p);

  const lookup = (path: string) => resolveParam(app, path);

  // Tracks evaluated low→high; additive clips add delta vs base value.
  const ordered = [...weights].sort((a, b) => (a.clip.track ?? 0) - (b.clip.track ?? 0));
  const values: Record<string, number> = {};
  for (const cw of ordered) {
    const src = sources.get(cw.clip.source); if (!src) continue;
    const vals = sampleSource(src, cw.localTime, lookup);
    for (const [path, v] of Object.entries(vals)) {
      if (!Number.isFinite(v)) continue;
      if (cw.clip.additive) {
        // Softimage additive layer: accumulate weighted action values onto lower tracks.
        const under = values[path] ?? Number(lookup(path)?.value ?? 0);
        values[path] = under + v * cw.weight;
      } else {
        const prev = values[path];
        values[path] = prev == null ? v : prev * (1 - cw.weight) + v * cw.weight;
      }
    }
  }
  if (apply) {
    for (const [path, v] of Object.entries(values)) {
      const p = lookup(path);
      if (p) p.value = v;
    }
  }
  if (apply && Object.keys(values).length) app.events.emit('params');
  return { frame, weights, values };
}

/** Install live mixer evaluation on the app (runs after fcurve eval each frame). */
export function installMixerEval(app: MixerHost & { mixerLive?: boolean; _mixerEvalInstalled?: boolean }) {
  if (app._mixerEvalInstalled) return;
  app._mixerEvalInstalled = true;
  app.mixerLive = true;
  app.anim.onFrame((f) => {
    if (!app.mixerLive) return;
    const mix = mixerOf(app.scene.root as any);
    const clips: MixerClip[] = (mix as any).clips ?? [];
    if (!clips.length || !mix.val('Active')) return;
    evaluateMixer(app, f, true);
  });
}

export function mixerDump(mix: Property) {
  syncMixer(mix);
  return {
    name: mix.val('Name'),
    active: !!mix.val('Active'),
    start: mix.val('start'),
    duration: mix.val('duration'),
    sources: JSON.parse(mix.val('sources') || '[]'),
    tracks: JSON.parse(mix.val('tracks') || '[]'),
    transitions: JSON.parse(mix.val('transitions') || '[]'),
    compounds: JSON.parse(mix.val('compounds') || '[]'),
    relations: JSON.parse(mix.val('relations') || '[]'),
  };
}

/**
 * Softimage PC nested Mixer parameter probe (si_anim_mixer_deep.json `mixer.nested`).
 * Labels match Softimage Parameter.Name strings from XSIBATCH dump.
 */
export function mixerNestedSoftimage(mix: Property) {
  syncMixer(mix);
  return [
    { name: 'Name', classname: 'Parameter', value: mix.val('Name') },
    { name: 'Hidden', classname: 'Parameter', value: !!mix.val('Hidden') },
    { name: 'Active', classname: 'Parameter', value: !!mix.val('Active') },
    { name: 'Start time', classname: 'Parameter', value: mix.val('start') },
    { name: 'Duration', classname: 'Parameter', value: mix.val('duration') },
    { name: 'Auto Transition', classname: 'Parameter', value: !!mix.val('autotransition') },
  ];
}
