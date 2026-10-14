import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { flare, litFloor, routesOf, samplePairs } from '../../../tools/scenelab/contrast';
import { timeOfDay } from '../../../src/data/timeOfDay';
import { compositions } from '../../../src/levels/compositions';

const catalog = 'tests/scenes/catalog', specs = readdirSync(catalog).filter(f => f.endsWith('.json')).map(f => ({ f, spec: JSON.parse(readFileSync(`${catalog}/${f}`, 'utf8')) }));

test('T-E31-16 @E31 @E31-AC16 the night presets lift asphalt so the route reads against the verge, and L10 has its own night preset', () => {
  for (const name of ['L9-crossing', 'L10-night'] as const) expect(timeOfDay[name].roadLift ?? 0).toBeGreaterThanOrEqual(1);
  // Night stays night: moonlight dimmer than the L4 dusk, dark haze, no daylight preset carries the lift.
  for (const name of ['L10-night'] as const) { expect(timeOfDay[name].intensity).toBeLessThanOrEqual(.4); expect(timeOfDay[name].practical).toBe(1); }
  for (const [name, preset] of Object.entries(timeOfDay)) if (!['L9-crossing', 'L10-night'].includes(name)) expect(preset.roadLift ?? 0).toBe(0);
  expect(compositions['D-CURE'].timeOfDay).toBe('L10-night');
});

test('T-E31-16b @E31 @E31-AC16 every D-CURE Scene Lab scene is lit by the L10 night preset (no stale L9 look in R1-R6)', () => {
  for (const { f, spec } of specs) if (spec.layout?.district === 'D-CURE' && spec.time) expect(spec.time, f).toBe('L10-night');
});

test('T-E31-16c @E31 @E31-AC16 the navigation contrast catalog covers R1-R6 and the L9 road with the 3:1 gates', () => {
  const night = specs.filter(s => s.f.startsWith('night-read-'));
  expect(night.map(s => s.spec.name).sort()).toEqual(['night-read-l10-r1', 'night-read-l10-r2', 'night-read-l10-r3', 'night-read-l10-r4', 'night-read-l10-r5', 'night-read-l10-r6', 'night-read-l9-apc', 'night-read-l9-crawl', 'night-read-l9-road']);
  for (const { spec } of night) { expect(spec.expect.navContrastMin).toBe(2.5); expect(spec.expect.navContrastFloor).toBe(2); if (spec.name !== 'night-read-l9-apc') expect(spec.expect.playerContrastMin).toBe(3); expect(spec.contrast.district).toBeTruthy(); }
});

test('T-E31-16d @E31 @E31-AC16 route sampling follows the authored routes and respects the scene bounds', () => {
  const cure = routesOf({ district: 'D-CURE' });
  expect(cure.lines).toHaveLength(7); // R1-R6 plus the R7 arena approach (L10-D4) expect(cure.halfWidthM).toBe(4);
  expect(routesOf({ district: 'D-CROSSING' }).halfWidthM).toBe(6);
  const all = samplePairs({ district: 'D-CURE' }), boxed = samplePairs({ district: 'D-CURE' }, [[900, 60], [1000, 100]]);
  expect(all.length).toBeGreaterThan(3000); expect(boxed.length).toBeGreaterThan(40); expect(boxed.length).toBeLessThan(all.length / 20);
  for (const [x, z, nx, nz, side] of boxed) { expect(x).toBeGreaterThanOrEqual(900); expect(x).toBeLessThanOrEqual(1000); expect(Math.hypot(nx, nz)).toBeCloseTo(1, 6); expect([-1, 1]).toContain(side); expect(z).toBeGreaterThan(59); }
  expect(flare).toBeLessThan(.05); expect(litFloor).toBeGreaterThan(.05);
});
