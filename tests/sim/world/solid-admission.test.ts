import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { spawnSetPiece } from '../../../src/sim/missions/L4Spectacle';
import { missionControls } from '../../../src/sim/missions/controls';
import { respawnAtCheckpoint } from '../../../src/sim/missions/Respawn';
import { vehicles, vehicleDef } from '../../../src/data/vehicles';
import { emergeResident, walkResidents, type HouseEmergence } from '../../../src/sim/outbreak/HouseEmergence';
import { Outbreak } from '../../../src/sim/outbreak/Outbreak';
import { loadLevel } from '../../../tools/sim-runner/levels';
import { SimPhase } from '../../../src/core/EventBus';

async function arena() { const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1); return w; }
const tick = (w: SimWorld, n = 1) => { for (let i = 0; i < n; i++) w.update(); expect(w.solids.offenders).toEqual([]); };

test('contact repair respects infected-only exclusions while humans retain admission', async () => {
  const w = await arena();
  try {
    w.infected!.excludeInfected([{ x: 12, z: 12, y: .7, halfX: 1, halfZ: 2, halfY: 2, navBlocker: true }]);
    const player = w.entities.get(1)!;
    expect(w.solids.relocate(player, { x: 12, z: 12, y: .7 }, 'test.human-exclusion', 0)).toBe(true);
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: 10.5, z: 12 }))!;
    e.combat!.staggerUntil = 600; tick(w);
    e.transform.x = 12; // A scripted or contact correction must not bypass the infected mask.
    tick(w);
    // The contact contract permits 2 cm penetration; navigation's zero-depth
    // query must use that same margin (plus the audit's floating-point epsilon).
    expect(w.infected!.infectedNav.clear(e.transform.x, e.transform.z, .33 - 1e-6, true)).toBe(true);
    expect(Math.abs(e.transform.x - 12)).toBeGreaterThanOrEqual(1.33);
    expect(player.transform.x).toBe(12);
    expect(w.solids.snapshot().failures).toBe(0);
  } finally { w.dispose(); }
});

test('body congestion cannot admit an actor through a thin wall', async () => {
  const w = await arena();
  try {
    expect(w.solids.relocate(w.entities.get(1)!, { x: 12, z: 12, y: .7 }, 'test.clear-door')).toBe(true);
    w.infected!.nav.setBlocker(987654, { x: 0, z: 0, y: .7, halfX: .05, halfZ: 10, halfY: 2 }, true);
    const big = w.entities.get(w.infected!.spawn('infected.elephant', { x: -1.3, z: 0 }))!;
    big.combat!.staggerUntil = 600;
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: -.41, z: 0 }))!;
    e.combat!.staggerUntil = 600;
    expect(e.pendingAdmission).toBeUndefined();
    expect(e.transform.x + e.combat!.radius).toBeLessThanOrEqual(-.049);
    tick(w);
  } finally { w.dispose(); }
});

