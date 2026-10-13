import { SimPhase } from '../../core/EventBus';
import { megaAlpha } from '../../data/megaAlpha';
import { Status } from '../combat/Status';
import { moveAgent } from '../locomotion/AgentMotion';
import type { NavGrid } from './NavGrid';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';

/**
 * E32 §5.4 / AC10 (lane L10-S3): the one persistent Mega Alpha and its global pursuit.
 *
 * - It reads the player's position (sampled at 2 Hz: "approximately") with no sight, hearing or lure checks.
 * - It cruises at 0.7 × the nominal run everywhere. Where detailed collision/nav is resident it steers on the shared nav grid
 *   (towards the next authored route node while far, towards the player while near); inside `closeM` the shared Alpha chase brain
 *   (contact, barricade breach, special scheduler) runs it. Off-region it advances along the authored route graph at the same
 *   speed × sim-time in 2 Hz steps, without a mesh or collider.
 * - Stuck recovery escalates replan → authored alternate link → shared Alpha breach brain, and cycles, so no obstacle traps it for good.
 * - One entity, spawned once, always in the infected system (it counts against the cap even while coarse). Its compact pursuit state
 *   is a checkpoint seam (`world.megaPursuit`); entity HP/position/cooldowns ride the ordinary entity snapshot.
 *
 * The residency query is the seam to L9-S4 streaming: `resident(x, z)` is true where collision/nav for that point is loaded.
 */
export interface PursuitNode { id: string; x: number; z: number; region?: string }
/** Authored reachable waypoints (street centre lines, region seams); links are walkable both ways. */
export interface PursuitRoute { nodes: readonly PursuitNode[]; links: readonly (readonly [string, string])[] }
export interface PursuitOptions {
  route?: PursuitRoute;
  /** L9-S4 seam: true where detailed collision/nav is loaded. Default: inside the AI nav grid and its active-district mask. */
  resident?: (x: number, z: number) => boolean;
  /** Authored introduction point; default: the route node nearest `startBehindM` route-metres from the player, else straight behind her. */
  spawn?: { x: number; z: number };
  /** Absolute tick of the automatic introduction; null = the mission calls introduce(). Default: install tick + introduceS. */
  introduceTick?: number | null;
}
export type PursuitMode = 'dormant' | 'detailed' | 'close' | 'coarse' | 'recover' | 'breach' | 'dead';
export type PursuitBand = 'distant' | 'approaching' | 'near';
export interface MegaPursuitState {
  /** Capture tick: restore shifts every stored tick by the checkpoint delta, like entity timers. */
  tick: number;
  id: number; mode: PursuitMode; introducedAt: number; introduceTick: number | null;
  x: number; z: number; hp: number; maxHp: number;
  /** Approximate player position, refreshed at 2 Hz. */
  target: { x: number; z: number };
  /** Remaining authored node ids towards the node nearest the target. */
  route: string[]; routeAt: number;
  /** Last authored node reached; the current leg is passed → route[0]. */
  passed: string | null;
  /** Link key → avoided until tick; -1 = authored block (collapsed street) until breached or unblocked. */
  blocked: Record<string, number>;
  breach: { link: string; until: number } | null;
  stuck: { level: number; since: number; sampleAt: number; x: number; z: number; noPath: number; goal: { x: number; z: number } | null };
  lastDamage: { tick: number; amount: number; sourceId: number } | null;
  /** Metres advanced while coarse (telemetry). */
  coarseM: number;
}
const key = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const BLOCKED_COST = 1e6;

