import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, MeshBasicNodeMaterial, Matrix4, PerspectiveCamera, Scene, Vector2 } from 'three/webgpu';
import { preRender } from '../../../src/render/PreRenderer';
import { Renderer } from '../../../src/render/Renderer';

for (const fails of [false, true]) test(`@E19 pre-render warms hidden zero-count variants and restores state on ${fails ? 'failure' : 'success'}`, async () => {
  const scene = new Scene(), group = new Group(), mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicNodeMaterial(), 2);
  const original = [new Matrix4().makeTranslation(3, 4, 5), new Matrix4().makeRotationY(.7)]; original.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
  group.visible = false; mesh.visible = false; mesh.count = 0; group.add(mesh); scene.add(group);
  const size = new Vector2(1600, 900), calls: string[] = [];
  const renderer = { finishWarmUp: vi.fn(async () => calls.push('finish')), selectedBackend: 'webgl', getSize: (target: Vector2) => target.copy(size), setSize: (x: number, y: number) => size.set(x, y), compileAsync: vi.fn(async () => { expect(group.visible).toBe(true); expect(mesh.visible).toBe(true); expect(mesh.frustumCulled).toBe(false); expect(mesh.count).toBe(1); calls.push('compile'); }) } as unknown as Renderer;
  const warm = preRender(renderer, scene, new PerspectiveCamera(), () => { expect(size.toArray()).toEqual([32, 32]); expect(mesh.count).toBe(calls.includes('render') ? 2 : 1); calls.push('render'); if (fails) throw new Error('GPU lost'); });
  if (fails) await expect(warm).rejects.toThrow('GPU lost'); else await warm;
  expect(calls).toEqual(fails ? ['compile', 'render'] : ['compile', 'render', 'finish', 'render', 'finish']); expect(size.toArray()).toEqual([1600, 900]);
  expect(group.visible).toBe(false); expect(mesh.visible).toBe(false); expect(mesh.count).toBe(0); expect(mesh.frustumCulled).toBe(true);
  original.forEach((matrix, i) => { const actual = new Matrix4(); mesh.getMatrixAt(i, actual); actual.elements.forEach((v, j) => expect(v).toBeCloseTo(matrix.elements[j])); });
  mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose();
});

test('@E19 pre-render warms every render object including distinct shadow and capacity variants', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  const meshes = Array.from({ length: 4 }, (_, i) => new InstancedMesh(geometry, material, i === 3 ? 4 : 2));
  meshes[0].visible = false; meshes[2].receiveShadow = true; scene.add(...meshes);
  const renderer = { selectedBackend: 'webgl', getSize: (target: Vector2) => target.set(100, 100), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}), compileAsync: vi.fn(async () => { expect(meshes.map(m => m.visible)).toEqual([true, true, true, true]); }) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), () => { expect(meshes.map(m => m.visible)).toEqual([true, true, true, true]); });
  expect(meshes.map(m => m.visible)).toEqual([false, true, true, true]); expect(meshes.map(m => m.count)).toEqual([2, 2, 2, 4]);
  meshes.forEach(mesh => mesh.dispose()); geometry.dispose(); material.dispose();
});


test('@E19 warm-up waits for a new render frame even when the GPU fence is already signaled', async () => {
  let frame: FrameRequestCallback | undefined, finished = false;
  const fence = vi.fn(async () => {}), request = vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('requestAnimationFrame', request);
  try {
    const renderer = { selectedBackend: 'webgl', backend: { utils: { _clientWaitAsync: fence } } } as unknown as Renderer;
    const warm = Renderer.prototype.finishWarmUp.call(renderer); void warm.then(() => { finished = true; });
    await Promise.resolve(); expect(fence).toHaveBeenCalledOnce(); expect(request).toHaveBeenCalledOnce(); expect(finished).toBe(false);
    frame!(0); await warm; expect(finished).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});

test('@E19 animated batches execute both driver paths without opaque occluders', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  const crowd = new InstancedMesh(geometry, material, 3), district = new InstancedMesh(geometry, material, 2);
  crowd.userData.preRenderSolo = true; crowd.visible = false; crowd.count = 0; scene.add(crowd, district);
  const draws: number[][] = [];
  const renderer = { selectedBackend: 'webgl', getSize: (target: Vector2) => target.set(100, 100), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}), compileAsync: vi.fn(async () => {}) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), () => { draws.push([Number(crowd.visible), Number(district.visible), crowd.count]); });
  expect(draws).toEqual([[1, 1, 1], [1, 1, 2], [1, 0, 1], [1, 0, 2]]);
  expect(crowd.visible).toBe(false); expect(crowd.count).toBe(0); expect(district.visible).toBe(true); expect(district.count).toBe(2);
  crowd.dispose(); district.dispose(); geometry.dispose(); material.dispose();
});
