import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { missionSandbox } from '../../fixtures/scenarios/mission-sandbox';
import { arena, step, dummy } from '../combat/helpers';
import { stateHash } from '../../../src/sim/world/stateHash';
import { NavGrid } from '../../../src/sim/world/NavGrid';
import { districtGameplay } from '../../../src/levels/districts';
import { resolvePosition } from '../../../src/levels/districts/validate';
import type { DistrictLayout } from '../../../src/levels/districts/types';

test('T-E11-composition @E11 @E11-AC03 authored district objects respect origin and open runtime collider/nav', async () => {
  const w = await arena(), layout: DistrictLayout = JSON.parse(readFileSync('public/assets/layouts/D-RES.layout.json', 'utf8'));
  const [x, z] = resolvePosition(districtGameplay['D-RES'].playerStart, layout);
  w.loadComposition({ id: 'E11-composition', tier: 0, timeOfDay: 'L1', districts: [{ id: 'D-RES', origin: [50, -50], overrides: { interactions: {
    devices: [{ kind: 'door', position: { x: x + 1, z }, options: { key: 'key.house' } }],
    pickups: [{ kind: 'item', position: { x, z }, item: 'key.house' }],
  } } }] }, [layout]);
  const door = w.query({ archetype: 'device.door' })[0], nav = w.districts!.nav, colliders = w.physics.colliderCount;
  expect(door.transform).toMatchObject({ x: x + 51, z: z - 50 });
  expect(nav.walkable([door.transform.x, door.transform.z])).toBe(false);
  w.setInput({ interact: true }); step(w, 1);
  expect(w.entities.get(door.id)!.interactable!.open).toBe(true);
  expect(nav.walkable([door.transform.x, door.transform.z])).toBe(true);
  expect(w.physics.colliderCount).toBe(colliders - 1);
  w.reset(); expect(w.getState().perf).toEqual({ entities: 0, bodies: 0, colliders: 0, listeners: 0 });
});

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

test('M1 E11/E12 @E11 @E11-AC03 @E11-AC07 tier rebuild preserves doors and recreates debris bodies', async () => {
  const w = await arena(), layout: DistrictLayout = JSON.parse(readFileSync('public/assets/layouts/D-RES.layout.json', 'utf8'));
  try {
    w.loadComposition({ id: 'E11-tier', tier: 0, timeOfDay: 'L1', districts: [{ id: 'D-RES', origin: [0, 0] }] }, [layout]);
    const p = w.entities.get(1)!.transform;
    const door = w.interactables!.spawn('door', { x: p.x + 2, z: p.z });
    const fence = w.hazards!.spawn('fence', { x: p.x + 4, z: p.z });
    w.hazards!.hit(fence, 1000, 'melee'); expect(w.hazards!.debris.snapshot()).toHaveLength(8);
    w.setTier(1); expect(w.hazards!.debris.snapshot()).toHaveLength(0);
    expect(w.interactables!.nav).toBe(w.districts!.nav);
    expect(w.districts!.nav.walkable([p.x + 2, p.z])).toBe(false);
    w.interactables!.unblock(door);
    const next = w.hazards!.spawn('crate', { x: p.x + 5, z: p.z }); w.hazards!.hit(next, 1000, 'melee');
    expect(w.hazards!.debris.snapshot()).toHaveLength(8); step(w, 1);
  } finally { w.dispose(); }
});


test('M1 E11/E12 @E12 @E12-AC05 checkpoint restores door and prop collision without retaining debris', async () => {
  const w = await arena();
  try {
    w.loadScenario('mission-sandbox', 7);
    const door = w.interactables!.spawn('door', { x: 0, z: 0 });
    const fence = w.hazards!.spawn('fence', { x: 3, z: 0 });
    const mission = w.loadMission(missionSandbox()); mission.begin(); mission.checkpoint('C');
    const colliders = w.physics.colliderCount;
    w.setInput({ interact: true }); step(w, 1);
    expect(w.entities.get(door)!.interactable!.open).toBe(true);
    w.hazards!.hit(fence, 1000, 'melee'); expect(w.hazards!.debris.snapshot()).toHaveLength(8);
    mission.restore('C');
    expect(w.entities.get(door)!.interactable!.open).toBe(false);
    expect(w.entities.get(fence)!.destructible!.broken).toBe(false);
    expect(w.hazards!.debris.snapshot()).toHaveLength(0);
    expect(w.physics.colliderCount).toBe(colliders);
  } finally { w.dispose(); }
});
