import { readFileSync } from 'node:fs';
import { solidOverlaps } from '../../src/levels/placementClearance';
import type { DistrictLayout, Placement } from '../../src/levels/districts/types';
/** look-l10: placement-vs-solid pairs of D-CURE layouts (same rule as tests/unit/levels/placement-solids.test.ts, vehicles included). */
const moving = (p: Placement) => /^(prop|kit|decay|haz|veh)\./.test(p.assetId) && !/^prop\.(tree|street-tree|bush|garden-bush|hedge|flower|grass|privacy-fence|picket-fence)/.test(p.assetId);
for (const f of process.argv.slice(2)) {
  const l = JSON.parse(readFileSync(f, 'utf8')) as DistrictLayout;
  const all = new Set<string>();
  for (const t of [0, 6] as const) for (const o of solidOverlaps(l, t, moving)) all.add(`${o.placement} x ${o.collider}`);
  console.log(f, all.size, JSON.stringify([...all].slice(0, 20)));
}
