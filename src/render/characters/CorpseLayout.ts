import { SpatialHash } from '../../sim/spatial/SpatialHash';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import { staticCollision } from '../../assets/staticCollision';
import type { Aabb } from '../../levels/districts/types';

export const corpsePoses = ['death-back', 'death-side', 'death-crumple'] as const;
export const corpsePose = (id: number) => corpsePoses[Math.abs(Math.imul(id ^ (id >>> 16), 0x45d9f3b)) % corpsePoses.length];
export const corpseYaw = (id: number) => (id * 2.399963229728653) % (Math.PI * 2);
interface RestingPose {
  x: number; y: number; z: number; yaw: number; sourceX: number; sourceZ: number; deadAt: number;
  ax: number; az: number; bx: number; bz: number; radius: number; height: number; body: EntitySnapshot; prone?: number;
}
type DeferredPose = EntitySnapshot['transform'] & { body: EntitySnapshot; deadAt: number; prone?: number };
interface VehicleFootprint { x: number; z: number; c: number; s: number; sx: number; sz: number; floor: number; boxes: readonly Aabb[] }
const layouts = new WeakMap<SimWorld, CorpseLayout>();
/** Native and pedestrian-look bodies share one layout, without movement colliders. */
export function corpseLayout(world: SimWorld): CorpseLayout {
  let layout = layouts.get(world);
  if (!layout) { layout = new CorpseLayout(world); layouts.set(world, layout); }
  return layout;
}
const pointDistanceSquared = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return (x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2;
};
const cross = (x: number, z: number, u: number, v: number) => x * v - z * u;
function segmentDistanceSquared(ax: number, az: number, bx: number, bz: number, p: RestingPose): number {
  const d = cross(bx - ax, bz - az, p.bx - p.ax, p.bz - p.az);
  if (Math.abs(d) > 1e-8) {
    const t = cross(p.ax - ax, p.az - az, p.bx - p.ax, p.bz - p.az) / d;
    const u = cross(p.ax - ax, p.az - az, bx - ax, bz - az) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(pointDistanceSquared(ax, az, p.ax, p.az, p.bx, p.bz), pointDistanceSquared(bx, bz, p.ax, p.az, p.bx, p.bz), pointDistanceSquared(p.ax, p.az, ax, az, bx, bz), pointDistanceSquared(p.bx, p.bz, ax, az, bx, bz));
}
const yawDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export class CorpseLayout {
  readonly bodies = new Map<number, RestingPose>();
  private readonly spatial = new SpatialHash();
  private readonly neighbors: number[] = [];
  private readonly query = { x: 0, z: 0, r: 5 };
  // place() can run for hundreds of newly settled bodies in one view update.
  // Keep its broad-phase scratch storage on the layout instead of allocating
  // several arrays (and one hull wrapper per vehicle) for every corpse.
  private readonly hulls: VehicleFootprint[] = [];
  private readonly nearbyHulls: VehicleFootprint[] = [];
  private readonly hullScratch: VehicleFootprint[] = [];
  private readonly carFootprints = new WeakMap<object, VehicleFootprint>();
  private readonly neighborPoses: (RestingPose | undefined)[] = [];
  private readonly layerPoses: (RestingPose | undefined)[] = [];
  private readonly bestScratch = {} as RestingPose;
  private readonly swept = { x: 0, z: 0 };
  private readonly rootCache = new Float64Array(5);
  private readonly deferred = new Map<number, DeferredPose>();
  private remainingMs = Infinity;
  private revision = -1;
  private epilogue = false;
  private readonly scriptedVehicles: EntitySnapshot[] = [];
  private vehicleDistrict: SimWorld['districts'] | undefined;
  private readonly parkedVehicles: VehicleFootprint[] = [];
  constructor(private readonly world: SimWorld) {}
  /** Keep a landing wave or cure reflow out of one render update. A search
   * finishes atomically; later bodies retain their last pose until next frame. */
  beginFrame(budgetMs = 2): void { this.remainingMs = budgetMs; }
  /** Explicit asset/screenshot readiness also waits for presentation settling. */
  settleAll(): void {
    const remaining = this.remainingMs; this.remainingMs = Infinity;
    try { for (const p of this.deferred.values()) this.place(p.body, p.deadAt, p.prone); }
    finally { this.remainingMs = remaining; }
  }
  audit() {
    const bodies = [...this.bodies.values()], player = this.world.entities.get(1)?.transform;
    let sunkPairs = 0, heapPairs = 0, repeatedPairs = 0;
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (segmentDistanceSquared(a.ax, a.az, a.bx, a.bz, b) >= (a.radius + b.radius - .001) ** 2) continue;
      heapPairs++;
      const lower = a.y <= b.y ? a : b, upper = lower === a ? b : a;
      if (upper.y < lower.y + lower.height - .001) sunkPairs++;
      if (corpsePose(a.body.id) === corpsePose(b.body.id) && yawDistance(a.yaw, b.yaw) < .2) repeatedPairs++;
    }
    return { count: bodies.length, sunkPairs, heapPairs, repeatedPairs,
      maxDisplacementM: Math.max(0, ...bodies.map(p => Math.hypot(p.x - p.sourceX, p.z - p.sourceZ))),
      maxLiftM: Math.max(0, ...bodies.map(p => p.y - (p.body.transform.y - .7))),
      courierClear: !player || bodies.every(p => pointDistanceSquared(player.x, player.z, p.ax, p.az, p.bx, p.bz) >= .949 ** 2) };
  }
  place(e: EntitySnapshot, deadAt = e.infected?.deadAt ?? 0, prone?: number): RestingPose | EntitySnapshot['transform'] {
    const epilogue = this.world.missions?.def.id === 'L10' && !!this.world.missions.state.cureFront;
    if (epilogue !== this.epilogue) {
      this.epilogue = epilogue;
      for (const [id, pose] of this.bodies) this.deferred.set(id, pose);
      this.bodies.clear(); this.spatial.reset();
      this.neighborPoses.fill(undefined); this.layerPoses.fill(undefined);
    }
    if (this.revision !== this.world.entities.revision) {
      for (const [id, pose] of this.bodies) if (this.world.entities.get(id) !== pose.body || pose.body.health.current > 0 || pose.body.hidden) { this.bodies.delete(id); this.spatial.delete(id); }
      for (const [id, pose] of this.deferred) if (this.world.entities.get(id) !== pose.body || pose.body.health.current > 0 || pose.body.hidden) this.deferred.delete(id);
      this.revision = this.world.entities.revision;
      this.scriptedVehicles.length = 0;
      for (const entity of this.world.entities.iterate()) if ((entity.kind === 'setpiece' || entity.traffic || entity.convoy) && entity.archetype.startsWith('veh.') && staticCollision[entity.archetype]) this.scriptedVehicles.push(entity);
    }
    // A blast owns its whole flight, including the last 15 cm above the floor.
    // Searching a ground heap there snapped airborne bodies up into the pile
    // and repeated that search for every moving victim on successive frames.
    // The simulation clears corpseBlast on landing; settle exactly once then.
    if (e.corpseThrown && e.corpseBlast) return { ...e.transform, y: e.transform.y - .7 };
    const player = this.world.entities.get(1)?.transform, previous = this.bodies.get(e.id);
    if (previous?.deadAt === deadAt && previous.sourceX === e.transform.x && previous.sourceZ === e.transform.z
      && (!player || pointDistanceSquared(player.x, player.z, previous.ax, previous.az, previous.bx, previous.bz) >= .95 ** 2)) { this.deferred.delete(e.id); return previous; }
    if (this.remainingMs <= 0) {
      let pending = this.deferred.get(e.id);
      if (!pending || pending.body !== e || pending.deadAt !== deadAt) {
        pending = { ...(previous ?? e.transform), y: previous?.y ?? e.transform.y - .7, yaw: previous?.yaw ?? e.transform.yaw + corpseYaw(e.id), body: e, deadAt, prone };
        this.deferred.set(e.id, pending);
      }
      return pending;
    }
    const start = performance.now();
    try { return this.settle(e, deadAt, prone, epilogue); }
    finally { this.remainingMs -= performance.now() - start; }
  }
  private settle(e: EntitySnapshot, deadAt: number, prone: number | undefined, epilogue: boolean): RestingPose | EntitySnapshot['transform'] {
    const player = this.world.entities.get(1)?.transform;
    const safePlayer = (p: RestingPose) => !player || pointDistanceSquared(player.x, player.z, p.ax, p.az, p.bx, p.bz) >= .95 ** 2;
    let feet = e.transform.y - .7;
    const support = this.world.districts, nav = this.world.infected?.nav;
    if (this.vehicleDistrict !== support) {
      this.vehicleDistrict = support; this.parkedVehicles.length = 0;
      this.neighborPoses.fill(undefined); this.layerPoses.fill(undefined);
      for (const district of support?.districts ?? []) for (const p of district.decay.placements) {
        const shape = p.assetId.startsWith('veh.') && staticCollision[p.assetId]; if (!shape) continue;
        this.parkedVehicles.push({ x: p.position[0] + district.origin[0], z: p.position[2] + district.origin[1], c: Math.cos(p.yaw), s: Math.sin(p.yaw), sx: p.scale[0] || 1, sz: p.scale[2] || 1, floor: p.position[1], boxes: shape.boxes });
      }
    }
    const hulls = this.hulls; hulls.length = 0;
    for (const parked of this.parkedVehicles) hulls.push(parked);
    let dynamicIndex = 0;
    const dynamicHull = (): VehicleFootprint => {
      let hull = this.hullScratch[dynamicIndex];
      if (!hull) this.hullScratch[dynamicIndex] = hull = { x: 0, z: 0, c: 1, s: 0, sx: 1, sz: 1, floor: 0, boxes: [] };
      dynamicIndex++;
      return hull;
    };
    for (const entity of this.scriptedVehicles) if (!entity.hidden) {
      const p = entity.transform;
      const hull = dynamicHull();
      hull.x = p.x; hull.z = p.z; hull.c = Math.cos(p.yaw); hull.s = Math.sin(p.yaw); hull.sx = hull.sz = 1;
      hull.floor = p.y - (entity.traffic || entity.convoy ? .5 : .7); hull.boxes = staticCollision[entity.archetype].boxes; hulls.push(hull);
    }
    for (const car of this.world.vehicles?.cars.values() ?? []) {
      const p = car.entity.transform, def = car.physics.def;
      let hull = this.carFootprints.get(car);
      if (!hull) {
        hull = { x: 0, z: 0, c: 1, s: 0, sx: 1, sz: 1, floor: 0, boxes: [{ min: [-def.length / 2, 0, -def.width / 2], max: [def.length / 2, 0, def.width / 2] }] };
        this.carFootprints.set(car, hull);
      }
      hull.x = p.x; hull.z = p.z; hull.c = Math.cos(p.yaw); hull.s = Math.sin(p.yaw); hull.sx = hull.sz = 1; hull.floor = p.y - .7; hulls.push(hull);
    }
    // A search moves the root at most 6 m; include the whole body and its
    // largest padding too. Test distant hulls once, instead of scanning every
    // parked car in all seven L10 regions for every sampled foot/end point.
    // Preserve hull order: overlapping vehicles retain the same support floor.
    const reach = 6 + Math.max(.15, prone ?? 1.25) + .8 + 1e-6;
    const nearbyHulls = this.nearbyHulls; nearbyHulls.length = 0;
    for (const h of hulls) {
      const dx = e.transform.x - h.x, dz = e.transform.z - h.z;
      const along = dx * h.c - dz * h.s, across = dx * h.s + dz * h.c;
      for (const b of h.boxes) if (along >= Math.min(b.min[0] * h.sx, b.max[0] * h.sx) - reach
        && along <= Math.max(b.min[0] * h.sx, b.max[0] * h.sx) + reach
        && across >= Math.min(b.min[2] * h.sz, b.max[2] * h.sz) - reach
        && across <= Math.max(b.min[2] * h.sz, b.max[2] * h.sz) + reach) { nearbyHulls.push(h); break; }
    }
    const sourceFeet = feet;
    const vehicleFloor = (x: number, z: number, padding = .65): number | undefined => {
      for (const h of nearbyHulls) {
        if (h.floor > sourceFeet + .6) continue;
        const dx = x - h.x, dz = z - h.z, along = (dx * h.c - dz * h.s) / h.sx, across = (dx * h.s + dz * h.c) / h.sz;
        for (const b of h.boxes) if (along > b.min[0] - padding / Math.abs(h.sx) && along < b.max[0] + padding / Math.abs(h.sx) && across > b.min[2] - padding / Math.abs(h.sz) && across < b.max[2] + padding / Math.abs(h.sz)) return h.floor;
      }
      return undefined;
    };
    const vehicleClear = (x: number, z: number, padding = .65) => vehicleFloor(x, z, padding) === undefined;
    const floor = vehicleFloor(e.transform.x, e.transform.z, 0), startsOnVehicle = floor !== undefined;
    if (startsOnVehicle) feet = support?.supportBelow(e.transform.x, e.transform.z, floor) ?? floor;
    if (e.corpseThrown && !startsOnVehicle && feet > (support?.supportBelow(e.transform.x, e.transform.z, feet) ?? 0) + .15) return { ...e.transform, y: feet };
    const initialYaw = e.transform.yaw + corpseYaw(e.id), direction = prone === undefined ? 1 : -1;
    const length = prone ?? 1.25, radius = prone === undefined ? .6 : .8, height = prone === undefined ? .22 : .32;
    const pose: RestingPose = { x: e.transform.x, y: feet, z: e.transform.z, yaw: initialYaw, sourceX: e.transform.x, sourceZ: e.transform.z, deadAt,
      ax: 0, az: 0, bx: 0, bz: 0, radius, height, body: e, prone };
    // The four orientations at one root share the same spatial query. The
    // layout cannot change during this synchronous search; preserve bucket order.
    // Captured mutable doubles live in boxed closure slots in V8. Dense
    // searches update these millions of times; retain unboxed scratch instead.
    const roots = this.rootCache; roots.fill(NaN);
    const neighbors = this.neighborPoses, layers = this.layerPoses;
    let neighborCount = 0, layerCount = 0;
    // Clearing an array's length to zero also discards its V8 backing store.
    // Thousands of dense-pile roots must reuse capacity, not just the array
    // objects. The visitor avoids a second growing/truncated ID buffer.
    const collectNeighbor = (id: number): void => { if (id !== e.id) neighbors[neighborCount++] = this.bodies.get(id)!; };
    const ownPose = corpsePose(e.id);
    // The four orientations at one root share its hull, sweep and support.
    // Dense piles search hundreds of roots; repeating these queries per yaw
    // made the zoo's settling waves block the view update.
    let rootClear = false;
    const evaluate = (x: number, z: number, yaw: number, supported = true): RestingPose | undefined => {
      if (x !== roots[0] || z !== roots[1]) {
        roots[0] = x; roots[1] = z; rootClear = vehicleClear(x, z);
        // A body falling off a hull does not need a route from its roof.
        if (rootClear && nav && !startsOnVehicle) {
          const swept = this.swept; swept.x = e.transform.x; swept.z = e.transform.z;
          nav.move(swept, x - swept.x, z - swept.z, Math.min(.3, e.combat?.radius ?? .3));
          rootClear = Math.hypot(swept.x - x, swept.z - z) <= .01;
        }
        roots[2] = NaN;
      }
      if (!rootClear) return;
      const dx = -Math.cos(yaw) * direction, dz = Math.sin(yaw) * direction;
      pose.x = x; pose.z = z; pose.yaw = yaw;
      pose.ax = x - dx * .15; pose.az = z - dz * .15;
      pose.bx = x + dx * length; pose.bz = z + dz * length;
      if (!vehicleClear(pose.ax, pose.az, radius) || !vehicleClear(pose.bx, pose.bz, radius)) return;
      if (!safePlayer(pose)) return;
      if (Number.isNaN(roots[2])) roots[2] = support?.supportBelow(x, z, feet) ?? feet;
      pose.y = roots[2];
      if (supported) for (let sample = 0; sample < 3; sample++) {
        const t = sample * .5;
        const px = pose.ax + (pose.bx - pose.ax) * t, pz = pose.az + (pose.bz - pose.az) * t;
        if (!nav?.clear(px, pz, radius) || support && Math.abs(support.supportBelow(px, pz, feet) - feet) > .3) return;
      }
      if (x !== roots[3] || z !== roots[4]) {
        this.query.x = roots[3] = x; this.query.z = roots[4] = z;
        neighborCount = 0;
        this.spatial.query(this.query, this.neighbors, false, collectNeighbor);
      }
      const minX = Math.min(pose.ax, pose.bx), maxX = Math.max(pose.ax, pose.bx), minZ = Math.min(pose.az, pose.bz), maxZ = Math.max(pose.az, pose.bz);
      layerCount = 0;
      for (let n = 0; n < neighborCount; n++) {
        const other = neighbors[n]!;
        // A separated capsule AABB cannot overlap. Keep a small margin so this
        // only skips definite misses; surviving pairs use the exact old distance.
        const reach = radius + other.radius + 1e-6;
        if (maxX < Math.min(other.ax, other.bx) - reach || minX > Math.max(other.ax, other.bx) + reach
          || maxZ < Math.min(other.az, other.bz) - reach || minZ > Math.max(other.az, other.bz) + reach) continue;
        if (segmentDistanceSquared(pose.ax, pose.az, pose.bx, pose.bz, other) >= (radius + other.radius) ** 2) continue;
        if (corpsePose(other.body.id) === ownPose && yawDistance(yaw, other.yaw) < .2) return;
        // Stable insertion into the used prefix retains the old height sort
        // and bucket tie order without resizing the scratch backing store.
        let at = layerCount++;
        while (at > 0 && layers[at - 1]!.y > other.y) { layers[at] = layers[at - 1]; at--; }
        layers[at] = other;
      }
      // Fill the lowest free layer. Always going above the highest neighbour
      // made a chain of touching feet climb into an artificial body tower.
      for (let i = 0; i < layerCount; i++) {
        const other = layers[i]!;
        if (pose.y + height > other.y + .001 && pose.y < other.y + other.height - .001) pose.y = other.y + other.height;
      }
      // Reuse search scratch; only the winning pose needs an owned record.
      return pose;
    };
    let best: RestingPose | undefined;
    // First prefer an unoccupied footprint, nearest to the death position.
    // Combat bodies stay within 1 m. Once the L10 fight ends, use the surrounding
    // floor (up to 4 m) so the final collapsed crowd reads as individual people.
    // L4-17 (fix70-v): a war piles hundreds of bodies on the same spot; stacking them in the 1 m
    // search ring built a 2-3 m mound. A spot already tall (> 2 layers) keeps searching outward in
    // wider 0.3 m rings (to 5.5 m) for a free footprint, so piles spread sideways. Bodies are never removed.
    const mound = feet + .45;
    for (let ring = 0; ring <= (epilogue ? 22 : startsOnVehicle ? 30 : 20); ring++) {
      if (ring > (epilogue ? 10 : 5) && !startsOnVehicle && best && best.y <= mound) break;
      const distance = epilogue ? ring * .4 : startsOnVehicle || ring <= 5 ? ring * .2 : 1 + (ring - 5) * .3, samples = ring ? Math.max(16, Math.min(48, ring * 8)) : 1;
      for (let i = 0; i < samples; i++) {
        const angle = initialYaw + i * Math.PI * 2 / samples, x = e.transform.x + Math.cos(angle) * distance, z = e.transform.z + Math.sin(angle) * distance;
        for (let turn = 0; turn < 4; turn++) {
          const candidate = evaluate(x, z, initialYaw + turn * 2.399963229728653);
          if (!candidate) continue;
          if (candidate.y <= feet + .05) { Object.assign(this.bestScratch, candidate); best = this.bestScratch; break; }
          if (!best || candidate.y < best.y - .001) { Object.assign(this.bestScratch, candidate); best = this.bestScratch; }
        }
        if (best && best.y <= feet + .05) break;
      }
      if (best && best.y <= feet + .05) break;
    }
    // A narrow doorway can fit the actor but reject a conservative full-body
    // strip. Keep the bounded root and heap layer, never teleport it elsewhere.
    if (!best) for (let i = 0; i < 80 && !best; i++) {
      const angle = initialYaw + i * Math.PI * 2 / 80;
      best = evaluate(e.transform.x + Math.cos(angle), e.transform.z + Math.sin(angle), angle + Math.PI / 2, false);
    }
    if (!best) best = evaluate(e.transform.x, e.transform.z, initialYaw + .7, false) ?? pose;
    // Retain one stable result for this body; candidate exploration above
    // reuses bestScratch instead of allocating on every improving root.
    const placed = { ...best };
    this.deferred.delete(e.id);
    this.bodies.set(e.id, placed); this.spatial.set(e.id, placed.x, placed.z); return placed;
  }
}
