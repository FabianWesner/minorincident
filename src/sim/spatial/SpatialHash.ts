/** 4 m cells; the exact distance filter and numeric sort give stable queries. */
export class SpatialHash {
  private readonly cells = new Map<string, Set<number>>();
  private readonly positions = new Map<number, { x: number; z: number }>();
  private key(x: number, z: number): string { return `${Math.floor(x / 4)},${Math.floor(z / 4)}`; }
  set(id: number, x: number, z: number): void {
    const previous = this.positions.get(id);
    if (previous && this.key(previous.x, previous.z) === this.key(x, z)) { previous.x = x; previous.z = z; return; }
    this.delete(id);
    this.positions.set(id, { x, z });
    const key = this.key(x, z);
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, cell = new Set());
    cell.add(id);
  }
  delete(id: number): void {
    const position = this.positions.get(id);
    if (!position) return;
    const key = this.key(position.x, position.z), cell = this.cells.get(key)!;
    cell.delete(id); if (!cell.size) this.cells.delete(key);
    this.positions.delete(id);
  }
  query(within: { x: number; z: number; r: number }, result: number[] = []): number[] {
    if (![within.x, within.z, within.r].every(Number.isFinite) || within.r < 0) throw new RangeError('Query position and radius must be finite, radius nonnegative');
    result.length = 0;
    for (let x = Math.floor((within.x - within.r) / 4); x <= Math.floor((within.x + within.r) / 4); x++) {
      for (let z = Math.floor((within.z - within.r) / 4); z <= Math.floor((within.z + within.r) / 4); z++) {
        for (const id of this.cells.get(`${x},${z}`) ?? []) {
          const p = this.positions.get(id)!;
          if ((p.x - within.x) ** 2 + (p.z - within.z) ** 2 <= within.r ** 2) result.push(id);
        }
      }
    }
    return result.sort((a, b) => a - b);
  }
  reset(): void { this.cells.clear(); this.positions.clear(); }
}
