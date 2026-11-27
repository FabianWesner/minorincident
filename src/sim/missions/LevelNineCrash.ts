import * as RAPIER from '@dimforge/rapier3d-compat';
import { stopEngine } from '../vehicles/ConvoySound';
import { survivor } from '../../data/survivor';
import type { Transform } from '../world/types';
import type { Mission } from './Mission';
import { emptyEncounters, updateEncounters, type L9EncounterState } from './LevelNineEncounters';
import { LevelNineDriving, type L9DrivingState } from './LevelNineDriving';
import { l9Course } from '../../data/l9';
import { dialogue } from '../../data/dialogue';

export interface L9CrashState {
  phase: 'driving' | 'approach' | 'fall' | 'impact' | 'dazed' | 'rise' | 'mega-exit' | 'mega-roar' | 'mega-leap' | 'done';
  carId: number; startedAt: number; preCrashDurability: number; approachTicks?: number; impactSpeed?: number; direction?: number; fallFrom?: Transform;
  heading?: { x: number; z: number }; megaLandedAt?: number; dazedAt?: number;
  samFlightFrom?: Transform; weaponFireIds?: number[];
  from: Transform; safeAnchor: string; finished: boolean; ended: boolean;
  /** L9-E1 route groups (spawned once, stable ids). Optional so pre-E1 saves still load. */
  encounters?: L9EncounterState;
  driving?: L9DrivingState;
}
const FALL = 90, IMPACT = 120, DAZED = 120, RISE = 60, MEGA_EXIT = 150, MEGA_ROAR = 150, MEGA_LEAP = 120;
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/** E31 L9-S6: fixed-tick, one-shot crash. Campaign equipment reset belongs to S7. */
export class LevelNineCrash {
  state: L9CrashState = { phase: 'driving', carId: 0, startedAt: 0, preCrashDurability: 0,
    from: { x: 0, y: 0, z: 0, yaw: 0 }, safeAnchor: 'crawl-start', finished: false, ended: false, encounters: emptyEncounters() };
  readonly driving: LevelNineDriving;
  constructor(private readonly mission: Mission) { this.driving = new LevelNineDriving(mission); }
  private get w() { return this.mission.world; }
  private anchor(name: string): Transform {
    const a = this.mission.def.anchors[name];
    return { x: a.x, y: a.y ?? 0, z: a.z, yaw: 0 };
  }
  prepare(): void {
    if (this.state.carId) return;
    const w = this.w, at = this.anchor('crossing-start'), payload = w.progression?.campaign?.transport;
    const active = w.vehicles!.active;
    if (active !== null && w.entities.get(active)?.archetype === 'vehicle.military-apc') this.state.carId = active;
    else if (payload) this.state.carId = w.vehicles!.restoreTransfer(payload, at);
    else {
      const id = w.vehicles!.spawn('vehicle.military-apc', at);
      const car = w.entities.get(id)!;
      car.vehicle!.driver = 1; w.vehicles!.rebuild(); this.state.carId = id;
    }
    // Restore occupants before spawning: their IDs belong to the incoming transport.
    const corgi = w.npcs!.companion.spawn();
    if (!payload?.occupants.some(e => e.companion)) {
      const car = w.vehicles!.cars.get(this.state.carId)!;
      const dog = w.entities.get(corgi)!;
      // The standalone L9 start boards the companion through the authored passenger entry. The driver door can
      // differ on transports (APC doorX vs passenger entry), leaving the dog outside when boarding is attempted.
      Object.assign(dog.transform, w.vehicles!.passengerDoor(this.state.carId));
      w.spatial.set(corgi, dog.transform.x, dog.transform.z);
      if (w.vehicles!.boardPassenger(this.state.carId, corgi)) {
        // L9 starts with the courier driving: the companion has already boarded too.
        car.entity.vehicle!.passengers!.find(p => p.id === corgi)!.phase = 'seated';
        dog.hidden = true; w.spatial.delete(corgi);
      }
    }
    w.vehicles!.setFloorPolicy(this.state.carId);
    for (const actor of payload?.occupants ?? []) {
      const live = w.entities.get(actor.id);
      if (live && (live.civilian || live.companion) && live.health.current > 0 && !live.infection && !live.infected) live.health.current = live.health.max;
    }
    const saved = w.progression?.campaign?.l9Crash;
    if (saved) {
      if (this.state.carId !== saved.state.carId) w.entities.delete(this.state.carId);
      Object.assign(w.entities.get(1)!, structuredClone(saved.player));
      w.entities.replace(structuredClone(saved.vehicle));
      for (const actor of saved.actors ?? []) w.entities.replace(structuredClone(actor));
      this.restore(saved);
      if (saved.chunks) w.chunks?.load(saved.chunks);
      // r30-l9bridge: a resumed world starts at tick 0 but the saved entities carry absolute ticks (the APC's impact stall alone
      // froze it for 2.5 min after Continue). Rebase them as Mission.restore does for a retry.
      const delta = w.tick - saved.tick;
      for (const e of w.entities.iterate()) {
        if (e.vehicle) { if (e.vehicle.explodeAt !== null) e.vehicle.explodeAt += delta; if (e.vehicle.recoveringUntil) e.vehicle.recoveringUntil += delta; }
        if (e.light && e.light.startedAt >= 0) e.light.startedAt += delta;
        if (e.infected) { w.infected?.restoreSpecialTimers(e.infected, delta); if (e.infected.until) e.infected.until += delta; if (e.infected.cooldown) e.infected.cooldown += delta; if (e.infected.recoverAt >= 0) { e.infected.recoverAt += delta; e.infected.deadAt += delta; } }
      }
      w.vehicles!.rebuild(false, delta); this.rebuild(); this.driving.safeBridgeStart(false);
      w.npcs!.restore(w.tick - saved.tick);
      const p = w.entities.get(1)!;
      w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform);
      w.previousPlayer = { ...p.transform }; w.spatial.set(1, p.transform.x, p.transform.z);
      this.mission.setState('crash-started', this.state.phase !== 'driving');
      this.mission.setState('crash-impacted', !['driving', 'approach', 'fall'].includes(this.state.phase));
      this.mission.setState('crash-finished', this.state.finished);
      if (this.state.ended) { this.mission.state.phase = 'progression'; this.mission.state.result = w.progression?.campaign?.results?.L9 ?? null; }
    }
    this.driving.prepare();
    if (this.state.phase !== 'driving') this.hidePursuitBus();
  }
  /** The chase ends at the collapsed span; it must not follow the courier
   * onto the far bank or be mistaken for the APC wreck. */
  private hidePursuitBus(): void {
    const id = this.driving.state.busId, bus = this.w.vehicles!.cars.get(id);
    if (!bus) return;
    bus.entity.hidden = true; bus.physics.body.setEnabled(false);
    this.w.vehicles!.autopilot.delete(id); stopEngine(this.w, id);
  }
  begin(): void {
    this.mission.checkpoint('crossing-start');
    const text = this.mission.def.briefing;
    this.mission.state.subtitle = { id: 'L9.briefing', text, until: this.w.tick + 360 };
    this.w.events.emit({ type: 'dialogue.line', tick: this.w.tick, id: 'L9.briefing', text });
  }
  private lock(): void {
    this.w.storyLock = { scripted: null, skip: false }; this.w.clearInput();
    const p = this.w.entities.get(1)!;
    p.health.current = Math.max(1, p.health.current);
    p.survivor!.invulnerableUntil = this.w.tick + 120;
  }
  update(): void {
    const s = this.state, w = this.w, car = w.entities.get(s.carId);
    if (!car || s.finished || w.entities.get(1)!.health.current <= 0) return;
    this.driving.updateDialogue();
    this.driving.updateConvoy();
    if (s.phase === 'driving') {
      this.driving.update();
      updateEncounters(w, s.encounters ??= emptyEncounters());
      // The actual bridge deck owns the finale. Reaching this x elsewhere in
      // the district cannot take the controls or move the vehicle sideways.
      // The bridge crash only triggers when the APC is actually driving onto
      // the deck, not when a player crosses the same strip while backing out.
      if (!this.driving.state.evacuationDone || Math.cos(car.transform.yaw) <= 0 || car.transform.x < l9Course.bridge.x || car.transform.x > l9Course.bridge.endX || Math.abs(car.transform.z) > l9Course.bridge.halfZ) return;
      // r39-markers (r38-vqa P2-1): the deck itself starts the collapse, at any speed and heading. An APC held by boarders or stationary
      // used to sit on the deck with the objective unmet; the scripted run-up below then goes east at a floor speed.
      this.mission.checkpoint('outskirts-approach');
      this.mission.setState('crash-started', true);
      this.hidePursuitBus();
      s.phase = 'approach'; s.startedAt = w.tick; s.from = { ...car.transform }; s.preCrashDurability = car.health.current;
      const lip = this.anchor('crash-impact'), velocity = w.vehicles!.cars.get(s.carId)!.physics.body.linvel();
      const driven = Math.hypot(velocity.x, velocity.z), eastward = velocity.x >= 1;
      s.impactSpeed = Math.max(eastward ? 1 : 8, driven);
      s.heading = eastward ? { x: velocity.x / driven, z: velocity.z / driven } : { x: 1, z: 0 };
      if (!eastward) s.from.yaw = 0;
      const along = Math.max(3, (lip.x - s.from.x) * s.heading.x + (lip.z - s.from.z) * s.heading.z);
      // The initial velocity is continuous. Once the creature lands and the
      // span tilts, gravity adds 3.5 m/s² down the broken deck.
      const afterLanding = Math.max(0, along - s.impactSpeed);
      s.approachTicks = Math.max(90, Math.ceil((1 + (-s.impactSpeed + Math.sqrt(s.impactSpeed ** 2 + 7 * afterLanding)) / 3.5) * 60));
      // The bridge ending owns the screen: a pending school-bus ram warning must not linger over the crash.
      this.driving.state.busRamAt = 0;
      w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.crash-approach', actorId: s.carId });
    }
    if (s.phase !== 'approach') this.collapseCull();
    if (s.phase === 'rise' || s.phase === 'mega-exit' || s.phase === 'mega-roar' || s.phase === 'mega-leap') this.lock();
    else if (s.phase === 'dazed' || s.phase === 'impact') {
      w.storyLock = { scripted: null, skip: false }; w.clearInput();
      const p = w.entities.get(1)!; p.health.current = Math.max(1, p.health.current);
      p.survivor!.invulnerableUntil = w.tick + 120;
    }
    const def = w.vehicles!.cars.get(s.carId)!.physics.def, height = def.suspension + def.wheelRadius + .15;
    const approachTicks = s.approachTicks ?? 180, t = w.tick - s.startedAt, lip = this.anchor('crash-impact'), wreck = this.anchor('crash-wreck');
    const heading = s.heading ?? { x: Math.cos(s.from.yaw), z: -Math.sin(s.from.yaw) };
    const travel = (ticks: number) => {
      const seconds = ticks / 60;
      return Math.min((s.impactSpeed ?? 14) * seconds + 1.75 * Math.max(0, seconds - 1) ** 2, Math.max(3, Math.hypot(lip.x - s.from.x, lip.z - s.from.z)));
    };
    const approachPose = (): Transform => {
      const distance = travel(Math.min(t, approachTicks));
      return { x: s.from.x + heading.x * distance, y: s.from.y, z: s.from.z + heading.z * distance, yaw: s.from.yaw };
    };
    const rotation = (roll: number) => ({ x: Math.cos(s.from.yaw / 2) * Math.sin(roll / 2), y: Math.sin(s.from.yaw / 2) * Math.cos(roll / 2), z: -Math.sin(s.from.yaw / 2) * Math.sin(roll / 2), w: Math.cos(s.from.yaw / 2) * Math.cos(roll / 2) });
    const mega = w.entities.get(this.driving.state.megaId);
    if (mega && s.phase === 'approach' && t >= 60 && s.megaLandedAt === undefined) {
      s.megaLandedAt = w.tick;
      w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.mega-boarded', actorId: mega.id });
    }
    if (mega && (s.phase === 'approach' || s.phase === 'fall') && s.megaLandedAt !== undefined) {
      // The Mega lands on the APC mid-span and rides the visible vehicle through
      // the section collapse. The ending after impact still has it climb out.
      const c = Math.cos(car.transform.yaw), sn = Math.sin(car.transform.yaw);
      mega.hidden = false; mega.infected!.hidden = false;
      Object.assign(mega.transform, { x: car.transform.x + c * 1.4, y: car.transform.y + 2.7, z: car.transform.z - sn * 1.4, yaw: car.transform.yaw });
      w.spatial.set(mega.id, mega.transform.x, mega.transform.z);
    } else if (mega && !['dazed', 'rise', 'mega-exit', 'mega-roar', 'mega-leap'].includes(s.phase)) {
      mega.hidden = true; mega.infected!.hidden = true;
    }
    if (s.phase !== 'approach' && s.phase !== 'fall' && s.phase !== 'impact') {
      this.updateEnding(mega);
      return;
    }
    if (t < approachTicks) {
      w.vehicles!.scriptPose(s.carId, approachPose());
    } else if (t < approachTicks + FALL) {
      if (s.phase === 'approach') {
        s.phase = 'fall'; s.fallFrom = approachPose();
        // Equipment ownership changes at its visible loss, before the prone courier can be drawn with weapons.
        w.combat!.setLoadout(['weapon.fire-axe'], ['weapon.fire-axe']);
        s.weaponFireIds = [0, 2].map(offset => {
          const id = w.hazards!.spawn('fire', { x: 516 + offset, z: 4 }, { radius: 2, duration: 60 });
          w.entities.get(id)!.transform.y = -4.8; return id;
        });
        const sam = w.entities.get(this.driving.state.samId);
        if (sam && sam.health.current > 0) {
          s.samFlightFrom = { ...car.transform, y: car.transform.y + .8 };
          car.vehicle!.passengers = car.vehicle!.passengers?.filter(p => p.id !== sam.id);
          sam.hidden = false; sam.emerging = true;
          if (sam.civilian?.survivor) sam.civilian.survivor.mode = 'hidden';
        }
        w.events.emit({ type: 'explosion.slowmo', tick: w.tick, defId: 'l9.bridge-collapse', scale: .4, seconds: 1.5 });
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.bridge-collapse' });
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.weapons-lost', actorId: s.carId });
      }
      const f = (t - approachTicks) / FALL, start = s.fallFrom ?? approachPose();
      // The collapsing span launches the APC across the gap. It lands on the
      // authored far shoulder, where the courier can see her own wreck.
      const x = lerp(start.x, wreck.x, f), y = lerp(start.y, height + wreck.y, f) + Math.sin(Math.PI * f) * 1.2;
      const sam = w.entities.get(this.driving.state.samId);
      if (sam && s.samFlightFrom) {
        Object.assign(sam.transform, { x: lerp(s.samFlightFrom.x, 528, f), z: lerp(s.samFlightFrom.z, -6, f), y: lerp(s.samFlightFrom.y, .7, f) + Math.sin(Math.PI * f) * 3, yaw: start.yaw });
        w.spatial.set(sam.id, sam.transform.x, sam.transform.z);
      }
      w.vehicles!.scriptPose(s.carId, { x, y, z: lerp(start.z, wreck.z, f), yaw: start.yaw }, 0, rotation(0));
    } else {
      const landed = { ...car.transform, y: height + wreck.y };
      w.vehicles!.scriptPose(s.carId, landed, 0, rotation(0));
      if (s.phase === 'fall' || s.phase === 'approach') {
        s.safeAnchor = this.findSafeAnchor(); s.phase = 'impact';
        this.mission.setState('crash-impacted', true);
        const safe = this.anchor(s.safeAnchor); safe.y += survivor.height / 2 + .02;
        w.vehicles!.destroyScripted(s.carId, safe, true); stopEngine(w, s.carId);
        for (const passenger of car.vehicle!.passengers ?? []) {
          const e = w.entities.get(passenger.id); if (!e) continue;
          e.hidden = false; delete e.passengerOf;
          Object.assign(e.transform, { x: safe.x + .8, y: e.companion ? .3 : .7, z: safe.z - (e.companion ? .5 : 6), yaw: 0 });
          if (e.civilian) { e.civilian.pauseUntil = Number.MAX_SAFE_INTEGER; if (e.civilian.survivor) e.civilian.survivor.mode = 'hidden'; }
          w.spatial.set(e.id, e.transform.x, e.transform.z);
        }
        car.vehicle!.passengers = [];
        const sam = w.entities.get(this.driving.state.samId);
        if (sam) { if (s.samFlightFrom) Object.assign(sam.transform, { x: 528, y: .7, z: -6 }); delete sam.passengerOf; delete sam.emerging; if (sam.civilian) sam.civilian.pauseUntil = Number.MAX_SAFE_INTEGER; }
        w.events.emit({ type: 'vehicle.sound', tick: w.tick, sourceId: s.carId, phase: 'crash', position: wreck, velocity: { x: 0, z: 0 }, rpm: 0, speed: 0, health: 0, impulse: 30 });
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.crash-impact', actorId: s.carId });
      }
      if (t >= approachTicks + FALL + IMPACT && s.phase === 'impact') {
        s.phase = 'dazed'; s.startedAt = w.tick; s.dazedAt = w.tick;
        const p = w.entities.get(1)!; p.transform.y = survivor.height / 2 + .02;
        w.player?.resetPose(w.tick); p.survivor!.animation = 'knockdown';
        if (mega) {
          Object.assign(mega.transform, { x: car.transform.x, y: car.transform.y + 1, z: car.transform.z, yaw: car.transform.yaw });
        }
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.dazed' });
      }
    }
    this.updateEnding(mega);
  }
  private updateEnding(mega: ReturnType<typeof this.w.entities.get>): void {
    const s = this.state, w = this.w, p = w.entities.get(1)!;
    if (mega?.infected && ['dazed', 'rise', 'mega-exit', 'mega-roar', 'mega-leap'].includes(s.phase)) {
      const brain = mega.infected, wreck = w.entities.get(s.carId)!.transform;
      brain.state = 'idle'; brain.scripted = { x: wreck.x + 10000, z: wreck.z };
      delete brain.provoked; delete brain.pressureTarget;
      if (s.phase !== 'mega-roar') brain.specialAttack = undefined;
      if (mega.combat) mega.combat.attacking = false;
    }
    if (s.phase === 'dazed' && w.tick - (s.dazedAt ?? w.tick) >= DAZED) {
      s.phase = 'rise'; s.startedAt = w.tick; w.player?.resetPose(w.tick); p.survivor!.scriptedClip = 'get-up-prone';
      w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.rise' });
    } else if (s.phase === 'rise' && w.tick - s.startedAt >= RISE) {
      delete p.survivor!.scriptedClip; s.phase = 'mega-exit'; s.startedAt = w.tick;
      if (mega) {
        const wreck = w.entities.get(s.carId)!.transform;
        mega.hidden = false; mega.infected!.hidden = false; delete mega.attachedTo; delete mega.contactExempt;
        mega.infected!.state = 'idle'; mega.infected!.specialAttack = undefined;
        mega.infected!.scripted = { x: wreck.x + 10000, z: wreck.z };
        if (mega.combat) mega.combat.attacking = false;
        mega.transform = { ...wreck, y: wreck.y + 1.5 };
        w.spatial.set(mega.id, mega.transform.x, mega.transform.z);
      }
      w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.mega-exits-wreck', actorId: mega?.id });
    } else if (s.phase === 'mega-exit' && w.tick - s.startedAt >= MEGA_EXIT) {
      s.phase = 'mega-roar'; s.startedAt = w.tick;
      if (mega?.infected) mega.infected.specialAttack = { move: 'alpha.roar', attackId: mega.id * 1000 + w.tick, stage: 'active', startTick: w.tick, activeTick: w.tick, cooldownExpiry: w.tick + MEGA_ROAR, recoveryUntil: w.tick + MEGA_ROAR, target: { id: 1, x: p.transform.x, z: p.transform.z }, area: { x: mega.transform.x, z: mega.transform.z, radius: 0, dx: 1, dz: 0 }, hitIds: [] };
      if (mega) w.events.emit({ type: 'mega.cue', tick: w.tick, sourceId: mega.id, kind: 'roar', band: 'near' });
      this.sayEnding('L9.mega-survived', MEGA_ROAR);
    } else if (s.phase === 'mega-exit') {
      const f = Math.min(1, (w.tick - s.startedAt) / MEGA_EXIT), wreck = w.entities.get(s.carId)!.transform;
      if (mega) {
        mega.transform.x = wreck.x + f * 2; mega.transform.z = wreck.z - f * 2;
        mega.transform.y = wreck.y + 1.5 * (1 - f) + .7 * f;
        mega.transform.yaw = -Math.atan2(p.transform.z - mega.transform.z, p.transform.x - mega.transform.x);
        w.spatial.set(mega.id, mega.transform.x, mega.transform.z);
      }
    } else if (s.phase === 'mega-roar' && w.tick - s.startedAt >= MEGA_ROAR) {
      s.phase = 'mega-leap'; s.startedAt = w.tick; this.sayEnding('L9.end-caption', MEGA_LEAP);
    } else if (s.phase === 'mega-leap') {
      const f = Math.min(1, (w.tick - s.startedAt) / MEGA_LEAP);
      if (mega) {
        const start = w.entities.get(s.carId)!.transform;
        mega.transform.x = start.x + 2 + f * 50; mega.transform.z = start.z - 2 - f * 6;
        mega.transform.y = .7 + Math.sin(Math.PI * f) * 12; mega.transform.yaw = 0;
        w.spatial.set(mega.id, mega.transform.x, mega.transform.z);
        if (f >= 1) { mega.hidden = true; mega.infected!.hidden = true; }
      }
      if (f >= 1) {
        s.phase = 'done'; s.finished = true; w.storyLock = null; w.clearInput();
        this.mission.setState('crash-finished', true);
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.ending-finished' });
      }
    }
  }
  private sayEnding(id: string, duration: number): void {
    const text = dialogue[id]; this.mission.state.subtitle = { id, text, until: this.w.tick + duration };
    this.w.events.emit({ type: 'dialogue.line', tick: this.w.tick, id, text });
  }
  /**
   * The chasing pack must not follow the crash sequence onto the far shoulder; the courier remains protected while the ending plays.
   * Root cause is the pack arriving at all: the span collapses under the APC, so from the fall on every live infected on the deck or the far
   * bank (x past the bridge head) goes down with it into the pit (corpses stay, in the pit). The Mega Alpha's pursuit seam is never touched.
   */
  private collapseCull(): void {
    const w = this.w, ai = w.infected; if (!ai) return;
    const head = l9Course.bridge.x + 2;
    for (const e of ai.active) {
      if (!e.infected || e.infected.pursuit || e.hidden || e.id === this.driving.state.megaId || e.transform.x <= head) continue;
      if (e.health.current > 0) {
        w.combat?.damage.apply({ attackId: w.tick, actionId: 'l9.bridge-collapse', sourceId: this.state.carId, targetId: e.id, origin: e.transform, direction: { x: 1, z: 0 }, base: e.health.max * 10 + 1000, multiplier: 1, type: 'vehicle', knockback: 0, stagger: 0 });
        if (e.health.current > 0) e.health.current = 0;
      }
      if (e.transform.y > -4.5) { e.transform.y = -4.8; if (e.attachedTo !== undefined) delete e.attachedTo; w.spatial.set(e.id, e.transform.x, e.transform.z); }
    }
  }
  /** Check each authored safe position against navigation and actual colliders. */
  private findSafeAnchor(): string {
    const w = this.w, shape = new RAPIER.Capsule(survivor.height / 2 - survivor.radius, survivor.radius);
    for (const name of ['crawl-start', 'crawl-fallback']) {
      const start = this.anchor(name);
      const blocked = !w.districts!.nav.walkable([start.x, start.z]) || w.physics.world!.intersectionWithShape({ x: start.x, y: survivor.height / 2 + .02, z: start.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, w.physics.playerCollider!);
      if (!blocked) return name;
    }
    throw new Error('L9 crash: both authored safe positions are blocked');
  }
  cameraPose(): { position: [number, number, number]; target: [number, number, number] } | null {
    const s = this.state;
    if (s.phase === 'driving' || s.phase === 'done') return null;
    if (s.phase === 'dazed' || s.phase === 'rise' || s.phase === 'mega-exit' || s.phase === 'mega-roar' || s.phase === 'mega-leap') {
      // Keep the courier, burning wreck and Mega in frame through the ending.
      const p = this.w.entities.get(1)!.transform, car = this.w.entities.get(s.carId)!.transform;
      const x = (p.x + car.x) / 2, z = (p.z + car.z) / 2;
      return { position: [x + 20, 15, z - 22], target: [x, .5, z] };
    }
    if (s.phase === 'impact') {
      // The landing follows the incoming velocity, so frame the actual wreck
      // and safe ending position from the far bank instead of a fixed girder.
      const car = this.w.entities.get(s.carId)!.transform, p = this.w.entities.get(1)!.transform;
      const x = (car.x + p.x) / 2, z = (car.z + p.z) / 2;
      return { position: [x + 28, 22, z - 32], target: [x, 0, z] };
    }
    const p = this.w.entities.get(s.carId)!.transform;
    return { position: [p.x + 20, 22, p.z + 20], target: [p.x, p.y, p.z] };
  }
  end(): void { if (this.state.finished) this.state.ended = true; }
  save() {
    const actors = [...this.w.entities.iterate()].filter(e => e.id !== 1 && e.id !== this.state.carId && (e.civilian || e.companion || e.infected || e.vehicle || e.hazard || e.kind === 'setpiece' || e.kind === 'obstacle')).map(e => structuredClone(e));
    return { ...this.snapshot(), ...(this.w.chunks ? { chunks: this.w.chunks.save() } : {}), actors, player: this.w.getEntity(1)!, vehicle: this.w.getEntity(this.state.carId)! };
  }
  snapshot() { return { state: structuredClone(this.state), tick: this.w.tick }; }
  restore(saved: unknown): void {
    const data = saved as ReturnType<LevelNineCrash['snapshot']>;
    this.state = structuredClone(data.state); this.state.startedAt += this.w.tick - data.tick;
    if (this.state.megaLandedAt !== undefined) this.state.megaLandedAt += this.w.tick - data.tick;
    if (this.state.dazedAt !== undefined) this.state.dazedAt += this.w.tick - data.tick;
    if (this.state.encounters?.patrol) this.state.encounters.patrol.nextAt += this.w.tick - data.tick;
    if (this.state.driving) this.driving.restore(this.w.tick - data.tick);
  }
  /** Called after vehicle bodies rebuild; no impact/audio/event is replayed. */
  rebuild(): void {
    const s = this.state, car = this.w.entities.get(s.carId)!;
    if (s.driving) this.driving.rebuild();
    if (s.phase === 'driving') { this.w.storyLock = null; this.w.vehicles!.setFloorPolicy(s.carId); this.driving.poseHatch(); return; }
    const yaw = car.transform.yaw;
    this.w.vehicles!.scriptPose(s.carId, car.transform, 0, { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
    if (s.phase === 'done') this.w.storyLock = null; else this.lock();
  }
}
