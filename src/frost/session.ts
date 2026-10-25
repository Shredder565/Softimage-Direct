/** App-level FROST session: graph + eval state + playhead hook. */

import type { App } from '../core/commands';
import {
  createFrostState,
  frostPositions,
  aliveCount,
  tickFrost,
  type FrostEvalState,
} from './evaluator';
import { emitSimulateRecipe } from './presets';
import {
  parseFrostGraph,
  serializeFrostGraph,
  type FrostGraphIR,
  frostId,
} from './ir';
import { FROST_NODES } from './nodes';

export class FrostSession {
  graph: FrostGraphIR;
  state: FrostEvalState;
  /** Last packed positions for viewport. */
  positions = new Float32Array(0);
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
    this.lastFrame = -1;
    this.dirty = true;
  }

  loadRecipe() {
    this.graph = emitSimulateRecipe();
    this.reset();
    this.tick(this.app.anim.frame);
    this.app.events.emit('scene');
  }

  loadJSON(json: string | FrostGraphIR) {
    this.graph = parseFrostGraph(json);
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

  tick(frame: number) {
    tickFrost(this.graph, this.state, { frame, fps: 30 });
    this.positions = frostPositions(this.state);
    this.lastFrame = frame;
    this.dirty = false;
    this.app.events.emit('params');
  }

  status(): string {
    const mode = this.graph.simulated ? 'simulated' : 'procedural';
    return `${this.graph.name} · ${mode} · ${aliveCount(this.state)} pts · f${this.state.frame}`;
  }
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
