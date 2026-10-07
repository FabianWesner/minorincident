import { Rng } from '../../core/Rng';
import { l1v2 } from '../../data/l1v2';
import { l1AccidentEvents, type L1AccidentEventName } from '../outbreak/types';
import { installL1Outbreak } from '../outbreak/install';
import type { Mission } from './Mission';
import type { L1State } from './types';
import type { EntitySnapshot } from '../world/types';
import { L1Story } from './L1Story';

const TICKS = 60;
/** Story-only numbers; spec section 3 beats 4 to 6. Everything systemic lives in the C/D lanes. */
const story = {
  techWalkMs: 1.6, takeBoxS: 1.5, standoffM: 1.4, awayFromLabM: 30, exitSearchS: 12, exitSearchM: 4,
  /** Accident sequence anchors (sim lookups) and the exits: [anchor, heading in degrees, 0 = +X east, 90 = +Z south]. */
  anchors: { 'l1.flicker': 'lab-smoke-window', 'l1.blast': 'lab-exit-window', 'l1.ringing': 'lab-door', 'l1.smoke': 'lab-smoke-vent', 'l1.screams': 'lab-door', 'l1.infectedExit': 'lab-exit-front' } as Record<L1AccidentEventName, string>,
  exits: [['lab-exit-front', 125], ['lab-exit-front', 95], ['lab-exit-side', 170], ['lab-exit-window', 215], ['lab-exit-window', 250]] as [string, number][],
  /** Infected looks for the lab staff (existing variants until the lab-staff models are registered). */
  staffModels: ['npc.lab-guard', 'npc.lab-tech-b', 'npc.civilian-woman-b', 'npc.civilian-man-a'],
  staffTints: ['#2f4858', '#e5d9b9', '#c4473d', '#6d5aa8'],
  variants: ['inf.delivery-driver', 'inf.cashier', 'inf.bbq-dad', 'inf.suburban-mom', 'inf.bathrobe-neighbor'],
  techRole: 'delivery-driver', techModel: 'npc.lab-tech-a', techTint: '#f1f1ec',
  /** Fair moment (QA1-05): windows burst first, the side door next, the front door (and the technician) last. */
  exitDelayS: { 'lab-exit-window': 3, 'lab-exit-side': 3.5, 'lab-exit-front': 4.5 } as Record<string, number>,
  /** Grace for a player at the door: exits are disoriented ~3 s, bites on the player hit softly for the first 8 s. */
  graceDamage: .25, graceS: 8, staggerS: 1.5,
  blastPushM: 3.2, blastPushRangeM: 12,
  eventOrder: ['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams'] as const,
};
const fresh = (): L1State => ({
  phase: 'morning', carrying: false, delivered: false, away: false, techId: 0, hx: 0, hz: 0,
  handoverAt: 0, deliveredAt: 0, flickerAt: 0, exitAt: 0, warned: false, fired: 0,
  exitIds: [], exitHeadingsDeg: [], runs: [], turnedIds: [], escapedIds: [], graceUntil: 0, hordeDone: false, routeSpawns: 0, routeNextAt: 0,
});

/**
 * L1 v2 story controller (spec epic-19 section 3, beats 2 to 10). Scripted only up to the infected exit: the
 * technician hand-over, the 4 to 6 s calm, the accident events (rendered and voiced by lane H) and the five exits.
 * From beat 6 on the outbreak is systemic (lanes C and D); this class then only counts results.
 */
export class LevelOneOutbreak {
  /** PO UAT story beats (clerk, technician, garage rack, fire station). */
  readonly story: L1Story;
  constructor(private readonly mission: Mission) { this.story = new L1Story(mission); }
  private get l1(): L1State { return this.mission.state.l1!; }
  private anchor(name: string) { return this.mission.def.anchors[name]; }

