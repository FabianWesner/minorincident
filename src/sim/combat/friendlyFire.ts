/** s178 campaign difficulty (PO 2026-11-19): Simple is the status quo; Hard turns friendly fire both ways.
 * PO quote: "Hard - with only two changes: * friendly fire hurts them and me * auto-healing is off".
 * Every predicate here returns false unless `world.difficulty === 'hard'`, so a Simple run stays byte-identical. */
import type { EntitySnapshot } from '../world/types';
import type { SimWorld } from '../world/SimWorld';

/** A living human friendly fire may hit: civilians (incl. allied fighters and survivor followers) and escorts.
 * The corgi (`companion`), owner pets and zoo animals are never targets (campaign rule "corgi safe"). */
export function fireTarget(target: EntitySnapshot): boolean {
  return !!target.escort || !!target.civilian && !target.civilian.pet && !target.civilian.zooAnimal;
}

/** A friendly-fire source in Hard: the courier (melee, guns, explosives, fire — vehicle impacts excluded
 * by the PO), player-attributed hazards/chains, allied fighters (soldiers, officers, firefighters, armed
 * civilians and survivors) and scripted allied set pieces (the L4 tank and helicopter). Infected never are. */
export function friendlyCapable(source: EntitySnapshot | undefined | null): boolean {
  return !!source && !source.infected && !source.infection &&
    (source.id === 1 || !!source.playerDamageSource || !!source.civilian?.ally || source.kind === 'setpiece');
}

/** The same sources, gated on the Hard difficulty (false in every Simple run). */
export function friendlySource(world: SimWorld, source: EntitySnapshot | undefined | null): boolean {
  return world.difficulty === 'hard' && friendlyCapable(source);
}
