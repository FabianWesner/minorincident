import { writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { ThreatObserver } from './threat/observer';
const campaign = preset('L10-default'); campaign.seed = 1; campaign.settings.quality = 'low';
const samples: unknown[] = [];
let observation: unknown;
await runLevel('L10', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: 'low', passive: true,
  beforeBegin: world => {
    const observer = new ThreatObserver(world, 'L10');
    const update = world.update.bind(world);
    world.update = () => {
      update();
      if (world.tick >= 70000 && world.tick <= 75000 && world.tick % 60 === 0) {
        const actor = world.entities.get(120);
        if (actor?.infected) samples.push({ tick: world.tick, player: { ...world.entities.get(1)!.transform }, actor: { ...actor.transform }, health: actor.health.current, radius: actor.combat?.radius, brain: structuredClone(actor.infected) });
      }
    };
    observation = observer;
  },
  beforeDispose: () => { observation = (observation as ThreatObserver).finish(); },
});
writeFileSync('test-results/s116-l10-stuck.json', JSON.stringify({ samples, observation }, null, 2));
