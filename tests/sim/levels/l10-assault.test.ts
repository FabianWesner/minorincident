import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { cure } from '../../../src/levels/L10/district';
import { cureEncounters, cureEncounterSlots } from '../../../src/levels/L10/encounters';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import type { DistrictLayout } from '../../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;

for (const tier of ['high', 'low'] as const) test(`T-E32-21-E3-${tier} @E32-AC06 @E32-AC12 @E32-AC21 @E32-AC31 capped mixed assault, persistent arrival and ten rockets`, async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadComposition(compositions.L10, [layout], 32); applyCampaign(w, preset('L10-default')); w.chunks!.setQuality(tier);
    const m = w.loadMission(resolveCampaignMission('L10', w.districts!)); m.begin(); m.loadCheckpoint('cure-disperse-ready');
    const p = w.entities.get(1)!; Object.assign(p.transform, { x: 4002, z: -25 }); w.physics.playerBody!.setTranslation(p.transform, true); w.chunks!.update();
    const boss = w.megaPursuit!; const id = boss.introduce({ x: 3942, z: -25 });
    w.combat!.damage.god = true;
    // No activation: no R7 population, even after arsenal/ready checkpoint grants.
    w.tick = 3600; w.l10Encounters!.update();
    expect(Object.keys(w.l10Encounters!.state.spawned).filter(k => k.startsWith('dispersal-'))).toHaveLength(0);
    w.setInput({ interact: true }); w.update(); w.clearInput();
    expect(m.state.states['charge-active']).toBe(true);
    const started = w.tick, samples: number[] = []; let arrival: number | null = null, peak = 0;
    let previous = { ...w.entities.get(id)!.transform };
    for (let i = 0; i < 3600; i++) {
      const start = performance.now(); w.update(); if (i > 120) samples.push(performance.now() - start);
      const e = w.entities.get(id)!;
      expect(boss.state.id).toBe(id);
      // Until close range, movement is continuous cruise, never an arrival teleport.
      if (Math.hypot(previous.x - p.transform.x, previous.z - p.transform.z) > 14) expect(Math.hypot(e.transform.x - previous.x, e.transform.z - previous.z)).toBeLessThan(.1);
      previous = { ...e.transform };
      if (arrival === null && boss.distance() <= 25) arrival = (w.tick - started) / 60;
      peak = Math.max(peak, w.infected!.director.count);
      expect(w.infected!.director.count).toBeLessThanOrEqual(tier === 'high' ? 200 : 100);
    }
    // This local 60 m fixture checks continuous approach; the default ~143 s
    // production checkpoint route is asserted by l10-arrival.test.ts (PO 10-16).
    expect(arrival).toBeGreaterThanOrEqual(10); expect(arrival).toBeLessThanOrEqual(40);
    const slots = cureEncounterSlots(cureEncounters.at(-1)!, tier);
    expect(slots.every(s => w.l10Encounters!.state.spawned[s.key])).toBe(true);
    expect(slots.filter(s => s.archetype === 'infected.alpha')).toHaveLength(tier === 'high' ? 3 : 2);
    expect(slots.filter(s => s.archetype === 'infected.dog')).toHaveLength(4);
    expect(peak).toBeGreaterThanOrEqual(tier === 'high' ? 140 : 75);
    expect(m.state.states['cure-released']).toBe(false);
    const shot = (attackId: number) => w.combat!.damage.apply({ sourceId: 1, targetId: id, attackId, actionId: 'weapon.rocket-launcher', direct: true, origin: p.transform, direction: { x: -1, z: 0 }, base: 1, multiplier: 1, type: 'explosive', stagger: 0, knockback: 0 });
    for (let hit = 1; hit <= 10; hit++) { expect(shot(hit + 10000)).toBe(300); expect(shot(hit + 10000)).toBe(0); expect(w.entities.get(id)!.health.current).toBe(3000 - hit * 300); }
    for (let i = 0; i < 150; i++) w.update();
    expect(boss.state.mode).toBe('dead'); expect(w.entities.get(id)!.corpse).toBe(true);
    Object.assign(p.transform, { x: 4002, z: -27 }); w.physics.playerBody!.setTranslation(p.transform, true);
    w.setInput({ interact: true }); for (let i = 0; i < 45; i++) w.update(); w.clearInput();
    expect(m.state.states['cure-released']).toBe(true);
    const ledger = w.l10Encounters!.snapshot(); for (let i = 0; i < 600; i++) w.update();
    expect(w.l10Encounters!.snapshot()).toEqual(ledger); expect(w.entities.get(id)!.corpse).toBe(true);
    samples.sort((a,b) => a-b); const p95 = samples[Math.ceil(samples.length * .95)-1];
    mkdirSync('test-results/epics/E32/E3', { recursive: true });
    writeFileSync(`test-results/epics/E32/E3/assault-${tier}.json`, JSON.stringify({ tier, peak, arrival, bossId: id, slots: slots.length, p95, console: cure.anchors['cure-console'] }, null, 2));
    expect(p95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
  } finally { w.dispose(); }
});

