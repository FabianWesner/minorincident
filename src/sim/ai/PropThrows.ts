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
    const gorilla = source.infected?.arenaBoss?.arena === 'gorilla';
    this.object.id = 0; this.objectDistanceSquared = (radius + 1e-9) ** 2;
    for (const e of this.world.entities.iterate()) if (!lightOnly && e.corpse && e.infected && e.health.current <= 0) this.considerObject(source, e.id, true, e.transform);
    for (const p of this.world.props?.items ?? []) if ((lightOnly ? p.metadata.class === 'light' : gorilla ? p.metadata.mass <= 1500 : p.metadata.class === 'medium') && !p.fixed && !p.braced && p.body.isEnabled()) this.considerObject(source, p.entityId, false, p.body.translation());
    for (const p of this.props) if ((lightOnly ? p.class === 'light' : gorilla ? p.mass <= 1500 : p.class === 'medium') && p.body.isEnabled()) this.considerObject(source, p.id, false, p.body.translation());
    if (gorilla && !lightOnly) for (const e of this.world.infected!.active) if (e.id !== source.id && e.health.current > 0 && !e.infected!.arenaBoss && !e.infected!.pursuit && !e.infected!.thrownBy && !e.emerging && !e.hidden && !e.infected!.hidden && e.attachedTo === undefined && !e.infectionRise) this.considerObject(source, e.id, false, e.transform, true);
    return this.object.id ? this.object : undefined;
  }
  private considerObject(source: EntitySnapshot, id: number, corpse: boolean, p: { x: number; y?: number; z: number }, living = false): void {
    const dx = p.x - source.transform.x, dz = p.z - source.transform.z, squared = dx * dx + dz * dz;
    if (squared > this.objectDistanceSquared || squared === this.objectDistanceSquared && id >= (this.object.id || Infinity)) return;
    for (const e of this.world.infected!.active) if (e.infected!.specialAttack?.projectile?.objectId === id && e.infected!.specialAttack.stage !== 'recovery') return;
    for (const flight of this.flights) if (flight.prop.id === id) return;
    if (source.infected?.arenaBoss?.roof ? !this.world.combat!.query.visible(source.transform, { x: p.x, y: (p.y ?? 0) + .5, z: p.z }) : !this.world.infected!.hearing.lineOfSight(source.transform, p)) return;
    this.object.id = id; this.object.corpse = corpse; this.object.living = living; this.objectDistanceSquared = squared;
  }
  launchSpecial(source: EntitySnapshot, a: InfectedSpecialAttack, radius: number, range = 15, speed = 12, lift = false): boolean {
    const object = this.nearestObject(source, radius, (source.infected?.arenaBoss?.barrage ?? 0) > 0); if (!object) return false;
    const dx = a.target.x - source.transform.x, dz = a.target.z - source.transform.z, distance = Math.hypot(dx, dz);
    if (distance < .01) return false;
    a.projectile = { objectId: object.id, corpse: object.corpse, living: object.living, started: lift ? a.activeTick : this.world.tick, x: source.transform.x, z: source.transform.z, dx: dx / distance, dz: dz / distance, distance: 0, range: Math.max(.1, Math.min(range, distance - (object.living ? 2 : 0))), speed, ...(source.infected?.arenaBoss ? { fromY: source.transform.y + .6, toY: this.world.districts?.groundHeight(a.target.x, a.target.z) ?? 0 } : {}) };
    const body = this.world.entities.get(object.id); if (object.corpse && body) { body.corpseThrown = true; delete body.corpseBlast; }
    if (object.living && body?.infected) { body.infected.thrownBy = source.id; body.infected.perched = true; this.world.infected!.cancelSpecial(body.id); }
    if (!lift) this.world.events.emit({ type: 'infected.prop-thrown', tick: this.world.tick, sourceId: source.id, propId: object.id, attackId: a.attackId });
    this.positionSpecial(a, false); return true;
  }
  holdSpecial(a: InfectedSpecialAttack): void { if (a.projectile) this.positionSpecial(a, false); }
  /** A 12 m/s swept flight, bounded to 15 m. Its scalar progress survives restore without a WASM handle. */
  updateSpecial(source: EntitySnapshot, a: InfectedSpecialAttack): boolean {
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
      const amount = this.world.combat!.damage.apply({ sourceId: source.id, targetId: victim.id, attackId: a.attackId, actionId: `infected.${a.move}`, origin: old, direction: { x: f.dx, z: f.dz }, base: source.infected?.arenaBoss?.arena === 'gorilla' ? (source.infected.arenaBoss.barrage ? 18 : 40) : 30, multiplier: 1, type: 'projectile', knockback: 0, stagger: .8, knockdownTicks: 48 });
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
  private positionSpecial(a: InfectedSpecialAttack, settled: boolean): void {
    const f = a.projectile!, x = f.x + f.dx * f.distance, z = f.z + f.dz * f.distance;
    const floor = this.world.districts?.groundHeight(x, z) ?? 0;
    const height = settled ? 0 : this.flightY(a, f.distance) - floor;
    const e = this.world.entities.get(f.objectId);
    if (f.corpse || f.living) { if (e) {
      this.world.solids.wrote(e, 'infected.thrown-body'); Object.assign(e.transform, { x, y: floor + .7 + height, z });
      if (settled && f.living && e.infected) {
        delete e.infected.thrownBy; e.infected.perched = false;
        e.combat!.staggerUntil = this.world.tick + 36; e.infected.state = 'stagger'; e.infected.until = this.world.tick + 36;
        if (e.health.current > 0) this.world.infected!.pursueTarget(e.id, 1);
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
  settleSpecial(a: InfectedSpecialAttack): void { if (a.projectile) this.positionSpecial(a, true); }
  update(): void {
    const player = this.world.entities.get(1)!;
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i], p = flight.prop.body.translation(), v = flight.prop.body.linvel();
      const controller = this.world.physics.characterController;
      let contact = false;
      if (controller) for (let c = 0; c < controller.numComputedCollisions(); c++) if (controller.computedCollision(c)?.collider?.parent()?.handle === flight.prop.body.handle) contact = true;
      if (contact || Math.hypot(p.x - player.transform.x, p.y - player.transform.y, p.z - player.transform.z) < flight.prop.radius + 0.6) {
        const speed = Math.hypot(v.x, v.y, v.z), damage = Math.min(80, flight.prop.mass * speed * speed * 0.005);
        const amount = this.world.combat!.damage.apply({ sourceId: flight.sourceId, targetId: 1, attackId: flight.attackId, actionId: 'infected.gorilla.prop', origin: p, direction: { x: v.x / Math.max(0.01, speed), z: v.z / Math.max(0.01, speed) }, base: damage, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
        this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: flight.sourceId, targetId: 1, attackId: flight.attackId, special: 'prop-throw', amount }); this.flights.splice(i, 1);
      } else if (this.world.tick >= flight.expires) this.flights.splice(i, 1);
    }
  }
}
