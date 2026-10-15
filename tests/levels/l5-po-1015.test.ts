import { applyCampaign } from '../../src/sim/progression/apply';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { l5MusicReady } from '../../src/data/musicBeats';
import { afterEach, expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { l5, l5Survivors } from '../../src/data/l5';
import { LevelFiveBot } from '../../src/debug/bot/LevelFiveBot';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL5, runL5 } from '../../tools/sim-runner/l5Bots';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test('PO #21 @E23 @E23-AC08 @E23-AC09 survivor-2 restore: walking to the sound reveals survivors 3, 4 and 5, then reaches the ending', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const { mission } = loaded, w = world;
  runL5(w, mission, 'complete', { stopWhen: m => m.state.l5!.phase === 'search' });
  // The current cheapest bot tour finds Dale second. Recreate the PO/scene checkpoint
  // with Rosa and Sam found instead, using ordinary navigation and interaction.
  for (const key of ['rosa', 'sam']) {
    const ring = mission.def.anchors[`l5-ring-${key}`], protector = new LevelFiveBot(w, 'complete');
    for (let tick = 0; tick < 180 * 60 && mission.state.l5!.survivors.find(r => r.key === key)!.status === 'hidden'; tick++) {
      const input = protector.sample();
      w.applyInput(input.attackTarget ? input : { ...emptyInput(), moveTarget: { x: ring.x, z: ring.z }, walk: true, interact: distance(w.entities.get(1)!.transform, ring) <= l5.survivors.reachM }, 'keyboard'); w.update();
    }
    expect(mission.state.l5!.survivors.find(r => r.key === key)!.status).toBe('following');
  }
  expect(mission.state.l5!.found).toBe(2);
  expect(mission.state.checkpoint).toBe('survivor-2');
  mission.restore('survivor-2');
  const cues = new Map<string, { x: number; z: number }>();
  w.events.on('l5.cue', e => { if (e.type === 'l5.cue') cues.set(e.key, e.position); });
  // Follow the emitted position with the ordinary navigation input; no ring-coordinate shortcut.
  // The protector bot handles threats and the trip between hearing ranges.
  for (const count of [3, 4, 5]) {
    if (count === 3) {
      expect(mission.state.l5!.survivors.find(r => r.key === 'dale')!.status).toBe('hidden');
      const protector = new LevelFiveBot(w, 'complete');
      // Approach the PO's reported bus position, then follow Dale's emitted sound.
      // Keep the real protector's combat input while supplying this ordinary walk destination.
      for (let tick = 0; tick < 120 * 60 && !cues.has('dale'); tick++) {
        const input = protector.sample();
        w.applyInput(input.attackTarget ? input : { ...emptyInput(), moveTarget: { x: -8.25, z: .74 } }, 'keyboard'); w.update();
      }
      expect(mission.state.l5!.found).toBe(2);
    } else runL5(w, mission, 'complete', { maxSeconds: 240, stopWhen: m => m.state.l5!.found >= count || [...cues.keys()].some(key => m.state.l5!.survivors.find(r => r.key === key)?.status === 'hidden') });
    const hidden = mission.state.l5!.survivors.find(r => r.status === 'hidden' && cues.has(r.key) && (count !== 3 || r.key === 'dale'));
    expect(hidden, `heard survivor ${count}`).toBeDefined();
    const sound = cues.get(hidden!.key)!;
    const ring = mission.def.anchors[`l5-ring-${hidden!.key}`];
    expect(sound).toEqual({ x: ring.x, z: ring.z });
    for (let tick = 0; tick < 60 * 60 && mission.state.l5!.found < count; tick++) {
      w.applyInput({ ...emptyInput(), moveTarget: sound, interact: true }, 'keyboard'); w.update();
    }
    expect(mission.state.l5!.found, `find ${count} by walking to ${hidden!.key}'s sound`).toBe(count);
    const survivor = w.entities.get(hidden!.id)!;
    expect(survivor.hidden).toBe(false);
    expect(survivor.civilian!.survivor!.mode).toBe('follow');
    expect(distance(survivor.transform, sound)).toBeLessThanOrEqual(2.5);
  }
  const end = runL5(w, mission, 'complete', { maxSeconds: 300 });
  expect(end.outcome).toBe('complete');
}, 1_800_000);

