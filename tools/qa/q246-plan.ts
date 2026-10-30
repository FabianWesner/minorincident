/** Authored route coverage and placement-vs-solids receipt; no new test-suite cases. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cureBeltGroundLantern, cureRoadsideBelt } from '../../src/levels/L10/roadsideBelt';
import { cure } from '../../src/levels/L10/district';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
const props = cureRoadsideBelt(layout.placements), anchors = props.filter(p => p.roadLife);
assert.deepEqual(placementColliders([...layout.placements, ...props], layout.colliders), placementColliders(layout.placements, layout.colliders));
const lines = [...cure.regions.map(r => r.route), ...cure.detours.map(d => d.route)];
const distance = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], d = dx * dx + dz * dz;
  const t = d ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const edge = (p: Point) => Math.min(...lines.flatMap(l => l.slice(1).map((b, i) => distance(p, l[i], b)))) - 3;
const [lx,,lz] = cureBeltGroundLantern;
const checked = [...props, { id:'substation-ground-lantern', visualAabb:{ min:[lx-.17,0,lz-.17], max:[lx+.17,.65,lz+.17] } }];
const bounds = checked.flatMap(p => { const { min: a, max: b } = p.visualAabb; return [[a[0],a[2]], [a[0],b[2]], [b[0],a[2]], [b[0],b[2]]].map(q => edge(q as Point)); });
const overlaps: string[][] = [];
for (const p of checked) for (const c of layout.colliders) {
  const a = p.visualAabb, b = c.aabb;
  if (b.max[1] <= .15 || b.min[1] >= a.max[1]) continue;
  if (a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[2] < b.max[2] && a.max[2] > b.min[2]) overlaps.push([p.id, c.id]);
}
let carry = 14, offset = 0;
const coverage: { id: string; nominalM: number; actualM: number; standalone: boolean; side: number; preferredSide: number }[] = [];
for (const [ri, region] of cure.regions.slice(0, 5).entries()) {
  let length = 0;
  const segments = region.route.slice(1).map((b, i) => { const a = region.route[i], d = Math.hypot(b[0]-a[0], b[1]-a[1]), s = length; length += d; return { a,b,d,s }; });
  let s = carry;
  for (let n = 0; s < length; s += 28, n++) {
    const id = `decor-cure-belt-r${ri+1}-${n}-lamp`;
    const standalone = ri === 2 && s === 620;
    const p = anchors.find(p => p.id === id) ?? (standalone ? { id:'substation-ground-lantern', position:cureBeltGroundLantern } : undefined);
    assert.ok(p, `Unlit station ${id}`);
    const [x,,z] = p.position;
    const projections = segments.map(q => {
      const dx=q.b[0]-q.a[0], dz=q.b[1]-q.a[1], t=Math.max(0,Math.min(1,((x-q.a[0])*dx+(z-q.a[1])*dz)/(q.d*q.d)));
      return { at:q.s+t*q.d, distance:Math.hypot(x-q.a[0]-t*dx,z-q.a[1]-t*dz), side:Math.sign((x-q.a[0])*-dz+(z-q.a[1])*dx) };
    }).filter(p => Math.abs(p.at-s) <= 6.1).sort((a,b) => a.distance-b.distance);
    assert.ok(projections.length, id);
    coverage.push({ id:p.id, nominalM:offset+s, actualM:offset+projections[0].at, standalone,
      side:projections[0].side, preferredSide:coverage.length % 2 ? -1 : 1 });
  }
  carry=s-length; offset+=length;
}
const gaps=coverage.slice(1).map((p,i) => p.actualM-coverage[i].actualM);
const result = { props:props.length, focalPoints:coverage.length, supplyLanterns:anchors.length, groundLanterns:coverage.filter(p=>p.standalone).length,
  edgeMin:Math.min(...bounds), edgeMax:Math.max(...bounds), gapMin:Math.min(...gaps), gapMax:Math.max(...gaps),
  alternateSideExceptions:coverage.filter(p=>p.side!==p.preferredSide).length, colliderSetUnchanged:true, overlaps, coverage };
mkdirSync('test-results/q246',{recursive:true}); writeFileSync('test-results/q246/plan.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({ ...result, coverage:undefined }));
assert.deepEqual(overlaps, []); assert.ok(result.edgeMin>=3 && result.edgeMax<=10);
assert.ok(result.gapMin>=25 && result.gapMax<=40);
assert.ok(props.every(p=>p.decor && p.position[1]===0));
