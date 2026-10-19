import { readFileSync } from 'node:fs';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout } from '../../src/levels/districts/types';
/** Temporary look-l10 probe: colliders within r metres of x,z. */
const [x, z, r] = process.argv.slice(2).map(Number);
const l = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
for (const c of placementColliders(l.placements, l.colliders)) {
  const d = Math.hypot(Math.max(c.aabb.min[0] - x, 0, x - c.aabb.max[0]), Math.max(c.aabb.min[2] - z, 0, z - c.aabb.max[2]));
  if (d < r) console.log(c.id, d.toFixed(2), JSON.stringify(c.aabb), c.walkable ?? '');
}
