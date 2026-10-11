import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, Matrix4, PerspectiveCamera, Scene, Vector2, Vector3 } from 'three/webgpu';
import { compileLanes, preRender } from '../../../src/render/PreRenderer';
import { Renderer } from '../../../src/render/Renderer';

for (const fails of [false, true]) test(`@E19 pre-render warms hidden zero-count variants and restores state on ${fails ? 'failure' : 'success'}`, async () => {
  const scene = new Scene(), group = new Group(), mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicNodeMaterial(), 2);
  const original = [new Matrix4().makeTranslation(3, 4, 5), new Matrix4().makeRotationY(.7)]; original.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
  group.visible = false; mesh.visible = false; mesh.count = 0; group.add(mesh); scene.add(group);
  const size = new Vector2(1600, 900), calls: string[] = [];
  // Compile lanes: every call sees the warm-up state; each leaf is visible in exactly one lane.
  const lanes: boolean[] = [];
  const renderer = { finishWarmUp: vi.fn(async () => calls.push('finish')), selectedBackend: 'webgl', getSize: (target: Vector2) => target.copy(size), setSize: (x: number, y: number) => size.set(x, y), compileAsync: vi.fn(async () => { expect(group.visible).toBe(true); lanes.push(mesh.visible); expect(mesh.frustumCulled).toBe(false); expect(mesh.count).toBe(1); calls.push('compile'); }) } as unknown as Renderer;
  const warm = preRender(renderer, scene, new PerspectiveCamera(), () => { expect(size.toArray()).toEqual([32, 32]); expect(mesh.count).toBe(calls.includes('render') ? 2 : 1); calls.push('render'); if (fails) throw new Error('GPU lost'); });
  if (fails) await expect(warm).rejects.toThrow('GPU lost'); else await warm;
  const compiles = Array<string>(compileLanes).fill('compile');
  expect(lanes.filter(Boolean)).toHaveLength(1);
  expect(calls).toEqual(fails ? [...compiles, 'render'] : [...compiles, 'render', 'finish', 'render', 'finish']); expect(size.toArray()).toEqual([1600, 900]);
  expect(group.visible).toBe(false); expect(mesh.visible).toBe(false); expect(mesh.count).toBe(0); expect(mesh.frustumCulled).toBe(true);
  original.forEach((matrix, i) => { const actual = new Matrix4(); mesh.getMatrixAt(i, actual); actual.elements.forEach((v, j) => expect(v).toBeCloseTo(matrix.elements[j])); });
  mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose();
});

test('@E19 pre-render warms every render object including distinct shadow and capacity variants', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  const meshes = Array.from({ length: 4 }, (_, i) => new InstancedMesh(geometry, material, i === 3 ? 4 : 2));
  meshes[0].visible = false; meshes[2].receiveShadow = true; scene.add(...meshes);
  const compiled = [0, 0, 0, 0];
  const renderer = { selectedBackend: 'webgl', getSize: (target: Vector2) => target.set(100, 100), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}), compileAsync: vi.fn(async () => { meshes.forEach((m, i) => { compiled[i] += Number(m.visible); }); }) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), () => { expect(meshes.map(m => m.visible)).toEqual([true, true, true, true]); });
  // The concurrent compile lanes together cover every render object exactly once.
  expect(compiled).toEqual([1, 1, 1, 1]);
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

test('@transition prewarm yields between small draw groups, reports completed work and restores the scene on failure', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  const meshes = Array.from({ length: 100 }, () => new Mesh(geometry, material)); scene.add(...meshes);
  const size = new Vector2(1600, 900), groups: number[] = [], progress: number[] = [];
  const pause = vi.fn(async () => {});
  const renderer = { selectedBackend: 'webgl', getSize: (target: Vector2) => target.copy(size), setSize: (x: number, y: number) => size.set(x, y), finishWarmUp: vi.fn(async () => {}), compileAsync: vi.fn(async () => {}) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), () => { groups.push(meshes.filter(m => m.visible).length); }, undefined, pause, (done, total) => progress.push(done / total));
  expect(groups.slice(0, 2)).toEqual([64, 36]); expect(pause.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(progress.at(-1)).toBe(1); expect(progress.every((p, i) => i === 0 || p >= progress[i - 1])).toBe(true);
  await expect(preRender(renderer, scene, new PerspectiveCamera(), () => { throw new Error('GPU lost'); }, undefined, pause)).rejects.toThrow('GPU lost');
  expect(size.toArray()).toEqual([1600, 900]); expect(meshes.every(m => m.visible && m.frustumCulled)).toBe(true);
  geometry.dispose(); material.dispose();
});

test('@transition animated warm-up groups cover both driver paths without overlapping actors and restore instance matrices', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  const actors = Array.from({ length: 5 }, () => { const mesh = new InstancedMesh(geometry, material, 2); mesh.count = 0; mesh.userData.preRenderSolo = true; return mesh; });
  const wall = new Mesh(geometry, material); scene.add(...actors, wall);
  const paths = actors.map(() => new Set<number>()), sizes: number[] = [];
  const renderer = { selectedBackend: 'webgl', getSize: (target: Vector2) => target.set(1600, 900), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}), compileAsync: vi.fn(async () => {}) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), () => {
    if (wall.visible) return;
    const visible = actors.filter(mesh => mesh.visible), positions = new Set<string>(); sizes.push(visible.length);
    actors.forEach((mesh, index) => {
      if (!mesh.visible) return;
      paths[index].add(mesh.count); const matrix = new Matrix4(); mesh.getMatrixAt(0, matrix);
      positions.add(matrix.elements.slice(12, 15).join(','));
      const pixel = new Vector3().setFromMatrixPosition(matrix).project(new PerspectiveCamera());
      expect((pixel.x + 1) * 16 % 1).toBeCloseTo(.5); expect((pixel.y + 1) * 16 % 1).toBeCloseTo(.5);
    });
    expect(positions.size).toBe(visible.length);
  });
  expect(sizes).toEqual([4, 4, 1, 1]); expect(paths.every(path => path.has(1) && path.has(2))).toBe(true);
  for (const mesh of actors) { const matrix = new Matrix4(); mesh.getMatrixAt(0, matrix); expect(matrix.elements).toEqual(new Matrix4().elements); expect(mesh.count).toBe(0); mesh.dispose(); }
  geometry.dispose(); material.dispose();
});

for (const background of [false, true]) test(`@transition WebGPU ${background ? 'background' : 'foreground'} chunks preserve the existing compilation policy`, async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const compile = vi.fn(async () => {}), render = vi.fn(), pause = vi.fn(async () => {});
  const renderer = { selectedBackend: 'webgpu', getSize: (target: Vector2) => target.set(1600, 900), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), render, compile, pause, undefined, background);
  expect(compile).toHaveBeenCalledTimes(Number(background));
  expect(pause).toHaveBeenCalled(); expect(render).toHaveBeenCalled();
  geometry.dispose(); material.dispose();
});
