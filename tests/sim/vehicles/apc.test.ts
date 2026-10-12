import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { vehicleDef } from '../../../src/data/vehicles';
import { emptyInput } from '../../../src/input/InputFrame';
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
async function fixture(count = 0) {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 7);
  const v = w.vehicles!, def = vehicleDef('vehicle.military-apc'), id = v.spawn(def.id, { x: 0, z: 0 });
  const player = w.entities.get(1)!;
  Object.assign(player.transform, { x: def.doorX, z: def.width / 2 + .55 });
  w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
  w.setInput({ interact: true }); step(w, 1); w.clearInput();
  expect(v.active).toBe(id);
  const roster: number[] = [];
  for (let i = 0; i < count; i++) {
    const actor = w.npcs!.civilians.spawn('cashier', { x: def.doorX, z: def.width / 2 + .55 });
    const e = w.entities.get(actor)!; e.health.current = 50 + i;
    e.civilian!.survivor = { key: `apc-${i}`, mode: 'follow', leader: 1, foundAt: w.tick, slot: i, cover: false, waitAt: 0 };
    expect(v.boardPassenger(id, actor)).toBe(true); roster.push(actor);
    step(w, 61);
  }
  if (!count) step(w, 60);
  return { w, v, id, roster };
}
test.each([0, 1, 35])('T-E30-13-apc @E30-AC13 complete %i-person roster boards without a seat cap', async count => {
  const { w, v, id, roster } = await fixture(count);
  try {
    expect(v.groupBoarded(id, roster)).toBe(true);
    expect(v.cars.get(id)!.entity.vehicle!.passengers ?? []).toHaveLength(count);
    for (const actor of roster) { expect(w.entities.get(actor)!.hidden).toBe(true); expect(w.entities.get(actor)!.passengerOf).toBe(id); }
    const pending = w.npcs!.civilians.spawn('cashier', { x: 10, z: 10 });
    expect(v.boardPassenger(id, pending)).toBe(false); expect(v.groupBoarded(id, [...roster, pending])).toBe(false);
    w.entities.get(pending)!.health.current = 0;
    expect(v.groupBoarded(id, [...roster, pending])).toBe(true);
  } finally { w.dispose(); }
});
test('T-E30-14-apc @E30-AC14 shared APC transfer keeps identity, roster, health, weapons and durability', async () => {
  const { w, v, id, roster } = await fixture(5), destination = new SimWorld(); await destination.init(); destination.loadScenario('horde-arena', 9);
  try {
    w.combat!.setLoadout(['weapon.bat', 'weapon.fire-axe', 'weapon.handgun'], ['weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher']);
    w.entities.get(1)!.health.current = 37;
    w.combat!.runner.infiniteCharges = true;
    w.combat!.runner.loadout.state.RIGHT.index = 2;
    v.damage(id, 187); const source = v.transfer(id);
    expect(source.occupants.map(e => e.id)).toEqual([1, ...roster]);
    const transferredId = destination.vehicles!.restoreTransfer(source, { x: 12, z: -8 }, Math.PI / 2);
    expect(transferredId).toBe(id); expect(destination.vehicles!.active).toBe(id);
    expect(destination.entities.get(id)!.health).toEqual(source.vehicle.health);
    for (const actor of source.occupants) {
      const restored = destination.entities.get(actor.id)!;
      expect(restored.health).toEqual(actor.health); expect(restored.weapons).toEqual(actor.weapons); expect(restored.civilian?.survivor?.key).toBe(actor.civilian?.survivor?.key);
      expect(restored.civilian?.state).toBe(actor.civilian?.state);
      expect(restored.hidden).toBe(true);
      if (actor.id === 1) { expect(restored.transform.x).toBe(12); expect(restored.transform.z).toBe(-8); }
      else expect(Math.hypot(restored.transform.x - 12, restored.transform.z + 8)).toBeLessThan(vehicleDef('vehicle.military-apc').length / 2);
    }
    expect(destination.combat!.runner.loadout.state).toEqual(source.occupants[0].weapons);
    expect(destination.combat!.runner.infiniteCharges).toBe(true);
    expect(destination.vehicles!.groupBoarded(id, roster)).toBe(true);
    step(destination, 120); expect(destination.vehicles!.groupBoarded(id, roster)).toBe(true);
    expect(source.vehicle.transform.x).not.toBe(12);
    expect(destination.physics.playerCollider!.isEnabled()).toBe(false);
  } finally { w.dispose(); destination.dispose(); }
});
test('T-E30-14-unarmed @E30-AC14 APC only attacks through mass; both firing inputs are suspended', async () => {
  const { w, v, id } = await fixture();
  try {
    const frame = emptyInput(); frame.left.down = frame.left.held = frame.right.down = frame.right.held = true;
    w.applyInput(frame, 'keyboard'); step(w, 120);
    expect(w.events.events().filter(e => e.type === 'combat.attack')).toHaveLength(0);
    const target = w.infected!.spawn('infected.runner', { x: 3.1, z: 0 });
    const car = v.cars.get(id)!; car.physics.body.setLinvel({ x: 8, y: 0, z: 0 }, true); car.physics.postPhysics(); w.clearInput(); step(w, 1);
    expect(w.entities.get(target)!.health.current).toBeLessThan(w.entities.get(target)!.health.max);
  } finally { w.dispose(); }
});
test('T-E30-13-exit @E30-AC13 safe passenger exit resumes following, with continuous doorway movement', async () => {
  const { w, v, id, roster } = await fixture(1);
  try {
    const actor = w.entities.get(roster[0])!, before = { ...actor.transform };
    expect(v.disembarkPassenger(id, actor.id)).toBe(true);
    const positions: { x: number; z: number }[] = [];
    step(w, 12);
    for (let i = 0; i < 49; i++) { step(w, 1); positions.push({ ...actor.transform }); }
    for (let i = 1; i < positions.length; i++) expect(Math.hypot(positions[i].x - positions[i - 1].x, positions[i].z - positions[i - 1].z)).toBeLessThan(1);
    expect(actor.hidden).toBe(false); expect(actor.passengerOf).toBeUndefined(); expect(actor.health.current).toBe(50);
    expect(actor.civilian!.pauseUntil).not.toBe(Number.MAX_SAFE_INTEGER); expect(actor.transform).not.toEqual(before);
    expect(w.infected!.nav.clear(actor.transform.x, actor.transform.z, .35)).toBe(true);
    expect(v.groupBoarded(id, roster)).toBe(false);
  } finally { w.dispose(); }
});