test.each(vehicles.map(v => v.id))('all moving and parked vehicle hulls use the contact commit: %s', async def => {
  const w = await arena();
  try {
    const id = w.vehicles!.spawn(def, { x: 12, z: 0 }, .63), car = w.vehicles!.cars.get(id)!;
    const e = w.entities.get(w.infected!.spawn('infected.alpha', { x: 12, z: 4 }, { state: 'idle' }))!;
    tick(w);
    const p = car.entity.transform, along = car.physics.def.length / 2 - .1;
    Object.assign(e.transform, { x: p.x + Math.cos(p.yaw) * along, z: p.z - Math.sin(p.yaw) * along }); tick(w);
    expect(car.physics.hullDistance(e.transform.x, e.transform.z)).toBeGreaterThanOrEqual(e.combat!.radius - .02);
    expect(e.health.current).toBe(300); expect(w.solids.snapshot().pending).toBe(0);
  } finally { w.dispose(); }
});
test('unsafe spawn retains identity and concurrency slot, then admits when the hull leaves', async () => {
  const w = await arena();
  try {
    const tank = spawnSetPiece(w, 'veh.tank', { x: 12, z: 0 });
    // A bounded request surrounded by solids must remain queued rather than vanish.
    for (let i = 0; i < 12; i++) spawnSetPiece(w, 'veh.tank', { x: 12 + Math.cos(i * Math.PI / 6) * 4, z: Math.sin(i * Math.PI / 6) * 4 });
    const id = w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' }), e = w.entities.get(id)!;
    expect(e.pendingAdmission).toBeDefined(); expect(w.infected!.director.count).toBe(1);
    tick(w, 3); expect(w.entities.get(id)).toBe(e);
    for (const s of w.entities.iterate()) if (s.kind === 'setpiece') s.hidden = true;
    tank.hidden = true; tick(w, 30);
    expect(e.pendingAdmission).toBeUndefined(); expect(e.hidden).not.toBe(true); expect(w.infected!.director.count).toBe(1);
  } finally { w.dispose(); }
});
test('teleport and checkpoint allies reserve distinct radius-aware slots', async () => {
  const w = await arena();
  try {
    w.vehicles!.spawn('vehicle.school-bus', { x: 12, z: 0 });
    const ids = Array.from({ length: 8 }, () => w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' }));
    const player = w.entities.get(1)!;
    missionControls(w).teleport('player', { x: 12, z: 0 });
    expect(w.solids.clear(player.transform, .35, 1)).toBe(true);
    respawnAtCheckpoint(w, { x: 12, z: 6 }); tick(w);
    expect(ids.every(id => w.entities.get(id)!.health.current > 0)).toBe(true);
    expect(w.solids.clear(player.transform, .35, 1)).toBe(true);
    missionControls(w).teleport(ids[0], { x: -400, z: -400 });
    expect(w.entities.get(ids[0])!.transform).toMatchObject({ x: -400, z: -400 });
  } finally { w.dispose(); }
});

test('a deferred checkpoint keeps its requested pose and restores collider and grace on admission', async () => {
  const w = await arena();
  try {
    const tank = spawnSetPiece(w, 'veh.tank', { x: 12, z: 0 }), player = w.entities.get(1)!;
    respawnAtCheckpoint(w, { x: 12, z: 0 });
    expect(player.pendingAdmission).toBeDefined(); expect(w.physics.playerCollider!.isEnabled()).toBe(false);
    tick(w, 35);
    expect(player.pendingAdmission).toMatchObject({ x: 12, z: 0, writer: 'checkpoint.respawn' });
    expect(player.transform).toMatchObject({ x: 12, z: 0 });
    tank.hidden = true; tick(w, 30);
    expect(player.pendingAdmission).toBeUndefined(); expect(player.hidden).not.toBe(true);
    expect(w.physics.playerCollider!.isEnabled()).toBe(true);
    expect(player.survivor!.invulnerableUntil - w.tick).toBeGreaterThan(90);
    expect(w.solids.clear(player.transform, .35, 1)).toBe(true);
  } finally { w.dispose(); }
});
test('repeating a blocked checkpoint request does not turn its hidden courier into a passenger', async () => {
  const w = await arena();
  try {
    spawnSetPiece(w, 'veh.tank', { x: 12, z: 0 });
    const player = w.entities.get(1)!;
    respawnAtCheckpoint(w, { x: 12, z: 0 });
    expect(player.pendingAdmission).toBeDefined();
    respawnAtCheckpoint(w, { x: 12, z: 0 });
    expect(player.pendingAdmission).toBeDefined();
    expect(w.physics.playerCollider!.isEnabled()).toBe(false);
    tick(w, 35);
    expect(player.pendingAdmission).toBeDefined(); expect(w.solids.snapshot().failures).toBe(0);
  } finally { w.dispose(); }
});
test('a pooled body can return to its former position under its new identity', async () => {
  const w = await arena();
  try {
    const ai = w.infected!, first = w.entities.get(ai.spawn('infected.runner', { x: 12, z: 0 }, { state: 'idle' }))!;
    first.combat!.staggerUntil = 600; tick(w);
    const oldId = first.id; ai.release(first);
    const reused = w.entities.get(ai.spawn('infected.runner', { x: 16, z: 0 }, { state: 'idle' }))!;
    expect(reused).toBe(first); expect(reused.id).not.toBe(oldId);
    reused.combat!.staggerUntil = 600;
    expect(w.solids.relocate(reused, { x: 12, y: .7, z: 0 }, 'test.reused-body', 0, false)).toBe(true);
    tick(w);
    expect(reused.transform.x).toBe(12); expect(reused.hidden).not.toBe(true);
    expect(ai.active).toHaveLength(1); expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  } finally { w.dispose(); }
});

test('a safe explicit relocation releases an earlier deferred checkpoint request', async () => {
  const w = await arena();
  try {
    spawnSetPiece(w, 'veh.tank', { x: 12, z: 0 });
    const player = w.entities.get(1)!;
    respawnAtCheckpoint(w, { x: 12, z: 0 });
    expect(player.pendingAdmission).toBeDefined();
    expect(w.solids.relocate(player, { x: 20, z: 6, y: player.transform.y }, 'test.safe-relocation')).toBe(true);
    expect(player.pendingAdmission).toBeUndefined(); expect(player.hidden).not.toBe(true);
    expect(w.physics.playerCollider!.isEnabled()).toBe(true);
    tick(w, 35); expect(player.transform.x).toBeCloseTo(20);
    expect(w.solids.snapshot().pending).toBe(0);
  } finally { w.dispose(); }
});
test('a circular admission beside a box corner can walk away at its full radius', async () => {
  const w = await arena();
  try {
    w.infected!.nav.setBlocker(987650, { x: 12, z: 0, y: .7, halfX: 1, halfZ: 1, halfY: .7 }, true);
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: 8, z: 0 }, { state: 'idle' }))!;
    expect(w.solids.relocate(e, { x: 10.7518, z: 1.2482, y: .7 }, 'test.corner', 0, false)).toBe(true);
    expect(w.infected!.nav.clear(e.transform.x, e.transform.z, .35)).toBe(false);
    expect(w.solids.clear(e.transform, .35, e.id)).toBe(true);
    w.events.on('sim.tick', () => { w.npcs!.move(e, { x: 9, z: 1.2482 }, 2, e.infected!); }, SimPhase.ai + .25);
    tick(w, 60);
    expect(e.transform.x).toBeLessThan(10.2);
    expect(e.combat!.radius).toBe(.35); expect(w.solids.clear(e.transform, .35, e.id)).toBe(true);
  } finally { w.dispose(); }
});
test('checkpoint restore discards a deferred player mask from the discarded timeline', async () => {
  const w = await loadLevel('L2', 1);
  try {
    const player = w.entities.get(1)!, at = { ...player.transform };
    const tank = spawnSetPiece(w, 'veh.tank', { x: at.x + 30, z: at.z });
    Object.assign(player.transform, tank.transform);
    expect(w.solids.admit(player, 'test.blocked-restore', 0, false)).toBe(false);
    expect(w.physics.playerCollider!.isEnabled()).toBe(false);
    w.missions!.state.runOutUntil = w.tick + 300;
    w.missions!.restore('start', true);
    expect(w.missions!.state.runOutUntil).toBeUndefined();
    expect(player.pendingAdmission).toBeUndefined(); expect(player.hidden).not.toBe(true);
    expect(w.physics.playerCollider!.isEnabled()).toBe(true);
    tick(w, 2); expect(w.solids.clear(player.transform, .35, 1)).toBe(true);
  } finally { w.dispose(); }
}, 120_000);
test('a checkpoint containing a deferred player restores the inactive collider until admission', async () => {
  const w = await loadLevel('L2', 1);
  try {
    const player = w.entities.get(1)!, at = { ...player.transform };
    const tank = spawnSetPiece(w, 'veh.tank', at);
    expect(w.solids.admit(player, 'test.pending-snapshot', 0, false)).toBe(false);
    const checkpoint = w.missions!.def.checkpoints[0]; w.missions!.checkpoint(checkpoint);
    expect(w.solids.relocate(player, at, 'test.leave-pending-snapshot', 8, false)).toBe(true);
    expect(w.physics.playerCollider!.isEnabled()).toBe(true);
    w.missions!.restore(checkpoint, true);
    expect(player.pendingAdmission).toBeDefined(); expect(w.physics.playerCollider!.isEnabled()).toBe(false);
    w.entities.get(tank.id)!.hidden = true; tick(w, 30);
    expect(player.pendingAdmission).toBeUndefined(); expect(w.physics.playerCollider!.isEnabled()).toBe(true);
  } finally { w.dispose(); }
}, 120_000);
test('guard audits a stationary actor when a tank moves over it and retains bounded diagnostics', async () => {
  const w = await arena();
  try {
    const tank = spawnSetPiece(w, 'veh.tank', { x: 20, z: 0 });
    const e = w.entities.get(w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' }))!;
    tick(w); tank.transform.x = 12; tick(w);
    expect(w.solids.clear(e.transform, e.combat!.radius, e.id)).toBe(true);
    expect(w.solids.snapshot().failures).toBe(0);
  } finally { w.dispose(); }
});

test('vehicle exits wait for bodyless actors occupying both doors', async () => {
  const w = await arena();
  try {
    const def = vehicleDef('vehicle.sedan'), id = w.vehicles!.spawn(def.id, { x: 12, z: 0 });
    const player = w.entities.get(1)!;
    Object.assign(player.transform, { x: 12 + def.doorX, z: def.width / 2 + .55 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    w.setInput({ interact: true }); tick(w); w.clearInput(); tick(w, 60);
    expect(w.vehicles!.active).toBe(id);
    const car = w.vehicles!.cars.get(id)!, p = car.entity.transform;
    const blockers = [-1, 1].map(side => w.entities.get(w.infected!.spawn('infected.alpha', { x: p.x + def.doorX, z: p.z + side * (def.width / 2 + .55) }, { state: 'idle' }))!);
    expect(blockers.every(e => !e.pendingAdmission && !e.attachedTo)).toBe(true);
    expect(w.vehicles!.exit()).toBe(false);
    for (let i = 0; i < blockers.length; i++) expect(w.solids.relocate(blockers[i], { x: 20, z: i * 2, y: p.y }, 'test.clear-door')).toBe(true);
    expect(w.vehicles!.exit()).toBe(true);
    tick(w); expect(w.solids.clear(player.transform, .35, 1)).toBe(true);
  } finally { w.dispose(); }
});

test('a deferred casualty leaves admission and follows normal death cleanup', async () => {
  const w = await arena();
  try {
    spawnSetPiece(w, 'veh.tank', { x: 12, z: 0 });
    const e = w.entities.get(w.infected!.spawn('infected.alpha', { x: 20, z: 0 }, { state: 'idle' }))!;
    Object.assign(e.transform, { x: 12, z: 0 });
    expect(w.solids.admit(e, 'test.blocked-casualty', 0)).toBe(false);
    e.health.current = 0; tick(w, 2);
    expect(e.pendingAdmission).toBeUndefined(); expect(w.solids.snapshot().pending).toBe(0);
    expect(e.hidden).not.toBe(true);
  } finally { w.dispose(); }
});

test('a stationary revived actor is admitted again after its attachment exemption ends', async () => {
  const w = await arena();
  try {
    const tank = spawnSetPiece(w, 'veh.tank', { x: 12, z: 0 });
    const e = w.entities.get(w.infected!.spawn('infected.alpha', { x: 20, z: 0 }, { state: 'idle' }))!;
    e.attachedTo = tank.id; Object.assign(e.transform, { x: 12, z: 0 }); tick(w);
    e.health.current = 0; delete e.attachedTo; tick(w, 2);
    e.health.current = 300; e.infected!.state = 'idle'; tick(w);
    expect(w.solids.clear(e.transform, e.combat!.radius, e.id)).toBe(true);
    expect(e.hidden).not.toBe(true); expect(e.pendingAdmission).toBeUndefined();
  } finally { w.dispose(); }
});

test('an explicit actor attachment alone exempts contact with its owner', async () => {
  const w = await arena();
  try {
    const player = w.entities.get(1)!;
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: 12, z: 0 }, { state: 'idle' }))!;
    e.attachedTo = player.id; Object.assign(e.transform, player.transform); tick(w);
    expect(Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z)).toBeLessThan(.02);
    delete e.attachedTo; tick(w);
    expect(Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z)).toBeGreaterThanOrEqual(.68);
    expect(w.solids.failures).toBe(0);
  } finally { w.dispose(); }
});

