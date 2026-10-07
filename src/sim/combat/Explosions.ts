// Radial impulse with upward bias, mass-scaled linear falloff, applied one tick later, and bullet time:
// adapted from Bruno Simon folio-2025 Explosions.js + Time.js bulletTime (MIT, 41046b5). Ticker waits become sim ticks.
import * as RAPIER from '@dimforge/rapier3d-compat';
import { SimPhase } from '../../core/EventBus';
import { blastDamage, explosionDef, type BlastClass, type ExplosionDef } from '../../data/explosions';
import type { ExplosionBeat } from '../../data/audioEvents';
import type { SimWorld } from '../world/SimWorld';

export interface BlastOptions {
  /** Entity credited with damage (hazard, car, thrower). Defaults to the player. */
  sourceId?: number;
  /** Upgrade-resolved radius (throwables); defaults to the def radius. */
  radius?: number;
  /** False when the caller already resolved damage (E05 throwables/projectiles keep their own resolver). */
  damage?: boolean;
}
/** Detached car body panels (E27-AC05): cosmetic physics bodies that tumble and settle; 30 s lifetime. */
export interface CarPart { body: RAPIER.RigidBody; kind: 'door' | 'hood'; sourceId: number; until: number; half: [number, number, number] }
interface Pending { at: number; body: RAPIER.RigidBody; x: number; y: number; z: number }
type Scheduled = { at: number; kind: 'stage'; def: string; x: number; z: number; sourceId: number }
  | { at: number; kind: 'beat'; beat: ExplosionBeat; size: 'small' | 'medium' | 'large' | 'mega'; x: number; z: number; sourceId: number };

/** Bodies respond less as they get heavier: cones fly, benches tumble, cars hop (spec 07 §2 explosion column). */
export const massResponse = (mass: number): number => Math.min(1.25, Math.max(.4, (50 / mass) ** .25));
const audioSize = (c: BlastClass): 'small' | 'medium' | 'large' | 'mega' => c === 'mega' || c === 'large' || c === 'medium' ? c : 'small';
const MAX_FIRES = 24, MAX_PARTS = 12;

