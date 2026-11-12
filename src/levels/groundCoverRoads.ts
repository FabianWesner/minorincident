import type { DistrictLayout, Placement } from './districts/types';

/** Ground-cover footprints must clear the complete authored road lane. */
export function clearGroundCoverFromRoads(layout: DistrictLayout): DistrictLayout {
  const pointSegmentDistance = (x: number, z: number, a: readonly number[], b: readonly number[]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  };
  const segmentIntersects = (u: readonly number[], v: readonly number[], c: readonly number[], d: readonly number[]) => {
    const orient = (a: readonly number[], b: readonly number[], q: readonly number[]) => (b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]);
    const onSegment = (a: readonly number[], b: readonly number[], q: readonly number[]) => q[0] >= Math.min(a[0],b[0])-1e-8 && q[0] <= Math.max(a[0],b[0])+1e-8 && q[1] >= Math.min(a[1],b[1])-1e-8 && q[1] <= Math.max(a[1],b[1])+1e-8;
    const a=orient(u,v,c), b=orient(u,v,d), e=orient(c,d,u), f=orient(c,d,v);
    return a*b < 0 && e*f < 0 || Math.abs(a)<1e-8 && onSegment(u,v,c) || Math.abs(b)<1e-8 && onSegment(u,v,d) || Math.abs(e)<1e-8 && onSegment(c,d,u) || Math.abs(f)<1e-8 && onSegment(c,d,v);
  };
  const segmentDistanceToBox = (a: readonly number[], b: readonly number[], p: Placement) => {
    const x0 = p.visualAabb.min[0], x1 = p.visualAabb.max[0], z0 = p.visualAabb.min[2], z1 = p.visualAabb.max[2];
    const inside = (q: readonly number[]) => q[0] >= x0 && q[0] <= x1 && q[1] >= z0 && q[1] <= z1;
    const corners = [[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
    if (inside(a) || inside(b) || corners.some((c,i) => segmentIntersects(a,b,c,corners[(i+1)%4]))) return 0;
    const boxDistance = (q: readonly number[]) => Math.hypot(Math.max(x0-q[0],0,q[0]-x1), Math.max(z0-q[1],0,q[1]-z1));
    return Math.min(boxDistance(a), boxDistance(b), ...corners.map(q => pointSegmentDistance(q[0],q[1],a,b)));
  };
  const groundCover = (p: Placement) => /^(veg\.|decal\.|debris\.rubble$|decay\.rubble-pile$)/.test(p.assetId)
    || /(?:ground|grass|vegetation|rubble-field|parking-tile|plaza-tile)/i.test(p.assetId);
  const removed = new Set(layout.placements.filter(p => groundCover(p) && layout.roads.edges.some(road =>
    road.points.slice(1).some((b, i) => segmentDistanceToBox(road.points[i], b, p) < road.laneWidth / 2 + .01))).map(p => p.id));
  if (!removed.size) return layout;
  return { ...layout, placements: layout.placements.filter(p => !removed.has(p.id)),
    colliders: layout.colliders.filter(c => !removed.has(c.id.split('/')[0])),
    buildings: layout.buildings.filter(b => !removed.has(b.id)) };
}