for (const tier of ['high', 'low'] as const) test(`T-E32-21-E3-overlap-${tier} @E32-AC06 @E32-AC21 full cap defers assault, dead bodies survive replenishment and revisit`, async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadComposition(compositions.L10, [layout], 32); applyCampaign(w, preset('L10-default')); w.chunks!.setQuality(tier);
    const m = w.loadMission(resolveCampaignMission('L10', w.districts!)); m.begin(); m.loadCheckpoint('cure-disperse-ready');
    const p = w.entities.get(1)!; Object.assign(p.transform, { x: 4002, z: -27 }); w.physics.playerBody!.setTranslation(p.transform, true); w.chunks!.update();
    w.megaPursuit!.introduce({ x: 3942, z: -25 }); w.combat!.damage.god = true;
    const incoming: number[] = [];
    while (w.infected!.director.count < w.infected!.director.cap) incoming.push(w.infected!.spawn('infected.runner', { x: 3965, z: -25 }, { state: 'idle' }));
    w.setInput({ interact: true }); w.update(); w.clearInput();
    w.tick += 10 - w.tick % 10; w.l10Encounters!.update();
    expect(Object.keys(w.l10Encounters!.state.spawned).filter(k => k.startsWith('dispersal-'))).toHaveLength(0);
    const bodies = incoming.slice(0, 12);
    for (const targetId of bodies) w.combat!.damage.apply({ sourceId: 1, targetId, attackId: 70000 + targetId, actionId: 'weapon.rocket-launcher', type: 'explosive', direct: true, permanent: true, origin: p.transform, direction: { x: -1, z: 0 }, base: 10000, multiplier: 1, knockback: 0, stagger: 0 });
    for (let i = 0; i < 150; i++) w.update();
    expect(w.infected!.director.count).toBeLessThanOrEqual(tier === 'high' ? 200 : 100);
    expect(Object.keys(w.l10Encounters!.state.spawned).filter(k => k.startsWith('dispersal-')).length).toBeGreaterThan(0);
    for (const id of bodies) expect(w.entities.get(id)!.corpse).toBe(true);
    const ledger = w.l10Encounters!.snapshot(), save = m.saveResume();
    Object.assign(p.transform, { x: 3400, z: 95 }); w.chunks!.update();
    Object.assign(p.transform, { x: 4002, z: -27 }); w.chunks!.update();
    for (const id of bodies) expect(w.entities.get(id)!.corpse).toBe(true);
    m.loadResume(save); expect(w.l10Encounters!.snapshot()).toEqual(ledger);
    expect(new Set(Object.values(ledger.spawned)).size).toBe(Object.values(ledger.spawned).length);
  } finally { w.dispose(); }
});

test('T-E32-10-E3 @E32-AC10 production composition introduces one reserved pursuer behind R1', async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadComposition(compositions.L10, [layout], 32); applyCampaign(w, preset('L10-default'));
    w.loadMission(resolveCampaignMission('L10', w.districts!)).begin();
    const boss = w.megaPursuit!; expect(boss.state.mode).toBe('dormant'); expect(w.infected!.director.reserved).toBe(1);
    w.tick = 5400; w.update(); const id = boss.state.id;
    expect(id).toBeGreaterThan(1); expect(boss.entity()!.transform.x).toBeLessThan(w.entities.get(1)!.transform.x - 79);
    expect(w.infected!.director.reserved).toBe(0);
    for (let i = 0; i < 60; i++) w.update();
    expect(boss.state.id).toBe(id); expect(boss.introduce()).toBe(id);
    expect([...w.entities.iterate()].filter(e => e.infected?.pursuit)).toHaveLength(1);
  } finally { w.dispose(); }
});
