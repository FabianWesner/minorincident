/**
 * PO 2026-11-10: the sanctuary gate collects heavy weapons ("Heavy weapons stay at the armory. Rules of the sanctuary.").
 * The rocket launcher is the only heavy tier a courier can carry into L8 (the flamethrower and minigun are L10 grants), so
 * it is the whole list. It does not return in L8 or L9; the L10 hangar armory hands it back (cureHangarWeapons).
 */
export const sanctuaryHeavyWeapons: readonly string[] = ['weapon.rocket-launcher'];
export const isSanctuaryHeavy = (id: string): boolean => sanctuaryHeavyWeapons.includes(id);
