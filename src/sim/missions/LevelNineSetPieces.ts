import { crossing } from '../../levels/L9/district';
import { l9Course, l9SetPieces, l9SetPieceTuning as tune } from '../../data/l9';
import type { Point } from '../../levels/districts/types';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { ObstacleKind } from '../vehicles/Obstacles';
import { pursueCrossingVehicle } from './LevelNineEncounters';

/**
 * r32-l9fun (PO 2026-11-10 "some real fight action not just dumb zombies"): authored L9 set pieces on top of the
 * ambient groups. Leapers (L9 Alpha type) wait at the verge, crouch and pounce onto the APC (swerve, brake or shoot them
 * off); Throwers hurl barricades, bins and concrete blocks into the road ahead (dodge or smash); a roadblock horde to
 * plough through; dog/runner packs that close on the hull. The rail stall gets a leaper, a thrower and a mixed rush.
 * Deterministic: every decision reads the native world; state lives in the L9 mission snapshot.
 */
export interface L9ScriptedAlpha { id: number; role: 'leaper' | 'thrower'; piece: string; phase: 'wait' | 'windup' | 'air' | 'hull' | 'cool' | 'throw' | 'free'; at: number; post: { x: number; z: number }; uses: number; from?: { x: number; z: number }; to?: { x: number; z: number }; nextStrike?: number }
export interface L9Flight { obstacleId: number; from: { x: number; z: number }; to: { x: number; z: number }; started: number; land: number; sourceId: number }
export interface L9SetPieceState { fired: string[]; alphas: L9ScriptedAlpha[]; flights: L9Flight[]; packs: number[]; stall?: { leaper: boolean; thrower: boolean; rush: boolean } }
export const emptySetPieces = (): L9SetPieceState => ({ fired: [], alphas: [], flights: [], packs: [] });

type Lane = { x: number; z: number; dx: number; dz: number };
const lineDistance = (p: { x: number; z: number }, points: Point[]): number => {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(p.x - ax - dx * t, p.z - az - dz * t));
  }
  return best;
};

export class LevelNineSetPieces {
  constructor(private readonly w: SimWorld, private readonly carId: () => number, private readonly route: () => string | null, private readonly signal: (name: string, actorId?: number) => void) {}
  private get car() { return this.w.vehicles!.cars.get(this.carId())!; }

