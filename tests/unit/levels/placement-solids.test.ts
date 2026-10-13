import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { levelFourLayouts } from '../../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../../src/levels/L5/layout';
import { levelTwoLayouts } from '../../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../../src/levels/L3/layout';
import { solidOverlaps } from '../../../src/levels/placementClearance';
import type { DistrictLayout, Placement } from '../../../src/levels/districts/types';

/**
 * General placement validator (PO 10-13 L4 "collision": a light tower through a privacy fence corner). Every placed prop with
 * a footprint (equipment, crates, sandbags, barriers, furniture, kits, decay pieces; vehicles have their own gate in
 * layout-overlap.test.ts) against every solid collider of another placement or the level, in every level L1-L9 and tier W0-W6.
 * Foliage and fence runs are excluded as the moving piece (crowns and hedges stand in beds, runs share posts by design).
 * 2026-10-13: 198 offender pairs; the free-standing equipment nudge (placementClearance `freestanding`) fixed the light towers
 * (195 left). The remaining pairs are the backlog in placement-solids.baseline.json; a new one fails. Report:
 * test-results/placement-offenders.json.
 */
const load = (f: string) => JSON.parse(readFileSync(`public/assets/layouts/${f}`, 'utf8')) as DistrictLayout;
const moving = (p: Placement) => /^(prop|kit|decay|haz)\./.test(p.assetId) && !/^prop\.(tree|street-tree|bush|garden-bush|hedge|flower|grass|privacy-fence|picket-fence)/.test(p.assetId);
const baselinePath = 'tests/unit/levels/placement-solids.baseline.json';
const baseline = new Set<string>(existsSync(baselinePath) ? (JSON.parse(readFileSync(baselinePath, 'utf8')) as { pairs: string[] }).pairs : []);

test('@E21 no placed prop cuts into a solid, L1-L9, every tier (new offenders only; backlog in the baseline)', () => {
  const found: string[] = [];
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9']) {
    const c = compositions[level]; if (!c) continue;
    const base = c.districts.map(d => load(`${d.id}.layout.json`));
    const layouts = level === 'L2' ? levelTwoLayouts(base) : level === 'L3' ? levelThreeLayouts(base) : level === 'L4' ? levelFourLayouts(base) : level === 'L5' ? levelFiveLayouts(base) : base;
    for (const layout of layouts) for (const tier of [0, 1, 2, 3, 4, 5, 6] as const)
      for (const o of solidOverlaps(layout, tier, moving)) found.push(`${level} ${layout.district}: ${o.placement} (${o.assetId}) x ${o.collider}`);
  }
  const unique = [...new Set(found)].sort();
  writeFileSync('test-results/placement-offenders.json', JSON.stringify({ count: unique.length, pairs: unique }, null, 1));
  if (process.env.UPDATE_PLACEMENT_BASELINE === '1') writeFileSync(baselinePath, JSON.stringify({ note: 'Known prop-vs-solid placement pairs on 2026-10-13 (qa-low-tier): layout backlog. Remove entries as they are fixed; never add one to pass a new placement.', pairs: unique }, null, 1));
  expect(unique.filter(p => !baseline.has(p))).toEqual([]);
}, 300_000);
