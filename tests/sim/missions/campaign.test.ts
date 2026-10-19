import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { missionControls } from '../../../src/sim/missions/controls';
import { missionIds, resolveCampaignMission } from '../../../src/levels/missions';
import { compositions } from '../../../src/levels/compositions';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { emptyInput } from '../../../src/input/InputFrame';
import { missionSandbox } from '../../fixtures/scenarios/mission-sandbox';
let world: SimWorld;
afterEach(() => world?.dispose());
for (const id of missionIds) test(`T-E12-07-${id}${id === 'L7' ? ' @E29-AC01' : ''} @E12 @E12-AC07 every cheat advances exactly one ${id} step to level.completed`, async () => {
  world = new SimWorld(); await world.init(); const composition = compositions[id];
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8'))),1);
  if (id === 'L10') applyCampaign(world, preset('L10-default'));
  world.loadMission(resolveCampaignMission(id,world.districts!)); const api = missionControls(world); api.begin();
  let calls=0;
  while(api.state()!.phase === 'playing') {
    // PO 2026-10-13 run-out: with action still going on the world runs 5 s before the level completes.
    if (api.state()!.runOutUntil !== undefined) { world.update(); continue; }
    const before=api.state()!.completedObjectives.length; api.completeObjective(); expect(api.state()!.completedObjectives.length).toBe(before+1); expect(++calls).toBeLessThan(100);
  }
  // The L7 bus owns its departure shot; its graph finishes at the ordinary result without a second cinematic.
  if (id === 'L7') {
    expect(world.missions!.def.steps.map(step => step.id)).toEqual(['rocket', 'corridor', 'departure']);
    expect(world.missions!.def.steps.every(step => step.fail.length === 0)).toBe(true);
    expect(api.state()!.completedObjectives).toEqual(['rocket', 'corridor', 'departure']);
    expect(api.state()!.phase).toBe('result');
    expect(world.events.events().filter(e => e.type === 'level.completed' && e.id === 'L7')).toHaveLength(1);
    return;
  }
  // E20: L2 ends on the closing gate with no cinematic or reward screen; the campaign continues straight into L3.
  // E21: the same for L3, which ends at the army zone line and continues into L4.
  // E22: and L4, which ends at the barred cellar door and continues into L5.
  // E23: and L5, which ends at the Metro shutter and continues into L6.
  // L8 (zoo): the APC escape continues straight into L9 like L2-L5.
  // E19: L1 now goes directly to its result screen, without the old cinematic.
  if (id === 'L1' || id === 'L10') {
    expect(api.state()!.phase).toBe('result'); expect(world.events.events().some(e => e.type === 'level.completed')).toBe(true);
    return;
  }
  if (id === 'L2' || id === 'L3' || id === 'L4' || id === 'L5' || id === 'L8' || id === 'L9') { expect(api.state()!.phase).toBe('progression'); expect(world.events.events().some(e => e.type === 'level.completed')).toBe(true); return; }
  expect(api.state()!.phase).toBe('cinematic'); world.setInput({ interact: true }); for(let i=0;i<30;i++)world.update();
  expect(api.state()!.phase).toBe('result'); expect(world.events.events().some(e => e.type === 'level.completed')).toBe(true);
}, id === 'L3' ? 120_000 : 30_000); // Match the dedicated L3 graph check's authored-wave setup timeout.
test('@E12 @E12-AC07 @E22-AC01 L4 ride -> quartermaster -> hold -> hide -> bar -> wait completes straight into progression (no cinematic, no reward screen)',async()=>{
  world=new SimWorld();await world.init();const c=compositions.L4;world.loadComposition(c,c.districts.map(d=>JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8'))));world.loadMission(resolveCampaignMission('L4',world.districts!));const api=missionControls(world);api.begin();
  api.completeObjective('ride');expect(api.state()!.states.arrived).toBe(true);api.completeObjective('quartermaster');expect(api.state()!.steps.hold.status).toBe('active');expect(api.state()!.states.turned).toBe(true);
  api.completeObjective();expect(api.state()!.states.turned).toBe(true);expect(api.state()!.states['line-broken']).toBe(true);
  api.completeObjective('hide');api.completeObjective('bar');api.completeObjective('wait');for(let i=0;i<400&&api.state()!.phase==='playing';i++)world.update();expect(api.state()!.phase).toBe('progression');
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
test('@E12 @E12-AC07 L3 armory -> defend -> fallback -> army checkpoint completes straight into progression',async()=>{
  world=new SimWorld();await world.init();const c=compositions.L3;world.loadComposition(c,c.districts.map(d=>JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8'))));world.loadMission(resolveCampaignMission('L3',world.districts!));const api=missionControls(world);api.begin();
  api.completeObjective('armory');api.completeObjective('defend');expect(api.state()!.states.fallback).toBe(true);api.completeObjective('checkpoint');expect(api.state()!.phase).toBe('progression');
}, 120_000); // Advancing the authored defense waves took >30 s under four-worker simulation load.
test('@E12 @E12-AC05 authored source checkpoint can be loaded fresh and retains its reached snapshot',async()=>{
  world=new SimWorld();await world.init();const c=compositions.L1;world.loadComposition(c,c.districts.map(d=>JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8'))),42);const m=world.loadMission(resolveCampaignMission('L1',world.districts!));m.loadCheckpoint('accident');
  expect(m.state.steps.escape.status).toBe('active');expect(m.state.checkpoint).toBe('accident');expect(world.seed).toBe(42);expect(m.state.completedObjectives).toContain('deliver');
  m.state.items.push('temporary');m.loadCheckpoint('accident');expect(m.state.items).not.toContain('temporary');
});
