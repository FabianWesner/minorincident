import type { ScenarioDefinition } from '../../levels/loader';
type Wall = NonNullable<ScenarioDefinition['walls']>[number];
/** Coarse look-ahead offsets (path nodes) for budgeted NPC steering. */
const lookAhead = [40, 30, 22, 15, 10, 6, 3, 1, 0];
/** Radius cuts (m) `move` tries, smallest first, for a body that already stands inside the baked wall margin. */
const marginSteps = [0.002, 0.005, 0.01, 0.02, 0.04, 0.06, 0.08, 0.1];
// L1's morning population has more than sixteen simultaneous route targets.
// Retain those exact answers between ticks instead of evicting an entire round.
const nearestMemoCapacity = 64;
/** 0.5 m collider-baked district grid. Fixed workspaces serve budgeted A* and shared reverse flow fields. */
export class NavGrid {
  readonly cellSize = 0.5;
  readonly width: number;
  readonly depth: number;
  readonly blocked: Uint8Array;
  readonly distance: Int32Array;
  private readonly queue: Int32Array;
  private readonly parent: Int32Array;
  private readonly cost: Float64Array;
  private readonly open: Uint8Array;
  private readonly pathSeen: Uint32Array;
  private pathStamp = 0;
  private readonly heap: { cell: number; score: number }[] = [];
  private readonly buckets = new Map<number, Map<number, Wall[]>>();
  private searchFrom = -1;
  private searchTo = -1;
  private searching = false;
  private head = 0;
  private tail = 0;
  private readonly blockers = new Map<number, Wall>();
  private readonly blockerBuckets = new Map<number, Map<number, Map<number, Wall>>>();
  /** Optional active-district footprint, supplied by campaign assembly without importing render data. */
  mask: ((x: number, z: number) => boolean) | null = null;
  private playerBounds: { x0: number; x1: number; z0: number; z1: number } | null = null;
  /** Story perimeters constrain player routes without closing the battle to infected or soldiers. */
  setPlayerBounds(bounds: NavGrid['playerBounds']): void {
    this.playerBounds = bounds; this.reach.active = false;
  }
  private insidePlayerBounds(x: number, z: number, radius: number): boolean {
    const b = this.playerBounds;
    return !b || (x >= b.x0 + radius && x <= b.x1 - radius && z >= b.z0 + radius && z <= b.z1 - radius);
  }
  target = -1;
  expansions = 0;
  constructor(readonly ground: { width: number; depth: number }, readonly walls: readonly Wall[], readonly clearance = 0.65, readonly center = { x: 0, z: 0 }, mask: NavGrid['mask'] = null) {
    this.mask = mask;
    this.width = Math.ceil(ground.width / this.cellSize); this.depth = Math.ceil(ground.depth / this.cellSize);
    const count = this.width * this.depth;
    this.blocked = new Uint8Array(count); this.distance = new Int32Array(count); this.queue = new Int32Array(count);
    this.parent = new Int32Array(count); this.cost = new Float64Array(count); this.open = new Uint8Array(count);
    this.pathSeen = new Uint32Array(count);
    this.distance.fill(-1);
    this.indexWalls();
    this.bake();
  }
  /** Rectangle windows can rasterize wall footprints directly. This is exactly clear(..., clearance)
   * at cell centres, without a broad-phase lookup for every empty terrain cell on each stream seam. */
  private bake(): void {
    if (this.mask) { for (let cell = 0; cell < this.blocked.length; cell++) this.blocked[cell] = Number(!this.clear(this.x(cell), this.z(cell), this.clearance)); return; }
    this.blocked.fill(0);
    const r = this.clearance, step = this.cellSize;
    for (let z = 0; z < this.depth; z++) {
      const offset = z * this.width;
      if (Math.abs(this.z(offset) - this.center.z) + r >= this.ground.depth / 2) { this.blocked.fill(1, offset, offset + this.width); continue; }
      for (let x = 0; x < this.width && Math.abs(this.x(x) - this.center.x) + r >= this.ground.width / 2; x++) this.blocked[offset + x] = 1;
      for (let x = this.width - 1; x >= 0 && Math.abs(this.x(x) - this.center.x) + r >= this.ground.width / 2; x--) this.blocked[offset + x] = 1;
    }
    const walls = this.walls.filter(w => w.navBlocker || w.y - w.halfY < 1.8 && w.y + w.halfY > .05);
    for (const wall of [...walls, ...this.blockers.values()]) {
      const cx = (wall.x - this.center.x + this.ground.width / 2) / step - .5, cz = (wall.z - this.center.z + this.ground.depth / 2) / step - .5;
      const x0 = Math.max(0, Math.floor(cx - (wall.halfX + r) / step)), x1 = Math.min(this.width - 1, Math.ceil(cx + (wall.halfX + r) / step));
      const z0 = Math.max(0, Math.floor(cz - (wall.halfZ + r) / step)), z1 = Math.min(this.depth - 1, Math.ceil(cz + (wall.halfZ + r) / step));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (Math.abs(this.x(x) - wall.x) < wall.halfX + r && Math.abs(this.z(z * this.width) - wall.z) < wall.halfZ + r) this.blocked[z * this.width + x] = 1;
    }
  }
  cell(x: number, z: number): number {
    const cx = Math.floor((x - this.center.x + this.ground.width / 2) / this.cellSize), cz = Math.floor((z - this.center.z + this.ground.depth / 2) / this.cellSize);
    return cx < 0 || cz < 0 || cx >= this.width || cz >= this.depth ? -1 : cz * this.width + cx;
  }
  /** Player clearance is smaller than AI clearance. Route to the nearest walkable
   * cell when the player hugs a collider, then use direct movement once visible. */
  /** Memo of recent `nearestCell` answers (fixed targets such as refuges are asked every tick by every fleeing agent;
   * a blocked target cell costs up to 169 line tests). Invalidate only answers near changed blockers. */
  private readonly nearestMemo: { x: number; z: number; r: number; cell: number }[] = [];
  private readonly nearestBlockers = new Map<number, Pick<Wall, 'x' | 'z' | 'halfX' | 'halfZ'>>();
  private nearestNext = 0;
  nearestCell(x: number, z: number, radius?: number): number {
    const r = radius ?? -1;
    for (const m of this.nearestMemo) if (m.x === x && m.z === z && m.r === r) return m.cell;
    const cell = this.nearestCellUncached(x, z, radius);
    const slot = { x, z, r, cell };
    if (this.nearestMemo.length < nearestMemoCapacity) this.nearestMemo.push(slot); else this.nearestMemo[this.nearestNext] = slot;
    this.nearestNext = (this.nearestNext + 1) % nearestMemoCapacity;
    return cell;
  }
  private nearestCellUncached(x: number, z: number, radius?: number): number {
    const cell=this.cell(x,z);if(cell<0||!this.blocked[cell] && (radius === undefined || this.visible({ x, z }, { x: this.x(cell), z: this.z(cell) }, radius)))return cell;
    let nearest=-1,distance=Infinity;
    for(let dz=-6;dz<=6;dz++)for(let dx=-6;dx<=6;dx++){
      const candidate=this.cell(x+dx*this.cellSize,z+dz*this.cellSize);if(candidate<0||this.blocked[candidate])continue;
      // A farther cell cannot replace the current answer; avoid its segment test.
      const d=(this.x(candidate)-x)**2+(this.z(candidate)-z)**2;if(d<distance&&(radius === undefined || this.visible({ x, z }, { x: this.x(candidate), z: this.z(candidate) }, radius))){nearest=candidate;distance=d;}
    }
    return nearest;
  }
  x(cell: number): number { return (cell % this.width + 0.5) * this.cellSize - this.ground.width / 2 + this.center.x; }
  z(cell: number): number { return (Math.floor(cell / this.width) + 0.5) * this.cellSize - this.ground.depth / 2 + this.center.z; }
  clear(x: number, z: number, radius = 0, rounded = false, ignoreBlocker?: number): boolean {
    if (this.mask && !this.mask(x, z)) return false;
    if (Math.abs(x - this.center.x) + radius >= this.ground.width / 2 || Math.abs(z - this.center.z) + radius >= this.ground.depth / 2) return false;
    if (!this.buckets.size && !this.blockers.size) return true;
    const cellX = Math.floor(x / 4), cellZ = Math.floor(z / 4);
    const walls = this.buckets.get(cellX)?.get(cellZ);
    if (walls) for (const w of walls) if (rounded ? this.intersects(w, x, z, radius) : Math.abs(x - w.x) < w.halfX + radius && Math.abs(z - w.z) < w.halfZ + radius) return false;
    const blockers = this.blockerBuckets.get(cellX)?.get(cellZ);
    if (blockers) for (const [id, w] of blockers) if (id !== ignoreBlocker && (rounded ? this.intersects(w, x, z, radius) : Math.abs(x - w.x) < w.halfX + radius && Math.abs(z - w.z) < w.halfZ + radius)) return false;
    return true;
  }
  private intersects(w: Wall, x: number, z: number, radius: number): boolean {
    const dx = Math.abs(x - w.x), dz = Math.abs(z - w.z);
    if (dx >= w.halfX + radius || dz >= w.halfZ + radius) return false;
    // Match the circular capsule footprint at box corners, rather than a square
    // dilation that can declare a valid Rapier position trapped inside a wall.
    const outsideX = Math.max(0, dx - w.halfX), outsideZ = Math.max(0, dz - w.halfZ);
    return radius === 0 || outsideX * outsideX + outsideZ * outsideZ < radius * radius;
  }
  private indexWalls(): void {
    this.buckets.clear();
    for (const wall of this.walls.filter(w => w.navBlocker || (w.y - w.halfY < 1.8 && w.y + w.halfY > .05))) for (let z = Math.floor((wall.z - wall.halfZ - 2) / 4); z <= Math.floor((wall.z + wall.halfZ + 2) / 4); z++) for (let x = Math.floor((wall.x - wall.halfX - 2) / 4); x <= Math.floor((wall.x + wall.halfX + 2) / 4); x++) {
      let column = this.buckets.get(x);
      if (!column) this.buckets.set(x, column = new Map());
      let bucket = column.get(z);
      if (!bucket) column.set(z, bucket = []);
      bucket.push(wall);
    }
  }
  /** The same walls, live blockers and mask baked for a wider body (E32 Mega Alpha); the caller forwards later blocker changes. */
  withClearance(clearance: number): NavGrid {
    const grid = new NavGrid(this.ground, this.walls, clearance, this.center, this.mask);
    for (const [id, wall] of this.blockers) grid.setBlocker(id, wall, true);
    return grid;
  }
  /** E08 campaign tier swaps replace static walls, retaining the fixed search workspace. */
  prepare(walls: readonly Wall[]): Uint8Array {
    return new NavGrid(this.ground, walls, this.clearance, this.center, this.mask).blocked;
  }
  rebake(prepared?: Uint8Array): void {
    this.indexWalls();
    this.nearestBlockers.clear();
    for (const [id, wall] of this.blockers) this.nearestBlockers.set(id, { x: wall.x, z: wall.z, halfX: wall.halfX, halfZ: wall.halfZ });
    if (prepared) {
      this.blocked.set(prepared);
      for (const wall of this.blockers.values()) this.updateBlockerCells(wall);
    } else this.bake();
    this.target = -1; this.searching = false; this.head = this.tail = 0; this.nearestMemo.length = 0;
  }
  /** Stream windows keep their bounded search buffers while their global origin changes. */
  recenter(center: { x: number; z: number }): void {
    this.center.x = center.x; this.center.z = center.z;
    this.reach.active = false; this.reach.key = -1;
    this.rebake();
  }
  /** E11 doors and broken props invalidate only their affected cells and cached searches. */
  setBlocker(id: number, wall: Wall, blocked: boolean): void {
    const previousBounds = this.nearestBlockers.get(id);
    if (previousBounds) this.indexBlocker(id, previousBounds);
    if (blocked) { this.blockers.set(id, wall); this.indexBlocker(id, wall, wall); } else this.blockers.delete(id);
    // Keep old bounds even when the caller mutates its retained wall object in place.
    if (blocked) this.nearestBlockers.set(id, { x: wall.x, z: wall.z, halfX: wall.halfX, halfZ: wall.halfZ }); else this.nearestBlockers.delete(id);
    if (previousBounds) this.updateBlockerCells(previousBounds);
    this.updateBlockerCells(wall);
    this.target = -1; this.searching = false;
    if (previousBounds) this.invalidateNearest(previousBounds);
    this.invalidateNearest(wall);
  }
  /** Live furniture uses the same local 4 m broad phase as static walls. */
  private indexBlocker(id: number, bounds: Pick<Wall, 'x' | 'z' | 'halfX' | 'halfZ'>, wall?: Wall): void {
    for (let x = Math.floor((bounds.x - bounds.halfX - 2) / 4); x <= Math.floor((bounds.x + bounds.halfX + 2) / 4); x++) {
      let column = this.blockerBuckets.get(x);
      if (!column && wall) this.blockerBuckets.set(x, column = new Map());
      if (!column) continue;
      for (let z = Math.floor((bounds.z - bounds.halfZ - 2) / 4); z <= Math.floor((bounds.z + bounds.halfZ + 2) / 4); z++) {
        let bucket = column.get(z);
        if (wall) { if (!bucket) column.set(z, bucket = new Map()); bucket.set(id, wall); }
        else { bucket?.delete(id); if (!bucket?.size) column.delete(z); }
      }
      if (!column.size) this.blockerBuckets.delete(x);
    }
  }
  private invalidateNearest(wall: Pick<Wall, 'x' | 'z' | 'halfX' | 'halfZ'>): void {
    for (let i = this.nearestMemo.length - 1; i >= 0; i--) {
      const memo = this.nearestMemo[i];
      // nearestCell searches six cells in each direction; include rounding to the candidate's centre
      // and both baked clearance and the query's segment radius. Distant walls cannot change its answer.
      const pad = 7 * this.cellSize + Math.max(this.clearance, memo.r);
      if (Math.abs(memo.x - wall.x) <= wall.halfX + pad && Math.abs(memo.z - wall.z) <= wall.halfZ + pad) this.nearestMemo.splice(i, 1);
    }
  }
  private updateBlockerCells(wall: Pick<Wall, 'x' | 'z' | 'halfX' | 'halfZ'>): void {
    const pad = this.clearance + this.cellSize;
    const x0 = Math.max(0, Math.floor((wall.x - wall.halfX - pad - this.center.x + this.ground.width / 2) / this.cellSize));
    const x1 = Math.min(this.width - 1, Math.ceil((wall.x + wall.halfX + pad - this.center.x + this.ground.width / 2) / this.cellSize));
    const z0 = Math.max(0, Math.floor((wall.z - wall.halfZ - pad - this.center.z + this.ground.depth / 2) / this.cellSize));
    const z1 = Math.min(this.depth - 1, Math.ceil((wall.z + wall.halfZ + pad - this.center.z + this.ground.depth / 2) / this.cellSize));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const cell = z * this.width + x;
      this.blocked[cell] = Number(!this.clear(this.x(cell), this.z(cell), this.clearance));
    }
  }
  visible(from: { x: number; z: number }, to: { x: number; z: number }, radius: number): boolean {
    if (!this.mask && !this.walls.length && !this.blockers.size) return this.clear(to.x, to.z, radius);
    const dx = to.x - from.x, dz = to.z - from.z, steps = Math.ceil(Math.hypot(dx, dz) / 0.2);
    if (!this.clear(to.x, to.z, radius)) return false;
    // The outer ground is convex: endpoint clearance covers the complete ray.
    if (Math.abs(from.x - this.center.x) + radius >= this.ground.width / 2 || Math.abs(from.z - this.center.z) + radius >= this.ground.depth / 2) return false;
    const divisor = Math.max(1, steps);
    const walls = new Set<Wall>();
    const collect = (x: number, z: number) => {
      const bucket = this.buckets.get(x)?.get(z); if (bucket) for (const wall of bucket) walls.add(wall);
      const blockers = this.blockerBuckets.get(x)?.get(z); if (blockers) for (const wall of blockers.values()) walls.add(wall);
    };
    if (!this.mask) {
      // Empty streamed terrain needs only the crossed broad-phase cells. The exact slab sweep below
      // still checks every collected wall; no fixed-distance samples can skip a narrow corner.
      let x = Math.floor(from.x / 4), z = Math.floor(from.z / 4);
      const endX = Math.floor(to.x / 4), endZ = Math.floor(to.z / 4), sx = Math.sign(dx), sz = Math.sign(dz);
      let nextX = dx ? ((x + (sx > 0 ? 1 : 0)) * 4 - from.x) / dx : Infinity;
      let nextZ = dz ? ((z + (sz > 0 ? 1 : 0)) * 4 - from.z) / dz : Infinity;
      const deltaX = dx ? 4 / Math.abs(dx) : Infinity, deltaZ = dz ? 4 / Math.abs(dz) : Infinity;
      for (;;) {
        collect(x, z); if (x === endX && z === endZ) break;
        // Rounding at an endpoint boundary must never advance an already completed axis.
        if (x === endX) nextX = Infinity; if (z === endZ) nextZ = Infinity;
        if (nextX < nextZ) { x += sx; nextX += deltaX; }
        else if (nextZ < nextX) { z += sz; nextZ += deltaZ; }
        else { x += sx; z += sz; nextX += deltaX; nextZ += deltaZ; }
      }
    } else {
      let previousX = Infinity, previousZ = Infinity;
      for (let i = 0; i <= steps; i++) {
        const x = from.x + dx * i / divisor, z = from.z + dz * i / divisor;
        if (!this.mask(x, z)) return false;
        const bucketX = Math.floor(x / 4), bucketZ = Math.floor(z / 4);
        if (bucketX !== previousX || bucketZ !== previousZ) { collect(bucketX, bucketZ); previousX = bucketX; previousZ = bucketZ; }
      }
    }
    // Sampled clearance alone can skip a corner between two samples. A pulled
    // waypoint must clear the entire segment, including narrow foliage boxes.
    for (const wall of walls) {
      const minX = wall.x - wall.halfX - radius, maxX = wall.x + wall.halfX + radius;
      const minZ = wall.z - wall.halfZ - radius, maxZ = wall.z + wall.halfZ + radius;
      // Rapier's rounded capsule can rest inside a conservative expanded box
      // corner. Permit an outward escape, never a route through the solid.
      if (from.x > minX && from.x < maxX && from.z > minZ && from.z < maxZ &&
        ((from.x <= wall.x && to.x <= minX) || (from.x >= wall.x && to.x >= maxX) ||
         (from.z <= wall.z && to.z <= minZ) || (from.z >= wall.z && to.z >= maxZ))) continue;
      let enter = 0, leave = 1;
      // Keep the exact two slab tests without allocating three arrays per wall.
      if (dx === 0) {
        if (from.x <= minX || from.x >= maxX) continue;
      } else {
        const a = (minX - from.x) / dx, b = (maxX - from.x) / dx;
        enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
      }
      if (dz === 0) {
        if (from.z <= minZ || from.z >= maxZ) continue;
      } else {
        const a = (minZ - from.z) / dz, b = (maxZ - from.z) / dz;
        enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
      }
      if (enter < leave) return false;
    }
    return true;
  }
  /** Sweeps movement in subcell increments; axis fallback slides around collider corners. */
  move(position: { x: number; z: number }, dx: number, dz: number, radius: number, capsule = false): void {
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2)); dx /= count; dz /= count;
    // Rapier contact or crowd pushes can leave a body inside the grid's conservative margin.
    // Recover enough clearance to slide out instead of rejecting every step along the face.
    // Checked only once a step is refused, so free movement costs nothing extra.
    let touched = false, rounded = false;
    for (let i = 0; i < count; i++) {
      if (this.clear(position.x + dx, position.z + dz, radius, rounded)) { position.x += dx; position.z += dz; continue; }
      if (!touched) {
        touched = true;
        if (!this.clear(position.x, position.z, radius)) {
          // Rapier's capsule fits beside box corners that the square grid margin rejects.
          // Recover using its circular footprint first, retaining the full body radius;
          // shallow contact corrections still use the smallest bounded margin cut.
          rounded = capsule && this.clear(position.x, position.z, radius, true);
          const fit = rounded ? undefined : marginSteps.find(cut => cut < radius && this.clear(position.x, position.z, radius - cut, capsule));
          if (rounded || fit !== undefined) { if (fit !== undefined) radius -= fit; rounded = capsule; i--; continue; }
        }
      }
      if (this.clear(position.x + dx, position.z, radius, rounded)) position.x += dx; if (this.clear(position.x, position.z + dz, radius, rounded)) position.z += dz;
    }
  }
  private neighbor(cell: number, direction: number): number {
    const x = cell % this.width, z = Math.floor(cell / this.width);
    return direction === 0 ? x > 0 ? cell - 1 : -1 : direction === 1 ? x + 1 < this.width ? cell + 1 : -1 : direction === 2 ? z > 0 ? cell - this.width : -1 : z + 1 < this.depth ? cell + this.width : -1;
  }
  /** Reverse BFS for groups >20. Never exceeds the supplied expansion budget in one tick. */
  flow(x: number, z: number, budget: number): void {
    const target = this.cell(x, z);
    if (target !== this.target) {
      this.target = target; this.distance.fill(-1); this.head = this.tail = 0;
      if (target >= 0 && !this.blocked[target]) { this.distance[target] = 0; this.queue[this.tail++] = target; }
    }
    this.expansions = 0;
    while (this.head < this.tail && this.expansions++ < budget) {
      const cell = this.queue[this.head++];
      for (let d = 0; d < 4; d++) { const n = this.neighbor(cell, d); if (n >= 0 && !this.blocked[n] && this.distance[n] < 0) { this.distance[n] = this.distance[cell] + 1; this.queue[this.tail++] = n; } }
    }
    this.expansions = Math.min(this.expansions, budget);
  }
  flowNext(cell: number): number {
    if (cell < 0 || this.distance[cell] <= 0) return cell;
    let next = cell;
    for (let d = 0; d < 4; d++) { const n = this.neighbor(cell, d); if (n >= 0 && this.distance[n] >= 0 && this.distance[n] < this.distance[next]) next = n; }
    return next;
  }
  private push(cell: number, score: number): void {
    const item = { cell, score }; let index = this.heap.length; this.heap.push(item);
    while (index > 0) { const parent = (index - 1) >> 1; if (this.heap[parent].score <= score) break; this.heap[index] = this.heap[parent]; index = parent; }
    this.heap[index] = item;
  }
  private pop(): number {
    const cell = this.heap[0].cell, item = this.heap.pop()!;
    if (this.heap.length) { let index = 0;
      while (index * 2 + 1 < this.heap.length) { let next = index * 2 + 1; if (next + 1 < this.heap.length && this.heap[next + 1].score < this.heap[next].score) next++; if (this.heap[next].score >= item.score) break; this.heap[index] = this.heap[next]; index = next; }
      this.heap[index] = item;
    }
    return cell;
  }
  /** Shared string-pulled route: skip all visible waypoints, so actors do not zig-zag on the grid. */
  /** `nearest`: when the target is unreachable (a click into a fenced yard), route to the reachable cell closest to it. */
  steer(position: { x: number; z: number }, target: { x: number; z: number }, route: { path: number[]; goal: number; pathIndex: number; hold?: number }, radius: number, waypoint: { x: number; z: number }, budget = 1600, nearest = false): boolean {
    if (nearest && this.playerBounds) {
      const b = this.playerBounds, margin = Math.max(radius, this.clearance);
      target = { x: Math.max(b.x0 + margin, Math.min(b.x1 - margin, target.x)), z: Math.max(b.z0 + margin, Math.min(b.z1 - margin, target.z)) };
    }
    // Budgeted NPC steering skips the direct sweep to far targets (a 100 m refuge line test per agent per tick); the
    // routed look-ahead below covers them.
    const far = Number.isFinite(budget) && Math.abs(target.x - position.x) + Math.abs(target.z - position.z) > 30;
    if (!far && this.visible(position, target, radius)) { route.path.length = 0; route.goal = -1; Object.assign(waypoint, target); return true; }
    const to = this.nearestCell(target.x, target.z, radius);
    if (to !== route.goal || route.pathIndex >= route.path.length) {
      let from = this.nearestCell(position.x, position.z, radius);
      // A closest cell across a collider corner is not a reachable starting point.
      if (from >= 0 && !this.visible(position, { x: this.x(from), z: this.z(from) }, radius)) {
        let distance = Infinity; from = -1;
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
          const cell = this.cell(position.x + dx * this.cellSize, position.z + dz * this.cellSize);
          if (cell < 0 || this.blocked[cell]) continue;
          const point = { x: this.x(cell), z: this.z(cell) }, d = (point.x - position.x) ** 2 + (point.z - position.z) ** 2;
          if (d < distance && this.visible(position, point, radius)) { from = cell; distance = d; }
        }
      }
      if (!(nearest ? this.reachPath(from, target, route.path, budget) : this.path(from, to, route.path, budget))) return false;
      // Align with that visible start before rounding the first corner.
      if (from >= 0) route.path.unshift(from);
      route.goal = to; route.pathIndex = 0; route.hold = 0;
    }
    while (route.pathIndex < route.path.length && Math.hypot(position.x - this.x(route.path[route.pathIndex]), position.z - this.z(route.path[route.pathIndex])) < .12) {
      const next = route.path[route.pathIndex + 1];
      if (next !== undefined && !this.visible(position, { x: this.x(next), z: this.z(next) }, radius)) break;
      route.pathIndex++;
    }
    // Look ahead a bounded window: line tests over a whole cross-district path cost ~30 ms per call.
    // NPC steering (finite budget) samples the window coarsely: forty line tests per agent per tick dominated crowded
    // scenes (E20 rescue: ~16 ms/tick); bots and vehicles (infinite budget) keep the exact farthest-visible node.
    if (Number.isFinite(budget)) {
      // Walking the straight segment toward the chosen node keeps it visible: re-run the look-ahead every fourth tick.
      if (route.hold && route.pathIndex < route.path.length) { route.hold--; waypoint.x = this.x(route.path[route.pathIndex]); waypoint.z = this.z(route.path[route.pathIndex]); return true; }
      const last = route.path.length - 1;
      let above = Math.min(last, route.pathIndex + 40) + 1;
      for (const k of lookAhead) {
        const i = Math.min(last, route.pathIndex + k); if (i >= above) continue;
        waypoint.x = this.x(route.path[i]); waypoint.z = this.z(route.path[i]);
        if (this.visible(position, waypoint, radius)) {
          // Bisect between the visible sample and the blocked one above it, so corners are cut (nearly) as tightly as
          // the exact scan at a few extra line tests.
          let lo = i, hi = above;
          while (hi - lo > 1) {
            const mid = (lo + hi) >> 1; waypoint.x = this.x(route.path[mid]); waypoint.z = this.z(route.path[mid]);
            if (this.visible(position, waypoint, radius)) lo = mid; else hi = mid;
          }
          waypoint.x = this.x(route.path[lo]); waypoint.z = this.z(route.path[lo]);
          route.pathIndex = lo; route.hold = 3; return true;
        }
        above = i;
      }
      route.goal = -1; return false;
    }
    for (let i = Math.min(route.path.length - 1, route.pathIndex + 40); i >= route.pathIndex; i--) {
      waypoint.x = this.x(route.path[i]); waypoint.z = this.z(route.path[i]);
      if (this.visible(position, waypoint, radius)) { route.pathIndex = i; return true; }
    }
    route.goal = -1; return false;
  }
  private reachParent: Int32Array | null = null;
  private reachQueue: Int32Array | null = null;
  private reachSeen: Uint32Array | null = null;
  private reachStamp = 0;
  private reachDepth: Int32Array | null = null;
  private readonly reach = { active: false, key: -1, from: -1, tx: 0, tz: 0, head: 0, tail: 0, best: -1, bestD: Infinity, far: -1, farD: Infinity, stamp: 0 };
  /** Player route (E19 QA1-02): a breadth-first flood from the player's cell (own workspace, never starved by
   * the crowd's shared A*), time-sliced at `budget` cells per call so no click costs a frame (~1–4 ms for a full
   * district flood on desktop otherwise). The goal is the reachable cell closest to the click (the click when
   * reachable; early exit). Returns true with `result` filled when done, false while still flooding. */
  reachPath(from: number, target: { x: number; z: number }, result: number[], budget = Infinity): boolean {
    const count = this.width * this.depth, r = this.reach;
    this.reachParent ??= new Int32Array(count); this.reachQueue ??= new Int32Array(count); this.reachSeen ??= new Uint32Array(count); this.reachDepth ??= new Int32Array(count);
    const parent = this.reachParent, queue = this.reachQueue, seen = this.reachSeen, depth = this.reachDepth;
    const key = this.cell(target.x, target.z);
    if (!r.active || r.key !== key) {
      if (from < 0 || this.blocked[from]) { r.active = false; result.length = 0; return false; }
      Object.assign(r, { active: true, key, from, head: 0, tail: 0, best: from, bestD: Infinity, far: -1, farD: Infinity, stamp: ++this.reachStamp,
        tx: (target.x - this.center.x + this.ground.width / 2) / this.cellSize - .5, tz: (target.z - this.center.z + this.ground.depth / 2) / this.cellSize - .5 });
      seen[from] = r.stamp; parent[from] = -1; depth[from] = 0; queue[r.tail++] = from;
    }
    let steps = 0, done = false;
    while (r.head < r.tail) {
      if (steps++ >= budget) return false;
      const cell = queue[r.head++], d = (cell % this.width - r.tx) ** 2 + (Math.floor(cell / this.width) - r.tz) ** 2;
      if (d < r.bestD) { r.bestD = d; r.best = cell; }
      if (d < .5 && depth[cell] >= 4) { done = true; break; } // the click itself is reachable: no need to flood the district
      if (depth[cell] >= 8 && d < r.farD) { r.farD = d; r.far = cell; }
      for (let k = 0; k < 4; k++) { const n = this.neighbor(cell, k); if (n >= 0 && !this.blocked[n] && seen[n] !== r.stamp && this.insidePlayerBounds(this.x(n), this.z(n), this.clearance)) { seen[n] = r.stamp; parent[n] = cell; depth[n] = depth[cell] + 1; queue[r.tail++] = n; } }
    }
    void done;
    // Repeated clicks behind the same fence must still make progress: when the closest reachable spot is where
    // the player already stands, take the closest one at least 4 m of walking away (slides along the fence and
    // around its end, toward the click).
    let best = r.best;
    if (depth[best] < 4 && r.far >= 0 && r.bestD > 4) best = r.far;
    result.length = 0;
    for (let cell = best; cell !== r.from && cell >= 0; cell = parent[cell]) result.push(cell);
    result.reverse(); r.active = false; r.key = -1;
    // The route begins at the flood's start cell (the player may have moved a few cells while it ran).
    if (r.from !== from && r.from >= 0) result.unshift(r.from);
    return true;
  }
  /** Cells the current (or last finished) A* search expanded in total, across resumed calls. */
  searchSize = 0;
  /** True while a budget-limited A* between these cells is still in progress (call `path` again to resume it). */
  pending(from: number, to: number): boolean { return this.searching && this.searchFrom === from && this.searchTo === to; }
  /**
   * Every walkable cell connected to `from` (4-neighbour, like `path`), as a 0/1 mask over the grid. A full flood with its own
   * buffers (never the shared A* or flow workspace), for one-off questions such as "which candidate spots can reach the
   * objective" where a budgeted `path` per candidate gives false "unreachable" answers over long distances.
   */
  reachableFrom(from: number): Uint8Array {
    const seen = new Uint8Array(this.width * this.depth);
    if (from < 0 || this.blocked[from]) return seen;
    const queue = new Int32Array(seen.length); let head = 0, tail = 0;
    seen[from] = 1; queue[tail++] = from;
    while (head < tail) {
      const cell = queue[head++];
      for (let d = 0; d < 4; d++) { const n = this.neighbor(cell, d); if (n >= 0 && !this.blocked[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n; } }
    }
    return seen;
  }
  /**
   * Start cell for a route: the nearest walkable cell that is in straight reach of the body (`radius`), so an agent beside a
   * thin wall never starts on the cell behind it (same rule as `steer`). -1 when no walkable cell within 1.5 m is in reach
   * (the body stands in a slot narrower than the baked clearance: see `escapeCell`).
   */
  startCell(position: { x: number; z: number }, radius: number): number {
    const nearest = this.nearestCell(position.x, position.z);
    if (nearest < 0 || this.visible(position, { x: this.x(nearest), z: this.z(nearest) }, radius)) return nearest;
    let best = -1, distance = Infinity;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const cell = this.cell(position.x + dx * this.cellSize, position.z + dz * this.cellSize);
      if (cell < 0 || this.blocked[cell]) continue;
      const d = (this.x(cell) - position.x) ** 2 + (this.z(cell) - position.z) ** 2;
      if (d < distance && this.visible(position, { x: this.x(cell), z: this.z(cell) }, radius)) { best = cell; distance = d; }
    }
    return best;
  }
  /**
   * After a failed `path` search: the nearest walkable cell within `range` metres that the search never reached (outside the
   * start's pocket) and that the body (`radius`) can walk to in a straight line, or -1. A fence gap or porch alley narrower
   * than the baked clearance leaves a few isolated cells; this is the way out of them. `outsideSearch` false: any walkable cell
   * at least `minRange` away.
   */
  escapeCell(position: { x: number; z: number }, radius: number, range = 6, outsideSearch = true, minRange = 0): number {
    // E18: offsets nearest-first, stopping once no remaining cell can beat the best one; the line-of-sight test is the cost
    // (an L3 follower off the crowd grid ran ~1000 of them per tick). Same answer as the full square scan.
    const n = Math.ceil(range / this.cellSize), offsets = this.escapeOffsets(n), slack = this.cellSize * Math.SQRT1_2; let best = -1, distance = range * range;
    for (let i = 0; i < offsets.length; i += 3) {
      const reach = Math.max(0, offsets[i + 2] - slack); if (reach * reach > distance) break;
      const cell = this.cell(position.x + offsets[i] * this.cellSize, position.z + offsets[i + 1] * this.cellSize);
      if (cell < 0 || this.blocked[cell] || (outsideSearch && this.pathSeen[cell] === this.pathStamp)) continue;
      const d = (this.x(cell) - position.x) ** 2 + (this.z(cell) - position.z) ** 2;
      if ((d < distance || d === distance && cell < best) && d >= minRange * minRange && this.visible(position, { x: this.x(cell), z: this.z(cell) }, radius)) { best = cell; distance = d; }
    }
    return best;
  }
  private readonly escapeOffsetCache = new Map<number, Float64Array>();
  /** (dx, dz, metres) triples of the (2n+1)^2 square, nearest first. */
  private escapeOffsets(n: number): Float64Array {
    let offsets = this.escapeOffsetCache.get(n);
    if (!offsets) {
      const list: [number, number, number][] = [];
      for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) list.push([dx, dz, Math.hypot(dx, dz) * this.cellSize]);
      list.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
      this.escapeOffsetCache.set(n, offsets = Float64Array.from(list.flat()));
    }
    return offsets;
  }
  /** Budgeted A*; caller retries later if the tick budget is exhausted. Writes into a reused path array. */
  path(from: number, to: number, result: number[], budget: number): boolean {
    result.length = 0; this.expansions = 0;
    if (from < 0 || to < 0 || this.blocked[from] || this.blocked[to]) return false;
    if (!this.searching || this.searchFrom !== from || this.searchTo !== to) {
      this.searchFrom = from; this.searchTo = to; this.searching = true; this.searchSize = 0;
      this.heap.length = 0; this.push(from, 0);
      // As with reachPath, stamp visited cells instead of clearing the entire district for each agent.
      this.pathStamp = (this.pathStamp + 1) >>> 0;
      if (!this.pathStamp) { this.pathSeen.fill(0); this.pathStamp = 1; }
      this.pathSeen[from] = this.pathStamp; this.cost[from] = 0; this.parent[from] = -1; this.open[from] = 1;
    }
    const tx = to % this.width, tz = Math.floor(to / this.width);
    while (this.expansions < budget) {
      let best = -1;
      while (this.heap.length) { const candidate = this.pop(); if (this.open[candidate] === 1) { best = candidate; break; } }
      if (best < 0) { this.searching = false; return false; }
      this.expansions++; this.searchSize++; this.open[best] = 2;
      if (best === to) { this.searching = false; for (let cell = to; cell !== from; cell = this.parent[cell]) result.push(cell); result.reverse(); return true; }
      for (let d = 0; d < 4; d++) { const n = this.neighbor(best, d); if (n >= 0 && !this.blocked[n] && (this.pathSeen[n] !== this.pathStamp || this.open[n] !== 2 && this.cost[best] + 1 < this.cost[n])) { this.pathSeen[n] = this.pathStamp; this.cost[n] = this.cost[best] + 1; this.parent[n] = best; this.open[n] = 1; this.push(n, this.cost[n] + (Math.abs(n % this.width - tx) + Math.abs(Math.floor(n / this.width) - tz)) * 1.00001); } }
    }
    return false;
  }
}
