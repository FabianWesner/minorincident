import base from '../playwright.config';
import { defineConfig } from '@playwright/test';
/** SceneSession owns the private server and headless GPU browser. Run under e2e-lock. */
export default defineConfig({ ...base, testDir: './e2e', outputDir: '../test-results/playwright/health-bars', testMatch: 'health-bars.spec.ts', webServer: undefined, projects: [{ name: 'chromium' }], workers: 1 });
