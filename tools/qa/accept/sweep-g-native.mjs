/** Current-source global-row measurements using the existing acceptance probe. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { probeLevel, provenance } from './probe.ts';
import { evaluate } from './evaluate.ts';

const [row, level] = process.argv.slice(2);
if (!/^G-\d{2}$/.test(row) || !/^L([1-9]|10)$/.test(level)) throw new Error('Usage: sweep-g-native.mjs G-NN L<N>');
const root = 'docs/reports/sweep-g'; mkdirSync(root, { recursive: true });
const identity = provenance(), results = [];
for (const tier of ['low', 'high']) for (const policy of row === 'G-13' ? ['complete'] : ['complete', 'stationary']) {
  console.log(`Begin ${row} ${level} ${tier}/${policy}`);
  const receipt = await probeLevel(level, tier, policy, identity);
  const path = `${root}/${row}-${level}-${tier}-${policy}.json.gz`;
  const data = gzipSync(JSON.stringify(receipt)); writeFileSync(path, data);
  const checks = evaluate(receipt, path).filter(check => check.id === row);
  results.push({ tier, policy, path, sha256: createHash('sha256').update(data).digest('hex'), outcome: receipt.run?.outcome,
    nativeStateHash: receipt.nativeStateHash, error: receipt.error, checks });
  console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(`${root}/${row}-${level}-native.json`, JSON.stringify({ ...identity, generatedAt: new Date().toISOString(), row, level, results }, null, 2));
process.exitCode = results.some(result => result.error || result.checks.some(check => check.status === 'FAIL')) ? 1 : 0;
