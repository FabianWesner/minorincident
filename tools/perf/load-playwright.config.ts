import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import base from '../../playwright.config';

// Keep the baseline snapshot on E2E_PORT while testing the candidate on SCENE_PORT.
// Both preview servers are started explicitly, with their retained build metadata.
export default defineConfig({
  ...base,
  testDir: resolve('tests'),
  outputDir: resolve('test-results/load-stalls/playwright'),
  reporter: [['list'], ['json', { outputFile: resolve('test-results/load-stalls/playwright-results.json') }]],
  webServer: undefined,
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.SCENE_PORT ?? 4222}` },
});
