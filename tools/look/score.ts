import { launchBrowser } from '../browser-pool/client';
import { gpuArgs, output, prepareReview } from './sheets';
const browser = await launchBrowser({ headless: true, args: gpuArgs });
try { await prepareReview(browser); console.log(`Sheets, reviewer.md and scores-template.json ready in ${output}`); }
finally { await browser.close(); }
