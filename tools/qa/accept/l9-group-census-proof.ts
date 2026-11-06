import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { l9GroupCensusReceipts } from './l9-group-census-receipts';
import { provenance } from './probe';
import { atomicJson } from './report';
const path = 'docs/reports/sweep-c/L9-02-census.json', original = readFileSync(path), identity = provenance();
const actual = JSON.parse(original.toString());
const results: { name: string; qualifies: boolean }[] = [];
const check = () => {
  const rows = l9GroupCensusReceipts(identity.sourceHash);
  return rows.length === 2 && rows.every(row => row.receipt.checks.every(check => check.status === 'PASS'));
};
const fault = (name: string, mutate: (value: typeof actual) => void) => {
  const value = structuredClone(actual); mutate(value); writeFileSync(path, JSON.stringify(value));
  const qualifies = check(); results.push({ name, qualifies }); assert.equal(qualifies, false, name);
};
try {
  assert(check()); results.push({ name: 'actual eight-member groups and all driven detours qualify', qualifies: true });
  fault('nine bodies rejected', value => { const g = value.rows[0].groups[0]; g.ids.push(-1); g.actors.push({ id: -1, archetype: 'infected.runner' }); });
  fault('missing Alpha rejected', value => { value.rows[0].groups.flatMap((g: { actors: { archetype: string }[] }) => g.actors).find((a: { archetype: string }) => a.archetype === 'infected.alpha').archetype = 'infected.runner'; });
  fault('duplicate IDs rejected', value => { const g = value.rows[0].groups[0]; g.ids[1] = g.ids[0]; });
  fault('actor IDs must match census IDs', value => { value.rows[0].groups[0].actors[0].id = -1; });
  fault('missing group rejected', value => { value.rows[0].groups.pop(); });
  fault('duplicated detour cannot replace missing detour', value => { value.rows[0].detours[1] = value.rows[0].detours[0]; });
  fault('clearance below twenty metres rejected', value => { value.rows[0].detours[0].minimumDriveClearance = 19.99; });
  fault('stale source rejected', value => { value.sourceHash = '0'.repeat(64); });
  fault('observer side effect rejected', value => { value.cells[0].controlIdentical = false; });
} finally {
  writeFileSync(path, original); l9GroupCensusReceipts(identity.sourceHash);
}
atomicJson(`docs/reports/fix65-c/L9-02-adapter-controls-${identity.sourceHash.slice(0, 8)}.json`, { ...identity, results,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  originalRestored: readFileSync(path).equals(original), censusSha256: createHash('sha256').update(original).digest('hex') });
console.log(results);
