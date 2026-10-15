import { afterEach, expect, test } from 'vitest';
import { loadL5 } from '../../tools/sim-runner/l5Bots';
import type { SimWorld } from '../../src/sim/world/SimWorld';
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
test('PO #26 @E23 three followers at 99/60/30 percent: only the most injured reserves and walks to the medkit; unsafe medicine waits', async () => {
  const loaded = await loadL5(1); world = loaded.world; const w = world;
  loaded.mission.completeObjective('emerge'); for (let tick = 0; tick < 661; tick++) w.update();
  for (const e of [...w.infected!.active]) w.infected!.release(e);
  const group = loaded.mission.state.l5!.survivors.slice(0, 3).map((r, i) => {
    const e = w.entities.get(r.id)!; e.hidden = false; e.civilian!.survivor!.mode = 'follow'; r.status = 'following';
    Object.assign(e.transform, { x: 8 + i, z: -39 }); w.spatial.set(e.id, e.transform.x, e.transform.z);
    e.health.current = e.health.max * [.99, .6, .3][i]; return e;
  });
  const id = w.pickups!.spawn('medkit', { x: 5, z: -39 }), pack = w.entities.get(id)!;
  if (pack.pickup && 'kind' in pack.pickup) pack.pickup.amount = 40;
  const threatId = w.infected!.spawn('infected.alpha', { x: 4, z: -37 });
  expect(w.pickups!.seekSurvivorMedkit(group[2])).toBe(false);
  w.infected!.release(w.entities.get(threatId)!);
  expect(w.pickups!.seekSurvivorMedkit(group[0])).toBe(false);
  expect(w.pickups!.seekSurvivorMedkit(group[1])).toBe(false);
  expect(pack.pickup).toMatchObject({ reservedFor: group[2].id, collected: false });
  const start = { ...group[2].transform };
  for (let tick = 0; tick < 300 && !(pack.pickup && 'kind' in pack.pickup && pack.pickup.collected); tick++) {
    w.tick++; for (const e of group) w.pickups!.seekSurvivorMedkit(e);
  }
  expect(pack.pickup).toMatchObject({ collected: true });
  expect(group[2].health.current).toBeCloseTo(58);
  expect(Math.hypot(group[2].transform.x - start.x, group[2].transform.z - start.z)).toBeGreaterThan(1);
  expect(group[0].health.current).toBeCloseTo(59.4); expect(group[1].health.current).toBeCloseTo(36);
  expect(w.events.events().filter(e => e.type === 'pickup.collected' && 'id' in e && e.id === id)).toHaveLength(1);
  // A survivor reservation never blocks the player's normal pickup transaction.
  const player = w.entities.get(1)!; const other = w.pickups!.spawn('medkit', player.transform);
  player.health.current = 20; const p = w.entities.get(other)!.pickup!; if ('kind' in p) p.reservedFor = group[1].id;
  w.pickups!.update(); expect(player.health.current).toBeGreaterThan(20); expect(p).toMatchObject({ collected: true });
}, 300_000);

test('PO #25 @E07 @E23 an Alpha 5 m from the courier behind cover turns, roars and engages without sight; regular infected hear too', async () => {
  const loaded = await loadL5(1); world = loaded.world; const w = world;
  loaded.mission.completeObjective('emerge'); for (let tick = 0; tick < 661; tick++) w.update();
  const alpha = w.infected!.active.find(e => e.archetype === 'infected.alpha')!;
  for (const e of [...w.infected!.active]) if (e !== alpha) w.infected!.release(e);
  const player = w.entities.get(1)!;
  Object.assign(player.transform, { x: -56.77, z: -10.76 }); Object.assign(w.previousPlayer!, player.transform);
  w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform); w.spatial.set(1, player.transform.x, player.transform.z);
  Object.assign(alpha.transform, { x: -52, z: -12, yaw: 0 }); w.spatial.set(alpha.id, -52, -12);
  w.infected!.hearing.los.register({ id: 'po-car-cover', source: 'car', active: true, shape: { kind: 'aabb', min: { x: -55, z: -14 }, max: { x: -54, z: -9 } } });
  expect(w.infected!.hearing.sees(alpha, player.transform)).toBe(false);
  expect(w.infected!.hearing.hears(alpha, player.transform)).toBe(true);
  const start = w.tick;
  for (let tick = 0; tick < 120; tick++) w.update();
  expect(w.events.events().some(e => e.type === 'ai.alerted' && e.tick > start && e.targetId === alpha.id && e.cause === 'hearing')).toBe(true);
  expect(w.events.events().some(e => e.type === 'telegraph' && e.sourceId === alpha.id && e.special === 'alpha.roar')).toBe(true);
  expect(Math.hypot(alpha.transform.x + 52, alpha.transform.z + 12)).toBeGreaterThan(.5);
  const regular = w.infected!.spawn('infected.runner', alpha.transform);
  expect(w.infected!.hearing.hears(w.entities.get(regular)!, player.transform)).toBe(true);
}, 300_000);