export class MegaPursuit {
  state: MegaPursuitState;
  private readonly nodes = new Map<string, PursuitNode>();
  private readonly adjacency = new Map<string, string[]>();
  private readonly resident: (x: number, z: number) => boolean;
  private readonly path = { path: [] as number[], goal: -1, pathIndex: 0, hold: 0 };
  private readonly waypoint = { x: 0, z: 0 };
  private readonly local = { x: 0, z: 0 };
  private readonly stops: (() => void)[] = [];
  private reservation = false;
  /** Nav baked at the Mega's own clearance (falls back to the shared crowd grid on very large grids). */
  readonly grid: NavGrid;
  readonly radius: number;
  constructor(readonly world: SimWorld, readonly options: PursuitOptions = {}) {
    for (const node of options.route?.nodes ?? []) { if (this.nodes.has(node.id)) throw new Error(`Duplicate pursuit node ${node.id}`); this.nodes.set(node.id, node); this.adjacency.set(node.id, []); }
    for (const [a, b] of options.route?.links ?? []) {
      if (!this.nodes.has(a) || !this.nodes.has(b)) throw new Error(`Unknown pursuit link ${a}-${b}`);
      this.adjacency.get(a)!.push(b); this.adjacency.get(b)!.push(a);
    }
    const ai = world.infected!;
    const own = ai.nav.width * ai.nav.depth <= megaAlpha.ownGridMaxCells;
    this.grid = own ? ai.nav.withClearance(megaAlpha.radius) : ai.nav; this.radius = own ? megaAlpha.radius : ai.nav.clearance;
    if (own) this.stops.push(world.events.on('world.blocker.changed', ev => { if (ev.type === 'world.blocker.changed') this.grid.setBlocker(ev.id, ev.wall, ev.blocked); }));
    this.resident = options.resident ?? ((x, z) => ai.nav.cell(x, z) >= 0 && (!ai.nav.mask || ai.nav.mask(x, z)));
    const player = world.entities.get(1)!.transform;
    this.state = {
      tick: world.tick, id: 0, mode: 'dormant', introducedAt: -1,
      introduceTick: options.introduceTick === undefined ? world.tick + Math.round(megaAlpha.introduceS * 60) : options.introduceTick,
      x: 0, z: 0, hp: megaAlpha.hp, maxHp: megaAlpha.hp, target: { x: player.x, z: player.z }, route: [], routeAt: -Infinity, passed: null,
      blocked: {}, breach: null, stuck: { level: 0, since: -1, sampleAt: world.tick, x: 0, z: 0, noPath: 0, goal: null }, lastDamage: null, coarseM: 0,
    };
    // Its slot is held from install, so the one introduction can never fail on a full cap.
    ai.director.reserved++; this.reservation = true;
    this.stops.push(world.events.on('sim.tick', () => this.tick(), SimPhase.ai - .05));
    this.stops.push(world.events.on('combat.hit', ev => {
      if (ev.type === 'combat.hit' && ev.targetId === this.state.id && ev.amount > 0) this.state.lastDamage = { tick: ev.tick, amount: ev.amount, sourceId: ev.sourceId };
    }));
    this.stops.push(world.events.on('player.respawned', () => this.keepGap()));
  }
  /** The live Mega entity (null before the introduction and after its body settled away). */
  entity(): EntitySnapshot | null { const e = this.state.id ? this.world.entities.get(this.state.id) : undefined; return e?.infected?.pursuit ? e : null; }
  alive(): boolean { const e = this.entity(); return !!e && (e.health.current > 0 || (e.infected!.recoverAt ?? -1) >= 0); }
  /** Planar distance to the player; Infinity before the introduction or after death. */
  distance(): number { const e = this.entity(), p = this.world.entities.get(1)!; return e && this.alive() ? dist(e.transform, p.transform) : Infinity; }
  /** E32 §5.5 bands for audio and the minimap ring; no bearing. */
  band(): PursuitBand | null { const d = this.distance(); return !Number.isFinite(d) ? null : d > megaAlpha.bands.distantM ? 'distant' : d >= megaAlpha.bands.nearM ? 'approaching' : 'near'; }
  /** Level scripting: an authored street closes (collapse, barricade); the route avoids it, or breaches it with no alternate. */
  blockLink(a: string, b: string): void { this.state.blocked[key(a, b)] = -1; this.state.routeAt = -Infinity; }
  unblockLink(a: string, b: string): void { delete this.state.blocked[key(a, b)]; this.state.routeAt = -Infinity; }

