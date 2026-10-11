import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { l5 } from '../../src/data/l5';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { applyCampaign } from '../../src/sim/progression/apply';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { decodeSave, validateSave } from '../../src/sim/progression/Save';
import { preset } from '../../src/sim/progression/Campaign';
import { loadL5 } from '../../tools/sim-runner/l5Bots';
import { SimWorld } from '../../src/sim/world/SimWorld';

for (const tier of ['high', 'low'] as const) test(`@E23 @E23-AC04 @E23-AC15 @E23-AC16 station identities/state survive checkpoint and L6 handover, ${tier}`, async () => {
  const { world, mission } = await loadL5(7, tier);
  const next = new SimWorld();
  try {
    expect(world.infected!.active).toHaveLength(l5.infected.start[tier]);
    const alphas = world.infected!.active.filter(e => e.archetype === 'infected.alpha');
    expect(alphas).toHaveLength(2); expect(alphas.every(e => e.health.max === 300)).toBe(true);
    const ids = [...mission.state.l5!.stationIds];
    expect(ids).toHaveLength(24); expect(new Set(ids).size).toBe(24);
    const resident = world.entities.get(ids[3])!;
    resident.health.current = 37;
    mission.completeObjective('emerge');
    for (let i = 0; i < 2; i++) world.update();
    mission.checkpoint('outside');
    const saved = structuredClone(ids.map(id => world.entities.get(id)!));
    resident.health.current = 1;
    mission.restore();
    expect(mission.state.l5!.stationIds).toEqual(ids);
    expect(world.entities.get(ids[3])!.health.current).toBe(37);
    expect(world.entities.values().filter(e => ids.includes(e.id))).toHaveLength(24);
    expect(world.infected!.active.filter(e => e.archetype === 'infected.alpha')).toHaveLength(2);
    // Exercise both five rescued and zero rescued with the same existing station crowd.
    if (tier === 'low') for (const r of mission.state.l5!.survivors) world.entities.get(r.id)!.health.current = 0;
    world.update(); mission.completeObjective('look'); mission.completeObjective('metro');
    const result = mission.state.result!;
    const rescued = result.rescuedSurvivors!;
    expect(rescued).toHaveLength(tier === 'low' ? 0 : 5);
    expect(result.survivors).toEqual(rescued.map(e => e.civilian!.survivor!.key));
    expect(result.stationOccupants!.map(e => e.id)).toEqual(ids);
    const campaign = preset('L5-default');
    completeCampaignLevel(campaign, 5, result, world);
    expect(validateSave(campaign)).toBe(true);
    expect(decodeSave(JSON.stringify(campaign)).status).toBe('ok');
    await next.init();
    next.loadComposition(compositions.L6, [JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json', 'utf8'))], 7);
    next.infected!.director.setTier(tier); next.npcs!.setQuality(tier);
    applyCampaign(next, campaign);
    const carriedIds = [...ids, ...rescued.map(e => e.id)];
    expect(next.entities.values().some(e => carriedIds.includes(e.id))).toBe(false);
    const m6 = next.loadMission(resolveCampaignMission('L6', next.districts!)); m6.begin();
    expect(m6.state.l6!.survivors.map(r => r.id)).toEqual(carriedIds);
    for (const prior of rescued) { expect(next.entities.get(prior.id)!.health).toEqual(prior.health); expect(next.entities.get(prior.id)!.appearance).toEqual(prior.appearance); }
    for (const prior of saved) {
      const actual = next.entities.get(prior.id)!;
      expect(actual.health).toEqual(prior.health);
      expect(actual.appearance).toEqual(prior.appearance);
      expect(actual.civilian!.state).toBe(prior.civilian!.state);
      expect(actual.civilian!.story).toEqual(prior.civilian!.story);
      expect(actual.transform.x).toBeCloseTo(prior.transform.x - l5.metro.stationX);
      expect(actual.transform.z).toBeCloseTo(prior.transform.z - l5.metro.stationZ);
    }
    const newId = next.infected!.spawn('infected.runner', { x: -10, z: -6 });
    expect(ids).not.toContain(newId);
  } finally { world.dispose(); next.dispose(); }
}, 120_000);

test('@E23 @E23-AC01 L5 retains the carried racks instead of replacing them with its fallback arsenal', async () => {
  const world = new SimWorld();
  try {
    await world.init();
    const composition = compositions.L5;
    world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 7);
    const save = preset('L5-default');
    save.racks = { LEFT: ['weapon.bat', 'weapon.kick'], RIGHT: ['weapon.handgun', 'weapon.army-mg'] };
    applyCampaign(world, save);
    world.loadMission(resolveCampaignMission('L5', world.districts!)).begin();
    const weapons = world.entities.get(1)!.weapons!;
    expect(weapons.LEFT.rack.map(r => r.id)).toEqual(save.racks.LEFT);
    expect(weapons.RIGHT.rack.map(r => r.id)).toEqual(save.racks.RIGHT);
  } finally { world.dispose(); }
}, 120_000);


test('@E23 @E23-AC07 Alphas investigate nearby gunfire and acquire visible civilians without omniscience', async () => {
  const { world: w, mission } = await loadL5(3);
  try {
    mission.completeObjective('emerge');
    const ai = w.infected!;
    for (const e of [...ai.active]) ai.release(e);
    const shot = { x: -20, z: -38.2 };
    const player = w.entities.get(1)!;
    Object.assign(player.transform, shot); w.spatial.set(1, shot.x, shot.z);
    w.physics.playerBody!.setTranslation({ ...shot, y: player.transform.y }, true);
    const alpha = w.entities.get(ai.spawn('infected.alpha', { x: -5, z: shot.z }, { yaw: 0 }))!;
    w.update();
    expect(alpha.infected!.heardTargetId).toBe(0); expect(alpha.infected!.specialAttack).toBeUndefined();
    w.events.emit({ type: 'outbreak.distraction', tick: w.tick, id: 123, kind: 'gunfire', position: shot, radius: 30, until: w.tick + 600 });
    expect(alpha.infected!.investigate).toEqual(shot);
    for (let i = 0; i < 20; i++) w.update();
    expect(alpha.transform.x).toBeLessThan(-5);
    ai.release(alpha);
    const watcher = w.entities.get(ai.spawn('infected.alpha', { x: -5, z: shot.z }, { yaw: 0 }))!;
    const civilian = w.entities.get(mission.state.l5!.stationIds[0])!;
    Object.assign(civilian.transform, { x: -2, z: shot.z }); w.spatial.set(civilian.id, -2, shot.z);
    Object.assign(player.transform, { x: 3, z: shot.z }); w.spatial.set(1, 3, shot.z);
    w.physics.playerBody!.setTranslation({ x: 3, y: player.transform.y, z: shot.z }, true);
    w.update();
    expect(watcher.infected!.heardTargetId).toBe(civilian.id);
  } finally { w.dispose(); }
}, 120_000);
