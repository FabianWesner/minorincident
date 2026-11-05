import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { NavGrid } from '../../../src/sim/ai/NavGrid';
import { PathProbe } from '../threat/observer';
import { provenance } from './probe';
import { atomicJson } from './report';
const identity=provenance(),rows=[];
for(const tier of ['low','high'] as const){
 const campaign=preset('L8-default');campaign.settings.quality=tier;
 const world=await loadLevel('L8',1,campaign,0,{quality:tier});
 try{
  const district=world.districts!.districts.find(d=>d.id==='D-ZOO')!,source=world.infected!.nav;
  const grid=source.withClearance(1.25),paths=new PathProbe(),player=structuredClone(world.entities.get(1)!);
  player.combat={...player.combat!,radius:1.25};
  const anchor=(name:string)=>{const p=district.layout.anchors[name].position;return {x:p[0]+district.origin[0],z:p[2]+district.origin[1]};};
  const enclosureRows=[];
  for(const species of ['lion','gorilla','elephant','zebra','flamingo']){
   const center=anchor(`enclosure-${species}`),gates=[];
   for(const direction of ['north','south']){
    const gate=anchor(`${species}-gate-${direction}`),sign=Math.sign(gate.z-center.z),inside={x:gate.x,z:gate.z-sign*3},outside={x:gate.x,z:gate.z+sign*3};
    const start={...center};let startAdjustment=0;
    if(!grid.clear(start.x,start.z,1.25))for(let radius=.5;radius<=3;radius+=.5){let found=false;for(let i=0;i<16;i++){const p={x:center.x+Math.cos(i*Math.PI/8)*radius,z:center.z+Math.sin(i*Math.PI/8)*radius};if(grid.clear(p.x,p.z,1.25)){Object.assign(start,p);startAdjustment=radius;found=true;break;}}if(found)break;}
    const local=new NavGrid(source.ground,source.walls,1.25,source.center,(x,z)=>Math.abs(x-center.x)<=19&&Math.abs(z-center.z)<=19);
    const actorAt=(at:{x:number;z:number})=>({...player,transform:{...player.transform,...at}});
    const interior=paths.distance(local,actorAt(start),inside),escape=paths.distance(grid,actorAt(outside),world.missions!.def.anchors.exit);
    const crossing=grid.visible(inside,outside,1.25),endpoints=[start,inside,outside].every(p=>grid.clear(p.x,p.z,1.25));
    // An inserted full gate-width slab must invalidate this explicit crossing.
    const blocked=new NavGrid(source.ground,[...source.walls,{x:gate.x,z:gate.z,y:1,halfX:5,halfZ:.5,halfY:1}],1.25,source.center);
    const negativeBlocked=!blocked.visible(inside,outside,1.25);
    gates.push({direction,gate,start,startAdjustment,inside,outside,endpoints,crossing,interiorMetres:Number.isFinite(interior)?interior:null,escapeMetres:Number.isFinite(escape)?escape:null,negativeBlocked,pass:endpoints&&crossing&&Number.isFinite(interior)&&Number.isFinite(escape)&&negativeBlocked});
   }
   enclosureRows.push({species,center,gates,pass:gates.every(gate=>gate.pass)});
  }
  rows.push({tier,clearanceRadius:1.25,enclosures:enclosureRows,pass:enclosureRows.every(row=>row.pass)});
 }finally{world.dispose();}
}
atomicJson('docs/reports/fix55-c/L8-enclosure-paths.json',{...identity,toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'Read-only path queries on separate copies of actual low/high navigation. Each enclosure has distinct north/south gates: interior paths constrained inside enclosure, explicit6m gate crossing at1.25m radius, then body-clear path from outside to actual fixed APC marker. Start anchor adjustment≤3m recorded if occupied. Inserting a slab at either gate must block its explicit crossing. Does not move actors or measure rendered visibility.',rows});
console.log(rows.map(row=>({tier:row.tier,pass:row.pass,enclosures:row.enclosures.map(e=>({species:e.species,pass:e.pass}))})));
export type L8PathProof={sourceHash:string;observerHash:string;toolSha256:string;rows:typeof rows};
