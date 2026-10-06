import { Rng } from '../../core/Rng';
import { l1v2 } from '../../data/l1v2';
import { l1AccidentEvents, type L1AccidentEventName } from '../outbreak/types';
import { l1Seams } from './l1Seams';
import type { Mission } from './Mission';
import type { L1State } from './types';
import type { EntitySnapshot } from '../world/types';

const TICKS = 60;
/** Story-only numbers; spec section 3 beats 4 to 6. Everything systemic lives in the C/D lanes. */
const story = {
  techWalkMs: 1.6, takeBoxS: 1.5, standoffM: 1.4, awayFromLabM: 30, exitSearchS: 12, exitSearchM: 4,
  /** Accident sequence anchors (sim lookups) and the exits: [anchor, heading in degrees, 0 = +X east, 90 = +Z south]. */
  anchors: { 'l1.flicker': 'lab-smoke-window', 'l1.blast': 'lab-exit-window', 'l1.ringing': 'lab-door', 'l1.smoke': 'lab-smoke-vent', 'l1.screams': 'lab-door', 'l1.infectedExit': 'lab-exit-front' } as Record<L1AccidentEventName, string>,
  exits: [['lab-exit-front', 125], ['lab-exit-front', 55], ['lab-exit-side', 350], ['lab-exit-window', 180], ['lab-exit-window', 235]] as [string, number][],
  /** Infected looks for the lab staff (existing variants until the lab-staff models are registered). */
  variants: ['inf.delivery-driver', 'inf.cashier', 'inf.bbq-dad', 'inf.suburban-mom', 'inf.bathrobe-neighbor'],
  techRole: 'delivery-driver', techArchetype: 'npc.lab-tech-a',
  eventOrder: ['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams'] as const,
};
const fresh = (): L1State => ({
  phase: 'morning', carrying: false, delivered: false, away: false, techId: 0, hx: 0, hz: 0,
  handoverAt: 0, deliveredAt: 0, flickerAt: 0, exitAt: 0, warned: false, fired: 0,
  exitIds: [], exitHeadingsDeg: [], runs: [], turnedIds: [], escapedIds: [],
});

/**
 * L1 v2 story controller (spec epic-19 section 3, beats 2 to 10). Scripted only up to the infected exit: the
 * technician hand-over, the 4 to 6 s calm, the accident events (rendered and voiced by lane H) and the five exits.
 * From beat 6 on the outbreak is systemic (lanes C and D); this class then only counts results.
 */
export class LevelOneOutbreak {
  constructor(private readonly mission: Mission) {}
  private get l1(): L1State { return this.mission.state.l1!; }
  private anchor(name: string) { return this.mission.def.anchors[name]; }

  prepare(): void {
    const { world, state } = this.mission, ai = world.infected, npcs = world.npcs;
    state.l1 = fresh();
    world.combat?.clearLoadout();
    // Caps 60 (high) / 30 (low): the director halves levelCap on the low tier.
    if (ai) ai.director.levelCap = l1v2.director.capHigh;
    if (!ai || !npcs) return;
    // The technician is a civilian-component entity (renders through the NPC path) driven by the script alone.
    const spawn = this.anchor('lab-tech-spawn'), nav = ai.nav;
    const cell = nav.nearestCell(spawn.x, spawn.z), p = nav.clear(spawn.x, spawn.z, .35) ? { x: spawn.x, z: spawn.z } : { x: nav.x(cell), z: nav.z(cell) };
    const id = npcs.civilians.spawn(story.techRole, p, { waypoints: [p] });
    const e = world.entities.get(id)!, c = e.civilian!;
    e.archetype = story.techArchetype; c.model = story.techArchetype; c.ambient = false; c.pauseUntil = Number.MAX_SAFE_INTEGER;
    c.variant = story.variants[0]; c.routine = 'staff';
    Object.assign(e.transform, spawn); this.face(e, this.anchor('lab-door'));
    world.spatial.set(id, spawn.x, spawn.z);
    this.l1.techId = id;
  }

