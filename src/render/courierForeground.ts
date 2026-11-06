import type { EntitySnapshot } from '../sim/world/types';

/** Metres to the nearest living Mega Alpha below which the courier draws in the near-camera depth slice. */
export const megaForegroundM = 14;
/** Five living bodies inside the caller's overlap radius count as a close crowd. */
export function crowdSurroundsCourier(at: { x: number; z: number }, figures: Iterable<EntitySnapshot>, radiusM = 3): boolean {
  let nearby = 0;
  for (const e of figures) {
    if (e.id === 1 || e.hidden || e.health.current <= 0 || e.infected?.hidden || !(e.civilian || e.infected || e.escort)) continue;
    const dx = e.transform.x - at.x, dz = e.transform.z - at.z;
    if (dx * dx + dz * dz < radiusM * radiusM && ++nearby >= 5) return true;
  }
  return false;
}

/**
 * When the courier draws in the near-camera depth slice (CharacterView.setForeground): she then clears every blocker,
 * including nearer people, the corgi and props. Boss contact, L7's packed following group and corpse piles use this treatment.
 * Building and roof blockers are handled by the placement cut (SeeThrough), which keeps nearer actors in front of her
 * (PO #9 L2 start, #26 L1 shutter: the slice drew her over firefighter "2", the closed bay leaf and the horde).
 */
export function courierForegroundWanted(nearBodies: boolean, megaDistanceM: number, onFootBehindVehicle = false): boolean {
  // vqa-3 P1 (L2 doors): on foot, vehicle hulls stay whole (no disc); a hull hiding her chest/head shows her through the
  // slice + gold contour instead, as in the hordes. Riding/driving keeps the separate hull cut and seated cutaway.
  return onFootBehindVehicle || nearBodies || megaDistanceM < megaForegroundM;
}
