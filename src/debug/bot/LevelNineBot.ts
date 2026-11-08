import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { crossing, crossingRouteLength } from '../../levels/L9/district';
import type { Point } from '../../levels/districts/types';
import type { SimWorld } from '../../sim/world/SimWorld';
import { l9Course } from '../../data/l9';

/** Ordinary keyboard policy: follow a route, avoid heavy bodies, shake boarders,
 * defend stopped hatches and supply the controlled crawl. No simulation writes. */
export class LevelNineBot {
  private index = 1;
  private avoid: { x: number; z: number; until: number } | null = null;
  private blockedAt: number | null = null;
  private reverseUntil = 0;
  readonly path: readonly Point[];
  readonly length: number;
  constructor(private readonly w: SimWorld, routeId = 'road', detour = false, private readonly throttle = .7, readonly profile = 'complete') {
    const route = crossing.routes.find(r => r.id === routeId);
    if (!route) throw new Error(`Unknown L9 route ${routeId}`);
    // A long straight aimed only at its far end can retain a corner-cutting offset
    // for hundreds of metres. Guide the risky route through its authored encounter
    // anchors; the explicitly safe detour keeps its existing trace.
    const base = detour ? route.detour : route.points.flatMap((a, i, points) => {
      const b = points[i + 1]; if (!b) return [a];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const along = (p: Point) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length;
      return [a, ...route.risks.filter(p => along(p) > 0 && along(p) < length
        && Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / length < 1).sort((p, q) => along(p) - along(q))];
    });
    // A completion driver reads the road: it takes the open side of the solid
    // collapsed sections, reserving jump attempts for the dedicated fixture.
    // Clear the concrete splitter before taking the fork. A zero-HP APC has
    // a tighter slow turn and otherwise noses straight into its inner edge.
    const approach = base.map(p => p[0] === -450 && p[1] === 0 ? [-420, 0] as Point : p);
    this.path = approach.flatMap((a, i, points) => {
      const b = points[i + 1]; if (!b) return [a];
      const ramps = l9Course.ramps.filter(r => r.x - 18 > a[0] && r.x + 22 < b[0] && Math.abs(r.z - a[1]) < 6);
      return [a, ...ramps.flatMap(r => [[r.x - 18, r.z + 12], [r.x + 22, r.z + 12]] as Point[])];
    });
    this.length = crossingRouteLength(this.path);
  }
  get finished(): boolean { return this.w.missions?.l9?.state.finished ?? false; }
  /** Share of the route length passed (0..1): finished segments plus the car's projection on the current one. */
  progress(): number {
    const car = this.w.missions?.l9 && this.w.entities.get(this.w.missions.l9.state.carId), a = this.path[this.index - 1], b = this.path[this.index];
    const done = crossingRouteLength(this.path.slice(0, this.index)), seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const along = car ? ((car.transform.x - a[0]) * (b[0] - a[0]) + (car.transform.z - a[1]) * (b[1] - a[1])) / seg : 0;
    return Math.min(1, (done + Math.max(0, Math.min(seg, along))) / this.length);
  }
  /** 6 m on straights, up to 16 m before a right-angle bend at waypoint `i`. */
  private switchRadius(i: number): number {
    const a = this.path[i - 1], b = this.path[i], c = this.path[i + 1];
    if (!a || !c) return 6;
    const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])), Math.cos(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]))));
    return 6 + 10 * Math.min(1, turn / (Math.PI / 2));
  }
  sample(): InputFrame {
    const w = this.w, f = emptyInput(), l9 = w.missions?.l9;
    const car = l9 && w.entities.get(l9.state.carId);
    if (!car || this.profile === 'idle' || this.finished) return f;
    if (l9.state.phase === 'crawl') { const end = w.missions!.def.anchors['crawl-end'], dx = end.x - w.entities.get(1)!.transform.x, dz = end.z - w.entities.get(1)!.transform.z, length = Math.hypot(dx, dz) || 1; f.move = { x: dx / length, z: dz / length }; return f; }
    if (l9.state.phase !== 'driving') return f;
    const driving = l9.driving.state;
    if (l9.driving.hatch) {
      f.brake = true; f.selectedWeaponKey = 5;
      const target = w.infected!.active.filter(e => !e.hidden && !e.infected?.hidden && e.health.current > 0 && e.id !== driving.megaId).sort((a, b) => Math.hypot(a.transform.x - car.transform.x, a.transform.z - car.transform.z) - Math.hypot(b.transform.x - car.transform.x, b.transform.z - car.transform.z))[0];
      if (target && Math.hypot(target.transform.x - car.transform.x, target.transform.z - car.transform.z) < 30) { const dx = target.transform.x - car.transform.x, dz = target.transform.z - car.transform.z, length = Math.hypot(dx, dz) || 1; f.aim = { x: dx / length, z: dz / length }; f.aimSource = 'keyboard'; f.activeAttack = true; f.left = { down: true, held: true, up: false }; }
      return f;
    }
    if (car.vehicle!.attached.length && car.vehicle!.speed > 2.25) {
      f.drive = { throttle: .4, steer: w.tick % 120 < 60 ? 1 : -1 }; f.handbrake = true; return f;
    }
    if (!l9.driving.holding(car.id) && car.vehicle!.speed < 1) this.blockedAt ??= w.tick; else this.blockedAt = null;
    if (this.blockedAt !== null && w.tick - this.blockedAt >= 90) { this.reverseUntil = w.tick + 90; this.blockedAt = null; this.avoid = null; }
    if (w.tick < this.reverseUntil) { f.drive = { throttle: -.8, steer: .6 }; return f; }
    const p = car.transform;
    // Switch to the next waypoint earlier before a sharp bend: the 6 t APC's turning circle otherwise overshoots the corner by
    // ~8 m and wedges it against the dressed verge (fork corner (-450, 0) of the road detour: utility pole + bush, T-E31-20).
    while (this.index < this.path.length - 1 && Math.hypot(this.path[this.index][0] - p.x, this.path[this.index][1] - p.z) < this.switchRadius(this.index)) this.index++;
    let target: Point = this.path[this.index];
    if (p.x > 405 && Math.abs(p.z) < 35 && !driving.evacuationDone) {
      if (driving.gateClosed && p.x < l9Course.gate.x + 4) target = [l9Course.gate.x + 6, l9Course.gate.sideZ];
      else target = [l9Course.evacuation.x, l9Course.evacuation.z];
      if (Math.hypot(target[0] - p.x, target[1] - p.z) < 5 && target[0] === l9Course.evacuation.x) { f.brake = true; return f; }
    }
    // Read nearby moving heavy bodies, just as the driver reads solid road
    // furniture. Ploughing into the same brute after every restart is not a
    // completion policy for the revised stop-on-impact mechanic.
    if (this.avoid && (w.tick >= this.avoid.until || Math.hypot(this.avoid.x - p.x, this.avoid.z - p.z) < 4)) this.avoid = null;
    if (p.x < 405 && !this.avoid) {
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      const heavy = w.infected!.active.find(e => {
        const dx = e.transform.x - p.x, dz = e.transform.z - p.z, ahead = dx * c - dz * s;
        return !e.hidden && !e.infected?.hidden && e.health.current > 0 && ['infected.brute', 'infected.armored', 'infected.riot', 'infected.elephant'].includes(e.archetype) && ahead > 4 && ahead < 25 && Math.abs(dx * s + dz * c) < 6;
      });
      if (heavy) {
        const side = (heavy.transform.x - p.x) * s + (heavy.transform.z - p.z) * c >= 0 ? -1 : 1;
        this.avoid = { x: heavy.transform.x + s * side * 9, z: heavy.transform.z + c * side * 9, until: w.tick + 240 };
      }
    }
    if (this.avoid) target = [this.avoid.x, this.avoid.z];
    const dx = target[0] - p.x, dz = target[1] - p.z, want = -Math.atan2(dz, dx);
    const delta = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
    f.drive = { throttle: this.throttle, steer: Math.max(-1, Math.min(1, delta * 2)) };
    return f;
  }
}
