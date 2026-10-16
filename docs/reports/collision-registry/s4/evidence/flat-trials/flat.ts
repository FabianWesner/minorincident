const numericOrder = (a: number, b: number): number => a - b;
export interface ContactCells { epoch: number; radius(id: number): number; intersects(maximum: number, minX: number, minZ: number): boolean }
type Position = { id: number; x: number; z: number; cellX: number; cellZ: number; slot: number };
type Bound = { epoch: number; radius: ContactCells['radius']; maximum: number };
type Cell = { ids: number[]; x: number[]; z: number[]; bound?: Bound; otherBound?: Bound };
/** 4 m cells; the exact distance filter and numeric sort give stable queries. */
export class SpatialHash {
  private readonly inverseCellSize: number;
  constructor(private readonly cellSize = 4) { this.inverseCellSize = 1 / cellSize; }
  // Keep the position in its bucket so dense queries do not look up every ID again.
  private readonly cells = new Map<number, Map<number, Cell>>();
  private readonly free: Position[] = [];
  private readonly positions = new Map<number, Position>();
  set(id: number, x: number, z: number): void {
    const previous = this.positions.get(id);
    if (previous && previous.x === x && previous.z === z) return;
    const cellX = Math.floor(x * this.inverseCellSize), cellZ = Math.floor(z * this.inverseCellSize);
    if (previous && previous.cellX === cellX && previous.cellZ === cellZ) {
      previous.x = x; previous.z = z;
      const cell = this.cells.get(cellX)!.get(cellZ)!;
      cell.x[previous.slot] = x; cell.z[previous.slot] = z; return;
    }
    if (previous) this.removeFromCell(previous);
    const position = previous ?? this.free.pop() ?? { id, x, z, cellX, cellZ, slot: 0 };
    position.id = id; position.x = x; position.z = z; position.cellX = cellX; position.cellZ = cellZ;
    this.positions.set(id, position);
    let column = this.cells.get(cellX);
    if (!column) this.cells.set(cellX, column = new Map());
    let cell = column.get(cellZ);
    if (!cell) column.set(cellZ, cell = { ids: [], x: [], z: [] });
    position.slot = cell.ids.length; cell.ids.push(id); cell.x.push(x); cell.z.push(z);
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
    const cell = this.cells.get(position.cellX)!.get(position.cellZ)!;
    // Retain Map insertion order: contact resolution depends on stable bucket order.
    cell.ids.splice(position.slot, 1); cell.x.splice(position.slot, 1); cell.z.splice(position.slot, 1);
    for (let i = position.slot; i < cell.ids.length; i++) this.positions.get(cell.ids[i])!.slot = i;
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
      const column = this.cells.get(cx); if (!column) continue;
      for (let cz = minZ; cz <= maxZ; cz++) {
        const cell = column.get(cz); if (!cell) continue;
        // Empty retained buckets cannot contain a contact or invoke a visitor.
        if (!cell.ids.length) continue;
        if (contacts) {
          // Occupancy and rollback alternate radius policies in one transaction.
          let bound = cell.bound;
          if (bound?.radius !== contacts.radius && cell.otherBound?.radius === contacts.radius) {
            const previous = bound; bound = cell.otherBound; cell.bound = bound; cell.otherBound = previous;
          }
          if (!bound || bound.epoch !== contacts.epoch || bound.radius !== contacts.radius) {
            if (bound && bound.radius !== contacts.radius) { cell.otherBound = bound; bound = undefined; }
            let maximum = 0; for (let i = 0; i < cell.ids.length; i++) maximum = Math.max(maximum, contacts.radius(cell.ids[i]));
            if (bound) { bound.epoch = contacts.epoch; bound.radius = contacts.radius; bound.maximum = maximum; }
            else { bound = { epoch: contacts.epoch, radius: contacts.radius, maximum }; cell.bound = bound; }
          }
          // No contact in this cell means none of its IDs could move the active body. Preserve cell/ID order.
          if (!contacts.intersects(bound.maximum, cx * this.cellSize, cz * this.cellSize)) continue;
        }
        const ids = cell.ids, xs = cell.x, zs = cell.z;
        for (let i = 0; i < ids.length; i++) {
          const dx = xs[i] - x, dz = zs[i] - z;
          if (dx * dx + dz * dz <= radiusSquared) { if (visit) { if (visit(ids[i]) === false) return result; } else result.push(ids[i]); }
        }
      }
    }
    return sorted ? result.sort(numericOrder) : result;
  }
  reset(): void { this.cells.clear(); this.positions.clear(); this.free.length = 0; }
}
