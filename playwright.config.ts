import { defineConfig, devices } from '@playwright/test';
import { poolEndpoint } from './tools/browser-pool/client';
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  const workers = arg === '--workers' ? process.argv[++i] : arg.startsWith('--workers=') ? arg.slice('--workers='.length) : undefined;
  if ((arg === '--workers' || workers !== undefined) && workers !== '1' && workers !== '2') throw new Error('Playwright is limited to 1 or 2 workers on this machine');
}
const endpoint = await poolEndpoint();
if (endpoint) { process.env.MI_BROWSER_POOL_WS = endpoint; process.env.MI_BROWSER_POOL = '1'; }

// Playwright forces color in child workers; avoid conflicting inherited NO_COLOR.
delete process.env.NO_COLOR;

// Parallel worktrees each set their own E2E_PORT so they never reuse another lane's server.
const port = Number(process.env.E2E_PORT ?? 3301);
const phonePerfSpecs = process.env.PHONE_PERF === '1' ? ['**/perf/*.spec.ts'] : [];
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
  projects: [
    { name: 'chromium', ...(process.env.MI_REMOTE === '1' ? { testMatch: '**/e2e/**/*.spec.ts' } : {}), testIgnore: '**/webgpu.spec.ts', use: { browserName: 'chromium' } },
    { name: 'pixel-7', testMatch: [...phonePerfSpecs, '**/smoke.spec.ts', '**/input-touch.spec.ts', '**/hud-touch.spec.ts', '**/mobile-hud-layout.spec.ts', '**/home-button.spec.ts', '**/menu-10-levels.spec.ts', '**/apc-floor.spec.ts', '**/l9-browser-input.spec.ts'], use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: 'pixel-7-landscape', testMatch: ['**/smoke.spec.ts', '**/input-touch.spec.ts', '**/hud-touch.spec.ts', '**/mobile-hud-layout.spec.ts', '**/home-button.spec.ts', '**/menu-10-levels.spec.ts', '**/apc-floor.spec.ts', '**/l9-browser-input.spec.ts'], use: { ...devices['Pixel 7 landscape'], browserName: 'chromium', viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } },
    { name: 'iphone-14', testMatch: ['**/smoke.spec.ts', '**/input-touch.spec.ts', '**/hud-touch.spec.ts', '**/mobile-hud-layout.spec.ts'], use: { ...devices['iPhone 14'], browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: 'iphone-14-landscape', testMatch: ['**/smoke.spec.ts', '**/input-touch.spec.ts', '**/hud-touch.spec.ts', '**/mobile-hud-layout.spec.ts'], use: { ...devices['iPhone 14 landscape'], browserName: 'chromium', viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } },
    ...(process.env.E2E_WEBGPU === '1' ? [{ name: 'webgpu', testMatch: '**/webgpu.spec.ts', use: { browserName: 'chromium' as const, headless: true, launchOptions: { args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--use-angle=metal'] } } }] : []),
    ...(process.env.E2E_WEBGPU_HEADLESS === '1' ? [{ name: 'webgpu-headless', testMatch: '**/webgpu.spec.ts', use: { browserName: 'chromium' as const, headless: true, launchOptions: { args: ['--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } } }] : []),
    ...(process.env.E2E_LEGACY === '1' ? [{ name: 'webkit', testMatch: '**/smoke.spec.ts', use: { browserName: 'webkit' as const, launchOptions: { args: [] }, connectOptions: undefined } }] : []),
  ],
  // Test the real production output, including the query-gated API chunk.
  webServer: { command: `npx vite preview${process.env.E2E_DIST ? ` --outDir '${process.env.E2E_DIST.replaceAll("'", "'\\''")}'` : ''} --host 127.0.0.1 --port ${port} --strictPort --configLoader runner`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI && !process.env.E2E_PORT, timeout: 30_000 },
});
