import type { ScenarioDefinition } from '../../levels/loader';
type Wall = NonNullable<ScenarioDefinition['walls']>[number];
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
  private readonly heap: { cell: number; score: number }[] = [];
  private readonly buckets = new Map<string, Wall[]>();
  private searchFrom = -1;
  private searchTo = -1;
  private searching = false;
  private head = 0;
  private tail = 0;
  private readonly blockers = new Map<number, Wall>();
  /** Optional active-district footprint, supplied by campaign assembly without importing render data. */
  mask: ((x: number, z: number) => boolean) | null = null;
  target = -1;
  expansions = 0;
  constructor(readonly ground: { width: number; depth: number }, readonly walls: readonly Wall[], readonly clearance = 0.65, readonly center = { x: 0, z: 0 }, mask: NavGrid['mask'] = null) {
    this.mask = mask;
    this.width = Math.ceil(ground.width / this.cellSize); this.depth = Math.ceil(ground.depth / this.cellSize);
    const count = this.width * this.depth;
    this.blocked = new Uint8Array(count); this.distance = new Int32Array(count); this.queue = new Int32Array(count);
    this.parent = new Int32Array(count); this.cost = new Float64Array(count); this.open = new Uint8Array(count);
    this.distance.fill(-1);
    this.indexWalls();
    for (let cell = 0; cell < count; cell++) this.blocked[cell] = Number(!this.clear(this.x(cell), this.z(cell), clearance));
  }
  cell(x: number, z: number): number {
    const cx = Math.floor((x - this.center.x + this.ground.width / 2) / this.cellSize), cz = Math.floor((z - this.center.z + this.ground.depth / 2) / this.cellSize);
    return cx < 0 || cz < 0 || cx >= this.width || cz >= this.depth ? -1 : cz * this.width + cx;
  }
  /** Player clearance is smaller than AI clearance. Route to the nearest walkable
   * cell when the player hugs a collider, then use direct movement once visible. */
  nearestCell(x: number, z: number, radius?: number): number {
    const reachable = (cell: number) => radius === undefined || this.visible({ x, z }, { x: this.x(cell), z: this.z(cell) }, radius);
    const cell=this.cell(x,z);if(cell<0||!this.blocked[cell] && reachable(cell))return cell;
    let nearest=-1,distance=Infinity;
    for(let dz=-6;dz<=6;dz++)for(let dx=-6;dx<=6;dx++){
      const candidate=this.cell(x+dx*this.cellSize,z+dz*this.cellSize);if(candidate<0||this.blocked[candidate]||!reachable(candidate))continue;
      const d=(this.x(candidate)-x)**2+(this.z(candidate)-z)**2;if(d<distance){nearest=candidate;distance=d;}
    }
    return nearest;
  }
  x(cell: number): number { return (cell % this.width + 0.5) * this.cellSize - this.ground.width / 2 + this.center.x; }
  z(cell: number): number { return (Math.floor(cell / this.width) + 0.5) * this.cellSize - this.ground.depth / 2 + this.center.z; }
  clear(x: number, z: number, radius = 0, rounded = false): boolean {
    if (this.mask && !this.mask(x, z)) return false;
    if (Math.abs(x - this.center.x) + radius >= this.ground.width / 2 || Math.abs(z - this.center.z) + radius >= this.ground.depth / 2) return false;
    for (const w of this.buckets.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []) if (rounded ? this.intersects(w, x, z, radius) : Math.abs(x - w.x) < w.halfX + radius && Math.abs(z - w.z) < w.halfZ + radius) return false;
    for (const w of this.blockers.values()) if (rounded ? this.intersects(w, x, z, radius) : Math.abs(x - w.x) < w.halfX + radius && Math.abs(z - w.z) < w.halfZ + radius) return false;
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
    for (const wall of this.walls) for (let z = Math.floor((wall.z - wall.halfZ - 2) / 4); z <= Math.floor((wall.z + wall.halfZ + 2) / 4); z++) for (let x = Math.floor((wall.x - wall.halfX - 2) / 4); x <= Math.floor((wall.x + wall.halfX + 2) / 4); x++) {
      const key = `${x},${z}`, bucket = this.buckets.get(key) ?? []; bucket.push(wall); this.buckets.set(key, bucket);
    }
  }
  /** E08 campaign tier swaps replace static walls, retaining the fixed search workspace. */
  prepare(walls: readonly Wall[]): Uint8Array {
    return new NavGrid(this.ground, walls, this.clearance, this.center, this.mask).blocked;
  }
  rebake(prepared?: Uint8Array): void {
    this.indexWalls();
    if (prepared) {
      this.blocked.set(prepared);
      for (const wall of this.blockers.values()) this.updateBlockerCells(wall);
    } else for (let cell = 0; cell < this.blocked.length; cell++) this.blocked[cell] = Number(!this.clear(this.x(cell), this.z(cell), this.clearance));
    this.target = -1; this.searching = false; this.head = this.tail = 0;
  }
  /** E11 doors and broken props invalidate only their affected cells and cached searches. */
  setBlocker(id: number, wall: Wall, blocked: boolean): void {
    const previous = this.blockers.get(id);
    if (blocked) this.blockers.set(id, wall); else this.blockers.delete(id);
    if (previous && previous !== wall) this.updateBlockerCells(previous);
    this.updateBlockerCells(wall);
    this.target = -1; this.searching = false;
  }
  private updateBlockerCells(wall: Wall): void {
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
    const walls = new Set(this.blockers.values());
    for (let i = 0; i <= steps; i++) {
      const x = from.x + dx * i / Math.max(1, steps), z = from.z + dz * i / Math.max(1, steps);
      if (this.mask && !this.mask(x, z)) return false;
      if (Math.abs(x - this.center.x) + radius >= this.ground.width / 2 || Math.abs(z - this.center.z) + radius >= this.ground.depth / 2) return false;
      for (const wall of this.buckets.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []) walls.add(wall);
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
      for (const [start, delta, center, half] of [[from.x, dx, wall.x, wall.halfX], [from.z, dz, wall.z, wall.halfZ]]) {
        const min = center - half - radius, max = center + half + radius;
        if (delta === 0) { if (start <= min || start >= max) { leave = -1; break; } }
        else {
          const a = (min - start) / delta, b = (max - start) / delta;
          enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
        }
      }
      if (enter < leave) return false;
    }
    return true;
  }
  /** Sweeps movement in subcell increments; axis fallback slides around collider corners. */
  move(position: { x: number; z: number }, dx: number, dz: number, radius: number): void {
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2)); dx /= count; dz /= count;
    for (let i = 0; i < count; i++) {
      if (this.clear(position.x + dx, position.z + dz, radius)) { position.x += dx; position.z += dz; }
      else { if (this.clear(position.x + dx, position.z, radius)) position.x += dx; if (this.clear(position.x, position.z + dz, radius)) position.z += dz; }
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
  steer(position: { x: number; z: number }, target: { x: number; z: number }, route: { path: number[]; goal: number; pathIndex: number }, radius: number, waypoint: { x: number; z: number }, budget = 1600): boolean {
    if (this.visible(position, target, radius)) { route.path.length = 0; route.goal = -1; Object.assign(waypoint, target); return true; }
    const to = this.nearestCell(target.x, target.z, radius);
    if (to !== route.goal || route.pathIndex >= route.path.length) {
      if (!this.path(this.nearestCell(position.x, position.z, radius), to, route.path, budget)) return false;
      route.goal = to; route.pathIndex = 0;
    }
    while (route.pathIndex < route.path.length && Math.hypot(position.x - this.x(route.path[route.pathIndex]), position.z - this.z(route.path[route.pathIndex])) < .12) route.pathIndex++;
    for (let i = route.path.length - 1; i >= route.pathIndex; i--) {
      waypoint.x = this.x(route.path[i]); waypoint.z = this.z(route.path[i]);
      if (this.visible(position, waypoint, radius)) { route.pathIndex = i; return true; }
    }
    route.goal = -1; return false;
  }
  /** Budgeted A*; caller retries later if the tick budget is exhausted. Writes into a reused path array. */
  path(from: number, to: number, result: number[], budget: number): boolean {
    result.length = 0; this.expansions = 0;
    if (from < 0 || to < 0 || this.blocked[from] || this.blocked[to]) return false;
    if (!this.searching || this.searchFrom !== from || this.searchTo !== to) {
      this.searchFrom = from; this.searchTo = to; this.searching = true;
      this.heap.length = 0; this.push(from, 0);
      this.cost.fill(Infinity); this.parent.fill(-1); this.open.fill(0); this.cost[from] = 0; this.open[from] = 1;
    }
    const tx = to % this.width, tz = Math.floor(to / this.width);
    while (this.expansions < budget) {
      let best = -1;
      while (this.heap.length) { const candidate = this.pop(); if (this.open[candidate] === 1) { best = candidate; break; } }
      if (best < 0) { this.searching = false; return false; }
      this.expansions++; this.open[best] = 2;
      if (best === to) { this.searching = false; for (let cell = to; cell !== from; cell = this.parent[cell]) result.push(cell); result.reverse(); return true; }
      for (let d = 0; d < 4; d++) { const n = this.neighbor(best, d); if (n >= 0 && !this.blocked[n] && this.open[n] !== 2 && this.cost[best] + 1 < this.cost[n]) { this.cost[n] = this.cost[best] + 1; this.parent[n] = best; this.open[n] = 1; this.push(n, this.cost[n] + (Math.abs(n % this.width - tx) + Math.abs(Math.floor(n / this.width) - tz)) * 1.00001); } }
    }
    return false;
  }
}
