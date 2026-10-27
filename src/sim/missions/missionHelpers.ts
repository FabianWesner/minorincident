import type { SimWorld } from '../world/SimWorld';
import type { CoverWall } from '../combat/HitQuery';
import type { Point } from '../npc/types';

/** Shared level-mission mechanics (nearest-clear search, blocker events, follower slots, player relocation). */

/** First clear point on a 0.5 m, 16-ray ring search around `at` up to `maxD` metres, or undefined when none is clear. */
export function findClearPoint(nav: { clear(x: number, z: number, r: number): boolean }, at: Point, radius: number, maxD: number): Point | undefined {
  for (let d = 0; d <= maxD; d += .5) for (let k = 0; k < (d ? 16 : 1); k++) {
    const p = { x: at.x + Math.cos(k * Math.PI / 8) * d, z: at.z + Math.sin(k * Math.PI / 8) * d };
    if (nav.clear(p.x, p.z, radius)) return p;
  }
  return undefined;
}

/** Nearest point with at least `r` (min .36) clearance within 6 m; the original point when nothing is clear. */
export function snapToClear(world: SimWorld, p: Point, r = .4): Point {
  return findClearPoint(world.infected!.nav, p, Math.max(r, .36), 6) ?? { x: p.x, z: p.z };
}

/** Like findClearPoint but a missing point is a level-authoring error. */
export function requireClearPoint(world: SimWorld, at: Point, radius: number, maxD: number, label: string): Point {
  const p = findClearPoint(world.infected!.nav, at, radius, maxD);
  if (!p) throw new Error(`No clear ${label} point at ${at.x},${at.z}`);
  return p;
}

export function emitBlocker(world: SimWorld, id: number, blocked: boolean, wall: CoverWall): void {
  world.events.emit({ type: 'world.blocker.changed', tick: world.tick, id, blocked, wall });
}

/** Static collider + navigation blocker for `wall` under a stable event `id`; `handles` tracks the physics blocker per key. */
export function setWall(world: SimWorld, handles: Map<string, number>, key: string, id: number, wall: CoverWall, blocked: boolean): void {
  const handle = handles.get(key);
  if (blocked && handle === undefined) { handles.set(key, world.physics.addBlocker(wall)); emitBlocker(world, id, true, wall); }
  if (!blocked && handle !== undefined) { world.physics.removeBlocker(handle); handles.delete(key); emitBlocker(world, id, false, wall); }
}

/** Heading of the leader: its velocity when moving, otherwise its facing. */
export function leaderHeading(yaw: number, velocity?: Point): Point {
  const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
  return speed > .8 ? { x: velocity!.x / speed, z: velocity!.z / speed } : { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

/** Distance behind the leader of a follower slot (rows of three, 1.2 m apart). */
export function formationBack(slot: number): number { return 2.3 + Math.floor(slot / 3) * 1.2; }

/** Three-column follower formation behind the leader. */
export function formationSlot(leader: Point, heading: Point, slot: number): Point {
  const back = formationBack(slot), side = (slot % 3 - 1) * 1.2;
  return { x: leader.x - heading.x * back - heading.z * side, z: leader.z - heading.z * back + heading.x * side };
}

/** Moves the player to (x, z) with physics, previous-frame and spatial index in sync. */
export function relocatePlayer(world: SimWorld, x: number, z: number): void {
  const player = world.entities.get(1)!;
  player.transform.x = x; player.transform.z = z;
  world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
  Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, x, z);
}
