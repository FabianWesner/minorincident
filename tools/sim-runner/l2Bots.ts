import { readFileSync } from 'node:fs';
import { l2 } from '../../src/data/l2';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { Mission } from '../../src/sim/missions/Mission';
import type { EntitySnapshot } from '../../src/sim/world/types';
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
  minHp: number; deathsAt: string[];
  /** Section-specific observations (null when the run did not get there). */
  calm: { infectedMax: number; combatEvents: number; alarmS: number; crewAtTruckS: number | null; axeActive: boolean } | null;
  ride: { passenger: boolean; seconds: number; seatedEveryTick: boolean; crewExitS: number; controlS: number } | null;
  doors: { order: string[]; nearBefore: number; firstCivOutS: number | null; firstAmbushVisibleS: number | null; emerged3s: number; doors3s: string[]; allOutS: number | null; nonBiteNearRescue: number } | null;
  /** Firefighter bites: entity kept, asset kept, seconds from bite to risen. */
  crewTurns: { id: number; seconds: number; sameAsset: boolean }[];
  audit: { sightViolations: number; nonSightAlerts: number; emergeFar: number; emergeSeen: number; emerged: number };
  radio: { infected: number; escapeArea: number; groupsOf4: number; chasingPlayer: number } | null;
  cluster: { atApproach: number; size: number } | null;
  gate: { closeS: number; infectedInsideAfter: number } | null;
  /** Died within 120 s of the doors opening. */
  diedBy120: boolean;
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
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
export function inCheckpointZone(p: { x: number; z: number }): boolean { const [z0, z1] = l2.checkpoint.gateZ; return p.x >= l2.checkpoint.gateX + .3 && p.z >= z0 && p.z <= z1; }

