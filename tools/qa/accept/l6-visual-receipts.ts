/** Qualify L6's measured presentation fixtures only while every source/evidence digest matches. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';
type Hashed = { file: string; sha256: string };
type Published = { sourceHash: string; browserHash: string; publisherSha256: string; evidence: Hashed[]; captureReview: Hashed; receipts: FixtureReceipt[] };
const sha = (file: string | URL) => createHash('sha256').update(readFileSync(file)).digest('hex');
export function l6VisualReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const path = 'docs/reports/l6-visual/acceptance-fixtures.json';
  if (!existsSync(path)) return [];
  const proof = JSON.parse(readFileSync(path, 'utf8')) as Published;
  if (proof.sourceHash !== sourceHash || proof.browserHash !== browserHash || proof.publisherSha256 !== sha('tools/qa/l6-visual-publish.py') ||
      !proof.evidence.length || !proof.evidence.every(e => existsSync(e.file) && sha(e.file) === e.sha256) ||
      !existsSync(proof.captureReview.file) || sha(proof.captureReview.file) !== proof.captureReview.sha256) return [];
  const review = JSON.parse(readFileSync(proof.captureReview.file, 'utf8')) as { sourceHash: string; allPersonallyReviewed: boolean; images: (Hashed & { what: string })[] };
  if (review.sourceHash !== sourceHash || !review.allPersonallyReviewed || !review.images.length ||
      !review.images.every(c => c.what.trim() && evidenceIsArchivedOrMatches(c.file, c.sha256))) return [];
  const results = [];
  for (const tier of ['low', 'high'] as const) {
    const measured = proof.receipts.find(r => r.tier === tier && r.level === 'L6' && r.sourceHash === sourceHash);
    if (!measured || measured.errors.length || !['L6-01', 'L6-02', 'L6-04', 'L6-06', 'L6-08', 'L6-09', 'L6-11', 'L6-12', 'L6-14'].every(id => measured.checks.some(c => c.id === id && c.tier === tier))) continue;
    const receipt: FixtureReceipt = { ...measured, fixtureHash: sha(new URL(import.meta.url)), observations: { proof: path, captureReview: proof.captureReview, frameTiming: false, scope: 'Controlled native/browser fixtures and the exact full-row manual reviews; no full physical route or global performance signoff.' } };
    const receiptPath = `${reportRoot}/receipts/L6-${tier}-visual-browser.json`; atomicJson(receiptPath, receipt); results.push({ path: receiptPath, receipt });
  }
  return results;
}
