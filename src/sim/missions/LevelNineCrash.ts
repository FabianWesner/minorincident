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
  phase: 'driving' | 'approach' | 'fall' | 'impact' | 'crawl' | 'done';
  carId: number; startedAt: number; preCrashDurability: number; approachTicks?: number; impactSpeed?: number; direction?: number; fallFrom?: Transform;
  heading?: { x: number; z: number }; megaLandedAt?: number; crawlProgress?: number;
  samFlightFrom?: Transform; endingAt?: number; weaponFireIds?: number[];
  from: Transform; crawlAnchor: string; finished: boolean; ended: boolean;
  /** L9-E1 route groups (spawned once, stable ids). Optional so pre-E1 saves still load. */
  encounters?: L9EncounterState;
  driving?: L9DrivingState;
}
const FALL = 90, IMPACT = 120, CRAWL = 360;
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/** E31 L9-S6: fixed-tick, one-shot crash. Campaign equipment reset belongs to S7. */
export class LevelNineCrash {
  state: L9CrashState = { phase: 'driving', carId: 0, startedAt: 0, preCrashDurability: 0,
    from: { x: 0, y: 0, z: 0, yaw: 0 }, crawlAnchor: 'crawl-start', finished: false, ended: false, encounters: emptyEncounters() };
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
      w.vehicles!.rebuild(); this.rebuild();
      w.npcs!.restore(w.tick - saved.tick);
      const p = w.entities.get(1)!;
      w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform);
      w.previousPlayer = { ...p.transform }; w.spatial.set(1, p.transform.x, p.transform.z);
      this.mission.setState('crash-started', this.state.phase !== 'driving');
      this.mission.setState('crash-impacted', ['impact', 'crawl', 'done'].includes(this.state.phase));
      this.mission.setState('crash-finished', this.state.finished);
      if (this.state.ended) { this.mission.state.phase = 'progression'; this.mission.state.result = w.progression?.campaign?.results?.L9 ?? null; }
    }
    this.driving.prepare();
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
      if (!this.driving.state.evacuationDone || car.transform.x < l9Course.bridge.x || car.transform.x > l9Course.bridge.endX || Math.abs(car.transform.z) > l9Course.bridge.halfZ || w.vehicles!.cars.get(s.carId)!.physics.body.linvel().x < 1) return;
      this.mission.checkpoint('outskirts-approach');
      this.mission.setState('crash-started', true);
      s.phase = 'approach'; s.startedAt = w.tick; s.from = { ...car.transform }; s.preCrashDurability = car.health.current;
      const lip = this.anchor('crash-impact'), velocity = w.vehicles!.cars.get(s.carId)!.physics.body.linvel();
      s.impactSpeed = Math.max(1, Math.hypot(velocity.x, velocity.z));
      s.heading = { x: velocity.x / s.impactSpeed, z: velocity.z / s.impactSpeed };
      const along = Math.max(3, (lip.x - s.from.x) * s.heading.x + (lip.z - s.from.z) * s.heading.z);
      // The initial velocity is continuous. Once the creature lands and the
      // span tilts, gravity adds 3.5 m/s² down the broken deck.
      const afterLanding = Math.max(0, along - s.impactSpeed);
      s.approachTicks = Math.max(90, Math.ceil((1 + (-s.impactSpeed + Math.sqrt(s.impactSpeed ** 2 + 7 * afterLanding)) / 3.5) * 60));
      w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.crash-approach', actorId: s.carId });
    }
    if (s.phase !== 'crawl') this.lock();
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
    if (mega) {
      mega.hidden = false; mega.infected!.hidden = false;
      const leap = Math.min(1, t / 60), at = car.transform;
      Object.assign(mega.transform, { x: at.x - 6 * (1 - leap), z: at.z, y: at.y + 1.3 + Math.sin(Math.PI * leap) * 6, yaw: at.yaw });
      w.spatial.set(mega.id, mega.transform.x, mega.transform.z);
      if (t >= 60 && s.megaLandedAt === undefined) { s.megaLandedAt = w.tick; w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.mega-boarded', actorId: mega.id }); }
    }
    if (t < approachTicks) {
      w.vehicles!.scriptPose(s.carId, approachPose());
    } else if (t < approachTicks + FALL) {
      if (s.phase === 'approach') {
        s.phase = 'fall'; s.fallFrom = approachPose();
        // Equipment ownership changes at its visible loss, before any crawl
        // frame can draw the launcher across the courier's body.
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
      const f = (t - approachTicks) / FALL, start = s.fallFrom ?? approachPose(), seconds = (t - approachTicks) / 60;
      const speed = (s.impactSpeed ?? 14) + Math.max(0, approachTicks / 60 - 1) * 3.5;
      const y = Math.max(height + wreck.y, start.y - 4.905 * seconds * seconds), x = start.x + heading.x * speed * seconds;
      const sam = w.entities.get(this.driving.state.samId);
      if (sam && s.samFlightFrom) {
        Object.assign(sam.transform, { x: lerp(s.samFlightFrom.x, 528, f), z: lerp(s.samFlightFrom.z, -6, f), y: lerp(s.samFlightFrom.y, .7, f) + Math.sin(Math.PI * f) * 3, yaw: start.yaw });
        w.spatial.set(sam.id, sam.transform.x, sam.transform.z);
      }
      // Hitting the far bank removes forward momentum instead of pulling the
      // hull back toward a predetermined wreck pose.
      w.vehicles!.scriptPose(s.carId, { x: y < height - .8 ? Math.min(523.5, x) : x, y, z: start.z + heading.z * speed * seconds, yaw: start.yaw }, 0, rotation(Math.min(Math.PI / 2, f * Math.PI / 2)));
    } else {
      const landed = { ...car.transform, y: height + wreck.y };
      w.vehicles!.scriptPose(s.carId, landed, 0, rotation(Math.PI / 2));
      if (s.phase === 'fall' || s.phase === 'approach') {
        s.crawlAnchor = this.safeAnchor(); s.phase = 'impact';
        this.mission.setState('crash-impacted', true);
        const safe = this.anchor(s.crawlAnchor); safe.y += survivor.height / 2 + .02;
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
      if (t >= approachTicks + FALL + IMPACT) {
        if (s.phase !== 'crawl') { s.phase = 'crawl'; s.crawlProgress = 0; w.storyLock = null; w.clearInput(); }
        const start = this.anchor(s.crawlAnchor), end = this.anchor('crawl-end'), p = w.entities.get(1)!;
        const dx = end.x - start.x, dz = end.z - start.z, length = Math.hypot(dx, dz), move = w.inputFrame.move;
        const forward = Math.max(0, Math.min(1, (move.x * dx + move.z * dz) / length));
        s.crawlProgress = Math.min(1, (s.crawlProgress ?? 0) + forward / CRAWL);
        const f = s.crawlProgress;
        Object.assign(w.previousPlayer!, p.transform);
        Object.assign(p.transform, { x: lerp(start.x, end.x, f), y: survivor.height / 2 + .02, z: lerp(start.z, end.z, f), yaw: -Math.atan2(dz, dx) });
        if (s.endingAt === undefined) p.survivor!.scriptedClip = 'crawl';
        w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform); w.spatial.set(1, p.transform.x, p.transform.z);
        const sam = w.entities.get(this.driving.state.samId);
        if (sam?.civilian && sam.health.current > 0) { w.npcs!.move(sam, { x: 548, z: -8 }, 1.1, sam.civilian, .5); w.spatial.set(sam.id, sam.transform.x, sam.transform.z); }
        if (f >= 1) {
          if (s.endingAt === undefined) {
            s.endingAt = w.tick; delete p.survivor!.scriptedClip;
            w.vehicles!.explodeScripted(s.carId);
            this.mission.state.subtitle = { id: 'L9.end-caption', text: dialogue['L9.end-caption'], until: w.tick + 180 };
            w.events.emit({ type: 'dialogue.line', tick: w.tick, id: 'L9.end-caption', text: this.mission.state.subtitle.text });
          }
          if (w.tick - s.endingAt >= 180) {
            s.phase = 'done'; s.finished = true; w.storyLock = null; w.clearInput();
            this.mission.setState('crash-finished', true);
            w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.crawl-finished' });
          }
        }
      }
    }
  }
  /** Check both authored anchors against actual colliders and the whole crawl corridor. */
  private safeAnchor(): string {
    const w = this.w, end = this.anchor('crawl-end'), shape = new RAPIER.Capsule(survivor.height / 2 - survivor.radius, survivor.radius);
    for (const name of ['crawl-start', 'crawl-fallback']) {
      const start = this.anchor(name); let clear = true;
      for (let i = 0; i <= 40; i++) {
        const x = lerp(start.x, end.x, i / 40), z = lerp(start.z, end.z, i / 40);
        if (!w.districts!.nav.walkable([x, z]) || w.physics.world!.intersectionWithShape({ x, y: survivor.height / 2 + .02, z }, { x: 0, y: 0, z: 0, w: 1 }, shape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, w.physics.playerCollider!)) { clear = false; break; }
      }
      if (clear) return name;
    }
    throw new Error('L9 crash: both authored crawl corridors are blocked');
  }
  cameraPose(): { position: [number, number, number]; target: [number, number, number] } | null {
    const s = this.state;
    if (s.phase === 'driving' || s.phase === 'crawl' || s.phase === 'done') return null;
    if (s.phase === 'impact') return { position: [524, 3, 14], target: [516, -3.5, 4] };
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
    if (this.state.endingAt !== undefined) this.state.endingAt += this.w.tick - data.tick;
    if (this.state.encounters?.patrol) this.state.encounters.patrol.nextAt += this.w.tick - data.tick;
    if (this.state.driving) this.driving.restore(this.w.tick - data.tick);
  }
  /** Called after vehicle bodies rebuild; no impact/audio/event is replayed. */
  rebuild(): void {
    const s = this.state, car = this.w.entities.get(s.carId)!;
    if (s.driving) this.driving.rebuild();
    if (s.phase === 'driving') { this.w.storyLock = null; this.w.vehicles!.setFloorPolicy(s.carId); this.driving.poseHatch(); return; }
    const roll = s.phase === 'fall' ? Math.min(1, (this.w.tick - s.startedAt - (s.approachTicks ?? 180)) / FALL) * Math.PI / 2 : s.phase === 'approach' ? 0 : Math.PI / 2;
    const yaw = car.transform.yaw;
    this.w.vehicles!.scriptPose(s.carId, car.transform, 0, { x: Math.cos(yaw / 2) * Math.sin(roll / 2), y: Math.sin(yaw / 2) * Math.cos(roll / 2), z: -Math.sin(yaw / 2) * Math.sin(roll / 2), w: Math.cos(yaw / 2) * Math.cos(roll / 2) });
    if (s.phase === 'crawl' || s.finished) this.w.storyLock = null; else this.lock();
  }
}