  /** Called by the mission when an objective completes (before its onComplete actions). */
  completed(id: string): void {
    const { world } = this.mission, l1 = this.l1;
    if (id === 'pickup') l1.carrying = true;
    if (id === 'weapon') world.combat?.setLoadout(['weapon.bat'], ['weapon.kick']);
    if (id === 'firestation') {
      // The shutter closes behind the player (the gate action blocks the player collider): infected outside cannot pass either.
      const door = this.anchor('fire-bay-door');
      world.events.emit({ type: 'world.blocker.changed', tick: world.tick, id: 900_001, blocked: true, wall: { x: door.x, z: door.z, y: .7, halfX: door.radius, halfY: .7, halfZ: .2 } });
    }
  }
  noteTurned(id: number): void { const l1 = this.mission.state.l1; if (l1 && !l1.turnedIds.includes(id)) l1.turnedIds.push(id); }
  noteEscaped(id: number): void { const l1 = this.mission.state.l1; if (l1 && !l1.escapedIds.includes(id)) l1.escapedIds.push(id); }
  /** Result screen numbers: delivery, living infected now, pedestrians turned, pedestrians who escaped. */
  result(): { delivered: boolean; infected: number; turned: number; escaped: number } {
    const l1 = this.l1, ai = this.mission.world.infected;
    return { delivered: l1.delivered, infected: ai ? ai.active.filter(e => e.health.current > 0).length : 0, turned: l1.turnedIds.length, escaped: l1.escapedIds.length };
  }

  /**
   * Cheat/test path (`completeObjective` with no active objective): fast-forwards the scripted gap (hand-over, calm,
   * accident) to the infected exit so the generic graph walk can continue. Never used by gameplay or bots.
   */
  advance(): boolean {
    const l1 = this.mission.state.l1, tick = this.mission.world.tick;
    if (!l1 || l1.phase === 'spread') return false;
    if (!l1.delivered) { l1.delivered = true; l1.deliveredAt = tick; l1.carrying = false; this.mission.setState('delivered', true); }
    l1.flickerAt = tick - 20 * TICKS; l1.exitAt = tick; this.accident(tick);
    return this.mission.state.l1!.phase === 'spread';
  }

  /** Checkpoint restore: shift the story timeline by the time that passed since capture. */
  restore(delta: number): void {
    const l1 = this.l1;
    for (const key of ['handoverAt', 'deliveredAt', 'flickerAt', 'exitAt'] as const) if (l1[key]) l1[key] += delta;
    for (const run of l1.runs) run.until += delta;
  }

  private face(e: EntitySnapshot, at: { x: number; z: number }): void { e.transform.yaw = -Math.atan2(at.z - e.transform.z, at.x - e.transform.x); }
  private place(e: EntitySnapshot, x: number, z: number, towards: { x: number; z: number }): void {
    const dx = x - e.transform.x, dz = z - e.transform.z;
    e.transform.x = x; e.transform.z = z;
    if (Math.hypot(dx, dz) > 1e-4) e.transform.yaw = -Math.atan2(dz, dx); else this.face(e, towards);
    this.mission.world.spatial.set(e.id, x, z);
  }

  update(): void {
    const { world, state } = this.mission, l1 = state.l1; if (!l1) return;
    const tick = world.tick, player = world.entities.get(1)!, tech = world.entities.get(l1.techId);
    // The technician is script-driven until he turns: ambient civilian logic (alarm, flee) must not move him.
    if (tech?.civilian) { tech.civilian.state = 'calm'; tech.civilian.pauseUntil = Number.MAX_SAFE_INTEGER; }
    if (!l1.delivered) this.handover(tick, player);
    else if (l1.phase === 'calm' || l1.phase === 'accident') this.accident(tick);
    if (l1.runs.length) this.run(tick);
    if (l1.phase === 'spread' && !l1.away) {
      const lab = this.anchor('lab-gate');
      if (Math.hypot(player.transform.x - lab.x, player.transform.z - lab.z) >= story.awayFromLabM) { l1.away = true; this.mission.setState('away', true); }
    }
  }

