import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { l8BoardingReceipts } from './l8-boarding-receipts';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';

const identity = provenance(), hash = browserHash();
const proofPath = 'docs/reports/sweep-c/L8-09-boarding-native.json', radarPath = 'docs/reports/sweep-c/L8-09-radar-replay.json';
const samplePath = 'docs/reports/sweep-c/L8-09-low-boarding-samples.json.gz';
const completionPath = 'docs/reports/fix51-r10c/L7-L8-carried-low/late-input-completion.json.gz';
const reviewPath = 'docs/reports/fix51-r10c/L7-L8-carried-low/review.json';
const paths = [proofPath, radarPath, samplePath, completionPath, reviewPath];
const originals = new Map(paths.map(path => [path, readFileSync(path)]));
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const restore = () => { for (const [path, bytes] of originals) writeFileSync(path, bytes); };
const checks = () => l8BoardingReceipts(identity.sourceHash, identity.observerHash, hash).map(({ receipt }) => ({ tier: receipt.tier, checks: receipt.checks.map(check => check.status) }));
const baseline = checks();
assert.deepEqual(baseline, [{ tier: 'low', checks: ['PASS', 'PASS', 'PASS'] }, { tier: 'high', checks: ['PASS', 'PASS', 'PASS'] }]);
const cases = [];
try {
  for (const fault of ['unseated-native-member', 'departure-with-waiter', 'unassigned-hidden-member', 'invented-internal-accounting', 'unseated-physical-corgi', 'invented-physical-gun', 'missing-pin', 'missing-tick', 'missing-high', 'stale-source', 'changed-observer', 'unreviewed-image']) {
    restore();
    const proof = JSON.parse(readFileSync(proofPath, 'utf8')), radar = JSON.parse(readFileSync(radarPath, 'utf8'));
    const low = proof.rows.find((row: { tier: string }) => row.tier === 'low'), ui = radar.rows.find((row: { tier: string }) => row.tier === 'low');
    if (fault === 'unseated-native-member') low.transfer.vehicle.vehicle.passengers[0].phase = 'entering';
    if (fault === 'departure-with-waiter' || fault === 'unassigned-hidden-member') {
      const samples = JSON.parse(gunzipSync(readFileSync(samplePath)).toString());
      if (fault === 'departure-with-waiter') samples.find((sample: { waiting: number[] }) => sample.waiting.length).canDrive = true;
      else {
        const sample = samples.find((sample: { actors: { hidden: boolean; companion?: unknown }[] }) => sample.actors.some(actor => actor.hidden && !actor.companion));
        delete sample.actors.find((actor: { hidden: boolean; companion?: unknown }) => actor.hidden && !actor.companion).passengerOf;
      }
      const bytes = gzipSync(JSON.stringify(samples)); writeFileSync(samplePath, bytes); low.samplesSha256 = sha(bytes);
    }
    if (fault === 'unseated-physical-corgi' || fault === 'invented-physical-gun') {
      const completion = JSON.parse(gunzipSync(readFileSync(completionPath)).toString());
      if (fault === 'unseated-physical-corgi') completion.campaign.transport.vehicle.vehicle.passengers[0].phase = 'entering';
      else completion.campaign.transport.vehicle.vehicle.turret = 'counterfactual-gun';
      const raw = Buffer.from(JSON.stringify(completion)), bytes = gzipSync(raw); writeFileSync(completionPath, bytes);
      const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
      const artifact = review.artifacts.find((entry: { file: string }) => entry.file === completionPath);
      artifact.sha256 = sha(bytes); artifact.uncompressedSha256 = sha(raw); writeFileSync(reviewPath, JSON.stringify(review));
    }
    if (fault === 'missing-pin') ui.missingPins++;
    if (fault === 'invented-internal-accounting') ui.internalPassengerSamples++;
    if (fault === 'missing-tick') ui.ticks--;
    if (fault === 'missing-high') proof.rows = proof.rows.filter((row: { tier: string }) => row.tier !== 'high');
    if (fault === 'stale-source') proof.sourceHash = '0'.repeat(64);
    if (fault === 'changed-observer') proof.observerHash = '0'.repeat(64);
    if (fault === 'unreviewed-image') delete ui.capture.seen;
    writeFileSync(proofPath, JSON.stringify(proof)); radar.nativeProofSha256 = sha(readFileSync(proofPath)); writeFileSync(radarPath, JSON.stringify(radar));
    const results = checks(), affected = fault === 'missing-high' ? 'high' : 'low';
    assert(!results.some(row => row.tier === affected && row.checks.every(status => status === 'PASS')), fault);
    cases.push({ fault, results });
  }
} finally { restore(); }
assert(paths.every(path => readFileSync(path).equals(originals.get(path)!)));
assert.deepEqual(checks(), baseline);
atomicJson('docs/reports/sweep-c/L8-09-coverage-proof.json', { ...identity, browserHash: hash,
  toolSha256: sha(readFileSync(new URL(import.meta.url))), baseline, cases, originalBytesRestored: true,
  method: 'Twelve counterfactual mutations through actual receipt consumer. Matching transport/proof hashes refreshed to test semantics. Hidden actor without assigned APC and invented internal accounting both reject. Every tier must retain all three passing clauses. Native state, qualified archives and manual reviews restored byte-for-byte; no counterfactual is game evidence.' });
