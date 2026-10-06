import { Rng } from '../../core/Rng';
import { l1v2 } from '../../data/l1v2';
import { civilianRoles, l1Pedestrians } from '../../data/npcs';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { CivilianState, Point } from '../npc/types';
import type { Appearance } from './appearance';
import { HumanTargets } from './humans';
import type { BiteEvent, InfectionPhase, LosBlockerRegistry, SpeedTier, Vec2 } from './types';

const ticks = (seconds: number) => Math.round(seconds * 60);
const civ = l1v2.civilians;
/** Seconds of each transformation phase except collapse, which takes the rest of the 3.0 +/- 0.5 s (section 5.7). */
const phaseS = { stagger: .5, eyes: .7, rise: .6 } as const;
/** Skin blend toward ash-green at the end of the collapse (section 5.7: 0 to 40 %). */
const skinBlend = .4;
const mobile = new Set<CivilianState>(['calm', 'alarmed', 'flee']);

/** A refuge door (house, shop) or off-map edge. Entering it removes a fleeing pedestrian as "escaped". */
export interface Refuge { id: string; x: number; z: number }
export interface OutbreakOptions {
  /** Refuge doors and map edges a fleeing pedestrian runs to (anchors `refuge-door-*`, `edge-in-*`). */
  refuges: Refuge[];
  /** Off-screen entries for the civilian top-up (anchors `edge-in-*`). Defaults to the edge refuges. */
  entries?: Refuge[];
  /** Named positions for anchor-only accident events (`l1.blast` at `lab-door`, ...). */
  anchors?: Record<string, Vec2>;
  tier?: 'high' | 'low';
}
export interface PedestrianOptions {
  role?: string; model?: string; tint?: string; accessories?: string[]; handProp?: string | null; tier?: SpeedTier;
  waypoints?: Point[]; faces?: (Point | null)[]; yaw?: number;
}

/**
 * L1 v2 pedestrians and systemic outbreak (specs/epic-19 sections 5.1, 5.7, 5.9). Replaces the E08 civilian lifecycle
 * when installed (`world.npcs.civilians.outbreak`): routines, notice (sight cone + hearing), startle, flight to
 * refuges, 1.0 s grab with rescue window, bite, and the 3 s transformation that turns the SAME entity into an
 * infected with the same asset, tint and accessories. Lane C's infected AI chases and reaches humans; this class
 * detects the contact, owns the grab/bite, and emits `outbreak.bite` / `outbreak.infection` / `outbreak.civilian-escaped`.
 */
