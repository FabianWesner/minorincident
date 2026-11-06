import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import type {FixtureReceipt} from './fixtures';
import {atomicJson,reportRoot} from './report';
import {evidenceIsArchivedOrMatches} from './reviews';
import {l7Corridor} from '../../../src/levels/L7/corridor';
type Point={x:number;y?:number;z:number};
type Entity={id:number;archetype:string;hp:number;hidden:boolean;pending:boolean;position:Point};
type Human={id:number;hp:number;hidden:boolean;infected:boolean;position:Point};
type Event={type:string;tick:number;sourceId?:number;targetId?:number;actionId?:string;position?:Point;radius?:number};
type Hashed={file:string;sha256:string};
type Tick={tick:number;final:Entity[];humans:Human[];bus:Entity;departure:{phase:string;startedAt:number};camera:unknown};
export type L7CorridorInput={sourceHash:string;observerHash:string;browserHash:string;toolSha256:string;seed:Hashed;setup:{initial:Entity[];quality:string;backend:string;incomingIds:number[];driverDetached:boolean};result:{initial:Entity[];events:Event[];ticks:Tick[];inputs:{tick:number;nativeDriver:boolean;mouseAttack:boolean}[];crossed:(Human&{tick:number})[];finish:{tick:number;bus:Entity;departure:{phase:string;startedAt:number}};final:{phase:string}};commands:{tick:number;keys:string[];mouseDown:boolean;recovery:boolean}[];captures:(Hashed&{label:string;zoom:number})[];errors:string[]};
type Review={sourceHash:string;browserHash:string;toolSha256:string;inputSha256:string;captures:(Hashed&{seen:string})[];sheets:Hashed[];rawCleanup:{allPersonallyReviewed:boolean;verifiedAndDeleted:number}};
const inCorridor=(p:Point)=>p.x>=l7Corridor.x[0]&&p.x<=l7Corridor.x[1]&&p.z>=l7Corridor.z[0]&&p.z<=l7Corridor.z[1];
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z),root='docs/reports/sweep-c5/L7-08';
export function readCorridor(tier:string,sourceHash:string,browserHash:string):{a:L7CorridorInput;v:Review;seen:boolean;ip:string;rp:string}|undefined{
 const ip=`${root}/${tier}-physical.json.gz`,rp=`${root}/${tier}-review.json`;if(!existsSync(ip)||!existsSync(rp))return;const raw=gunzipSync(readFileSync(ip)),a=JSON.parse(raw.toString()) as L7CorridorInput,v=JSON.parse(readFileSync(rp,'utf8')) as Review;
 const tools=['tools/qa/accept/sweep-c5-l7-corridor.mjs',`${root}/remote-census-producer.mjs`].map(p=>sha(readFileSync(p)));
 if(a.sourceHash!==sourceHash||a.browserHash!==browserHash||!tools.includes(a.toolSha256)||v.sourceHash!==sourceHash||v.browserHash!==browserHash||v.toolSha256!==a.toolSha256||v.inputSha256!==sha(raw))return;
 const seen=v.rawCleanup.allPersonallyReviewed&&v.rawCleanup.verifiedAndDeleted===a.captures.length&&v.captures.length===a.captures.length&&v.sheets.length>0&&v.sheets.every(s=>evidenceIsArchivedOrMatches(s.file,s.sha256))&&a.captures.every(c=>v.captures.some(v=>v.file===c.file&&v.sha256===c.sha256&&v.seen.trim()));return{a,v,seen,ip,rp};
}
export function l7CorridorReceipts(sourceHash:string,observerHash:string,browserHash:string):{path:string;receipt:FixtureReceipt}[]{
 const np=`${root}/native-current.json.gz`;if(!existsSync(np))return[];const native=JSON.parse(gunzipSync(readFileSync(np)).toString()) as {sourceHash:string;observerHash:string;toolSha256:string;rows:{tier:string;initial:Entity[];controlIdentical:boolean}[]};
 if(native.sourceHash!==sourceHash||native.observerHash!==observerHash||native.toolSha256!==sha(readFileSync('tools/qa/accept/fix55-l7-corridor.ts')))return[];
 const count=(rows:Entity[],tier:string)=>rows.filter(e=>e.archetype==='infected.runner'&&e.hp===60&&!e.hidden&&!e.pending).length>=(tier==='low'?60:120)&&rows.filter(e=>e.archetype==='infected.alpha'&&e.hp===300&&!e.hidden&&!e.pending).length>=2,results=[];
 for(const tier of ['low','high'] as const){const cell=readCorridor(tier,sourceHash,browserHash);if(!cell)continue;const {a,seen,ip,rp}=cell,r=a.result,n=native.rows.find(r=>r.tier===tier),regulars=a.setup.initial.filter(e=>e.archetype==='infected.runner').length,alphas=a.setup.initial.filter(e=>e.archetype==='infected.alpha').length;
  const census=!!n?.controlIdentical&&count(n.initial,tier)&&count(a.setup.initial,tier)&&JSON.stringify(a.setup.initial)===JSON.stringify(r.initial);
  const input=a.setup.driverDetached&&r.inputs.length===r.finish.tick&&r.inputs.every((f,i)=>f.tick===i&&!f.nativeDriver)&&a.commands.some(c=>c.mouseDown&&c.keys.includes('ShiftLeft'))&&existsSync(a.seed.file)&&sha(readFileSync(a.seed.file))===a.seed.sha256;
  const kills=r.events.filter(e=>e.type==='combat.kill'&&e.sourceId===1&&e.actionId==='weapon.rocket-launcher'&&a.setup.initial.some(i=>i.id===e.targetId));
  const blasts=r.events.filter(e=>e.type==='explosion'&&e.sourceId===1&&e.position&&inCorridor(e.position)&&e.radius&&kills.some(k=>k.tick===e.tick&&k.position&&distance(k.position,e.position!)<=e.radius!+.01));
  const uses:{id:number;blastTick:number;passageTick:number;crossingTick:number;nearestLivingFinal:number|null}[]=[];
  for(const cross of r.crossed){if(cross.hidden||cross.infected||cross.hp<=0||cross.position.x>=-68||!a.setup.incomingIds.includes(cross.id))continue;
   for(const blast of blasts){let used=false;for(const s of r.ticks){if(s.tick<=blast.tick||s.tick>cross.tick)continue;const h=s.humans.find(h=>h.id===cross.id&&h.hp>0&&!h.hidden&&!h.infected);if(!h||!inCorridor(h.position)||distance(h.position,blast.position!)>blast.radius!-.35)continue;
     const unknown=a.setup.initial.some(e=>!s.final.some(f=>f.id===e.id)&&!r.events.some(k=>k.type==='combat.kill'&&k.targetId===e.id&&k.tick<=s.tick));if(unknown)continue;
     const distances=s.final.filter(e=>e.hp>0&&!e.hidden&&!e.pending).map(e=>distance(h.position,e.position)-(e.archetype==='infected.alpha'?.55:.35)),nearest=distances.length?Math.min(...distances):null;
     if(nearest!==null&&nearest<=.35)continue;uses.push({id:h.id,blastTick:blast.tick,passageTick:s.tick,crossingTick:cross.tick,nearestLivingFinal:nearest});used=true;break;
    }if(used)break;
   }
  }
  const reviewed=seen&&['corridor-mouth','rocket-gap','survivor-crossing'].every(label=>[.5,1.5].every(z=>a.captures.some(c=>c.label===label&&c.zoom===z))),valid=a.setup.quality===tier&&a.setup.backend==='webgl'&&!a.errors.length;
  const checks:FixtureReceipt['checks']=[{id:'L7-08',clause:'initial admitted final horde census with canonical control',tier,policy:'physical-corridor',status:valid&&census?'PASS':'FAIL',value:{census,regulars,alphas,namedCoreRegulars:a.setup.initial.filter(e=>e.archetype==='infected.runner'&&inCorridor(e.position)).length,namedCoreAlphas:a.setup.initial.filter(e=>e.archetype==='infected.alpha'&&inCorridor(e.position)).length,canonicalControl:n?.controlIdentical},target:'At least60/120full-health admitted regulars and2Alphas in initial finalgroup; physical and independent unchanged canonical controls. Exact O-review judges initial crowded corridor view.',receipt:np},
   {id:'L7-08',clause:'physical rocket-cleared disc used by living carried human',tier,policy:'physical-corridor',status:valid&&input&&uses.length>0?'PASS':'FAIL',value:{input,rocketCohortKills:kills.length,qualifyingBlasts:blasts.length,uses},target:'Inside authored corridor bounds, actual ShiftLMB rocket kills original finalgroup actor inside blast; same actual carried healthy human walks through body-clear interior of that blast disc then crosses west beyondx-68. Missing actors never assumed dead; every input is physical, no native driver ticks.',receipt:ip},
   {id:'L7-08',clause:'reviewed physical corridor strips',tier,policy:'physical-corridor',status:valid&&reviewed?'PASS':'FAIL',value:{valid,seen,reviewed},target:'Every capture digest/seen note checked; paired actual approach, confirmed rocket-kill and survivor-crossing strips. Remote census and cinematic camera override limitations explicit in exact O-review.',receipt:rp}];
  const path=`${reportRoot}/receipts/L7-${tier}-corridor-browser.json`,receipt:FixtureReceipt={version:1,level:'L7',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],observations:{root},checks};atomicJson(path,receipt);results.push({path,receipt});
 }
 return results;
}
