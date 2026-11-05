/** Summarize current physical receipts and retain actual runtime backend/quality. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const marker = JSON.parse(readFileSync('dist/.qa-accept-build.json', 'utf8'));
const rows = [];
for (let n = 1; n <= 10; n++) for (const backend of ['webgl2', 'webgpu']) for (const tier of ['low', 'high']) {
 const level = `L${n}`, suffix = backend === 'webgl2' ? '' : '-webgpu-z1.5';
 const path = `docs/reports/fix51-verify/receipts/${level}-${tier}${suffix}-browser.json`;
 if (!existsSync(path)) { rows.push({ level, backend, tier, status: 'NOT CHECKED', reason: 'No receipt' }); continue; }
 const bytes = readFileSync(path), receipt = JSON.parse(bytes);
 if (receipt.sourceHash !== marker.sourceHash || receipt.browserHash !== marker.browserHash) { rows.push({ level, backend, tier, status: 'NOT CHECKED', reason: 'Receipt is for a different game or browser observer', path }); continue; }
 const out = `test-results/fix51-browser/${level}-${tier}${suffix}`;
 const completionPath = `${out}/accept-completion.json`;
 const completion = existsSync(completionPath) ? JSON.parse(readFileSync(completionPath, 'utf8')) : null;
 const runtimeMatrixMatches = completion?.backend === (backend === 'webgl2' ? 'webgl' : 'webgpu') && completion?.quality === tier;
 const run = receipt.run?.find(run => run.level === level);
 const consoleErrors = receipt.issues.filter(issue => ['console-error', 'page-error'].includes(issue.kind));
 const blockingGameplayIssues = receipt.issues.filter(issue => issue.severity === 'P0');
 const complete = !!run?.finished && !run.skipped.length;
 if (complete && !consoleErrors.length && !receipt.errors.length) assert(runtimeMatrixMatches, `${level}/${backend}/${tier}: actual backend/tier mismatch`);
 rows.push({ level, backend, tier, requestedZoom: 1.5, actualBackend: completion?.backend, actualQuality: completion?.quality, runtimeMatrixMatches,
  completed: complete, status: receipt.errors.length || consoleErrors.length || blockingGameplayIssues.length ? 'FAIL' : complete && runtimeMatrixMatches ? 'PASS' : 'NOT CHECKED',
  wallSeconds: run?.wallSeconds, deathsOrRetries: run?.deaths, assists: run?.assists, skipped: run?.skipped,
  consoleErrors, errors: receipt.errors, blockingGameplayIssues, advisories: receipt.issues.filter(issue => !['console-error', 'page-error'].includes(issue.kind)), path,
  receiptSha256: createHash('sha256').update(bytes).digest('hex'), frameTiming: receipt.frameTiming, sourceHash: receipt.sourceHash, browserHash: receipt.browserHash });
}
const counts = Object.fromEntries(['PASS', 'FAIL', 'NOT CHECKED'].map(status => [status, rows.filter(row => row.status === status).length]));
writeFileSync('docs/reports/fix51-r4/physical-coverage.json', JSON.stringify({ ...marker, generatedAt: new Date().toISOString(), method: 'Headless physical WASD/mouse, ordinary routes, survival-protected, no objective skips, at most two GPU browsers, no frame timings. WebGL2 requests ANGLE Metal; actual backend and quality checked from each runtime completion.', counts, rows }, null, 2) + '\n');
console.log(JSON.stringify(counts));
