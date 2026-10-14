import { expect, test } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Raycaster, Vector3 } from 'three/webgpu';
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


test('triangle bounds preserve barycentric edge extrapolation, including two negative weights', () => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([.1, .05, .1, 1.8, .2, .2, .5, .1, 1.7], 3));
  const material = new MeshBasicNodeMaterial(), mesh = new Mesh(geometry, material);
  const corners = [0, 1, 2].map(i => new Vector3().fromBufferAttribute(geometry.getAttribute('position'), i));
  try {
    for (const offset of [-1000, 0, 1000]) {
      mesh.position.x = offset; mesh.updateMatrixWorld(true);
      const field = new GroundField(); field.add(mesh);
      const [a, b, c] = corners.map(p => p.clone().applyMatrix4(mesh.matrixWorld));
      const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      const weights = [-1.00001e-6, -.99999e-6, 0, .2, 1, 1 + 1.99999e-6, 1 + 2.00001e-6];
      for (const u0 of weights) for (const v0 of weights) {
        const x = u0 * a.x + v0 * b.x + (1 - u0 - v0) * c.x;
        const z = u0 * a.z + v0 * b.z + (1 - u0 - v0) * c.z;
        const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
        const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d, w = 1 - u - v;
        const expected = u < -1e-6 || v < -1e-6 || w < -1e-6 ? null : u * a.y + v * b.y + w * c.y;
        if (expected === null) expect(field.height(x, z)).toBeNull();
        else expect(field.height(x, z)).toBeCloseTo(expected, 12);
      }
    }
  } finally { geometry.dispose(); material.dispose(); }
});

test('a flat face covering a whole bucket has an exact cached height and additions invalidate it', () => {
  const material = new MeshBasicNodeMaterial();
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, .05, 0, 20, .05, 0, 0, .05, 20], 3));
  const patch = new Mesh(new PlaneGeometry(.5, .5).rotateX(-Math.PI / 2), material);
  patch.position.set(2.5, .2, 2.5); patch.updateMatrixWorld(true);
  const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld(true);
  const field = new GroundField();
  try {
    field.add(mesh);
    for (let x = 2.01; x < 3; x += .11) for (let z = 2.01; z < 3; z += .13) expect(field.height(x, z)).toBeCloseTo(.05, 8);
    const cache = (field as unknown as { uniformCells: Map<number, number | null> }).uniformCells;
    expect([...cache.values()].filter(value => value !== null)).toHaveLength(1);
    field.add(patch);
    expect(field.height(2.5, 2.5)).toBeCloseTo(.2, 12); expect(field.height(2.9, 2.9)).toBeCloseTo(.05, 8);
    expect([...cache.values()].filter(value => value !== null)).toHaveLength(0);
  } finally { geometry.dispose(); patch.geometry.dispose(); material.dispose(); }
});
