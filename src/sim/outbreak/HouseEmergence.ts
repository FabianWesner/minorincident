import type { SimWorld } from '../world/SimWorld';
import type { DistrictLayout } from '../../levels/districts/types';
import { buildingDoors, doorwayOf } from '../../data/buildingDoors';
import type { PedestrianOptions } from './Outbreak';

/**
 * Residents coming out of a house's front door (L1 beat 9, PO rule 2026-10-07: "10 ... come out of the house ... No
 * random spawns"; PO P1 10-08: "a zombie spawning out of nowhere"). Each resident is placed inside the house behind
 * the door, the door swings open (SimWorld.openDoor; DistrictView draws the authored leaf open) and stays open, and the
 * resident stumbles out over the threshold, across the porch and down its steps to the path, where the normal infected
 * AI takes over. Nobody ever appears on the yard or the pavement. Shared by LevelOneOutbreak and Scene Lab (`emerge`),
 * so the lab scene runs the game's own emergence.
 */
export interface HouseDoor {
  /** Refuge-door number at this house's gate (the house is also a flee refuge), 0 when it has none. */
  door: number;
  /** The house placement id. */
  house: string;
  /** Threshold point: the middle of the door opening at floor level (x, z). */
  x: number; z: number;
  /** Outward unit normal of the door. */
  nx: number; nz: number;
  /** Porch floor along the walk out: [until metres past the threshold, floor height], ground (0) beyond the last. */
  floor: [number, number][];
  /** Walkable doorstep on the path in front of the porch steps. */
  sx: number; sz: number;
  /** Then on along the front path through the gate to these points (when the yard path is a dead end for the AI). */
  route: [number, number][];
  /** Where the AI takes over: the last route point, else the doorstep. */
  ox: number; oz: number;
}
export interface HouseEmergence extends HouseDoor {
  /** Tick of the next resident; `ids` the residents out (or on their way out) so far. */
  next: number; ids: number[];
  /** Walk-out pace (m/s), default `emergeSpeedMs` (a stumble); the lab staff burst out running. */
  speedMs?: number;
  /** Residents still on their scripted walk out of the door: release timeout tick, and the route leg (-1 = porch). */
  walking?: { id: number; until: number; leg: number; lane?: number }[];
}
export type LayoutDoor = Omit<HouseDoor, 'sx' | 'sz' | 'route' | 'ox' | 'oz'> & { depth: number; width: number; gate: { x: number; z: number } };
/** Scripted pace out of the door (a stumble, slower than the AI run), metres per second. */
export const emergeSpeedMs = 1.25;
/** Spawn depth behind the threshold: the resident is inside, out of sight, while the door swings (0.45 s). */
export const emergeInsideM = .9;

/**
 * Every door infected can come out of in a district layout (world metres; `origin` is the district origin): any placement
 * whose asset has `emerge` door data in src/data/buildingDoors.ts (today `bld.house-a` and `bld.clinic-annex`). `assets`
 * narrows the kinds (L1 beat 9 uses houses only).
 */
export function layoutHouseDoors(layout: DistrictLayout, origin: [number, number] = [0, 0], anchors?: Record<string, { x: number; z: number }>, assets?: (assetId: string) => boolean): LayoutDoor[] {
  const refuges = Object.entries(anchors ?? {}).filter(([k]) => k.startsWith('refuge-door-')).map(([k, a]) => ({ n: Number(k.slice(12)), x: a.x, z: a.z }));
  const out: LayoutDoor[] = [];
  for (const p of layout.placements) {
    const def = buildingDoors[p.assetId]; if (!def?.emerge || (assets && !assets(p.assetId))) continue;
    const way = doorwayOf(p, origin)!, n = way.out, scale = p.scale[0], depth = (def.apron - def.x) * scale;
    const sx = way.centre.x + n.x * depth, sz = way.centre.z + n.z * depth;
    // The refuge point sits on the pavement at this building's gate, on the line of the door path.
    const gate = refuges.filter(r => Math.hypot(r.x - sx, r.z - sz) < 8 && Math.abs((r.x - sx) * n.z - (r.z - sz) * n.x) < .5)
      .sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz))[0];
    const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
    out.push({ door: gate?.n ?? 0, house: p.id, x: r6(way.centre.x), z: r6(way.centre.z), nx: r6(n.x), nz: r6(n.z), floor: def.emerge.floor.map(([m, y]) => [m * scale, y]), depth, width: way.width,
      // Without the anchors (Scene Lab crops): layout.py puts the refuge point 1 m out from the door path point.
      gate: gate ? { x: gate.x, z: gate.z } : { x: r6(sx + n.x), z: r6(sz + n.z) } });
  }
  return out;
}

