/** Read-only: dump one L5 entity's state at a tick (complete route). Usage: ... low|high id tick */
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
const tier = process.argv[2] === 'high' ? 'high' : 'low', id = Number(process.argv[3]), at = Number(process.argv[4]);
const campaign = preset('L5-default'); campaign.settings.quality = tier;
await runLevel('L5', 'complete', 1, at / 60 + 1, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: world => {
  const update = world.update.bind(world);
  world.update = () => { update(); if (world.tick !== at) return; const e = world.entities.get(id)!;
    console.log(JSON.stringify({ archetype: e.archetype, health: e.health, hidden: e.hidden, corpse: e.corpse, civilian: e.civilian && { state: e.civilian.state, survivor: e.civilian.survivor, ally: !!e.civilian.ally, story: e.civilian.story, schedule: !!e.civilian.schedule }, transform: e.transform }, null, 0).slice(0, 1500)); };
} });
