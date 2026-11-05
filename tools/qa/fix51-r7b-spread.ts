import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { l1SpreadProbe, l1SpreadChecks } from './accept/l1-spread';
import { provenance } from './accept/probe';
const identity = provenance(), proofs = [];
for (const tier of ['low', 'high'] as const) {
  const result = await l1SpreadProbe(tier), checks = l1SpreadChecks(result);
  assert(Object.values(checks).every(Boolean));
  const mutants = [
    { ...result, report: { ...result.report, infectedAfterExit: { ...result.report.infectedAfterExit, 0: 4 } } },
    { ...result, report: { ...result.report, infectedAfterExit: { ...result.report.infectedAfterExit, 120: 14 } } },
    { ...result, report: { ...result.report, infectedAfterExit: { ...result.report.infectedAfterExit, 240: 24 } } },
    { ...result, spreadTurns: [...result.spreadTurns, { id: -1, tick: -1, bitten: false }] },
    { ...result, directSpawns: [{ id: -1, tick: -1 }] },
    { ...result, report: { ...result.report, deaths: 1 } },
  ].map(mutant => l1SpreadChecks(mutant));
  assert(mutants.every(mutant => Object.values(mutant).some(pass => !pass)));
  writeFileSync(`docs/reports/fix51-r7b/l1-spread-${tier}.json`, JSON.stringify({ ...identity, ...result, checks }, null, 2));
  proofs.push({ tier, positive: checks, mutants });
  console.log(tier, result.report.infectedAfterExit, checks);
}
writeFileSync('docs/reports/fix51-r7b/l1-spread-checker-proof.json', JSON.stringify({ ...identity, proofs }, null, 2));
