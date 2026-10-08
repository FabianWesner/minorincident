import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { missionControls } from '../../../src/sim/missions/controls';
import { missionIds, resolveCampaignMission } from '../../../src/levels/missions';
import { compositions } from '../../../src/levels/compositions';
import { stateHash } from '../../../src/sim/world/stateHash';
import { emptyInput } from '../../../src/input/InputFrame';
import { missionSandbox } from '../../fixtures/scenarios/mission-sandbox';
let world: SimWorld;
afterEach(() => world?.dispose());
for (const id of missionIds) test(`T-E12-07-${id} @E12 @E12-AC07 every cheat advances exactly one ${id} step to level.completed`, async () => {
  world = new SimWorld(); await world.init(); const composition = compositions[id];
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8'))),1);
  world.loadMission(resolveCampaignMission(id,world.districts!)); const api = missionControls(world); api.begin();
  let calls=0;
  while(api.state()!.phase === 'playing') {
    const before=api.state()!.completedObjectives.length; api.completeObjective(); expect(api.state()!.completedObjectives.length).toBe(before+1); expect(++calls).toBeLessThan(100);
  }
  // E20: L2 ends on the closing gate with no cinematic or reward screen; the campaign continues straight into L3.
  if (id === 'L2') { expect(api.state()!.phase).toBe('progression'); expect(world.events.events().some(e => e.type === 'level.completed')).toBe(true); return; }
  expect(api.state()!.phase).toBe('cinematic'); world.setInput({ interact: true }); for(let i=0;i<30;i++)world.update();
  expect(api.state()!.phase).toBe('result'); expect(world.events.events().some(e => e.type === 'level.completed')).toBe(true);
});
for(const order of [['breaker-3','crossing','blockade'],['breaker-3','blockade','crossing'],['crossing','breaker-3','blockade'],['crossing','blockade','breaker-3'],['blockade','breaker-3','crossing'],['blockade','crossing','breaker-3']]) test(`@E12 @E12-AC03 L4 full graph task order ${order.join(',')}`,async()=>{
  world=new SimWorld();await world.init();const c=compositions.L4;world.loadComposition(c,c.districts.map(d=>JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8'))));world.loadMission(resolveCampaignMission('L4',world.districts!));const api=missionControls(world);api.begin();api.completeObjective('hub');
  for(const task of order){if(task==='breaker-3'){api.completeObjective('breaker-1');api.completeObjective('breaker-2');}if(task==='crossing')api.completeObjective('fuse');api.completeObjective(task);}
  expect(api.state()!.steps.bridge.status).toBe('active');api.completeObjective('bridge');expect(api.state()!.phase).toBe('cinematic');
});
for (const action of ['left','right','interact','selector','move','pause'] as const) test(`T-E12-06-${action} @E12 @E12-AC06 ${action} skips at 0.5s and watch/skip gameplay hashes match`, async () => {
  const def=missionSandbox();def.onComplete=[{kind:'cinematic',id:'twist'}];
  const run=async(skip:boolean)=>{
    world=new SimWorld();await world.init();world.loadScenario('mission-sandbox');world.loadMission(def);const api=missionControls(world);api.begin();api.completeObjective();const frozen=world.tick;
    const input=emptyInput();if(action==='left'||action==='right')input[action].held=true;else if(action==='move')input.move.x=1;else if(action==='selector')input.selector=1;else input[action]=true;
    world.setInput(skip?input:emptyInput());for(let i=0;i<29;i++)world.update();expect(api.state()!.phase).toBe('cinematic');expect(world.tick).toBe(frozen);
    world.update();if(skip)expect(api.state()!.phase).toBe('result');else {expect(api.state()!.phase).toBe('cinematic');for(let i=30;i<120;i++)world.update();}
    expect(api.state()!.phase).toBe('result');expect(api.state()!.items).toContain('keys');expect(api.state()!.gates.exit).toBe(true);const hash=stateHash(world.getState());world.dispose();return hash;
  };
  expect(await run(true)).toBe(await run(false));
});
test('@E12 @E12-AC07 L3 park route cancels the alternative and reaches the finale',async()=>{
  world=new SimWorld();await world.init();const c=compositions.L3;world.loadComposition(c,c.districts.map(d=>JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8'))));world.loadMission(resolveCampaignMission('L3',world.districts!));const api=missionControls(world);api.begin();api.completeObjective('forecourt');api.completeObjective('car');api.completeObjective('park-route');expect(api.state()!.steps['market-route'].status).toBe('cancelled');for(const id of ['park-rescue','park-cover','approach','checkpoint','checkpoint-cover','patient','gates'])api.completeObjective(id);expect(api.state()!.phase).toBe('cinematic');
});
test('@E12 @E12-AC05 authored source checkpoint can be loaded fresh and retains its reached snapshot',async()=>{
  world=new SimWorld();await world.init();const c=compositions.L1;world.loadComposition(c,c.districts.map(d=>JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8'))),42);const m=world.loadMission(resolveCampaignMission('L1',world.districts!));m.loadCheckpoint('accident');
  expect(m.state.steps.escape.status).toBe('active');expect(m.state.checkpoint).toBe('accident');expect(world.seed).toBe(42);expect(m.state.completedObjectives).toContain('deliver');
  m.state.items.push('temporary');m.loadCheckpoint('accident');expect(m.state.items).not.toContain('temporary');
});
