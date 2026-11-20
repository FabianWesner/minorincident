import type { Placement } from '../../levels/districts/types';
import type { Vec2 } from '../../input/InputFrame';

export interface BurningObject { id: string; x: number; z: number; flameHeight: number; state: 'intact' | 'burning' | 'charred'; at: number }
/** Authored vegetation and wooden fences share a bounded fire lifetime. */
export class VegetationFire {
  readonly objects: BurningObject[];
  constructor(placements: readonly Placement[], private readonly blocked: (a: Vec2, b: Vec2) => boolean = () => false) {
    this.objects = placements.filter(p => /^prop\.(tree(?:\.dead)?|street-tree|street-tree-blossom|garden-bush(?:-small)?|hedge|picket-fence|privacy-fence)$/.test(p.assetId))
      .map(p => ({ id: p.id, x: p.position[0], z: p.position[2], flameHeight: /tree/.test(p.assetId) ? Math.max(1, (p.visualAabb?.max[1] ?? 4) * .45) : .25, state: 'intact' as const, at: 0 }));
  }
  ignite(position: Vec2, tick: number, radius: number): void {
    let active = this.objects.filter(o => o.state === 'burning').length;
    for (const o of this.objects) if (active < 32 && o.state === 'intact' && Math.hypot(o.x - position.x, o.z - position.z) <= radius && !this.blocked(position, o)) {
      o.state = 'burning'; o.at = tick; active++;
    }
  }
  update(tick: number): void { for (const o of this.objects) if (o.state === 'burning' && tick - o.at >= 600) o.state = 'charred'; }
  snapshot(): BurningObject[] { return this.objects.map(o => ({ ...o })); }
  restore(saved: readonly BurningObject[]): void {
    const byId = new Map(saved.map(o => [o.id, o]));
    for (const o of this.objects) { const state = byId.get(o.id); if (state) Object.assign(o, state); }
  }
}
