// Physics/collision core: the solid registry admits, commits and repairs every body against walls, vehicle hulls and
// other bodies; corpse footprints and blast flights use the same solids. Mission checkpoints snapshot all of it.
import { afterEach, expect, test } from 'vitest';
import { spawnSetPiece } from '../../src/sim/missions/L4Spectacle';
import type { MissionDef } from '../../src/sim/missions/types';
import { SimWorld } from '../../src/sim/world/SimWorld';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function arena(seed = 1) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena', seed); return w; }
const tick = (w: SimWorld, n = 1) => { for (let i = 0; i < n; i++) w.update(); expect(w.solids.offenders).toEqual([]); };
function corpse(w: SimWorld, x: number, z = 0) {
  const id = w.infected!.spawn('infected.runner', { x, z }, { state: 'idle' }), e = w.entities.get(id)!;
  e.health.current = 0; Object.assign(e.infected!, { state: 'dead', deadAt: w.tick - 120, recoverAt: -1 });
  w.infected!.settle(e); expect(w.entities.get(id)!.corpse).toBe(true); return id;
}

test('admission: parked vehicle hulls exclude bodies, coincident spawns separate, a thin wall never admits a body through it', async () => {
  for (const vehicle of ['vehicle.sedan', 'vehicle.school-bus']) {
    const w = await arena();
    const car = w.vehicles!.cars.get(w.vehicles!.spawn(vehicle, { x: 10, z: 0 }))!;
    const e = w.entities.get(w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' }))!;
    tick(w, 60);
    expect(car.physics.hullDistance(e.transform.x, e.transform.z), vehicle).toBeGreaterThanOrEqual(e.combat!.radius - .02);
  }
  const w = await arena();
  const ids = Array.from({ length: 8 }, () => w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' }));
  w.update(); expect(w.infected!.active).toHaveLength(8);
  for (const a of ids) for (const b of ids) if (a < b) {
    const ea = w.entities.get(a)!, eb = w.entities.get(b)!;
    expect(ea.combat!.radius + eb.combat!.radius - Math.hypot(ea.transform.x - eb.transform.x, ea.transform.z - eb.transform.z)).toBeLessThanOrEqual(.02);
  }
  const t = await arena();
  expect(t.solids.relocate(t.entities.get(1)!, { x: 12, z: 12, y: .7 }, 'test.clear-door')).toBe(true);
  t.infected!.nav.setBlocker(987654, { x: 0, z: 0, y: .7, halfX: .05, halfZ: 10, halfY: 2 }, true);
  const big = t.entities.get(t.infected!.spawn('infected.elephant', { x: -1.3, z: 0 }))!; big.combat!.staggerUntil = 600;
  const e = t.entities.get(t.infected!.spawn('infected.runner', { x: -.41, z: 0 }))!; e.combat!.staggerUntil = 600;
  expect(e.transform.x + e.combat!.radius).toBeLessThanOrEqual(-.049);
  tick(t);
});

test('an unsafe spawn keeps its identity and director slot, then admits once the hulls leave', async () => {
  const w = await arena();
  const tank = spawnSetPiece(w, 'veh.tank', { x: 12, z: 0 });
  for (let i = 0; i < 12; i++) spawnSetPiece(w, 'veh.tank', { x: 12 + Math.cos(i * Math.PI / 6) * 4, z: Math.sin(i * Math.PI / 6) * 4 });
  const id = w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' }), e = w.entities.get(id)!;
  expect(e.pendingAdmission).toBeDefined(); expect(w.infected!.director.count).toBe(1);
  tick(w, 3); expect(w.entities.get(id)).toBe(e);
  for (const s of w.entities.iterate()) if (s.kind === 'setpiece') s.hidden = true;
  tank.hidden = true; tick(w, 30);
  expect(e.pendingAdmission).toBeUndefined(); expect(e.hidden).not.toBe(true); expect(w.infected!.director.count).toBe(1);
});

test('the courier: knockback and post-physics writes never cross a thin solid; she can push out of eight bodies', async () => {
  const w = await arena(), player = w.entities.get(1)!;
  expect(w.solids.relocate(player, { x: 10.8, z: 0, y: .705 }, 'test.before-wall', 0, false)).toBe(true);
  const wall = { x: 12, z: 0, y: .7, halfX: .1, halfZ: 3, halfY: .7 };
  w.physics.addBlocker(wall); w.infected!.nav.setBlocker(987653, wall, true); w.physics.update();
  w.tick++; w.solids.commit();
  player.transform.x = 12; // a writer requests a pose inside the wall
  w.tick++; w.solids.commit();
  expect(player.transform.x).toBeLessThanOrEqual(11.57);
  expect(w.physics.playerCollider!.translation().x).toBeCloseTo(player.transform.x, 6);
  expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });

  const k = await arena();
  k.infected!.nav.setBlocker(987654, { x: 10, z: 0, y: .7, halfX: .1, halfZ: 3, halfY: .7 }, true);
  const alpha = k.entities.get(k.infected!.spawn('infected.alpha', { x: 9, z: 0 }, { state: 'idle' }))!;
  k.knockback(alpha, { x: 1, z: 0 }, .6);
  expect(alpha.transform.x + alpha.combat!.radius).toBeLessThanOrEqual(9.9 + .02);

  const p = await arena(), courier = p.entities.get(1)!, start = { ...courier.transform };
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    p.entities.get(p.infected!.spawn('infected.runner', { x: start.x + Math.cos(angle) * 1.1, z: start.z + Math.sin(angle) * 1.1 }, { state: 'idle' }))!.combat!.staggerUntil = 600;
  }
  p.setInput({ move: { x: 1, z: 0 } }); tick(p, 120);
  expect(courier.transform.x - start.x).toBeGreaterThan(1.5);
});

