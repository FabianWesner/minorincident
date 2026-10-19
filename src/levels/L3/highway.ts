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
  for (const joint of highwayJointSegments) {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw), yaw = joint.yaw + p.yaw;
    const x = p.position[0] + joint.x * c + joint.z * s, z = p.position[2] - joint.x * s + joint.z * c;
    const hx = Math.abs(Math.cos(yaw)) * joint.length / 2 + Math.abs(Math.sin(yaw)) * .35, hz = Math.abs(Math.sin(yaw)) * joint.length / 2 + Math.abs(Math.cos(yaw)) * .35;
    result.push({ id: `${p.id}/highway-joint-${joint.side}`, aabb: { min: [x - hx, p.position[1] + 5.7, z - hz], max: [x + hx, p.position[1] + 6.65, z + hz], navBlocker: true }, walkable: false, minTier: p.minTier, maxTier: p.maxTier });
  }
  return result;
}

/** Integral top-end rail joins, in the ramp's local asset frame; shared by rendering and contact. */
export const highwayJointSegments = [-1, 1].map(side => {
  const a = highwayPoint({ position: [0, 0, 0], yaw: 0 } as Placement, 0, side * 2.6), b = [-12, 5.7, -side * 2.58];
  const dx = b[0] - a[0], dz = b[2] - a[2];
  return { side, x: (a[0] + b[0]) / 2, z: (a[2] + b[2]) / 2, length: Math.hypot(dx, dz) + .04, yaw: -Math.atan2(dz, dx) };
});
