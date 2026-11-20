import { catalog } from './actions/catalog';
import { weaponKeyMap } from './weaponSlots';

/** Historical key assignments for old recordings. */
const legacyPreferred = [
  'weapon.fists', 'weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg',
  'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.molotov', 'weapon.pipe-bomb',
];
const ids = Object.keys(catalog).filter(id => id.startsWith('weapon.') && id !== 'weapon.kick' && id !== 'weapon.pistol');
const legacyOrder = [...legacyPreferred.filter(id => ids.includes(id)), ...ids.filter(id => !legacyPreferred.includes(id))];
export const legacyWeaponKeys: Readonly<Record<string, number>> = Object.fromEntries(legacyOrder.map((id, index) => [id, index + 1]));
export const weaponKeys = weaponKeyMap;

export function weaponKey(id: string): number | undefined { return weaponKeys[id]; }
export function weaponLegacyKey(id: string): number | undefined {
  const canonical = id === 'weapon.kick' ? 'weapon.fists' : id === 'weapon.pistol' ? 'weapon.handgun' : id;
  return legacyWeaponKeys[canonical];
}
const fallbackPriority: Readonly<Record<string, number>> = Object.fromEntries(legacyPreferred.map((id, index) => [id, index + 1]));
export function weaponFallbackPriority(id: string): number | undefined {
  const canonical = id === 'weapon.kick' ? 'weapon.fists' : id === 'weapon.pistol' ? 'weapon.handgun' : id;
  return fallbackPriority[canonical];
}
