import { afterEach, expect, test, vi } from 'vitest';
import { runTen } from '../../../tools/sim-runner/l10';
import { LevelTenBot } from '../../../src/debug/bot/LevelTenBot';
import { emptyInput } from '../../../src/input/InputFrame';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

afterEach(() => vi.restoreAllMocks());

test('L10 runner advances the normal death delay and uses the respawned entity', () => {
  const dead = { health: { current: 0 }, transform: { x: 4000, z: -26 } };
  const alive = { health: { current: 100 }, transform: { x: 4000, z: -26 } };
  const entities = new Map([[1, dead]]);
  const mission = { state: { phase: 'playing', states: {}, steps: { mega: { status: 'active' } } }, def: { steps: [{ id: 'mega' }] } };
  const sample = vi.spyOn(LevelTenBot.prototype, 'sample').mockImplementation(() => {
    expect(entities.get(1)).toBe(world.tick === 0 ? dead : alive);
    return emptyInput();
  });
  const world = {
    tick: 0, missions: mission, entities, infected: { director: { count: 0 } }, megaPursuit: { state: { id: 3 } },
    applyInput: vi.fn(), update() {
      this.tick++;
      if (this.tick === 1) entities.set(1, alive);
      else { alive.transform.x++; mission.state.phase = 'result'; }
    },
  } as unknown as SimWorld;
  const result = runTen(world, 'complete', 2 / 60);
  expect(sample).toHaveBeenCalledTimes(2);
  expect(result.ticks).toBe(2);
  expect(result.regions.reduce((sum, region) => sum + region.metres, 0)).toBe(1);
});
