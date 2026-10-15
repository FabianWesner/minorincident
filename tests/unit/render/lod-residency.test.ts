import { expect, test, vi } from 'vitest';
import { GameView } from '../../../src/render/GameView';
import { loadGate } from '../../../src/assets/loadGate';

test('T-E32-28-residency @E32-AC28 production L10 tier swaps use the load gate from the first playable frame', async () => {
  const wait = vi.spyOn(loadGate, 'wait').mockResolvedValue();
  const view = Object.assign(Object.create(GameView.prototype) as GameView, {
    params: new URLSearchParams(), playSeconds: 0, world: { scenario: 'L10' },
  });
  const swapping = (view as unknown as { swapSlot(): Promise<void> }).swapSlot();
  // A four-second startup timer here defeats the two-second movement prefetch.
  // Assert admission before awaiting, so a regression fails without a long timeout.
  expect(wait).toHaveBeenCalledOnce();
  await swapping;
});
