import { expect, test } from 'vitest';
import { Scene } from 'three/webgpu';
import { Lighting } from '../../../src/render/Lighting';
import { footprint } from '../../../src/render/LightField';

// PO 10-20 #62 "L6 after I picked up the headlamp there is a 3-5s freeze". The pickup promoted the headlamp to the
// hero spot, swapping sun -> spot: a light-list change rebuilds every material pipeline warmed after loading.
// Underground the light list is fixed from the preset onwards: one spot, no sun, with or without a hero light.
test('@E24 @E25 PO 10-20 #62 the subway keeps one stable light list across the headlamp pickup', () => {
  const lighting = new Lighting(new Scene()); lighting.set('L6-subway');
  const lists: string[] = [], list = () => `${lighting.sun.visible}/${lighting.spot.visible}/${lighting.spot.castShadow}`;
  lists.push(list());
  const headlamp = { ...footprint({ type: 'spot', color: 'light_led_white', intensity: 9, range: 18, angle: 48, flicker: 'none', shadow: 'hero', position: [1.5, 1.9, -2], direction: [1, -.3, 0] }), id: 'headlamp' };
  for (let i = 0; i < 8; i++) { lighting.setHeroLight(i >= 3 ? headlamp : null, { x: 1.5, y: .9, z: -2 }, i * .5); lists.push(list()); }
  expect(new Set(lists)).toEqual(new Set(['false/true/true']));
  // Without a hero light the stable spot carries no light (its shadow weight fades to zero).
  for (let i = 0; i < 30; i++) lighting.setHeroLight(null, { x: 100, y: 0, z: 0 }, 10 + i);
  expect(lighting.spot.visible).toBe(true); expect(lighting.spot.intensity).toBeLessThan(1e-5);
  // The exterior night street keeps the ordinary one-source swap.
  lighting.set('L6'); expect(lighting.sun.visible).toBe(true); expect(lighting.spot.visible).toBe(false);
  lighting.dispose();
});
