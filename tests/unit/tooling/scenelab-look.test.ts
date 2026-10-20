import { expect, test } from 'vitest';
import { hueDistance, lookStats } from '../../../tools/scenelab/look';

const image = (pixels: [number, number, number][]) => Uint8Array.from(pixels.flatMap(p => [...p, 255]));

test('alpha-white look stats: crowd pixels only, pale share and saturation-weighted hue', () => {
  const ground: [number, number, number] = [110, 100, 105];
  const without = image([ground, ground, ground, ground]);
  // Orange live Alpha body on two pixels, the rest is unchanged ground.
  const live = lookStats(image([[230, 120, 20], [200, 100, 15], ground, ground]), without);
  expect(live.pixels).toBe(2); expect(live.whiteShare).toBe(0);
  expect(live.hue).toBeGreaterThan(20); expect(live.hue).toBeLessThan(40);
  // The hit-flash white mass: pale, unsaturated body pixels.
  const white = lookStats(image([[235, 228, 226], [240, 236, 230], [230, 120, 20], ground]), without);
  expect(white.whiteShare).toBeCloseTo(2 / 3);
  expect(hueDistance(350, 10)).toBe(20); expect(hueDistance(30, 200)).toBe(170);
});