test('an attack windup faces its victim without residual steering rotating it into a neighbour', async () => {
  const w = await arena();
  try {
    const player = w.entities.get(1)!;
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: player.transform.x + 5, z: player.transform.z }, { state: 'chase' }))!;
    tick(w); expect(e.locomotion).toBeDefined();
    expect(w.solids.relocate(e, { x: player.transform.x + 1.2, y: player.transform.y, z: player.transform.z }, 'test.attack-start')).toBe(true);
    Object.assign(e.locomotion!, { vx: 0, vz: 4, omega: 3 });
    tick(w); expect(e.infected!.state).toBe('attack');
    const yaw = e.transform.yaw;
    expect(Math.abs(Math.atan2(Math.sin(yaw - Math.PI), Math.cos(yaw - Math.PI)))).toBeLessThan(.02);
    while (w.tick + 1 < e.infected!.until) {
      tick(w); expect(e.transform.yaw).toBeCloseTo(yaw, 5);
    }
  } finally { w.dispose(); }
});

test('a clear formation can enter positions its neighbours vacate during the same tick', async () => {
  const w = await arena();
  try {
    const bodies = [12, 12.716].map(x => w.entities.get(w.infected!.spawn('infected.runner', { x, z: 0 }, { state: 'idle' }))!);
    for (const e of bodies) e.combat!.staggerUntil = 600;
    // An unrelated blocked transaction must not freeze this clear formation.
    const blocked = w.entities.get(w.infected!.spawn('infected.runner', { x: 25, z: 0 }, { state: 'idle' }))!;
    blocked.combat!.staggerUntil = 600;
    const tank = spawnSetPiece(w, 'veh.tank', { x: 30, z: 0 });
    tick(w);
    const starts = bodies.map(e => e.transform.x);
    for (const e of bodies) e.transform.x += .2;
    Object.assign(blocked.transform, tank.transform);
    tick(w);
    for (let i=0;i<bodies.length;i++) expect(bodies[i].transform.x).toBeCloseTo(starts[i] + .2, 5);
  } finally { w.dispose(); }
});

