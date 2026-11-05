import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { drivingPresence } from './l9-driving-presence';
import { evidenceIsArchivedOrMatches } from './reviews';

/** Admit only source-matched, fully reviewed physical route receipts. A stalled
 * drive is inconclusive for the every-60-seconds-of-driving criterion. */
export function l9RouteReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
  const expectedTool = sha(readFileSync('tools/qa/accept/l9-route-r10.ts'));
  const fixtures: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of ['low', 'high'] as const) for (const route of ['road', 'countryside', 'dry-shortcut']) {
    const inputPath = `docs/reports/fix51-r10c/L9-${tier}-webgl2-z1.5-${route}.json`;
    const reviewPath = `docs/reports/fix51-r10c/L9-${tier}-${route}-reviewed.json`;
    if (!existsSync(inputPath) || !existsSync(reviewPath)) continue;
    const input = JSON.parse(readFileSync(inputPath, 'utf8')) as {
      sourceHash: string; browserHash: string; toolSha256: string; tier: string; route: string; runtimeMatches: boolean; fullRouteConsolePass: boolean;
      error: string | null; artifacts: { logSha256: string }; visibility: { observations: number; conservativeGapSeconds: number | null; pass: boolean };
      result: { runs: { level: string; finished: boolean; skipped: string[] }[] } | null;
    };
    const review = JSON.parse(readFileSync(reviewPath, 'utf8')) as {
      sourceHash: string; browserHash: string; toolSha256: string; logArchive: string; logSha256: string; archiveSha256: string;
      sheet: { file: string; sha256: string }; captures: { file: string; sha256: string; seen: string }[];
    };
    if (input.sourceHash !== sourceHash || input.browserHash !== browserHash || input.toolSha256 !== expectedTool || input.tier !== tier || input.route !== route ||
      review.sourceHash !== sourceHash || review.browserHash !== browserHash || review.toolSha256 !== expectedTool || review.logSha256 !== input.artifacts.logSha256) continue;
    const reviewed = review.captures.length > 0 && review.captures.every(capture => /^[a-f0-9]{64}$/.test(capture.sha256) && capture.seen.trim()) &&
      evidenceIsArchivedOrMatches(review.sheet.file, review.sheet.sha256) &&
      existsSync(review.logArchive) && sha(readFileSync(review.logArchive)) === review.archiveSha256 && sha(gunzipSync(readFileSync(review.logArchive))) === input.artifacts.logSha256;
    if (!reviewed) continue;
    const completed = !!input.result?.runs.some(run => run.level === 'L9' && run.finished && !run.skipped.length);
    const visibility = drivingPresence(gunzipSync(readFileSync(review.logArchive)).toString());
    const measured = visibility.conservativeGapSeconds;
    const pass = completed && !input.error && input.fullRouteConsolePass && input.runtimeMatches && visibility.observations > 1 && visibility.pass && measured !== null && measured <= 60;
    const path = `${reportRoot}/receipts/L9-${tier}-${route}-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L9', tier, sourceHash, fixtureHash: sha(Buffer.concat([readFileSync(new URL(import.meta.url)), readFileSync('tools/qa/accept/l9-driving-presence.ts')])), errors: [],
      checks: [{ id: 'L9-03', clause: `${route} full driving camera visibility`, tier, policy: 'real-input-webgl2', status: pass ? 'PASS' : completed && !input.error && input.fullRouteConsolePass && input.runtimeMatches && measured !== null ? 'FAIL' : 'NOT CHECKED',
        value: { completed, ...visibility, occupiedClockDiagnostic: input.visibility, runtimeMatches: input.runtimeMatches, fullRouteConsolePass: input.fullRouteConsolePass, inputPath, reviewPath },
        target: 'complete physical authored route; living submitted on-camera infected every60 driving seconds; existing >=0.5m/s motion clock, unknown intervals counted, maximum sample interval added; all captures reviewed', receipt: path }],
      observations: { browserHash, toolSha256: expectedTool, motionEvaluatorSha256: sha(readFileSync('tools/qa/accept/l9-driving-presence.ts')), inputPath, reviewPath, sheet: review.sheet, logArchive: review.logArchive } };
    atomicJson(path, receipt); fixtures.push({ path, receipt });
  }
  return fixtures;
}
