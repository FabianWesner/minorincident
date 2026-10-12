import { expect, test } from 'vitest';
import { WorldHumans } from '../../../src/sim/ai/Perception';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('T-E29-19-human-query @E29-AC19 human queries match the original spatial filter through same-tick movement, bites, spawn, deletion and restore', () => {
  const world = new SimWorld(), humans = new WorldHumans(world);
  const add = (civilian: boolean, x: number) => {
    const e = world.entities.create({ kind: civilian ? 'npc' : 'infected', archetype: civilian ? 'npc.civilian-man-a' : 'infected.runner', faction: civilian ? 'civilian' : 'infected', health: { current: 60, max: 60 }, transform: { x, y: .7, z: x % 3, yaw: 0 } });
    if (civilian) e.civilian = { adult: true, state: 'calm' } as EntitySnapshot['civilian'];
    world.spatial.set(e.id, e.transform.x, e.transform.z); return e;
  };
  const player = add(false, 0); player.kind = 'player';
  const targets = [add(true, -2), add(true, 2), add(true, 7)];
  for (let i = 0; i < 200; i++) add(false, (i % 21) - 10);
  const compare = () => {
    for (const x of [-3, 0, 6]) for (const r of [0, 2, 8, 16]) {
      const expected = world.spatial.query({ x, z: 0, r }).flatMap(id => { const h = humans.get(id); return h ? [structuredClone(h)] : []; });
      expect(humans.within({ x, z: 0 }, r)).toEqual(expected);
    }
  };
  try {
    compare(); targets[0].civilian!.adult = false; compare();
    targets[0].civilian!.adult = true; targets[1].hidden = true; compare(); targets[1].hidden = false;
    humans.bitten.add(targets[1].id); compare(); humans.bitten.clear();
    targets[2].transform.x = -1; world.spatial.set(targets[2].id, -1, targets[2].transform.z); compare();
    targets[2].health.current = 0; compare();
    world.entities.delete(targets[0].id); world.spatial.delete(targets[0].id); add(true, 1); compare();
    // Equal entity count and tick: spawn invalidation must still refresh membership.
    world.entities.delete(targets[1].id); world.spatial.delete(targets[1].id); const replacement = add(true, 2);
    world.events.emit({ type: 'entity.spawned', tick: world.tick, id: replacement.id }); compare();
    const restored = structuredClone(world.entities.values());
    restored.find(e => e.id === replacement.id)!.id = 800;
    world.entities.restore(restored, player); world.spatial.reset();
    for (const e of world.entities.iterate()) world.spatial.set(e.id, e.transform.x, e.transform.z);
    world.events.emit({ type: 'checkpoint.restored', tick: world.tick, id: 'rocket' }); compare();
    const pending = add(false, 1); pending.kind = 'npc'; compare();
    pending.civilian = { ...targets[0].civilian!, adult: true }; compare();
    world.tick++; compare(); expect(() => humans.within({ x: 0, z: 0 }, -1)).toThrow(RangeError);
  } finally { world.dispose(); }
});

test('T-E29-19-traffic-query @E29-AC19 cached traffic obstacles retain live movement, late components, deletion and restore', async () => {
  const { Traffic } = await import('../../../src/sim/npc/Traffic');
  const world = new SimWorld(), traffic = new Traffic(world);
  try {
    expect(traffic.overlaps({ x: 0, z: 0 })).toBe(false);
    const id = traffic.spawn([{ x: 0, z: 0 }, { x: 10, z: 0 }]);
    const car = world.entities.get(id)!;
    expect(traffic.overlaps({ x: 0, z: 0 })).toBe(true);
    car.transform.x = 10;
    expect(traffic.overlaps({ x: 0, z: 0 })).toBe(false);
    expect(traffic.overlaps({ x: 10, z: 0 })).toBe(true);
    const saved = structuredClone(car);
    world.entities.delete(id); expect(traffic.overlaps({ x: 10, z: 0 })).toBe(false);
    const pending = world.entities.create({ ...saved, traffic: undefined });
    expect(traffic.overlaps({ x: 10, z: 0 })).toBe(false);
    pending.traffic = saved.traffic;
    expect(traffic.overlaps({ x: 10, z: 0 })).toBe(true);
    world.entities.replace({ ...saved, id: pending.id, transform: { ...saved.transform, x: 20 } });
    expect(traffic.overlaps({ x: 10, z: 0 })).toBe(false);
    expect(traffic.overlaps({ x: 20, z: 0 })).toBe(true);
  } finally { world.dispose(); }
});
