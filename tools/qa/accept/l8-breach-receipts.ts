import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import type {FixtureReceipt} from './fixtures';
import {atomicJson,reportRoot} from './report';
import {evidenceIsArchivedOrMatches} from './reviews';
type Hashed={file:string;sha256:string};
type Point={x:number;z:number};
type Actor={id:number;outlet:number;tick:number;hp:number;hidden?:boolean;pending?:object;emerging?:boolean;position:Point;drawn:boolean};
type Outlet=Point&{house:string;nx:number;nz:number};
type Cell={tier:string;outletIndex:number;outlet:Outlet;completed:boolean;errors:string[];setup:{backend:string;quality:string;outlets:Outlet[]};goals:Point[];commands:{keys:string[]}[];captures:(Hashed&{tick:number;zoom:number})[];samples:{tick:number;position:Point;breached:boolean;arrivals:{id:number;outlet:number;tick:number}[];doors:[string,{at:number}][];tunnelActors:Actor[]}[]};
export function l8BreachReceipts(sourceHash:string,browserHash:string):{path:string;receipt:FixtureReceipt}[]{
 const root='docs/reports/sweep-c5/L8-04',sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),tool=sha(readFileSync('tools/qa/accept/sweep-c5-l8-breach.mjs')),results=[];
 for(const tier of ['low','high'] as const){
  const checks:FixtureReceipt['checks']=[];
  for(let index=0;index<4;index++){
   const ip=`${root}/${tier}-${index}-physical.json.gz`,rp=`${root}/${tier}-${index}-review.json`;if(!existsSync(ip)||!existsSync(rp))continue;
   const raw=gunzipSync(readFileSync(ip)),proof=JSON.parse(raw.toString()) as {sourceHash:string;browserHash:string;toolSha256:string;rows:Cell[]},review=JSON.parse(readFileSync(rp,'utf8')) as {sourceHash:string;browserHash:string;toolSha256:string;inputSha256:string;captures:(Hashed&{seen:string})[];sheets:Hashed[];rawCleanup:{verifiedAndDeleted:number;allPersonallyReviewed:boolean}};
   if(proof.sourceHash!==sourceHash||proof.browserHash!==browserHash||proof.toolSha256!==tool||review.sourceHash!==sourceHash||review.browserHash!==browserHash||review.toolSha256!==tool||review.inputSha256!==sha(raw))continue;
   const r=proof.rows[0];if(!r||r.tier!==tier||r.outletIndex!==index)continue;
   const before=r.samples.find(s=>s.tick===3540),start=r.samples.find(s=>s.tick===3600),end=r.samples.at(-1),o=r.outlet;
   const sampled=r.samples.length===691&&r.samples.every((s,i)=>s.tick===(i<=590?i*6:3540+(i-590)*3));
   const ready=!!before&&Math.hypot(before.position.x-r.goals[0].x,before.position.z-r.goals[0].z)<.65;
   const points=r.setup.outlets,distances=points.flatMap((a,i)=>points.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z)));
   const packet=start?.arrivals??[],packetPass=packet.length===(tier==='low'?12:24)&&points.length===4&&distances.every(d=>d>=20)&&[0,1,2,3].every(n=>packet.filter(a=>a.outlet===n&&a.tick===3600).length===(tier==='low'?3:6));
   const own=packet.filter(a=>a.outlet===index),first=new Map<number,{tick:number;s:number}>(),previous=new Map<number,{tick:number;actor:Actor}>();let maxStep=0,moves=0;
   for(const s of r.samples)for(const e of s.tunnelActors.filter(a=>a.outlet===index)){
    if(!e.hidden&&!e.pending&&e.hp>0&&!first.has(e.id))first.set(e.id,{tick:s.tick,s:(e.position.x-o.x)*o.nx+(e.position.z-o.z)*o.nz});
    const p=previous.get(e.id);if(p&&p.actor.emerging&&e.emerging){maxStep=Math.max(maxStep,Math.hypot(e.position.x-p.actor.position.x,e.position.z-p.actor.position.z));moves++;}previous.set(e.id,{tick:s.tick,actor:e});
   }
   const birth=start?.tunnelActors.filter(e=>e.outlet===index)??[];
   const entry=own.length>0&&birth.length===own.length&&birth.every(e=>(e.position.x-o.x)*o.nx+(e.position.z-o.z)*o.nz<0)&&first.size===own.length&&[...first.values()].every(f=>f.s<0)&&moves>100&&maxStep<=1&&!!start?.doors.some(([id,d])=>id===`door-${o.house}`&&d.at===3600);
   const seen=review.rawCleanup.allPersonallyReviewed&&review.rawCleanup.verifiedAndDeleted===12&&review.captures.length===12&&review.sheets.length===2&&review.sheets.every(s=>evidenceIsArchivedOrMatches(s.file,s.sha256))&&r.captures.length===12&&r.captures.every(c=>review.captures.some(v=>v.file===c.file&&v.sha256===c.sha256&&v.seen.trim()));
   const pass=r.completed&&!r.errors.length&&r.setup.backend==='webgl'&&r.setup.quality===tier&&r.commands.some(c=>c.keys.length>0)&&sampled&&ready&&packetPass&&entry&&seen&&end?.tick===3840&&r.samples.every(s=>s.breached===(s.tick>=3600));
   checks.push({id:'L8-04',clause:`tunnel${index} physical timed emergence and reviewed strip`,tier,policy:'physical-breach',status:pass?'PASS':'FAIL',value:{sampled,ready,packetPass,entry,seen,firstAdmitted:[...first],maxThreeTickEmergenceStepMetres:maxStep,distances,consoleErrors:r.errors},target:'actual WASD prebreach observation point; all4 packets3/6 at3600,20m separation; door opens3600; actors born/admitted behind threshold, continuous3tick emergence;12 reviewed paired frames, exact O-review judges visible-door or roof-occluded paths',receipt:rp});
  }
  if(!checks.length)continue;const path=`${reportRoot}/receipts/L8-${tier}-breach-browser.json`,receipt:FixtureReceipt={version:1,level:'L8',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],observations:{root},checks};atomicJson(path,receipt);results.push({path,receipt});
 }
 return results;
}
