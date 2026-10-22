import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { missionIds } from '../../../src/levels/missions';
import { preset } from '../../../src/sim/progression/Campaign';
import physicsAssets from '../../../src/data/physicsAssets';
import { l4, l4Route, l4RoutePose, l4ConvoyStations } from '../../../src/data/l4';
import { l7Departure } from '../../../src/data/l7';
import { emptyInput } from '../../../src/input/InputFrame';
import { bicycleGeometry } from '../../../src/data/bicycleGeometry';
import { seatAnchor, seatSpecs, sitHipHeight } from '../../../src/sim/npc/seats';
import { l4PerimeterWalls } from '../../../src/data/l4Perimeter';
import { oracle, obbHitsAabb } from './oracles';
import { markerAnchor } from '../../../src/sim/missions/markerAnchor';
import { loadLevel } from './world';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { highwayPoint } from '../../../src/levels/L3/highway';
import { inside } from '../../../src/levels/districts/validate';
import { ObjectiveMarker } from '../../../src/render/ObjectiveMarker';
import { objectiveText } from '../../../src/sim/missions/objectiveText';
import { l2TruckPath } from '../../../src/data/l2';
import { vehicleDef } from '../../../src/data/vehicles';
import { findDoorway } from '../../../src/sim/missions/doorRoute';
import type { EntitySnapshot } from '../../../src/sim/world/types';

const layouts = new Map(readdirSync('public/assets/layouts').filter(x => x.endsWith('.layout.json')).map(x => [x.slice(0, -12), JSON.parse(readFileSync(`public/assets/layouts/${x}`, 'utf8')) as DistrictLayout]));
const sceneActor = (e: EntitySnapshot) => !!(e.civilian?.story || e.civilian?.ally || e.civilian?.survivor || e.civilian?.routine === 'staff');

let morning: Promise<{ seats: string[]; actors: string[]; cast: Record<string, number> }> | undefined;
function morningSweep() {
  return morning ??= (async () => {
    const failures = new Set<string>(), actorFailures = new Set<string>();
    const cast: Record<string, number> = {};
    for (const level of missionIds) for (const tier of ['high', 'low'] as const) {
      const world = await loadLevel(level, 1, tier);
      const tracked = new Map<number, { seen: boolean }>();
      for (const e of world.entities.iterate()) if (sceneActor(e)) tracked.set(e.id, { seen: !e.hidden && !e.pendingAdmission });
      cast[`${level}/${tier}`] = tracked.size;
      const propById = new Map(world.props!.items.map(p => [p.id, p]));
      const placementById = new Map<string, DistrictLayout['placements'][number]>(world.districts!.districts.flatMap(d => d.layout.placements.map(p => [`${d.id}/${p.id}`, p] as const)));
      for (let i = 0; i < 90 * 60; i++) {
        world.update();
        for (const [id, watch] of tracked) {
          const e = world.entities.get(id);
          if (!e) { actorFailures.add(`${level}/${tier}: scripted actor ${id} removed before its exit`); continue; }
          if (!e.civilian || e.health.current <= 0 || e.civilian.state === 'finished' || e.civilian.survivor?.mode === 'hidden' || e.passengerOf !== undefined || e.corpse || e.infected) { tracked.delete(id); continue; }
          if (watch.seen && oracle.actor({ inScriptedScene: true, exists: true, hidden: !!e.hidden })) actorFailures.add(`${level}/${tier}: scripted actor ${id} (${e.civilian.story?.clip ?? e.civilian.ally?.role ?? 'cast'}) hidden mid-scene at tick ${world.tick}`);
          if (!e.hidden && !e.pendingAdmission) watch.seen = true;
        }
        if (i % 60) continue;
        for (const e of world.entities.iterate()) {
          const c = e.civilian, action = c?.schedule?.[c.scheduleStep ?? 0];
          if (!c) continue;
          if (sceneActor(e) && !tracked.has(e.id)) tracked.set(e.id, { seen: !e.hidden && !e.pendingAdmission });
          if (e.hidden || e.health.current <= 0 || !(c?.story?.clip === 'npc-sit' || action?.activity === 'sit' && c.activityUntil)) continue;
          const target = action?.seat ?? e.transform;
          const prop = action?.seatProp ? propById.get(action.seatProp) : world.props!.items.filter(p => seatSpecs[p.assetId] && Math.hypot(p.pose.p[0] - target.x, p.pose.p[2] - target.z) < 1.2).sort((a, b) => Math.hypot(a.pose.p[0] - target.x, a.pose.p[2] - target.z) - Math.hypot(b.pose.p[0] - target.x, b.pose.p[2] - target.z))[0];
          if (!prop || !seatSpecs[prop.assetId] || !world.entities.get(prop.entityId) || process.env.QA_INVARIANTS_BREAK === 'seats') { if (oracle.seat({ sitting: true, hasSeat: false, supported: false })) failures.add(`${level}/${tier}/${e.id}: no seat (${action?.seatProp ?? c?.story?.clip})`); }
          else {
            const placement = placementById.get(prop.id);
            const yaw = 2 * Math.atan2(prop.pose.q[1], prop.pose.q[3]);
            const expected = placement && seatAnchor(prop.assetId, prop.pose.p, yaw, placement.scale);
            const dx = target.x - prop.pose.p[0], dz = target.z - prop.pose.p[2];
            const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw), localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
            // Bench seats allow multiple people along their length; test against the actual support footprint, not only its center anchor.
            const actualHipY = e.transform.y - .7 + (action?.seatLift ?? 0) + sitHipHeight;
            const supported = !!expected && Math.abs(localX - seatSpecs[prop.assetId].hipX * placement!.scale[0]) <= .2 && Math.abs(localZ) <= .95 && Math.abs(actualHipY - expected.y) <= .2;
            if (oracle.seat({ sitting: true, hasSeat: true, supported })) failures.add(`${level}/${tier}/${e.id}: ${JSON.stringify({ asset: prop.assetId, seat: target, localX, localZ, actualHipY, expected })}`);
          }
        }
      }
      world.dispose();
    }
    return { seats: [...failures], actors: [...actorFailures], cast };
  })();
}

