import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {l6,l6Doors,l6PhotoSpots} from '../../../src/data/l6';
import {timeOfDay} from '../../../src/data/timeOfDay';
import {worldAssets} from '../../../src/assets/worldDefinitions';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { compositions } from '../../../src/levels/compositions';
import {validateLayout} from '../../../src/levels/districts/validate';
import type {DistrictLayout} from '../../../src/levels/districts/types';
const layout=JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json','utf8')) as DistrictLayout;
test('T-E24-12 @E24 @E24-AC12 @E24-AC11 confined metro, passages and gates use shipped solid kits',()=>{
  expect(validateLayout(layout,worldAssets)).toEqual([]);expect(l6.tunnel.width).toBeLessThanOrEqual(8);expect(l6.tunnel.end-l6.tunnel.start).toBeGreaterThanOrEqual(200);expect(l6.tunnel.end-l6.tunnel.start).toBeLessThanOrEqual(260);expect(l6Doors.slice(2)).toHaveLength(6);expect(new Set(l6Doors.slice(2).map(d=>d.z)).size).toBe(2);expect(layout.placements.filter(p=>p.assetId==='kit.maintenance-corridor')).toHaveLength(5);expect(l6.gates).toHaveLength(3);
  for(const x of l6.gates){const barriers=layout.placements.filter(p=>p.assetId==='prop.jersey-barrier'&&p.position[0]===x&&Math.abs(p.position[2]-15)>1.5&&Math.abs(p.position[2]-15)<3);expect(barriers).toHaveLength(2);expect(barriers[1].position[2]-barriers[0].position[2]-2.5).toBeLessThanOrEqual(2.5);expect(layout.placements.some(p=>p.assetId==='prop.crates'&&Math.abs(p.position[0]-x)<4)).toBe(true);}
  const blockers=layout.placements.filter(p=>p.assetId==='prop.jersey-barrier'&&p.position[0]>=30&&p.position[0]<=246).map(p=>p.position[0]).sort((a,b)=>a-b);for(let i=1;i<blockers.length;i++)expect(blockers[i]-blockers[i-1]).toBeLessThanOrEqual(25);
  for(const [name]of l6PhotoSpots)expect(layout.anchors[`photo-${name}`]).toBeDefined();expect(layout.placements.some(p=>p.assetId.startsWith('weapon.'))).toBe(false);
});
test('T-E24-14a @E24 @E24-AC14 underground has no sun and the exterior is darker/lower than L5',()=>{expect(timeOfDay['L6-subway'].intensity).toBe(0);expect(timeOfDay.L6.polar).toBeGreaterThan(timeOfDay.L5.polar);expect(timeOfDay.L6.intensity).toBeLessThanOrEqual(timeOfDay.L4.intensity*.4);});
test('T-E24-seam @E24 PO 10-15 "Tracks are disconnected": one continuous D-SUBWAY track, rail endpoints coincide within 2 cm',()=>{
  // Rail geometry per module in the module's own frame (tools/blender/sslib/l6_metro.py tunnel() and track() share it): gauge
  // +-0.72 m, crown top 0.62 m above the module origin, module length 12 m. A kit that differs in rail height or position
  // would show here as a placement offset or fail the module list below.
  const crown={'kit.metro-tunnel':.62,'kit.metro-track':.62} as Record<string,number>,gauge=.72,half=6;
  const run=layout.placements.filter(p=>p.assetId in crown).map(p=>({id:p.id,x:p.position[0],y:p.position[1]+crown[p.assetId],z:p.position[2]})).sort((a,b)=>a.x-b.x);
  expect(run.length).toBeGreaterThanOrEqual(20);
  expect(run[0].x-half).toBeLessThanOrEqual(-30+.02);expect(run[run.length-1].x+half).toBeGreaterThanOrEqual(246-.02);
  for(let i=1;i<run.length;i++){const a=run[i-1],b=run[i];
    for(const side of [-gauge,gauge]){const end=[a.x+half,a.y,a.z+side],start=[b.x-half,b.y,b.z+side];
      for(let k=0;k<3;k++)expect(Math.abs(end[k]-start[k]),`${a.id} -> ${b.id} rail ${side} axis ${'xyz'[k]}`).toBeLessThanOrEqual(.02);}}
  // The station platform track modules lie on the tunnel's line and the tunnel-start anchor is on it.
  expect(layout.anchors['tunnel-start'].position[2]).toBeCloseTo(run[0].z,2);
});

test('T-E24-exit-route @E24 @E24-AC17 tunnel centreline climbs the drawn escalator to Northgate without a step above autostep', () => {
  const world = new DistrictWorld(compositions.L6, [layout], 1);
  const exit = layout.placements.find(p => p.assetId === 'int.metro-exit')!;
  // The delivered escalator centre is 0.9 m to the left of the asset origin after its half-turn.
  expect(exit.position[2] - .9).toBeCloseTo(l6.tunnel.z, 6);
  let feet = .6;
  for (let x = 246; x <= 261; x += .05) {
    const top = world.groundHeight(x, l6.tunnel.z);
    expect(top, `unsupported approach at x=${x}`).toBeGreaterThanOrEqual(feet - .01);
    expect(top - feet, `unclimbable step at x=${x}`).toBeLessThanOrEqual(.4);
    expect(world.groundBelow(x, l6.tunnel.z, feet, .4)).toBeCloseTo(top, 6);
    feet = top;
  }
  expect(feet).toBeCloseTo(3.9, 6);
});
