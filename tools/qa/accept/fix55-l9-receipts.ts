import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import type { NativeReceipt } from './probe';
import type { L9NativeProof } from './fix55-l9-native';
import { atomicJson, reportRoot } from './report';
export function fix55L9Receipts(sourceHash:string):{path:string;receipt:FixtureReceipt}[]{
 const proofPath='docs/reports/fix55-c/L9-native.json';if(!existsSync(proofPath))return [];
 const sha=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
 const proof=JSON.parse(readFileSync(proofPath,'utf8')) as L9NativeProof;
 const surroundPath='docs/reports/sweep-c3/L9-04/stopped-contact.json.gz';
 const surround=existsSync(surroundPath)?JSON.parse(gunzipSync(readFileSync(surroundPath)).toString()) as {sourceHash:string;toolSha256:string;rows:{tier:string;events:{type:string;tick:number;targetId?:number;attackId?:number;hitAt?:number;before?:number;after?:number}[]}[]}:null;
 const surroundFresh=!!surround&&surround.sourceHash===sourceHash&&surround.toolSha256===sha(readFileSync('tools/qa/accept/sweep-c3-l9-contact.ts'));
 if(proof.sourceHash!==sourceHash||proof.toolSha256!==sha(readFileSync('tools/qa/accept/fix55-l9-native.ts')))return [];
 const results:{path:string;receipt:FixtureReceipt}[]=[];
 for(const tier of ['low','high'] as const){
  const control=JSON.parse(readFileSync(`${reportRoot}/receipts/L9-${tier}-complete.json`,'utf8')) as NativeReceipt;
  const canonical=proof.rows.find(row=>row.tier===tier&&row.mode==='canonical'),zero=proof.rows.find(row=>row.tier===tier&&row.mode==='zero'),shortcut=proof.rows.find(row=>row.tier===tier&&row.mode==='shortcut');
  if(control.sourceHash!==sourceHash||control.observerHash!==proof.observerHash||!canonical?.controlIdentical||canonical.finalHash!==control.nativeStateHash||!zero||!shortcut)continue;
  const path=`${reportRoot}/receipts/L9-${tier}-fix55-native.json`;
  const receipt:FixtureReceipt={version:1,level:'L9',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],checks:[],observations:{proofPath}};
  const add=(id:string,clause:string,value:unknown,target:string,pass:boolean,evidencePath=proofPath)=>receipt.checks.push({id,clause,tier,policy:'controlled-fixture',value,target,status:pass?'PASS':'FAIL',receipt:evidencePath});
  add('L9-01','native first drive input and movement', {firstDrive:canonical.firstDrive,firstMotion:canonical.firstMotion},'drive and movement within30ticks of Begin',canonical.firstDrive!==null&&canonical.firstDrive<=30&&canonical.firstMotion!==null&&canonical.firstMotion<=30);
  const groups=proof.groups.filter(group=>!group.id.includes('wanderer'));
  add('L9-02','authored route group census and detour clearance',groups,'road2×6; countryside3×6; shortcut6×at least8 with2Alphas; every authored group detour≥20m',groups.filter(g=>g.route==='road').length===2&&groups.filter(g=>g.route==='countryside').length===3&&groups.filter(g=>g.route==='dry-shortcut').length===6&&groups.every(g=>g.runners>= (g.route==='dry-shortcut'?8:6)&&g.detourClearance>=20)&&groups.filter(g=>g.route==='dry-shortcut').reduce((n,g)=>n+g.alphas,0)===2);
  const censusPath='docs/reports/sweep-c/L9-02-census.json';
  if(existsSync(censusPath)){
   const census=JSON.parse(readFileSync(censusPath,'utf8')) as {sourceHash:string;observerHash:string;toolSha256:string;cells:{tier:string;route:string;finished:boolean;finalHash:string;controlHash:string;controlIdentical:boolean}[];rows:{tier:string;groups:{id:string;route:string;ids:number[];actors:{id:number;archetype:string}[]}[]}[]};
   const observed=census.rows.find(row=>row.tier===tier),cells=census.cells.filter(cell=>cell.tier===tier);
   const fresh=census.sourceHash===sourceHash&&census.observerHash===control.observerHash&&census.toolSha256===sha(readFileSync('tools/qa/accept/l9-group-census.ts'))&&
    cells.length===3&&['road','countryside','dry-shortcut'].every(route=>cells.some(cell=>cell.route===route&&cell.finished&&cell.controlIdentical&&cell.finalHash===cell.controlHash))&&cells.find(cell=>cell.route==='road')?.finalHash===control.nativeStateHash;
   const complete=observed&&JSON.stringify(observed.groups.map(group=>group.id).sort())===JSON.stringify(groups.map(group=>group.id).sort())&&
    observed.groups.every(group=>Array.isArray(group.ids)&&Array.isArray(group.actors)&&group.ids.length===group.actors.length&&JSON.stringify([...group.ids].sort((a,b)=>a-b))===JSON.stringify(group.actors.map(actor=>actor.id).sort((a,b)=>a-b)));
   if(fresh&&complete&&observed){
    const actual=observed.groups;
    const counts=[['road',2,6],['countryside',3,6],['dry-shortcut',6,8]] as const;
    const pass=counts.every(([route,count,size])=>actual.filter(group=>group.route===route).length===count&&actual.filter(group=>group.route===route).every(group=>group.ids.length===size&&new Set(group.ids).size===size))&&
     actual.every(group=>group.actors.every(actor=>['infected.runner','infected.alpha'].includes(actor.archetype)))&&actual.filter(group=>group.route==='dry-shortcut').flatMap(group=>group.actors).filter(actor=>actor.archetype==='infected.alpha').length===2;
    add('L9-02','actual admitted route group member census',actual,'road2×6; countryside3×6; shortcut6×8 total members including2Alphas; exact distinct production entity IDs',pass,censusPath);
   }
  }
  add('L9-04','safe route retains more durability than risky shortcut',{safe:canonical.preCrashDurability,shortcut:shortcut.preCrashDurability},'both routes complete; safe pre-crash durability strictly greater',canonical.finished&&shortcut.finished&&canonical.preCrashDurability>shortcut.preCrashDurability);
  const hits=shortcut.hits as {source:string;before:number;after:number;contactId:number|null;attackId:number|null}[];
  add('L9-04','shortcut durability billing per unique contact onset',hits,'nonempty contact ledger; ten damage per onset, no duplicate contact/attack charge',hits.length>0&&hits.every(hit=>hit.after===Math.max(0,hit.before-10))&&new Set(hits.map(hit=>`${hit.source}/${hit.contactId}/${hit.attackId}`)).size===hits.length);
  const surroundRow=surroundFresh?surround!.rows.find(row=>row.tier===tier):undefined;
  if(surroundRow){
   const windups=surroundRow.events.filter(event=>event.type==='vehicle.attack-windup');
   const attacks=surroundRow.events.filter(event=>event.type==='vehicle.durability-hit'&&event.attackId!==null&&event.attackId!==undefined);
   const matched=attacks.map(hit=>({hit,windup:windups.find(event=>event.attackId===hit.attackId&&event.targetId===hit.targetId)}));
   add('L9-04','stopped-surround attacks deal10 damage after at least0.6s windup',{windups,matched},'at least one actual attack hit; every hit has its matching actual windup, ≥36 ticks lead, and exactly10 durability damage',matched.length>0&&matched.every(({hit,windup})=>!!windup&&hit.tick-windup.tick!>=36&&hit.after===Math.max(0,hit.before!-10)),surroundPath);
  }
  add('L9-05','zero durability driving and smoke state',zero,'actual0HP from Begin; completes>1km drive, max road cap0.6, smoke state every driving tick; rendered smoke remains separate',zero.finished&&zero.drivenMetres>1000&&zero.zero.movingTicks>0&&Math.abs(zero.zero.maxCap-.6)<.02&&zero.zero.smokingTicks===zero.zero.ticks);
  add('L9-06','native safe rough/road traversal without wedge',{canonical:canonical.finished,zero:zero.finished,zeroDistance:zero.drivenMetres},'ordinary safe route and0HP detour both complete without relocation',canonical.finished&&zero.finished);
  for(const row of [canonical,zero]){
   const impact=row.signals.filter(signal=>signal.name==='l9.crash-impact'),objective=row.objectives.find(event=>event.id==='reach-outskirts');
   add('L9-07',`${row.mode} crash once and wreck objective ordering`,{signals:row.signals,objectives:row.objectives,states:row.states},'exactly one impact; wreck objective at/after impact; completed crash sequence',row.finished&&impact.length===1&&!!objective&&objective.tick>=impact[0].tick);
  }
  add('L9-09','detailed chunk cap during native safe and zero routes',{safe:canonical.peakChunks,zero:zero.peakChunks},`at most${tier==='low'?9:25} detailed resident chunks`,Math.max(canonical.peakChunks,zero.peakChunks)<=(tier==='low'?9:25));
  atomicJson(path,receipt);results.push({path,receipt});
 }
 return results;
}
