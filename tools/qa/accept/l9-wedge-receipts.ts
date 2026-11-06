import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import type {FixtureReceipt} from './fixtures';
import {atomicJson,reportRoot} from './report';
import {evidenceIsArchivedOrMatches} from './reviews';
import {l9StreamReceipts} from './l9-stream-receipts';
type Hashed={file:string;sha256:string};
type Sample={tick:number;position:{x:number;z:number;yaw:number};speed:number;hp:number;hud:string;stage?:string;target?:string};
type Challenge={target:{id:string;x:number;z:number};contact:Sample;escaped:boolean;escape:Sample;attempts:{keys:string[];before:Sample;after:Sample}[]};
type Proof={sourceHash:string;browserHash:string;toolSha256:string;rows:{tier:string;setup:{backend:string;quality:string};challenges:Challenge[];samples:Sample[];commands:{tick:number;keys:string[]}[];captures:(Hashed&{label:string;zoom:number;state:Sample})[];errors:string[]}[]};
type Review={sourceHash:string;browserHash:string;toolSha256:string;inputSha256:string;captures:(Hashed&{seen:string})[];sheets:Hashed[];rawCleanup:{allPersonallyReviewed:boolean;verifiedAndDeleted:number}};
export function l9WedgeReceipts(sourceHash:string,observerHash:string,browserHash:string):{path:string;receipt:FixtureReceipt}[]{
 const root='docs/reports/sweep-c5/L9-06',sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),results=[],stream=l9StreamReceipts(sourceHash,observerHash,browserHash).flatMap(r=>r.receipt.checks);
 for(const tier of ['low','high'] as const){
  const ip=`${root}/${tier}-physical.json.gz`,rp=`${root}/${tier}-review.json`;if(!existsSync(ip)||!existsSync(rp))continue;const raw=gunzipSync(readFileSync(ip)),a=JSON.parse(raw.toString()) as Proof,v=JSON.parse(readFileSync(rp,'utf8')) as Review,r=a.rows[0];
  if(a.sourceHash!==sourceHash||a.browserHash!==browserHash||![sha(readFileSync('tools/qa/accept/sweep-c5-l9-wedge.mjs')),sha(readFileSync(`${root}/producer.mjs`))].includes(a.toolSha256)||v.sourceHash!==sourceHash||v.browserHash!==browserHash||v.toolSha256!==a.toolSha256||v.inputSha256!==sha(raw))continue;
  const ids=['prop.tent:2455','veh.school-bus:2427','kit.army-checkpoint:2454'];
  const recoveries=r&&r.challenges.length===3&&ids.every(id=>{const c=r.challenges.find(c=>c.target.id===id);if(!c?.contact||!c.escape||!c.escaped)return false;const approach=r.samples.filter(s=>s.stage==='approach'&&s.target===id).slice(-20),press=r.samples.filter(s=>s.stage==='press-contact'&&s.target===id),attempt=c.attempts[0];return approach.length===20&&approach.every(s=>Math.abs(s.speed)<.5&&Math.hypot(s.position.x-c.target.x,s.position.z-c.target.z)<12)&&press.length===40&&c.contact.tick-approach.at(-1)!.tick===240&&c.attempts.length===1&&attempt.keys.join(',')==='KeyS'&&c.escape.tick-c.contact.tick<=300&&(c.escape.position.x-c.contact.position.x)*Math.cos(c.contact.position.yaw)-(c.escape.position.z-c.contact.position.z)*Math.sin(c.contact.position.yaw)<=-8&&Math.hypot(c.escape.position.x-c.contact.position.x,c.escape.position.z-c.contact.position.z)>=8&&r.commands.some(cmd=>cmd.tick===c.contact.tick&&cmd.keys.join(',')==='KeyS');});
  const seen=v.rawCleanup.allPersonallyReviewed&&v.rawCleanup.verifiedAndDeleted===12&&v.captures.length===12&&v.sheets.length===2&&v.sheets.every(s=>evidenceIsArchivedOrMatches(s.file,s.sha256))&&r?.captures.length===12&&ids.every(id=>['contact','escaped'].every(stage=>[.5,1.5].every(z=>r.captures.some(c=>c.label===`${id}-${stage}`&&c.zoom===z&&v.captures.some(v=>v.file===c.file&&v.sha256===c.sha256&&v.seen.trim())))));
  const hud=r?.captures.every(c=>c.state.hud===`Armor ${c.state.hp} / 1000`),valid=r?.tier===tier&&r.setup.backend==='webgl'&&r.setup.quality===tier&&!r.errors.length,routeChecks=stream.filter(c=>c.tier===tier&&c.clause.endsWith('physical streaming residency and continuous input')),routes=routeChecks.length===3&&routeChecks.every(c=>c.status==='PASS');
  const checks:FixtureReceipt['checks']=[{id:'L9-06',clause:'six authored physical routes remain driveable',tier,policy:'physical-wedge',status:routes?'PASS':'FAIL',value:routeChecks.map(c=>({clause:c.clause,status:c.status})),target:'All three current physical authored detours per tier reach bridge, normal AI/physics, no actor writes or skips',receipt:'docs/reports/sweep-c5/L9-09/coverage-proof.json'},
   {id:'L9-06',clause:'three physical offroad stall and reverse recoveries',tier,policy:'physical-wedge',status:valid&&recoveries?'PASS':'FAIL',value:{valid,recoveries,cases:r?.challenges.map(c=>({id:c.target.id,escaped:c.escaped,reverseTicks:c.escape?.tick-c.contact?.tick}))},target:'Physical offroad approaches to existing tent/bus/checkpoint corners, ≥20six-tick stalled samples<0.5m/s, foursecond forward press, ordinary reverse clears≥8m within5s; no placement/teleport',receipt:ip},
   {id:'L9-06',clause:'reviewed world arrow absence and exact durability HUD',tier,policy:'physical-wedge',status:valid&&seen&&hud?'PASS':'FAIL',value:{valid,seen,hud},target:'All12pairedPOzoom panels inspected, no giant flat world arrow above APC; live HUD text and bar match exact health; exact O-review supplies visible judgement',receipt:rp}];
  const path=`${reportRoot}/receipts/L9-${tier}-wedge-browser.json`,receipt:FixtureReceipt={version:1,level:'L9',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],observations:{root},checks};atomicJson(path,receipt);results.push({path,receipt});
 }
 return results;
}
