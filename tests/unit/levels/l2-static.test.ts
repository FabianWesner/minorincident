import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { l2, l2Anchors, l2Station, stationPoint } from '../../../src/data/l2';
import { timeOfDay } from '../../../src/data/timeOfDay';
import { l2Dressing, levelTwoLayouts } from '../../../src/levels/L2/layout';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout } from '../../../src/levels/districts/types';

/** E20 static criteria: the W1 dressing manifest and the midday light preset. */
const manifest = new Set((JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string }[]).map(a => a.id));
const grove = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
const count = (kinds: string[]) => l2Dressing.filter(d => kinds.includes(d.kind)).reduce((n, d) => n + (d.count ?? 1), 0);

test('T-E20-15 @E20 @E20-AC15 W1 dressing manifest: section 5.7 minimum counts, exactly one smoking vehicle, nothing post-apocalyptic', () => {
  expect(count(['corpse'])).toBeGreaterThanOrEqual(6);
  expect(count(['abandoned', 'crashed', 'smoking'])).toBeGreaterThanOrEqual(8);
  expect(count(['crashed'])).toBeGreaterThanOrEqual(3);
  expect(count(['bin'])).toBeGreaterThanOrEqual(10);
  expect(count(['belongings'])).toBeGreaterThanOrEqual(6);
  expect(count(['broken-window'])).toBeGreaterThanOrEqual(4);
  expect(l2Dressing.filter(d => d.assetId === 'decal.blood-trail').length).toBeGreaterThanOrEqual(4);
  expect(l2Dressing.filter(d => d.kind === 'emergency' && d.lit).length).toBeGreaterThanOrEqual(2);
  expect(count(['smoking'])).toBe(1);
  expect(count(['fighting'])).toBeGreaterThanOrEqual(1);
  // Every referenced id is a manifest asset (non-integrated ones render as registry placeholders).
  for (const d of l2Dressing) expect(manifest.has(d.assetId), d.assetId).toBe(true);
  // The L2 town at its W1 tier carries no generic burned facades, collapsed buildings, building fires or rubble. The one
  // exception is the L1 story carryover (PO 2026-10-08): the annex the lab blast burned, with its debris (`carry-*` ids).
  const [layout] = levelTwoLayouts([grove]), tier = compositions.L2.tier;
  expect(tier).toBe(1);
  const inTier = layout.placements.filter(p => p.minTier <= tier && p.maxTier >= tier), live = inTier.filter(p => !p.id.startsWith('carry-')).map(p => p.assetId);
  for (const banned of ['decay.burned-facade', 'decay.collapsed-facade', 'decay.rubble-pile', 'decay.crater']) expect(live).not.toContain(banned);
  expect(inTier.filter(p => p.decay).map(p => p.id)).toEqual(['bld.clinic-annex:822']);
  for (const p of inTier.filter(p => p.id.startsWith('carry-annex'))) expect(Math.hypot(p.position[0] - 66, p.position[2] + 15)).toBeLessThan(8);
  expect(live).toContain('bld.supermarket'); expect(live).toContain('veh.police-suv'); expect(live).toContain('prop.barricade'); expect(live).toContain('bld.river-bridge');
});

test('T-E20-16 @E20 @E20-AC16 midday preset: high sun (polar <= 0.40, >= 0.30 above L1) and a probe shadow <= 0.6x the L1 length', () => {
  expect(compositions.L2.timeOfDay).toBe('L2');
  expect(timeOfDay.L2.polar).toBeLessThanOrEqual(.4);
  expect(timeOfDay.L2.polar).toBeLessThanOrEqual(timeOfDay.L1.polar - .3);
  // Ground shadow of a vertical 1.8 m probe under a directional sun at polar angle p (from the zenith): 1.8 tan p.
  const shadow = (polar: number) => 1.8 * Math.tan(polar);
  expect(shadow(timeOfDay.L2.polar) / shadow(timeOfDay.L1.polar)).toBeLessThanOrEqual(.6);
  expect(timeOfDay.L2.intensity).toBeGreaterThan(timeOfDay.L1.intensity);
});

test('T-E20-01 @E20 L2 starts where L1 ends: the station frame is the D-GROVE Fire Station 3 placement, the L2 copy removes what it replaces, the ambush doors stay by the market', () => {
  const station = grove.placements.filter(p => p.assetId === 'bld.fire-station');
  expect(station).toHaveLength(1);
  expect(station[0].position[0]).toBeCloseTo(l2Station.x, 2); expect(station[0].position[2]).toBeCloseTo(l2Station.z, 2); expect(station[0].yaw).toBeCloseTo(l2Station.yaw, 3);
  // The L1 completion trigger lies in the bay the L2 station-local frame describes (right bay, 1.2 m inside).
  const [tx, tz] = stationPoint(.4, -1.23), trigger = grove.anchors['fire-bay-trigger'].position;
  expect(Math.hypot(trigger[0] - tx, trigger[2] - tz)).toBeLessThan(.05);
  // Superseded placements are matched by asset and position: all ten (four at the market, the roadwork kit and five fences at the closing gate) still find their placement (no silent no-op after a rebuild).
  const [layout] = levelTwoLayouts([grove]);
  expect(grove.placements.length - layout.placements.filter(p => !p.id.startsWith('l2-') && !p.id.startsWith('carry-')).length).toBe(10);
  // The three ambush doors are the same physical doors as when L2 was tuned (door numbers follow the layout's door order).
  const expected = [[-76.65, -37.5], [-19.62, -35], [-50.82, -4]];
  for (const [i, [door]] of l2.rescue.ambushDoors.entries()) { const p = grove.anchors[door].position; expect(Math.hypot(p[0] - expected[i][0], p[2] - expected[i][1]), door).toBeLessThan(.05); }
  expect(l2Anchors['l2-start']).toBeDefined();
});
