import {mkdirSync,writeFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {SimWorld} from '../../../src/sim/world/SimWorld';
import {applyCampaign} from '../../../src/sim/progression/apply';
import {preset,powerScore} from '../../../src/sim/progression/Campaign';
test('@E13 @perf progression combat-arena sim timing and power progression counters',async()=>{
  const w=new SimWorld();await w.init();w.loadScenario('combat-arena');applyCampaign(w,preset('L6-default'));
  try{
    for(let i=0;i<120;i++)w.update();const times=[];
    for(let i=0;i<600;i++){const start=performance.now();w.update();times.push(performance.now()-start);}times.sort((a,b)=>a-b);
    const result={ticks:600,simMsP50:times[300],simMsP95:times[570],powerScores:[2,3,4,5,6].map(l=>powerScore(preset(`L${l as 2|3|4|5|6}-default`))),counters:w.getState().perf};
    expect(result.simMsP95).toBeLessThan(4);mkdirSync('test-results/epics/E13',{recursive:true});writeFileSync('test-results/epics/E13/sim-perf.json',JSON.stringify(result,null,2));
  }finally{w.dispose();}
});
