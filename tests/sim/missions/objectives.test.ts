import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { missionControls } from '../../../src/sim/missions/controls';
import { objectiveTypes } from '../../../src/sim/missions/types';
import { missionSandbox } from '../../fixtures/scenarios/mission-sandbox';
let world: SimWorld;
afterEach(() => world?.dispose());
async function load(def = missionSandbox()) {
  world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 1); world.scenario = 'mission-sandbox'; world.loadMission(def);
  const api = missionControls(world); api.begin(); return api;
}
function step(ticks = 1) { for (let i = 0; i < ticks; i++) world.update(); }
function teleport(id: number, x = 5, z = 0) { missionControls(world).teleport(id,{x,z}); }
function kill(id: number) { const actor=Object.entries(world.missions!.state.actors).find(([,entity])=>entity===id)![0]; missionControls(world).damageActor(actor,10000); }
for (const type of objectiveTypes) test(`T-E12-02-${type} @E12 @E12-AC02 mission-sandbox completes ${type} through sim controls`, async () => {
  const api = await load(missionSandbox(type)), actors = api.state()!.actors;
  switch (type) {
    case 'reach': teleport(1); break;
    case 'interact': teleport(1); world.setInput({ interact: true }); break;
    case 'kill': kill(actors.boss); break;
    case 'killAll': kill(actors.boss); step(); expect(api.state()!.completedObjectives).toEqual([]); kill(actors.runner); break;
    case 'survive': case 'defend': step(119); expect(api.state()!.completedObjectives).toEqual([]); break;
    case 'escort': teleport(actors.escort); break;
    case 'collect': api.collect('fuse'); step(); expect(api.state()!.completedObjectives).toEqual([]); api.collect('keys'); break;
    case 'drive': teleport(actors.car); step(); expect(api.state()!.completedObjectives).toEqual([]); api.setState('driving:car', true); break;
    case 'custom': api.count('breakers', 2); step(); expect(api.state()!.completedObjectives).toEqual([]); api.count('breakers'); break;
  }
  step(); expect(api.state()!.completedObjectives).toEqual([type]);
  expect(world.events.events().filter(e => e.type === 'objective.started' || e.type === 'objective.completed')).toEqual([
    { tick: 0, type: 'objective.started', id: type }, { tick: world.tick, type: 'objective.completed', id: type },
  ]);
});
const permutations = [['a','b','c'], ['a','c','b'], ['b','a','c'], ['b','c','a'], ['c','a','b'], ['c','b','a']];
for (const order of permutations) test(`T-E12-03-${order.join('')} @E12 @E12-AC03 parallel tasks join in ${order.join(',')}`, async () => {
  const def = missionSandbox('custom'), template = def.steps[0]; def.states.push('a','b','c');
  def.steps = ['a','b','c'].map(id => ({ ...template, id, complete: { kind: 'state', key: id, equals: true } }));
  def.steps.push({ ...template, id: 'join', start: { kind: 'objectives', ids: ['a','b','c'], mode: 'all' }, complete: { kind: 'timer', seconds: 1 } }); def.finish = ['join'];
  const api = await load(def);
  for (const [i, id] of order.entries()) { api.setState(id, true); step(); expect(api.state()!.completedObjectives).toEqual(order.slice(0, i+1)); expect(api.state()!.steps.join.status).toBe(i === 2 ? 'active' : 'pending'); }
  step(60); expect(api.state()!.phase).toBe('result');
});
test('T-E12-04 @E12 @E12-AC04 timeout at exactly 120s, retry restores timer, completing cancels timeout', async () => {
  const def = missionSandbox(); def.steps[0].timer = 120; const api = await load(def);
  step(7199); expect(api.state()!.phase).toBe('playing'); step(); expect(world.events.events()).toContainEqual({ type: 'mission.failed', tick: 7200, reason: 'timeout' });
  api.retry(); expect(api.state()!.steps.reach.started).toBe(7200); step(7199); expect(api.state()!.phase).toBe('playing');
  teleport(1); step(); expect(api.state()!.phase).toBe('retry'); // deadline takes precedence
  api.retry(); teleport(1); step(1); expect(api.state()!.phase).toBe('result'); step(7201); expect(api.state()!.phase).toBe('result');
});
test('T-E12-05 @E12 @E12-AC05 death restores C objectives, full HP, charges and escorts; scripted boss remains dead', async () => {
  const def = missionSandbox('kill'); def.steps.push({ ...def.steps[0], id: 'reach', type: 'reach', start: { kind: 'objectives', ids: ['kill'], mode: 'all' }, complete: { kind: 'volume', anchor: 'goal', edge: 'inside' } }); def.finish = ['reach'];
  const api = await load(def), actor = api.state()!.actors;
  kill(actor.boss); api.completeObjective('kill'); world.entities.get(1)!.weapons!.RIGHT.rack[0].charges = 2;
  teleport(1, 1); api.checkpoint('C'); const saved = api.state()!;
  teleport(actor.escort, 20); world.entities.get(1)!.weapons!.RIGHT.rack[0].charges = 0;
  world.player!.damage(1000, world.tick); step(120);
  expect(api.state()!.completedObjectives).toEqual(saved.completedObjectives); expect(world.entities.get(1)!.health.current).toBe(100);
  expect(world.entities.get(1)!.weapons!.RIGHT.rack[0].charges).toBe(2); expect(world.entities.get(actor.escort)!.transform.x).toBe(-5); expect(world.entities.get(actor.boss)!.health.current).toBe(0);
  expect(api.state()!.stats.deaths).toBe(1); expect(api.state()!.stats.damage).toBe(100);
});
for (const type of ['escort','defend'] as const) test(`@E12 ${type} failure shows retry and restores actors`, async () => {
  const api = await load(missionSandbox(type)); kill(api.state()!.actors[type === 'escort' ? 'escort' : 'target']); step();
  expect(api.state()!.failure).toBe(type === 'escort' ? 'escort-died' : 'target-destroyed'); expect(api.state()!.phase).toBe('retry'); api.retry(); expect(api.state()!.phase).toBe('playing');
});
test('@E12 volume enter/exit latches, stand-to-interact cancels outside, filtered signals count', async () => {
  const def = missionSandbox(); def.steps[0].complete = { kind: 'volume', anchor: 'goal', edge: 'exit' }; const api = await load(def);
  step(); expect(api.state()!.completedObjectives).toEqual([]); teleport(1); step(); expect(api.state()!.completedObjectives).toEqual([]); teleport(1, 0); step(); expect(api.state()!.phase).toBe('result');
  world.dispose(); const stand = await load(missionSandbox('interact')); teleport(1); step(35); expect(stand.state()!.phase).toBe('playing'); teleport(1, 0); step(); teleport(1); step(35); expect(stand.state()!.phase).toBe('playing'); step(); expect(stand.state()!.phase).toBe('result');
  world.dispose(); const eventDef = missionSandbox('custom'); eventDef.steps[0].complete = { kind: 'event', type: 'device.used', actor: 'car', count: 2 }; const events = await load(eventDef);
  events.signal('device.used','escort'); step(); events.signal('device.used','car'); step(); expect(events.state()!.phase).toBe('playing'); events.signal('device.used','car'); step(); expect(events.state()!.phase).toBe('result');
});
test('@E12 @E12-AC05 a boss killed after C stays dead and its restored objective is completable',async()=>{
  const def=missionSandbox('kill');def.steps.push({...def.steps[0],id:'next',type:'reach',start:{kind:'objectives',ids:['kill'],mode:'all'},complete:{kind:'volume',anchor:'goal',edge:'inside'}});def.finish=['next'];
  const api=await load(def);api.checkpoint('C');const boss=api.state()!.actors.boss;kill(boss);step();expect(api.state()!.completedObjectives).toEqual(['kill']);world.player!.damage(1000,world.tick);step(120);
  expect(world.entities.get(boss)!.health.current).toBe(0);step();expect(api.state()!.completedObjectives).toEqual(['kill']);api.completeObjective('next');expect(api.state()!.phase).toBe('result');
});
test('@E12 scripted spawn/migration/gate/item/time/state/checkpoint/marker actions are observable and gates collide',async()=>{
  const def=missionSandbox();def.onStart.push({kind:'migration',group:'actors',to:'goal'},{kind:'timeOfDay',value:'L5'},{kind:'state',key:'power',value:true},{kind:'grant',item:'fuse'},{kind:'checkpoint',id:'C'},{kind:'marker',anchor:'goal'});
  def.steps[0].onComplete=[{kind:'gate',id:'exit',open:true}];
  const api=await load(def);expect(api.state()!).toMatchObject({items:['fuse'],states:{power:true},timeOfDay:'L5',checkpoint:'C',marker:'goal'});
  expect(world.events.events()).toContainEqual({type:'migration.started',id:'actors',to:def.anchors.goal,tick:0});
  const gates: boolean[]=[];world.physics.world!.colliders.forEach(c=>{if(c.translation().x===5)gates.push(c.isEnabled());});expect(gates).toEqual([true]);
  api.completeObjective();expect(api.state()!.gates.exit).toBe(true);
});
test('@E12 @E12-AC04 a completed timed objective cannot fail while another parallel task continues',async()=>{
  const def=missionSandbox();def.steps[0].timer=120;def.steps.push({...def.steps[0],id:'parallel',type:'custom',timer:undefined,complete:{kind:'state',key:'power',equals:true}});def.finish=['reach','parallel'];
  const api=await load(def);teleport(1);step();expect(api.state()!.steps.reach.status).toBe('completed');step(7201);expect(api.state()!.phase).toBe('playing');expect(world.events.events().some(e=>e.type==='mission.failed')).toBe(false);api.setState('power',true);step();expect(api.state()!.phase).toBe('result');
});
test('@E12 @E12-AC05 restoring an inside-volume checkpoint does not invent a new enter edge',async()=>{
  const def=missionSandbox();def.steps[0].complete={kind:'all',triggers:[{kind:'volume',anchor:'goal',edge:'enter'},{kind:'state',key:'power',equals:true}]};const api=await load(def);
  teleport(1);step();api.checkpoint('C');teleport(1,0);step();api.restore('C');api.setState('power',true);step();expect(api.state()!.phase).toBe('playing');teleport(1,0);step();teleport(1);step();expect(api.state()!.phase).toBe('result');
});
test('@E12 @E12-AC04 timeout still fires while the player waits to respawn',async()=>{
  const def=missionSandbox();def.steps[0].timer=1;const api=await load(def);world.player!.damage(1000,0);step(60);expect(api.state()!.phase).toBe('retry');expect(world.events.events()).toContainEqual({type:'mission.failed',tick:60,reason:'timeout'});
});
test('@E12 @E12-AC09 optional objective achievement is counted once across checkpoint retries',async()=>{
  const def=missionSandbox();def.steps[0].optional=true;def.steps.push({...def.steps[0],id:'main',type:'custom',optional:false,complete:{kind:'state',key:'power',equals:true}});def.finish=['main'];const api=await load(def);api.checkpoint('C');teleport(1);step();api.restore('C');teleport(1);step();api.completeObjective('main');expect(api.state()!.result!.optionalObjectives).toEqual(['reach']);
});
test('@E12 @E12-AC06 a skippable failure cinematic ends on Retry',async()=>{
  const def=missionSandbox();def.steps[0].timer=1/60;def.steps[0].onFail=[{kind:'cinematic',id:'twist'}];const api=await load(def);step();expect(api.state()!.phase).toBe('cinematic');world.setInput({interact:true});step(30);expect(api.state()!.phase).toBe('retry');expect(api.state()!.failure).toBe('timeout');
});
