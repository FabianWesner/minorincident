import { test, expect, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, Scene } from 'three/webgpu';
// Three's r186 internal manager is omitted from @types/three.
// @ts-expect-error internal module has no declaration
import RenderObjects from 'three/src/renderers/common/RenderObjects.js';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { weatherMaterialFlags } from '../../../src/render/WeatherView';
import { installPaletteVariantCache } from '../../../src/render/Renderer';

for (const retained of [false, true]) test(`@transition real Three palette variants ${retained ? 'stay warm until disposal' : 'reproduce weather retirement without the cache'}`, () => {
  const scene = new Scene(), lighting = new Lighting(scene); lighting.set('L3'); const materials = new Materials(lighting);
  const material = materials.get('sidewalk'), geometry = new BoxGeometry(), mesh = new Mesh(geometry, material), camera = new PerspectiveCamera();
  const nodes = { getCacheKey: () => 0, delete: vi.fn() }, pipelines = { delete: vi.fn() }, bindings = { deleteForRender: vi.fn() };
  const Manager = RenderObjects as unknown as new (...args: unknown[]) => { get(...args: unknown[]): { id: number }; dispose(): void; _renderObjects: Set<unknown> };
  const objects = new Manager({ backend: {}, contextNode: { id: 1, version: 0 }, _currentSourceMaterial: null }, nodes, {}, pipelines, bindings, {});
  if (retained) { installPaletteVariantCache(objects); installPaletteVariantCache(objects); }
  const lights = {}, context = { id: 1 };
  const first = objects.get(mesh, material, scene, camera, lights, context, null);
  material.setWeatherMode(weatherMaterialFlags.fog);
  const fire = objects.get(mesh, material, scene, camera, lights, context, null);
  material.setWeatherMode(lighting.weatherMode);
  const restored = objects.get(mesh, material, scene, camera, lights, context, null);
  expect(restored.id === first.id).toBe(retained); expect(fire.id === first.id).toBe(false);
  expect(nodes.delete).toHaveBeenCalledTimes(retained ? 0 : 2);
  if (retained) {
    for (let i = 0; i < 10; i++) {
      material.setWeatherMode(weatherMaterialFlags.fog);
      expect(objects.get(mesh, material, scene, camera, lights, context, null).id).toBe(fire.id);
      material.setWeatherMode(lighting.weatherMode);
      expect(objects.get(mesh, material, scene, camera, lights, context, null).id).toBe(first.id);
    }
    expect(objects._renderObjects.size).toBe(2);
  }
  material.dispose(); expect(objects._renderObjects.size).toBe(0);
  expect(nodes.delete).toHaveBeenCalledTimes(retained ? 2 : 3);
  objects.dispose(); geometry.dispose(); materials.dispose(); lighting.dispose();
});

for (const retained of [false, true]) for (const palette of [false, true]) test(`PO #100 L10 ${palette ? 'palette' : 'background'} light variants ${retained ? 'remain resident' : 'reproduce retirement'}`, () => {
  const scene = new Scene(), lighting = new Lighting(scene); lighting.set('L10-night'); const materials = new Materials(lighting);
  const material = palette ? materials.get('sidewalk') : new MeshBasicNodeMaterial(), geometry = new BoxGeometry(), mesh = new Mesh(geometry, material), camera = new PerspectiveCamera();
  const nodes = { getCacheKey: () => scene.userData.shadowVariant === 'L10:spot' ? 1 : 0, delete: vi.fn() };
  const Manager = RenderObjects as unknown as new (...args: unknown[]) => { get(...args: unknown[]): { id: number }; dispose(): void; _renderObjects: Set<unknown> };
  const objects = new Manager({ backend: {}, contextNode: { id: 1, version: 0 }, _currentSourceMaterial: null }, nodes, {}, { delete: vi.fn() }, { deleteForRender: vi.fn() }, {});
  if (retained) installPaletteVariantCache(objects);
  const lights = {}, context = { id: 1 };
  const draw = () => objects.get(mesh, material, scene, camera, lights, context, null);
  scene.userData.shadowVariant = 'L10:sun'; const sun = draw();
  scene.userData.shadowVariant = 'L10:spot'; const spot = draw();
  scene.userData.shadowVariant = 'L10:sun'; expect(draw().id === sun.id).toBe(retained);
  if (retained) {
    for (let i = 0; i < 12; i++) {
      scene.userData.shadowVariant = 'L10:spot'; expect(draw().id).toBe(spot.id);
      scene.userData.shadowVariant = 'L10:sun'; expect(draw().id).toBe(sun.id);
    }
    expect(objects._renderObjects.size).toBe(2); expect(nodes.delete).not.toHaveBeenCalled();
    // Memoized strings must still distinguish the caller's pass, then return
    // to the original source key without retiring either render object.
    const reflection = objects.get(mesh, material, scene, camera, lights, context, null, 'reflection');
    expect(reflection.id).not.toBe(sun.id); expect(draw().id).toBe(sun.id);
    expect(objects._renderObjects.size).toBe(3);
  }
  material.dispose(); expect(objects._renderObjects.size).toBe(0);
  objects.dispose(); geometry.dispose(); materials.dispose(); lighting.dispose();
});

test('PO #100 L10 restores its source immediately across asynchronous work and errors', async () => {
  const scene = new Scene(), lighting = new Lighting(scene); lighting.set('L10-night');
  const pending = lighting.withShadowSource(true, async () => {
    expect(lighting.sun.visible !== lighting.spot.visible).toBe(true);
    expect(scene.userData.shadowVariant).toBe('L10:spot');
    await Promise.resolve();
    expect(scene.userData.shadowVariant).toBe('L10:sun');
  });
  expect(scene.userData.shadowVariant).toBe('L10:sun'); await pending;
  expect(() => lighting.withShadowSource(true, () => { throw Error('warmup failure'); })).toThrow('warmup failure');
  expect(lighting.sun.visible).toBe(true); expect(lighting.spot.visible).toBe(false);
  expect(scene.userData.shadowVariant).toBe('L10:sun');
  lighting.set('L1'); expect(scene.userData.shadowVariant).toBeUndefined(); lighting.dispose();
});
