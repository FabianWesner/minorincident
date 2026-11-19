import type { Level } from '../sim/progression/Campaign';

/** Authored campaign start racks. Carried saves and pickups never expand a later level's opening rack. */
export const levelStartWeapons: Readonly<Record<Level, { LEFT: readonly string[]; RIGHT: readonly string[] }>> = {
  1: { LEFT: [], RIGHT: [] },
  2: { LEFT: ['weapon.bat'], RIGHT: [] },
  3: { LEFT: ['weapon.bat', 'weapon.fire-axe'], RIGHT: [] },
  4: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun'] },
  5: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg'] },
  6: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun'] },
  7: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.assault-rifle'] },
  8: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher'] },
  9: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.assault-rifle'] },
  10: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.fire-axe'] },
};
