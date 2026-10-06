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
  role('screamer', 60, 3.5, 'scream'), role('sprinter', 30, 6.5), role('riot', 150, 3.2, 'shield'),
  role('bloated', 120, 2.5, 'explode', 0.5), role('firefighter', 140, 3.8, 'fire-immune'),
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