test('T-E30-17-apc @E30-AC17 checkpoint keeps remaining boarding time, occupant roster and vehicle health', async () => {
  const { missionSandbox } = await import('../../fixtures/scenarios/mission-sandbox');
  const { w, v, id } = await fixture();
  try {
    const def = missionSandbox('survive'); def.onStart = []; def.steps[0].complete = { kind: 'timer', seconds: 1000 };
    const mission = w.loadMission(def); mission.begin();
    const actor = w.npcs!.civilians.spawn('cashier', { x: .71, z: 2.025 });
    expect(v.boardPassenger(id, actor)).toBe(true); step(w, 20); v.damage(id, 50); mission.checkpoint('C');
    const passenger = w.entities.get(id)!.vehicle!.passengers![0], remaining = passenger.started + 60 - w.tick;
    step(w, 90); v.damage(id, 100); mission.restore('C');
    const restored = w.entities.get(id)!.vehicle!.passengers![0];
    expect(restored.phase).toBe('enter'); expect(restored.started + 60 - w.tick).toBe(remaining);
    expect(w.entities.get(id)!.health.current).toBe(950); expect(w.entities.get(actor)!.passengerOf).toBe(id);
    step(w, remaining); expect(w.entities.get(id)!.vehicle!.passengers![0].phase).toBe('seated');
    expect(w.entities.get(actor)!.hidden).toBe(true); expect(w.entities.get(id)!.vehicle!.passengers).toHaveLength(1);
  } finally { w.dispose(); }
});

test('T-E30-14-windup @E30-AC14 boarding cancels a personal weapon already preparing to fire', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 7);
  try {
    const id = w.vehicles!.spawn('vehicle.military-apc', { x: 0, z: 0 });
    const player = w.entities.get(1)!; Object.assign(player.transform, { x: .71, z: 2.025 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    w.combat!.setLoadout(['weapon.bat'], ['weapon.rocket-launcher']);
    w.setInput({ right: { down: true, held: true, up: false }, aim: { x: 1, z: 0 } }); step(w, 1);
    expect(w.combat!.runner.running.RIGHT).toBeDefined();
    expect(w.events.events().filter(e => e.type === 'combat.attack')).toHaveLength(0);
    w.clearInput(); w.setInput({ interact: true }); step(w, 1); w.clearInput();
    expect(w.vehicles!.active).toBe(id); expect(w.vehicles!.groupBoarded(id, [])).toBe(false); expect(() => w.vehicles!.transfer(id)).toThrow('Driver is still boarding'); step(w, 60);
    expect(w.combat!.runner.running.RIGHT).toBeUndefined();
    expect(w.events.events().filter(e => e.type === 'combat.attack')).toHaveLength(0);
    expect(w.combat!.projectiles).toHaveLength(0);
  } finally { w.dispose(); }
});

