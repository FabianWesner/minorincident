import { Vector2, Vector3, type Box3, type Camera, type Node } from 'three/webgpu';
import { dot, fract, mix, positionView, positionWorld, screenCoordinate, screenSize, screenUV, smoothstep, uniform, renderGroup, vec2 } from 'three/tsl';

/** One player see-through hole shared by every occluder (leaf crowns, buildings, roofs, poles, props).
 * Foliage writes the projected centre/depth/radius each frame; DistrictView projects the complete subject before every render. Screen UV has a top-left origin. */
export const seeThrough = {
  center: uniform(new Vector2(-10, -10)).setGroup(renderGroup),
  /** View-space z of the courier's farthest body point; only fragments nearer the camera are cut. */
  depth: uniform(0).setGroup(renderGroup),
  radius: uniform(.1).setGroup(renderGroup),
  /** Hole radius for solid occluders (screen-height units): covers the courier or the complete player vehicle. */
  solidRadius: uniform(.17).setGroup(renderGroup),
  /** Solid reveal is immediate, including the first presented frame. */
  strength: uniform(0).setGroup(renderGroup),
  /** Legacy diagnostic: reveal stays bounded, including when the camera is inside a roof. */
  cover: uniform(0).setGroup(renderGroup),
  /** World height of the subject's lowest point (feet or tyres). Solid occluders retain the support surface below it. */
  floor: uniform(0).setGroup(renderGroup),
  /** Mega Alpha only (E32 close camera): 0..1 eased opening of a courier-sized hole in the boss while it stands between the lens and the courier. */
  bossStrength: uniform(0).setGroup(renderGroup),
  /** Boss hole radius in screen heights (the boss hole is about a courier wide, not a survivor group). */
  bossRadius: uniform(.12).setGroup(renderGroup),
};

/** Placements lower than this never count as occluders (DistrictView's camera-to-courier tests) and are never cut.
 * PO 2026-10-13 "Bank isn't fully rendered": at zoom 0.66 the group-sized solid hole spans most of the frame, and a
 * bench nearer the camera than the courier lost everything above 0.3 m (planks, back) while a building occluded her. */
export const occluderMinHeight = 1.1;
/** LOD0 carries detail (lids, handles) the lower LODs lack, so a prop just under the limit at LOD1 (the height DistrictView classifies by) can draw a few cm above it at LOD0.
 * Every LOD of such a prop must stay uncut, else the hero batch carries the cut material the classification says it never has (forecourt recycling bin, 1.1165 m at LOD0). */
export const lodHeightSlack = 1.1;

/** Soft circular mask around the courier: 0 at the centre, 1 outside the radius and behind the courier. */
export const seeThroughHole = (scale = 1, radius: Node<'float'> = seeThrough.radius, inner = .55) => positionView.z.greaterThan(seeThrough.depth).select(
  smoothstep(radius.mul(inner * scale), radius.mul(scale), screenUV.sub(seeThrough.center).mul(vec2(screenSize.x.div(screenSize.y), 1)).length()), 1);

/** Solid occluders use a slightly tighter circle than leaf crowns: a lamp post beside the courier stays whole.
 * They dissolve with an ordered (interleaved gradient noise) dither instead of blending, so
 * they stay opaque, depth-writing and in their batch. Fragments below 0.08 m above the courier's feet (ground, kerbs, lawns, and the deck or stair she stands on) are kept:
 * PO 10-14 (minigun deck): the cut dissolved a jagged hole in the floor under the gunner. */
export const seeThroughKeep = (eligible?: Node<'float'>) => {
  const hole = positionWorld.y.greaterThan(seeThrough.floor.add(.08)).select(mix(1, seeThroughHole(1, seeThrough.solidRadius, .85), seeThrough.strength), 1);
  const noise = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  const keep = hole.greaterThan(noise);
  return eligible ? eligible.lessThan(.5).or(keep) : keep;
};

/** Mega Alpha dither (same noise as solid occluders): only boss fragments nearer the lens than the courier's far body point and inside a small
 * disc around her are dropped, so a boss standing in front keeps its silhouette, arms and red eyes while the courier stays readable. */
export const seeThroughKeepBoss = () => {
  const hole = mix(1, seeThroughHole(1, seeThrough.bossRadius, .6), seeThrough.bossStrength);
  const noise = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  return hole.greaterThan(noise);
};

const revealCorner = new Vector3();
/** Project the subject (courier or whole player vehicle) into the shared hole uniforms: the fully clear inner disc encloses every corner, depth is its nearest point.
 * Also used by scenes without a DistrictView, so Scene Lab asset-only scenes reveal the courier the same way. */
export function projectReveal(camera: Camera & { aspect: number }, box: Box3): void {
  seeThrough.floor.value = box.min.y;
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, depth = Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    revealCorner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse); depth = Math.min(depth, revealCorner.z);
    revealCorner.set(x, y, z).project(camera);
    const u = revealCorner.x * .5 + .5, v = .5 - revealCorner.y * .5;
    left = Math.min(left, u); right = Math.max(right, u); top = Math.min(top, v); bottom = Math.max(bottom, v);
  }
  seeThrough.center.value.set((left + right) / 2, (top + bottom) / 2);
  seeThrough.solidRadius.value = Math.hypot((right - left) * camera.aspect, bottom - top) / 2 / .85;
  seeThrough.depth.value = depth - .05;
}
