import { expect, test, vi } from 'vitest';
import { BoxGeometry, DirectionalLight, Group, InstancedMesh, LineSegments, LineBasicNodeMaterial, Mesh, MeshBasicNodeMaterial, Matrix4, PerspectiveCamera, DataTexture, Scene, SpotLight, Vector2, Vector3 } from 'three/webgpu';
import { compileLanes, preRender, warmUpSize } from '../../../src/render/PreRenderer';
import { Renderer } from '../../../src/render/Renderer';

test('T-E25-14g @E25 warm-up preserves the active gameplay light list', async () => {
  const scene = new Scene(), sun = new DirectionalLight(), spot = new SpotLight(); spot.visible = false; scene.add(sun, spot);
  const lines = new LineSegments(new BoxGeometry(), new LineBasicNodeMaterial()); lines.visible = false; scene.add(lines); let compiledLines=0;
  const check = () => { expect(sun.visible).toBe(true); expect(spot.visible).toBe(false); };
  const renderer = { selectedBackend: 'webgl', getSize: (target: Vector2) => target.set(100, 100), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}), compileAsync: vi.fn(async () => { check(); if(lines.visible){compiledLines++;expect(lines.frustumCulled).toBe(false);} }) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), () => { check(); expect(lines.visible).toBe(true); }); check();
  expect(compiledLines).toBe(1);expect(lines.visible).toBe(false);expect(lines.frustumCulled).toBe(true);lines.geometry.dispose();(lines.material as LineBasicNodeMaterial).dispose();sun.dispose();spot.dispose();
});

for (const fails of [false, true]) test(`@E19 pre-render warms hidden zero-count variants and restores state on ${fails ? 'failure' : 'success'}`, async () => {
  const scene = new Scene(), group = new Group(), mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicNodeMaterial(), 2);
  const original = [new Matrix4().makeTranslation(3, 4, 5), new Matrix4().makeRotationY(.7)]; original.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
  group.visible = false; mesh.visible = false; mesh.count = 0; group.add(mesh); scene.add(group);
  const size = new Vector2(1600, 900), calls: string[] = [];
  // Compile lanes: every call sees the warm-up state; each leaf is visible in exactly one lane.
  const lanes: boolean[] = [];
  const renderer = { finishWarmUp: vi.fn(async () => calls.push('finish')), selectedBackend: 'webgl', getSize: (target: Vector2) => target.copy(size), setSize: (x: number, y: number) => size.set(x, y), compileAsync: vi.fn(async () => { expect(group.visible).toBe(true); lanes.push(mesh.visible); expect(mesh.frustumCulled).toBe(false); expect(mesh.count).toBe(1); calls.push('compile'); }) } as unknown as Renderer;
  const warm = preRender(renderer, scene, new PerspectiveCamera(), () => { expect(size.toArray()).toEqual([warmUpSize, warmUpSize]); expect(mesh.count).toBe(calls.includes('render') ? 2 : 1); calls.push('render'); if (fails) throw new Error('GPU lost'); });
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
  material.userData.batchFeatures = 'static-test';
  const meshes = Array.from({ length: 4 }, (_, i) => new InstancedMesh(geometry, material, i === 3 ? 4 : 2));
  meshes[0].visible = false; meshes[2].receiveShadow = true; scene.add(...meshes);
  const compiled = [0, 0, 0, 0];
  const renderer = { selectedBackend: 'webgl', getSize: (target: Vector2) => target.set(100, 100), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}), compileAsync: vi.fn(async () => { meshes.forEach((m, i) => { compiled[i] += Number(m.visible); }); }) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), () => { expect(meshes.map(m => m.visible)).toEqual([true, true, true, true]); });
  // Same-capacity static duplicates share compilation; shadow and capacity
  // variants stay separate. The actual warm-up draws above cover all four.
  expect(compiled).toEqual([1, 0, 1, 1]);
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