export class Outbreak {
  readonly rng: Rng;
  readonly humans: HumanTargets;
  readonly stats = { bites: 0, turned: 0, killed: 0, escaped: 0, rescued: 0, toppedUp: 0, hordeSpawned: 0 };
  /** Tick of the first living infected in the level; -1 before the accident. */
  started = -1;
  /** Optional dynamic line-of-sight blockers (gates, car-wash curtain) registered by lane C/F. */
  blockers: LosBlockerRegistry | null = null;
  readonly refuges: Refuge[];
  readonly entries: Refuge[];
  private readonly heard: { x: number; z: number; tick: number }[] = [];
  private readonly rescue = new Set<number>();
  /** People convulsing on the ground this tick: witnesses notice them like an infected. */
  private readonly turning: EntitySnapshot[] = [];
  private emitting = false;
  private topUpAt = 0;
  private readonly offs: (() => void)[] = [];
  constructor(readonly world: SimWorld, readonly options: OutbreakOptions) {
    this.rng = new Rng(world.seed, 'outbreak');
    this.humans = new HumanTargets(world);
    const ai = world.infected!;
    ai.director.levelCap = l1v2.director.capHigh; ai.director.tier = options.tier ?? 'high';
    this.refuges = options.refuges.map(r => ({ id: r.id, ...this.snap(r) }));
    this.entries = (options.entries ?? options.refuges.filter(r => r.id.startsWith('edge'))).map(r => ({ id: r.id, ...this.snap(r) }));
    const hear = (event: { type: string; position?: Vec2; anchor?: string }) => {
      const p = event.position ?? (event.anchor ? options.anchors?.[event.anchor] : undefined); if (p) this.hear(p);
    };
    this.offs.push(world.events.on('l1.blast', hear), world.events.on('l1.screams', hear));
    this.offs.push(world.events.on('outbreak.bite', event => { if (event.type === 'outbreak.bite' && !this.emitting) this.externalBite(event); }));
    // Lane C's L1 brain grabs on contact and owns the 1.0 s hold and the rescue; the victim only mirrors it here.
    this.offs.push(world.events.on('civilian.grabbed', event => { if (event.type === 'civilian.grabbed' && !this.emitting && this.aiBites()) this.grabbedBy(event.targetId, event.sourceId); }));
    this.offs.push(world.events.on('combat.hit', event => {
      if (event.type !== 'combat.hit') return;
      if (world.npcs?.civilians.holds(event.targetId)) this.rescue.add(event.targetId);
    }));
  }
  /** True when lane C's L1 infected brain is active (D-GROVE): it grabs, holds, rescues and emits `outbreak.bite`. */
  aiBites(): boolean { return !!this.world.infected?.l1; }
  private grabbedBy(targetId: number, sourceId: number): void {
    const e = this.world.entities.get(targetId), c = e?.civilian, attacker = this.world.entities.get(sourceId);
    if (!e || !c?.l1 || e.infection || !attacker || !mobile.has(c.state)) return;
    delete c.l1.doorAt; c.attacker = sourceId; c.threat.x = attacker.transform.x; c.threat.z = attacker.transform.z; this.dropProp(e);
    this.state(e, 'grabbed', ticks(civ.grabS)); this.face(e, attacker.transform, Math.PI); this.hear(e.transform);
  }
  dispose(): void { this.offs.forEach(off => off()); this.offs.length = 0; }
  private snap(p: Vec2): Vec2 {
    const nav = this.world.infected!.nav;
    if (nav.clear(p.x, p.z, .35)) return { x: p.x, z: p.z };
    const cell = nav.nearestCell(p.x, p.z); return cell >= 0 ? { x: nav.x(cell), z: nav.z(cell) } : { x: p.x, z: p.z };
  }
  private range([min, max]: readonly [number, number]): number { return min + this.rng.next() * (max - min); }
  /** A scream or blast; pedestrians within 12 m notice it (infected never hear in L1). */
  hear(position: Vec2): void { this.heard.push({ x: position.x, z: position.z, tick: this.world.tick }); }

  /** One L1 pedestrian with a seeded look, speeds and a calm routine. Returns the entity id. */
  spawnPedestrian(position: Point, options: PedestrianOptions = {}): number {
    const civilians = this.world.npcs!.civilians;
    const role = options.role ?? civilianRoles[Math.floor(this.rng.next() * civilianRoles.length)].role;
    const id = civilians.spawn(role, position, { waypoints: options.waypoints ?? [position] });
    const e = this.world.entities.get(id)!, c = e.civilian!;
    const model = options.model ?? l1Pedestrians.models[Math.floor(this.rng.next() * l1Pedestrians.models.length)];
    c.model = model;
    e.transform.yaw = options.yaw ?? this.rng.next() * Math.PI * 2;
    const tier: SpeedTier = options.tier ?? (model === 'npc.civilian-elderly' || role === 'bathrobe-neighbor' ? 'frail' : role === 'jogger' || this.rng.next() < l1Pedestrians.athleticShare ? 'athletic' : 'average');
    e.appearance = { entityId: id, asset: model, tint: options.tint ?? l1Pedestrians.shirts[Math.floor(this.rng.next() * l1Pedestrians.shirts.length)],
      accessories: [...(options.accessories ?? [])], handProp: options.handProp ?? null, tier } satisfies Appearance;
    c.l1 = { walkSpeed: this.range(civ.walkSpeed) * (model === 'npc.civilian-elderly' ? .85 : 1), fleeSpeed: this.range(civ.fleeSpeed) * (tier === 'frail' ? .9 : 1),
      startleTicks: ticks(this.range(civ.startleS)), refuge: null, target: null, repickAt: 0, noticed: -1, faces: options.faces ? structuredClone(options.faces) : undefined };
    c.pauseUntil = this.world.tick + Math.floor(this.rng.next() * 90);
    return id;
  }

