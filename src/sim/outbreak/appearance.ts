import type { EntitySnapshot } from '../world/types';
import type { SpeedTier } from './types';

/**
 * The look of one pedestrian. It is created with the civilian and travels unchanged to the infected that the same
 * entity becomes (specs/epic-19 section 5.7): same asset, tint and accessories; only the carried hand prop drops.
 */
export interface Appearance {
  /** Entity that owns this look. A pooled infected record reused for another spawn gets a new id and loses it. */
  entityId: number;
  asset: string;
  /** Shirt tint (#rrggbb) applied to the clothing vertices of `asset`. */
  tint: string;
  accessories: string[];
  /** Carried prop; cleared when dropped (startle or bite). */
  handProp: string | null;
  tier: SpeedTier;
}

/** True for an infected (or turning pedestrian) that must render as its own former self, never as another model. */
export function keepsLook(e: EntitySnapshot): boolean {
  return e.appearance?.entityId === e.id;
}
