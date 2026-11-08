import type { EntitySnapshot } from '../world/types';
import { survivor } from '../../data/survivor';

/** Feet/support level for combat. Character transforms are body centres; infected and ordinary humans use a 0.7 m offset. */
export function combatLevel(entity: Pick<EntitySnapshot, 'transform' | 'survivor'> & Partial<Pick<EntitySnapshot, 'infected'>>): number {
  return entity.transform.y - (entity.survivor ? survivor.height / 2 : .7);
}

/** Attacks may cross small lips, but cannot reach a separate floor above or below. */
export function combatHeightReachable(a: Parameters<typeof combatLevel>[0], b: Parameters<typeof combatLevel>[0], reach = .9): boolean {
  return Math.abs(combatLevel(a) - combatLevel(b)) <= reach;
}