test('PO #21 @E23 @E23-AC09 discovery is available from every reachable side within 2.5 m of each sound', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const { mission } = loaded, w = world;
  mission.completeObjective('emerge'); for (let i = 0; i < 661; i++) w.update();
  for (const e of [...w.infected!.active]) w.infected!.release(e);
  mission.checkpoint('outside');
  for (const def of l5Survivors) {
    let sides = 0;
    for (let angle = 0; angle < 8; angle++) {
      mission.restore('outside');
      const ring = mission.def.anchors[`l5-ring-${def.key}`];
      const p = { x: ring.x + 2.4 * Math.cos(angle * Math.PI / 4), z: ring.z + 2.4 * Math.sin(angle * Math.PI / 4) };
      if (!w.trapRescue!.reachable(p.x, p.z) || !w.infected!.nav.clear(p.x, p.z, .4)) continue;
      sides++;
      const player = w.entities.get(1)!; Object.assign(player.transform, p); Object.assign(w.previousPlayer!, player.transform);
      w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform); w.spatial.set(1, p.x, p.z);
      for (let tick = 0; tick < 61; tick++) w.update();
      expect(mission.state.l5!.survivors.find(r => r.key === def.key)!.status, `${def.key} side ${angle}`).toBe('following');
    }
    expect(sides, `${def.key} reachable sides`).toBeGreaterThan(0);
  }
}, 300_000);

test('PO #20b @E23 @E23-AC09 survivor-1 restore: Alpha at 15 m engages, follower reacts briefly and keeps following', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const { mission } = loaded, w = world;
  runL5(w, mission, 'complete', { stopWhen: m => m.state.checkpoint === 'survivor-1' });
  mission.restore('survivor-1');
  const alpha = w.infected!.active.find(e => e.archetype === 'infected.alpha')!;
  for (const e of [...w.infected!.active]) if (e.id !== alpha.id) w.infected!.release(e);
  const follower = w.entities.get(mission.state.l5!.survivors.find(r => r.status === 'following')!.id)!;
  // Open Harbor Street: Alpha 15 m from the protector, follower 2 m behind her.
  // Start inside the follow radius, with the protector between the human and threat.
  const place = (id: number, x: number, z: number) => {
    const e = w.entities.get(id)!; Object.assign(e.transform, { x, z }); w.spatial.set(id, x, z);
    if (id === 1) { w.physics.playerBody!.setTranslation(e.transform, true); w.physics.playerBody!.setNextKinematicTranslation(e.transform); Object.assign(w.previousPlayer!, e.transform); }
  };
  place(1, 10, -39); place(follower.id, 12, -39);
  expect(distance(follower.transform, w.entities.get(1)!.transform)).toBeLessThanOrEqual(l5.follow.maxM);
  const alphaId = alpha.id; place(alphaId, -5, -39); alpha.transform.yaw = 0;
  if (alpha.infected!.territory) Object.assign(alpha.infected!.territory, { x: -5, z: -39 });
  let reacted = false, resumed = -1, alerted = false, maxJump = 0;
  w.events.on('ai.alerted', e => { if (e.type === 'ai.alerted' && e.targetId === alphaId) alerted = true; });
  let previous = { ...follower.transform };
  for (let tick = 0; tick < 5 * 60; tick++) {
    // Once the reaction starts, the protector withdraws with ordinary walking input.
    // A stationary survivor already in her slot need not move merely to prove recovery.
    if (reacted) w.applyInput({ ...emptyInput(), move: { x: 1, z: 0 }, walk: true }, 'keyboard');
    w.update();
    reacted ||= follower.civilian!.survivor!.cover;
    if (reacted && !follower.civilian!.survivor!.cover && w.tick >= follower.civilian!.knockedUntil && distance(previous, follower.transform) > .001 && resumed < 0) resumed = tick;
    maxJump = Math.max(maxJump, distance(previous, follower.transform)); previous = { ...follower.transform };
    expect(distance(follower.transform, w.entities.get(1)!.transform)).toBeLessThanOrEqual(l5.follow.maxM);
  }
  expect(reacted).toBe(true); expect(resumed, JSON.stringify({ tick: w.tick, follower: follower.transform, fearUntil: follower.civilian!.survivor!.fearUntil, knockedUntil: follower.civilian!.knockedUntil })).toBeGreaterThanOrEqual(0); expect(resumed).toBeLessThan(5 * 60);
  expect(alerted).toBe(true);
  expect(distance(w.entities.get(alphaId)!.transform, { x: -5, z: -39 })).toBeGreaterThan(1);
  // Keep the protector between the threat and follower, at ordinary walking pace.
  for (let tick = 0; tick < 8 * 60; tick++) {
    w.applyInput({ ...emptyInput(), move: { x: 1, z: 0 }, walk: true }, 'keyboard'); w.update();
    maxJump = Math.max(maxJump, distance(previous, follower.transform)); previous = { ...follower.transform };
    expect(distance(follower.transform, w.entities.get(1)!.transform), JSON.stringify({ tick, follower: follower.transform, player: w.entities.get(1)!.transform, cover: follower.civilian!.survivor!.cover, knockedUntil: follower.civilian!.knockedUntil, now: w.tick })).toBeLessThanOrEqual(l5.follow.maxM);
  }
  expect(follower.civilian!.survivor!.mode).toBe('follow'); expect(maxJump).toBeLessThan(1);
}, 300_000);

