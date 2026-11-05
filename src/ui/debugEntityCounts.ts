import type { EntitySnapshot } from '../sim/world/types';

/** Recoverable zero-HP bodies are downed, even though their animation state is named 'dead'. */
export function debugEntityCounts(entities: readonly EntitySnapshot[]) {
  return {
    pedestrians: entities.filter(e => e.civilian && e.health.current > 0 && !e.infected).length,
    alive: entities.filter(e => e.infected && e.health.current > 0 && e.infected.recoverAt < 0).length,
    downed: entities.filter(e => e.infected && e.health.current <= 0 && e.infected.recoverAt >= 0 && !e.corpse).length,
    corpses: entities.filter(e => e.corpse || e.infected && e.health.current <= 0 && e.infected.recoverAt < 0).length,
  };
}
