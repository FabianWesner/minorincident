import { Walker } from './Walker';
import { Rng } from '../../core/Rng';
import type { Mission } from '../../sim/missions/Mission';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot, InputFrame } from '../../sim/world/types';
import { emptyInput } from '../../input/InputFrame';
export type L1Profile = 'complete' | 'newbie' | 'idle' | 'evade-only';
export interface L1Report {
  profile: L1Profile; seed: number; outcome: 'complete' | 'timeout';
  simSeconds: number; deaths: number; kills: number; knockdowns: number; damage: number;
  timeline: { id: string; t: number }[];
  /** Living infected, sampled at +0/+60/+120/+240 s after the accident exit. */
  infectedAfterExit: Record<number, number>; maxInfected: number;
  exitHeadingsDeg: number[]; exitIds: number[]; technicianId: number;
  bites: number;
}
const goals: Record<string, string> = { pickup: 'parcel-counter', deliver: 'lab-door', escape: 'garage-door', weapon: 'garage-bat', firestation: 'fire-bay-trigger' };

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** Runs one profile to the result screen (or the time limit) and reports. */
export function* l1Frames(world: SimWorld, mission: Mission, profile: L1Profile, opts: { seed?: number; maxSeconds?: number; stopWhen?: (mission: Mission) => boolean; onExit?: (world: SimWorld, mission: Mission) => void } = {}): Generator<InputFrame, L1Report> {
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
  try {
  for (let tick = 0; tick < maxTicks && mission.state.phase !== 'result' && mission.state.phase !== 'progression'; tick++) {
    if (opts.stopWhen?.(mission)) break;
    const player = world.entities.get(1)!, p = player.transform, l1 = mission.state.l1!, t = world.tick / 60;
    for (const id of mission.state.completedObjectives) if (!seen.has(id)) { seen.add(id); timeline.push({ id, t }); }
    if (l1.exitIds.length && !exitTick) { exitTick = world.tick; opts.onExit?.(world, mission); }
    if (exitTick) for (const s of [0, 60, 120, 240]) if (!(s in infectedAfterExit) && world.tick - exitTick >= s * 60) infectedAfterExit[s] = alive().length;
    maxInfected = Math.max(maxInfected, alive().length);
    if (mission.state.phase === 'cinematic') { yield structuredClone(world.deviceInput); continue; }
    if (player.health.current <= 0) { world.setInput({ move: { x: 0, z: 0 }, interact: false }); yield structuredClone(world.deviceInput); continue; }
    const idle = profile === 'idle' && l1.delivered;
    if (idle) { world.setInput({ move: { x: 0, z: 0 }, interact: false, left: { down: false, held: false, up: false } }); yield structuredClone(world.deviceInput); continue; }
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
    yield structuredClone(world.deviceInput);
  }
  } finally { stopBites(); stopCivTurn(); }
  world.clearInput();
  return {
    profile, seed, outcome: mission.state.phase === 'result' || mission.state.phase === 'progression' ? 'complete' : 'timeout',
    simSeconds: mission.state.stats.time, deaths: mission.state.stats.deaths, kills: mission.state.stats.kills, knockdowns: mission.state.stats.knockdowns, damage: mission.state.stats.damage,
    timeline, infectedAfterExit, maxInfected, exitHeadingsDeg: [...mission.state.l1!.exitHeadingsDeg], exitIds: [...mission.state.l1!.exitIds], technicianId: mission.state.l1!.techId, bites,
  };
}

/** The same policy generator used by the headless L1 runner. */
export class LevelOneBot {
  private readonly frames: ReturnType<typeof l1Frames>;
  finished = false;
  constructor(world: SimWorld, readonly profile: L1Profile = 'complete') { this.frames = l1Frames(world, world.missions!, profile); }
  sample(): InputFrame { const next = this.frames.next(); this.finished = !!next.done; return next.done ? emptyInput() : next.value; }
  dispose(): void { this.frames.return(undefined as never); }
}
