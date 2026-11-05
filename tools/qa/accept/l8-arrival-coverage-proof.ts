import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { l8ArrivalReceipts } from './l8-arrival-receipts-r10';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';

const identity = provenance(), hash = browserHash(), proofPath = 'docs/reports/fix51-r10c/L8-arrival-proof.json';
const tiers = ['low', 'high'] as const;
const inputPath = (tier: string) => `docs/reports/fix51-r10c/L7-L8-carried-${tier}-input.json`;
const reviewPath = (tier: string) => `docs/reports/fix51-r10c/L7-L8-carried-${tier}/review.json`;
const ledgerPath = (tier: string) => `docs/reports/fix51-r10c/L7-L8-carried-${tier}/late-input-acceptance-ledger.json.gz`;
const paths = [proofPath, ...tiers.flatMap(tier => [inputPath(tier), reviewPath(tier), ledgerPath(tier)])];
const originals = new Map(paths.map(path => [path, readFileSync(path)]));
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const restore = () => { for (const [path, bytes] of originals) writeFileSync(path, bytes); };
const checks = () => l8ArrivalReceipts(identity.sourceHash, hash).map(({ receipt }) => ({ tier: receipt.tier, status: receipt.checks[0].status }));
const baseline = checks();
assert.deepEqual(baseline, [{ tier: 'low', status: 'PASS' }, { tier: 'high', status: 'PASS' }]);
const proof = JSON.parse(readFileSync(proofPath, 'utf8'));
assert.equal(proof.rows.find((row: { tier: string }) => row.tier === 'low').expectedIds.length, 0);
assert(proof.rows.find((row: { tier: string }) => row.tier === 'high').expectedIds.length > 0);
const cases: { fault: string; results: ReturnType<typeof checks> }[] = [];
try {
  for (const fault of ['missing-low-roster', 'invented-low-roster', 'wrong-high-native-id', 'damaged-high-arrival', 'damaged-corgi', 'wrong-racks', 'wrong-selection', 'missing-high', 'bad-producer-hash', 'unfinished-L7', 'stale-source']) {
    restore();
    const candidate = JSON.parse(readFileSync(proofPath, 'utf8'));
    const low = candidate.rows.find((row: { tier: string }) => row.tier === 'low');
    const high = candidate.rows.find((row: { tier: string }) => row.tier === 'high');
    if (fault === 'wrong-high-native-id') high.humans[0].id += 100000;
    if (fault === 'damaged-corgi') low.companions[0].hp--;
    if (fault === 'wrong-racks') high.racks.LEFT.reverse();
    if (fault === 'wrong-selection') low.selected = 'weapon.bat';
    if (fault === 'missing-high') candidate.rows = candidate.rows.filter((row: { tier: string }) => row.tier !== 'high');
    if (fault === 'stale-source') candidate.sourceHash = '0'.repeat(64);
    if (['missing-low-roster', 'invented-low-roster', 'damaged-high-arrival'].includes(fault)) {
      const tier = fault === 'damaged-high-arrival' ? 'high' : 'low';
      const ledger = JSON.parse(gunzipSync(readFileSync(ledgerPath(tier))).toString());
      const arrival = ledger.find((level: { level: string }) => level.level === 'L8').samples[0];
      if (fault === 'missing-low-roster') delete arrival.followers;
      if (fault === 'invented-low-roster') arrival.followers = [{ id: 999999, hp: 100 }];
      if (fault === 'damaged-high-arrival') arrival.followers[0].hp--;
      const raw = Buffer.from(JSON.stringify(ledger)), archive = gzipSync(raw);
      writeFileSync(ledgerPath(tier), archive);
      const review = JSON.parse(readFileSync(reviewPath(tier), 'utf8'));
      const artifact = review.artifacts.find((item: { file: string }) => item.file === ledgerPath(tier));
      artifact.sha256 = sha(archive); artifact.uncompressedSha256 = sha(raw);
      writeFileSync(reviewPath(tier), JSON.stringify(review));
    }
    if (fault === 'bad-producer-hash' || fault === 'unfinished-L7') {
      const input = JSON.parse(readFileSync(inputPath('low'), 'utf8'));
      if (fault === 'bad-producer-hash') input.toolSha256 = '0'.repeat(64);
      else input.result.runs.find((run: { level: string }) => run.level === 'L7').finished = false;
      writeFileSync(inputPath('low'), JSON.stringify(input)); low.inputSha256 = sha(readFileSync(inputPath('low')));
    }
    writeFileSync(proofPath, JSON.stringify(candidate));
    const results = checks(), affected = ['wrong-high-native-id', 'damaged-high-arrival', 'wrong-racks', 'missing-high'].includes(fault) ? 'high' : 'low';
    assert(!results.some(row => row.tier === affected && row.status === 'PASS'), fault);
    cases.push({ fault, results });
  }
} finally { restore(); }
assert(paths.every(path => readFileSync(path).equals(originals.get(path)!)), 'All exact qualifying bytes restored');
assert.deepEqual(checks(), baseline);
atomicJson('docs/reports/sweep-c/L8-01-coverage-proof.json', { ...identity, browserHash: hash,
  toolSha256: sha(readFileSync(new URL(import.meta.url))), baseline,
  method: 'Exercise actual production receipt consumer with11 temporary faults. Present empty low roster and nonempty high roster are genuine physical outcomes, both legal0–35 coverage. Missing arrays, invented identities, HP loss, rack/selection errors, missing coverage, stale source, bad producer hash and unfinished L7 must reject. Altered archives have matching temporary transport hashes so semantic faults, not checksum failures, are tested. Counterfactual mutations are never qualifying game evidence. Exact original bytes restored in finally.', cases, originalBytesRestored: true });
console.log(cases);
