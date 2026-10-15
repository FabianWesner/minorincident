import { mkdirSync, writeFileSync } from 'node:fs';
import { runFinaleCalibration } from '../../../../tools/sim-runner/l10-finale-calibration';
const label = process.argv[2] ?? 'after';
mkdirSync(`test-results/astra-hitches/${label}`, { recursive: true });
for (const tier of ['high', 'low'] as const) {
  const start = performance.now();
  const result = await runFinaleCalibration(tier);
  const wallSeconds = (performance.now() - start) / 1000;
  writeFileSync(`test-results/astra-hitches/${label}/${tier}.json`, JSON.stringify({ wallSeconds, result }, null, 2));
  console.log(JSON.stringify({ label, tier, wallSeconds, arrival: result.arrival, released: result.released }));
}
