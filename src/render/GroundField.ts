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
  private static readonly v = [new Vector3(), new Vector3(), new Vector3()];
  get triangles(): number { return this.tris.length / 9; }
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
      const id = this.tris.length / 9; this.tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      const x0 = Math.floor(Math.min(a.x, b.x, c.x) / CELL), x1 = Math.floor(Math.max(a.x, b.x, c.x) / CELL);
      const z0 = Math.floor(Math.min(a.z, b.z, c.z) / CELL), z1 = Math.floor(Math.max(a.z, b.z, c.z) / CELL);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const key = GroundField.key(x, z), list = this.cells.get(key); if (list) list.push(id); else this.cells.set(key, [id]); }
    }
  }
  private static key(x: number, z: number): number { return (x + 32768) * 65536 + (z + 32768); }
  /** Highest drawn ground point at (x, z), or null where the district draws none of its own (off-slice backdrop). */
  height(x: number, z: number): number | null {
    const list = this.cells.get(GroundField.key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!list) return null;
    const t = this.tris; let best: number | null = null;
    for (const id of list) {
      const o = id * 9, ax = t[o], az = t[o + 2], bx = t[o + 3], bz = t[o + 5], cx = t[o + 6], cz = t[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      const y = u * t[o + 1] + v * t[o + 4] + w * t[o + 7];
      if (best === null || y > best) best = y;
    }
    return best;
  }
}
