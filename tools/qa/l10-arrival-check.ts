/** L10 finale timing after dressing changes. --variants compares the shipped allocator with 0 / ±4 props.
 * Run under tools/sim-lock.sh (Mac CPU slot) or tools/remote/run.sh. */
import { deepStrictEqual, equal } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runFinaleCalibration } from '../sim-runner/l10-finale-calibration';
import { withLegacyPropIds } from '../sim-runner/propVariants';

const args = process.argv.slice(2), variants = args.includes('--variants');
const positional = args.filter(arg => !arg.startsWith('--'));
const tiers = (positional[0] ? [positional[0]] : ['high', 'low']) as ('high' | 'low')[];
if (tiers.some(tier => tier !== 'high' && tier !== 'low')) throw new Error('Tier must be high or low');
const delta = Number(positional[1] ?? 0) as -4 | 0 | 4;
if (![-4, 0, 4].includes(delta)) throw new Error('Prop delta must be -4, 0 or 4');
const rows: object[] = [];
try {
  for (const tier of tiers) {
    let baseline: Awaited<ReturnType<typeof runFinaleCalibration>> | undefined;
    for (const props of variants ? [0, 0, -4, 4] as const : [delta]) {
      const legacy = variants && baseline === undefined;
      const run = () => runFinaleCalibration(tier, props);
      const r = legacy ? await withLegacyPropIds(run) : await run();
      const mode = legacy ? 'main' : 'candidate';
      const row = { mode, tier, props, arrival: r.arrival, released: r.released, deaths: r.deaths, peak: r.peak,
        fullChargeBossGate: r.fullChargeBossGate, bossIdChanged: r.bossIdChanged,
        outcomeHash: createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 16) };
      rows.push({ ...row, result: r }); console.log(JSON.stringify(row));
      equal(r.released, true, `${tier}/${props}: cure must release`);
      equal(r.deaths, 0, `${tier}/${props}: no deaths`);
      if (legacy) baseline = r;
      else if (baseline) deepStrictEqual(r, baseline, `${tier}/${props}: finale differs from main`);
    }
  }
} finally {
  mkdirSync('test-results/prop-invariance', { recursive: true });
  writeFileSync('test-results/prop-invariance/l10.json', JSON.stringify(rows, null, 2) + '\n');
}
