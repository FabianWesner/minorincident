import { NavGrid } from '../../src/sim/ai/NavGrid';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { runL3 } from '../sim-runner/l3Bots';
import { preset } from '../../src/sim/progression/Campaign';
const campaign = preset('L3-default'); campaign.seed = 2; campaign.settings.quality = 'low';
const hits: unknown[] = [];
const routes: unknown[] = [];
let probeWorld: SimWorld | undefined;
const path = NavGrid.prototype.path;
NavGrid.prototype.path = function(from, to, result, budget) {
  const found = path.call(this, from, to, result, budget);
  const actor = probeWorld?.infected?.active.find(e => [691, 1136, 835].includes(e.id) && e.infected?.path === result);
  if (actor && probeWorld!.tick >= 7000) routes.push({ tick: probeWorld!.tick, actor: actor.id, from, to, found, pending: this.pending(from, to), expansions: this.expansions, total: this.searchSize, position: { ...actor.transform } });
  return found;
};
const world = await loadLevel('L3', 2, campaign, 0, { quality: 'low', beforeBegin: w => {
  probeWorld = w;
  w.events.on('outbreak.bite', event => { hits.push({ type: event.type, tick: w.tick, event }); });
  w.events.on('l3.squad-lost', event => { hits.push({ type: event.type, tick: w.tick, event }); });
  w.events.on('civilian.turned', event => { hits.push({ type: event.type, tick: w.tick, event }); });
  w.events.on('combat.hit', hit => {
    if (hit.type !== 'combat.hit') return;
    const target = w.entities.get(hit.targetId), source = w.entities.get(hit.sourceId);
    if (!target?.civilian?.ally) return;
    hits.push({ tick: w.tick, target: target.id, source: source?.id, sourceArchetype: source?.archetype, health: target.health.current, amount: hit.amount, action: hit.actionId, position: { ...target.transform },
      sourceGoal: source?.infected?.goal, sourceScripted: source?.infected?.scripted });
  });
} });
try {
  const report = runL3(world, world.missions!, 'complete', { seed: 2, maxSeconds: 1200, street: 'auto' });
  writeFileSync(process.argv[2] ?? 'test-results/s116-l3-loss.json', JSON.stringify({ report, hits, routes }, null, 2));
} finally { NavGrid.prototype.path = path; world.dispose(); }
