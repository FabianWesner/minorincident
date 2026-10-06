import { l1Pedestrians } from '../../data/npcs';
import type { Point } from '../npc/types';
import type { Outbreak, PedestrianOptions } from './Outbreak';
import type { Vec2 } from './types';

type Plan = PedestrianOptions & { at: Point; jog?: boolean };

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
  /** A facing circle of 2-3 people (chat, patio table, queue) around `center`. */
  const circle = (center: Point | null, n: number, props: (string | null)[], role?: string) => {
    if (!center) return;
    const spin = rng.next() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const angle = spin + i * Math.PI * 2 / n, at = snap({ x: center.x + Math.cos(angle) * .9, z: center.z + Math.sin(angle) * .9 }, 2);
      if (at) plans.push({ at, waypoints: [at], faces: [center], handProp: props[i % props.length], role, yaw: -Math.atan2(center.z - at.z, center.x - at.x) });
    }
  };
  /** A line facing `face` (bus stop, counter queue). */
  const line = (start: Point | null, face: Point | null, n: number, props: (string | null)[]) => {
    if (!start || !face) return;
    const dx = face.x - start.x, dz = face.z - start.z, d = Math.hypot(dx, dz) || 1;
    for (let i = 0; i < n; i++) {
      const at = snap({ x: start.x - dz / d * (i * 1.1 - .5), z: start.z + dx / d * (i * 1.1 - .5) }, 2);
      if (at) plans.push({ at, waypoints: [at], faces: [face], handProp: props[i % props.length], yaw: -Math.atan2(dz, dx) });
    }
  };
  // Hubs first (seated, chatting, queueing, gardening): everyone faces something.
  const patio = anchor('cafe-patio');
  if (patio) { circle({ x: patio.x - 1.5, z: patio.z }, 3, ['coffee', 'phone', null]); circle({ x: patio.x + 2, z: patio.z + 1 }, 2, ['coffee', 'coffee']); }
  const bus = anchor('bus-stop');
  line(bus && snap(bus, 3), bus && { x: bus.x, z: bus.z - 4 }, 3, ['phone', 'bag', null]);
  const counter = anchor('parcel-counter'), depotDoor = anchor('parcel-door');
  if (depotDoor) circle(snap({ x: depotDoor.x + 2.5, z: depotDoor.z + 2 }, 3), 2, ['phone', null]);
  line(counter && snap({ x: counter.x + 3, z: counter.z + 2 }, 3), counter, 2, ['bag', null]);
  for (const [i, door] of doors.entries()) {
    if (i % 3 === 0) circle(snap({ x: door.x + 1.5, z: door.z + (door.z < 0 ? 2 : -2) }, 3), 2, [null, 'phone']);
    else if (i % 3 === 1) {
      // Gardener: water two flower spots beside the door, facing them.
      const a = snap({ x: door.x - 1.6, z: door.z + (door.z < 0 ? 1.4 : -1.4) }, 2), b = a && snap({ x: a.x + 3.2, z: a.z }, 1.5);
      if (a && b) plans.push({ at: a, waypoints: [a, b], faces: [{ x: a.x, z: door.z }, { x: b.x, z: door.z }], handProp: 'watering-can', role: 'bathrobe-neighbor', yaw: 0 });
    }
  }
  for (const name of ['carwash-start', 'garage-door', 'alarm-car-2', 'gate-1', 'gate-3']) {
    const p = anchor(name), at = p && snap({ x: p.x + 2, z: p.z + 2 }, 4);
    if (at && p) plans.push({ at, waypoints: [at], faces: [p], handProp: pick(l1Pedestrians.handProps.slice(0, 3)) });
  }
  // Fill with walkers, joggers and elderly strollers spread over every sidewalk run.
  let r = Math.floor(rng.next() * Math.max(1, runs.length));
  for (let guard = 0; plans.length < count && runs.length && guard < count * 8; guard++) {
    const run = runs[r++ % runs.length], start = Math.floor(rng.next() * run.length), kind = rng.next();
    const span = kind < .2 ? run.length : 2 + Math.floor(rng.next() * 4), points: Point[] = [];
    for (let i = 0; i < span && start + i < run.length; i++) points.push(run[start + i]);
    if (points.length < 2) { const back = run.slice(Math.max(0, start - 3), start + 1); if (back.length < 2) continue; points.splice(0, points.length, ...back); }
    // Keep right: outbound and return legs run 0.45 m apart, so oncoming walkers pass instead of blocking.
    const ux = points[points.length - 1].x - points[0].x, uz = points[points.length - 1].z - points[0].z, ul = Math.hypot(ux, uz) || 1;
    const shift = (p: Point, side: number) => { const q = { x: p.x - uz / ul * .45 * side, z: p.z + ux / ul * .45 * side }; return clear(q) ? q : p; };
    const loop = [...points.map(p => shift(p, 1)), ...points.slice(1, -1).reverse().map(p => shift(p, -1))];
    if (kind < .2) plans.push({ at: loop[0], waypoints: loop, role: 'jogger', jog: true });
    else if (kind < .38) plans.push({ at: loop[0], waypoints: loop, faces: loop.map(p => nearestDoor(p)), model: 'npc.civilian-elderly', handProp: 'cane', role: pick(['bathrobe-neighbor', 'suburban-mom']) });
    else plans.push({ at: loop[0], waypoints: loop, handProp: pick(['bag', 'phone', 'coffee', null, null]) });
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
