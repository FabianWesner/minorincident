/** Distance LOD policy for world assets (buildings, props, vehicles, interactables).
 * At the maximum zoom (camera radius 19 m x 1.45, x1.15 while driving) everything inside the view lies
 * within ~30 m of the camera target; LOD0 covers that plus about one screen of margin, so the play
 * view never shows a decimated LOD on the high tier. Hysteresis keeps a band until the distance is
 * clearly past the boundary, so assets near a boundary do not pop back and forth. */
export type Lod = 'lod0' | 'lod1' | 'lod2';
export const lodPolicy = { lod1From: 45, lod2From: 90, hysteresis: 4 } as const;
/** Low tier (phones) keeps its measured budget: LOD1 near, LOD2 beyond 16 m (props always LOD2). */
export const lowLodPolicy = { lod1From: 0, lod2From: 16, hysteresis: 2 } as const;
const rank: Record<Lod, number> = { lod0: 0, lod1: 1, lod2: 2 };
const bands: Lod[] = ['lod0', 'lod1', 'lod2'];
export function pickLod(distance: number, previous?: Lod, policy: { lod1From: number; lod2From: number; hysteresis: number } = lodPolicy): Lod {
  const target: Lod = distance > policy.lod2From ? 'lod2' : distance > policy.lod1From ? 'lod1' : 'lod0';
  if (!previous || previous === target) return target;
  // Only leave the previous band once the distance is past its boundary by the hysteresis margin.
  const edges = [policy.lod1From, policy.lod2From];
  if (rank[target] > rank[previous]) return distance > edges[rank[target] - 1] + policy.hysteresis ? target : bands[rank[target] - 1] === previous ? previous : target;
  return distance < edges[rank[target]] - policy.hysteresis ? target : bands[rank[target] + 1] === previous ? previous : target;
}
/** Individually loaded models (vehicles, entity assets, interactables). Low tier keeps LOD1/LOD2 at 30 m. */
export function modelLod(distance: number, previous: string | undefined, low: boolean): Lod {
  if (low) return distance > 30 ? 'lod2' : 'lod1';
  return pickLod(distance, previous === 'lod0' || previous === 'lod1' || previous === 'lod2' ? previous : undefined);
}
