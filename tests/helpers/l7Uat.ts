import { expect } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { action } from '../../src/data/actions/catalog';
import { combatArchetypes, ttkBands } from '../../src/data/balance';
import { BoxGeometry, Group, Mesh } from 'three/webgpu';
import { removeL7LakeWall } from '../../src/render/district/l7LakeWall';
import fair from '../../public/assets/layouts/D-FAIR.layout.json';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { goalReach } from '../../src/sim/world/TrapRescue';
import { emptyInput } from '../../src/input/InputFrame';

function checkWallGeometry() {
  const geometry = new BoxGeometry(170, .9, .5), wall = new Mesh(geometry), neighbour = new Mesh(geometry), root = new Group();
  wall.position.set(0, .45, 56.9); neighbour.position.set(0, .45, -60); root.add(wall, neighbour);
  const owned = removeL7LakeWall(root, fair as unknown as DistrictLayout, ['dressing:lake-wall:426']);
  expect(owned).toHaveLength(1);
  expect(wall.geometry.index!.count).toBe(0);
  expect(neighbour.geometry.index!.count).toBe(36); expect(geometry.index!.count).toBe(36);
  for (const g of owned) g.dispose(); geometry.dispose();
}

/** Every checkpoint/objective plus a whole-graph audit, including the PO's lower street. */
export async function checkL7Navigation() {
  checkWallGeometry();
  await checkFollowerBites();
  await checkCorpseCatchup();
  await checkPharmacyCatchup();
  await checkL7CourierYield();
  const w = await loadLevel('L7', 29);
  try {
    const launcher = [...w.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.rocket-launcher');
    expect(launcher, 'the authored launcher remains present for the approach').toBeDefined();
    for (const e of w.infected!.active) e.hidden = true;
    for (let tick = 0; tick < 300; tick++) {
      w.applyInput(emptyInput(), 'keyboard'); w.update();
      expect(w.missions!.state.steps.rocket.status, 'the uncollected launcher stays active').toBe('active');
      for (const row of w.l7Encounters!.state.roster) {
        if (row.status !== 'following') continue;
        const e = w.entities.get(row.id)!;
        expect(Math.hypot(e.transform.x - launcher!.transform.x, e.transform.z - launcher!.transform.z), `survivor ${row.id} stays outside the 2 m objective ring plus body clearance at tick ${w.tick}`).toBeGreaterThanOrEqual(2.35);
      }
    }
    // The loading renderer must see the actual resident models at tick zero;
    // discovering their pedestrian looks on the first AI tick builds new
    // living/corpse shaders during the launcher pickup (L7-01).
    const residents = w.infected!.active.filter(e => e.archetype === 'infected.runner');
    expect(residents.length).toBeGreaterThan(0);
    expect(residents.every(e => e.appearance?.entityId === e.id && e.appearance.asset.startsWith('npc.'))).toBe(true);
    const district = w.districts!;
    const destinations = Object.entries(w.missions!.def.anchors);
    const heightReach = new Map(destinations.map(([name, at]) => {
      return [name, goalReach(district.nav, (x, z) => district.groundHeight(x, z), [at])] as const;
    }));
    for (const checkpoint of ['start', ...w.missions!.def.checkpoints]) {
      w.missions!.loadCheckpoint(checkpoint);
      const nav = w.infected!.nav;
      // Debug graph-prefix loading does not walk the courier to the completed
      // objective. Check the authored checkpoint place as well as the start.
      const p = checkpoint === 'start' ? w.entities.get(1)!.transform : w.missions!.def.anchors[`l7-${checkpoint === 'corridor' ? 'corridor-east' : checkpoint}`];
      const reachable = nav.reachableFrom(nav.nearestCell(p.x, p.z));
      for (const [name, at] of destinations) {
        expect(reachable[nav.nearestCell(at.x, at.z)], `${checkpoint} → ${name}`).toBe(1);
        expect(heightReach.get(name)![district.nav.index(p.x, p.z)], `${checkpoint} → ${name}, including climb limits`).toBe(1);
      }
    }
    const nav = w.infected!.nav;
    expect(nav.visible({ x: -30, z: 60 }, { x: -30, z: 55.5 }, .4), 'Q-291 direct crossing onto the promenade').toBe(true);
    expect(w.districts!.districts[0].decay.colliders.some(c => c.id.includes('lake-wall'))).toBe(false);
    // Audit the entire walk graph. One inherited, fully fenced residential yard
    // is intentionally isolated (259 m²); it has no entrance, spawn or objective.
    const reached = nav.reachableFrom(nav.nearestCell(-30, 50));
    const isolated: { x: number; z: number; area: number }[] = [];
    for (let c = 0; c < nav.blocked.length; c++) if (!nav.blocked[c] && !reached[c]) {
      const component = nav.reachableFrom(c); let cells = 0;
      for (let k = 0; k < component.length; k++) if (component[k]) { reached[k] = 1; cells++; }
      if (cells * nav.cellSize ** 2 >= 10) isolated.push({ x: nav.x(c), z: nav.z(c), area: cells * nav.cellSize ** 2 });
    }
    expect(isolated).toEqual([{ x: 30.25, z: -33.75, area: 259 }]);
    // The same 0.5 m cells, independently checked with directed height edges:
    // a lower street cannot pass this audit merely because the planar graph is connected.
    for (const [goal, corridorHeight] of heightReach) {
    const inspected = new Uint8Array(corridorHeight.length), grid = district.nav;
    for (let c = 0; c < grid.cells.length; c++) if (grid.cells[c] && !corridorHeight[c] && !inspected[c]) {
      const pocket = [c]; inspected[c] = 1;
      for (let i = 0; i < pocket.length; i++) for (const next of [pocket[i] - 1, pocket[i] + 1, pocket[i] - grid.width, pocket[i] + grid.width]) {
        if (next < 0 || next >= grid.cells.length || Math.abs(next % grid.width - pocket[i] % grid.width) > 1 || !grid.cells[next] || corridorHeight[next] || inspected[next]) continue;
        inspected[next] = 1; pocket.push(next);
      }
      if (pocket.length * grid.cellSize ** 2 < 10) continue;
      for (const cell of pocket) {
        const x = grid.min[0] + (cell % grid.width + .5) * grid.cellSize;
        const z = grid.min[1] + (Math.floor(cell / grid.width) + .5) * grid.cellSize;
        expect(x >= 30.25 && x <= 33.25 && z >= -33.75 && z <= 39.75, `${goal}: unlisted unreachable area at ${x}, ${z}`).toBe(true);
      }
    }
    }
    // Q-289: neither shoulder is a tall impassable step. Sample the full rise
    // at 10 cm resolution, including the joins onto the elevated road.
    for (const x of [113, 173, 233, 273]) for (const [from, to] of [[-15, 15], [15, 45]]) {
      let previous = w.districts!.pavingHeight(x, from);
      for (let z = from + .1; z <= to; z += .1) {
        const next = w.districts!.pavingHeight(x, z);
        expect(Math.abs(next - previous), `Northgate ${x}, ${z}`).toBeLessThanOrEqual(.151);
        previous = next;
      }
    }
  } finally { w.dispose(); }
}

/** Opening a rocket gap must not fling the escorted humans into that gap. */
function checkFriendlyRocketReaction(w: SimWorld) {
  const follower = w.entities.get(w.l7Encounters!.state.roster[0].id)!, before = { ...follower.transform }, health = follower.health.current;
  const enemy = w.infected!.active.find(e => e.archetype === 'infected.runner')!;
  const point = w.solids.find({ x: before.x + 1.3, z: before.z, y: before.y }, .35, enemy.id, 2, true)!;
  expect(point).not.toBeNull();
  expect(w.solids.relocate(enemy, point, 'test.rocket-target', 0)).toBe(true);
  const enemyHealth = enemy.health.current;
  w.explosions!.blast('explosion.rocket', before, { sourceId: 1, actionId: 'weapon.rocket-launcher', fires: false });
  expect(follower.health.current).toBe(health);
  expect(follower.civilian!.knockedUntil, 'friendly rocket splash keeps living followers upright').toBeLessThanOrEqual(w.tick);
  expect(follower.transform).toEqual(before);
  expect(enemy.health.current, 'the same rocket still damages infected').toBeLessThan(enemyHealth);
}

/** A dense L7 column cannot hold the courier inside its own body ring. */
async function checkL7CourierYield() {
  const w = await loadLevel('L7', 1, undefined, 0, { quality: 'low' });
  try {
    const player = w.entities.get(1)!, roster = w.l7Encounters!.state.roster;
    for (const e of w.entities.iterate()) if (e.id !== 1 && !roster.some(r => r.id === e.id)) e.hidden = true;
    Object.assign(player.transform, { x: -30, z: 50, y: .7 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    w.solids.remember(player, 'test.l7-courier-yield'); w.spatial.set(1, -30, 50);
    Object.assign(player.survivor!.velocity, { x: 0, z: 0 });
    roster.forEach((row, slot) => {
      const e = w.entities.get(row.id)!, inner = slot < 8, count = inner ? 8 : 16, angle = (inner ? slot : slot - 8) * Math.PI * 2 / count, radius = inner ? .9 : 1.8;
      Object.assign(e.transform, { x: -30 + Math.cos(angle) * radius, z: 50 + Math.sin(angle) * radius, y: .7 });
      w.solids.remember(e, 'test.l7-courier-yield'); w.spatial.set(e.id, e.transform.x, e.transform.z);
      delete e.locomotion; e.civilian!.path.length = 0; e.civilian!.goal = -1; e.civilian!.l1!.target = null;
    });
    const start = { x: player.transform.x, z: player.transform.z };
    for (let tick = 0; tick < 60; tick++) { w.applyInput(emptyInput(), 'keyboard'); w.update(); }
    expect(Math.hypot(player.transform.x - start.x, player.transform.z - start.z), 'followers yield without moving a stationary courier').toBeLessThan(.01);
    for (let tick = 0; tick < 180; tick++) {
      const input = emptyInput(); input.move.x = 1;
      w.applyInput(input, 'keyboard'); w.update();
    }
    expect(Math.hypot(player.transform.x - start.x, player.transform.z - start.z), 'the courier walks through the follower column instead of remaining boxed in').toBeGreaterThan(9);
  } finally { w.dispose(); }
}

/** r5-l7 (vqa58 survivor losses): a completed bite costs an evacuee a third of its bar instead of killing it, the
 * biter reels while it tears free, and a loss inside the column never raises "Survivor lost behind you!". */
async function checkFollowerBites() {
  const w = await loadLevel('L7', 3, undefined, 0, { quality: 'low' });
  try {
    checkFriendlyRocketReaction(w);
    for (const e of [...w.infected!.active]) { w.solids.forget(e); w.infected!.release(e); }
    const roster = w.l7Encounters!.state.roster, follower = w.entities.get(roster[0].id)!;
    const runner = w.entities.get(w.infected!.spawn('infected.runner', { x: follower.transform.x + 1.2, z: follower.transform.z }, { state: 'chase' }))!;
    const wounds = new Map<number, number[]>(), alarms: string[] = [];
    w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.special === 'bite') wounds.set(e.targetId, [...wounds.get(e.targetId) ?? [], w.entities.get(e.targetId)!.health.current]); });
    w.events.on('l7.follower-alarm', e => { if (e.type === 'l7.follower-alarm') alarms.push(e.kind); });
    let staggered = false;
    for (let tick = 0; tick < 60 * 60 && roster.every(r => r.status === 'following'); tick++) {
      w.applyInput(emptyInput(), 'keyboard'); w.update();
      staggered ||= (runner.combat?.staggerUntil ?? 0) > w.tick;
    }
    const lost = roster.find(r => r.status !== 'following');
    expect(lost, 'one unopposed runner still kills an evacuee').toBeDefined();
    expect(wounds.get(lost!.id), 'the fatal bite is the third: 100 → 66 → 32 → dead').toEqual([66, 32]);
    expect(staggered, 'the biter reels after a survived bite').toBe(true);
    expect(alarms.filter(kind => kind !== 'wait'), 'a loss beside the courier is not "behind you"').toEqual([]);
  } finally { w.dispose(); }
}

