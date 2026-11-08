// Native L8 transport setup fixture; this is not a physical L8 playtest.
import {writeFileSync} from 'node:fs';
import {runLevel} from '../../../tools/sim-runner/levels';
import {preset} from '../../../src/sim/progression/Campaign';
import {recordL8Transport,completeCampaignLevel} from '../../../src/sim/progression/carryover';
for(const quality of ['low','high'] as const){const save=preset('L8-default');let transfer;const run=await runLevel('L8','complete',1,undefined,'auto',save,(w,r)=>{transfer=w.missions!.l8!.transferOrNull();if(!transfer||!recordL8Transport(save,transfer))throw Error('missing production transport');completeCampaignLevel(save,8,r,w)},0,{quality});if(!run.completed||!save.transport)throw Error('L8 fixture failed');writeFileSync(`test-results/pre-uat-l9/transport-${quality}.json`,JSON.stringify({save,run,transfer}));console.log(quality,transfer.vehicle.id,transfer.vehicle.health.current,transfer.occupants.length)}
