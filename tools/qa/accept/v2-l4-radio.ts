import {writeFileSync} from 'node:fs';
import {loadL4,runL4} from '../../sim-runner/l4Bots';
import {provenance} from './probe';
const cells=[];
for(const tier of ['high','low'] as const){const {world,mission}=await loadL4(1,tier);const lines:object[]=[];const off=world.events.on('dialogue.line',e=>{if(e.type==='dialogue.line')lines.push({tick:world.tick,id:e.id,text:e.text,subtitle:structuredClone(mission.state.subtitle)});});const result=runL4(world,mission,'complete',{seed:1});off();cells.push({tier,outcome:result.outcome,deaths:result.deaths,lines});world.dispose();}
writeFileSync('docs/reports/v2-l2l4/L4-09-radio.json',JSON.stringify({...provenance(),method:'Read-only dialogue.line event listener on ordinary complete native bot, seed 1, both tiers; captures subtitle state at emission.',cells},null,2)+'\n');console.log(JSON.stringify(cells));
