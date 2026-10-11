import { test, expect, vi } from 'vitest';
import { BoxGeometry, Mesh, PerspectiveCamera, Scene } from 'three/webgpu';
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
