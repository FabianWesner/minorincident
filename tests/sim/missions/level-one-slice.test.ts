import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { levelOneSlice } from '../../../src/levels/levelOneSlice';
import { emptyInput } from '../../../src/input/InputFrame';
let world: SimWorld;
afterEach(() => world?.dispose());
async function start(seed=1) {
  world=new SimWorld();await world.init();const c=compositions.L1;
  world.loadComposition(c,c.districts.map(d=>JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8'))),seed);
  world.enableInfected();world.combat!.clearLoadout();const def=levelOneSlice(resolveCampaignMission('L1',world.districts!));world.npcs?.configureSlice(def.anchors['incident-0']);const m=world.loadMission(def);m.begin();return m;
}
test('@E19 @E19-AC01 slice graph ends at store combat, without the deferred finale',async()=>{
  const m=await start();while(m.state.phase==='playing')m.completeObjective();
  expect(m.state.phase).toBe('result');expect(m.state.completedObjectives).toEqual(['breakfast','escape','melee','store-fight']);
});
test('@E19 @E19-AC04 no attacks before pickup; diner spawns real chasing AI and caps population',async()=>{
  const m=await start();world.setInput({left:{down:true,held:true,up:false},right:{down:true,held:true,up:false}});
  for(let i=0;i<60;i++)world.update();expect(world.entities.get(1)!.weapons).toBeUndefined();expect(world.events.events().some(e=>e.type==='combat.attack')).toBe(false);
  world.clearInput();m.completeObjective('breakfast');expect(world.infected!.active).toHaveLength(4);expect(world.infected!.active.every(e=>e.infected!.state==='chase')).toBe(true);
  const before={...world.infected!.active[0].transform};for(let i=0;i<60;i++)world.update();expect(world.infected!.active[0].transform).not.toEqual(before);expect(world.infected!.director.levelCap).toBe(15);
});
for(const weapon of ['bat','crowbar','machete'])test(`@E19 slice ${weapon} pickup retained after death, brains restore and restart is unarmed`,async()=>{
  const m=await start();m.completeObjective('breakfast');m.completeObjective('escape');m.chooseMelee(`weapon.${weapon}`);m.completeObjective('melee');
  expect(world.entities.get(1)!.weapons!.LEFT.rack.map(s=>s.id)).toEqual([`weapon.${weapon}`]);expect(world.entities.get(1)!.weapons!.RIGHT.rack[0].id).toBe('weapon.kick');
  world.player!.damage(100,world.tick);world.setInput(emptyInput());for(let i=0;i<200;i++)world.update();
  expect(m.state.checkpoint).toBe('melee');expect(m.state.steps['store-fight'].status).toBe('active');expect(world.entities.get(1)!.weapons!.LEFT.rack[0].id).toBe(`weapon.${weapon}`);
  expect(world.infected!.active.every(e=>world.entities.get(e.id)===e)).toBe(true);expect(world.infected!.director.count).toBeLessThanOrEqual(15);
  m.completeObjective('store-fight');m.restartSlice();expect(world.entities.get(1)!.weapons).toBeUndefined();expect(world.infected!.active).toHaveLength(0);expect(m.state.steps.breakfast.status).toBe('active');
});

test('@E19 @E19-AC05 evade-only reaches the hardware checkpoint on 20 seeds via movement',async()=>{
  for(let seed=1;seed<=20;seed++){
    const m=await start(seed);
    const walk=(x:number,z:number)=>{
      for(let tick=0;tick<1400;tick++){
        const p=world.entities.get(1)!.transform,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);
        if(d<.7){world.clearInput();return;}
        world.setInput({move:{x:dx/d*Math.min(1,d),z:dz/d*Math.min(1,d)}});world.update();
      }
      throw new Error(`evade seed ${seed} stalled: ${JSON.stringify(world.entities.get(1)!.transform)}`);
    };
    walk(-14,-4);await walk(0,0);walk(42,0);walk(42,-6.5);expect(m.state.steps.escape.status).toBe('active');
    walk(42,0);walk(70,0);walk(70,-7);expect(m.state.checkpoint).toBe('melee');expect(m.state.stats.deaths).toBe(0);
    expect(world.events.events().some(e=>e.type==='combat.attack')).toBe(false);world.dispose();
  }
});

test('@E19 slice complete policy finishes 20 seeds with normal movement, pickup and combat',async()=>{
  for(let seed=1;seed<=20;seed++){
    const m=await start(seed);
    const walk=(x:number,z:number)=>{
      for(let i=0;i<1500;i++){
        const p=world.entities.get(1)!.transform,d=Math.hypot(x-p.x,z-p.z);if(d<.7){world.clearInput();return;}
        world.setInput({move:{x:(x-p.x)/d*Math.min(1,d),z:(z-p.z)/d*Math.min(1,d)}});world.update();
      }throw new Error(`seed ${seed}: route blocked`);
    };
    walk(-14,-4);await walk(0,0);walk(42,0);walk(42,-6.5);walk(42,0);walk(70,0);walk(70,-7);
    world.clearInput();world.setInput({interact:true});world.update();world.clearInput();
    for(let i=0;i<6000&&m.state.phase==='playing';i++){
      const p=world.entities.get(1)!.transform,target=world.infected!.active.filter(e=>e.health.current>0).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z))[0];
      if(target)world.setInput({attackTarget:{id:target.id,side:'LEFT'},left:{down:false,held:true,up:false}});
      world.update();
    }
    expect(m.state.phase,`seed ${seed}: ${JSON.stringify({p:world.entities.get(1)!.transform,hp:world.entities.get(1)!.health,steps:m.state.steps,actors:world.infected!.active.map(e=>({id:e.id,p:e.transform,hp:e.health.current,state:e.infected!.state}))})}`).toBe('result');expect(m.state.stats.kills).toBe(5);expect(m.state.stats.deaths).toBeLessThanOrEqual(2);world.dispose();
  }
});
