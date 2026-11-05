/** Mortal, ordinary-input unarmed diagnostic: shelter orbit then existing evade route,
 * with local steering away from visible pursuers. No health, actor or clock writes. */
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { LevelSixBot } from '../../../src/debug/bot/LevelSixBot';
import { Walker } from '../../../src/debug/bot/Walker';
import { followFrustum } from '../../sim-runner/l3Bots';
import { emptyInput } from '../../../src/input/InputFrame';
import { provenance, type Tier } from './probe';
import { stateHash } from '../../../src/sim/world/stateHash';
export function fistsCompletionPass(result: { completed: boolean; offered: string[]; attacks: string[] }): boolean {
 return result.completed && result.offered.length > 0 && [...result.offered, ...result.attacks].every(id=>id==='weapon.fists'||id==='weapon.kick');
}
export async function fistsOnlyRoute(tier: Tier) {
const campaign=preset('L6-default');campaign.settings.quality=tier;campaign.racks={LEFT:['weapon.fists'],RIGHT:['weapon.kick']};campaign.ownedActions=['weapon.fists','weapon.kick'];
const world=await loadLevel('L6',1,campaign,0,{quality:tier});
try{
 const bot=new LevelSixBot(world,'evade-only'),walker=new Walker(),offered=new Set<string>(),attacks=new Set<string>();
 const events:unknown[]=[],samples:unknown[]=[];let orbit=0;
 const points=[{x:18,z:6},{x:18,z:-8},{x:-7,z:-8},{x:-7,z:7}];
 for(const type of ['l6.breach1','l6.breach2','l6.abandon','l6.exit','player.died','checkpoint.restored','level.completed'] as const)world.events.on(type,e=>events.push(structuredClone(e)));
 world.events.on('combat.attack',e=>{if(e.type==='combat.attack'&&e.sourceId===1)attacks.add(e.actionId);});
 for(let i=0;i<900*60&&!bot.finished;i++){
  followFrustum(world,1.5);let f=bot.sample();const p=world.entities.get(1)!,s=world.missions!.state.l6!;
  for(const side of ['LEFT','RIGHT'] as const)for(const slot of world.combat!.runner.loadout.state[side].rack)offered.add(slot.id);
  if(p.health.current>0&&world.missions!.state.phase==='playing'){
   if(['shelter','first','fails'].includes(s.phase)){
    if(Math.hypot(p.transform.x-points[orbit].x,p.transform.z-points[orbit].z)<1.2){orbit=(orbit+1)%points.length;walker.reset();}
    const move=walker.step(world,points[orbit],.8,`orbit-${orbit}`);f={...emptyInput(),move:move??{x:0,z:0}};
   }
   const enemies=world.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission&&world.infected!.nav.visible(p.transform,e.transform,0)&&Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)<7);
   if(enemies.length){
    const intended={...f.move},length=Math.hypot(intended.x,intended.z)||1;let best=-Infinity;
    for(let k=0;k<16;k++){
     const x=Math.cos(k*Math.PI/8),z=Math.sin(k*Math.PI/8),at={x:p.transform.x+x,z:p.transform.z+z};
     if(!world.infected!.nav.visible(p.transform,at,.35)||!world.infected!.nav.clear(at.x,at.z,.35)||world.player!.locomotion.movementMask&&!world.player!.locomotion.movementMask(at.x,at.z))continue;
     const separation=Math.min(...enemies.map(e=>Math.hypot(at.x-e.transform.x,at.z-e.transform.z)));
     const score=separation*2+(x*intended.x+z*intended.z)/length;
     if(score>best){best=score;f.move={x,z};}
    }
    const close=enemies.sort((a,b)=>Math.hypot(a.transform.x-p.transform.x,a.transform.z-p.transform.z)-Math.hypot(b.transform.x-p.transform.x,b.transform.z-p.transform.z))[0];
    if(Math.hypot(close.transform.x-p.transform.x,close.transform.z-p.transform.z)<1.8){
     const dx=close.transform.x-p.transform.x,dz=close.transform.z-p.transform.z,d=Math.hypot(dx,dz)||1;
     f.aimSource='keyboard';f.aim={x:dx/d,z:dz/d};f.left={down:false,held:true,up:false};
    }
   }
  }
  world.applyInput(f,'keyboard');world.update();
  if(world.tick%120===0)samples.push({tick:world.tick,phase:world.missions!.state.l6?.phase,hp:p.health.current,at:{...p.transform},leader:[s.leaderX,s.leaderZ],alive:s.survivors.filter(r=>r.status==='shelter'||r.status==='following').length});
 }
 const m=world.missions!,result={...provenance(),tier,setup:'Only unarmed campaign racks at load; mortal courier; ordinary move/aim/fist inputs; no actor/health/clock changes or objective skips.',completed:['result','progression'].includes(m.state.phase),phase:m.state.phase,stats:m.state.stats,result:m.state.result,offered:[...offered],attacks:[...attacks],events,samples};
 return {...result,nativeStateHash:stateHash(world.getState())};
}finally{world.dispose();}
}
if(process.argv[1]?.endsWith('fix53-fists.ts')){
 const tier=process.argv[2]==='high'?'high':'low';
 const result=await fistsOnlyRoute(tier);
 writeFileSync(`docs/reports/fix53-b/L6-13-${tier}-diagnostic.json`,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({tier,completed:result.completed,phase:result.phase,stats:result.stats,offered:result.offered,attacks:result.attacks,nativeStateHash:result.nativeStateHash}));
}
