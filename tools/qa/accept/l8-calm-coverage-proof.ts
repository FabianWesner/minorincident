import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { l8CalmReceipts } from './l8-calm-receipts-r10';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';

const identity = provenance(), hash = browserHash();
const inputPath = (tier: string) => `docs/reports/fix51-r10c/L7-L8-carried-${tier}-input.json`;
const reviewPath = (tier: string) => `docs/reports/fix51-r10c/L7-L8-carried-${tier}/review.json`;
const auditPath = (tier: string) => `docs/reports/fix51-r10c/L7-L8-carried-${tier}/handover-audit-late-input.json.gz`;
const paths = ['low', 'high'].flatMap(tier => [inputPath(tier), reviewPath(tier), auditPath(tier)]);
const originals = new Map(paths.map(path => [path, readFileSync(path)]));
const restore = () => { for (const [path, bytes] of originals) writeFileSync(path, bytes); };
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const checks = () => l8CalmReceipts(identity.sourceHash, hash).map(({ receipt }) => ({ tier: receipt.tier, status: receipt.checks[0].status }));
const baseline = checks();
assert.deepEqual(baseline, [{ tier: 'low', status: 'PASS' }, { tier: 'high', status: 'PASS' }]);
const cases: { fault: string; results: ReturnType<typeof checks> }[] = [];
try {
  for (const fault of ['missing-tick-zero', 'calm-objective', 'calm-pin', 'calm-world-marker', 'early-breach', 'late-breach', 'sampling-gap', 'missing-high']) {
    restore();
    if (fault === 'missing-high') {
      const input = JSON.parse(readFileSync(inputPath('high'), 'utf8')); input.sourceHash = '0'.repeat(64);
      writeFileSync(inputPath('high'), JSON.stringify(input));
    } else {
      let audit = JSON.parse(gunzipSync(readFileSync(auditPath('low'))).toString());
      if (fault === 'missing-tick-zero') audit.shift();
      if (fault === 'calm-objective') audit[10].text = 'An early objective';
      if (fault === 'calm-pin') audit[10].pin = true;
      if (fault === 'calm-world-marker') audit[10].marker = true;
      if (fault === 'early-breach') audit.find((sample: { breached: boolean }) => sample.breached).tick = 3599;
      if (fault === 'late-breach') audit.find((sample: { breached: boolean }) => sample.breached).tick = 3601;
      if (fault === 'sampling-gap') audit = audit.filter((sample: { tick: number }) => sample.tick < 1000 || sample.tick > 1120);
      const raw = Buffer.from(JSON.stringify(audit)), bytes = gzipSync(raw); writeFileSync(auditPath('low'), bytes);
      const review = JSON.parse(readFileSync(reviewPath('low'), 'utf8'));
      const artifact = review.artifacts.find((item: { file: string }) => item.file === auditPath('low'));
      artifact.sha256 = sha(bytes); artifact.uncompressedSha256 = sha(raw); writeFileSync(reviewPath('low'), JSON.stringify(review));
    }
    const results = checks(), tier = fault === 'missing-high' ? 'high' : 'low';
    assert(!results.some(row => row.tier === tier && row.status === 'PASS'), fault); cases.push({ fault, results });
  }
} finally { restore(); }
assert(paths.every(path => readFileSync(path).equals(originals.get(path)!)));
assert.deepEqual(checks(), baseline);
atomicJson('docs/reports/sweep-c/L8-02-coverage-proof.json', { ...identity, browserHash: hash,
  toolSha256: sha(readFileSync(new URL(import.meta.url))), baseline, cases, originalBytesRestored: true,
  method: 'Actual production calm receipt consumer, eight temporary counterexamples with transport hashes rebound only for these declared negative controls. Missing tick0, early objective/pin/world-marker, breach3599/3601, >60tick observation gap and missing high coverage must reject. Exact original physical run artifacts and metadata restored in finally. Native everytick combat/marker coverage remains a separate required clause.' });
console.log(cases);
