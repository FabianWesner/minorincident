import { finale } from './l10Finale';

/**
 * E32 §5.7 / L10-S6: the mounted rotary minigun (`weapon.rotary-minigun` on `wpn.minigun-mounted`). Seconds, metres, fractions.
 * Fire rate, range and damage live on the action (`mountedActions` in actions/catalog.ts); the numbers below are the spin and heat model.
 * Unlimited ammo: no magazine, reload or ammo counter. Heat is the only limit.
 */
export const minigun = {
  actionId: 'weapon.rotary-minigun',
  /** Rounds per second while firing. */
  rate: 20,
  /** Effective range (the action range; ordinary TTK is specified inside it). */
  rangeM: 35,
  /** Barrels reach full speed this long after the trigger goes down and wind down this long after it is released. */
  spinUpS: 0.5, spinDownS: 1.2,
  /** First round leaves once the barrels reach this fraction of full speed (0.4 s from cold at the 0.5 s spin-up). */
  fireSpin: 0.8,
  /** Heat rises 12.5%/s while firing (8 s from cold), cools 20%/s once the trigger has been up 0.5 s, and a locked gun unlocks below 40%. */
  heatPerS: 0.125, coolPerS: 0.2, coolDelayS: 0.5, unlockBelow: 0.4,
  /** Operator stands within this distance of the gun (planar) to man it; leaving by input is instant (one tick, well inside 0.5 s). */
  mountRadiusM: 2.6,
  /** Acceptance: dismount within 0.5 s of the input. The implementation needs one tick. */
  dismountMaxTicks: 30,
  /** Gunner stands behind the pivot (gunnerSocket in the GLB: x -0.78 in the gun frame); a dismount returns to where she mounted. */
  seatBackM: 0.78,
  /** Muzzle in the gun frame (GLB: pivot y 0.95 + elevation 0.43, muzzle x 1.46 + barrels 0.3). */
  pivotHeightM: 0.95, muzzleHeightM: 1.38, muzzleForwardM: 1.46,
} as const;

export interface GunPlacement { x: number; z: number; /** Deck height under the gun (0 on the ground). */ y: number; /** Rest yaw in degrees (scene-spec convention, 0 faces +x). */ yaw: number }
/** The finale gun in world metres: `origin` is the console's world position (D4 maps the local frame with one offset). */
export function finaleGunPlacement(origin: { x: number; z: number } = { x: 0, z: 0 }): GunPlacement {
  const { at, deckHeight, yaw } = finale.gun;
  return { x: origin.x + at[0], z: origin.z + at[1], y: deckHeight, yaw };
}
