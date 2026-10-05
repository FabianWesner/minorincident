import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { arena, spawn, step } from './helpers';
test('T-E07-07 @E07 @E07-AC07 director excludes player radius, expanded camera footprint and colliders', async () => {
  const w = await arena(), d = w.infected!.director;
  expect(d.safe('infected.runner', { x: 0, z: 17.9 })).toBe(false); expect(d.visible({ x: 34, z: 0 })).toBe(true); expect(d.safe('infected.runner', { x: 34, z: 0 })).toBe(false);
  d.request('infected.runner', { x: 48, z: 0 }); d.request('infected.runner', { x: 0, z: 0 }); d.request('infected.runner', { x: 60, z: 0 }); step(w, 1);
  expect(w.infected!.active).toHaveLength(1); expect(d.queue).toHaveLength(2); const e = w.infected!.active[0]; expect(Math.hypot(e.transform.x, e.transform.z)).toBeGreaterThanOrEqual(18); expect(d.visible(e.transform)).toBe(false); expect(w.infected!.nav.clear(e.transform.x, e.transform.z, e.combat!.radius)).toBe(true);
  w.loadScenario('maze'); expect(w.infected!.director.safe('infected.runner', { x: -10, z: -4 })).toBe(false);
});
test('T-E07-08 @E07 @E07-AC08 scripted waves queue and resume within both tier caps', async () => {
  for (const tier of ['high', 'low'] as const) {
    const w = await arena(), d = w.infected!.director; d.tier = tier; d.wave('infected.runner', 230); step(w, 1);
    expect(d.count).toBe(d.cap); expect(d.queue.length).toBe(230 - d.cap); for (const e of w.infected!.active) e.health.current = 0; step(w, 1); expect(d.count).toBe(Math.min(d.cap, 230 - d.cap)); expect(d.count).toBeLessThanOrEqual(d.cap);
  }
});
test('T-E07-09 @E07 @E07-AC09 150-infected stream follows spline on time and fans out', async () => {
  const w = await arena(), d = w.infected!.director; const m = d.migration([{ x: -48, z: -20 }, { x: -10, z: -18 }, { x: 25, z: -24 }, { x: 48, z: -20 }]);
  const ticks = Math.ceil(m.expectedSeconds * 60); step(w, ticks); expect(m.arrived).toBe(150); expect(w.tick / 60 / m.expectedSeconds).toBeGreaterThanOrEqual(0.8); expect(w.tick / 60 / m.expectedSeconds).toBeLessThanOrEqual(1.2);
  for (const id of m.members) { const e = w.entities.get(id)!; expect(Math.hypot(e.transform.x - 48, e.transform.z + 20)).toBeLessThan(4.5); }
  const before = w.infected!.active.map((e) => ({ ...e.transform })); step(w, 30); expect(w.infected!.active.filter((e, i) => Math.hypot(e.transform.x - before[i].x, e.transform.z - before[i].z) > 0.5).length).toBeGreaterThan(100);
});
test('T-E07-10 @E07 @E07-AC10 five-minute spawn/kill cycle reuses prewarmed entity objects', async () => {
  const w = await arena(), ai = w.infected!, allocated = ai.counters.allocated, records = new Set(ai.pool);
  for (let tick = 0; tick < 18000; tick++) {
    if (tick % 60 === 0) { for (let i = ai.active.length - 1; i >= 0; i--) { ai.active[i].health.current = 0; ai.release(ai.active[i]); } for (let i = 0; i < 150; i++) spawn(w, 'runner', i % 15 - 7, 10 + Math.floor(i / 15), 'idle'); }
    w.update(); for (const e of ai.active) expect(records.has(e)).toBe(true);
  }
  expect(ai.counters.allocated).toBe(allocated); expect(ai.counters.reused).toBe(45000);
});
test('T-E07-11 @E07 @E07-AC11 @perf 200 chasing infected stay inside the 4 ms simulation p95 budget', async () => {
  const w = await arena(); w.combat!.damage.god = true; for (let i = 0; i < 200; i++) spawn(w, 'runner', i % 20 - 10, 10 + Math.floor(i / 20)); step(w, 120);
  const times: number[] = []; for (let i = 0; i < 600; i++) { const start = performance.now(); w.update(); times.push(performance.now() - start); } times.sort((a, b) => a - b); const p95 = times[Math.floor(times.length * 0.95)]; const metrics = { scenario: 'horde-arena', infected: 200, simMsP95: p95, budget: 4 }; mkdirSync('test-results/epics/E07', { recursive: true }); writeFileSync('test-results/epics/E07/sim-perf.json', JSON.stringify(metrics, null, 2) + '\n'); console.log(JSON.stringify(metrics)); expect(p95).toBeLessThanOrEqual(4);
});
