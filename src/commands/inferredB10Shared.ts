// Row CMD-B10 (INFERRED batch, 2026-11-18): shared helpers of inferredB10Views.ts and inferredB10Scene.ts.
//
// No analyst note exists for the commands of this row. Names, argument names, order and defaults come from
// data/command_registry.json (inferredB10Args.ts); behaviour is reasoned from the registry descriptions / tooltips,
// publicly documented Softimage scripting semantics and the related commands and view-manager state already in src/.
// Every registration is marked `// inferred`; branches that could not be reasoned out log "not yet attested".
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { X3DObject, MoveComponentOperator } from '../core/scene';
import { B10_ARGS, B10_DESC, B10_CATEGORY } from './inferredB10Args';

export const B10_NOTE = 'CMD-B10 inferred batch';

export interface B10State {
  registered: string[];
  skipped: string[];
  /** Last command of this batch that activated a tool, and the last "auxiliary" (non Selection / SRT / Navigation) one. */
  tool: { current: string | null; lastAux: { name: string; args: Record<string, any> } | null };
  /** Message shown when something is dragged onto a 3D view (SetDropMessage). */
  dropMessage: string;
  /** Pending DelayedRefresh requests (frame or null = now) – kept for inspection. */
  delayedRefresh: (number | null)[];
  /** Results of RunPerformanceTest. */
  perf: { type: number; frames: number; seconds: number; fps: number } | null;
  /** In-memory fast playback caches per view index (Save / LoadFastPlaybackCache). */
  playbackCaches: Map<number, { frames: number[]; file: string }>;
}

export function b10(app: App): B10State {
  return ((app as any).inferredB10 ??= {
    registered: [], skipped: [], tool: { current: null, lastAux: null }, dropMessage: '', delayedRefresh: [], perf: null,
    playbackCaches: new Map(),
  } as B10State);
}

/** Register with the registry argument list unless another module already owns the name. */
export function regB10(app: App, name: string, def: Omit<CommandDef, 'name' | 'label' | 'category' | 'args'> & Partial<Pick<CommandDef, 'label' | 'category'>>) {
  const st = b10(app);
  if (app.commands.has(name)) { st.skipped.push(name); return; }
  const args = B10_ARGS[name];
  if (!args) throw new Error(`CMD-B10: no registry argument list for ${name}`);
  app.register({
    name, label: def.label ?? name, category: def.category ?? (B10_CATEGORY[name] || 'General'),
    description: (def as any).description ?? B10_DESC[name] ?? '',
    ...def,
    args: args.map(a => ({ ...a })),
  } as CommandDef);
  st.registered.push(name);
}

export function logNyaB10(app: App, command: string, what: string) {
  app.logMsg('info', `${command}: not yet attested: ${what} (${B10_NOTE})`);
}
export const unset = (v: any) => v === undefined || v === null || v === '';
export const num = (v: any, d = 0) => { const n = Number(v); return unset(v) || !Number.isFinite(n) ? d : n; };
export const boolA = (v: any) => typeof v === 'string' ? /^(true|1|yes|-1)$/i.test(v.trim()) : !!v;
/** ":siRelative:siDeltaMode" → "siRelative"; numbers and plain names pass through. */
export function constName(v: any): string | number | null {
  if (unset(v)) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim(); const m = /^:([^:]+):/.exec(s);
  return m ? m[1] : /^-?\d+$/.test(s) ? Number(s) : s;
}
/** Comma-separated list; commas inside [...] (component index lists) do not split. */
export function splitList(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '[') depth++; else if (ch === ']') depth = Math.max(0, depth - 1); if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map(t => t.trim()).filter(Boolean);
}
export const listOf = (arg: any): any[] => unset(arg) ? [] : Array.isArray(arg) ? arg : typeof arg === 'string' ? splitList(arg) : [arg];

