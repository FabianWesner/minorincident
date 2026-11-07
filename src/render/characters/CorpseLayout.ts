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
interface SearchState {
  e: EntitySnapshot; player: EntitySnapshot['transform'] | undefined;
  nav: NonNullable<SimWorld['infected']>['nav'] | undefined; support: SimWorld['districts'];
  startsOnVehicle: boolean; feet: number; direction: number; length: number; radius: number; height: number;
  pose: RestingPose; numeric: Float64Array; ownPose: string;
  vehicleClear(x: number, z: number, padding?: number): boolean;
  neighbors: (RestingPose | undefined)[]; layers: (RestingPose | undefined)[];
  spatial: SpatialHash; query: { x: number; z: number; r: number }; ids: number[]; swept: { x: number; z: number };
  collectNeighbor(id: number): void; rootX: number; rootZ: number; rootClear: boolean; rootFloor: number;
  queriedX: number; queriedZ: number; neighborCount: number; rootChecked: boolean; bestY: number;
}
/** Route admission is needed only for a footprint that could win. */
function reachableRoot(state: SearchState): boolean {
  if (state.rootChecked) return state.rootClear;
  state.rootChecked = true;
  const { e, nav, startsOnVehicle, swept, rootX: x, rootZ: z } = state;
  if (nav && !startsOnVehicle) {
    swept.x = e.transform.x; swept.z = e.transform.z;
    nav.move(swept, x - swept.x, z - swept.z, Math.min(.3, e.combat?.radius ?? .3));
    const errorX = Math.abs(swept.x - x), errorZ = Math.abs(swept.z - z);
    state.rootClear = errorX <= .005 && errorZ <= .005 || errorX <= .01 && errorZ <= .01 && Math.hypot(errorX, errorZ) <= .01;
  }
  return state.rootClear;
}
/** One shared evaluator keeps dense searches on the same optimized numeric path. */
function evaluateCandidate(state: SearchState, x: number, z: number, yaw: number, supported = true): RestingPose | undefined {
  const { player, nav, support, feet, direction, length, radius, height, pose, numeric, ownPose, vehicleClear, neighbors, layers } = state;
  if (x !== state.rootX || z !== state.rootZ) {
    state.rootX = x; state.rootZ = z; state.rootClear = vehicleClear(x, z);
    state.rootChecked = false;
    state.rootFloor = NaN;
  }
  if (!state.rootClear) return;
  // Until a winner exists, retain the legacy last-rejected footprint for its
  // fallback. Once one exists, defer the sweep until the height can improve it.
  if (state.bestY === Infinity && !reachableRoot(state)) return;
  const dx = -Math.cos(yaw) * direction, dz = Math.sin(yaw) * direction;
  const ax = x - dx * .15, az = z - dz * .15;
  const bx = x + dx * length, bz = z + dz * length;
  numeric[0] = x; numeric[1] = z; numeric[2] = yaw;
  numeric[3] = ax; numeric[4] = az; numeric[5] = bx; numeric[6] = bz;
  if (!vehicleClear(ax, az, radius) || !vehicleClear(bx, bz, radius)) return;
  if (player && !(pointDistanceSquared(player.x, player.z, ax, az, bx, bz) >= .95 ** 2)) return;
  if (Number.isNaN(state.rootFloor)) state.rootFloor = support?.supportBelow(x, z, feet) ?? feet;
  let y = state.rootFloor; numeric[7] = y;
  if (x !== state.queriedX || z !== state.queriedZ) {
    state.query.x = state.queriedX = x; state.query.z = state.queriedZ = z;
    state.neighborCount = 0;
    state.spatial.query(state.query, state.ids, false, state.collectNeighbor);
  }
  const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
  let layerCount = 0;
  for (let n = 0; n < state.neighborCount; n++) {
    const other = neighbors[n]!;
    // A separated capsule AABB cannot overlap. Keep a small margin so this
    // only skips definite misses; surviving pairs use the exact old distance.
    const reach = radius + other.radius + 1e-6;
    if (maxX < Math.min(other.ax, other.bx) - reach || minX > Math.max(other.ax, other.bx) + reach
      || maxZ < Math.min(other.az, other.bz) - reach || minZ > Math.max(other.az, other.bz) + reach) continue;
    if (segmentDistanceSquared(ax, az, bx, bz, other) >= (radius + other.radius) ** 2) continue;
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
    if (y + height > other.y + .001 && y < other.y + other.height - .001) y = other.y + other.height;
  }
  // Navigation and support samples cannot rescue a footprint that is already
  // higher than the current winner. Dense heaps reject those before sweeping.
  if (state.bestY !== Infinity && y > feet + .05 && !(y < state.bestY - .001)) return;
  if (!reachableRoot(state)) return;
  if (supported) for (let sample = 0; sample < 3; sample++) {
    const t = sample * .5;
    const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
    if (!nav?.clear(px, pz, radius) || support && Math.abs(support.supportBelow(px, pz, feet) - feet) > .3) return;
  }
  pose.x = x; pose.z = z; pose.yaw = yaw; pose.ax = ax; pose.az = az; pose.bx = bx; pose.bz = bz; pose.y = y;
  // Reuse search scratch; only the winning pose needs an owned record.
  return pose;
}
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
  private readonly candidateNumbers = new Float64Array(8);
  private readonly deferred = new Map<number, DeferredPose>();
  private remainingMs = Infinity;
  private searchDeadline = Infinity;
  private search: { body: EntitySnapshot; deadAt: number; prone?: number; x: number; z: number; iterator: Generator<void, RestingPose | EntitySnapshot['transform']> } | undefined;
  private revision = -1;
  private epilogue = false;
  private readonly scriptedVehicles: EntitySnapshot[] = [];
  private vehicleDistrict: SimWorld['districts'] | undefined;
  private readonly parkedVehicles: VehicleFootprint[] = [];
  constructor(private readonly world: SimWorld) {}
  /** Keep a landing wave or cure reflow out of one render update. A search
   * yields between candidate roots; deferred bodies retain their last pose. */
  beginFrame(budgetMs = 2): void {
    this.remainingMs = budgetMs;
    const active = this.search, body = active?.body;
    if (active && body && (this.world.entities.get(body.id) !== body || body.health.current > 0 || body.hidden
      || body.transform.x !== active.x || body.transform.z !== active.z || body.corpseThrown && body.corpseBlast)) this.search = undefined;
  }
  /** Explicit asset/screenshot readiness also waits for presentation settling. */
  settleAll(): void {
    const remaining = this.remainingMs; this.remainingMs = Infinity;
    try {
      while (this.deferred.size) {
        const p = this.search ?? this.deferred.values().next().value!;
        this.place(p.body, p.deadAt, p.prone);
      }
    }
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
      this.epilogue = epilogue; this.search = undefined;
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
    if (this.search?.body === e && (this.search.deadAt !== deadAt || this.search.x !== e.transform.x || this.search.z !== e.transform.z)) this.search = undefined;
    if (previous?.deadAt === deadAt && previous.sourceX === e.transform.x && previous.sourceZ === e.transform.z
      && (!player || pointDistanceSquared(player.x, player.z, previous.ax, previous.az, previous.bx, previous.bz) >= .95 ** 2)) { if (this.search?.body === e) this.search = undefined; this.deferred.delete(e.id); return previous; }
    if (this.remainingMs <= 0 || this.search && this.search.body !== e) return this.defer(e, deadAt, prone, previous);
    const start = performance.now();
    this.searchDeadline = start + this.remainingMs;
    this.search ??= { body: e, deadAt, prone, x: e.transform.x, z: e.transform.z, iterator: this.settle(e, deadAt, prone, epilogue) };
    try {
      const result = this.search.iterator.next();
      if (result.done) { this.search = undefined; return result.value; }
      return this.defer(e, deadAt, prone, previous);
    } finally { this.remainingMs -= performance.now() - start; }
  }
  private defer(e: EntitySnapshot, deadAt: number, prone: number | undefined, previous: RestingPose | undefined): DeferredPose {
    let pending = this.deferred.get(e.id);
    if (!pending || pending.body !== e || pending.deadAt !== deadAt) {
      pending = { ...(previous ?? e.transform), y: previous?.y ?? e.transform.y - .7, yaw: previous?.yaw ?? e.transform.yaw + corpseYaw(e.id), body: e, deadAt, prone };
      this.deferred.set(e.id, pending);
    }
    return pending;
  }
  private *settle(e: EntitySnapshot, deadAt: number, prone: number | undefined, epilogue: boolean): Generator<void, RestingPose | EntitySnapshot['transform']> {
    const player = this.world.entities.get(1)?.transform;
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
    // Rejected candidates keep numeric scratch unboxed. Publishing every
    // sampled coordinate into a spread/copied pose record caused heavy GC.
    const numeric = this.candidateNumbers;
    numeric[0] = pose.x; numeric[1] = pose.z; numeric[2] = pose.yaw;
    numeric[3] = pose.ax; numeric[4] = pose.az; numeric[5] = pose.bx; numeric[6] = pose.bz; numeric[7] = pose.y;
    // The four orientations at one root share the same spatial query. The
    // layout cannot change during this synchronous search; preserve bucket order.
    const neighbors = this.neighborPoses, layers = this.layerPoses;
    // Clearing an array's length to zero also discards its V8 backing store.
    // Thousands of dense-pile roots must reuse capacity, not just the array
    // objects. The visitor avoids a second growing/truncated ID buffer.
    const ownPose = corpsePose(e.id);
    // The four orientations at one root share its hull, sweep and support.
    // Dense piles search hundreds of roots; repeating these queries per yaw
    // made the zoo's settling waves block the view update.
    const state: SearchState = { e, player, nav, support, startsOnVehicle, feet, direction, length, radius, height, pose, numeric, ownPose, vehicleClear,
      neighbors, layers, spatial: this.spatial, query: this.query, ids: this.neighbors, swept: this.swept,
      rootX: NaN, rootZ: NaN, rootClear: false, rootFloor: feet, queriedX: NaN, queriedZ: NaN, neighborCount: 0, rootChecked: false, bestY: Infinity,
      collectNeighbor: id => { if (id !== e.id) neighbors[state.neighborCount++] = this.bodies.get(id)!; } };
    let best: RestingPose | undefined;
    // First prefer an unoccupied footprint, nearest to the death position.
    // Combat bodies stay within 1 m. Once the L10 fight ends, use the surrounding
    // floor (up to 4 m) so the final collapsed crowd reads as individual people.
    // L4-17 (fix70-v): a war piles hundreds of bodies on the same spot; stacking them in the 1 m
    // search ring built a 2-3 m mound. A spot already tall (> 2 layers) keeps searching outward in
    // wider rings (to 10 m in L4, 5.5 m elsewhere) for a free footprint, so piles spread sideways. Bodies are never removed.
    // L4 prefers a genuinely ground-level footprint before accepting a pile.
    // A 45 cm root lift still added enough body height to produce visibly
    // tall stacks in the L4 plaza; keep searching outward for free ground.
    const mound = feet + (this.world.scenario === 'L4' ? .05 : .45);
    // Reuse the same bounded candidate count, but let the L4 war spread bodies
    // across more reachable floor before accepting another vertical layer.
    const ringSpacing = this.world.scenario === 'L4' ? .6 : .3;
    for (let ring = 0; ring <= (epilogue ? 22 : startsOnVehicle ? 30 : 20); ring++) {
      if (ring > (epilogue ? 10 : 5) && !startsOnVehicle && best && best.y <= mound) break;
      const distance = epilogue ? ring * .4 : startsOnVehicle || ring <= 5 ? ring * .2 : 1 + (ring - 5) * ringSpacing, samples = ring ? Math.max(16, Math.min(48, ring * 8)) : 1;
      for (let i = 0; i < samples; i++) {
        const angle = initialYaw + i * Math.PI * 2 / samples, x = e.transform.x + Math.cos(angle) * distance, z = e.transform.z + Math.sin(angle) * distance;
        for (let turn = 0; turn < 4; turn++) {
          state.bestY = best?.y ?? Infinity;
          const candidate = evaluateCandidate(state, x, z, initialYaw + turn * 2.399963229728653);
          if (!candidate) continue;
          if (candidate.y <= feet + .05) { Object.assign(this.bestScratch, candidate); best = this.bestScratch; break; }
          if (!best || candidate.y < best.y - .001) { Object.assign(this.bestScratch, candidate); best = this.bestScratch; }
        }
        if (best && best.y <= feet + .05) break;
        if (performance.now() >= this.searchDeadline) {
          yield;
          // The courier can move while a dense search is suspended. A best
          // candidate from an earlier frame must still leave their capsule clear.
          if (best && player && !(pointDistanceSquared(player.x, player.z, best.ax, best.az, best.bx, best.bz) >= .95 ** 2)) {
            best = undefined; state.bestY = Infinity;
            // A bound is valid only while its winner is valid. Revisit the
            // skipped roots, including the legacy fallback footprint.
            state.rootX = state.rootZ = state.queriedX = state.queriedZ = NaN;
            numeric[0] = e.transform.x; numeric[1] = e.transform.z; numeric[2] = initialYaw;
            numeric[3] = numeric[4] = numeric[5] = numeric[6] = 0; numeric[7] = feet;
            ring = -1; break;
          }
        }
      }
      if (best && best.y <= feet + .05) break;
    }
    // A narrow doorway can fit the actor but reject a conservative full-body
    // strip. Keep the bounded root and heap layer, never teleport it elsewhere.
    if (!best) state.bestY = Infinity;
    if (!best) for (let i = 0; i < 80 && !best; i++) {
      const angle = initialYaw + i * Math.PI * 2 / 80;
      best = evaluateCandidate(state, e.transform.x + Math.cos(angle), e.transform.z + Math.sin(angle), angle + Math.PI / 2, false);
      if (!best && performance.now() >= this.searchDeadline) yield;
    }
    if (!best) {
      best = evaluateCandidate(state, e.transform.x, e.transform.z, initialYaw + .7, false);
      if (!best) {
        // The legacy fallback uses the final rejected candidate's footprint.
        pose.x = numeric[0]; pose.z = numeric[1]; pose.yaw = numeric[2];
        pose.ax = numeric[3]; pose.az = numeric[4]; pose.bx = numeric[5]; pose.bz = numeric[6]; pose.y = numeric[7]; best = pose;
      }
    }
    // Retain one stable result for this body; candidate exploration above
    // reuses bestScratch instead of allocating on every improving root.
    const placed = { ...best };
    this.deferred.delete(e.id);
    this.bodies.set(e.id, placed); this.spatial.set(e.id, placed.x, placed.z); return placed;
  }
}
