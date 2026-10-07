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
export class Walker {
  private route = { path: [] as number[], goal: -1, pathIndex: 0 };
  private key = '';
  private readonly wp = { x: 0, z: 0 };
  reset(): void { this.route = { path: [], goal: -1, pathIndex: 0 }; }
  /** Pick an actual connected grid destination, rather than a point across a fence. */
  detour(world: SimWorld, goal: { x: number; z: number }, away?: { x: number; z: number }): { x: number; z: number } | null {
    const p = world.entities.get(1)!.transform, nav = world.infected!.nav;
    const from = nav.nearestCell(p.x, p.z, .45), path: number[] = [];
    let best: { x: number; z: number } | null = null, score = -Infinity;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, target = { x: p.x + Math.cos(angle) * 6, z: p.z + Math.sin(angle) * 6 };
      nav.reachPath(from, target, path);
      const cell = path[path.length - 1];
      if (cell === undefined || path.length > 40) continue;
      const at = { x: nav.x(cell), z: nav.z(cell) };
      if (dist(p, at) < 3) continue;
      const value = dist(p, goal) - dist(at, goal) + (away ? 2 * (dist(at, away) - dist(p, away)) : 0);
      if (value > score) { best = at; score = value; }
    }
    this.reset();
    return best;
  }
  /** Route toward the target; stop within `stop` metres or when no route is available. */
  step(world: SimWorld, target: { x: number; z: number }, stop: number, key: string): { x: number; z: number } | null {
    const p = world.entities.get(1)!.transform;
    if (dist(p, target) <= stop) return null;
    if (key !== this.key) { this.key = key; this.reset(); }
    // Use the player flood's separate workspace: crowd A* cannot starve a re-plan.
    const ok = world.infected!.nav.steer(p, target, this.route, .45, this.wp, Infinity, true);
    // A failed search is not permission to walk straight through its obstacle.
    if (!ok) return null;
    const dx = this.wp.x - p.x, dz = this.wp.z - p.z, d = Math.hypot(dx, dz) || 1;
    // Held movement lasts 250 ms for the newbie: brake before a short grid waypoint.
    const speed = Math.min(1, d / 1.2);
    return { x: dx / d * speed, z: dz / d * speed };
  }
}

