/** All actual military-wall capsules plus actual camera-family angular bounds. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { preset } from '../../src/sim/progression/Campaign';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const rows=[];
for(const tier of ['low','high'] as const){
 const campaign=preset('L4-default');campaign.settings.quality=tier;
 const w=await loadLevel('L4',1,campaign,0,{quality:tier});
 try{
  w.missions!.completeObjective('ride');w.missions!.completeObjective('quartermaster');w.update();
  const walls=[...w.entities.iterate()].filter(e=>e.barricade?.intact&&e.barricade.slot.groupId==='l4-wall');
  const probes=[];
  for(const e of walls){
   const slot=e.barricade!.slot,dx=slot.b.x-slot.a.x,dz=slot.b.z-slot.a.z,n=Math.hypot(dx,dz),nx=-dz/n,nz=dx/n;
   const at={x:e.transform.x+nx*1.5,y:(w.districts?.groundHeight(e.transform.x+nx*1.5,e.transform.z+nz*1.5)??0)+.72,z:e.transform.z+nz*1.5};
   const body=w.physics.playerBody!,collider=w.physics.playerCollider!,controller=w.physics.characterController!;
   body.setTranslation(at,true);w.physics.world!.propagateModifiedBodyPositionsToColliders();
   const requested={x:-nx*3,y:0,z:-nz*3};controller.computeColliderMovement(collider,requested,undefined,collider.collisionGroups());
   const movement=controller.computedMovement(),travel=-(movement.x*nx+movement.z*nz);
   probes.push({id:e.id,slot:slot.id,at,requested,movement,travel,blocked:travel<1.5,archetype:e.archetype});
  }
  const cinematicPoses=Object.entries(w.missions!.def.cinematics).map(([name,p])=>({name,position:p.position,target:p.target,offset:p.position.map((v,i)=>v-p.target[i])}));
  rows.push({tier,wallCount:walls.length,probes,cinematicPoses});console.log(tier,walls.length,probes.filter(p=>!p.blocked).length);
 }finally{w.dispose();}
}
writeFileSync('docs/reports/sweep-b/L4-solids.json',JSON.stringify({...provenance(),producerSha256:createHash('sha256').update(readFileSync('tools/qa/sweep-b-l4-solids.ts')).digest('hex'),method:'Explicit opening-war fixture after completing ride and quartermaster; actual perimeter then exists. Every actual intact military wall is crossed by the production Rapier courier capsule from1.5m out along its normal, with a3m requested displacement; actual computed movement retained. No collider removed/replaced and no health/count changes. Actual mission cinematic poses retained; render-angle timeline and visual surfaces are separate evidence.',rows},null,2)+'\n');