test('an isolated blocked actor projects along contact instead of freezing at its prior pose', async () => {
  const w = await arena();
  try {
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: 12, z: 0 }, { state: 'idle' }))!;
    const other = w.entities.get(w.infected!.spawn('infected.runner', { x: 12.716, z: 0 }, { state: 'idle' }))!;
    for (const body of [e, other]) body.combat!.staggerUntil = 600;
    tick(w);
    e.transform.x += .2; e.transform.z += .3;
    w.tick++; w.solids.commit();
    expect(e.transform.z).toBeGreaterThan(.3);
    expect(w.solids.clear(e.transform, e.combat!.radius, e.id, true, .02)).toBe(true);
    expect(w.solids.offenders).toEqual([]);
  } finally { w.dispose(); }
});

test('a cached dense-crowd contact permits a formation to enter the space its blocker vacates', async () => {
  const w = await arena();
  try {
    const group = Array.from({ length: 9 }, (_, i) => w.entities.get(w.infected!.spawn('infected.runner', {
      x: 10 + i % 3 * .8, z: Math.floor(i / 3) * .8,
    }, { state: 'idle' }))!);
    w.tick++; w.solids.commit();
    // Populate the contact witness/density cache with a real rejected proposal.
    group[4].transform.x += .25;
    w.tick++; w.solids.commit();
    const before = group.map(e => ({ ...e.transform }));
    for (const e of group) { e.transform.x += .4; e.transform.z += .4; }
    w.tick++; w.solids.commit();
    for (let i = 0; i < group.length; i++) {
      expect(group[i].transform.x).toBeCloseTo(before[i].x + .4, 8);
      expect(group[i].transform.z).toBeCloseTo(before[i].z + .4, 8);
    }
    expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
    expect(w.infected!.director.count).toBe(9);
  } finally { w.dispose(); }
});

