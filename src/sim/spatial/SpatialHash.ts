const numericOrder = (a: number, b: number): number => a - b;
export interface ContactCells { epoch: number; radius(id: number): number; intersects(maximum: number, minX: number, minZ: number): boolean }
type Position = { id: number; x: number; z: number; cellX: number; cellZ: number };
type ContactBound = { epoch: number; radius: ContactCells['radius']; maximum: number; positions: Position[] };
type Cell = Map<number, Position> & { contacts?: ContactBound };
/** 4 m cells; the exact distance filter and numeric sort give stable queries. */
export class SpatialHash {
  // Keep the position in its bucket so dense queries do not look up every ID again.
  private readonly cells = new Map<number, Map<number, Cell>>();
  private readonly free: Position[] = [];
  private readonly positions = new Map<number, Position>();
  set(id: number, x: number, z: number): void {
    const previous = this.positions.get(id), cellX = Math.floor(x / 4), cellZ = Math.floor(z / 4);
    if (previous && previous.cellX === cellX && previous.cellZ === cellZ) { previous.x = x; previous.z = z; return; }
    if (previous) {
      const oldCell = this.cells.get(previous.cellX)!.get(previous.cellZ)!;
      oldCell.delete(id);
      const bound = oldCell.contacts, index = bound?.positions.indexOf(previous) ?? -1;
      if (index >= 0) bound!.positions.splice(index, 1);
    }
    const position = previous ?? this.free.pop() ?? { id, x, z, cellX, cellZ };
    position.id = id; position.x = x; position.z = z; position.cellX = cellX; position.cellZ = cellZ;
    this.positions.set(id, position);
    let column = this.cells.get(cellX);
    if (!column) this.cells.set(cellX, column = new Map());
    let cell = column.get(cellZ);
    if (!cell) { cell = new Map(); cell.contacts = undefined; column.set(cellZ, cell); }
    cell.set(id, position);
    // Keep a conservative upper bound as bodies change cells during the current contact phase.
    const bound = cell.contacts;
    if (bound) {
      const radius = bound.radius(id); bound.maximum = Math.max(bound.maximum, radius);
      if (radius > 0) bound.positions.push(position);
    }
  }
  delete(id: number): void {
    const position = this.positions.get(id);
    if (!position) return;
    const cell = this.cells.get(position.cellX)!.get(position.cellZ)!;
    cell.delete(id);
    const bound = cell.contacts, index = bound?.positions.indexOf(position) ?? -1;
    if (index >= 0) bound!.positions.splice(index, 1);
    this.free.push(position);
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
          let bound = cell.contacts;
          if (!bound || bound.epoch !== contacts.epoch || bound.radius !== contacts.radius) {
            if (!bound) {
              bound = { epoch: contacts.epoch, radius: contacts.radius, maximum: 0, positions: [] };
              cell.contacts = bound;
            }
            // Membership is rescanned each phase, but its backing list need not
            // be allocated again for every occupied cell on all sixty ticks.
            bound.epoch = contacts.epoch; bound.radius = contacts.radius; bound.maximum = 0; bound.positions.length = 0;
            for (const p of cell.values()) { const radius = contacts.radius(p.id); bound.maximum = Math.max(bound.maximum, radius); if (radius > 0) bound.positions.push(p); }
          }
          // No contact in this cell means none of its IDs could move the active body. Preserve cell/ID order.
          if (!contacts.intersects(bound.maximum, cx * 4, cz * 4)) continue;
          // Lights, props and settled bodies cannot participate in character separation.
          // Keep only eligible positions in the exact current bucket order.
          // Keep this dense loop separate from Map iteration. Mixing the two
          // iterator types on hundreds of contact queries defeats its hot path.
          const positions = bound.positions;
          for (let i = 0; i < positions.length; i++) {
            const p = positions[i], dx = p.x - x, dz = p.z - z;
            if (dx * dx + dz * dz <= radiusSquared) { if (visit) visit(p.id); else result.push(p.id); }
          }
        } else for (const p of cell.values()) {
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz <= radiusSquared) { if (visit) visit(p.id); else result.push(p.id); }
        }
      }
    }
    return sorted ? result.sort(numericOrder) : result;
  }
  reset(): void { this.cells.clear(); this.positions.clear(); this.free.length = 0; }
}