/** E27 core: one deterministic entry point for every blast (hazards, throwables, cars, scripted megas). */
export class Explosions {
  readonly pending: Pending[] = [];
  readonly scheduled: Scheduled[] = [];
  readonly parts: CarPart[] = [];
  private readonly nearby: number[] = [];
  private readonly area = { x: 0, z: 0, r: 0 };
  private readonly impulse = { x: 0, y: 0, z: 0 };
  /** Last blast per sim tick, for probes and tests. */
  last: { tick: number; id: string; x: number; z: number; radius: number } | null = null;
  constructor(private readonly world: SimWorld) {
    world.events.on('sim.tick', () => this.applyImpulses(), SimPhase.ai);
    world.events.on('sim.tick', () => this.update(), SimPhase.missions);
  }
  blast(id: string, at: { x: number; z: number }, opts: BlastOptions = {}): void {
    const d = explosionDef(id), sourceId = opts.sourceId ?? 1, tick = this.world.tick;
    if (!Number.isFinite(at.x) || !Number.isFinite(at.z)) throw new RangeError('Blast position must be finite');
    if (d.stages) {
      for (const s of d.stages) this.scheduled.push({ at: tick + s.delay, kind: 'stage', def: s.def, x: at.x + s.offset.x, z: at.z + s.offset.z, sourceId });
      this.update(); return;
    }
    const r = opts.radius ?? d.radius;
    this.last = { tick, id, x: at.x, z: at.z, radius: r };
    this.world.events.emit({ type: 'explosion', tick, defId: id, cls: d.class, fx: d.fx, sourceId, position: { x: at.x, y: .7, z: at.z }, radius: r });
    const size = audioSize(d.class);
    this.world.events.emit({ type: 'explosion.beat', tick, sourceId, position: { x: at.x, y: .7, z: at.z }, beat: 'crack', size });
    this.scheduled.push({ at: tick + 4, kind: 'beat', beat: 'debris', size, x: at.x, z: at.z, sourceId }, { at: tick + 15, kind: 'beat', beat: 'roar', size, x: at.x, z: at.z, sourceId });
    this.damage(d, at, r, sourceId, opts.damage !== false);
    this.queueImpulses(d, at, r);
    if (d.class === 'large' && this.world.vehicles?.cars.has(sourceId)) this.detachParts(sourceId);
    this.ignite(d, at, r);
    const player = this.world.entities.get(1);
    if (d.slowMo && player && player.health.current > 0 && Math.hypot(player.transform.x - at.x, player.transform.z - at.z) <= d.slowMo.within)
      this.world.events.emit({ type: 'explosion.slowmo', tick, defId: id, scale: d.slowMo.scale, seconds: d.slowMo.seconds });
  }
  private damage(d: ExplosionDef, at: { x: number; z: number }, r: number, sourceId: number, apply: boolean): void {
    const world = this.world, damage = world.combat?.damage, query = world.combat?.query;
    this.area.x = at.x; this.area.z = at.z; this.area.r = r;
    // Copy once: hit events chain into hazards that query neighbours themselves.
    for (const id of [...world.spatial.query(this.area, this.nearby)]) {
      const target = world.entities.get(id);
      if (!target || id === sourceId || target.health.current <= 0 || target.hidden || target.attachedTo !== undefined) continue;
      const dx = target.transform.x - at.x, dz = target.transform.z - at.z, distance = Math.hypot(dx, dz);
      if (distance > r || (query && !this.visible(query, at, target.transform, target.id))) continue;
      const amount = blastDamage(d, distance, r), scale = d.damage ? amount / d.damage : 0;
      if (target.vehicle) { world.vehicles?.damage(id, apply ? amount * d.vehicle : 0); continue; }
      if (!apply || !damage || amount <= 0) continue;
      damage.apply({ attackId: 0, actionId: d.id, sourceId: world.entities.get(sourceId) ? sourceId : 1, targetId: id, origin: at, direction: { x: distance ? dx / distance : 1, z: distance ? dz / distance : 0 }, base: amount, multiplier: 1, type: 'explosive', radius: r, knockback: d.knockback * scale, stagger: d.stagger });
    }
    // Barricade rails are not in the spatial hash: distance to the rail segment (spec 07 §5 barricade damage).
    if (!damage || d.barricade <= 0) return;
    for (const e of world.entities.values()) {
      const s = e.barricade?.slot; if (!s || !e.barricade!.intact || e.health.current <= 0) continue;
      const ax = s.b.x - s.a.x, az = s.b.z - s.a.z, t = Math.max(0, Math.min(1, ((at.x - s.a.x) * ax + (at.z - s.a.z) * az) / (ax * ax + az * az)));
      const distance = Math.hypot(s.a.x + ax * t - at.x, s.a.z + az * t - at.z), amount = blastDamage(d, distance, r) * d.barricade;
      if (amount > 0) damage.apply({ attackId: 0, actionId: d.id, sourceId: world.entities.get(sourceId) ? sourceId : 1, targetId: e.id, origin: at, direction: { x: 0, z: 0 }, base: amount, multiplier: 1, type: 'explosive', knockback: 0, stagger: 0 });
    }
  }
  /** Full cover between blast and target shields it; cover the blast starts inside (a stack of tanks) does not. */
  private visible(query: import('./HitQuery').HitQuery, at: { x: number; z: number }, to: { x: number; z: number }, targetId: number): boolean {
    const dx = to.x - at.x, dz = to.z - at.z, distance = Math.hypot(dx, dz);
    if (distance < 1e-6) return true;
    for (const walls of [query.walls, query.dynamicWalls]) for (const w of walls) {
      if (w.entityId === targetId || w.y - w.halfY > .7 || w.y + w.halfY < .7 || (Math.abs(at.x - w.x) <= w.halfX && Math.abs(at.z - w.z) <= w.halfZ)) continue;
      let near = 0, far = distance;
      for (const [o, d, c, half] of [[at.x, dx / distance, w.x, w.halfX], [at.z, dz / distance, w.z, w.halfZ]]) {
        if (Math.abs(d) < 1e-12) { if (o < c - half || o > c + half) { far = -1; break; } continue; }
        const a = (c - half - o) / d, b = (c + half - o) / d; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      }
      if (far >= near && near < distance - 1e-8) return false;
    }
    return true;
  }
  /** Bruno: direction = horizontal × (1/upward) + up, normalised; strength fades linearly from 1 m to the radius. */
  private push(d: ExplosionDef, at: { x: number; z: number }, r: number, body: RAPIER.RigidBody): void {
    if (!body.isEnabled() || !body.isDynamic()) return;
    const p = body.translation(), dx = p.x - at.x, dz = p.z - at.z, distance = Math.hypot(dx, dz);
    const fade = Math.max(0, Math.min(1, (r - distance) / Math.max(1e-6, r - 1)));
    if (fade <= 0 || d.impulse <= 0) return;
    const h = 1 / d.upward, nx = distance > 1e-6 ? dx / distance * h : 0, nz = distance > 1e-6 ? dz / distance * h : 0, length = Math.hypot(nx, 1, nz);
    const mass = body.mass(), speed = d.impulse * fade * massResponse(mass);
    this.pending.push({ at: this.world.tick + 1, body, x: nx / length * speed * mass, y: 1 / length * speed * mass, z: nz / length * speed * mass });
  }
  private queueImpulses(d: ExplosionDef, at: { x: number; z: number }, r: number): void {
    const props = this.world.props;
    if (props) {
      let woken = 0;
      for (const item of props.items) if (!item.fixed && !item.braced && Math.hypot(item.pose.p[0] - at.x, item.pose.p[2] - at.z) < r) { this.push(d, at, r, item.body); woken++; }
      if (woken) props.burst(this.world.tick + 300);
    }
    for (const piece of this.world.hazards?.debris.pieces ?? []) if (piece.until) this.push(d, at, r, piece.body);
    for (const car of this.world.vehicles?.cars.values() ?? []) this.push(d, at, r, car.physics.body);
    for (const part of this.parts) if (part.until) this.push(d, at, r, part.body);
  }
  private applyImpulses(): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]; if (p.at > this.world.tick) continue;
      this.impulse.x = p.x; this.impulse.y = p.y; this.impulse.z = p.z;
      if (p.body.isValid() && p.body.isEnabled()) p.body.applyImpulse(this.impulse, true);
      this.pending.splice(i, 1);
    }
  }
  /** Doors and hood fly off the wreck as cosmetic bodies (pooled, never more than 12). */
  private detachParts(carId: number): void {
    const car = this.world.vehicles!.cars.get(carId)!, physics = this.world.physics.world!, t = car.physics.transform, def = car.physics.def;
    const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
    const specs: { kind: CarPart['kind']; half: [number, number, number]; local: [number, number, number]; v: [number, number, number] }[] = [
      { kind: 'hood', half: [.55, .04, def.width * .42], local: [def.length * .3, .55, 0], v: [2.5, 7.5, 0] },
      { kind: 'door', half: [.5, .38, .04], local: [.1, .3, def.width / 2 + .05], v: [.6, 4.5, 5] },
      { kind: 'door', half: [.5, .38, .04], local: [.1, .3, -def.width / 2 - .05], v: [-.4, 4, -5] },
    ];
    for (const spec of specs) {
      let part = this.parts.find(p => !p.until);
      if (!part && this.parts.length < MAX_PARTS) {
        const body = physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setLinearDamping(.3).setAngularDamping(.6));
        physics.createCollider(RAPIER.ColliderDesc.cuboid(...spec.half).setDensity(40).setCollisionGroups(0x00020002), body);
        part = { body, kind: spec.kind, sourceId: carId, until: 0, half: spec.half }; this.parts.push(part);
      }
      if (!part) break;
      const [lx, ly, lz] = spec.local, [vx, vy, vz] = spec.v;
      part.kind = spec.kind; part.sourceId = carId; part.until = this.world.tick + 1800; part.body.setEnabled(true);
      part.body.setTranslation({ x: t.x + lx * c + lz * s, y: t.y + ly, z: t.z - lx * s + lz * c }, true);
      part.body.setRotation({ x: 0, y: Math.sin(t.yaw / 2), z: 0, w: Math.cos(t.yaw / 2) }, true);
      part.body.setLinvel({ x: vx * c + vz * s, y: vy, z: -vx * s + vz * c }, true);
      part.body.setAngvel({ x: vz * .8, y: 1.5, z: -vx * 1.2 }, true);
    }
  }
  /** Aftermath fires: E11 fire hazards that damage, ignite flammables, spread once and burn out. */
  private ignite(d: ExplosionDef, at: { x: number; z: number }, r: number): void {
    const hazards = this.world.hazards; if (!hazards || !d.fires.count) return;
    let active = 0;
    for (const e of this.world.entities.iterate()) if (e.hazard?.kind === 'fire' && this.world.tick < e.hazard.activeUntil) active++;
    const phase = (this.world.tick % 17) * .37;
    for (let i = 0; i < d.fires.count && active < MAX_FIRES; i++, active++) {
      const angle = phase + i * Math.PI * 2 / d.fires.count, distance = r * (.18 + .12 * (i % 2));
      hazards.spawn('fire', { x: at.x + Math.cos(angle) * distance, z: at.z + Math.sin(angle) * distance }, { radius: d.fires.radius, duration: d.fires.seconds, spread: d.fires.spread });
    }
  }
  /** Fire count for the spread cap (shared with Hazards). */
  static readonly maxFires = MAX_FIRES;
  private update(): void {
    const tick = this.world.tick;
    for (let i = 0; i < this.scheduled.length;) {
      const s = this.scheduled[i]; if (s.at > tick) { i++; continue; }
      this.scheduled.splice(i, 1);
      if (s.kind === 'stage') {
        this.world.events.emit({ type: 'explosion.beat', tick, sourceId: s.sourceId, position: { x: s.x, y: .7, z: s.z }, beat: 'boom', size: audioSize(explosionDef(s.def).class) });
        this.blast(s.def, s, { sourceId: s.sourceId });
      } else this.world.events.emit({ type: 'explosion.beat', tick, sourceId: s.sourceId, position: { x: s.x, y: .7, z: s.z }, beat: s.beat, size: s.size });
    }
    for (const part of this.parts) if (part.until && tick >= part.until) { part.until = 0; part.body.setEnabled(false); }
  }
  /** Physics-world replacement (decay tier rebuild) invalidates the pooled bodies. */
  reset(worldReset = false): void {
    if (!worldReset) for (const part of this.parts) this.world.physics.world?.removeRigidBody(part.body);
    this.parts.length = 0; this.pending.length = 0;
  }
  snapshot() {
    return { scheduled: this.scheduled.map(s => ({ ...s })), parts: this.parts.filter(p => p.until).map(p => ({ kind: p.kind, sourceId: p.sourceId, until: p.until, position: { ...p.body.translation() }, rotation: { ...p.body.rotation() } })) };
  }
}
