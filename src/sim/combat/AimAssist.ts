import type { EntitySnapshot } from '../world/types';
import type { Vec2 } from '../../input/InputFrame';
import type { EntityStore } from '../world/EntityStore';
import type { HitQuery } from './HitQuery';
export type AimAssistSetting = 'Off' | 'Low' | 'Default' | 'High';
const facingDegrees: Record<AimAssistSetting, number> = { Off: 0, Low: 15, Default: 25, High: 35 };
const facingRangeM = 18;
const degrees: Record<AimAssistSetting, number> = { Off: 0, Low: 6, Default: 12, High: 18 };
export class AimAssist {
  setting: AimAssistSetting = 'Default';
  constructor(private readonly entities: EntityStore, private readonly query: HitQuery, private readonly onScreen: (point: Vec2) => boolean = () => true) {}
  /**
   * Keyboard/touch fire (Q-196, PO 10-26: "the MP shots at the Zombie that is closest to where I am aiming"): the living,
   * visible, on-screen infected closest to the aim ray within the setting's cone (Low 15°, Default 25°, High 35°) and
   * at most 18 m away wins; the score adds a twentieth of the distance along the ray, so the nearer of two equally aligned
   * infected is chosen. Civilians, allies and corpses never pull. Without a candidate the aim stays straight ahead.
   */
  facing(origin: Vec2, aim: Vec2, range: number, projectileSpeed?: number): void {
    if (this.setting === 'Off') return;
    let selected: EntitySnapshot | undefined;
    const cosine = Math.cos(facingDegrees[this.setting] * Math.PI / 180), reach = Math.min(range, facingRangeM);
    let best = Infinity, x = aim.x, z = aim.z;
    for (const target of this.entities.iterate()) {
      if (target.faction !== 'infected' || target.health.current <= 0 || target.hidden || target.infected?.hidden) continue;
      const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z, distance = Math.hypot(dx, dz);
      if (!distance || distance > reach) continue;
      const along = dx * aim.x + dz * aim.z, score = Math.abs(dx * aim.z - dz * aim.x) + along * .05;
      if (along / distance < cosine - 1e-6 || score >= best || !this.onScreen(target.transform) || !this.query.visible(origin, target.transform)) continue;
      best = score; x = dx / distance; z = dz / distance; selected = target;
    }
    // A slow projectile (rocket) flies to the intercept point, so a walking target is still met.
    const lead = selected && projectileSpeed ? intercept(origin, selected, projectileSpeed) : null;
    const length = lead ? Math.hypot(lead.x, lead.z) : 0;
    if (lead && length) { x = lead.x / length; z = lead.z / length; }
    aim.x = x; aim.z = z;
  }
  /** Mutates a shot's private direction, never the remembered per-side player aim. */
  apply(sourceId: number, origin: Vec2, aim: Vec2, range: number, projectileSpeed?: number): void {
    if (this.setting === 'Off') return;
    let best = Infinity, x = aim.x, z = aim.z, selected: EntitySnapshot | undefined;
    const cosine = Math.cos(degrees[this.setting] * Math.PI / 180);
    for (const id of this.query.nearby(origin, range)) {
      const target = this.entities.get(id)!;
      if (id === sourceId || target.faction !== 'infected' || target.health.current <= 0 || target.infected?.hidden) continue;
      const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z, distance = Math.hypot(dx, dz);
      if (distance && distance < best && (dx * aim.x + dz * aim.z) / distance >= cosine && this.query.visible(origin, target.transform)) { best = distance; x = dx / distance; z = dz / distance; selected = target; }
    }
    // Keep a deliberate projectile lead when it is closer to the intercept than
    // snapping to the current body. Direct target intent retains its usual snap.
    const lead = selected && projectileSpeed ? intercept(origin, selected, projectileSpeed) : null, length = lead ? Math.hypot(lead.x, lead.z) : 0;
    if (lead && length && (aim.x * lead.x + aim.z * lead.z) / length > (x * lead.x + z * lead.z) / length + 1e-9) { x = aim.x; z = aim.z; }
    aim.x = x; aim.z = z;
  }
}

/** Offset from `origin` to where a projectile of `speed` meets the target's current motion; null without a solution. */
function intercept(origin: Vec2, target: EntitySnapshot, speed: number): Vec2 | null {
  const velocity = target.motion?.velocity; if (!velocity) return null;
  const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z;
  const a = velocity.x ** 2 + velocity.z ** 2 - speed ** 2;
  const b = 2 * (dx * velocity.x + dz * velocity.z), c = dx ** 2 + dz ** 2;
  const discriminant = b * b - 4 * a * c;
  const roots = Math.abs(a) < 1e-6 ? [b ? -c / b : 0] : discriminant >= 0 ? [(-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a)] : [];
  const time = Math.min(...roots.filter(t => t >= 0));
  return Number.isFinite(time) ? { x: dx + velocity.x * time, z: dz + velocity.z * time } : null;
}