/**
 * The way out for the AI: the doorstep on the door path just in front of the porch steps, and, when the AI cannot
 * path from there to `goal` (fenced front yards are closed nav pockets; a kerb lamp can block the gate on the 4-way
 * grid), on through the gate to the nearest connected pavement point. Null when there is no way out.
 */
export function doorExit(world: SimWorld, door: LayoutDoor, goal: { x: number; z: number }): Pick<HouseDoor, 'sx' | 'sz' | 'route' | 'ox' | 'oz'> | null {
  const nav = world.infected?.nav; if (!nav) return null;
  const to = nav.nearestCell(goal.x, goal.z);
  // One-off searches when the house opens: a door 20 m from the goal needs more than a per-tick AI budget.
  const connected = (x: number, z: number) => { const cell = nav.nearestCell(x, z); return cell >= 0 && to >= 0 && nav.path(cell, to, [], 1_000_000); };
  let step: { x: number; z: number } | null = null;
  for (let d = door.depth; d <= door.depth + 1.2 && !step; d += .2) {
    const x = door.x + door.nx * d, z = door.z + door.nz * d;
    if (nav.clear(x, z, .3)) step = { x, z };
  }
  if (!step) return null;
  if (connected(step.x, step.z)) return { sx: step.x, sz: step.z, route: [], ox: step.x, oz: step.z };
  // Through the gate (the refuge point on the pavement), then the nearest connected clear point within 2.5 m of it.
  const route: [number, number][] = [[door.gate.x, door.gate.z]];
  let best: [number, number] | null = null, bestD = Infinity;
  for (let dz = -2.5; dz <= 2.5; dz += .25) for (let dx = -2.5; dx <= 2.5; dx += .25) {
    const x = door.gate.x + dx, z = door.gate.z + dz, d = Math.hypot(dx, dz);
    // Out on the street side of the gate only (never back into the yard).
    if (d >= bestD || (x - door.gate.x) * door.nx + (z - door.gate.z) * door.nz < -.1 || !nav.clear(x, z, .35) || !connected(x, z)) continue;
    best = [x, z]; bestD = d;
  }
  if (!best) return null;
  route.push(best);
  return { sx: step.x, sz: step.z, route, ox: best[0], oz: best[1] };
}

/** World id of a house door for SimWorld.openDoor / `gate.changed` (the refuge-door number, as before; else the house). */
export const doorId = (door: Pick<HouseDoor, 'door' | 'house'>) => door.door ? `door-${door.door}` : `door-${door.house}`;

/** Floor height `s` metres past the threshold (inside: the porch/hall floor), eased over 10 cm at each tread edge. */
export function floorAt(door: Pick<HouseDoor, 'floor'>, s: number): number {
  const f = door.floor; if (!f.length) return 0;
  let y = f[0][1];
  for (let i = 0; i < f.length; i++) {
    const next = i + 1 < f.length ? f[i + 1][1] : 0, edge = f[i][0];
    if (s >= edge + .05) y = next;
    else if (s > edge - .05) { y = f[i][1] + (next - f[i][1]) * (s - edge + .05) / .1; break; }
    else break;
  }
  return y;
}

/**
 * One resident steps out: spawned inside behind the threshold, turned (same pipeline as the technician), facing out,
 * AI held until the doorstep. The door opens with the first resident and stays open. Returns the entity id.
 */
