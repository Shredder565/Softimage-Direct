/** App-level FROST session: graph + eval state + playhead hook + hair wizard. */

import type { App } from '../core/commands';
import type { X3DObject } from '../core/scene';
import {
  createFrostState,
  frostPositions,
  frostStrandLines,
  aliveCount,
  aliveStrandCount,
  tickFrost,
  type FrostEvalState,
  type FrostMeshBinding,
} from './evaluator';
import { emitSimulateRecipe, characterHairRecipe } from './presets';
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

export class FrostSession {
  graph: FrostGraphIR;
  state: FrostEvalState;
  /** Last packed particle positions for viewport. */
  positions = new Float32Array(0);
  /** Last packed strand line segments (pairs of xyz). */
  strandLines = new Float32Array(0);
  /** Active hair wizard state (null when not in hair workflow). */
  hair: HairWizardState | null = null;
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
    this.lastFrame = -1;
    this.dirty = true;
  }

  loadRecipe() {
    this.hair = null;
    this.graph = emitSimulateRecipe();
    this.reset();
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  /** Apply / refresh character hair recipe from wizard state. */
  loadHairRecipe(wiz?: HairWizardState) {
    this.hair = wiz ? { ...wiz, layers: wiz.layers.map(l => ({ ...l })) } : defaultHairWizard();
    this.graph = hairRecipe(this.hair);
    this.reset();
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  /** Re-emit graph from current hair wizard without wiping playhead catch-up hard. */
  applyHairWizard() {
    if (!this.hair) this.hair = defaultHairWizard();
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

  loadJSON(json: string | FrostGraphIR) {
    this.graph = parseFrostGraph(json);
    this.hair = wizardFromGraph(this.graph);
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
    if (this.graph.simulated && f < this.lastFrame) this.reset();
    if (this.graph.simulated && f > this.lastFrame + 1 && this.lastFrame >= 0) {
      // catch up missed frames for determinism while playing
      for (let i = this.lastFrame + 1; i <= f; i++) this.tick(i);
    } else {
      this.tick(f);
    }
  }

  /** Resolve scene meshes referenced by hair / collide nodes. */
  collectMeshes(): Record<string, FrostMeshBinding> {
    const names = new Set<string>();
    for (const n of this.graph.nodes) {
      if (n.type === 'CreateStrands' && n.params.scalpObject) names.add(String(n.params.scalpObject));
      if (n.type === 'CollideBody' && n.params.bodyObject) names.add(String(n.params.bodyObject));
    }
    if (this.hair?.scalpObject) names.add(this.hair.scalpObject);
    if (this.hair?.bodyObject) names.add(this.hair.bodyObject);
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
    this.lastFrame = frame;
    this.dirty = false;
    this.app.events.emit('params');
  }

  status(): string {
    const mode = this.graph.simulated ? 'simulated' : 'procedural';
    const pts = aliveCount(this.state);
    const strands = aliveStrandCount(this.state);
    if (strands > 0) return `${this.graph.name} · ${mode} · ${strands} strands · f${this.state.frame}`;
    return `${this.graph.name} · ${mode} · ${pts} pts · f${this.state.frame}`;
  }

  isHairGraph(): boolean {
    return this.graph.nodes.some(n => n.type === 'CreateStrands' || n.type === 'SimulateStrands');
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

export { characterHairRecipe };
