// Spawn/pressure admission: the director decides where and when every wave, migration, revival and house resident
// appears (offscreen, clear of the courier and colliders, inside the caps). All levels' pressure goes through it.
import { afterEach, expect, test } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { View } from '../../src/render/View';
import { missionControls } from '../../src/sim/missions/controls';
import { SimWorld } from '../../src/sim/world/SimWorld';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function arena() { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena'); return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
const spawn = (w: SimWorld, role: string, x: number, z = 0, state: 'chase' | 'idle' = 'chase') => w.entities.get(w.infected!.spawn(`infected.${role}`, { x, z }, { state }))!;

test('placement: never inside the courier radius, the expanded camera volume (also at max zoom) or a collider', async () => {
  const w = await arena(), d = w.infected!.director;
  expect(d.safe('infected.runner', { x: 0, z: 17.9 })).toBe(false); expect(d.visible({ x: 34, z: 0 })).toBe(true);
  d.request('infected.runner', { x: 48, z: 0 }); d.request('infected.runner', { x: 0, z: 0 }); d.request('infected.runner', { x: 60, z: 0 }); step(w, 1);
  expect(w.infected!.active).toHaveLength(1); expect(d.queue).toHaveLength(2);
  const e = w.infected!.active[0];
  expect(Math.hypot(e.transform.x, e.transform.z)).toBeGreaterThanOrEqual(18); expect(d.visible(e.transform)).toBe(false);
  expect(w.infected!.nav.clear(e.transform.x, e.transform.z, e.combat!.radius)).toBe(true);
  // With a narrow camera, an offscreen clear cell still needs 18 m from the courier.
  const narrow = await arena(), nd = narrow.infected!.director; nd.camera.halfWidth = 5; nd.camera.halfDepth = 5;
  expect(nd.offscreen({ x: 0, z: 12 })).toBe(true);
  expect(nd.safe('infected.runner', { x: 0, z: 12 })).toBe(false); expect(nd.safe('infected.runner', { x: 0, z: 19 })).toBe(true);

  const ortho = new Matrix4().makeOrthographic(-20, 20, 20, -20, 0.1, 100).multiply(new Matrix4().makeRotationX(Math.PI / 2)).multiply(new Matrix4().makeTranslation(0, -50, 0));
  d.setFrustum(ortho.elements); expect(d.visible({ x: 21.9, z: 0 })).toBe(true); expect(d.visible({ x: 22.1, z: 0 })).toBe(false);

  const z = await arena(), director = z.infected!.director, view = new View();
  view.resize(1600, 900); view.reset({ x: 0, z: 0 });
  const projection = new Matrix4();
  const sync = () => director.setFrustum(projection.multiplyMatrices(view.simCamera.projectionMatrix, view.simCamera.matrixWorldInverse).elements, view.simCamera.position);
  const at = { x: -19, z: 0 };
  sync(); expect(director.offscreen(at)).toBe(true);
  view.zoom(100); view.update({ x: 0, z: 0 }, 2); sync();
  const screen = new Vector3(at.x, .7, at.z).project(view.simCamera);
  expect(Math.abs(screen.x)).toBeLessThan(1);
  director.request('infected.runner', at); step(z, 1);
  expect(director.queue).toHaveLength(1); expect(z.infected!.active).toHaveLength(0);
  view.zoom(-100); view.update({ x: 0, z: 0 }, 2); sync(); step(z, 1);
  expect(director.queue).toHaveLength(0); expect(z.infected!.active).toHaveLength(1);
});

test('caps: waves queue and resume inside both tier caps; reserved slots wait for residents; revivals and migrations never exceed the cap', async () => {
  for (const tier of ['high', 'low'] as const) {
    const w = await arena(), d = w.infected!.director; d.tier = tier; d.wave('infected.runner', 230); step(w, 1);
    expect(d.count, tier).toBe(d.cap); expect(d.queue.length).toBe(230 - d.cap);
    for (const e of w.infected!.active) e.health.current = 0;
    step(w, 1); expect(d.count).toBe(Math.min(d.cap, 230 - d.cap));
  }
  const r = await arena(), d = r.infected!.director;
  d.levelCap = 6; d.reserved = 2; d.wave('infected.runner', 6); step(r, 1);
  expect(d.cap).toBe(6); expect(d.count).toBe(4); expect(d.queue).toHaveLength(2);
  d.reserved = 0; step(r, 1); expect(d.count).toBe(6); expect(d.queue).toHaveLength(0);

  const n = await arena(), ai = n.infected!, runner = spawn(n, 'runner', 2, 0, 'idle'); runner.health.current = 0;
  const nurse = spawn(n, 'nurse', 1); ai.director.levelCap = 1;
  step(n, 25); expect(ai.director.count).toBe(1); expect(runner.health.current).toBe(0); expect(nurse.infected!.reviveUsed).toBe(false);
  ai.director.levelCap = 2; step(n, 100); expect(ai.director.count).toBe(2); expect(runner.health.current).toBe(runner.health.max);

  const m = await arena(), mai = m.infected!; mai.director.levelCap = 1; const blocker = spawn(m, 'runner', 20, 0, 'idle');
  const migration = mai.director.migration([{ x: -48, z: -20 }, { x: 48, z: -20 }], 1);
  expect(migration.members).toHaveLength(0); expect(mai.director.queue).toHaveLength(1);
  blocker.health.current = 0; step(m, 1); expect(migration.members).toHaveLength(1); expect(mai.director.queue).toHaveLength(0);
});

test('a 150-infected migration follows its spline on time and fans out at the goal', async () => {
  const w = await arena(), d = w.infected!.director;
  const m = d.migration([{ x: -48, z: -20 }, { x: -10, z: -18 }, { x: 25, z: -24 }, { x: 48, z: -20 }]);
  step(w, Math.ceil(m.expectedSeconds * 60));
  expect(m.arrived).toBe(150);
  expect(w.tick / 60 / m.expectedSeconds).toBeGreaterThanOrEqual(0.8); expect(w.tick / 60 / m.expectedSeconds).toBeLessThanOrEqual(1.2);
  for (const id of m.members) { const e = w.entities.get(id)!; expect(Math.hypot(e.transform.x - 48, e.transform.z + 20)).toBeLessThan(4.5); }
});

test('pooling: spawn/kill cycles reuse prewarmed records, keep every corpse, and refresh borrowed collision radii', async () => {
  const w = await arena(), ai = w.infected!, allocated = ai.counters.allocated, records = new Set(ai.pool); w.combat!.damage.god = true;
  missionControls(w).teleport('player', { x: 40, z: 40 });
  let reused = true;
  for (let tick = 0; tick < 3600; tick++) {
    if (tick % 600 === 0) for (const e of ai.active) e.health.current = 0;
    w.update();
    if (tick % 600 === 0) for (let i = 0; i < 150; i++) spawn(w, 'runner', i % 15 - 7, 10 + Math.floor(i / 15), 'idle');
    for (const e of ai.active) reused = records.has(e) && reused;
  }
  expect(reused).toBe(true); expect(ai.counters.allocated).toBe(allocated);
  expect([...w.entities.iterate()].filter(e => e.corpse)).toHaveLength(750);

  const r = await arena(), runner = spawn(r, 'runner', 10, 0, 'idle'); step(r, 1);
  expect(r.player!.locomotion.crowd[0].radius).toBe(0.35);
  runner.health.current = 0; step(r, 2762);
  const gorilla = spawn(r, 'gorilla', 10, 0, 'idle'); expect(gorilla).toBe(runner); step(r, 1);
  expect(r.player!.locomotion.crowd[0].radius).toBe(0.7);
});
