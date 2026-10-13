import { readFileSync } from 'node:fs';
import { BoxGeometry, FileLoader, Group, Mesh, MeshBasicNodeMaterial, Scene } from 'three/webgpu';
import { expect, test, vi } from 'vitest';
import { crossingChunks } from '../../../src/levels/L9/district';
import { localTerrainPoint, selectTerrainChunks } from '../../../src/sim/world/TerrainChunks';
import { TerrainView } from '../../../src/render/TerrainView';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GroundField } from '../../../src/render/GroundField';
import { DistrictAssets } from '../../../src/assets/DistrictAssets';
import { Materials } from '../../../src/render/Materials';
import { Lighting } from '../../../src/render/Lighting';

test('T-E31-12-S3 @E31-AC12 selection covers current and 2s predicted cells within quality bounds', () => {
  for (const tier of ['high', 'low'] as const) for (const x of [-500.01, -500, -499.99, -.01, 0, .01, 499.99]) for (const z of [-300.01, -.01, .01, 299.99]) for (const [vx, vz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) {
    const cells = selectTerrainChunks(crossingChunks, 100, [x, z], [vx, vz], tier);
    expect(cells.length).toBeLessThanOrEqual(tier === 'high' ? 25 : 9);
    for (const t of [0, 2]) {
      const px = x + vx / Math.hypot(vx, vz) * 18 * t, pz = z + vz / Math.hypot(vx, vz) * 18 * t;
      expect(cells.some(c => px >= c.origin[0] && px < c.max[0] && pz >= c.origin[1] && pz < c.max[1]), `${tier}: ${px},${pz}`).toBe(true);
    }
  }
  const cell = crossingChunks[95]; expect(localTerrainPoint(cell, [551, 352])).toEqual([51, 52]);
  const shifted = crossingChunks.map(c => ({ ...c, origin: [c.origin[0] + 2000, c.origin[1] - 1600] as [number, number], max: [c.max[0] + 2000, c.max[1] - 1600] as [number, number] }));
  expect(selectTerrainChunks(shifted, 100, [2000, -1600], [1, 0], 'low').map(c => c.id)).toEqual(selectTerrainChunks(crossingChunks, 100, [0, 0], [1, 0], 'low').map(c => c.id));
});

function cache(delayed = false) {
  const live = new Set<string>(), release = vi.fn(), finish: (() => void)[] = [];
  return { live, release, finish, registry: { leaseGlb(id: string) {
    live.add(id); const root = new Group(); root.add(new Mesh(new BoxGeometry(10, .01, 10), new MeshBasicNodeMaterial()));
    const ready = delayed ? new Promise<Group>(resolve => finish.push(() => resolve(root))) : Promise.resolve(root);
    let released = false;
    return { ready, release() { if (released) return; released = true; live.delete(id); root.traverse(n => { if (n instanceof Mesh) { n.geometry.dispose(); (n.material as MeshBasicNodeMaterial).dispose(); } }); release(id); } };
  } } };
}

test('T-E31-12-unload-S3 @E31-AC12 @E31-AC19 repeated traversals release cell arrays/buffers and tier drops bound residency', async () => {
  const c = cache(), view = new TerrainView(crossingChunks, 100, id => id, c.registry, 'high');
  for (let lap = 0; lap < 5; lap++) for (const x of [-450, 0, 450, 0, -450]) {
    view.update([x, 0], [18, 0]); await view.ready();
    expect(view.snapshot().resident).toBeLessThanOrEqual(25); expect(c.live.size).toBe(view.snapshot().resident);
    expect(view.snapshot().queued).toBe(0);
  }
  expect(view.snapshot().unloaded).toBeGreaterThan(100);
  view.setQuality('low'); expect(view.snapshot().resident).toBeLessThanOrEqual(9);
  view.update([0, 0]); await view.ready(); expect(c.live.size).toBe(9);
  view.dispose(); expect(c.live.size).toBe(0);
});

test('T-E31-12-delay-S3 @E31-AC12 delayed stale loads cannot mount after teleport/dispose', async () => {
  const c = cache(true), view = new TerrainView(crossingChunks, 100, id => id, c.registry, 'low');
  view.update([-450, 0]); expect(view.snapshot().loading).toBe(2);
  view.update([450, 0]); expect(view.snapshot().resident).toBe(0); expect(c.live.size).toBe(2);
  view.dispose(); c.finish.forEach(f => f()); await view.ready();
  expect(c.live.size).toBe(0); expect(view.children).toHaveLength(0); expect(c.release).toHaveBeenCalledTimes(2);
});

test('T-E31-12-error-S3 @E31-AC12 load failure releases ownership and readiness reports the failure', async () => {
  const release = vi.fn(), view = new TerrainView(crossingChunks, 100, id => id, { leaseGlb: () => ({ ready: Promise.reject(Error('missing terrain')), release }) }, 'low');
  view.update([0, 0]); await expect(view.ready()).rejects.toThrow('missing terrain');
  expect(release).toHaveBeenCalledTimes(2); view.dispose();
});

test('T-E31-19-shaders-S3 @E31-AC19 terrain leases share the static shader graph and last release evicts geometry', async () => {
  const buffer = readFileSync('public/assets/layouts/D-CROSSING.chunks/crossing-6-0.glb');
  vi.spyOn(FileLoader.prototype, 'loadAsync').mockResolvedValue(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), registry = new DistrictAssets(materials);
  const a = registry.leaseGlb('/a.glb'), b = registry.leaseGlb('/a.glb'), c = registry.leaseGlb('/c.glb');
  const [first, shared, other] = await Promise.all([a.ready, b.ready, c.ready]);
  expect(first).toBe(shared);
  const mesh = first.children[0] as Mesh, twin = other.children[0] as Mesh;
  expect(mesh.material).toBe(twin.material); expect((mesh.material as MeshBasicNodeMaterial).userData.batchFeatures).toBeDefined();
  const disposed = vi.spyOn(mesh.geometry, 'dispose');
  a.release(); await Promise.resolve(); expect(disposed).not.toHaveBeenCalled();
  b.release(); await Promise.resolve(); expect(disposed).toHaveBeenCalledOnce();
  const next = registry.leaseGlb('/a.glb'); expect(await next.ready).not.toBe(first);
  expect((await next.ready).children[0] as Mesh).toHaveProperty('material', mesh.material);
  c.release(); next.release(); await Promise.resolve(); registry.dispose(); materials.dispose(); lighting.dispose();
});

test('T-E31-13-assets-S3 @E31-AC13 streamed cells stay below LOD2 cap, coarse horizon below 10k', () => {
  const manifest = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.chunks/manifest.json', 'utf8'));
  expect(Object.keys(manifest.triangles).sort()).toEqual(crossingChunks.map(c => c.id).sort());
  expect(Math.max(...Object.values(manifest.triangles) as number[])).toBeLessThanOrEqual(800);
  expect(manifest.horizonTriangles).toBeLessThanOrEqual(10_000);
  expect(manifest.sourceHash).toBe(JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')).geometryHash);
});

test('T-E31-13-seams-S3 @E31-AC13 independently loaded local cells and coarse terrain preserve seam heights', async () => {
  async function field(path: string, origin: [number, number] = [0, 0]) {
    const b = readFileSync(path), scene = (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
    scene.position.set(origin[0], 0, origin[1]); scene.updateMatrixWorld(true);
    const ground = new GroundField(); scene.traverse(n => { if (n instanceof Mesh) ground.add(n); });
    return ground;
  }
  const horizon = await field('public/assets/layouts/D-CROSSING.horizon.glb');
  const fields = await Promise.all(crossingChunks.map(async c => ({ c, ground: await field(`public/assets/layouts/D-CROSSING.chunks/${c.id}.glb`, c.origin) })));
  for (const { c, ground } of fields) {
    for (const [x, z] of [[c.origin[0] + .01, c.origin[1] + 50], [c.max[0] - .01, c.origin[1] + 50], [c.origin[0] + 50, c.origin[1] + .01], [c.origin[0] + 50, c.max[1] - .01]]) {
      const coarse = horizon.height(x, z), detailed = ground.height(x, z);
      expect(coarse).not.toBeNull(); expect(detailed).not.toBeNull(); expect(Math.abs(coarse! - detailed!)).toBeLessThanOrEqual(.02);
    }
    for (const neighbour of fields.filter(n => n.c.origin[0] === c.max[0] && n.c.origin[1] === c.origin[1] || n.c.origin[1] === c.max[1] && n.c.origin[0] === c.origin[0])) {
      const east = neighbour.c.origin[0] === c.max[0];
      for (const offset of [1, 25, 50, 75, 99]) {
        const x = east ? c.max[0] : c.origin[0] + offset, z = east ? c.origin[1] + offset : c.max[1];
        expect(Math.abs(ground.height(x, z)! - neighbour.ground.height(x, z)!)).toBeLessThanOrEqual(.02);
      }
    }
  }
});
