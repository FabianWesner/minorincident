import { readFileSync, existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { l5Fires } from '../../../src/data/l5';
import { l7Rocket } from '../../../src/data/l7';
import { levelFiveLayouts, l5ShellAssets } from '../../../src/levels/L5/layout';
import { levelSevenLayouts, l7Exit, l7Fires, l7StreetDamage, l7Contains } from '../../../src/levels/L7/layout';
import { resolveDecay, validateLayout, inside } from '../../../src/levels/districts/validate';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { compositions } from '../../../src/levels/compositions';
const base = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
const [w5] = levelFiveLayouts([base]), [w6] = levelSevenLayouts([base]);
test('T-E29-09-district @E29-AC09 W6 explicitly retains Fairhaven landmarks and reviewed W5 derivatives', () => {
  // Runtime dressing shares L5's intentional road placements; validate the
  // W6 shell/layer schema independently of those base-export road rules.
  const contract = { ...w6, placements: w6.placements.filter(p => l5ShellAssets.includes(p.assetId) && !p.id.startsWith('l7-')) };
  expect(validateLayout(contract, worldAssets)).toEqual([]);
  expect(base.layers.some(l => l.tier === 6)).toBe(false);
  const retained = resolveDecay(w6, 6);
  for (const p of w5.placements.filter(p => l5ShellAssets.includes(p.assetId))) {
    const twin = retained.placements.find(v => v.id === p.id)!;
    expect(twin).toBeDefined();
    expect(twin.position).toEqual(p.position); expect(twin.yaw).toBe(p.yaw);
    expect(twin.scale).toEqual(p.scale); expect(twin.visualAabb).toEqual(p.visualAabb);
    expect(twin.decay).toBe('w6');
  }
  for (const name of ['pair-plaza', 'pair-harbor-street', 'pair-metro-entrance', 'pair-kessler-lane']) expect(w6.anchors[name]).toEqual(w5.anchors[name]);
  for (const id of l5ShellAssets) for (const suffix of ['', '.lod1', '.lod2']) expect(existsSync(`public/assets/models/${id}.w6${suffix}.glb`)).toBe(true);
  expect(existsSync('public/assets/layouts/D-FAIR.w6.glb')).toBe(true);
  const saved = JSON.parse(JSON.stringify(w6)) as DistrictLayout;
  expect(resolveDecay(saved, 6)).toEqual(retained);
  for (let tier = 0; tier <= 5; tier++) expect(resolveDecay(JSON.parse(JSON.stringify(base)), tier as 0)).toEqual(resolveDecay(base, tier as 0));
});
test('T-E29-10-district @E29-AC10 heavier dressing, dead defenses and passable Northgate branches', () => {
  const retained = resolveDecay(w6, 6), before = resolveDecay(w5, 5);
  const military = (p: typeof retained.placements[number]) => /veh\.(military|tank)/.test(p.assetId);
  const collapse = (p: typeof retained.placements[number]) => p.assetId === 'decay.collapsed-facade';
  expect(retained.placements.filter(military).length).toBeGreaterThan(before.placements.filter(military).length);
  expect(retained.placements.filter(military).length).toBeGreaterThanOrEqual(6);
  expect(retained.placements.filter(collapse).length).toBeGreaterThanOrEqual(8);
  const stress = JSON.parse(readFileSync('tests/scenes/l7-district/stress.json', 'utf8'));
  expect(stress.script.map((s: { effect: { fire: number[]; radius: number } }) => ({ at: s.effect.fire, r: s.effect.radius }))).toEqual(l7Fires.map(f => ({ at: f.at, r: f.r })));
  expect(l7Fires.length).toBeGreaterThan(l5Fires.length); expect(l7Fires.length).toBeGreaterThanOrEqual(12);
  expect(l7Fires.filter(f => f.deep).length).toBeGreaterThanOrEqual(6);
  expect(l7StreetDamage.length).toBeGreaterThanOrEqual(4);
  expect(retained.lights).toEqual([]);
  expect(retained.placements.some(p => p.assetId === 'prop.hmg-nest' || p.id === 'l5-station')).toBe(false);
  for (let x = -90; x <= 295; x += 2.5) for (let z = -70; z <= 70; z += 2.5) expect(l7Contains(x, z)).toBe(inside([x, z], w6.bounds));
  const world = new DistrictWorld(compositions.L7, [w6], 29);
  expect(world.playerStart).toEqual([l7Exit.position[0], l7Exit.position[2]]);
  const reached = world.nav.flood(world.playerStart);
  for (const point of [[88, -40], [88, 46], [50, -40], [50, 46]]) expect(reached[world.nav.index(...point as [number, number])], `route ${point}`).toBe(1);
  for (const [x, z] of l7StreetDamage) expect(reached[world.nav.index(x, z)]).toBe(1);
  const wreck = retained.placements.find(p => p.id === 'l7-rocket-wreck')!;
  expect(wreck.assetId).toBe(l7Rocket.vehicle); expect(wreck.decay).toBe('wrecked');
  const rocket = w6.anchors['l7-rocket'].position;
  expect(Math.hypot(rocket[0] - l7Exit.position[0], rocket[2] - l7Exit.position[2])).toBeLessThanOrEqual(5);
  expect(reached[world.nav.index(rocket[0], rocket[2])]).toBe(1);
});

test('T-E29-10-fires @E29-AC10 production district installs persistent fires and shared rocket hooks', async () => {
  const { SimWorld } = await import('../../../src/sim/world/SimWorld');
  const world = new SimWorld(); await world.init();
  try {
    world.loadComposition(compositions.L7, [base], 29);
    const fires = world.entities.values().filter(e => e.hazard?.kind === 'fire');
    expect(fires).toHaveLength(l7Fires.length);
    expect(fires.every(e => e.hazard!.activeUntil >= 7200 * 60)).toBe(true);
    expect(world.entities.values().filter(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === l7Rocket.action)).toHaveLength(1);
    const wreck = world.districts!.districts[0].decay.placements.find(p => p.id === 'l7-rocket-wreck')!;
    expect(world.districts!.districts[0].decay.colliders.some(c => c.id.startsWith(wreck.id + '/'))).toBe(true);
    expect(world.districts!.groundHeight(l7Exit.position[0], l7Exit.position[2])).toBe(l7Exit.position[1]);
    const pickup = world.entities.values().find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === l7Rocket.action)!;
    expect(pickup.transform.y).toBeCloseTo(l7Exit.position[1] + .15);
    expect(world.weather!.timeline[0].kind).toBe('ash');
  } finally { world.dispose(); }
});

test('T-E29-09-assets @E29-AC09 W6 deliveries satisfy the existing geometry and LOD contracts', async () => {
  const { validateAssets } = await import('../../../tools/assets/validate');
  const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as import('../../../src/assets/types').AssetDef[];
  const reports = await validateAssets(manifest.filter(a => l5ShellAssets.includes(a.id)));
  const variants = reports.filter(r => /\.w6:lod[012]$/.test(r.id));
  expect(variants).toHaveLength(21);
  expect(variants.flatMap(r => r.errors.map(error => `${r.id}: ${error}`))).toEqual([]);
}, 120_000);
