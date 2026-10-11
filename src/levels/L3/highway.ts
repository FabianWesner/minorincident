import type { Aabb, Placement, StaticCollider } from '../districts/types';
/** The existing S-ramp's authored centreline (assets/kit.highway-onramp/build.py), in game space. */
export function highwayPoint(p: Placement, t: number, offset = 0): [number, number, number] {
  const slope = -4.3 * 2 * Math.PI / 24 * Math.cos(2 * Math.PI * t), norm = Math.hypot(slope, 1);
  const x = -12 + 24 * t - slope / norm * offset, z = 4.3 * Math.sin(2 * Math.PI * t) - offset / norm;
  return [p.position[0] + x * Math.cos(p.yaw) + z * Math.sin(p.yaw), p.position[1] + .7 + 5 * (1-t*t), p.position[2] - x * Math.sin(p.yaw) + z * Math.cos(p.yaw)];
}
/** Fine support strips and continuous jersey rails replace the old ground-level pier footprints on L3's traversed ramps. */
export function highwayColliders(p: Placement): StaticCollider[] {
  const result: StaticCollider[] = [];
  for (let i = 0; i < 120; i++) {
    const a = i / 120, b = (i+1) / 120;
    for (const side of [0, -1, 1]) {
      const offsets = side ? [side * 2.31, side * 2.88] : [-2.31, 2.31];
      const points = [a,b].flatMap(t => offsets.map(w => highwayPoint(p,t,w)));
      const box: Aabb = {min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
      points.forEach(v => v.forEach((n,k) => { box.min[k]=Math.min(box.min[k],n); box.max[k]=Math.max(box.max[k],n); }));
      if(side) box.navBlocker = true;
      box.min[1] -= .5; box.max[1] += side ? .95 : 0;
      result.push({id:`${p.id}/highway-${side}-${i}`,aabb:box,walkable:side===0,minTier:p.minTier,maxTier:p.maxTier});
    }
  }
  return result;
}
