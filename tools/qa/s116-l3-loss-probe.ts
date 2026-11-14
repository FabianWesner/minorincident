import { writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { runL3 } from '../sim-runner/l3Bots';
import { preset } from '../../src/sim/progression/Campaign';
const campaign = preset('L3-default'); campaign.seed = 2; campaign.settings.quality = 'low';
const hits: unknown[] = [];
const world = await loadLevel('L3', 2, campaign, 0, { quality: 'low', beforeBegin: w => {
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
  writeFileSync(process.argv[2] ?? 'test-results/s116-l3-loss.json', JSON.stringify({ report, hits }, null, 2));
} finally { world.dispose(); }
