import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { applyL1Aftermath, clearOfL2Script, emptyAftermath, l1AftermathDressing, l1Canon, pavingAt, type L1Aftermath } from '../../../src/levels/continuity';
import { levelTwoLayouts } from '../../../src/levels/L2/layout';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { decodeSave } from '../../../src/sim/progression/Save';
import { newCampaign } from '../../../src/sim/progression/Campaign';
import { validAftermath } from '../../../src/sim/progression/carryover';
import { decayTwin, placementAssetId, worldAsset } from '../../../src/assets/worldDefinitions';
import { variantPath, type AssetDef } from '../../../src/assets/types';

/** Campaign continuity: the L1 aftermath in the L2 town (src/levels/continuity.ts). Static/unit level. */
const grove = () => JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
const manifest = new Map((JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[]).map(a => [a.id, a]));

test('T-CONT-10 @continuity L2 layout carries the burned annex (decay twin, lights off) and the canon dressing; L1 stays intact', () => {
  const [l2] = levelTwoLayouts([grove()]);
  const annex = l2.placements.find(p => p.id === l1Canon.annex.placement)!;
  expect(annex.decay).toBe('burned');
  expect(placementAssetId(annex)).toBe('bld.clinic-annex.burned');
  expect(l2.lightGroups.some(g => g.id === annex.lightGroup)).toBe(false);
  for (const d of l1AftermathDressing) expect(l2.placements.some(p => p.id === d.id && p.assetId === d.assetId), d.id).toBe(true);
  for (const r of l1Canon.annex.rubble) { expect(l2.placements.find(p => p.id === r.id)?.assetId).toBe('decay.rubble-pile'); expect(l2.colliders.some(c => c.id === r.id)).toBe(true); }
  // Decals sit on the kerbed paving, never under it.
  for (const p of l2.placements.filter(p => p.id.startsWith('carry-') && p.assetId.startsWith('decal.'))) expect(p.position[1]).toBeGreaterThan(pavingAt(l2, p.position[0], p.position[2]));
  // L1 itself (the source layout) is untouched: the annex explodes in L1, it is not born burned.
  const l1 = grove();
  expect(l1.placements.find(p => p.id === l1Canon.annex.placement)!.decay).toBeUndefined();
  expect(l1.placements.some(p => p.id.startsWith('carry-'))).toBe(false);
  // Other districts pass through unchanged.
  const other = { ...grove(), district: 'D-MAIN' } as DistrictLayout, count = other.placements.length;
  expect(applyL1Aftermath(other, null).placements.length).toBe(count);
});

test('T-CONT-11 @continuity the debris blocks nav cells in L2 but keeps the annex door, refuge door 47 and every objective reachable', () => {
  const l2 = new DistrictWorld(compositions.L2, levelTwoLayouts([grove()]), 1), l1 = new DistrictWorld(compositions.L1, [grove()], 1);
  for (const r of l1Canon.annex.rubble) {
    expect(l2.nav.walkable([r.x, r.z]), `${r.id} blocked in L2`).toBe(false);
    expect(l1.nav.walkable([r.x, r.z]), `${r.id} free in L1`).toBe(true);
  }
  const door = grove().anchors['refuge-door-47'].position, reached = l2.nav.flood(l2.playerStart);
  expect(reached[l2.nav.index(door[0], door[2])]).toBe(1);
  expect(l2.nav.hash).not.toBe(new DistrictWorld(compositions.L2, levelTwoLayouts([grove()]).map(l => ({ ...l, placements: l.placements.filter(p => !p.id.startsWith('carry-annex-rubble')), colliders: l.colliders.filter(c => !c.id.startsWith('carry-annex-rubble')) })), 1).nav.hash);
});

test('T-CONT-12 @continuity new assets: burned annex twin (3 runtime tiers), rubble pile (authored LODs), scorch decal', () => {
  const annex = manifest.get('bld.clinic-annex')!;
  expect(annex.decayVariants).toContain('burned');
  expect(decayTwin('bld.clinic-annex.burned')).toEqual({ base: 'bld.clinic-annex', decay: 'burned' });
  expect(worldAsset('bld.clinic-annex.burned')?.id).toBe('bld.clinic-annex');
  for (const path of [annex.glb, annex.lods!.lod1!, annex.lods!.lod2!]) expect(existsSync(variantPath(path, 'burned')), path).toBe(true);
  const rubble = manifest.get('decay.rubble-pile')!;
  expect(rubble.status).toBe('integrated');
  for (const path of [rubble.glb, rubble.lods!.lod1!, rubble.lods!.lod2!]) expect(existsSync(path), path).toBe(true);
  expect(existsSync(manifest.get('decal.scorch')!.decalTexture!)).toBe(true);
});

const sample = (): L1Aftermath => ({ version: 1, props: [{ id: 'D-GROVE/prop.trash-bin:12', p: [1, .4, 2], q: [0, 0, .7071, .7071] }], dumpsters: ['dumpster-1'], gatesClosed: ['gate-2'],
  bodies: [{ x: -20.5, z: 3.1, yaw: 1.2, model: 'npc.civilian-man-a', tint: '#c4473d' }], bike: { x: 30, z: 3, yaw: .5 } });
test('T-CONT-13 @continuity campaign save stores the player-caused L1 aftermath; malformed records and old saves', () => {
  expect(validAftermath(sample())).toBe(true);
  expect(validAftermath(emptyAftermath())).toBe(true);
  for (const bad of [{ ...sample(), version: 2 }, { ...sample(), dumpsters: ['car-1'] }, { ...sample(), bodies: [{ x: NaN, z: 0, yaw: 0, model: 'npc.a', tint: '#000000' }] }, { ...sample(), props: [{ id: 'D-MAIN/x', p: [0, 0, 0], q: [0, 0, 0, 1] }] }])
    expect(validAftermath(bad)).toBe(false);
  const save = newCampaign();
  expect(decodeSave(JSON.stringify(save)).status).toBe('ok');                          // old saves carry no world record
  expect(decodeSave(JSON.stringify({ ...save, world: { L1: sample() } })).status).toBe('ok');
  expect(decodeSave(JSON.stringify({ ...save, world: { L1: { version: 1 } } })).status).toBe('error');
  expect(decodeSave(JSON.stringify({ ...save, world: { L7: sample() } })).status).toBe('error');
});

test('T-CONT-14 @continuity player-caused statics never land on an L2 set piece (bike on the truck route is dropped)', () => {
  expect(clearOfL2Script({ x: -70.6, z: 33 })).toBe(false);      // truck route out of the bay
  expect(clearOfL2Script({ x: -50, z: -40 })).toBe(false);       // market doors
  expect(clearOfL2Script({ x: 80, z: 30 })).toBe(false);         // bridge checkpoint
  expect(clearOfL2Script({ x: 20, z: 10 })).toBe(true);
  const [onRoute] = levelTwoLayouts([grove()], { ...sample(), bike: { x: -30.6, z: 0, yaw: 0 } });
  expect(onRoute.placements.some(p => p.id === 'carry-bike')).toBe(false);
  const [parked] = levelTwoLayouts([grove()], sample());
  expect(parked.placements.find(p => p.id === 'carry-bike')?.assetId).toBe('veh.courier-bike');
});
