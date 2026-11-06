import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { detourChecks, type DetourProof } from './l9-detour-receipts';
import { atomicJson } from './report';
import { provenance } from './probe';
const cases = [];
for (const tier of ['low', 'high']) for (const route of ['road', 'countryside', 'dry-shortcut']) {
  const bytes = readFileSync(`docs/reports/sweep-c5/L9-02/${tier}-${route}-physical.json.gz`);
  const original = JSON.parse(gunzipSync(bytes).toString()) as DetourProof;
  assert(detourChecks(original, tier, route).pass); cases.push({ tier, route, fault: 'original', pass: true, proofSha256: createHash('sha256').update(bytes).digest('hex') });
  for (const fault of ['crossed pack anchor', 'unfinished drive', 'no keyboard commands', 'wrong group anchor', 'unreviewed frame', 'missing tick interval', 'missing vehicle', 'no actual input frames']) {
    const broken = structuredClone(original), row = broken.rows[0];
    if (fault === 'crossed pack anchor') row.samples[Math.floor(row.samples.length / 2)].position = { x: row.groups[0].at[0], z: row.groups[0].at[1] };
    if (fault === 'unfinished drive') row.result.phase = 'driving';
    if (fault === 'no keyboard commands') row.commands = [];
    if (fault === 'wrong group anchor') row.groups[0].at[0]++;
    if (fault === 'unreviewed frame') delete row.captures[0].seen;
    if (fault === 'missing tick interval') row.samples[1].tick++;
    if (fault === 'missing vehicle') row.samples[0].vehiclePresent = false;
    if (fault === 'no actual input frames') row.result.inputs = [];
    assert(!detourChecks(broken, tier, route).pass, `${tier}/${route}: ${fault}`); cases.push({ tier, route, fault, rejected: true });
  }
}
atomicJson('docs/reports/sweep-c5/L9-02/physical-checker-controls.json', { ...provenance(), toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), cases, method: 'Pure checker counterexamples only; six actual proof files unchanged. These mutated data are not game observations.' });
console.log('Six actual drives pass;48 semantic detour faults reject.');
