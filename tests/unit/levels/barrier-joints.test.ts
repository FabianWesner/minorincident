import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { levelThreeLayouts } from '../../../src/levels/L3/layout';
import { compositions } from '../../../src/levels/compositions';

test('continuous fence chains close their nominal-versus-physical panel seams to at most 2 cm', () => {
  const layouts = levelThreeLayouts([JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8'))]);
  const original = layouts[0].placements.filter(p => p.id.startsWith('l3-outskirts-fence--45.6-')).sort((a, b) => a.position[0] - b.position[0]);
  const district = new DistrictWorld(compositions.L3, layouts, 1).districts[0];
  const drawn = new Map(district.decay.placements.map(p => [p.id, p]));
  expect(original.length).toBeGreaterThan(10);
  for (let i = 1; i < original.length; i++) {
    const a = drawn.get(original[i - 1].id)!, b = drawn.get(original[i].id)!;
    expect(b.position[0] - a.position[0] - (a.scale[2] + b.scale[2]) * 1.28).toBeLessThanOrEqual(.02);
  }
  // Assembly must not accumulate stretching into the authored/cached layout on a second load.
  const second = new DistrictWorld(compositions.L3, layouts, 1).districts[0];
  expect(second.decay.placements.map(p => p.scale)).toEqual(district.decay.placements.map(p => p.scale));
  expect(layouts[0].placements.find(p => p.id === original[0].id)!.scale).toEqual(original[0].scale);
});

test('all shipped district privacy-fence chains meet the same 2 cm joint limit', () => {
  const ids = ['D-GROVE', 'D-CORRIDOR', 'D-FAIR', 'D-RES', 'D-MAIN', 'D-SHOP', 'D-SCHOOL', 'D-CIVIC', 'D-PARK', 'D-ZOO', 'D-EDGE', 'D-CROSSING', 'D-CURE'] as const;
  let joints = 0;
  for (const id of ids) {
    const layout = JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8'));
    const gameplay = { id, playerStart: { anchor: 'player-start' }, spawns: [], spawnVolumes: [], triggers: [], objectives: [], interactables: [], civilianRoutes: [], safePoints: [], photoSpots: [], decay: [] };
    const world = new DistrictWorld({ id: 'joint-audit', tier: 0, timeOfDay: 'L1', districts: [{ id, origin: [0, 0], gameplay }] }, [layout], 1);
    const before = layout.placements.filter((p: { assetId: string }) => p.assetId === 'prop.privacy-fence') as import('../../../src/levels/districts/types').Placement[];
    const after = new Map(world.districts[0].layout.placements.map(p => [p.id, p]));
    for (let i = 0; i < before.length; i++) for (let j = i + 1; j < before.length; j++) {
      const a = before[i], b = before[j];
      if (Math.abs(a.yaw - b.yaw) > .001 || Math.abs(a.position[1] - b.position[1]) > .02) continue;
      const dx = b.position[0] - a.position[0], dz = b.position[2] - a.position[2];
      if (Math.abs(dx * Math.cos(a.yaw) + dz * Math.sin(a.yaw)) > .01) continue;
      const distance = Math.hypot(dx, dz), gap = distance - (a.scale[2] + b.scale[2]) * 1.28;
      if (gap <= .02 || gap > .16 || a.maxTier < b.minTier || b.maxTier < a.minTier) continue;
      joints++;
      expect(Math.hypot(after.get(b.id)!.position[0] - after.get(a.id)!.position[0], after.get(b.id)!.position[2] - after.get(a.id)!.position[2]) - (after.get(a.id)!.scale[2] + after.get(b.id)!.scale[2]) * 1.28, `${id}: ${a.id}/${b.id}`).toBeLessThanOrEqual(.02);
    }
  }
  expect(joints).toBeGreaterThan(100);
});

test('closing a fence joint preserves the deliberate gate at its opposite end', () => {
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8'));
  const fence = (id: string, z: number) => ({ id, assetId: 'prop.privacy-fence', position: [0, 0, z], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [-.14, 0, z - 1.3], max: [.14, 1.8, z + 1.3] } });
  layout.placements = [fence('a', 0), fence('b', 2.6), fence('c', -3.56)]; layout.colliders = [];
  const id = 'D-GROVE', gameplay = { id, playerStart: { anchor: 'player-start' }, spawns: [], spawnVolumes: [], triggers: [], objectives: [], interactables: [], civilianRoutes: [], safePoints: [], photoSpots: [], decay: [] } as const;
  const world = new DistrictWorld({ id: 'joint-gate-audit', tier: 0, timeOfDay: 'L1', districts: [{ id, origin: [0, 0], gameplay: { ...gameplay, spawns: [], spawnVolumes: [], triggers: [], objectives: [], interactables: [], civilianRoutes: [], safePoints: [], photoSpots: [], decay: [] } }] }, [layout], 1);
  const walls = new Map(placementColliders(world.districts[0].decay.placements, []).map(c => [c.id.split('/')[0], c.aabb]));
  expect(walls.get('b')!.min[2] - walls.get('a')!.max[2]).toBeLessThanOrEqual(.02);
  expect(walls.get('a')!.min[2] - walls.get('c')!.max[2]).toBeCloseTo(1, 6);
});
