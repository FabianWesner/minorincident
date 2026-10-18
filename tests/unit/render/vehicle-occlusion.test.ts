import { expect, test, vi } from 'vitest';
import { Box3, BoxGeometry, Group, Matrix4, Mesh, Vector3 } from 'three/webgpu';
import { SubjectOcclusion } from '../../../src/render/SubjectOcclusion';
import { VehicleView } from '../../../src/render/VehicleView';
import { PaletteMaterial } from '../../../src/render/PaletteMaterial';

const apc = new Box3(new Vector3(-3, 0, -1.5), new Vector3(3, 3, 1.5));
const sedan = new Box3(new Vector3(-2.1, 0, -.9), new Vector3(2.1, 1.5, .9));

test('@E18 adjacent non-occluding vehicle stays opaque at every game zoom', () => {
  const selection = new SubjectOcclusion();
  for (const zoom of [1.5, 1, .5]) {
    selection.setSubject(new Vector3().setFromSphericalCoords(19 * zoom, Math.PI * .30, Math.PI / 4), apc);
    for (const [x, z] of [[4, -4], [-4, 4], [-5, -5], [4, 4]]) {
      expect(selection.blockedBy(sedan, new Matrix4().makeTranslation(x, 0, z)), `zoom ${zoom}, sedan ${x},${z}`).toBe(false);
    }
    // The same footprint can block the subject when it carries a tall truck.
    const truck = sedan.clone(); truck.max.y = 6;
    expect(selection.blockedBy(truck, new Matrix4().makeTranslation(4, 0, 4))).toBe(true);
  }
});

test('@E18 a foreground sedan hides an on-foot courier; elevated, rotated bounds follow the chassis', () => {
  const selection = new SubjectOcclusion();
  const courier = new Box3(new Vector3(-.55, 0, -.55), new Vector3(.55, 1.9, .55));
  selection.setSubject(new Vector3(10, 5, 10), courier);
  expect(selection.blockedBy(sedan, new Matrix4().makeTranslation(1.5, 0, 1.5))).toBe(true);
  const chassis = new Group(); chassis.position.set(1.5, 8, 1.5); chassis.rotation.set(.1, Math.PI / 4, -.2); chassis.updateMatrixWorld();
  expect(selection.blockedBy(sedan, chassis.matrixWorld)).toBe(false);
  selection.setSubject(new Vector3(10, 13, 10), courier.translate(new Vector3(0, 8, 0)));
  expect(selection.blockedBy(sedan, chassis.matrixWorld)).toBe(true);
  selection.setSubject(new Vector3(1.5, 8.5, 1.5), courier);
  expect(selection.blockedBy(sedan, chassis.matrixWorld)).toBe(true);
  // A vehicle beyond the subject cannot hide it.
  expect(selection.blockedBy(sedan, new Matrix4().makeTranslation(-5, 8, -5))).toBe(false);
});

test('@E18 VehicleView enables only blocking cars and keeps the driven APC opaque', () => {
  const paint = () => Object.assign(Object.create(PaletteMaterial.prototype), { seeThrough: vi.fn() });
  const driven = paint(), beside = paint(), foreground = paint();
  const model = new Group(), entryRing = new Mesh(new BoxGeometry(20, 1, 20));
  entryRing.visible = false; model.add(entryRing);
  const neighbour = new Group(); neighbour.position.set(4, 0, -4);
  const truck = new Group(); truck.position.set(4, 0, 4);
  const tall = sedan.clone(); tall.max.y = 6;
  const context = Object.assign(Object.create(VehicleView.prototype), {
    world: { vehicles: { active: 1 } }, view: { camera: { position: new Vector3(10, 12, 10) } },
    occlusion: new SubjectOcclusion(), records: new Map([
      [1, { parent: new Group(), model, bounds: apc, paint: [driven] }],
      [2, { parent: neighbour, bounds: sedan, paint: [beside] }],
      [3, { parent: truck, bounds: tall, paint: [foreground] }],
    ]),
  });
  const subject = new Box3();
  expect(context.playerBounds(subject)).toBe(true);
  expect(subject).toEqual(apc); // Hidden entry markers must not enlarge the player vehicle.
  context.updateReveal(subject);
  expect(driven.seeThrough).toHaveBeenLastCalledWith(false);
  expect(beside.seeThrough).toHaveBeenLastCalledWith(false);
  expect(foreground.seeThrough).toHaveBeenLastCalledWith(true);
  truck.position.set(-8, 0, -8);
  context.updateReveal(apc);
  expect(foreground.seeThrough).toHaveBeenLastCalledWith(false);
  context.updateReveal();
  expect(beside.seeThrough).toHaveBeenLastCalledWith(false);
});
