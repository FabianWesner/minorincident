import { catalog } from './actions/catalog';

/** Stable campaign shortcuts. Melee variants share 1; throwable variants share 0. */
const fixed = {
  'weapon.fists': 1, 'weapon.kick': 1, 'weapon.bat': 1, 'weapon.fire-axe': 1,
  'weapon.machete': 1, 'weapon.crowbar': 1, 'weapon.knife': 1, 'weapon.nail-bat': 1,
  'weapon.shovel': 1, 'weapon.police-baton': 1, 'weapon.katana': 1,
  'weapon.handgun': 2, 'weapon.pistol': 2, 'weapon.shotgun': 3,
  'weapon.army-mg': 4, 'weapon.machine-gun': 4, 'weapon.assault-rifle': 5, 'weapon.smg': 5,
  'weapon.hunting-rifle': 6, 'weapon.nail-gun': 7, 'weapon.flamethrower': 8,
  'weapon.rocket-launcher': 9, 'weapon.molotov': 10, 'weapon.pipe-bomb': 10,
  'weapon.flashbang': 10, 'weapon.grenade': 10, 'weapon.smoke-grenade': 10,
  'weapon.firecracker-lure': 10,
} as const;

/** Historical key assignments for old recordings. */
const legacyPreferred = [
  'weapon.fists', 'weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg',
  'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.molotov', 'weapon.pipe-bomb',
];
const ids = Object.keys(catalog).filter(id => id.startsWith('weapon.') && id !== 'weapon.kick' && id !== 'weapon.pistol');
const legacyOrder = [...legacyPreferred.filter(id => ids.includes(id)), ...ids.filter(id => !legacyPreferred.includes(id))];
export const legacyWeaponKeys: Readonly<Record<string, number>> = Object.fromEntries(legacyOrder.map((id, index) => [id, index + 1]));
export const weaponKeys: Readonly<Record<string, number>> = fixed;

export function weaponKey(id: string): number | undefined { return fixed[id as keyof typeof fixed]; }
export function weaponLegacyKey(id: string): number | undefined {
  const canonical = id === 'weapon.kick' ? 'weapon.fists' : id === 'weapon.pistol' ? 'weapon.handgun' : id;
  return legacyWeaponKeys[canonical];
}
const fallbackPriority: Readonly<Record<string, number>> = Object.fromEntries(legacyPreferred.map((id, index) => [id, index + 1]));
export function weaponFallbackPriority(id: string): number | undefined {
  const canonical = id === 'weapon.kick' ? 'weapon.fists' : id === 'weapon.pistol' ? 'weapon.handgun' : id;
  return fallbackPriority[canonical];
}
