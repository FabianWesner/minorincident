import { Box3, InstancedMesh, Matrix4, Vector3 } from 'three/webgpu';
import { expect, test, vi } from 'vitest';
import { RoutineProps } from '../../../src/render/npc/RoutineProps';

test('T-E22-20-props @E22-AC20 @E18 gun and hand probes reuse storage and retain exact world transforms', () => {
  vi.stubGlobal('location', { search: '?test=1' });
  const props = new RoutineProps();
  try {
    const hand = new Float32Array([.1, .2, .3, -.1, .4, .2]);
    const first = new Matrix4().makeRotationY(.7).setPosition(3, 2, 1);
    props.held('rifle', first, 7, hand);
    const gun = props.guns[0], contact = props.contacts[0], points = contact.hand, muzzle = props.muzzles.get(7)!;
    expect(muzzle.distanceTo(new Vector3(0, .02, .9).applyMatrix4(first))).toBeLessThan(1e-7);
    props.begin(); expect(props.muzzles.size).toBe(0); expect(props.contacts).toHaveLength(0);
    const second = new Matrix4().makeRotationY(-.3).setPosition(-4, 1, 9);
    props.held('pistol', second, 12, hand); props.finish();
    expect(props.guns[0]).toBe(gun); expect(props.contacts[0]).toBe(contact); expect(contact.hand).toBe(points);
    expect(props.muzzles.get(12)).toBe(muzzle); expect(props.muzzles.has(7)).toBe(false);
    expect(gun.entity).toBe(12); expect(contact.prop).toBe('pistol'); expect(contact.matrix.equals(second)).toBe(true);
    for (let i = 0; i < hand.length; i += 3) expect(new Vector3().fromArray(points, i).distanceTo(new Vector3().fromArray(hand, i).applyMatrix4(second))).toBeLessThan(1e-6);
  } finally { props.dispose(); vi.unstubAllGlobals(); }
});

test('T-E22-20-dropped @E22-AC20 dropped props retain their rotated ground clearance', () => {
  const props = new RoutineProps();
  try {
    for (const yaw of [0, .7, -1.2, Math.PI]) {
      props.begin(); props.dropped('coffee', { x: 3, y: .6, z: -2, yaw }); props.finish();
      const mesh = props.children.find(child => (child as InstancedMesh).count === 1) as InstancedMesh;
      const pose = new Matrix4(); mesh.getMatrixAt(0, pose);
      const bounds = new Box3().copy(mesh.geometry.boundingBox!).applyMatrix4(pose);
      expect(bounds.min.y).toBeCloseTo(.615, 6);
      expect(pose.elements[12]).toBe(3); expect(pose.elements[14]).toBe(-2);
    }
  } finally { props.dispose(); }
});
