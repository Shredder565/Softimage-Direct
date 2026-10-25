/** Deterministic emit + integrate + strand hair smoke checks (no DOM). */

import { emitSimulateRecipe, characterHairRecipe } from './presets';
import {
  createFrostState,
  tickFrost,
  aliveCount,
  aliveStrandCount,
  frostPositions,
  frostStrandLines,
} from './evaluator';
import { parseFrostGraph, serializeFrostGraph } from './ir';
import { defaultHairWizard, hairRecipe } from './hair';
import {
  generateStrands,
  applyStyleLayers,
  defaultStyleLayers,
  tickStrandDynamics,
  packStrandLineSegments,
} from './strands';

export interface FrostSmokeResult {
  ok: boolean;
  failures: string[];
  checks: string[];
}

function assert(cond: boolean, msg: string, failures: string[], checks: string[]) {
  if (cond) checks.push(msg);
  else failures.push(msg);
}

/** Run evaluator unit/smoke suite. Safe for Node or browser. */
export function runFrostSmokeTests(): FrostSmokeResult {
  const failures: string[] = [];
  const checks: string[] = [];

  // IR round-trip
  try {
    const before = emitSimulateRecipe('roundtrip');
    const after = parseFrostGraph(serializeFrostGraph(before));
    assert(before.version === after.version, 'IR version preserved', failures, checks);
    assert(before.nodes.length === after.nodes.length, 'IR nodes round-trip', failures, checks);
    assert(before.links.length === after.links.length, 'IR links round-trip', failures, checks);
    assert(after.simulated === true, 'IR simulated flag', failures, checks);
  } catch (e: any) {
    failures.push(`IR round-trip threw: ${e?.message ?? e}`);
  }

  // Emit grows particle count across frames
  {
    const g = emitSimulateRecipe('smoke');
    const st = createFrostState();
    tickFrost(g, st, { frame: 1, fps: 30 });
    const n1 = aliveCount(st);
    tickFrost(g, st, { frame: 2, fps: 30 });
    const n2 = aliveCount(st);
    tickFrost(g, st, { frame: 10, fps: 30 });
    const n10 = aliveCount(st);
    assert(n1 > 0, `emit births particles (f1=${n1})`, failures, checks);
    assert(n2 >= n1, `emit accumulates (f1=${n1} f2=${n2})`, failures, checks);
    assert(n10 > n1, `emit over time (f1=${n1} f10=${n10})`, failures, checks);
  }

  // Integrate moves particles (gravity / turbulize)
  {
    const g = emitSimulateRecipe('integrate');
    const emit = g.nodes.find(n => n.type === 'Emit')!;
    emit.params.rate = 30;
    emit.params.speed = 0;
    emit.params.position = [0, 5, 0];
    const st = createFrostState();
    for (let f = 1; f <= 5; f++) tickFrost(g, st, { frame: f, fps: 30 });
    const before = frostPositions(st).slice();
    for (let f = 6; f <= 20; f++) tickFrost(g, st, { frame: f, fps: 30 });
    const after = frostPositions(st);
    assert(before.length > 0 && after.length > 0, 'integrate has particles', failures, checks);
    let moved = 0;
    const n = Math.min(before.length, after.length) / 3;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(
        after[i * 3] - before[i * 3],
        after[i * 3 + 1] - before[i * 3 + 1],
        after[i * 3 + 2] - before[i * 3 + 2],
      );
      if (d > 1e-4) moved++;
    }
    let y0 = 0, y1 = 0, c0 = before.length / 3, c1 = after.length / 3;
    for (let i = 0; i < c0; i++) y0 += before[i * 3 + 1];
    for (let i = 0; i < c1; i++) y1 += after[i * 3 + 1];
    y0 /= Math.max(1, c0); y1 /= Math.max(1, c1);
    assert(moved > 0 || y1 < y0 - 0.01, `integrate moves / gravity (Δy=${(y1 - y0).toFixed(3)} moved=${moved})`, failures, checks);
  }

  // Determinism: same graph + frames → same positions
  {
    const run = () => {
      const g = emitSimulateRecipe('det');
      const st = createFrostState();
      for (let f = 1; f <= 15; f++) tickFrost(g, st, { frame: f, fps: 30 });
      return Array.from(frostPositions(st));
    };
    const a = run(), b = run();
    assert(a.length === b.length && a.every((v, i) => v === b[i]), 'deterministic CPU tick', failures, checks);
  }

  // Procedural flag resets each tick
  {
    const g = emitSimulateRecipe('proc');
    g.simulated = false;
    const st = createFrostState();
    tickFrost(g, st, { frame: 1 });
    const n1 = aliveCount(st);
    tickFrost(g, st, { frame: 2 });
    const n2 = aliveCount(st);
    assert(n1 > 0 && n2 > 0 && n2 <= n1 + 2, `procedural no carry (n1=${n1} n2=${n2})`, failures, checks);
  }

  // —— P1: strand generate ——
  {
    const strands = generateStrands({ count: 40, segments: 6, length: 1.0, seed: 9 });
    assert(strands.length === 40, `strand generate count (${strands.length})`, failures, checks);
    assert(strands.every(s => s.pos.length === 7 * 3), 'strand segment buffers', failures, checks);
    applyStyleLayers(strands, defaultStyleLayers(), 9);
    const lines = packStrandLineSegments(strands);
    assert(lines.length === 40 * 6 * 6, `strand line pack (${lines.length})`, failures, checks);
  }

  // —— P1: simple dynamics tick moves tips under gravity/wind ——
  {
    const strands = generateStrands({ count: 20, segments: 5, length: 1.2, seed: 2 });
    applyStyleLayers(strands, defaultStyleLayers(), 2);
    for (const s of strands) { s.pos.set(s.rest); s.prev.set(s.rest); }
    const tipY0 = strands.reduce((a, s) => a + s.pos[s.segments * 3 + 1], 0) / strands.length;
    for (let i = 0; i < 12; i++) {
      tickStrandDynamics(strands, {
        gravity: [0, -6, 0],
        damping: 0.08,
        stiffness: 0.2,
        stretchLimit: 1.08,
        iterations: 4,
        wind: [0.8, 0, 0.2],
        windTurbulence: 1.2,
        dt: 1 / 30,
        time: i / 30,
        colliderSphere: { cx: 0, cy: 0.8, cz: 0, r: 0.4 },
      });
    }
    const tipY1 = strands.reduce((a, s) => a + s.pos[s.segments * 3 + 1], 0) / strands.length;
    let moved = 0;
    for (const s of strands) {
      const i = s.segments * 3;
      const d = Math.hypot(s.pos[i] - s.rest[i], s.pos[i + 1] - s.rest[i + 1], s.pos[i + 2] - s.rest[i + 2]);
      if (d > 1e-3) moved++;
    }
    assert(moved > 0 || tipY1 < tipY0 - 0.01, `strand dynamics tick (moved=${moved} Δy=${(tipY1 - tipY0).toFixed(3)})`, failures, checks);
  }

  // —— P1: hair recipe graph evaluates strands ——
  {
    const wiz = defaultHairWizard();
    wiz.guideCount = 48;
    wiz.segments = 6;
    const g = hairRecipe(wiz, 'hairSmoke');
    assert(g.nodes.some(n => n.type === 'CreateStrands'), 'hair recipe has CreateStrands', failures, checks);
    assert(g.nodes.some(n => n.type === 'SimulateStrands'), 'hair recipe has SimulateStrands', failures, checks);
    assert(g.nodes.some(n => n.type === 'StyleLayers'), 'hair recipe has StyleLayers', failures, checks);
    assert(g.nodes.some(n => n.type === 'CollideBody'), 'hair recipe has CollideBody', failures, checks);
    assert(g.nodes.some(n => n.type === 'Wind'), 'hair recipe has Wind', failures, checks);
    const st = createFrostState();
    for (let f = 1; f <= 10; f++) tickFrost(g, st, { frame: f, fps: 30 });
    const n = aliveStrandCount(st);
    const lines = frostStrandLines(st);
    assert(n > 0, `hair graph births strands (n=${n})`, failures, checks);
    assert(lines.length > 0, `hair graph packs strand lines (${lines.length})`, failures, checks);

    // Deterministic hair tick
    const run = () => {
      const st2 = createFrostState();
      const g2 = characterHairRecipe('detHair');
      for (let f = 1; f <= 8; f++) tickFrost(g2, st2, { frame: f, fps: 30 });
      return Array.from(frostStrandLines(st2));
    };
    const a = run(), b = run();
    assert(a.length === b.length && a.every((v, i) => v === b[i]), 'deterministic hair strand tick', failures, checks);

    // Hair IR round-trip
    const rt = parseFrostGraph(serializeFrostGraph(g));
    assert(rt.nodes.length === g.nodes.length && rt.links.length === g.links.length, 'hair IR round-trip', failures, checks);
  }

  return { ok: failures.length === 0, failures, checks };
}
