import type { Level } from '../sim/progression/Campaign';

/** Authored campaign start racks. PO 2026-11-25 ("For some reason I lost a shotgun. Why?"): a weapon found in an earlier level
 * stays in every later rack; L10 starts empty by story (the hangar rack); the rocket launcher stays a limited special (L7/L8 only). Carried saves and pickups never expand a rack beyond this. */
export const levelStartWeapons: Readonly<Record<Level, { LEFT: readonly string[]; RIGHT: readonly string[] }>> = {
  1: { LEFT: [], RIGHT: [] },
  2: { LEFT: ['weapon.bat'], RIGHT: [] },
  3: { LEFT: ['weapon.bat', 'weapon.fire-axe'], RIGHT: [] },
  4: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun'] },
  5: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg'] },
  // PO 2026-11-26: L5's dropped rifles are survivor-only pickups, so the courier first carries the assault rifle in L7.
  6: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun'] },
  7: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.assault-rifle'] },
  8: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.assault-rifle', 'weapon.rocket-launcher'] },
  9: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.assault-rifle'] },
  10: { LEFT: [], RIGHT: [] },
};
