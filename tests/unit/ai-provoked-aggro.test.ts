import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';

/**
 * PO 10-20 (L5 metro): "I shot the alpha in L5, but it's not attacking. Of course when shot, the alpha (or Zombie or mega)
 * needs to go to attack move even when not in sight". Any infected damaged by the courier hunts her for about 12 s.
 */
async function shotFarAway(archetype: string) {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena');
  world.combat!.damage.god = true;
  const courier = world.entities.get(1)!;
  const id = world.infected!.spawn(archetype, { x: courier.transform.x + 32, z: courier.transform.z }, { state: 'idle' });
  return { world, courier, id, e: world.entities.get(id)! };
}
const hit = (world: SimWorld, targetId: number, sourceId = 1) => world.combat!.damage.apply({
  sourceId, targetId, attackId: 9001, actionId: 'weapon.pistol', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 3, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
const gap = (a: { transform: { x: number; z: number } }, b: { transform: { x: number; z: number } }) => Math.hypot(a.transform.x - b.transform.x, a.transform.z - b.transform.z);

for (const archetype of ['infected.runner', 'infected.alpha', 'infected.lion']) {
  test(`T-AGGRO-${archetype} @aggro a ${archetype} shot out of sight and idle chases the shooter for ~12 s`, async () => {
    const { world, courier, id, e } = await shotFarAway(archetype);
    try {
      for (let i = 0; i < 5; i++) world.update();
      expect(e.infected!.state).toBe('idle');
      const before = gap(e, courier);
      hit(world, id);
      expect(e.health.current).toBeGreaterThan(0);
      expect(e.infected!.provoked?.id).toBe(1);
      for (let i = 0; i < 180; i++) world.update();
      expect(e.infected!.state, 'state after the hit').not.toBe('idle');
      expect(gap(e, courier), 'distance closed in 3 s (m)').toBeLessThan(before - 4);
    } finally { world.dispose(); }
  }, 120_000);
}

test('T-AGGRO-source @aggro only a human shooter provokes, and the memory lasts 12 s', async () => {
  const { world, id, e } = await shotFarAway('infected.runner');
  try {
    const other = world.infected!.spawn('infected.runner', { x: 0, z: 0 }, { state: 'idle' });
    hit(world, id, other);
    expect(e.infected!.provoked).toBeUndefined();
    hit(world, id, 1);
    expect(e.infected!.provoked?.until).toBe(world.tick + 12 * 60);
  } finally { world.dispose(); }
});
