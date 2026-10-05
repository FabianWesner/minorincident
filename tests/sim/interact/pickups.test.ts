import { expect, test } from 'vitest';
import { arena, step, equip } from '../combat/helpers';
test('T-E11-08 @E11 @E11-AC08 pickups apply exact effects once; health caps and objective items persist', async () => {
  const w = await arena(), p = w.entities.get(1)!, pickups = w.pickups!;
  w.player!.damage(80, w.tick);
  const med = pickups.spawn('medkit', { x: 0, z: 0 }); step(w, 1); expect(p.health.current).toBe(70);
  const soda = pickups.spawn('soda', { x: 0, z: 0 }); step(w, 1); expect(p.health.current).toBe(85);
  pickups.spawn('medkit', { x: 0, z: 0 }); step(w, 1); expect(p.health.current).toBe(100);
  const drink = pickups.spawn('energy-drink', { x: 0, z: 0 }); step(w, 1);
  expect(p.speedBuff).toEqual({ multiplier: 1.25, until: w.tick + 480 });
  step(w, 1); expect(w.player!.locomotion.speedScale).toBe(1.25);
  step(w, 479); expect(w.player!.locomotion.speedScale).toBe(1);
  equip(w); const grenade = w.combat!.runner.loadout.current('RIGHT'); grenade.charges = 0; grenade.nextCharge = w.tick + 600;
  pickups.spawn('throwable', { x: 0, z: 0 }); step(w, 1); expect(grenade.charges).toBe(1);
  pickups.spawn('throwable', { x: 0, z: 0 }); step(w, 1); expect(grenade.charges).toBe(2); expect(grenade.nextCharge).toBe(0);
  pickups.spawn('weapon', { x: 0, z: 0 }, 'weapon.pistol'); step(w, 1);
  expect(w.combat!.runner.loadout.state.LEFT.rack.map(s => s.id)).toContain('weapon.pistol');
  for (const item of ['key.house', 'fuse', 'batteries']) { pickups.spawn('item', { x: 0, z: 0 }, item); step(w, 1); }
  expect(p.inventory).toEqual(['key.house', 'fuse', 'batteries']);
  step(w, 120);
  for (const id of [med, soda, drink]) expect(w.events.events().filter(e => e.type === 'pickup.collected' && e.id === id)).toHaveLength(1);
  expect(w.entities.get(med)!.pickup!.collected).toBe(true);
});
test('T-E11-08b @E11 @E11-AC08 full/unsupported pickups wait, dead players cannot collect; respawn keeps inventory', async () => {
  const w = await arena(), p = w.entities.get(1)!;
  const med = w.pickups!.spawn('medkit', { x: 0, z: 0 }); step(w, 1); expect(w.entities.get(med)!.pickup!.collected).toBe(false);
  w.player!.damage(100, w.tick); const key = w.pickups!.spawn('item', { x: 0, z: 0 }, 'key.house'); step(w, 1); expect(w.entities.get(key)!.pickup!.collected).toBe(false);
  step(w, 150); expect(p.inventory).toContain('key.house');
  w.player!.damage(100, w.tick); step(w, 150); expect(p.inventory).toContain('key.house');
  expect(() => w.pickups!.spawn('weapon', { x: 0, z: 0 }, 'unknown')).toThrow();
});
