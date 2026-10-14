import { afterEach, expect, test, vi } from 'vitest';
import { Group, Object3D, PerspectiveCamera, WebGPURenderer } from 'three/webgpu';
import { Renderer } from '../../../src/render/Renderer';

afterEach(() => vi.restoreAllMocks());

test('nested shadow renders share current scene matrices and the next frame updates again', () => {
  const scene = new Group(), child = new Object3D(), camera = new PerspectiveCamera();
  scene.add(child); scene.position.set(3, 2, 1); child.position.set(2, 0, 0);
  const update = vi.spyOn(scene, 'updateMatrixWorld');
  const renderer = Object.create(Renderer.prototype) as Renderer;
  let depth = 0;
  vi.spyOn(WebGPURenderer.prototype, 'render').mockImplementation((at, view) => {
    expect(at.matrixWorldAutoUpdate).toBe(false);
    expect(child.matrixWorld.elements[12]).toBe(5 + (scene.position.x - 3));
    if (depth++ === 0) renderer.render(at, view);
    depth--;
  });
  renderer.render(scene, camera); expect(update).toHaveBeenCalledTimes(1); expect(scene.matrixWorldAutoUpdate).toBe(true);
  scene.position.x++; renderer.render(scene, camera); expect(update).toHaveBeenCalledTimes(2); expect(scene.matrixWorldAutoUpdate).toBe(true);
});

test('manual scenes stay manual and render failures restore automatic updates', () => {
  const scene = new Group(), camera = new PerspectiveCamera(), renderer = Object.create(Renderer.prototype) as Renderer;
  const update = vi.spyOn(scene, 'updateMatrixWorld');
  vi.spyOn(WebGPURenderer.prototype, 'render').mockImplementation(() => { throw new Error('driver'); });
  expect(() => renderer.render(scene, camera)).toThrow('driver'); expect(scene.matrixWorldAutoUpdate).toBe(true);
  scene.matrixWorldAutoUpdate = false;
  expect(() => renderer.render(scene, camera)).toThrow('driver'); expect(scene.matrixWorldAutoUpdate).toBe(false); expect(update).toHaveBeenCalledTimes(1);
});
