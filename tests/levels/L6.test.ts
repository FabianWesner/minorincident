import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { loadL6, runL6 } from '../../tools/sim-runner/l6Bots';
import { l6, l6InjuryLines } from '../../src/data/l6';
import { validateMission } from '../../src/sim/missions/schema';
import type { SimWorld } from '../../src/sim/world/SimWorld';
let world:SimWorld|undefined;
afterEach(()=>{world?.dispose();world=undefined;});
const step=(w:SimWorld,n:number)=>{for(let i=0;i<n;i++)w.update();};
const save=(name:string,data:unknown)=>{mkdirSync('test-results/epics/E24',{recursive:true});writeFileSync(`test-results/epics/E24/${name}.json`,JSON.stringify(data,null,2));};
test('T-E24-01 @E24 @E24-AC01 graph shelter -> stop -> retreat -> exit has no fail timer or survivor fail',async()=>{
  const l=await loadL6();world=l.world;const m=l.mission;expect(validateMission(m.def)).toEqual([]);expect(m.def.steps.map(s=>s.id)).toEqual(['shelter','stop','retreat','exit']);expect(m.def.deadline).toBeUndefined();expect(m.def.steps.every(s=>!s.timer&&!s.fail.length)).toBe(true);
  for(let i=0;i<4;i++)m.completeObjective();expect(m.state.phase).toBe('cinematic');step(world,400);expect(m.state.phase).toBe('result');expect(m.state.result!.survivorsIn).toBe(29);
});
test('T-E24-04 @E24 @E24-AC04 @E24-AC05 @E08-AC11 calm adult routines, carried ids, readable injury dialogue, no weapon pickup and no early combat',async()=>{
  const l=await loadL6(7,'high',['rosa','mia']);world=l.world;const s=l.mission.state.l6!;expect(s.survivors).toHaveLength(26);expect(s.survivors.slice(24).map(s=>s.key)).toEqual(['rosa','mia']);expect(new Set(s.survivors.map(r=>r.routine))).toEqual(new Set(['guard','sit','talk','treat','rest','share']));expect(s.survivors.filter(r=>r.injured).length).toBeGreaterThanOrEqual(5);
  expect(s.say?.text).toBe(l6InjuryLines.treatment);const rack=structuredClone(world.entities.get(1)!.weapons!);step(world,5*60);expect(s.say?.text).toBe(l6InjuryLines.patient);expect(s.say!.until-s.say!.at).toBe(270);step(world,23*60);expect(world.infected!.director.count).toBe(0);expect(world.events.events().filter(e=>e.type.startsWith('combat.'))).toEqual([]);expect(world.events.events().some(e=>e.type==='story.say'&&e.text===l6InjuryLines.treatment)).toBe(true);expect(world.entities.values().filter(e=>e.pickup)).toEqual([]);expect(world.entities.get(1)!.weapons).toEqual(rack);
  const low=await loadL6(1,'low',[]);expect(low.mission.state.l6!.survivors).toHaveLength(15);low.world.dispose();save('shelter',{high:s.survivors.length,low:15,carried:['rosa','mia'],injured:s.survivors.filter(r=>r.injured).length});
});
test('T-E24-06 @E24 @E24-AC06 @E24-AC07 @E24-AC13 idle two breaches, bangs, immediate power failure, first-of abandonment and caps',async()=>{
  const l=await loadL6(3);world=l.world;world.combat!.damage.god=true;const s=l.mission.state.l6!;const events: {type:string;tick:number}[]=[];
  for(const type of ['l6.bang','l6.breach1','l6.breach2','power.off','l6.abandon'] as const)world.events.on(type,e=>events.push({type:e.type,tick:e.tick}));
  step(world,s.breach2At+16*60);expect(s.abandonAt).toBeGreaterThanOrEqual(s.breach2At);expect(s.abandonAt).toBeLessThanOrEqual(s.breach2At+900);expect((s.breach2At-s.breach1At)/60).toBeGreaterThanOrEqual(20);expect((s.breach2At-s.breach1At)/60).toBeLessThanOrEqual(30);expect(s.spawnLog.filter(e=>e.wave===1)).toHaveLength(2);expect(s.spawnLog.filter(e=>e.wave===2)).toHaveLength(8);expect(new Set(s.spawnLog.filter(e=>e.wave===2).map(e=>e.door)).size).toBe(2);
  const bangs=events.filter(e=>e.type==='l6.bang');for(const [i,type]of ['l6.breach1','l6.breach2'].entries())expect(events.find(e=>e.type===type)!.tick-bangs[i].tick).toBeGreaterThanOrEqual(90);expect(events.find(e=>e.type==='power.off')!.tick).toBe(events.find(e=>e.type==='l6.breach2')!.tick);expect(s.flashlight&&s.emergency&&!s.mainPower).toBe(true);expect(world.infected!.director.count).toBeLessThanOrEqual(60);save('breaches',{events,spawns:s.spawnLog});
});
test('T-E24-16 @E24 @E24-AC16 death restores all four checkpoint snapshots, outbreak, gates and power',async()=>{
  const l=await loadL6(4);world=l.world;const m=l.mission,w=world,evidence:Record<string,unknown>={};
  for(const id of l6.checkpoints){
    if(id==='abandon'){m.completeObjective('shelter');m.completeObjective('stop');step(w,1);}
    if(id==='mid-tunnel'||id==='exit-platform')m.checkpoint(id);
    const state=structuredClone(m.state.l6!),positions=state.survivors.map(r=>({...w.entities.get(r.id)!.transform,id:r.id})),infected=w.infected!.active.map(e=>e.id);
    step(w,20);w.player!.damage(w.entities.get(1)!.health.max,w.tick);
    for(let i=0;i<400&&w.entities.get(1)!.health.current<=0;i++)w.update();
    expect(w.entities.get(1)!.health.current).toBeGreaterThan(0);expect(m.state.checkpoint).toBe(id);expect(m.state.l6!.mainPower).toBe(state.mainPower);expect(m.state.l6!.survivors).toEqual(state.survivors);expect(m.state.l6!.gates.map(g=>g.id)).toEqual(state.gates.map(g=>g.id));expect(w.infected!.active.map(e=>e.id)).toEqual(infected);
    for(const p of positions)expect(Math.hypot(w.entities.get(p.id)!.transform.x-p.x,w.entities.get(p.id)!.transform.z-p.z)).toBeLessThan(.2);
    evidence[id]={power:state.mainPower,emergency:state.emergency,positions,infected,gates:state.gates};
  }save('checkpoints',evidence);
});
test('T-E24-02 @E24 @E24-AC02 @E24-AC10 single-seed complete bot (PO: no batteries) protects and rejoins the community',async()=>{
  const l=await loadL6(1);world=l.world;const result=runL6(world);save('complete-seed-1',result);expect(result.outcome).toBe('complete');expect(result.simSeconds).toBeGreaterThanOrEqual(180);expect(result.simSeconds).toBeLessThanOrEqual(270);expect(result.rescued/result.total).toBeGreaterThanOrEqual(.6);expect(result.peak).toBeLessThanOrEqual(60);const lag=result.fates.filter(r=>r.straggler);expect(lag.filter(r=>r.rejoined).length/lag.length).toBeGreaterThanOrEqual(.7);
},1_800_000);
test('T-E24-09 @E24 @E24-AC09 group pauses at a gate when the rear is under attack and the player is absent',async()=>{
  const l=await loadL6();world=l.world;const m=l.mission;m.completeObjective('shelter');m.completeObjective('stop');const s=m.state.l6!;s.leaderX=90;s.leaderZ=15;
  for(const r of s.survivors){const e=world.entities.get(r.id)!;e.transform.x=84;e.transform.z=15;}
  Object.assign(world.entities.get(1)!.transform,{x:30,z:15});world.infected!.spawn('infected.runner',{x:76,z:15});m.l6!.update();expect(s.paused).toBe(true);expect(s.leaderX).toBe(90);
});
test('T-E24-11 @E24 @E24-AC11 service leaf refuses to trap survivors, then blocks sight and motion',async()=>{
  const l=await loadL6();world=l.world;const m=l.mission;m.completeObjective('shelter');m.completeObjective('stop');const s=m.state.l6!,gate=s.gates[0];
  for(const r of s.survivors){const e=world.entities.get(r.id)!;e.transform.x=96;e.transform.z=15;}world.entities.get(s.survivors[0].id)!.transform.x=91;Object.assign(world.entities.get(1)!.transform,{x:91.4,z:15});
  for(let i=0;i<61;i++)m.l6!.update();expect(gate.closedAt).toBe(0);world.entities.get(s.survivors[0].id)!.transform.x=96;for(let i=0;i<61;i++)m.l6!.update();expect(gate.hold).toBe(0);world.tick=1;world.inputFrame.interact=true;m.l6!.update();world.inputFrame.interact=false;for(let i=0;i<58;i++)m.l6!.update();expect(gate.closedAt).toBe(0);m.l6!.update();expect(gate.closedAt).toBe(1);expect(world.entities.get(gate.id)!.barricade!.intact).toBe(true);expect(world.infected!.nav.visible({x:88,z:15},{x:93,z:15},0)).toBe(false);expect(world.infected!.nav.clear(90,15,.4)).toBe(false);
  const hp=world.entities.get(gate.id)!.health.max;expect(hp/(5*world.barricades!.dps('infected.runner'))).toBeCloseTo(10,1);const prop=world.props!.items.find(p=>p.assetId==='prop.crates'&&Math.abs(p.pose.p[0]-87)<1)!;world.props!.place(prop,{p:[90,.6,15],q:[0,0,0,1]});world.barricades!.braceServiceGate(gate.id);const braced=world.entities.get(gate.id)!.health.max;expect(braced).toBe(hp+(prop.metadata.barricadeHP??80));expect(prop.braced).toBe(true);world.barricades!.braceServiceGate(gate.id);expect(world.entities.get(gate.id)!.health.max).toBe(braced);save('gate',{hp,braced,holdSeconds:hp/(5*world.barricades!.dps('infected.runner'))});
});

