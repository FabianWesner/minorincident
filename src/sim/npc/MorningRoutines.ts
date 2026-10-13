import type { SimWorld } from '../world/SimWorld';
import { soilDecorations } from '../../levels/districts/decorationSurface';
import type { EntitySnapshot } from '../world/types';
import { standNear } from './gardening';
import { seatAnchor, sitHipHeight } from './seats';
import type { CivilianActivity, Point } from './types';

/** A clear lawn pocket can still be fenced off. Author only cells connected to the sidewalk network. */
function prepareReachability(world: SimWorld): void {
  const nav = world.infected!.nav, start = world.entities.get(1)!.transform;
  const cell = nav.nearestCell(start.x, start.z);
  nav.flow(nav.x(cell), nav.z(cell), nav.blocked.length);
}
function routineOk(world: SimWorld, p: Point): boolean {
  const nav = world.infected!.nav, cell = nav.cell(p.x, p.z);
  return cell >= 0 && nav.distance[cell] >= 0 && nav.clear(p.x, p.z, .35) && nav.visible(p, { x: nav.x(cell), z: nav.z(cell) }, .35);
}
function routinePoint(world: SimWorld, p: Point): Point {
  const nav = world.infected!.nav;
  if (routineOk(world, p)) return p;
  let best = -1, distance = Infinity;
  for (let dz = -12; dz <= 12; dz++) for (let dx = -12; dx <= 12; dx++) {
    const c = nav.cell(p.x + dx * .5, p.z + dz * .5);
    if (c < 0 || nav.distance[c] < 0) continue;
    const d = (nav.x(c) - p.x) ** 2 + (nav.z(c) - p.z) ** 2;
    if (d < distance) { best = c; distance = d; }
  }
  if (best < 0) throw new Error('Morning anchor has no reachable approach');
  return { x: nav.x(best), z: nav.z(best) };
}

/**
 * A seated civilian whose state leaves calm/alarmed (flee, hide, grabbed, bitten...) is no longer on the seat: drop the seat from the
 * current step (it becomes a plain look at the current spot) so no sitting pose or seat lift can follow them away from the bench.
 */
export function leaveSeat(e: EntitySnapshot): void {
  const c = e.civilian!, step = c.scheduleStep ?? 0, activity = c.schedule?.[step];
  if (!activity?.seat) return;
  c.schedule![step] = { activity: 'look', anchor: activity.anchor, target: { x: e.transform.x, z: e.transform.z }, facing: activity.facing, ticks: activity.ticks };
  c.activityUntil = 0; c.activityStarted = 0; c.lastTravelProgress = undefined;
}

/** Seat movement that makes a sitter stand up: displacement of the seat, or turn of the prop (metres, radians). */
export const seatMoveLimit = .3, seatTurnLimit = 20 * Math.PI / 180;
const rotate = (q: number[], v: number[]): [number, number, number] => {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx];
};
const conj = (q: number[]) => [-q[0], -q[1], -q[2], q[3]];
const multiply = (a: number[], b: number[]) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];

/**
 * Seats follow the live (physics-moved) prop. The sitter's hip anchor is the authored anchor carried rigidly with the prop's pose, so a
 * pushed bench carries the sitter a little; a prop moved more than seatMoveLimit / seatTurnLimit, tipped, or destroyed stands the sitter up
 * with a short reaction. An upright prop is sat on again at its new place; a tipped or destroyed one is left behind. Returns true when the
 * sitter stood up this tick.
 */
