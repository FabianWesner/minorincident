import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { HumanTarget, HumanTargetQuery, Vec2 } from './types';
import { SpatialHash } from '../spatial/SpatialHash';

/** Civilian states in which a pedestrian is a live human (perceivable, chaseable, biteable). */
const liveStates = new Set(['calm', 'alarmed', 'flee', 'hide']);
export function isLiveHuman(e: EntitySnapshot): boolean {
  if (e.hidden || e.health.current <= 0) return false;
  if (e.id === 1) return e.kind === 'player';
  if (e.escort && !e.escort.child && e.escort.state !== 'dead' && e.escort.state !== 'downed') return true;
  const c = e.civilian;
  return !!c && c.adult && (!c.pet || !!c.zooAnimal) && liveStates.has(c.state) && !e.infection;
}

/**
 * Lane D implementation of the L0 HumanTarget query (player + adult pedestrians + zoo animals; never the corgi, domestic pets, children,
 * escaped or turning people). Rebuilt at most once per tick; order is stable by id.
 */
export class HumanTargets implements HumanTargetQuery {
  private tick = -1;
  private readonly list: HumanTarget[] = [];
  private readonly byId = new Map<number, HumanTarget>();
  private readonly found: HumanTarget[] = [];
  private readonly records = new WeakMap<EntitySnapshot, HumanTarget>();
  private readonly index = new SpatialHash();
  private readonly indexedIds = new Set<number>();
  private readonly nearby: number[] = [];
  constructor(private readonly world: SimWorld) {}
  private refresh(): void {
    if (this.tick === this.world.tick) return;
    this.tick = this.world.tick; this.list.length = 0; this.byId.clear();
    for (const e of this.world.entities.iterate()) {
      if (!isLiveHuman(e) || this.world.missions?.state.l3?.waitingIds?.includes(e.id) || e.id === 1 && this.world.inspectionGhost) continue;
      let target = this.records.get(e);
      if (!target) {
        target = { id: e.id, kind: e.id === 1 ? 'player' : e.civilian?.zooAnimal ? 'animal' : 'civilian', position: { x: e.transform.x, z: e.transform.z }, facing: e.transform.yaw };
        this.records.set(e, target);
      } else { target.position.x = e.transform.x; target.position.z = e.transform.z; target.facing = e.transform.yaw; }
      this.list.push(target);
      this.indexedIds.add(e.id); this.index.set(e.id, target.position.x, target.position.z);
    }
    this.list.sort((a, b) => a.id - b.id);
    for (const target of this.list) this.byId.set(target.id, target);
    for (const id of this.indexedIds) if (!this.byId.has(id)) { this.index.delete(id); this.indexedIds.delete(id); }
  }
  all(): readonly HumanTarget[] { this.refresh(); return this.list; }
  get(id: number): HumanTarget | undefined { this.refresh(); const e = this.world.entities.get(id); return e && isLiveHuman(e) ? this.byId.get(id) : undefined; }
  within(center: Vec2, radius: number): readonly HumanTarget[] {
    this.refresh(); this.found.length = 0;
    this.index.query({ x: center.x, z: center.z, r: radius }, this.nearby, false);
    for (const id of this.nearby) {
      const target = this.byId.get(id);
      if (target && this.get(id) && (target.position.x - center.x) ** 2 + (target.position.z - center.z) ** 2 <= radius * radius) this.found.push(target);
    }
    this.found.sort((a, b) => a.id - b.id);
    return this.found;
  }
  /** Forget the cache (after teleports or checkpoint restore inside one tick). */
  invalidate(): void { this.tick = -1; }
}
