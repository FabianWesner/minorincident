const numericOrder = (a: number, b: number): number => a - b;
export interface ContactCells { epoch: number; radius(id: number): number; intersects(maximum: number, minX: number, minZ: number): boolean }
type Position = { id: number; x: number; z: number; cellX: number; cellZ: number };
/** 4 m cells; the exact distance filter and numeric sort give stable queries. */
export class SpatialHash {
  // Keep the position in its bucket so dense queries do not look up every ID again.
  private readonly cells = new Map<number, Map<number, Map<number, Position>>>();
  private readonly free: Position[] = [];
  private readonly contactBounds = new WeakMap<Map<number, Position>, { epoch: number; radius: ContactCells['radius']; maximum: number }>();
  private readonly positions = new Map<number, Position>();
  set(id: number, x: number, z: number): void {
    const previous = this.positions.get(id), cellX = Math.floor(x / 4), cellZ = Math.floor(z / 4);
    if (previous && previous.cellX === cellX && previous.cellZ === cellZ) { previous.x = x; previous.z = z; return; }
    if (previous) this.cells.get(previous.cellX)!.get(previous.cellZ)!.delete(id);
    const position = previous ?? this.free.pop() ?? { id, x, z, cellX, cellZ };
    position.id = id; position.x = x; position.z = z; position.cellX = cellX; position.cellZ = cellZ;
    this.positions.set(id, position);
    let column = this.cells.get(cellX);
    if (!column) this.cells.set(cellX, column = new Map());
    let cell = column.get(cellZ);
    if (!cell) column.set(cellZ, cell = new Map());
    cell.set(id, position);
    // Keep a conservative upper bound as bodies change cells during the current contact phase.
    const bound = this.contactBounds.get(cell); if (bound) bound.maximum = Math.max(bound.maximum, bound.radius(id));
  }
  delete(id: number): void {
    const position = this.positions.get(id);
    if (!position) return;
    const cell = this.cells.get(position.cellX)!.get(position.cellZ)!;
    cell.delete(id); this.free.push(position);
    this.positions.delete(id);
  }
  /** A visitor consumes matches in bucket order without materializing IDs; it must not change this index. */
  query(within: { x: number; z: number; r: number }, result: number[] = [], sorted = true, visit?: (id: number) => void, contacts?: ContactCells): number[] {
    const { x, z, r } = within;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(r) || r < 0) throw new RangeError('Query position and radius must be finite, radius nonnegative');
    result.length = 0;
    const minX = Math.floor((x - r) / 4), maxX = Math.floor((x + r) / 4);
    const minZ = Math.floor((z - r) / 4), maxZ = Math.floor((z + r) / 4), radiusSquared = r * r;
    for (let cx = minX; cx <= maxX; cx++) {
      const column = this.cells.get(cx); if (!column) continue;
      for (let cz = minZ; cz <= maxZ; cz++) {
        const cell = column.get(cz); if (!cell) continue;
        if (contacts) {
          let bound = this.contactBounds.get(cell);
          if (!bound || bound.epoch !== contacts.epoch || bound.radius !== contacts.radius) {
            let maximum = 0; for (const id of cell.keys()) maximum = Math.max(maximum, contacts.radius(id));
            bound = { epoch: contacts.epoch, radius: contacts.radius, maximum }; this.contactBounds.set(cell, bound);
          }
          // No contact in this cell means none of its IDs could move the active body. Preserve cell/ID order.
          if (!contacts.intersects(bound.maximum, cx * 4, cz * 4)) continue;
        }
        for (const p of cell.values()) {
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz <= radiusSquared) { if (visit) visit(p.id); else result.push(p.id); }
        }
      }
    }
    return sorted ? result.sort(numericOrder) : result;
  }
  reset(): void { this.cells.clear(); this.positions.clear(); this.free.length = 0; }
}
