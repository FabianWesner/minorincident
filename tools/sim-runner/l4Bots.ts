import { readFileSync } from 'node:fs';
import { l4 } from '../../src/data/l4';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { Mission } from '../../src/sim/missions/Mission';
import { LevelFourBot, type L4Profile, type L4RouteChoice } from '../../src/debug/bot/LevelFourBot';
import { followFrustum } from './l3Bots';

/** E22 L4 single-seed pass (specs/epic-22 section 8; PO 10-09: no bot batteries). Bots write only InputFrames: no teleports, loadout injection or cheats. */
export interface L4Report {
  profile: L4Profile; route: L4RouteChoice; seed: number; outcome: 'complete' | 'timeout';
  simSeconds: number; deaths: number; kills: number; knockdowns: number; damage: number;
  timeline: { type: string; t: number }[];
  rideS: number; controlBackS: number; gunS: number | null; turnAfterGunS: number; turnAfterArrivalS: number; humansNear: number; turnedIds: number[];
  turnedWithin30: number; maxConcurrent: number; maxCharacters: number; infectedAtT30: number; infectedAtBreak: number; killsAtBreak: number;
  soldiersAtTurn: number; soldiersAtBreak: number; soldiersAtCellar: number; civiliansAtTurn: number;
  breakCause: string; breakAfterS: number; shots: { tank: number[]; heliBursts: number; hmgBursts: number };
  kills_: { player: number; soldiers: number; armedCivilians: number; unarmedCivilians: number; heli: number; tank: number; other: number };
  damageLive: { fires: number; burning: number; glass: number; scorch: number };
  edges: number[]; deathsAt: string[]; battleAfterBarred: number;
}
export async function loadL4(seed: number, tier: 'high' | 'low' = 'high'): Promise<{ world: SimWorld; mission: Mission }> {
  const world = new SimWorld(); await world.init();
  const composition = compositions.L4;
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
  if (tier === 'low') { world.infected!.director.setTier('low'); world.npcs!.setQuality('low'); }
  applyCampaign(world, preset('L4-default'));
  const mission = world.loadMission(resolveCampaignMission('L4', world.districts!)); mission.begin();
  return { world, mission };
}
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export function runL4(world: SimWorld, mission: Mission, profile: L4Profile, opts: { seed?: number; route?: L4RouteChoice; maxSeconds?: number; stopWhen?: (m: Mission) => boolean; god?: boolean } = {}): L4Report {
  const bot = new LevelFourBot(world, profile, opts.route ?? 'auto'), maxTicks = (opts.maxSeconds ?? 600) * 60, start = world.tick;
  if (opts.god) world.combat!.damage.god = true;
  const timeline: L4Report['timeline'] = [], deathsAt: string[] = [], tank: number[] = [], edges = new Set<number>();
  let firstGun = -1, controlBack = -1, turnedWithin30 = 0, maxConcurrent = 0, maxCharacters = 0, humansNear = 0, battle = 0, scorch = 0, turnedIds: number[] = [];
  const offs = [
    ...(['l4.convoyArrived', 'l4.gun', 'l4.firstTurn', 'l4.lineBreaks', 'l4.heliWithdrawn', 'l4.descended', 'l4.doorBarred'] as const).map(type => world.events.on(type, e => timeline.push({ type: e.type, t: (e.tick - start) / 60 }))),
    world.events.on('objective.completed', e => { if (e.type === 'objective.completed') timeline.push({ type: `objective:${e.id}`, t: (e.tick - start) / 60 }); }),
    world.events.on('l4.gun', e => { if (firstGun < 0) firstGun = e.tick; }),
    world.events.on('l4.firstTurn', e => { if (e.type === 'l4.firstTurn') { humansNear = e.humansNear; turnedIds = [...e.ids]; } }),
    world.events.on('vehicle.exited', e => { if (e.type === 'vehicle.exited' && controlBack < 0) controlBack = e.tick; }),
    world.events.on('l4.tankFire', e => { if (e.type === 'l4.tankFire') tank.push(e.tick); }),
    world.events.on('l4.wave', e => { if (e.type === 'l4.wave') for (const i of e.edges) edges.add(i); }),
    world.events.on('l4.battle', () => { battle++; }),
    world.events.on('explosion', e => { if (e.type === 'explosion' && e.radius > 0) scorch++; }),
    world.events.on('civilian.turned', e => { const s = mission.state.l4!; if (e.type === 'civilian.turned' && s.turnAt && e.tick - s.turnAt <= 30 * 60 && !turnedIds.includes(e.id)) turnedWithin30++; }),
    world.events.on('player.died', e => { const p = world.entities.get(1)!.transform; deathsAt.push(`${((e.tick - start) / 60).toFixed(0)}s@${p.x.toFixed(0)},${p.z.toFixed(0)}/${mission.state.l4!.phase}`); }),
  ];
  for (let tick = 0; tick < maxTicks && !bot.finished; tick++) {
    if (opts.stopWhen?.(mission)) break;
    maxConcurrent = Math.max(maxConcurrent, world.infected!.director.count);
    let humans = 0; for (const e of world.entities.iterate()) if (e.civilian && !e.infection && e.health.current > 0 && !e.hidden) humans++;
    maxCharacters = Math.max(maxCharacters, humans + world.infected!.active.filter(e => e.health.current > 0).length);
    followFrustum(world); world.applyInput(bot.sample(), 'keyboard'); world.update();
  }
  offs.forEach(off => off()); world.clearInput(); world.combat!.damage.god = false;
  const s = mission.state.l4!, hazards = [...world.entities.iterate()].filter(e => e.hazard?.kind === 'fire').length;
  // From the arrival event: a checkpoint restore shifts `arrivedAt` by the retry delta, so the stored tick overstates the ride after a death.
  const arrivedS = timeline.find(e => e.type === 'l4.convoyArrived')?.t ?? (s.arrivedAt ? (s.arrivedAt - start) / 60 : 0);
  return {
    profile, route: opts.route ?? 'auto', seed: opts.seed ?? world.seed, outcome: mission.state.phase === 'result' || mission.state.phase === 'progression' ? 'complete' : 'timeout',
    simSeconds: mission.state.stats.time, deaths: mission.state.stats.deaths, kills: mission.state.stats.kills, knockdowns: mission.state.stats.knockdowns, damage: mission.state.stats.damage,
    timeline, rideS: arrivedS, controlBackS: controlBack >= 0 && s.arrivedAt ? (controlBack - s.arrivedAt) / 60 : -1, gunS: firstGun >= 0 ? (firstGun - start) / 60 : null,
    turnAfterGunS: s.turnAt && s.gunAt ? (s.turnAt - s.gunAt) / 60 : -1, turnAfterArrivalS: s.turnAt && s.arrivedAt ? (s.turnAt - s.arrivedAt) / 60 : -1, humansNear, turnedIds,
    turnedWithin30, maxConcurrent, maxCharacters, infectedAtT30: s.infectedAtT30, infectedAtBreak: s.infectedAtBreak, killsAtBreak: s.killsAtBreak,
    soldiersAtTurn: s.soldiersAtTurn, soldiersAtBreak: s.soldiersAtBreak, soldiersAtCellar: s.soldiersAtCellar, civiliansAtTurn: s.civiliansAtTurn,
    breakCause: s.lineCause, breakAfterS: s.lineBreakAt && s.warAt ? (s.lineBreakAt - s.warAt) / 60 : -1, shots: { tank, heliBursts: s.heliShots, hmgBursts: s.hmgBursts },
    kills_: { ...s.kills }, damageLive: { fires: hazards, burning: s.burning.length, glass: s.glass.length, scorch }, edges: [...edges], deathsAt, battleAfterBarred: battle,
  };
}
void dist; void l4;
