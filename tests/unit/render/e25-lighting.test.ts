import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { buildLightTable, extractLights } from '../../../tools/assets/lights';
import { parseLight, spotGroundDistance, lightPalette } from '../../../src/data/lights';
import { LightField, footprint, fieldGain } from '../../../src/render/LightField';
import { anchorsFor, layoutLights, placeAnchor } from '../../../src/render/WorldLights';
import { timeOfDay } from '../../../src/data/timeOfDay';
import { compositions } from '../../../src/levels/compositions';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import type { DistrictLayout } from '../../../src/levels/districts/types';

test('T-E25-02 @E25 @E25-AC02 every light:* anchor in the shipped GLBs parses into a valid ss_light and the runtime table is current', () => {
  const { table, errors, unreferenced } = buildLightTable();
  expect(errors).toEqual([]); expect(unreferenced).toEqual({});
  expect(Object.values(table).flat().length).toBeGreaterThanOrEqual(284);
  expect(Object.keys(table).length).toBeGreaterThanOrEqual(68);
  // The committed runtime table is exactly what the tool extracts (npm run assets:lights).
  expect(JSON.parse(readFileSync('src/data/lightAnchors.json', 'utf8'))).toEqual(JSON.parse(JSON.stringify(table)));
  for (const anchor of Object.values(table).flat()) {
    expect(anchor.color in lightPalette).toBe(true);
    expect(anchor.intensity).toBeGreaterThanOrEqual(0); expect(anchor.intensity).toBeLessThanOrEqual(10);
    if (anchor.type === 'spot') expect(spotGroundDistance(anchor)).toBeLessThanOrEqual(anchor.range);
  }
});

test('T-E25-02b @E25 @E25-AC02 the validator rejects §6 violations: tokens, intensity, sky-pointing spots, missing emissive nodes', () => {
  const ok = parseLight('light:a', JSON.stringify({ type: 'spot', color: 'light_led_white', intensity: 6, range: 24, angle: 48 }), [0, 6, 0], [0, -.7, .7]);
  expect(ok.errors).toEqual([]); expect(ok.anchor).toMatchObject({ pool: true, shadow: 'none', powerGroup: 'self' });
  expect(parseLight('light:b', { type: 'point', color: '#ff0000', intensity: 2, range: 3 }, [0, 2, 0], [0, -1, 0]).errors.join()).toMatch(/palette token/);
  expect(parseLight('light:c', { type: 'point', color: 'light_fire', intensity: 12, range: 3 }, [0, 2, 0], [0, -1, 0]).errors.join()).toMatch(/0\.\.10/);
  expect(parseLight('light:d', { type: 'spot', color: 'light_fire', intensity: 2, range: 10, angle: 30 }, [0, 2, 0], [0, 1, 0]).errors.join()).toMatch(/ground/);
  expect(parseLight('light:e', '{not json', [0, 0, 0], [0, -1, 0]).errors.join()).toMatch(/JSON/);
  // Anchor nested under a translated, rotated parent; its emissive mesh is missing and another emi_ mesh is unreferenced.
  const gltf = { scene: 0, scenes: [{ nodes: [0] }], materials: [{ name: 'emi_windowGlow' }], meshes: [{ primitives: [{ material: 0 }] }],
    nodes: [{ name: 'root', translation: [1, 0, 0], rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2], children: [1, 2] },
      { name: 'light:x', translation: [0, 3, 2], extras: { ss_light: { type: 'point', color: 'light_sodium', intensity: 3, range: 6, emissiveNodes: ['lamp'] } } },
      { name: 'glow', mesh: 0 }] };
  const result = extractLights(gltf);
  expect(result.anchors[0].position).toEqual([3, 3, 0]); expect(result.anchors[0].direction).toEqual([0, -1, 0]);
  expect(result.errors.join()).toMatch(/lamp is missing/); expect(result.unreferencedEmissive).toEqual(['glow']);
});

