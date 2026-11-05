import {newCampaign,autoRewards,type Level} from '../../src/sim/progression/Campaign';
import type {MissionId} from '../../src/levels/missions';
import {runLevel,type CompletionPolicy,type LevelReport} from '../sim-runner/levels';
/** One continuous campaign, preserving actual L5 racks and rescued ids at the subway handover. */
export async function runSubwayCampaign(seed:number,policy:CompletionPolicy='complete'){
  const save=newCampaign('female',seed),reports:(LevelReport&{start:typeof save.racks;end:typeof save.racks;carriedSurvivors:string[]})[]=[];
  for(let n=1;n<=6;n++){
    const start=structuredClone(save.racks),ids=[...save.survivors??[]],result=await runLevel(`L${n}` as MissionId,policy,save.seed,600,'auto',save);
    reports.push({...result,start,end:structuredClone(save.racks),carriedSurvivors:ids});
    if(!result.completed)break;
    if(n<6){const carried=structuredClone(save.racks);autoRewards(save,n as Level);if(n===5)save.racks=carried;}
  }
  return {policy,reports,save};
}
