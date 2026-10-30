import { Vector2, Vector3, type Box3, type Camera, type Node } from 'three/webgpu';
import { dot, fract, mix, normalWorld, positionView, positionWorld, screenCoordinate, screenSize, screenUV, smoothstep, uniform, renderGroup, vec2 } from 'three/tsl';

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
  /** A building encloses the lens; only that placement clears its foreground. */
  cover: uniform(0).setGroup(renderGroup),
  /** World height of the subject's lowest point (feet or tyres). Solid occluders retain the support surface below it. */
  floor: uniform(0).setGroup(renderGroup),
  /** Share of an occluder that survives inside the clear disc. 0 for the courier and her corgi (PO #45: no dither dots over the figures; the disc is cut clean),
   * .35 while the player drives or rides a vehicle so a faded car or bus still reads as one. */
  retain: uniform(0).setGroup(renderGroup),
  /** Frozen corpses (StaticCorpses) dissolve inside the subject disc while the courier is on foot (Q-209): a small-corpse pile
   * at her feet buried her (L4 west breach). A uniform switch: the corpse programs compile once with the cut. */
  corpse: uniform(0).setGroup(renderGroup),
  /** L6 (metro tunnel and station) uses a clean silhouette cut instead of fragment dither (Q-241: stipple on the arches). */
  solidSilhouette: uniform(0).setGroup(renderGroup),
  /** Height above her feet that solid occluders always keep (vertical faces; support faces keep .08 m more). 0.22 everywhere
   * (QA #48, PO #5); 0.42 in the L6 metro, whose rails rise 0.4 m above the track bed she walks on: a lower band sliced the
   * rail web and crown into a saw-tooth around her (Q-241). */
  keepBand: uniform(.22).setGroup(renderGroup),
  /** Legacy boss-mask diagnostic: the current Alpha-sized Mega stays opaque. */
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

/** Solid occluders use a tighter circle than leaf crowns: a lamp post beside the courier stays whole.
 * They dissolve with an ordered (interleaved gradient noise) dither instead of blending, so
 * they stay opaque, depth-writing and in their batch. Fragments below 0.3 m above the courier's feet (ground, kerbs, lawns, and the deck or stair she stands on) are kept:
 * PO 10-14 (minigun deck): the cut dissolved a jagged hole in the floor under the gunner. */
export const seeThroughKeep = (eligible?: Node<'float'>) => {
  // QA #48 (L5 pharmacy): the kept 0.3 m band of a wall standing right in front of her drew its top edge across her feet, so she read as
  // standing on the roof edge. Support surfaces (facing up) keep the 0.3 m band; vertical faces keep 0.22 m, so 20 cm kerbs stay whole (PO #5).
  const cuttable = positionWorld.y.greaterThan(seeThrough.floor.add(seeThrough.keepBand).add(.08))
    .or(normalWorld.y.lessThan(.5).and(positionWorld.y.greaterThan(seeThrough.floor.add(seeThrough.keepBand))));
  const hole = cuttable.select(mix(1, seeThroughHole(1, seeThrough.solidRadius, .85), seeThrough.strength), 1);
  const noise = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  // A placement enclosing most of the lens cannot leave a roof across the
  // entire viewport. Its foreground surfaces clear, while supports and surfaces
  // behind the subject stay intact. Other placements keep the bounded disc.
  const lens = eligible?.greaterThan(1.5).and(seeThrough.strength.greaterThan(.5))
    .and(positionView.z.greaterThan(seeThrough.depth)).and(positionWorld.y.greaterThan(seeThrough.floor.add(.08)));
  // Buildings (placements): fully clear the centre. A retained opaque core stacked foreground walls into a dark floating blob.
  const keep = seeThrough.solidSilhouette.greaterThan(.5).select(hole.greaterThan(.5), hole.greaterThan(noise));
  // Vehicles and props retain a screen-stable share of their surface inside the disc (retain = .35 while the player drives or
  // rides, 0 for the courier and her corgi on foot: PO #45 no dither dots over the figures). Shared noise across layers keeps the rest open.
  const retained = hole.mul(seeThrough.retain.oneMinus()).add(seeThrough.retain);
  const silhouette = seeThrough.solidSilhouette.greaterThan(.5).select(retained.greaterThan(.5), retained.greaterThan(noise));
  return eligible ? eligible.lessThan(.5).or(keep.and(lens!.not())) : silhouette;
};

/** Mega Alpha dither (same noise as solid occluders): only boss fragments nearer the lens than the courier's far body point and inside a small
 * disc around her are dropped, so a boss standing in front keeps its silhouette, arms and red eyes while the courier stays readable. */
export const seeThroughKeepBoss = () => {
  const hole = mix(1, seeThroughHole(1, seeThrough.bossRadius, .6), seeThrough.bossStrength);
  const noise = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  return hole.greaterThan(noise);
};

/** Q-209 corpse cut: corpse fragments nearer the lens than the courier's far body point and inside the solid subject disc are
 * dropped, with no kept floor band (bodies lie below it) and a clean disc (PO #45: no dither dots over her). Bodies elsewhere keep every pixel. */
let corpseKeep: Node<'bool'> | undefined;
export const seeThroughKeepCorpse = (): Node<'bool'> => corpseKeep ??= (() => {
  // Polish-p3 (QA: halftone dots slicing the nearer bodies at zoom 1): same fully clear disc (.85 R) but the dithered rim is
  // a quarter as wide (.85 R to .89 R), so only a thin edge, not a 15% band, shows dots.
  const hole = mix(1, seeThroughHole(1, seeThrough.solidRadius.mul(.89), .955), seeThrough.corpse);
  const noise = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  return hole.greaterThan(noise);
})();

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
