import { defineConfig, devices } from '@playwright/test';

// Playwright forces color in child workers; avoid conflicting inherited NO_COLOR.
delete process.env.NO_COLOR;

// Parallel worktrees each set their own E2E_PORT so they never reuse another lane's server.
const port = Number(process.env.E2E_PORT ?? 3301);
const swiftshader = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 4,
  fullyParallel: true,
  retries: 0,
  snapshotPathTemplate: '{testDir}/visual/__goldens__/{arg}{ext}',
  timeout: 60_000,
  outputDir: 'test-results/playwright/run',
  reporter: [['list'], ['json', { outputFile: 'test-results/playwright/results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    launchOptions: { args: swiftshader },
  },
  projects: [
    { name: 'chromium', testIgnore: '**/webgpu.spec.ts', use: { browserName: 'chromium' } },
    { name: 'pixel-7', testMatch: ['**/smoke.spec.ts', '**/input-touch.spec.ts'], use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: 'pixel-7-landscape', testMatch: ['**/smoke.spec.ts', '**/input-touch.spec.ts'], use: { ...devices['Pixel 7 landscape'], browserName: 'chromium', viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } },
    { name: 'iphone-14', testMatch: ['**/smoke.spec.ts', '**/input-touch.spec.ts'], use: { ...devices['iPhone 14'], browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: 'iphone-14-landscape', testMatch: ['**/smoke.spec.ts', '**/input-touch.spec.ts'], use: { ...devices['iPhone 14 landscape'], browserName: 'chromium', viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } },
    ...(process.env.E2E_WEBGPU === '1' ? [{ name: 'webgpu', testMatch: '**/webgpu.spec.ts', use: { browserName: 'chromium' as const, headless: false, launchOptions: { args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } } }] : []),
    { name: 'webkit', testMatch: '**/smoke.spec.ts', use: { browserName: 'webkit' } },
  ],
  // Test the real production output, including the query-gated API chunk.
  webServer: { command: `npx vite preview --host 127.0.0.1 --port ${port} --strictPort --configLoader runner`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI && !process.env.E2E_PORT, timeout: 30_000 },
});
