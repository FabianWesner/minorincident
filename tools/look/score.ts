import { chromium } from '@playwright/test';
import { gpuArgs, output, prepareReview } from './sheets';
const browser = await chromium.launch({ headless: true, args: gpuArgs });
try { await prepareReview(browser); console.log(`Sheets, reviewer.md and scores-template.json ready in ${output}`); }
finally { await browser.close(); }
