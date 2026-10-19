import { expect, test } from 'vitest';
import { l4 } from '../../../src/data/l4';
import { LevelFourWar } from '../../../src/sim/missions/LevelFourWar';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('T-E22-20-spawn-room @E22-AC20 counting retains the original character cap, reservations, hidden actors and persistent bodies', () => {
  const war = Object.create(LevelFourWar.prototype) as { spawnRoom(keep?: number): boolean };
  for (const tier of ['high', 'low'] as const) {
    const cap = l4.war.caps.characters[tier];
    for (let count = 0; count <= cap * 2; count += 7) {
      const entities = Array.from({ length: count }, (_, i) => ({ id: i, hidden: i % 7 === 0, health: { current: i % 5 ? 100 : 0 }, ...(i % 3 ? { civilian: {} } : { infected: {} }) })) as EntitySnapshot[];
      Object.assign(war, { mission: { world: { entities: { iterate: () => entities.values() }, infected: { director: { tier } } } } });
      for (const keep of [0, 1, 5, cap - 1, cap, cap + 1, -1, NaN, Infinity]) {
        expect(war.spawnRoom(keep)).toBe(entities.filter(e => !e.hidden && e.health.current > 0 && (e.infected || e.civilian)).length < cap - keep);
      }
    }
  }
});