  /** Beat 4: the technician comes out, takes the box and walks back in; then "Delivered". */
  private handover(tick: number, player: EntitySnapshot): void {
    const { world, state } = this.mission, l1 = this.l1, tech = world.entities.get(l1.techId);
    if (!tech) return;
    const spawn = this.anchor('lab-tech-spawn'), door = this.anchor('lab-exit-front');
    if (l1.handoverAt === 0) {
      const step = state.steps.deliver, a = this.anchor('lab-door');
      const near = (player.transform.x - a.x) ** 2 + (player.transform.z - a.z) ** 2 <= a.radius ** 2;
      if (step?.status === 'active' && l1.carrying && near && player.health.current > 0 && (world.inputFrame.interact || step.interaction >= TICKS)) {
        const dx = player.transform.x - door.x, dz = player.transform.z - door.z, d = Math.hypot(dx, dz) || 1;
        l1.hx = player.transform.x - dx / d * story.standoffM; l1.hz = player.transform.z - dz / d * story.standoffM;
        l1.handoverAt = tick; l1.phase = 'handover';
      } else { this.place(tech, spawn.x, spawn.z, a); return; }
    }
    const out1 = Math.hypot(door.x - spawn.x, door.z - spawn.z), out2 = Math.hypot(l1.hx - door.x, l1.hz - door.z), total = out1 + out2;
    const walkS = total / story.techWalkMs, pauseS = story.takeBoxS, t = (tick - l1.handoverAt) / TICKS;
    const point = (m: number) => m <= out1 ? { x: spawn.x + (door.x - spawn.x) * m / out1, z: spawn.z + (door.z - spawn.z) * m / out1 }
      : { x: door.x + (l1.hx - door.x) * (m - out1) / out2, z: door.z + (l1.hz - door.z) * (m - out1) / out2 };
    let pos: { x: number; z: number };
    if (t < walkS) pos = point(t * story.techWalkMs);
    else if (t < walkS + pauseS) { pos = { x: l1.hx, z: l1.hz }; l1.carrying = false; }
    else if (t < 2 * walkS + pauseS) pos = point(total - (t - walkS - pauseS) * story.techWalkMs);
    else {
      this.place(tech, spawn.x, spawn.z, this.anchor('lab-door'));
      l1.delivered = true; l1.deliveredAt = tick; l1.phase = 'calm'; l1.carrying = false;
      // 4 to 6 s of nothing, then the accident: a fresh seeded stream, so a retry after death replays the same timing.
      const rng = new Rng(world.seed, 'l1-story');
      l1.flickerAt = tick + Math.round((l1v2.accident.calmS[0] + rng.next() * (l1v2.accident.calmS[1] - l1v2.accident.calmS[0])) * TICKS);
      l1.exitAt = l1.flickerAt + Math.round((l1v2.accident.exitDelayS[0] + rng.next() * (l1v2.accident.exitDelayS[1] - l1v2.accident.exitDelayS[0])) * TICKS);
      this.mission.setState('delivered', true);
      this.mission.signal('l1.delivered');
      this.mission.radio('L1.delivered');
      return;
    }
    this.place(tech, pos.x, pos.z, { x: player.transform.x, z: player.transform.z });
    if (t >= walkS && t < walkS + pauseS) this.face(tech, player.transform);
  }

  /** Beat 5: corgi warning, then flicker -> blast -> ringing -> smoke -> screams; the infected exit at 8 to 10 s. */
  private accident(tick: number): void {
    const l1 = this.l1;
    const tech = this.mission.world.entities.get(l1.techId), spawn = this.anchor('lab-tech-spawn');
    if (tech) this.place(tech, spawn.x, spawn.z, this.anchor('lab-door'));
    if (tick < l1.flickerAt) return;
    if (!l1.warned) { l1.warned = true; l1.phase = 'accident'; this.mission.signal('l1.corgi-warn'); }
    for (; l1.fired < story.eventOrder.length; l1.fired++) {
      const name = story.eventOrder[l1.fired];
      if (tick < l1.flickerAt + Math.round(l1v2.accident.eventAtS[name.slice(3) as 'flicker'] * TICKS)) return;
      this.emit(name);
    }
    if (tick >= l1.exitAt) { this.emit('l1.infectedExit'); this.release(tick); }
  }
  private emit(type: L1AccidentEventName): void {
    const a = this.anchor(story.anchors[type]);
    this.mission.world.events.emit({ type, tick: this.mission.world.tick, anchor: story.anchors[type], position: { x: a.x, z: a.z } });
  }

