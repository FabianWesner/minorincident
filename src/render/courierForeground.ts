/** Metres to the nearest living Mega Alpha below which the courier draws in the near-camera depth slice. */
export const megaForegroundM = 14;

/**
 * When the courier draws in the near-camera depth slice (CharacterView.setForeground): she then clears every blocker,
 * including nearer people, the corgi and props. Boss contact, L7's packed following group and corpse piles use this treatment.
 * Building and roof blockers are handled by the placement cut (SeeThrough), which keeps nearer actors in front of her
 * (PO #9 L2 start, #26 L1 shutter: the slice drew her over firefighter "2", the closed bay leaf and the horde).
 */
export function courierForegroundWanted(nearBodies: boolean, megaDistanceM: number): boolean {
  return nearBodies || megaDistanceM < megaForegroundM;
}