/** A real corridor straggler must route around solid Alpha bodies before boarding owns it. */
async function checkCorpseCatchup() {
  const w = await loadLevel('L7', 1, undefined, 0, { quality: 'low' });
  try {
    const player = w.entities.get(1)!, follower = w.entities.get(w.l7Encounters!.state.roster[0].id)!;
    for (const other of w.entities.iterate()) if (other.id !== 1 && other.id !== follower.id) other.hidden = true;
    Object.assign(player.transform, { x: -30, z: 50, y: .7 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    w.solids.remember(player, 'test.corridor'); w.spatial.set(1, -30, 50);
    Object.assign(player.survivor!.velocity, { x: 0, z: 0 });
    Object.assign(follower.transform, { x: 44, z: 46, y: .7 });
    w.solids.remember(follower, 'test.straggler'); delete follower.locomotion;
    follower.civilian!.path.length = 0; follower.civilian!.goal = -1; follower.civilian!.pathIndex = 0; follower.civilian!.l1!.target = null;
    w.missions!.state.steps.rocket.status = 'completed'; w.missions!.state.steps.corridor.status = 'active';
    const bodies = [46.4, 44.4].map(z => {
      const body = w.entities.get(w.infected!.spawn('infected.alpha', { x: 35, z }, { state: 'idle' }))!;
      body.health.current = 0; Object.assign(body.infected!, { state: 'dead', deadAt: w.tick - 120, recoverAt: -1 });
      const id = body.id; w.infected!.settle(body);
      const settled = w.entities.get(id)!; expect(settled.corpse).toBe(true); return settled;
    });
    let arrived = false;
    for (let tick = 0; tick < 2400 && !arrived; tick++) {
      const before = { ...follower.transform };
      w.tick++; w.infected!.nav.flow(player.transform.x, player.transform.z, 1500);
      w.l7Encounters!.follower(follower); w.solids.commit();
      expect(Math.hypot(follower.transform.x - before.x, follower.transform.z - before.z), 'catch-up is continuous walking').toBeLessThan(.5);
      for (const body of bodies) expect(Math.hypot(follower.transform.x - body.transform.x, follower.transform.z - body.transform.z), 'solid corpses retain their full footprint').toBeGreaterThanOrEqual(1.35 - .021);
      arrived = Math.hypot(follower.transform.x - player.transform.x, follower.transform.z - player.transform.z) < 18;
    }
    expect(arrived, 'two dead Alphas must not keep a living follower 66 m away forever').toBe(true);
    expect(w.solids.offenders).toEqual([]);
  } finally { w.dispose(); }
}

/** Recorded pharmacy stragglers leave through real rounded capsule clearance. */
async function checkPharmacyCatchup() {
  for (const quality of ['low', 'high'] as const) {
    const w = await loadLevel('L7', 1, undefined, 0, { quality });
    try {
      const player = w.entities.get(1)!, follower = w.entities.get(w.l7Encounters!.state.roster[0].id)!;
      for (const other of w.entities.iterate()) if (other.id !== 1 && other.id !== follower.id) other.hidden = true;
      Object.assign(player.transform, { x: -30, z: 50, y: .7 });
      w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
      w.solids.remember(player, 'test.corridor'); w.spatial.set(1, -30, 50);
      Object.assign(player.survivor!.velocity, { x: 0, z: 0 });
      w.missions!.state.steps.rocket.status = 'completed'; w.missions!.state.steps.corridor.status = 'active';
      const health = follower.health.current, id = follower.id;
      // Physical ledger tick 9000: actors 54, 58 and 63, without coordinate rounding.
      for (const at of [{ x: 43.64834915492908, z: 37.470201226899704 }, { x: 42.03480701080949, z: 34.980446364774934 }, { x: 42.552465183028765, z: 35.5810746268351 }]) {
        const initial = w.solids.find({ ...at, y: .7 }, .35, id, 4, false)!;
        expect(initial).not.toBeNull(); Object.assign(follower.transform, initial);
        w.solids.remember(follower, 'test.pharmacy'); delete follower.locomotion;
        const c = follower.civilian!; c.path.length = 0; c.pathIndex = 0; c.goal = -1; c.l1!.target = null;
        let arrived = false;
        for (let tick = 0; tick < 2400 && !arrived; tick++) {
          const before = { ...follower.transform };
          w.tick++; w.infected!.nav.flow(player.transform.x, player.transform.z, 1500);
          w.l7Encounters!.follower(follower); w.solids.commit();
          expect(Math.hypot(follower.transform.x - before.x, follower.transform.z - before.z)).toBeLessThanOrEqual(5.2 / 60 + 1e-6);
          arrived = Math.hypot(follower.transform.x - player.transform.x, follower.transform.z - player.transform.z) < 18;
        }
        expect(arrived, `${quality} pharmacy ${at.x},${at.z}`).toBe(true);
        expect(follower.id).toBe(id); expect(follower.health.current).toBe(health);
        expect(w.solids.offenders).toEqual([]);
      }
      if (quality === 'high') checkNearRangeCatchup(w);
    } finally { w.dispose(); }
  }
}

/** A 19 m straggler needs a 60 m street detour. Other followers must not
 * continually replace its unfinished shared A* search. Recorded physical run. */
function checkNearRangeCatchup(w: SimWorld) {
  const p = w.entities.get(1)!;
  Object.assign(p.transform, { x: 61.269737243652344, z: 30.66730499267578, y: 1.0783395767211914, yaw: -24.347343065320896 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform);
  w.solids.remember(p, 'test.near-range-leader'); w.spatial.set(1, p.transform.x, p.transform.z);
  const positions = [
    [51, 58.78636838995762, 31.622484664300757],
    [52, 59.66041166295788, 32.262634633568425],
    [54, 57.743503326822115, 31.988364818021306],
    [55, 59.276612330176555, 33.27103613008447],
    [56, 74.68640614944597, 17.79644635219723],
    [57, 57.10050819508396, 33.5679037897464],
    [58, 57.61519747301161, 33.07296697791254],
    [59, 59.03115982185737, 32.6000588572461],
    [60, 55.76477914463052, 33.05690768545542],
    [61, 56.649254572914984, 32.995708767909086],
    [62, 56.24601358476257, 33.58496008942835],
    [63, 54.239179854640895, 34.70721465739254],
    [64, 55.198830336228355, 30.95871547701691],
    [65, 54.53497695356237, 35.35757026335401],
    [66, 54.370162933447375, 36.0527009646696],
    [67, 54.57997205158804, 37.542036650766306],
    [68, 53.38056226056749, 31.59263382444471],
    [69, 53.69396286647524, 36.59507090183298],
    [70, 54.4612841937558, 36.83760995103941],
    [71, 55.22384351456861, 38.763734002309455],
    [72, 52.86765581241363, 37.454799044588164],
    [73, 53.723382369178935, 38.30117024055273],
    [74, 54.58651425743357, 39.1448058624385],
  ];
  for (const [id, x, z] of positions) {
    const e = w.entities.get(id)!; e.hidden = false;
    Object.assign(e.transform, { x, z, y: w.districts!.groundHeight(x, z) + .7 }); delete e.locomotion;
    const c = e.civilian!; c.path.length = 0; c.pathIndex = 0; c.goal = -1; c.l1!.target = null;
    w.solids.remember(e, 'test.near-range-column'); w.spatial.set(id, x, z);
  }
  const follower = w.entities.get(56)!, health = follower.health.current;
  let arrived = false;
  for (let tick = 0; tick < 900 && !arrived; tick++) {
    w.tick++; w.infected!.nav.flow(p.transform.x, p.transform.z, 1500);
    for (const [id] of positions) w.l7Encounters!.follower(w.entities.get(id)!);
    w.solids.commit();
    arrived = Math.hypot(follower.transform.x - p.transform.x, follower.transform.z - p.transform.z) < 18;
  }
  expect(arrived, 'the recorded 19 m straggler rejoins without moving the waiting courier').toBe(true);
  expect(follower.health.current).toBe(health); expect(w.solids.offenders).toEqual([]);
}

async function rockets() {
  const w = new SimWorld(); await w.init(); w.loadScenario('combat-arena', 29);
  w.combat!.setLoadout(['weapon.rocket-launcher'], ['weapon.kick']);
  return w;
}

/** Ground targets (including beyond the legacy 35 m ray) and first-hit termination. */
export async function checkRocketEndpoints() {
  for (const distance of [4, 8, 15, 40]) {
  const w = await rockets();
  try {
    // The arena's boundary is 15 m away; the long-range case needs open sky.
    if (distance === 40) (w.combat!.query.walls as unknown[]).length = 0;
    const p = w.entities.get(1)!.transform, point = { x: p.x + distance, z: p.z };
    w.setInput({ aim: { x: 1, z: 0 }, aimPoint: point, left: { down: true, held: false, up: false } });
    w.update(); w.clearInput();
    let launchY: number | undefined, lastY = Infinity;
    for (let i = 0; i < 180; i++) {
      w.update(); const projectile = w.combat!.projectiles[0];
      if (projectile) { launchY ??= projectile.y; expect(projectile.y).toBeLessThanOrEqual(lastY); lastY = projectile.y; }
    }
    const exploded = w.events.events().filter(e => e.type === 'combat.exploded');
    expect(exploded).toHaveLength(1);
    const e = exploded[0]; if (e.type !== 'combat.exploded') throw new Error('missing impact');
    expect(Math.hypot(e.position.x - point.x, e.position.z - point.z, e.position.y)).toBeLessThan(.3);
    expect(launchY).toBeGreaterThan(.7);
  } finally { w.dispose(); }
  }
  for (const obstacle of ['wall', 'infected'] as const) await checkEarlierImpact(obstacle);
  for (const scheme of ['mouse-only', 'mouse-keyboard'] as const) {
    const w = await rockets();
    try {
      const p = w.entities.get(1)!.transform, id = w.spawnDummy('infected.dummy', { x: p.x + 8, z: p.z }, { hp: 100 });
      w.applyInput({ ...emptyInput(), mouseAttack: true, aimSource: 'pointer', aim: { x: 1, z: 0 }, aimPoint: { x: p.x + 15, z: p.z }, left: { down: true, held: false, up: false } }, scheme);
      w.update(); w.clearInput(); for (let i = 0; i < 120; i++) w.update();
      const e = w.events.events().find(e => e.type === 'combat.exploded');
      expect(e?.type, `${scheme} aimed infected`).toBe('combat.exploded');
      if (e?.type === 'combat.exploded') expect(e.position.x).toBeLessThan(p.x + 8.01);
      expect(w.entities.get(id)!.health.current).toBe(0);
    } finally { w.dispose(); }
  }
  // A ground click must keep its world point through either pointer control
  // scheme; this is the L7 behavior that the launch-direction fallback missed.
  for (const scheme of ['mouse-only', 'mouse-keyboard'] as const) {
    const w = await rockets();
    try {
      const p = w.entities.get(1)!.transform, point = { x: p.x + 6, z: p.z + 4 };
      const nearby = w.spawnDummy('infected.dummy', { x: point.x, z: point.z - 2 }, { hp: 1000 });
      const before = { ...w.entities.get(nearby)!.transform };
      w.applyInput({ ...emptyInput(), aim: { x: 1, z: 0 }, aimPoint: point, left: { down: true, held: false, up: false } }, scheme);
      w.update(); w.clearInput(); for (let i = 0; i < 120; i++) w.update();
      const e = w.events.events().find(e => e.type === 'combat.exploded');
      expect(e?.type, `${scheme} ground-click impact`).toBe('combat.exploded');
      if (e?.type === 'combat.exploded') expect(Math.hypot(e.position.x - point.x, e.position.z - point.z)).toBeLessThan(.3);
      expect(w.entities.get(nearby)!.health.current, `${scheme} click-point splash`).toBeLessThan(1000);
      expect(Math.hypot(w.entities.get(nearby)!.transform.x - before.x, w.entities.get(nearby)!.transform.z - before.z), `${scheme} click-point knockback`).toBeGreaterThan(0);
    } finally { w.dispose(); }
  }
  // A direction-only shot ends at catalog range and still creates the blast.
  const maxRange = await rockets();
  try {
    (maxRange.combat!.query.walls as unknown[]).length = 0;
    const p = maxRange.entities.get(1)!.transform;
    maxRange.setInput({ aim: { x: 1, z: 0 }, left: { down: true, held: false, up: false } });
    maxRange.update(); maxRange.clearInput(); for (let i = 0; i < 85; i++) maxRange.update();
    const nearby = maxRange.spawnDummy('infected.dummy', { x: p.x + 34, z: p.z + 4.5 }, { hp: 1000 });
    for (let i = 0; i < 95; i++) maxRange.update();
    const e = maxRange.events.events().find(e => e.type === 'combat.exploded');
    expect(e?.type, 'direction-only max-range impact').toBe('combat.exploded');
    if (e?.type === 'combat.exploded') expect(e.position.x).toBeCloseTo(p.x + action('weapon.rocket-launcher').range, 1);
    expect(maxRange.entities.get(nearby)!.health.current, 'max-range splash').toBeLessThan(1000);
    expect(Math.hypot(maxRange.entities.get(nearby)!.transform.x - (p.x + 34), maxRange.entities.get(nearby)!.transform.z - (p.z + 4.5)), 'max-range knockback').toBeGreaterThan(0);
  } finally { maxRange.dispose(); }
}

/** Five overlapping rockets at 25-tick cadence, with unchanged payload and derived TTK bands. */
export async function checkRocketCadence() {
  const w = await rockets();
  try {
    const p = w.entities.get(1)!.transform;
    w.setInput({ aim: { x: 1, z: 0 }, aimPoint: { x: p.x + 30, z: p.z }, left: { down: true, held: true, up: false } });
    let peak = 0;
    for (let i = 0; i < 110; i++) { w.update(); peak = Math.max(peak, w.combat!.projectiles.length); }
    const shots = w.events.events().filter(e => e.type === 'combat.attack');
    expect(shots).toHaveLength(5);
    for (let i = 1; i < shots.length; i++) expect(shots[i].tick - shots[i - 1].tick).toBe(25);
    expect(peak).toBeGreaterThanOrEqual(3);
    const def = action('weapon.rocket-launcher');
    expect([def.damage, def.splash!.radius, def.splash!.falloff]).toEqual([180, 6, .6]);
    expect(def.fireRate).toBeLessThan(action('weapon.handgun').fireRate);
    for (const [kind, profile] of Object.entries(combatArchetypes)) {
      const n = Math.ceil(profile.hp / (180 * (1 - profile.armor))), t = 1 / 6 + (n - 1) / 2.4;
      const band = ttkBands[def.id][kind as keyof typeof combatArchetypes];
      expect(band[0]).toBeCloseTo(Math.max(.01, Math.floor((.8 * t - .25 + 1e-8) * 100) / 100), 2);
      expect(band[1]).toBeCloseTo(Math.ceil((1.2 * t + .25 - 1e-8) * 100) / 100, 2);
    }
  } finally { w.dispose(); }
}

async function checkEarlierImpact(obstacle: 'wall' | 'infected') {
  const w = await rockets();
  try {
    const p = w.entities.get(1)!.transform;
    if (obstacle === 'wall') (w.combat!.query.walls as { x: number; y: number; z: number; halfX: number; halfY: number; halfZ: number }[]).push({ x: p.x + 3, y: 1, z: p.z, halfX: .1, halfY: 1, halfZ: 1 });
    const direct = obstacle === 'infected' ? w.spawnDummy('infected.dummy', { x: p.x + 3, z: p.z }, { hp: 100 }) : undefined;
    const splash = obstacle === 'infected' ? w.spawnDummy('infected.dummy', { x: p.x + 4, z: p.z + 2.5 }, { hp: 1000 }) : undefined;
    w.setInput({ aim: { x: 1, z: 0 }, aimPoint: { x: p.x + 8, z: p.z }, left: { down: true, held: false, up: false } });
    w.update(); w.clearInput(); for (let i = 0; i < 120; i++) w.update();
    const e = w.events.events().find(e => e.type === 'combat.exploded');
    expect(e?.type).toBe('combat.exploded');
    if (e?.type === 'combat.exploded') expect(e.position.x).toBeLessThanOrEqual(p.x + 3);
    if (direct) expect(w.entities.get(direct)!.health.current).toBeLessThan(100);
    if (splash) expect(w.entities.get(splash)!.health.current, `${obstacle} first-contact splash`).toBeLessThan(1000);
  } finally { w.dispose(); }
}
