import type { EntitySnapshot } from '../sim/world/types';

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
/** A nearby Mega only triggers the foreground slice when its body actually crosses the camera-to-courier view segment. */
export function megaOccludesCourier(camera: { x: number; y: number; z: number }, courier: { x: number; y: number; z: number }, figures: Iterable<EntitySnapshot>, radiusM = 2.4): boolean {
  const ax = camera.x, ay = camera.y, az = camera.z, bx = courier.x, by = courier.y + .85, bz = courier.z;
  const dx = bx - ax, dy = by - ay, dz = bz - az, lengthSq = dx * dx + dy * dy + dz * dz;
  if (lengthSq < 1e-6) return false;
  for (const e of figures) {
    if (!e.infected?.pursuit || e.hidden || e.infected.hidden || e.health.current <= 0) continue;
    const t = ((e.transform.x - ax) * dx + (e.transform.y + 1.2 - ay) * dy + (e.transform.z - az) * dz) / lengthSq;
    if (t <= 0 || t >= 1) continue;
    const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
    if ((e.transform.x - x) ** 2 + (e.transform.y + 1.2 - y) ** 2 + (e.transform.z - z) ** 2 <= radiusM * radiusM) return true;
  }
  return false;
}

export function courierForegroundWanted(nearBodies: boolean, megaOccludes: boolean, onFootBehindVehicle = false): boolean {
  // vqa-3 P1 (L2 doors): on foot, vehicle hulls stay whole (no disc); a hull hiding her chest/head shows her through the
  // slice + gold contour instead, as in the hordes. Riding/driving keeps the separate hull cut and seated cutaway.
  return onFootBehindVehicle || nearBodies || megaOccludes;
}