test('a wider house resident keeps its identity and walks clear of the pedestrian doorstep', async () => {
  const w = await arena();
  try {
    w.npcs!.civilians.outbreak = new Outbreak(w, { refuges: [] });
    // The pedestrian's endpoint is just inside the Alpha's required wall clearance.
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 987654, blocked: true,
      wall: { x: 11, z: 0, y: 1, halfX: 1, halfZ: 2, halfY: 1 } });
    const house: HouseEmergence = { door: 0, house: 'test-door', x: 11, z: 0, nx: 1, nz: 0, floor: [], sx: 12.35, sz: 0, ox: 12.35, oz: 0, route: [], next: 0, ids: [] };
    const id = emergeResident(w, house, w.tick, { archetype: 'infected.alpha' });
    const e = w.entities.get(id)!;
    expect(e.pendingAdmission).toBeDefined();
    for (let i = 0; i < 300 && house.walking?.length; i++) { walkResidents(w, house, w.tick); tick(w); }
    expect(house.walking).toHaveLength(0); expect(e.pendingAdmission).toBeUndefined();
    expect(e.hidden).not.toBe(true); expect(e.transform.x).toBeGreaterThanOrEqual(12.549);
    expect(w.infected!.director.count).toBe(1); expect(w.entities.get(id)).toBe(e);
  } finally { w.dispose(); }
});

