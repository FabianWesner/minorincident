import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { step, teleport } from './helpers';
async function load(id: 'L1' | 'L2' | 'L5') { const w = new SimWorld(); await w.init(); const c = compositions[id]; w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8')))); w.loadMission(resolveCampaignMission(id, w.districts!)); w.missions!.begin(); return w; }
test('@E08 L1 diner beat uses real rescue lifecycle and tier collision refresh', async () => {
  const w = await load('L1'); w.missions!.completeObjective('breakfast'); expect(w.districts!.composition.tier).toBe(1);
  const e = [...w.entities.iterate()].find(e => e.civilian?.state === 'grabbed')!; expect(e).toBeDefined(); w.entities.get(e.civilian!.attacker)!.health.current = 0; step(w, 1); expect(w.missions!.state.stats.rescued).toBe(1);
  w.setTier(2); expect([...w.entities.iterate()].filter(e => e.traffic)).toHaveLength(0); w.dispose();
});
test('@E08 L2 brother receives protected follower component; checkpoint restores references/timers', async () => {
  const w = await load('L2'); w.missions!.completeObjective('neighbor'); w.missions!.completeObjective('school'); w.missions!.completeObjective('brother'); const id = w.missions!.state.actors.brother, e = w.entities.get(id)!;
  expect(e.escort).toMatchObject({ child: true, gore: false }); teleport(w, e.transform.x, e.transform.z); e.health.current = 0; step(w, 1); w.missions!.checkpoint('brother'); const recordedTick = w.tick; step(w, 60); w.missions!.restore('brother');
  const restored = w.entities.get(id)!; expect(restored.escort!.downedAt).toBe(recordedTick + 60); expect(restored.health.current).toBe(0); step(w, 119); expect(restored.health.current).toBe(50); w.dispose();
});
test('@E08 L5 mission convoy actor references a spaced spline vehicle group', async () => {
  const w = await load('L5'); w.missions!.completeObjective('prep-1'); const group = [...w.entities.iterate()].filter(e => e.convoy); expect(group).toHaveLength(3); expect(w.entities.get(w.missions!.state.actors.convoy)!.convoy).toBeDefined(); expect(Math.hypot(group[0].transform.x - group[1].transform.x, group[0].transform.z - group[1].transform.z)).toBeCloseTo(7); w.dispose();
});
