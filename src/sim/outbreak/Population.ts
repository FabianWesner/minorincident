import { l1Pedestrians } from '../../data/npcs';
import type { CivilianActivity, CivilianProp, Point } from '../npc/types';
import type { Outbreak, PedestrianOptions } from './Outbreak';
import type { Vec2 } from './types';

type Plan = PedestrianOptions & { at: Point; jog?: boolean; dog?: boolean };

/**
 * A living D-GROVE morning (specs/epic-19 section 5.1): groups of 1-3 at the cafe patio, bus stop, depot counter,
 * doorsteps and gardens, plus walkers, joggers and elderly strollers on every sidewalk. Works on any layout that has
 * roads and the section 3 anchors; points are snapped to clear navigation. Model+tint pairs are unique within 20 m.
 */
export function populateGrove(outbreak: Outbreak, count = 56): number[] {
  const world = outbreak.world, nav = world.infected!.nav, rng = outbreak.rng;
  const district = world.districts!.districts.find(d => d.id === 'D-GROVE') ?? world.districts!.districts[0];
  const [ox, oz] = district.origin, layout = district.layout;
  const anchor = (name: string): Point | null => { const a = layout.anchors[name]; return a ? { x: a.position[0] + ox, z: a.position[2] + oz } : null; };
  const clear = (p: Point, radius = .45) => nav.clear(p.x, p.z, radius);
  const snap = (p: Point, reach = 5): Point | null => {
    if (clear(p)) return { ...p };
    let best: Point | null = null, distance = reach;
    for (let dz = -reach; dz <= reach; dz += .5) for (let dx = -reach; dx <= reach; dx += .5) {
      const q = { x: p.x + dx, z: p.z + dz }, d = Math.hypot(dx, dz);
      if (d < distance && clear(q)) { best = q; distance = d; }
    }
    return best;
  };
  // Sidewalk runs: both kerbs of every road, sampled every 4 m, split where navigation is blocked.
  const runs: Point[][] = [];
  for (const road of layout.roads.edges) for (let i = 0; i + 1 < road.points.length; i++) {
    const [a, b] = [road.points[i], road.points[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz); if (length < 4) continue;
    const ux = dx / length, uz = dz / length, offset = road.laneWidth / 2 + 1.4;
    for (const side of [-1, 1]) {
      let run: Point[] = [];
      for (let t = 2; t <= length - 2; t += 4) {
        const p = { x: a[0] + ux * t - uz * offset * side + ox, z: a[1] + uz * t + ux * offset * side + oz };
        if (clear(p)) run.push(p); else { if (run.length >= 3) runs.push(run); run = []; }
      }
      if (run.length >= 3) runs.push(run);
    }
  }
  const doors = Object.keys(layout.anchors).filter(n => n.startsWith('refuge-door-')).map(anchor).filter((p): p is Point => !!p);
  const nearestDoor = (p: Point) => doors.reduce<Point | null>((best, d) => !best || Math.hypot(d.x - p.x, d.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? d : best, null);
  const plans: Plan[] = [];
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rng.next() * items.length)];
  const t = (min: number, max: number) => Math.round((min + rng.next() * (max - min)) * 60);
  const prop = (p: string | null | undefined) => (p ?? undefined) as CivilianProp | undefined;
  const look = (target: Point, facing: Point, p?: string | null, s: [number, number] = [3, 8]): CivilianActivity => ({ activity: 'look', anchor: 'l1/look', target, facing, ticks: t(...s), prop: prop(p) });
  const walk = (target: Point, p?: string | null): CivilianActivity => ({ activity: 'walk', anchor: 'l1/walk', target, ticks: 1, prop: prop(p) });
  // Seats from the layout (benches, patio and garden sets) for sit/stand routines with coffee.
  const seats = layout.placements.filter(q => /^prop\.(bench|cafe-patio-set|garden-set)$/.test(q.assetId)).map(q => {
    const seat = { x: q.position[0] + ox, z: q.position[2] + oz }, front = { x: Math.cos(q.yaw), z: -Math.sin(q.yaw) };
    return { seat, target: snap({ x: seat.x + front.x * .9, z: seat.z + front.z * .9 }, 1.5), facing: { x: seat.x + front.x * 3, z: seat.z + front.z * 3 }, used: false };
  }).filter((q): q is { seat: Point; target: Point; facing: Point; used: boolean } => !!q.target);
  const seatNear = (p: Point | null, radius: number) => p ? seats.find(q => !q.used && Math.hypot(q.seat.x - p.x, q.seat.z - p.z) <= radius) : undefined;
  /** A facing circle of 2-3 people chatting (gestures) around `center`. */
  const circle = (center: Point | null, n: number, props: (string | null)[], role?: string) => {
    if (!center) return;
    const spin = rng.next() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const angle = spin + i * Math.PI * 2 / n, at = snap({ x: center.x + Math.cos(angle) * .9, z: center.z + Math.sin(angle) * .9 }, 2);
      if (at) plans.push({ at, role, handProp: props[i % props.length], yaw: -Math.atan2(center.z - at.z, center.x - at.x),
        schedule: [{ activity: 'chat', anchor: 'l1/chat', target: at, facing: center, ticks: t(6, 12), prop: prop(props[i % props.length]) }, look(at, center, props[i % props.length], [1.5, 3])] });
    }
  };
  /** Sit with a coffee on a nearby seat, stand, stretch the legs, come back. */
  const sitter = (near: Point | null) => {
    const q = seatNear(near, 14); if (!q) return false; q.used = true;
    const stroll = snap({ x: q.target.x + (rng.next() - .5) * 8, z: q.target.z + (rng.next() - .5) * 8 }, 3) ?? q.target;
    plans.push({ at: q.target, handProp: 'coffee', yaw: -Math.atan2(q.facing.z - q.seat.z, q.facing.x - q.seat.x), schedule: [
      { activity: 'sit', anchor: 'l1/seat', target: q.target, seat: q.seat, facing: q.facing, ticks: t(10, 20), prop: 'coffee' },
      { activity: 'stand', anchor: 'l1/seat', target: q.target, seat: q.seat, facing: q.facing, ticks: 36, prop: 'coffee' },
      walk(stroll, 'coffee'), look(stroll, q.seat, 'coffee', [2, 4]), walk(q.target, 'coffee')] });
    return true;
  };
  /** A line facing `face` (bus stop, counter queue); the first in the queue goes in and out of `door`. */
  const line = (start: Point | null, face: Point | null, n: number, props: (string | null)[], door?: Point | null) => {
    if (!start || !face) return;
    const dx = face.x - start.x, dz = face.z - start.z, d = Math.hypot(dx, dz) || 1;
    for (let i = 0; i < n; i++) {
      const at = snap({ x: start.x - dz / d * (i * 1.1 - .5), z: start.z + dx / d * (i * 1.1 - .5) }, 2); if (!at) continue;
      const entrance = i === 0 && door ? snap(door, 3) : null;
      plans.push({ at, handProp: props[i % props.length], yaw: -Math.atan2(dz, dx), schedule: entrance
        ? [look(at, face, props[i], [5, 10]), { activity: 'door', anchor: 'l1/door', target: entrance, facing: door!, ticks: 45, prop: prop(props[i]) }, { activity: 'inside', anchor: 'l1/door', target: entrance, ticks: t(4, 8), prop: prop(props[i]) }, walk(at, props[i])]
        : [look(at, face, props[i % props.length], [6, 12]), look(at, { x: face.x + dz / d * 3, z: face.z - dx / d * 3 }, props[i % props.length], [1.5, 3])] });
    }
  };
  // Hubs first (seated, chatting, queueing, gardening): everyone faces something.
  const patio = anchor('cafe-patio');
  if (patio) { if (!sitter(patio)) circle({ x: patio.x - 1.5, z: patio.z }, 3, ['coffee', 'phone', null]); if (!sitter(patio)) circle({ x: patio.x + 2, z: patio.z + 1 }, 2, ['coffee', 'coffee']); }
  for (let i = 0; i < 4; i++) sitter(patio && { x: patio.x + i * 20, z: patio.z });
  const bus = anchor('bus-stop');
  line(bus && snap(bus, 3), bus && { x: bus.x, z: bus.z - 4 }, 3, ['phone', 'bag', null]);
  const counter = anchor('parcel-counter'), depotDoor = anchor('parcel-door');
  if (depotDoor) circle(snap({ x: depotDoor.x + 2.5, z: depotDoor.z + 2 }, 3), 2, ['phone', null]);
  line(counter && snap({ x: counter.x + 3, z: counter.z + 2 }, 3), counter, 2, ['bag', null], depotDoor);
  // At most ~8 doorstep hubs spread over the map (the full layout has 50+ refuge doors).
  const hubDoors = doors.filter((_, i) => i % Math.max(1, Math.ceil(doors.length / 8)) === 0);
  for (const [i, door] of hubDoors.entries()) {
    if (i % 3 === 0) circle(snap({ x: door.x + 1.5, z: door.z + (door.z < 0 ? 2 : -2) }, 3), 2, [null, 'phone']);
    else if (i % 3 === 1) {
      // Gardener: water two flower spots beside the door, facing them.
      const a = snap({ x: door.x - 1.6, z: door.z + (door.z < 0 ? 1.4 : -1.4) }, 2), b = a && snap({ x: a.x + 3.2, z: a.z }, 1.5);
      if (a && b) plans.push({ at: a, handProp: 'watering-can', role: 'bathrobe-neighbor', yaw: 0, schedule: [
        { activity: 'water', anchor: 'l1/flowers', target: a, facing: { x: a.x, z: door.z }, ticks: t(5, 8), prop: 'watering-can' }, walk(b, 'watering-can'),
        { activity: 'water', anchor: 'l1/flowers', target: b, facing: { x: b.x, z: door.z }, ticks: t(4, 7), prop: 'watering-can' }, walk(a, 'watering-can')] });
    }
  }
  for (const name of ['carwash-start', 'garage-door', 'alarm-car-2', 'gate-1', 'gate-3']) {
    const p = anchor(name), at = p && snap({ x: p.x + 2, z: p.z + 2 }, 4);
    if (at && p) { const h = pick(['coffee', 'phone', 'bag']); plans.push({ at, handProp: h, schedule: [look(at, p, h, [6, 12]), look(at, { x: p.x + 3, z: p.z - 2 }, h, [2, 4])] }); }
  }
  // Stationary groups take at most 55 %: the rest walk, so the streets stay alive and the outbreak meets people.
  plans.splice(Math.round(count * .55));
  // Fill with grocery walkers, phone walkers, joggers, dog walkers and elderly cane strollers on every sidewalk run.
  let r = Math.floor(rng.next() * Math.max(1, runs.length)), dogs = 0;
  // Larch Street stays busy: the first walkers use the sidewalks near the facility (section 3, beats 3-7), so the
  // outbreak meets pedestrians there instead of an empty street.
  const lab = anchor('lab-door'), nearLab = lab ? runs.filter(run => run.some(q => Math.hypot(q.x - lab.x, q.z - lab.z) < 45)) : [];
  let larch = Math.min(10, nearLab.length * 3);
  for (let guard = 0; plans.length < count && runs.length && guard < count * 8; guard++) {
    const run = larch-- > 0 ? nearLab[larch % nearLab.length] : runs[r++ % runs.length], start = Math.floor(rng.next() * run.length), kind = rng.next();
    const span = kind < .2 ? run.length : 2 + Math.floor(rng.next() * 4), points: Point[] = [];
    for (let i = 0; i < span && start + i < run.length; i++) points.push(run[start + i]);
    if (points.length < 2) { const back = run.slice(Math.max(0, start - 3), start + 1); if (back.length < 2) continue; points.splice(0, points.length, ...back); }
    // Keep right: outbound and return legs run 0.45 m apart, so oncoming walkers pass instead of blocking.
    const ux = points[points.length - 1].x - points[0].x, uz = points[points.length - 1].z - points[0].z, ul = Math.hypot(ux, uz) || 1;
    const shift = (p: Point, side: number) => { const q = { x: p.x - uz / ul * .45 * side, z: p.z + ux / ul * .45 * side }; return clear(q) ? q : p; };
    const out = points.map(p => shift(p, 1)), back = points.slice(1, -1).reverse().map(p => shift(p, -1)), loop = [...out, ...back];
    const ends = (p: string | null, s: [number, number]) => { const sched: CivilianActivity[] = []; for (const q of loop) { sched.push(walk(q, p)); const d = nearestDoor(q); if ((q === out[out.length - 1] || q === out[0]) && d) sched.push(look(q, d, p, s)); } return sched; };
    if (kind < .18) plans.push({ at: loop[0], role: 'jogger', jog: true, schedule: loop.map(q => walk(q)) });
    else if (kind < .34) plans.push({ at: loop[0], model: 'npc.civilian-elderly', handProp: 'cane', role: pick(['bathrobe-neighbor', 'suburban-mom']), schedule: ends('cane', [3, 6]) });
    else if (kind < .42 && dogs < 2) { dogs++; plans.push({ at: loop[0], role: 'bbq-dad', dog: true, schedule: loop.map(q => walk(q)) }); }
    else { const h = pick(['bag', 'bag', 'phone', 'coffee', null]); plans.push({ at: loop[0], handProp: h, schedule: h === 'bag' ? ends(h, [2, 4]) : loop.map(q => walk(q, h)) }); }
  }
  // Unique silhouette+tint within 20 m (section 5.1), deterministic from the outbreak stream.
  const placed: { at: Point; key: string }[] = [], ids: number[] = [];
  for (const plan of plans.slice(0, count)) {
    const near = new Set(placed.filter(p => Math.hypot(p.at.x - plan.at.x, p.at.z - plan.at.z) < 20).map(p => p.key));
    const models = plan.model ? [plan.model] : l1Pedestrians.models.filter(m => m !== 'npc.civilian-elderly' || rng.next() < .5);
    const offset = Math.floor(rng.next() * 60);
    let model: string = plan.model ?? models[0], tint: string = l1Pedestrians.shirts[0];
    for (let k = 0; k < 60; k++) {
      const m = models[(offset + k) % models.length], t = l1Pedestrians.shirts[Math.floor((offset + k) / models.length) % l1Pedestrians.shirts.length];
      if (!near.has(`${m}|${t}`)) { model = m; tint = t; break; }
    }
    placed.push({ at: plan.at, key: `${model}|${tint}` });
    const id = outbreak.spawnPedestrian(plan.at, { ...plan, model, tint, accessories: [pick(l1Pedestrians.accessories)].filter(a => a !== 'none') });
    if (plan.jog) world.entities.get(id)!.civilian!.l1!.walkSpeed = 2.4 + rng.next() * .4;
    // Dog walk: the healthy pet follows its owner (E08 pet path; never in the L1 infection chain, leaves with the owner).
    if (plan.dog) { const p = snap({ x: plan.at.x + .8, z: plan.at.z + .6 }, 1.5); if (p) world.npcs!.civilians.spawn('dog', p, { pet: 'dog', owner: id, waypoints: [p] }); }
    ids.push(id);
  }
  return ids;
}

/** Refuge doors and map edges of the loaded D-GROVE layout, in world metres. */
export function groveRefuges(outbreak: { world: Outbreak['world'] }): { refuges: { id: string; x: number; z: number }[]; entries: { id: string; x: number; z: number }[]; anchors: Record<string, Vec2> } {
  const world = outbreak.world, district = world.districts!.districts.find(d => d.id === 'D-GROVE') ?? world.districts!.districts[0];
  const anchors: Record<string, Vec2> = {};
  for (const [name, a] of Object.entries(district.layout.anchors)) anchors[name] = { x: a.position[0] + district.origin[0], z: a.position[2] + district.origin[1] };
  const pick = (prefix: string) => Object.keys(anchors).filter(n => n.startsWith(prefix)).map(id => ({ id, ...anchors[id] }));
  const entries = pick('edge-in-');
  return { refuges: [...pick('refuge-door-'), ...entries], entries, anchors };
}