export function followSeat(world: SimWorld, e: EntitySnapshot): boolean {
  const props = world.props, c = e.civilian!, step = c.scheduleStep ?? 0, activity = c.schedule?.[step];
  if (!props || !activity?.seat) return false;
  if (activity.seatProp === undefined) {
    // Bind once to the nearest movable prop whose home pose is under the authored seat.
    let best: (typeof props.items)[number] | undefined, distance = 1.1;
    for (const item of props.items) { const d = Math.hypot(item.home.p[0] - activity.seat.x, item.home.p[2] - activity.seat.z); if (d < distance) { best = item; distance = d; } }
    activity.seatProp = best?.id ?? '';
    if (best) {
      activity.seatRel = [activity.seat.x - best.home.p[0], activity.seatLift === undefined ? 0 : activity.seatLift + sitHipHeight, activity.seat.z - best.home.p[2]];
      activity.seatRef = { p: [...best.home.p], q: [...best.home.q] };
    }
  }
  if (!activity.seatProp || !activity.seatRel || !activity.seatRef) return false;
  const ref = activity.seatRef;
  const item = props.items.find(i => i.id === activity.seatProp), entity = item && world.entities.get(item.entityId);
  const destroyed = !item || !entity || entity.health.current <= 0;
  let live: { x: number; y: number; z: number; lift: number } | null = null, upright = false, home: { x: number; y: number; z: number } | null = null, turned = 0;
  if (item && !destroyed) {
    const rel = multiply(item.pose.q, conj(ref.q)), yaw = 2 * Math.atan2(rel[1], rel[3]);
    // The sitter follows the prop's position and heading only: a slightly settled (tilted) prop must not tilt the fixed sit pose.
    const at = rotate([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], activity.seatRel);
    live = { x: item.pose.p[0] + at[0], y: item.pose.p[1] + at[1], z: item.pose.p[2] + at[2], lift: at[1] - sitHipHeight };
    home = { x: ref.p[0] + activity.seatRel[0], y: ref.p[1] + activity.seatRel[1], z: ref.p[2] + activity.seatRel[2] };
    upright = rotate(item.pose.q, [0, 1, 0])[1] >= Math.cos(seatTurnLimit);
    turned = 2 * Math.acos(Math.min(1, Math.abs(rel[3])));
  }
  const peers: number[] = [];
  c.schedule!.forEach((s, i) => { if (i === step || s.seat && Math.hypot(s.seat.x - activity.seat!.x, s.seat.z - activity.seat!.z) < .5) peers.push(i); });
  const moved = !live || !home || Math.hypot(live.x - home.x, live.y - home.y, live.z - home.z) > seatMoveLimit || turned > seatTurnLimit || !upright;
  if (!moved) {
    // Within tolerance: the sitter rides along with the prop.
    const seat = { x: live!.x, z: live!.z };
    for (const i of peers) { const s = c.schedule![i]; s.seat = seat; if (s.seatLift !== undefined) s.seatLift = live!.lift; }
    return false;
  }
  const original = { ...activity }, seated = !!c.activityUntil && activity.activity === 'sit';
  const resit = !!live && upright && !destroyed;
  const front = item ? rotate(item.pose.q, [1, 0, 0]) : [0, 0, 0], fl = Math.hypot(front[0], front[2]) || 1;
  for (const i of peers) {
    const s = i === step ? original : c.schedule![i];
    if (resit) {
      const seat = { x: live!.x, z: live!.z }, fx = front[0] / fl, fz = front[2] / fl;
      c.schedule![i] = { ...s, seat, seatLift: s.seatLift === undefined ? undefined : live!.lift, target: { x: seat.x + fx * .9, z: seat.z + fz * .9 }, facing: { x: seat.x + fx * 3, z: seat.z + fz * 3 }, seatProp: activity.seatProp, seatRel: activity.seatRel, seatRef: { p: [...item!.pose.p], q: [...item!.pose.q] } };
    } else {
      c.schedule![i] = { ...s, seat: undefined, seatLift: undefined, seatProp: '', seatRel: undefined, seatRef: undefined, activity: s.activity === 'sit' || s.activity === 'stand' ? 'look' : s.activity, ticks: s.activity === 'sit' ? Math.min(s.ticks, 90) : s.activity === 'stand' ? 30 : s.ticks, facing: item ? { x: item.pose.p[0], z: item.pose.p[2] } : s.facing };
    }
  }
  // The reaction: a protest and a look at the displaced bench (annoyed/surprised); a re-sit follows for an upright bench.
  if (seated) {
    world.events.emit({ type: 'civilian.bark', tick: world.tick, id: e.id, text: 'Hey!', position: { x: e.transform.x, z: e.transform.z } });
    if (resit) c.schedule!.splice(step, 0, { activity: 'look', anchor: activity.anchor, target: { x: e.transform.x, z: e.transform.z }, facing: { x: item!.pose.p[0], z: item!.pose.p[2] }, ticks: 60, prop: activity.prop });
  }
  c.activityUntil = 0; c.activityStarted = 0; c.lastTravelProgress = undefined;
  return true;
}

