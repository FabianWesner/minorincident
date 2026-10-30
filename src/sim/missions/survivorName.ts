import { l5Survivors } from '../../data/l5';
import type { EntitySnapshot } from '../world/types';

/** One identity label across the objective, wait line and minimap, including campaign handovers. */
export function survivorName(entity: EntitySnapshot): string {
  if (entity.companion) return 'Corgi';
  const survivor = entity.civilian?.survivor, model = entity.civilian?.model ?? entity.appearance?.asset;
  const known = l5Survivors.find(s => s.key === survivor?.key || s.model === model);
  if (known) return known.name;
  if (survivor?.key === 'shelter-0' || model === 'npc.marcus.aftermath') return 'Marcus';
  // Shelter keys survive roster compaction; slots can change at the next level.
  const shelter = /^shelter-(\d+)$/.exec(survivor?.key ?? '');
  return `Person ${shelter ? Number(shelter[1]) + 1 : survivor && survivor.slot >= 0 ? survivor.slot + 1 : entity.id}`;
}
