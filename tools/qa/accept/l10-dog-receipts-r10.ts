import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

/** Visual-only short physical encounters. Full native mechanics coverage is
 * independently required by the row map; these do not claim route completion. */
export function l10DogReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
  const tool = sha(readFileSync('tools/qa/accept/l10-dog-look-r10.ts'));
  const provenancePath = 'docs/reports/fix51-r10c/L10-dog-save-provenance.json';
  if (!existsSync(provenancePath)) return [];
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
  if (provenance.sourceHash !== sourceHash || provenance.toolSha256 !== sha(readFileSync('tools/qa/accept/l10-dog-save-r10.ts'))) return [];
  const results: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of ['low', 'high'] as const) for (const zoom of [.5, 1.5]) {
    const inputPath = `docs/reports/fix51-r10c/L10-${tier}-dog-z${zoom}-input.json`, reviewPath = `docs/reports/fix51-r10c/L10-${tier}-dog-z${zoom}/review.json`;
    if (!existsSync(inputPath) || !existsSync(reviewPath)) continue;
    const input = JSON.parse(readFileSync(inputPath, 'utf8'));
    const review = JSON.parse(readFileSync(reviewPath, 'utf8')) as {
      sourceHash: string; browserHash: string; toolSha256: string; tier: string; zoom: number;
      captures: { file: string; sha256: string; seen: string }[]; sheets: { file: string; sha256: string }[];
      artifacts: { file: string; sha256: string; uncompressedSha256: string }[];
      dogReview?: { row: string; visibleLivingDog: boolean; lowAnimalSilhouette: boolean; distinctFromCorgi: boolean; corgiVisible: boolean; evidence: { file: string; sha256: string }[] };
    };
    if (input.sourceHash !== sourceHash || input.browserHash !== browserHash || input.toolSha256 !== tool || input.tier !== tier || input.zoom !== zoom ||
      review.sourceHash !== sourceHash || review.browserHash !== browserHash || review.toolSha256 !== tool || review.tier !== tier || review.zoom !== zoom) continue;
    const seed = provenance.rows.find((row: { tier: string }) => row.tier === tier);
    const native = JSON.parse(readFileSync(`${reportRoot}/receipts/L10-${tier}-complete.json`, 'utf8'));
    if (!seed || !seed.controlIdentical || seed.nativeStateHash !== native.nativeStateHash || native.sourceHash !== sourceHash || native.observerHash !== provenance.observerHash ||
      !existsSync(seed.path) || sha(readFileSync(seed.path)) !== seed.archiveSha256 || sha(gunzipSync(readFileSync(seed.path))) !== seed.saveSha256) continue;
    const save = JSON.parse(gunzipSync(readFileSync(seed.path)).toString()); save.cureResume.cameraZoom = zoom;
    if (input.seedSaveSha256 !== sha(JSON.stringify(save))) continue;
    const reviewed = review.captures.length > 0 && review.captures.every(capture => /^[a-f0-9]{64}$/.test(capture.sha256) && capture.seen.trim()) &&
      review.sheets.length > 0 && review.sheets.every(sheet => evidenceIsArchivedOrMatches(sheet.file, sheet.sha256)) &&
      review.artifacts.length > 0 && review.artifacts.every(artifact => existsSync(artifact.file) && sha(readFileSync(artifact.file)) === artifact.sha256 && sha(gunzipSync(readFileSync(artifact.file))) === artifact.uncompressedSha256);
    if (!reviewed) continue;
    const artifact = review.artifacts.find(item => item.file.endsWith('/dog-look-completion.json.gz'));
    if (!artifact) continue;
    const completion = JSON.parse(gunzipSync(readFileSync(artifact.file)).toString());
    const runtimeMatches = completion.backend === 'webgl' && completion.quality === tier && Math.abs(completion.camera.zoom - zoom) < 1e-8;
    const checked = review.dogReview;
    const photosMatch = checked?.evidence.length === 3 && [0, 1, 2].every(index => checked.evidence.some(item => item.file === `dog-look-living-dog-${index}.jpg` && review.captures.some(capture => capture.file === item.file && capture.sha256 === item.sha256)));
    const run = input.result?.runs.find((run: { level: string }) => run.level === 'L10');
    const execution = !input.error && run && !run.skipped.length && !run.deaths && !input.result.issues.some((issue: { kind: string }) => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind));
    const pass = !!(runtimeMatches && execution && photosMatch && checked?.row === 'L10-06' && checked.visibleLivingDog && checked.lowAnimalSilhouette && checked.distinctFromCorgi && checked.corgiVisible);
    const path = `${reportRoot}/receipts/L10-${tier}-dog-z${zoom}-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L10', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [],
      checks: [{ id: 'L10-06', clause: `reviewed living infected dog distinct from corgi at zoom${zoom}`, tier, policy: 'real-input-webgl2', status: pass ? 'PASS' : 'FAIL',
        value: { runtimeMatches, execution: !!execution, photosMatch, review: checked, inputPath, reviewPath, provenancePath }, target: 'naturally reached living dog and corgi; physical sidestep; observed quality/zoom; reviewed low animal silhouette and distinct non-corgi appearance; no actor writes/skips or runtime errors', receipt: path }], observations: { browserHash, inputPath, reviewPath } };
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
