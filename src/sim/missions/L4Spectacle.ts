import { allyOnScreen } from '../outbreak/Allies';
import { Rng } from '../../core/Rng';
import { l4, l4FuelCrater, l4Edges, l4Emergence, l4Glass } from '../../data/l4';
import type { EntitySnapshot } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
import type { L4State } from './types';
import type { Point } from '../npc/types';

const ticks = (s: number) => Math.round(s * 60);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const CELL = 5;
/** Scripted actors (tank, helicopter, fuel truck) are plain rigid entities (`kind: 'setpiece'`, archetype = the manifest asset id); no combat component, never in the spatial hash. */
export function spawnSetPiece(world: SimWorld, asset: string, at: { x: number; z: number; y?: number; yaw?: number }): EntitySnapshot {
  const e = world.entities.create({ kind: 'setpiece', archetype: asset, faction: 'neutral', health: { current: 1000, max: 1000 }, transform: { x: at.x, y: at.y ?? .7, z: at.z, yaw: at.yaw ?? 0 } });
  world.solids.register(e); return e;
}

/**
 * E22 section 5.5 military spectacle: the tank (enters from the gate at turn + 45 s, fires a large explosion every 8-12 s at the densest
 * infected cluster at least 15 m from the player and every ally), the helicopter (orbits with door-gun bursts, withdraws at the line break,
 * never lands) and the fuel truck the tank sets off. Sim-light: deterministic scripted motion, targets chosen by the sim, every shot an event.
 */
export class L4Spectacle {
  private readonly rng: Rng;
  private path: { pts: Point[]; cum: number[]; length: number } | null = null;
  constructor(private readonly world: SimWorld, private readonly s: () => L4State, private readonly allies: () => EntitySnapshot[]) {
    this.rng = new Rng(world.seed, 'l4-spectacle');
  }
  private get ai() { return this.world.infected!; }
  private get player() { return this.world.entities.get(1)!; }

