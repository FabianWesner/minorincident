import { DoubleSide, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D, Raycaster, Scene, TorusGeometry, Vector3 } from 'three/webgpu';
import { expect, test } from 'vitest';
import { InstancedGroup } from '../../../src/render/InstancedGroup';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';

for (const frozen of [false, true]) test(`T-E29-19-bar-ray @E29-AC19 accelerated ${frozen ? 'frozen' : 'ordinary'} instances retain exact triangle occlusion`, () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  const material = frozen ? materials.get('asphalt') : new MeshBasicNodeMaterial();
  material.side = DoubleSide;
  if (frozen) material.userData.batchFeatures = {};
  const geometry = new TorusGeometry(1, .22, 8, 32), indices = [...geometry.index!.array];
  const prototype = new Group(), part = new Mesh(geometry, material); prototype.add(part);
  const refs = [new Object3D(), new Object3D()];
  refs[0].position.x = -1.8; refs[1].position.set(1.8, .2, -.5);
  refs[1].rotation.y = .3; refs[1].scale.set(1.2, .8, 1.5);
  const group = new InstancedGroup(prototype, refs); group.position.set(3, 1, -2); group.updateMatrixWorld(true);
  const ray = Object.assign(new Raycaster(), { firstHitOnly: true });
  ray.ray.origin.set(3, 1, 8);
  let hits = 0, misses = 0;
  try {
    for (const far of [9, 14]) for (let x = -4; x <= 4; x += .5) for (let y = -2; y <= 2; y += .5) {
      ray.far = far; ray.ray.direction.copy(new Vector3(x + 3, y + 1, -2)).sub(ray.ray.origin).normalize();
      const expected = ray.intersectObject(group, true).length > 0;
      expect(group.intersectsRay(ray)).toBe(expected);
      if (expected) hits++; else misses++;
    }
    expect(hits).toBeGreaterThan(5); expect(misses).toBeGreaterThan(5);
    // A window/arch hole must remain open, even though the ray crosses its bounding box.
    ray.far = 14; ray.ray.direction.set(-1.8, 0, -10).normalize();
    expect(ray.intersectObject(group, true)).toHaveLength(0); expect(group.intersectsRay(ray)).toBe(false);
    expect([...geometry.index!.array]).toEqual(indices);
    for (const mesh of group.children as InstancedMesh[]) mesh.count = 0;
    expect(group.intersectsRay(ray)).toBe(false);
  } finally { group.dispose(); geometry.dispose(); if (!frozen) material.dispose(); materials.dispose(); lighting.dispose(); }
});
