import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import base from '../../playwright.config';
export default defineConfig({
  ...base, testDir: resolve('tests'), testMatch: '**/e2e/smoke.spec.ts', workers: 1, fullyParallel: false,
  projects: [base.projects![0]],
  outputDir: resolve(process.env.BENCH_ARTIFACTS ?? 'test-results/browser-pool/smoke-artifacts'),
  reporter: [['json', { outputFile: process.env.BENCH_REPORT ?? 'test-results/browser-pool/smoke.json' }]],
  webServer: { ...base.webServer!, cwd: resolve('.'), reuseExistingServer: true },
});
