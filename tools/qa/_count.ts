import { readFileSync } from 'node:fs';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout } from '../../src/levels/districts/types';
for (const f of process.argv.slice(2)) {
  const l = JSON.parse(readFileSync(f, 'utf8')) as DistrictLayout;
  const cs = placementColliders(l.placements, l.colliders).filter(c => !c.walkable);
  const by: Record<string, number> = {};
  for (const c of cs) { const k = c.id.split(':')[0]; by[k] = (by[k] ?? 0) + 1; }
  console.log(f, cs.length, JSON.stringify(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 25)));
}