test('T-E24-13 @E24 @E24-AC13 bitten shelter adult retains identity through the shared 2.5-3.5 s infection',async()=>{
  const l=await loadL6(9);world=l.world;const w=world,r=l.mission.state.l6!.survivors[2],victim=w.entities.get(r.id)!,look=structuredClone(victim.appearance!);
  const id=w.infected!.spawn('infected.runner',{x:victim.transform.x+.6,z:victim.transform.z},{state:'migration',perched:false});w.npcs!.civilians.outbreak!.grab(victim,w.entities.get(id)!);step(w,60);
  expect(victim.infection).toBeDefined();const started=w.tick;for(let i=0;i<300&&victim.civilian;i++)w.update();const duration=(w.tick-started)/60;
  expect(duration).toBeGreaterThanOrEqual(2.5-1/60);expect(duration).toBeLessThanOrEqual(3.5+1/60);expect(w.entities.get(r.id)).toBe(victim);expect(victim.infected).toBeDefined();expect(victim.appearance).toEqual({...look,handProp:null});expect(r.status).toBe('turned');save('infection',{id:r.id,key:r.key,duration,look:victim.appearance});
});
test('T-E24-zero @E24 @E24-AC01 all survivors lost still permits the physical exit',async()=>{
  const l=await loadL6(5);world=l.world;const m=l.mission,w=world;m.completeObjective('shelter');m.completeObjective('stop');
  for(const r of m.state.l6!.survivors)w.entities.get(r.id)!.health.current=0;
  const p=w.entities.get(1)!;Object.assign(p.transform,{x:268,y:4.62,z:15});w.physics.playerBody!.setTranslation(p.transform,true);step(w,2);expect(m.state.l6!.phase).toBe('done');expect(m.state.timeOfDay).toBe('L6');step(w,400);expect(m.state.phase).toBe('result');expect(m.state.result!.rescued).toBe(0);
});

