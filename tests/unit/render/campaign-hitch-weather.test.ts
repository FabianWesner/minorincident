import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { DataTexture, Scene } from 'three/webgpu';
import { loadLayouts } from '../../../src/levels/layouts';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { Lighting } from '../../../src/render/Lighting';
import { PaletteMaterial } from '../../../src/render/PaletteMaterial';
import { View } from '../../../src/render/View';
import { WeatherView, weatherMaterialFlags } from '../../../src/render/WeatherView';
import { footprint } from '../../../src/render/LightField';

test('@E18 @E28 L6 position-based exterior fog uses its loading graph and weather preserves an inactive sun', async () => {
  const world = new SimWorld(); await world.init();
  const { composition, layouts } = await loadLayouts('L6', undefined, async url => JSON.parse(readFileSync(`public${url}`, 'utf8')));
  world.loadComposition(composition, layouts, 1);
  const lighting = new Lighting(new Scene()); lighting.set('L6-subway');
  const weather = new WeatherView(world, lighting), view = new View();
  const palette = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = new PaletteMaterial('asphalt', palette, lighting);
  try {
    weather.update(view, 'low', false);
    expect(world.weather!.kind).toBe('none'); expect(world.weather!.clouds).toBe(0);
    expect(lighting.weatherMode & weatherMaterialFlags.clouds).toBe(weatherMaterialFlags.clouds);
    const output = material.outputNode;
    const player = world.entities.get(1)!;
    Object.assign(player.transform, { x: 267, z: 15, y: 4.62 });
    world.weather!.update(); weather.update(view, 'low', false);
    expect(world.weather!.kind).toBe('fog'); expect(world.weather!.clouds).toBeGreaterThan(0);
    expect(material.outputNode).toBe(output);

    lighting.set('L5');
    const lamp = footprint({ type: 'spot', color: 'light_led_white', intensity: 9, range: 18, angle: 48, shadow: 'hero', flicker: 'none', position: [267, 6, 15], direction: [0, -1, 0] });
    lighting.setHeroLight(lamp, player.transform, 0);
    weather.update(view, 'low', false);
    expect(lighting.intensity.value).toBeGreaterThan(0);
    expect(lighting.sun.intensity).toBe(0);
    expect(lighting.spot.shadow.autoUpdate).toBe(true);
  } finally { material.dispose(); palette.dispose(); weather.dispose(); lighting.dispose(); world.dispose(); }
});