export function findObj(app: App, x: any): X3DObject | undefined {
  if (x instanceof X3DObject) return x;
  if (typeof x !== 'string' || !x) return undefined;
  if (x === app.scene.root.name) return app.scene.root;
  return app.scene.find(x) ?? app.scene.find(x.replace(/^Scene_Root\./, '')) ?? app.scene.find(x.split('.')[0]);
}
/** Objects of a Collection argument; unset = the selected objects. */
export function objsOf(app: App, arg: any): X3DObject[] {
  if (unset(arg)) return app.selectedObjects;
  const out: X3DObject[] = [];
  for (const x of listOf(arg)) { const o = findObj(app, x); if (o && !out.includes(o)) out.push(o); }
  return out;
}

// ------------------------------------------------------------------ view manager access
export const vm = (): any => (window as any).__vm ?? null;
export interface VP { name: string; kind: 'ortho' | 'persp'; camera: THREE.Camera; flags: Record<string, boolean>; x?: any }
export function viewports(): VP[] { return vm()?.viewports?.() ?? []; }
/** View argument: -1 (registry default) or out of range = the active view; 0..3 = views A..D. */
export function viewIndex(v: any): number {
  const V = vm(); if (!V) return -1;
  const all = viewports(); const letter = /siViewport([A-D])(?![a-z])/i.exec(String(v ?? ''))?.[1];
  const n = letter ? letter.toUpperCase().charCodeAt(0) - 65 : num(v, -1);
  if (n >= 0 && n < all.length) return n;
  return all.indexOf(V.active());
}
/** Run `f` with view `i` active, restoring the previously active view. */
export function withView<T>(i: number, f: () => T): T {
  const V = vm(); const all = viewports(); const prev = all.indexOf(V.active());
  if (i >= 0 && i !== prev) V.setActive(i);
  try { return f(); } finally { if (i >= 0 && i !== prev && prev >= 0) V.setActive(prev); }
}
export function orbitTarget(): THREE.Vector3 { const t = vm()?.orbitTarget?.(); return t ? t.clone() : new THREE.Vector3(); }

/** Translate objects by a world-space delta, written to their local positions (undoable through setParam). */
export function translateGlobal(app: App, objs: X3DObject[], d: THREE.Vector3, label: string) {
  for (const o of objs) {
    const parent = o.parentObj; let local = d.clone();
    if (parent) { const m = new THREE.Matrix3().setFromMatrix4(parent.globalMatrix()).invert(); local = d.clone().applyMatrix3(m); }
    const l = o.kinematics.local;
    (['x', 'y', 'z'] as const).forEach((ax, i) => { const p = l.get('pos' + ax); if (p) app.setParam(p, Number(p.value) + local.getComponent(i), label); });
  }
}

// ------------------------------------------------------------------ component moves
/** The Move Component operator on top of an object's stack, added (undoably) when the top operator is another one. */
export function topMoveComponentOp(app: App, o: X3DObject): MoveComponentOperator | null {
  const prim = o.primitive; if (!prim) return null;
  const top = prim.operators[prim.operators.length - 1];
  if (top instanceof MoveComponentOperator) return top;
  const op = new MoveComponentOperator();
  app.record('Move Component', () => prim.addOperator(op), () => prim.removeOperator(op));
  return op;
}
/** Add a local-space delta to points of an object through its Move Component operator (undoable). */
export function moveComponents(app: App, o: X3DObject, pts: number[], d: [number, number, number], label: string) {
  const op = topMoveComponentOp(app, o); if (!op) return null;
  const before = new Map([...op.deltas].map(([k, v]) => [k, [...v] as [number, number, number]]));
  const apply = (m: Map<number, [number, number, number]>) => { op.deltas.clear(); for (const [k, v] of m) op.deltas.set(k, v); (o.primitive as any).dirty = true; app.events.emit('scene'); };
  const after = new Map(before); for (const p of pts) { const v = after.get(p) ?? [0, 0, 0]; after.set(p, [v[0] + d[0], v[1] + d[1], v[2] + d[2]]); }
  app.record(label, () => apply(after), () => apply(before));
  return op;
}
