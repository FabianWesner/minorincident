import { defineConfig, devices } from '@playwright/test';
import { poolEndpoint } from './tools/browser-pool/client';
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  const workers = arg === '--workers' ? process.argv[++i] : arg.startsWith('--workers=') ? arg.slice('--workers='.length) : undefined;
  if ((arg === '--workers' || workers !== undefined) && workers !== '1' && workers !== '2') throw new Error('Playwright is limited to 1 or 2 workers on this machine');
}
// Playwright's --list path only needs test metadata. Keep gate collection passive:
// importing the config must not start or admit a browser-pool job.
const endpoint = process.argv.includes('--list') ? undefined : await poolEndpoint();
if (endpoint) { process.env.MI_BROWSER_POOL_WS = endpoint; process.env.MI_BROWSER_POOL = '1'; }

// Playwright forces color in child workers; avoid conflicting inherited NO_COLOR.
delete process.env.NO_COLOR;

// Parallel worktrees each set their own E2E_PORT so they never reuse another lane's server.
const port = Number(process.env.E2E_PORT ?? 3301);
const phonePerfSpecs = process.env.PHONE_PERF === '1' ? ['**/nightly/*.spec.ts'] : [];
// Browser tests are ALWAYS headless (the user works on this Mac; windows must never appear).
// macOS: headless Chromium renders WebGL2 on the real GPU via ANGLE/Metal (low CPU load);
// elsewhere (CI) SwiftShader. Headless WebGPU availability depends on the pinned browser and GPU;
// manual WebGPU validation remains the project policy (see docs/reports/render-test-parallel.md).
const gpuArgs = process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  // SwiftShader compilation competes for CPU across contexts on the remote runners.
  workers: process.env.MI_VERIFY_REMOTE_SIM === '1' ? 1 : process.platform === 'darwin' ? 2 : 1, // remote verification lanes keep one native GPU browser
  fullyParallel: true,
  retries: 0,
  snapshotPathTemplate: '{testDir}/visual/__goldens__/{arg}{ext}',
  timeout: process.platform === 'darwin' && process.env.BROWSER_POOL_BACKEND !== 'swiftshader' ? 60_000 : 180_000,
  // Separate artifacts for simultaneous browser runs using isolated preview ports.
  outputDir: `test-results/playwright/run${process.env.E2E_PORT ? `-${port}` : ''}`,
  reporter: [['list'], ['json', { outputFile: 'test-results/playwright/results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    headless: true,
    launchOptions: { args: gpuArgs },
    ...(process.env.MI_BROWSER_POOL_WS ? { connectOptions: { wsEndpoint: process.env.MI_BROWSER_POOL_WS, headers: { 'x-mi-job': process.env.MI_SLUG ?? process.cwd().split('/').at(-1) ?? 'playwright' } } } : {}),
  },
  // Test strategy (docs/qa/test-strategy.md): the per-change browser suite is tests/e2e (smoke + GPU limits, <= 6 tests);
  // tests/nightly/*.spec.ts are nightly performance budgets (project "perf", run through tools/perf/quiet-run.sh).
  projects: [
    { name: 'chromium', testMatch: '**/e2e/**/*.spec.ts', use: { browserName: 'chromium' } },
    { name: 'perf', testMatch: '**/nightly/*.spec.ts', use: { browserName: 'chromium' } },
    { name: 'pixel-7', testMatch: [...phonePerfSpecs, '**/e2e/smoke.spec.ts'], use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: 'pixel-7-landscape', testMatch: '**/e2e/smoke.spec.ts', use: { ...devices['Pixel 7 landscape'], browserName: 'chromium', viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } },
    { name: 'iphone-14', testMatch: '**/e2e/smoke.spec.ts', use: { ...devices['iPhone 14'], browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: 'iphone-14-landscape', testMatch: '**/e2e/smoke.spec.ts', use: { ...devices['iPhone 14 landscape'], browserName: 'chromium', viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } },
    ...(process.env.E2E_LEGACY === '1' ? [{ name: 'webkit', testMatch: '**/e2e/smoke.spec.ts', use: { browserName: 'webkit' as const, launchOptions: { args: [] }, connectOptions: undefined } }] : []),
  ],
  // Test the optimized QA output, including the query-gated API chunk.
  webServer: { command: `npx vite preview${process.env.E2E_DIST ? ` --outDir '${process.env.E2E_DIST.replaceAll("'", "'\\''")}'` : ''} --host 127.0.0.1 --port ${port} --strictPort --configLoader runner`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI && !process.env.E2E_PORT, timeout: 30_000 },
});
