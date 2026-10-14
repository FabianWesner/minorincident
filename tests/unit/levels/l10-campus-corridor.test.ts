import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { cure, cureThreatAtDepth } from '../../../src/levels/L10/district';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout } from '../../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
test('T-E32-03-D3 @E32-AC03 @E32-AC15 @E32-AC28 campus and corridor story anchors and full route are walkable', () => {
  const world = new DistrictWorld(compositions.L10, [layout], 32);
  for (const region of cure.regions.slice(4)) for (let i = 1; i < region.route.length; i++) {
    const a = region.route[i - 1], b = region.route[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= d; t++) expect(world.nav.walkable([a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d]), region.id).toBe(true);
  }
  for (const name of ['cure-research-entry', 'cure-terminal', 'cure-canister', 'cure-research', 'cure-corridor', 'rocket-pickup', 'cure-complex']) {
    const [x, , z] = layout.anchors[name].position;
    expect(world.nav.walkable([x, z]), name).toBe(true);
    expect([x,z]).toEqual(cure.anchors[name]);
  }
  expect(cure.anchors['rocket-pickup']).toEqual(cure.anchors['cure-corridor']);
  expect(world.nav.walkable(cure.anchors['corridor-blocked-road'])).toBe(false);
  for (const id of ['bld.cure-lab-main','bld.cure-lab-annex','prop.cure-iso-tent','prop.cure-generator','veh.ambulance','prop.cure-quarantine-fence','prop.cure-canister-pedestal','kit.dispersal-console']) expect(layout.placements.some(p => p.assetId === id), id).toBe(true);
});
test('T-E32-06-D3 @E32-AC06 regional threat is authored by route depth with shared-cap headroom', () => {
  expect(cure.threatDepth.map(r => r.routeEnd)).toEqual([250,850,1600,2400,2950,3950,4300]);
  expect(cureThreatAtDepth(2400).resident).toEqual({ high: [55,85], low: [35,55] });
  expect(cureThreatAtDepth(2950).resident).toEqual({ high: [80,130], low: [50,75] });
  expect(cureThreatAtDepth(2950).alphas).toEqual([2,3]);
  expect(cureThreatAtDepth(2950).dogs).toEqual([3,5]);
  expect(cureThreatAtDepth(2950).groupSize).toEqual([20,35]);
  for (const row of cure.threatDepth) {
    expect(row.resident.high[1]).toBeLessThanOrEqual(200);
    expect(row.resident.low[1]).toBeLessThanOrEqual(100);
    expect('weapon' in row).toBe(false);
  }
});
test('T-E32-15-D3 @E32-AC15 terminal operator socket faces the reachable interaction anchor', () => {
  const terminal = layout.placements.find(p => p.assetId === 'kit.dispersal-console')!;
  const [x, , z] = layout.anchors['cure-terminal'].position;
  // The retained console's operator socket is one metre along local +X.
  const operatorX = terminal.position[0] + Math.cos(terminal.yaw);
  const operatorZ = terminal.position[2] - Math.sin(terminal.yaw);
  expect(Math.hypot(x - operatorX, z - operatorZ)).toBeLessThanOrEqual(.6);
});
