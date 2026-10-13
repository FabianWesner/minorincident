import { policeTactics } from './l3';

/**
 * ally-combat-feel (PO 2026-10-13: "Everyone is just standing around and shooting, this doesn'T look like a fight scene."):
 * movement and cadence of every shooting ally. Police keep their own PO 10-09 tactics numbers; soldiers and armed civilians get the
 * same moves with their own leash (soldiers hold the line, civilians are nervous and wander further). `stillS`: the longest a
 * fighter stands on one spot before it shifts to another firing position.
 */
export const allyTactics = {
  officer: { ...policeTactics, stillS: 1.7 },
  soldier: { ...policeTactics, backstepM: 4, stepM: 1.4, stepMs: 2.6, stepS: .8, stepEveryS: 1.3, leashM: 2.8, stillS: 1.6 },
  civilian: { ...policeTactics, backstepM: 4.5, stepM: 1.7, stepMs: 3.2, stepS: .7, stepEveryS: .9, leashM: 6, stillS: 1.1, repositionShots: 2 },
} as const;
export type AllyTactic = typeof allyTactics[keyof typeof allyTactics];

/**
 * Fire cadence per weapon: bursts of `burst` shots `gapS` apart, a reload pause of `reloadS` after `mag` shots. The pause between
 * bursts shrinks to pay for the reload, so the average rate stays the gun's `shotS` (PO balance: accuracy and damage are untouched).
 */
export const allyCadence = {
  rifle: { burst: 3, gapS: .12, mag: 15, reloadS: 1.8 },
  hmg: { burst: 6, gapS: .1, mag: 60, reloadS: 2.4 },
  pistol: { burst: 1, gapS: 0, mag: 8, reloadS: 1.4 },
  'hunting-rifle': { burst: 1, gapS: 0, mag: 6, reloadS: 1.2 },
} as const;

/** Player-view rule for every ally gun (PO 2026-10-13): never beyond this from the courier, and only inside the inset camera frame. */
export const allyViewM = 22;
/** Self-defence radius of an on-screen ally (in the frame or within allyViewM of the courier): it may fire at an off-screen infected
 * this close to itself; everything farther must be inside the player's view. Allies away from the player are not bound (option 3). Orchestrator decision 2026-10-13 on the PO's "they kill all Zombies before i see
 * them myself": no long-range clearing before the player sees it, but nobody dies off screen without defending. 0 = the strict rule. */
export const allyOffscreenDefenceM: number = 6;
/** Call-outs: per speaker cooldown, and the quiet time between any two call-outs. */
export const allyCallout = { perAllyS: 9, globalS: 2.2 } as const;
