import { test, expect } from 'vitest';
import { Scene } from 'three/webgpu';
import { Lighting } from '../../../src/render/Lighting';
import { footprint } from '../../../src/render/LightField';

test('T-E25-05 @E25 @E25-AC05 sixty-second walk past forty anchors holds promotions below two per second on both tiers', () => {
  for (const tier of ['high', 'low'] as const) {
    const lighting = new Lighting(new Scene()); lighting.set('night'); lighting.setQuality(tier);
    const lights = Array.from({ length: 40 }, (_, i) => ({ ...footprint({ type: 'spot', color: 'light_led_white', intensity: 6, range: 8, angle: 70, flicker: 'none', shadow: 'hero', position: [i * 4, 4, 0], direction: [0, -1, 0] }), id: `lamp-${i}` }));
    lighting.field.setStatic(lights);
    const changes = new Map<number, number>(); let prior: string | null = null;
    for (let frame = 0; frame < 3600; frame++) {
      const time = frame / 60, focus = { x: time * 3 - 5, y: 0, z: 0 };
      lighting.setHeroLight(lighting.field.heroAt(focus.x, focus.z), focus, time);
      const state = lighting.getState(); expect(state.heroLights).toBeLessThanOrEqual(tier === 'high' ? 8 : 3); expect(state.heroShadowMaps).toBeLessThanOrEqual(tier === 'high' ? 3 : 1);
      if (lighting.heroLight !== prior) { const second = Math.floor(time); changes.set(second, (changes.get(second) ?? 0) + 1); prior = lighting.heroLight; }
    }
    expect(lighting.getState().promotionChanges).toBeGreaterThanOrEqual(40);
    expect(Math.max(...changes.values())).toBeLessThanOrEqual(2);
    lighting.dispose();
  }
});


test('T-E25-05l @E25 @E25-AC05 hero transitions preserve cached shadow nodes and render only one source', () => {
  const lighting = new Lighting(new Scene()); lighting.set('night');
  const light = { ...footprint({ type: 'spot', color: 'light_led_white', intensity: 6, range: 8, angle: 70, flicker: 'none', shadow: 'hero', position: [0, 4, 0], direction: [0, -1, 0] }), id: 'lamp' };
  for (let i = 0; i < 6; i++) {
    const active = i % 2 === 0;
    lighting.setHeroLight(active ? light : null, { x: active ? 0 : 100, y: 0, z: 0 }, i * 2);
    expect(lighting.sun.castShadow).toBe(true);
    expect(lighting.sun.visible).toBe(!active);
    expect(lighting.spot.visible).toBe(active);
    expect(Number(lighting.sun.visible) + Number(lighting.spot.visible)).toBe(1);
  }
  lighting.set('L1'); expect(lighting.sun.visible).toBe(true); expect(lighting.spot.visible).toBe(false);
  lighting.dispose();
});
