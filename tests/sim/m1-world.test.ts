import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { compositions } from '../../src/levels/compositions';
import { levelOneSlice } from '../../src/levels/levelOneSlice';
import { resolveCampaignMission } from '../../src/levels/missions';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import { NavGrid } from '../../src/sim/ai/NavGrid';
import { staticCollision as baked } from '../../src/assets/staticCollision';
import type { Placement } from '../../src/levels/districts/types';

let world: SimWorld;
afterEach(() => world?.dispose());
const step = (ticks: number) => { for (let i = 0; i < ticks; i++) world.update(); };
function teleport(x: number, z: number) {
  const e = world.entities.get(1)!; Object.assign(e.transform, { x, y: .705, z });
  world.physics.playerBody!.setTranslation(e.transform, true); world.player!.locomotion.reset(); world.spatial.set(1, x, z); world.physics.update();
}
async function slice() {
  world = new SimWorld(); await world.init();
  const c = compositions.L1;
  world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
  const def = levelOneSlice(resolveCampaignMission('L1', world.districts!)); world.npcs!.configureSlice(def.anchors['incident-0']);
  world.combat!.damage.god = true; return world;
}

test('@E19 M1-07 every solid L1 prop family stops a real survivor capsule outside its GLB compound', async () => {
  world = new SimWorld(); await world.init();
  const c = compositions.L1, ids = new Set<string>();
  for (const d of c.districts) {
    const layout = JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'));
    for (const p of layout.placements as Placement[]) if (p.minTier === 0 && p.assetId in baked) ids.add(p.assetId);
  }
  expect([...ids]).toEqual(expect.arrayContaining(['prop.hedge', 'prop.picket-fence', 'prop.mailbox-blue', 'prop.street-lamp', 'prop.gas-pump', 'veh.sedan-red', 'bld.gas-station']));
  // Solid street dressing remains covered when the look lane adds it to L1.
  ids.add('prop.fire-hydrant'); ids.add('veh.school-bus');
  for (const assetId of ids) {
    world.loadScenario('survivor');
    const placement: Placement = { id: 'probe', assetId, position: [0, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: false, lightGroup: '', visualAabb: { min: [0, 0, 0], max: [0, 0, 0] } };
    const boxes = placementColliders([placement], []).filter(c => !c.walkable).map(c => c.aabb);
    expect(boxes.length, assetId).toBeGreaterThan(0);
    for (const box of boxes) world.physics.addStatic(box, [0, 0]);
    // Approach the widest body-height component along its outside normal.
    const box = boxes.filter(b => b.max[1] > .5).sort((a, b) => (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) - (a.max[0] - a.min[0]) * (a.max[2] - a.min[2]))[0] ?? boxes[0];
    const minX = Math.min(...boxes.map(b => b.min[0])), z = (box.min[2] + box.max[2]) / 2;
    teleport(minX - 1, z); world.setInput({ move: { x: 1, z: 0 } }); step(240);
    const p = world.entities.get(1)!.transform;
    expect(p.x, assetId).toBeLessThanOrEqual(box.min[0] - .25);
    expect(p.y, assetId).toBeGreaterThan(.65);
  }
});

test('@E19 M1-08 gas forecourt is reachable from the road and canopy legs/pumps still block', async () => {
  await slice();
  const nav = world.infected!.nav;
  const district = world.districts!.districts.find(d => d.id === 'D-MAIN')!, gas = district.decay.placements.find(p => p.assetId === 'bld.gas-station')!;
  const shapes = placementColliders([gas], []);
  expect(shapes.length).toBeGreaterThan(1);
  // Open space on the front/right of the gas station, under its canopy.
  const destination = { x: gas.position[0] + district.origin[0] + 3, z: gas.position[2] + district.origin[1] + .3 };
  expect(nav.clear(destination.x, destination.z, .35)).toBe(true);
  teleport(42, 0); world.setInput({ moveTarget: destination }); step(720);
  const p = world.entities.get(1)!.transform;
  expect(Math.hypot(p.x - destination.x, p.z - destination.z)).toBeLessThan(.15);
  const infected = world.entities.get(world.infected!.spawn('infected.runner', destination))!;
  step(1); expect(infected.transform.y).toBeCloseTo(.7 + world.districts!.groundHeight(infected.transform.x, infected.transform.z));
  for (const type of ['prop.gas-pump', 'prop.street-lamp', 'prop.picket-fence']) {
    const placement = district.decay.placements.find(p => p.assetId === type)!;
    const body = placementColliders([placement], []).find(c => !c.walkable)!.aabb;
    expect(nav.clear((body.min[0] + body.max[0]) / 2 + district.origin[0], (body.min[2] + body.max[2]) / 2 + district.origin[1], .35)).toBe(false);
  }
});

test('@E19 M1-08 gentle joystick pulses step onto raised forecourt paving instead of snagging at its edge', async () => {
  await slice(); teleport(48.5, 18);
  for (let i = 0; i < 24; i++) {
    world.setInput({ move: { x: -.78, z: 0 } }); step(9); world.clearInput(); step(6);
  }
  const p = world.entities.get(1)!.transform;
  expect(p.x).toBeLessThan(47); expect(p.y).toBeGreaterThan(.95);
});

test('@E19 M1-07 click navigation string-pulls a path around a hedge, arriving without oscillation', async () => {
  await slice(); teleport(-19, -6.3);
  world.setInput({ moveTarget: { x: -15, z: -6.3 } });
  let routed = false;
  for (let i = 0; i < 480; i++) {
    world.update(); const p = world.entities.get(1)!.transform;
    if (Math.abs(p.z + 6.3) > .7) routed = true;
    expect(world.infected!.nav.clear(p.x, p.z, .32), `tick ${i}`).toBe(true);
  }
  const p = world.entities.get(1)!.transform; expect(routed, JSON.stringify({p, destination:world.controls.moveTarget})).toBe(true); expect(Math.hypot(p.x + 15, p.z + 6.3)).toBeLessThan(.15);
});

test('@E19 M1-04 corgi settles after turns/stops with stable yaw, zero idle speed and no follow-state chatter', async () => {
  await slice(); teleport(-14, -4.25);
  const corgi = [...world.entities.iterate()].find(e => e.companion)!;
  Object.assign(corgi.transform, { x: -16, z: -4.25 }); world.spatial.set(corgi.id, -16, -4.25);
  for (const direction of [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }]) {
    world.setInput({ move: direction }); step(90); world.clearInput(); step(240);
    const rest = { ...corgi.transform }, toggles: boolean[] = [];
    for (let i = 0; i < 240; i++) { world.update(); toggles.push(corgi.motion!.moving); expect(world.infected!.nav.clear(corgi.transform.x, corgi.transform.z, .35)).toBe(true); }
    expect(Math.hypot(corgi.transform.x - rest.x, corgi.transform.z - rest.z)).toBeLessThan(.001); expect(corgi.transform.yaw).toBe(rest.yaw); expect(corgi.motion!.speed).toBeLessThan(.001); expect(toggles.every(v => !v)).toBe(true);
    const p = world.entities.get(1)!.transform; expect(Math.hypot(p.x - corgi.transform.x, p.z - corgi.transform.z)).toBeLessThan(4);
  }
});

