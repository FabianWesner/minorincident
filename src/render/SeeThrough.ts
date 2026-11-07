import { Vector2, Vector3, type Box3, type Camera, type Node } from 'three/webgpu';
import { dot, fract, mix, normalWorld, positionView, positionWorld, screenCoordinate, screenSize, screenUV, smoothstep, uniform, renderGroup, vec2, vec4 } from 'three/tsl';

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
  /** 1 while the courier is on foot: vehicle hulls cut a clean, depth-limited disc (no retained dither share). */
  hullClean: uniform(0).setGroup(renderGroup),
  /** On-foot hull disc from the courier's own box (no corgi or group union): centre, radius (screen heights), far depth. */
  hullCenter: uniform(new Vector2(-10, -10)).setGroup(renderGroup),
  hullRadius: uniform(0).setGroup(renderGroup),
  hullDepth: uniform(0).setGroup(renderGroup),
  /** L6 (metro tunnel and station) uses a clean silhouette cut instead of fragment dither (Q-241: stipple on the arches). */
  solidSilhouette: uniform(0).setGroup(renderGroup),
  /** Height above her feet that solid occluders always keep (vertical faces; support faces keep .08 m more). 0.22 everywhere
   * (QA #48, PO #5); horizontal support faces retain at least .45 m. 0.42 in the L6 metro, whose rails rise 0.4 m above the track bed she walks on: a lower band sliced the
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
 * they stay opaque, depth-writing and in their batch. Horizontal supports through 0.45 m above the courier's feet (ground, kerbs, lawns, and the deck or stair she stands on) are kept:
 * PO 10-14 (minigun deck): the cut dissolved a jagged hole in the floor under the gunner. */
export const seeThroughKeep = (eligible?: Node<'float'>, deck = false) => {
  // fix68-a (L3-13): `deck` (the raised highway ramp) keeps everything up to 1.6 m above her feet, so the 0.95 m jersey rails and the
  // deck edge she walks along stay whole; only the gantry and lamp heads above head height dissolve.
  // QA #48 (L5 pharmacy): the kept 0.3 m band of a wall standing right in front of her drew its top edge across her feet, so she read as
  // standing on the roof edge. Support surfaces (facing up) keep the 0.3 m band; vertical faces keep 0.22 m, so 20 cm kerbs stay whole (PO #5).
  // A courier on the street must not cut the adjacent 0.4 m station apron.
  // Preserve step-height horizontal tops while vertical cover keeps its tight band.
  const cuttable = positionWorld.y.greaterThan(seeThrough.floor.add(seeThrough.keepBand.add(.08).max(deck ? 1.6 : .45)))
    .or(normalWorld.y.lessThan(.5).and(positionWorld.y.greaterThan(seeThrough.floor.add(deck ? seeThrough.keepBand.max(1.6) : seeThrough.keepBand))));
  const hole = cuttable.select(mix(1, seeThroughHole(1, seeThrough.solidRadius, .85), seeThrough.strength), 1);
  const noise = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  // A placement enclosing most of the lens cannot leave a roof across the
  // entire viewport. Its foreground surfaces clear, while supports and surfaces
  // behind the subject stay intact. Other placements keep the bounded disc.
  // The ramp's bounding box encloses the camera whenever she stands on it, which would clear every surface nearer than her (a straight
  // cut through the deck): the deck mode never takes the lens branch.
  const lens = deck ? undefined : eligible?.greaterThan(1.5).and(seeThrough.strength.greaterThan(.5))
    .and(positionView.z.greaterThan(seeThrough.depth)).and(positionWorld.y.greaterThan(seeThrough.floor.add(.08)));
  // Buildings (placements): fully clear the centre. A retained opaque core stacked foreground walls into a dark floating blob.
  const keep = seeThrough.solidSilhouette.greaterThan(.5).select(hole.greaterThan(.5), hole.greaterThan(noise));
  // Vehicles and props retain a screen-stable share of their surface inside the disc (retain = .35 while the player drives or
  // rides, 0 for the courier and her corgi on foot: PO #45 no dither dots over the figures). Shared noise across layers keeps the rest open.
  const retained = hole.mul(seeThrough.retain.oneMinus()).add(seeThrough.retain);
  const silhouette = seeThrough.solidSilhouette.greaterThan(.5).select(retained.greaterThan(.5), retained.greaterThan(noise));
  return eligible ? eligible.lessThan(.5).or(lens ? keep.and(lens.not()) : keep) : silhouette;
};

