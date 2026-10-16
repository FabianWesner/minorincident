import { expect, test } from 'vitest';
import { arena, spawn, step } from './helpers';
import { dogTuning, infectedDef, validateInfected } from '../../../src/data/infected';
import { l1v2 } from '../../../src/data/l1v2';
import { Outbreak } from '../../../src/sim/outbreak/Outbreak';
import { cureCanKill, isCorgi } from '../../../src/sim/npc/storyProtection';

test('T-E32-07a @E32 @E32-AC07 inf.dog data: 1.1x run, >= 0.6 s telegraph, <= 2 m reach, >= 2 s cooldown, 10 HP, non-corgi asset', () => {
  const d = infectedDef('infected.dog');
  validateInfected();
  expect(d.asset).toBe('inf.dog');
  expect(d.speed).toBeCloseTo(l1v2.player.runMs * 1.1, 6);
  expect(d.windup).toBeGreaterThanOrEqual(0.6);
  expect(d.range).toBeLessThanOrEqual(2);
  expect(d.attackInterval! - d.windup).toBeGreaterThanOrEqual(2);
  expect(d.damage).toBe(10);
  expect(dogTuning.damage).toBe(10);
  expect(d.special).toBe('pounce');
});

test('T-E32-07b @E32 @E32-AC07 a dog telegraphs >= 0.6 s before each bite and waits >= 2 s between its own bites', async () => {
  const w = await arena(); w.combat!.damage.god = true;
  const dog = spawn(w, 'dog', 6, 0, 'chase');
  for (let i = 0; i < 900; i++) { step(w, 1); if (w.infected!.playerPinned()) for (const d of w.infected!.active) d.infected!.grabUntil = 0; }
  const attacks = w.events.events().filter(e => e.type === 'infected.attack' && e.sourceId === dog.id);
  expect(attacks.length).toBeGreaterThanOrEqual(2);
  const windup = Math.ceil(infectedDef('infected.dog').windup * 60);
  expect(windup).toBeGreaterThanOrEqual(36);
  const ticks = attacks.map(a => a.tick);
  // Bite lands at windup end; the next windup may only start after the 2 s cooldown, so bites are >= 2 s + windup apart.
  for (let i = 1; i < ticks.length; i++) expect(ticks[i] - ticks[i - 1]).toBeGreaterThanOrEqual(120 + windup);
});

test('T-E32-07c @E32 @E32-AC07 a dog bite costs the courier 10 HP', async () => {
  const w = await arena(); const player = w.entities.get(1)!; const before = player.health.current;
  spawn(w, 'dog', 3, 0, 'chase');
  for (let i = 0; i < 300 && player.health.current === before; i++) step(w, 1);
  expect(before - player.health.current).toBeCloseTo(10 * (w.entities.get(1)!.combat?.damageMultiplier ?? 1), 0);
});

test('T-E32-08a @E32 @E32-AC08 the companion corgi can neither be infected nor turned, and is never an enemy target', async () => {
  const w = await arena(); const corgi = w.entities.get(w.npcs!.companion.spawn())!;
  const outbreak = new Outbreak(w, { refuges: [], tier: w.infected!.director.tier });
  expect(isCorgi(corgi)).toBe(true);
  outbreak.infect(corgi, 99); outbreak.turnNow(corgi);
  expect(corgi.infection).toBeUndefined(); expect(corgi.infected).toBeUndefined();
  expect(w.infected!.hearing.humans.within(corgi.transform, 5).some(h => h.id === corgi.id)).toBe(false);
  expect(cureCanKill(corgi)).toBe(false);
  // A dog told to hunt the corgi redirects to the courier and the corgi stays untouched.
  const dog = spawn(w, 'dog', corgi.transform.x + 3, corgi.transform.z, 'chase'); dog.infected!.heardTargetId = corgi.id;
  const hp = corgi.health.current; step(w, 400);
  expect(corgi.health.current).toBe(hp); expect(corgi.infected).toBeUndefined(); expect(corgi.infection).toBeUndefined();
  expect(w.events.events().filter(e => e.type === 'infected.attack' && e.targetId === corgi.id)).toHaveLength(0);
});

test('T-E32-08b @E32 @E32-AC08 no infected spawn may substitute for or be drawn as the corgi; real infected are valid cure targets', async () => {
  const w = await arena();
  expect(() => w.infected!.spawn('infected.dog', { x: 5, z: 0 }, { variant: 'char.corgi' })).toThrow(/corgi/);
  expect(() => w.infected!.spawn('infected.dog', { x: 5, z: 0 }, { variant: 'inf.corgi-pet' })).toThrow(/corgi/);
  const dog = spawn(w, 'dog', 8, 0, 'idle');
  expect(cureCanKill(dog)).toBe(true);
  expect(cureCanKill(w.entities.get(1)!)).toBe(false);
});

test('T-E32-07-los @E32-AC07 a solid wall blocks dog acquisition beyond close hearing; ordinary damage staggers and kills it', async () => {
  const w = await arena(), dog = spawn(w, 'dog', 7, 0, 'idle');
  dog.transform.yaw = Math.PI;
  const wall = { x: 3.5, y: 1.5, z: 0, halfX: .1, halfY: 1.5, halfZ: 4 };
  (w.combat!.query.walls as typeof wall[]).push(wall);
  step(w, 30);
  expect(w.events.events().filter(e => e.type === 'infected.attack' && e.sourceId === dog.id)).toHaveLength(0);
  expect(dog.infected!.state).not.toBe('chase');
  const hit = { sourceId: 1, targetId: dog.id, attackId: 100, actionId: 'weapon.pistol', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 10, multiplier: 1, type: 'bullet' as const, knockback: 0, stagger: .3 };
  expect(w.combat!.damage.apply(hit)).toBeGreaterThan(0);
  expect(dog.combat!.staggerUntil).toBeGreaterThan(w.tick);
  w.combat!.damage.apply({ ...hit, attackId: 101, base: 1000 });
  step(w, 1); expect(dog.health.current).toBe(0); expect(dog.infected!.state).toBe('dead');
});
