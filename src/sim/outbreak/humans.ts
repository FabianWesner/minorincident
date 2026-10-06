import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { HumanTarget, HumanTargetQuery, Vec2 } from './types';

/** Civilian states in which a pedestrian is a live human (perceivable, chaseable, biteable). */
const liveStates = new Set(['calm', 'alarmed', 'flee', 'hide']);
export function isLiveHuman(e: EntitySnapshot): boolean {
  if (e.hidden || e.health.current <= 0) return false;
  if (e.id === 1) return e.kind === 'player';
  const c = e.civilian;
  return !!c && c.adult && !c.pet && liveStates.has(c.state) && !e.infection;
}

/**
 * Lane D implementation of the L0 HumanTarget query (player + adult pedestrians; never the corgi, pets, children,
 * escaped or turning people). Rebuilt at most once per tick; order is stable by id.
 */
export class HumanTargets implements HumanTargetQuery {
  private tick = -1;
  private readonly list: HumanTarget[] = [];
  private readonly byId = new Map<number, HumanTarget>();
  private readonly found: HumanTarget[] = [];
  constructor(private readonly world: SimWorld) {}
  private refresh(): void {
    if (this.tick === this.world.tick) return;
    this.tick = this.world.tick; this.list.length = 0; this.byId.clear();
    for (const e of this.world.entities.iterate()) {
      if (!isLiveHuman(e)) continue;
      const target: HumanTarget = { id: e.id, kind: e.id === 1 ? 'player' : 'civilian', position: { x: e.transform.x, z: e.transform.z }, facing: e.transform.yaw };
      this.list.push(target);
    }
    this.list.sort((a, b) => a.id - b.id);
    for (const target of this.list) this.byId.set(target.id, target);
  }
  all(): readonly HumanTarget[] { this.refresh(); return this.list; }
  get(id: number): HumanTarget | undefined { this.refresh(); return this.byId.get(id); }
  within(center: Vec2, radius: number): readonly HumanTarget[] {
    this.refresh(); this.found.length = 0;
    for (const target of this.list) if ((target.position.x - center.x) ** 2 + (target.position.z - center.z) ** 2 <= radius * radius) this.found.push(target);
    return this.found;
  }
  /** Forget the cache (after teleports or checkpoint restore inside one tick). */
  invalidate(): void { this.tick = -1; }
}
