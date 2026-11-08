import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel } from './levels';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import { emptyInput } from '../../src/input/InputFrame';
import { observeAttackStarts } from '../qa/threat/attackStarts';
const out='test-results/l8-contact'; mkdirSync(out,{recursive:true});
const w=await loadLevel('L8',1,undefined,0,{quality:'low'}), bot=new LevelEightBot(w,'story-only'), zoo=w.missions!.l8!;
w.combat!.damage.god=true;
const attacks: unknown[]=[], samples: unknown[]=[];
observeAttackStarts(w,(id,target,tick)=>{if(target===1) attacks.push({id,tick,seconds:(tick-zoo.state.breachedAt)/60,at:w.entities.get(id)?.transform});});
for(let n=0;n<90*60;n++) {
 w.applyInput(zoo.state.breachedAt ? emptyInput():bot.sample(),'keyboard');w.update();
 if(zoo.state.breachedAt && w.tick%300===0) {
  const row={seconds:(w.tick-zoo.state.breachedAt)/60,player:{...w.entities.get(1)!.transform},actors:zoo.state.arrivals.map(q=>{const e=w.entities.get(q.id);return {id:q.id,outlet:q.outlet,hp:e?.health.current,at:e?.transform,emerging:e?.emerging,pending:e?.pendingAdmission,speed:e?.motion?.speed,state:e?.infected?.state,script:e?.infected?.scripted,target:e?.infected?.heardTargetId};})};
  samples.push(structuredClone(row)); console.log(JSON.stringify(row));
 }
}
writeFileSync(`${out}/low.json`,JSON.stringify({attacks,samples},null,2));w.dispose();
