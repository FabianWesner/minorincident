/** fix65-a: print runtime static colliders (placementColliders, as DistrictWorld builds them) inside a box. */
import { readFileSync } from 'node:fs';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import { levelOneLayouts } from '../../src/levels/L1/layout';
import { levelThreeLayouts } from '../../src/levels/L3/layout';
import type { DistrictLayout } from '../../src/levels/districts/types';
const [district, x0, z0, x1, z1, filter = ''] = process.argv.slice(2);
let layout = JSON.parse(readFileSync(`public/assets/layouts/${district}.layout.json`, 'utf8')) as DistrictLayout;
if (district === 'D-GROVE') layout = levelOneLayouts([layout])[0];
if (district === 'D-CORRIDOR') layout = levelThreeLayouts([layout])[0];
const r = (v: number) => Math.round(v * 100) / 100;
for (const c of placementColliders(layout.placements, layout.colliders)) {
  const { min, max } = c.aabb;
  if (max[0] < +x0 || min[0] > +x1 || max[2] < +z0 || min[2] > +z1 || !c.id.includes(filter)) continue;
  if ((c.minTier ?? 0) > 0) continue;
  if (process.env.JSON) console.log(JSON.stringify({ id: c.id, aabb: c.aabb, walkable: !!c.walkable }));
  else console.log(c.id, min.map(r).join(','), '->', max.map(r).join(','), c.walkable ? 'walk' : '');
}
