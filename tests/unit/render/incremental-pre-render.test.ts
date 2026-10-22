import { expect, test, vi } from 'vitest';
import { BoxGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, Scene } from 'three/webgpu';
import { incrementalPreRender } from '../../../src/render/PreRenderer';
import type { Renderer } from '../../../src/render/Renderer';
import { Lighting } from '../../../src/render/Lighting';

test('PO #100 warm slices wait for GPU linking and restore every visible body, instance and probe before play', async () => {
  const scene = new Scene(), lighting = new Lighting(scene); lighting.set('L10-night');
  scene.clear(); // The guard owns two leaves; lighting's decorative beams are unrelated.
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial();
  const body = new InstancedMesh(geometry, material, 3), other = new Mesh(geometry, material);
  body.name = 'body'; body.count = 3; body.visible = false;
  for (let i = 0; i < 3; i++) body.setMatrixAt(i, new Matrix4().makeTranslation(i, 0, 0));
  scene.add(body, other); scene.updateMatrixWorld(true);
  const original = [...body.instanceMatrix.array], probe = vi.fn(); body.onAfterRender = probe;
  const camera = new PerspectiveCamera(); camera.position.set(0, 3, 6); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const renderer = { info: { calls: 0 }, nodeBuilds: 0, foregroundCompile: false, nextNodeFrame: vi.fn() };
  let finish!: () => void;
  const draw = vi.fn(() => {
    expect(scene.userData.shadowVariant).toBe('L10:spot'); expect(body.visible).toBe(true); expect(other.visible).toBe(false);
    expect(body.count).toBe(draw.mock.calls.length === 1 ? 1 : 2);
    body.onAfterRender(undefined!, undefined!, undefined!, undefined!, undefined!, undefined!);
  });
  const compile = vi.fn(root => {
    expect(root).toBe(body); expect(body.count).toBe(1); expect(renderer.foregroundCompile).toBe(true);
    expect(renderer.info.calls).toBe(1); expect(scene.background).toBeNull(); expect(scene.backgroundNode).toBeNull();
    expect(scene.userData.shadowVariant).toBe('L10:spot'); renderer.nodeBuilds++;
    return new Promise<void>(resolve => { finish = resolve; });
  });
  const queue = incrementalPreRender(renderer as unknown as Renderer, scene, camera, draw, compile, run => lighting.withShadowSource(true, run));
  const restored = () => {
    expect(scene.userData.shadowVariant).toBe('L10:sun'); expect(body.visible).toBe(false); expect(other.visible).toBe(true);
    expect(body.count).toBe(3); expect([...body.instanceMatrix.array]).toEqual(original); expect(body.onAfterRender).toBe(probe);
    expect(renderer.foregroundCompile).toBe(false);
  };
  queue.step(); restored(); queue.step(); expect(compile).toHaveBeenCalledTimes(1); expect(draw).not.toHaveBeenCalled();
  finish(); await Promise.resolve();
  queue.step(); restored(); queue.step(); restored();
  expect(draw).toHaveBeenCalledTimes(2); expect(probe).not.toHaveBeenCalled();
  queue.cancel(); expect(queue.done).toBe(true); queue.step(); expect(draw).toHaveBeenCalledTimes(2);
  geometry.dispose(); material.dispose(); lighting.dispose();
});

test('PO #100 cached warm graphs skip driver draws and a failed link releases the queue', async () => {
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial();
  const mesh = new Mesh(geometry, material); mesh.matrixAutoUpdate = false; mesh.matrix.makeTranslation(7, 8, 9); scene.add(mesh); scene.updateMatrixWorld(true);
  const camera = new PerspectiveCamera(), renderer = { info: { calls: 0 }, nodeBuilds: 0, foregroundCompile: false, nextNodeFrame: vi.fn() }, draw = vi.fn();
  const cached = incrementalPreRender(renderer as unknown as Renderer, scene, camera, draw, async () => {}, run => run());
  cached.step(); await Promise.resolve(); expect(cached.done).toBe(true); expect(draw).not.toHaveBeenCalled();
  const failed = incrementalPreRender(renderer as unknown as Renderer, scene, camera, draw, async () => { throw Error('link failed'); }, run => run());
  failed.step(); await Promise.resolve(); expect(() => failed.step()).toThrow('link failed'); expect(failed.done).toBe(true);
  expect(mesh.visible).toBe(true); expect(mesh.position.toArray()).toEqual([0, 0, 0]);
  expect(mesh.matrix.elements.slice(12, 15)).toEqual([7, 8, 9]); expect(mesh.matrixWorld.elements.slice(12, 15)).toEqual([7, 8, 9]);
  geometry.dispose(); material.dispose();
});
