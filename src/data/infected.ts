import { l1v2 } from './l1v2';
/** Infected balance in metres/seconds/HP, from concept §7. Human roles and animals share one brain. */
export interface InfectedDef {
  id: string; hp: number; speed: number; radius: number; damage: number; range: number;
  windup: number; special: string; weight: number; grabChance: number; asset: string;
}
const assetIds: Record<string, string> = { runner: 'inf.common-worker', riot: 'inf.riot-cop', armored: 'inf.armored-football', dog: 'inf.dog-retriever', cat: 'inf.cat-tabby' };
function role(name: string, hp: number, speed: number, special = 'lunge', radius = 0.35, windup = 0.35): InfectedDef {
  return { id: `infected.${name}`, hp, speed, radius, special, windup, damage: 10, range: 1.1, weight: 1, grabChance: name === 'butcher' ? 0.6 : name === 'crawler' ? 0.35 : 0.15, asset: assetIds[name] ?? `inf.${name}` };
}
export const humanInfected: readonly InfectedDef[] = [
  role('runner', 40, 4.2), role('crawler', 25, 2, 'grab'), role('brute', 300, 3, 'charge', 0.6, 0.8),
  role('screamer', 60, 3.5, 'scream', 0.35, 0.8), role('sprinter', 30, 6.5), role('riot', 150, 3.2, 'shield'),
  role('bloated', 120, 2.5, 'explode', 0.5, 1), role('firefighter', 140, 3.8, 'fire-immune'),
  role('hazmat', 120, 3.2, 'aura'), role('armored', 400, 4.5, 'armor', 0.5),
  role('butcher', 900, 4, 'combo-grab', 0.6), role('nurse', 70, 5, 'revive'),
];
export const animalInfected: readonly InfectedDef[] = [
  role('dog', 30, 7, 'pounce', 0.3, 0.4), role('cat', 15, 6, 'cling', 0.2, 0.4),
  { ...role('crow', 20, 9, 'dive', 1, 0.6), weight: 5 },
  role('lion', 400, 7.5, 'pin', 0.6, 0.6), role('gorilla', 1200, 4.5, 'prop-throw', 0.7, 0.8),
  role('flamingo', 10, 5, 'peck', 0.25),
];
export const infectedDefinitions = [...humanInfected, ...animalInfected];
export function infectedDef(id: string): InfectedDef {
  const def = infectedDefinitions.find((def) => def.id === id);
  if (!def) throw new RangeError(`Unknown infected archetype: ${id}`);
  return def;
}
export function validateInfected(defs: readonly InfectedDef[] = infectedDefinitions): void {
  const ids = new Set<string>();
  for (const def of defs) {
    if (ids.has(def.id) || !def.id.startsWith('infected.') || !def.asset || !def.special ||
      ![def.hp, def.speed, def.radius, def.damage, def.range, def.weight].every((n) => Number.isFinite(n) && n > 0) ||
      !Number.isFinite(def.windup) || def.windup < 0.35 || !Number.isFinite(def.grabChance) || def.grabChance < 0 || def.grabChance > 1) throw new Error(`Invalid infected: ${def.id}`);
    ids.add(def.id);
  }
}
/** L1 v2 speed tiers (specs/epic-19 section 5.4): the visual read of the asset decides the tier. */
export type InfectedSpeedTier = 'frail' | 'average' | 'athletic';
const frailAssets = /elderly|bathrobe|alvarez/;
const athleticAssets = /jogger|skater|college|sprinter/;
export function l1SpeedTier(asset: string): InfectedSpeedTier {
  return frailAssets.test(asset) ? 'frail' : athleticAssets.test(asset) ? 'athletic' : 'average';
}
/**
 * Run speed of an L1 infected from its tier and a uniform sample `u` in [0, 1): base x (max - (max - low) * u^skew), where low =
 * max(max - spread, minMs / base) (specs/epic-19 section 5.4, PO 2026-10-07). Most infected run a little below today's tier base, a few at the old
 * maximum; some are slower than the running player, so a crowd strings out and fleeing works against part of it.
 */
export function l1TierSpeed(tier: InfectedSpeedTier, u: number): number {
  const f = l1v2.speedTiers.factor, base = l1v2.speedTiers[tier].baseMs, low = Math.max(f.max - f.spread, f.minMs / base);
  return base * (f.max - (f.max - low) * u ** f.skew);
}
/** Per-entity reaction delay (seconds) on a fresh sighting, derived from the same per-spawn sample (no extra RNG draw). */
export function l1ReactionS(u: number): number {
  const [low, high] = l1v2.speedTiers.factor.reactionS;
  return low + (high - low) * ((u * 7.31) % 1);
}
/**
 * PO rule "Infected recover" (specs/00-game-concept.md, 2026-10-08): a lethal melee/unarmed/firearm/vehicle hit only knocks
 * an infected down; it gets up after a deterministic per-entity random `downS` at full health. Explosive blasts and a
 * lethal burn kill for good. `getUpS` is the authored get-up beat (CrowdView plays the `get-up` clip from 0.7 s of a heavy reaction).
 */
export const infectedRecovery = { downS: [10, 20] as const, getUpS: .64 };
