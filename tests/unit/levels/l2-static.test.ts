import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
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
  // The L2 town at its W1 tier carries no burned facades, collapsed buildings, building fires or rubble.
  const [layout] = levelTwoLayouts([grove]), tier = compositions.L2.tier;
  expect(tier).toBe(1);
  const live = layout.placements.filter(p => p.minTier <= tier && p.maxTier >= tier).map(p => p.assetId);
  for (const banned of ['decay.burned-facade', 'decay.collapsed-facade', 'decay.rubble-pile', 'decay.crater']) expect(live).not.toContain(banned);
  expect(live).toContain('bld.supermarket'); expect(live).toContain('kit.police-checkpoint'); expect(live).toContain('bld.river-bridge');
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
