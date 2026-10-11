import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { Mission } from '../../src/sim/missions/Mission';
import { LevelFiveBot, type L5Profile } from '../../src/debug/bot/LevelFiveBot';
import { followFrustum } from './l3Bots';

/** E23 L5 single-seed pass (specs/epic-23 section 8; PO 10-09: no bot batteries). Bots write only InputFrames: no teleports, loadout injection or cheats. */
export interface L5Report {
  profile: L5Profile; seed: number; outcome: 'complete' | 'timeout';
  simSeconds: number; deaths: number; kills: number; knockdowns: number; damage: number;
  timeline: { type: string; t: number }[];
  /** Survivors: keys found (in order) with the time, fates at the end. */
  found: { key: string; t: number }[]; fates: Record<string, string>; rescued: number; rescuedKeys: string[];
  maxConcurrent: number; infectedAtStart: number; maxGroup: number;
  /** Follow metrics (non-combat time): share of ticks every living follower was within 8 m, the largest one-tick jump of any follower. */
  followShare: number; maxFollowerJump: number; lost: { key: string; cause: string; t: number }[];
  deathsAt: string[]; gunshots: number;
  /** E20-AC11-style omniscience audit, plus the director: queued requests and infected that appeared out of nowhere (neither at the start nor a turned person). */
  audit: { sightViolations: number; nonSightAlerts: number; directorQueueMax: number; newInfected: number };
}
export async function loadL5(seed: number, tier: 'high' | 'low' = 'high', progression = true): Promise<{ world: SimWorld; mission: Mission }> {
  const world = new SimWorld(); await world.init();
  const composition = compositions.L5;
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
  if (tier === 'low') { world.infected!.director.setTier('low'); world.npcs!.setQuality('low'); }
  if (progression) applyCampaign(world, preset('L5-default'));
  const mission = world.loadMission(resolveCampaignMission('L5', world.districts!)); mission.begin();
  return { world, mission };
}
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export function runL5(world: SimWorld, mission: Mission, profile: L5Profile, opts: { seed?: number; maxSeconds?: number; stopWhen?: (m: Mission) => boolean; god?: boolean; each?: (tick: number) => void } = {}): L5Report {
  const bot = new LevelFiveBot(world, profile), maxTicks = (opts.maxSeconds ?? 600) * 60, start = world.tick;
  if (opts.god) world.combat!.damage.god = true;
  const timeline: L5Report['timeline'] = [], found: L5Report['found'] = [], lost: L5Report['lost'] = [], deathsAt: string[] = [];
  const audit = { sightViolations: 0, nonSightAlerts: 0, directorQueueMax: 0, newInfected: 0 }, startIds = new Set(world.infected!.active.map(e => e.id)), turnedIds = new Set<number>();
  let maxConcurrent = 0, gunshots = 0, calm = 0, together = 0, maxJump = 0, maxGroup = 0;
  const last = new Map<number, { x: number; z: number }>();
  const offs = [
    ...(['l5.emerged', 'l5.searching', 'l5.accounted', 'l5.shutter', 'l5.sheltered'] as const).map(type => world.events.on(type, e => timeline.push({ type: e.type, t: (e.tick - start) / 60 }))),
    world.events.on('objective.completed', e => { if (e.type === 'objective.completed') timeline.push({ type: `objective:${e.id}`, t: (e.tick - start) / 60 }); }),
    world.events.on('civilian.turned', e => { if (e.type === 'civilian.turned') turnedIds.add(e.id); }),
    world.events.on('ai.alerted', e => {
      if (e.type !== 'ai.alerted' || e.sourceId !== 1) return;
      if (e.cause !== 'sight' && e.cause !== 'hearing') { audit.nonSightAlerts++; return; }
      const infected = world.entities.get(e.targetId), player = world.entities.get(1)!;
      if (e.cause === 'hearing' && infected && Math.hypot(infected.transform.x - player.transform.x, infected.transform.z - player.transform.z) > 2) audit.nonSightAlerts++;
      if (infected && world.infected!.l1 && !world.infected!.l1.lineOfSight(infected.transform, player.transform)) audit.sightViolations++;
    }),
    world.events.on('l5.found', e => { if (e.type === 'l5.found') found.push({ key: e.key, t: (e.tick - start) / 60 }); }),
    world.events.on('l5.lost', e => { if (e.type === 'l5.lost') lost.push({ key: e.key, cause: e.cause, t: (e.tick - start) / 60 }); }),
    world.events.on('outbreak.distraction', e => { if (e.type === 'outbreak.distraction' && e.kind === 'gunfire') gunshots++; }),
    world.events.on('player.died', e => { const p = world.entities.get(1)!.transform; deathsAt.push(`${((e.tick - start) / 60).toFixed(0)}s@${p.x.toFixed(0)},${p.z.toFixed(0)}/${mission.state.l5!.phase}`); }),
  ];
  const s0 = mission.state.l5!;
  const infectedAtStart = world.infected!.active.filter(e => e.health.current > 0).length;
  // Largest group of infected within 6 m of each other at the start.
  for (const e of world.infected!.active) maxGroup = Math.max(maxGroup, world.infected!.active.filter(o => dist(o.transform, e.transform) <= 6).length);
  for (let tick = 0; tick < maxTicks && !bot.finished; tick++) {
    if (opts.stopWhen?.(mission)) break;
    maxConcurrent = Math.max(maxConcurrent, world.infected!.director.count); audit.directorQueueMax = Math.max(audit.directorQueueMax, world.infected!.director.queue.length);
    followFrustum(world); world.applyInput(bot.sample(), 'keyboard'); world.update(); opts.each?.(tick);
    const s = mission.state.l5!, player = world.entities.get(1)!;
    const live = s.survivors.filter(r => r.status === 'following').map(r => world.entities.get(r.id)).filter(Boolean) as NonNullable<ReturnType<typeof world.entities.get>>[];
    for (const f of live) { const prev = last.get(f.id); if (prev) maxJump = Math.max(maxJump, dist(prev, f.transform)); last.set(f.id, { x: f.transform.x, z: f.transform.z }); }
    // Non-combat time: no infected within 12 m of the courier.
    if (live.length && !world.infected!.active.some(e => e.health.current > 0 && !e.hidden && dist(e.transform, player.transform) < 12)) { calm++; if (live.every(f => dist(f.transform, player.transform) <= 8)) together++; }
  }
  offs.forEach(off => off()); world.clearInput(); world.combat!.damage.god = false;
  const s = mission.state.l5!;
  audit.newInfected = world.infected!.active.filter(e => !startIds.has(e.id) && !turnedIds.has(e.id)).length;
  return {
    profile, seed: opts.seed ?? world.seed, outcome: mission.state.phase === 'result' || mission.state.phase === 'progression' ? 'complete' : 'timeout',
    simSeconds: mission.state.stats.time, deaths: mission.state.stats.deaths, kills: mission.state.stats.kills, knockdowns: mission.state.stats.knockdowns, damage: mission.state.stats.damage,
    timeline, found, fates: Object.fromEntries(s.survivors.map(r => [r.key, r.status])), rescued: mission.state.result?.rescued ?? s.survivors.filter(r => r.status === 'sheltered').length,
    rescuedKeys: mission.state.result?.survivors ?? s.survivors.filter(r => r.status === 'sheltered').map(r => r.key), maxConcurrent, infectedAtStart, maxGroup,
    followShare: calm ? together / calm : 1, maxFollowerJump: maxJump, lost, deathsAt, gunshots, audit,
  };
  void s0;
}