  /** Spawn the one Mega Alpha (idempotent: a second call returns the same entity id). */
  introduce(at?: { x: number; z: number }): number {
    if (this.state.id) return this.state.id;
    const ai = this.world.infected!, spot = at ?? this.options.spawn ?? this.behind();
    if (this.reservation) { ai.director.reserved = Math.max(0, ai.director.reserved - 1); this.reservation = false; }
    const resident = this.resident(spot.x, spot.z);
    const place = resident ? this.clearNear(spot) ?? spot : spot;
    const id = ai.spawn(megaAlpha.archetype, place, { state: 'chase', variant: megaAlpha.asset, offNav: !resident });
    const e = this.world.entities.get(id)!, b = e.infected!;
    b.pursuit = true; b.speed = megaAlpha.cruiseMs; e.combat!.radius = this.radius;
    e.health.current = e.health.max = megaAlpha.hp;
    const player = this.world.entities.get(1)!.transform;
    e.transform.yaw = -Math.atan2(player.z - place.z, player.x - place.x);
    Object.assign(this.state, { id, mode: resident ? 'detailed' : 'coarse', introducedAt: this.world.tick, x: place.x, z: place.z, hp: e.health.current, maxHp: e.health.max, routeAt: -Infinity });
    this.state.stuck = { level: 0, since: -1, sampleAt: this.world.tick, x: place.x, z: place.z, noPath: 0, goal: null };
    return id;
  }

  /** Per-tick bookkeeping before the AI phase: the introduction, death and the 2 Hz route refresh. */
  private tick(): void {
    const s = this.state, tick = this.world.tick;
    if (s.mode === 'dead') return;
    if (!s.id) { if (s.introduceTick !== null && tick >= s.introduceTick) this.introduce(); return; }
    const e = this.entity();
    if (!e) {
      // Removed without dying (a checkpoint captured before this pursuit was installed restored the world without it): it comes back.
      Object.assign(s, { id: 0, mode: 'dormant', introduceTick: tick, route: [], passed: null, breach: null });
      if (!this.reservation) { this.world.infected!.director.reserved++; this.reservation = true; }
      return;
    }
    if (e.health.current <= 0 && (e.infected!.recoverAt ?? -1) < 0) { s.mode = 'dead'; s.hp = 0; s.route.length = 0; return; }
    s.x = e.transform.x; s.z = e.transform.z; s.hp = e.health.current; s.maxHp = e.health.max;
    if (tick - s.routeAt >= megaAlpha.routeTicks) this.refresh();
  }

  /**
   * Called by InfectedSystem.update for the pursuit entity. True: this tick's movement is handled here. False: the shared Alpha
   * chase brain runs the entity this tick (close range, its special scheduler, or the breach level of the stuck recovery).
   */
  drive(e: EntitySnapshot): boolean {
    const s = this.state, b = e.infected!, tick = this.world.tick;
    const player = this.world.entities.get(1)!;
    // Never lured, never investigating a noise, never a civilian's pursuer: the player is the only target.
    delete e.noiseTarget; delete b.investigate; b.heardTargetId = 0; b.speed = megaAlpha.cruiseMs;
    if (b.specialAttack) { s.mode = 'close'; return false; }
    if (!this.resident(e.transform.x, e.transform.z)) { this.coarse(e); return true; }
    const d = dist(e.transform, player.transform), free = !Status.stunned(e, tick) && b.grabUntil <= tick && (b.specialRecoveryUntil ?? 0) <= tick && b.state !== 'attack' && !e.combat!.attacking;
    this.monitor(e, d, free);
    if (s.breach) { s.mode = 'breach'; e.combat!.attacking = false; this.world.spatial.set(e.id, e.transform.x, e.transform.z); return true; }
    if (s.stuck.level === 3 || (d <= megaAlpha.closeM && s.stuck.level < 2)) {
      s.mode = s.stuck.level === 3 ? 'recover' : 'close';
      if (b.state !== 'attack' && b.state !== 'stagger') b.state = 'chase';
      return false;
    }
    s.mode = s.stuck.level ? 'recover' : 'detailed';
    b.state = 'chase'; e.combat!.attacking = false;
    if (free) this.steer(e, d);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    return true;
  }