test('T-E30-13-loss @E30-AC13 departure carries living occupants without a phantom seat for a lost survivor', async () => {
  const { w, v, id, roster } = await fixture(2);
  try {
    w.entities.get(roster[1])!.health.current = 0;
    expect(v.groupBoarded(id, roster)).toBe(true);
    const transfer = v.transfer(id);
    expect(transfer.occupants.map(e => e.id)).toEqual([1, roster[0]]);
    expect(transfer.vehicle.vehicle!.passengers!.map(p => p.id)).toEqual([roster[0]]);
    expect(w.entities.get(roster[1])!.health.current).toBe(0);
  } finally { w.dispose(); }
});

test('T-E30-17-save @E30-AC17 campaign save serializes the shared APC payload without resetting health or roster', async () => {
  const { newCampaign } = await import('../../../src/sim/progression/Campaign');
  const { decodeSave } = await import('../../../src/sim/progression/Save');
  const { w, v, id, roster } = await fixture(3);
  try {
    v.damage(id, 120); const save = newCampaign(); save.transport = v.transfer(id);
    const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
    if (decoded.status !== 'ok') throw new Error('Transport save failed');
    expect(decoded.save.transport).toEqual(save.transport);
    expect(decoded.save.transport!.vehicle.id).toBe(id);
    expect(decoded.save.transport!.vehicle.health.current).toBe(880);
    const duplicated = structuredClone(save); duplicated.transport!.occupants.push(duplicated.transport!.occupants[0]);
    expect(decodeSave(JSON.stringify(duplicated)).status).toBe('error');
    expect(decoded.save.transport!.occupants.map(e => e.id)).toEqual([1, ...roster]);
  } finally { w.dispose(); }
});

test('T-E30-13-motion @E30-AC13 even hidden boarding and exit keep passenger motion below 1m per tick', async () => {
  const { w, v, id } = await fixture();
  try {
    const actorId = w.npcs!.civilians.spawn('cashier', { x: .71, z: 2.025 }), actor = w.entities.get(actorId)!;
    expect(v.boardPassenger(id, actorId)).toBe(true);
    let previous = { ...actor.transform };
    for (let i = 0; i < 80; i++) {
      step(w, 1); expect(Math.hypot(actor.transform.x - previous.x, actor.transform.z - previous.z)).toBeLessThan(1); previous = { ...actor.transform };
    }
    expect(v.disembarkPassenger(id, actorId)).toBe(true);
    for (let i = 0; i < 80; i++) {
      step(w, 1); expect(Math.hypot(actor.transform.x - previous.x, actor.transform.z - previous.z)).toBeLessThan(1); previous = { ...actor.transform };
    }
  } finally { w.dispose(); }
});

test('T-E30-13-companion @E30-AC13 companion identity and courage survive boarding, transfer and a grounded exit', async () => {
  const { w, v, id } = await fixture();
  const destination = new SimWorld(); await destination.init(); destination.loadScenario('horde-arena', 9);
  try {
    const actorId = w.npcs!.companion.spawn(), actor = w.entities.get(actorId)!;
    Object.assign(actor.transform, { x: .71, z: 2.025 }); actor.companion!.courage = 73;
    expect(v.boardPassenger(id, actorId)).toBe(true); step(w, 80);
    expect(actor.hidden).toBe(true); expect(v.groupBoarded(id, [actorId])).toBe(true);
    destination.vehicles!.restoreTransfer(v.transfer(id), { x: 12, z: -8 });
    const restored = destination.entities.get(actorId)!;
    expect(restored.companion!.courage).toBe(73); expect(restored.hidden).toBe(true);
    expect(destination.vehicles!.disembarkPassenger(id, actorId)).toBe(true); step(destination, 60);
    expect(restored.hidden).toBe(false); expect(restored.transform.y).toBe(.3); expect(restored.passengerOf).toBeUndefined();
  } finally { w.dispose(); destination.dispose(); }
});
