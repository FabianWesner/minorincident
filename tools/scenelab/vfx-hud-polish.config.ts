import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

if (!base.webServer || Array.isArray(base.webServer)) throw new Error('Expected one production preview server');
const webServer = { ...base.webServer, cwd: resolve('.') };

/** The HUD overlap gate must exercise the same production build on both native backends. */
export default defineConfig({
  ...base,
  testDir: resolve('tests'),
  testMatch: '**/e2e/vfx-hud-polish.spec.ts',
  outputDir: resolve('test-results/vfx-hud-polish/playwright'),
  webServer,
  workers: 2,
  reporter: [['list'], ['json', { outputFile: resolve('test-results/vfx-hud-polish/playwright.json') }]],
  projects: [
    { name: 'vfx-hud-webgl2', use: { ...base.use, browserName: 'chromium', headless: true } },
    { name: 'vfx-hud-webgpu', use: { ...base.use, browserName: 'chromium', headless: true,
      launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] } } },
  ],
});
