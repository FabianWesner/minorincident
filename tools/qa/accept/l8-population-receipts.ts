import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';
type Hashed={file:string;sha256:string};
type Person={id:number;archetype:string;species:string|null;role:string|null;carried:boolean;hp:number};
type Native={sourceHash:string;toolSha256:string;rows:{tier:string;mode:string;original:Person[];fixture:{id:number;before:{x:number;z:number}}[];activity:{id:number;maximum:number;hostileTicks:number;maximumIdleFacingNowhereSeconds:number}[];samples:{tick:number;fixture:{id:number;hp:number;hidden:boolean;pending:boolean;position:{x:number;z:number}}[];locals:{id:number}[]}[];crossed:number;missing:number;dead:number;hits:object[];finalHash:string;controlHash:string|null}[]};
type Figure={id:number;clip:string;phase:number;drawn:boolean};
type Physical={sourceHash:string;browserHash:string;toolSha256:string;rows:{tier:string;completed:boolean;errors:string[];setup:{backend:string;quality:string};samples:{tick:number;breached:boolean;figures:Figure[];activities:{id:number;archetype:string;species?:string;survivor:boolean}[]}[];commands:{keys:string[]}[];captures:Hashed[]}[]};
export function l8PopulationReceipts(sourceHash:string,browserHash:string):{path:string;receipt:FixtureReceipt}[]{
 const root='docs/reports/sweep-c5/L8-03',rp=`${root}/review.json`;if(!existsSync(rp))return[];
 const review=JSON.parse(readFileSync(rp,'utf8')) as {sourceHash:string;browserHash:string;producerSha256:string;inputs:Hashed[];native:Hashed;captures:(Hashed&{seen:string})[];sheets:Hashed[];rawCleanup:{verifiedAndDeleted:number;allPersonallyReviewed:boolean}};
 const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 const read=(ref:Hashed)=>{const b=readFileSync(ref.file);if(sha(b)!==ref.sha256)throw new Error(`L8 population digest: ${ref.file}`);return gunzipSync(b).toString();};
 if(review.sourceHash!==sourceHash||review.browserHash!==browserHash||review.producerSha256!==sha(readFileSync('tools/qa/accept/sweep-c5-l8-calm.mjs')))return[];
 const native=JSON.parse(read(review.native)) as Native;if(native.sourceHash!==sourceHash||native.toolSha256!==sha(readFileSync('tools/qa/accept/sweep-c5-l8-population.ts')))return[];
 const inputs=review.inputs.map(ref=>JSON.parse(read(ref)) as Physical);
 if(inputs.some(p=>p.sourceHash!==sourceHash||p.browserHash!==browserHash||p.toolSha256!==review.producerSha256))return[];
 const seen=review.rawCleanup.allPersonallyReviewed&&review.rawCleanup.verifiedAndDeleted===review.captures.length&&review.captures.length===20&&review.captures.every(c=>c.seen.trim()&&/^[a-f0-9]{64}$/.test(c.sha256))&&review.sheets.length===4&&review.sheets.every(s=>evidenceIsArchivedOrMatches(s.file,s.sha256));
 const results=[];
 for(const tier of ['low','high'] as const){
  const natural=native.rows.find(r=>r.tier===tier&&r.mode==='natural'),outside=native.rows.find(r=>r.tier===tier&&r.mode==='outside'),physical=inputs.flatMap(p=>p.rows).find(r=>r.tier===tier);
  if(!natural||!outside||!physical)continue;
  const locals=natural.original.filter(e=>!e.carried),animals=locals.filter(e=>e.species),staff=locals.filter(e=>/^npc\.(zookeeper|vet|groundskeeper)$/.test(e.archetype));
  const civilians=locals.filter(e=>!e.species&&e.role!=='soldier'&&!staff.includes(e));
  const countPass=civilians.length>=20&&locals.filter(e=>e.role==='soldier').length>=6&&staff.length>=4&&animals.length>=8&&new Set(animals.map(e=>e.species)).size===5&&animals.filter(e=>e.species==='zebra').length>=2&&animals.filter(e=>e.species==='flamingo').length>=3;
  const activityPass=[natural,outside].every(r=>r.samples.at(-1)?.tick===3599&&r.activity.length===r.original.length&&r.original.every(p=>r.activity.some(a=>a.id===p.id&&a.hostileTicks===0&&a.maximum<=180&&a.maximumIdleFacingNowhereSeconds===a.maximum/60)))&&natural.finalHash===natural.controlHash&&/^[a-f0-9]{8}$/.test(natural.finalHash);
  const wallPass=outside.fixture.length===4&&new Set(outside.fixture.map(f=>f.id)).size===4&&outside.crossed===0&&outside.missing===0&&outside.dead===0&&!outside.hits.length&&outside.samples.length===60&&outside.samples.every(s=>s.fixture.length===4&&s.fixture.every(f=>f.hp>0&&!f.hidden&&!f.pending&&!(Math.abs(f.position.x)<115.6&&Math.abs(f.position.z)<85.6)));
  const last=new Map<number,{tick:number;ticks:number}>();let maxIdle=0;
  for(const sample of physical.samples)for(const f of sample.figures.filter(f=>f.drawn&&f.clip==='idle')){const before=last.get(f.id),ticks=before&&before.tick===sample.tick-6?before.ticks+6:6;last.set(f.id,{tick:sample.tick,ticks});maxIdle=Math.max(maxIdle,ticks);}
  const drawn=new Set(physical.samples.flatMap(s=>s.figures.filter(f=>f.drawn).map(f=>f.id))),meta=new Map(physical.samples.flatMap(s=>s.activities.map(a=>[a.id,a] as const))),types=[...drawn].map(id=>meta.get(id)?.archetype??'');
  const clips=physical.samples.flatMap(s=>s.figures.filter(f=>f.drawn).map(f=>f.clip));
  const renderPass=seen&&physical.completed&&!physical.errors.length&&physical.setup.backend==='webgl'&&physical.setup.quality===tier&&physical.samples.length===600&&physical.samples[0].tick===0&&physical.samples.at(-1)?.tick===3594&&physical.samples.every((s,i)=>s.tick===i*6&&!s.breached)&&physical.commands.some(c=>c.keys.length>0)&&physical.captures.length===10&&physical.captures.every(c=>review.captures.some(r=>r.file===c.file&&r.sha256===c.sha256&&r.seen.trim()))&&maxIdle<=180&&types.includes('npc.soldier')&&types.some(t=>/^npc\.(zookeeper|vet|groundskeeper)$/.test(t))&&types.includes('npc.cashier')&&types.includes('animal.lion')&&types.includes('animal.elephant')&&clips.includes('npc-look-around')&&clips.includes('walk');
  const path=`${reportRoot}/receipts/L8-${tier}-population.json`,receipt:FixtureReceipt={version:1,level:'L8',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],observations:{reviewPath:rp},checks:[]};
  const add=(clause:string,policy:string,pass:boolean,value:unknown,target:string)=>receipt.checks.push({id:'L8-03',clause,tier,policy,status:pass?'PASS':'FAIL',value,target,receipt:rp});
  add('actual calm local census and purposeful routines','calm-population',countPass&&activityPass,{civilians:civilians.length,soldiers:locals.filter(e=>e.role==='soldier').length,staff:staff.length,animals:animals.map(e=>e.species),maximumIdleSeconds:Math.max(...natural.activity.map(a=>a.maximumIdleFacingNowhereSeconds)),controlIdentical:natural.finalHash===natural.controlHash},'20local civilians,6soldiers,4staff,8animals/5species/2zebras/3flamingos; no hostile or idle-facing-nowhere>3s; exact independent natural control');
  add('outside wall pursuit cannot cross or damage occupants','calm-population',wallPass,{crossed:outside.crossed,missing:outside.missing,dead:outside.dead,hits:outside.hits.length},'four live admitted production runners outside four walls, normal pursuit3599ticks; none crosses/damages inside; no missing/dead actor masking');
  add('reviewed physical calm activity clips','real-input-calm',renderPass,{seen,drawnIds:drawn.size,drawnClasses:[...new Set(types)],maxObservedIdleSeconds:maxIdle/60,clips:[...new Set(clips)]},'actual WASD before breach,6006tick samples; rendered civilian/soldier/staff/lion/elephant; idleclip<=3s; all20pairedzoom frames reviewed');
  atomicJson(path,receipt);results.push({path,receipt});
 }
 return results;
}
