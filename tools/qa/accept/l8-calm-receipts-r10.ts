import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

/** Real campaign entry and read-only DOM audit; sampled HUD evidence is paired
 * with the native every-tick attack/marker ledger by the complete-row map. */
export function l8CalmReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
  const results: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of ['low', 'high'] as const) {
    const inputPath = `docs/reports/fix51-r10c/L7-L8-carried-${tier}-input.json`;
    const reviewPath = `docs/reports/fix51-r10c/L7-L8-carried-${tier}/review.json`;
    if (!existsSync(inputPath) || !existsSync(reviewPath)) continue;
    const input = JSON.parse(readFileSync(inputPath, 'utf8'));
    const producer = input.producer ?? 'tools/qa/accept/carried-input-r10.ts';
    if (!['tools/qa/accept/carried-input-r10.ts', 'tools/qa/accept/carried-input-r11.ts'].includes(producer)) continue;
    const tool = sha(readFileSync(producer));
    const review = JSON.parse(readFileSync(reviewPath, 'utf8')) as {
      sourceHash: string; browserHash: string; toolSha256: string;
      captures: { sha256: string; seen: string }[]; sheets: { file: string; sha256: string }[];
      artifacts: { file: string; sha256: string; uncompressedSha256: string }[];
    };
    if (input.sourceHash !== sourceHash || input.browserHash !== browserHash || input.toolSha256 !== tool || input.tier !== tier ||
      review.sourceHash !== sourceHash || review.browserHash !== browserHash || review.toolSha256 !== tool) continue;
    const reviewed = review.captures.length > 0 && review.captures.every(capture => /^[a-f0-9]{64}$/.test(capture.sha256) && capture.seen.trim()) &&
      review.sheets.length > 0 && review.sheets.every(sheet => evidenceIsArchivedOrMatches(sheet.file, sheet.sha256)) &&
      review.artifacts.every(artifact => existsSync(artifact.file) && sha(readFileSync(artifact.file)) === artifact.sha256 && sha(gunzipSync(readFileSync(artifact.file))) === artifact.uncompressedSha256);
    if (!reviewed) continue;
    const artifact = review.artifacts.find(item => item.file.endsWith('/handover-audit-late-input.json.gz'));
    if (!artifact) continue;
    const audit = JSON.parse(gunzipSync(readFileSync(artifact.file)).toString()) as { tick: number; text: string; pin: boolean; marker: boolean; breached: boolean }[];
    const calm = audit.filter(sample => sample.tick < 3600), breach = audit.find(sample => sample.tick === 3600);
    const maxGapTicks = Math.max(...audit.slice(1).map((sample, index) => sample.tick - audit[index].tick));
    const continuous = calm[0]?.tick === 0 && (calm.at(-1)?.tick ?? 0) >= 3540 && maxGapTicks <= 60;
    const completionArtifact = review.artifacts.find(item => item.file.endsWith('/late-input-completion.json.gz'));
    if (!completionArtifact) continue;
    const completion = JSON.parse(gunzipSync(readFileSync(completionArtifact.file)).toString());
    const runtimeMatches = completion.backend === 'webgl' && completion.quality === tier && Math.abs(completion.camera.zoom - 1.5) < 1e-9;
    // This row ends at breach tick3600; later APC departure is qualified separately.
    const completed = runtimeMatches && input.result?.runs.some((run: { level: string; finished: boolean; skipped: string[] }) => run.level === 'L7' && run.finished && !run.skipped.length) && input.result?.runs.some((run: { level: string; skipped: string[] }) => run.level === 'L8' && !run.skipped.length);
    const consolePass = !input.error && !input.result?.issues.some((issue: { kind: string }) => ['console-error', 'page-error'].includes(issue.kind));
    const pass = completed && consolePass && continuous && calm.every(sample => sample.text.includes('central plaza') && sample.pin && sample.marker && !sample.breached) &&
      !!breach?.breached && breach.text.includes('Protect the group!') && !breach.pin && !breach.marker;
    const path = `${reportRoot}/receipts/L8-${tier}-calm-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L8', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [],
      checks: [{ id: 'L8-02', clause: 'carried real-input 60-second opening objective and marker audit', tier, policy: 'real-input-webgl2', status: pass ? 'PASS' : 'FAIL',
        value: { completed, consolePass, samples: calm.length, firstTick: calm[0]?.tick, lastCalmTick: calm.at(-1)?.tick, maxGapTicks, breach, inputPath, reviewPath },
        target: 'PO 2026-11-08: physical L7→L8 campaign; central-plaza objective and direction before tick3600, then Protect the group with no destination marker; native ledger separately checks the 30-second hold and delayed APC route', receipt: path }],
      observations: { browserHash, inputPath, reviewPath } };
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