test('a queued house resident can leave a body-blocked doorstep without crossing its wall', async () => {
  const w = await arena();
  try {
    w.npcs!.civilians.outbreak = new Outbreak(w, { refuges: [] });
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 987654, blocked: true,
      wall: { x: 11, z: 0, y: 1, halfX: 1, halfZ: 2, halfY: 1 } });
    const blocker = w.entities.get(w.infected!.spawn('infected.runner', { x: 13, z: 0 }))!;
    blocker.combat!.staggerUntil = 600;
    const house: HouseEmergence = { door: 0, house: 'crowded-door', x: 11, z: 0, nx: 1, nz: 0, floor: [], sx: 12.35, sz: 0, ox: 12.35, oz: 0, route: [], next: 0, ids: [] };
    const id = emergeResident(w, house, w.tick, { archetype: 'infected.runner' });
    const e = w.entities.get(id)!;
    for (let i = 0; i < 240 && house.walking?.length; i++) { walkResidents(w, house, w.tick); tick(w); }
    expect(house.walking).toHaveLength(0); expect(e.pendingAdmission).toBeUndefined();
    expect(e.hidden).not.toBe(true); expect(e.transform.x).toBeGreaterThanOrEqual(12.349);
    expect(w.infected!.director.count).toBe(2); expect(w.entities.get(id)).toBe(e);
  } finally { w.dispose(); }
});