test('corpses: a blast flight stops before a thin wall and lands with its identity; cover protects bodies; checkpoints restore mid-flight exactly', async () => {
  const w = await arena(27); w.combat!.damage.god = true;
  const id = corpse(w, 2);
  w.barricades!.spawn({ id: 'landing-wall', groupId: 'g', a: { x: 3, z: -2 }, b: { x: 3, z: 2 }, height: 2, initialHp: 1e6 });
  w.explosions!.blast('explosion.propane', { x: 0, z: 0 }, { fires: false, damage: false });
  const e = w.entities.get(id)!; expect(e.corpseBlast).toBeDefined();
  for (let i = 0; i < 300; i++) w.update();
  expect(e.transform.x).toBeGreaterThan(2); expect(e.transform.x).toBeLessThanOrEqual(3 - .38);
  expect(e.transform.y).toBeCloseTo(.7, 9); expect(w.entities.get(id)).toBe(e);

  const c = await arena(27); c.combat!.damage.god = true;
  const covered = corpse(c, 4), edge = corpse(c, 5);
  c.barricades!.spawn({ id: 'body-cover', groupId: 'g', a: { x: 3, z: -2 }, b: { x: 3, z: 2 }, height: 2, initialHp: 1e6 });
  c.explosions!.blast('explosion.propane', { x: 0, z: 0 }, { fires: false, damage: false });
  expect(c.entities.get(covered)!.corpseBlast).toBeUndefined(); expect(c.entities.get(edge)!.corpseBlast).toBeUndefined();

  const mission: MissionDef = {
    id: 'corpse-flight', briefing: 'Corpse flight', anchors: { spawn: { x: 0, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['C'], cinematics: {},
    steps: [{ id: 'wait', type: 'custom', text: 'Wait', anchor: 'spawn', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 1000 }, fail: [] }], finish: ['wait'], onStart: [], onComplete: [],
  };
  const r = await arena(27); r.combat!.damage.god = true;
  const m = r.loadMission(mission); m.begin();
  const body = corpse(r, 2);
  r.explosions!.blast('explosion.propane', { x: 0, z: 0 }, { fires: false, damage: false });
  for (let i = 0; i < 12; i++) r.update();
  m.checkpoint('C'); const airborne = { ...r.entities.get(body)!.transform };
  expect(airborne.y).toBeGreaterThan(.7);
  for (let i = 0; i < 300; i++) r.update();
  const landed = { ...r.entities.get(body)!.transform };
  m.restore('C'); expect(r.entities.get(body)!.transform).toEqual(airborne);
  for (let i = 0; i < 300; i++) r.update();
  expect(r.entities.get(body)!.transform).toEqual(landed); expect(r.entities.get(body)!.corpse).toBe(true);
});
