import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { crossing, crossingRouteLength } from '../../levels/L9/district';
import type { Point } from '../../levels/districts/types';
import type { SimWorld } from '../../sim/world/SimWorld';

/** One-seed can-it-be-finished driver for L9: real keyboard drive frames along a route (or its detour) with pure pursuit.
 * It never fights, leaves the car or loosens anything; the crash sequence takes over by itself at the outskirts. */
export class LevelNineBot {
  private index = 1;
  readonly path: readonly Point[];
  readonly length: number;
  constructor(private readonly w: SimWorld, routeId = 'road', detour = false, private readonly throttle = .7, readonly profile = 'complete') {
    const route = crossing.routes.find(r => r.id === routeId);
    if (!route) throw new Error(`Unknown L9 route ${routeId}`);
    this.path = detour ? route.detour : route.points; this.length = crossingRouteLength(this.path);
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
    if (!car || this.profile === 'idle' || this.finished || l9.state.phase !== 'driving') return f;
    const p = car.transform;
    // Switch to the next waypoint earlier before a sharp bend: the 6 t APC's turning circle otherwise overshoots the corner by
    // ~8 m and wedges it against the dressed verge (fork corner (-450, 0) of the road detour: utility pole + bush, T-E31-20).
    while (this.index < this.path.length - 1 && Math.hypot(this.path[this.index][0] - p.x, this.path[this.index][1] - p.z) < this.switchRadius(this.index)) this.index++;
    const dx = this.path[this.index][0] - p.x, dz = this.path[this.index][1] - p.z, want = -Math.atan2(dz, dx);
    const delta = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
    f.drive = { throttle: this.throttle, steer: Math.max(-1, Math.min(1, delta * 2)) };
    return f;
  }
}
