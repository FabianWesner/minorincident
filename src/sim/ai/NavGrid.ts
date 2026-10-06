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
  private searchFrom = -1;
  private searchTo = -1;
  private searching = false;
  private head = 0;
  private tail = 0;
  private readonly blockers = new Map<number, Wall>();
  target = -1;
  expansions = 0;
  constructor(readonly ground: { width: number; depth: number }, readonly walls: readonly Wall[], readonly clearance = 0.65, readonly center = { x: 0, z: 0 }) {
    this.width = Math.ceil(ground.width / this.cellSize); this.depth = Math.ceil(ground.depth / this.cellSize);
    const count = this.width * this.depth;
    this.blocked = new Uint8Array(count); this.distance = new Int32Array(count); this.queue = new Int32Array(count);
    this.parent = new Int32Array(count); this.cost = new Float64Array(count); this.open = new Uint8Array(count);
    this.distance.fill(-1);
    for (let cell = 0; cell < count; cell++) this.blocked[cell] = Number(!this.clear(this.x(cell), this.z(cell), clearance));
  }
  cell(x: number, z: number): number {
    const cx = Math.floor((x - this.center.x + this.ground.width / 2) / this.cellSize), cz = Math.floor((z - this.center.z + this.ground.depth / 2) / this.cellSize);
    return cx < 0 || cz < 0 || cx >= this.width || cz >= this.depth ? -1 : cz * this.width + cx;
  }
  x(cell: number): number { return (cell % this.width + 0.5) * this.cellSize - this.ground.width / 2 + this.center.x; }
  z(cell: number): number { return (Math.floor(cell / this.width) + 0.5) * this.cellSize - this.ground.depth / 2 + this.center.z; }
  clear(x: number, z: number, radius = 0): boolean {
    if (Math.abs(x - this.center.x) + radius >= this.ground.width / 2 || Math.abs(z - this.center.z) + radius >= this.ground.depth / 2) return false;
    for (const w of this.walls) if (Math.abs(x - w.x) < w.halfX + radius && Math.abs(z - w.z) < w.halfZ + radius) return false;
    for (const w of this.blockers.values()) if (Math.abs(x - w.x) < w.halfX + radius && Math.abs(z - w.z) < w.halfZ + radius) return false;
    return true;
  }
  /** E11 doors and broken props invalidate only their affected cells and cached searches. */
  setBlocker(id: number, wall: Wall, blocked: boolean): void {
    if (blocked) this.blockers.set(id, wall); else this.blockers.delete(id);
    for (let cell = 0; cell < this.blocked.length; cell++) {
      const x = this.x(cell), z = this.z(cell);
      if (Math.abs(x - wall.x) <= wall.halfX + this.clearance + this.cellSize && Math.abs(z - wall.z) <= wall.halfZ + this.clearance + this.cellSize) this.blocked[cell] = Number(!this.clear(x, z, this.clearance));
    }
    this.target = -1; this.searching = false;
  }
  visible(from: { x: number; z: number }, to: { x: number; z: number }, radius: number): boolean {
    if (!this.walls.length && !this.blockers.size) return this.clear(to.x, to.z, radius);
    const dx = to.x - from.x, dz = to.z - from.z, steps = Math.ceil(Math.hypot(dx, dz) / 0.2);
    for (let i = 0; i <= steps; i++) if (!this.clear(from.x + dx * i / Math.max(1, steps), from.z + dz * i / Math.max(1, steps), radius)) return false;
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
  /** Budgeted A*; caller retries later if the tick budget is exhausted. Writes into a reused path array. */
  path(from: number, to: number, result: number[], budget: number): boolean {
    result.length = 0; this.expansions = 0;
    if (from < 0 || to < 0 || this.blocked[from] || this.blocked[to]) return false;
    if (!this.searching || this.searchFrom !== from || this.searchTo !== to) {
      this.searchFrom = from; this.searchTo = to; this.searching = true;
      this.cost.fill(Infinity); this.parent.fill(-1); this.open.fill(0); this.cost[from] = 0; this.open[from] = 1;
    }
    const tx = to % this.width, tz = Math.floor(to / this.width);
    while (this.expansions < budget) {
      let best = -1, score = Infinity, heuristic = Infinity;
      for (let i = 0; i < this.open.length; i++) if (this.open[i] === 1) { const h = Math.abs(i % this.width - tx) + Math.abs(Math.floor(i / this.width) - tz), f = this.cost[i] + h; if (f < score || (f === score && h < heuristic)) { score = f; heuristic = h; best = i; } }
      if (best < 0) { this.searching = false; return false; }
      this.expansions++; this.open[best] = 2;
      if (best === to) { this.searching = false; for (let cell = to; cell !== from; cell = this.parent[cell]) result.push(cell); result.reverse(); return true; }
      for (let d = 0; d < 4; d++) { const n = this.neighbor(best, d); if (n >= 0 && !this.blocked[n] && this.open[n] !== 2 && this.cost[best] + 1 < this.cost[n]) { this.cost[n] = this.cost[best] + 1; this.parent[n] = best; this.open[n] = 1; } }
    }
    return false;
  }
}
