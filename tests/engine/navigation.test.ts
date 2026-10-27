// Navigation core: one NavGrid (collider-baked, dynamic blockers, budgeted A*) moves every infected, ally and pet in all levels.
import { afterEach, expect, test } from 'vitest';
import { NavGrid } from '../../src/sim/ai/NavGrid';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { survivor } from '../../src/data/survivor';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function arena(name: string) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name); w.combat!.damage.god = true; return w; }

test('capsule moves: a body inside the wall margin slides out and never moves deeper or crosses the solid', () => {
  const nav = new NavGrid({ width: 20, depth: 20 }, [{ x: 0, y: 1, z: 0, halfX: 1, halfY: 1, halfZ: 2 }]);
  for (const overlap of [.001, .015, .055, .095]) {
    const p = { x: 1.35 - overlap, z: 0 }, start = p.x;
    nav.move(p, -.02, 0, .35); expect(p.x).toBe(start);
    nav.move(p, .02, 0, .35); expect(p.x).toBeGreaterThan(start);
  }
  const p = { x: 1.33, z: 0 };
  expect(nav.clear(p.x, p.z, .34)).toBe(false);
  for (let i = 0; i < 30; i++) nav.move(p, 0, .1, .34);
  expect(p.z).toBeCloseTo(3);
  nav.move(p, .1, 0, .34); expect(nav.clear(p.x, p.z, .34)).toBe(true);
  for (let i = 0; i < 30; i++) nav.move(p, -.1, -.1, .34);
  expect(nav.clear(p.x, p.z, .34)).toBe(true);
});

test('A*: budgeted search resumes across ticks within its expansion budget; connectivity tells a long route from an enclosed yard', async () => {
  const w = await arena('maze'), nav = w.infected!.nav, result: number[] = [];
  let complete = false;
  for (let tick = 0; tick < 500 && !complete; tick++) { complete = nav.path(nav.cell(-20, 0), nav.cell(20, 0), result, 10); expect(nav.expansions).toBeLessThanOrEqual(10); }
  expect(complete).toBe(true); expect(result.length).toBeGreaterThan(80);
  for (const cell of result) expect(nav.blocked[cell]).toBe(0);

  const grid = new NavGrid({ width: 100, depth: 100 }, [
    { x: 0, z: -3, y: 1, halfX: 3.2, halfZ: .2, halfY: 1 }, { x: 0, z: 3, y: 1, halfX: 3.2, halfZ: .2, halfY: 1 },
    { x: -3, z: 0, y: 1, halfX: .2, halfZ: 3, halfY: 1 }, { x: 3, z: 0, y: 1, halfX: .2, halfZ: 3, halfY: 1 },
  ]);
  const from = grid.cell(-40, -40), goal = grid.cell(40, 40), path: number[] = [];
  expect(grid.path(from, goal, path, 1)).toBe(false);
  expect(grid.pending(from, goal)).toBe(true);
  const reachable = grid.reachableFrom(goal);
  expect(reachable[from]).toBe(1); expect(reachable[grid.cell(0, 0)]).toBe(0);
  expect(grid.pending(from, goal)).toBe(true);
  expect(grid.path(from, goal, path, Infinity)).toBe(true);

  // A live HUD route query must not restart click-to-move's incremental flood.
  // L4's parked-car bend reproduces the shared-workspace starvation after a
  // collapse respawn: the destination is connected, yet neither query finishes.
  const { world, mission } = await loadL4(1, 'low'); worlds.push(world);
  mission.l4!.completed('ride'); world.update(); world.update();
  mission.l4!.completed('quartermaster'); mission.l4!.completed('hold');
  for (let tick = 0; tick < 40; tick++) world.update();
  const position = { x: 30, z: 41.5 }, destination = { x: -79, z: -40 };
  Object.assign(world.entities.get(1)!.transform, position);
  const playerNav = world.infected!.nav.forPlayer(survivor.radius + .02, .25);
  const route = { path: [] as number[], goal: -1, pathIndex: 0 }, waypoint = { x: 0, z: 0 }, hint = { x: 0, z: 0 };
  let routed = false;
  mission.l4!.cellarDistance(hint);
  for (let tick = 0; tick < 120 && !routed; tick++) {
    routed = playerNav.steer(position, destination, route, survivor.radius + .02, waypoint, 3000, true);
    mission.l4!.cellarDistance(hint);
  }
  expect(routed, 'HUD hint must leave the movement flood resumable').toBe(true);
  const end = route.path.at(-1)!;
  expect(Math.hypot(playerNav.x(end) - destination.x, playerNav.z(end) - destination.z)).toBeLessThan(1);
});

test('dynamic blockers: a prepared rebake equals a full rebake after doors and carts open and close', () => {
  const walls = [{ x: 2, z: 0, y: 1, halfX: .6, halfZ: 2, halfY: 1 }];
  const grid = new NavGrid({ width: 20, depth: 20 }, walls), full = new NavGrid({ width: 20, depth: 20 }, walls);
  const door = { x: -2, z: 0, y: 1, halfX: .5, halfZ: 1, halfY: 1 }, cart = { ...door, x: -4, z: -3 };
  grid.setBlocker(1, door, true);
  const baked = grid.prepare(walls);
  grid.setBlocker(1, door, false); grid.setBlocker(2, cart, true); full.setBlocker(2, cart, true);
  grid.rebake(baked); full.rebake(); expect(grid.blocked).toEqual(full.blocked);
  grid.setBlocker(2, door, true); full.setBlocker(2, door, true); full.rebake(); expect(grid.blocked).toEqual(full.blocked);
  grid.setBlocker(2, door, false); full.setBlocker(2, door, false); full.rebake(); expect(grid.blocked).toEqual(full.blocked);
});

test('chasers path through a maze and an offset district without ever overlapping a static collider', async () => {
  const w = await arena('maze'); expect(w.infected!.navigation.districts).toHaveLength(3);
  const e = w.entities.get(w.infected!.spawn('infected.runner', { x: -20, z: 0 }, { state: 'chase' }))!;
  for (let i = 0; i < 900; i++) { w.update(); expect(w.infected!.nav.clear(e.transform.x, e.transform.z, e.combat!.radius)).toBe(true); }
  expect(Math.hypot(e.transform.x - 20, e.transform.z)).toBeLessThan(1.2);

  const o = await arena('offset-horde'), ai = o.infected!;
  const r = o.entities.get(ai.spawn('infected.runner', { x: 95, z: 50 }, { state: 'chase' }))!;
  for (let i = 0; i < 450; i++) { o.update(); expect(ai.nav.clear(r.transform.x, r.transform.z, r.combat!.radius)).toBe(true); }
  expect(Math.hypot(r.transform.x - 105, r.transform.z - 50)).toBeLessThan(1.2);
});
