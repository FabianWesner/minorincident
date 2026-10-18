import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import base from '../../../../tools/scenelab/vfx-stunning.config';
export default defineConfig({ ...base, testDir: resolve('docs/reports/merge-batch10/evidence'), testMatch: 'po34-original.spec.ts', outputDir: resolve('test-results/playwright/po34-original-main'), reporter: [['list'], ['json', { outputFile: resolve('docs/reports/merge-batch10/evidence/PO34-original-main-playwright.json') }]] });
