import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { NpcPatrol } from '../../../src/debug/bot/NpcPatrol';
import { step, teleport } from './helpers';
async function load(id: 'L1' | 'L2' | 'L5') { const w = new SimWorld(); await w.init(); const c = compositions[id]; w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8')))); w.loadMission(resolveCampaignMission(id, w.districts!)); w.missions!.begin(); return w; }
test('@E08 rescue lifecycle and tier collision refresh on the retired M1 map (L1 v2 replaced the diner beat)', async () => {
  const w = new SimWorld(); await w.init(); const c = compositions['L1-M1']; w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))));
  const nav = w.infected!.nav, p = w.entities.get(1)!.transform, free = (dx: number) => { const cell = nav.nearestCell(p.x + dx, p.z); return { x: nav.x(cell), z: nav.z(cell) }; };
  const victim = w.npcs!.civilians.spawn('cashier', free(4), { waypoints: [free(4)] }), attacker = w.infected!.spawn('infected.runner', free(6));
  expect(w.npcs!.civilians.grab(victim, attacker, true)).toBe(true); expect(w.entities.get(victim)!.civilian!.state).toBe('grabbed');
  w.entities.get(attacker)!.health.current = 0; step(w, 1); expect(w.events.events().some(e => e.type === 'civilian.saved' && e.id === victim)).toBe(true);
  w.setTier(1); expect(w.districts!.composition.tier).toBe(1); w.setTier(2); expect([...w.entities.iterate()].filter(e => e.traffic)).toHaveLength(0); w.dispose();
});
test('@E08 L2 brother receives protected follower component; checkpoint restores references/timers', async () => {
  const w = await load('L2'); w.missions!.completeObjective('neighbor'); w.missions!.completeObjective('school'); w.missions!.completeObjective('brother'); const id = w.missions!.state.actors.brother, e = w.entities.get(id)!;
  expect(e.escort).toMatchObject({ child: true, gore: false }); teleport(w, e.transform.x, e.transform.z); e.health.current = 0; step(w, 1); w.missions!.checkpoint('brother'); const recordedTick = w.tick; step(w, 60); w.missions!.restore('brother');
  const restored = w.entities.get(id)!; expect(restored.escort!.downedAt).toBe(recordedTick + 60); expect(restored.health.current).toBe(0); step(w, 119); expect(restored.health.current).toBe(50); w.dispose();
});
test('@E08 L5 mission convoy actor references a spaced spline vehicle group', async () => {
  const w = await load('L5'); w.missions!.completeObjective('prep-1'); const group = [...w.entities.iterate()].filter(e => e.convoy); expect(group).toHaveLength(3); expect(w.entities.get(w.missions!.state.actors.convoy)!.convoy).toBeDefined(); expect(Math.hypot(group[0].transform.x - group[1].transform.x, group[0].transform.z - group[1].transform.z)).toBeCloseTo(7); w.dispose();
});
test('@E08 @E08-AC15 ten-minute actual L2 composition patrol keeps the scripted brother out of infection and gore', async () => {
  const w = await load('L2'); w.missions!.completeObjective('neighbor'); w.missions!.completeObjective('school'); w.missions!.completeObjective('brother'); w.missions!.checkpoint('brother');
  const id = w.missions!.state.actors.brother, brother = w.entities.get(id)!;
  // A nearby hostile exercises targeting, cover/knockdown and checkpoint recovery on the loaded school map.
  if (w.infected!.nav.clear(brother.transform.x, brother.transform.z, .4)) w.infected!.spawn('infected.runner', brother.transform);
  let targeted = 0; const offs = (['infected.attack', 'civilian.grabbed'] as const).map(type => w.events.on(type, event => { if ('targetId' in event && event.targetId === id) targeted++; }));
  const bot = new NpcPatrol(w);
  for (let i = 0; i < 36000; i++) {
    w.applyInput(bot.sample(), 'keyboard'); w.update(); const e = w.entities.get(id)!;
    expect(e.civilian).toBeUndefined(); expect(e.infected).toBeUndefined(); expect(e.escort).toMatchObject({ child: true, gore: false }); expect(e.escort!.state).not.toBe('dead');
  }
  expect(targeted).toBe(0); for (const off of offs) off(); w.dispose();
}, 120000);
