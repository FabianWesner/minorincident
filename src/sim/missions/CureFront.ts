import { curePursuitRoute } from '../../levels/L10/district';
import { cureCanKill } from '../npc/storyProtection';
import type { EntitySnapshot } from '../world/types';
import type { Mission } from './Mission';
import type { CureFrontState } from './types';

export const cureSpeed = 10;
/** Connected route branches are reached in order; all radii use one simulation clock. */
export function cureReached(front: CureFrontState, at: { x: number; z: number }): boolean {
  return front.fronts.some(f => front.radius >= f.distance && Math.hypot(at.x - f.x, at.z - f.z) <= front.radius - f.distance + 1e-8);
}
/** Persisted on the mission, with unloaded deaths written into the existing chunk records. */
export class CureFront {
  constructor(private readonly mission: Mission) {}
  release(): void {
    const { state, def, world } = this.mission;
    if (state.cureFront) return;
    const origin = def.anchors['cure-console'];
    if (!origin) return;
    const fronts = [{ x: origin.x, z: origin.z, distance: 0 }];
    // Scene Lab/custom arenas have their own local console; production branches reuse the authored route.
    if (world.scenario === 'L10') for (const node of [...curePursuitRoute.nodes].reverse()) {
      const previous = fronts.at(-1)!;
      fronts.push({ x: node.x, z: node.z, distance: previous.distance + Math.hypot(node.x - previous.x, node.z - previous.z) });
    }
    state.cureFront = { releasedAt: world.tick, elapsed: 0, radius: 0, fronts, affectedIds: [] };
    const campaign = world.progression?.campaign;
    if (campaign) { campaign.world ??= {}; campaign.world.infectionCleared ??= { level: 10, releasedAt: world.tick }; }
    this.apply();
  }
  update(): void {
    const front = this.mission.state.cureFront;
    if (!front) { this.release(); return; }
    front.elapsed++;
    front.radius = front.elapsed * cureSpeed / 60;
    this.apply();
  }
  /** Reconcile save/retry restores without advancing time or emitting a release cue. */
  apply(): void {
    const { state, world } = this.mission, front = state.cureFront;
    if (!front) return;
    const affect = (e: EntitySnapshot, resident: boolean): boolean => {
      if (e.id === 1 || !cureCanKill(e) || e.corpse || e.health.current <= 0 && e.infected!.recoverAt < 0 || !cureReached(front, e.transform)) return false;
      if (resident) world.combat?.damage.cure(e);
      else world.combat?.damage.cure(e, false);
      if (!front.affectedIds.includes(e.id)) front.affectedIds.push(e.id);
      return true;
    };
    for (const e of world.entities.iterate()) affect(e, true);
    world.chunks?.applyCure(e => affect(e, false), chunk => front.fronts.some(f =>
      front.radius >= f.distance && Math.hypot(Math.max(chunk.origin[0], Math.min(chunk.max[0], f.x)) - f.x,
        Math.max(chunk.origin[1], Math.min(chunk.max[1], f.z)) - f.z) <= front.radius - f.distance));
  }
}
