import type { Placement } from '../../levels/districts/types';
import type { Vec2 } from '../../input/InputFrame';

export type FieldCellState = 'intact' | 'burning' | 'scorched';
export interface FieldCell { id: string; x: number; z: number; state: FieldCellState; ignitedAt: number; halfX?: number; halfZ?: number; }

/** Deterministic, checkpointable fire state for authored flammable ground. */
export class FieldFire {
  static readonly maxBurning = 128;
  private burningCount = 0;
  readonly cells: FieldCell[];
  private readonly byId = new Map<string, FieldCell>();
  private readonly neighbors = new Map<string, FieldCell[]>();
  private readonly buckets = new Map<string, FieldCell[]>();
  constructor(placements: readonly Placement[], private readonly blocked: (a: Vec2, b: Vec2) => boolean = () => false, lawns: readonly { id: string; x: number; z: number; halfX: number; halfZ: number }[] = []) {
    this.cells = [...placements.filter(p => p.assetId === 'veg.corn-block').map(p => ({ id: p.id, x: p.position[0], z: p.position[2], state: 'intact' as const, ignitedAt: 0 })), ...lawns.map(cell => ({ ...cell, state: 'intact' as const, ignitedAt: 0 }))].sort((a, b) => a.id.localeCompare(b.id));
    for (const cell of this.cells) this.byId.set(cell.id, cell);
    const buckets = this.buckets, key = (x: number, z: number) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
    for (const cell of this.cells) { const k = key(cell.x, cell.z), list = buckets.get(k) ?? []; list.push(cell); buckets.set(k, list); }
    for (const cell of this.cells) {
      const around: FieldCell[] = [];
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) around.push(...(buckets.get(`${Math.floor(cell.x / 16) + x},${Math.floor(cell.z / 16) + z}`) ?? []));
      this.neighbors.set(cell.id, around.filter(other => other !== cell && Math.hypot(other.x - cell.x, other.z - cell.z) <= (cell.halfX !== undefined || other.halfX !== undefined ? 8 : 16) && !this.blocked(cell, other)));
    }
  }
  ignite(position: Vec2, tick: number, radius = 5): number {
    let count = 0;
    for (let x = Math.floor((position.x - radius - 5) / 16); x <= Math.floor((position.x + radius + 5) / 16); x++)
      for (let z = Math.floor((position.z - radius - 5) / 16); z <= Math.floor((position.z + radius + 5) / 16); z++)
        for (const cell of this.buckets.get(`${x},${z}`) ?? []) if (this.burningCount < FieldFire.maxBurning && cell.state === 'intact' && Math.hypot(Math.max(0, Math.abs(cell.x - position.x) - (cell.halfX ?? 5)), Math.max(0, Math.abs(cell.z - position.z) - (cell.halfZ ?? 5))) <= radius && !this.blocked(position, cell)) {
          cell.state = 'burning'; cell.ignitedAt = tick; count++; this.burningCount++;
        }
    return count;
  }
  update(tick: number): void {
    const ignite: FieldCell[] = [];
    for (const cell of this.cells) {
      if (cell.state === 'burning' && tick - cell.ignitedAt >= 420) { cell.state = 'scorched'; this.burningCount--; }
      if (cell.state !== 'intact') continue;
      for (const source of this.neighbors.get(cell.id) ?? []) if (source.state === 'burning') {
        const distance = Math.hypot(cell.x - source.x, cell.z - source.z);
        const initialReach = cell.halfX !== undefined || source.halfX !== undefined ? 0 : 9;
        if (distance <= initialReach + Math.max(0, (tick - source.ignitedAt) / 60)) { ignite.push(cell); break; }
      }
    }
    for (const cell of ignite) { if (this.burningCount >= FieldFire.maxBurning) break; cell.state = 'burning'; cell.ignitedAt = tick; this.burningCount++; }
  }
  snapshot(): FieldCell[] { return this.cells.map(c => ({ ...c })); }
  restore(saved: readonly FieldCell[]): void {
    for (const state of saved) {
      const cell = this.byId.get(state.id);
      if (cell && ['intact', 'burning', 'scorched'].includes(state.state) && Number.isFinite(state.ignitedAt)) Object.assign(cell, state);
    }
    this.burningCount = this.cells.filter(cell => cell.state === 'burning').length;
  }
}
