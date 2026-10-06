import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { Point } from './types';
/** Kinematic ambient lanes and L5 convoy. Collision prediction uses braking distance, without Rapier cars. */
export class Traffic {
  private readonly target = { x: 0, z: 0 };
  constructor(readonly world: SimWorld) {}
  spawn(route: Point[], panic = false): number {
    if (route.length < 2 || !route.every(p => Number.isFinite(p.x) && Number.isFinite(p.z))) throw new RangeError('Invalid traffic lane');
    const e = this.world.entities.create({ kind: 'traffic', archetype: 'veh.sedan-red', faction: 'environment', transform: { ...route[0], y: .5, yaw: 0 }, health: { current: 100, max: 100 }, traffic: { route: structuredClone(route), segment: 1, speed: 0, desired: panic ? 9 : 6, braking: 6, stopped: false, panic } });
    this.world.spatial.set(e.id, e.transform.x, e.transform.z); return e.id;
  }
  /** Sample E07's Catmull-Rom migration spline once; convoy members share the sampled route. */
  convoy(route: Point[], count = 3): number[] {
    if (route.length < 2 || !route.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)) || !Number.isInteger(count) || count < 1) throw new RangeError('Invalid convoy');
    const samples: Point[] = [], ids: number[] = []; let length = 0;
    for (let i = 0; i <= 256; i++) {
      const t = i / 256 * (route.length - 1), segment = Math.min(route.length - 2, Math.floor(t)), u = t - segment;
      const p0 = route[Math.max(0, segment - 1)], p1 = route[segment], p2 = route[segment + 1], p3 = route[Math.min(route.length - 1, segment + 2)], p = { x: 0, z: 0 };
      for (const axis of ['x', 'z'] as const) p[axis] = .5 * (2 * p1[axis] + (-p0[axis] + p2[axis]) * u + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * u * u + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * u * u * u);
      if (i) length += Math.hypot(p.x - samples[i - 1].x, p.z - samples[i - 1].z); samples.push(p);
    }
    for (let i = 0; i < count; i++) {
      const e = this.world.entities.create({ kind: 'convoy', archetype: ['veh.school-bus', 'veh.ambulance', 'veh.pickup'][i % 3], faction: 'escort', transform: { x: route[0].x - (route[1].x - route[0].x) / (Math.hypot(route[1].x - route[0].x, route[1].z - route[0].z) || 1) * i * 7, z: route[0].z - (route[1].z - route[0].z) / (Math.hypot(route[1].x - route[0].x, route[1].z - route[0].z) || 1) * i * 7, y: .5, yaw: 0 }, health: { current: 1000, max: 1000 }, convoy: { route, samples, distance: -i * 7, length, state: 'stop', speed: 3, offset: i * 7 } });
      ids.push(e.id); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
    return ids;
  }
  private blocked(e: EntitySnapshot, direction: Point, brakingDistance: number): number {
    let gap = Infinity;
    for (const pedestrian of this.world.entities.iterate()) {
      if (pedestrian.hidden || (pedestrian.kind !== 'player' && !pedestrian.civilian && !pedestrian.escort)) continue;
      const dx = pedestrian.transform.x - e.transform.x, dz = pedestrian.transform.z - e.transform.z;
      const along = dx * direction.x + dz * direction.z, across = Math.abs(dx * direction.z - dz * direction.x);
      if (along > -2.35 && across < 1.2 && along < brakingDistance + 2.5) gap = Math.min(gap, along - 2.5);
    }
    return gap;
  }
  /** Pedestrian sweeps cannot enter an ambient car even when it has already stopped. */
  overlaps(position: Point): boolean {
    for (const e of this.world.entities.iterate()) if (e.traffic) {
      const dx = position.x - e.transform.x, dz = position.z - e.transform.z, cosine = Math.cos(e.transform.yaw), sine = Math.sin(e.transform.yaw);
      if (Math.abs(dx * cosine - dz * sine) < 2.35 && Math.abs(dx * sine + dz * cosine) < 1.15) return true;
    }
    return false;
  }
  update(): void {
    for (const e of this.world.entities.iterate()) {
      const t = e.traffic;
      if (t && e.health.current > 0) {
        const target = t.route[t.segment], dx = target.x - e.transform.x, dz = target.z - e.transform.z, distance = Math.hypot(dx, dz);
        if (distance < .1) { t.segment = (t.segment + 1) % t.route.length; continue; }
        this.target.x = dx / distance; this.target.z = dz / distance;
        const brakingDistance = t.speed * t.speed / (2 * t.braking) + t.speed / 60;
        const gap = this.blocked(e, this.target, brakingDistance + .3);
        const desired = Number.isFinite(gap) ? Math.min(t.desired, Math.sqrt(Math.max(0, 2 * t.braking * (gap - .1)))) : t.desired;
        t.speed = Math.max(0, Math.min(desired, t.speed + 2 / 60));
        const move = Math.max(0, Math.min(distance, t.speed / 60, gap));
        t.stopped = move < .001;
        e.transform.x += this.target.x * move; e.transform.z += this.target.z * move; e.transform.yaw = -Math.atan2(dz, dx);
        // L3+ player cars may hit ambient cars; reaction is cosmetic kinematic knockback/HP.
        if (this.world.npcs!.civilians.level >= 3) for (const car of this.world.vehicles?.cars.values() ?? []) if (Math.hypot(car.entity.transform.x - e.transform.x, car.entity.transform.z - e.transform.z) < 3 && car.entity.vehicle!.speed > 4) { e.health.current = Math.max(0, e.health.current - 20); t.speed = 0; }
      }
      const c = e.convoy;
      if (c && c.state !== 'arrived' && c.state !== 'destroyed') {
        if (e.health.current <= 0) { c.state = 'destroyed'; this.world.events.emit({ type: 'mission.failed', tick: this.world.tick, reason: 'target-destroyed' }); continue; }
        // Arc-length lookup over the pre-sampled spline, keeping convoy spacing in metres.
        const nextDistance = c.distance + c.speed / 60; let remaining = Math.max(0, nextDistance), segment = 1;
        while (segment < c.samples.length - 1) { const a = c.samples[segment - 1], b = c.samples[segment], length = Math.hypot(b.x - a.x, b.z - a.z); if (remaining <= length) break; remaining -= length; segment++; }
        const a = c.samples[segment - 1], b = c.samples[segment], length = Math.hypot(b.x - a.x, b.z - a.z) || 1, ratio = Math.min(1, remaining / length);
        this.target.x = (b.x - a.x) / length; this.target.z = (b.z - a.z) / length;
        const ahead = this.world.infected!.nav.clear(e.transform.x + this.target.x * 3, e.transform.z + this.target.z * 3, 1) && this.blocked(e, this.target, 4) > 1;
        c.state = ahead ? 'go' : 'stop';
        if (ahead) {
          c.distance = nextDistance; e.transform.x = nextDistance < 0 ? c.route[0].x + this.target.x * nextDistance : a.x + (b.x - a.x) * ratio; e.transform.z = nextDistance < 0 ? c.route[0].z + this.target.z * nextDistance : a.z + (b.z - a.z) * ratio; e.transform.yaw = -Math.atan2(this.target.z, this.target.x);
          if (c.distance >= c.length) c.state = 'arrived';
        }
      }
      if (t || c) this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }
}
