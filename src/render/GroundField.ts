import { Vector3, type BufferAttribute, type InterleavedBufferAttribute, type Mesh } from 'three/webgpu';

const CELL = 2;
/**
 * Top of the ground a district actually draws (baked layout GLB roads, road paint, kerbs, paving slabs, lawns): its
 * low triangles in 2 m buckets, as a height field (the highest face over each point). The sim walks a flat y = 0 plane and the layout `surfaces` only carry
 * paving heights (asphalt has none, yet the road boxes top out at 5 cm), so anything that must touch the drawn
 * surface (bicycle tyres, car tyres) asks here instead.
 */
export class GroundField {
  private readonly tris: number[] = [];
  private readonly cells = new Map<number, number[]>();
  private readonly sorted = new Set<number>();
  private readonly uniformCells = new Map<number, number | null>();
  private static readonly v = [new Vector3(), new Vector3(), new Vector3()];
  get triangles(): number { return this.tris.length / 15; }
  /** Add a mesh (world matrix already updated): every face whose top is below `maxHeight`. */
  add(mesh: Mesh, maxHeight = .4): void {
    const position = mesh.geometry.getAttribute('position') as BufferAttribute | InterleavedBufferAttribute, index = mesh.geometry.index;
    const count = index ? index.count : position.count, [a, b, c] = GroundField.v;
    for (let i = 0; i + 2 < count; i += 3) {
      for (const [k, p] of [a, b, c].entries()) p.fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld);
      if (Math.max(a.y, b.y, c.y) > maxHeight) continue;
      // Any face with a footprint (tops, kerb bevels, road paint edges); vertical walls have none. The highest face wins.
      const ux = b.x - a.x, uz = b.z - a.z, vx = c.x - a.x, vz = c.z - a.z;
      if (Math.abs(uz * vx - ux * vz) < 1e-8) continue;
      // Tyre contacts move even on idling vehicles. Precompute the constant
      // barycentric terms rather than retaining a history of moving points.
      const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      const top = Math.max(a.y, b.y, c.y), bottom = Math.min(a.y, b.y, c.y);
      // Barycentric edge tolerance can extrapolate two negative weights. Keep
      // that bound for slopes; a horizontal face has exactly constant height.
      const ceiling = top + (top === bottom ? 0 : (top - bottom) * 2e-6 + 1e-12);
      const id = this.tris.length / 15;
      const minX = Math.min(a.x, b.x, c.x), maxX = Math.max(a.x, b.x, c.x);
      const minZ = Math.min(a.z, b.z, c.z), maxZ = Math.max(a.z, b.z, c.z);
      // Two negative barycentric weights can extrapolate past a vertex. Retain that edge tolerance.
      const padX = (maxX - minX) * 2e-6 + 1e-9, padZ = (maxZ - minZ) * 2e-6 + 1e-9;
      this.tris.push(c.x, c.z, b.z - c.z, c.x - b.x, c.z - a.z, a.x - c.x, d, a.y, b.y, c.y, ceiling, minX - padX, maxX + padX, minZ - padZ, maxZ + padZ);
      const x0 = Math.floor(Math.min(a.x, b.x, c.x) / CELL), x1 = Math.floor(Math.max(a.x, b.x, c.x) / CELL);
      const z0 = Math.floor(Math.min(a.z, b.z, c.z) / CELL), z1 = Math.floor(Math.max(a.z, b.z, c.z) / CELL);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const key = GroundField.key(x, z), list = this.cells.get(key); if (list) list.push(id); else this.cells.set(key, [id]); this.sorted.delete(key); this.uniformCells.delete(key); }
    }
  }
  private static key(x: number, z: number): number { return (x + 32768) * 65536 + (z + 32768); }
  /** Highest drawn ground point at (x, z), or null where the district draws none of its own (off-slice backdrop). */
  height(x: number, z: number): number | null {
    const key = GroundField.key(Math.floor(x / CELL), Math.floor(z / CELL)), list = this.cells.get(key); if (!list) return null;
    const t = this.tris; let best: number | null = null;
    if (!this.sorted.has(key)) { list.sort((a, b) => t[b * 15 + 10] - t[a * 15 + 10]); this.sorted.add(key); }
    let uniform = this.uniformCells.get(key);
    if (uniform === undefined) {
      // The highest flat triangle may cover the entire bucket (large road/floor
      // faces). Every point then has this exact height, even if lower faces overlap.
      const o = list[0] * 15, height = t[o + 7], d = t[o + 6];
      let covered = height === t[o + 8] && height === t[o + 9] && Math.abs(d) >= 1e-12;
      const left = Math.floor(x / CELL) * CELL, top = Math.floor(z / CELL) * CELL;
      for (const cx of [left, left + CELL]) for (const cz of [top, top + CELL]) {
        if (!covered) break;
        const dx = cx - t[o], dz = cz - t[o + 1];
        const u = (t[o + 2] * dx + t[o + 3] * dz) / d, v = (t[o + 4] * dx + t[o + 5] * dz) / d;
        covered = u >= 1e-9 && v >= 1e-9 && 1 - u - v >= 1e-9;
      }
      uniform = covered ? height : null; this.uniformCells.set(key, uniform);
    }
    if (uniform !== null) return uniform;
    for (const id of list) {
      const o = id * 15;
      if (best !== null && best >= t[o + 10]) break;
      if (x < t[o + 11] || x > t[o + 12] || z < t[o + 13] || z > t[o + 14]) continue;
      const dx = x - t[o], dz = z - t[o + 1], d = t[o + 6]; if (Math.abs(d) < 1e-12) continue;
      const u = (t[o + 2] * dx + t[o + 3] * dz) / d, v = (t[o + 4] * dx + t[o + 5] * dz) / d, w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      const y = t[o + 7] === t[o + 8] && t[o + 8] === t[o + 9] ? t[o + 7] : u * t[o + 7] + v * t[o + 8] + w * t[o + 9];
      if (best === null || y > best) best = y;
    }
    return best;
  }
}
