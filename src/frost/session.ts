/** App-level FROST session: graph + eval state + playhead hook + hair/cloth wizards. */

import type { App } from '../core/commands';
import type { X3DObject } from '../core/scene';
import {
  createFrostState,
  frostPositions,
  frostStrandLines,
  frostClothPositions,
  frostClothWireframe,
  aliveCount,
  aliveStrandCount,
  aliveClothVerts,
  tickFrost,
  type FrostEvalState,
  type FrostMeshBinding,
} from './evaluator';
import { emitSimulateRecipe, characterHairRecipe, characterClothRecipe } from './presets';
import {
  parseFrostGraph,
  serializeFrostGraph,
  type FrostGraphIR,
  frostId,
} from './ir';
import { FROST_NODES } from './nodes';
import {
  defaultHairWizard,
  hairRecipe,
  wizardFromGraph,
  type HairWizardState,
} from './hair';
import {
  defaultClothWizard,
  clothRecipe,
  clothWizardFromGraph,
  type ClothWizardState,
} from './cloth';

export class FrostSession {
  graph: FrostGraphIR;
  state: FrostEvalState;
  /** Last packed particle positions for viewport. */
  positions = new Float32Array(0);
  /** Last packed strand line segments (pairs of xyz). */
  strandLines = new Float32Array(0);
  /** Last packed cloth vertex positions. */
  clothPositions = new Float32Array(0);
  /** Last packed cloth wireframe segments. */
  clothWire = new Float32Array(0);
  /** Active hair wizard state (null when not in hair workflow). */
  hair: HairWizardState | null = null;
  /** Active cloth wizard state. */
  cloth: ClothWizardState | null = null;
  dirty = true;
  private lastFrame = -1;
  private unsub: (() => void) | null = null;

  constructor(readonly app: App) {
    this.graph = emitSimulateRecipe();
    this.state = createFrostState();
  }

  attach() {
    if (this.unsub) return;
    this.unsub = this.app.events.on('frame', () => this.onFrame());
    this.app.events.on('newscene', () => this.reset());
  }

  detach() {
    this.unsub?.();
    this.unsub = null;
  }

  reset() {
    this.state = createFrostState();
    this.positions = new Float32Array(0);
    this.strandLines = new Float32Array(0);
    this.clothPositions = new Float32Array(0);
    this.clothWire = new Float32Array(0);
    this.lastFrame = -1;
    this.dirty = true;
  }

