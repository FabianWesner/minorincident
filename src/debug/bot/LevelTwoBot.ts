import { Rng } from '../../core/Rng';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import { Walker } from './Walker';

/** E20 section 8 bot profiles. `aggressive` stays at the rescue and fights; `idle` stands by the truck after arrival. */
export type L2Profile = 'complete' | 'newbie' | 'no-axe' | 'aggressive' | 'idle';
/** Escape route through the town and the way past the bridge cluster (forced-choice runs, AC13). */
export type L2Opening = 'side' | 'alarm';
type P = { x: number; z: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const ROUTES: Record<L2Opening, P[]> = {
  // Side path: Main Row west, Maple south, Elm to Juniper, alley-s east, the edge strip to the south gate of the checkpoint.
  side: [{ x: -50, z: -32 }, { x: -62, z: -31 }, { x: -64, z: -26 }, { x: -64, z: 2 }, { x: -64, z: 29.5 }, { x: -31, z: 30 }, { x: -30.6, z: 47.8 }, { x: 20, z: 48 }, { x: 60, z: 48 }, { x: 81.6, z: 48 }, { x: 81.8, z: 42 }, { x: 81.5, z: 36.8 }, { x: 81.4, z: 32.4 }],
  // Car alarm: Main Row east, Larch south to the parked car by the cluster, set it off, double back west along alley-r1 and take Elm Street to the main gate.
  alarm: [{ x: -44, z: -31 }, { x: -12, z: -31 }, { x: 20, z: -31 }, { x: 49.8, z: -30.5 }, { x: 50, z: -2 }, { x: 50.4, z: 12 }, { x: 50.6, z: 15.4 }, { x: 40, z: 15.2 }, { x: 14.2, z: 15.2 }, { x: 14.2, z: 29.6 }, { x: 40, z: 30 }, { x: 60, z: 30.5 }, { x: 70, z: 30 }, { x: 78.6, z: 30 }],
};
/** Route index at which the `alarm` opening sets the car off. */
const ALARM_AT = 6;

/**
 * L2 policy shared by the Node battery and the browser (ordinary controls only: movement, attack, interact; no cheats).
 * Complete: takes the axe, boards, fights a little at the doors, then disengages along the shortest safe route and slips
 * past the cluster by the side path. Newbie: 250 ms reaction, 15 % skipped attacks, occasional wrong turns.
 */
export class LevelTwoBot {
  finished = false;
  private readonly walker = new Walker();
  private readonly rng: Rng;
  private frame: InputFrame = emptyInput();
  private waypoint = 0;
  private detour: (P & { until: number }) | null = null;
  private stuck = { at: null as P | null, n: 0, next: 0 };
  private retreatAt = 0;
  private alarmed = false;
  private last: P | null = null;
  constructor(private readonly world: SimWorld, readonly profile: L2Profile = 'complete', readonly opening: L2Opening = 'side') { this.rng = new Rng(world.seed, `l2-bot-${profile}`); }
  private get takesAxe(): boolean { return this.profile !== 'no-axe' && this.profile !== 'idle'; }
  private threats(p: P, radius: number): EntitySnapshot[] {
    const w = this.world;
    return (w.infected?.active ?? []).filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && !e.infectionRise && dist(e.transform, p) <= radius && w.infected!.nav.visible(p, e.transform, 0))
      .sort((a, b) => dist(a.transform, p) - dist(b.transform, p));
  }
  sample(): InputFrame {
    const w = this.world, m = w.missions!, s = m.state.l2;
    this.finished = m.state.phase === 'result' || m.state.phase === 'progression';
    if (this.finished || !s) return emptyInput();
    if (m.state.phase === 'retry') { m.restore(); this.walker.reset(); this.detour = null; }
    if (m.state.phase === 'briefing') m.begin();
    if (m.state.phase === 'cinematic') return { ...emptyInput(), interact: true };
    const newbie = this.profile === 'newbie';
    if (newbie && w.tick % 15 !== 0) { this.frame.interact = false; return this.frame; }
    const frame = this.frame = emptyInput(), player = w.entities.get(1)!, p = player.transform, a = m.def.anchors;
    if (player.health.current <= 0 || s.seated) return frame;
    const go = (target: P, stop: number, key: string) => { const dir = this.walker.step(w, target, stop, key); if (dir) frame.move = dir; return !dir; };
    const strike = (target: EntitySnapshot) => { frame.attackTarget = { id: target.id, side: 'LEFT' }; frame.left.held = true; frame.move = { x: 0, z: 0 }; };
    // Calm and alarm: wait in the bay; at the alarm take the axe (optional) and board the truck.
    if (s.phase === 'calm') { if (this.takesAxe) go(a['l2-axe-rack'], 1, 'axe-wait'); return frame; }
    if (s.phase === 'alarm') {
      if (this.takesAxe && m.state.steps.axe.status === 'active') { if (go(a['l2-axe-rack'], .5, 'axe')) frame.interact = !newbie || this.rng.next() < .5; return frame; }
      if (go(a['l2-board'], .5, 'board')) frame.interact = !newbie || this.rng.next() < .5;
      return frame;
    }
    if (s.phase === 'ride') return frame;
    const near = this.threats(p, 2.6), skip = newbie && this.rng.next() < .15;
    if (this.profile === 'idle') return frame;
    if (this.profile === 'aggressive') {
      // Stays within 15 m of the doors and fights everything that comes.
      const door = a['l2-door-front'];
      if (near[0]) { strike(near[0]); return frame; }
      const prey = this.threats(door, 15)[0];
      if (prey) go(prey.transform, 1.6, `prey-${prey.id}`); else go(a['l2-forecourt'], 2, 'hold');
      return frame;
    }
    // Before the doors open: stand by the forecourt, out of the crew's way.
    if (!s.doorsOpenAt) { go(a['l2-forecourt'], 1.5, 'forecourt'); return frame; }
    // Fight a little at the doors, then disengage before the crowd closes in.
    if (!this.retreatAt) this.retreatAt = s.doorsOpenAt + (newbie ? 10 : 6) * 60;
    const leaving = w.tick >= this.retreatAt;
    if (!leaving) { if (near[0] && !skip) strike(near[0]); else go(a['l2-forecourt'], 2.5, 'cover'); return frame; }
    const route = ROUTES[this.opening];
    // After a respawn (checkpoint restore) rejoin the route at its nearest point instead of cutting across blocks.
    if (this.last && dist(this.last, p) > 6) { this.waypoint = route.reduce((best, q, i) => dist(q, p) < dist(route[best], p) ? i : best, 0); this.walker.reset(); this.detour = null; if (this.opening === 'alarm' && this.waypoint <= ALARM_AT) this.alarmed = false; }
    this.last = { x: p.x, z: p.z };
    while (this.waypoint < route.length - 1 && dist(p, route[this.waypoint]) < 2.2) this.waypoint++;
    if (this.opening === 'alarm' && !this.alarmed && this.waypoint >= ALARM_AT) {
      // Set the car alarm off (interact at the car), then double back while the cluster runs to it.
      const car = a['l2-cluster-alarm'];
      if (dist(p, car) > 2.6) { this.waypoint = ALARM_AT; go(car, 2.2, 'car'); return frame; }
      frame.interact = true; this.alarmed = true; this.waypoint = ALARM_AT + 1; return frame;
    }
    // A jammed walker (crowd or corner) steps aside along a connected route.
    if (w.tick >= this.stuck.next) {
      this.stuck.next = w.tick + 60;
      if (this.stuck.at && dist(this.stuck.at, p) < .6 && !near.length) this.stuck.n++; else this.stuck.n = 0;
      this.stuck.at = { x: p.x, z: p.z };
      if (this.stuck.n >= 3) { const at = this.walker.detour(w, route[this.waypoint]); this.detour = at ? { ...at, until: w.tick + 180 } : null; this.stuck.n = 0; }
    }
    if (this.detour && (w.tick > this.detour.until || dist(p, this.detour) < 1)) { this.detour = null; this.walker.reset(); }
    const crowd = this.threats(p, 4);
    // Losing a fight against three or more: break away along a connected route instead of standing.
    if (!this.detour && crowd.length >= 3 && player.health.current < 45) { const at = this.walker.detour(w, route[this.waypoint], crowd[0].transform); if (at) this.detour = { ...at, until: w.tick + 150 }; }
    if (newbie && !this.detour && this.rng.next() < .0015) { const k = Object.keys(a), r = a[k[Math.floor(this.rng.next() * k.length)]]; this.detour = { x: r.x, z: r.z, until: w.tick + 240 }; }
    if (this.detour) { go(this.detour, .8, `detour-${this.detour.until}`); return frame; }
    // Kill the few that follow; otherwise keep moving.
    if (near[0] && !skip) { strike(near[0]); return frame; }
    go(route[this.waypoint], .6, `route-${this.waypoint}`);
    return frame;
  }
}
