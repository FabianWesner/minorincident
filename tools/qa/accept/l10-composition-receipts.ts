import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { atomicJson, reportRoot } from './report';
import type { FixtureReceipt } from './fixtures';

interface Census { tick: number; count: number; dogs: number; alphas: number; ids: number[] }
interface Interval { firstTick: number; lastTick: number; count: number; dogs: number; alphas: number }
const bounds = [
  ['residential-fringe', [8, 16], [12, 24], [1, 2], [0, 0]],
  ['industrial-area', [16, 28], [25, 45], [2, 4], [1, 1]],
  ['military-zone', [28, 45], [45, 75], [2, 4], [1, 2]],
  ['research-campus', [35, 55], [55, 85], [2, 4], [1, 2]],
  ['destroyed-corridor', [50, 75], [80, 130], [3, 5], [2, 3]],
  ['dispersal-complex', [75, 95], [140, 190], null, null],
] as const;
export function l10CompositionReceipts(sourceHash: string, observerHash: string): { path: string; receipt: FixtureReceipt }[] {
  const file = 'docs/reports/fix72-c/L10-03/simultaneous-census.json';
  if (!existsSync(file)) return [];
  const d = JSON.parse(readFileSync(file, 'utf8')) as {
    sourceHash: string; observerHash: string; toolSha256: string;
    rows: { tier: string; controlIdentical: boolean; nativeStateHash: string;
      fringeDogs: { pickupTick: number | null; firstDogTick: number | null; prematureTicks: number; nativeStateHash: string; controlIdentical: boolean };
      regions: { region: string; ticks: number; upperViolations: number; witness: Census | null; intervals: Interval[] }[] }[];
  };
  const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  return (['low', 'high'] as const).map(tier => {
    const row = d.rows.find(r => r.tier === tier);
    const native = JSON.parse(readFileSync(`${reportRoot}/receipts/L10-${tier}-complete.json`, 'utf8'));
    const fresh = d.sourceHash === sourceHash && d.observerHash === observerHash &&
      d.toolSha256 === sha('tools/qa/accept/fix72-c-l10-composition.ts') && row?.controlIdentical &&
      native.sourceHash === sourceHash && native.observerHash === observerHash && native.nativeStateHash === row.nativeStateHash && native.run?.completed;
    const checks = bounds.map(([region, low, high, dogs, alphas]) => {
      const r = row?.regions.find(r => r.region === region), w = r?.witness, range = tier === 'low' ? low : high;
      const within = (value: number, limits: readonly [number, number]) => value >= limits[0] && value <= limits[1];
      const intervals = !!r && r.intervals.length > 0 && r.intervals.every((i, index) =>
        i.firstTick <= i.lastTick && (!index || i.firstTick === r.intervals[index - 1].lastTick + 1) &&
        i.count <= range[1] && (!dogs || i.dogs <= dogs[1]) && (!alphas || i.alphas <= alphas[1])) &&
        r.intervals.reduce((n, i) => n + i.lastTick - i.firstTick + 1, 0) === r.ticks;
      const witness = !!w && within(w.count, range) && (!dogs || within(w.dogs, dogs)) && (!alphas || within(w.alphas, alphas)) &&
        r!.intervals.some(i => i.firstTick <= w.tick && i.lastTick >= w.tick && i.count === w.count && i.dogs === w.dogs && i.alphas === w.alphas);
      return { region, intervals, witness, upperViolations: r?.upperViolations, sample: w };
    });
    const dogs = row?.fringeDogs;
    const pickup = !!dogs && dogs.pickupTick !== null && dogs.firstDogTick !== null && dogs.firstDogTick >= dogs.pickupTick &&
      dogs.prematureTicks === 0 && dogs.controlIdentical && dogs.nativeStateHash === native.nativeStateHash;
    const path = `${reportRoot}/receipts/L10-${tier}-composition.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L10', tier, sourceHash, fixtureHash: sha(new URL(import.meta.url).pathname), errors: [], checks: [
      { id: 'L10-03', clause: 'same-tick regional count and species composition', tier, policy: 'complete',
        status: fresh && checks.every(c => c.intervals && c.witness && c.upperViolations === 0) ? 'PASS' : 'FAIL',
        value: { fresh: !!fresh, regions: checks }, target: 'Every region has one joint count/dog/Alpha witness; every local tick preserves authored upper bounds; canonical final state identical.', receipt: file },
      { id: 'L10-03', clause: 'residential dogs follow actual handgun pickup', tier, policy: 'complete',
        status: fresh && pickup ? 'PASS' : 'FAIL', value: dogs, target: 'Actual handgun pickup observed; first admitted fringe dog at or after pickup; zero premature ticks; canonical control identical.', receipt: file },
    ] };
    atomicJson(path, receipt); return { path, receipt };
  });
}