test('same-id conversion keeps a legal circular pose beside a conservative route corner', async () => {
  const w = await arena();
  try {
    const o = w.npcs!.civilians.outbreak = new Outbreak(w, { refuges: [] });
    w.infected!.nav.setBlocker(987654, { x: 12, z: 0, y: .7, halfX: 1, halfZ: 1, halfY: .7 }, true);
    const at = { x: 10.7518, z: 1.2482 }, id = o.spawnPedestrian(at), e = w.entities.get(id)!;
    expect(w.infected!.nav.clear(at.x, at.z, .4)).toBe(false);
    expect(w.solids.clear(e.transform, .35, id)).toBe(true);
    o.turnNow(e);
    expect(w.entities.get(id)).toBe(e);
    expect(e.transform.x).toBe(at.x); expect(e.transform.z).toBe(at.z);
    expect(e.infected).toBeDefined(); expect(w.infected!.director.count).toBe(1);
    w.tick++; w.solids.commit();
    expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  } finally { w.dispose(); }
});

test.each(['classic', 'L1'] as const)('courier and corgi remain outside eight %s attackers through windup and knockback', async brain => {
  const w = await arena();
  try {
    w.combat!.damage.god = true;
    if (brain === 'L1') w.infected!.configureL1v2();
    const player = w.entities.get(1)!, dog = w.entities.get(w.npcs!.companion.spawn())!;
    const ids = Array.from({ length: 8 }, (_, i) => w.infected!.spawn('infected.runner', { x: player.transform.x + Math.cos(i * Math.PI / 4) * 3, z: player.transform.z + Math.sin(i * Math.PI / 4) * 3 }, { state: 'chase', yaw: Math.PI - i * Math.PI / 4 }));
    tick(w, 300);
    Object.assign(dog.transform, player.transform);
    Object.assign(w.entities.get(ids[0])!.transform, player.transform);
    tick(w);
    for (const e of [player, dog]) expect(w.solids.clear(e.transform, .35, e.id, true, .02)).toBe(true);
    expect(ids.every(id => !w.entities.get(id)!.pendingAdmission)).toBe(true);
    expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
    expect(w.infected!.director.count).toBe(8);
  } finally { w.dispose(); }
});

test('the courier can push out of eight living bodies while every committed footprint stays clear', async () => {
  const w = await arena();
  try {
    const player = w.entities.get(1)!, start = { ...player.transform };
    const ids = Array.from({ length: 8 }, (_, i) => {
      const angle = i * Math.PI / 4;
      const id = w.infected!.spawn('infected.runner', { x: start.x + Math.cos(angle) * 1.1, z: start.z + Math.sin(angle) * 1.1 }, { state: 'idle' });
      w.entities.get(id)!.combat!.staggerUntil = 600; return id;
    });
    w.setInput({ move: { x: 1, z: 0 } }); tick(w, 120);
    expect(player.transform.x - start.x).toBeGreaterThan(1.5);
    expect(ids.every(id => w.entities.get(id)!.health.current === 60 && !w.entities.get(id)!.hidden)).toBe(true);
  } finally { w.dispose(); }
});

