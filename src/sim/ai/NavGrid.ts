import type { ScenarioDefinition } from '../../levels/loader';
type Wall = NonNullable<ScenarioDefinition['walls']>[number];
/** Coarse look-ahead offsets (path nodes) for budgeted NPC steering. */
const lookAhead = [40, 30, 22, 15, 10, 6, 3, 1, 0];
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
  /** Memo of recent `nearestCell` answers (fixed targets such as refuges are asked every tick by every fleeing agent;
   * a blocked target cell costs up to 169 line tests). Cleared whenever blocked cells change. */
  private readonly nearestMemo: { x: number; z: number; r: number; cell: number }[] = [];
  private nearestNext = 0;
  nearestCell(x: number, z: number, radius?: number): number {
    const r = radius ?? -1;
    for (const m of this.nearestMemo) if (m.x === x && m.z === z && m.r === r) return m.cell;
    const cell = this.nearestCellUncached(x, z, radius);
    const slot = { x, z, r, cell };
    if (this.nearestMemo.length < 16) this.nearestMemo.push(slot); else this.nearestMemo[this.nearestNext] = slot;
    this.nearestNext = (this.nearestNext + 1) % 16;
    return cell;
  }
  private nearestCellUncached(x: number, z: number, radius?: number): number {
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
  clear(x: number, z: number, radius = 0, rounded = false, ignoreBlocker?: number): boolean {
    if (this.mask && !this.mask(x, z)) return false;
    if (Math.abs(x - this.center.x) + radius >= this.ground.width / 2 || Math.abs(z - this.center.z) + radius >= this.ground.depth / 2) return false;
    for (const w of this.buckets.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []) if (rounded ? this.intersects(w, x, z, radius) : Math.abs(x - w.x) < w.halfX + radius && Math.abs(z - w.z) < w.halfZ + radius) return false;
    for (const [id, w] of this.blockers) if (id !== ignoreBlocker && (rounded ? this.intersects(w, x, z, radius) : Math.abs(x - w.x) < w.halfX + radius && Math.abs(z - w.z) < w.halfZ + radius)) return false;
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
    this.target = -1; this.searching = false; this.head = this.tail = 0; this.nearestMemo.length = 0;
  }
  /** E11 doors and broken props invalidate only their affected cells and cached searches. */
  setBlocker(id: number, wall: Wall, blocked: boolean): void {
    const previous = this.blockers.get(id);
    if (blocked) this.blockers.set(id, wall); else this.blockers.delete(id);
    if (previous && previous !== wall) this.updateBlockerCells(previous);
    this.updateBlockerCells(wall);
    this.target = -1; this.searching = false; this.nearestMemo.length = 0;
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
  /** `nearest`: when the target is unreachable (a click into a fenced yard), route to the reachable cell closest to it. */
  steer(position: { x: number; z: number }, target: { x: number; z: number }, route: { path: number[]; goal: number; pathIndex: number; hold?: number }, radius: number, waypoint: { x: number; z: number }, budget = 1600, nearest = false): boolean {
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
      for (let k = 0; k < 4; k++) { const n = this.neighbor(cell, k); if (n >= 0 && !this.blocked[n] && seen[n] !== r.stamp) { seen[n] = r.stamp; parent[n] = cell; depth[n] = depth[cell] + 1; queue[r.tail++] = n; } }
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