/** Only calm civilians own their schedule. Notice/grab/flight always take priority. */
export function updateRoutine(world: SimWorld, e: EntitySnapshot): void {
  const c = e.civilian!, schedule = c.schedule!;
  const step = c.scheduleStep ?? 0, activity = schedule[step], tick = world.tick;
  if (!c.activityUntil) {
    c.lastTravelProgress ??= tick;
    const beforeX = e.transform.x, beforeZ = e.transform.z;
    world.npcs!.move(e, activity.target, c.model === 'npc.civilian-elderly' ? .85 : 1.25, c, .08);
    if (Math.hypot(e.transform.x - beforeX, e.transform.z - beforeZ) > .0001) c.lastTravelProgress = tick;
    if (Math.hypot(e.transform.x - activity.target.x, e.transform.z - activity.target.z) < .16) {
      c.activityStarted = tick; c.activityUntil = tick + Math.max(1, activity.ticks);
      if (activity.activity === 'inside') { e.hidden = true; world.spatial.delete(e.id); }
    }
  } else {
    const face = activity.facing;
    if (face) {
      const base = activity.seat ?? e.transform;
      const yaw = -Math.atan2(face.z - base.z, face.x - base.x);
      const delta = Math.atan2(Math.sin(yaw - e.transform.yaw), Math.cos(yaw - e.transform.yaw));
      e.transform.yaw += Math.max(-.08, Math.min(.08, delta));
    }
  }
  // A blocked walker looks around, then changes destination instead of walking in place.
  if (tick >= (c.activityUntil || Infinity) || !c.activityUntil && tick - c.lastTravelProgress! >= 180) {
    e.hidden = false; c.scheduleStep = (step + 1) % schedule.length;
    c.activityUntil = 0; c.activityStarted = 0; c.lastTravelProgress = tick; c.path = []; c.goal = -1;
  }
}