test('parked rotated hull admission uses its exact footprint rather than its coarse route box', async () => {
  const w = await arena();
  try {
    spawnSetPiece(w, 'veh.tank', { x: 12, z: 0, yaw: 40 * Math.PI / 180 }); tick(w, 30);
    const e = w.entities.get(w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' }))!;
    expect(e.pendingAdmission).toBeUndefined(); expect(e.hidden).not.toBe(true);
    expect(Math.hypot(e.transform.x - 12, e.transform.z)).toBeLessThan(3);
    tick(w);
  } finally { w.dispose(); }
});

test('courier contact projection sweeps the existing capsule instead of crossing a solid to a clear endpoint', async () => {
  const w = await arena();
  try {
    const player = w.entities.get(1)!;
    expect(w.solids.relocate(player, { x: 10.8, z: 0, y: .705 }, 'test.before-wall', 0, false)).toBe(true);
    const wall = { x: 12, z: 0, y: .7, halfX: .1, halfZ: 3, halfY: .7 };
    w.physics.addBlocker(wall); w.infected!.nav.setBlocker(987653, wall, true); w.physics.update();
    w.tick++; w.solids.commit();
    // A post-physics writer requests a pose inside the wall. Endpoint projection
    // points east, but the real capsule must retain the west side it approached.
    player.transform.x = 12;
    w.tick++; w.solids.commit();
    expect(player.transform.x).toBeLessThanOrEqual(11.57);
    expect(w.physics.playerCollider!.translation().x).toBeCloseTo(player.transform.x, 6);
    expect(w.solids.clear(player.transform, .35, 1, true, .02)).toBe(true);
    expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  } finally { w.dispose(); }
});

test('a stationary footprint change revalidates contact with its stationary neighbour', async () => {
  const w = await arena();
  try {
    const alpha = w.entities.get(w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' }))!;
    const neighbour = w.entities.get(w.infected!.spawn('infected.runner', { x: 13.2, z: 0 }, { state: 'idle' }))!;
    w.tick++; w.solids.commit();
    alpha.combat!.radius = 1.1;
    w.tick++; w.solids.commit();
    for (const e of [alpha, neighbour]) expect(w.solids.clear(e.transform, e.combat!.radius, e.id, true, .02)).toBe(true);
    expect(alpha.combat!.radius).toBe(1.1); expect(neighbour.health.current).toBe(60);
    expect(w.infected!.director.count).toBe(2);
    expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  } finally { w.dispose(); }
});

test('a hidden courier without a passenger owner still needs clear hull admission', async () => {
  const w = await arena();
  try {
    const car = w.vehicles!.spawn('vehicle.school-bus', { x: 12, z: 0 });
    const player = w.entities.get(1)!; player.hidden = true; Object.assign(player.transform, w.entities.get(car)!.transform);
    expect(w.solids.admit(player, 'test.hidden-unowned', 0, false)).toBe(false);
    expect(player.pendingAdmission).toBeDefined(); expect(w.physics.playerCollider!.isEnabled()).toBe(false);
    tick(w, 35); expect(player.pendingAdmission).toBeDefined();
    expect(w.solids.snapshot().failures).toBe(0);
  } finally { w.dispose(); }
});

test('the legacy L4 seated courier exempts only its explicit convoy bus', async () => {
  const w = await loadLevel('L4', 1);
  try {
    const player = w.entities.get(1)!, bus = w.missions!.l4!.passengerHull(player);
    expect(player.hidden).toBe(true); expect(bus).toBeDefined();
    expect(w.solids.clear(player.transform, .35, 1)).toBe(true);
    const tank = spawnSetPiece(w, 'veh.tank', { x: player.transform.x, z: player.transform.z + 20 });
    Object.assign(player.transform, tank.transform);
    expect(w.missions!.l4!.passengerHull(player)).toBe(bus);
    expect(w.solids.clear(player.transform, .35, 1)).toBe(false);
  } finally { w.dispose(); }
}, 120_000);

test('a hull reappears with unchanged entity revision and excludes an actor admitted while it was hidden', async () => {
  const w = await arena();
  try {
    const id = w.vehicles!.spawn('vehicle.school-bus', { x: 12, z: 0 }), car = w.vehicles!.cars.get(id)!;
    tick(w, 2); car.entity.hidden = true; tick(w);
    // Inside the long hull, outside the existing 1.5 m clinger attachment range.
    const alpha = w.entities.get(w.infected!.spawn('infected.alpha', { x: 14, z: 0 }, { state: 'idle' }))!;
    tick(w); const revision = w.entities.revision;
    expect(alpha.attachedTo).toBeUndefined();
    expect(car.physics.hullDistance(alpha.transform.x, alpha.transform.z)).toBeLessThan(alpha.combat!.radius);
    car.entity.hidden = false; tick(w);
    expect(w.entities.revision).toBe(revision);
    expect(alpha.attachedTo).toBeUndefined();
    expect(car.physics.hullDistance(alpha.transform.x, alpha.transform.z)).toBeGreaterThanOrEqual(alpha.combat!.radius - .02);
    expect(w.infected!.director.count).toBe(1); expect(alpha.health.current).toBe(300);
    expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  } finally { w.dispose(); }
});