  prepare(): void {
    const { world, state } = this.mission, ai = world.infected, npcs = world.npcs;
    state.l1 = fresh();
    world.combat?.clearLoadout();
    // Caps 60 (high) / 30 (low): the director halves levelCap on the low tier.
    if (ai) ai.director.levelCap = l1v2.director.capHigh;
    if (!ai || !npcs) return;
    // Lane D: pedestrians, panic, bites and transformations (after setQuality, so the tier is already known).
    const outbreak = npcs.civilians.outbreak ?? installL1Outbreak(world);
    // The technician is a pedestrian entity driven by the script alone; he turns in place (same id, look) at the exit.
    const spawn = this.anchor('lab-tech-spawn'), nav = ai.nav;
    const cell = nav.nearestCell(spawn.x, spawn.z), p = nav.clear(spawn.x, spawn.z, .35) ? { x: spawn.x, z: spawn.z } : { x: nav.x(cell), z: nav.z(cell) };
    const id = outbreak.spawnPedestrian(p, { role: story.techRole, model: story.techModel, tint: story.techTint, tier: 'average' });
    const e = world.entities.get(id)!, c = e.civilian!;
    c.ambient = false; c.pauseUntil = Number.MAX_SAFE_INTEGER; c.routine = 'staff';
    Object.assign(e.transform, spawn); this.face(e, this.anchor('lab-door'));
    world.spatial.set(id, spawn.x, spawn.z);
    this.l1.techId = id;
  }

  /** Called by the mission when an objective completes (before its onComplete actions). */
  completed(id: string): void {
    const { world } = this.mission, l1 = this.l1;
    // The parcel changes hands inside the clerk beat (matched hand-to-hand), not at the objective tick.
    if (id === 'pickup') { if (world.npcs?.civilians.outbreak) this.story.pickup(); else l1.carrying = true; }
    if (id === 'weapon') { world.combat?.setLoadout(['weapon.bat'], ['weapon.fists']); this.story.garage(); }
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
    const l1 = this.l1, ai = this.mission.world.infected, ob = this.mission.world.npcs?.civilians.outbreak;
    return { delivered: l1.delivered, infected: ai ? ai.active.filter(e => e.health.current > 0).length : 0, turned: ob ? ob.stats.turned : l1.turnedIds.length, escaped: ob ? ob.stats.escaped : l1.escapedIds.length };
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
    for (const key of ['handoverAt', 'deliveredAt', 'flickerAt', 'exitAt', 'graceUntil'] as const) if (l1[key]) l1[key] += delta;
    for (const run of l1.runs) run.until += delta;
    if (l1.exitIds.length && this.mission.state.checkpoint === 'accident') this.safeRespawn();
  }

