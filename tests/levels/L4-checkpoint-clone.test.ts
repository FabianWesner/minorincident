import { expect, test } from 'vitest';
import { cloneData } from '../../src/core/clone';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';
import { sameClone } from '../fixtures/sameClone';

test('T-E22-20-clone-l4 @E22-AC20 L4 turn and line-break checkpoints equal the structuredClone snapshot, sharing included', async () => {
  const { world, mission } = await loadL4(2, 'low');
  try {
    const checked: string[] = [];
    world.events.on('checkpoint.set', event => {
      if (event.type !== 'checkpoint.set') return;
      const live = world.entities.values(), saved = (mission as unknown as { checkpoints: Map<string, { entities: unknown }> }).checkpoints.get(event.id)!.entities;
      expect(sameClone(live, cloneData(live), world.query({})), event.id).toBe(true);
      expect(sameClone(live, saved, world.query({})), event.id).toBe(true);
      checked.push(event.id);
    });
    runL4(world, mission, 'complete', { seed: 2, god: true, maxSeconds: 400, stopWhen: m => m.state.l4!.lineBreakAt > 0 && world.tick > m.state.l4!.lineBreakAt + 2 });
    expect(checked).toEqual(expect.arrayContaining(['turn', 'line-break']));
  } finally { world.dispose(); }
}, 300_000);
