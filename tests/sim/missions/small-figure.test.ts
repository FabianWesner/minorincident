import { expect, test } from 'vitest';
import { loadL2 } from '../../../tools/sim-runner/l2Bots';

test('L2 seed 1 protected children keep child models in sim and appearance at both quality tiers @E08 @E20', async () => {
  for (const tier of ['high', 'low'] as const) {
    const { world } = await loadL2(1, tier);
    try {
      const children = [...world.entities.iterate()].filter(e => e.civilian?.adult === false && !e.civilian.pet);
      expect(children).toHaveLength(2);
      for (const child of children) {
        expect(child.archetype).toBe('npc.child');
        expect(child.civilian?.model).toBe('npc.civilian-kid');
        expect(child.appearance?.asset).toBe('npc.civilian-kid');
      }
    } finally { world.dispose(); }
  }
});
