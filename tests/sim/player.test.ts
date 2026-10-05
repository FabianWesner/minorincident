import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { survivor } from '../../src/data/survivor';
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';

const worlds: SimWorld[] = [];
async function setup(scenario = 'survivor'): Promise<SimWorld> { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(scenario, 1); return w; }
function step(w: SimWorld, ticks: number): void { for (let i = 0; i < ticks; i++) w.update(); }
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });

test('T-E04-01 @E04 @E04-AC01 acceleration reaches 95% in 9 ticks and release stops within 6', async () => {
  const w = await setup(); w.setInput({ move: { x: 1, z: 0 } }); step(w, 9);
  expect(w.player!.locomotion.displacement.x * 60).toBeGreaterThanOrEqual(4.5 * 0.95);
  w.setInput({ move: { x: 0, z: 0 } }); step(w, 6);
  expect(Math.hypot(w.player!.locomotion.displacement.x, w.player!.locomotion.displacement.z)).toBeLessThan(1e-6);
  // Analog and diagonal input cannot exceed full speed.
  w.setInput({ move: { x: 10, z: 10 } }); step(w, 15);
  expect(Math.hypot(w.player!.locomotion.velocity.x, w.player!.locomotion.velocity.z)).toBeCloseTo(4.5);
});

test('T-E04-02 @E04 @E04-AC02 200-direction capsule sweep never penetrates the static wall ring over 0.02m', async () => {
  const w = await setup('survivor-ring');
  for (let i = 0; i < 200; i++) {
    const angle = i * Math.PI * 2 / 200;
    w.entities.get(1)!.transform.x = w.entities.get(1)!.transform.z = 0;
    w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.physics.update();
    w.player!.locomotion.reset(); w.setInput({ move: { x: Math.cos(angle), z: Math.sin(angle) } });
    for (let tick = 0; tick < 150; tick++) {
      w.update(); const p = w.entities.get(1)!.transform;
      expect(Math.max(Math.abs(p.x), Math.abs(p.z)) + survivor.radius - 5, `direction ${i}, tick ${tick}`).toBeLessThanOrEqual(0.02);
    }
  }
});

test('T-E04-03 @E04 @E04-AC03 diagonal motion keeps at least 60% tangential speed along a wall', async () => {
  const w = await setup('survivor-ring');
  w.entities.get(1)!.transform.x = 4.6; w.entities.get(1)!.transform.z = -3;
  w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.physics.update();
  w.setInput({ move: { x: 1, z: 1 } }); step(w, 30);
  const start = w.entities.get(1)!.transform.z; step(w, 30);
  expect((w.entities.get(1)!.transform.z - start) / 0.5).toBeGreaterThanOrEqual(0.6 * 4.5 / Math.SQRT2);
});

test('T-E04-04 @E04 @E04-AC04 aim holds snap in one tick; movement turns at 720 degrees per second', async () => {
  const w = await setup(); const p = w.entities.get(1)!;
  for (const side of ['left', 'right'] as const) {
    w.setInput({ aim: { x: 0, z: 1 }, [side]: { held: true, down: false, up: false } }); step(w, 1);
    expect(p.transform.yaw).toBeCloseTo(-Math.PI / 2);
    w.clearInput();
  }
  p.transform.yaw = 0; w.setInput({ move: { x: -1, z: 0 }, aim: { x: 1, z: 0 } }); step(w, 1);
  expect(Math.abs(p.transform.yaw)).toBeCloseTo(4 * Math.PI / 60);
  step(w, 14); expect(Math.abs(p.transform.yaw)).toBeCloseTo(Math.PI);
});

