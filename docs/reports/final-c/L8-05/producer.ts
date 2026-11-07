import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadLevel} from '../../sim-runner/levels';
import {preset} from '../../../src/sim/progression/Campaign';
import {emptyInput} from '../../../src/input/InputFrame';
import {requireClearPoint} from '../../../src/sim/missions/missionHelpers';
import {provenance} from './probe';
import {atomicJson} from './report';
const identity=provenance(),rows=[];
for(const tier of ['low','high'] as const){
 const campaign=preset('L8-default');campaign.settings.quality=tier;const world=await loadLevel('L8',1,campaign,0,{quality:tier});
 try{
  world.combat!.damage.god=true; // Courier only; every measured target keeps ordinary HP/AI/faction.
  while(world.tick<3600){world.applyInput(emptyInput(),'keyboard');world.update();}
  const civilians=[...world.entities.iterate()].filter(e=>e.civilian&&e.health.current>0&&!e.infected&&!e.infection);
  const staff=(archetype:string)=>/^npc\.(zookeeper|vet|groundskeeper)$/.test(archetype);
  const definitions=[{kind:'civilian',actor:civilians.find(e=>!e.civilian!.zooAnimal&&e.civilian!.ally?.role!=='soldier'&&!staff(e.archetype))},
   {kind:'soldier',actor:civilians.find(e=>e.civilian!.ally?.role==='soldier')},...civilians.filter(e=>staff(e.archetype)).map(actor=>({kind:'staff',actor})),
   ...['lion','gorilla','elephant','zebra','flamingo'].map(species=>({kind:species,actor:civilians.find(e=>e.civilian!.zooAnimal===species)}))];
  const targets=definitions.map(({kind,actor})=>{
   if(!actor)throw new Error(`${tier}: missing healthy ${kind}`);
   const attackers=[];for(let i=0;i<4;i++){const point=requireClearPoint(world,{x:actor.transform.x+Math.cos(i*Math.PI/2)*1.1,z:actor.transform.z+Math.sin(i*Math.PI/2)*1.1},.35,2,'L8 bite capability fixture');const id=world.infected!.spawn('infected.runner',point,{state:'chase',yaw:0});attackers.push({id,position:{...world.entities.get(id)!.transform},hp:world.entities.get(id)!.health.current});}
   return {kind,id:actor.id,archetype:actor.archetype,species:actor.civilian!.zooAnimal??null,hp:actor.health.current,position:{...actor.transform},attackers};
  });
  const hits:object[]=[],turns=new Map<number,{id:number;kind:string;start:number;end:number|null;seconds:number|null;archetype:string|null}>();
  world.events.on('outbreak.bite',event=>{if(event.type==='outbreak.bite'){const target=targets.find(t=>t.id===event.targetId);if(target)hits.push({...event,successfulBite:true,kind:target.kind});}});
  world.events.on('combat.hit',event=>{if(event.type==='combat.hit'&&event.amount>0&&world.entities.get(event.sourceId)?.infected){const target=targets.find(t=>t.id===event.targetId);if(target)hits.push({...event,kind:target.kind});}});
  world.events.on('outbreak.infection',event=>{if(event.type!=='outbreak.infection')return;const target=targets.find(t=>t.id===event.entityId);if(!target)return;
   if(event.phase==='stagger')turns.set(target.id,{id:target.id,kind:target.kind,start:event.tick,end:null,seconds:null,archetype:null});
   if(event.phase==='infected'){const row=turns.get(target.id);if(row){row.end=event.tick;row.seconds=(event.tick-row.start)/60;row.archetype=world.entities.get(target.id)!.archetype;}}
  });
  let peak=0;for(let i=0;i<1500;i++){world.applyInput(emptyInput(),'keyboard');world.update();peak=Math.max(peak,world.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission).length);}
  rows.push({tier,setupTick:3600,finalTick:world.tick,targets,hits,turns:[...turns.values()],peak,cap:world.infected!.director.cap});console.log(tier,hits,turns);
 }finally{world.dispose();}
}
atomicJson('docs/reports/final-c/L8-05/L8-bite-fixtures.json',{...identity,toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'Explicit local-threat capability fixture at actual3600tick breach: choose existing healthy civilian/soldier/staff and one of each five animal species; spawn four ordinary60HP runners on body-clear points≈1.1m around each. No target HP/AI/faction, counts/caps/timers or infection changes. Only courier protected. Ordinary perception/combat and same-ID conversion proceed25s. Distinct from the read-only canonical routes with no natural staff hit.',rows});
