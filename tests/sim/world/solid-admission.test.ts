import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { spawnSetPiece } from '../../../src/sim/missions/L4Spectacle';
import { missionControls } from '../../../src/sim/missions/controls';
import { respawnAtCheckpoint } from '../../../src/sim/missions/Respawn';
import { vehicles, vehicleDef } from '../../../src/data/vehicles';

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
