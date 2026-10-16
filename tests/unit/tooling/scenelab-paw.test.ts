import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three';
import { expect, test } from 'vitest';
import { SceneLab } from '../../../src/debug/scenelab/SceneLab';
import { summarizeMotion, type MotionFrame } from '../../../src/debug/scenelab/motion';

test('drawn sole depth follows the lowest vertex independently of the contact anchor', () => {
  const geometry = new BoxGeometry(.4, .8, .3), material = new MeshBasicMaterial();
  const leg = new Group(); leg.add(new Mesh(geometry, material)); leg.position.y = .4;
  const probe = Object.assign(Object.create(SceneLab.prototype), { paws: new WeakMap() }) as { paw(leg: Object3D): number[]; pawSole(leg: Object3D): number };
  const point = new Vector3();
  for (const angle of [.4, -.7, 0, 1.2]) {
    leg.rotation.z = angle; leg.updateWorldMatrix(true, true);
    let bottom = Infinity; const mesh = leg.children[0] as Mesh;
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) bottom = Math.min(bottom, point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).y);
    expect(probe.pawSole(leg)).toBeCloseTo(bottom, 10);
    expect(probe.paw(leg)).toHaveLength(3);
  }
  geometry.dispose(); material.dispose();
});

test('drawn sole depth corrects sink without changing the existing contact/slide rule', () => {
  const frames: MotionFrame[] = [3, 4, 5].map(frame => ({ frame, floor: 0,
    feet: [{ heel: [frame * .1, .03, 0], toe: [frame * .1, .03, 0], yaw: 0 }] }));
  const original = summarizeMotion(frames), drawn = summarizeMotion(frames.map(f => ({ ...f, soleLowestY: -.034 })));
  expect(drawn.sinkMaxCm).toBe(3.4);
  expect({ ...drawn, sinkMaxCm: original.sinkMaxCm }).toEqual(original);
  expect(drawn.contacts).toBe(0); expect(drawn.slideMaxCm).toBe(0);
  const virtual: MotionFrame[] = frames.map(f => ({ ...f, feet: [{ heel: [0, -.012, 0], toe: [0, -.012, 0], yaw: 0 }] }));
  const anchor = summarizeMotion(virtual), mesh = summarizeMotion(virtual.map(f => ({ ...f, soleLowestY: 0 })));
  expect(anchor.sinkMaxCm).toBe(1.2); expect(mesh.sinkMaxCm).toBe(0);
  expect({ ...mesh, sinkMaxCm: anchor.sinkMaxCm }).toEqual(anchor);
});
