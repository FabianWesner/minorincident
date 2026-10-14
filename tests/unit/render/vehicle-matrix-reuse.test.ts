import { expect, test, vi } from 'vitest';
import { Group, Object3D } from 'three/webgpu';
import { updateTyreMatrices } from '../../../src/render/TyreContact';

test('tyre-only refresh exactly matches whole-car matrices through chassis, steering and suspension changes', () => {
  const scene = new Group(), car = new Group(), model = new Group(), axle = new Group(), panel = new Object3D();
  scene.add(car); car.add(model); model.add(axle, panel);
  const wheels = [new Object3D(), new Object3D()]; axle.add(...wheels);
  wheels.forEach((node, i) => node.position.set(i ? 1 : -1, .3, i ? 2 : -2));
  const records = wheels.map(node => ({ node })), panelUpdate = vi.spyOn(panel, 'updateMatrixWorld');
  for (const mirror of [-1, 1]) for (let tick = 0; tick < 60; tick++) {
    scene.position.set(3, 2, -4); car.position.set(tick / 10, .6, -tick / 20); car.rotation.set(.03, tick / 20, -.04);
    model.scale.set(mirror * 1.2, .8, 1.1); model.rotation.set(tick / 1000, 0, -.01); axle.rotation.y = tick / 80;
    wheels.forEach((node, i) => { node.rotation.set(0, tick / 200, tick / 3); node.position.y = .3 + Math.sin(tick + i) * .02; });
    updateTyreMatrices(records);
    const actual = wheels.map(node => node.matrixWorld.clone());
    expect(panelUpdate).not.toHaveBeenCalled();
    car.updateMatrixWorld(true);
    wheels.forEach((node, i) => node.matrixWorld.elements.forEach((v, j) => expect(v).toBe(actual[i].elements[j])));
    panelUpdate.mockClear();
    // The wheel fit changes only that pivot; its parent matrices remain current.
    wheels[0].position.y += .013; wheels[0].updateWorldMatrix(false, false);
    const settled = wheels[0].matrixWorld.clone(); car.updateMatrixWorld(true);
    expect(wheels[0].matrixWorld.elements).toEqual(settled.elements); panelUpdate.mockClear();
  }
});
