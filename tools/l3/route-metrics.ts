import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { l3, l3Anchors } from '../../src/data/l3';
import { levelThreeLayouts } from '../../src/levels/L3/layout';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { NavGrid as AiNav } from '../../src/sim/ai/NavGrid';
import { bakeNav } from '../../src/sim/world/NavGrid';
const label = process.argv[2] ?? 'after';
const [layout] = levelThreeLayouts([JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8')) as DistrictLayout]);
const solids = placementColliders(layout.placements, layout.colliders).filter(c => !c.walkable);
const grid = bakeNav([{ layout, origin: [0, 0], colliders: solids.map(c => c.aabb) }], 1, .5);
const nav = new AiNav({width:grid.max[0]-grid.min[0],depth:grid.max[1]-grid.min[1]}, solids.map(c=>({x:(c.aabb.min[0]+c.aabb.max[0])/2,z:(c.aabb.min[2]+c.aabb.max[2])/2,y:1,halfX:(c.aabb.max[0]-c.aabb.min[0])/2,halfZ:(c.aabb.max[2]-c.aabb.min[2])/2,halfY:1})), .45, {x:(grid.max[0]+grid.min[0])/2,z:(grid.max[1]+grid.min[1])/2},(x,z)=>grid.walkable([x,z]));
const from = l3Anchors['l3-start'], to = l3Anchors['l3-zone'], cells: number[] = [];
if (!nav.path(nav.nearestCell(...from, .4), nav.nearestCell(...to, .4), cells, 100000)) throw new Error('L3 zone unreachable');
const route = cells.map(i => [nav.x(i), nav.z(i)]);
const smooth = [route[0]];
for(let i=0;i<route.length-1;) {
  let next=i+1;
  for(let k=route.length-1;k>i;k--) if(nav.visible({x:route[i][0],z:route[i][1]},{x:route[k][0],z:route[k][1]},.45)) {next=k;break;}
  smooth.push(route[next]);i=next;
}
const smoothedLengthM=smooth.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-smooth[i][0],p[1]-smooth[i][1]),0);
const distances = [0];
for (let i = 1; i < route.length; i++) distances.push(distances[i-1] + Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]));
const encounters = l3.density.groups.flatMap(groups => groups.flatMap(([x,street]) => (x > 128 ? [0] : [0,-24,-12,12,24]).map(offset => [x+offset,l3.map.streets[street]])));
const corridorStart = route.findIndex(p=>p[0] >= -126);
const encounterDistances = encounters.map(p => { let best = Infinity, at = 0; route.forEach((q,i) => { const d = Math.hypot(p[0]-q[0],p[1]-q[1]); if (d < best) { best=d; at=distances[i]; } }); return { at, distance: best }; }).filter(p => p.distance <= 12).sort((a,b)=>a.at-b.at);
const encounterPositions=[distances[corridorStart],...encounterDistances.filter(p=>p.at>=distances[corridorStart]).map(p=>p.at),distances.at(-1)!];
const gaps = encounterPositions.slice(1).map((at,i)=>at-encounterPositions[i]);
const report = { label, smoothedLengthM, smooth, lengthM: distances.at(-1), route, encounterDistances, maxEncounterGapM: Math.max(...gaps), start: from, end: to };
const out = 'docs/reports/l3-route'; mkdirSync(out,{recursive:true}); writeFileSync(`${out}/${label}.json`,JSON.stringify(report,null,2));
const x0 = Math.min(...layout.bounds.map(p=>p[0])), x1=Math.max(...layout.bounds.map(p=>p[0]));
const rect = (x:number,z:number,w:number,h:number,color:string)=>`<rect x="${x}" y="${z}" width="${w}" height="${h}" fill="${color}"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="440" viewBox="${x0-8} -60 ${x1-x0+16} 110"><rect x="${x0-8}" y="-60" width="${x1-x0+16}" height="110" fill="#19242b"/>${layout.roads.edges.map(e=>`<polyline points="${e.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#657079" stroke-width="${e.laneWidth+4}"/>`).join('')}${solids.map(c=>rect(c.aabb.min[0],c.aabb.min[2],c.aabb.max[0]-c.aabb.min[0],c.aabb.max[2]-c.aabb.min[2],c.id.includes('roadblock')?'#ef8555':'#899184')).join('')}<polyline points="${route.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#ffe773" stroke-width="1.2"/>${encounters.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="1.6" fill="#d85868"/>`).join('')}<text x="${x0}" y="-51" font-size="5" fill="white">L3 ${label}: ${distances.at(-1)!.toFixed(1)} m · yellow: walkable route · red: encounter anchors · orange: wreck blockades</text></svg>`;
writeFileSync(`${out}/${label}.svg`,svg);console.log(JSON.stringify({...report,route:route.length,encounterDistances:encounterDistances.length}));
