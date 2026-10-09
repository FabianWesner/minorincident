const numericOrder = (a: number, b: number): number => a - b;
type Position = { id: number; x: number; z: number; cellX: number; cellZ: number };
/** 4 m cells; the exact distance filter and numeric sort give stable queries. */
export class SpatialHash {
  // Keep the position in its bucket so dense queries do not look up every ID again.
  private readonly cells = new Map<string, Map<number, Position>>();
  private readonly free: Position[] = [];
  private readonly positions = new Map<number, Position>();
  set(id: number, x: number, z: number): void {
    const previous = this.positions.get(id), cellX = Math.floor(x / 4), cellZ = Math.floor(z / 4);
    if (previous && previous.cellX === cellX && previous.cellZ === cellZ) { previous.x = x; previous.z = z; return; }
    if (previous) this.cells.get(`${previous.cellX},${previous.cellZ}`)!.delete(id);
    const position = previous ?? this.free.pop() ?? { id, x, z, cellX, cellZ };
    position.id = id; position.x = x; position.z = z; position.cellX = cellX; position.cellZ = cellZ;
    this.positions.set(id, position);
    const key = `${cellX},${cellZ}`;
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, cell = new Map());
    cell.set(id, position);
  }
  delete(id: number): void {
    const position = this.positions.get(id);
    if (!position) return;
    const cell = this.cells.get(`${position.cellX},${position.cellZ}`)!;
    cell.delete(id); this.free.push(position);
    this.positions.delete(id);
  }
  query(within: { x: number; z: number; r: number }, result: number[] = [], sorted = true): number[] {
    const { x, z, r } = within;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(r) || r < 0) throw new RangeError('Query position and radius must be finite, radius nonnegative');
    result.length = 0;
    const minX = Math.floor((x - r) / 4), maxX = Math.floor((x + r) / 4);
    const minZ = Math.floor((z - r) / 4), maxZ = Math.floor((z + r) / 4), radiusSquared = r * r;
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const cell = this.cells.get(`${cx},${cz}`); if (!cell) continue;
        for (const p of cell.values()) {
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz <= radiusSquared) result.push(p.id);
        }
      }
    }
    return sorted ? result.sort(numericOrder) : result;
  }
  reset(): void { this.cells.clear(); this.positions.clear(); this.free.length = 0; }
}