  /** 2 Hz: sample the player position and re-plan the authored node route towards it. */
  private refresh(): void {
    const s = this.state, player = this.world.entities.get(1)!.transform, tick = this.world.tick;
    s.target.x = player.x; s.target.z = player.z; s.routeAt = tick;
    for (const [link, until] of Object.entries(s.blocked)) if (until >= 0 && tick >= until) delete s.blocked[link];
    if (!this.nodes.size) { s.route.length = 0; return; }
    const goal = this.nearestNode(s.target), costs = this.costs(goal.id);
    // It stays on authored links: mid-leg it either finishes the leg or turns back to the node it passed (a straight line to any
    // other node would cut across buildings and blocked links); off the graph it joins at the nearest node.
    let best: PursuitNode | null = null, score = Infinity;
    const leg = s.passed && s.route.length && s.route[0] !== s.passed ? s.route[0] : null;
    const candidates = s.passed ? [s.passed, ...(leg ? [leg] : [])] : [this.nearestNode(s).id];
    for (const id of candidates) {
      const node = this.nodes.get(id)!, c = dist(s, node) + (costs.get(id) ?? Infinity) + (id === leg && key(s.passed!, leg) in s.blocked ? BLOCKED_COST : 0);
      if (c < score) { score = c; best = node; }
    }
    s.route.length = 0;
    // Past the goal node on the final leg: straight on to the player, never back to the node.
    if (s.passed === goal.id && (best as PursuitNode | null)?.id === goal.id) return;
    for (let node = (best as PursuitNode | null)?.id; node !== undefined; node = this.parent.get(node)) { s.route.push(node); if (node === goal.id) break; }
    // Standing on the node it passed: the next leg starts here (and may be a blocked link to breach).
    if (s.route.length > 1 && s.route[0] === s.passed && dist(s, this.nodes.get(s.passed)!) <= megaAlpha.nodeReachM) s.route.shift();
  }
  private readonly parent = new Map<string, string>();
  /** Dijkstra from the goal node over the authored graph (tens of nodes); blocked links cost a breach, never infinity. */
  private costs(goal: string): Map<string, number> {
    const cost = new Map<string, number>([[goal, 0]]), open = new Set([goal]); this.parent.clear();
    while (open.size) {
      let current = ''; let low = Infinity;
      for (const id of open) { const c = cost.get(id)!; if (c < low) { low = c; current = id; } }
      open.delete(current);
      const from = this.nodes.get(current)!;
      for (const next of this.adjacency.get(current)!) {
        const c = low + dist(from, this.nodes.get(next)!) + (key(current, next) in this.state.blocked ? BLOCKED_COST : 0);
        if (c < (cost.get(next) ?? Infinity)) { cost.set(next, c); this.parent.set(next, current); open.add(next); }
      }
    }
    return cost;
  }
  private nearestNode(p: { x: number; z: number }): PursuitNode {
    let best: PursuitNode | null = null, d = Infinity;
    for (const node of this.nodes.values()) { const nd = dist(p, node); if (nd < d) { d = nd; best = node; } }
    return best!;
  }
  /** The current leg (last node reached → next node) when it is a blocked link and the Mega stands at its start. */
  private legBlocked(at: { x: number; z: number } = this.state): string | null {
    const s = this.state;
    if (!s.passed || !s.route.length || s.route[0] === s.passed) return null;
    const link = key(s.passed, s.route[0]);
    return link in s.blocked && dist(at, this.nodes.get(s.passed)!) <= megaAlpha.nodeReachM ? link : null;
  }
  private pass(): void { this.state.passed = this.state.route.shift() ?? this.state.passed; }
  private breachStep(): boolean {
    const s = this.state, tick = this.world.tick;
    if (s.breach) {
      if (tick < s.breach.until) return true;
      delete s.blocked[s.breach.link]; s.breach = null; s.routeAt = -Infinity; return false;
    }
    const link = this.legBlocked();
    if (!link) return false;
    s.breach = { link, until: tick + Math.round(megaAlpha.breachS * 60) };
    return true;
  }
  /** Off-region: advance the same cruise speed × sim-time along the node route, in 2 Hz steps; no mesh, collider or nav. */
  private coarse(e: EntitySnapshot): void {
    const s = this.state, tick = this.world.tick;
    s.mode = 'coarse'; e.combat!.attacking = false; e.infected!.state = 'chase';
    s.stuck.sampleAt = tick; s.stuck.x = e.transform.x; s.stuck.z = e.transform.z; s.stuck.noPath = 0;
    if (s.breach || this.legBlocked()) { if (this.breachStep()) s.mode = 'breach'; return; }
    if ((tick - s.introducedAt) % megaAlpha.routeTicks !== 0) return;
    let budget = megaAlpha.cruiseMs * Status.speed(e) * megaAlpha.routeTicks / 60;
    const t = e.transform, startX = t.x, startZ = t.z;
    while (budget > 1e-6) {
      if (this.legBlocked(t)) break;
      const next = s.route.length ? this.nodes.get(s.route[0])! : s.target;
      const d = dist(t, next), stop = s.route.length ? 0 : this.radius + 1;
      if (d - stop <= budget) {
        const k = d > 1e-9 ? Math.max(0, d - stop) / d : 0; t.x += (next.x - t.x) * k; t.z += (next.z - t.z) * k; budget -= Math.max(0, d - stop);
        if (!s.route.length) break;
        this.pass();
      } else { t.x += (next.x - t.x) / d * budget; t.z += (next.z - t.z) / d * budget; budget = 0; }
    }
    const moved = Math.hypot(t.x - startX, t.z - startZ);
    if (moved > 1e-6) t.yaw = -Math.atan2(t.z - startZ, t.x - startX);
    s.coarseM += moved; s.x = t.x; s.z = t.z;
    t.y = .7 + (this.world.districts?.groundHeight(t.x, t.z) ?? 0);
    if (e.locomotion) e.locomotion.vx = e.locomotion.vz = 0;
    this.world.spatial.set(e.id, t.x, t.z);
  }
  /** Detailed steering on the shared nav grid at cruise speed. */
  private steer(e: EntitySnapshot, d: number): void {
    const s = this.state, t = e.transform, r = this.radius, nav = this.grid;
    // A body left inside a solid (a coarse handoff onto a freshly loaded block, a closing gate) first walks out at cruise.
    if (!nav.clear(t.x, t.z, r - .001)) { const out = this.clearNear(t, 12); if (out) this.walkTo(e, out, true); return; }
    while (s.route.length > 1 && dist(t, this.nodes.get(s.route[0])!) <= megaAlpha.nodeReachM) this.pass();
    if (this.breachStep()) { s.mode = 'breach'; return; }
    const node = s.route.length ? this.nodes.get(s.route[0])! : null;
    const goal = s.stuck.goal ?? (node && (d > megaAlpha.directM || s.stuck.level === 2) ? node : s.target);
    if (s.stuck.goal && dist(t, s.stuck.goal) < .6) s.stuck.goal = null;
    this.local.x = goal.x; this.local.z = goal.z;
    if (!nav.steer(t, this.local, this.path, r, this.waypoint, 20000)) { s.stuck.noPath++; return; }
    s.stuck.noPath = 0;
    this.walkTo(e, this.waypoint, false);
  }
  private walkTo(e: EntitySnapshot, to: { x: number; z: number }, direct: boolean): void {
    const t = e.transform, dx = to.x - t.x, dz = to.z - t.z, d = Math.hypot(dx, dz);
    if (d < .02) return;
    const speed = Math.min(megaAlpha.cruiseMs, d * 60);
    if (direct) { const step = Math.min(d, speed / 60); t.x += dx / d * step; t.z += dz / d * step; }
    else moveAgent(e, dx / d * speed, dz / d * speed, this.grid, this.world.tick, this.radius);
    t.y = .7 + (this.world.districts?.groundHeight(t.x, t.z) ?? 0);
  }
  /**
   * Progress monitor: less than `progressM` of travel over `windowS` (or no nav path for a second) while free to move escalates
   * 1 replan / walk out → 2 authored alternate (the current link is avoided) → 3 shared Alpha chase/breach brain → 1 again.
   */
  private monitor(e: EntitySnapshot, d: number, free: boolean): void {
    const s = this.state.stuck, tick = this.world.tick, t = e.transform, window = Math.round(megaAlpha.stuck.windowS * 60);
    if (!free || d <= 2.5 || this.state.breach) { s.sampleAt = tick; s.x = t.x; s.z = t.z; return; }
    if (s.noPath < 60 && tick - s.sampleAt < window) return;
    const moved = Math.hypot(t.x - s.x, t.z - s.z);
    if (moved < megaAlpha.stuck.progressM || s.noPath >= 60) this.escalate(e);
    else if (s.level && tick - s.since >= megaAlpha.stuck.clearS * 60) { s.level = 0; s.goal = null; }
    s.sampleAt = tick; s.x = t.x; s.z = t.z; s.noPath = 0;
  }
  private escalate(e: EntitySnapshot): void {
    const st = this.state, s = st.stuck, t = e.transform, nav = this.grid;
    s.level = s.level >= 3 ? 1 : s.level + 1; s.since = this.world.tick; s.goal = null;
    this.path.path.length = 0; this.path.goal = -1;
    if (s.level === 1) {
      // Walk out of a pocket narrower than the baked clearance (fence gap, porch alley), else simply re-plan.
      const cell = nav.escapeCell(t, this.radius, 6, false, 1.5);
      if (cell >= 0) s.goal = { x: nav.x(cell), z: nav.z(cell) };
    } else if (s.level === 2) {
      // Authored alternate: avoid the link it is on for a while and take the next-best route.
      if (st.route.length >= 2) st.blocked[key(st.route[0], st.route[1])] = this.world.tick + Math.round(megaAlpha.blockedLinkS * 60);
      else if (st.route.length === 1) { const prev = this.nearestOther(st.route[0]); if (prev) st.blocked[key(prev, st.route[0])] = this.world.tick + Math.round(megaAlpha.blockedLinkS * 60); }
      st.routeAt = -Infinity; this.refresh();
      if (!this.nodes.size) {
        const cell = nav.escapeCell(t, this.radius, 8, true, 3);
        if (cell >= 0) s.goal = { x: nav.x(cell), z: nav.z(cell) };
      }
    }
  }
  private nearestOther(id: string): string | null {
    let best: string | null = null, d = Infinity;
    for (const other of this.adjacency.get(id) ?? []) { const nd = dist(this.state, this.nodes.get(other)!); if (nd < d) { d = nd; best = other; } }
    return best;
  }
  /** Nearest nav-clear spot within `range` (rings, no line test: the body may stand inside a solid). */
  private clearNear(p: { x: number; z: number }, range = 6): { x: number; z: number } | null {
    const nav = this.grid, r = this.radius;
    if (nav.clear(p.x, p.z, r)) return { x: p.x, z: p.z };
    for (let d = .5; d <= range; d += .5) for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (nav.clear(x, z, r)) return { x, z };
    }
    return null;
  }
  /** Introduction point: the route node closest to `startBehindM` route-metres from the player's node; else straight behind her. */
  private behind(): { x: number; z: number } {
    const player = this.world.entities.get(1)!.transform, want = megaAlpha.startBehindM;
    if (this.nodes.size) {
      const costs = this.costs(this.nearestNode(player).id);
      let best: PursuitNode | null = null, score = Infinity;
      for (const node of this.nodes.values()) { const c = costs.get(node.id) ?? Infinity; if (c >= want && c - want < score) { score = c - want; best = node; } }
      if (best) return { x: best.x, z: best.z };
    }
    const yaw = player.yaw;
    return { x: player.x - Math.cos(yaw) * want, z: player.z + Math.sin(yaw) * want };
  }
  /** Respawn fairness: a restored Mega stands ≥ respawnGapM from the player (only at a checkpoint restore or respawn, never in play). */
  private keepGap(): void {
    const e = this.entity(); if (!e || !this.alive()) return;
    const player = this.world.entities.get(1)!.transform, gap = megaAlpha.respawnGapM;
    if (dist(e.transform, player) >= gap) return;
    let spot: { x: number; z: number } | null = null;
    if (this.nodes.size) {
      let best = Infinity;
      for (const node of this.nodes.values()) if (dist(node, player) >= gap && dist(node, e.transform) < best && (!this.resident(node.x, node.z) || this.grid.clear(node.x, node.z, this.radius))) { best = dist(node, e.transform); spot = node; }
    }
    if (!spot) {
      const d = dist(e.transform, player), dx = d > .1 ? (e.transform.x - player.x) / d : Math.cos(e.id), dz = d > .1 ? (e.transform.z - player.z) / d : Math.sin(e.id);
      for (let m = gap; m <= gap * 2 && !spot; m += 2) {
        const at = { x: player.x + dx * m, z: player.z + dz * m };
        spot = this.resident(at.x, at.z) ? this.clearNear(at, 4) : at;
      }
    }
    if (!spot) return;
    e.transform.x = spot.x; e.transform.z = spot.z; e.transform.y = .7 + (this.world.districts?.groundHeight(spot.x, spot.z) ?? 0);
    if (e.locomotion) e.locomotion.vx = e.locomotion.vz = 0;
    this.world.spatial.set(e.id, spot.x, spot.z);
    this.state.x = spot.x; this.state.z = spot.z; this.state.routeAt = -Infinity; this.path.path.length = 0; this.path.goal = -1;
  }

  /** Checkpoint seam (structured-cloneable). */
  snapshot(): MegaPursuitState { return structuredClone({ ...this.state, tick: this.world.tick }); }
  /**
   * After the entity restore of a checkpoint. Timers shift by the checkpoint delta; a Mega killed since the checkpoint stays dead
   * (E32: a legitimate early kill remains dead); a living one keeps ≥ respawnGapM from the restored player.
   */
  restore(saved: unknown): void {
    const s = structuredClone(saved as MegaPursuitState), delta = this.world.tick - s.tick, ai = this.world.infected!;
    const killed = this.state.mode === 'dead' && this.state.id !== 0, shift = (t: number) => t >= 0 && Number.isFinite(t) ? t + delta : t;
    s.introducedAt = shift(s.introducedAt); s.routeAt = -Infinity; if (s.introduceTick !== null) s.introduceTick = shift(s.introduceTick);
    for (const link of Object.keys(s.blocked)) s.blocked[link] = shift(s.blocked[link]);
    if (s.breach) s.breach.until = shift(s.breach.until);
    s.stuck = { level: 0, since: -1, sampleAt: this.world.tick, x: s.x, z: s.z, noPath: 0, goal: null };
    if (s.lastDamage) s.lastDamage.tick = shift(s.lastDamage.tick);
    s.tick = this.world.tick;
    // The cap reservation follows the restored phase: held while dormant, released once introduced.
    if (!s.id && !this.reservation) { ai.director.reserved++; this.reservation = true; }
    if (s.id && this.reservation) { ai.director.reserved = Math.max(0, ai.director.reserved - 1); this.reservation = false; }
    this.state = s; this.path.path.length = 0; this.path.goal = -1;
    const e = this.entity();
    if (killed && e) {
      e.health.current = 0; e.infected!.recoverAt = -1; e.infected!.state = 'dead'; e.infected!.deadAt = this.world.tick - 120;
      s.mode = 'dead'; s.hp = 0; return;
    }
    if (killed) { s.mode = 'dead'; s.hp = 0; return; }
    if (e) this.keepGap();
  }
  dispose(): void {
    this.stops.forEach(stop => stop()); this.stops.length = 0;
    if (this.reservation && this.world.infected) { this.world.infected.director.reserved = Math.max(0, this.world.infected.director.reserved - 1); this.reservation = false; }
  }
}

/** Attach the pursuit to a world with an infected system (one per level). */
export function installMegaPursuit(world: SimWorld, options: PursuitOptions = {}): MegaPursuit {
  if (!world.infected) throw new Error('Mega Alpha pursuit needs the infected system');
  world.megaPursuit?.dispose();
  world.megaPursuit = new MegaPursuit(world, options);
  return world.megaPursuit;
}
