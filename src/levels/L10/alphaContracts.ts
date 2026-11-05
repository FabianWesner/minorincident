import type { EntitySnapshot } from '../../sim/world/types';
import { cureRegions } from './mission';
export type CureRegion = typeof cureRegions[number]['id'];
/** Total authored regular Alphas across R3–R6; R7 is a concurrent assault cap. Mega uses a separate identity. */
export const cureAlphaCounts: Record<CureRegion, readonly [number, number]> = {
  'crash-outskirts': [0, 0], 'residential-fringe': [0, 0], 'industrial-area': [1, 1],
  'military-zone': [1, 2], 'research-campus': [1, 2], 'destroyed-corridor': [2, 3], 'dispersal-complex': [0, 3],
};
export function cureAlphaCap(region: CureRegion, tier: 'high' | 'low'): number {
  if (!(region in cureAlphaCounts)) throw new RangeError(`Unknown cure region: ${region}`);
  return region === 'dispersal-complex' && tier === 'low' ? 2 : cureAlphaCounts[region][1];
}
/** Entity records (including dead/off-region snapshots) retain the authored encounter ownership. */
export function cureRegularAlphaCount(entities: Iterable<EntitySnapshot>, region: CureRegion): number {
  let count = 0;
  for (const e of entities) if (e.archetype === 'infected.alpha' && !e.infected?.pursuit && e.infected?.variant !== 'inf.mega-alpha' && e.infected?.cureRegion === region &&
    (region !== 'dispersal-complex' || e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)) count++;
  return count;
}

/** Resident and serialized off-region records share the same authored quota. */
export function* cureAlphaPopulation(world: import('../../sim/world/SimWorld').SimWorld): IterableIterator<EntitySnapshot> {
  yield* world.entities.iterate();
  if (world.chunks) yield* world.chunks.inactiveEntities();
}