  update(): void {
    const world = this.world, ai = world.infected!, tick = world.tick;
    if (this.started < 0 && ai.active.some(a => a.health.current > 0)) { this.started = tick; this.topUpAt = tick; }
    // A pooled record reused by another spawn never inherits a former pedestrian's look.
    for (const e of ai.active) if (e.appearance && e.appearance.entityId !== e.id) delete e.appearance;
    while (this.heard.length && this.heard[0].tick < tick - 1) this.heard.shift();
    this.turning.length = 0; for (const e of world.entities.iterate()) if (e.infection && e.infection.phase !== 'stagger') this.turning.push(e);
    for (const e of world.entities.iterate()) {
      const c = e.civilian; if (!c || c.pet || !c.l1 || e.hidden) continue;
      if (e.infection) { this.transform(e); continue; }
      if (c.state === 'grabbed') { this.held(e); continue; }
      if (c.state === 'finished' || c.state === 'infected') continue;
      if ((tick + e.id) % 6 === 0 || this.heard.length) this.perceive(e);
      if (c.state === 'calm') this.routine(e);
      else if (c.state === 'alarmed') {
        this.face(e, c.threat, .2);
        if (tick >= c.until) { this.state(e, 'flee'); c.l1.repickAt = tick; }
      } else if (c.state === 'flee' || c.state === 'hide') this.flee(e);
      if (!e.hidden && e.civilian && mobile.has(c.state) && (tick + e.id) % 2 === 0 && !this.aiBites()) this.contact(e);
    }
    this.topUp();
  }

  private state(e: EntitySnapshot, state: CivilianState, duration = 0): void {
    const c = e.civilian!; if (c.state === 'grabbed' && state !== 'grabbed') this.world.npcs!.civilians.release(c.attacker);
    c.state = state; c.entered = this.world.tick; c.until = this.world.tick + duration;
    this.world.events.emit({ type: 'civilian.state', tick: this.world.tick, id: e.id, state, until: c.until });
  }
  private face(e: EntitySnapshot, p: Vec2, rate: number): void {
    const yaw = -Math.atan2(p.z - e.transform.z, p.x - e.transform.x), delta = Math.atan2(Math.sin(yaw - e.transform.yaw), Math.cos(yaw - e.transform.yaw));
    e.transform.yaw += Math.max(-rate, Math.min(rate, delta));
  }
  private dropProp(e: EntitySnapshot): void { if (e.appearance) e.appearance.handProp = null; }

  /** Calm life: walk the routine loop at 1.2-1.5 m/s and pause facing something (partner, window, flowers). */
  private routine(e: EntitySnapshot): void {
    const c = e.civilian!, l1 = c.l1!, tick = this.world.tick;
    const face = l1.faces?.[(c.waypoint + c.waypoints.length - 1) % c.waypoints.length];
    if (tick < c.pauseUntil) { if (face) this.face(e, face, .1); return; }
    const target = c.waypoints[c.waypoint];
    this.world.npcs!.move(e, target, l1.walkSpeed, c, .15);
    const left = Math.hypot(e.transform.x - target.x, e.transform.z - target.z);
    l1.progressFrom ??= { x: e.transform.x, z: e.transform.z }; l1.progressAt ??= tick;
    if (Math.hypot(e.transform.x - l1.progressFrom.x, e.transform.z - l1.progressFrom.z) > .3) { l1.progressAt = tick; l1.progressFrom.x = e.transform.x; l1.progressFrom.z = e.transform.z; }
    // Two walkers blocking each other (or a blocked route) turn back after 1 s instead of standing in each other's way.
    const stuck = tick - l1.progressAt > 60;
    if (left < (c.waypoints.length > 1 ? .3 : 1) || stuck) {
      l1.progressAt = tick; l1.progressFrom.x = e.transform.x; l1.progressFrom.z = e.transform.z;
      c.waypoint = (c.waypoint + (stuck && left >= .3 ? c.waypoints.length - 1 : 1)) % c.waypoints.length; c.path.length = 0; c.goal = -1;
      // Pauses always have something to face; plain walkers keep walking.
      const faces = l1.faces?.[(c.waypoint + c.waypoints.length - 1) % c.waypoints.length];
      c.pauseUntil = faces ? tick + ticks(2 + this.rng.next() * 6) : tick;
    }
  }

