import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { spawnSetPiece } from '../../../src/sim/missions/L4Spectacle';
import { missionControls } from '../../../src/sim/missions/controls';
import { respawnAtCheckpoint } from '../../../src/sim/missions/Respawn';
import { vehicles, vehicleDef } from '../../../src/data/vehicles';
import { emergeResident, walkResidents, type HouseEmergence } from '../../../src/sim/outbreak/HouseEmergence';

async function arena() { const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1); return w; }
const tick = (w: SimWorld, n = 1) => { for (let i = 0; i < n; i++) w.update(); expect(w.solids.offenders).toEqual([]); };

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

test('a wider house resident keeps its identity and walks clear of the pedestrian doorstep', async () => {
  const w = await arena();
  try {
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

test('courier and corgi remain outside eight attackers through windup and knockback', async () => {
  const w = await arena();
  try {
    w.combat!.damage.god = true;
    const player = w.entities.get(1)!, dog = w.entities.get(w.npcs!.companion.spawn())!;
    const ids = Array.from({ length: 8 }, (_, i) => w.infected!.spawn('infected.runner', { x: player.transform.x + Math.cos(i * Math.PI / 4) * 3, z: player.transform.z + Math.sin(i * Math.PI / 4) * 3 }, { state: 'chase' }));
    tick(w, 300);
    Object.assign(dog.transform, player.transform);
    Object.assign(w.entities.get(ids[0])!.transform, player.transform);
    tick(w);
    for (const e of [player, dog]) expect(w.solids.clear(e.transform, .35, e.id, true, .02)).toBe(true);
    expect(ids.every(id => !w.entities.get(id)!.pendingAdmission)).toBe(true);
    expect(w.infected!.director.count).toBe(8);
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