/** Small, individually authored groups distributed along the L1 route. No lawn grid population. */
export function populateMorning(world: SimWorld): void {
  prepareReachability(world);
  for (const district of world.districts!.districts) {
    if (district.id !== 'D-RES' && district.id !== 'D-MAIN') continue;
    const { layout, origin } = district;
    const point = (x: number, z: number): Point => ({ x: x + origin[0], z: z + origin[1] });
    const safe = (p: Point): Point => routinePoint(world, p);
    const at = (name: string): Point => { const p = layout.anchors[name].position; return point(p[0], p[2]); };
    const walk = (p: Point, anchor: string, prop?: CivilianActivity['prop']): CivilianActivity => ({ activity: 'walk', target: safe(p), anchor, ticks: 1, prop });
    const spawn = (role: string, model: string, schedule: CivilianActivity[], initial = 0): number => {
      schedule = schedule.map(s => ({ ...s, target: safe(s.target) }));
      const id = world.npcs!.civilians.spawn(role, schedule[initial].target, { model, schedule, waypoints: schedule.map(s => s.target) });
      const e = world.entities.get(id)!; e.civilian!.scheduleStep = initial;
      const face = schedule[initial].facing;
      if (face) e.transform.yaw = -Math.atan2(face.z - e.transform.z, face.x - e.transform.x);
      return id;
    };
    // Benches come from placements; flowers come from the reproducible layout's dressing anchors.
    const bench = layout.placements.filter(p => p.assetId === 'prop.bench')[district.id === 'D-MAIN' ? 8 : 0];
    if (bench) {
      const anchored = seatAnchor(bench.assetId, bench.position, bench.yaw, bench.scale, { x: origin[0], z: origin[1] });
      const seat = anchored ?? point(bench.position[0], bench.position[2]), seatLift = anchored?.lift;
      const front = { x: Math.cos(bench.yaw), z: -Math.sin(bench.yaw) };
      const target = { x: seat.x + front.x * .9, z: seat.z + front.z * .9 };
      spawn('cashier', 'npc.civilian-man-b', [
        { activity: 'sit', anchor: bench.id, target, seat, seatLift, facing: { x: seat.x + front.x * 3, z: seat.z + front.z * 3 }, ticks: 600, prop: 'coffee' },
        { activity: 'stand', anchor: bench.id, target, seat, seatLift, facing: { x: seat.x + front.x * 3, z: seat.z + front.z * 3 }, ticks: 36, prop: 'coffee' },
        walk(point(bench.position[0], -3.6), 'sidewalk/bench-exit', 'coffee'),
        walk(point(bench.position[0] + 3, -3.6), 'sidewalk/bench-loop', 'coffee'), walk(target, bench.id, 'coffee'),
      ]);
    }
    // Gardening stands within 0.5 m of a real flower (derived from the live decoration positions), facing it; the second stop is
    // another real flower 2.5-7 m away. Flowers with no reachable standing spot are skipped.
    const flowers = soilDecorations(layout).filter(d => d.kind === 'flower').map(d => point(d.position[0], d.position[2]));
    const tend = (f: Point, prefer: Point) => standNear({ x0: f.x, z0: f.z, x1: f.x, z1: f.z }, p => routineOk(world, p), prefer);
    let first: ReturnType<typeof tend> = null, second: ReturnType<typeof tend> = null, flowerA: Point | undefined;
    for (const f of flowers.slice(6)) {
      const a = tend(f, { x: f.x, z: f.z + 2 }); if (!a) continue;
      const g = flowers.find(h => { const d = Math.hypot(h.x - f.x, h.z - f.z); return d >= 2.5 && d <= 7 && !!tend(h, { x: h.x, z: h.z + 2 }); });
      if (g) { first = a; second = tend(g, { x: g.x, z: g.z + 2 }); flowerA = f; break; }
    }
    if (first && second && flowerA) {
      const gardening: CivilianActivity[] = [
        { activity: 'water', anchor: 'flower-box/0', target: first.target, facing: first.facing, ticks: 360, prop: 'watering-can' },
        walk(second.target, 'flower-box/1', 'watering-can'),
        { activity: 'water', anchor: 'flower-box/1', target: second.target, facing: second.facing, ticks: 300, prop: 'watering-can' },
        walk(first.target, 'flower-box/0', 'watering-can'),
      ];
      if (district.id === 'D-MAIN') {
        const door = at('diner-door');
        gardening.push({ activity: 'door', anchor: 'diner-door', target: door, facing: { x: door.x, z: door.z - 3 }, ticks: 45 },
          { activity: 'inside', anchor: 'diner-door', target: door, ticks: 300 });
      }
      spawn('bathrobe-neighbor', 'npc.civilian-woman-b', gardening);
      if (district.id === 'D-RES') {
        const admire = tend(flowerA, { x: flowerA.x + 1.6, z: flowerA.z + 1 }) ?? first;
        spawn('suburban-mom', 'npc.civilian-elderly', [
          walk(point(-7, -3.6), 'crescent/sidewalk', 'cane'),
          { activity: 'look', anchor: 'flower-box/0', target: admire.target, facing: admire.facing, ticks: 120, prop: 'cane' },
          walk(point(-3, -3.6), 'crescent/sidewalk', 'cane'),
        ], 2);
      }
    }
    if (district.id === 'D-RES') {
      const owner = spawn('bbq-dad', 'npc.civilian-man-a', [walk(point(6, 3.6), 'crescent/east'), walk(point(17, 3.6), 'crescent/east')]);
      // Existing healthy corgi asset is reused by NpcView without its companion backpack.
      const p = world.entities.get(owner)!.transform;
      world.npcs!.civilians.spawn('dog', safe({ x: p.x + .8, z: p.z + .6 }), { pet: 'dog', owner, waypoints: [safe(p)] });
      const a = safe(point(-4, 3.6)), b = safe(point(-2.5, 3.6));
      for (const [i, model] of ['npc.civilian-woman-a', 'npc.civilian-man-b'].entries()) {
        const target = i ? b : a, facing = i ? a : b;
        spawn(i ? 'delivery-driver' : 'suburban-mom', model, [
          { activity: 'chat', anchor: 'crescent/chat', target, facing, ticks: 360 + i * 60, prop: i ? 'phone' : undefined },
          walk({ x: target.x + 3, z: target.z }, 'crescent/chat'), walk(target, 'crescent/chat'),
        ]);
      }
    } else {
      const hardware = at('hardware-display');
      const browse = standNear({ x0: hardware.x, z0: hardware.z, x1: hardware.x, z1: hardware.z }, p => routineOk(world, p), { x: hardware.x, z: hardware.z + 1 }, [.5, .8, 1.1, 1.4]);
      spawn('delivery-driver', 'npc.civilian-woman-a', [
        walk(point(9, -3.6), 'hardware/sidewalk', 'bag'), walk(point(17, -3.6), 'hardware/sidewalk', 'bag'),
        { activity: 'look', anchor: 'hardware-display', target: browse?.target ?? safe({ x: hardware.x, z: hardware.z + 1 }), facing: browse?.facing ?? hardware, ticks: 90, prop: 'bag' },
      ], 1);
      spawn('jogger', 'npc.civilian-man-a', [walk(point(21, 3.6), 'main/east', 'phone'), walk(point(8, 3.6), 'main/east', 'phone')]);
    }
  }
}

