import type { DistrictLayout, PositionRef, Point, Tier, Aabb } from "./types";
/** Resolve on load, so gameplay can tune coordinates without rebuilding a layout. */
export function resolvePosition(
  ref: PositionRef,
  layout: DistrictLayout,
): Point {
  if ("anchor" in ref) {
    const pose = layout.anchors[ref.anchor];
    if (!pose)
      throw new Error(`Missing anchor: ${layout.district}/${ref.anchor}`);
    return [pose.position[0], pose.position[2]];
  }
  return [ref.x, ref.z];
}
export function inside(point: Point, polygon: Point[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x, z] = polygon[i],
      [xx, zz] = polygon[j];
    if (
      z > point[1] !== zz > point[1] &&
      point[0] < ((xx - x) * (point[1] - z)) / (zz - z) + x
    )
      result = !result;
  }
  return result;
}
function laneOverlap(
  aabb: Aabb,
  a: Point,
  b: Point,
  halfWidth: number,
): boolean {
  // Liang-Barsky clipping against an expanded footprint supports arbitrary road headings.
  let lo = 0,
    hi = 1;
  for (const [axis, index] of [
    [0, 0],
    [2, 1],
  ]) {
    const min = aabb.min[axis] - halfWidth,
      max = aabb.max[axis] + halfWidth,
      delta = b[index] - a[index];
    if (delta === 0) {
      if (a[index] < min || a[index] > max) return false;
    } else {
      let t0 = (min - a[index]) / delta,
        t1 = (max - a[index]) / delta;
      if (t0 > t1) [t0, t1] = [t1, t0];
      lo = Math.max(lo, t0);
      hi = Math.min(hi, t1);
      if (lo > hi) return false;
    }
  }
  return true;
}
/** Same drivable lane footprint used by layout validation, independent of allowRoad. */
export function overlapsRoad(layout: DistrictLayout, aabb: Aabb): boolean {
  return layout.roads.edges.some(e => e.points.slice(1).some((b, i) => laneOverlap(aabb, e.points[i], b, e.laneWidth / 2)));
}
export function validateLayout(
  layout: DistrictLayout,
  manifest: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  if (
    layout.version !== 1 ||
    layout.bounds.length < 5 ||
    JSON.stringify(layout.bounds[0]) !== JSON.stringify(layout.bounds.at(-1)) ||
    layout.bounds.some((p) => p.some((v) => !Number.isFinite(v)))
  )
    errors.push("invalid closed bounds");
  const connected = new Set([layout.roads.nodes[0]?.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of layout.roads.edges)
      if (connected.has(e.start) || connected.has(e.end))
        for (const id of [e.start, e.end])
          if (!connected.has(id)) {
            connected.add(id);
            changed = true;
          }
  }
  if (connected.size !== layout.roads.nodes.length)
    errors.push("disconnected road graph");
  const nodes = new Map(layout.roads.nodes.map((n) => [n.id, n.point]));
  for (const e of layout.roads.edges)
    if (
      !nodes.has(e.start) ||
      !nodes.has(e.end) ||
      e.points.length < 2 ||
      JSON.stringify(e.points[0]) !== JSON.stringify(nodes.get(e.start)) ||
      JSON.stringify(e.points.at(-1)) !== JSON.stringify(nodes.get(e.end)) ||
      e.laneWidth <= 0
    )
      errors.push(`invalid road edge ${e.id}`);
  for (const p of layout.placements) {
    if (!(p.assetId in manifest)) errors.push(`unknown asset ${p.assetId}`);
    if (!inside([p.position[0], p.position[2]], layout.bounds))
      errors.push(`placement outside bounds ${p.id}`);
    if (
      !p.allowRoad &&
      layout.roads.edges.some((e) =>
        e.points
          .slice(1)
          .some((b, i) =>
            laneOverlap(p.visualAabb, e.points[i], b, e.laneWidth / 2),
          ),
      )
    )
      errors.push(`road lane overlap ${p.id}`);
    if (p.allowRoad && !["veh.wreck", "prop.traffic-cone"].includes(p.assetId))
      errors.push(`illegal road exception ${p.id}`);
  }
  return errors;
}
/** Cumulative layer resolution is shared by render, physics and tests. */
export function resolveDecay(layout: DistrictLayout, tier: Tier) {
  const layers = layout.layers.filter((l) => l.tier <= tier),
    off = new Set(layers.flatMap((l) => l.disableLights));
  return {
    placements: layout.placements.filter(
      (p) => p.minTier <= tier && p.maxTier >= tier,
    ),
    colliders: layout.colliders.filter(
      (c) => c.minTier <= tier && c.maxTier >= tier,
    ),
    removed: layers.flatMap((l) => l.remove),
    lights: layout.lightGroups.filter((g) => !off.has(g.id)).map((g) => g.id),
  };
}
/** Vector minimap consumes the same polylines as Blender's road authoring. No duplicate map coordinates. */
export const minimapData = (layout: DistrictLayout) => ({
  bounds: layout.bounds,
  roads: layout.roads.edges.map((e) => e.points),
  buildings: layout.buildings.map((b) => ({
    id: b.id,
    aabb: b.aabb,
    label: b.label,
  })),
});
