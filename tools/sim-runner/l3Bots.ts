import { readFileSync } from 'node:fs';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { l3Segment, l3Street } from '../../src/data/l3';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { Mission } from '../../src/sim/missions/Mission';
import { LevelThreeBot, type L3Profile, type L3StreetChoice } from '../../src/debug/bot/LevelThreeBot';

/** E21 L3 bot battery (specs/epic-21 section 8). Bots write only InputFrames: no teleports, loadout injection or cheats. */
export interface L3Report {
  profile: L3Profile; street: L3StreetChoice; seed: number; outcome: 'complete' | 'timeout';
  simSeconds: number; deaths: number; kills: number; knockdowns: number; damage: number;
  timeline: { type: string; t: number }[];
  handgunS: number | null; handgunShots: number;
  /** Section 5.5: officers at the start, attack directions that emerged, officers turned during the attack, the fallback. */
  attack: { officers: number; directions: string[]; turnedDuring: number; sameLook: boolean; fallbackCause: string; fallbackAfterS: number } | null;
  /** Section 5.4: squad at the fallback, per-segment-end sizes, losses with causes, officers turned in the corridor. */
  squad: { atFallback: number; segmentEnds: number[]; atCheckpoint: number; losses: { cause: string; t: number }[]; turnedInCorridor: number; protected: number; maxJumpM: number; near8Share: number } | null;
  /** Section 5.4 AC09: segment 1 knockdowns by officers vs the player, player damage in segment 1. */
  s1: { officerKills: number; playerKills: number; damage: number } | null;
  /** AC05: distances of the player's handgun and melee knockdowns. */
  killDistances: { gun: number[]; melee: number[] };
  /** AC11: largest regression of the progress coordinate after the fallback; streets used. */
  regressionM: number; streets: string[];
  /** AC12: pre-populated per segment, median live infected within 30 m per segment, max concurrent infected and cap. */
  density: { prepopulated: number[]; near30: number[]; maxConcurrent: number; cap: number };
  /** AC14: medkits picked up and the time-weighted share below 20 % HP. */
  medkits: number; lowHpShare: number;
  /** E20-AC11-style omniscience audit. */
  audit: { sightViolations: number; nonSightAlerts: number; emerged: number; emergeSeen: number };
  deathsAt: string[];
}
export async function loadL3(seed: number, tier: 'high' | 'low' = 'high'): Promise<{ world: SimWorld; mission: Mission }> {
  const world = new SimWorld(); await world.init();
  const composition = compositions.L3;
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
  if (tier === 'low') { world.infected!.director.setTier('low'); world.npcs!.setQuality('low'); }
  applyCampaign(world, preset('L3-default'));
  const mission = world.loadMission(resolveCampaignMission('L3', world.districts!)); mission.begin();
  return { world, mission };
}
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const camera = new PerspectiveCamera(25, 16 / 9, .1, 600), offset = new Vector3(), frustum = new Matrix4();
/** The game camera's view volume (View.ts: 25 deg lens, radius 19, polar 0.30 pi, azimuth 45 deg, following the courier), so the
 * headless director spawns out of view exactly as it would in the browser (Game.simTick sets the same frustum). */
