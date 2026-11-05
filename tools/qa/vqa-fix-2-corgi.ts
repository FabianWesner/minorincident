import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const rows=[];
for(const level of ['L7','L8'] as const)for(const tier of ['low','high'] as const){
 const w=await loadLevel(level,1,undefined,0,{quality:tier});
 try{
  const dog=[...w.entities.iterate()].find(e=>e.companion)!,kit=w.entities.get(w.pickups!.spawn('medkit',dog.transform))!,at={...kit.transform};
  const initial={dog:{...dog.transform},kit:{...kit.transform}};
  for(let i=0;i<180;i++)w.update();
  const distance=Math.hypot(dog.transform.x-kit.transform.x,dog.transform.z-kit.transform.z),p=w.entities.get(1)!.transform;
  const playerDistance=Math.hypot(dog.transform.x-p.x,dog.transform.z-p.z);
  assert(distance>=1.2,`${level}/${tier} must leave the medkit clear`);assert(playerDistance>=1.2); assert(Math.abs(dog.transform.y-.3-(p.y-.7))<.1, `${level}/${tier} dog must stand on the courier floor`);
  assert.deepEqual(kit.transform,at);assert(kit.pickup&&'kind'in kit.pickup&&!kit.pickup.collected);
  rows.push({level,tier,initial,after:{dog:{...dog.transform},kit:{...kit.transform}},distance,playerDistance,seconds:3});
 }finally{w.dispose();}
}
writeFileSync('docs/reports/vqa-fix-2/corgi-resting-proof.json',JSON.stringify({...provenance(),method:'Production L7/L8 opening, an uncollected medkit placed at the ordinary corgi resting location, three seconds of ordinary idle simulation; no courier/dog relocation or input.',rows},null,2)+'\n');console.log(rows.map(r=>({level:r.level,tier:r.tier,distance:r.distance,playerDistance:r.playerDistance})));