test('T-E04-05 @E04 @E04-AC05 damage grants exactly 36 invulnerable ticks; regen starts at 240 ticks and gives 2 HP/s', async () => {
  const w = await setup(); const player = w.player!;
  expect(player.damage(20, w.tick)).toBe(20);
  for (let tick = 1; tick < 36; tick++) { step(w, 1); expect(player.damage(20, w.tick)).toBe(0); }
  step(w, 1); expect(player.damage(10, w.tick)).toBe(10);
  step(w, 239); expect(player.entity.health.current).toBe(70);
  step(w, 1); expect(player.entity.health.current).toBeCloseTo(70 + 2 / 60);
  step(w, 59); expect(player.entity.health.current).toBeCloseTo(72);
  step(w, 2000); expect(player.entity.health.current).toBe(100);
});

test('T-E04-06 @E04 @E04-AC06 death emits once and respawns at last checkpoint at tick 120; level state survives', async () => {
  const w = await setup(); const p = w.player!;
  w.mission = { completedObjectives: ['pharmacy'] }; w.progression = { pickups: ['bat', 'medkit'] };
  p.setCheckpoint({ x: -2, y: 0.705, z: 3 }); p.setCheckpoint({ x: 4, y: 0.705, z: -2 });
  const retained = { mission: structuredClone(w.mission), progression: structuredClone(w.progression) };
  p.damage(100, w.tick); p.damage(100, w.tick);
  expect(w.events.events().filter((e) => e.type === 'player.died')).toHaveLength(1);
  w.setInput({ move: { x: 1, z: 0 } }); step(w, 119);
  expect(p.entity.health.current).toBe(0); expect(p.entity.survivor!.animation).toBe('die');
  w.clearInput(); step(w, 1);
  expect(p.entity.transform.x).toBeCloseTo(4); expect(p.entity.transform.z).toBeCloseTo(-2);
  expect(p.entity.health.current).toBe(100); expect(p.entity.survivor!.animation).toBe('idle');
  expect(w.events.events().filter((e) => e.type === 'player.respawned')).toHaveLength(1);
  expect(w.getState()).toMatchObject(retained);
});

test('T-E04-07 @E04 @E04-AC07 move-only escape from 12 overlapping infected within 3 seconds; walls remain solid', async () => {
  const w = await setup();
  const crowd = Array.from({ length: 12 }, (_, i) => ({ transform: { x: Math.cos(i * Math.PI / 6) * 0.85, z: Math.sin(i * Math.PI / 6) * 0.85 }, radius: 0.4 }));
  w.player!.locomotion.crowd = crowd; w.setInput({ move: { x: 1, z: 0 } });
  for (let i = 0; i < 180; i++) {
    w.update(); const p = w.player!.entity.transform;
    if (Math.hypot(p.x, p.z) < 1.6) expect(w.player!.locomotion.displacement.x * 60).toBeGreaterThanOrEqual(0.2 - 1e-4);
  }
  expect(w.player!.entity.transform.x).toBeGreaterThan(1.6);
  const wall = await setup('survivor-ring'); wall.player!.locomotion.crowd = [{ transform: { x: 4, z: 0 }, radius: 1 }];
  wall.setInput({ move: { x: 1, z: 0 } }); step(wall, 180);
  expect(wall.player!.entity.transform.x + survivor.radius).toBeLessThanOrEqual(5.02);
});

test('T-E04-perf @E04 fixed-step survivor reference scenario stays below 4ms p95 with twelve crowd circles', async () => {
  const w = await setup(); w.player!.locomotion.crowd = Array.from({ length: 12 }, (_, i) => ({ transform: { x: Math.cos(i) * 0.85, z: Math.sin(i) * 0.85 }, radius: 0.4 }));
  const times: number[] = []; w.setInput({ move: { x: 1, z: 0 } }); step(w, 120);
  for (let i = 0; i < 3600; i++) { const start = performance.now(); w.update(); times.push(performance.now() - start); }
  times.sort((a, b) => a - b); const p95 = times[Math.floor(times.length * 0.95)];
  mkdirSync('test-results/epics/E04', { recursive: true }); writeFileSync('test-results/epics/E04/sim-perf.json', JSON.stringify({ ticks: 3600, crowd: 12, simMsP95: p95, budgetMs: 4 }));
  expect(p95).toBeLessThan(4);
});
