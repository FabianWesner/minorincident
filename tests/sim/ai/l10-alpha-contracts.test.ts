import { readFileSync } from 'node:fs';
import { compositions } from '../../../src/levels/compositions';
import { installNpcSystems } from '../../../src/sim/npc/install';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { cureAlphaPopulation } from '../../../src/levels/L10/alphaContracts';
import { expect, test } from 'vitest';
import { arena, spawn, step, hit } from './helpers';
import { cureAlphaCap, cureAlphaCounts, cureRegularAlphaCount, type CureRegion } from '../../../src/levels/L10/alphaContracts';
import { dogModel } from '../../../src/data/dogAppearance';
import { MegaPursuit } from '../../../src/sim/ai/MegaPursuit';

for (const tier of ['high', 'low'] as const) test(`T-E32-09-count-${tier} @E32 @E32-AC09 authored regional quotas include dead records and exclude Mega; mixed infected share the global cap`, async () => {
  const w = await arena(); w.scenario = 'L10'; const ai = w.infected!; ai.director.setTier(tier); ai.director.strict = true;
  for (const region of Object.keys(cureAlphaCounts) as CureRegion[]) {
    const cap = cureAlphaCap(region, tier);
    for (let i = 0; i < cap; i++) ai.spawn('infected.alpha', { x: 20, z: i * 3 }, { cureRegion: region });
    expect(cureRegularAlphaCount(w.entities.iterate(), region)).toBe(cap);
    expect(() => ai.spawn('infected.alpha', { x: 20, z: 9 }, { cureRegion: region })).toThrow(/region cap/);
  }
  expect(() => ai.spawn('infected.alpha', { x: 20, z: 9 })).toThrow(/authored cure region/);
  const boss = w.megaPursuit = new MegaPursuit(w, { spawn: { x: -20, z: 0 }, introduceTick: null });
  boss.introduce();
  expect(ai.active.filter(e => e.infected?.pursuit)).toHaveLength(1);
  expect(cureRegularAlphaCount(w.entities.iterate(), 'industrial-area')).toBe(1);
  const alpha = ai.active.find(e => e.infected?.cureRegion === 'industrial-area')!;
  hit(w, alpha.id, 10000, 'bullet');
  expect(alpha.health.current).toBe(0);
  expect(() => ai.spawn('infected.alpha', { x: 20, z: 9 }, { cureRegion: 'industrial-area' })).toThrow(/region cap/);
  while (ai.director.count < ai.director.cap) spawn(w, 'dog', 20, 20, 'idle');
  expect(ai.director.count).toBe(tier === 'high' ? 200 : 100);
  expect(() => spawn(w, 'dog', 20, 20, 'idle')).toThrow(/concurrency cap/);
});

test('T-E32-09-queue @E32 @E32-AC09 queued Alpha admission waits at the regional assault cap and retains ownership', async () => {
  const w = await arena(), ai = w.infected!; ai.director.setTier('low');
  for (let i = 0; i < 3; i++) ai.director.request('infected.alpha', { x: 50, z: i * 3 }, { cureRegion: 'dispersal-complex', state: 'idle' });
  ai.director.update(); expect(ai.active).toHaveLength(2); expect(ai.director.queue).toHaveLength(1);
  const dead = ai.active[0]; hit(w, dead.id, 10000, 'explosive'); ai.director.update();
  expect(ai.director.queue).toHaveLength(0);
  expect(cureRegularAlphaCount(w.entities.iterate(), 'dispersal-complex')).toBe(2);
});

test('T-E32-09-specials @E32 @E32-AC09 L10 regular Alphas use all four stock specials, cooldowns and conventional resistance', async () => {
  const w = await arena(); w.scenario = 'L10'; const ai = w.infected!;
  for (const move of ['alpha.charge', 'alpha.ground-slam', 'alpha.grab-throw', 'alpha.roar'] as const) {
    const alpha = w.entities.get(ai.spawn('infected.alpha', { x: 6, z: 0 }, { cureRegion: 'military-zone', state: 'idle' }))!;
    expect(ai.startSpecial(alpha.id, move, { id: 1, x: 0, z: 0 }, { x: 6, z: 0, dx: -1, dz: 0, radius: 4 })).toBe(true);
    expect(alpha.infected!.specialAttack!.move).toBe(move);
    expect(ai.startSpecial(alpha.id, move, { id: 1, x: 0, z: 0 }, { x: 6, z: 0, dx: -1, dz: 0, radius: 4 })).toBe(false);
    ai.release(alpha);
  }
  const alpha = w.entities.get(ai.spawn('infected.alpha', { x: 6, z: 0 }, { cureRegion: 'industrial-area' }))!;
  const hp = alpha.health.current; expect(hit(w, alpha.id, 20, 'bullet')).toBe(10); expect(alpha.health.current).toBe(hp - 10);
  hit(w, alpha.id, 10000, 'bullet'); expect(alpha.health.current).toBe(0);
});

