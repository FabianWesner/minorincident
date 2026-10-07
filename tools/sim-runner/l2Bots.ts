import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { Mission } from '../../src/sim/missions/Mission';
import { LevelTwoBot, type L2Opening, type L2Profile } from '../../src/debug/bot/LevelTwoBot';

/** E20 L2 bot battery (specs/epic-20 section 8). Bots write only InputFrames: no teleports, loadout injection or cheats. */
export interface L2Report {
  profile: L2Profile; opening: L2Opening; seed: number; outcome: 'complete' | 'timeout';
  simSeconds: number; deaths: number; kills: number; damage: number; axe: boolean;
  timeline: { type: string; t: number }[];
  /** Live infected at doors-open + s, total and rescue-site only (ambush + bitten after the reveal). */
  infectedAt: Record<number, { all: number; rescue: number }>;
  firefighterHits: number; firefightersTurnedBy90: number; firstDeathS: number | null;
  /** Kills inside 15 m of the doors (aggressive) and of cluster members. */
  killsNearDoors: number; clusterKilled: number; clusterSize: number;
  /** Lowest player HP after the doors open (before any death). */
  minHp: number;
  deathsAt: string[];
}
export async function loadL2(seed: number, tier: 'high' | 'low' = 'high'): Promise<{ world: SimWorld; mission: Mission }> {
  const world = new SimWorld(); await world.init();
  const composition = compositions.L2;
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
  if (tier === 'low') { world.infected!.director.setTier('low'); world.npcs!.setQuality('low'); }
  applyCampaign(world, preset('L2-default'));
  const mission = world.loadMission(resolveCampaignMission('L2', world.districts!)); mission.begin();
  return { world, mission };
}
export function runL2(world: SimWorld, mission: Mission, profile: L2Profile, opts: { seed?: number; opening?: L2Opening; maxSeconds?: number; stopWhen?: (m: Mission) => boolean } = {}): L2Report {
  const bot = new LevelTwoBot(world, profile, opts.opening ?? 'side'), maxTicks = (opts.maxSeconds ?? 600) * 60;
  const timeline: L2Report['timeline'] = [], infectedAt: L2Report['infectedAt'] = {};
  const crew = new Set(mission.state.l2!.crewIds), turnedCrew = new Set<number>();
  const deathsAt: string[] = [];
  let ffHits = 0, firstDeath: number | null = null, killsNearDoors = 0, clusterKilled = 0, minHp = Infinity;
  const offs = [
    ...(['l2.alarm', 'l2.truckDeparted', 'l2.truckArrived', 'l2.crewExit', 'l2.firefightersAtDoors', 'l2.doorsOpen', 'l2.radio', 'l2.gateClosed'] as const).map(type => world.events.on(type, e => { timeline.push({ type: e.type, t: e.tick / 60 }); })),
    world.events.on('objective.completed', e => { if (e.type === 'objective.completed') timeline.push({ type: `objective:${e.id}`, t: e.tick / 60 }); }),
    world.events.on('combat.hit', e => { if (e.type === 'combat.hit' && crew.has(e.sourceId)) ffHits++; }),
    world.events.on('outbreak.infection', e => { const s = mission.state.l2!; if (e.type === 'outbreak.infection' && e.phase === 'infected' && crew.has(e.entityId) && s.doorsOpenAt && e.tick - s.doorsOpenAt <= 90 * 60) turnedCrew.add(e.entityId); }),
    world.events.on('player.died', e => { firstDeath ??= e.tick / 60; const p = world.entities.get(1)!.transform; deathsAt.push(`${(e.tick / 60).toFixed(0)}s@${p.x.toFixed(0)},${p.z.toFixed(0)}/${mission.state.l2!.phase}`); }),
    world.events.on('combat.kill', e => {
      if (e.type !== 'combat.kill' || e.sourceId !== 1) return;
      const door = mission.def.anchors['l2-door-front'];
      if (Math.hypot(e.position.x - door.x, e.position.z - door.z) <= 15) killsNearDoors++;
      if (mission.state.l2!.clusterIds.includes(e.targetId)) clusterKilled++;
    }),
  ];
  const turnedAfter = new Set<number>();
  offs.push(world.events.on('civilian.turned', e => { if (e.type === 'civilian.turned') turnedAfter.add(e.id); }));
  for (let tick = 0; tick < maxTicks && !bot.finished; tick++) {
    if (opts.stopWhen?.(mission)) break;
    const s = mission.state.l2!;
    if (s.doorsOpenAt) for (const at of [0, 10, 60, 90, 120]) if (!(at in infectedAt) && world.tick - s.doorsOpenAt >= at * 60) {
      const live = world.infected!.active.filter(e => e.health.current > 0);
      infectedAt[at] = { all: live.length, rescue: live.filter(e => s.ambushIds.includes(e.id) || turnedAfter.has(e.id)).length };
    }
    if (s.doorsOpenAt) minHp = Math.min(minHp, world.entities.get(1)!.health.current);
    world.applyInput(bot.sample(), 'keyboard'); world.update();
  }
  offs.forEach(off => off()); world.clearInput();
  const s = mission.state.l2!;
  return {
    profile, opening: opts.opening ?? 'side', seed: opts.seed ?? world.seed, outcome: mission.state.phase === 'result' || mission.state.phase === 'progression' ? 'complete' : 'timeout',
    simSeconds: mission.state.stats.time, deaths: mission.state.stats.deaths, kills: mission.state.stats.kills, damage: mission.state.stats.damage, axe: s.axe,
    timeline, infectedAt, firefighterHits: ffHits, firefightersTurnedBy90: turnedCrew.size, firstDeathS: firstDeath,
    killsNearDoors, clusterKilled, clusterSize: s.clusterIds.length, minHp: Number.isFinite(minHp) ? minHp : 100, deathsAt,
  };
}
