import { expect, test } from 'vitest';
import { Object3D, Quaternion, Vector3 } from 'three';
import { LimbIK } from '../../../src/render/characters/LimbIK';

// Original solver retained as a numerical oracle for the matrix-read shortcut.
function reference(upper: Object3D, middle: Object3D, end: Object3D) {
  const target = new Vector3(), axis = new Vector3(), bend = new Vector3(), joint = new Vector3(), lower = new Vector3();
  const frame = new Quaternion(), upperRotation = new Quaternion(), lowerRotation = new Quaternion(), endRotation = new Quaternion();
  const a = middle.position.length(), b = end.position.length(), upperDirection = middle.position.clone().normalize(), lowerDirection = end.position.clone().normalize();
  return (at: Vector3, pole: Vector3, orientation: Quaternion, weight: number) => {
    const parent = upper.parent!;
    parent.updateWorldMatrix(true, false); parent.worldToLocal(target.copy(at)).sub(upper.position); parent.getWorldQuaternion(frame).invert();
    const distance = Math.max(.0001, Math.min(a + b - .0001, target.length()));
    axis.copy(target).normalize(); bend.copy(pole).applyQuaternion(frame).addScaledVector(axis, -bend.dot(axis)).normalize();
    const along = (a * a + distance * distance - b * b) / (2 * distance);
    joint.copy(axis).multiplyScalar(along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
    upperRotation.setFromUnitVectors(upperDirection, joint.normalize());
    lower.copy(axis).multiplyScalar(distance).addScaledVector(joint, -a).applyQuaternion(endRotation.copy(upperRotation).invert()).normalize();
    lowerRotation.setFromUnitVectors(lowerDirection, lower);
    endRotation.copy(upperRotation).multiply(lowerRotation).invert().multiply(frame).multiply(orientation);
    upper.quaternion.slerp(upperRotation, weight); middle.quaternion.slerp(lowerRotation, weight); end.quaternion.slerp(endRotation, weight);
    upper.updateWorldMatrix(false, true);
  };
}

test('IK matrix reuse matches the original solver under rotated, scaled and mirrored parents', () => {
  for (const mirror of [1, -1]) {
    const parent = new Object3D(), upper = new Object3D(), middle = new Object3D(), end = new Object3D();
    parent.position.set(3, 2, -4); parent.rotation.set(.2, .6, -.3); parent.scale.set(1.2 * mirror, .8, 1.1);
    upper.position.set(.1, .4, -.2); middle.position.set(0, -.35, 0); end.position.set(0, -.3, 0);
    parent.add(upper); upper.add(middle); middle.add(end);
    const copy = parent.clone(true), copiedUpper = copy.children[0], copiedMiddle = copiedUpper.children[0], copiedEnd = copiedMiddle.children[0];
    const expected = reference(upper, middle, end), actual = new LimbIK(copiedUpper, copiedMiddle, copiedEnd);
    for (let i = 0; i < 80; i++) {
      const target = parent.localToWorld(new Vector3(.2 * Math.sin(i), -.05, .15 * Math.cos(i)));
      const pole = new Vector3(1, .1, .3), orientation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), i * .03), weight = [0, .3, 1][i % 3];
      expected(target, pole, orientation, weight); actual.solve(target, pole, orientation, weight);
      for (const [a, b] of [[upper, copiedUpper], [middle, copiedMiddle], [end, copiedEnd]]) {
        for (let c = 0; c < 16; c++) expect(b.matrixWorld.elements[c]).toBeCloseTo(a.matrixWorld.elements[c], 12);
      }
    }
  }
});
