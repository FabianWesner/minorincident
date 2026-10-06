import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { NpcPatrol } from '../../../src/debug/bot/NpcPatrol';
import { npcs } from '../../../src/data/npcs';
import { npcWorld, step } from './helpers';
import type { GameEvent } from '../../../src/sim/world/types';
const metrics: { level: string; tier: string; average: number; expected: number; simMsP95: number; ticks: number; distance: number; attacks: number }[] = [];
for (const tier of ['high', 'low'] as const) test(`T-E08-11-${tier} @E08 @E08-AC11 @E08-AC17 L1-L6 first three-minute objective-patrol runs: density and immunity`, async () => {
  const w = new SimWorld(); await w.init();
  for (let level = 1; level <= 6; level++) {
    const composition = compositions[`L${level}`]; w.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 42);
    w.npcs!.setQuality(tier);
    for (const e of w.entities.iterate()) if (e.civilian) expect(w.districts!.nav.walkable([e.transform.x, e.transform.z])).toBe(true);
    const expected = npcs.density[level - 1] * (tier === 'low' ? .6 : 1), bot = new NpcPatrol(w), times: number[] = [];
    const corgi = [...w.entities.iterate()].find(e => e.companion)!; 
    let total = 0, distance = 0, attacks = 0; const infectionEvents: GameEvent[] = [];
    const stop = w.events.on('civilian.state', e => { if ('id' in e && e.id === corgi.id) infectionEvents.push(e); });
    const stopAttack = w.events.on('combat.attack', () => { attacks++; });
    for (let tick = 0; tick < 10800; tick++) {
      const player = w.entities.get(1)!, x = player.transform.x, z = player.transform.z;
      w.applyInput(bot.sample(), 'keyboard'); const start = performance.now(); w.update(); times.push(performance.now() - start);
      distance += Math.hypot(player.transform.x - x, player.transform.z - z);
      let count = 0; for (const e of w.entities.iterate()) if (e.kind === 'civilian' && e.civilian?.ambient && e.civilian.adult && e.civilian.state !== 'infected' && e.civilian.state !== 'finished') count++;
      total += count; expect(corgi.civilian).toBeUndefined(); expect(corgi.companion).toBeDefined(); expect(corgi.health.current).toBe(100);
    }
    const average = total / 10800; expect(average).toBeGreaterThanOrEqual(expected * .9); expect(average).toBeLessThanOrEqual(expected * 1.1); expect(infectionEvents).toHaveLength(0); expect(distance).toBeGreaterThan(10); expect(attacks).toBeGreaterThan(0); stop(); stopAttack();
    times.sort((a, b) => a - b); const simMsP95 = times[Math.floor(times.length * .95)]; expect(simMsP95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
    metrics.push({ level: `L${level}`, tier, average, expected, simMsP95, ticks: w.tick, distance, attacks });
  }
  w.dispose(); mkdirSync('test-results/epics/E08', { recursive: true }); writeFileSync('test-results/epics/E08/campaign.json', JSON.stringify(metrics, null, 2));
}, 120000);
test('T-E08-17 @E08 @E08-AC17 100 seeds use data pet probability and 2–4s down before dog rise', async () => {
  let turned = 0; const durations = new Set<number>();
  for (let seed = 1; seed <= 100; seed++) {
    const w = await npcWorld('turning-probe', seed), owner = w.npcs!.civilians.spawn('bbq-dad', { x: 5, z: 0 }), pet = w.npcs!.civilians.spawn('dog', { x: 4, z: 0 }, { pet: 'dog', owner }), attacker = w.infected!.spawn('infected.butcher', { x: 5, z: 0 });
    w.npcs!.civilians.grab(owner, attacker, true); const e = w.entities.get(pet)!;
    if (e.civilian!.state === 'down') {
      turned++; const duration = e.civilian!.downTicks; durations.add(duration); expect(duration).toBeGreaterThanOrEqual(120); expect(duration).toBeLessThanOrEqual(240);
      step(w, duration - 1); expect(e.civilian!.state).toBe('down'); step(w, 1); expect(e.civilian!.state).toBe('rising'); step(w, 72); expect(w.events.events().find(e => e.type === 'civilian.turned' && e.id === pet)).toMatchObject({ variant: 'inf.dog-retriever' });
    }
    w.dispose();
  }
  expect(turned / 100).toBeGreaterThan(npcs.petInfectionChance - .15); expect(turned / 100).toBeLessThan(npcs.petInfectionChance + .15); expect(durations.size).toBeGreaterThan(20);
});
test('@E08 stray cats use systemic grabs and the short pet down/rise lifecycle', async () => {
  const w = await npcWorld('turning-probe', 42), position = { x: 20, z: 20 }, id = w.npcs!.civilians.spawn('cat', position, { pet: 'cat', waypoints: [position] });
  w.infected!.spawn('infected.butcher', position); const pet = w.entities.get(id)!;
  for (let i = 0; i < 180 && pet.civilian!.state === 'calm'; i++) w.update();
  expect(pet.civilian!.state).toBe('down'); expect(pet.civilian!.downTicks).toBeGreaterThanOrEqual(120); expect(pet.civilian!.downTicks).toBeLessThanOrEqual(240);
  step(w, pet.civilian!.until - w.tick + 72); expect(w.events.events().find(event => event.type === 'civilian.turned' && event.id === id)).toMatchObject({ variant: 'inf.cat-tabby' }); w.dispose();
});
