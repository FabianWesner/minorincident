import { writeFileSync } from 'node:fs';
import { launchBrowser } from './client';
import { delay } from './host';
const waits: number[] = [], pooled = process.env.MI_BROWSER_POOL === '1';
let browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (let step = 0; step < 2; step++) {
    const start = Date.now();
    if (step && pooled) browser = await launchBrowser();
    const context = await browser.newContext(), page = await context.newPage();
    waits.push(Date.now() - start);
    await page.setContent('<canvas width="1280" height="720"></canvas>');
    await page.evaluate(async () => {
      const canvas = document.querySelector('canvas')!, g = canvas.getContext('2d')!;
      for (let i = 0; i < 12; i++) { g.fillStyle = `rgb(${i * 20},64,128)`; g.fillRect(0, 0, canvas.width, canvas.height); await new Promise(requestAnimationFrame); }
    });
    await context.close();
    if (pooled) await browser.close();
    if (step === 0) await delay(2000); // remote judge/monitor work, identical in both paths
  }
} finally { await browser.close(); }
writeFileSync(process.argv[2], JSON.stringify({ waits }));
