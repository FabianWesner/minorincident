// List the L5 colliders within a margin of a point: npx tsx tools/l5/at.ts x z [margin]
import { readFileSync } from 'node:fs';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { levelFiveLayouts } from '../../src/levels/L5/layout';

const base = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
const [layout] = levelFiveLayouts([base]);
const x = Number(process.argv[2]), z = Number(process.argv[3]), m = Number(process.argv[4] ?? 0.9);
for (const c of placementColliders(layout.placements, layout.colliders)) {
  if (c.walkable) continue;
  const a = c.aabb;
  if (x >= a.min[0] - m && x <= a.max[0] + m && z >= a.min[2] - m && z <= a.max[2] + m) console.log(c.id, 'x', a.min[0].toFixed(2), a.max[0].toFixed(2), 'z', a.min[2].toFixed(2), a.max[2].toFixed(2), 'h', a.max[1].toFixed(2));
}