test('T-E25-U1 @E25 layout assembly places authored lights in world space and follows decay power groups', () => {
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-MAIN.layout.json', 'utf8')) as DistrictLayout;
  const lamp = anchorsFor('prop.street-lamp')[0];
  expect(lamp).toMatchObject({ type: 'point', color: 'light_sodium', position: [0, 3.18, 0] });
  expect(placeAnchor({ ...lamp, position: [1, 2, 0], direction: [1, 0, 0] }, [10, 0, 5], Math.PI / 2).position.map(v => +v.toFixed(6))).toEqual([10, 2, 4]);
  const day = layoutLights(new DistrictWorld({ ...compositions['D-MAIN'], tier: 0 }, [layout], 1));
  const lamps = layout.placements.filter(p => p.assetId === 'prop.street-lamp' && p.minTier === 0);
  expect(day.length).toBeGreaterThanOrEqual(lamps.length); expect(day.every(l => l.on)).toBe(true);
  const placed = lamps[0], pool = day.find(l => Math.hypot(l.x - placed.position[0], l.z - placed.position[2]) < .01)!;
  expect(pool.r).toBeGreaterThan(pool.b); expect(pool.hero).toBe(true);
  // W5 turns every block's power off: pools stay registered but dark.
  const w5 = layoutLights(new DistrictWorld({ ...compositions['D-MAIN'], tier: 5 }, [layout], 1));
  expect(w5.filter(l => l.on && l.flicker !== 1).length).toBe(0);
});

test('T-E25-U2 @E25 light field budget, spot footprints and the E27 transient hook', () => {
  const field = new LightField(); field.strength.value = 1;
  const spot = footprint({ type: 'spot', color: 'light_led_white', intensity: 6, range: 24, angle: 48, flicker: 'none', position: [0, 6, 0], direction: [0, -.6, .8] });
  expect(spot.aimZ).toBeGreaterThan(3); expect(spot.stretch).toBeGreaterThan(1); expect(spot.r).toBeCloseTo(6 * fieldGain, 1);
  field.setStatic(Array.from({ length: 900 }, (_, i) => footprint({ type: 'point', color: 'light_sodium', intensity: 3, range: 6, flicker: 'none', position: [(i % 30) * 2 - 30, 3, Math.floor(i / 30) * 2 - 30], direction: [0, -1, 0] })));
  field.update(0, 0, 0); expect(field.snapshot().drawn).toBe(512);
  field.setQuality('low'); field.update(0, 0, 0); expect(field.snapshot()).toMatchObject({ drawn: 256, resolution: 512, size: 60 });
  field.setStatic([]); field.update(0, 0, 10); field.addTransient({ x: 1, z: 1 }, 'light_fire', 8, 4, 1);
  field.update(0, 0, 10.5); expect(field.snapshot().drawn).toBe(1);
  field.update(0, 0, 11.1); expect(field.snapshot()).toMatchObject({ drawn: 0, transients: 0 });
  const forever = field.addTransient({ x: 1, z: 1 }, '#ff7a1a', 8, 4, Infinity);
  field.update(0, 0, 50); expect(field.snapshot().transients).toBe(1); forever.remove(); field.update(0, 0, 51); expect(field.snapshot().transients).toBe(0);
  field.strength.value = 0; field.addTransient({ x: 1, z: 1 }, 'light_fire', 8, 4, 5); field.update(0, 0, 60); expect(field.snapshot().drawn).toBe(0);
  field.dispose();
});

test('T-E25-U3 @E25 level moods: morning, midday and afternoon skip the field; dusk and night are lit and readable', () => {
  expect(['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].map(id => compositions[id].timeOfDay)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
  for (const id of ['L1', 'L2', 'L3'] as const) expect(timeOfDay[id].practical ?? 0).toBe(0);
  for (const id of ['L5', 'L6', 'night'] as const) { expect(timeOfDay[id].practical).toBeGreaterThan(.5); expect(timeOfDay[id].rim).toBeGreaterThan(0); expect(timeOfDay[id].aura).toBeGreaterThan(0); }
  expect(compositions['night-street'].timeOfDay).toBe('night');
});
