import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three';
import { expect, test } from 'vitest';
import { SceneLab } from '../../../src/debug/scenelab/SceneLab';

test('paw sink probe follows the lowest drawn vertex after a leg rotates', () => {
  const geometry = new BoxGeometry(.4, .8, .3), material = new MeshBasicMaterial();
  const leg = new Group(); leg.add(new Mesh(geometry, material)); leg.position.y = .4;
  const probe = Object.assign(Object.create(SceneLab.prototype), { paws: new WeakMap() }) as { paw(leg: Object3D): number[] };
  const point = new Vector3();
  for (const angle of [.4, -.7, 0, 1.2]) {
    leg.rotation.z = angle; leg.updateWorldMatrix(true, true);
    let bottom = Infinity; const mesh = leg.children[0] as Mesh;
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) bottom = Math.min(bottom, point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).y);
    expect(probe.paw(leg)[1]).toBeCloseTo(bottom, 10);
  }
  geometry.dispose(); material.dispose();
});
