import type { RigidBody } from '@dimforge/rapier3d-compat';
import type { SimWorld } from '../world/SimWorld';
import { storyProtected } from '../npc/storyProtection';
import type { InfectedSpecialAttack } from './types';
import type { EntitySnapshot } from '../world/types';
/** Borrowed E26 medium-prop body. E26 owns its lifetime and visual synchronization. */
export interface ThrowableProp { id: number; body: RigidBody; mass: number; class: 'light' | 'medium' | 'heavy'; radius: number }
interface Flight { prop: ThrowableProp; sourceId: number; attackId: number; expires: number }
/** E07 only selects/launches borrowed props; physics and momentum damage use the existing world. */
export class PropThrows {
  readonly props: ThrowableProp[] = [];
  readonly flights: Flight[] = [];
  private readonly object = { id: 0, corpse: false, living: false };
  private objectDistanceSquared = 0;
  constructor(private readonly world: SimWorld) {}
  nearestMedium(source: EntitySnapshot): ThrowableProp | undefined {
    let nearest: ThrowableProp | undefined, distance = 6;
    for (const prop of this.props) {
      if (prop.class !== 'medium' || this.flights.some((flight) => flight.prop === prop)) continue;
      const position = prop.body.translation(), d = Math.hypot(position.x - source.transform.x, position.z - source.transform.z);
      if (d < distance) { distance = d; nearest = prop; }
    }
    return nearest;
  }
  nearestLight(source: EntitySnapshot, radius = 6): ThrowableProp | undefined {
    let nearest: ThrowableProp | undefined, distance = radius;
    const consider = (candidate: ThrowableProp) => {
      if (candidate.class !== 'light' || this.reserved(candidate.id) || this.flights.some(flight => flight.prop.id === candidate.id)) return;
      const p = candidate.body.translation(), d = Math.hypot(p.x - source.transform.x, p.z - source.transform.z);
      if (d - candidate.radius < distance) { distance = Math.max(0, d - candidate.radius); nearest = candidate; }
    };
    for (const prop of this.props) consider(prop);
    for (const item of this.world.props?.items ?? []) if (!item.fixed && !item.braced && item.metadata.class !== 'fixed' && item.body.isEnabled()) consider({ id: item.entityId, body: item.body, mass: item.mass, class: item.metadata.class, radius: item.radius });
    return nearest;
  }
  launch(source: EntitySnapshot, attackId: number): boolean {
    const prop = this.nearestMedium(source); if (!prop) return false;
    const target = this.world.entities.get(1)!.transform, p = source.transform;
    const dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz), time = Math.max(0.25, distance / 12), y = 2;
    prop.body.setTranslation({ x: p.x, y, z: p.z }, true);
    prop.body.setLinvel({ x: dx / time, y: (target.y - y + 0.5 * 9.81 * time * time) / time, z: dz / time }, true);
    this.flights.push({ prop, sourceId: source.id, attackId, expires: this.world.tick + Math.ceil((time + 1) * 60) });
    this.world.events.emit({ type: 'infected.prop-thrown', tick: this.world.tick, sourceId: source.id, propId: prop.id, attackId }); return true;
  }
  /** Nearest available retained corpse or movable E26 medium prop, with stable id ties. */
  nearestObject(source: EntitySnapshot, radius: number, lightOnly = false): { id: number; corpse: boolean; living: boolean } | undefined {
    if (source.infected?.arenaBoss) return this.nearestArenaObject(source, radius, lightOnly);
    this.object.id = 0; this.objectDistanceSquared = (radius + 1e-9) ** 2;
    for (const e of this.world.entities.iterate()) if (e.corpse && e.health.current <= 0 && e.id !== source.id) this.considerObject(source, e.id, true, e.transform);
    for (const p of this.world.props?.items ?? []) if (p.mass < 1500 && !p.fixed && !p.braced && p.body.isEnabled()) this.considerObject(source, p.entityId, false, p.body.translation(), p.radius);
    for (const p of this.props) if (p.mass < 1500 && p.body.isEnabled()) this.considerObject(source, p.id, false, p.body.translation(), p.radius);
    return this.object.id ? this.object : undefined;
  }
  private nearestArenaObject(source: EntitySnapshot, radius: number, lightOnly = false): { id: number; corpse: boolean; living: boolean } | undefined {
    const gorilla = source.infected?.arenaBoss?.arena === 'gorilla';
    this.object.id = 0; this.objectDistanceSquared = (radius + 1e-9) ** 2;
    for (const e of this.world.entities.iterate()) if (!lightOnly && e.corpse && e.infected && e.health.current <= 0) this.considerObject(source, e.id, true, e.transform);
    for (const p of this.world.props?.items ?? []) if ((lightOnly ? p.metadata.class === 'light' : gorilla ? p.metadata.mass <= 1500 : p.metadata.class === 'medium') && !p.fixed && !p.braced && p.body.isEnabled()) this.considerObject(source, p.entityId, false, p.body.translation());
    for (const p of this.props) if ((lightOnly ? p.class === 'light' : gorilla ? p.mass <= 1500 : p.class === 'medium') && p.body.isEnabled()) this.considerObject(source, p.id, false, p.body.translation());
    if (gorilla && !lightOnly) for (const e of this.world.infected!.active) if (e.id !== source.id && e.health.current > 0 && !e.infected!.arenaBoss && !e.infected!.pursuit && !e.infected!.thrownBy && !e.emerging && !e.hidden && !e.infected!.hidden && e.attachedTo === undefined && !e.infectionRise) this.considerObject(source, e.id, false, e.transform, 0, true);
    return this.object.id ? this.object : undefined;
  }
  objectPosition(id: number): { x: number; z: number } | undefined {
    const e = this.world.entities.get(id);
    if (e?.corpse) return { x: e.transform.x, z: e.transform.z };
    const prop = this.world.props?.items.find(item => item.entityId === id);
    if (prop) { const p = prop.body.translation(); return { x: p.x, z: p.z }; }
    const borrowed = this.props.find(item => item.id === id);
    if (borrowed) { const p = borrowed.body.translation(); return { x: p.x, z: p.z }; }
    return undefined;
  }
  /** Select a living regular infected for the Thrower living-missile move. */
  nearestLiving(source: EntitySnapshot, radius: number): EntitySnapshot | undefined {
    let found: EntitySnapshot | undefined, best = radius * radius;
    for (const e of this.world.infected!.active) {
      if (e.id === source.id || e.archetype === 'infected.alpha' || e.infected?.arenaBoss || e.infected?.arenaCarrier || e.attachedTo !== undefined || this.reserved(e.id) || !e.infected || e.health.current <= 0 || e.corpse || e.infected.hidden || e.infected.specialAttack || e.infected.pursuit || e.infectionRise) continue;
      const dx = e.transform.x - source.transform.x, dz = e.transform.z - source.transform.z, d = dx * dx + dz * dz;
      if (d > best || !this.world.infected!.hearing.lineOfSight(source.transform, e.transform)) continue;
      if (d < best || d === best && e.id < (found?.id ?? Infinity)) { found = e; best = d; }
    }
    return found;
  }
  private reserved(id: number): boolean {
    return this.world.infected!.active.some(e => e.infected!.specialAttack?.pickup?.objectId === id || e.infected!.specialAttack?.barrageProjectiles?.some(f => f.objectId === id) || e.infected!.specialAttack?.projectile?.objectId === id && e.infected!.specialAttack.stage === 'active');
  }
  private body(id: number): RigidBody | undefined {
    return this.world.props?.items.find(p => p.entityId === id)?.body ?? this.props.find(p => p.id === id)?.body;
  }
  /** Reserve a real world object at the beginning of its visible overhead lift. */
  pickupSpecial(source: EntitySnapshot, a: InfectedSpecialAttack, radius = a.move === 'gorilla.grab-throw' ? 3 : 2): boolean {
    if (a.pickup) return true;
    const living = a.move === 'alpha.living-missile' ? this.nearestLiving(source, radius) : undefined;
    const light = a.move === 'alpha.barrage' ? this.nearestLight(source, radius) : undefined;
    const object = living ? { id: living.id, corpse: false, living: true } : light ? { id: light.id, corpse: false } : a.move === 'alpha.living-missile' || a.move === 'alpha.barrage' ? undefined : this.nearestObject(source, radius);
    if (!object) return false;
    a.pickup = { objectId: object.id, corpse: object.corpse, ...('living' in object && object.living ? { living: true } : {}) };
    const entity = this.world.entities.get(object.id);
    if (entity) {
      entity.attachedTo = source.id;
      if (object.corpse) { entity.corpseThrown = true; delete entity.corpseBlast; }
    }
    this.holdSpecial(source, a); return true;
  }
  holdSpecial(source: EntitySnapshot, a: InfectedSpecialAttack): void {
    if (source.infected?.arenaBoss && a.projectile) { this.positionSpecial(a, false); return; }
    const held = a.pickup; if (!held) return;
    const p = { x: source.transform.x, y: source.transform.y + 1.8, z: source.transform.z };
    const body = this.body(held.objectId);
    if (body) { body.setTranslation(p, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    const entity = this.world.entities.get(held.objectId); if (entity) Object.assign(entity.transform, p);
    this.world.spatial.set(held.objectId, p.x, p.z);
  }
  private considerObject(source: EntitySnapshot, id: number, corpse: boolean, p: { x: number; y?: number; z: number }, radius = 0, living = false): void {
    const dx = p.x - source.transform.x, dz = p.z - source.transform.z, squared = Math.max(0, Math.hypot(dx, dz) - radius) ** 2;
    if (squared > this.objectDistanceSquared || squared === this.objectDistanceSquared && id >= (this.object.id || Infinity)) return;
    for (const e of this.world.infected!.active) if (e.infected!.specialAttack?.projectile?.objectId === id && e.infected!.specialAttack.stage !== 'recovery') return;
    for (const flight of this.flights) if (flight.prop.id === id) return;
    if (this.reserved(id) || (source.infected?.arenaBoss?.roof ? !this.world.combat!.query.visible(source.transform, { x: p.x, y: (p.y ?? 0) + .5, z: p.z }) : !this.world.infected!.hearing.lineOfSight(source.transform, p))) return;
    this.object.id = id; this.object.corpse = corpse; this.object.living = living; this.objectDistanceSquared = squared;
  }
  launchSpecial(source: EntitySnapshot, a: InfectedSpecialAttack, radius: number, arenaRange = 15, speed = 12, lift = false): boolean {
    if (source.infected?.arenaBoss) return this.launchArenaSpecial(source, a, radius, arenaRange, speed, lift);
    if (!a.pickup && !this.pickupSpecial(source, a, radius)) return false;
    const object = a.pickup!;
    const entity = this.world.entities.get(object.objectId);
    if (object.living && (!entity || entity.health.current <= 0)) { this.settleSpecial(a); return false; }
    const dx = a.target.x - source.transform.x, dz = a.target.z - source.transform.z, distance = Math.hypot(dx, dz);
    if (distance < .01) return false;
    const range = object.living ? Math.max(.1, Math.min(25, distance - 1.8)) : Math.min(25, distance);
    const body = !object.corpse && !object.living ? this.body(object.objectId) : undefined;
    a.projectile = { ...object, physics: !!body, radius: this.world.props?.items.find(p => p.entityId === object.objectId)?.radius ?? this.props.find(p => p.id === object.objectId)?.radius ?? 1, y: source.transform.y + 1.8, ...(body ? { damping: body.linearDamping() } : {}), started: this.world.tick, x: source.transform.x, z: source.transform.z, dx: dx / distance, dz: dz / distance, distance: 0, range };
    if (body) {
      body.setLinearDamping(0);
      const time = Math.max(.25, range / 12), y = source.transform.y + 1.8;
      this.world.props?.burst(this.world.tick + Math.ceil((time + 1) * 60));
      const floor = this.world.districts?.groundHeight(a.target.x, a.target.z) ?? 0;
      body.setTranslation({ x: source.transform.x, y, z: source.transform.z }, true);
      body.setLinvel({ x: dx / distance * range / time, y: (floor + .5 - y + .5 * 9.81 * time * time) / time, z: dz / distance * range / time }, true);
    }
    if (entity && !object.living) delete entity.attachedTo;
    delete a.pickup;
    this.world.events.emit({ type: 'infected.prop-thrown', tick: this.world.tick, sourceId: source.id, propId: object.objectId, attackId: a.attackId });
    this.positionSpecial(a, false); return true;
  }
  /** A 12 m/s swept flight, bounded to 25 m. Its scalar progress survives restore without a WASM handle. */
  updateSpecial(source: EntitySnapshot, a: InfectedSpecialAttack): boolean {
    if (a.projectile?.fromY !== undefined) return this.updateArenaSpecial(source, a);
    const f = a.projectile!;
    if (this.world.tick === f.started) return false;
    const old = { x: f.lastX ?? f.x + f.dx * f.distance, z: f.lastZ ?? f.z + f.dz * f.distance };
    const next = Math.min(f.range, (this.world.tick - f.started) * 12 / 60), body = f.physics ? this.body(f.objectId) : undefined;
    if (body && f.restoreVelocity) {
      const time = Math.max(.25, f.range / 12), elapsed = f.distance / 12;
      const floor = this.world.districts?.groundHeight(a.target.x, a.target.z) ?? 0;
      body.setLinearDamping(0);
      body.setLinvel({ x: f.dx * f.range / time, y: (floor + .5 - (f.y ?? 2.5) + .5 * 9.81 * time * time) / time - 9.81 * elapsed, z: f.dz * f.range / time }, true);
      delete f.restoreVelocity;
    }
    const p = body ? body.translation() : { x: f.x + f.dx * next, z: f.z + f.dz * next };
    f.lastX = p.x; f.lastZ = p.z;
    // Full solid cover wins over a human behind it, including thin dynamic LOS blockers.
    if (!this.world.infected!.hearing.lineOfSight(old, p)) { this.positionSpecial(a, true); return true; }
    f.distance = next; this.positionSpecial(a, false);
    let victim: EntitySnapshot | undefined, along = Infinity;
    const hitRadius = Math.max(1, f.radius ?? 1);
    for (const human of this.world.infected!.hearing.humans.within(p, hitRadius + .2)) {
      const e = this.world.entities.get(human.id);
      if (!e || e.health.current <= 0 || e.companion || e.escort?.child || storyProtected(this.world, e)) continue;
      const vx = e.transform.x - old.x, vz = e.transform.z - old.z, t = Math.max(0, Math.min(Math.hypot(p.x - old.x, p.z - old.z), vx * f.dx + vz * f.dz));
      if (Math.hypot(old.x + f.dx * t - e.transform.x, old.z + f.dz * t - e.transform.z) > hitRadius || !this.world.infected!.hearing.lineOfSight(old, e.transform)) continue;
      if (t < along || t === along && e.id < (victim?.id ?? Infinity)) { victim = e; along = t; }
    }
    if (victim && this.world.infected!.specialHit(source.id, victim.id)) {
      const amount = this.world.combat!.damage.apply({ sourceId: source.id, targetId: victim.id, attackId: a.attackId, actionId: `infected.${a.move}`, origin: old, direction: { x: f.dx, z: f.dz }, base: 30, multiplier: 1, type: 'projectile', knockback: 0, stagger: .8, knockdownTicks: 48 });
      this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: source.id, targetId: victim.id, attackId: a.attackId, special: a.move, amount });
      this.positionSpecial(a, true); return true;
    }
    if (next >= f.range || f.living && (this.world.entities.get(f.objectId)?.health.current ?? 0) <= 0) { this.positionSpecial(a, true); return true; }
    return false;
  }
  private positionSpecial(a: InfectedSpecialAttack, settled: boolean): void {
    if (a.projectile?.fromY !== undefined) { this.positionArenaSpecial(a, settled); return; }
    const f = a.projectile!;
    if (f.physics) { if (settled) this.body(f.objectId)?.setLinearDamping(f.damping ?? 1.2); return; } // Rapier owns the arc, collision and final resting pose.
    const x = f.x + f.dx * f.distance, z = f.z + f.dz * f.distance;
    const floor = this.world.districts?.groundHeight(x, z) ?? 0;
    const height = settled ? 0 : 1.3 * (1 - f.distance / f.range) + Math.sin(Math.PI * f.distance / f.range) * .6;
    const e = this.world.entities.get(f.objectId);
    if (f.corpse) { if (e) Object.assign(e.transform, { x, y: floor + .7 + height, z }); }
    else {
      const prop = this.world.props?.items.find(p => p.entityId === f.objectId), body = prop?.body ?? this.props.find(p => p.id === f.objectId)?.body;
      if (body) { body.setTranslation({ x, y: floor + height, z }, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
      if (prop) { prop.pose.p = [x, floor + height, z]; prop.awake = true; }
      if (e) Object.assign(e.transform, { x, y: floor + .7 + height, z });
      if (f.living && settled && e?.infected) {
        delete e.attachedTo; e.transform.y = floor + .7;
        if (e.health.current > 0) {
          e.infected.state = 'chase'; e.infected.heardTargetId = a.target.id; e.infected.targetId = 0; e.infected.path.length = 0;
          delete e.infected.scripted; delete e.noiseTarget; delete e.infected.roar;
          if (e.infected.l1) {
            const brain = e.infected.l1;
            brain.mode = 'chase'; brain.targetId = a.target.id; brain.pauseUntil = 0; brain.hasGoal = false;
            brain.distractionId = 0; brain.ignoreId = 0; brain.ignoreUntil = 0;
            brain.seenX = a.target.x; brain.seenZ = a.target.z; brain.seenTick = this.world.tick;
          }
          e.combat!.staggerUntil = this.world.tick + 36;
          e.combat!.reaction = { index: 0, started: this.world.tick, until: this.world.tick + 36, direction: { x: f.dx, z: f.dz }, from: { x, z }, to: { x, z }, heavy: true };
        }
      }
    }
    this.world.spatial.set(f.objectId, x, z);
  }
  private launchArenaSpecial(source: EntitySnapshot, a: InfectedSpecialAttack, radius: number, range = 15, speed = 12, lift = false): boolean {
    const object = this.nearestObject(source, radius, (source.infected?.arenaBoss?.barrage ?? 0) > 0); if (!object) return false;
    const dx = a.target.x - source.transform.x, dz = a.target.z - source.transform.z, distance = Math.hypot(dx, dz);
    if (distance < .01) return false;
    a.projectile = { objectId: object.id, corpse: object.corpse, living: object.living, started: lift ? a.activeTick : this.world.tick, x: source.transform.x, z: source.transform.z, dx: dx / distance, dz: dz / distance, distance: 0, range: Math.max(.1, Math.min(range, distance - (object.living ? 2 : 0))), speed, ...(source.infected?.arenaBoss ? { fromY: source.transform.y + .6, toY: this.world.districts?.groundHeight(a.target.x, a.target.z) ?? 0 } : {}) };
    const body = this.world.entities.get(object.id); if (object.corpse && body) { body.corpseThrown = true; delete body.corpseBlast; }
    if (object.living && body?.infected) { body.infected.thrownBy = source.id; body.infected.perched = true; this.world.infected!.cancelSpecial(body.id); }
    if (!lift) this.world.events.emit({ type: 'infected.prop-thrown', tick: this.world.tick, sourceId: source.id, propId: object.id, attackId: a.attackId });
    this.positionSpecial(a, false); return true;
  }
  /** A 12 m/s swept flight, bounded to 15 m. Its scalar progress survives restore without a WASM handle. */
  private updateArenaSpecial(source: EntitySnapshot, a: InfectedSpecialAttack): boolean {
    const f = a.projectile!;
    if (this.world.tick === f.started) return false;
    const old = { x: f.x + f.dx * f.distance, y: this.flightY(a, f.distance), z: f.z + f.dz * f.distance };
    const next = Math.min(f.range, (this.world.tick - f.started) * (f.speed ?? 12) / 60), p = { x: f.x + f.dx * next, y: this.flightY(a, next), z: f.z + f.dz * next };
    // Full solid cover wins over a human behind it, including thin dynamic LOS blockers.
    if (f.fromY !== undefined ? !this.world.combat!.query.visible(old, p) : !this.world.infected!.hearing.lineOfSight(old, p)) { this.positionSpecial(a, true); return true; }
    f.distance = next; this.positionSpecial(a, false);
    let victim: EntitySnapshot | undefined, along = Infinity;
    for (const human of this.world.infected!.hearing.humans.within(p, 1.2)) {
      const e = this.world.entities.get(human.id);
      if (!e || e.health.current <= 0 || e.companion || e.escort?.child || storyProtected(this.world, e)) continue;
      const vx = e.transform.x - old.x, vz = e.transform.z - old.z, t = Math.max(0, Math.min(Math.hypot(p.x - old.x, p.z - old.z), vx * f.dx + vz * f.dz));
      if (f.fromY !== undefined && Math.abs(old.y + (p.y - old.y) * t / (Math.hypot(p.x - old.x, p.z - old.z) || 1) - e.transform.y) > 1) continue;
      if (Math.hypot(old.x + f.dx * t - e.transform.x, old.z + f.dz * t - e.transform.z) > 1 || (f.fromY !== undefined ? !this.world.combat!.query.visible(old, e.transform) : !this.world.infected!.hearing.lineOfSight(old, e.transform))) continue;
      if (t < along || t === along && e.id < (victim?.id ?? Infinity)) { victim = e; along = t; }
    }
    if (victim && this.world.infected!.specialHit(source.id, victim.id)) {
      const amount = this.world.combat!.damage.apply({ sourceId: source.id, targetId: victim.id, attackId: a.attackId, actionId: `infected.${a.move}`, origin: old, direction: { x: f.dx, z: f.dz }, base: source.infected?.arenaBoss?.arena === 'gorilla' ? (source.infected.arenaBoss.barrage ? 18 : 65) : 30, multiplier: 1, type: 'projectile', knockback: 0, stagger: .8, knockdownTicks: 48 });
      this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: source.id, targetId: victim.id, attackId: a.attackId, special: a.move, amount });
      this.positionSpecial(a, true); return true;
    }
    if (next >= f.range) { this.positionSpecial(a, true); return true; }
    return false;
  }
  private flightY(a: InfectedSpecialAttack, distance: number): number {
    const f = a.projectile!, t = distance / f.range, floor = this.world.districts?.groundHeight(f.x + f.dx * distance, f.z + f.dz * distance) ?? 0;
    return f.fromY === undefined ? floor + 1.3 * (1 - t) + Math.sin(Math.PI * t) * .6 : f.fromY * (1 - t) + (f.toY ?? floor) * t + Math.sin(Math.PI * t) * 1.2;
  }
  private positionArenaSpecial(a: InfectedSpecialAttack, settled: boolean): void {
    const f = a.projectile!, x = f.x + f.dx * f.distance, z = f.z + f.dz * f.distance;
    const floor = this.world.districts?.groundHeight(x, z) ?? 0;
    const height = settled ? 0 : this.flightY(a, f.distance) - floor;
    const e = this.world.entities.get(f.objectId);
    if (f.corpse || f.living) { if (e) {
      this.world.solids.wrote(e, 'infected.thrown-body'); Object.assign(e.transform, { x, y: floor + .7 + height, z });
      if (settled && f.living && e.infected) {
        delete e.infected.thrownBy; e.infected.perched = false;
        if (e.health.current > 0) {
          this.world.infected!.pursueTarget(e.id, 1);
          e.combat!.staggerUntil = this.world.tick + 36; e.infected.state = 'stagger'; e.infected.until = this.world.tick + 36;
          e.combat!.reaction = { index: 0, started: this.world.tick, until: this.world.tick + 36, direction: { x: f.dx, z: f.dz }, from: { x, z }, to: { x, z }, heavy: true };
        }
        this.world.solids.admit(e, 'infected.thrown-landing', 3);
      }
    } }
    else {
      const prop = this.world.props?.items.find(p => p.entityId === f.objectId), body = prop?.body ?? this.props.find(p => p.id === f.objectId)?.body;
      if (body) { body.setTranslation({ x, y: floor + height, z }, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
      if (prop) { prop.pose.p = [x, floor + height, z]; prop.awake = true; }
      if (e) Object.assign(e.transform, { x, y: floor + height, z });
    }
    this.world.spatial.set(f.objectId, x, z);
  }
  settleSpecial(a: InfectedSpecialAttack): void {
    if (a.pickup) {
      const held = a.pickup, entity = this.world.entities.get(held.objectId), source = entity?.attachedTo !== undefined ? this.world.entities.get(entity.attachedTo) : undefined;
      const p = source?.transform ?? entity?.transform;
      if (p) {
        const y = (this.world.districts?.groundHeight(p.x, p.z) ?? 0) + .7;
        if (entity) { delete entity.attachedTo; Object.assign(entity.transform, { x: p.x, y, z: p.z }); }
        this.body(held.objectId)?.setTranslation({ x: p.x, y, z: p.z }, true);
      }
      delete a.pickup;
    }
    if (a.projectile) this.positionSpecial(a, true);
    for (const projectile of a.barrageProjectiles ?? []) { a.projectile = projectile; this.positionSpecial(a, true); }
    delete a.projectile; delete a.barrageProjectiles;
  }
  update(): void {
    const player = this.world.entities.get(1)!;
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i], p = flight.prop.body.translation(), v = flight.prop.body.linvel();
      const controller = this.world.physics.characterController;
      let contact = false;
      if (controller) for (let c = 0; c < controller.numComputedCollisions(); c++) if (controller.computedCollision(c)?.collider?.parent()?.handle === flight.prop.body.handle) contact = true;
      if (contact || Math.hypot(p.x - player.transform.x, p.y - player.transform.y, p.z - player.transform.z) < flight.prop.radius + 0.6) {
        const speed = Math.hypot(v.x, v.y, v.z), damage = Math.min(80, flight.prop.mass * speed * speed * 0.005);
        const amount = this.world.combat!.damage.apply({ sourceId: flight.sourceId, targetId: 1, attackId: flight.attackId, actionId: 'infected.alpha.throw', origin: p, direction: { x: v.x / Math.max(0.01, speed), z: v.z / Math.max(0.01, speed) }, base: damage, multiplier: 1, type: 'melee', knockback: 0, stagger: .8, knockdownTicks: 48 });
        this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: flight.sourceId, targetId: 1, attackId: flight.attackId, special: 'prop-throw', amount }); this.flights.splice(i, 1);
      } else if (this.world.tick >= flight.expires) this.flights.splice(i, 1);
    }
  }
}