test('@E19 M1-06 neighbors use five models, safe sidewalk routines and actual movement/idle states', async () => {
  await slice();
  const neighbors = [...world.entities.iterate()].filter(e => e.civilian?.schedule && !e.civilian.pet);
  expect(neighbors).toHaveLength(10); expect(new Set(neighbors.map(e => e.civilian!.model)).size).toBe(5);
  const moving = new Set<number>(), idle = new Set<number>();
  for (let i = 0; i < 1200; i++) {
    world.update();
    for (const e of neighbors) {
      expect(world.infected!.nav.clear(e.transform.x, e.transform.z, .35)).toBe(true); expect(e.transform.y).toBe(.7);
      (e.motion!.moving ? moving : idle).add(e.id);
      if (!e.motion!.moving) expect(e.motion!.speed).toBeLessThan(.13);
    }
  }
  expect(moving.size).toBe(neighbors.length); expect(idle.size).toBe(neighbors.length);
});

test('@E19 M1-10 all character bodies separate, even in stationary infected attack states', async () => {
  await slice(); teleport(0, 0);
  const corgi = [...world.entities.iterate()].find(e => e.companion)!;
  Object.assign(corgi.transform, { x: 0, z: 0 }); world.spatial.set(corgi.id, 0, 0);
  const npc = world.npcs!.civilians.spawn('cashier', { x: .1, z: 0 }, { waypoints: [{ x: .1, z: 0 }] });
  const infected = world.infected!.spawn('infected.runner', { x: 0, z: .1 }, { state: 'chase' });
  step(120);
  const bodies = [world.entities.get(1)!, corgi, world.entities.get(npc)!, world.entities.get(infected)!];
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) expect(Math.hypot(bodies[i].transform.x - bodies[j].transform.x, bodies[i].transform.z - bodies[j].transform.z)).toBeGreaterThanOrEqual((bodies[i].combat?.radius ?? .35) + (bodies[j].combat?.radius ?? .35) - .025);
});

test('@E19 grid route budgets resume and straight visible sections have no zig-zag waypoints', () => {
  const wall = { x: 0, y: 1, z: 0, halfX: .5, halfY: 1, halfZ: 3 }, nav = new NavGrid({ width: 20, depth: 20 }, [wall]);
  const route = { path: [] as number[], goal: -1, pathIndex: 0 }, waypoint = { x: 0, z: 0 };
  expect(nav.steer({ x: -4, z: 0 }, { x: 4, z: 0 }, route, .35, waypoint)).toBe(true);
  expect(Math.abs(waypoint.z)).toBeGreaterThan(3); expect(route.pathIndex).toBeGreaterThan(2);
  expect(nav.visible({ x: -4, z: 0 }, waypoint, .35)).toBe(true);
});

test('@E19 M1-07 visibility sweeps thin corners between samples and allows only outward escapes', () => {
  const nav = new NavGrid({ width: 20, depth: 20 }, [{ x: .1, y: 1, z: 0, halfX: .03, halfY: 1, halfZ: .03 }], 0);
  expect(nav.visible({ x: 0, z: 0 }, { x: .2, z: 0 }, 0)).toBe(false);
  nav.setBlocker(1, { x: 2, y: 1, z: 0, halfX: .5, halfY: 1, halfZ: .5 }, true);
  const corner = { x: 1.2, z: -.8 };
  expect(nav.clear(corner.x, corner.z, .35)).toBe(false);
  expect(nav.visible(corner, { x: 1, z: -1 }, .35)).toBe(true);
  expect(nav.visible(corner, { x: 3, z: 0 }, .35)).toBe(false);
});

test('@E19 VQA-08 combat spacing still lets broad armored fighters enter melee range', async () => {
  await slice(); teleport(0, 0);
  const id = world.infected!.spawn('infected.armored', { x: 2, z: 0 }, { state: 'chase' });
  step(240);
  expect(world.events.events().some(e => e.type === 'infected.attack' && e.sourceId === id)).toBe(true);
  const p = world.entities.get(1)!.transform, enemy = world.entities.get(id)!;
  expect(Math.hypot(p.x - enemy.transform.x, p.z - enemy.transform.z)).toBeGreaterThanOrEqual(.85);
});