test('PO #19c @E23 @E23-AC14 music follows the first find and survivor checkpoint restores, never elapsed time', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const { mission } = loaded, w = world;
  mission.completeObjective('emerge'); mission.l5!.advance(); mission.checkpoint('outside');
  mission.state.stats.time = 120;
  expect(l5MusicReady(mission.state)).toBe(false);
  runL5(w, mission, 'complete', { stopWhen: m => m.state.checkpoint === 'survivor-1' });
  expect(l5MusicReady(mission.state)).toBe(true);
  for (const id of ['survivor-1', 'survivor-2', 'survivor-3', 'survivor-4', 'survivor-5']) {
    runL5(w, mission, 'complete', { stopWhen: m => m.state.checkpoint === id });
    mission.restore(id); expect(l5MusicReady(mission.state), id).toBe(true);
  }
  mission.restore('outside'); expect(l5MusicReady(mission.state)).toBe(false);
}, 300_000);

test('PO #18 @E23 @E23-AC16 every L5 safe-space exit returns to its entry door, faces out and rejects occupied exit spots', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const { mission } = loaded, w = world;
  const doors = Object.entries(mission.def.anchors).filter(([name]) => name === 'l5-cellar-door');
  expect(doors).toHaveLength(1); // Metro is a one-way level handover, not a re-enterable safe space.
  for (const [, door] of doors) {
    const entry = { x: door.x, z: door.z, yaw: door.yaw ?? -Math.PI / 2 };
    // Reconstruct the PO's cellar checkpoint before pressing E at the brace.
    mission.restore('start');
    const blocker = w.infected!.spawn('infected.alpha', { x: entry.x + Math.cos(entry.yaw), z: entry.z - Math.sin(entry.yaw) });
    const brace = mission.def.anchors['l5-brace'], player = w.entities.get(1)!;
    Object.assign(player.transform, { x: brace.x, z: brace.z }); Object.assign(w.previousPlayer!, player.transform);
    w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    for (let tick = 0; tick < 75 && mission.state.l5!.phase === 'cellar'; tick++) {
      w.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); w.update();
    }
    expect(mission.state.l5!.phase).not.toBe('cellar');
    expect(distance(player.transform, entry)).toBeLessThanOrEqual(1.5);
    expect(Math.cos(player.transform.yaw) * Math.cos(entry.yaw) + Math.sin(player.transform.yaw) * Math.sin(entry.yaw)).toBeGreaterThan(.99);
    expect(w.infected!.nav.clear(player.transform.x, player.transform.z, .4)).toBe(true);
    expect(distance(player.transform, w.entities.get(blocker)!.transform)).toBeGreaterThanOrEqual((w.entities.get(blocker)!.combat?.radius ?? .8) + .35);
    mission.restore('outside'); expect(mission.state.l5!.phase).toBe('emerged');
    expect(distance(w.entities.get(1)!.transform, entry)).toBeLessThanOrEqual(1.5);
  }
}, 300_000);

