import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fix55L9Receipts } from './fix55-l9-receipts';
import { provenance } from './probe';
import { atomicJson } from './report';

const identity = provenance(), path = 'docs/reports/sweep-c/L9-02-census.json', original = readFileSync(path);
const read = () => fix55L9Receipts(identity.sourceHash).map(item => ({ tier: item.receipt.tier,
  status: item.receipt.checks.find(check => check.clause === 'actual admitted route group member census')?.status ?? 'NOT CHECKED' }));
const cases: { name: string; results: ReturnType<typeof read> }[] = [];
try {
  const actual = read(); assert(actual.length === 2 && actual.every(row => row.status === 'FAIL'));
  cases.push({ name: 'actual current nine-member cohorts reject eight-total criterion', results: actual });
  const conforming = JSON.parse(original.toString());
  // Counterfactual receipt only: demonstrate that exact eight-member groups
  // retaining both Alphas would pass this count clause. No game actors change.
  for (const row of conforming.rows) for (const group of row.groups) {
    if (group.actors.length !== 9) continue;
    const index = group.actors.findIndex((actor: { archetype: string }) => actor.archetype === 'infected.runner');
    const [removed] = group.actors.splice(index, 1);
    group.ids = group.ids.filter((id: number) => id !== removed.id);
    group.actualCount = 8; group.runners = 7; group.status = 'PASS';
  }
  writeFileSync(path, JSON.stringify(conforming));
  const positive = read(); assert(positive.every(row => row.status === 'PASS'));
  cases.push({ name: 'synthetic exact-count control, not an actual game pass', results: positive });
  const missingAlpha = structuredClone(conforming);
  const alphaGroup = missingAlpha.rows[0].groups.find((group: { alphas: number }) => group.alphas === 1);
  alphaGroup.actors.find((actor: { archetype: string }) => actor.archetype === 'infected.alpha').archetype = 'infected.runner';
  writeFileSync(path, JSON.stringify(missingAlpha));
  const alpha = read(); assert.equal(alpha[0].status, 'FAIL');
  cases.push({ name: 'missing required Alpha', results: alpha });
  const duplicate = structuredClone(conforming), group = duplicate.rows[0].groups[0];
  group.ids[1] = group.ids[0]; group.actors[1].id = group.actors[0].id;
  writeFileSync(path, JSON.stringify(duplicate));
  const repeated = read(); assert.equal(repeated[0].status, 'FAIL');
  cases.push({ name: 'duplicate actor ID cannot count twice', results: repeated });
  const partial = structuredClone(conforming); partial.rows[0].groups.pop();
  writeFileSync(path, JSON.stringify(partial));
  const absent = read(); assert.equal(absent[0].status, 'NOT CHECKED');
  cases.push({ name: 'missing cohort evidence cannot qualify count clause', results: absent });
  const stale = structuredClone(conforming); stale.sourceHash = '0'.repeat(64);
  writeFileSync(path, JSON.stringify(stale));
  const old = read(); assert(old.every(row => row.status === 'NOT CHECKED'));
  cases.push({ name: 'stale source cannot qualify count clause', results: old });
} finally {
  writeFileSync(path, original); fix55L9Receipts(identity.sourceHash);
}
assert(readFileSync(path).equals(original));
atomicJson('docs/reports/sweep-c/L9-02-census-controls.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  cases, actualCensusRestored: true, actualCensusSha256: createHash('sha256').update(original).digest('hex'),
  method: 'Temporary receipt controls only; all production populations and actors remain unchanged. The actual game result is FAIL; the positive counterfactual is not qualifying game evidence.',
});
console.log(cases);
