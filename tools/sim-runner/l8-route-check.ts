/** L8 native route receipt; runner provenance is explicit because its checkout has no commit. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { probeLevel, provenance, type Tier } from '../qa/accept/probe';
import { evaluate } from '../qa/accept/evaluate';
const out = process.env.L8_ROUTE_OUT ?? 'test-results/l8-route'; mkdirSync(out, { recursive: true });
const tier = (process.env.L8_BOSS_TIER ?? 'low') as Tier;
const identity = provenance(process.env.L8_BOSS_REVISION ?? 'working-tree');
let failed = false;
for (const policy of ['stationary', 'complete'] as const) {
  if (process.env.L8_ROUTE_POLICY && policy !== process.env.L8_ROUTE_POLICY) continue;
  console.log(`L8 ${tier}/${policy} starting`);
  const receipt = await probeLevel('L8', tier, policy, identity);
  const path = `${out}/${tier}-${policy}.json`; writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n');
  const clauses = evaluate(receipt, path).filter(c => ['G-13', 'G-22', 'L8-06'].includes(c.id));
  writeFileSync(`${out}/${tier}-${policy}-clauses.json`, JSON.stringify(clauses, null, 2) + '\n');
  console.log(JSON.stringify({ tier, policy, outcome: receipt.run?.outcome, error: receipt.error, clauses }));
  if (receipt.error || policy === 'complete' && !receipt.run?.completed || clauses.some(c => c.status === 'FAIL')) failed = true;
}
if (failed) process.exitCode = 1;
