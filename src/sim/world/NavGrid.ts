import type { Aabb, DistrictLayout, Point } from "../../levels/districts/types";
import { inside } from "../../levels/districts/validate";
export interface NavDistrict {
  layout: DistrictLayout;
  origin: Point;
  colliders: Aabb[];
}
/** Dense 1m grid, baked once at load. The occupancy/hash contains no wall time or render data. */
export class NavGrid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
  hash = "";
  private readonly blocks = new Map<number, number[]>();
  private readonly occupancy = new Map<number, { count: number; base: number }>();
  /** Dynamic blockers preserve baked occupancy and overlapping doors/fences. */
  block(id: number, wall: { x: number; z: number; halfX: number; halfZ: number }): void {
    if (this.blocks.has(id)) return;
    const indices: number[] = [];
    const x0 = Math.max(0, Math.ceil((wall.x - wall.halfX - .4 - this.min[0]) / this.cellSize - .5)),
      x1 = Math.min(this.width - 1, Math.floor((wall.x + wall.halfX + .4 - this.min[0]) / this.cellSize - .5)),
      z0 = Math.max(0, Math.ceil((wall.z - wall.halfZ - .4 - this.min[1]) / this.cellSize - .5)),
      z1 = Math.min(this.height - 1, Math.floor((wall.z + wall.halfZ + .4 - this.min[1]) / this.cellSize - .5));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const px = this.min[0] + (x + .5) * this.cellSize, pz = this.min[1] + (z + .5) * this.cellSize;
      if (Math.abs(px - wall.x) > wall.halfX + .4 || Math.abs(pz - wall.z) > wall.halfZ + .4) continue;
      const index = z * this.width + x, cell = this.occupancy.get(index) ?? { count: 0, base: this.cells[index] };
      cell.count++; this.occupancy.set(index, cell); this.cells[index] = 0; indices.push(index);
    }
    this.blocks.set(id, indices); this.rehash();
  }
  unblock(id: number): void {
    for (const index of this.blocks.get(id) ?? []) {
      const cell = this.occupancy.get(index)!;
      if (--cell.count === 0) { this.cells[index] = cell.base; this.occupancy.delete(index); }
    }
    this.blocks.delete(id); this.rehash();
  }
  private rehash(): void {
    let hash = (2166136261 ^ this.hashSeed) >>> 0;
    for (const cell of this.cells) hash = Math.imul(hash ^ cell, 16777619) >>> 0;
    this.hash = `${this.width}x${this.height}:${hash.toString(16).padStart(8, '0')}`;
  }
  constructor(
    readonly min: Point,
    readonly max: Point,
    readonly cellSize = 1,
    private readonly hashSeed = 0,
  ) {
    this.width = Math.ceil((max[0] - min[0]) / cellSize);
    this.height = Math.ceil((max[1] - min[1]) / cellSize);
    this.cells = new Uint8Array(this.width * this.height);
  }
  index(x: number, z: number): number {
    const cx = Math.floor((x - this.min[0]) / this.cellSize),
      cz = Math.floor((z - this.min[1]) / this.cellSize);
    return cx < 0 || cz < 0 || cx >= this.width || cz >= this.height
      ? -1
      : cz * this.width + cx;
  }
  walkable(p: Point): boolean {
    return this.cells[this.index(...p)] === 1;
  }
  /** Click destinations stay on baked walkable ground, including clicks beyond a district edge. */
  clamp(p: Point): Point {
    if (this.walkable(p)) return [...p];
    let nearest: Point | null = null, distance = Infinity;
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i]) {
      const x = this.min[0] + (i % this.width + .5) * this.cellSize;
      const z = this.min[1] + (Math.floor(i / this.width) + .5) * this.cellSize;
      const d = (x - p[0]) ** 2 + (z - p[1]) ** 2;
      if (d < distance) { distance = d; nearest = [x, z]; }
    }
    if (!nearest) throw new Error('No walkable destination');
    return nearest;
  }
  /** Load/test-time flood fill. The typed queue bounds memory and does not use Array.shift(). */
  flood(start: Point): Uint8Array {
    const reached = new Uint8Array(this.cells.length),
      queue = new Int32Array(this.cells.length),
      first = this.index(...start);
    if (first < 0 || !this.cells[first]) return reached;
    let read = 0,
      write = 1;
    queue[0] = first;
    reached[first] = 1;
    while (read < write) {
      const i = queue[read++],
        x = i % this.width;
      // L10 visits millions of cells at load: do not allocate a four-element array for each one.
      for (let direction = 0; direction < 4; direction++) {
        const n = direction === 0 ? x > 0 ? i - 1 : -1 : direction === 1 ? x < this.width - 1 ? i + 1 : -1 : direction === 2 ? i - this.width : i + this.width;
        if (n >= 0 && n < this.cells.length && this.cells[n] && !reached[n]) {
          reached[n] = 1;
          queue[write++] = n;
        }
      }
    }
    return reached;
  }
}
export function bakeNav(districts: NavDistrict[], seed: number, cellSize = 1): NavGrid {
  const min: Point = [Infinity, Infinity],
    max: Point = [-Infinity, -Infinity];
  for (const d of districts)
    for (const p of d.layout.bounds)
      for (let a = 0; a < 2; a++) {
        min[a] = Math.min(min[a], p[a] + d.origin[a]);
        max[a] = Math.max(max[a], p[a] + d.origin[a]);
      }
  const nav = new NavGrid(min, max, cellSize, seed);
  for (const d of districts) {
    const excluded = d.layout.walkable.excluded.map(area => ({ area,
      minX: Math.min(...area.map(p => p[0])), maxX: Math.max(...area.map(p => p[0])),
      minZ: Math.min(...area.map(p => p[1])), maxZ: Math.max(...area.map(p => p[1])),
    }));
    const buckets = new Map<string, Aabb[]>();
    for (const a of d.colliders.filter(a => a.navBlocker || (a.min[1] < 1.8 && a.max[1] > .05))) for (let z = Math.floor((a.min[2] - .4) / 4); z <= Math.floor((a.max[2] + .4) / 4); z++) for (let x = Math.floor((a.min[0] - .4) / 4); x <= Math.floor((a.max[0] + .4) / 4); x++) {
      const key = `${x},${z}`, bucket = buckets.get(key) ?? []; bucket.push(a); buckets.set(key, bucket);
    }
    const bounds = d.layout.bounds, xs = bounds.map(p => p[0]), zs = bounds.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    // Rectangle layouts (including L10's 8.88 million cells) need no polygon test. Other outlines retain it.
    const rectangle = bounds.length >= 4 && bounds.length <= 5 && bounds.every((p, i) =>
      (p[0] === minX || p[0] === maxX) && (p[1] === minZ || p[1] === maxZ) &&
      (p[0] === bounds[(i + 1) % bounds.length][0] || p[1] === bounds[(i + 1) % bounds.length][1]));
    const x0 = Math.max(0, Math.ceil((minX + d.origin[0] - min[0]) / cellSize - .5)), x1 = Math.min(nav.width, Math.ceil((maxX + d.origin[0] - min[0]) / cellSize - .5));
    const z0 = Math.max(0, Math.ceil((minZ + d.origin[1] - min[1]) / cellSize - .5)), z1 = Math.min(nav.height, Math.ceil((maxZ + d.origin[1] - min[1]) / cellSize - .5));
    if (districts.length === 1 && rectangle && !excluded.length) {
      // One rectangular district can fill open rows and rasterize its collider boxes directly. L10 otherwise
      // queried an empty spatial bucket for most of its 8.88M cells. Multi-district unions keep the general path.
      for (let z = z0; z < z1; z++) nav.cells.fill(1, z * nav.width + x0, z * nav.width + x1);
      for (const a of d.colliders) {
        if (!(a.navBlocker || a.min[1] < 1.8 && a.max[1] > .05)) continue;
        const ranges = [0, 1].map(axis => {
          const low = a.min[axis === 0 ? 0 : 2] - .4, high = a.max[axis === 0 ? 0 : 2] + .4;
          const limit = axis === 0 ? nav.width : nav.height;
          let first = Math.max(0, Math.ceil((low + d.origin[axis] - min[axis]) / cellSize - .5));
          let last = Math.min(limit - 1, Math.floor((high + d.origin[axis] - min[axis]) / cellSize - .5));
          // Preserve the general path's exact floating-point boundary comparisons after translating a district.
          const coordinate = (i: number) => min[axis] + (i + .5) * cellSize - d.origin[axis];
          if (first < limit && coordinate(first) < low) first++;
          if (first > 0 && coordinate(first - 1) >= low) first--;
          if (last >= 0 && coordinate(last) > high) last--;
          if (last + 1 < limit && coordinate(last + 1) <= high) last++;
          return [first, last];
        });
        if (ranges[0][0] > ranges[0][1]) continue;
        for (let z = ranges[1][0]; z <= ranges[1][1]; z++) nav.cells.fill(0, z * nav.width + ranges[0][0], z * nav.width + ranges[0][1] + 1);
      }
      continue;
    }
    for (let z = z0; z < z1; z++) {
      const p: Point = [0, min[1] + (z + .5) * cellSize - d.origin[1]], bz = Math.floor(p[1] / 4);
      let previousBucket = Infinity, blockers: Aabb[] = [];
      for (let x = x0; x < x1; x++) {
        p[0] = min[0] + (x + .5) * cellSize - d.origin[0];
        const bx = Math.floor(p[0] / 4);
        // Adjacent cells share a collider bucket: build its key once per four metres, not once per cell.
        if (bx !== previousBucket) { previousBucket = bx; blockers = buckets.get(`${bx},${bz}`) ?? []; }
        if (
          (rectangle || inside(p, bounds)) &&
          !excluded.some(box => p[0] >= box.minX && p[0] <= box.maxX && p[1] >= box.minZ && p[1] <= box.maxZ && inside(p, box.area)) &&
          ! blockers.some(
            (a) =>
              p[0] >= a.min[0] - 0.4 &&
              p[0] <= a.max[0] + 0.4 &&
              p[1] >= a.min[2] - 0.4 &&
              p[1] <= a.max[2] + 0.4,
          )
        )
          nav.cells[z * nav.width + x] = 1;
      }
    }
  }
  let hash = (2166136261 ^ seed) >>> 0;
  for (const cell of nav.cells) hash = Math.imul(hash ^ cell, 16777619) >>> 0;
  nav.hash = `${nav.width}x${nav.height}:${hash.toString(16).padStart(8, "0")}`;
  return nav;
}