  /** Point `m` metres ahead along the lane the APC is driving (nearest route or detour polyline), keeping its lateral offset (clamped). */
  lane(m: number, lateral = 0): Lane | null {
    const p = this.car.entity.transform, route = this.route();
    let best: { line: Point[]; seg: number; t: number; d: number; side: number } | null = null;
    for (const r of crossing.routes) {
      if (route && r.id !== route) continue;
      for (const line of [r.points, r.detour]) for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (len * len)));
        const qx = a[0] + dx * t, qz = a[1] + dz * t, d = Math.hypot(p.x - qx, p.z - qz);
        if (!best || d < best.d) best = { line, seg: i, t, d, side: ((p.x - a[0]) * -dz + (p.z - a[1]) * dx) / len };
      }
    }
    if (!best || best.d > 30) return null;
    let { seg, t } = best, left = m;
    const line = best.line;
    for (; seg < line.length - 1; seg++, t = 0) {
      const a = line[seg], b = line[seg + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), rest = len * (1 - t);
      if (left <= rest || seg === line.length - 2) {
        const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, along = len * t + Math.min(left, rest), off = Math.max(-5, Math.min(5, best.side)) + lateral;
        return { x: a[0] + dx * along - dz * off, z: a[1] + dz * along + dx * off, dx, dz };
      }
      left -= rest;
    }
    return null;
  }
  /** Admission like the authored groups: resident chunk, director-safe cell, pool/cap, never inside the driving frame. */
  private spawn(archetype: string, at: { x: number; z: number }, opts: { alphaType?: 'leaper' | 'thrower'; minM?: number } = {}): number {
    const ai = this.w.infected!, p = this.car.entity.transform;
    if (ai.director.count + 1 > ai.director.cap || !ai.pool.length) return 0;
    for (let d = 0; d <= 4; d += .5) for (let i = 0; i < (d ? 12 : 1); i++) {
      const x = at.x + Math.cos(i * Math.PI / 6) * d, z = at.z + Math.sin(i * Math.PI / 6) * d;
      if (Math.hypot(x - p.x, z - p.z) < (opts.minM ?? 105) || !this.w.chunks?.resident(x, z) || !ai.director.safe(archetype, { x, z })) continue;
      return ai.spawn(archetype, { x, z }, { state: 'chase', yaw: Math.atan2(p.z - z, p.x - x), ...(opts.alphaType ? { alphaType: opts.alphaType } : {}) });
    }
    return 0;
  }
  update(s: L9SetPieceState, stallAt: number | null, holding: boolean): void {
    const w = this.w, car = this.car, p = car.entity.transform;
    for (const piece of l9SetPieces) {
      if (s.fired.includes(piece.id) || p.x < (piece.atXByRoute?.[this.route() ?? ''] ?? piece.atX) || holding) continue;
      // A fast battering-ram pass can reach a trigger before its forward chunk is resident. Keep it pending and retry
      // next tick; recording a failed stage as fired silently removed the thrower from the approach.
      if (this.stage(s, piece.kind, piece.id)) { s.fired.push(piece.id); this.signal(`setpiece.${piece.id}`); }
    }
    if (stallAt !== null) this.stall(s, stallAt);
    if (w.tick % 10 === 0) for (const id of s.packs) pursueCrossingVehicle(w, id);
    this.flights(s);
    for (const a of s.alphas) this.alpha(s, a);
    s.alphas = s.alphas.filter(a => a.phase !== 'free' || a.at > w.tick - 600);
  }
  private stage(s: L9SetPieceState, kind: string, piece: string): boolean {
    const ahead = this.lane(tune.aheadM);
    if (!ahead) return false;
    const side = (lane: Lane, off: number) => ({ x: lane.x - lane.dz * off, z: lane.z + lane.dx * off });
    if (kind === 'chase-pack') {
      const ids = tune.pack.types.map((type, i) => this.spawn(type, side(this.lane(tune.aheadM + Math.floor(i / 2) * 3) ?? ahead, (i % 2 ? 1 : -1) * tune.pack.sideM))).filter(Boolean);
      for (const id of ids) { this.w.infected!.pursueTarget(id, 1); pursueCrossingVehicle(this.w, id); }
      s.packs.push(...ids); return ids.length > 0;
    }
    if (kind === 'leapers') {
      let n = 0;
      for (let i = 0; i < tune.leaper.count; i++) {
        const lane = this.lane(tune.aheadM + i * 14) ?? ahead, post = side(lane, (i % 2 ? 1 : -1) * tune.leaper.sideM), id = this.spawn('infected.alpha', post, { alphaType: 'leaper' });
        if (id) { n++; this.hold(id, post); s.alphas.push({ id, role: 'leaper', piece, phase: 'wait', at: this.w.tick, post: this.at(id), uses: 0 }); }
      }
      return n > 0;
    }
    if (kind === 'thrower') {
      const post = side(ahead, (piece.endsWith('1') ? 1 : -1) * tune.thrower.sideM), id = this.spawn('infected.alpha', post, { alphaType: 'thrower' });
      if (id) { this.hold(id, post); s.alphas.push({ id, role: 'thrower', piece, phase: 'wait', at: this.w.tick, post: this.at(id), uses: 0 }); }
      return !!id;
    }
    if (kind === 'stall-ambush') {
      // Staged where this lane crosses the railway, i.e. where the engine stalls; both wait at their posts.
      let rail: Lane | null = null;
      for (let m = 60; m <= 260 && !rail; m += 4) { const at = this.lane(m); if (at && at.x >= l9Course.railX - 3) rail = at; }
      if (!rail) return false;
      let n = 0;
      for (const [role, off] of [['leaper', tune.stall.ambushLeaperSideM], ['thrower', -tune.stall.ambushThrowerSideM]] as const) {
        const post = side(rail, off), id = this.spawn('infected.alpha', post, { alphaType: role });
        if (id) { n++; this.hold(id, post); s.alphas.push({ id, role, piece, phase: 'wait', at: this.w.tick, post: this.at(id), uses: 0 }); }
      }
      return n > 0;
    }
    if (kind === 'smash') {
      let n = 0;
      for (const [i, off] of tune.smash.slots.entries()) {
        const at = side(this.lane(tune.aheadM + (i % 3) * 1.6) ?? ahead, off);
        if (this.w.infected!.nav.clear(at.x, at.z, .6) && this.w.solids.clear({ x: at.x, y: .7, z: at.z }, .6)) { this.w.vehicles!.obstacles.spawn(tune.smash.items[i % tune.smash.items.length], at); n++; }
      }
      return n > 0;
    }
    if (kind === 'roadblock') {
      let n = 0;
      for (const off of tune.roadblock.slots) {
        const at = side(ahead, off);
        if (this.w.infected!.nav.clear(at.x, at.z, .6) && this.w.solids.clear({ x: at.x, y: .7, z: at.z }, .6)) { this.w.vehicles!.obstacles.spawn('barricade', at); n++; }
      }
      const behind = this.lane(tune.aheadM + 5) ?? ahead;
      for (const [i, type] of tune.roadblock.horde.entries()) {
        const id = this.spawn(type, side(this.lane(tune.aheadM + 3 + (i % 3) * 2.5) ?? behind, (i % 5 - 2) * 2.2));
        if (id) { this.w.infected!.pursueTarget(id, 1); pursueCrossingVehicle(this.w, id); s.packs.push(id); n++; }
      }
      return n > 0;
    }
    return false;
  }
  /** The rail stall's hatch defence: a leaper, a thrower and a late mixed rush arrive from beyond the frame. */
  private stall(s: L9SetPieceState, stallAt: number): void {
    const w = this.w, p = this.car.entity.transform, st = s.stall ??= { leaper: false, thrower: false, rush: false };
    const ring = (angle: number, m: number) => ({ x: p.x + Math.cos(angle) * m, z: p.z + Math.sin(angle) * m });
    if (!st.rush && w.tick - stallAt >= tune.stall.rushAtTicks) {
      let n = 0;
      for (const [i, type] of tune.stall.rush.entries()) {
        const at = ring(Math.PI * (.75 + i * .1), 106), id = this.spawn(type, at);
        if (id) { this.w.infected!.pursueTarget(id, 1); pursueCrossingVehicle(w, id); s.packs.push(id); n++; }
      }
      st.rush = true; if (n) this.signal('setpiece.stall-rush');
    }
  }
  private at(id: number) { const t = this.w.entities.get(id)!.transform; return { x: t.x, z: t.z }; }
  private hold(id: number, post: { x: number; z: number }): void { const b = this.w.entities.get(id)?.infected; if (b) { b.scripted = { ...post }; b.state = 'chase'; } }
  private freeze(e: EntitySnapshot, on: boolean): void {
    if (on) { e.infected!.thrownBy = e.id; delete e.infected!.scripted; }
    else { delete e.infected!.thrownBy; delete e.infected!.specialAttack; }
  }
  private pose(e: EntitySnapshot, move: 'alpha.pounce' | 'alpha.grab-throw', stage: 'telegraph' | 'active', start: number, active: number, target: { x: number; z: number }): void {
    const dx = target.x - e.transform.x, dz = target.z - e.transform.z, d = Math.hypot(dx, dz) || 1;
    const area = { x: e.transform.x, z: e.transform.z, radius: move === 'alpha.pounce' ? 1 : 1.4, dx: dx / d, dz: dz / d };
    e.infected!.specialAttack = { move, attackId: e.id * 16 + (start % 16), stage, startTick: start, activeTick: active, cooldownExpiry: active, recoveryUntil: active + 30, target: { id: this.carId(), ...target }, area, hitIds: [] };
    e.transform.yaw = -Math.atan2(dz, dx);
    if (stage === 'telegraph') this.w.events.emit({ type: 'telegraph', tick: this.w.tick, sourceId: e.id, attackId: e.infected!.specialAttack.attackId, special: move, move, duration: (active - start) / 60, startTick: start, activeTick: active, cooldownExpiry: active, target: { id: this.carId(), ...target }, area });
  }
  /** Where the APC hull will be after `ticks` at its current velocity. */
  private predict(ticks: number): { x: number; z: number } {
    const v = this.car.physics.body.linvel(), p = this.car.entity.transform;
    return { x: p.x + v.x * ticks / 60, z: p.z + v.z * ticks / 60 };
  }
  private hullHit(amount: number, sourceId: number): void {
    const car = this.car, before = car.entity.health.current;
    this.w.vehicles!.damage(car.entity.id, amount);
    this.w.events.emit({ type: 'vehicle.durability-hit', tick: this.w.tick, sourceId: car.entity.id, targetId: sourceId, source: 'attack', contactId: null, attackId: null, before, after: car.entity.health.current });
  }
  private alpha(s: L9SetPieceState, a: L9ScriptedAlpha): void {
    const w = this.w, e = w.entities.get(a.id), car = this.car, tick = w.tick;
    if (!e?.infected || e.health.current <= 0) { if (e?.infected) this.freeze(e, false); if (a.phase !== 'free') { a.phase = 'free'; a.at = tick; } return; }
    const p = car.entity.transform, hull = car.physics.hullDistance(e.transform.x, e.transform.z);
    // Ahead or alongside: positive when the Alpha is in front of the APC's nose along its heading.
    const along = (e.transform.x - p.x) * Math.cos(p.yaw) - (e.transform.z - p.z) * Math.sin(p.yaw);
    if (a.role === 'leaper') {
      const L = tune.leaper;
      if (a.phase === 'wait' && tick % 10 === 0) this.hold(a.id, a.post);
      if ((a.phase === 'wait' || a.phase === 'cool' && tick >= a.at) && a.uses < L.uses && e.attachedTo === undefined && !e.infected.specialAttack
        && hull < L.rangeM && hull > 2 && (along > -4 || car.physics.speed < 2) && w.combat!.query.visible(e.transform, p)) {
        const target = this.predict(L.windupTicks + L.flightTicks);
        this.freeze(e, true); this.pose(e, 'alpha.pounce', 'telegraph', tick, tick + L.windupTicks, target);
        a.phase = 'windup'; a.at = tick + L.windupTicks; a.to = target; a.uses++;
        this.signal('leaper-crouch', a.id); return;
      }
      if (a.phase === 'windup' && tick >= a.at) {
        a.from = { x: e.transform.x, z: e.transform.z }; a.phase = 'air'; a.at = tick + L.flightTicks;
        this.pose(e, 'alpha.pounce', 'active', tick - L.windupTicks, tick, a.to!); this.signal('leaper-pounce', a.id);
      }
      if (a.phase === 'air') {
        const t = 1 - Math.max(0, a.at - tick) / L.flightTicks, from = a.from!, to = a.to!;
        w.solids.wrote(e, 'l9.leaper-flight');
        Object.assign(e.transform, { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t, y: .7 + (1.3 * t) + 4 * 2.2 * t * (1 - t) });
        w.spatial.set(e.id, e.transform.x, e.transform.z);
        if (tick < a.at) return;
        this.freeze(e, false);
        const vehicle = car.entity.vehicle!;
        if (car.physics.hullDistance(e.transform.x, e.transform.z) <= 1.4 && vehicle.attached.length < 8 && this.w.vehicles!.active === car.entity.id && tick >= (vehicle.nextBoardAt ?? 0)) {
          const c = Math.cos(p.yaw), sn = Math.sin(p.yaw), side = (e.transform.x - p.x) * sn + (e.transform.z - p.z) * c >= 0 ? 1 : -1;
          // Clinging at the side rail, as the hull's boarder slots pose it; left at the landing point (inside the hull) a
          // shake-off on the next tick dropped it under the APC and the ram killed it outright.
          const along = -car.physics.def.length * .25 + Math.floor(vehicle.attached.length / 2) * .65, reach = car.physics.def.width / 2 + .12;
          Object.assign(e.transform, { x: p.x + c * along + sn * side * reach, z: p.z - sn * along + c * side * reach, y: p.y + .8 });
          w.spatial.set(e.id, e.transform.x, e.transform.z);
          vehicle.attached.push(e.id); e.attachedTo = car.entity.id; if (vehicle.boardSpacing) vehicle.nextBoardAt = tick + vehicle.boardSpacing;
          (vehicle.apcBoarders ??= {})[e.id] = { startedAt: tick - 180, nextHit: tick + 60, side };
          w.events.emit({ type: 'vehicle.grabbed', tick, sourceId: car.entity.id, targetId: e.id });
          this.hullHit(20, e.id); a.phase = 'hull'; a.nextStrike = tick + L.strikeTicks; this.signal('leaper-landed', a.id);
        } else {
          e.transform.y = (w.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0) + .7;
          w.solids.admit(e, 'l9.leaper-landing', 3);
          w.combat?.damage.apply({ attackId: tick, actionId: 'l9.leaper-miss', sourceId: car.entity.id, targetId: e.id, origin: e.transform, direction: { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) }, base: 0, multiplier: 1, type: 'vehicle', knockback: .4, stagger: 1, knockdownTicks: 60 });
          a.phase = 'cool'; a.at = tick + L.cooldownTicks; w.infected!.pursueTarget(e.id, 1); pursueCrossingVehicle(w, e.id); this.signal('leaper-missed', a.id);
        }
        return;
      }
      if (a.phase === 'hull') {
        if (e.attachedTo !== car.entity.id) { a.phase = 'cool'; a.at = tick + L.cooldownTicks; pursueCrossingVehicle(w, e.id); this.signal('leaper-shaken', a.id); return; }
        if (tick >= (a.nextStrike ?? 0)) { this.hullHit(L.hullDamage, e.id); a.nextStrike = tick + L.strikeTicks; }
      }
      if (a.phase === 'cool' && tick % 10 === 0) pursueCrossingVehicle(w, e.id);
      return;
    }
    // Thrower.
    const T = tune.thrower;
    if (a.phase === 'wait' && tick % 10 === 0) this.hold(a.id, a.post);
    const passed = along < -10 && hull >= T.startM && !a.piece.startsWith('stall');
    if ((a.phase === 'wait' || a.phase === 'cool') && (a.uses >= T.throws || passed && a.uses > 0)) { a.phase = 'free'; a.at = tick; this.freeze(e, false); delete e.infected.scripted; w.infected!.pursueTarget(e.id, 1); pursueCrossingVehicle(w, e.id); return; }
    // The rail ambush thrower saves its load for the stalled hull (the hatch fight), not the approach.
    const ready = (a.phase === 'wait' && (hull < T.startM || passed && a.uses === 0) || a.phase === 'cool' && tick >= a.at) && (!a.piece.startsWith('stall') || car.physics.speed < 1.5);
    if (ready && hull > T.stopM && e.attachedTo === undefined && !e.infected.specialAttack && (passed && a.uses === 0 || w.combat!.query.visible(e.transform, p))) {
      const target = this.throwTarget(T.windupTicks + T.flightTicks, a.uses);
      this.freeze(e, true); this.pose(e, 'alpha.grab-throw', 'telegraph', tick, tick + T.windupTicks, target);
      a.phase = 'throw'; a.at = tick + T.windupTicks; a.to = target; this.signal('thrower-windup', a.id); return;
    }
    if (a.phase === 'throw' && tick >= a.at) {
      // Re-aim at release: the landing marker shown at the windup start stays honest within a lane width.
      const to = this.throwTarget(T.flightTicks, a.uses), item = T.items[a.uses % T.items.length] as ObstacleKind, kind: ObstacleKind = item === 'jersey-barrier' && car.physics.speed < T.heavyMinSpeed ? 'trash-can' : item, from = { x: e.transform.x, z: e.transform.z };
      const id = this.w.vehicles!.obstacles.spawn(kind, to);
      this.w.vehicles!.obstacles.launch(id, true);
      const o = w.entities.get(id)!; Object.assign(o.transform, { x: from.x, z: from.z, y: 2.4 });
      s.flights.push({ obstacleId: id, from, to, started: tick, land: tick + T.flightTicks, sourceId: a.id });
      this.pose(e, 'alpha.grab-throw', 'active', tick - T.windupTicks, tick, to);
      w.events.emit({ type: 'infected.prop-thrown', tick, sourceId: a.id, propId: id, attackId: e.infected.specialAttack!.attackId });
      a.uses++; a.phase = 'cool'; a.at = tick + T.intervalTicks; this.signal('thrower-throw', a.id);
      return;
    }
    if (a.phase === 'cool' && tick >= a.at - T.intervalTicks + 30 && e.infected.thrownBy !== undefined) { this.freeze(e, false); this.hold(a.id, a.post); }
  }
  /** A point on the APC's lane, a little ahead of where the hull will be: the driver dodges or smashes it. Stopped hull: aim at the hull. */
  private throwTarget(ticks: number, uses = 0): { x: number; z: number } {
    const car = this.car, p = car.entity.transform, at = this.predict(ticks);
    if (car.physics.speed < 2) { const [a, l] = tune.thrower.stoppedOffsetsM[uses % tune.thrower.stoppedOffsetsM.length]; return { x: p.x + Math.cos(p.yaw) * a + Math.sin(p.yaw) * l, z: p.z - Math.sin(p.yaw) * a + Math.cos(p.yaw) * l }; }
    // A fast turn can put the constant-velocity prediction far off the road. Keep thrown props on the authored route,
    // preserving the same forward lead while using its lane tangent for the short flight.
    const route = crossing.routes.find(r => r.id === this.route());
    const onDetour = route && lineDistance(p, route.detour) + 4 < lineDistance(p, route.points);
    const along = Math.hypot(at.x - p.x, at.z - p.z), lateral = onDetour ? (uses % 2 === 0 ? 1 : -1) * 10 : 0;
    const target = this.lane(along + tune.thrower.leadM, lateral);
    if (target) return { x: target.x, z: target.z };
    return { x: at.x + Math.cos(p.yaw) * tune.thrower.leadM, z: at.z - Math.sin(p.yaw) * tune.thrower.leadM };
  }
  private flights(s: L9SetPieceState): void {
    const w = this.w, car = this.car, tick = w.tick;
    for (let i = s.flights.length - 1; i >= 0; i--) {
      const f = s.flights[i], o = w.entities.get(f.obstacleId);
      if (!o) { s.flights.splice(i, 1); continue; }
      const t = Math.min(1, (tick - f.started) / Math.max(1, f.land - f.started));
      Object.assign(o.transform, { x: f.from.x + (f.to.x - f.from.x) * t, z: f.from.z + (f.to.z - f.from.z) * t, y: .5 + 1.9 * (1 - t) + 4 * 3 * t * (1 - t), yaw: t < 1 ? t * 9 : 0 });
      if (t < 1) continue;
      s.flights.splice(i, 1);
      Object.assign(o.transform, { x: f.to.x, z: f.to.z, y: .5, yaw: 0 });
      this.w.vehicles!.obstacles.launch(f.obstacleId, false);
      w.events.emit({ type: 'vfx.effect', tick, kind: 'smoke', position: { x: f.to.x, y: 0, z: f.to.z }, radius: 1.6 });
      if (car.physics.hullDistance(f.to.x, f.to.z) <= 1.2) {
        this.hullHit(tune.thrower.hullDamage, f.sourceId); this.signal('thrower-hull-hit', f.sourceId);
        this.w.vehicles!.obstacles.smash(f.obstacleId, car.physics.body.linvel(), tick);
      } else this.signal('thrower-landed', f.sourceId);
    }
  }
  restore(s: L9SetPieceState, delta: number): void {
    for (const a of s.alphas) { a.at += delta; if (a.nextStrike !== undefined) a.nextStrike += delta; }
    // In-flight objects land at once on a restore (the obstacle colliders are rebuilt landed).
    for (const f of s.flights) { const o = this.w.entities.get(f.obstacleId); if (o) Object.assign(o.transform, { x: f.to.x, z: f.to.z, y: .5, yaw: 0 }); }
    s.flights.length = 0;
  }
}
