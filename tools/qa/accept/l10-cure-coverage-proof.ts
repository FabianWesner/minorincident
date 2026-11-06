import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { sweepC4L10CureReceipts } from './sweep-c4-l10-cure-receipts';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';
const identity = provenance(), reviewPath = 'docs/reports/sweep-c4/L10-09-review.json', reviewBytes = readFileSync(reviewPath), cases = [];
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
for (const tier of ['low', 'high']) {
  const proofPath = `docs/reports/sweep-c4/L10-09-${tier}-physical.json.gz`, original = readFileSync(proofPath);
  const verdict = () => sweepC4L10CureReceipts(identity.sourceHash, browserHash()).find(result => result.receipt.tier === tier)?.receipt.checks.find(check => check.clause === 'reviewed airborne research subtitles and backpack canister')?.status;
  try {
    assert.equal(verdict(), 'PASS'); cases.push({ tier, fault: 'original', observed: verdict() });
    for (const fault of ['truncated subtitle', 'missing close recording', 'extra weapon slot', 'lost carried checkpoint', 'no interaction', 'no physical movement', 'unreviewed capture']) {
      const proof = JSON.parse(gunzipSync(original).toString()), review = JSON.parse(reviewBytes.toString());
      if (fault === 'truncated subtitle') for (const sample of proof.samples.filter((sample: { stage: string }) => sample.stage === 'recording')) sample.subtitle = 'A cure.';
      if (fault === 'missing close recording') proof.samples = proof.samples.filter((sample: { stage: string; zoom: number }) => sample.stage !== 'recording' || sample.zoom !== .5);
      if (fault === 'extra weapon slot') for (const sample of proof.samples.filter((sample: { stage: string }) => sample.stage === 'carried')) sample.racks.LEFT.push('weapon.canister');
      if (fault === 'lost carried checkpoint') for (const sample of proof.samples.filter((sample: { stage: string }) => sample.stage === 'exit')) sample.saved.carried = false;
      if (fault === 'no interaction') proof.result.inputs = [];
      if (fault === 'no physical movement') proof.commands = proof.commands.filter((command: { keys?: string[] }) => !command.keys?.length);
      if (fault === 'unreviewed capture') for (const capture of review.captures) capture.seen = '';
      const bytes = gzipSync(JSON.stringify(proof)); writeFileSync(proofPath, bytes);
      review.proofs.find((ref: { file: string }) => ref.file === proofPath).sha256 = sha(bytes);
      writeFileSync(reviewPath, JSON.stringify(review));
      assert.equal(verdict(), 'FAIL', `${tier}: ${fault}`); cases.push({ tier, fault, observed: verdict() });
      writeFileSync(proofPath, original); writeFileSync(reviewPath, reviewBytes);
    }
  } finally { writeFileSync(proofPath, original); writeFileSync(reviewPath, reviewBytes); }
}
// Restore the generated clause receipts as well as the exact original evidence bytes.
sweepC4L10CureReceipts(identity.sourceHash, browserHash());
atomicJson('docs/reports/sweep-c5/L10-09/checker-controls.json', { ...identity, cases });
console.log('Fourteen semantic faults rejected; both original physical receipts pass; exact evidence restored.');
