/** Offline receipt mutations exercise the production tolerance evaluator, not game behavior. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate } from '../accept/evaluate';
import type { NativeReceipt } from '../accept/probe';

const base=JSON.parse(readFileSync('docs/reports/fix51-verify/receipts/L5-low-complete.json','utf8')) as NativeReceipt;
assert(base.observation?.l5Formation?.length===5 && base.run);
const fixture=structuredClone(base);
fixture.run!.completed=true;
for(const r of fixture.observation!.l5Formation!)Object.assign(r,{calmTicks:4000,within8Ticks:4000,straightTicks:4000,inBandStraightTicks:3800,badStraightTicks:200,maxBadRun:120});
const cases: {name:string;expected:string;actual:string;value:unknown}[]=[];
const check=(name:string,mutate:(r:NativeReceipt)=>void,expected:string,clause='calm straight-walk')=>{
 const receipt=structuredClone(fixture);mutate(receipt);
 const result=evaluate(receipt,'synthetic-tolerance-control').find(c=>c.id==='L5-08'&&c.clause.includes(clause))!;
 assert.equal(result.status,expected,name);cases.push({name,expected,actual:result.status,value:result.value});
};
check('exact95percent and exactly120ticks permitted',()=>{},'PASS');
check('94.975percent fails',r=>{r.observation!.l5Formation![0].inBandStraightTicks=3799;r.observation!.l5Formation![0].badStraightTicks=201;},'FAIL');
check('121tick excursion fails despite96.975percent in-band',r=>{Object.assign(r.observation!.l5Formation![0],{inBandStraightTicks:3879,badStraightTicks:121,maxBadRun:121});},'FAIL');
check('incomplete route cannot qualify',r=>{r.run!.completed=false;},'NOT CHECKED');
check('missing fifth follower cannot qualify',r=>{r.observation!.l5Formation!.pop();},'NOT CHECKED');
check('zero straight ticks cannot qualify',r=>{Object.assign(r.observation!.l5Formation![0],{straightTicks:0,inBandStraightTicks:0,badStraightTicks:0,maxBadRun:0});},'NOT CHECKED');
check('missing in-band counter cannot qualify',r=>{Reflect.deleteProperty(r.observation!.l5Formation![0],'inBandStraightTicks');},'NOT CHECKED');
check('within8m clause remains binding',r=>{r.observation!.l5Formation![0].within8Ticks=3199;},'FAIL','share within8m');
writeFileSync('docs/reports/fix63-a/L5-08-tolerance-proof.json',JSON.stringify({method:'Synthetic receipt mutations against evaluate(); source native run is not requalified by these mutations.',cases},null,2)+'\n');
console.log('L5-08 tolerance: all8 boundary/absence controls pass');
