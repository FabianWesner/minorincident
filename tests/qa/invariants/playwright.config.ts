import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import base from '../../../playwright.config';
const e2ePort = Number(process.env.E2E_PORT ?? 4191), scenePort = Number(process.env.SCENE_PORT ?? 4192);
if ([e2ePort, scenePort].includes(3300) || e2ePort === scenePort) throw new Error('Invariant sweep needs distinct private preview/Scene Lab ports');
export default defineConfig({
  ...base,
  testDir: './rendering', testMatch: '*.spec.ts', workers: 1, fullyParallel: false,
  projects: [{ name: 'chromium', use: { browserName: 'chromium', headless: true, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] } } }],
  use: { ...base.use, baseURL: `http://127.0.0.1:${e2ePort}`, trace: 'retain-on-failure' },
  outputDir: resolve('test-results/qa-invariants/browser'),
  reporter: [['list'], ['json', { outputFile: 'test-results/qa-invariants/browser.json' }]],
  webServer: [e2ePort, scenePort].map(port => ({ command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort --configLoader runner`, url: `http://127.0.0.1:${port}`, cwd: resolve('.'), reuseExistingServer: false, timeout: 30_000 })),
});
