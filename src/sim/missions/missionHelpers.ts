import type { SimWorld } from '../world/SimWorld';
import type { CoverWall } from '../combat/HitQuery';
import type { Point } from '../npc/types';
import type { EntitySnapshot } from '../world/types';
import { actorRadius, solidLargeCorpse } from '../world/SolidRegistry';
import { looseSlotOffset } from '../outbreak/groupNature';

/** Shared level-mission mechanics (nearest-clear search, blocker events, follower slots, player relocation). */

/** A large corpse is a physical body outside the static route grid. Find a
 * swept, body-clear step around it before asking the ordinary route to resume. */
export function corpseDetour(world: SimWorld, e: EntitySnapshot, goal: Point): Point[] | undefined {
  const dx = goal.x - e.transform.x, dz = goal.z - e.transform.z, length2 = dx * dx + dz * dz;
  if (length2 < .01) return;
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
  const bodies = [...world.entities.iterate()].filter(body => solidLargeCorpse(body) && !body.hidden && Math.abs(body.transform.y - e.transform.y) <= 1.2);
  const clearOfCorpses = (from: Point, to: Point) => bodies.every(body => {
    const x = to.x - from.x, z = to.z - from.z, length = x * x + z * z;
    const along = length ? Math.max(0, Math.min(1, ((body.transform.x - from.x) * x + (body.transform.z - from.z) * z) / length)) : 0;
    return Math.hypot(from.x + along * x - body.transform.x, from.z + along * z - body.transform.z) >= actorRadius(e) + (e.companion ? .4 : 0) + actorRadius(body);
  });
  if (world.scenario === 'L8') {
    // A fallen elephant beside a displaced light prop can trap an otherwise
    // valid nav route. Find a bounded local path with the actual solid sweep,
    // including the full corgi footprint, before resuming the door approach.
    const near = bodies.some(body => distance(e.transform, body.transform) < actorRadius(e) + (e.companion ? .4 : 0) + actorRadius(body) + 1);
    if (!near || clearOfCorpses(e.transform, goal) && !bodies.some(body => world.solids.blockingBody(e.id)?.id === body.id)) return;
    type Node = { x: number; z: number; cost: number; score: number; parent?: Node };
    const queue: Node[] = [{ x: 0, z: 0, cost: 0, score: 0 }], visited = new Set<string>();
    const point = (node: Node) => ({ x: e.transform.x + node.x * .75, z: e.transform.z + node.z * .75 });
    for (let visits = 0; queue.length && visits < 512; visits++) {
      queue.sort((a, b) => b.score - a.score); const node = queue.pop()!, key = `${node.x},${node.z}`;
      if (visited.has(key)) continue; visited.add(key);
      const from = point(node), probe = { ...e, transform: { ...e.transform, ...from }, contactExempt: e.id };
      const gx = goal.x - from.x, gz = goal.z - from.z, length = Math.hypot(gx, gz);
      if (node.parent && clearOfCorpses(from, goal) && world.solids.sweep(probe, { x: gx / length, z: gz / length }, length, actorRadius(e), false, false) >= length - .001) {
        const path: Point[] = []; let step: Node | undefined = node;
        while (step?.parent) { path.unshift(point(step)); step = step.parent; }
        return path;
      }
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
        if (!x && !z) continue;
        const next = { x: node.x + x, z: node.z + z, cost: node.cost + Math.hypot(x, z) * .75, score: 0, parent: node };
        if (Math.abs(next.x) > 12 || Math.abs(next.z) > 12 || visited.has(`${next.x},${next.z}`)) continue;
        const at = point(next), leg = Math.hypot(x, z) * .75;
        if (!world.infected!.nav.contains(at.x, at.z, actorRadius(e)) || !world.solids.clear({ ...at, y: e.transform.y }, actorRadius(e), e.id) || world.solids.sweep(probe, { x: x * .75 / leg, z: z * .75 / leg }, leg) < leg - .001) continue;
        next.score = next.cost + distance(at, goal); queue.push(next);
      }
    }
    return;
  }
  for (const body of bodies) {
    const reach = actorRadius(e) + actorRadius(body), along = ((body.transform.x - e.transform.x) * dx + (body.transform.z - e.transform.z) * dz) / length2;
    if (distance(e.transform, body.transform) > reach + .75 || along <= 0 || along >= 1 || Math.hypot(e.transform.x + along * dx - body.transform.x, e.transform.z + along * dz - body.transform.z) > reach + .1) continue;
    const angle = Math.atan2(e.transform.z - body.transform.z, e.transform.x - body.transform.x);
    const candidates: { path: Point[]; length: number }[] = [];
    for (const sign of [-1, 1]) {
      const path: Point[] = []; let from: Point = e.transform, travelled = 0;
      for (let step = 1; step <= 4; step++) {
        const at = { x: body.transform.x + Math.cos(angle + sign * step * Math.PI / 4) * (reach + 1), z: body.transform.z + Math.sin(angle + sign * step * Math.PI / 4) * (reach + 1) };
        const x = at.x - from.x, z = at.z - from.z, length = Math.hypot(x, z);
        // Query a copied footprint at each proposed leg; skip its real body's
        // current reservation, while retaining every other actor and solid.
        const probe = { ...e, transform: { ...e.transform, ...from }, contactExempt: e.id };
        if (!world.solids.clear({ ...at, y: e.transform.y }, actorRadius(e), e.id) || !world.infected!.nav.visible(from, at, actorRadius(e)) || world.solids.sweep(probe, { x: x / length, z: z / length }, length) < length - .01) break;
        path.push(at); travelled += length;
        if (clearOfCorpses(at, goal)) { candidates.push({ path, length: travelled + distance(at, goal) }); break; }
        from = at;
      }
    }
    candidates.sort((a, b) => a.length - b.length);
    if (candidates.length) return candidates[0].path;
  }
}

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

/** Three-column follower formation behind the leader, loosened per slot into a
 * cluster of pairs. Scripted L7 staging/travel passes false to retain authored targets. */
export function formationSlot(leader: Point, heading: Point, slot: number, natural = true): Point {
  const loose = natural ? looseSlotOffset(slot) : { back: 0, side: 0 }, back = formationBack(slot) + loose.back, side = (slot % 3 - 1) * 1.2 + loose.side;
  return { x: leader.x - heading.x * back - heading.z * side, z: leader.z - heading.z * back + heading.x * side };
}

/** Moves the player to (x, z) with physics, previous-frame and spatial index in sync. */
export function relocatePlayer(world: SimWorld, x: number, z: number): void {
  const player = world.entities.get(1)!;
  player.transform.x = x; player.transform.z = z;
  world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
  Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, x, z);
}
