/** Fixed campaign shortcuts, independent of pickup order and rack capacity. */
export const weaponKeys = {
  'weapon.fists': 1,
  'weapon.bat': 2,
  'weapon.fire-axe': 3,
  'weapon.handgun': 4,
  'weapon.army-mg': 5,
  'weapon.shotgun': 6,
  'weapon.rocket-launcher': 7,
  'weapon.molotov': 8,
  'weapon.pipe-bomb': 9,
} as const;

/** Kick shares unarmed; the legacy pistol shares the campaign handgun shortcut. */
export function weaponKey(id: string): number | undefined {
  const canonical = id === 'weapon.kick' ? 'weapon.fists' : id === 'weapon.pistol' ? 'weapon.handgun' : id;
  return Object.hasOwn(weaponKeys, canonical) ? weaponKeys[canonical as keyof typeof weaponKeys] : undefined;
}
