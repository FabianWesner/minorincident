/** Shared game framing; simulation uses these constants, never the rendered camera. */
export const cameraFraming = { fovDeg: 25, radiusM: 19, polar: Math.PI * .30, portraitWidthM: 7 } as const;

/** PO #67: serialized zoom must also accept the held launcher's wider follow view. */
export const rocketZoomLimit = 2;

/** Both target and shooter reach are shorter than the narrowest default ground width. */
export const policeEngagementM = cameraFraming.portraitWidthM * .65;
export const policeShotRangeM = cameraFraming.portraitWidthM - 1;

/** Conservative default follow-camera projection, centred on the simulation player.
 * Use the desktop radius/vertical extent and the phone's minimum width together: this volume
 * fits inside both aspect framings. Project the infected's torso, leaving 12% around screen edges.
 * No render matrices, viewport state, presentation smoothing or frame timing enter simulation. */
export function policeTargetInView(dx: number, dz: number): boolean {
  if (Math.hypot(dx, dz) > policeEngagementM) return false;
  const { polar, radiusM, portraitWidthM, fovDeg } = cameraFraming;
  const toward = (dx + dz) / Math.SQRT2, right = (dx - dz) / Math.SQRT2;
  const depth = radiusM - Math.sin(polar) * toward - Math.cos(polar) * .7;
  const up = -Math.cos(polar) * toward + Math.sin(polar) * .7;
  return Math.abs(right) <= .88 * portraitWidthM / 2 * Math.min(1, depth / radiusM)
    && Math.abs(up) <= .88 * Math.tan(fovDeg * Math.PI / 360) * depth;
}
