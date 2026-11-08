/** Deterministic, material-aware response of world damage to each weapon family.
 * Values scale the weapon's authored damage; they never alter combat balance. */
export type DestructionMaterial = 'glass' | 'wood' | 'metal' | 'brick' | 'concrete';

const defaultResponse: Readonly<Record<DestructionMaterial, number>> = {
  glass: .18, wood: .08, metal: .025, brick: .012, concrete: .006,
};

/** Explicit rows keep the effect legible and data-driven while unlisted weapons
 * inherit a conservative response appropriate to their damage type. */
export const weaponDestructionResponse: Readonly<Record<string, Partial<Record<DestructionMaterial, number>>>> = {
  'boss.gorilla.smash': { glass: 4, wood: 3, metal: 2, brick: 2, concrete: 2 },
  'boss.mega.charge': { glass: 4, wood: 3, metal: 2, brick: 2, concrete: 2 },
  'weapon.bat': { glass: .08, wood: .18, metal: .02, brick: .01, concrete: .005 },
  'weapon.fire-axe': { glass: .25, wood: .8, metal: .06, brick: .025, concrete: .01 },
  'weapon.handgun': { glass: .5, wood: .08, metal: .025, brick: .012, concrete: .006 },
  'weapon.pistol': { glass: .5, wood: .08, metal: .025, brick: .012, concrete: .006 },
  'weapon.shotgun': { glass: 1.2, wood: .28, metal: .08, brick: .04, concrete: .02 },
  'weapon.army-mg': { glass: .45, wood: .2, metal: .09, brick: .025, concrete: .01 },
  'weapon.machine-gun': { glass: .45, wood: .2, metal: .09, brick: .025, concrete: .01 },
  'weapon.rotary-minigun': { glass: .45, wood: .2, metal: .09, brick: .025, concrete: .01 },
  'weapon.rocket-launcher': { glass: 4, wood: 3, metal: 2.4, brick: 2.2, concrete: 1.5 },
  'weapon.grenade': { glass: 2, wood: 1.5, metal: 1.1, brick: .9, concrete: .7 },
  'weapon.pipe-bomb': { glass: 2.5, wood: 2, metal: 1.4, brick: 1.2, concrete: .9 },
  'weapon.molotov': { glass: .02, wood: .06, metal: .01, brick: .005, concrete: .003 },
};

const materialByArchetype: Readonly<Record<string, DestructionMaterial>> = {
  'prop.glass': 'glass', 'prop.mailbox': 'metal', 'prop.cone': 'metal',
  'prop.fence': 'wood', 'prop.crate': 'wood', 'prop.barricade': 'wood',
  'prop.trash-can': 'metal', 'prop.fuel-trail': 'wood',
};

export function destructionMaterial(archetype: string | undefined): DestructionMaterial {
  if (!archetype) return 'metal';
  return materialByArchetype[archetype] ?? (archetype.startsWith('bld.') ? 'brick' : archetype.startsWith('veh.') || archetype.startsWith('vehicle.') ? 'metal' : 'wood');
}

export function destructionDamage(actionId: string, material: DestructionMaterial, authoredDamage: number): number {
  if (!Number.isFinite(authoredDamage) || authoredDamage < 0) throw new RangeError('Invalid destruction damage');
  // Environmental chain blasts already carry their authored prop/vehicle damage curve.
  if (actionId.startsWith('explosion.')) return authoredDamage;
  const response = weaponDestructionResponse[actionId]?.[material] ?? defaultResponse[material];
  return authoredDamage * response;
}
