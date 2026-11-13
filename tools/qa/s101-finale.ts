/** Exact native complete-policy finale receipt; gameplay and attack observer are unchanged. */
import { writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { observeAttackStarts } from './threat/attackStarts';
const receipts = [];
for (const quality of ['high', 'low'] as const) for (const seed of [1, 2, 3]) {
  const attacks: number[] = [];
  let installed: number | undefined, released: number | undefined;
  const result = await runLevel('L10', 'complete', seed, 1800, 'auto', preset('L10-default'), undefined, 0, {
    quality,
    beforeBegin(world) {
      observeAttackStarts(world, (_source, target, tick) => { if (target === 1) attacks.push(tick); });
      world.events.on('sim.tick', () => {
        const states = world.missions!.state.states;
        if (states['cure-installed']) installed ??= world.tick;
        if (states['cure-released']) released ??= world.tick;
      });
    },
  });
  const starts = attacks.filter(t => installed !== undefined && released !== undefined && t >= installed && t <= released);
  const points = installed !== undefined && released !== undefined ? [installed, ...starts, released] : [];
  const gaps = points.slice(1).map((t, i) => (t - points[i]) / 60);
  const receipt = { quality, seed, completed: result.completed, deaths: result.deaths, installed, released,
    durationS: installed !== undefined && released !== undefined ? (released - installed) / 60 : null,
    starts, headS: gaps[0] ?? null, tailS: gaps.at(-1) ?? null, maxGapS: gaps.length ? Math.max(...gaps) : null,
    pass: result.completed && starts.length > 0 && gaps.every(g => g <= 20) };
  receipts.push(receipt);
  console.log(JSON.stringify(receipt));
}
writeFileSync(process.env.S101_OUT ?? '/private/tmp/s101-finale.json', JSON.stringify(receipts, null, 2) + '\n');
