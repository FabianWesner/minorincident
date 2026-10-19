import { expect, test } from 'vitest';
import { BoxGeometry, DoubleSide, FrontSide, BackSide, Group, Mesh, MeshBasicMaterial, Object3D, Raycaster, Vector3 } from 'three/webgpu';
import { InstancedGroup } from '../../../src/render/InstancedGroup';

test('T-E29-20-occlusion @E29-AC20 @E18-AC01 placement occlusion matches full batch raycasting for drawn doors, roofs and compact interiors', () => {
  const prototype = new Group(), material = new MeshBasicMaterial({ side: DoubleSide });
  const shell = new Mesh(new BoxGeometry(2, 2, 2), material); shell.position.y = 1;
  const door = new Mesh(new BoxGeometry(.2, 1.5, 1), material); door.userData.door = 'door'; door.position.set(2, .75, 0);
  const interior = new Mesh(new BoxGeometry(.4, .4, .4), material); interior.position.set(0, 3, 0); interior.userData.interior = true;
  const roof = new Mesh(new BoxGeometry(3, .2, 3), material); roof.name = 'roof'; roof.position.y = 2.1;
  prototype.add(shell, door, interior, roof);
  const references = Array.from({ length: 24 }, (_, i) => { const ref = new Object3D(); ref.position.set(i * 7, 0, i % 2 * 6); ref.rotation.y = i * .13; ref.scale.set(1 + i % 3 * .1, 1, 1); ref.updateMatrixWorld(true); return ref; });
  const batch = new InstancedGroup(prototype, references); batch.updateMatrixWorld(true);
  batch.interiorVisible(false, references[0]); batch.interiorVisible(false, references[8]);
  batch.pose('door', .8, references[3]); batch.roofVisible(false, references[4]);
  // Compare rays to every drawn part of every placement, plus a clear miss.
  for (const ref of references) for (const y of [.5, 1.7, 2.1, 3, 4]) {
    const ray = new Raycaster(new Vector3(ref.position.x, y, ref.position.z + 4), new Vector3(0, 0, -1), 0, 8);
    const full = ray.intersectObject(batch, true).some(hit => {
      const mesh = hit.object as import('three').InstancedMesh;
      // The oracle batch contains distant siblings; this ray's finite range intersects only this placement.
      return mesh.isMesh;
    });
    expect(batch.occludesReference(ray, ref), `reference ${references.indexOf(ref)} y=${y}`).toBe(full);
  }
  const siblingRay = new Raycaster(new Vector3(0, 1, 4), new Vector3(0, 0, -1), 0, 8);
  expect(batch.occludesReference(siblingRay, references[0])).toBe(true);
  expect(batch.occludesReference(siblingRay, references[2])).toBe(false);
  batch.dispose(); shell.geometry.dispose(); door.geometry.dispose(); interior.geometry.dispose(); roof.geometry.dispose(); material.dispose();
});

test('T-E29-20-occlusion-bvh @E29-AC20 @E18-AC01 accelerated triangles preserve sides, groups, finite ranges and source indices', () => {
  for (const indexed of [true, false]) for (const side of [FrontSide, BackSide, DoubleSide]) {
    const box = new BoxGeometry(2, 3, 2, 8, 8, 8), geometry = indexed ? box : box.toNonIndexed();
    const index = geometry.index?.array.slice(), positions = geometry.getAttribute('position').array.slice();
    const materials = Array.from({ length: 6 }, () => new MeshBasicMaterial({ side }));
    const prototype = new Mesh(geometry, materials), ref = new Object3D();
    ref.position.set(2, 1, -3); ref.rotation.set(.1, .7, -.2); ref.scale.set(1.3, .8, 1.7); ref.updateMatrixWorld(true);
    const batch = new InstancedGroup(prototype, [ref]); batch.updateMatrixWorld(true);
    for (const origin of [new Vector3(2, 1, 8), new Vector3(2, 1, -3), new Vector3(12, 4, 0)]) {
      for (const x of [-2, 0, 1, 2, 3, 4, 6]) for (const [near, far] of [[0, 30], [0, 1], [4, 12], [12, 20]]) {
        const direction = new Vector3(x, 1.4, -3).sub(origin).normalize();
        const ray = new Raycaster(origin, direction, near, far);
        expect(batch.occludesReference(ray, ref)).toBe(ray.intersectObject(batch, true).length > 0);
      }
    }
    expect(geometry.index?.array).toEqual(index); expect(geometry.getAttribute('position').array).toEqual(positions);
    batch.dispose(); geometry.dispose(); if (!indexed) box.dispose(); materials.forEach(material => material.dispose());
  }
});
