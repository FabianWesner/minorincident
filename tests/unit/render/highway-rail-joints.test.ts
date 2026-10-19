import { expect, test } from 'vitest';
import { Box3, Group, Mesh, MeshBasicMaterial } from 'three';
import { addHighwayRailJoints } from '../../../src/assets/highwayRailJoints';
import { highwayColliders } from '../../../src/levels/L3/highway';
import type { Placement } from '../../../src/levels/districts/types';

test('integral ramp joins draw the same solid bounds at every quality LOD', () => {
  for (const lod of ['lod0', 'lod1', 'lod2']) {
    const root = new Group(), material = new MeshBasicMaterial();
    const geometries = addHighwayRailJoints(root, material);
    expect(geometries).toHaveLength(2);
    expect(addHighwayRailJoints(root, material)).toHaveLength(0);
    const p = { id: lod, position: [0, 0, 0], yaw: 0, minTier: 0, maxTier: 5 } as Placement;
    const colliders = highwayColliders(p).filter(c => c.id.includes('/highway-joint-'));
    for (const c of colliders) {
      const mesh = root.getObjectByName(c.id.split('/')[1]) as Mesh;
      const box = new Box3().setFromObject(mesh);
      for (let axis = 0; axis < 3; axis++) {
        expect(box.min.getComponent(axis)).toBeCloseTo(c.aabb.min[axis], 5);
        expect(box.max.getComponent(axis)).toBeCloseTo(c.aabb.max[axis], 5);
      }
    }
    for (const geometry of geometries) geometry.dispose(); material.dispose();
  }
});
