/** Deterministic emit + integrate smoke checks (no DOM). */

import { emitSimulateRecipe } from './presets';
import { createFrostState, tickFrost, aliveCount, frostPositions } from './evaluator';
import { parseFrostGraph, serializeFrostGraph } from './ir';

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

  return { ok: failures.length === 0, failures, checks };
}
