import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import config from '../../playwright.config';

export default defineConfig({
  ...config,
  testDir: '.',
  testMatch: 'parallel-benchmark.spec.ts',
  projects: [config.projects![0]],
  outputDir: resolve('test-results/render-parallel/playwright-artifacts'),
  webServer: { ...config.webServer!, cwd: resolve('.') },
  reporter: [['json', { outputFile: process.env.BENCH_REPORT ?? 'test-results/render-parallel/playwright.json' }]],
});
