import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect} from 'vitest';
import {runSubwayCampaign} from '../../tools/l6/campaignRun';
for(const policy of ['complete','newbie'] as const)test(`T-E24-08 @E24 @E24-AC08 continuous ${policy} campaign on one seed with real L5 handover`,async()=>{
  const result=await runSubwayCampaign(1,policy);
  mkdirSync('test-results/epics/E24',{recursive:true});
  writeFileSync(`test-results/epics/E24/campaign-${policy==='newbie'?'newbie-':''}seed-1.json`,JSON.stringify(result,null,2));
  expect(result.reports).toHaveLength(6);expect(result.reports.every(r=>r.completed)).toBe(true);
  expect(result.reports[5].start).toEqual(result.reports[4].end);
  expect(result.reports[5].carriedSurvivors).toEqual(result.save.results!.L5!.survivors);
  if(policy==='newbie'){const total=result.reports.reduce((n,r)=>n+r.time,0);expect(total).toBeGreaterThanOrEqual(870);expect(total).toBeLessThanOrEqual(1590);}
},1_800_000);