  /** Sight: 140 degree cone, 16 m, clear line of sight. Hearing: screams and blasts within 12 m. */
  private perceive(e: EntitySnapshot): void {
    const c = e.civilian!, ai = this.world.infected!, range = civ.noticeRangeM, half = Math.cos(civ.noticeConeDeg / 2 * Math.PI / 180);
    const fx = Math.cos(e.transform.yaw), fz = -Math.sin(e.transform.yaw);
    let threat: Vec2 | null = null, best = Infinity;
    for (let i = 0, n = ai.active.length + this.turning.length; i < n; i++) {
      const a = i < ai.active.length ? ai.active[i] : this.turning[i - ai.active.length];
      if (a.health.current <= 0 || a.infectionRise || a.infected?.hidden || a.hidden || a === e) continue;
      const dx = a.transform.x - e.transform.x, dz = a.transform.z - e.transform.z, d = Math.hypot(dx, dz);
      if (d > range || d >= best) continue;
      if (d > .8 && (dx * fx + dz * fz) / d < half) continue;
      if (!this.sees(e.transform, a.transform, a.id)) continue;
      threat = a.transform; best = d;
    }
    if (!threat) for (const h of this.heard) {
      const d = Math.hypot(h.x - e.transform.x, h.z - e.transform.z);
      if (d <= civ.hearRadiusM && d < best) { threat = h; best = d; }
    }
    if (!threat) return;
    c.threat.x = threat.x; c.threat.z = threat.z;
    if (c.state === 'calm') {
      c.l1!.noticed = this.world.tick; this.dropProp(e);
      this.state(e, 'alarmed', c.l1!.startleTicks);
    }
  }
  private sees(a: Vec2, b: Vec2, ignoreId: number): boolean {
    if (this.blockers && !this.blockers.clear(a, b)) return false;
    return this.world.combat?.query.visible(a, b, ignoreId) ?? true;
  }

  /** Flee to the best refuge: near, and not past the threat. Entering it removes the pedestrian as escaped. */
  private flee(e: EntitySnapshot): void {
    const c = e.civilian!, l1 = c.l1!, tick = this.world.tick;
    if (tick >= l1.repickAt || !l1.target) {
      let best: Refuge | null = null, score = Infinity;
      for (const r of this.refuges) {
        const mine = Math.hypot(r.x - e.transform.x, r.z - e.transform.z), theirs = Math.hypot(r.x - c.threat.x, r.z - c.threat.z);
        const s = mine + (theirs < mine ? 60 + (mine - theirs) * 2 : 0);
        if (s < score) { score = s; best = r; }
      }
      if (best && best.id !== l1.refuge) { l1.refuge = best.id; l1.target = { x: best.x, z: best.z }; c.path.length = 0; c.goal = -1; }
      l1.repickAt = tick + 60;
    }
    if (!l1.target) return;
    if (l1.doorAt !== undefined) {
      // Fumbling with the door: the pedestrian is still outside and can be caught.
      this.face(e, l1.target, .2);
      if (tick - l1.doorAt >= ticks(l1Pedestrians.doorOpenS)) this.escape(e);
      return;
    }
    const before = { x: e.transform.x, z: e.transform.z };
    this.world.npcs!.move(e, l1.target, l1.fleeSpeed, c, .2);
    if (Math.hypot(e.transform.x - before.x, e.transform.z - before.z) < 1e-4) {
      // No route: run straight away from the threat instead of freezing.
      const dx = e.transform.x - c.threat.x, dz = e.transform.z - c.threat.z, d = Math.hypot(dx, dz) || 1;
      this.world.npcs!.moveStep(e, dx / d * l1.fleeSpeed / 60, dz / d * l1.fleeSpeed / 60);
    }
    if (Math.hypot(e.transform.x - l1.target.x, e.transform.z - l1.target.z) <= l1Pedestrians.refugeReachM) {
      if (l1.refuge?.startsWith('edge')) this.escape(e); else l1.doorAt = tick;
    }
  }
  private escape(e: EntitySnapshot): void {
    const refuge = e.civilian!.l1!.refuge ?? 'edge';
    this.stats.escaped++;
    this.world.events.emit({ type: 'outbreak.civilian-escaped', tick: this.world.tick, id: e.id, refuge });
    this.world.spatial.delete(e.id); this.world.entities.delete(e.id);
  }

