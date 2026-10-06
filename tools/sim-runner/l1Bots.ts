import { readFileSync } from 'node:fs';
import { Rng } from '../../src/core/Rng';
import { l1v2 } from '../../src/data/l1v2';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import type { Mission } from '../../src/sim/missions/Mission';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';

/**
 * L1 v2 bot policies (specs/90-test-concept.md section 5, epic-19 section 9). Bots read the sim like a player sees it
 * (positions, objective anchors) and write only InputFrame patches: no cheats, no teleports.
 */
export type L1Profile = 'complete' | 'newbie' | 'idle' | 'evade-only';
export interface L1Report {
  profile: L1Profile; seed: number; outcome: 'complete' | 'timeout';
  simSeconds: number; deaths: number; kills: number; damage: number;
  timeline: { id: string; t: number }[];
  /** Living infected, sampled at +0/+60/+120/+240 s after the accident exit. */
  infectedAfterExit: Record<number, number>; maxInfected: number;
  exitHeadingsDeg: number[]; exitIds: number[]; technicianId: number;
  bites: number;
}
const goals: Record<string, string> = { pickup: 'parcel-counter', deliver: 'lab-door', escape: 'garage-door', weapon: 'garage-bat', firestation: 'fire-bay-trigger' };

export async function loadL1(seed: number): Promise<{ world: SimWorld; mission: Mission }> {
  const world = new SimWorld(); await world.init();
  const composition = compositions.L1;
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
  const mission = world.loadMission(resolveCampaignMission('L1', world.districts!)); mission.begin();
  return { world, mission };
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
class Walker {
  private route = { path: [] as number[], goal: -1, pathIndex: 0 };
  private key = '';
  private readonly wp = { x: 0, z: 0 };
  /** Moves one tick toward `target` along the nav grid; true once within `stop` metres. */
  step(world: SimWorld, target: { x: number; z: number }, stop: number, key: string): { x: number; z: number } | null {
    const p = world.entities.get(1)!.transform;
    if (dist(p, target) <= stop) return null;
    if (key !== this.key) { this.key = key; this.route = { path: [], goal: -1, pathIndex: 0 }; }
    const ok = world.infected!.nav.steer(p, target, this.route, .45, this.wp);
    const dx = (ok ? this.wp.x : target.x) - p.x, dz = (ok ? this.wp.z : target.z) - p.z, d = Math.hypot(dx, dz) || 1;
    return { x: dx / d, z: dz / d };
  }
}

/** Runs one profile to the result screen (or the time limit) and reports. */
export function runL1(world: SimWorld, mission: Mission, profile: L1Profile, opts: { seed?: number; maxSeconds?: number; stopWhen?: (mission: Mission) => boolean } = {}): L1Report {
  const seed = opts.seed ?? world.seed, maxTicks = (opts.maxSeconds ?? 900) * 60, rng = new Rng(seed, `bot-${profile}`);
  const walker = new Walker(), seen = new Set<string>(), timeline: L1Report['timeline'] = [];
  const infectedAfterExit: Record<number, number> = {};
  let maxInfected = 0, bites = 0, exitTick = 0, detour: { x: number; z: number; until: number } | null = null, decideAt = 0, move = { x: 0, z: 0 }, fight: EntitySnapshot | null = null;
  const stopBites = world.events.on('outbreak.bite', () => { bites++; });
  const stopCivTurn = world.events.on('civilian.turned', () => { bites++; });
  const anchor = (name: string) => mission.def.anchors[name];
  const alive = () => world.infected?.active.filter(e => e.health.current > 0) ?? [];
  const newbie = profile === 'newbie', fights = profile === 'complete' || profile === 'newbie';
  for (let tick = 0; tick < maxTicks && mission.state.phase !== 'result' && mission.state.phase !== 'progression'; tick++) {
    if (opts.stopWhen?.(mission)) break;
    const player = world.entities.get(1)!, p = player.transform, l1 = mission.state.l1!, t = world.tick / 60;
    for (const id of mission.state.completedObjectives) if (!seen.has(id)) { seen.add(id); timeline.push({ id, t }); }
    if (l1.exitIds.length && !exitTick) exitTick = world.tick;
    if (exitTick) for (const s of [0, 60, 120, 240]) if (!(s in infectedAfterExit) && world.tick - exitTick >= s * 60) infectedAfterExit[s] = alive().length;
    maxInfected = Math.max(maxInfected, alive().length);
    if (mission.state.phase === 'cinematic') { world.update(); continue; }
    if (player.health.current <= 0) { world.setInput({ move: { x: 0, z: 0 }, interact: false }); world.update(); continue; }
    const idle = profile === 'idle' && l1.delivered;
    if (idle) { world.setInput({ move: { x: 0, z: 0 }, interact: false, left: { down: false, held: false, up: false } }); world.update(); continue; }
    const reaction = newbie ? 15 : 1;
    if (world.tick >= decideAt) {
      decideAt = world.tick + reaction;
      const step = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active');
      const threats = alive().filter(e => dist(e.transform, p) <= 9).sort((a, b) => dist(a.transform, p) - dist(b.transform, p));
      const nearest = threats[0];
      fight = fights && nearest && dist(nearest.transform, p) <= 2.6 && (!newbie || rng.next() > .15) ? nearest : null;
      let goal: { x: number; z: number } | null = null, stop = 1.2, key = step?.id ?? 'wait';
      if (step) goal = anchor(goals[step.id]);
      else if (l1.delivered && !l1.exitIds.length) { goal = anchor('lab-door'); stop = 3; key = 'calm'; }
      if (step?.id === 'deliver' || step?.id === 'pickup') stop = .9;
      if (newbie) {
        if (detour && world.tick > detour.until) detour = null;
        if (!detour && rng.next() < .0006) { const names = Object.keys(mission.def.anchors); const a = anchor(names[Math.floor(rng.next() * names.length)]); detour = { x: a.x, z: a.z, until: world.tick + 360 }; }
        if (detour) { goal = detour; stop = 2; key = 'detour'; }
      }
      let dir = goal ? walker.step(world, goal, stop, key) : null;
      if (profile === 'evade-only' && nearest && dist(nearest.transform, p) < 8 && goal) {
        // Keep the objective direction but bias away from the closest threat.
        const away = { x: p.x - nearest.transform.x, z: p.z - nearest.transform.z }, d = Math.hypot(away.x, away.z) || 1;
        dir = { x: (dir?.x ?? 0) * .6 + away.x / d, z: (dir?.z ?? 0) * .6 + away.z / d };
        const n = Math.hypot(dir.x, dir.z) || 1; dir = { x: dir.x / n, z: dir.z / n };
      }
      move = fight ? { x: 0, z: 0 } : dir ?? { x: 0, z: 0 };
    }
    const target = fight && fight.health.current > 0 ? fight : null;
    world.setInput(target ? { move, interact: false, attackTarget: { id: target.id, side: 'LEFT' }, left: { down: false, held: true, up: false } } : { move, interact: false, attackTarget: undefined, left: { down: false, held: false, up: false } });
    world.update();
  }
  stopBites(); stopCivTurn();
  world.clearInput();
  return {
    profile, seed, outcome: mission.state.phase === 'result' || mission.state.phase === 'progression' ? 'complete' : 'timeout',
    simSeconds: mission.state.stats.time, deaths: mission.state.stats.deaths, kills: mission.state.stats.kills, damage: mission.state.stats.damage,
    timeline, infectedAfterExit, maxInfected, exitHeadingsDeg: [...mission.state.l1!.exitHeadingsDeg], exitIds: [...mission.state.l1!.exitIds], technicianId: mission.state.l1!.techId, bites,
  };
}
export const l1BotConfig = l1v2.bots;

export interface DuelReport { seed: number; count: number; weapon: 'unarmed' | 'bat'; skill: 'newbie' | 'standing'; playerDied: boolean; diedAtS: number | null; killed: number; seconds: number }
/**
 * AC14 duel bot: the player (unarmed or with the bat) against `count` infected chasing from 7 m, standing or
 * `newbie` (250 ms reaction, 15 % skipped attacks). Runs inside the real L1 world; ends when all infected are down,
 * the player dies, or after `maxSeconds`.
 */
export async function runDuel(opts: { seed: number; count: number; weapon: 'unarmed' | 'bat'; skill: 'newbie' | 'standing'; maxSeconds?: number }): Promise<DuelReport> {
  const { world } = await loadL1(opts.seed);
  const rng = new Rng(opts.seed, 'duel'), ai = world.infected!, player = world.entities.get(1)!;
  world.combat!.setLoadout([opts.weapon === 'bat' ? 'weapon.bat' : 'weapon.fists'], ['weapon.kick']);
  const ids: number[] = [];
  for (let i = 0; i < opts.count; i++) {
    const angle = (i / opts.count) * Math.PI * 2 + rng.next() * .5;
    for (let r = 7; r > 2; r -= .5) {
      const at = { x: player.transform.x + Math.cos(angle) * r, z: player.transform.z + Math.sin(angle) * r };
      if (ai.nav.clear(at.x, at.z, .45)) { ids.push(ai.spawn('infected.runner', at, { state: 'chase', yaw: -Math.atan2(player.transform.z - at.z, player.transform.x - at.x) })); break; }
    }
  }
  const maxTicks = (opts.maxSeconds ?? 40) * 60, reaction = opts.skill === 'newbie' ? 15 : 1;
  let target: EntitySnapshot | undefined, died: number | null = null, miss = false;
  for (let tick = 0; tick < maxTicks; tick++) {
    const living = ids.map(id => world.entities.get(id)).filter((e): e is EntitySnapshot => !!e && e.health.current > 0);
    if (!living.length) break;
    if (player.health.current <= 0) { died ??= tick / 60; break; }
    if (tick % reaction === 0) {
      target = living.sort((a, b) => dist(a.transform, player.transform) - dist(b.transform, player.transform))[0];
      miss = opts.skill === 'newbie' && rng.next() < .15;
    }
    world.setInput(target && !miss ? { move: { x: 0, z: 0 }, attackTarget: { id: target.id, side: 'LEFT' }, left: { down: false, held: true, up: false } } : { move: { x: 0, z: 0 }, attackTarget: undefined, left: { down: false, held: false, up: false } });
    world.update();
  }
  const killed = ids.filter(id => (world.entities.get(id)?.health.current ?? 0) <= 0).length;
  const report: DuelReport = { seed: opts.seed, count: opts.count, weapon: opts.weapon, skill: opts.skill, playerDied: died !== null, diedAtS: died, killed, seconds: world.tick / 60 };
  world.clearInput(); world.dispose();
  return report;
}