export function followFrustum(world: SimWorld): void {
  const p = world.entities.get(1)!.transform;
  offset.setFromSphericalCoords(19, Math.PI * .3, Math.PI / 4);
  camera.position.set(p.x + offset.x, offset.y, p.z + offset.z); camera.lookAt(p.x, 0, p.z); camera.updateMatrixWorld(true);
  frustum.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  world.infected?.director.setFrustum(frustum.elements, camera.position);
}
const median = (v: number[]) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export function runL3(world: SimWorld, mission: Mission, profile: L3Profile, opts: { seed?: number; street?: L3StreetChoice; maxSeconds?: number; stopWhen?: (m: Mission) => boolean; god?: boolean } = {}): L3Report {
  const bot = new LevelThreeBot(world, profile, opts.street ?? 'auto'), maxTicks = (opts.maxSeconds ?? 600) * 60, start = world.tick;
  if (opts.god) world.combat!.damage.god = true;
  const s0 = mission.state.l3!, officers = new Set(s0.officerIds);
  const timeline: L3Report['timeline'] = [], deathsAt: string[] = [];
  const gun: number[] = [], melee: number[] = [];
  let firstGun = -1, squadAtFallback = 0, handgunShots = 0, turnedDuring = 0, turnedInCorridor = 0, sameLook = true;
  const s1 = { officerKills: 0, playerKills: 0, damage: 0 };
  const audit = { sightViolations: 0, nonSightAlerts: 0, emerged: 0, emergeSeen: 0 };
  const streets = new Set<string>();
  const near30: number[][] = [[], [], []];
  let maxConcurrent = 0, low = 0, samples = 0, medkits = 0, regression = 0, maxJump = 0, nearTicks = 0, calmTicks = 0, protectedFlags = 0;
  const lastPos = new Map<number, { x: number; z: number }>(), squadIds = new Set<number>();
  const offs = [
    ...(['l3.handgun', 'l3.attack', 'l3.wave', 'l3.fallback', 'l3.squad-lost', 'l3.segment', 'l3.crossed'] as const).map(type => world.events.on(type, e => timeline.push({ type: e.type, t: (e.tick - start) / 60 }))),
    world.events.on('objective.completed', e => { if (e.type === 'objective.completed') timeline.push({ type: `objective:${e.id}`, t: (e.tick - start) / 60 }); }),
    world.events.on('l3.fallback', e => { if (e.type === 'l3.fallback') { squadAtFallback = e.squad.length; for (const id of e.squad) squadIds.add(id); } }),
    world.events.on('checkpoint.restored', () => lastPos.clear()),
    world.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.pistol') handgunShots++; }),
    // First acquisition (a later checkpoint restore shifts the stored tick with the timeline).
    world.events.on('l3.handgun', e => { if (firstGun < 0) firstGun = e.tick; }),
    world.events.on('pickup.collected', e => { if (e.type === 'pickup.collected' && 'kind' in e && e.kind === 'medkit') medkits++; }),
    world.events.on('outbreak.infection', e => {
      const s = mission.state.l3!;
      if (e.type !== 'outbreak.infection' || e.phase !== 'infected' || !officers.has(e.entityId)) return;
      if (s.phase === 'attack') turnedDuring++; else if (s.fallbackAt && squadIds.has(e.entityId)) turnedInCorridor++;
      sameLook &&= world.entities.get(e.entityId)?.appearance?.asset === 'npc.police-officer';
    }),
    world.events.on('player.damaged', e => { if (e.type === 'player.damaged' && mission.state.l3!.fallbackAt && l3Segment(world.entities.get(1)!.transform.x) === 0) s1.damage += e.amount; }),
    world.events.on('player.died', e => { const p = world.entities.get(1)!.transform; deathsAt.push(`${((e.tick - start) / 60).toFixed(0)}s@${p.x.toFixed(0)},${p.z.toFixed(0)}/${mission.state.l3!.phase}`); }),
    world.events.on('combat.kill', e => {
      if (e.type !== 'combat.kill' || world.entities.get(e.targetId)?.faction !== 'infected') return;
      const s = mission.state.l3!, src = world.entities.get(e.sourceId);
      if (s.fallbackAt && l3Segment(e.position.x) === 0) { if (e.sourceId === 1) s1.playerKills++; else if (officers.has(e.sourceId)) s1.officerKills++; }
      if (e.sourceId === 1 && src) (e.actionId === 'weapon.pistol' ? gun : melee).push(dist(src.transform, e.position));
    }),
    world.events.on('ai.alerted', e => {
      if (e.type !== 'ai.alerted' || e.sourceId !== 1) return;
      if (e.cause !== 'sight') { audit.nonSightAlerts++; return; }
      const infected = world.entities.get(e.targetId), player = world.entities.get(1)!;
      if (infected && world.infected!.l1 && !world.infected!.l1.lineOfSight(infected.transform, player.transform)) audit.sightViolations++;
    }),
  ];
  for (let tick = 0; tick < maxTicks && !bot.finished; tick++) {
    if (opts.stopWhen?.(mission)) break;
    const s = mission.state.l3!, player = world.entities.get(1)!, p = player.transform;
    maxConcurrent = Math.max(maxConcurrent, world.infected!.director.count);
    if (player.health.current > 0) { samples++; if (player.health.current < .2 * player.health.max) low++; }
    if (s.fallbackAt) {
      regression = Math.max(regression, s.furthest - p.x);
      // Streets walked inside the corridor proper (the yard exit and On-ramp Road to the gate are shared by every route).
      if (s.phase === 'corridor' && p.x > -115 && p.x < 122) streets.add(l3Street(p.z));
      const seg = l3Segment(p.x);
      if (seg >= 0 && seg <= 2 && world.tick % 30 === 0) near30[seg].push(world.infected!.active.filter(e => e.health.current > 0 && dist(e.transform, p) <= 30).length);
      // Squad: never teleports (per-tick jump), no protection flag, near the player outside combat.
      // Non-combat time: no living infected within 20 m of the courier and no squad member in a fight.
      const calm = !world.infected!.active.some(e => e.health.current > 0 && dist(e.transform, p) < 20) && !s.squad.some(q => { const t = world.entities.get(world.entities.get(q.id)?.civilian?.ally?.targetId ?? 0); return !!t && t.health.current > 0; });
      for (const q of s.squad) {
        const e = world.entities.get(q.id); if (!e) continue;
        const last = lastPos.get(q.id); if (last) maxJump = Math.max(maxJump, dist(last, e.transform)); lastPos.set(q.id, { x: e.transform.x, z: e.transform.z });
        if (e.survivor || e.companion || (e.civilian?.l1?.graceUntil ?? 0) > world.tick + 60) protectedFlags++;
        if (calm && seg === 0) { calmTicks++; if (dist(e.transform, p) <= 8) nearTicks++; }
      }
    }
    followFrustum(world); world.applyInput(bot.sample(), 'keyboard'); world.update();
  }
  offs.forEach(off => off()); world.clearInput(); world.combat!.damage.god = false;
  const s = mission.state.l3!;
  for (const q of s.pending) if (q.id > 0 && q.x !== undefined) { audit.emerged++; if (q.seen) audit.emergeSeen++; }
  const dirs = new Set(s.waves.filter(w => w.id).map(w => w.dir));
  const officersAtStart = s0.officerIds.length;
  return {
    profile, street: opts.street ?? 'auto', seed: opts.seed ?? world.seed, outcome: mission.state.phase === 'result' || mission.state.phase === 'progression' ? 'complete' : 'timeout',
    simSeconds: mission.state.stats.time, deaths: mission.state.stats.deaths, kills: mission.state.stats.kills, knockdowns: mission.state.stats.knockdowns, damage: mission.state.stats.damage,
    timeline, handgunS: firstGun >= 0 ? (firstGun - start) / 60 : s.handgunAt ? (s.handgunAt - start) / 60 : null, handgunShots,
    attack: s.attackAt ? { officers: officersAtStart, directions: [...dirs], turnedDuring, sameLook, fallbackCause: s.fallbackCause, fallbackAfterS: s.fallbackAt ? (s.fallbackAt - s.attackAt) / 60 : -1 } : null,
    squad: s.fallbackAt ? { atFallback: squadAtFallback, segmentEnds: [0, 1, 2].map(k => s.segmentSquad[k] ?? -1), atCheckpoint: s.crossedAt ? s.squad.length : -1, losses: s.lost.map(l => ({ cause: l.cause, t: (l.tick - start) / 60 })), turnedInCorridor, protected: protectedFlags, maxJumpM: maxJump, near8Share: calmTicks ? nearTicks / calmTicks : 1 } : null,
    s1: s.fallbackAt ? s1 : null,
    killDistances: { gun, melee },
    regressionM: regression, streets: [...streets],
    density: { prepopulated: [0, 1, 2].map(k => s.pending.filter(q => q.segment === k).length), near30: near30.map(median), maxConcurrent, cap: world.infected!.director.cap },
    medkits, lowHpShare: samples ? low / samples : 0, audit, deathsAt,
  };
}
