import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { districtAssetUrls } from '../../../src/assets/DistrictAssets';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { buildScene, validateSpec, type SceneSpec } from '../../../src/debug/scenelab/spec';
import { worldTiers, type DistrictLayout, type Tier } from '../../../src/levels/districts/types';
import { resolveDecay, validateLayout } from '../../../src/levels/districts/validate';
import { loadLayouts } from '../../../src/levels/layouts';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { AmbienceSchedule } from '../../../src/audio/AmbienceSchedule';
const assets = new Map((manifest as AssetDef[]).map(a => [a.id, a]));
function fixture(tier: Tier = 6) {
  return buildScene({ tier, ground: 'asphalt', size: 40, props: [{ id: 'wreck', asset: 'veh.military-truck', decay: 'wrecked', at: [6, 5] }], actors: [{ kind: 'courier', at: [-5, 0] }] }, assets);
}

test('T-E29-09-contract @E29-AC09 W0–W6 serialize exact layer ranges without extending W5 lifetimes', () => {
  const { layout } = fixture();
  layout.roads.nodes.push({ id: 'road', point: [0, 0] });
  layout.placements[0].allowRoad = false;
  const legacy = structuredClone(layout.placements[0]); legacy.id = 'ends-at-w5'; legacy.maxTier = 5;
  layout.placements.push(legacy);
  layout.colliders.push({ id: legacy.id, aabb: legacy.visualAabb, minTier: 0, maxTier: 5 });
  layout.placements[0].minTier = 6; layout.colliders[0].minTier = 6;
  layout.layers.push({ tier: 5, remove: ['old-canopy'], disableLights: [] }, { tier: 6, remove: ['last-canopy'], disableLights: ['scene-lab'] });
  expect(validateLayout(layout, worldAssets)).toEqual([]);
  const saved = JSON.parse(JSON.stringify(layout)) as DistrictLayout;
  for (const tier of worldTiers) expect(resolveDecay(saved, tier)).toEqual(resolveDecay(layout, tier));
  expect(resolveDecay(saved, 5).placements.map(p => p.id)).toEqual(['ends-at-w5']);
  const ruined = resolveDecay(saved, 6);
  expect(ruined.placements.map(p => p.id)).toEqual(['wreck']);
  expect(ruined.colliders.map(c => c.id)).toEqual(['wreck']);
  expect(ruined.removed).toEqual(['old-canopy', 'last-canopy']); expect(ruined.lights).toEqual([]);
  // Fairhaven's base geometry/anchors do not change as a side effect of tier loading.
  const fair = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
  expect(JSON.parse(JSON.stringify(fair)).anchors).toEqual(fair.anchors);
});

test('T-E29-09-validation @E29-AC09 W6 is accepted and invalid tiers/ranges/variants rejected', async () => {
  const { layout } = fixture();
  for (const value of [-1, 6.5, 7, NaN]) {
    const bad = structuredClone(layout); bad.placements[0].maxTier = value as Tier; bad.layers[0].tier = value as Tier; bad.lightGroups[0].offAt = value as Tier;
    expect(validateLayout(bad, worldAssets).join(' ')).toMatch(/invalid tier range.*invalid layer tier.*invalid light tier/);
    expect(validateSpec({ tier: value as Tier }, assets)).toHaveLength(1);
    expect(() => resolveDecay(layout, value as Tier)).toThrow('W0…W6');
    await expect(loadLayouts('D-RES', value as Tier, async () => layout)).rejects.toThrow('W0…W6');
  }
  const reversed = structuredClone(layout); reversed.colliders[0].minTier = 6; reversed.colliders[0].maxTier = 5;
  expect(validateLayout(reversed, worldAssets)).toContain('invalid tier range wreck');
  const unknown = structuredClone(layout); unknown.placements[0].decay = 'unreviewed-w6';
  expect(validateLayout(unknown, worldAssets)).toContain('unknown decay variant wreck:unreviewed-w6');
  const read = async (url: string) => JSON.parse(readFileSync(`public${url}`, 'utf8')) as unknown;
  const loaded = await loadLayouts('D-RES', 6, read);
  expect(loaded.composition.tier).toBe(6); expect(loaded.composition.timeOfDay).toBe('L6');
});

test('T-E29-09-scene @E29-AC09 W6 Scene Lab props retain visuals, compound collision and reviewed asset URLs', () => {
  const spec = JSON.parse(readFileSync('tests/scenes/l7-tier/after.json', 'utf8')) as SceneSpec;
  expect(validateSpec(spec, assets)).toEqual([]);
  const built = buildScene(spec, assets); const world = new DistrictWorld(built.composition, [built.layout], 1);
  expect(world.composition.tier).toBe(6);
  expect(world.districts[0].decay.placements).toHaveLength(spec.props!.length);
  expect(world.districts[0].decay.colliders.some(c => c.id.startsWith('wreck/geometry-'))).toBe(true);
  expect(world.nav.flood([-5, 0])[world.nav.index(5, 0)]).toBe(1);
  const definition = (id: string) => assets.get(id)!;
  expect(districtAssetUrls('veh.military-truck', definition, ['lod1'], 'wrecked')).toHaveLength(1);
  expect(new AmbienceSchedule(6, 1).update(10)?.cue).toMatch(/^ambient\./);
});
