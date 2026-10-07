import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Matrix4 } from 'three';
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
  mkdirSync('test-results/epics/E07', { recursive: true }); writeFileSync('test-results/epics/E07/migration.json', JSON.stringify({ requested: m.requested, arrived: m.arrived, expectedSeconds: m.expectedSeconds, actualSeconds: w.tick / 60, fanRadius: 4.5 }, null, 2) + '\n');
  const before = w.infected!.active.map((e) => ({ ...e.transform })); step(w, 30); expect(w.infected!.active.filter((e, i) => Math.hypot(e.transform.x - before[i].x, e.transform.z - before[i].z) > 0.5).length).toBeGreaterThan(100);
});
test('T-E07-10 @E07 @E07-AC10 five-minute spawn/kill cycle reuses prewarmed entity objects', async () => {
  const w = await arena(), ai = w.infected!, allocated = ai.counters.allocated, records = new Set(ai.pool); w.combat!.damage.god = true; let allRecordsReused = true;
  for (let tick = 0; tick < 18000; tick++) {
    if (tick % 600 === 0) for (const e of ai.active) e.health.current = 0;
    w.update(); // Settled bodies release only their brains, retaining static identity records.
    if (tick % 600 === 0) for (let i = 0; i < 150; i++) spawn(w, 'runner', i % 15 - 7, 10 + Math.floor(i / 15), 'idle');
    for (const e of ai.active) allRecordsReused = records.has(e) && allRecordsReused;
  }
  expect(allRecordsReused).toBe(true); expect(ai.counters.allocated).toBe(allocated); expect(ai.counters.reused).toBe(4500); expect([...w.entities.iterate()].filter(e => e.corpse)).toHaveLength(4350);
  mkdirSync('test-results/epics/E07', { recursive: true }); writeFileSync('test-results/epics/E07/pooling.json', JSON.stringify({ ticks: w.tick, seconds: w.tick / 60, concurrent: 150, corpsesAtEnd: 4350, available: ai.pool.length, allocatedAfterWarmup: allocated, ...ai.counters }, null, 2) + '\n');
});
test('T-E07-11 @E07 @E07-AC11 @perf 200 chasing infected stay inside the 4 ms simulation p95 budget', async () => {
  const w = await arena(); w.combat!.damage.god = true; for (let i = 0; i < 200; i++) spawn(w, 'runner', i % 20 - 10, 10 + Math.floor(i / 20)); step(w, 120);
  const times: number[] = []; for (let i = 0; i < 600; i++) { const start = performance.now(); w.update(); times.push(performance.now() - start); } times.sort((a, b) => a - b); const p95 = times[Math.floor(times.length * 0.95)]; const metrics = { scenario: 'horde-arena', infected: 200, simMsP95: p95, budget: 4 }; mkdirSync('test-results/epics/E07', { recursive: true }); writeFileSync('test-results/epics/E07/sim-perf.json', JSON.stringify(metrics, null, 2) + '\n'); console.log(JSON.stringify(metrics)); expect(p95).toBeLessThanOrEqual(4);
});

test('T-E07-10b @E07 @E07-AC10 recycled archetypes refresh borrowed player-collision radii', async () => {
  const w = await arena(), runner = spawn(w, 'runner', 10, 0, 'idle'); step(w, 1);
  expect(w.player!.locomotion.crowd[0].radius).toBe(0.35);
  runner.health.current = 0; step(w, 2762);
  const gorilla = spawn(w, 'gorilla', 10, 0, 'idle'); expect(gorilla).toBe(runner); step(w, 1);
  expect(w.player!.locomotion.crowd[0].radius).toBe(0.7);
});

test('T-E07-08b @E07 @E07-AC08 revival respects cap and retries instead of exceeding it', async () => {
  const w = await arena(), ai = w.infected!, runner = spawn(w, 'runner', 2, 0, 'idle'); runner.health.current = 0; const nurse = spawn(w, 'nurse', 1); ai.director.levelCap = 1;
  step(w, 25); expect(ai.director.count).toBe(1); expect(runner.health.current).toBe(0); expect(nurse.infected!.reviveUsed).toBe(false);
  ai.director.levelCap = 2; step(w, 100); expect(ai.director.count).toBe(2); expect(runner.health.current).toBe(40);
});

test('T-E07-08c @E07 @E07-AC08 a capped scripted migration remains queued and begins when capacity returns', async () => {
  const w = await arena(), ai = w.infected!; ai.director.levelCap = 1; const blocker = spawn(w, 'runner', 20, 0, 'idle');
  const m = ai.director.migration([{ x: -48, z: -20 }, { x: 48, z: -20 }], 1); expect(m.members).toHaveLength(0); expect(ai.director.queue).toHaveLength(1); step(w, 30); expect(ai.director.count).toBe(1);
  blocker.health.current = 0; step(w, 1); expect(m.members).toHaveLength(1); expect(ai.director.queue).toHaveLength(0); expect(m.started).toBe(w.tick);
});

test('T-E07-07b @E07 @E07-AC07 supplied camera volume uses the 10 percent expanded frustum', async () => {
  const w = await arena(), d = w.infected!.director, matrix = new Matrix4().makeOrthographic(-20, 20, 20, -20, 0.1, 100);
  // XZ orthographic view from above: view Z=-Y, view Y=world Z.
  matrix.multiply(new Matrix4().makeRotationX(Math.PI / 2)).multiply(new Matrix4().makeTranslation(0, -50, 0));
  d.setFrustum(matrix.elements); expect(d.visible({ x: 21.9, z: 0 })).toBe(true); expect(d.visible({ x: 22.1, z: 0 })).toBe(false); expect(d.safe('infected.runner', { x: 21.9, z: 0 })).toBe(false);
});