test('PO #18 @E23 L4 records the doorway actually entered and carries it into L5', async () => {
  const loaded = await loadL4(1); world = loaded.world;
  const { mission } = loaded, w = world, save = w.progression!.campaign!;
  const door = mission.def.anchors['l4-cellar-door'];
  mission.l4!.completed('hide');
  expect(save.shelterEntry).toEqual({ x: door.x, z: door.z, yaw: -Math.PI / 2 });
  const carried = structuredClone(save); delete carried.shelterEntry;
  completeCampaignLevel(carried, 4, mission.state.stats, w);
  expect(carried.shelterEntry).toEqual(save.shelterEntry);
  w.dispose();
  const next = await loadL5(1); world = next.world;
  applyCampaign(next.world, carried);
  next.mission.completeObjective('emerge');
  expect(distance(next.world.entities.get(1)!.transform, carried.shelterEntry!)).toBeLessThanOrEqual(1.5);
}, 300_000);

test('PO #20b @E23 @E23-AC07 a visible player at 15 m is acquired beyond the former Alpha territory', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const { mission } = loaded, w = world;
  runL5(w, mission, 'complete', { stopWhen: m => m.state.checkpoint === 'survivor-1' });
  mission.restore('survivor-1');
  const alpha = w.infected!.active.find(e => e.archetype === 'infected.alpha')!;
  for (const e of [...w.infected!.active]) if (e.id !== alpha.id) w.infected!.release(e);
  const player = w.entities.get(1)!;
  Object.assign(player.transform, { x: 10, z: -39 }); Object.assign(w.previousPlayer!, player.transform);
  w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform); w.spatial.set(1, 10, -39);
  const follower = w.entities.get(mission.state.l5!.survivors.find(r => r.status === 'following')!.id)!;
  Object.assign(follower.transform, { x: 13, z: -39 }); w.spatial.set(follower.id, 13, -39);
  Object.assign(alpha.transform, { x: -5, z: -39, yaw: 0 }); w.spatial.set(alpha.id, -5, -39);
  if (alpha.infected!.territory) Object.assign(alpha.infected!.territory, { x: -5, z: -39 });
  const sight = { range: w.infected!.hearing.rangeM, weather: w.weather?.modifiers.infectedSight, light: w.lightPower?.sightMultiplier(player.transform), cone: w.infected!.hearing.inCone(alpha, player.transform), los: w.infected!.hearing.lineOfSight(alpha.transform, player.transform), health: alpha.health.current, state: alpha.infected!.state, yaw: alpha.transform.yaw };
  let acquired = false;
  w.events.on('ai.alerted', e => { if (e.type === 'ai.alerted' && e.targetId === alpha.id && e.sourceId === 1) acquired = true; });
  for (let tick = 0; tick < 180; tick++) w.update();
  expect(acquired, JSON.stringify(sight)).toBe(true);
  expect(distance(alpha.transform, { x: -5, z: -39 })).toBeGreaterThan(1);
}, 300_000);
