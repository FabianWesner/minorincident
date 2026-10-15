import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { moveAgent } from '../../src/sim/locomotion/AgentMotion';
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

for (const tier of ['high', 'low'] as const) test(`@E23 @E23-AC04 Alphas stay in town away from the Metro and final escort leg, ${tier}`, async () => {
  const { world, mission } = await loadL5(1, tier);
  try {
    const door = mission.def.anchors['l5-metro-shutter'];
    const alphas = world.infected!.active.filter(e => e.archetype === 'infected.alpha');
    expect(alphas).toHaveLength(2);
    for (const e of alphas) {
      const home = e.infected!.territory!;
      expect(home).toBeDefined();
      expect(Math.hypot(home.x - door.x, home.z - door.z) - home.radius - e.combat!.radius).toBeGreaterThan(25);
      // The last leg follows Metro Road (z=-37.6) east from the plaza, then enters the stairs.
      const legX = Math.max(-20, Math.min(door.x, home.x));
      expect(Math.hypot(home.x - legX, home.z + 37.6) - home.radius).toBeGreaterThan(8);
      // Even a charge impulse cannot leave its town encounter; retreat remains possible.
      Object.assign(e.transform, { x: home.x, z: home.z - home.radius + .05 });
      moveAgent(e, 0, -18, world.infected!.nav, world.tick, e.combat!.radius, true);
      expect(Math.hypot(e.transform.x - home.x, e.transform.z - home.z)).toBeLessThanOrEqual(home.radius);
      world.tick++;
      moveAgent(e, 0, 3, world.infected!.nav, world.tick, e.combat!.radius, true);
      expect(e.transform.z).toBeGreaterThan(home.z - home.radius + .05);
    }
    mission.checkpoint('outside');
    const territories = alphas.map(e => structuredClone(e.infected!.territory));
    delete alphas[0].infected!.territory;
    mission.restore();
    expect(alphas.map(e => world.entities.get(e.id)!.infected!.territory)).toEqual(territories);
  } finally { world.dispose(); }
}, 120_000);

test('@E23 @E23-AC15 nearby infected do not stall ingress; the descending shutter sweeps intruders out and blocks return', async () => {
  const { world: w, mission: m } = await loadL5(1);
  try {
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    m.completeObjective('emerge'); m.completeObjective('look');
    const door = m.def.anchors['l5-metro-shutter'];
    const player = w.entities.get(1)!;
    Object.assign(player.transform, { x: door.x, z: door.z - 2 });
    w.physics.playerBody!.setTranslation(player.transform, true);
    w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    w.spatial.set(1, player.transform.x, player.transform.z);
    const followers = m.state.l5!.survivors.map(r => w.entities.get(r.id)!);
    followers.forEach((e, i) => {
      Object.assign(e.transform, { x: door.x + (i % 2 ? .4 : -.4), z: door.z + .7 + i * .5 });
      w.spatial.set(e.id, e.transform.x, e.transform.z);
    });
    const enemy = w.entities.get(w.infected!.spawn('infected.alpha', { x: door.x, z: door.z - 1 }))!;
    // Keep the intruder stationary to isolate shelter entry from combat damage.
    enemy.combat!.staggerUntil = w.tick + 900;
    for (let i = 0; i < 600 && !m.state.l5!.shutterAt; i++) w.update();
    expect(m.state.l5!.shutterAt).toBeGreaterThan(0);
    expect(followers.every(e => m.l5!.insideStation(e.transform))).toBe(true);
    expect(enemy.transform.z).toBeGreaterThan(door.z + enemy.combat!.radius);
    expect(w.infected!.nav.clear(door.x, door.z, .35)).toBe(false);
    const before = enemy.transform.z;
    for (let i = 0; i < 20; i++) {
      moveAgent(enemy, 0, -18, w.infected!.nav, ++w.tick, enemy.combat!.radius, true);
    }
    expect(enemy.transform.z).toBeGreaterThanOrEqual(before - .051);
    for (let i = 0; i < 180; i++) w.update();
    expect(m.state.gates['l5-metro-shutter']).toBe(false);
    expect(m.state.phase).toBe('progression');
    expect(m.state.result!.survivors).toHaveLength(5);
  } finally { w.dispose(); }
}, 120_000);

