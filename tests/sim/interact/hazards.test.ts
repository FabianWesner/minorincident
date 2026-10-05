import { expect, test } from 'vitest';
import { arena, step, dummy, health, equip, fire } from '../combat/helpers';
import { NavGrid } from '../../../src/sim/world/NavGrid';
import { destructibleKinds } from '../../../src/sim/interact/Hazards';

test('T-E11-04 @E11 @E11-AC04 propane waits 18 ticks, chains at 4m, damages player at 30% and props', async () => {
  const w = await arena(), h = w.hazards!;
  const a = h.spawn('propane', { x: 1, z: 0 }), b = h.spawn('propane', { x: 5, z: 0 });
  const infected = dummy(w, 2), outside = dummy(w, 12), prop = h.spawn('crate', { x: 2, z: 1 });
  h.hit(a, 100, 'bullet'); step(w, 17); expect(health(w, infected)).toBe(100);
  step(w, 1); expect(health(w, infected)).toBeLessThan(100); expect(health(w, prop)).toBeLessThan(100);
  expect(health(w, 1)).toBeCloseTo(100 - 100 * .8 * .3);
  expect(w.entities.get(b)!.hazard!.fuseAt).toBe(36);
  expect(w.events.events().filter(e => e.type === 'hazard.exploded')).toHaveLength(1);
  step(w, 18); const blasts = w.events.events().filter(e => e.type === 'hazard.exploded');
  expect(blasts).toHaveLength(2); expect(blasts[0]).toMatchObject({ radius: 5, tick: 18 });
  expect(health(w, outside)).toBe(100); step(w, 60); expect(w.events.events().filter(e => e.type === 'hazard.exploded')).toHaveLength(2);
});
test('T-E11-05 @E11 @E11-AC05 a real bullet triggers a 20m/10s alarm and nearby infected target the car', async () => {
  const w = await arena(), h = w.hazards!, car = h.spawn('car-alarm', { x: 3, z: 0 });
  const near = dummy(w, 18, 2), far = dummy(w, 25, 2);
  equip(w, ['weapon.pistol']); fire(w); step(w, 20);
  const noise = w.events.events().find(e => e.type === 'noise');
  expect(noise).toMatchObject({ sourceId: car, radius: 20, duration: 10 });
  expect(w.entities.get(near)!.noiseTarget?.id).toBe(car); expect(w.entities.get(far)!.noiseTarget).toBeUndefined();
  const expiry = w.entities.get(near)!.noiseTarget!.until;
  step(w, expiry - w.tick); expect(w.entities.get(near)!.noiseTarget).toBeUndefined();
  expect(w.entities.get(car)!.hazard!.activeUntil).toBe(expiry);
});
test('T-E11-06 @E11 @E11-AC06 fire ignites adjacent wood within 3s and burns out after authored burn time', async () => {
  const w = await arena(), h = w.hazards!;
  h.spawn('fire', { x: 10, z: 0 });
  const fence = h.spawn('fence', { x: 11, z: 0 }, { burnTime: 4 }), crate = h.spawn('crate', { x: 13, z: 0 }, { burnTime: 6 });
  const metal = h.spawn('trash-can', { x: 10, z: 1 }), far = h.spawn('crate', { x: 25, z: 0 });
  step(w, 180); expect(w.entities.get(fence)!.destructible!.burningUntil).toBeGreaterThan(w.tick);
  expect(w.entities.get(metal)!.destructible!.burningUntil).toBe(0);
  step(w, 180); expect(w.entities.get(crate)!.destructible!.burningUntil).toBeGreaterThan(0);
  const expiry = w.entities.get(fence)!.destructible!.burningUntil;
  expect(w.entities.get(fence)!.destructible!.broken).toBe(true); expect(w.tick).toBeGreaterThanOrEqual(expiry);
  step(w, 420); expect(w.entities.get(crate)!.destructible!.broken).toBe(true); expect(w.entities.get(far)!.destructible!.broken).toBe(false);
});
test('T-E11-07 @E11 @E11-AC07 real melee destroys fence, opens nav, physics debris is capped and expires after 8s', async () => {
  const w = await arena(), nav = new NavGrid([-3, -2], [4, 3]); nav.cells.fill(1); w.interactables!.nav = nav;
  const fence = w.hazards!.spawn('fence', { x: 1, z: 0 }, { hp: 20, halfZ: 3 });
  expect(nav.flood([-2, 0])[nav.index(3, 0)]).toBe(0);
  equip(w); fire(w); step(w, 20); expect(w.entities.get(fence)!.destructible!.broken).toBe(true);
  expect(nav.flood([-2, 0])[nav.index(3, 0)]).toBe(1);
  const debris = w.hazards!.debris.snapshot(); expect(debris.length).toBeGreaterThan(0); expect(debris.length).toBeLessThanOrEqual(8);
  expect(w.physics.bodyCount).toBe(2 + debris.length);
  const until = debris[0].until; step(w, until - w.tick - 1); expect(w.hazards!.debris.snapshot()).toHaveLength(debris.length);
  step(w, 1); expect(w.hazards!.debris.snapshot()).toHaveLength(0);
  const count = w.physics.bodyCount;
  const crate = w.hazards!.spawn('crate', { x: 10, z: 0 }); w.hazards!.hit(crate, 1000, 'melee');
  expect(w.physics.bodyCount).toBe(count); // same Rapier slots reused
});
test('T-E11-hazard-scope @E11 gas leaks on bullets, fuse electrifies water/fence for 5s, toxic zones damage', async () => {
  const w = await arena(), h = w.hazards!, gas = h.spawn('gas-can', { x: 10, z: 0 });
  h.hit(gas, 1, 'melee'); expect(w.query({ archetype: 'hazard.fuel-trail' })).toHaveLength(0);
  h.hit(gas, 1, 'bullet'); expect(w.query({ archetype: 'hazard.fuel-trail' }).length).toBeGreaterThan(0);
  const box = h.spawn('fuse-box', { x: 0, z: 0 }), water = h.spawn('water', { x: 0, z: 0 }), metal = h.spawn('metal-fence', { x: 2, z: 0 });
  h.hit(box, 1, 'bullet'); expect(w.entities.get(water)!.hazard!.activeUntil).toBe(300); expect(w.entities.get(metal)!.hazard!.activeUntil).toBe(300);
  step(w, 60); expect(health(w, 1)).toBeLessThan(100);
  step(w, 240); expect(w.entities.get(water)!.hazard!.activeUntil).toBe(w.tick);
  const victim = dummy(w, 15); h.spawn('toxic', { x: 15, z: 0 }); step(w, 60); expect(health(w, victim)).toBeLessThan(100);
});
test('T-E11-breakables @E11 @E11-AC07 every light prop breaks once and pooled debris stays bounded', async () => {
  const w = await arena();
  for (const [i, kind] of destructibleKinds.entries()) {
    const id = w.hazards!.spawn(kind, { x: 10 + i * 2, z: 10 });
    w.hazards!.hit(id, 1000, 'melee'); w.hazards!.hit(id, 1000, 'melee');
    expect(w.events.events().filter(e => e.type === 'prop.broken' && e.id === id)).toHaveLength(1);
  }
  expect(w.hazards!.debris.snapshot().length).toBeLessThanOrEqual(32);
});
test('T-E11-chain-budget @E11 @E11-AC04 large chains honor eight blasts per sim second without dropping links', async () => {
  const w = await arena(); const ids = [];
  for (let i = 0; i < 12; i++) ids.push(w.hazards!.spawn('propane', { x: 10 + i * .01, z: 0 }));
  w.hazards!.hit(ids[0], 100, 'bullet'); step(w, 59);
  expect(w.events.events().filter(e => e.type === 'hazard.exploded')).toHaveLength(8);
  step(w, 60); expect(w.events.events().filter(e => e.type === 'hazard.exploded')).toHaveLength(12);
});
test('T-E11-cosmetic-debris @E11 @E11-AC07 pooled pieces collide with the ground and do not obstruct the survivor', async () => {
  const w = await arena(), baseline = await arena(), crate = w.hazards!.spawn('crate', { x: 8, z: 0 });
  w.hazards!.hit(crate, 1000, 'melee');
  for (const [i, p] of w.hazards!.debris.pieces.entries()) {
    p.body.setTranslation({ x: .6 + i * .15, y: .7, z: 0 }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
  for (const world of [w, baseline]) { world.setInput({ move: { x: 1, z: 0 } }); step(world, 60); }
  expect(w.entities.get(1)!.transform.x).toBeCloseTo(baseline.entities.get(1)!.transform.x, 3);
  expect(w.hazards!.debris.snapshot().every(p => p.position.y > 0)).toBe(true);
});
test('T-E11-fire-radius @E11 @E11-AC06 authored fire-zone radius governs spread and expired fires stop igniting', async () => {
  const w = await arena();
  w.hazards!.spawn('fire', { x: 10, z: 0 }, { radius: 4, duration: 2 });
  const crate = w.hazards!.spawn('crate', { x: 13, z: 0 });
  step(w, 119); expect(w.entities.get(crate)!.destructible!.exposure).toBe(119);
  step(w, 1); expect(w.entities.get(crate)!.destructible!.burningUntil).toBe(0);
  step(w, 60); expect(w.entities.get(crate)!.destructible!.exposure).toBe(0);
  w.hazards!.spawn('fire', { x: 10, z: 0 }, { radius: 4 }); step(w, 120);
  expect(w.entities.get(crate)!.destructible!.burningUntil).toBe(w.tick + 360);
});
