import type { Vec2 } from '../../input/InputFrame';
import type { EntityStore } from '../world/EntityStore';
import type { HitQuery } from './HitQuery';
export type AimAssistSetting = 'Off' | 'Low' | 'Default' | 'High';
const degrees: Record<AimAssistSetting, number> = { Off: 0, Low: 6, Default: 12, High: 18 };
export class AimAssist {
  setting: AimAssistSetting = 'Default';
  constructor(private readonly entities: EntityStore, private readonly query: HitQuery) {}
  /** Mutates a shot's private direction, never the remembered per-side player aim. */
  apply(sourceId: number, origin: Vec2, aim: Vec2, range: number): void {
    if (this.setting === 'Off') return;
    let best = Infinity, x = aim.x, z = aim.z;
    const cosine = Math.cos(degrees[this.setting] * Math.PI / 180);
    for (const id of this.query.nearby(origin, range)) {
      const target = this.entities.get(id)!;
      if (id === sourceId || target.faction !== 'infected' || target.health.current <= 0 || target.infected?.hidden) continue;
      const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z, distance = Math.hypot(dx, dz);
      if (distance && distance < best && (dx * aim.x + dz * aim.z) / distance >= cosine && this.query.visible(origin, target.transform)) { best = distance; x = dx / distance; z = dz / distance; }
    }
    aim.x = x; aim.z = z;
  }
}
