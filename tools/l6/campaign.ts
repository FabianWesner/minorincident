import {mkdirSync,writeFileSync} from 'node:fs';
import {runSubwayCampaign} from './campaignRun';
const seed=Number(process.argv[2]??1),policy=process.argv[3]==='newbie'?'newbie':'complete';
const result=await runSubwayCampaign(seed,policy);
mkdirSync('test-results/epics/E24',{recursive:true});
writeFileSync(`test-results/epics/E24/campaign-${policy==='newbie'?'newbie-':''}seed-${seed}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result.reports));
if(result.reports.length!==6||result.reports.some(r=>!r.completed))process.exitCode=1;