test('@E23 @E23-AC15 the five survivors cross the Metro opening from the real-input group photo', async () => {
  const { world: w, mission: m } = await loadL5(1);
  try {
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    m.completeObjective('emerge'); m.completeObjective('look');
    // The lookout has left his post in the recorded real-input run. His body
    // must not be needed to push followers out of a doorway crowd jam.
    w.entities.delete(m.state.l5!.lookoutId); w.spatial.delete(m.state.l5!.lookoutId);
    const player = w.entities.get(1)!;
    Object.assign(player.transform, { x: 37.78496170043945, z: -50.62974166870117 });
    w.physics.playerBody!.setTranslation(player.transform, true);
    w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    w.spatial.set(1, player.transform.x, player.transform.z);
    const corgi = w.entities.values().find(e => e.companion)!;
    Object.assign(corgi.transform, { x: 37.77191, z: -49.34055, y: .975 });
    Object.assign(corgi.companion!, { state: 'follow', following: false, velocity: { x: 0, z: 0 }, pickup: null });
    w.spatial.set(corgi.id, corgi.transform.x, corgi.transform.z);
    // Positions observed while the real-input run waited at the stairs: no intruder
    // or separation impulse should be needed to push a living person through.
    const positions = [[38.25599, -47.54761], [37.20675, -48.27262], [37.75909, -48.02834], [37.21383, -47.56967], [38.38523, -48.24918]];
    const velocities = [[-1.0346, -3.6564], [.5111, -.7021], [1.0120, -3.6628], [.3231, -3.7862], [-.5527, -.7936]];
    m.state.l5!.survivors.forEach((r, i) => {
      const e = w.entities.get(r.id)!;
      // The real input tour finds Rosa/Sam first, not the cheat's data order.
      // Earlier arrivals must not park in the opening ahead of later followers.
      r.foundAt = ['rosa', 'sam', 'mia', 'okafor', 'dale'].indexOf(r.key) + 1;
      Object.assign(e.transform, { x: positions[i][0], z: positions[i][1] });
      e.locomotion = { vx: velocities[i][0], vz: velocities[i][1], ax: 0, az: 0, omega: 0, updatedAt: w.tick - 1 };
      w.spatial.set(e.id, e.transform.x, e.transform.z);
    });
    for (let i = 0; i < 1200 && !m.state.l5!.doneAt; i++) w.update();
    expect(m.state.l5!.shutterAt).toBeGreaterThan(0);
    expect(m.state.result!.survivors).toHaveLength(5);
  } finally { w.dispose(); }
}, 120_000);

test('@E23 @E23-AC11 @E23-AC15 a survivor turning during shutter closure cannot corrupt the L6 save', async () => {
  const { world: w, mission: m } = await loadL5(1);
  try {
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    m.completeObjective('emerge'); m.completeObjective('look');
    const door = m.def.anchors['l5-metro-shutter'], player = w.entities.get(1)!;
    Object.assign(player.transform, { x: door.x, z: door.z - 4 });
    w.physics.playerBody!.setTranslation(player.transform, true);
    w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    w.spatial.set(1, player.transform.x, player.transform.z);
    m.state.l5!.survivors.forEach((r, i) => {
      const e = w.entities.get(r.id)!;
      Object.assign(e.transform, { x: door.x + (i % 2 ? .4 : -.4), z: door.z - 1.4 - Math.floor(i / 2) });
      w.spatial.set(e.id, e.transform.x, e.transform.z);
    });
    for (let i = 0; i < 600 && !m.state.l5!.shutterAt; i++) w.update();
    expect(m.state.l5!.shutterAt).toBeGreaterThan(0);
    const victim = w.entities.get(m.state.l5!.survivors[0].id)!;
    w.npcs!.civilians.outbreak!.turnNow(victim);
    // Include the existing five-second action run-out: the new infected is engaged.
    for (let i = 0; i < 600 && m.state.phase === 'playing'; i++) w.update();
    expect(m.state.phase).toBe('progression');
    expect(m.state.l5!.survivors[0].status).toBe('turned');
    expect(m.state.result!.survivors).not.toContain('dale');
    const save = preset('L5-default'); completeCampaignLevel(save, 5, m.state.result!, w);
    expect(validateSave(save)).toBe(true);
    expect(decodeSave(JSON.stringify(save)).status).toBe('ok');
  } finally { w.dispose(); }
}, 120_000);