  // ---------------------------------------------------------------------------------------------------- clusters
  /** Densest infected cluster (>= `min` within one grid cell and its neighbours) that satisfies `ok`; the centre of mass of the cell. */
  cluster(min: number, ok: (p: Point) => boolean): { at: Point; count: number } | null {
    const cells = new Map<string, { x: number; z: number; n: number }[]>(), live: EntitySnapshot[] = [];
    for (const e of this.ai.active) if (e.health.current > 0 && !e.hidden && !e.infected?.hidden && !e.infectionRise) live.push(e);
    const key = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    for (const e of live) { const k = key(e.transform.x, e.transform.z); let c = cells.get(k); if (!c) cells.set(k, c = []); c.push({ x: e.transform.x, z: e.transform.z, n: 1 }); }
    let best: { at: Point; count: number } | null = null;
    for (const [k, list] of cells) {
      const [cx, cz] = k.split(',').map(Number);
      let n = 0, sx = 0, sz = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const p of cells.get(`${cx + dx},${cz + dz}`) ?? []) { n++; sx += p.x; sz += p.z; }
      if (n < min || (best && n <= best.count)) continue;
      const at = { x: sx / n, z: sz / n }; void list;
      if (ok(at)) best = { at, count: n };
    }
    return best;
  }
  private clearOfAllies(at: Point, metres: number): boolean {
    if (dist(at, this.player.transform) < metres) return false;
    // Bitten allies and humans hiding inside refuges still require blast clearance.
    const registered = [...this.s().soldierIds, ...this.s().armed.map(a => a.id)]
      .map(id => this.world.entities.get(id)).filter(a => a?.civilian && a.health.current > 0);
    return [...this.allies(), ...registered].every(a => dist(at, a!.transform) >= metres);
  }

  // ---------------------------------------------------------------------------------------------------- the tank
  private tankRoute() {
    if (!this.path) {
      const pts = l4.tank.path.map(([x, z]) => ({ x, z })), cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i], pts[i - 1]));
      this.path = { pts, cum, length: cum.at(-1)! };
    }
    return this.path;
  }
  startTank(): void {
    const s = this.s(), p = this.tankRoute().pts[0];
    const e = spawnSetPiece(this.world, 'veh.tank', { x: p.x, z: p.z, yaw: 0 });
    s.tankId = e.id; s.tankS = 0; s.tankPhase = 'enter';
  }
  private tankPose(at: number): { x: number; z: number; yaw: number } {
    const r = this.tankRoute(), d = Math.max(0, Math.min(r.length, at));
    let i = 1; while (i < r.pts.length - 1 && r.cum[i] < d) i++;
    const a = r.pts[i - 1], b = r.pts[i], f = (d - r.cum[i - 1]) / ((r.cum[i] - r.cum[i - 1]) || 1);
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, yaw: -Math.atan2(b.z - a.z, b.x - a.x) };
  }
  updateTank(): void {
    const s = this.s(), tank = this.world.entities.get(s.tankId); if (!tank || s.tankPhase === 'off' || s.tankPhase === 'gone' || s.tankPhase === 'silent') return;
    const tick = this.world.tick;
    if (s.tankPhase === 'enter') {
      s.tankS += l4.tank.speedMs / 60;
      const p = this.tankPose(s.tankS); Object.assign(tank.transform, { x: p.x, z: p.z, yaw: p.yaw });
      if (s.tankS >= this.tankRoute().length) { s.tankPhase = 'hold'; s.tankFireAt = tick + ticks(2); }
      return;
    }
    // Holding in the lake garden: turn the hull toward the next target, fire every 8-12 s.
    if (tick < s.tankFireAt) return;
    const clear = (p: Point) => this.clearOfAllies(p, l4.tank.minDistM);
    let target = this.cluster(3, clear) ?? this.cluster(1, clear);
    // l4 merge fix: once the horde is locked in melee with the lines (every infected within minDistM of an ally) no cluster is safe to shell.
    // After one missed second the tank shells the busiest street mouth outside the safety radius instead of idling for 10+ s.
    if (!target && this.dueMisses++ >= 1) target = this.streetBarrage(clear);
    if (!target) { s.tankFireAt = tick + ticks(1); return; }
    const want = -Math.atan2(target.at.z - tank.transform.z, target.at.x - tank.transform.x);
    const delta = Math.atan2(Math.sin(want - tank.transform.yaw), Math.cos(want - tank.transform.yaw));
    const step = l4.tank.turnRate / 60;
    if (Math.abs(delta) > step) { tank.transform.yaw += Math.sign(delta) * step; return; }
    this.fireTank(tank, target.at);
  }
  /** The street mouth (no building doors) that is clear of the courier and every ally and has the most infected within 25 m (ties: nearest to the courier). */
  private streetBarrage(clear: (p: Point) => boolean): { at: Point; count: number } | null {
    let best: { at: Point; count: number; d: number } | null = null;
    const live = this.ai.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && !e.infectionRise);
    for (const m of l4Emergence) {
      if (m.door) continue;
      const at = { x: m.at[0], z: m.at[1] };
      if (!clear(at)) continue;
      const count = live.filter(e => dist(e.transform, at) <= 25).length, d = dist(at, this.player.transform);
      if (!best || count > best.count || (count === best.count && d < best.d)) best = { at, count, d };
    }
    return best && { at: best.at, count: best.count };
  }
  private dueMisses = 0;
  fireTank(tank: EntitySnapshot, at: Point): void {
    this.dueMisses = 0;
    const s = this.s(), tick = this.world.tick, rng = this.rng;
    s.tankShots++;
    const muzzle = { x: tank.transform.x + Math.cos(-tank.transform.yaw) * 4.2, z: tank.transform.z + Math.sin(-tank.transform.yaw) * 4.2 };
    this.world.events.emit({ type: 'l4.tankFire', tick, from: muzzle, to: { ...at }, shot: s.tankShots });
    this.world.events.emit({ type: 'ally.attack', tick, sourceId: tank.id, targetId: 0, role: 'tank', weapon: 'door-gun', hit: true, from: muzzle, to: { ...at } });
    this.world.explosions?.blast(l4.tank.shellId, at, { sourceId: tank.id });
    const [a, b] = l4.tank.fireEveryS;
    s.tankFireAt = tick + ticks(a + rng.next() * (b - a));
    this.shatter(at, 18);
  }

  // ---------------------------------------------------------------------------------------------------- the helicopter
  startHeli(): void {
    const s = this.s(), h = l4.heli;
    const e = spawnSetPiece(this.world, 'veh.helicopter-military', { x: h.centre[0] + h.startR, z: h.centre[1], y: h.alt + .7 + 12, yaw: 0 });
    s.heliId = e.id; s.heliAngle = 0; s.heliPhase = 'arrive'; s.heliAt = this.world.tick; s.heliBurstAt = this.world.tick + ticks(3); s.heliBurst = 0;
  }
  updateHeli(): void {
    const s = this.s(), heli = this.world.entities.get(s.heliId); if (!heli || s.heliPhase === 'off' || s.heliPhase === 'gone') return;
    const h = l4.heli, tick = this.world.tick, t = (tick - s.heliAt) / 60;
    s.heliAngle += h.omega / 60;
    let r = h.orbitR, alt = h.alt;
    if (s.heliPhase === 'arrive') { const f = Math.min(1, t / h.arriveS); r = h.startR + (h.orbitR - h.startR) * f; alt = h.alt + 12 * (1 - f); if (f >= 1) { s.heliPhase = 'orbit'; s.heliAt = tick; } }
    else if (s.heliPhase === 'withdraw') { const f = Math.min(1, t / h.withdrawS); r = h.orbitR + (h.startR * 1.3 - h.orbitR) * f * f; alt = h.alt + 26 * f; if (f >= 1) { s.heliPhase = 'gone'; heli.hidden = true; this.world.events.emit({ type: 'l4.heliWithdrawn', tick }); return; } }
    const x = h.centre[0] + Math.cos(s.heliAngle) * r, z = h.centre[1] + Math.sin(s.heliAngle) * r;
    // Heading is the orbit tangent (counter-clockwise on the map); a tilted nose reads as banking in the camera.
    heli.transform.x = x; heli.transform.z = z; heli.transform.y = alt + .7;
    heli.transform.yaw = -Math.atan2(Math.cos(s.heliAngle), -Math.sin(s.heliAngle));
    if (s.heliPhase === 'orbit' || s.heliPhase === 'arrive') this.heliGun(heli);
  }
  private heliGun(heli: EntitySnapshot): void {
    const s = this.s(), h = l4.heli, tick = this.world.tick;
    if (tick < s.heliBurstAt) return;
    if (s.heliBurst === 0) {
      // A burst starts: pick the densest cluster that is not on top of an ally or the courier (door-gun fire is area fire).
      const bound = allyOnScreen(this.world, heli.transform), target = this.cluster(3, p => this.clearOfAllies(p, 6) && (!bound || this.world.infected!.director.inPlayerView(p)));
      if (!target) { s.heliBurstAt = tick + ticks(1); return; }
      s.heliBurst = h.burst.shots; s.heliTarget = { ...target.at };
      this.world.events.emit({ type: 'l4.heliPass', tick, from: { x: heli.transform.x, z: heli.transform.z }, to: { ...target.at } });
    }
    const at = s.heliTarget ?? { x: l4.map.centre.x, z: l4.map.centre.z };
    // PO 2026-10-13 / option 3: a door gun the player can see fires only at infected in view; away from the player it fights as before.
    const seen = allyOnScreen(this.world, heli.transform);
    const victims = this.ai.active.filter(e => e.health.current > 0 && !e.hidden && !e.infectionRise && dist(e.transform, at) <= 4.5 && (!seen || this.world.infected!.director.inPlayerView(e.transform)));
    const victim = victims.length ? victims[(s.heliShots + victims.length) % victims.length] : undefined;
    const from = { x: heli.transform.x, z: heli.transform.z }, to = victim ? { x: victim.transform.x, z: victim.transform.z } : at;
    const hit = !!victim && new Rng(this.world.seed, `heli-shot:${s.heliShots}`).next() < h.burst.hit;
    s.heliShots++;
    this.world.events.emit({ type: 'ally.attack', tick, sourceId: heli.id, targetId: victim?.id ?? 0, role: 'heli', weapon: 'door-gun', hit, from, to });
    if (hit && victim && this.world.combat) {
      const dx = victim.transform.x - from.x, dz = victim.transform.z - from.z, d = Math.hypot(dx, dz) || 1;
      this.world.combat.damage.apply({ attackId: 0, actionId: 'weapon.pistol', sourceId: heli.id, targetId: victim.id, origin: from, direction: { x: dx / d, z: dz / d }, base: h.burst.damage, multiplier: 1, type: 'bullet', knockback: 0, stagger: .25 });
    }
    s.heliBurst--;
    if (s.heliBurst === 0) { const [a, b] = h.burstEveryS; s.heliBurstAt = tick + ticks(a + this.rng.next() * (b - a)); }
    else s.heliBurstAt = tick + ticks(h.burst.shotS);
  }
  withdrawHeli(): void {
    const s = this.s(); if (s.heliPhase === 'off' || s.heliPhase === 'gone' || s.heliPhase === 'withdraw') return;
    s.heliPhase = 'withdraw'; s.heliAt = this.world.tick;
  }

  // ---------------------------------------------------------------------------------------------------- the fuel truck and live damage
  reserveFuelTruck(blocked = true): void {
    const f = l4.fuelTruck;
    this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: 900_450, blocked, wall: { x: f.x, y: 1, z: f.z, halfX: 2.5, halfY: 1, halfZ: 6.55 } });
  }
  spawnFuelTruck(): void {
    const s = this.s(), f = l4.fuelTruck;
    const e = spawnSetPiece(this.world, 'veh.fuel-truck', { x: f.x, z: f.z, yaw: f.yaw });
    s.fuelId = e.id;
    this.reserveFuelTruck();
  }
  /** The line break: the tank round hits the fuel truck; two seconds later the mega chain goes off and the shockwave shatters the glass around. */
  detonateFuelTruck(): void {
    const s = this.s(), tank = this.world.entities.get(s.tankId), f = l4.fuelTruck, tick = this.world.tick;
    const from = tank ? { x: tank.transform.x, z: tank.transform.z } : { x: f.x - 30, z: f.z + 20 };
    this.world.events.emit({ type: 'l4.tankFire', tick, from, to: { x: f.x, z: f.z }, shot: ++s.tankShots });
    this.world.events.emit({ type: 'ally.attack', tick, sourceId: tank?.id ?? 0, targetId: 0, role: 'tank', weapon: 'door-gun', hit: true, from, to: { x: f.x, z: f.z } });
    this.world.explosions?.blast(f.blast, { x: f.x, z: f.z }, { sourceId: s.fuelId });
    const truck = this.world.entities.get(s.fuelId);
    if (truck) { truck.hidden = true; const crater = spawnSetPiece(this.world, 'decay.fuel-truck-crater', { ...l4FuelCrater, y: .7 }); s.craterId = crater.id; }
    this.world.events.emit({ type: 'world.blocker.changed', tick, id: 900_450, blocked: false, wall: { x: f.x, y: 1, z: f.z, halfX: 1.6, halfY: 1, halfZ: 5.6 } });
    this.shatter({ x: f.x, z: f.z }, 48);
  }
  /** Shockwave glass: a broken-glass decal at every frontage within `radius` of a blast (once per frontage, at most 16). */
  shatter(at: Point, radius: number): void {
    const s = this.s();
    for (const [i, [x, z, yaw]] of l4Glass.entries()) {
      if (s.glass.includes(i) || dist({ x, z }, at) > radius) continue;
      s.glass.push(i);
      spawnSetPiece(this.world, 'decay.broken-glass', { x, z, y: .76, yaw });
    }
  }
  /** Fires on the plaza edge buildings and the streets: E27 fire hazards (flame cards, light, smoke column), they burn all level and kill infected. */
  fires(): void {
    const s = this.s(), spots: Point[] = [{ x: 7, z: -24 }, { x: -6, z: 31 }, { x: 17, z: 20 }, { x: -18, z: -30 }, { x: 30, z: -36 }, { x: 8, z: 42 }];
    for (const p of spots.slice(0, l4.collapse.fires)) { this.world.hazards?.spawn('fire', p, { radius: 1.3, duration: 3600 }); s.fires++; }
  }
  edgePoint(i: number): Point { const [x, z] = l4Edges[i].at; return { x, z }; }
}
