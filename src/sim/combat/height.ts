import type { EntitySnapshot } from '../world/types';
import { survivor } from '../../data/survivor';

/** Feet/support level for combat, using each character controller's body-centre offset. */
export function combatLevel(entity: Pick<EntitySnapshot, 'transform' | 'survivor'> & Partial<Pick<EntitySnapshot, 'companion'>>): number {
  return entity.transform.y - (entity.survivor ? survivor.height / 2 : entity.companion ? .3 : .7);
}

/** Attacks may cross small lips, but cannot reach a separate floor above or below. */
export function combatHeightReachable(a: Parameters<typeof combatLevel>[0], b: Parameters<typeof combatLevel>[0], reach = .9): boolean {
  return Math.abs(combatLevel(a) - combatLevel(b)) <= reach;
}
