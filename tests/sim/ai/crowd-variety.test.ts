import { expect, test } from 'vitest';
import { arena, spawn } from './helpers';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';

test('ordinary spawns share seven looks within 25%, scripted variants stay authored and pool reuse gets a fresh look @E07', async () => {
  const w = await arena();
  for (let i=0;i<20;i++) spawn(w,'runner', (i%5)*2-4,Math.floor(i/5)*2+8,'idle');
  const ai = w.infected!, counts = regularInfectedModels.map(m => ai.active.filter(e=>e.infected!.variant===m).length);
  expect(ai.active).toHaveLength(20); expect(Math.max(...counts)/20).toBeLessThanOrEqual(.25); expect(counts.every(n=>n>0)).toBe(true);
  const scripted = ai.spawn('infected.runner', {x:12,z:8}, {variant:'inf.delivery-driver'});
  expect(w.entities.get(scripted)!.infected!.variant).toBe('inf.delivery-driver');
  const old = ai.active[0], oldId = old.id; ai.release(old);
  const id = ai.spawn('infected.runner',{x:0,z:8}); expect(id).not.toBe(oldId); expect(w.entities.get(id)).toBe(old);
  expect(regularInfectedModels).toContain(old.infected!.variant); expect(old.appearance).toBeUndefined();
  w.dispose();
});

test('L6 maintenance arrivals use a balanced cast instead of one repeated aftermath model @E24 @E07', async () => {
  const { Outbreak } = await import('../../../src/sim/outbreak/Outbreak');
  const { LevelSixSubway } = await import('../../../src/sim/missions/LevelSixSubway');
  const { l6BreachModels } = await import('../../../src/data/l6');
  const w = await arena();
  w.npcs!.civilians.outbreak = new Outbreak(w,{refuges:[]});
  const state = { infectedIds:[] as number[], spawnLog:[] };
  const controller = new LevelSixSubway({world:w,state:{l6:state}} as unknown as import('../../../src/sim/missions/Mission').Mission);
  (controller as unknown as {spawn(n:number,doors:number[],wave:number):void}).spawn(20,[0,1],1);
  expect(state.infectedIds).toHaveLength(20);
  const counts = l6BreachModels.map(model=>state.infectedIds.filter(id=>w.entities.get(id)!.appearance!.asset===model).length);
  expect(Math.max(...counts)/20).toBeLessThanOrEqual(.25); expect(counts).toEqual([4,4,4,4,4]);
  w.dispose();
});


test('dressing regular infected balances their own cohort even beside an authored pedestrian crowd @E07 @E08', async () => {
  const { Outbreak } = await import('../../../src/sim/outbreak/Outbreak');
  const { l1Pedestrians } = await import('../../../src/data/npcs');
  const w = await arena(), outbreak = new Outbreak(w,{refuges:[]});
  for (let i=0;i<30;i++) outbreak.spawnPedestrian({x:i%6-3,z:Math.floor(i/6)}, {model:i%2 ? 'npc.civilian-man-a' : 'npc.civilian-man-b'});
  for (let i=0;i<20;i++) spawn(w,'runner',(i%5)*2-4,Math.floor(i/5)*2+8,'idle');
  outbreak.dressInfected();
  const counts = l1Pedestrians.models.map(model=>w.infected!.active.filter(e=>e.appearance?.asset===model).length);
  expect(counts).toEqual([4,4,4,4,4]);
  outbreak.dispose(); w.dispose();
});
