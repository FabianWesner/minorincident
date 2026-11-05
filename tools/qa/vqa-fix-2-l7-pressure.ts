/** Process-local authored-anchor comparison, no acceptance thresholds changed. */
import {writeFileSync}from'node:fs';
import{runLevel,loadLevel}from'../sim-runner/levels';
import{preset}from'../../src/sim/progression/Campaign';
import{l7Encounters}from'../../src/data/l7';
import{ThreatObserver}from'./threat/observer';
const at=l7Encounters.streets[0]as{x:number;z:number},old={...at},rows=[];
try{for(const x of[233,239,245,259]){
 at.x=x;const idle=await loadLevel('L7',1,preset('L7-default'),0,{quality:'high'});let surviving=0,infected=0;try{for(let i=0;i<300;i++)idle.update();surviving=idle.l7Encounters!.state.roster.filter(r=>r.status==='following').length;infected=idle.l7Encounters!.state.roster.filter(r=>idle.entities.get(r.id)?.infection).length;}finally{idle.dispose();}
 let observer:ThreatObserver|undefined,phases:unknown;const run=await runLevel('L7','complete',1,undefined,'auto',preset('L7-default'),undefined,0,{quality:'low',beforeBegin:w=>{observer=new ThreatObserver(w,'L7');},beforeDispose:()=>{phases=observer!.finish().phases;}});const row={x,surviving,infected,run,phases};rows.push(row);console.log(JSON.stringify(row));
}}finally{Object.assign(at,old);}
writeFileSync('docs/reports/vqa-fix-2/L7-pressure-comparison.json',JSON.stringify({method:'Process-local first-pack x-anchor comparison, same production counts, five idle seconds on high and full competent low input.',rows},null,2)+'\n');
