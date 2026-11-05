import { createHash } from 'node:crypto';
import { existsSync,readFileSync } from 'node:fs';
import type { FixtureReceipt } from './fixtures';
import { atomicJson,reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';
import { action } from '../../../src/data/actions/catalog';
type Point={x:number;z:number};
type Event={type:string;tick:number;sourceId?:number;actionId?:string;position?:Point;targetId?:number;amount?:number};
type Case={tier:string;kind:string;errors:string[];setup:{backend:string;quality:string};result:{point:Point;initial:{id:number;hp:number;maxHp:number;position:Point}[];final:{id:number;hp:number;position:Point;radius:number}[];inputs:{tick:number;mouseAttack:boolean;activeAttack?:boolean;aimPoint:Point|null}[];events:Event[]}};
export function fix55RocketReceipts(sourceHash:string,browserHash:string):{path:string;receipt:FixtureReceipt}[]{
 const proofPath='docs/reports/fix55-c/L7-03-physical.json',reviewPath='docs/reports/fix55-c/L7-03-review.json';if(!existsSync(proofPath)||!existsSync(reviewPath))return [];
 const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
 const proof=JSON.parse(readFileSync(proofPath,'utf8')) as {sourceHash:string;browserHash:string;toolSha256:string;rows:Case[]};
 const review=JSON.parse(readFileSync(reviewPath,'utf8')) as {sourceHash:string;browserHash:string;toolSha256:string;inputSha256:string;captures:{tier:string;kind:string;file:string;sha256:string;seen:string}[];sheets:{file:string;sha256:string}[];rocketReview?:{visibleRocket:boolean;blastBlood:boolean;noWhiteout:boolean;pointblankPeakReviewed:boolean}};
 if(proof.sourceHash!==sourceHash||proof.browserHash!==browserHash||proof.toolSha256!==sha(readFileSync('tools/qa/accept/fix55-l7-rockets.mjs'))||review.sourceHash!==sourceHash||review.browserHash!==browserHash||review.toolSha256!==proof.toolSha256||review.inputSha256!==sha(readFileSync(proofPath)))return [];
 const reviewed=review.captures.length>0&&review.captures.every(c=>c.seen.trim()&&/^[a-f0-9]{64}$/.test(c.sha256))&&review.sheets.every(s=>evidenceIsArchivedOrMatches(s.file,s.sha256));
 const boundaryPath='docs/reports/sweep-c4/L7-03-ballistics.json';
 const boundary=existsSync(boundaryPath)?JSON.parse(readFileSync(boundaryPath,'utf8')) as {sourceHash:string;browserHash:string;toolSha256:string;rows:Case[]}:null;
 const boundaryFresh=boundary?.sourceHash===sourceHash&&boundary.browserHash===browserHash&&boundary.toolSha256===sha(readFileSync('tools/qa/accept/sweep-c4-l7-ballistics.mjs'));
 const results:{path:string;receipt:FixtureReceipt}[]=[];
 for(const tier of ['low','high'] as const){
  const rows=proof.rows.filter(row=>row.tier===tier),cadence=rows.find(row=>row.kind==='cadence'),cohort=rows.find(row=>row.kind==='cohort'),pointblank=rows.find(row=>row.kind==='pointblank');if(!cadence||!cohort||!pointblank)continue;
  const path=`${reportRoot}/receipts/L7-${tier}-rocket-browser.json`,receipt:FixtureReceipt={version:1,level:'L7',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],checks:[],observations:{proofPath,reviewPath}};
  const add=(clause:string,value:unknown,target:string,pass:boolean)=>receipt.checks.push({id:'L7-03',clause,value,target,status:pass?'PASS':'FAIL',tier,policy:'real-input-webgl2',receipt:proofPath});
  const execution=rows.length===3&&rows.every(row=>!row.errors.length&&row.setup.backend==='webgl'&&row.setup.quality===tier);
  const shots=cadence.result.events.filter(e=>e.type==='combat.attack'&&e.sourceId===1&&e.actionId==='weapon.rocket-launcher'),gaps=shots.slice(1).map((shot,i)=>shot.tick-shots[i].tick),impacts=cadence.result.events.filter(e=>e.type==='explosion'&&e.sourceId===1);
  add('physical rocket cadence and overlapping flight',{shotTicks:shots.map(s=>s.tick),impactTicks:impacts.map(e=>e.tick),intervals:gaps},'held LMB;25ticks per shot=2.4/s; second shot before first impact',execution&&shots.length>=3&&gaps.every(g=>g===25)&&impacts.length>0&&shots[1].tick<impacts[0].tick);
  add('clicked empty-ground impact',{clicked:cadence.result.point,impacts,inputs:cadence.result.inputs},'actual mouse aimPoint; all empty-ground impacts within0.1m of clicked ground',execution&&impacts.length>0&&impacts.every(e=>e.position&&Math.hypot(e.position.x-cadence.result.point.x,e.position.z-cadence.result.point.z)<=.1)&&cadence.result.inputs.some(i=>i.mouseAttack&&i.aimPoint&&Math.hypot(i.aimPoint.x-cadence.result.point.x,i.aimPoint.z-cadence.result.point.z)<=.1));
  const initial=cohort.result.initial,killed=cohort.result.final.filter(e=>e.hp<=0),cohortShots=cohort.result.events.filter(e=>e.type==='combat.attack'&&e.sourceId===1);
  add('one physical rocket kills24-body three-metre cohort',{initial,killed,shots:cohortShots},'24 unmodified60HP regulars initially within3m; one actual shot kills≥20',execution&&initial.length===24&&initial.every(e=>e.hp===60&&e.maxHp===60&&Math.hypot(e.position.x-cohort.result.point.x,e.position.z-cohort.result.point.z)<=3)&&cohortShots.length===1&&killed.length>=20);
  add('three-metre movement gap in controlled cohort',{living:cohort.result.final.filter(e=>e.hp>0)},'empty arena has no static blocker; no living cohort body intersects1.5m-radius gap around clicked ground',execution&&cohort.result.final.every(e=>e.hp<=0||Math.hypot(e.position.x-cohort.result.point.x,e.position.z-cohort.result.point.z)>1.5+e.radius));
  const visual=review.rocketReview;
  add('reviewed night rockets blood and pointblank impact peak',{reviewPath,visual},'all captures seen, retained sheets hash-valid; actual13/14/16/18tick close explosion frames retain courier/ground without white-out',execution&&reviewed&&!!visual?.visibleRocket&&visual.blastBlood&&visual.noWhiteout&&visual.pointblankPeakReviewed&&[13,14,16,18].every(tick=>review.captures.some(c=>c.tier===tier&&c.kind==='pointblank'&&c.file.endsWith(`-${tick}.jpg`))));
  if(boundaryFresh){
   for(const kind of ['first-hit','far-click','direction-range']){
    const row=boundary!.rows.find(row=>row.tier===tier&&row.kind===kind);if(!row)continue;
    const launches=row.result.events.filter(event=>event.type==='combat.attack'&&event.sourceId===1&&event.actionId==='weapon.rocket-launcher');
    const explosions=row.result.events.filter(event=>event.type==='explosion'&&event.sourceId===1);
    const origin=launches[0]?.position,impact=explosions[0]?.position;
    const distance=origin&&impact?Math.hypot(impact.x-origin.x,impact.z-origin.z):null;
    const physical=row.result.inputs.some(input=>kind==='direction-range'?input.activeAttack&&!input.aimPoint:input.mouseAttack&&input.aimPoint&&Math.hypot(input.aimPoint.x-row.result.point.x,input.aimPoint.z-row.result.point.z)<.1);
    const valid=!row.errors.length&&row.setup.backend==='webgl'&&row.setup.quality===tier&&launches.length===1&&explosions.length===1&&physical;
    const target=row.result.initial[0];
    const pass=kind==='first-hit'?valid&&!!target&&target.hp===60&&target.maxHp===60&&row.result.final[0]?.hp===0&&!!impact&&Math.hypot(impact.x-target.position.x,impact.z-target.position.z)<=.45&&Math.hypot(impact.x-row.result.point.x,impact.z-row.result.point.z)>1:kind==='far-click'?valid&&!!impact&&Math.hypot(impact.x-row.result.point.x,impact.z-row.result.point.z)<.1:valid&&distance!==null&&Math.abs(distance-action('weapon.rocket-launcher').range)<=.1;
    const clause=kind==='first-hit'?'physical rocket first-hit detonation':kind==='far-click'?'physical rocket clicked point beyond catalog range':'physical rocket catalog max-range detonation';
    const targetText=kind==='first-hit'?'actual ground click beyond ordinary60HP body; one rocket detonates at first body surface':kind==='far-click'?'E29 §5.2 clicked world point is honored, including beyond direction-only catalog range':'actual Space with no aimPoint; empty-ground detonation at catalog35m range ±0.1m';
    receipt.checks.push({id:'L7-03',clause,value:{point:row.result.point,origin,impact,distance,target},target:targetText,status:pass?'PASS':'FAIL',tier,policy:'real-input-webgl2',receipt:boundaryPath});
   }
  }
  atomicJson(path,receipt);results.push({path,receipt});
 }
 return results;
}
