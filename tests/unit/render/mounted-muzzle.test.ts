import { expect, test } from 'vitest';
import { Group, Matrix4, Vector3 } from 'three/webgpu';
import { DistrictView } from '../../../src/render/DistrictView';

test('T-E22-20-mounted-muzzle @E22-AC20 mounted selection preserves stable ties, nested transforms and the exact barrel socket', () => {
  const nests = () => [-1, 1].map(x => {
    const parent = new Group(), root = new Group(), gun = new Group(), muzzle = new Group();
    parent.position.set(10, 0, -5); parent.rotation.y = .4; parent.scale.set(1.2, .8, 1.1);
    root.position.set(x, 0, 0); gun.position.set(0, 1.4, 0); muzzle.position.set(1.7, .1, .05);
    parent.add(root); root.add(gun); gun.add(muzzle); parent.updateMatrixWorld(true);
    return { root, gun, muzzle };
  });
  const actual = nests(), expected = nests();
  const view = Object.create(DistrictView.prototype) as DistrictView;
  Object.assign(view, { machineGuns: actual, machineGunPoint: new Vector3(), machineGunHeading: new Vector3(), machineGunInverse: new Matrix4() });
  for (const at of [{ x: 10, z: -5 }, { x: 9, z: -4 }, { x: 11, z: -6 }, { x: 30, z: 30 }]) for (const direction of [{ x: 1, z: 0 }, { x: 0, z: -1 }, { x: -.6, z: .8 }]) {
    const sorted = expected.map(n => ({ n, p: n.root.getWorldPosition(new Vector3()) })).sort((a, b) => Math.hypot(a.p.x - at.x, a.p.z - at.z) - Math.hypot(b.p.x - at.x, b.p.z - at.z));
    const nearest = sorted[0]; let tip: Vector3 | null = null;
    if (Math.hypot(nearest.p.x - at.x, nearest.p.z - at.z) <= 3) {
      nearest.n.root.updateWorldMatrix(true, true);
      const heading = new Vector3(direction.x, 0, direction.z).transformDirection(nearest.n.gun.parent!.matrixWorld.clone().invert());
      nearest.n.gun.rotation.y = -Math.atan2(heading.z, heading.x);
      nearest.n.root.updateWorldMatrix(true, true); tip = nearest.n.muzzle.getWorldPosition(new Vector3());
    }
    const result = view.aimMachineGun(at, direction);
    expect(result?.toArray() ?? null).toEqual(tip?.toArray() ?? null);
    expect(actual.map(n => n.gun.rotation.y)).toEqual(expected.map(n => n.gun.rotation.y));
  }
});
