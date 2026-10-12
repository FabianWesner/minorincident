import { Vector2, type Node } from 'three/webgpu';
import { dot, fract, mix, positionView, positionWorld, screenCoordinate, screenSize, screenUV, smoothstep, uniform, vec2 } from 'three/tsl';

/** One player see-through hole shared by every occluder (leaf crowns, buildings, roofs, poles, props).
 * Foliage writes the projected centre/depth/radius each frame; DistrictView eases `strength` while an
 * occluder actually sits on the camera-to-courier ray. Screen UV has a top-left origin. */
export const seeThrough = {
  center: uniform(new Vector2(-10, -10)),
  /** View-space z of the courier's farthest body point; only fragments nearer the camera are cut. */
  depth: uniform(0),
  radius: uniform(.1),
  /** 0..1 eased opening of the solid-occluder hole (leaf crowns always use the full hole). */
  strength: uniform(0),
  /** 0..1 eased: a solid occluder hugs the camera (e.g. the camera above a pitched roof), so its cut widens past
   * the screen edges. A courier-sized hole in a roof 3 m from the lens left the frame one flat colour (L4 blank viewport). */
  cover: uniform(0),
};

/** Soft circular mask around the courier: 0 at the centre, 1 outside the radius and behind the courier. */
export const seeThroughHole = (scale = 1, radius: Node<'float'> = seeThrough.radius) => positionView.z.greaterThan(seeThrough.depth).select(
  smoothstep(radius.mul(.55 * scale), radius.mul(scale), screenUV.sub(seeThrough.center).mul(vec2(screenSize.x.div(screenSize.y), 1)).length()), 1);

/** Solid occluders use a slightly tighter circle than leaf crowns: a lamp post beside the courier stays whole.
 * They dissolve with an ordered (interleaved gradient noise) dither instead of blending, so
 * they stay opaque, depth-writing and in their batch. Fragments below 0.3 m (ground, kerbs, lawns) are kept. */
export const seeThroughKeep = () => {
  // With `cover` the radius grows to 3 (beyond any screen corner from any centre): everything nearer than the courier opens.
  const hole = positionWorld.y.greaterThan(.3).select(mix(1, seeThroughHole(.85, mix(seeThrough.radius, 3, seeThrough.cover)), seeThrough.strength), 1);
  const noise = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  return hole.greaterThan(noise);
};
