/** One live riot against a full-health continuously firing stationary courier. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { l4 } from '../../src/data/l4';
import { provenance } from './accept/probe';
const rows=[];
for(const tier of ['low','high'] as const) for(const distance of [.9,1.6,3,6,20,26]){
 const w=new SimWorld();await w.init();w.loadScenario('horde-arena',1);
 try{
  w.scenario='L4';w.infected!.director.setTier(tier);w.combat!.damage.god=false;
  const p=w.entities.get(1)!;p.health.current=p.health.max=100;
  const id=w.infected!.spawn('infected.riot',{x:distance,z:0},{yaw:Math.PI}),e=w.entities.get(id)!;
  e.combat!.damageMultiplier=l4.war.infectedDamage;
  w.combat!.setLoadout(['weapon.army-mg'],['weapon.kick']);w.infected!.press(id,1,3600,100);
  const before={player:structuredClone(p),riot:structuredClone(e)},hits:unknown[]=[];
  w.events.on('combat.hit',event=>hits.push(structuredClone(event)));
  for(let tick=0;tick<1200&&e.health.current>0&&p.health.current>0;tick++){
   const dx=e.transform.x-p.transform.x,dz=e.transform.z-p.transform.z,d=Math.hypot(dx,dz)||1;
   w.setInput({move:{x:0,z:0},aimSource:'keyboard',aim:{x:dx/d,z:dz/d},aimPoint:{x:e.transform.x,z:e.transform.z},left:{down:false,held:true,up:false}});w.update();
  }
  rows.push({tier,startDistance:distance,seconds:w.tick/60,playerHp:p.health.current,riotHp:e.health.current,before,hits,end:{player:{...p.transform},riot:{...e.transform}}});
  console.log(tier,distance,w.tick/60,p.health.current,e.health.current);
 }finally{w.dispose();}
}
writeFileSync('docs/reports/sweep-b/L4-riot-duels.json',JSON.stringify({...provenance(),producerSha256:createHash('sha256').update(readFileSync('tools/qa/sweep-b-riot-duel.ts')).digest('hex'),method:'Controlled production combat, actual L4 scenario flag and unchanged L4 infectedDamage multiplier. Exactly one ordinary riot, live unmodified AI and normal press order; courier starts100HP and holds stationary MG fire/aim through ordinary input. No god protection, other infected, AI disable or stat/target reductions. Distances include body-clear0.9m point blank and weapon range26m. Native mechanics only; visible HP/recoil/bar/feel remain separate.',rows},null,2)+'\n');
