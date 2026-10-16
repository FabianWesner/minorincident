const numericOrder = (a: number, b: number): number => a - b;
export interface ContactCells { epoch: number; radius(id: number): number; intersects(maximum: number, minX: number, minZ: number): boolean }
type Position = { id: number; x: number; z: number; cellX: number; cellZ: number; slot: number };
type Bound = { epoch: number; radius: ContactCells['radius']; maximum: number };
type Cell = { x: number; z: number; items: Position[]; bound?: Bound; otherBound?: Bound };
/** 4 m cells; the exact distance filter and numeric sort give stable queries. */
export class SpatialHash {
  private readonly inverseCellSize: number;
  constructor(private readonly cellSize = 4) { this.inverseCellSize = 1 / cellSize; }
  // Keep the position in its bucket so dense queries do not look up every ID again.
  private readonly cells = new Map<number, Map<number, Cell>>();
  private readonly free: Position[] = [];
  // Cache cell membership only; positions and contact bounds remain live. The
  // fixed cache retains bucket order and bounds memory as callers explore a level.
  private readonly windows: ({ minX: number; maxX: number; minZ: number; maxZ: number; revision: number; cells: Cell[] } | undefined)[] = [];
  private revision = 0;
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
    let column = this.cells.get(cellX);
    if (!column) this.cells.set(cellX, column = new Map());
    let cell = column.get(cellZ);
    if (!cell) { column.set(cellZ, cell = { x: cellX * this.cellSize, z: cellZ * this.cellSize, items: [] }); this.revision++; }
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
    const items = this.cells.get(position.cellX)!.get(position.cellZ)!.items;
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
    // Hash collisions replace a window; all four bounds are checked before reuse.
    const key = (minX * 73856093 ^ maxX * 19349663 ^ minZ * 83492791 ^ maxZ * 2654435761) & 63;
    let window = this.windows[key];
    if (!window || window.minX !== minX || window.maxX !== maxX || window.minZ !== minZ || window.maxZ !== maxZ || window.revision !== this.revision) {
      const cells: Cell[] = [];
      for (let cx = minX; cx <= maxX; cx++) {
        const column = this.cells.get(cx); if (!column) continue;
        for (let cz = minZ; cz <= maxZ; cz++) { const cell = column.get(cz); if (cell) cells.push(cell); }
      }
      this.windows[key] = window = { minX, maxX, minZ, maxZ, revision: this.revision, cells };
    }
    for (const cell of window.cells) {
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
        if (!contacts.intersects(bound.maximum, cell.x, cell.z)) continue;
      }
      const items = cell.items;
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        const dx = p.x - x, dz = p.z - z;
        if (dx * dx + dz * dz <= radiusSquared) { if (visit) { if (visit(p.id) === false) return result; } else result.push(p.id); }
      }
    }
    return sorted ? result.sort(numericOrder) : result;
  }
  reset(): void { this.cells.clear(); this.positions.clear(); this.free.length = 0; this.windows.length = 0; this.revision++; }
}
