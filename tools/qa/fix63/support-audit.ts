/** Correlate the prior reviewed wall-body witnesses with the current unchanged ramp support geometry. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { loadL3 } from '../../sim-runner/l3Bots';
import { highwayPoint } from '../../../src/levels/L3/highway';
const file=process.argv[2] ?? 'docs/reports/fix62-a/L3-13-browser.json.gz';
const output=process.argv[3] ?? 'docs/reports/fix63-a/L3-13-support-audit.json';
type Point={x:number;y:number;z:number};
type Frame={label:string;zoom:number;state:{actors:{id:number;hp:number;hidden:boolean;at:Point}[];figures:{id:number;drawn:boolean;feet:[number,number,number][]}[]}};
const evidence=JSON.parse((file.endsWith('.gz') ? gunzipSync(readFileSync(file)) : readFileSync(file)).toString()) as {sourceHash:string;runs:{tier:string;frames:Frame[]}[]};
const {world}=await loadL3(1,'high');
try {
 const district=world.districts!.districts.find(d=>d.id==='D-CORRIDOR')!;
 const ramp=district.decay.placements.filter(p=>p.assetId==='kit.highway-onramp').sort((a,b)=>a.position[0]-b.position[0])[0];
 const centre=Array.from({length:2401},(_,i)=>highwayPoint(ramp,i/2400));
 const nearest=(x:number,z:number)=>{
  let best=Infinity,point=centre[0];
  for(const p of centre){const d=(p[0]-x)**2+(p[2]-z)**2;if(d<best){best=d;point=p;}}
  return {distanceM:Math.sqrt(best),roadY:point[1]};
 };
 const rows=[];
 for(const run of evidence.runs)for(const frame of run.frames){
  if(frame.zoom!==1.5||!['x144','x150','x156','settled-10s'].includes(frame.label))continue;
  for(const a of frame.state.actors){
   if(a.hp<=0||a.hidden||a.at.x<143||a.at.x>167.5)continue;
   const root=nearest(a.at.x,a.at.z),figures=frame.state.figures.filter(f=>f.id===a.id&&f.drawn);
   const feet=figures.flatMap(f=>f.feet).map(([x,y,z])=>({x,y,z,...nearest(x,z),groundHeight:world.districts!.groundHeight(x,z),verticalGapM:y-world.districts!.groundHeight(x,z)}));
   const supports=district.decay.colliders.filter(c=>c.walkable&&c.aabb.min[0]<=a.at.x&&c.aabb.max[0]>=a.at.x&&c.aabb.min[2]<=a.at.z&&c.aabb.max[2]>=a.at.z).map(c=>({id:c.id,top:c.aabb.max[1]}));
   rows.push({tier:run.tier,frame:frame.label,id:a.id,at:a.at,root,groundHeight:world.districts!.groundHeight(a.at.x,a.at.z),outside:root.distanceM>2.31||feet.some(f=>f.distanceM>2.31),supports,feet});
  }
 }
 writeFileSync(output,JSON.stringify({method:'Supplied actor/foot ledger correlated with the current highway formula and native support AABBs. Geometry diagnosis supplements the separately reviewed physical traversal frames.',file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),observedSourceHash:evidence.sourceHash,ramp:{id:ramp.id,position:ramp.position,yaw:ramp.yaw},deckHalfWidthM:2.31,rows},null,2)+'\n');
 console.log('Audited',rows.length,'root/foot witnesses; outside',rows.filter(r=>r.outside).length, 'roots outside',rows.filter(r=>r.root.distanceM>2.31).length);
}finally{world.dispose();}
