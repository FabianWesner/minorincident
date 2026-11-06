import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import type {FixtureReceipt} from './fixtures';
import {atomicJson,reportRoot} from './report';
import {evidenceIsArchivedOrMatches} from './reviews';
type Actor={id:number;archetype:string;hidden?:boolean;passengerOf?:number;companion?:object;health:{current:number;max:number};transform:{x:number;z:number};vehicle?:{driver:number;passengers:{id:number;phase:string}[]}};
type Hashed={file:string;sha256:string};
type Sample={tick:number;active:number;phase:string;car:Actor;companions:Actor[];roster:{passenger:{id:number;phase:string};entity:Actor}[];view:{id:number;occupants:{actorId:number;seated:boolean}[]}[];inputs:{tick:number;drive:{throttle:number;steer:number}}[]};
type Input={sourceHash:string;browserHash:string;toolSha256:string;physical:{input:Hashed;completion:Hashed};result:{level:string;backend:string;quality:string;loading:boolean;active:number;car:Actor;physicalDeparture:{vehicle:Actor;occupants:Actor[]}};samples:Sample[];commands:{tick:number;keys:string[]}[];captures:(Hashed&{stage:string;zoom:number;state:Sample})[];errors:string[]};
type Review={sourceHash:string;browserHash:string;toolSha256:string;inputSha256:string;captures:(Hashed&{seen:string})[];sheets:Hashed[];rawCleanup:{allPersonallyReviewed:boolean;verifiedAndDeleted:number}};
export function l9ArrivalReceipts(sourceHash:string,browserHash:string):{path:string;receipt:FixtureReceipt}[]{
 const root='docs/reports/sweep-c5/L9-01',sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),results=[];
 for(const tier of ['low','high'] as const){
  const ip=`${root}/${tier}-arrival.json.gz`,rp=`${root}/${tier}-review.json`;if(!existsSync(ip)||!existsSync(rp))continue;
  const raw=gunzipSync(readFileSync(ip)),a=JSON.parse(raw.toString()) as Input,v=JSON.parse(readFileSync(rp,'utf8')) as Review;
  if(a.sourceHash!==sourceHash||a.browserHash!==browserHash||a.toolSha256!==sha(readFileSync('tools/qa/accept/sweep-c5-l9-arrival.mjs'))||v.sourceHash!==sourceHash||v.browserHash!==browserHash||v.toolSha256!==a.toolSha256||v.inputSha256!==sha(raw))continue;
  const r=a.result,initial=a.samples[0],payload=r.physicalDeparture,car=r.car,ids=payload.occupants.filter(e=>e.id!==1).map(e=>e.id).sort((a,b)=>a-b),arrived=initial?.roster.map(p=>p.entity.id).sort((a,b)=>a-b);
  const exactPayload=Object.values(a.physical).every(p=>existsSync(p.file)&&sha(readFileSync(p.file))===p.sha256);
  const carry=car.id===payload.vehicle.id&&car.health.current===payload.vehicle.health.current&&JSON.stringify(ids)===JSON.stringify(arrived)&&payload.occupants.every(e=>e.id===1||initial.roster.some(p=>p.entity.id===e.id&&p.entity.archetype===e.archetype&&p.passenger.phase==='seated'));
  const start=initial?.car.transform,firstMotion=a.samples.find(s=>s.tick<=30&&Math.hypot(s.car.transform.x-start.x,s.car.transform.z-start.z)>.001),input=a.samples.flatMap(s=>s.inputs).find(f=>f.drive.throttle>0);
  const control=initial?.tick===0&&initial.active===car.id&&car.vehicle?.driver===1&&!r.loading&&input?.tick===0&&!!firstMotion&&firstMotion.tick<=30&&a.samples.slice(0,31).every((s,i)=>s.tick===i);
  const hidden=a.samples.length===181&&a.samples.every(s=>s.phase==='driving'&&s.companions.length===1&&s.companions.every(d=>d.hidden&&d.passengerOf===car.id&&s.roster.some(p=>p.entity.id===d.id&&p.passenger.phase==='seated')&&s.view.every(v=>v.occupants.every(o=>o.actorId!==d.id))));
  const seated=a.captures.every(c=>c.state.view.some(v=>v.id===car.id&&v.occupants.some(o=>o.actorId===1&&o.seated)));
  const seen=v.rawCleanup.allPersonallyReviewed&&v.rawCleanup.verifiedAndDeleted===14&&v.captures.length===14&&v.sheets.length===2&&v.sheets.every(s=>evidenceIsArchivedOrMatches(s.file,s.sha256))&&a.captures.length===14&&['arrival','first-half-second','drive-300','drive-420','drive-600','drive-720','drive-900'].every(stage=>[.5,1.5].every(z=>a.captures.some(c=>c.stage===`${stage}-z${z}`&&c.zoom===z&&v.captures.some(v=>v.file===c.file&&v.sha256===c.sha256&&v.seen.trim()))));
  const pass=exactPayload&&carry&&control&&hidden&&seated&&seen&&!a.errors.length&&r.level==='L9'&&r.backend==='webgl'&&r.quality===tier&&a.commands.some(c=>c.keys.includes('KeyW'));
  const checks:FixtureReceipt['checks']=[{id:'L9-01',clause:'physical carried start control and reviewed occupants',tier,policy:'real-input-webgl2',status:pass?'PASS':'FAIL',value:{exactPayload,carry,control,firstInputTick:input?.tick,firstMotionTick:firstMotion?.tick,hidden,seated,seen,carId:car.id,hp:car.health.current,passengerIds:arrived,errors:a.errors},target:'exact physical L8 payload; throttle available tick0 and firstmotion≤30ticks; normal seated driver/corgi lifecycle and14 reviewed paired-zoom cab frames, exact O-review supplies visible no-clipping judgement',receipt:rp}];
  const path=`${reportRoot}/receipts/L9-${tier}-arrival-browser.json`,receipt:FixtureReceipt={version:1,level:'L9',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],observations:{root},checks};atomicJson(path,receipt);results.push({path,receipt});
 }
 return results;
}