  loadRecipe() {
    this.hair = null;
    this.cloth = null;
    this.graph = emitSimulateRecipe();
    this.reset();
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  /** Apply / refresh character hair recipe from wizard state. */
  loadHairRecipe(wiz?: HairWizardState) {
    this.cloth = null;
    this.hair = wiz ? { ...wiz, layers: wiz.layers.map(l => ({ ...l })) } : defaultHairWizard();
    this.graph = hairRecipe(this.hair);
    this.reset();
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  /** Re-emit graph from current hair wizard without wiping playhead catch-up hard. */
  applyHairWizard() {
    if (!this.hair) this.hair = defaultHairWizard();
    this.cloth = null;
    this.graph = hairRecipe(this.hair);
    this.state.strandsReady = false;
    this.dirty = true;
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  ensureHairWizard(): HairWizardState {
    if (this.hair) return this.hair;
    const from = wizardFromGraph(this.graph);
    this.hair = from ?? defaultHairWizard();
    return this.hair;
  }

  loadClothRecipe(wiz?: ClothWizardState) {
    this.hair = null;
    this.cloth = wiz ? { ...wiz, pinRings: [...wiz.pinRings], gravity: [...wiz.gravity] as any, wind: [...wiz.wind] as any } : defaultClothWizard();
    this.graph = clothRecipe(this.cloth);
    this.reset();
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  applyClothWizard() {
    if (!this.cloth) this.cloth = defaultClothWizard();
    this.hair = null;
    this.graph = clothRecipe(this.cloth);
    this.state.clothReady = false;
    this.state.clothCache.clear();
    this.dirty = true;
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  ensureClothWizard(): ClothWizardState {
    if (this.cloth) return this.cloth;
    const from = clothWizardFromGraph(this.graph);
    this.cloth = from ?? defaultClothWizard();
    return this.cloth;
  }

  /** Explicit Settle N frames (design §5 — replaces negative-frame pre-roll folklore). */
  settleCloth(frames?: number) {
    const n = frames ?? this.cloth?.settleFrames ?? 24;
    this.state.settlePending = Math.max(0, n | 0);
    this.dirty = true;
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  /** One-click bake: enable cache and store current frame (+ optionally settle first). */
  bakeClothCache() {
    if (!this.cloth) this.cloth = defaultClothWizard();
    this.cloth.cacheEnabled = true;
    this.graph = clothRecipe(this.cloth);
    this.state.clothCache.enabled = true;
    if (this.state.cloth) this.state.clothCache.bake(this.app.anim.frame, this.state.cloth.pos);
    this.dirty = true;
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  loadJSON(json: string | FrostGraphIR) {
    this.graph = parseFrostGraph(json);
    this.hair = wizardFromGraph(this.graph);
    this.cloth = clothWizardFromGraph(this.graph);
    this.reset();
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  toJSON(): string {
    return serializeFrostGraph(this.graph);
  }

  addNode(type: string, x = 80, y = 80) {
    const def = FROST_NODES[type];
    if (!def) throw new Error(`Unknown FROST node: ${type}`);
    const n = {
      id: frostId('n'),
      type,
      x,
      y,
      params: { ...def.defaults },
    };
    this.graph.nodes.push(n);
    this.dirty = true;
    return n;
  }

  removeNode(id: string) {
    this.graph.nodes = this.graph.nodes.filter(n => n.id !== id);
    this.graph.links = this.graph.links.filter(l => l.from !== id && l.to !== id);
    this.dirty = true;
  }

  connect(from: string, fromPort: string, to: string, toPort: string) {
    this.graph.links = this.graph.links.filter(l => !(l.to === to && l.toPort === toPort));
    this.graph.links.push({ id: frostId('l'), from, fromPort, to, toPort });
    this.dirty = true;
  }

  disconnect(to: string, toPort: string) {
    this.graph.links = this.graph.links.filter(l => !(l.to === to && l.toPort === toPort));
    this.dirty = true;
  }

  private onFrame() {
    const f = this.app.anim.frame;
    if (f === this.lastFrame && !this.dirty) return;
    // When playing forward, tick each new frame; when scrubbing jump, retick
    if (this.graph.simulated && f < this.lastFrame) {
      // Cloth cache can scrub without full reset
      if (!(this.state.clothCache.enabled && this.state.clothCache.has(f))) this.reset();
    }
    if (this.graph.simulated && f > this.lastFrame + 1 && this.lastFrame >= 0) {
      for (let i = this.lastFrame + 1; i <= f; i++) this.tick(i);
    } else {
      this.tick(f);
    }
  }

  /** Resolve scene meshes referenced by hair / cloth / collide nodes. */
  collectMeshes(): Record<string, FrostMeshBinding> {
    const names = new Set<string>();
    for (const n of this.graph.nodes) {
      if (n.type === 'CreateStrands' && n.params.scalpObject) names.add(String(n.params.scalpObject));
      if (n.type === 'CreateCloth' && n.params.garmentObject) names.add(String(n.params.garmentObject));
      if (n.type === 'CollideBody' && n.params.bodyObject) names.add(String(n.params.bodyObject));
    }
    if (this.hair?.scalpObject) names.add(this.hair.scalpObject);
    if (this.hair?.bodyObject) names.add(this.hair.bodyObject);
    if (this.cloth?.garmentObject) names.add(this.cloth.garmentObject);
    if (this.cloth?.bodyObject) names.add(this.cloth.bodyObject);
    const out: Record<string, FrostMeshBinding> = {};
    for (const name of names) {
      const obj = this.app.scene.find(name);
      if (!obj) continue;
      const binding = meshBindingOf(obj);
      if (binding) out[name] = binding;
    }
    return out;
  }

  tick(frame: number) {
    tickFrost(this.graph, this.state, { frame, fps: 30, meshes: this.collectMeshes() });
    this.positions = frostPositions(this.state);
    this.strandLines = frostStrandLines(this.state);
    this.clothPositions = frostClothPositions(this.state);
    this.clothWire = frostClothWireframe(this.state);
    this.lastFrame = frame;
    this.dirty = false;
    this.app.events.emit('params');
  }

  status(): string {
    const mode = this.graph.simulated ? 'simulated' : 'procedural';
    const pts = aliveCount(this.state);
    const strands = aliveStrandCount(this.state);
    const cloth = aliveClothVerts(this.state);
    if (cloth > 0) {
      const cache = this.state.clothCache.enabled ? ` · cache ${this.state.clothCache.size}` : '';
      return `${this.graph.name} · ${mode} · ${cloth} cloth verts${cache} · f${this.state.frame}`;
    }
    if (strands > 0) return `${this.graph.name} · ${mode} · ${strands} strands · f${this.state.frame}`;
    return `${this.graph.name} · ${mode} · ${pts} pts · f${this.state.frame}`;
  }

  isHairGraph(): boolean {
    return this.graph.nodes.some(n => n.type === 'CreateStrands' || n.type === 'SimulateStrands');
  }

  isClothGraph(): boolean {
    return this.graph.nodes.some(n => n.type === 'CreateCloth' || n.type === 'SimulateCloth');
  }
}

function meshBindingOf(obj: X3DObject): FrostMeshBinding | null {
  const mesh = obj.primitive?.mesh?.();
  if (!mesh?.positions?.length) return null;
  const mat = obj.globalMatrix().elements;
  return {
    name: obj.name,
    positions: mesh.positions,
    indices: mesh.indices ?? null,
    matrix: Array.from(mat),
  };
}

const SESSIONS = new WeakMap<App, FrostSession>();

export function frostOf(app: App): FrostSession {
  let s = SESSIONS.get(app);
  if (!s) {
    s = new FrostSession(app);
    s.attach();
    s.tick(app.anim.frame);
    SESSIONS.set(app, s);
  }
  return s;
}

/** Convenience: load default character hair without going through wizard UI. */
export function loadDefaultHair(app: App) {
  const s = frostOf(app);
  s.loadHairRecipe(defaultHairWizard());
  return s;
}

/** Convenience: load default character cloth. */
export function loadDefaultCloth(app: App) {
  const s = frostOf(app);
  s.loadClothRecipe(defaultClothWizard());
  return s;
}

export { characterHairRecipe, characterClothRecipe };