  /** An infected that reaches a pedestrian grabs it for 1.0 s; any hit on the grabber in that window rescues. */
  private contact(e: EntitySnapshot): void {
    const ai = this.world.infected!, civilians = this.world.npcs!.civilians;
    if (this.world.tick < (e.civilian!.l1!.graceUntil ?? 0)) return;
    for (const a of ai.active) {
      if (a.health.current <= 0 || a.infectionRise || a.infected?.hidden || a.attachedTo !== undefined || civilians.holds(a.id)) continue;
      if (a.combat && a.combat.staggerUntil > this.world.tick) continue;
      if (Math.hypot(a.transform.x - e.transform.x, a.transform.z - e.transform.z) > l1Pedestrians.grabReachM + (a.combat?.radius ?? .35)) continue;
      this.grab(e, a); return;
    }
  }
  /** Public for scripted beats and tests: start the 1.0 s grab of `targetId` by infected `sourceId`. */
  grab(e: EntitySnapshot, attacker: EntitySnapshot): void {
    const c = e.civilian!, tick = this.world.tick;
    delete c.l1!.doorAt; c.attacker = attacker.id; c.threat.x = attacker.transform.x; c.threat.z = attacker.transform.z; this.dropProp(e);
    this.world.npcs!.civilians.hold(attacker.id); this.rescue.delete(attacker.id);
    this.state(e, 'grabbed', ticks(civ.grabS));
    this.face(e, attacker.transform, Math.PI);
    this.world.events.emit({ type: 'civilian.grabbed', tick, sourceId: attacker.id, targetId: e.id, variant: c.variant, rescueUntil: tick + ticks(civ.rescueWindowS) });
    this.hear(e.transform);
  }
  private held(e: EntitySnapshot): void {
    const c = e.civilian!, tick = this.world.tick, attacker = this.world.entities.get(c.attacker);
    if (this.aiBites() && !this.world.npcs!.civilians.holds(c.attacker)) {
      // The bite arrives as `outbreak.bite` (externalBite); a released hold without it is a rescue.
      if (this.world.infected!.holding(e.id) === 0) this.rescued(e);
      return;
    }
    const broken = !attacker?.infected || attacker.health.current <= 0 || this.rescue.has(c.attacker) || (attacker.combat?.staggerUntil ?? 0) > tick
      || Math.hypot(attacker.transform.x - e.transform.x, attacker.transform.z - e.transform.z) > l1Pedestrians.grabBreakM;
    if (broken) { this.rescue.delete(c.attacker); this.rescued(e); }
    else if (tick >= c.until) this.bite(e, attacker!);
  }
  private rescued(e: EntitySnapshot): void {
    const c = e.civilian!, tick = this.world.tick; this.stats.rescued++;
    this.state(e, 'flee'); c.l1!.repickAt = tick; c.l1!.graceUntil = tick + ticks(1);
    this.world.events.emit({ type: 'civilian.saved', tick, id: e.id }); this.world.missions?.civilianSaved(e.id);
  }
  /** At the infected cap a bite kills instead of turning (section 5.9). */
  private canTurn(): boolean {
    const ai = this.world.infected!; let turning = 0;
    for (const e of this.world.entities.iterate()) if (e.infection) turning++;
    return ai.pool.length > turning && ai.director.count + turning < ai.director.cap;
  }
  private bite(e: EntitySnapshot, attacker: EntitySnapshot): void {
    const turns = this.canTurn(); this.state(e, 'bitten');
    this.world.npcs!.civilians.release(attacker.id);
    const event: BiteEvent = { tick: this.world.tick, type: 'outbreak.bite', sourceId: attacker.id, targetId: e.id, position: { x: e.transform.x, z: e.transform.z }, turns };
    this.stats.bites++; this.emitting = true; this.world.events.emit(event); this.emitting = false;
    if (turns) this.infect(e, attacker.id); else this.kill(e);
  }
  /** Lane C may report a completed bite itself; the victim is handled exactly once. */
  private externalBite(event: BiteEvent): void {
    const e = this.world.entities.get(event.targetId), c = e?.civilian;
    if (!e || !c?.l1 || e.infection || !(mobile.has(c.state) || c.state === 'grabbed')) return;
    this.stats.bites++;
    if (c.state === 'grabbed') this.world.npcs!.civilians.release(c.attacker);
    if (event.turns && this.canTurn()) this.infect(e, event.sourceId); else this.kill(e);
  }
  private kill(e: EntitySnapshot): void {
    this.stats.killed++; this.dropProp(e); e.civilian!.eyesGlow = false;
    this.state(e, 'finished'); this.world.events.emit({ type: 'civilian.finished', tick: this.world.tick, id: e.id });
  }

