/** Canonical player-facing names shared by the rack, pickup hints, and touch controls. */
export const weaponNames: Readonly<Record<string, string>> = {
  'weapon.fists': 'Fists', 'weapon.kick': 'Kick', 'weapon.bat': 'Baseball Bat',
  'weapon.crowbar': 'Crowbar', 'weapon.machete': 'Machete', 'weapon.knife': 'Knife',
  'weapon.nail-bat': 'Nail Bat', 'weapon.shovel': 'Shovel', 'weapon.police-baton': 'Police Baton',
  'weapon.fire-axe': 'Fire Axe', 'weapon.katana': 'Katana', 'weapon.pistol': 'Pistol',
  'weapon.handgun': 'Handgun', 'weapon.shotgun': 'Shotgun', 'weapon.nail-gun': 'Nail Gun',
  'weapon.smg': 'SMG', 'weapon.hunting-rifle': 'Hunting Rifle', 'weapon.assault-rifle': 'Assault Rifle',
  'weapon.flamethrower': 'Flamethrower', 'weapon.machine-gun': 'Machine Gun', 'weapon.army-mg': 'Army MG',
  'weapon.rocket-launcher': 'Rocket Launcher', 'weapon.grenade': 'Grenade', 'weapon.molotov': 'Molotov Cocktail',
  'weapon.pipe-bomb': 'Pipe Bomb', 'weapon.flashbang': 'Flashbang', 'weapon.smoke-grenade': 'Smoke Grenade',
  'weapon.firecracker-lure': 'Firecracker', 'ability.corgi-lure': 'Corgi Lure',
};

export const weaponName = (id: string): string => weaponNames[id] ?? id.split('.').at(-1)!.split('-').map(word => word[0]!.toUpperCase() + word.slice(1)).join(' ');
