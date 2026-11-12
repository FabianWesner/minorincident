// Navigation core: one NavGrid (collider-baked, dynamic blockers, budgeted A*) moves every infected, ally and pet in all levels.
import { afterEach, expect, test } from 'vitest';
import { NavGrid } from '../../src/sim/ai/NavGrid';
import { bakeNav, NavGrid as WorldNavGrid } from '../../src/sim/world/NavGrid';
import { goalReach, stepUpM } from '../../src/sim/world/TrapRescue';
import type { DistrictLayout, Placement } from '../../src/levels/districts/types';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { survivor } from '../../src/data/survivor';
import { checkL7Navigation } from '../helpers/l7Uat';
import { PathProbe } from '../../tools/qa/threat/observer';
import { loadLevel } from '../../tools/sim-runner/levels';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function arena(name: string) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name); w.combat!.damage.god = true; return w; }

function checkDirectedReach(): void {
  for (let pattern = 0; pattern < 24; pattern++) {
    const nav = new WorldNavGrid([0, 0], [12, 12]), heights = new Float32Array(nav.cells.length);
    for (let i = 0; i < nav.cells.length; i++) { nav.cells[i] = (i * 31 + pattern * 17) % 13 > 1 ? 1 : 0; heights[i] = pattern % 3 ? ((i * 17 + pattern * 3) % 7) * .4 : 0; }
    const flood = new Uint8Array(nav.cells.length), pending = [nav.index(3.5, 4.5)];
    if (nav.cells[pending[0]]) flood[pending[0]] = 1; else pending.length = 0;
    for (let cursor = 0; cursor < pending.length; cursor++) {
      const i = pending[cursor], x = i % nav.width;
      for (const j of [x ? i - 1 : -1, x + 1 < nav.width ? i + 1 : -1, i - nav.width, i + nav.width]) {
        if (j >= 0 && j < flood.length && nav.cells[j] && !flood[j]) { flood[j] = 1; pending.push(j); }
      }
    }
    expect(nav.flood([3.5, 4.5]), `scanline flood pattern ${pattern}`).toEqual(flood);
    const goals = [{ x: 3.5, z: 4.5 }, { x: 10.5, z: 8.5 }], expected = new Uint8Array(nav.cells.length), queue: number[] = [];
    for (const goal of goals) { const i = nav.index(goal.x, goal.z); if (nav.cells[i]) { expected[i] = 1; queue.push(i); } }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const i = queue[cursor], x = i % nav.width, z = Math.floor(i / nav.width);
      for (const [dx, dz] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
        const nx = x + dx, nz = z + dz, j = nz * nav.width + nx;
        if (nx < 0 || nx >= nav.width || nz < 0 || nz >= nav.height || !nav.cells[j] || expected[j]) continue;
        if (dx && dz && (!nav.cells[i + dx] || !nav.cells[i + dz * nav.width])) continue;
        if (heights[i] - heights[j] <= stepUpM) { expected[j] = 1; queue.push(j); }
      }
    }
    expect(goalReach(nav, () => { throw Error('Prepared heights must be used'); }, goals, heights), `directed ground pattern ${pattern}`).toEqual(expected);
  }
}

