import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { missionSandbox } from '../../fixtures/scenarios/mission-sandbox';
test('@E12 mission-sandbox fixed-step p95 stays within the 4ms high-tier sim budget',async()=>{
  const world=new SimWorld();await world.init();world.loadScenario('mission-sandbox',1);const def=missionSandbox('custom');
  const template=def.steps[0];def.steps=['a','b','c'].map(id=>({...template,id}));def.finish=['a','b','c'];world.loadMission(def).begin();
  try{
    for(let i=0;i<120;i++)world.update();
    const samples:number[]=[];for(let i=0;i<3600;i++){const start=performance.now();world.update();samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
    const metrics={scenario:'mission-sandbox',seed:1,ticks:3600,activeObjectives:3,entities:world.entities.size,simMsMedian:samples[1800],simMsP95:samples[3420],budgetMs:4};
    mkdirSync('test-results/epics/E12',{recursive:true});writeFileSync('test-results/epics/E12/sim-perf.json',JSON.stringify(metrics,null,2));expect(metrics.simMsP95).toBeLessThan(4);
  }finally{world.dispose();}
});
