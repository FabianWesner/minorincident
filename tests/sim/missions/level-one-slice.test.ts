import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { levelOneSlice } from '../../../src/levels/levelOneSlice';
import { View } from '../../../src/render/View';
import { Matrix4 } from 'three';
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
test('@E19 @E19-AC04 morning has no attacks; diner stages one entrant before real chasing AI and caps population',async()=>{
  const m=await start();world.setInput({left:{down:true,held:true,up:false},right:{down:true,held:true,up:false}});
  for(let i=0;i<60;i++)world.update();expect(world.entities.get(1)!.weapons).toBeUndefined();expect(world.events.events().some(e=>e.type==='combat.attack')).toBe(false);
  world.clearInput();m.completeObjective('breakfast');expect(world.infected!.active).toHaveLength(1);expect(world.infected!.active[0].infected!.state).toBe('migration');
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


test('@E19 incident checkpoint restores escape, fists and live runners after death', async () => {
  const m = await start(); m.completeObjective('breakfast');
  expect(m.state.checkpoint).toBe('escape');
  world.player!.damage(100, world.tick);
  for (let i = 0; i < 125; i++) world.update();
  expect(m.state.completedObjectives).toEqual(['breakfast']);
  expect(m.state.steps.escape.status).toBe('active');
  expect(m.state.steps.melee.status).toBe('pending');
  expect(world.entities.get(1)!.weapons!.LEFT.rack[0].id).toBe('weapon.fists');
  expect(world.infected!.active.filter(e => e.health.current > 0)).toHaveLength(1);
  expect(world.infected!.active.every(e => e.combat!.damageMultiplier === .2)).toBe(true);
});

test('@E19 four incident runners cannot kill an idle unarmed survivor within 25 seconds', async () => {
  const m = await start(); const p = world.entities.get(1)!;
  Object.assign(p.transform, {x:42, z:-6.5}); world.physics.playerBody!.setTranslation(p.transform, true);
  m.completeObjective('breakfast');
  for (let i = 0; i < 1500; i++) world.update();
  expect(m.state.stats.deaths).toBe(0); expect(p.health.current).toBeGreaterThan(0);
  const damage = world.events.events().filter(e => e.type === 'player.damaged');
  expect(damage.length).toBeGreaterThan(0);
  expect(damage.every(e => e.type === 'player.damaged' && e.amount === 2)).toBe(true);
});

for (const side of ['LEFT', 'RIGHT'] as const) test(`@E19 incident ${side} unarmed action hits and kills real AI`, async () => {
  const m = await start(); const p = world.entities.get(1)!;
  Object.assign(p.transform, {x:42, z:-6.5}); world.physics.playerBody!.setTranslation(p.transform, true);
  m.completeObjective('breakfast');
  for (let i = 0; i < 2000 && m.state.stats.kills === 0; i++) {
    const target = world.infected!.active.filter(e => e.health.current > 0).sort((a,b) => Math.hypot(a.transform.x-p.transform.x,a.transform.z-p.transform.z)-Math.hypot(b.transform.x-p.transform.x,b.transform.z-p.transform.z))[0];
    world.setInput({attackTarget:{id:target.id,side}, [side === 'LEFT' ? 'left' : 'right']:{down:false,held:true,up:false}}); world.update();
  }
  expect(m.state.stats.kills).toBeGreaterThan(0); expect(m.state.stats.deaths).toBe(0);
  expect(world.events.events().some(e => e.type === 'combat.hit' && e.sourceId === 1 && e.amount > 0 && e.actionId === (side === 'LEFT' ? 'weapon.fists' : 'weapon.kick'))).toBe(true);
});

test('@E19 loaded ground edges stop direct movement at both outer and missing-district boundaries after decay', async () => {
  await start();
  for (const tier of [0, 1] as const) {
    world.setTier(tier);
    for (const edge of [{x:0,z:-25,move:{x:0,z:-1}}, {x:0,z:25,move:{x:0,z:1}}, {x:81,z:0,move:{x:1,z:0}}, {x:0,z:0,move:{x:-1,z:0}}]) {
      const p = world.entities.get(1)!;
      Object.assign(p.transform, {x:edge.x,z:edge.z,y:.705}); world.physics.playerBody!.setTranslation(p.transform,true);
      world.setInput({move:edge.move});
      for (let i = 0; i < 1500; i++) { world.update(); expect(p.transform.y).toBeGreaterThan(.65); }
      expect(world.districts!.nav.walkable([p.transform.x,p.transform.z])).toBe(true);
      expect(p.health.current).toBe(100);
    }
  }
  for (const target of [[1000,1000],[-1000,-1000],[0,60],[42,-10]] as [number,number][]) {
    const clamped = world.districts!.nav.clamp(target); expect(world.districts!.nav.walkable(clamped)).toBe(true);
    world.clearInput(); world.setInput({moveTarget:{x:target[0],z:target[1]}}); world.update();
    expect(world.controls.moveTarget).toEqual({x:clamped[0],z:clamped[1]});
  }
});


test('@E19 @E19-AC06 M1-10 entrant walks offscreen, bites three visible customers, then chases; checkpoint keeps staging', async () => {
  const m = await start(); const p = world.entities.get(1)!;
  Object.assign(p.transform, {x:42,z:-6.5}); world.physics.playerBody!.setTranslation(p.transform,true);
  m.completeObjective('breakfast');
  // Retreating lets nearer customers carry the chain; standing close draws attacks immediately.
  Object.assign(p.transform, {x:80,z:0}); world.physics.playerBody!.setTranslation(p.transform,true);
  const entrant = world.infected!.active[0];
  expect(world.infected!.director.visible(entrant.transform)).toBe(false);
  expect(m.state.outbreak!.victims).toHaveLength(3);
  expect(world.infected!.active).toHaveLength(1);
  for (let i=0;i<3600 && !m.state.outbreak!.released;i++) world.update();
  expect(m.state.outbreak!.released).toBe(true);
  expect(world.infected!.active.filter(e=>e.health.current>0)).toHaveLength(4);
  const events = world.events.events();
  for (const id of m.state.outbreak!.victims) {
    const sequence = events.filter(e=>e.type==='civilian.state'&&e.id===id).map(e=>e.type==='civilian.state'?e.state:'');
    expect(sequence).toEqual(expect.arrayContaining(['grabbed','bitten','down','rising','infected']));
    expect(events.some(e=>e.type==='civilian.eyes'&&e.id===id)).toBe(true);
    const turned = events.find(e=>e.type==='civilian.turned'&&e.id===id);
    expect(turned).toBeDefined();
  }
  expect(world.infected!.active.every(e=>['alerted','chase','attack'].includes(e.infected!.state) || e.infected!.state === 'migration' && !!world.entities.get(e.infected!.targetId)?.civilian)).toBe(true);
  m.restore('escape'); expect(m.state.outbreak!.released).toBe(false); expect(world.infected!.active).toHaveLength(1);
});


for (const [width,height] of [[1600,900],[390,844]]) for (const zoom of [-10,10]) test(`@E19 M1-10 store back-door silhouettes are offscreen or occluded at ${width}x${height} zoom ${zoom}`, async () => {
  const m=await start(),p=world.entities.get(1)!;
  Object.assign(p.transform,{x:70,z:-7});world.physics.playerBody!.setTranslation(p.transform,true);
  const view=new View();view.resize(width,height);view.reset(p.transform);view.zoom(zoom);view.update(p.transform,2);
  const matrix=new Matrix4().multiplyMatrices(view.camera.projectionMatrix,view.camera.matrixWorldInverse);
  world.infected!.director.setFrustum(matrix.elements,view.camera.position);
  m.completeObjective('breakfast');m.completeObjective('escape');m.completeObjective('melee');
  expect(world.infected!.active).toHaveLength(5);
  for(const e of world.infected!.active){
    const d=world.infected!.director,point=e.transform;
    expect(d.offscreen(point)||d.occluded(point)).toBe(true);
    expect(point.z).toBeLessThanOrEqual(m.def.anchors.hardware.z-12);
  }
});


test('@E19 M1-23 M1-24 each diner rise releases its own brain before the chain finishes', async () => {
  const m = await start(), player = world.entities.get(1)!;
  Object.assign(player.transform, { x: 42, z: -6.5 }); world.physics.playerBody!.setTranslation(player.transform, true);
  world.combat!.damage.god = true; m.completeObjective('breakfast');
  Object.assign(player.transform, { x: 80, z: 0 }); world.physics.playerBody!.setTranslation(player.transform, true);
  const initialVictims = [...m.state.outbreak!.victims], movements = new Set<number>();
  let firstTurn = 0, actionBeforeLastTurn = false, maxInfected = 0;
  const births = new Map<number, { tick: number; x: number; z: number }>();
  for (let i = 0; i < 3600; i++) {
    world.update(); maxInfected = Math.max(maxInfected, world.infected!.director.count);
    for (const id of initialVictims) {
      const e = world.entities.get(id)!;
      if (e.civilian!.state === 'flee' && e.motion!.moving) movements.add(id);
    }
    for (const event of world.events.events(world.tick - 1)) if (event.type === 'civilian.turned' && !births.has(event.infectedId)) {
      const e = world.entities.get(event.infectedId)!;
      births.set(event.infectedId, { tick: event.tick, x: e.transform.x, z: e.transform.z }); firstTurn ||= event.tick;
    }
    const unfinished = initialVictims.some(id => !['infected','finished'].includes(world.entities.get(id)!.civilian!.state));
    for (const [id, birth] of births) {
      const e = world.entities.get(id)!;
      expect(e.infectionRise).toBeUndefined();
      if (unfinished && (e.combat!.attacking || Math.hypot(e.transform.x - birth.x, e.transform.z - birth.z) > .1)) actionBeforeLastTurn = true;
    }
    if (m.state.outbreak!.released) break;
  }
  expect(firstTurn).toBeGreaterThan(0); expect(actionBeforeLastTurn).toBe(true); expect(movements.size).toBeGreaterThan(0);
  expect(maxInfected).toBeLessThanOrEqual(15);
  const events = world.events.events(), timings = [];
  for (const id of initialVictims) {
    const bitten = events.find(e => e.type === 'civilian.state' && e.id === id && e.state === 'bitten');
    const turned = events.find(e => e.type === 'civilian.turned' && e.id === id);
    if (bitten && turned) { timings.push(turned.tick - bitten.tick); expect(turned.tick - bitten.tick).toBeGreaterThanOrEqual(156); expect(turned.tick - bitten.tick).toBeLessThanOrEqual(180); }
  }
  expect(timings.length).toBe(3); expect(new Set(timings).size).toBeGreaterThan(1);
  m.completeObjective('escape'); expect(world.infected!.active).toHaveLength(0);
});


test('@E19 M1-23 a newborn stays grounded and harmless during its rise; killing it cancels the turn', async () => {
  const m = await start(), p = world.entities.get(1)!;
  Object.assign(p.transform, { x: 42, z: -6.5 }); world.physics.playerBody!.setTranslation(p.transform, true);
  world.combat!.damage.god = true; m.completeObjective('breakfast');
  let body = world.entities.get(m.state.outbreak!.victims[0])!;
  for (let i = 0; i < 1500 && !body.civilian!.risingInfectedId; i++) world.update();
  const newborn = world.entities.get(body.civilian!.risingInfectedId!)!;
  expect(newborn.infectionRise).toBeDefined(); expect(body.hidden).toBe(true);
  const position = { ...newborn.transform }, until = newborn.infectionRise!.until;
  for (let i = 0; i < 30; i++) {
    world.update(); expect(newborn.transform).toEqual(position); expect(newborn.combat!.attacking).toBe(false);
  }
  newborn.health.current = 0; world.update(); expect(body.civilian!.state).toBe('finished');
  expect(newborn.infectionRise).toBeUndefined();
  while (world.tick <= until + 1) world.update();
  expect(world.events.events().some(e => e.type === 'civilian.turned' && e.id === body.id)).toBe(false);
  m.restore('escape'); body = world.entities.get(m.state.outbreak!.victims[0])!;
  expect(body.hidden).toBeUndefined(); expect(body.civilian!.state).toBe('calm'); expect(world.infected!.active).toHaveLength(1);
});