/** Three diner customers run distinct activities and remain addressable by the outbreak checkpoint. */
export function dinerCustomer(world: SimWorld, index: number, diner: Point): number {
  prepareReachability(world);
  const district = world.districts?.districts.find(d => d.id === 'D-MAIN');
  const safe = (p: Point): Point => routinePoint(world, p);
  const bench = district?.layout.placements.filter(p => p.assetId === 'prop.bench').find(p => p.position[0] < -17 && p.position[2] < -6);
  const roles = ['cashier', 'suburban-mom', 'bbq-dad'];
  const models = ['npc.civilian-man-a', 'npc.civilian-woman-a', 'npc.civilian-elderly'];
  const a = safe({ x: diner.x + (index - 1) * 3.2, z: diner.z + 2.4 });
  let schedule: CivilianActivity[];
  if (index === 0 && bench && district) {
    const anchored = seatAnchor(bench.assetId, bench.position, bench.yaw, bench.scale, { x: district.origin[0], z: district.origin[1] });
    const seat = anchored ?? { x: bench.position[0] + district.origin[0], z: bench.position[2] + district.origin[1] }, seatLift = anchored?.lift;
    const target = safe({ x: seat.x, z: seat.z - .9 });
    schedule = [{ activity: 'sit', anchor: bench.id, target, seat, seatLift, facing: { x: seat.x, z: seat.z - 3 }, ticks: 540, prop: 'coffee' },
      { activity: 'stand', anchor: bench.id, target, seat, seatLift, facing: { x: seat.x, z: seat.z - 3 }, ticks: 36, prop: 'coffee' },
      { activity: 'walk', anchor: 'diner/sidewalk', target: safe({ x: seat.x, z: -3.6 + district.origin[1] }), ticks: 1, prop: 'coffee' },
      { activity: 'walk', anchor: 'diner/sidewalk', target: a, ticks: 1, prop: 'coffee' }];
  } else {
    schedule = [{ activity: index === 2 ? 'look' : 'walk', anchor: 'diner/flowers', target: a, facing: diner, ticks: index === 2 ? 120 : 1, prop: index === 2 ? 'cane' : 'bag' },
      { activity: 'walk', anchor: 'diner/sidewalk', target: safe({ x: a.x + 2.4, z: a.z }), ticks: 1, prop: index === 2 ? 'cane' : 'bag' }];
  }
  return world.npcs!.civilians.spawn(roles[index], schedule[0].target, { model: models[index], panicReaction: index === 1 ? 'flee' : 'freeze', schedule, waypoints: schedule.map(s => s.target) });
}