  /**
   * Death after the accident (QA2b-01): the checkpoint sits at the door in the middle of the mob, so the player is placed at the
   * safest nearby street point out of infected sight with ~2 s of invulnerability, and infected close to the old spot are sent searching.
   */
  private safeRespawn(): void {
    const { world } = this.mission, ai = world.infected, nav = ai?.nav, player = world.entities.get(1)!, tick = world.tick;
    if (!ai || !nav) return;
    const live = ai.active.filter(e => e.health.current > 0), gate = this.anchor('lab-gate'), from = { x: player.transform.x, z: player.transform.z };
    const near = (x: number, z: number) => live.reduce((m, e) => Math.min(m, Math.hypot(e.transform.x - x, e.transform.z - z)), 99);
    let best = { x: from.x, z: from.z }, bestScore = -Infinity;
    const candidates = [{ x: gate.x, z: gate.z }, this.anchor('lab-bike-rack')];
    for (const r of [10, 18, 26, 34]) for (let k = 0; k < 12; k++) candidates.push({ x: gate.x + Math.cos(k * Math.PI / 6) * r, z: gate.z + Math.sin(k * Math.PI / 6) * r });
    for (const c of candidates) {
      if (!c || !nav.clear(c.x, c.z, .6) || !nav.visible(from, c, .5) && Math.hypot(c.x - from.x, c.z - from.z) > 14) continue;
      const score = Math.min(near(c.x, c.z), 22) - .15 * Math.hypot(c.x - gate.x, c.z - gate.z);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    player.transform.x = best.x; player.transform.z = best.z;
    world.physics.playerBody!.setTranslation(player.transform, true); world.previousPlayer = { ...player.transform }; world.spatial.set(1, best.x, best.z);
    world.player!.setCheckpoint(player.transform);
    if (player.survivor) player.survivor.invulnerableUntil = tick + 2 * TICKS;
    for (const e of live) {
      if (Math.hypot(e.transform.x - best.x, e.transform.z - best.z) > 22 || !e.infected?.l1) continue;
      // Re-disperse: a point 25 m from the player, away from them, then a normal search.
      const a = Math.atan2(e.transform.z - best.z, e.transform.x - best.x), cell = nav.nearestCell(e.transform.x + Math.cos(a) * 25, e.transform.z + Math.sin(a) * 25);
      if (cell >= 0) { e.infected.l1.mode = 'wander'; e.infected.state = 'wander'; ai.rush(e.id, { x: nav.x(cell), z: nav.z(cell) }, tick + 10 * TICKS); }
    }
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
    this.story.update();
    // The technician is script-driven until he turns: ambient civilian logic (alarm, flee) must not move him.
    if (tech?.civilian) { tech.civilian.state = 'calm'; tech.civilian.pauseUntil = Number.MAX_SAFE_INTEGER; }
    if (!l1.delivered) this.handover(tick, player);
    else if (l1.phase === 'calm' || l1.phase === 'accident') this.accident(tick);
    if (l1.runs.length) this.run(tick);
    if (l1.graceUntil && tick >= l1.graceUntil) {
      l1.graceUntil = 0;
      for (const id of l1.exitIds) { const e = world.entities.get(id); if (e?.combat && e.infected) e.combat.damageMultiplier = 1; }
    }
    if (l1.phase === 'spread' && tick % 300 === 0 && l1.graceUntil === 0 && world.npcs?.civilians.outbreak?.stats.bites === 0) {
      // Robust start: until the first bite, idle exit infected are re-sent to the nearest pedestrian wherever they are.
      for (const id of l1.exitIds) { const e = world.entities.get(id), t = e && e.health.current > 0 ? this.pedestrianTarget(e.transform, 120) : null; if (t) world.infected!.rush(id, t, tick + 10 * TICKS); }
    }
    if (l1.phase === 'spread') this.horde(tick, player);
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
        l1.handoverAt = tick; l1.phase = 'handover'; this.story.handoverStart(l1.techId, door);
      } else { this.place(tech, spawn.x, spawn.z, a); return; }
    }
    const out1 = Math.hypot(door.x - spawn.x, door.z - spawn.z), out2 = Math.hypot(l1.hx - door.x, l1.hz - door.z), total = out1 + out2;
    const walkS = total / story.techWalkMs, pauseS = story.takeBoxS;
    // Any press during the beat fast-forwards to the moment the technician has the box.
    if (this.story.skipping && (tick - l1.handoverAt) / TICKS < walkS + pauseS) l1.handoverAt = tick - Math.ceil((walkS + pauseS) * TICKS);
    const t = (tick - l1.handoverAt) / TICKS;
    const point = (m: number) => m <= out1 ? { x: spawn.x + (door.x - spawn.x) * m / out1, z: spawn.z + (door.z - spawn.z) * m / out1 }
      : { x: door.x + (l1.hx - door.x) * (m - out1) / out2, z: door.z + (l1.hz - door.z) * (m - out1) / out2 };
    let pos: { x: number; z: number };
    if (t < walkS) { pos = point(t * story.techWalkMs); this.story.handoverPose(tech, 'out'); }
    else if (t < walkS + pauseS) {
      // Nervous glance, then he signs and takes the box (matched with the courier's hand-over).
      pos = { x: l1.hx, z: l1.hz }; const into = t - walkS;
      if (into < .6) { this.story.handoverPose(tech, 'glance'); if (tick === l1.handoverAt + Math.ceil(walkS * TICKS)) this.story.say(tech.id, 'handover.tech'); }
      else { this.story.handoverPose(tech, 'sign'); if (tick === l1.handoverAt + Math.ceil((walkS + .6) * TICKS)) world.player?.act('hand-over', tick); if (into >= 1.05) l1.carrying = false; }
    }
    else if (t < 2 * walkS + pauseS) { l1.carrying = false; this.story.handoverPose(tech, 'in'); pos = point(total - (t - walkS - pauseS) * story.techWalkMs); if (t - walkS - pauseS > .4) this.story.handoverEnd(undefined); }
    else {
      this.place(tech, spawn.x, spawn.z, this.anchor('lab-door')); this.story.handoverEnd(tech);
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
    if (type === 'l1.blast') this.blastPush();
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
        const target = this.pedestrianTarget(at) ?? this.farPoint(at, rad);
        const exiting = world.entities.get(id);
        if (exiting?.combat) { exiting.combat.damageMultiplier = story.graceDamage; exiting.combat.staggerUntil = tick + Math.round(story.staggerS * TICKS); }
        if (i === 0) {
          // The technician is still inside: scripted indoor leg to the front door, then the real infected AI is rushed outward.
          l1.runs.push({ id, dx: target.x, dz: target.z, speed, until: tick + 60 * TICKS, via: { x: at.x, z: at.z } });
        } else {
          const delay = Math.round((story.exitDelayS[exit] ?? 0) * TICKS);
          if (delay === 0) ai.rush(id, target, tick + story.exitSearchS * TICKS);
          else {
            const brain = world.entities.get(id)?.infected?.l1; if (brain) brain.pauseUntil = tick + delay;
            l1.runs.push({ id, dx: target.x, dz: target.z, speed, until: tick + delay + 60, rushAt: tick + delay });
          }
        }
      }
    }
    l1.graceUntil = tick + story.graceS * TICKS;
    world.combat?.setLoadout(['weapon.fists'], ['weapon.fists']);
    this.mission.setState('exited', true);
    this.mission.requestCheckpoint('accident');
  }
  /** An exiting lab-staff member: a pedestrian turned at once (same pipeline as the technician), looks kept. */
  private spawnInfected(at: { x: number; z: number }, variant: string): number {
    const { world } = this.mission, ai = world.infected!, outbreak = world.npcs?.civilians.outbreak;
    for (let r = 0; r <= story.exitSearchM; r += .5) for (let k = 0; k < 8; k++) {
      const p = { x: at.x + Math.cos(k * Math.PI / 4) * r, z: at.z + Math.sin(k * Math.PI / 4) * r };
      if (!ai.nav.clear(p.x, p.z, .45) || ai.active.some(o => o.health.current > 0 && Math.hypot(o.transform.x - p.x, o.transform.z - p.z) < .9)) continue;
      if (!outbreak) return ai.spawn('infected.runner', p, { variant });
      const id = outbreak.spawnPedestrian(p, { role: story.techRole, model: story.staffModels[(this.l1.exitIds.length - 1) % story.staffModels.length], tint: story.staffTints[(this.l1.exitIds.length - 1) % story.staffTints.length] });
      outbreak.turnNow(world.entities.get(id)!);
      return id;
    }
    return 0;
  }
  /** The technician turns as infected #1: same entity id and look (lane D `turnNow`). */
  private infectTechnician(at: { x: number; z: number }): number {
    const { world } = this.mission, l1 = this.l1, e = world.entities.get(l1.techId), outbreak = world.npcs?.civilians.outbreak;
    if (!e || !outbreak) return this.spawnInfected(at, story.variants[0]);
    outbreak.turnNow(e, 'average');
    // Held still until he reaches the door (scripted indoor leg), then the real AI is rushed outward.
    const brain = e.infected?.l1; if (brain) brain.pauseUntil = world.tick + 60 * TICKS;
    return e.id;
  }

  /**
   * Beat 9 (director rules, section 5.9): from the bat pickup, ask the director every second until 6 infected are near the
   * garage exit (it only spawns off-screen); then, on the way to the fire station, up to two more streams 30 m ahead of the player.
   */
  private horde(tick: number, player: EntitySnapshot): void {
    const { world, state } = this.mission, l1 = this.l1, outbreak = world.npcs?.civilians.outbreak;
    if (!outbreak || state.steps.weapon.status !== 'completed' || tick % 30 !== 0) return;
    if (!l1.hordeDone) {
      const near = world.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - this.anchor('garage-door').x, e.transform.z - this.anchor('garage-door').z) <= l1v2.director.hordeRadiusM).length;
      // Spawn only off-screen: try Elm Street's entry first, then the nearest map-edge entries to the garage.
      const garage = this.anchor('garage-door'), entries = ['elm-horde-entry', ...[1, 2, 3, 4, 5, 6].map(i => `edge-in-${i}`)].map(n => this.anchor(n)).filter(Boolean)
        .sort((a, b) => Math.hypot(a.x - garage.x, a.z - garage.z) - Math.hypot(b.x - garage.x, b.z - garage.z));
      const before = new Set(world.infected!.active.map(e => e.id));
      if (near >= l1v2.director.hordeMinInfectedNearGarage || entries.some(entry => outbreak.ensureHorde(garage, entry) > 0)) {
        l1.hordeDone = true; l1.routeNextAt = tick + 8 * TICKS;
        // The new infected come running down the street toward the garage exit, then search around it.
        for (const e of world.infected!.active) if (!before.has(e.id) && e.health.current > 0) world.infected!.rush(e.id, garage, tick + 25 * TICKS);
      }
      return;
    }
    if (state.steps.firestation.status !== 'active' || l1.routeSpawns >= 2 || tick < l1.routeNextAt) return;
    const fire = this.anchor('fire-bay-door'), nav = world.infected!.nav, p = player.transform, d = Math.hypot(fire.x - p.x, fire.z - p.z);
    if (d < 40) return;
    const cell = nav.nearestCell(p.x + (fire.x - p.x) / d * 30, p.z + (fire.z - p.z) / d * 30);
    if (cell < 0) return;
    const ahead = { x: nav.x(cell), z: nav.z(cell) };
    // A stream is a fresh "garage-style" horde around the point ahead (the spawn waits for it to be off-screen).
    const before = new Set(world.infected!.active.map(e => e.id));
    if (outbreak.ensureHorde(ahead, ahead) > 0) {
      l1.routeSpawns++; l1.routeNextAt = tick + 15 * TICKS;
      for (const e of world.infected!.active) if (!before.has(e.id) && e.health.current > 0) world.infected!.rush(e.id, { x: p.x, z: p.z }, tick + 20 * TICKS);
    }
  }
  /** The nearest live pedestrian within 30 m of an exit: the first infected go for them before the player. */
  private pedestrianTarget(at: { x: number; z: number }, maxM = 30): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null, bestD = maxM;
    for (const e of this.mission.world.entities.iterate()) {
      if (!e.civilian?.l1 || e.hidden || e.infection || e.id === this.l1.techId || !['calm', 'alarmed', 'flee'].includes(e.civilian.state)) continue;
      const d = Math.hypot(e.transform.x - at.x, e.transform.z - at.z); if (d < bestD) { bestD = d; best = { x: e.transform.x, z: e.transform.z }; }
    }
    return best;
  }
  /** Blast push along a clear direction (open ground, no prop or parked bicycle at the end), preferring away from the vent. */
  private blastPush(): void {
    const { world } = this.mission, player = world.entities.get(1)!, v = this.anchor('lab-smoke-vent'), nav = world.infected?.nav;
    const dx = player.transform.x - v.x, dz = player.transform.z - v.z, d = Math.hypot(dx, dz);
    if (!nav || d >= story.blastPushRangeM || d < .01) return;
    const base = Math.atan2(dz, dx), p = player.transform;
    for (const turn of [0, .5, -.5, 1, -1, 1.5, -1.5]) {
      const a = base + turn, ux = Math.cos(a), uz = Math.sin(a);
      for (let dist = story.blastPushM; dist >= 1.2; dist -= .8) {
        const end = { x: p.x + ux * dist, z: p.z + uz * dist };
        if (!nav.clear(end.x, end.z, .6) || !nav.visible(p, end, .5)) continue;
        if ([...world.entities.iterate()].some(o => o.id !== 1 && (o.bicycle || o.interactable || o.hazard || o.destructible) && Math.hypot(o.transform.x - end.x, o.transform.z - end.z) < 1.6)) continue;
        world.knockback(player, { x: ux, z: uz }, dist); return;
      }
    }
  }
  /** A point 32 m from the exit along a heading, snapped to clear ground. */
  private farPoint(at: { x: number; z: number }, rad: number): { x: number; z: number } {
    const nav = this.mission.world.infected!.nav, x = at.x + Math.cos(rad) * 32, z = at.z + Math.sin(rad) * 32, cell = nav.nearestCell(x, z);
    return cell >= 0 ? { x: nav.x(cell), z: nav.z(cell) } : { x, z };
  }
  /** Technician indoor leg only (interior is not walkable nav); at the door the infected AI takes over via `rush`. */
  private run(tick: number): void {
    const { world } = this.mission, l1 = this.l1, ai = world.infected!;
    for (let i = l1.runs.length - 1; i >= 0; i--) {
      const run = l1.runs[i], e = world.entities.get(run.id);
      if (!e?.infected || e.health.current <= 0) { l1.runs.splice(i, 1); continue; }
      if (!run.via) {
        if (tick >= (run.rushAt ?? 0)) { l1.runs.splice(i, 1); ai.rush(e.id, { x: run.dx, z: run.dz }, tick + story.exitSearchS * TICKS); }
        continue;
      }
      const vx = run.via.x - e.transform.x, vz = run.via.z - e.transform.z, d = Math.hypot(vx, vz);
      if (d < .6 || tick >= run.until) { l1.runs.splice(i, 1); ai.rush(e.id, { x: run.dx, z: run.dz }, tick + story.exitSearchS * TICKS); continue; }
      e.transform.x += vx / d * run.speed / TICKS; e.transform.z += vz / d * run.speed / TICKS; e.transform.yaw = -Math.atan2(vz, vx);
      world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }
}
export { l1AccidentEvents };
