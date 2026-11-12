import { catalog } from './actions/catalog';

/** Stable legacy shortcuts stay first; the remaining carried weapons get unique rack indices. */
const preferred = [
  'weapon.fists', 'weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg',
  'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.molotov', 'weapon.pipe-bomb',
];
const weaponIds = Object.keys(catalog).filter(id => id.startsWith('weapon.') && id !== 'weapon.kick' && id !== 'weapon.pistol');
const orderedIds = [...preferred.filter(id => weaponIds.includes(id)), ...weaponIds.filter(id => !preferred.includes(id))];
export const weaponKeys: Readonly<Record<string, number>> = Object.fromEntries(orderedIds.map((id, index) => [id, index + 1]));

/** Kick shares unarmed; the legacy pistol shares the campaign handgun shortcut. */
export function weaponKey(id: string): number | undefined {
  const canonical = id === 'weapon.kick' ? 'weapon.fists' : id === 'weapon.pistol' ? 'weapon.handgun' : id;
  return weaponKeys[canonical];
}
