import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { CivilianActivity, Point } from './types';

/** A clear lawn pocket can still be fenced off. Author only cells connected to the sidewalk network. */
function prepareReachability(world: SimWorld): void {
  const nav = world.infected!.nav, start = world.entities.get(1)!.transform;
  const cell = nav.nearestCell(start.x, start.z);
  nav.flow(nav.x(cell), nav.z(cell), nav.blocked.length);
}
function routinePoint(world: SimWorld, p: Point): Point {
  const nav = world.infected!.nav, cell = nav.cell(p.x, p.z);
  if (cell >= 0 && nav.distance[cell] >= 0 && nav.clear(p.x, p.z, .35) && nav.visible(p, { x: nav.x(cell), z: nav.z(cell) }, .35)) return p;
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

/** Only calm civilians own their schedule. Notice/grab/flight always take priority. */
export function updateRoutine(world: SimWorld, e: EntitySnapshot): void {
  const c = e.civilian!, schedule = c.schedule!;
  const step = c.scheduleStep ?? 0, activity = schedule[step], tick = world.tick;
  if (!c.activityUntil) {
    c.travelStarted ??= tick;
    world.npcs!.move(e, activity.target, c.model === 'npc.civilian-elderly' ? .85 : 1.25, c, .08);
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
  if (tick >= (c.activityUntil || Infinity) || !c.activityUntil && tick - c.travelStarted! > 900) {
    e.hidden = false; c.scheduleStep = (step + 1) % schedule.length;
    c.activityUntil = 0; c.activityStarted = 0; c.travelStarted = tick; c.path = []; c.goal = -1;
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
      const seat = point(bench.position[0], bench.position[2]);
      const front = { x: Math.cos(bench.yaw), z: -Math.sin(bench.yaw) };
      const target = { x: seat.x + front.x * .9, z: seat.z + front.z * .9 };
      spawn('cashier', 'npc.civilian-man-b', [
        { activity: 'sit', anchor: bench.id, target, seat, facing: { x: seat.x + front.x * 3, z: seat.z + front.z * 3 }, ticks: 600, prop: 'coffee' },
        { activity: 'stand', anchor: bench.id, target, seat, facing: { x: seat.x + front.x * 3, z: seat.z + front.z * 3 }, ticks: 36, prop: 'coffee' },
        walk(point(bench.position[0], -3.6), 'sidewalk/bench-exit', 'coffee'),
        walk(point(bench.position[0] + 3, -3.6), 'sidewalk/bench-loop', 'coffee'), walk(target, bench.id, 'coffee'),
      ]);
    }
    const flower = layout.decorations?.filter(d => d.kind === 'flower')[6];
    if (flower) {
      const facing = point(flower.position[0], flower.position[2]), target = safe({ x: facing.x, z: facing.z + 1 });
      const gardening: CivilianActivity[] = [
        { activity: 'water', anchor: 'flower-box/0', target, facing, ticks: 360, prop: 'watering-can' },
        walk({ x: target.x + 2.6, z: target.z }, 'flower-box/1', 'watering-can'),
        { activity: 'water', anchor: 'flower-box/1', target: { x: target.x + 2.6, z: target.z }, facing: { x: facing.x + 2.6, z: facing.z }, ticks: 300, prop: 'watering-can' },
        walk(target, 'flower-box/0', 'watering-can'),
      ];
      if (district.id === 'D-MAIN') {
        const door = at('diner-door');
        gardening.push({ activity: 'door', anchor: 'diner-door', target: door, facing: { x: door.x, z: door.z - 3 }, ticks: 45 },
          { activity: 'inside', anchor: 'diner-door', target: door, ticks: 300 });
      }
      spawn('bathrobe-neighbor', 'npc.civilian-woman-b', gardening);
      if (district.id === 'D-RES') spawn('suburban-mom', 'npc.civilian-elderly', [
        walk(point(-7, -3.6), 'crescent/sidewalk', 'cane'),
        { activity: 'look', anchor: 'flower-box/0', target: safe({ x: target.x + 1.6, z: target.z + .6 }), facing, ticks: 120, prop: 'cane' },
        walk(point(-3, -3.6), 'crescent/sidewalk', 'cane'),
      ], 2);
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
      spawn('delivery-driver', 'npc.civilian-woman-a', [
        walk(point(9, -3.6), 'hardware/sidewalk', 'bag'), walk(point(17, -3.6), 'hardware/sidewalk', 'bag'),
        { activity: 'look', anchor: 'hardware-display', target: safe({ x: hardware.x, z: hardware.z + 1 }), facing: hardware, ticks: 90, prop: 'bag' },
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
    const seat = { x: bench.position[0] + district.origin[0], z: bench.position[2] + district.origin[1] };
    const target = safe({ x: seat.x, z: seat.z - .9 });
    schedule = [{ activity: 'sit', anchor: bench.id, target, seat, facing: { x: seat.x, z: seat.z - 3 }, ticks: 540, prop: 'coffee' },
      { activity: 'stand', anchor: bench.id, target, seat, facing: { x: seat.x, z: seat.z - 3 }, ticks: 36, prop: 'coffee' },
      { activity: 'walk', anchor: 'diner/sidewalk', target: safe({ x: seat.x, z: -3.6 + district.origin[1] }), ticks: 1, prop: 'coffee' },
      { activity: 'walk', anchor: 'diner/sidewalk', target: a, ticks: 1, prop: 'coffee' }];
  } else {
    schedule = [{ activity: index === 2 ? 'look' : 'walk', anchor: 'diner/flowers', target: a, facing: diner, ticks: index === 2 ? 120 : 1, prop: index === 2 ? 'cane' : 'bag' },
      { activity: 'walk', anchor: 'diner/sidewalk', target: safe({ x: a.x + 2.4, z: a.z }), ticks: 1, prop: index === 2 ? 'cane' : 'bag' }];
  }
  return world.npcs!.civilians.spawn(roles[index], schedule[0].target, { model: models[index], panicReaction: 'freeze', schedule, waypoints: schedule.map(s => s.target) });
}