test('capsule moves: a body inside the wall margin slides out and never moves deeper or crosses the solid', () => {
  checkDirectedReach();
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
  const wreck: Placement = { id: 'reviewed-wreck', assetId: 'veh.sedan-red', position: [-72, 0, 26.8], yaw: .6,
    scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: 'test', visualAabb: { min: [0, 0, 0], max: [0, 0, 0] } };
  const proxy = placementColliders([wreck], [])[0].aabb;
  const oriented = placementColliders([{ ...wreck, orientedFootprint: true }], [])[0].aabb;
  expect(proxy.navFootprint, 'authored collision proxies require explicit review').toBeUndefined();
  expect(oriented.navFootprint).toMatchObject({ yaw: .6, halfX: 2.298, halfZ: 1.144 });
  expect(oriented.min).toEqual(proxy.min); expect(oriented.max).toEqual(proxy.max);
  const hull = { x: (oriented.min[0] + oriented.max[0]) / 2, z: (oriented.min[2] + oriented.max[2]) / 2,
    y: 1, halfY: 1, halfX: (oriented.max[0] - oriented.min[0]) / 2, halfZ: (oriented.max[2] - oriented.min[2]) / 2, navFootprint: oriented.navFootprint! };
  const gate = new NavGrid({ width: 20, depth: 20 }, [hull], .5, { x: -72, z: 26.8 });
  const gateProxy = new NavGrid(gate.ground, [{ ...hull, navFootprint: undefined }], .5, gate.center);
  expect(gateProxy.clear(-70.25, 24.25, .5), 'the proxy closes a physically clear corner').toBe(false);
  expect(gate.clear(-70.25, 24.25, .5), 'the unchanged crowd radius fits the actual hull corner').toBe(true);
  const layout = { bounds: [[-8, -8], [8, -8], [8, 8], [-8, 8]], walkable: { excluded: [] } } as unknown as DistrictLayout;
  const bounds = { min: [-4, 0, -4] as [number, number, number], max: [4, 2, 4] as [number, number, number], navFootprint: { x: 0, z: 0, halfX: 3.5, halfZ: .5, yaw: Math.PI / 4 } };
  const districtNav = bakeNav([{ layout, origin: [0, 0], colliders: [bounds] }], 1, .5);
  expect(districtNav.walkable([3.25, -3.25])).toBe(true);
  expect(districtNav.walkable([2.25, -2.25])).toBe(false);
  const aiNav = new NavGrid({ width: 20, depth: 20 }, [{ x: 0, z: 0, y: 1, halfX: 4, halfZ: 4, halfY: 1, navFootprint: { x: 0, z: 0, halfX: 3.5, halfZ: .5, yaw: Math.PI / 4 } }]);
  expect(aiNav.clear(3, -3, .35)).toBe(true); expect(aiNav.clear(2, -2, .35)).toBe(false);
  expect(aiNav.visible({ x: 3, z: -3 }, { x: 5, z: -1 }, .35)).toBe(true);
  const maskedNav = new NavGrid(aiNav.ground, aiNav.walls, aiNav.clearance, aiNav.center, () => true);
  expect(aiNav.blocked).toEqual(maskedNav.blocked);
  // Exact circular clearance around reviewed rotated hulls cannot close
  // cells that were clear of the old conservative proxy.
  const cornerWall = { x: 0, z: 0, y: 1, halfX: 2.5 / Math.SQRT2, halfZ: 2.5 / Math.SQRT2, halfY: 1,
    navFootprint: { x: 0, z: 0, halfX: 2, halfZ: .5, yaw: Math.PI / 4 } };
  const corners = new NavGrid({ width: 10, depth: 10 }, [cornerWall], .5);
  expect(corners.clear(2.4, -1.1, .5)).toBe(true);
  expect(corners.clear(2.25, -1.25, .5)).toBe(true);
  expect(corners.clear(2.25, -1.25, .5, true)).toBe(true);
  const cornerStart = { x: 3.25 / Math.SQRT2, z: -1.55 / Math.SQRT2 };
  const cornerEnd = { x: 3.25 / Math.SQRT2, z: -1.45 / Math.SQRT2 };
  expect(corners.clear(cornerStart.x, cornerStart.z, .5)).toBe(true);
  expect(corners.clear(cornerEnd.x, cornerEnd.z, .5)).toBe(true);
  expect(corners.visible(cornerStart, cornerEnd, .5), 'segment clearance agrees with rounded cell clearance').toBe(true);
  expect(corners.visible({ x: 3.01 / Math.SQRT2, z: -2.01 / Math.SQRT2 },
    { x: 3.01 / Math.SQRT2, z: -.99 / Math.SQRT2 }, .5), 'a chord through the rounded corner still collides').toBe(false);
  const broad = new NavGrid(corners.ground, [{ ...cornerWall, navFootprint: undefined }], .5);
  for (let cell = 0; cell < corners.blocked.length; cell++) if (!broad.blocked[cell]) expect(corners.blocked[cell], `no newly closed cell ${cell}`).toBe(0);
  expect(corners.clear(1.75, -1.25, .5)).toBe(false);
  const maskedCorners = new NavGrid(corners.ground, corners.walls, .5, corners.center, () => true);
  expect(corners.blocked).toEqual(maskedCorners.blocked);

  {
  // fix55-l3: a body shoved deeper than the margin cut is not wedged; it slides out along the face, never deeper.
  // The L3 corgi stood 0.12 m inside a kerb blocker (radius 0.44, cuts up to 0.1) and refused every step for 450 s.
  const nav = new NavGrid({ width: 20, depth: 20 }, [{ x: 0, y: .6, z: 0, halfX: .45, halfY: .6, halfZ: .3 }]);
  const p = { x: -.77, z: .2 }, radius = .44;
  expect(nav.clear(p.x, p.z, radius - .1)).toBe(false);
  nav.move(p, .02, 0, radius); expect(p.x, 'inward step refused').toBe(-.77);
  const before = { ...p };
  nav.move(p, .1, .06, radius);
  expect(p.x, 'no deeper along x').toBe(before.x); expect(p.z, 'slides along the face').toBeGreaterThan(before.z);
  for (let i = 0; i < 40; i++) nav.move(p, .1, .06, radius);
  expect(nav.clear(p.x, p.z, radius), 'out of the solid').toBe(true);
  }
});

