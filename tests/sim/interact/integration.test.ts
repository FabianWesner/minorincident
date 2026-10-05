import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { arena, step, dummy } from '../combat/helpers';
import { stateHash } from '../../../src/sim/world/stateHash';
import { NavGrid } from '../../../src/sim/world/NavGrid';

test('T-E11-lifecycle @E11 authored yard is deterministic across unload/reload including hazard timers and debris', async () => {
  const w = await arena(); const hashes = [];
  for (let i = 0; i < 2; i++) {
    w.loadScenario('interact-yard', 22); step(w, 90);
    const propane = w.query({ archetype: 'hazard.propane' })[0].id;
    w.hazards!.hit(propane, 100, 'bullet'); step(w, 36);
    hashes.push(stateHash(w.getState())); expect(w.getState().interactions!.debris.length).toBeGreaterThan(0);
    w.reset(); expect(w.getState().perf).toEqual({ entities: 0, bodies: 0, colliders: 0, listeners: 0 });
  }
  expect(hashes[0]).toBe(hashes[1]);
});
test('T-E11-overlapping-nav @E11 @E11-AC03 @E11-AC07 overlapping blockers restore only originally walkable cells', async () => {
  const nav = new NavGrid([0, 0], [5, 5]); nav.cells.fill(1); nav.cells[0] = 0;
  const wall = { x: 1, z: 1, halfX: 1, halfZ: 1 };
  nav.block(1, wall); nav.block(2, wall); nav.unblock(1); expect(nav.walkable([1, 1])).toBe(false);
  nav.unblock(2); expect(nav.walkable([1, 1])).toBe(true); expect(nav.cells[0]).toBe(0);
});
test('T-E11-perf @E11 @perf 100 infected and 200 flammable props stay below 6ms sim p95; debris remains <=32', async () => {
  const w = await arena();
  for (let i = 0; i < 100; i++) dummy(w, 10 + i % 10 * 2, Math.floor(i / 10) * 2);
  for (let i = 0; i < 200; i++) w.hazards!.spawn('crate', { x: 10 + i % 20 * 2, z: Math.floor(i / 20) * 2 });
  const alarm = w.hazards!.spawn('car-alarm', { x: 15, z: 15 }); w.hazards!.hit(alarm, 1, 'bullet');
  w.hazards!.spawn('fire', { x: 15, z: 15 }); step(w, 60);
  const times = [];
  for (let i = 0; i < 600; i++) { const start = performance.now(); w.update(); times.push(performance.now() - start); }
  times.sort((a, b) => a - b); const p95 = times[Math.floor(times.length * .95)];
  const props = w.query({ kind: 'prop' });
  for (const p of props) w.hazards!.hit(p.id, 1000, 'melee');
  const debris = w.hazards!.debris.snapshot().length;
  expect(debris).toBeLessThanOrEqual(32); expect(p95).toBeLessThan(6);
  const metrics = { simMsP95: p95, simMsMedian: times[300], ticks: 600, infected: 100, props: 200, debris, bodies: w.physics.bodyCount, budgetMs: 6 };
  mkdirSync('test-results/epics/E11', { recursive: true }); writeFileSync('test-results/epics/E11/sim-perf.json', JSON.stringify(metrics, null, 2) + '\n');
});
