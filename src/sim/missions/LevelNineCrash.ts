import * as RAPIER from '@dimforge/rapier3d-compat';
import { stopEngine } from '../vehicles/ConvoySound';
import { survivor } from '../../data/survivor';
import type { Transform } from '../world/types';
import type { Mission } from './Mission';

export interface L9CrashState {
  phase: 'driving' | 'approach' | 'fall' | 'impact' | 'crawl' | 'done';
  carId: number; startedAt: number; preCrashDurability: number;
  from: Transform; crawlAnchor: string; finished: boolean; ended: boolean;
}
const APPROACH = 180, FALL = 120, IMPACT = 180, CRAWL = 360;
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/** E31 L9-S6: fixed-tick, one-shot crash. Campaign equipment reset belongs to S7. */
export class LevelNineCrash {
  state: L9CrashState = { phase: 'driving', carId: 0, startedAt: 0, preCrashDurability: 0,
    from: { x: 0, y: 0, z: 0, yaw: 0 }, crawlAnchor: 'crawl-start', finished: false, ended: false };
  constructor(private readonly mission: Mission) {}
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
    w.vehicles!.setFloorPolicy(this.state.carId);
    const saved = w.progression?.campaign?.l9Crash;
    if (saved) {
      if (this.state.carId !== saved.state.carId) w.entities.delete(this.state.carId);
      Object.assign(w.entities.get(1)!, structuredClone(saved.player));
      w.entities.replace(structuredClone(saved.vehicle));
      this.restore(saved);
      if (saved.chunks) w.chunks?.load(saved.chunks);
      w.vehicles!.rebuild(); this.rebuild();
      const p = w.entities.get(1)!;
      w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform);
      w.previousPlayer = { ...p.transform }; w.spatial.set(1, p.transform.x, p.transform.z);
      this.mission.setState('crash-started', this.state.phase !== 'driving');
      this.mission.setState('crash-finished', this.state.finished);
      if (this.state.ended) { this.mission.state.phase = 'progression'; this.mission.state.result = w.progression?.campaign?.results?.L9 ?? null; }
    }
  }
  begin(): void { this.mission.checkpoint('crossing-start'); }
  private lock(): void {
    this.w.storyLock = { scripted: null, skip: false }; this.w.clearInput();
    const p = this.w.entities.get(1)!;
    p.health.current = Math.max(1, p.health.current);
    p.survivor!.invulnerableUntil = this.w.tick + 120;
  }
  update(): void {
    const s = this.state, w = this.w, car = w.entities.get(s.carId);
    if (!car || s.finished || w.entities.get(1)!.health.current <= 0) return;
    if (s.phase === 'driving') {
      const a = this.anchor('crash-approach');
      // The complete outskirts strip catches road/off-road bypasses before the x=550 trigger.
      if (car.transform.x < a.x - 2) return;
      this.mission.checkpoint('outskirts-approach');
      this.mission.setState('crash-started', true);
      s.phase = 'approach'; s.startedAt = w.tick; s.from = { ...car.transform }; s.preCrashDurability = car.health.current;
      w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.crash-approach', actorId: s.carId });
    }
    this.lock();
    const def = w.vehicles!.cars.get(s.carId)!.physics.def, height = def.suspension + def.wheelRadius + .15;
    const t = w.tick - s.startedAt, lip = this.anchor('crash-impact'), wreck = this.anchor('crash-wreck');
    if (t < APPROACH) {
      w.vehicles!.scriptPose(s.carId, { x: lerp(s.from.x, lip.x, t / APPROACH), y: lerp(s.from.y, height, t / APPROACH), z: lerp(s.from.z, lip.z, t / APPROACH), yaw: 0 });
    } else if (t < APPROACH + FALL) {
      if (s.phase === 'approach') { s.phase = 'fall'; w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.bridge-collapse' }); }
      const f = (t - APPROACH) / FALL;
      w.vehicles!.scriptPose(s.carId, { x: lerp(lip.x, wreck.x, f), y: lerp(height, wreck.y + height, f * f), z: wreck.z, yaw: lerp(0, Math.PI / 2, f) });
    } else {
      w.vehicles!.scriptPose(s.carId, { ...wreck, y: wreck.y + height, yaw: Math.PI / 2 });
      if (s.phase === 'fall' || s.phase === 'approach') {
        s.crawlAnchor = this.safeAnchor(); s.phase = 'impact';
        const safe = this.anchor(s.crawlAnchor); safe.y += survivor.height / 2 + .02;
        w.vehicles!.destroyScripted(s.carId, safe); stopEngine(w, s.carId);
        w.events.emit({ type: 'vehicle.sound', tick: w.tick, sourceId: s.carId, phase: 'crash', position: wreck, velocity: { x: 0, z: 0 }, rpm: 0, speed: 0, health: 0, impulse: 30 });
        this.mission.state.subtitle = { id: 'l9.crash', text: 'The bridge gave way. Crawl clear of the wreck.', until: w.tick + 300 };
        w.events.emit({ type: 'dialogue.line', tick: w.tick, id: 'l9.crash', text: this.mission.state.subtitle.text });
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.crash-impact', actorId: s.carId });
      }
      if (t >= APPROACH + FALL + IMPACT) {
        s.phase = 'crawl';
        const f = (t - APPROACH - FALL - IMPACT) / CRAWL, start = this.anchor(s.crawlAnchor), end = this.anchor('crawl-end'), p = w.entities.get(1)!;
        Object.assign(w.previousPlayer!, p.transform);
        Object.assign(p.transform, { x: lerp(start.x, end.x, f), y: survivor.height / 2 + .02, z: lerp(start.z, end.z, f), yaw: 0 });
        p.survivor!.scriptedClip = 'crawl';
        w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform); w.spatial.set(1, p.transform.x, p.transform.z);
        if (f >= 1) {
          s.phase = 'done'; s.finished = true; delete p.survivor!.scriptedClip; w.storyLock = null; w.clearInput();
          this.mission.setState('crash-finished', true);
          w.events.emit({ type: 'mission.signal', tick: w.tick, name: 'l9.crawl-finished' });
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
    const p = this.w.entities.get(s.carId)!.transform;
    return { position: [p.x + 20, 22, p.z + 20], target: [p.x, p.y, p.z] };
  }
  end(): void { if (this.state.finished) this.state.ended = true; }
  save() { return { ...this.snapshot(), ...(this.w.chunks ? { chunks: this.w.chunks.save() } : {}), player: this.w.getEntity(1)!, vehicle: this.w.getEntity(this.state.carId)! }; }
  snapshot() { return { state: structuredClone(this.state), tick: this.w.tick }; }
  restore(saved: unknown): void {
    const data = saved as ReturnType<LevelNineCrash['snapshot']>;
    this.state = structuredClone(data.state); this.state.startedAt += this.w.tick - data.tick;
  }
  /** Called after vehicle bodies rebuild; no impact/audio/event is replayed. */
  rebuild(): void {
    const s = this.state, car = this.w.entities.get(s.carId)!;
    if (s.phase === 'driving') { this.w.storyLock = null; this.w.vehicles!.setFloorPolicy(s.carId); return; }
    this.w.vehicles!.scriptPose(s.carId, car.transform);
    if (!s.finished) this.lock(); else this.w.storyLock = null;
  }
}