test('A*: budgeted search resumes across ticks within its expansion budget; connectivity tells a long route from an enclosed yard', async () => {
  {
  const nav = new NavGrid({ width: 30, depth: 30 }, [{ x: 0, z: 0, y: 1, halfX: .3, halfZ: 3, halfY: 1 }]);
  nav.flow(5, 0, 100_000);
  const from = { x: -5, z: 0 }, cell = nav.nearestCell(from.x, from.z);
  const waypoint = nav.flowWaypoint(cell, from, .35), at = { x: nav.x(waypoint), z: nav.z(waypoint) };
  expect(nav.visible(from, at, .35)).toBe(true);
  expect(Math.hypot(at.x - from.x, at.z - from.z)).toBeGreaterThan(1);
  expect(waypoint).not.toBe(nav.flowNext(cell));
  const corner = { x: -.75, z: -2.75 }, next = nav.flowWaypoint(nav.nearestCell(corner.x, corner.z), corner, .35);
  expect(nav.visible(corner, { x: nav.x(next), z: nav.z(next) }, .35)).toBe(true);
  }
  await checkL7Navigation();
  {
    const w = await loadLevel('L2', 1, undefined, 0, { quality: 'low' }); worlds.push(w);
    const nav = w.infected!.nav, path: number[] = [], from = nav.cell(5.25, -26.75), goal = nav.nearestCell(10, -30);
    // Parked cars are now sleeping props; include their live blockers in the
    // old AABB proxy so this still proves the reviewed pickup OBB is needed.
    const proxy = new NavGrid(nav.ground, [...nav.walls, ...w.props!.navWalls.values()].map(wall => ({ ...wall, navFootprint: undefined })), .5, nav.center, nav.mask);
    expect(proxy.path(from, goal, path, Infinity), 'pickup proxy created an eight-cell island').toBe(false);
    expect(nav.path(from, goal, path, Infinity), 'reviewed pickup footprint connects the island to the street').toBe(true);
  }

  const nav = new NavGrid({ width: 44, depth: 12 }, [{ x: 0, z: 0, y: 1, halfX: .5, halfZ: 4.5, halfY: 1 }]), result: number[] = [];
  let complete = false;
  for (let tick = 0; tick < 500 && !complete; tick++) { complete = nav.path(nav.cell(-18, 0), nav.cell(18, 0), result, 10); expect(nav.expansions).toBeLessThanOrEqual(10); }
  expect(complete).toBe(true); expect(result.length).toBeGreaterThan(80);
  for (const cell of result) expect(nav.blocked[cell]).toBe(0);
  const detour = new NavGrid({ width: 40, depth: 40 }, [{ x: 0, y: 1, z: 0, halfX: .5, halfY: 1, halfZ: 8 }]);
  const actor = structuredClone(worlds[0].entities.get(1)!); Object.assign(actor.transform, { x: -2, z: 0 });
  const probe = new PathProbe(), probeGoal = { x: 2, z: 0 }, expansions = detour.expansions;
  expect(probe.query(detour, actor, probeGoal), 'connected long detour').toBe(true);
  expect(probe.query(detour, actor, probeGoal, 2.5), 'a long detour is not locally reachable').toBe(false);
  expect(probe.query(detour, actor, probeGoal, 8), 'relaxed path stretch retains connectivity').toBe(true);
  expect(detour.expansions, 'audit searches never advance the live navigation grid').toBe(expansions);

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

  // Recorded Grove porch/market poses are physically clear but disconnected
  // by the civilian bake. Infected keep their full .35 m body radius.
  for (const [level, at, destination] of [
    ['L1', { x: 4.562189064505742, z: 24.808600961977945 }, { x: 6.006657600402832, z: 33.62395095825195 }],
    ['L2', { x: -50.81836635325894, z: -4.031225946136547 }, { x: -53.16584014892578, z: -32.84975814819336 }],
  ] as const) {
    const grove = await loadLevel(level, 1); worlds.push(grove);
    const ai = grove.infected!, id = ai.spawn('infected.runner', { x: 0, z: 30 });
    const body = structuredClone(grove.entities.get(id)!); Object.assign(body.transform, at);
    expect(ai.nav.clearance).toBe(.5);
    expect(ai.infectedNav.clearance).toBe(.35);
    expect(ai.infectedNav.clear(at.x, at.z, body.combat!.radius)).toBe(true);
    expect(probe.query(ai.nav, body, destination, 2.5), `${level} civilian-bake counterexample`).toBe(false);
    expect(probe.query(ai.infectedNav, body, destination, 2.5), `${level} body-clear route`).toBe(true);
  }

  // A live HUD route query must not restart the incremental player-navigation flood.
  // L4's parked-car bend reproduces the shared-workspace starvation after a
  // collapse respawn: the destination is connected, yet neither query finishes.
  const { world, mission } = await loadL4(1, 'low'); worlds.push(world);
  expect(world.infected!.nav.clearance).toBe(.5);
  expect(world.infected!.infectedNav.clearance).toBe(.35);
  // Actual bodies stranded behind reception ropes, chair rows and the desk's
  // west corner. The production grid must connect these poses to the aisle.
  for (const [x, z] of [[-27.55, -6.9], [-24.93, -12.97], [-23.49, -12.41], [-27.66, -5.35]]) {
    const body = structuredClone(world.entities.get(1)!);
    Object.assign(body.transform, { x, z }); body.combat!.radius = .35;
    expect(probe.query(world.infected!.nav, body, { x: -20, z: -2 }, 2.5), `reception exit from ${x},${z}`).toBe(true);
  }
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

test('dynamic blockers: a prepared rebake equals a full rebake after doors and carts open and close; a checkpoint restore re-announcing unchanged blockers leaves every AI grid identical (L10, L8)', async () => {
  const walls = [{ x: 2, z: 0, y: 1, halfX: .6, halfZ: 2, halfY: 1 }];
  const grid = new NavGrid({ width: 20, depth: 20 }, walls), full = new NavGrid({ width: 20, depth: 20 }, walls);
  const door = { x: -2, z: 0, y: 1, halfX: .5, halfZ: 1, halfY: 1 }, cart = { ...door, x: -4, z: -3 };
  grid.setBlocker(1, door, true);
  const baked = grid.prepare(walls);
  grid.setBlocker(1, door, false); grid.setBlocker(2, cart, true); full.setBlocker(2, cart, true);
  grid.rebake(baked); full.rebake(); expect(grid.blocked).toEqual(full.blocked);
  grid.setBlocker(2, door, true); full.setBlocker(2, door, true); full.rebake(); expect(grid.blocked).toEqual(full.blocked);
  grid.setBlocker(2, door, false); full.setBlocker(2, door, false); full.rebake(); expect(grid.blocked).toEqual(full.blocked);
  // r29-respawn: identical re-announcements skip the cell re-bake but moved/removed blockers still re-bake.
  const gridOf = (fast: boolean) => {
    NavGrid.fastReannounce = fast;
    const g = new NavGrid({ width: 40, depth: 40 }, []), a = { x: 5, z: 5, y: 1, halfX: 2, halfY: 1, halfZ: 1 }, b = { x: -6, z: 3, y: 1, halfX: 1, halfY: 1, halfZ: 3, navFootprint: { x: -6, z: 3, halfX: 1, halfZ: 3, yaw: .4 } };
    g.setBlocker(-1, a, true); g.setBlocker(-2, b, true);
    for (let pass = 0; pass < 2; pass++) { g.setBlocker(-1, { ...a }, true); g.setBlocker(-2, { ...b }, true); }
    g.setBlocker(-1, a, false); g.setBlocker(-2, { ...b, x: -4, navFootprint: { ...b.navFootprint, x: -4 } }, true);
    return g.blocked;
  };
  try { expect(gridOf(true)).toEqual(gridOf(false)); } finally { NavGrid.fastReannounce = true; }
  // Checkpoint restores on the real levels: every AI grid ends identical to the full re-announce (cells and blocker ids).
  for (const level of ['L10', 'L8'] as const) {
    const states: Record<string, { cells: number[]; ids: number[] }>[] = [];
    for (const fast of [false, true]) {
      NavGrid.fastReannounce = fast;
      const world = await loadLevel(level, 1); worlds.push(world);
      const mission = world.missions!, destruction = world.destruction!, checkpoint = mission.def.checkpoints[0];
      mission.checkpoint(checkpoint);
      for (let round = 0; round < 2; round++) {
        for (const o of destruction.objects.filter(o => o.present && !o.protected).slice(round * 40, round * 40 + 40)) for (const [part, shape] of o.parts.entries()) destruction.damage({ object: o, part, distance: 0, local: shape.bounds.min, normal: [0, 1, 0] }, 'weapon.rocket-launcher', 5000);
        for (let i = 0; i < 200; i++) { world.tick++; destruction.update(); }
        mission.restore(checkpoint);
      }
      const ai = world.infected!, grids: Record<string, NavGrid> = { nav: ai.nav, admission: ai.infectedNav };
      ai.navigation.districts.forEach((d, i) => { grids[`district${i}`] = d.grid; });
      if (world.megaPursuit) grids.mega = world.megaPursuit.grid;
      states.push(Object.fromEntries(Object.entries(grids).map(([k, g]) => [k, { cells: [...g.blocked], ids: [...(g as unknown as { blockers: Map<number, unknown> }).blockers.keys()].sort((x, y) => x - y) }])));
    }
    NavGrid.fastReannounce = true;
    expect(Object.keys(states[1]), level).toEqual(Object.keys(states[0]));
    for (const k of Object.keys(states[0])) {
      expect(states[1][k].ids, `${level}/${k}: blocker ids`).toEqual(states[0][k].ids);
      expect(states[1][k].cells.filter((v, i) => v !== states[0][k].cells[i]).length, `${level}/${k}: differing cells`).toBe(0);
    }
  }
}, 240_000);

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
