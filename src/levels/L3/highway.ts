import type { Aabb, Placement, StaticCollider } from '../districts/types';
/** The existing S-ramp's authored centreline (assets/kit.highway-onramp/build.py), in game space. */
export function highwayPoint(p: Placement, t: number, offset = 0): [number, number, number] {
  const slope = -4.3 * 2 * Math.PI / 24 * Math.cos(2 * Math.PI * t), norm = Math.hypot(slope, 1);
  const x = -12 + 24 * t - slope / norm * offset, z = 4.3 * Math.sin(2 * Math.PI * t) - offset / norm;
  return [p.position[0] + x * Math.cos(p.yaw) + z * Math.sin(p.yaw), p.position[1] + .7 + 5 * (1-t*t), p.position[2] - x * Math.sin(p.yaw) + z * Math.cos(p.yaw)];
}
/** Fine support strips and continuous jersey rails replace the old ground-level pier footprints on L3's traversed ramps. */
const deckCells = 10;
const cellIndex = (o0: number) => Math.round((o0 + 2.31) / (4.62 / deckCells));
/** Half-width (in t) of the tight inner bend round each S apex (t 0.25 / 0.75): the inner rail radius stays under ~2 m there. */
const apexHalfT = .07;
export function highwayColliders(p: Placement): StaticCollider[] {
  const result: StaticCollider[] = [];
  for (let i = 0; i < 120; i++) {
    const a = i / 120, b = (i+1) / 120;
    // The deck strip is cut across its width too: a tilted 4.62 m strip has an axis-aligned box of ~3.5 x 4.6 m, which held actors
    // up to 1 m above the drawn road beside the S-curve (PO P1-113: courier on a phantom slab beside a dark void).
    const cells: [number, number][] = Array.from({ length: deckCells }, (_, k) => [-2.31 + 4.62 * k / deckCells, -2.31 + 4.62 * (k + 1) / deckCells]);
    for (const side of [0, -1, 1]) for (const [o0, o1] of side ? [[side * 2.31, side * 2.88] as [number, number]] : cells) {
      const offsets = [o0, o1];
      const points = [a,b].flatMap(t => offsets.map(w => highwayPoint(p,t,w)));
      const box: Aabb = {min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
      points.forEach(v => v.forEach((n,k) => { box.min[k]=Math.min(box.min[k],n); box.max[k]=Math.max(box.max[k],n); }));
      if(side) box.navBlocker = true;
      box.min[1] -= .5; box.max[1] += side ? .95 : 0;
      result.push({id:`${p.id}/highway-${side}-${i}${side ? '' : `-${cellIndex(o0)}`}`,aabb:box,walkable:side===0,minTier:p.minTier,maxTier:p.maxTier});
      // fix65-a (L3-13): at each S-bend apex the inner Jersey rail winds round a 0.8 m radius and its straight segments fan
      // open, so a body on the last deck cell stood over the fan and read as hanging past the broken inner edge. Those
      // apex cells keep their support but also carry a rail-height nav blocker, holding walkers ~1 m off the inner rail.
      const apex = Math.abs(a + .5 / 120 - .25) < apexHalfT ? 1 : Math.abs(a + .5 / 120 - .75) < apexHalfT ? -1 : 0;
      if (!side && apex && (apex > 0 ? o0 > 2.31 - 4.62 / deckCells - 1e-6 : o1 < -2.31 + 4.62 / deckCells + 1e-6))
        result.push({id:`${p.id}/highway-apex-${i}`,aabb:{min:[box.min[0],box.max[1],box.min[2]],max:[box.max[0],box.max[1]+.95,box.max[2]],navBlocker:true},walkable:false,minTier:p.minTier,maxTier:p.maxTier});
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
