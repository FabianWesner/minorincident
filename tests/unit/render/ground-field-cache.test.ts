import { expect, test } from 'vitest';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Raycaster, Vector3 } from 'three/webgpu';
import { GroundField } from '../../../src/render/GroundField';

test('drawn ground samples remain exact and mesh additions invalidate previous heights and misses', () => {
  const field = new GroundField(), material = new MeshBasicNodeMaterial();
  const plane = (height: number, x = 0) => {
    const mesh = new Mesh(new PlaneGeometry(4, 4).rotateX(-Math.PI / 2), material);
    mesh.position.set(x, height, 0); mesh.updateMatrixWorld(true); return mesh;
  };
  const low = plane(.05), high = plane(.2), distant = plane(.1, 20), slope = plane(.23);
  slope.rotation.z = .08; slope.updateMatrixWorld(true);
  try {
    field.add(low);
    for (let i = 0; i < 10; i++) expect(field.height(.5, .25)).toBeCloseTo(.05, 12);
    expect(field.height(20, 0)).toBeNull();
    field.add(high); field.add(distant);
    expect(field.height(.5, .25)).toBeCloseTo(.2, 12);
    expect(field.height(20, 0)).toBeCloseTo(.1, 12);
    // Walking coordinates keep exact surface interpolation without
    // retaining a route history.
    for (let i = 0; i < 1000; i++) field.height(i / 1000, .25);
    expect(field.height(.5, .25)).toBeCloseTo(.2, 12);
    field.add(slope);
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    for (let x = -1.9; x < 1.9; x += .17) for (const z of [-.75, 0, .75]) {
      ray.ray.origin.set(x, 1, z);
      const hit = ray.intersectObjects([low, high, slope], false)[0];
      expect(field.height(x, z)).toBeCloseTo(hit.point.y, 11);
    }
  } finally { low.geometry.dispose(); high.geometry.dispose(); distant.geometry.dispose(); slope.geometry.dispose(); material.dispose(); }
});
