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
      for (const n of [
        x > 0 ? i - 1 : -1,
        x < this.width - 1 ? i + 1 : -1,
        i - this.width,
        i + this.width,
      ])
        if (n >= 0 && n < this.cells.length && this.cells[n] && !reached[n]) {
          reached[n] = 1;
          queue[write++] = n;
        }
    }
    return reached;
  }
}
export function bakeNav(districts: NavDistrict[], seed: number): NavGrid {
  const min: Point = [Infinity, Infinity],
    max: Point = [-Infinity, -Infinity];
  for (const d of districts)
    for (const p of d.layout.bounds)
      for (let a = 0; a < 2; a++) {
        min[a] = Math.min(min[a], p[a] + d.origin[a]);
        max[a] = Math.max(max[a], p[a] + d.origin[a]);
      }
  const nav = new NavGrid(min, max, 1, seed);
  for (const d of districts) {
    for (let z = 0; z < nav.height; z++)
      for (let x = 0; x < nav.width; x++) {
        const p: Point = [
          min[0] + x + 0.5 - d.origin[0],
          min[1] + z + 0.5 - d.origin[1],
        ];
        if (
          inside(p, d.layout.bounds) &&
          !d.layout.walkable.excluded.some((area) => inside(p, area)) &&
          !d.colliders.some(
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
  let hash = (2166136261 ^ seed) >>> 0;
  for (const cell of nav.cells) hash = Math.imul(hash ^ cell, 16777619) >>> 0;
  nav.hash = `${nav.width}x${nav.height}:${hash.toString(16).padStart(8, "0")}`;
  return nav;
}
