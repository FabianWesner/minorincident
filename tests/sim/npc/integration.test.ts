import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { step } from './helpers';
async function load(id: 'L1' | 'L5') { const w = new SimWorld(); await w.init(); const c = compositions[id]; w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8')))); w.loadMission(resolveCampaignMission(id, w.districts!)); w.missions!.begin(); return w; }
test('@E08 rescue lifecycle and tier collision refresh on the retired M1 map (L1 v2 replaced the diner beat)', async () => {
  const w = new SimWorld(); await w.init(); const c = compositions['L1-M1']; w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))));
  const nav = w.infected!.nav, p = w.entities.get(1)!.transform, free = (dx: number) => { const cell = nav.nearestCell(p.x + dx, p.z); return { x: nav.x(cell), z: nav.z(cell) }; };
  const victim = w.npcs!.civilians.spawn('cashier', free(4), { waypoints: [free(4)] }), attacker = w.infected!.spawn('infected.runner', free(6));
  expect(w.npcs!.civilians.grab(victim, attacker, true)).toBe(true); expect(w.entities.get(victim)!.civilian!.state).toBe('grabbed');
  w.entities.get(attacker)!.health.current = 0; step(w, 1); expect(w.events.events().some(e => e.type === 'civilian.saved' && e.id === victim)).toBe(true);
  w.setTier(1); expect(w.districts!.composition.tier).toBe(1);
  const traffic = [...w.entities.iterate()].filter(e => e.traffic);
  w.setTier(2);
  for (const car of traffic) { expect(w.entities.get(car.id)).toBe(car); expect(car.traffic).toMatchObject({ speed: 0, desired: 0, stopped: true }); }
  w.dispose();
});
// The old L2 brother beat was retired by the E20 redesign (po-levels-2-6-2026-10-07); the protected-follower rules
// (escort child, no gore, downed/revive and checkpoint timers) stay covered on the sandbox in followers.test.ts.
test('@E08 L5 mission convoy actor references a spaced spline vehicle group', async () => {
  const w = await load('L5'); w.missions!.completeObjective('prep-1'); const group = [...w.entities.iterate()].filter(e => e.convoy); expect(group).toHaveLength(3); expect(w.entities.get(w.missions!.state.actors.convoy)!.convoy).toBeDefined(); expect(Math.hypot(group[0].transform.x - group[1].transform.x, group[0].transform.z - group[1].transform.z)).toBeCloseTo(7); w.dispose();
});
