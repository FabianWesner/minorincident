import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { fixtureHash } from './fixtures';
import { checkpointHash, type CheckpointReceipt } from './checkpoints';
import type { NativeReceipt } from './probe';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

/** Inspected physical research slices, plus the independently controlled mortal
 * checkpoint receipt. Native rack/speed clauses remain separate requirements. */
export function l10CureReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
  const tool = sha(readFileSync('tools/qa/accept/l10-batch-r10.ts'));
  const results: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of ['low', 'high'] as const) {
    const inputPath = `docs/reports/fix51-r10c/L10-${tier}-batch-2-input.json`;
    const reviewPath = `docs/reports/fix51-r10c/L10-${tier}-batch-2/review.json`;
    if (!existsSync(inputPath) || !existsSync(reviewPath)) continue;
    const input = JSON.parse(readFileSync(inputPath, 'utf8'));
    const review = JSON.parse(readFileSync(reviewPath, 'utf8')) as {
      sourceHash: string; browserHash: string; toolSha256: string;
      captures: { file: string; sha256: string; seen: string }[]; sheets: { file: string; sha256: string }[];
      artifacts: { file: string; sha256: string; uncompressedSha256: string }[];
      cureReview?: { row: string; reviewedAt: string; recording: { airborne: boolean; notVaccine: boolean; healthySafety: boolean; killsInfected: boolean; neverReverses: boolean; regionalDispersal: boolean; evidence: { file: string; sha256: string }[] }; backpack: { visible: boolean; noExtraSlot: boolean; evidence: { file: string; sha256: string }[] } };
    };
    if (input.sourceHash !== sourceHash || input.browserHash !== browserHash || input.toolSha256 !== tool || input.tier !== tier ||
      review.sourceHash !== sourceHash || review.browserHash !== browserHash || review.toolSha256 !== tool) continue;
    const reviewed = review.captures.length > 0 && review.captures.every(capture => /^[a-f0-9]{64}$/.test(capture.sha256) && capture.seen.trim()) &&
    review.sheets.length > 0 && review.sheets.every(sheet => evidenceIsArchivedOrMatches(sheet.file, sheet.sha256)) &&
      review.artifacts.length > 0 && review.artifacts.every(artifact => existsSync(artifact.file) && sha(readFileSync(artifact.file)) === artifact.sha256 && sha(gunzipSync(readFileSync(artifact.file))) === artifact.uncompressedSha256);
    if (!reviewed) continue;
    const completionArtifact = review.artifacts.find(item => item.file.endsWith('/late-input-completion.json.gz'));
    if (!completionArtifact) continue;
    const completion = JSON.parse(gunzipSync(readFileSync(completionArtifact.file)).toString());
    const runtimeMatches = completion.backend === 'webgl' && completion.quality === tier && Math.abs(completion.camera.zoom - 1.5) < 1e-8;
    const run = input.result?.runs.find((run: { level: string }) => run.level === 'L10');
    const steps = ['research', 'cure', 'research-exit', 'destroyed-corridor'];
    const traversed = run && !run.skipped.length && steps.every(id => run.steps.some((step: { id: string }) => step.id === id) && completion.mission.steps[id]?.status === 'completed');
    const carried = completion.mission.states['terminal-read'] && completion.mission.states['cure-carried'] && !completion.mission.states['cure-installed'] && completion.mission.items.filter((item: string) => item === 'cure-canister').length === 1;
    const consolePass = !input.error && input.result && !input.result.issues.some((issue: { kind: string }) => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind));
    const checked = review.cureReview;
    const evidenceMatches = (kind: 'recording' | 'backpack') => {
      const evidence = checked?.[kind].evidence;
      return evidence?.length === 2 && ['0-5', '1-5'].every(zoom => evidence.some(item => item.file.endsWith(`-${tier}-z${zoom}.jpg`) && item.file.includes(kind === 'recording' ? '-cure-t' : '-research-exit-') && review.captures.some(capture => capture.file === item.file && capture.sha256 === item.sha256)));
    };
    const pass = !!(runtimeMatches && traversed && carried && consolePass && checked?.row === 'L10-09' && Number.isFinite(Date.parse(checked.reviewedAt)) &&
      checked.recording.airborne && checked.recording.notVaccine && checked.recording.healthySafety && checked.recording.killsInfected && checked.recording.neverReverses && checked.recording.regionalDispersal &&
      checked.backpack.visible && checked.backpack.noExtraSlot && evidenceMatches('recording') && evidenceMatches('backpack'));
    const path = `${reportRoot}/receipts/L10-${tier}-cure-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L10', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [],
      checks: [{ id: 'L10-09', clause: 'reviewed airborne research subtitles and backpack canister', tier, policy: 'real-input-webgl2', status: pass ? 'PASS' : 'FAIL',
        value: { runtimeMatches, traversed: !!traversed, carried: !!carried, consolePass: !!consolePass, review: checked, inputPath, reviewPath },
        target: 'actual physical terminal→cure→corridor; complete research subtitle meaning and visible canister without extra weapon slot at both zooms; no skips or runtime errors', receipt: path }],
      observations: { browserHash, inputPath, reviewPath } };
    const checkpointPath = `${reportRoot}/receipts/L10-${tier}-checkpoints.json`, nativePath = `${reportRoot}/receipts/L10-${tier}-complete.json`;
    if (existsSync(checkpointPath) && existsSync(nativePath)) {
      const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8')) as CheckpointReceipt;
      const native = JSON.parse(readFileSync(nativePath, 'utf8')) as NativeReceipt;
      const death = checkpoint.checks.find(check => check.id === 'L10-15' && check.clause === 'cure and boss HP/death snapshot at cure-research');
      const value = death?.value as { damage: number; expected: { cure: boolean }; observed: { cure: boolean }; rackMatch: boolean } | undefined;
      if (checkpoint.sourceHash === sourceHash && native.sourceHash === sourceHash && checkpoint.tier === tier && native.tier === tier && checkpoint.fixtureHash === fixtureHash() && checkpoint.checkpointHash === checkpointHash() && !checkpoint.errors.length && checkpoint.control.identical && checkpoint.control.observed === native.nativeStateHash && checkpoint.control.control === native.nativeStateHash && death && value) {
        receipt.checks.push({ ...death, id: 'L10-09', clause: 'carried canister restored by actual checkpoint death', status: death.status === 'PASS' && value.damage >= 100 && value.expected.cure && value.observed.cure && value.rackMatch ? 'PASS' : 'FAIL', receipt: checkpointPath });
      }
    }
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
