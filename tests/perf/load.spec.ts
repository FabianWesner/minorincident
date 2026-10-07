import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect, test } from '@playwright/test';
import { startCdnServer } from '../../tools/performance/cdn-server';
import { launchArgs, measure, type LoadRun } from '../../tools/performance/load-measure';

// Real-flow load measurement of the production build (title -> Start -> first playable L1 frame),
// served like Cloudflare Pages (HTTP/2, brotli, dist/_headers) and throttled through CDP.
// Numbers are recorded in test-results/load/; the gates catch large regressions only, since this
// Mac runs many jobs at once (timings carry a CPU-load factor; bytes and requests do not).
const output = 'test-results/load';
const budgets = {
  // Unique bytes downloaded before the first playable frame (L1 v2 / D-GROVE: ~21.8 MB at
  // introduction, 45 MB before the load lane). Fails when the critical download grows by > 15 %.
  criticalBytes: 25_000_000,
  // Includes the menu-time prefetch of the same files (served from the HTTP cache on the second request).
  criticalRequests: 420,
  // Code payload (HTML, CSS, JS, WASM) of a cold visit.
  codeBytes: 2_000_000,
  // Start -> playable, generous multiples of the targets (3 s desktop, 6 s 4G, 1.5 s warm).
  desktopCold: 30_000, mobileCold: 45_000, warm: 25_000,
};

function certificate(): { cert: string; key: string; spki: string } | null {
  const cert = `${output}/cert.pem`, key = `${output}/key.pem`;
  try {
    if (!existsSync(cert)) execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
    const pub = execFileSync('openssl', ['x509', '-in', cert, '-pubkey', '-noout']);
    const der = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: pub });
    const spki = execFileSync('openssl', ['dgst', '-sha256', '-binary'], { input: der }).toString('base64');
    return { cert, key, spki };
  } catch { return null; }
}

test('T-LOAD-01 @perf @load production L1 load: critical download, title and Start -> playable (desktop, 4G, warm)', async () => {
  test.setTimeout(900_000);
  test.skip(!existsSync('dist/index.html'), 'requires `npm run build`');
  mkdirSync(output, { recursive: true });
  const tls = certificate();
  const { port, stop } = await startCdnServer({ root: 'dist', port: 0, cert: tls?.cert, key: tls?.key });
  // A pinned (trusted) certificate keeps Chromium's HTTP cache, which a certificate error would disable.
  const browser = await chromium.launch({ headless: true, args: [...launchArgs, ...(tls ? [`--ignore-certificate-errors-spki-list=${tls.spki}`] : [])] });
  const runs: LoadRun[] = [];
  try {
    const base = `${tls ? 'https' : 'http'}://127.0.0.1:${port}/`;
    runs.push(...await measure(browser, base, 'desktop'));
    runs.push(...await measure(browser, base, 'mobile', ['cold']));
    runs.push(...await measure(browser, base, 'phone', ['cold']));
  } finally { await browser.close(); await stop(); }
  const summary = runs.map(run => ({ ...run, files: undefined, slowest: run.slowest.slice(0, 5) }));
  writeFileSync(`${output}/load.json`, JSON.stringify({ at: new Date().toISOString(), protocol: tls ? 'h2' : 'http/1.1', budgets, runs: summary }, null, 2) + '\n');
  const [desktopCold, desktopWarm, mobileCold, phoneCold] = runs;
  for (const run of runs) expect(run.errors.filter(e => e.startsWith('pageerror')), `${run.profile} ${run.cache}`).toEqual([]);
  expect(desktopCold.uniqueCriticalBytes).toBeLessThanOrEqual(budgets.criticalBytes);
  expect(desktopCold.criticalRequests).toBeLessThanOrEqual(budgets.criticalRequests);
  const code = ['html/css', 'js', 'js-rapier', 'wasm'].reduce((n, kind) => n + (desktopCold.byKind[kind]?.bytes ?? 0), 0);
  expect(code).toBeLessThanOrEqual(budgets.codeBytes);
  // Warm visits must come from the HTTP cache: hashed bundles and versioned assets need no transfer
  // (sound banks are fetched unversioned by src/audio and may revalidate or refetch).
  const audioBytes = desktopWarm.files.filter(f => f.url.startsWith('/assets/audio/')).reduce((n, f) => n + f.bytes, 0);
  expect(desktopWarm.criticalBytes - audioBytes).toBeLessThan(200_000);
  expect(desktopCold.startToPlayableMs).toBeLessThanOrEqual(budgets.desktopCold);
  expect(mobileCold.startToPlayableMs).toBeLessThanOrEqual(budgets.mobileCold);
  expect(desktopWarm.startToPlayableMs).toBeLessThanOrEqual(budgets.warm);
  expect(phoneCold.startToPlayableMs).toBeLessThanOrEqual(budgets.mobileCold);
  // These district props draw LOD2 everywhere on phones. Their never-drawn LOD1
  // must neither delay startup nor compete with later building-tier streaming.
  for (const id of ['prop.bench', 'prop.bbq', 'prop.picket-fence']) {
    expect(phoneCold.files.some(file => file.url.endsWith(`/${id}.lod2.glb`)), id).toBe(true);
    expect(phoneCold.files.some(file => file.url.endsWith(`/${id}.lod1.glb`)), id).toBe(false);
  }
});