  /** Start the 3.0 +/- 0.5 s transformation of the same entity (stagger, collapse, eyes, rise). */
  infect(e: EntitySnapshot, sourceId: number): void {
    const tick = this.world.tick, total = ticks(civ.transformS + (this.rng.next() * 2 - 1) * civ.transformJitterS);
    this.dropProp(e);
    e.infection = { entityId: e.id, progress: 0, phase: 'stagger', tier: e.appearance?.tier ?? 'average', startedTick: tick, endsTick: tick + total, biteSourceId: sourceId };
    const c = e.civilian!; c.veins = 0; c.eyesGlow = false; c.attacker = sourceId;
    if (c.state !== 'bitten') this.state(e, 'bitten', ticks(phaseS.stagger)); else c.until = tick + ticks(phaseS.stagger);
    this.world.events.emit({ type: 'outbreak.infection', tick, entityId: e.id, phase: 'stagger', progress: 0 });
  }
  private transform(e: EntitySnapshot): void {
    const inf = e.infection!, c = e.civilian!, tick = this.world.tick;
    if (c.state === 'finished') { delete e.infection; this.stats.killed++; return; }
    const total = inf.endsTick - inf.startedTick, elapsed = tick - inf.startedTick;
    inf.progress = Math.min(1, elapsed / total);
    const phase: InfectionPhase = elapsed < ticks(phaseS.stagger) ? 'stagger' : tick < inf.endsTick - ticks(phaseS.rise + phaseS.eyes) ? 'collapse' : tick < inf.endsTick - ticks(phaseS.rise) ? 'eyes' : tick < inf.endsTick ? 'rise' : 'infected';
    const ground = total - ticks(phaseS.stagger) - ticks(phaseS.rise);
    c.veins = skinBlend * Math.max(0, Math.min(1, (elapsed - ticks(phaseS.stagger)) / ground));
    c.eyesGlow = phase === 'eyes' || phase === 'rise';
    if (phase !== inf.phase) {
      inf.phase = phase;
      if (phase === 'collapse') this.state(e, 'down', inf.endsTick - ticks(phaseS.rise) - tick);
      else if (phase === 'eyes') this.world.events.emit({ type: 'civilian.eyes', tick, id: e.id });
      else if (phase === 'rise') this.state(e, 'rising', ticks(phaseS.rise));
      if (phase !== 'infected') this.world.events.emit({ type: 'outbreak.infection', tick, entityId: e.id, phase, progress: inf.progress });
    }
    if (phase === 'stagger') {
      // Bite reaction: a short stumble away from the biter, clutching the wound.
      const source = this.world.entities.get(inf.biteSourceId)?.transform ?? c.threat;
      const dx = e.transform.x - source.x, dz = e.transform.z - source.z, d = Math.hypot(dx, dz) || 1;
      this.world.npcs!.moveStep(e, dx / d * .6 / 60, dz / d * .6 / 60); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
    if (phase === 'infected') this.rise(e);
  }
  /** The same entity becomes an infected: same id, asset, tint, accessories; speed from its tier (section 5.4). */
  private rise(e: EntitySnapshot, bitten = true): void {
    const ai = this.world.infected!, tick = this.world.tick, c = e.civilian!, inf = e.infection!;
    const nav = ai.nav, cell = nav.clear(e.transform.x, e.transform.z, .4) ? -1 : nav.nearestCell(e.transform.x, e.transform.z);
    const at = cell >= 0 ? { x: nav.x(cell), z: nav.z(cell) } : { x: e.transform.x, z: e.transform.z };
    let id: number;
    try { id = ai.spawn('infected.runner', at, { variant: c.variant, yaw: e.transform.yaw, state: 'idle', perched: false, tier: inf.tier }); }
    catch { delete e.infection; this.kill(e); return; }
    const pooled = this.world.entities.get(id)!;
    this.world.entities.delete(id); this.world.spatial.delete(id);
    ai.active[ai.active.indexOf(pooled)] = e;
    e.kind = 'infected'; e.faction = 'infected'; e.archetype = pooled.archetype;
    e.infected = pooled.infected; e.combat = pooled.combat; e.health = pooled.health;
    Object.assign(e.transform, at);
    // Lane C's L1 brain already gave it the tier run speed; without it (tests, old levels) use the tier base +/- jitter.
    if (!e.infected!.l1) e.infected!.speed = l1v2.speedTiers[inf.tier].baseMs * (1 + (this.rng.next() * 2 - 1) * l1v2.speedTiers.jitter);
    delete e.civilian; delete e.infection; delete e.motion;
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    if (!bitten) return;
    this.stats.turned++;
    this.world.events.emit({ type: 'outbreak.infection', tick, entityId: e.id, phase: 'infected', progress: 1 });
    this.world.events.emit({ type: 'civilian.turned', tick, id: e.id, infectedId: e.id, variant: c.variant, position: { x: e.transform.x, z: e.transform.z } });
  }

  /**
   * Turn a pedestrian immediately (no on-screen transformation), keeping id and look. For scripted beats that happen out
   * of sight, e.g. the lab technician inside the facility or the off-screen horde. Not counted as a bite.
   */
  turnNow(e: EntitySnapshot, tier?: SpeedTier): void {
    if (tier && e.appearance) e.appearance.tier = tier;
    e.infection = { entityId: e.id, progress: 1, phase: 'infected', tier: e.appearance?.tier ?? 'average', startedTick: this.world.tick, endsTick: this.world.tick, biteSourceId: 0 };
    e.hidden = false; this.rise(e, false);
  }
  /** Live pedestrians (not escaped, not turning, not dead). */
  liveCivilians(): number {
    let count = 0; for (const e of this.world.entities.iterate()) if (e.civilian?.l1 && !e.hidden && !e.infection && mobile.has(e.civilian.state)) count++; return count;
  }
  /** Section 5.9: walkers enter from off-screen edges while fewer than 25 remain, until 3:30 into the outbreak. */
  private topUp(): void {
    const tick = this.world.tick, d = l1v2.director;
    if (this.started < 0 || tick < this.topUpAt || tick - this.started > ticks(d.topUpUntilS) || !this.entries.length) return;
    this.topUpAt = tick + ticks(l1Pedestrians.topUpEveryS);
    if (this.liveCivilians() >= d.topUpBelowCivilians) return;
    const director = this.world.infected!.director;
    const start = Math.floor(this.rng.next() * this.entries.length);
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[(start + i) % this.entries.length];
      if (!director.safe('infected.runner', entry)) continue;
      const goal = this.walkGoal(entry);
      this.spawnPedestrian({ x: entry.x, z: entry.z }, { waypoints: [goal, { x: entry.x, z: entry.z }] });
      this.stats.toppedUp++; return;
    }
  }
  private walkGoal(from: Vec2): Point {
    const nav = this.world.infected!.nav;
    for (let i = 0; i < 8; i++) {
      const angle = this.rng.next() * Math.PI * 2, r = 15 + this.rng.next() * 25;
      const cell = nav.nearestCell(from.x + Math.cos(angle) * r, from.z + Math.sin(angle) * r);
      if (cell >= 0 && nav.clear(nav.x(cell), nav.z(cell), .35)) return { x: nav.x(cell), z: nav.z(cell) };
    }
    return { x: from.x, z: from.z };
  }
  /**
   * Section 5.9 horde guarantee before beat 9 (called by the mission): if fewer than 6 infected are within 35 m of
   * `exit`, spawn the shortfall at the off-screen `entry` as infected pedestrians (civilian models with the overlay)
   * chasing fleeing pedestrians. Returns the number spawned.
   */
  ensureHorde(exit: Vec2, entry: Vec2): number {
    const ai = this.world.infected!, d = l1v2.director;
    let near = 0; for (const a of ai.active) if (a.health.current > 0 && Math.hypot(a.transform.x - exit.x, a.transform.z - exit.z) <= d.hordeRadiusM) near++;
    const at = this.snap(entry), missing = Math.max(0, d.hordeMinInfectedNearGarage - near);
    // M1-10: never spawn in view; the mission simply asks again on a later tick.
    if (missing && !ai.director.offscreen(at)) return 0;
    let spawned = 0;
    for (let i = 0; i < missing && ai.director.count < ai.director.cap && ai.pool.length; i++) {
      const p = this.snap({ x: at.x + (i % 3) * 1.2 - 1.2, z: at.z + Math.floor(i / 3) * 1.2 });
      this.turnNow(this.world.entities.get(this.spawnPedestrian(p))!); spawned++;
    }
    for (let i = 0; i < Math.min(2, spawned); i++) {
      const p = this.snap({ x: at.x + (exit.x - at.x) * .25 + i, z: at.z + (exit.z - at.z) * .25 });
      const id = this.spawnPedestrian(p), c = this.world.entities.get(id)!.civilian!;
      c.threat.x = at.x; c.threat.z = at.z; c.l1!.noticed = this.world.tick; this.state(this.world.entities.get(id)!, 'flee');
    }
    this.stats.hordeSpawned += spawned; return spawned;
  }
  /** Checkpoint restore (after `Npcs.restore` shifted entity timers by `delta`): layer-level clocks only. */
  restore(delta: number): void {
    this.started = this.started < 0 ? -1 : this.started + delta; this.topUpAt += delta; this.heard.length = 0; this.rescue.clear(); this.humans.invalidate();
  }
  /** Plain state for a checkpoint snapshot (entities carry everything else). */
  snapshot() { return { started: this.started, topUpAt: this.topUpAt, stats: { ...this.stats } }; }
  load(state: ReturnType<Outbreak['snapshot']>): void { this.started = state.started; this.topUpAt = state.topUpAt; Object.assign(this.stats, state.stats); this.heard.length = 0; this.rescue.clear(); this.humans.invalidate(); }
}