/** A closed hull has no playable interior. Clear its full depth inside the
 * same bounded opening, so cutting its near wall cannot expose an unlit rear
 * step or chassis fragment behind the courier. Eligibility is still tested
 * against the camera-to-subject segments before this mode is enabled. */
export const seeThroughKeepHull = () => {
  const distance = screenUV.sub(seeThrough.center).mul(vec2(screenSize.x.div(screenSize.y), 1)).length();
  const hole = mix(1, smoothstep(seeThrough.solidRadius.mul(.85), seeThrough.solidRadius, distance), seeThrough.strength);
  const noise = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  const retained = hole.mul(seeThrough.retain.oneMinus()).add(seeThrough.retain);
  // vqa-1 P1 (L2 doors): on foot the cut is a clean disc edge with no dither and only hull fragments nearer the lens than
  // the courier go, so a truck she stands beside keeps its far half instead of dissolving into road-coloured noise.
  // The disc is her own projected box, so only hull pixels over her body and nearer than her are removed.
  const own = screenUV.sub(seeThrough.hullCenter).mul(vec2(screenSize.x.div(screenSize.y), 1)).length();
  const clean = positionView.z.lessThanEqual(seeThrough.hullDepth).or(own.greaterThan(seeThrough.hullRadius)).or(seeThrough.strength.lessThan(.5));
  return positionWorld.y.lessThanEqual(seeThrough.floor.add(.08)).or(seeThrough.hullClean.greaterThan(.5).select(clean, retained.greaterThan(noise)));
};

/** Seated L2 crew cutaway (vqa-1 P2): the hull above a horizontal plane over the occupied seats is removed, like a cutaway
 * drawing with its roof off. World position goes into the chassis frame through one matrix; no dither, no screen disc. */
export const seeThroughKeepCutaway = (inverse: Node<'mat4'>, min: Node<'vec3'>, max: Node<'vec3'>) => {
  const local = inverse.mul(vec4(positionWorld, 1)).xyz;
  return local.x.lessThan(min.x).or(local.x.greaterThan(max.x)).or(local.z.lessThan(min.z)).or(local.z.greaterThan(max.z)).or(local.y.lessThan(min.y)).or(local.y.greaterThan(max.y));
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
  const { u, v, radius, depth } = projectBox(camera, box);
  seeThrough.center.value.set(u, v);
  seeThrough.solidRadius.value = radius / .85;
  seeThrough.depth.value = depth - .05;
}
/** The courier's own on-foot hull disc (vqa-1 P1): no union, enclosing circle of her projected box. */
export function projectHullReveal(camera: Camera & { aspect: number }, box: Box3 | undefined): void {
  if (!box) { seeThrough.hullCenter.value.set(-10, -10); seeThrough.hullRadius.value = 0; return; }
  const { u, v, radius, depth } = projectBox(camera, box);
  seeThrough.hullCenter.value.set(u, v); seeThrough.hullRadius.value = radius; seeThrough.hullDepth.value = depth - .05;
}
function projectBox(camera: Camera & { aspect: number }, box: Box3): { u: number; v: number; radius: number; depth: number } {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, depth = Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    revealCorner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse); depth = Math.min(depth, revealCorner.z);
    revealCorner.set(x, y, z).project(camera);
    const u = revealCorner.x * .5 + .5, v = .5 - revealCorner.y * .5;
    left = Math.min(left, u); right = Math.max(right, u); top = Math.min(top, v); bottom = Math.max(bottom, v);
  }
  return { u: (left + right) / 2, v: (top + bottom) / 2, radius: Math.hypot((right - left) * camera.aspect, bottom - top) / 2, depth };
}
