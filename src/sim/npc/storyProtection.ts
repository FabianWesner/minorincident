import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';

/**
 * Required story actors stay human and standing until their beat completes. Read the
 * checkpointed mission state so retries restore protection without a separate timer.
 * Regular allies and rescued followers retain their ordinary combat/infection rules.
 */
export function storyProtected(world: SimWorld, entity: EntitySnapshot): boolean {
  if (!entity.civilian && !entity.escort) return false;
  const s = world.missions?.state;
  if (!s || s.phase === 'result' || s.phase === 'progression') return false;
  const id = entity.id;
  if (s.l1) {
    if (id === s.l1.clerkId || (id === s.l1.techId && !s.l1.delivered)) return true;
    if (id === s.l1.firefighterId && s.steps.firestation?.status === 'active') return true;
  }
  // The driver is part of the crew; the ride itself is kinematic, with no separate driver entity.
  if (s.l2 && !s.l2.doorsOpenAt && (s.l2.crewIds.includes(id) || s.l2.trappedIds.includes(id))) return true;
  if (s.l3?.waitingIds?.includes(id)) return true;
  if (s.l3 && !s.l3.fallbackAt && id === s.l3.squadIds[0]) return true;
  if (s.l4 && !s.l4.gunAt && id === s.l4.qmId) return true;
  if (s.l5) {
    if (id === s.l5.lookoutId && !s.l5.shutterAt || s.l5.stationIds.includes(id)) return true;
    if (s.l5.survivors.some(r => r.id === id && r.status === 'hidden')) return true;
  }
  if (s.l6) {
    if (id === s.l6.survivors[0]?.id && !s.l6.gateAt) return true;
    // Injured followers still carry the straggler/help beat after the first breach.
    if (s.l6.survivors.some(r => r.id === id && r.injured && !r.rejoined && r.status !== 'out')) return true;
    if (world.tick < s.l6.breach1At) {
      const medic = s.l6.survivors.find(r => r.key === 'rosa' || r.routine === 'treat');
      if (id === medic?.id) return true;
    }
  }
  return false;
}

/**
 * E32-AC08 (PO 10-13): "The player's own corgi remains completely safe and is never infected." One predicate for every path that
 * could turn, target, substitute or cure-damage an actor: the companion entity (`char.corgi`). Domestic pets walking with owners
 * are other dogs and keep their ordinary outbreak rules.
 */
export function isCorgi(entity: { companion?: unknown; archetype?: string } | undefined): boolean {
  return !!entity && (!!entity.companion || entity.archetype === 'char.corgi');
}
/** Asset/variant spellings that would draw the corgi as an enemy (spawn substitution guard). */
export function isCorgiModel(model: string | undefined): boolean {
  return !!model && /corgi/i.test(model);
}
/** The cure front and every other infected-only effect: only living entities flagged infected, never the corgi. */
export function cureCanKill(entity: { companion?: unknown; archetype?: string; infected?: unknown }): boolean {
  return !!entity.infected && !isCorgi(entity);
}
