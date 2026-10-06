import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, MeshBasicNodeMaterial, PerspectiveCamera, Scene, Vector2 } from 'three/webgpu';
import { preRender } from '../../../src/render/PreRenderer';
import type { Renderer } from '../../../src/render/Renderer';

for (const fails of [false, true]) test(`@E19 pre-render warms hidden zero-count variants and restores state on ${fails ? 'failure' : 'success'}`, async () => {
  const scene = new Scene(), group = new Group(), mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicNodeMaterial(), 2);
  group.visible = false; mesh.visible = false; mesh.count = 0; group.add(mesh); scene.add(group);
  const size = new Vector2(1600, 900), calls: string[] = [];
  const renderer = { finishWarmUp: vi.fn(async () => calls.push('finish')), selectedBackend: 'webgl', getSize: (target: Vector2) => target.copy(size), setSize: (x: number, y: number) => size.set(x, y), compileAsync: vi.fn(async () => { expect(group.visible).toBe(true); expect(mesh.visible).toBe(true); expect(mesh.frustumCulled).toBe(false); expect(mesh.count).toBe(1); calls.push('compile'); }) } as unknown as Renderer;
  const warm = preRender(renderer, scene, new PerspectiveCamera(), () => { expect(size.toArray()).toEqual([32, 32]); calls.push('render'); if (fails) throw new Error('GPU lost'); });
  if (fails) await expect(warm).rejects.toThrow('GPU lost'); else await warm;
  expect(calls).toEqual(fails ? ['compile', 'render'] : ['compile', 'render', 'finish']); expect(size.toArray()).toEqual([1600, 900]);
  expect(group.visible).toBe(false); expect(mesh.visible).toBe(false); expect(mesh.count).toBe(0); expect(mesh.frustumCulled).toBe(true);
  mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose();
});
