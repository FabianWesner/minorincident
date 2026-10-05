import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import { districtIds, type DistrictLayout } from '../../../src/levels/districts/types';
import { validateLayout, minimapData, resolveDecay } from '../../../src/levels/districts/validate';
const layouts = districtIds.map((id) => JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout);

test('T-E10-01 @E10 @E10-AC01 closed bounds, connected roads, manifest references and lane exclusion', () => {
  for (const layout of layouts) expect(validateLayout(layout, manifest), layout.district).toEqual([]);
  const bad = structuredClone(layouts[0]); bad.bounds.pop(); bad.placements[0].assetId = 'missing'; bad.placements[0].position = [0,0,0]; bad.placements[0].visualAabb = { min: [-1,0,-1], max: [1,1,1] }; bad.roads.edges = bad.roads.edges.filter((e) => e.end !== 'north');
  const errors = validateLayout(bad, manifest);
  for (const text of ['bounds', 'road graph', 'asset', 'lane']) expect(errors.join(' ')).toContain(text);
});
test('T-E10-03 @E10 @E10-AC03 cumulative decay grows wrecks, removes base nodes and disables lights monotonically', () => {
  for (const layout of layouts) {
    const states = ([0,1,2,3,4,5] as const).map((tier) => resolveDecay(layout, tier));
    for (let t = 1; t < 6; t++) {
      expect(states[t].placements.length).toBeGreaterThan(states[t-1].placements.length);
      expect(states[t].placements.filter((p) => p.assetId === 'veh.wreck').length).toBeGreaterThan(states[t-1].placements.filter((p) => p.assetId === 'veh.wreck').length);
      expect(states[t].lights.length).toBeLessThanOrEqual(states[t-1].lights.length);
    }
    expect(states[0].lights).toHaveLength(4); expect(states[3].lights).toHaveLength(2); expect(states[5].lights).toHaveLength(0);
    expect(states[5].removed).toContain('collapse-canopy');
  }
});
test('T-E10-07 @E10 @E10-AC07 every building/heavy prop collider matches transformed manifest AABB within 10%', () => {
  for (const layout of layouts) for (const p of layout.placements) {
    const def = manifest[p.assetId as keyof typeof manifest];
    if (!def.solid) continue;
    const c = layout.colliders.find((c) => c.id === p.id)!; expect(c).toBeDefined();
    const sx = Math.abs(Math.cos(p.yaw)) * def.dimensions.x * p.scale[0] + Math.abs(Math.sin(p.yaw)) * def.dimensions.z * p.scale[2];
    const sz = Math.abs(Math.sin(p.yaw)) * def.dimensions.x * p.scale[0] + Math.abs(Math.cos(p.yaw)) * def.dimensions.z * p.scale[2];
    for (const [axis, extent] of [[0,sx],[2,sz]]) {
      expect(Math.abs(c.aabb.max[axis] - c.aabb.min[axis] - extent) / extent).toBeLessThanOrEqual(.1);
      expect(Math.abs((c.aabb.max[axis]+c.aabb.min[axis])/2 - p.position[axis])).toBeLessThanOrEqual(extent*.1);
    }
  }
});
test('T-E10-10 @E10 @E10-AC10 vector minimap preserves 3D road centerlines within one metre', () => {
  for (const layout of layouts) {
    const map = minimapData(layout);
    expect(map.buildings).toHaveLength(layout.buildings.length);
    map.roads.forEach((road, i) => road.forEach((point,j) => expect(Math.hypot(point[0]-layout.roads.edges[i].points[j][0],point[1]-layout.roads.edges[i].points[j][1])).toBeLessThanOrEqual(1)));
  }
});