export function emergeResident(world: SimWorld, house: HouseEmergence, tick: number, opts: { archetype?: string; look?: PedestrianOptions; inside?: number; lateral?: number; tier?: 'frail' | 'average' | 'athletic' } = {}): number {
  const outbreak = world.npcs?.civilians.outbreak; if (!outbreak) return 0;
  // Spawned on a clear nav cell (the spawn rule), then placed inside behind the door before anything is drawn.
  const nav = world.infected?.nav, cell = nav ? nav.nearestCell(house.ox, house.oz, .35) : -1;
  const at = nav && cell >= 0 ? { x: nav.x(cell), z: nav.z(cell) } : { x: house.ox, z: house.oz };
  const id = opts.archetype ? world.infected!.spawn(opts.archetype, at) : outbreak.spawnPedestrian(at, opts.look);
  const e = world.entities.get(id)!;
  if (!opts.archetype) outbreak.turnNow(e, opts.tier);
  place(world, house, e, -(opts.inside ?? emergeInsideM), opts.lateral ?? 0);
  e.transform.yaw = -Math.atan2(house.nz, house.nx);
  let walk = (opts.inside ?? emergeInsideM) + Math.hypot(house.sx - house.x, house.sz - house.z), from: [number, number] = [house.sx, house.sz];
  for (const p of house.route) { walk += Math.hypot(p[0] - from[0], p[1] - from[1]); from = p; }
  walk /= house.speedMs ?? emergeSpeedMs;
  const until = tick + Math.ceil(walk * 60) + 60;
  // Stunned = no AI at all (InfectedSystem.updateL1); `emerging` = no body separation (it would snap the body onto
  // the nearest nav cell and reset its height): the scripted walk owns the body until the doorstep.
  if (e.combat) e.combat.staggerUntil = tick + 2;
  e.emerging = true;
  world.solids.admit(e, 'house.emergence', 0, false);
  world.openDoor(doorId(house), { x: house.x, z: house.z, nx: house.nx, nz: house.nz }, tick);
  (house.walking ??= []).push({ id, until, leg: -1, ...(opts.lateral ? { lane: opts.lateral } : {}) });
  house.ids.push(id);
  return id;
}
/** On the door line `s` metres past the threshold (`lateral` metres to the side, + = right of the outward normal). */
function place(world: SimWorld, house: HouseDoor, e: { id: number; transform: { x: number; y: number; z: number } }, s: number, lateral = 0): void {
  const p = e.transform; p.x = house.x + house.nx * s - house.nz * lateral; p.z = house.z + house.nz * s + house.nx * lateral;
  p.y = .7 + Math.max(floorAt(house, s), world.districts?.groundHeight(p.x, p.z) ?? 0);
  world.spatial.set(e.id, p.x, p.z);
}

/**
 * Scripted walk out of the door, one tick: straight out along the door normal, over the threshold, across the porch and
 * down its treads to the doorstep, then along the route through the gate. Returns the ids that reached the end this
 * tick (the caller hands them to the AI).
 */
export function walkResidents(world: SimWorld, house: HouseEmergence, tick: number): number[] {
  const done: number[] = [], walking = house.walking ?? [], end = (house.sx - house.x) * house.nx + (house.sz - house.z) * house.nz, step = (house.speedMs ?? emergeSpeedMs) / 60;
  // Nobody steps into the doorway before the leaves have swung open (DistrictView: doorSwingS 0.4 s, eased; 27 ticks).
  const opened = world.openDoors.get(doorId(house)), swinging = !!opened && tick < opened.at + 27;
  for (let i = walking.length - 1; i >= 0; i--) {
    const w = walking[i], e = world.entities.get(w.id);
    if (!e?.infected || e.health.current <= 0) { if (e) e.emerging = undefined; walking.splice(i, 1); continue; }
    const p = e.transform;
    if (swinging) { if (e.combat) e.combat.staggerUntil = Math.max(e.combat.staggerUntil ?? 0, tick + 2); w.until++; continue; }
    if (w.leg < 0) {
      const s = Math.min(end, (p.x - house.x) * house.nx + (p.z - house.z) * house.nz + step), lane = w.lane ?? 0;
      // Through the door in its lane (a double door takes two abreast), then onto the path line by the doorstep.
      place(world, house, e, s, s <= 0 ? lane : lane * Math.max(0, 1 - s / Math.max(.5, end))); p.yaw = -Math.atan2(house.nz, house.nx);
      if (s >= end - 1e-6) w.leg = 0;
    } else if (w.leg < house.route.length) {
      const [tx, tz] = house.route[w.leg], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), m = Math.min(step, d);
      if (d > 1e-6) { p.x += dx / d * m; p.z += dz / d * m; p.yaw = -Math.atan2(dz, dx); }
      p.y = .7 + (world.districts?.groundHeight(p.x, p.z) ?? 0); world.spatial.set(e.id, p.x, p.z);
      if (d <= step) w.leg++;
    }
    if (e.combat) e.combat.staggerUntil = Math.max(e.combat.staggerUntil ?? 0, tick + 2);
    // Released at the end of the walk only, never inside the house (the AI would snap the body onto the nearest nav cell).
    const outside = (p.x - house.x) * house.nx + (p.z - house.z) * house.nz > 0;
    if (w.leg >= house.route.length || (outside && tick >= w.until)) { walking.splice(i, 1); e.emerging = undefined; if (e.combat) e.combat.staggerUntil = tick; done.push(w.id); }
  }
  return done;
}
