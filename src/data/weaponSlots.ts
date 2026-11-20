import type { Level } from '../sim/progression/Campaign';
import { levelStartWeapons } from './levelStartWeapons';
import { weaponKey } from './weaponKeys';

/** Fixed campaign weapon positions. Sets include the level's starts and authored weapon pickups. */
export const weaponKeyOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const weaponForKey: Readonly<Record<number, readonly string[]>> = {
  1: ['weapon.fists', 'weapon.kick', 'weapon.bat', 'weapon.fire-axe', 'weapon.machete', 'weapon.crowbar', 'weapon.knife', 'weapon.nail-bat', 'weapon.shovel', 'weapon.police-baton', 'weapon.katana'],
  2: ['weapon.handgun'], 3: ['weapon.shotgun'], 4: ['weapon.army-mg'], 5: ['weapon.assault-rifle', 'weapon.smg'],
  6: ['weapon.hunting-rifle'], 7: ['weapon.nail-gun'], 8: ['weapon.flamethrower'], 9: ['weapon.rocket-launcher'],
  10: ['weapon.molotov', 'weapon.pipe-bomb', 'weapon.flashbang', 'weapon.grenade', 'weapon.smoke-grenade', 'weapon.firecracker-lure'],
};
const l10 = ['weapon.machete', 'weapon.handgun', 'weapon.shotgun', 'weapon.assault-rifle', 'weapon.hunting-rifle', 'weapon.nail-gun', 'weapon.flamethrower', 'weapon.rocket-launcher', 'weapon.molotov', 'weapon.pipe-bomb', 'weapon.flashbang'];
const union = (level: Level, pickups: readonly string[]): readonly string[] => [...new Set([...levelStartWeapons[level].LEFT, ...levelStartWeapons[level].RIGHT, ...pickups])]
  .sort((a, b) => (Object.entries(weaponForKey).find(([, ids]) => ids.includes(a))?.[0] ?? '99').localeCompare(Object.entries(weaponForKey).find(([, ids]) => ids.includes(b))?.[0] ?? '99', undefined, { numeric: true }));
export const levelWeaponSets: Readonly<Record<Level, readonly string[]>> = {
  1: union(1, ['weapon.fists']), 2: union(2, []), 3: union(3, ['weapon.handgun']),
  4: union(4, ['weapon.army-mg']), 5: union(5, ['weapon.shotgun']), 6: union(6, []),
  7: union(7, ['weapon.rocket-launcher']), 8: union(8, []), 9: union(9, []), 10: union(10, l10),
};

export interface WeaponRackSlot { key: number; weapon: string; owned: boolean }
/** Displayable slots for a campaign level; missing acquisitions remain explicit holes. */
export function weaponRackSlots(level: Level, owned: readonly string[]): WeaponRackSlot[] {
  const present = new Set(owned);
  return [...new Set(levelWeaponSets[level].map(weaponKey).filter((key): key is number => key !== undefined))]
    .sort((a, b) => a - b).map(key => {
      const candidates = weaponForKey[key], acquired = candidates.find(id => present.has(id));
      return { key, weapon: acquired ?? levelWeaponSets[level].find(id => candidates.includes(id))!, owned: acquired !== undefined };
    });
}
