import { describe, expect, test } from 'vitest';
import { l1v2 } from '../../../src/data/l1v2';
import { keepsLook } from '../../../src/sim/outbreak/appearance';
import type { BiteEvent, InfectionEvent } from '../../../src/sim/outbreak/types';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { anchor, groveWorld, infectedCount, releaseFive, step } from './l1-grove';

const civilians = (w: Awaited<ReturnType<typeof groveWorld>>['w']) => [...w.entities.iterate()].filter(e => e.civilian?.l1);
const park = (w: Awaited<ReturnType<typeof groveWorld>>['w']) => { const p = w.entities.get(1)!; p.transform.x = -82; p.transform.z = -52; w.spatial.set(1, -82, -52); };

describe('L1 v2 civilians and infection', () => {
  test('T-E19-05 @E19 @E19-AC05 50-60 civilians, no idling, startle 0.3-0.8 s, flee slower than infected', async () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { w } = await groveWorld(seed);
      const people = civilians(w);
      expect(people.length).toBeGreaterThanOrEqual(l1v2.civilians.countMin); expect(people.length).toBeLessThanOrEqual(l1v2.civilians.countMax);
      // Flee speed is below the slowest possible infected (frail base -6 %), on every seed.
      const slowest = l1v2.speedTiers.frail.baseMs * (1 - l1v2.speedTiers.jitter);
      for (const e of people) { expect(e.civilian!.l1!.fleeSpeed).toBeGreaterThanOrEqual(l1v2.civilians.fleeSpeed[0] * .9 - 1e-9); expect(e.civilian!.l1!.fleeSpeed).toBeLessThan(slowest); }
      // No identical silhouette+tint pair within 20 m at the start.
      for (const a of people) for (const b of people) if (a.id < b.id && Math.hypot(a.transform.x - b.transform.x, a.transform.z - b.transform.z) < 20)
        expect(`${a.appearance!.asset}|${a.appearance!.tint}`).not.toBe(`${b.appearance!.asset}|${b.appearance!.tint}`);
      if (seed > 3) { w.dispose(); continue; }
      // 60 s of calm morning: nobody stands still without facing something for more than 3 s.
      park(w); const still = new Map<number, number>(); let worst = 0;
      for (let t = 0; t < 3600; t++) {
        step(w, 1);
        for (const e of civilians(w)) {
          const c = e.civilian!, moving = (e.motion?.speed ?? 0) > .1, activity = c.schedule![c.scheduleStep ?? 0];
          // Performing a civlife activity (sit, chat, water, look at something) or inside a shop counts as purposeful.
          const facing = e.hidden || !!c.activityUntil && !!activity.facing;
          const n = moving || facing ? 0 : (still.get(e.id) ?? 0) + 1; still.set(e.id, n); worst = Math.max(worst, n);
        }
      }
      expect(worst).toBeLessThanOrEqual(l1v2.civilians.idleFacingNowhereMaxS * 60);
      // Notice: an infected in plain sight -> 0.3-0.8 s startle (alarmed) -> flee, then moving at the flee speed.
      const ai = w.infected!, ahead = (e: { transform: { x: number; z: number; yaw: number } }) => ai.nav.nearestCell(e.transform.x + Math.cos(e.transform.yaw) * 7, e.transform.z - Math.sin(e.transform.yaw) * 7);
      // A calm pedestrian with an infected placed in plain sight ahead (clear line of sight on the real map).
      const victim = civilians(w).find(e => { if (e.civilian!.state !== 'calm' || e.hidden) return false; const c = ahead(e), p = { x: ai.nav.x(c), z: ai.nav.z(c) }; return c >= 0 && Math.hypot(p.x - e.transform.x, p.z - e.transform.z) > 4 && w.combat!.query.visible(e.transform, p); })!;
      const spot = ahead(victim);
      const id = ai.spawn('infected.runner', { x: ai.nav.x(spot), z: ai.nav.z(spot) }, { state: 'migration', perched: false });
      const startTick = w.tick; let alarmed = -1, fled = -1;
      for (let t = 0; t < 120 && fled < 0; t++) { step(w, 1); const s = victim.civilian!.state; if (s === 'alarmed' && alarmed < 0) alarmed = w.tick; if (s === 'flee') fled = w.tick; }
      expect(alarmed - startTick).toBeLessThanOrEqual(7);
      const startle = (fled - alarmed) / 60; expect(startle).toBeGreaterThanOrEqual(l1v2.civilians.startleS[0] - 1 / 60); expect(startle).toBeLessThanOrEqual(l1v2.civilians.startleS[1] + 1 / 60);
      const from = { ...victim.transform }; step(w, 30);
      if (w.entities.get(victim.id)) expect(Math.hypot(victim.transform.x - from.x, victim.transform.z - from.z) / .5).toBeLessThanOrEqual(victim.civilian!.l1!.fleeSpeed + .05);
      expect(w.entities.get(id)?.infected).toBeDefined();
      w.dispose();
    }
  }, 240_000);

  test('T-E19-06 @E19 @E19-AC06 every new infected is caused by a bite event (idle player, systemic spread, lane C AI)', async () => {
    const at120: number[] = [], at240: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const { w, outbreak } = await groveWorld(seed); park(w); expect(outbreak.aiBites()).toBe(true);
      step(w, 300); releaseFive(w); expect(infectedCount(w)).toBe(5);
      const born = new Set<number>(), bitten = new Set<number>();
      w.events.on('outbreak.infection', e => { if (e.type === 'outbreak.infection' && e.phase === 'infected') born.add(e.entityId); });
      w.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite' && e.turns) bitten.add(e.targetId); });
      step(w, 7200); at120.push(infectedCount(w));
      step(w, 7200); at240.push(infectedCount(w));
      // Every infected beyond the initial five rose from a bite, as the same entity that was bitten.
      for (const id of born) expect(bitten.has(id)).toBe(true);
      expect(infectedCount(w)).toBeLessThanOrEqual(5 + born.size);
      expect(outbreak.stats.hordeSpawned).toBe(0);
      w.dispose();
    }
    console.log(`AC06 infected at +120 s: ${at120.join(' ')}; at +240 s: ${at240.join(' ')}`);
    const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
    expect(median(at120)).toBeGreaterThanOrEqual(l1v2.bots.idleSpread.at120s);
    expect(median(at240)).toBeGreaterThanOrEqual(l1v2.bots.idleSpread.at240s);
    expect(at120.filter(n => n >= l1v2.bots.idleSpread.floorAt120s).length).toBeGreaterThanOrEqual(l1v2.bots.idleSpread.floorSeeds);
  }, 1_800_000);

  test('T-E19-18 @E19 @E19-AC18 infection continuity: id, asset, tint, accessories, 2.5-3.5 s, phases, speed tier', async () => {
    const durations: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const { w, outbreak } = await groveWorld(seed, { civilians: 50 }); park(w);
      const victim = civilians(w).find(e => e.civilian!.state === 'calm' && e.appearance!.handProp)!;
      const look = structuredClone(victim.appearance!), ai = w.infected!;
      const id = ai.spawn('infected.runner', { x: victim.transform.x + .6, z: victim.transform.z }, { state: 'migration', perched: false });
      outbreak.grab(victim, w.entities.get(id)!);
      expect(victim.appearance!.handProp).toBeNull();
      step(w, 60);
      const bite = w.events.events().find((e): e is BiteEvent => e.type === 'outbreak.bite' && e.targetId === victim.id);
      expect(bite).toMatchObject({ sourceId: id, turns: true });
      const started = w.tick; let rose = -1;
      for (let t = 0; t < 300 && rose < 0; t++) { step(w, 1); if (!victim.civilian) rose = w.tick; }
      const seconds = (rose - started) / 60; durations.push(seconds);
      expect(seconds).toBeGreaterThanOrEqual(2.5 - 1 / 60); expect(seconds).toBeLessThanOrEqual(3.5 + 1 / 60);
      const phases = w.events.events().filter((e): e is InfectionEvent => e.type === 'outbreak.infection' && e.entityId === victim.id).map(e => e.phase);
      expect(phases).toEqual(['stagger', 'collapse', 'eyes', 'rise', 'infected']);
      // Same entity object and id: now an infected with the same asset, tint and accessories (hand prop dropped).
      const now = w.entities.get(victim.id) as EntitySnapshot;
      expect(now).toBe(victim); expect(now.infected).toBeDefined(); expect(now.faction).toBe('infected'); expect(ai.active).toContain(now);
      expect(now.appearance).toEqual({ ...look, handProp: null }); expect(keepsLook(now)).toBe(true);
      const tier = l1v2.speedTiers[look.tier]; expect(Math.abs(now.infected!.speed / tier.baseMs - 1)).toBeLessThanOrEqual(l1v2.speedTiers.jitter + 1e-9);
      // The newborn is a real infected: it takes damage and dies like any other.
      w.combat!.damage.apply({ sourceId: 1, targetId: now.id, attackId: 9, actionId: 'test', origin: now.transform, direction: { x: 1, z: 0 }, base: 999, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
      expect(now.health.current).toBe(0);
      w.dispose();
    }
    expect(new Set(durations.map(d => d.toFixed(2))).size).toBeGreaterThan(5);
  }, 240_000);

  test('@E19 @E19-AC05 grab rescue window: any hit on the grabber within 1.0 s saves the pedestrian', async () => {
    const { w, outbreak } = await groveWorld(3, { civilians: 50 }); park(w);
    const victim = civilians(w).find(e => e.civilian!.state === 'calm')!, ai = w.infected!;
    const id = ai.spawn('infected.runner', { x: victim.transform.x + .6, z: victim.transform.z }, { state: 'migration', perched: false });
    outbreak.grab(victim, w.entities.get(id)!); step(w, 40);
    w.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 7, actionId: 'test', origin: victim.transform, direction: { x: 1, z: 0 }, base: 1, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
    step(w, 2);
    expect(victim.civilian!.state).toBe('flee'); expect(victim.infection).toBeUndefined(); expect(outbreak.stats.rescued).toBe(1);
    expect(w.events.events().some(e => e.type === 'outbreak.bite')).toBe(false); w.dispose();
  });

  test('@E19 @E19-AC06 at the infected cap a bite kills instead of turning (60 high / 30 low)', async () => {
    const { w, outbreak } = await groveWorld(4, { tier: 'low', civilians: 50 }); park(w);
    const ai = w.infected!; expect(ai.director.cap).toBe(l1v2.director.capLow);
    while (ai.director.count < ai.director.cap) { const cell = ai.nav.nearestCell(80 - ai.director.count, 50); ai.spawn('infected.runner', { x: ai.nav.x(cell), z: ai.nav.z(cell) }, { state: 'migration', perched: false }); }
    const victim = civilians(w).find(e => e.civilian!.state === 'calm')!;
    outbreak.grab(victim, ai.active[0]); ai.active[0].transform.x = victim.transform.x + .6; ai.active[0].transform.z = victim.transform.z; step(w, 61);
    expect(w.events.events().find(e => e.type === 'outbreak.bite')).toMatchObject({ targetId: victim.id, turns: false });
    step(w, 300); expect(victim.civilian!.state).toBe('finished'); expect(ai.director.count).toBe(l1v2.director.capLow); w.dispose();
  });

  test('@E19 @E19-AC06 horde guarantee and scripted turns keep the pedestrian look (section 5.9)', async () => {
    const { w, outbreak } = await groveWorld(5, { civilians: 50 }); park(w);
    const exit = anchor('garage-door'), entry = anchor('elm-horde-entry');
    const spawned = outbreak.ensureHorde(exit, entry);
    expect(spawned).toBe(l1v2.director.hordeMinInfectedNearGarage);
    const horde = w.infected!.active.filter(e => keepsLook(e));
    expect(horde).toHaveLength(spawned);
    for (const e of horde) { expect(e.civilian).toBeUndefined(); expect(e.appearance!.asset).toMatch(/^npc\.civilian-/); }
    expect(outbreak.ensureHorde(entry, entry)).toBe(0);
    // Scripted out-of-sight turn (lab technician): same id and look, not counted as a bite.
    const tech = w.entities.get(outbreak.spawnPedestrian({ x: anchor('lab-exit-front').x, z: anchor('lab-exit-front').z + 2 }))!;
    const look = structuredClone(tech.appearance); outbreak.turnNow(tech, 'average');
    expect(w.entities.get(tech.id)).toBe(tech); expect(tech.infected).toBeDefined(); expect(tech.appearance).toEqual({ ...look, tier: 'average' });
    expect(outbreak.stats.turned).toBe(0); w.dispose();
  });
});
