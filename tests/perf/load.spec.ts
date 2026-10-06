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
  // Bytes are deterministic for a build: fail when the critical download grows by > 25 %.
  criticalBytes: 19_000_000,
  criticalRequests: 200,
  bootBytes: 4_500_000,
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
  } finally { await browser.close(); await stop(); }
  const summary = runs.map(run => ({ ...run, files: undefined, slowest: run.slowest.slice(0, 5) }));
  writeFileSync(`${output}/load.json`, JSON.stringify({ at: new Date().toISOString(), protocol: tls ? 'h2' : 'http/1.1', budgets, runs: summary }, null, 2) + '\n');
  const [desktopCold, desktopWarm, mobileCold] = runs;
  for (const run of runs) expect(run.errors.filter(e => e.startsWith('pageerror')), `${run.profile} ${run.cache}`).toEqual([]);
  expect(desktopCold.criticalBytes).toBeLessThanOrEqual(budgets.criticalBytes);
  expect(desktopCold.criticalRequests).toBeLessThanOrEqual(budgets.criticalRequests);
  expect(desktopCold.bootBytes).toBeLessThanOrEqual(budgets.bootBytes);
  // Warm visits must come from the HTTP cache: hashed bundles and versioned assets need no transfer.
  expect(desktopWarm.criticalBytes).toBeLessThan(200_000);
  expect(desktopCold.startToPlayableMs).toBeLessThanOrEqual(budgets.desktopCold);
  expect(mobileCold.startToPlayableMs).toBeLessThanOrEqual(budgets.mobileCold);
  expect(desktopWarm.startToPlayableMs).toBeLessThanOrEqual(budgets.warm);
});
