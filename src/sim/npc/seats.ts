import type { Point } from './types';

/**
 * Authored seat anchors of the props civilians sit on. The `npc-sit` clip is a fixed pose (thighs level, shins vertical):
 * its hip joint is `sitHipHeight` above the model root and `sitHipAboveSeat` above the plane its thighs rest on. The
 * anchor is therefore the hip (pelvis) target: over the seat centre at `top` + `sitHipAboveSeat`. Props that are sat on
 * are authored low enough (layouts/*, `SEAT_SY` in tools/blender/sslib/l1_dressing.py) that the legs reach the ground.
 * Pose numbers are checked against the rig in tests/unit/render/sit-pose.test.ts.
 */
export const sitHipHeight = 0.43;
export const sitHipAboveSeat = 0.12;
/** Local to the prop, +X is the seat front. `hipX` puts the back a hand from the backrest and the heels past the front edge. */
export const seatSpecs: Record<string, { hipX: number; top: number }> = {
  'prop.bench': { hipX: 0.16, top: 0.5625 },
  'prop.lawn-chair-a': { hipX: 0.1, top: 0.4875 },
  'prop.lawn-chair-b': { hipX: 0.1, top: 0.4875 },
};
export interface SeatAnchor extends Point { y: number; /** Root lift above the sitter's ground that puts the hip joint on `y`. */ lift: number }
/** World position of the sitter's hip joint and the root lift for a seat placement (`origin` is the district offset). */
export function seatAnchor(assetId: string, position: readonly number[], yaw: number, scale: readonly number[], origin: Point = { x: 0, z: 0 }): SeatAnchor | null {
  const spec = seatSpecs[assetId];
  if (!spec) return null;
  const forward = spec.hipX * scale[0], y = spec.top * scale[1] + sitHipAboveSeat;
  return { x: position[0] + origin.x + Math.cos(yaw) * forward, z: position[2] + origin.z - Math.sin(yaw) * forward, y: position[1] + y, lift: y - sitHipHeight };
}
