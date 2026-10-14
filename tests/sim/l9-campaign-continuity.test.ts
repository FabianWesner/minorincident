import { expect, test } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { emptyAftermath } from '../../src/levels/continuity';
import { LevelTwoBot } from '../../src/debug/bot/LevelTwoBot';

test('T-E31-20-L1-prop @E31-AC20 @E20-AC04 L1 carried bin cannot strand the seated L2 truck on its station apron', async () => {
  const save = preset('L2-default'), aftermath = emptyAftermath();
  aftermath.props = [{ id: 'D-GROVE/prop.trash-bin:1291', p: [-68.2162, 0, 42.2979], q: [0, .7071, 0, .7071] }];
  save.world = { L1: aftermath };
  const w = await loadLevel('L2', 1, save);
  try {
    expect(w.props!.items.some(p => p.id === aftermath.props[0].id)).toBe(false);
    const bot = new LevelTwoBot(w);
    for (let i = 0; i < 90 * 60 && !w.missions!.state.l2!.arrivedAt; i++) { w.applyInput(bot.sample(), 'keyboard'); w.update(); }
    expect(w.missions!.state.l2!.arrivedAt).toBeGreaterThan(0);
    expect(w.missions!.state.l2!.seated).toBe(false);
  } finally { w.dispose(); }
});