test('T-E32-07-spawn-coats @E32 @E32-AC07 actual dog spawns choose seeded palette assets and preserve explicit overrides', async () => {
  const w = await arena(), models = new Set<string>();
  for (let i = 0; i < 24; i++) { const dog = spawn(w, 'dog', 10, 10, 'idle'); expect(dog.infected!.variant).toBe(dogModel(w.seed, dog.id, true)); models.add(dog.infected!.variant); }
  expect(models.size).toBe(3);
  const id = w.infected!.spawn('infected.dog', { x: 10, z: 10 }, { variant: 'inf.dog.cream' }); expect(w.entities.get(id)!.infected!.variant).toBe('inf.dog.cream');
  const pets = new Set<string>();
  for (let i = 0; i < 24; i++) { const id = w.npcs!.civilians.spawn('dog', { x: 10, z: 10 }, { pet: 'dog', waypoints: [{ x: 10, z: 10 }] }); const pet = w.entities.get(id)!; expect(pet.civilian!.model).toBe(dogModel(w.seed, id, false)); pets.add(pet.civilian!.model!); }
  expect(pets.size).toBe(3);
  step(w, 1);
});

for (const tier of ['high', 'low'] as const) test(`T-E32-09-stream-${tier} @E32 @E32-AC09 serialized Alpha ownership and dog coat survive five revisits and save/load`, async () => {
  const w = await arena();
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')) as DistrictLayout;
  w.loadComposition(compositions['D-CROSSING'], [layout], 32); installNpcSystems(w); w.scenario = 'L10';
  const focus = (x: number, z: number) => { Object.assign(w.entities.get(1)!.transform, { x, z }); w.chunks!.update([x, z]); };
  w.chunks!.setQuality(tier); focus(0, -330);
  const ai = w.infected!, id = ai.spawn('infected.alpha', { x: 8, z: -325 }, { cureRegion: 'industrial-area' });
  const dogId = ai.spawn('infected.dog', { x: 14, z: -325 }), coat = w.entities.get(dogId)!.infected!.variant;
  for (let i = 0; i < 5; i++) {
    focus(450, 220); expect(w.entities.get(id)).toBeUndefined();
    expect(cureRegularAlphaCount(cureAlphaPopulation(w), 'industrial-area')).toBe(1);
    const save = JSON.parse(JSON.stringify(w.chunks!.save())); w.chunks!.load(save);
    expect(() => ai.spawn('infected.alpha', { x: 450, z: 220 }, { cureRegion: 'industrial-area' })).toThrow(/region cap/);
    focus(0, -330); expect(w.entities.get(id)!.infected!.cureRegion).toBe('industrial-area');
    expect(w.entities.get(dogId)!.infected!.variant).toBe(coat);
    expect(cureRegularAlphaCount(cureAlphaPopulation(w), 'industrial-area')).toBe(1);
  }
});

test('T-E32-07-pet-turn @E32 @E32-AC07 a scheduled healthy dog turns on the dog brain and retains its seeded infected coat', async () => {
  const w = await arena();
  const id = w.npcs!.civilians.spawn('dog', { x: 10, z: 10 }, { pet: 'dog', waypoints: [{ x: 10, z: 10 }], schedule: [{ activity: 'stand', anchor: 'dog', target: { x: 10, z: 10 }, ticks: 600 }] });
  const dog = w.entities.get(id)!, coat = dog.civilian!.variant;
  const source = spawn(w, 'runner', 11, 10, 'idle');
  expect(w.npcs!.civilians.grab(id, source.id, true)).toBe(true);
  for (let i = 0; i < 400 && !w.events.events().some(e => e.type === 'civilian.turned' && e.id === id); i++) step(w, 1);
  const event = w.events.events().find(e => e.type === 'civilian.turned' && e.id === id)!;
  expect(event).toBeDefined(); if (event.type !== 'civilian.turned') return;
  const infected = w.entities.get(event.infectedId)!;
  expect(infected.archetype).toBe('infected.dog'); expect(infected.infected!.variant).toBe(coat);
  expect(infected.infected!.model).toBeUndefined();
});