/** Runs one profile to the result screen (or the time limit) and reports. */
export function runL1(world: SimWorld, mission: Mission, profile: L1Profile, opts: { seed?: number; maxSeconds?: number; stopWhen?: (mission: Mission) => boolean; onExit?: (world: SimWorld, mission: Mission) => void } = {}): L1Report {
  const seed = opts.seed ?? world.seed, maxTicks = (opts.maxSeconds ?? 900) * 60, rng = new Rng(seed, `bot-${profile}`);
  const walker = new Walker(), seen = new Set<string>(), timeline: L1Report['timeline'] = [];
  const infectedAfterExit: Record<number, number> = {};
  const bike = world.vehicles?.bicycle, useBike = profile === 'complete' && !!bike?.entity;
  const stuck: { at: { x: number; z: number } | null; n: number } = { at: null, n: 0 };
  let sampleAt = 0;
  let rode = false, press = false, maxInfected = 0, bites = 0, exitTick = 0, detour: { x: number; z: number; until: number } | null = null, decideAt = 0, move = { x: 0, z: 0 }, fight: EntitySnapshot | null = null;
  const stopBites = world.events.on('outbreak.bite', () => { bites++; });
  const stopCivTurn = world.events.on('civilian.turned', () => { bites++; });
  const anchor = (name: string) => mission.def.anchors[name];
  const alive = () => world.infected?.active.filter(e => e.health.current > 0) ?? [];
  const newbie = profile === 'newbie', fights = profile === 'complete' || profile === 'newbie';
  for (let tick = 0; tick < maxTicks && mission.state.phase !== 'result' && mission.state.phase !== 'progression'; tick++) {
    if (opts.stopWhen?.(mission)) break;
    const player = world.entities.get(1)!, p = player.transform, l1 = mission.state.l1!, t = world.tick / 60;
    for (const id of mission.state.completedObjectives) if (!seen.has(id)) { seen.add(id); timeline.push({ id, t }); }
    if (l1.exitIds.length && !exitTick) { exitTick = world.tick; opts.onExit?.(world, mission); }
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
      const threats = alive().filter(e => !e.hidden && !e.infected?.hidden && dist(e.transform, p) <= 9 && world.infected!.nav.visible(p, e.transform, 0)).sort((a, b) => dist(a.transform, p) - dist(b.transform, p));
      const nearest = threats[0];
      fight = fights && nearest && dist(nearest.transform, p) <= 2.6 && (!newbie || rng.next() > .15) ? nearest : null;
      let goal: { x: number; z: number } | null = null, stop = 1.2, key = step?.id ?? 'wait';
      press = false;
      if (bike?.riding) rode = true;
      // A jammed bicycle (wide turns against corners): after 3 s without progress the courier steps off and walks.
      // Decision ticks can shift after a cinematic or respawn; do not require an exact modulo tick.
      if (world.tick >= sampleAt) {
        sampleAt = world.tick + 60;
        if (stuck.at && dist(stuck.at, p) < .6 && move.x * move.x + move.z * move.z > 0) stuck.n++; else stuck.n = 0;
        stuck.at = { x: p.x, z: p.z };
      }
      if (bike?.riding && stuck.n >= 3) { press = true; stuck.n = 0; }
      else if (stuck.n >= 3 && step) {
        const at = walker.detour(world, anchor(goals[step.id]), nearest?.transform);
        detour = at ? { ...at, until: world.tick + 240 } : null; stuck.n = 0;
      }
      if (step) goal = anchor(goals[step.id]);
      else if (l1.delivered && !l1.exitIds.length) { goal = anchor('lab-door'); stop = 3; key = 'calm'; }
      if (step?.id === 'deliver' || step?.id === 'pickup') stop = .9;
      if (step?.id === 'firestation') stop = .25;
      // The courier rides from bike-start through the depot to the facility; it auto-dismounts at the no-bike zone edge.
      if (useBike && !rode && !bike!.riding && !l1.delivered && step && (step.id === 'pickup' || step.id === 'deliver')) {
        const at = bike!.entity!.transform;
        if (dist(at, p) <= 1.4) press = true; else { goal = { x: at.x, z: at.z }; stop = 1; key = 'to-bike'; }
      }
      if (detour && (world.tick > detour.until || dist(p, detour) < 1)) { detour = null; walker.reset(); }
      const enteringBay = profile === 'evade-only' && step?.id === 'firestation' && dist(p, anchor('fire-bay-trigger')) <= 14;
      if (enteringBay && detour) { detour = null; walker.reset(); }
      // Retreat along a connected route if a crowd is winning; fight isolated blockers.
      if (!enteringBay && !detour && goal && nearest && player.health.current < 35 && threats.filter(e => dist(e.transform, p) < 4).length >= 3) {
        const at = walker.detour(world, goal, nearest.transform);
        if (at) detour = { ...at, until: world.tick + 180 };
      }
      if (newbie) {
        if (!detour && rng.next() < .0006) { const names = Object.keys(mission.def.anchors); const a = anchor(names[Math.floor(rng.next() * names.length)]); detour = { x: a.x, z: a.z, until: world.tick + 360 }; }
        }
      // Raw away-vectors can drive into the garage wall forever. Choose an actual connected escape route.
      // Once near the bay, keep running toward shelter with normal input instead of relying on an ending auto-walk.
      if (profile === 'evade-only' && !enteringBay && !detour && nearest && dist(nearest.transform, p) < 8 && goal) {
        const at = walker.detour(world, goal, nearest.transform);
        if (at) detour = { ...at, until: world.tick + 240 };
      }
      if (detour) { goal = detour; stop = .8; key = `detour-${detour.until}`; fight = null; }
      const dir = goal ? walker.step(world, goal, stop, key) : null;
      move = fight ? { x: 0, z: 0 } : dir ?? { x: 0, z: 0 };
    }
    const target = fight && fight.health.current > 0 ? fight : null;
    world.setInput(target ? { move, interact: press, attackTarget: { id: target.id, side: 'LEFT' }, left: { down: false, held: true, up: false } }   : { move, interact: press, attackTarget: undefined, left: { down: false, held: false, up: false } });
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
  world.combat!.setLoadout([opts.weapon === 'bat' ? 'weapon.bat' : 'weapon.fists'], ['weapon.fists']);
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
