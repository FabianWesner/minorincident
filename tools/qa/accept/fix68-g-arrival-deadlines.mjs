/** Read-only audit of active L3 arrival deadlines during the ordinary high-tier prefix. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels.ts';
import { preset } from '../../../src/sim/progression/Campaign.ts';
import { stateHash } from '../../../src/sim/world/stateHash.ts';
import { provenance } from './probe.ts';
const identity=provenance(), calls=[];let observedHash,controlHash;
const campaign=()=>{const c=preset('L3-default');c.settings.quality='high';return c;};
await runLevel('L3','complete',1,90,'auto',campaign(),undefined,0,{quality:'high',beforeBegin:w=>{
 const rush=w.infected.rush.bind(w.infected);
 w.infected.rush=(id,point,until,...rest)=>{
  const q=w.missions.state.l3.waves.find(q=>q.id===id),brain=w.entities.get(id)?.infected?.l1;
  const before=brain?.search.until,mode=brain?.mode,phase=w.missions.state.l3.phase;
  const sent=rush(id,point,until,...rest);
  if(q&&['fallback','corridor'].includes(phase))calls.push({tick:w.tick,id,wave:q.wave,scheduled:q.at,phase,mode,cohortRefresh:w.tick%120===0&&w.tick<q.at+3600&&until>=q.at+3600&&point===w.entities.get(1).transform,before,requested:until,after:brain?.search.until,sent});
  return sent;
 };
},beforeDispose:w=>{observedHash=stateHash(w.getState());}});
await runLevel('L3','complete',1,90,'auto',campaign(),undefined,0,{quality:'high',beforeDispose:w=>{controlHash=stateHash(w.getState());}});
const shortened=calls.filter(c=>c.cohortRefresh&&c.sent&&c.after<c.before),result={...identity,method:'Read-only rush wrapper on ordinary90-second high-tier complete prefix. No event injection, relocation, count or timer changes. Exact unobserved control comparison.',observedHash,controlHash,identical:observedHash===controlHash,shortenedActiveDeadlines:shortened,calls};
writeFileSync(process.env.FIX68_G_DEADLINE_OUT??'docs/reports/fix68-g/G-22-deadline.json.gz',gzipSync(JSON.stringify(result)));
console.log(JSON.stringify({identical:result.identical,shortened:shortened.length,examples:shortened.slice(0,4)}));
process.exitCode=result.identical?0:1;
