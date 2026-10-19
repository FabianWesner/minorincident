import { expect, test } from 'vitest';
import { BoxGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Object3D, Raycaster, Vector3 } from 'three/webgpu';
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