describe('automatic regression invariants', () => {
  test('2 seated actors: every active sit/bench pose across L1–L10 and both quality tiers has seat support', async () => {
    const result = await morningSweep();
    expect(result.seats.slice(0, 20), `${result.seats.length} seat failures; P1-112`).toEqual([]);
  }, 480_000);

  test('3 scripted actors: all initial cast, depot clerk and lab technician persist until their scripted exits', async () => {
    const morning = await morningSweep();
    const world = await loadLevel('L1', 1), mission = world.missions!;
    // Run the same L1 story controller used by the depot trigger; it stays private in production.
    (mission as unknown as { l1: { story: { pickup(): void } } }).l1.story.pickup();
    const clerkId = mission.state.l1!.clerkId!, clerkHome = { ...mission.state.l1!.clerkRoute![0] };
    const missing = new Set<string>(); let seen = false;
    for (let i = 0; i < 180 * 60; i++) {
      world.update();
      const state = world.missions?.state.l1, id = state?.clerkId;
      if (state?.beat?.id === 'pickup') {
        const actor = world.entities.get(id ?? 0);
        if (actor && seen && process.env.QA_INVARIANTS_BREAK === 'actors') actor.hidden = true;
        if (actor && !actor.pendingAdmission && !actor.hidden) seen = true;
        const home = state.clerkRoute?.[0], atScriptedExit = actor?.civilian?.story?.clip === 'npc-walk' && !!home && Math.hypot(actor.transform.x - home.x, actor.transform.z - home.z) < .5;
        if (seen && oracle.actor({ inScriptedScene: !atScriptedExit, exists: !!actor, hidden: !!actor?.hidden })) missing.add(`tick ${world.tick}: clerk ${id ?? 'missing'} ${actor ? `hidden=${actor.hidden}, pending=${!!actor.pendingAdmission}, pos=${actor.transform.x.toFixed(2)},${actor.transform.z.toFixed(2)}` : 'entity missing'}`);
      }
      if (state?.beatsDone?.includes('pickup') && !state.beat) break;
    }
    const clerkEnd = world.entities.get(clerkId), pickupDone = mission.state.l1!.beatsDone?.includes('pickup');
    const returnedM = clerkEnd ? Math.hypot(clerkEnd.transform.x - clerkHome.x, clerkEnd.transform.z - clerkHome.z) : Infinity;
    world.dispose();
    expect(seen, 'P1-109: clerk becomes visible during the scripted exchange').toBe(true);
    expect(pickupDone, 'clerk scene reaches its authored exit').toBe(true);
    expect(returnedM, 'clerk physically returns to the depot before the scene ends').toBeLessThanOrEqual(.5);
    expect([...missing], 'P1-109: actor must remain until the scripted exit').toEqual([]);
    expect(mission.def.steps.length).toBeGreaterThan(0);
    const lab = await loadLevel('L1', 1);
    try {
      const m = lab.missions!, state = m.state.l1!, player = lab.entities.get(1)!;
      for (const [id, step] of Object.entries(m.state.steps)) step.status = id === 'deliver' ? 'active' : id === 'pickup' ? 'completed' : 'pending';
      state.carrying = true;
      Object.assign(player.transform, m.def.anchors['lab-door']);
      lab.physics.playerBody!.setTranslation(player.transform, true); lab.physics.playerBody!.setNextKinematicTranslation(player.transform);
      const id = state.techId, doorway = findDoorway(lab, 'bld.clinic-annex', m.def.anchors['lab-exit-front']); let shown = false;
      for (let i = 0; i < 120 * 60 && !state.delivered; i++) {
        lab.applyInput({ ...emptyInput(), interact: i === 0 }, 'keyboard'); lab.update();
        const actor = lab.entities.get(id);
        if (state.handoverAt && actor && !actor.pendingAdmission && !actor.hidden) shown = true;
        const outside = !doorway || !!actor && (actor.transform.x - doorway.door.x) * doorway.out.x + (actor.transform.z - doorway.door.z) * doorway.out.z > .05;
        // Interior occlusion before emergence / after crossing back through the door is a scripted entrance/exit.
        // A missing entity, or a hidden exterior actor during either walking leg or the handover, is a regression.
        if (state.handoverAt && !state.delivered && (!actor || outside && actor.hidden)) missing.add(`technician ${id} disappeared at tick ${lab.tick}`);
      }
      expect(shown, 'technician visible during handover').toBe(true);
      expect(state.delivered, 'technician reaches scripted return/door exit').toBe(true);
      const returned = lab.entities.get(id), home = m.def.anchors['lab-tech-spawn'];
      expect(returned && Math.hypot(returned.transform.x - home.x, returned.transform.z - home.z), 'technician physically returns inside before handover ends').toBeLessThanOrEqual(.5);
      expect([...morning.actors, ...missing].slice(0, 20), `actors invariant: ${morning.actors.length + missing.size} missing frames; cast ${JSON.stringify(morning.cast)}`).toEqual([]);
    } finally { lab.dispose(); }
  }, 480_000);

  test('4 vehicles: scripted route and stop poses have no overlap with registered solids', async () => {
    const layout = layouts.get('D-FAIR')!, solids = layout.colliders.filter(c => !c.walkable && /^(bld\.|prop\.(?:.*fence|.*barrier)|l4-)/.test(c.id) && !c.id.includes('hedge')).map(c => ({ id: c.id, aabb: c.aabb }));
    for (const wall of l4PerimeterWalls) solids.push({ id: wall.id, aabb: { min: [wall.x - wall.halfX, wall.y - wall.halfY, wall.z - wall.halfZ], max: [wall.x + wall.halfX, wall.y + wall.halfY, wall.z + wall.halfZ] } });
    const tank = physicsAssets['veh.tank'];
    const samples: { id: string; x: number; z: number; yaw: number; box?: { min: number[]; max: number[] }; baseY?: number; vehicleId?: string }[] = [];
    for (let i = 1; i < l4.tank.path.length; i++) {
      const [x0, z0] = l4.tank.path[i - 1], [x1, z1] = l4.tank.path[i], length = Math.hypot(x1 - x0, z1 - z0), yaw = -Math.atan2(z1 - z0, x1 - x0);
      for (let d = 0; d <= length; d += .25) samples.push({ id: `tank-route-${i}-${d.toFixed(2)}`, x: x0 + (x1 - x0) * d / length, z: z0 + (z1 - z0) * d / length, yaw });
    }
    const stop = l4.tank.path.at(-1)!;
    // The hull turns while firing at the hold pose: check its full swept rotation as well as the approach tangent.
    for (let a = 0; a < 24; a++) samples.push({ id: `tank-stop-${a}`, x: stop[0], z: stop[1], yaw: a * Math.PI / 12 });
    const route = l4Route(), stations = l4ConvoyStations(route.length);
    for (const [i, vehicle] of l4.convoy.vehicles.entries()) {
      for (const box of physicsAssets[vehicle.asset as keyof typeof physicsAssets].boxes) {
        for (let s = stations.start[i]; s <= stations.end[i]; s += .25) samples.push({ id: `convoy-${vehicle.id}-${s.toFixed(2)}`, ...l4RoutePose(route, s), box, baseY: .7 });
        samples.push({ id: `convoy-${vehicle.id}-stop`, ...l4RoutePose(route, stations.end[i]), box, baseY: .7 });
      }
    }
    for (const v of layout.placements.filter(p => p.assetId.startsWith('veh.'))) {
      const physical = physicsAssets[v.assetId as keyof typeof physicsAssets];
      for (const [i, b] of physical?.boxes.entries() ?? []) {
        const lx = (b.min[0] + b.max[0]) / 2, lz = (b.min[2] + b.max[2]) / 2;
        samples.push({ id: `${v.id}-box-${i}`, x: v.position[0] + Math.cos(v.yaw) * lx + Math.sin(v.yaw) * lz, z: v.position[2] - Math.sin(v.yaw) * lx + Math.cos(v.yaw) * lz, yaw: v.yaw, box: b, baseY: v.position[1], vehicleId: v.id });
      }
    }
    const conflicts = new Set<string>();
    for (const pose of samples) for (const solid of solids) for (const box of pose.box ? [pose.box] : tank.boxes) {
      if (pose.vehicleId === solid.id) continue;
      // Layout collision boxes are in district-local coordinates; tank route coordinates share D-FAIR origin.
      const isTank = pose.id.startsWith('tank-');
      const halfX = (box.max[0] - box.min[0]) / 2, halfZ = (box.max[2] - box.min[2]) / 2;
      const baseY = pose.baseY ?? (isTank ? .7 : 0), vertical = [box.min[1] + baseY, box.max[1] + baseY];
      const lx = pose.vehicleId ? 0 : (box.min[0] + box.max[0]) / 2, lz = pose.vehicleId ? 0 : (box.min[2] + box.max[2]) / 2;
      const x = pose.x + Math.cos(pose.yaw) * lx + Math.sin(pose.yaw) * lz, z = pose.z - Math.sin(pose.yaw) * lx + Math.cos(pose.yaw) * lz;
      if (oracle.vehicle(obbHitsAabb(x, z, pose.yaw, halfX, halfZ, vertical[0], vertical[1], solid.aabb))) conflicts.add(`${pose.id.split('-').slice(0, 3).join('-')} overlaps ${solid.id}`);
    }
    const world = await loadLevel('L1', 1);
    try {
      const bike = world.vehicles!.bicycle.entity!, player = world.entities.get(1)!;
      const obstacles = world.districts!.districts.flatMap(d => d.decay.colliders.filter(c => !c.walkable && /bld\.|fence|barrier/.test(c.id) && !/hedge/.test(c.id)).map(c => ({ id: c.id, aabb: { min: [c.aabb.min[0] + d.origin[0], c.aabb.min[1], c.aabb.min[2] + d.origin[1]], max: [c.aabb.max[0] + d.origin[0], c.aabb.max[1], c.aabb.max[2] + d.origin[1]] } })));
      const points = [[-70.5, 46.99], ...world.vehicles!.bicycle.parkPoints.map(p => [p.x, p.z]), ...world.vehicles!.bicycle.noBikeZones.flatMap(zone => zone.polygon.map(p => [p.x, p.z]))];
      for (const [x, z] of points) for (let a = 0; a < 8; a++) {
        const heading = a * Math.PI / 4;
        if (!world.infected!.nav.clear(x, z, .35, false, bike.id) || world.vehicles!.bicycle.inNoBikeZone({ x, z })) continue;
        Object.assign(player.transform, { x, z }); Object.assign(bike.bicycle!, { heading, mounted: true, lockUntil: 0 });
        Object.assign(bike.transform, { x, z, y: world.districts!.pavingHeight(x, z), yaw: -heading });
        Object.assign(world.vehicles!.bicycle as unknown as { lastOutside: { x: number; z: number }; mountedInPark: boolean }, { lastOutside: { x, z }, mountedInPark: false });
        world.vehicles!.bicycle.filter({ ...emptyInput(), interact: true });
        if (bike.bicycle!.mounted) { conflicts.add(`bike at ${x},${z}: dismount failed`); continue; }
        const p = bike.transform, centre = (bicycleGeometry.minX + bicycleGeometry.maxX) / 2;
        for (const solid of obstacles) {
          if (obbHitsAabb(p.x + Math.cos(p.yaw) * centre, p.z - Math.sin(p.yaw) * centre, p.yaw, (bicycleGeometry.maxX - bicycleGeometry.minX) / 2, bicycleGeometry.halfWidth, p.y, p.y + bicycleGeometry.height, solid.aabb)) conflicts.add(`bike park at ${x},${z}/${a} intersects ${solid.id}`);
          if (/fence|barrier/.test(solid.id)) {
            const dx = p.x - x, dz = p.z - z, length = Math.hypot(dx, dz);
            if (length > .1 && obbHitsAabb((x + p.x) / 2, (z + p.z) / 2, -Math.atan2(dz, dx), length / 2, .001, .1, 1, solid.aabb)) conflicts.add(`bike park at ${x},${z}/${a} crossed ${solid.id}`);
          }
        }
      }
    } finally { world.dispose(); }
    const l7world = await loadLevel('L7', 1);
    try {
      const box = physicsAssets['veh.evac-bus'].boxes[0];
      for (const district of l7world.districts!.districts) for (const solid of district.decay.colliders.filter(c => !c.walkable && /bld\.|fence|barrier/.test(c.id) && !/hedge/.test(c.id))) {
        const aabb = { min: [solid.aabb.min[0] + district.origin[0], solid.aabb.min[1], solid.aabb.min[2] + district.origin[1]], max: [solid.aabb.max[0] + district.origin[0], solid.aabb.max[1], solid.aabb.max[2] + district.origin[1]] };
        for (let x = l7Departure.lane.fromX; x <= l7Departure.lane.toX; x += .25) if (obbHitsAabb(x, l7Departure.lane.z, 0, (box.max[0] - box.min[0]) / 2, (box.max[2] - box.min[2]) / 2, box.min[1] + .7, box.max[1] + .7, aabb)) { conflicts.add(`L7 bus route overlaps ${solid.id}`); break; }
      }
    } finally { l7world.dispose(); }
    const l2world = await loadLevel('L2', 1);
    try {
      const truck = vehicleDef('vehicle.fire-engine'), shape = { min: [-truck.length / 2, -.3, -truck.width / 2], max: [truck.length / 2, .3, truck.width / 2] };
      for (const district of l2world.districts!.districts) for (const solid of district.decay.colliders.filter(c => !c.walkable && /bld\.|fence|barrier/.test(c.id) && !/hedge/.test(c.id))) {
        const aabb = { min: [solid.aabb.min[0] + district.origin[0], solid.aabb.min[1], solid.aabb.min[2] + district.origin[1]], max: [solid.aabb.max[0] + district.origin[0], solid.aabb.max[1], solid.aabb.max[2] + district.origin[1]] };
        for (const p of l2TruckPath) if (obbHitsAabb(p.x, p.z, p.yaw, (shape.max[0] - shape.min[0]) / 2, (shape.max[2] - shape.min[2]) / 2, shape.min[1] + .7, shape.max[1] + .7, aabb)) { conflicts.add(`L2 truck route overlaps ${solid.id}`); break; }
      }
    } finally { l2world.dispose(); }
    expect([...conflicts].slice(0, 30), `vehicles invariant: route, stop and dismount intersections (${conflicts.size})`).toEqual([]);
  });

  test('6 objectives: every mission step has a visible destination marker or explicit HUD-only rule', async () => {
    const violations: string[] = [];
    for (const id of missionIds) {
      const world = await loadLevel(id, 1), mission = world.missions!;
      const marker = new ObjectiveMarker(world);
      for (const step of mission.def.steps) {
        // Select this step independently; a convoy's initial lock is not the quartermaster/bar step's state.
        world.storyLock = null;
        const state = mission.state.steps;
        for (const def of mission.def.steps) state[def.id].status = def.id === step.id ? 'pending' : 'completed';
        const controller = mission as unknown as { markerObjective: string | null; pendingMarker: string | null; activate(): void };
        controller.markerObjective = null; controller.pendingMarker = null;
        const start = vi.spyOn(mission as unknown as { satisfied(): boolean }, 'satisfied').mockReturnValue(true);
        controller.activate(); start.mockRestore();
        const hasMarkerAnchor = !!mission.def.anchors[step.anchor];
        if (!hasMarkerAnchor) violations.push(`${id}/${step.id}: missing anchor`);
        if (!objectiveText(mission, step.text).trim()) violations.push(`${id}/${step.id}: missing objective text`);
        const override = step.onStart?.find(a => a.kind === 'marker');
        const expectedMarker = override?.kind === 'marker' ? override.anchor : step.waypoint === false ? null : step.anchor;
        if (mission.state.marker !== expectedMarker) violations.push(`${id}/${step.id}: marker ${mission.state.marker} should be ${expectedMarker}`);
        const markerResolves = step.waypoint === false || !!markerAnchor(mission);
        if (oracle.objective({ markerVisible: markerResolves, visibleAtMs: 0 })) violations.push(`${id}/${step.id}: no state-visible waypoint in the start tick`);
        if (step.waypoint !== false) {
          marker.update(false);
          if (!marker.visible) violations.push(`${id}/${step.id}: actual ObjectiveMarker suppressed at activation`);
          // A pull-back is presentation state, so it must not remove guidance while any waypoint objective is active.
          // Apply the same 120-tick overlay to every step, including the known P1-114 checkpoint.
          for (let tick = 0; tick <= 120; tick++) { marker.update(true); world.tick++; }
          if (!marker.visible || process.env.QA_INVARIANTS_BREAK === 'objectives') violations.push(`${id}/${step.id}: objective marker hidden beyond 2 s during camera pull-back`);
        }
      }
      marker.dispose();
      world.dispose();
    }
    expect(violations, 'P1-114: objective routes and marker anchors must exist').toEqual([]);
    expect(preset('L10-default')).toBeTruthy(); // document the campaign-ready level preset used for late levels
  }, 300_000);

  test('7 walkable ground: every authored raised walkable surface edge follows sim ground within 20 cm', async () => {
    const errors: string[] = [];
    for (const level of missionIds) {
      const world = await loadLevel(level, 1);
      for (const district of world.districts!.districts) for (const col of district.decay.colliders) {
        if (!col.walkable || col.aabb.max[1] < .05 || col.id.includes('/highway-')) continue;
        const x = (col.aabb.min[0] + col.aabb.max[0]) / 2 + district.origin[0], z = (col.aabb.min[2] + col.aabb.max[2]) / 2 + district.origin[1];
        // Stacked paving/supports have one exposed top: the lower slab isn't the drawn walking surface.
        const local = [x - district.origin[0], z - district.origin[1]] as [number, number];
        const drawnY = Math.max(col.aabb.max[1], ...district.decay.colliders.filter(c => c.walkable && local[0] >= c.aabb.min[0] && local[0] <= c.aabb.max[0] && local[1] >= c.aabb.min[2] && local[1] <= c.aabb.max[2]).map(c => c.aabb.max[1]), ...district.layout.surfaces.filter(s => inside(local, s.polygon)).map(s => s.height ?? 0));
        const simY = world.districts!.pavingHeight(x, z);
        if (oracle.ground({ drawnY, simY })) errors.push(`${level}/${district.id}/${col.id}: ${simY.toFixed(2)} vs ${drawnY.toFixed(2)}`);
      }
      for (const district of world.districts!.districts) {
        // Sample every drawn surface route: 0.5 m around its boundary and through its centroid.
        for (const surface of district.layout.surfaces) for (let i = 0; i < surface.polygon.length; i++) {
          const a = surface.polygon[i], b = surface.polygon[(i + 1) % surface.polygon.length], n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / .5));
          const cx = surface.polygon.reduce((sum, p) => sum + p[0], 0) / surface.polygon.length, cz = surface.polygon.reduce((sum, p) => sum + p[1], 0) / surface.polygon.length;
          for (let j = 0; j <= n; j++) {
            const edgeX = a[0] + (b[0] - a[0]) * j / n, edgeZ = a[1] + (b[1] - a[1]) * j / n;
            const x = edgeX + (cx - edgeX) * .01, z = edgeZ + (cz - edgeZ) * .01;
            // A material surface on a bench/roof is not an authored walkable route.
            if (!world.infected!.nav.clear(x + district.origin[0], z + district.origin[1], .2)) continue;
            const expected = surface.height ?? 0, got = world.districts!.pavingHeight(x + district.origin[0], z + district.origin[1]);
            if (got < expected - .2) errors.push(`${level}/${district.id}/${surface.surface}: unsupported drawn paving at ${x},${z}`);
          }
        }
        // Nonplanar route geometry must use the authored deck equation, never its axis-aligned collider top.
        for (const p of district.layout.placements.filter(p => p.assetId === 'kit.highway-onramp')) for (let i = 0; i <= 96; i++) {
          const t = i / 96;
          for (const offset of [-2.2, -1.1, 0, 1.1, 2.2]) {
            const [x, drawnY, z] = highwayPoint(p, t, offset), simY = world.districts!.groundHeight(x + district.origin[0], z + district.origin[1]);
            if (oracle.ground({ drawnY, simY })) errors.push(`${level}/${p.id}: deck t=${t.toFixed(2)} offset=${offset} walk=${simY.toFixed(2)} drawn=${drawnY.toFixed(2)}`);
          }
          for (const offset of [-4.5, -3.3, 3.3, 4.5]) {
            const [x, y, z] = highwayPoint(p, t, offset), h = world.districts!.groundHeight(x + district.origin[0], z + district.origin[1]);
            if (t > .06 && y > 1 && h > 1 && h > y - 1) errors.push(`${level}/${p.id}: phantom support outside rail t=${t.toFixed(2)} offset=${offset}`);
          }
        }
        if (level === 'L3') {
          // Authored tilted-rail/span joints from the L3 support regression: both sides of both joins.
          for (const [x, z] of [[180.25, -.95], [166.75, .95], [180.9, -.5], [166.1, .5]]) {
            const drawnY = 5.7, simY = world.districts!.groundHeight(x + district.origin[0], z + district.origin[1]);
            if (oracle.ground({ drawnY, simY })) errors.push(`${level}: deck joint wedge (${x}, ${z}) walk=${simY.toFixed(2)} drawn=${drawnY}`);
          }
        }
      }
      world.dispose();
    }
    expect(errors.slice(0, 20), `${errors.length} walkable height errors`).toEqual([]);
  }, 300_000);
});