  /** Beat 6: five infected through the exits, the technician (same entity) among them, in different directions. */
  private release(tick: number): void {
    const { world } = this.mission, l1 = this.l1, ai = world.infected;
    l1.phase = 'spread'; l1.exitIds = []; l1.exitHeadingsDeg = [];
    if (ai) {
      const rng = new Rng(world.seed, 'l1-exit');
      for (const [i, [exit, heading]] of story.exits.entries()) {
        const at = this.anchor(exit), rad = heading * Math.PI / 180;
        const speed = l1v2.speedTiers.average.baseMs * (1 + (rng.next() * 2 - 1) * l1v2.speedTiers.jitter);
        const id = i === 0 ? this.infectTechnician(at) : this.spawnInfected(at, story.variants[i]);
        if (id === 0) continue;
        l1.exitIds.push(id); l1.exitHeadingsDeg.push(heading);
        const target = this.farPoint(at, rad);
        if (i === 0) {
          // The technician is still inside: scripted indoor leg to the front door, then the real infected AI is rushed outward.
          l1.runs.push({ id, dx: target.x, dz: target.z, speed, until: tick + 60 * TICKS, via: { x: at.x, z: at.z } });
        } else ai.rush(id, target, tick + story.exitSearchS * TICKS);
      }
    }
    world.combat?.setLoadout(['weapon.fists'], ['weapon.kick']);
    this.mission.setState('exited', true);
    this.mission.requestCheckpoint('accident');
  }
  private spawnInfected(at: { x: number; z: number }, variant: string): number {
    const ai = this.mission.world.infected!;
    for (let r = 0; r <= story.exitSearchM; r += .5) for (let k = 0; k < 8; k++) {
      const p = { x: at.x + Math.cos(k * Math.PI / 4) * r, z: at.z + Math.sin(k * Math.PI / 4) * r };
      if (ai.nav.clear(p.x, p.z, .45) && !ai.active.some(o => o.health.current > 0 && Math.hypot(o.transform.x - p.x, o.transform.z - p.z) < .9)) return ai.spawn('infected.runner', p, { variant });
    }
    return 0;
  }
  /** The technician rises as infected #1: same entity id and look, civilian component replaced by the infected brain. */
  private infectTechnician(at: { x: number; z: number }): number {
    const { world } = this.mission, l1 = this.l1, e = world.entities.get(l1.techId), ai = world.infected!;
    if (!e) return this.spawnInfected(at, story.variants[0]);
    const seam = l1Seams(world).outbreak;
    if (seam?.infect?.(e.id, { tier: 'average', instant: true })) return e.id;
    const donor = ai.pool.pop();
    if (!donor) return this.spawnInfected(at, story.variants[0]);
    // Fallback in place: adopt a pooled brain, keep the entity object (id, transform, look).
    delete e.civilian;
    e.kind = 'infected'; e.faction = 'infected'; e.archetype = 'infected.runner';
    e.health = { current: 40, max: 40 };
    e.infected = donor.infected; e.combat = donor.combat;
    Object.assign(e.combat!, { radius: .35, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1 }); e.combat!.statuses.length = 0;
    Object.assign(e.infected!, { state: 'wander', variant: story.variants[0], speed: 5.1, pathGrid: -1, goal: -1, pathIndex: 0, until: 0, cooldown: 0, targetId: 0, hidden: false, grabHits: 0, grabUntil: 0, special: '', deadAt: -1 }); e.infected!.path.length = 0;
    delete e.hidden;
    world.spatial.set(e.id, e.transform.x, e.transform.z);
    ai.active.push(e);
    // Give the in-place entity the L1 brain (perception, search, tier speed) like every spawned infected.
    if (ai.l1) { ai['initL1'](e, 'average'); e.infected!.l1!.pauseUntil = world.tick + 60 * TICKS; }
    return e.id;
  }

  /** A point 20 m from the exit along a heading, snapped to clear ground. */
  private farPoint(at: { x: number; z: number }, rad: number): { x: number; z: number } {
    const nav = this.mission.world.infected!.nav, x = at.x + Math.cos(rad) * 20, z = at.z + Math.sin(rad) * 20, cell = nav.nearestCell(x, z);
    return cell >= 0 ? { x: nav.x(cell), z: nav.z(cell) } : { x, z };
  }
  /** Technician indoor leg only (interior is not walkable nav); at the door the infected AI takes over via `rush`. */
  private run(tick: number): void {
    const { world } = this.mission, l1 = this.l1, ai = world.infected!;
    for (let i = l1.runs.length - 1; i >= 0; i--) {
      const run = l1.runs[i], e = world.entities.get(run.id);
      if (!e?.infected || e.health.current <= 0 || !run.via) { l1.runs.splice(i, 1); continue; }
      const vx = run.via.x - e.transform.x, vz = run.via.z - e.transform.z, d = Math.hypot(vx, vz);
      if (d < .6 || tick >= run.until) { l1.runs.splice(i, 1); ai.rush(e.id, { x: run.dx, z: run.dz }, tick + story.exitSearchS * TICKS); continue; }
      e.transform.x += vx / d * run.speed / TICKS; e.transform.z += vz / d * run.speed / TICKS; e.transform.yaw = -Math.atan2(vz, vx);
      world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }
}
export { l1AccidentEvents };
