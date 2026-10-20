const numericOrder = (a: number, b: number): number => a - b;
export interface ContactCells { epoch: number; radius(id: number): number; intersects(maximum: number, minX: number, minZ: number): boolean }
type Position = { id: number; x: number; z: number; cellX: number; cellZ: number; slot: number };
type Bound = { epoch: number; radius: ContactCells['radius']; maximum: number };
type Cell = { items: Position[]; bound?: Bound; otherBound?: Bound };
/** Unique for |cell| < 2^15 per axis (±131 km at 4 m cells); a Smi on every engine. Non-finite cells keep one NaN key as before. */
const cellKey = (cellX: number, cellZ: number): number => cellX * 65536 + cellZ;
/** 4 m cells; the exact distance filter and numeric sort give stable queries. */
export class SpatialHash {
  private readonly inverseCellSize: number;
  constructor(private readonly cellSize = 4) { this.inverseCellSize = 1 / cellSize; }
  // Keep the position in its bucket so dense queries do not look up every ID again.
  // perf-w6: one map keyed by both cell coordinates (one lookup per visited cell; auxiliary IDs from
  // 1e9 keep the position records in a Map). Query order is unchanged: the loops below still visit X columns, then Z rows, then bucket order.
  private readonly cells = new Map<number, Cell>();
  private readonly free: Position[] = [];
  private readonly positions = new Map<number, Position>();
  set(id: number, x: number, z: number): void {
    const previous = this.positions.get(id);
    if (previous && previous.x === x && previous.z === z) return;
    const cellX = Math.floor(x * this.inverseCellSize), cellZ = Math.floor(z * this.inverseCellSize);
    if (previous && previous.cellX === cellX && previous.cellZ === cellZ) { previous.x = x; previous.z = z; return; }
    if (previous) this.removeFromCell(previous);
    const position = previous ?? this.free.pop() ?? { id, x, z, cellX, cellZ, slot: 0 };
    position.id = id; position.x = x; position.z = z; position.cellX = cellX; position.cellZ = cellZ;
    this.positions.set(id, position);
    const key = cellKey(cellX, cellZ);
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, cell = { items: [] });
    position.slot = cell.items.length; cell.items.push(position);
    // Keep a conservative upper bound as bodies change cells during the current contact phase.
    const bound = cell.bound; if (bound) {
      bound.maximum = Math.max(bound.maximum, bound.radius(id));
      const other = cell.otherBound; if (other) other.maximum = Math.max(other.maximum, other.radius(id));
    }
  }
  delete(id: number): void {
    const position = this.positions.get(id);
    if (!position) return;
    this.removeFromCell(position); this.free.push(position);
    this.positions.delete(id);
  }
  private removeFromCell(position: Position): void {
    const items = this.cells.get(cellKey(position.cellX, position.cellZ))!.items;
    // Retain Map insertion order: contact resolution depends on stable bucket order.
    items.splice(position.slot, 1);
    for (let i = position.slot; i < items.length; i++) items[i].slot = i;
  }
  /** A visitor consumes matches in bucket order without materializing IDs; false stops the query.
   * It must not change this index. Other return values are ignored. */
  query(within: { x: number; z: number; r: number }, result: number[] = [], sorted = true, visit?: (id: number) => unknown, contacts?: ContactCells): number[] {
    const { x, z, r } = within;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(r) || r < 0) throw new RangeError('Query position and radius must be finite, radius nonnegative');
    result.length = 0;
    const minX = Math.floor((x - r) * this.inverseCellSize), maxX = Math.floor((x + r) * this.inverseCellSize);
    const minZ = Math.floor((z - r) * this.inverseCellSize), maxZ = Math.floor((z + r) * this.inverseCellSize), radiusSquared = r * r;
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const cell = this.cells.get(cellKey(cx, cz)); if (!cell) continue;
        // Empty retained buckets cannot contain a contact or invoke a visitor.
        if (!cell.items.length) continue;
        if (contacts) {
          // Occupancy and rollback alternate radius policies in one transaction.
          let bound = cell.bound;
          if (bound?.radius !== contacts.radius && cell.otherBound?.radius === contacts.radius) {
            const previous = bound; bound = cell.otherBound; cell.bound = bound; cell.otherBound = previous;
          }
          if (!bound || bound.epoch !== contacts.epoch || bound.radius !== contacts.radius) {
            if (bound && bound.radius !== contacts.radius) { cell.otherBound = bound; bound = undefined; }
            let maximum = 0; for (let i = 0; i < cell.items.length; i++) maximum = Math.max(maximum, contacts.radius(cell.items[i].id));
            if (bound) { bound.epoch = contacts.epoch; bound.radius = contacts.radius; bound.maximum = maximum; }
            else { bound = { epoch: contacts.epoch, radius: contacts.radius, maximum }; cell.bound = bound; }
          }
          // No contact in this cell means none of its IDs could move the active body. Preserve cell/ID order.
          if (!contacts.intersects(bound.maximum, cx * this.cellSize, cz * this.cellSize)) continue;
        }
        const items = cell.items;
        for (let i = 0; i < items.length; i++) {
          const p = items[i];
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz <= radiusSquared) { if (visit) { if (visit(p.id) === false) return result; } else result.push(p.id); }
        }
      }
    }
    return sorted ? result.sort(numericOrder) : result;
  }
  reset(): void { this.cells.clear(); this.positions.clear(); this.free.length = 0; }
}
