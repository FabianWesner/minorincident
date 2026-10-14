const numericOrder = (a: number, b: number): number => a - b;
export interface ContactCells { epoch: number; radius(id: number): number; intersects(maximum: number, minX: number, minZ: number): boolean }
type Position = { id: number; x: number; z: number; cellX: number; cellZ: number; slot: number };
type Cell = { items: Position[]; bound?: { epoch: number; radius: ContactCells['radius']; maximum: number } };
/** 4 m cells; the exact distance filter and numeric sort give stable queries. */
export class SpatialHash {
  // Keep the position in its bucket so dense queries do not look up every ID again.
  private readonly cells = new Map<number, Map<number, Cell>>();
  private readonly free: Position[] = [];
  private readonly positions = new Map<number, Position>();
  set(id: number, x: number, z: number): void {
    const previous = this.positions.get(id), cellX = Math.floor(x / 4), cellZ = Math.floor(z / 4);
    if (previous && previous.cellX === cellX && previous.cellZ === cellZ) { previous.x = x; previous.z = z; return; }
    if (previous) this.removeFromCell(previous);
    const position = previous ?? this.free.pop() ?? { id, x, z, cellX, cellZ, slot: 0 };
    position.id = id; position.x = x; position.z = z; position.cellX = cellX; position.cellZ = cellZ;
    this.positions.set(id, position);
    let column = this.cells.get(cellX);
    if (!column) this.cells.set(cellX, column = new Map());
    let cell = column.get(cellZ);
    if (!cell) column.set(cellZ, cell = { items: [] });
    position.slot = cell.items.length; cell.items.push(position);
    // Keep a conservative upper bound as bodies change cells during the current contact phase.
    const bound = cell.bound; if (bound) bound.maximum = Math.max(bound.maximum, bound.radius(id));
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
          let bound = cell.bound;
          if (!bound || bound.epoch !== contacts.epoch || bound.radius !== contacts.radius) {
            let maximum = 0; for (let i = 0; i < cell.items.length; i++) maximum = Math.max(maximum, contacts.radius(cell.items[i].id));
            bound = { epoch: contacts.epoch, radius: contacts.radius, maximum }; cell.bound = bound;
          }
          // No contact in this cell means none of its IDs could move the active body. Preserve cell/ID order.
          if (!contacts.intersects(bound.maximum, cx * 4, cz * 4)) continue;
        }
        const items = cell.items;
        for (let i = 0; i < items.length; i++) {
          const p = items[i];
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz <= radiusSquared) { if (visit) visit(p.id); else result.push(p.id); }
        }
      }
    }
    return sorted ? result.sort(numericOrder) : result;
  }
  reset(): void { this.cells.clear(); this.positions.clear(); this.free.length = 0; }
}
