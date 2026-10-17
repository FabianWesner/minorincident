/** Compare the unchanged browser gates against an immutable VFX baseline build.
 * E2E_PORT=<unique> VFX_DIST=<build> sh tools/e2e-lock.sh npx playwright test --config tools/scenelab/vfx-stunning.config.ts ... */
import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import base from '../../playwright.config';

const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
const port = Number(process.env.E2E_PORT);
if (!Number.isInteger(port) || port === 3300) throw new Error('Set a unique E2E_PORT');
const webServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
export default defineConfig({
  ...base,
  testDir: resolve('tests'),
  outputDir: resolve(`test-results/playwright/vfx-${port}`),
  reporter: [['list'], ['json', { outputFile: `test-results/vfx-stunning/browser-${port}.json` }]],
  webServer: { ...webServer, reuseExistingServer: false, command: `node ${quote(resolve('node_modules/vite/bin/vite.js'))} preview --outDir ${quote(resolve(process.env.VFX_DIST ?? 'dist'))} --host 127.0.0.1 --port ${port} --strictPort --configLoader runner` },
});
