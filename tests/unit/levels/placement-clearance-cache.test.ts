import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { FootprintIndex, findClearSpot, firstOverlap, footprints, resolveOverlaps } from '../../../src/levels/placementClearance';
import type { DistrictLayout, Placement, Tier } from '../../../src/levels/districts/types';

/** Original loop recomputes every obstacle after each move. This reference
 * guards order and updated geometry, including candidates moved earlier. */
function uncached(layout: DistrictLayout, tier: Tier, movable: (p: Placement) => boolean): string[] {
  const live = layout.placements.filter(p => p.minTier <= tier && p.maxTier >= tier), moved: string[] = [];
  for (const p of live) {
    if (!movable(p) || !footprints(p, 0, true).length) continue;
    const others = live.filter(q => q.id !== p.id).flatMap(q => footprints(q));
    if (firstOverlap(p, others) === undefined) continue;
    const spot = findClearSpot(layout, p, others, { slide: p.assetId.startsWith('veh.'), maxRadius: 6 });
    if (!spot) continue;
    const dx = spot[0] - p.position[0], dz = spot[1] - p.position[2];
    p.position = [spot[0], p.position[1], spot[1]];
    p.visualAabb = { min: [p.visualAabb.min[0] + dx, p.visualAabb.min[1], p.visualAabb.min[2] + dz], max: [p.visualAabb.max[0] + dx, p.visualAabb.max[1], p.visualAabb.max[2] + dz] };
    moved.push(p.id);
  }
  return moved;
}
for (const district of ['D-GROVE', 'D-CORRIDOR']) test(`${district}: footprint reuse preserves sequential overlap resolution`, () => {
  const input = JSON.parse(readFileSync(`public/assets/layouts/${district}.layout.json`, 'utf8')) as DistrictLayout;
  const source = input.placements.find(p => (district === 'D-GROVE' ? p.assetId.startsWith('veh.') : p.assetId === 'prop.fire-hydrant') && p.minTier <= 1 && p.maxTier >= 1)!;
  expect(source).toBeDefined();
  for (let i = 0; i < 4; i++) input.placements.push({ ...structuredClone(source), id: `cache-test:${i}` });
  const a = structuredClone(input), b = structuredClone(input), movable = (p: Placement) => p.id.startsWith('cache-test:');
  const expected = uncached(a, 1, movable), actual = resolveOverlaps(b, 1, movable);
  expect(actual).toEqual(expected); expect(b).toEqual(a); expect(actual.length).toBeGreaterThan(1);
});

test('append-only dressing index returns the same nearest spots as a fresh index', () => {
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
  const source = layout.placements.find(p => p.assetId.startsWith('veh.') && p.minTier <= 1 && p.maxTier >= 1)!;
  const obstacles = layout.placements.filter(p => p.minTier <= 1 && p.maxTier >= 1).flatMap(p => footprints(p));
  const index = new FootprintIndex(obstacles);
  for (let i = 0; i < 4; i++) {
    const p = { ...structuredClone(source), id: `indexed:${i}` };
    const expected = findClearSpot(layout, p, obstacles, { slide: true, maxRadius: 6 });
    expect(findClearSpot(layout, p, obstacles, { slide: true, maxRadius: 6, index })).toEqual(expected);
    expect(expected).toBeDefined(); p.position = [expected![0], p.position[1], expected![1]];
    const added = footprints(p, 0, true); obstacles.push(...added); index.add(added);
  }
});