for (const fails of [false, true]) test(`@transition warm-up polls GPU completion between frames and cleans its fence on ${fails ? 'failure' : 'success'}`, async () => {
  vi.useFakeTimers();
  const sync = {}, gl = { SYNC_GPU_COMMANDS_COMPLETE: 1, SYNC_FLUSH_COMMANDS_BIT: 2, TIMEOUT_EXPIRED: 3, WAIT_FAILED: 4,
    fenceSync: vi.fn(() => sync), flush: vi.fn(), deleteSync: vi.fn(), clientWaitSync: vi.fn().mockReturnValueOnce(3).mockReturnValue(fails ? 4 : 5) };
  const frame = vi.fn((callback: FrameRequestCallback) => { callback(0); return 1; }); vi.stubGlobal('requestAnimationFrame', frame);
  try {
    const renderer = { selectedBackend: 'webgl', backend: { gl } } as unknown as Renderer;
    const pending = Renderer.prototype.finishWarmUp.call(renderer);
    const result = fails ? expect(pending).rejects.toThrow('Warm-up GPU fence failed') : pending;
    expect(frame).not.toHaveBeenCalled(); await vi.runAllTimersAsync(); await result;
    expect(gl.deleteSync).toHaveBeenCalledWith(sync); expect(gl.flush).toHaveBeenCalledOnce();
    expect(frame).toHaveBeenCalledTimes(fails ? 0 : 1);
  } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
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

for (const background of [false, true]) test(`@transition ${background ? 'menu' : 'foreground'} prewarm groups report completed work and restore the scene on failure`, async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  const meshes = Array.from({ length: background ? 100 : 1100 }, () => new Mesh(geometry, material)); scene.add(...meshes);
  const size = new Vector2(1600, 900), groups: number[] = [], progress: number[] = [];
  const pause = vi.fn(async () => {});
  const renderer = { selectedBackend: 'webgl', getSize: (target: Vector2) => target.copy(size), setSize: (x: number, y: number) => size.set(x, y), finishWarmUp: vi.fn(async () => {}), compileAsync: vi.fn(async () => {}) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), () => { groups.push(meshes.filter(m => m.visible).length); }, undefined, pause, (done, total) => progress.push(done / total), background);
  expect(groups.slice(0, 2)).toEqual(background ? [64, 36] : [1024, 76]); expect(pause.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(progress.at(-1)).toBe(1); expect(progress.every((p, i) => i === 0 || p >= progress[i - 1])).toBe(true);
  await expect(preRender(renderer, scene, new PerspectiveCamera(), () => { throw new Error('GPU lost'); }, undefined, pause)).rejects.toThrow('GPU lost');
  expect(size.toArray()).toEqual([1600, 900]); expect(meshes.every(m => m.visible && m.frustumCulled)).toBe(true);
  geometry.dispose(); material.dispose();
});

test('@transition animated warm-up groups cover both driver paths without overlapping actors and restore instance matrices', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  const actors = Array.from({ length: 65 }, () => { const mesh = new InstancedMesh(geometry, material, 2); mesh.count = 0; mesh.userData.preRenderSolo = true; return mesh; });
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
      expect((pixel.x + 1) * warmUpSize / 2 % 1).toBeCloseTo(.5); expect((pixel.y + 1) * warmUpSize / 2 % 1).toBeCloseTo(.5);
    });
    expect(positions.size).toBe(visible.length);
  });
  expect(sizes).toEqual([64, 64, 1, 1]); expect(paths.every(path => path.has(1) && path.has(2))).toBe(true);
  for (const mesh of actors) { const matrix = new Matrix4(); mesh.getMatrixAt(0, matrix); expect(matrix.elements).toEqual(new Matrix4().elements); expect(mesh.count).toBe(0); mesh.dispose(); }
  geometry.dispose(); material.dispose();
});

for (const background of [false, true]) test(`@transition WebGPU ${background ? 'background' : 'foreground'} chunks compile pipelines asynchronously`, async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const compile = vi.fn(async () => {}), render = vi.fn(), pause = vi.fn(async () => {});
  const renderer = { selectedBackend: 'webgpu', getSize: (target: Vector2) => target.set(1600, 900), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), render, compile, pause, undefined, background, true);
  expect(compile).toHaveBeenCalledOnce();
  expect(pause).toHaveBeenCalled(); expect(render).toHaveBeenCalled();
  geometry.dispose(); material.dispose();
});

for (const background of [false, true]) test(`@transition ${background ? 'background' : 'foreground'} compilation restores its node-build policy after failure`, async () => {
  const scene = new Scene(), renderer = { foregroundCompile: false, selectedBackend: 'webgl', getSize: (target: Vector2) => target.set(1600, 900), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}) } as unknown as Renderer;
  await expect(preRender(renderer, scene, new PerspectiveCamera(), vi.fn(), async () => {
    expect(renderer.foregroundCompile).toBe(!background); throw Error('Compile failed');
  }, undefined, undefined, background)).rejects.toThrow('Compile failed');
  expect(renderer.foregroundCompile).toBe(false);
});


test('@E18 WebGPU pose uploads yield within 4 MiB and finish before pipeline compilation', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  const textures = Array.from({ length: 3 }, () => new DataTexture(new Float32Array(600_000), 75, 2000));
  const leaves = textures.map(texture => { const mesh = new Mesh(geometry, material); mesh.userData.preRenderTextures = [texture]; return mesh; });
  scene.add(...leaves);
  const calls: string[] = [], initTexture = vi.fn(() => calls.push('upload'));
  const renderer = { selectedBackend: 'webgpu', getSize: (target: Vector2) => target.set(1600, 900), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}), initTexture } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), vi.fn(), async () => { calls.push('compile'); }, async () => { calls.push('pause'); }, undefined, false, true);
  expect(calls.slice(0, 7)).toEqual(['upload', 'pause', 'upload', 'pause', 'upload', 'pause', 'compile']);
  expect(initTexture).toHaveBeenCalledTimes(3);
  geometry.dispose(); material.dispose(); textures.forEach(texture => texture.dispose());
});


test('@E18 other WebGPU levels retain foreground compilation and draw batching', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicNodeMaterial(), scene = new Scene();
  const leaves = Array.from({ length: 130 }, () => new Mesh(geometry, material)); scene.add(...leaves);
  const compile = vi.fn(async () => {}), groups: number[] = [];
  const renderer = { selectedBackend: 'webgpu', getSize: (target: Vector2) => target.set(1600, 900), setSize: vi.fn(), finishWarmUp: vi.fn(async () => {}) } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), () => { groups.push(leaves.filter(leaf => leaf.visible).length); }, compile, async () => {});
  expect(compile).not.toHaveBeenCalled(); expect(groups).toEqual([130, 130, 130]);
  geometry.dispose(); material.dispose();
});
