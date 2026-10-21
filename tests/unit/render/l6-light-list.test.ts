import { expect, test } from 'vitest';
import { Scene } from 'three/webgpu';
import { Lighting } from '../../../src/render/Lighting';
import { footprint } from '../../../src/render/LightField';

// PO 10-20 #62 "L6 after I picked up the headlamp there is a 3-5s freeze". The pickup promoted the headlamp to the
// hero spot, swapping sun -> spot: a light-list change rebuilds every material pipeline warmed after loading.
// The light list stays fixed through pickup and the night exit; inactive shadows have zero weight.
test('@E24 @E25 PO 10-20 #62 the subway keeps one stable light list across the headlamp pickup', () => {
  const lighting = new Lighting(new Scene()); lighting.set('L6-subway');
  const lists: string[] = [], list = () => `${lighting.sun.visible}/${lighting.spot.visible}/${lighting.spot.castShadow}`;
  lists.push(list());
  const headlamp = { ...footprint({ type: 'spot', color: 'light_led_white', intensity: 9, range: 18, angle: 48, flicker: 'none', shadow: 'hero', position: [1.5, 1.9, -2], direction: [1, -.3, 0] }), id: 'headlamp' };
  for (let i = 0; i < 8; i++) { lighting.setHeroLight(i >= 3 ? headlamp : null, { x: 1.5, y: .9, z: -2 }, i * .5); lists.push(list()); }
  expect(new Set(lists)).toEqual(new Set(['true/true/true']));
  // Without a hero light the stable spot carries no light (its shadow weight fades to zero).
  for (let i = 0; i < 30; i++) lighting.setHeroLight(null, { x: 100, y: 0, z: 0 }, 10 + i);
  expect(lighting.spot.visible).toBe(true); expect(lighting.spot.intensity).toBeLessThan(1e-5);
  // The exterior keeps the same list and restores only the moon's contribution.
  lighting.set('L6'); expect(list()).toBe(lists[0]);
  expect(lighting.sun.shadow.intensity).toBe(1); expect(lighting.spot.shadow.intensity).toBe(0);
  expect(lighting.sun.shadow.autoUpdate).toBe(true); expect(lighting.spot.shadow.autoUpdate).toBe(false);
  lighting.dispose();
});

for (const quality of ['low', 'high'] as const) for (const preset of ['L5', 'L8-zoo', 'L10-night'] as const) {
  test(`${preset} ${quality}: entering and leaving a hero pool retains the light list and only updates the active shadow`, () => {
    const lighting = new Lighting(new Scene()); lighting.set(preset); lighting.setQuality(quality);
    const light = { ...footprint({ type: 'spot', color: 'light_led_white', intensity: 9, range: 18, angle: 48, flicker: 'none', shadow: 'hero', position: [0, 3, 0], direction: [0, -1, 0] }), id: 'lamp' };
    for (const [time, lamp, x] of [[0, null, 100], [2, light, 0], [4, null, 100], [6, light, 0]] as const) {
      lighting.setHeroLight(lamp, { x, y: 0, z: 0 }, time);
      expect(lighting.sun.visible && lighting.spot.visible).toBe(true);
      expect(lighting.sun.castShadow && lighting.spot.castShadow).toBe(true);
      expect(Number(lighting.sun.shadow.autoUpdate) + Number(lighting.spot.shadow.autoUpdate)).toBe(1);
      expect(lighting.sun.shadow.intensity).toBe(lamp ? 0 : 1);
      expect(lighting.spot.shadow.intensity).toBe(lamp ? 1 : 0);
      expect(lamp ? lighting.sun.intensity : lighting.spot.intensity).toBe(0);
    }
    lighting.dispose();
  });
}

// QA 10-21 #82 "switching quality low -> high throws TypeError: Cannot read properties of null (reading 'depthTexture')
// in the shadow update": a runtime castShadow flip disposes the ShadowNode that cached materials still update.
for (const preset of ['L6-subway', 'L6', 'L1', 'L5', 'L10-night'] as const) {
  test(`@E24 QA #82 ${preset}: quality switches never flip castShadow; low L6 only zeroes the spot shadow`, () => {
    const lighting = new Lighting(new Scene()); lighting.set(preset);
    const headlamp = { ...footprint({ type: 'spot', color: 'light_led_white', intensity: 9, range: 18, angle: 48, flicker: 'none', shadow: 'hero', position: [1.5, 1.9, -2], direction: [1, -.3, 0] }), id: 'headlamp' };
    const lists = new Set<string>(), l6 = preset === 'L6-subway' || preset === 'L6';
    for (const [i, tier] of (['low', 'high', 'low', 'high', 'low'] as const).entries()) {
      lighting.setQuality(tier); lighting.setHeroLight(i % 2 ? headlamp : null, { x: 1.5, y: .9, z: -2 }, i);
      expect(lighting.sun.castShadow && lighting.spot.castShadow).toBe(true);
      lists.add(`${lighting.sun.visible}/${lighting.spot.visible}`);
      if (l6 && tier === 'low') { expect(lighting.spot.shadow.intensity).toBe(0); expect(lighting.spot.shadow.autoUpdate).toBe(false); }
      if (preset === 'L6-subway' && tier === 'high') { expect(lighting.spot.shadow.intensity).toBe(1); expect(lighting.spot.shadow.autoUpdate).toBe(true); }
    }
    // Stable presets keep one light list through every switch (L1 still swaps sun <-> spot for hero pools).
    if (preset !== 'L1') expect(lists.size).toBe(1);
    lighting.dispose();
  });
}
