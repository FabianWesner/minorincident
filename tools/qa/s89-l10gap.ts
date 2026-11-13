/** Native L10 cadence receipt. Observer only; does not alter inputs, actors or audit thresholds. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { observeAttackStarts } from './threat/attackStarts';
import { cureHangarConversation } from '../../src/data/l10Story';

const rows = [];
const seeds = (process.env.S89_SEEDS ?? '1,2,3').split(',').map(Number);
const tiers = (process.env.S89_TIERS ?? 'low,high').split(',') as ('low' | 'high')[];
if (!seeds.length || seeds.some(seed => ![1, 2, 3].includes(seed)) || new Set(seeds).size !== seeds.length ||
    !tiers.length || tiers.some(tier => !['low', 'high'].includes(tier)) || new Set(tiers).size !== tiers.length) throw new Error('Expected unique seeds 1–3 and low/high tiers');
const baseline = JSON.parse(readFileSync(process.env.S89_BASELINE ?? 'docs/reports/s89-l10gap/baseline.json', 'utf8')) as {
  rows: { seed: number; quality: string; startsPerMinute: number }[];
};
const flags: string[] = [];
if (seeds.length !== 3 || tiers.length !== 2) flags.push('PARTIAL_MATRIX');
for (const seed of seeds) for (const quality of tiers) {
  const starts: number[] = [], protectedTicks: number[] = [];
  let totalTicks = 0, dialogueProgress = 0;
  const result = await runLevel('L10', 'complete', seed, 1800, 'auto', preset('L10-default'), undefined, 0, {
    quality,
    beforeBegin(world) {
      observeAttackStarts(world, (_source, target, tick) => { if (target === 1) starts.push(tick); });
      world.events.on('sim.tick', event => {
        if (event.type !== 'sim.tick') return;
        const state = world.missions!.state;
        const line = state.counters['hangar-line'] ?? 0;
        const progress = cureHangarConversation.slice(0, line).reduce((sum, entry) => sum + entry[1], 0) + (state.counters['hangar-line-ticks'] ?? 0);
        if (progress > dialogueProgress) protectedTicks.push(event.tick);
        dialogueProgress = progress;
      });
    },
    beforeDispose(world) { totalTicks = world.tick; },
  });
  starts.sort((a, b) => a - b);
  const gaps = starts.slice(1).map((tick, i) => {
    const from = starts[i], excludedTicks = protectedTicks.filter(t => t > from && t <= tick).length;
    return { from: from / 60, to: tick / 60, rawSeconds: (tick - from) / 60, hangarSeconds: excludedTicks / 60, seconds: (tick - from - excludedTicks) / 60 };
  });
  const row = { seed, quality, completed: result.completed, deaths: result.deaths, totalTicks, attackStarts: starts.length,
    startsPerMinute: starts.length / ((totalTicks - (starts[0] ?? 0)) / 3600),
    longestGapSeconds: Math.max(0, ...gaps.map(g => g.seconds)), protectedSeconds: protectedTicks.length / 60,
    peakInfected: result.maxConcurrentInfected, starts: starts.map(t => t / 60), gaps };
  const reference = baseline.rows.find(entry => entry.seed === seed && entry.quality === quality);
  const prefix = `${seed}/${quality}`;
  if (!row.completed) flags.push(`${prefix}:INCOMPLETE`);
  if (starts.length < 2) flags.push(`${prefix}:INSUFFICIENT_ATTACK_STARTS`);
  if (row.longestGapSeconds > 45) flags.push(`${prefix}:GAP_OVER_45`);
  if (!reference || !Number.isFinite(reference.startsPerMinute)) flags.push(`${prefix}:MISSING_RATE_BASELINE`);
  else if (!Number.isFinite(row.startsPerMinute) || row.startsPerMinute < reference.startsPerMinute) flags.push(`${prefix}:RATE_REGRESSION`);
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(process.env.S89_OUT ?? '/private/tmp/s89-cadence.json', JSON.stringify({
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  method: 'Native complete policy; adjacent courier attack starts; subtract only observed protected research dialogue ticks. Rate uses first attack to final world tick, matching s86. No end-tail criterion is inferred.', passed: flags.length === 0, flags, rows,
}, null, 2) + '\n');

if (flags.length) { console.error(JSON.stringify({ flags })); process.exitCode = 1; }
