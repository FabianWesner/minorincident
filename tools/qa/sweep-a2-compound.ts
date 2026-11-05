/** Every-tick first-five-second army rest ledger on ordinary native input. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {loadL3,followFrustum} from '../sim-runner/l3Bots';
import {LevelThreeBot} from '../../src/debug/bot/LevelThreeBot';
import {emptyInput} from '../../src/input/InputFrame';
import {provenance} from './accept/probe';
const runs=[];
for(const tier of ['low','high']as const){const {world:w,mission:m}=await loadL3(1,tier);try{
 w.combat!.damage.god=true;const profile=tier==='high'?'evade-only':'complete',bot=new LevelThreeBot(w,profile,'auto'),rest=[];
 for(let i=0;i<36000&&!m.state.l3!.doneAt;i++){
  followFrustum(w);w.applyInput(m.state.l3!.crossedAt?emptyInput():bot.sample(),'keyboard');w.update();const s=m.state.l3!,p=w.entities.get(1)!.transform;
  if(s.crossedAt&&w.tick<=s.crossedAt+300){const living=w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission);rest.push({tick:w.tick,crossedAt:s.crossedAt,inside:living.filter(e=>e.transform.x>201.5).map(e=>e.id),near:living.filter(e=>Math.hypot(e.transform.x-p.x,e.transform.z-p.z)<=20).map(e=>e.id)});}
 }
 const s=m.state.l3!;runs.push({tier,profile,crossedAt:s.crossedAt,doneAt:s.doneAt,soldierIds:s.soldierIds,rest});assert.equal(rest.length,301);assert(rest.every(r=>!r.inside.length&&!r.near.length));assert.equal(s.doneAt!-s.crossedAt,900);assert(s.soldierIds.length>=8);console.log(tier,rest.length,s.doneAt!-s.crossedAt);
 }finally{w.dispose();}}
writeFileSync('docs/reports/sweep-a2/L3-14-native-rest.json.gz',gzipSync(JSON.stringify({...provenance(),method:'Ordinary complete(low)/evade(high) native input with count-only courier damage suppression; empty input after crossing; every tick first5s. No relocation/spawns/AI edits.',runs})));
