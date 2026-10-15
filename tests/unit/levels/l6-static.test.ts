import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {l6,l6Doors,l6PhotoSpots} from '../../../src/data/l6';
import {timeOfDay} from '../../../src/data/timeOfDay';
import {worldAssets} from '../../../src/assets/worldDefinitions';
import {validateLayout} from '../../../src/levels/districts/validate';
import type {DistrictLayout} from '../../../src/levels/districts/types';
const layout=JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json','utf8')) as DistrictLayout;
test('T-E24-12 @E24 @E24-AC12 @E24-AC11 confined metro, passages and gates use shipped solid kits',()=>{
  expect(validateLayout(layout,worldAssets)).toEqual([]);expect(l6.tunnel.width).toBeLessThanOrEqual(8);expect(l6.tunnel.end-l6.tunnel.start).toBeGreaterThanOrEqual(200);expect(l6.tunnel.end-l6.tunnel.start).toBeLessThanOrEqual(260);expect(l6Doors.slice(2)).toHaveLength(6);expect(new Set(l6Doors.slice(2).map(d=>d.z)).size).toBe(2);expect(layout.placements.filter(p=>p.assetId==='kit.maintenance-corridor')).toHaveLength(5);expect(l6.gates).toHaveLength(3);
  for(const x of l6.gates){const barriers=layout.placements.filter(p=>p.assetId==='prop.jersey-barrier'&&p.position[0]===x&&[12.65,17.35].includes(p.position[2]));expect(barriers).toHaveLength(2);expect(barriers[1].position[2]-barriers[0].position[2]-2.5).toBeLessThanOrEqual(2.5);expect(layout.placements.some(p=>p.assetId==='prop.crates'&&Math.abs(p.position[0]-x)<4)).toBe(true);}
  const blockers=layout.placements.filter(p=>p.assetId==='prop.jersey-barrier'&&p.position[0]>=30&&p.position[0]<=246).map(p=>p.position[0]).sort((a,b)=>a-b);for(let i=1;i<blockers.length;i++)expect(blockers[i]-blockers[i-1]).toBeLessThanOrEqual(25);
  for(const [name]of l6PhotoSpots)expect(layout.anchors[`photo-${name}`]).toBeDefined();expect(layout.placements.some(p=>p.assetId.startsWith('weapon.'))).toBe(false);
});
test('T-E24-14a @E24 @E24-AC14 underground has no sun and the exterior is darker/lower than L5',()=>{expect(timeOfDay['L6-subway'].intensity).toBe(0);expect(timeOfDay.L6.polar).toBeGreaterThan(timeOfDay.L5.polar);expect(timeOfDay.L6.intensity).toBeLessThanOrEqual(timeOfDay.L4.intensity*.4);});
