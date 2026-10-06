import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { levelOneSlice } from '../../../src/levels/levelOneSlice';

async function morning() {
  const w = new SimWorld(); await w.init(); const c = compositions.L1;
  w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
  w.enableInfected(); const def = levelOneSlice(resolveCampaignMission('L1', w.districts!));
  w.npcs!.configureSlice(); w.loadMission(def).begin(); w.combat!.damage.god = true; return w;
}

test('M1-16 M1-30 @E19 morning schedules remain clear and change activity over 60 seconds', async () => {
  const w = await morning(), crowd = [...w.entities.iterate()].filter(e => e.civilian?.schedule);
  expect(crowd.length).toBeGreaterThanOrEqual(12);
  const activities = new Set(crowd.flatMap(e => e.civilian!.schedule!.map(s => s.activity)));
  expect([...activities]).toEqual(expect.arrayContaining(['sit', 'chat', 'water', 'look', 'walk', 'door', 'inside']));
  const starts = new Map(crowd.map(e => [e.id, { ...e.transform }])), displacement = new Map(crowd.map(e => [e.id, 0]));
  const seen = new Map(crowd.map(e => [e.id, new Set<number>()]));
  let inside = false, emerged = false;
  for (let i = 0; i < 3600; i++) {
    w.update();
    for (const e of crowd) {
      expect(w.infected!.nav.clear(e.transform.x, e.transform.z, .35), String(e.id)).toBe(true);
      seen.get(e.id)!.add(e.civilian!.scheduleStep!);
      const start = starts.get(e.id)!;
      displacement.set(e.id, Math.max(displacement.get(e.id)!, Math.hypot(e.transform.x - start.x, e.transform.z - start.z)));
      if (e.hidden) inside = true; else if (inside && e.civilian!.schedule!.some(s => s.activity === 'inside')) emerged = true;
    }
  }
  expect(inside).toBe(true); expect(emerged).toBe(true);
  for (const [id, steps] of seen) expect(steps.size, `civilian ${id} stuck on one activity`).toBeGreaterThan(1);
  for (const [id, distance] of displacement) expect(distance, `civilian ${id} has no reachable walking leg`).toBeGreaterThan(.75);
  const customers = w.missions!.state.outbreak!.victims.map(id => w.entities.get(id)!);
  expect(new Set(customers.map(e => e.civilian!.model)).size).toBe(3);
  expect(customers.every(e => e.civilian!.pauseUntil !== Number.MAX_SAFE_INTEGER)).toBe(true);
  w.dispose();
});

test('M1-30 @E19 attack interrupts bench, carrying and flower routines before the bite', async () => {
  for (let index = 0; index < 3; index++) {
    const w = await morning(), id = w.missions!.state.outbreak!.victims[index];
    const e = w.entities.get(id)!, c = e.civilian!;
    const nav = w.infected!.nav, cell = nav.nearestCell(e.transform.x + 4, e.transform.z + 4);
    const attacker = w.infected!.spawn('infected.runner', { x: nav.x(cell), z: nav.z(cell) }, { state: 'migration' });
    w.npcs!.civilians.alarm(e.transform);
    expect(c.state).toBe('alarmed'); const step = c.scheduleStep;
    for (let i = 0; i < 31; i++) w.update();
    expect(c.state).toBe('alarmed'); expect(c.scheduleStep).toBe(step);
    Object.assign(w.entities.get(attacker)!.transform, e.transform);
    expect(w.npcs!.civilians.grab(id, attacker, true)).toBe(true);
    expect(c.state).toBe('grabbed');
    for (let i = 0; i < 1500 && c.state !== 'infected'; i++) w.update();
    const turn = w.events.events().find(event => event.type === 'civilian.turned' && event.id === id);
    expect(turn?.type).toBe('civilian.turned');
    if (turn?.type === 'civilian.turned') {
      const newborn = w.entities.get(turn.infectedId)!; expect(newborn.infected!.model).toBe(c.model);
      w.infected!.release(newborn);
      const recycled = w.infected!.spawn('infected.runner', e.transform);
      expect(w.entities.get(recycled)!.infected!.model).toBeUndefined();
    }
    w.dispose();
  }
});


test('M1-30 @E19 ambient gardening flees while checkpoint restoration preserves activity timers', async () => {
  const w = await morning(), e = [...w.entities.iterate()].find(e => e.civilian?.schedule?.[0].activity === 'water')!;
  w.update(); const c = e.civilian!, until = c.activityUntil!, started = c.activityStarted!;
  w.npcs!.restore(600);
  expect(c.activityUntil).toBe(until + 600); expect(c.activityStarted).toBe(started + 600);
  w.npcs!.civilians.alarm(e.transform);
  for (let i = 0; i < 31; i++) w.update();
  expect(c.state).toBe('flee'); w.dispose();
});
