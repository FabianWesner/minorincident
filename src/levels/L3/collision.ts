import { l3 } from '../../data/l3';
import type { CoverWall } from '../../sim/combat/HitQuery';

/** Army base collision registry: infected have no admission to the compound.
 * The central lane ends at the boom; the flanks end at the concrete wall line.
 * These filled footprints close guard-hut gaps and prevent routing around the perimeter.
 * Humans and the corgi use the ordinary geometry grid and enter through the raised boom.
 */
export const l3BaseCollision: readonly CoverWall[] = [
  { x: (l3.finale.barrierX + 248) / 2, z: 0, y: 1.7, halfX: (248 - l3.finale.barrierX) / 2, halfZ: 45.6, halfY: 1.7, navBlocker: true },
  ...[-1, 1].map(side => ({ x: 230, z: side * 25, y: 1.7, halfX: 18, halfZ: 20.6, halfY: 1.7, navBlocker: true })),
];
