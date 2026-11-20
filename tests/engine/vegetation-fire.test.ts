import { expect, test } from 'vitest';
import { VegetationFire } from '../../src/sim/interact/VegetationFire';
import type { Placement } from '../../src/levels/districts/types';

const placement = (id: string, assetId: string, x: number) => ({ id, assetId, position: [x, 0, 0] }) as Placement;

test('vegetation burns for ten seconds, chars, and excludes buildings', () => {
  const fire = new VegetationFire([placement('tree', 'prop.tree', 0), placement('house', 'bld.house', 0)]);
  fire.ignite({ x: 0, z: 0 }, 10, 2);
  expect(fire.objects).toHaveLength(1);
  expect(fire.objects[0].state).toBe('burning');
  fire.update(609); expect(fire.objects[0].state).toBe('burning');
  fire.update(610); expect(fire.objects[0].state).toBe('charred');
});
