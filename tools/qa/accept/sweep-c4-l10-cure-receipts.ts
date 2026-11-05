import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { fixtureHash } from './fixtures';
import { checkpointHash, type CheckpointReceipt } from './checkpoints';
import type { NativeReceipt } from './probe';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

type Hashed = { file: string; sha256: string };
type Sample = { stage: string; quality: string; zoom: number; subtitle: string; states: Record<string, boolean>; items: string[]; checkpoint: string; racks: { LEFT: string[]; RIGHT: string[] }; saved: { carried: boolean; items: string[] } };
type Proof = { sourceHash: string; browserHash: string; toolSha256: string; tier: string; native: Hashed; seed: { path: string; sha256: string }; setup: { backend: string; quality: string }; errors: string[]; samples: Sample[]; commands: { keys?: string[]; key?: string }[]; captures: (Hashed & { stage: string; zoom: number })[]; result: { inputs: { frame: { interact: boolean } }[] } };

/** Focused actual research interaction, paired with independent full-route and death controls. */
export function sweepC4L10CureReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const reviewPath = 'docs/reports/sweep-c4/L10-09-review.json';
  if (!existsSync(reviewPath)) return [];
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const review = JSON.parse(readFileSync(reviewPath, 'utf8')) as { sourceHash: string; browserHash: string; proofs: Hashed[]; captures: (Hashed & { seen: string })[]; sheets: Hashed[]; recordingMeaning: boolean; visibleBackpackAtBothZooms: boolean };
  if (review.sourceHash !== sourceHash || review.browserHash !== browserHash) return [];
  const results = [];
  for (const tier of ['low', 'high'] as const) {
    const proofPath = `docs/reports/sweep-c4/L10-09-${tier}-physical.json.gz`;
    if (!existsSync(proofPath)) continue;
    const bytes = readFileSync(proofPath), proof = JSON.parse(gunzipSync(bytes).toString()) as Proof;
    if (!review.proofs.some(ref => ref.file === proofPath && ref.sha256 === sha(bytes)) || proof.sourceHash !== sourceHash || proof.browserHash !== browserHash || proof.tier !== tier || proof.toolSha256 !== sha(readFileSync('tools/qa/accept/sweep-c4-l10-cure.mjs')) || proof.errors.length) continue;
    if (!existsSync(proof.native.file) || sha(readFileSync(proof.native.file)) !== proof.native.sha256 || !existsSync(proof.seed.path) || sha(readFileSync(proof.seed.path)) !== proof.seed.sha256) continue;
    const nativePath = `${reportRoot}/receipts/L10-${tier}-complete.json`, native = JSON.parse(readFileSync(nativePath, 'utf8')) as NativeReceipt;
    const observation = JSON.parse(readFileSync(proof.native.file, 'utf8'));
    const control = observation.rows.find((row: { tier: string }) => row.tier === tier);
    if (observation.sourceHash !== sourceHash || observation.observerHash !== native.observerHash || observation.toolSha256 !== sha(readFileSync('tools/qa/accept/l10-cure-r10.ts')) || !control?.controlIdentical || control.nativeStateHash !== native.nativeStateHash || control.physicalSeed?.path !== proof.seed.path || control.physicalSeed?.sha256 !== proof.seed.sha256) continue;
    const initial = proof.samples.find(sample => sample.stage === 'initial');
    const paired = (stage: string) => [.5, 1.5].every(zoom => proof.samples.some(sample => sample.stage === stage && sample.quality === tier && Math.abs(sample.zoom - zoom) < 1e-8));
    const meaning = ['airborne agent', 'not a vaccine', 'harmless to healthy humans and animals', 'immediately kills infected humans and animals', 'never reverses infection', 'regional dispersal complex'];
    const recording = proof.samples.filter(sample => sample.stage === 'recording');
    const carried = proof.samples.filter(sample => ['carried', 'exit'].includes(sample.stage));
    const seen = proof.captures.length >= 7 && proof.captures.every(capture => review.captures.some(item => item.file === capture.file && item.sha256 === capture.sha256 && item.seen?.trim()));
    const pass = proof.setup.backend === 'webgl' && proof.setup.quality === tier && !!initial && !initial.states['terminal-read'] && !initial.states['cure-carried'] &&
      ['recording', 'carried', 'exit'].every(paired) && recording.every(sample => sample.states['terminal-read'] && meaning.every(text => sample.subtitle.toLowerCase().includes(text))) &&
      carried.every(sample => sample.states['cure-carried'] && !sample.states['cure-installed'] && sample.items.filter(item => item === 'cure-canister').length === 1 && JSON.stringify(sample.racks) === JSON.stringify(initial.racks)) &&
      proof.samples.filter(sample => sample.stage === 'exit').every(sample => sample.checkpoint === 'cure-research' && sample.saved.carried && sample.saved.items.includes('cure-canister')) &&
      proof.commands.some(command => command.keys?.length) && proof.commands.filter(command => command.key === 'KeyE').length >= 2 && proof.result.inputs.some(input => input.frame.interact) &&
      seen && review.recordingMeaning && review.visibleBackpackAtBothZooms && review.sheets.length > 0 && review.sheets.every(sheet => evidenceIsArchivedOrMatches(sheet.file, sheet.sha256));
    const path = `${reportRoot}/receipts/L10-${tier}-sweep-c4-cure.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L10', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], checks: [{ id: 'L10-09', clause: 'reviewed airborne research subtitles and backpack canister', tier, policy: 'real-input-webgl2', status: pass ? 'PASS' : 'FAIL', value: { initial: !!initial, recording, paired: ['recording', 'carried', 'exit'].map(stage => ({ stage, pass: paired(stage) })), seen, reviewPath, proofPath }, target: 'actual WASD/E terminal, canister and lab exit; full rendered recording meaning and visible backpack at both PO zooms; unchanged racks and carried retry snapshot', receipt: proofPath }] };
    const checkpointPath = `${reportRoot}/receipts/L10-${tier}-checkpoints.json`;
    const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8')) as CheckpointReceipt;
    const death = checkpoint.checks.find(check => check.id === 'L10-15' && check.clause === 'cure and boss HP/death snapshot at cure-research');
    const value = death?.value as { damage: number; expected: { cure: boolean }; observed: { cure: boolean }; rackMatch: boolean } | undefined;
    if (checkpoint.sourceHash === sourceHash && native.sourceHash === sourceHash && checkpoint.fixtureHash === fixtureHash() && checkpoint.checkpointHash === checkpointHash() && !checkpoint.errors.length && checkpoint.control.identical && checkpoint.control.observed === native.nativeStateHash && checkpoint.control.control === native.nativeStateHash && death && value) receipt.checks.push({ ...death, id: 'L10-09', clause: 'carried canister restored by actual checkpoint death', status: death.status === 'PASS' && value.damage >= 100 && value.expected.cure && value.observed.cure && value.rackMatch ? 'PASS' : 'FAIL', receipt: checkpointPath });
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
