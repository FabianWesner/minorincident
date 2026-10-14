import { expect, test, vi } from 'vitest';
import { Group, Quaternion, Vector3, type Object3D } from 'three/webgpu';
import { VehicleOccupant } from '../../../src/render/characters/VehicleOccupant';
import { createSurvivorPlaceholder } from '../../../src/render/characters/placeholder';
import { LimbIK } from '../../../src/render/characters/LimbIK';

const Construct = VehicleOccupant as unknown as new (id: number, asset: string, model: Object3D) => VehicleOccupant;
// Original world-getter path: independent oracle for the already-current matrix path.
function original(copy: VehicleOccupant, seat: Object3D, wheel: Vector3 | undefined, fit: number, lean: number): number[] {
  const model = copy.model, torso = model.getObjectByName('torso')!, rest = torso.quaternion.clone();
  const point = new Vector3(), pole = new Vector3(), orientation = new Quaternion(), grip = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
  copy.scale.setScalar(fit); seat.updateWorldMatrix(true, false);
  copy.parent!.worldToLocal(copy.position.copy(seat.getWorldPosition(point)));
  copy.quaternion.copy(copy.parent!.getWorldQuaternion(orientation).invert()).multiply(seat.getWorldQuaternion(new Quaternion()));
  if (wheel) copy.position.x += Math.max(0, Math.min(.2, wheel.x - copy.position.x - .35 * fit));
  torso.quaternion.copy(rest); torso.rotateZ(wheel ? lean : -.25); copy.updateWorldMatrix(true, true);
  return ['L', 'R'].map((side, i) => {
    const arm = new LimbIK(model.getObjectByName(`arm${side}`)!, model.getObjectByName(`foreArm${side}`)!, model.getObjectByName(`hand${side}`)!);
    if (wheel) { point.copy(wheel).add(new Vector3(-.04, .025, i === 0 ? -.12 : .12)); copy.parent!.localToWorld(point); }
    else copy.localToWorld(point.set(.2, .1, i === 0 ? -.11 : .11));
    pole.set(.15, -.8, i === 0 ? -.3 : .3).transformDirection(copy.parent!.matrixWorld);
    orientation.copy(copy.parent!.getWorldQuaternion(new Quaternion())).multiply(grip); arm.solve(point, pole, orientation);
    return arm.end.getWorldPosition(new Vector3()).distanceTo(point);
  });
}

test('seated contacts reuse current matrices with identical poses under translated, leaning and reflected cars', () => {
  for (const mirror of [-1, 1]) for (const driver of [false, true]) for (let tick = 0; tick < 10; tick++) {
    const scene = new Group(), car = new Group(), seat = new Group(); scene.add(car); car.add(seat);
    scene.position.set(20, 3, -7); scene.rotation.y = tick * .1;
    car.position.set(tick, .2, 2); car.rotation.set(.03, tick / 7, -.04); car.scale.set(mirror * 1.2, .9, 1.1); seat.position.set(.5, .8, -.2); seat.rotation.y = .05;
    const actual = new Construct(1, 'test', createSurvivorPlaceholder('male')), expected = new Construct(2, 'test', createSurvivorPlaceholder('male')); car.add(actual, expected);
    const wheel = driver ? new Vector3(.8, 1, -.2) : undefined;
    const gaps = original(expected, seat, wheel, .85, -.5), refresh = vi.spyOn(car, 'updateWorldMatrix');
    actual.pose(seat, wheel, .85, -.5);
    expect(refresh.mock.calls.length).toBeLessThan(8);
    refresh.mockRestore();
    actual.updateMatrixWorld(true); expected.updateMatrixWorld(true);
    for (const name of ['hip', 'torso', 'armL', 'foreArmL', 'handL', 'armR', 'foreArmR', 'handR']) {
      const a = actual.model.getObjectByName(name)!, b = expected.model.getObjectByName(name)!;
      a.matrixWorld.elements.forEach((v, i) => expect(v).toBeCloseTo(b.matrixWorld.elements[i], 12));
    }
    actual.handGapM.forEach((v, i) => expect(v).toBeCloseTo(gaps[i], 12));
  }
});