test('T-E24-11-siege @E24 @E24-AC11 five real infected break the closed service gate in 8-12 seconds',async()=>{
  const l=await loadL6(1);world=l.world;const w=world,gate=l.mission.state.l6!.gates[0],leaf=w.entities.get(gate.id)!;w.combat!.damage.god=true;
  const p=w.entities.get(1)!;Object.assign(p.transform,{x:94,y:1.32,z:15});w.physics.playerBody!.setTranslation(p.transform,true);w.spatial.set(1,94,15);
  for(let i=0;i<5;i++)w.infected!.spawn('infected.runner',{x:88.4-Math.floor(i/3)*.5,z:14.5+(i%3)*.5},{state:'chase',yaw:0});
  step(w,20);w.barricades!.closeServiceGate(gate.id,Math.round(w.barricades!.dps('infected.runner')*5*10));
  const start=w.tick;for(let i=0;i<900&&leaf.barricade!.intact;i++)w.update();const seconds=(w.tick-start)/60;save('gate-siege',{seconds,hp:leaf.health.max,remaining:leaf.health.current,player:p.transform,attackers:w.infected!.active.map(e=>({at:e.transform,brain:e.infected}))});expect(leaf.barricade!.intact).toBe(false);expect(seconds).toBeGreaterThanOrEqual(8);expect(seconds).toBeLessThanOrEqual(12);
});

test('T-E24-03 @E24 @E24-AC03 single-seed newbie protects injured survivors within the original band',async()=>{
  const l=await loadL6(1);world=l.world;const result=runL6(world,'newbie');save('newbie-seed-1',result);
  expect(result.outcome).toBe('complete');expect(result.simSeconds).toBeGreaterThanOrEqual(195);expect(result.simSeconds).toBeLessThanOrEqual(300);expect(result.deaths).toBeLessThanOrEqual(2);expect(result.rescued/result.total).toBeGreaterThanOrEqual(.4);
},1_800_000);
