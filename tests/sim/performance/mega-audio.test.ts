import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { installMegaPursuit } from '../../../src/sim/ai/MegaPursuit';
for (const [count, budget] of [[200,4],[100,6]] as const) test(`T-E32-13-perf-${count} @E32-AC13 @E18-AC02 full horde and off-region audio scheduling`, async()=>{
  const w=new SimWorld(); await w.init();
  try {
    w.loadScenario(count===200?'perf-horde-200':'perf-horde-100');w.combat!.damage.god=true;
    w.infected!.release(w.infected!.active[0]);const pursuit=installMegaPursuit(w,{introduceTick:null,resident:()=>false});pursuit.introduce({x:-250,z:0});
    let cues=0;w.events.on('mega.cue',()=>cues++);const ms:number[]=[];
    for(let tick=0;tick<2400;tick++){const start=performance.now();w.update();if(tick>=120)ms.push(performance.now()-start);}
    ms.sort((a,b)=>a-b);const proof={count:w.infected!.director.count,cues,p95:ms[Math.ceil(ms.length*.95)-1],budget};
    mkdirSync('test-results/epics/E32/audio',{recursive:true});writeFileSync(`test-results/epics/E32/audio/sim-perf-${count}.json`,JSON.stringify(proof,null,2));
    expect(proof.count).toBe(count);expect(cues).toBeGreaterThanOrEqual(4);expect(proof.p95).toBeLessThanOrEqual(budget);
  } finally{w.dispose();}
});