export function runL2(world: SimWorld, mission: Mission, profile: L2Profile, opts: { seed?: number; opening?: L2Opening; maxSeconds?: number; stopWhen?: (m: Mission) => boolean; god?: boolean } = {}): L2Report {
  const bot = new LevelTwoBot(world, profile, opts.opening ?? 'side'), maxTicks = (opts.maxSeconds ?? 600) * 60, start = world.tick;
  if (opts.god) world.combat!.damage.god = true;
  const s0 = mission.state.l2!, a = mission.def.anchors, forecourt = a['l2-forecourt'];
  const timeline: L2Report['timeline'] = [], infectedAt: L2Report['infectedAt'] = {};
  const crew = new Set(s0.crewIds), turnedCrew = new Set<number>(), deathsAt: string[] = [], turnedAfter = new Set<number>();
  let ffHits = 0, firstDeath: number | null = null, killsNearDoors = 0, clusterKilled = 0, minHp = Infinity, diedBy120 = false;
  const calm = { infectedMax: 0, combatEvents: 0, alarmS: 0, crewAtTruckS: null as number | null, axeActive: false };
  let passenger = false, seatedEveryTick = true, controlAt = 0;
  const doors = { order: [] as string[], nearBefore: 0, firstCivOutS: null as number | null, firstAmbushVisibleS: null as number | null, emerged3s: 0, doors3s: [] as string[], allOutS: null as number | null, nonBiteNearRescue: 0 };
  const audit = { sightViolations: 0, nonSightAlerts: 0, emergeFar: 0, emergeSeen: 0, emerged: 0 };
  const bites = new Map<number, number>(), crewTurns: L2Report['crewTurns'] = [], known = new Set<number>();
  let radio: L2Report['radio'] = null, cluster: L2Report['cluster'] = null, gate: L2Report['gate'] = null, insideAfter = 0;
  const offs = [
    ...(['l2.alarm', 'l2.truckDeparted', 'l2.truckArrived', 'l2.crewExit', 'l2.firefightersAtDoors', 'l2.doorsOpen', 'l2.radio', 'l2.gateClosed'] as const).map(type => world.events.on(type, e => { timeline.push({ type: e.type, t: e.tick / 60 }); doors.order.push(e.type); })),
    world.events.on('objective.completed', e => { if (e.type === 'objective.completed') timeline.push({ type: `objective:${e.id}`, t: e.tick / 60 }); }),
    world.events.on('vehicle.entered', e => { if (e.type === 'vehicle.entered' && e.role === 'passenger') passenger = true; }),
    world.events.on('combat.hit', e => { if (e.type === 'combat.hit' && crew.has(e.sourceId)) ffHits++; }),
    world.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite' && crew.has(e.targetId) && !bites.has(e.targetId)) bites.set(e.targetId, e.tick); }),
    world.events.on('outbreak.infection', e => {
      const s = mission.state.l2!;
      if (e.type !== 'outbreak.infection' || e.phase !== 'infected') return;
      if (crew.has(e.entityId) && s.doorsOpenAt && e.tick - s.doorsOpenAt <= 90 * 60) turnedCrew.add(e.entityId);
      if (crew.has(e.entityId) && bites.has(e.entityId) && !crewTurns.some(t => t.id === e.entityId)) crewTurns.push({ id: e.entityId, seconds: (e.tick - bites.get(e.entityId)!) / 60, sameAsset: world.entities.get(e.entityId)?.appearance?.asset === 'npc.firefighter-alive' });
    }),
    world.events.on('civilian.turned', e => { if (e.type === 'civilian.turned') turnedAfter.add(e.id); }),
    world.events.on('player.died', e => {
      firstDeath ??= e.tick / 60; const p = world.entities.get(1)!.transform, s = mission.state.l2!;
      deathsAt.push(`${(e.tick / 60).toFixed(0)}s@${p.x.toFixed(0)},${p.z.toFixed(0)}/${s.phase}`);
      if (s.doorsOpenAt && e.tick - s.doorsOpenAt <= 120 * 60) diedBy120 = true;
    }),
    world.events.on('combat.kill', e => {
      if (e.type !== 'combat.kill' || e.sourceId !== 1) return;
      if (dist(e.position, a['l2-door-front']) <= 15) killsNearDoors++;
      if (mission.state.l2!.clusterIds.includes(e.targetId)) clusterKilled++;
    }),
    world.events.on('ai.alerted', e => {
      if (e.type !== 'ai.alerted' || e.sourceId !== 1) return;
      if (e.cause !== 'sight') { audit.nonSightAlerts++; return; }
      const infected = world.entities.get(e.targetId), player = world.entities.get(1)!;
      if (infected && world.infected!.l1 && !world.infected!.l1.lineOfSight(infected.transform, player.transform)) audit.sightViolations++;
    }),
  ];
  for (const type of ['combat.attack', 'combat.hit', 'combat.kill'] as const) offs.push(world.events.on(type, () => { if (!mission.state.l2!.alarmAt || world.tick < mission.state.l2!.alarmAt) calm.combatEvents++; }));
  const alive = () => world.infected!.active.filter(e => e.health.current > 0);
  for (let tick = 0; tick < maxTicks && !bot.finished; tick++) {
    if (opts.stopWhen?.(mission)) break;
    const s = mission.state.l2!, t = world.tick;
    if (s.phase === 'calm') calm.infectedMax = Math.max(calm.infectedMax, world.infected!.active.length);
    if (s.phase !== 'calm' && !calm.alarmS) { calm.alarmS = (s.alarmAt - start) / 60; calm.axeActive = mission.state.steps.axe.status === 'active'; }
    if (s.alarmAt && calm.crewAtTruckS === null && s.crewIds.every(id => world.entities.get(id)?.hidden)) calm.crewAtTruckS = (t - s.alarmAt) / 60;
    if (s.phase === 'ride') seatedEveryTick &&= !!world.entities.get(1)!.hidden && s.crewIds.every(id => !!world.entities.get(id)?.hidden);
    if (s.arrivedAt && !controlAt && !world.storyLock && !world.entities.get(1)!.hidden) controlAt = t;
    if (!s.doorsOpenAt) doors.nearBefore = Math.max(doors.nearBefore, alive().filter(e => dist(e.transform, forecourt) < 40).length);
    else {
      const since = (t - s.doorsOpenAt) / 60;
      // Through the doors = visible and outside the market footprint (some wait visibly at the glass before the release).
      const out = (id: number) => { const e = world.entities.get(id); return !e || (!e.hidden && !(e.transform.x > -59.8 && e.transform.x < -51.3 && e.transform.z > -46.7 && e.transform.z < -37.6)); };
      if (doors.firstCivOutS === null && s.trappedIds.some(out)) doors.firstCivOutS = since;
      if (doors.allOutS === null && s.trappedIds.every(out)) doors.allOutS = since;
      if (doors.firstAmbushVisibleS === null && s.ambushIds.some(id => { const e = world.entities.get(id); return !!e && !e.hidden && world.infected!.director.visible(e.transform); })) doors.firstAmbushVisibleS = since;
      if (since <= 3) { doors.emerged3s = s.ambush.filter(q => q.id > 0).length; doors.doors3s = [...new Set(s.ambush.filter(q => q.id > 0).map(q => q.door))]; }
      for (const e of alive()) if (!known.has(e.id)) {
        known.add(e.id);
        if (!s.ambushIds.includes(e.id) && !turnedAfter.has(e.id) && dist(e.transform, forecourt) < 40 && since > 0) doors.nonBiteNearRescue++;
      }
      for (const at of [0, 10, 60, 90, 120]) if (!(at in infectedAt) && since >= at) {
        const live = alive(); infectedAt[at] = { all: live.length, rescue: live.filter(e => s.ambushIds.includes(e.id) || turnedAfter.has(e.id)).length };
      }
      minHp = Math.min(minHp, world.entities.get(1)!.health.current);
    }
    if (!s.doorsOpenAt) for (const e of world.infected!.active) known.add(e.id);
    if (s.radioAt && !radio && t >= s.radioAt) {
      const live = alive(), street = live.filter(e => dist(e.transform, forecourt) >= 40);
      const homes = new Map<string, number>();
      for (const q of s.pending) { const e = world.entities.get(q.id); if (q.id > 0 && e && e.health.current > 0) homes.set(`${q.home.x},${q.home.z}`, (homes.get(`${q.home.x},${q.home.z}`) ?? 0) + 1); }
      radio = { infected: live.length, escapeArea: street.length, groupsOf4: [...homes.values()].filter(n => n >= 4).length, chasingPlayer: live.filter(e => e.infected?.l1?.mode === 'chase' && e.infected.l1.targetId === 1).length };
    }
    if (s.clusterReached && !cluster) {
      const [cx, cz] = l2.cluster.home;
      cluster = { atApproach: s.clusterIds.map(id => world.entities.get(id)).filter((e): e is EntitySnapshot => !!e && e.health.current > 0 && e.transform.x >= cx - 18 && e.transform.x <= l2.checkpoint.gateX && Math.abs(e.transform.z - cz) <= 10).length, size: s.clusterIds.length };
    }
    if (s.gateClosedAt && !gate) gate = { closeS: (s.gateClosedAt - s.crossedAt) / 60, infectedInsideAfter: 0 };
    if (s.gateClosedAt) insideAfter = Math.max(insideAfter, alive().filter(e => inCheckpointZone(e.transform)).length);
    world.applyInput(bot.sample(), 'keyboard'); world.update();
  }
  offs.forEach(off => off()); world.clearInput(); world.combat!.damage.god = false;
  const s = mission.state.l2!;
  for (const q of s.pending) if (q.id > 0 && q.x !== undefined) { audit.emerged++; if (dist({ x: q.x, z: q.z! }, mission.def.anchors[q.door]) > 3) audit.emergeFar++; if (q.seen) audit.emergeSeen++; }
  if (gate) gate.infectedInsideAfter = insideAfter;
  const arrived = s.arrivedAt ? s.arrivedAt : 0;
  return {
    profile, opening: opts.opening ?? 'side', seed: opts.seed ?? world.seed, outcome: mission.state.phase === 'result' || mission.state.phase === 'progression' ? 'complete' : 'timeout',
    simSeconds: mission.state.stats.time, deaths: mission.state.stats.deaths, kills: mission.state.stats.kills, damage: mission.state.stats.damage, axe: s.axe,
    timeline, infectedAt, firefighterHits: ffHits, firefightersTurnedBy90: turnedCrew.size, firstDeathS: firstDeath,
    killsNearDoors, clusterKilled, clusterSize: s.clusterIds.length, minHp: Number.isFinite(minHp) ? minHp : 100, deathsAt,
    calm: calm.alarmS ? calm : null,
    ride: arrived ? { passenger, seconds: (s.arrivedAt - s.departAt) / 60, seatedEveryTick, crewExitS: (s.crewExitAt - s.arrivedAt) / 60, controlS: (controlAt - s.arrivedAt) / 60 } : null,
    doors: s.doorsOpenAt ? doors : null, crewTurns, audit, radio, cluster, gate, diedBy120,
  };
}
