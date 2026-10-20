import type { Placement, StaticCollider } from '../districts/types';

/** Compound supports for the authored metro stair shaft: side/rear walls block,
 * treads carry feet. The old aggregate footprint filled the entire open shaft. The side plinths stand above the 1.2 m landing
 * (P0 10-20: flush with it, a courier pushed sideways off the landing walked along the plinth top past the shaft and was stranded). */
export function metroIngressColliders(p: Placement): StaticCollider[] {
  const boxes: { x0: number; x1: number; z0: number; z1: number; top: number; walkable: boolean }[] = [
    { x0: -2.4, x1: -.95, z0: -3.2, z1: 3.2, top: 2.4, walkable: false },
    { x0: .95, x1: 2.4, z0: -3.2, z1: 3.2, top: 2.4, walkable: false },
    { x0: -1.2, x1: 1.2, z0: -3.2, z1: -2.2, top: 1.2, walkable: false },
    { x0: -1.2, x1: 1.2, z0: 2.2, z1: 3.2, top: 1.2, walkable: true },
    { x0: -2, x1: 2, z0: 3.2, z1: 3.7, top: .8, walkable: true },
    { x0: -2, x1: 2, z0: 3.7, z1: 4.2, top: .4, walkable: true },
    { x0: -1.2, x1: 1.2, z0: 2.94, z1: 3.2, top: 1.265, walkable: true },
  ];
  for (let i = 0; i < 8; i++) boxes.push({ x0: -1.2, x1: 1.2, z0: 2.2 - .55 * (i + 1), z1: 2.2 - .55 * i, top: 1.2 - 1.05 * (i + 1) / 8, walkable: true });
  return boxes.map((b, i) => ({ id: `${p.id}/ingress-${i}`, aabb: { min: [p.position[0] + b.x0, 0, p.position[2] + b.z0], max: [p.position[0] + b.x1, b.top, p.position[2] + b.z1] }, walkable: b.walkable, minTier: p.minTier, maxTier: p.maxTier }));
}
