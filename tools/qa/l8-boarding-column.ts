/** Motion-only control: a complete living column must leave the centre approach clear. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
import { emptyInput } from '../../src/input/InputFrame';
const w=await loadLevel('L8',1,undefined,0,{quality:'high'}),m=w.missions!,z=m.l8!,s=z.state;
m.state.states.breached=true;m.state.states['hale-keys']=true;m.state.states['hale-fallen']=true;s.breachedAt=-1800;s.nextWave=1e12;
m.state.steps.sanctuary.status='completed';m.state.steps.escape.status='active';for(const a of s.arenas)a.phase=3;
w.combat!.damage.god=true;w.solids.relocate(w.entities.get(1)!,{x:91.99,z:72.85,y:.7},'qa.cover-position',2);
w.update(); const group=z.passengers();
for(const [i,id] of group.entries()){const e=w.entities.get(id)!;w.solids.relocate(e,{x:94.5+(i%3)*1.5,z:62+Math.floor(i/3)*1.5,y:e.companion?.3:.82},'qa.queue-position',3);}
if(process.env.L8_BOARDING_CORPSE || process.env.L8_BOARDING_CONTACT){
  const elephant=w.entities.get(s.arenas.find(a=>a.id==='elephant')!.ids[0])!;
  assert(w.solids.relocate(elephant,process.env.L8_BOARDING_CONTACT?{x:102.76858,z:54.86135,y:.7}:{x:102.85,z:58.5,y:.7},'qa.fallen-elephant',4));
  elephant.health.current=0;elephant.corpse=true;
  const dog=w.entities.get(group[0])!;
  if(process.env.L8_BOARDING_CONTACT) assert(w.solids.relocate(w.entities.get(s.reyesId)!,{x:104.13,z:55.64,y:.7},'qa.reyes-contact',.5));
  else w.solids.relocate(dog,{x:102.85,z:55.95,y:.3},'qa.north-approach',2);
}
let seated=0;
for(let n=0;n<3600;n++){w.applyInput(emptyInput(),'keyboard');w.update();seated=w.entities.get(s.carId)!.vehicle!.passengers?.filter(p=>p.phase==='seated').length??0;if(seated>=group.length)break;}
const result={...provenance(),corpseObstruction:!!process.env.L8_BOARDING_CORPSE,contactObstruction:!!process.env.L8_BOARDING_CONTACT,method:'Protected motion-only boarding fixture. All fights already clear, real NPC paths and vehicle boarding; no combat victory claimed.',pass:seated>=group.length && w.solids.failures === 0,collisionFailures:w.solids.failures,tick:w.tick,seated,total:group.length,door:w.vehicles!.passengerDoor(s.carId),cast:group.map(id=>{const e=w.entities.get(id)!;return{id,at:e.transform,hp:e.health.current,passengerOf:e.passengerOf,state:e.civilian?.state,path:e.civilian?.path,companion:e.companion,blocker:w.solids.blockingBody(e.id)?.id};})};
writeFileSync(process.argv[2]??'docs/reports/p1-l8rework/boarding-column.json',JSON.stringify(result,null,2));console.log(JSON.stringify({pass:result.pass,seated,total:group.length,tick:w.tick}));w.dispose();if(!result.pass)process.exitCode=1;
