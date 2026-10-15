/** PO 10-15: presentation/selection order, independent of pickup order and rack storage.
 * Unarmed is one carried entry; the magazine pistol and army MG retain their campaign positions.
 * The mounted minigun reserves its position without becoming a carried pickup.
 */
export const weaponOrder = [
  'weapon.fists', 'weapon.kick', 'weapon.bat', 'weapon.fire-axe',
  'weapon.crowbar', 'weapon.machete', 'weapon.knife', 'weapon.nail-bat', 'weapon.shovel', 'weapon.police-baton', 'weapon.katana',
  'weapon.handgun', 'weapon.pistol', 'weapon.smg', 'weapon.army-mg', 'weapon.shotgun',
  'weapon.hunting-rifle', 'weapon.assault-rifle', 'weapon.machine-gun', 'weapon.rotary-minigun', 'weapon.rocket-launcher', 'weapon.nail-gun',
  'weapon.grenade', 'weapon.molotov', 'weapon.pipe-bomb', 'weapon.firecracker-lure', 'weapon.smoke-grenade', 'weapon.flashbang',
  'ability.corgi-lure', 'ability.ground-slam', 'ability.shield-bubble', 'ability.adrenaline', 'ability.turret',
] as const;
const rank = new Map<string, number>(weaponOrder.map((id, index) => [id, index]));
/** Unknown future actions sort last, deterministically, until explicitly placed in the table. */
export const compareWeapons = (a: string, b: string): number => {
  const left = a === 'weapon.kick' ? 'weapon.fists' : a, right = b === 'weapon.kick' ? 'weapon.fists' : b;
  return (rank.get(left) ?? weaponOrder.length) - (rank.get(right) ?? weaponOrder.length) || left.localeCompare(right);
};
