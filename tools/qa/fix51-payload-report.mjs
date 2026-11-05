/** Summarize the perf2 byte-only receipts; fails unless all startup budgets pass.
 * node tools/qa/fix51-payload-report.mjs [input-root] [report-directory]
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const input = process.argv[2] ?? 'test-results/fix51-payload';
const out = process.argv[3] ?? 'docs/reports/fix51-payload';
mkdirSync(out, { recursive: true });
const selection = 'L1-L2-L3-L4-L5-L6-L7-L8-L9-L10';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const rows = [], sources = [], ledger = new Map();
const assetBytes = requests => requests.filter(r => new URL(r.url).pathname.startsWith('/assets/')).reduce((n, r) => n + r.sizes.responseBodySize, 0);
for (const tier of ['low', 'high']) {
  const source = `${input}/accepted-${tier}/loads/${selection}.json`, bytes = readFileSync(source);
  const archive = gzipSync(bytes); writeFileSync(`${out}/loads-${tier}.json.gz`, archive);
  sources.push({ tier, source, rawSha256: hash(bytes), archiveSha256: hash(archive) });
  for (const row of JSON.parse(bytes)) {
    const origin = new URL(row.bundle).origin;
    const paths = [...new Set(row.startedNetwork.filter(r => r.url.startsWith(origin + '/')).map(r => new URL(r.url).pathname))].sort();
    for (const path of paths) if (!ledger.has(path)) {
      const data = readFileSync(path === '/' ? 'dist/index.html' : `dist${path}`);
      ledger.set(path, { path, bytes: data.length, sha256: hash(data), gzipEstimate: path.endsWith('.gz') ? data.length : Math.min(data.length, gzipSync(data, { level: 9 }).length) });
    }
    rows.push({ level: row.level, tier, completedAssetBytes: assetBytes(row.network), startedAssetBytes: assetBytes(row.startedNetwork),
      limitBytes: 25000000, verdict: assetBytes(row.startedNetwork) <= 25000000 ? 'PASS' : 'FAIL',
      gzipStartupEstimate: paths.reduce((n, path) => n + ledger.get(path).gzipEstimate, 0), gzipLimitBytes: row.level === 'L1' ? 15000000 : null,
      warmUpProxyMs: row.loadMeasures.at(-1)?.duration, errors: row.errors, bundle: row.bundle, paths });
  }
}
assert.equal(rows.length, 20);
assert.equal(new Set(rows.map(r => `${r.level}:${r.tier}`)).size, 20);
assert(rows.every(r => !r.errors.length && r.verdict === 'PASS' && (r.level !== 'L1' || r.gzipStartupEstimate <= r.gzipLimitBytes)));
const changed = [...new Set((git(['diff', '--name-only', 'HEAD', '--', 'src', 'tools/qa']) + '\n' + git(['ls-files', '--others', '--exclude-standard', '--', 'tools/qa'])).split('\n').filter(Boolean))];
const sourceHashes = Object.fromEntries(changed.sort().map(path => [path, hash(readFileSync(path))]));
writeFileSync(`${out}/asset-bytes.json`, JSON.stringify({ baseline: 'e851b81cd',
  method: 'perf2 release-ab-load.mjs RELEASE_BYTES_ONLY=1; fresh context per level/tier, title entry through three RAFs after loading-card closure. Completed counts match perf2. Started counts additionally await unfinished requests initiated at that frontier; requests initiated later are excluded. Gzip estimate is level 9 per distinct HTTP file, retaining .gz and smaller incompressible originals. view:warm-up is a shared-host proxy. No cold/warm timing qualification.',
  sources, sourceHashes, rows, fileLedger: [...ledger.values()] }, null, 2) + '\n');
assert.equal(git(['diff', '--name-only', 'e851b81cd', '--', 'public', 'assets', 'src/assets/manifest.json', 'tools/assets/validate.ts']), '');
const inventory = JSON.parse(readFileSync('docs/reports/fix51-perf2/asset-inventory.json')).sides.find(r => r.side === 'candidate').registeredFileRows.map(row => ({ ...row, bytes: statSync(`public/${row.path}`).size }));
const violations = inventory.filter(row => row.bytes > row.limitBytes); assert.equal(violations.length, 0);
writeFileSync(`${out}/registered-inventory.json.gz`, gzipSync(JSON.stringify({ method: 'Fresh filesystem counts against unchanged perf2 registered per-file limits; asset sources, public files, manifest and validator unchanged from e851b81cd.', registeredFiles: inventory.length, registeredBytes: inventory.reduce((n, row) => n + row.bytes, 0), manifestSha256: hash(readFileSync('src/assets/manifest.json')), violations, files: inventory })));
console.log(rows.map(row => `${row.level} ${row.tier}: ${(row.startedAssetBytes / 1e6).toFixed(3)} MB; gzip estimate ${(row.gzipStartupEstimate / 1e6).toFixed(3)} MB; warm-up proxy ${row.warmUpProxyMs.toFixed(1)} ms`).join('\n'));
