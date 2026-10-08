import type { SimWorld } from '../world/SimWorld';
import type { DistrictLayout } from '../../levels/districts/types';

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
  /** Residents still on their scripted walk out of the door: release timeout tick, and the route leg (-1 = porch). */
  walking?: { id: number; until: number; leg: number }[];
}
type DoorSpec = { x: number; z: number; depth: number; floor: [number, number][] };

/**
 * Front doors residents can come out of, in house-local metres (models face +X at yaw 0). `x, z` is the door path point
 * of layouts/D-GROVE/layout.py `HOUSE` (the gate path and the refuge point are placed from it), `depth` how far the
 * door leaf sits behind it, and `floor` the porch deck and stair treads from the threshold out. Measured from
 * assets/bld.house-a/build.py (door pivot x 2.085 before the -0.68 GLB recentre; plank deck top 0.54 m to x 3.68; treads
 * 0.36 m to 3.94 and 0.20 m to 4.20). House kinds without measured door geometry are not used: house-b has a side
 * entry, house-c's street side is its deck and back windows.
 */
const houseDoors: Record<string, (scale: number) => DoorSpec | null> = {
  'bld.house-a': () => ({ x: 4.1, z: -1.6, depth: 2.69, floor: [[1.59, .54], [1.85, .36], [2.11, .2]] }),
};
/** Scripted pace out of the door (a stumble, slower than the AI run), metres per second. */
export const emergeSpeedMs = 1.25;
/** Spawn depth behind the threshold: the resident is inside, out of sight, while the door swings (0.45 s). */
export const emergeInsideM = .9;

/** Local (x, z) to world offset, same convention as layout.py `rot` (three.js rotation.y). */
const rot = (yaw: number, x: number, z: number) => ({ x: x * Math.cos(yaw) + z * Math.sin(yaw), z: -x * Math.sin(yaw) + z * Math.cos(yaw) });

/** Every usable house front door of a district layout (world metres; `origin` is the district origin). */
export type LayoutDoor = Omit<HouseDoor, 'sx' | 'sz' | 'route' | 'ox' | 'oz'> & { depth: number; gate: { x: number; z: number } };
export function layoutHouseDoors(layout: DistrictLayout, origin: [number, number] = [0, 0], anchors?: Record<string, { x: number; z: number }>): LayoutDoor[] {
  const refuges = Object.entries(anchors ?? {}).filter(([k]) => k.startsWith('refuge-door-')).map(([k, a]) => ({ n: Number(k.slice(12)), x: a.x, z: a.z }));
  const out: LayoutDoor[] = [];
  for (const p of layout.placements) {
    const t = houseDoors[p.assetId]?.(p.scale[0]); if (!t) continue;
    const yaw = p.yaw ?? 0, path = rot(yaw, t.x, t.z), n = rot(yaw, 1, 0);
    const sx = p.position[0] + origin[0] + path.x, sz = p.position[2] + origin[1] + path.z;
    // The refuge point sits on the pavement at this house's gate, on the line of the door path.
    const gate = refuges.filter(r => Math.hypot(r.x - sx, r.z - sz) < 8 && Math.abs((r.x - sx) * n.z - (r.z - sz) * n.x) < .5)
      .sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz))[0];
    const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
    out.push({ door: gate?.n ?? 0, house: p.id, x: r6(sx - n.x * t.depth), z: r6(sz - n.z * t.depth), nx: r6(n.x), nz: r6(n.z), floor: t.floor.map(([s, y]) => [s, y]), depth: t.depth,
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
export function emergeResident(world: SimWorld, house: HouseEmergence, tick: number): number {
  const outbreak = world.npcs?.civilians.outbreak; if (!outbreak) return 0;
  const id = outbreak.spawnPedestrian({ x: house.ox, z: house.oz });
  const e = world.entities.get(id)!;
  outbreak.turnNow(e);
  place(world, house, e, -emergeInsideM);
  e.transform.yaw = -Math.atan2(house.nz, house.nx);
  let walk = emergeInsideM + Math.hypot(house.sx - house.x, house.sz - house.z), from: [number, number] = [house.sx, house.sz];
  for (const p of house.route) { walk += Math.hypot(p[0] - from[0], p[1] - from[1]); from = p; }
  walk /= emergeSpeedMs;
  const until = tick + Math.ceil(walk * 60) + 60;
  // Stunned = no AI at all (InfectedSystem.updateL1); `emerging` = no body separation (it would snap the body onto
  // the nearest nav cell and reset its height): the scripted walk owns the body until the doorstep.
  if (e.combat) e.combat.staggerUntil = tick + 2;
  e.emerging = true;
  world.openDoor(doorId(house), { x: house.x, z: house.z, nx: house.nx, nz: house.nz }, tick);
  (house.walking ??= []).push({ id, until, leg: -1 });
  house.ids.push(id);
  return id;
}
function place(world: SimWorld, house: HouseDoor, e: { id: number; transform: { x: number; y: number; z: number } }, s: number): void {
  const p = e.transform; p.x = house.x + house.nx * s; p.z = house.z + house.nz * s;
  p.y = .7 + Math.max(floorAt(house, s), world.districts?.groundHeight(p.x, p.z) ?? 0);
  world.spatial.set(e.id, p.x, p.z);
}

/**
 * Scripted walk out of the door, one tick: straight out along the door normal, over the threshold, across the porch and
 * down its treads to the doorstep, then along the route through the gate. Returns the ids that reached the end this
 * tick (the caller hands them to the AI).
 */
export function walkResidents(world: SimWorld, house: HouseEmergence, tick: number): number[] {
  const done: number[] = [], walking = house.walking ?? [], end = (house.sx - house.x) * house.nx + (house.sz - house.z) * house.nz, step = emergeSpeedMs / 60;
  for (let i = walking.length - 1; i >= 0; i--) {
    const w = walking[i], e = world.entities.get(w.id);
    if (!e?.infected || e.health.current <= 0) { if (e) e.emerging = undefined; walking.splice(i, 1); continue; }
    const p = e.transform;
    if (w.leg < 0) {
      const s = Math.min(end, (p.x - house.x) * house.nx + (p.z - house.z) * house.nz + step);
      place(world, house, e, s); p.yaw = -Math.atan2(house.nz, house.nx);
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
