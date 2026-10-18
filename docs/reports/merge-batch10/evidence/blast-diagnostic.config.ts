import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import base from '../../../../playwright.config';
export default defineConfig({
  ...base, testDir: resolve('docs/reports/merge-batch10/evidence'),
  testMatch: 'blast-diagnostic.spec.ts',
  outputDir: resolve('test-results/merge-batch10/gl-diagnostic'),
  webServer: { ...base.webServer, cwd: process.cwd() },
  reporter: [['list'], ['json', { outputFile: resolve('docs/reports/merge-batch10/perf/gl-diagnostic-playwright.json') }]],
});
