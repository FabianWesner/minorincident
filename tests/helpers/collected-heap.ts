import type { BrowserContext, Page } from '@playwright/test';

/** E18 JS heap gate: retire completed frame temporaries, collect, then use decimal MB.
 * Keep embedder/backing-store sizes in the evidence, outside Runtime.usedSize. */
export async function collectedHeap(page: Page, context: BrowserContext) {
  await page.evaluate(() => window.__SS__!.pause());
  const cdp = await context.newCDPSession(page);
  try {
    const heapBeforeCollection = await cdp.send('Runtime.getHeapUsage');
    const legacyHeapBeforeCollection = await page.evaluate(() => window.__SS__!.perf().heapBytes ?? null);
    for (let i = 0; i < 3; i++) {
      await cdp.send('HeapProfiler.collectGarbage');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
    const audit = await cdp.send('Runtime.getHeapUsage');
    const legacyHeapAfterCollection = await page.evaluate(() => window.__SS__!.perf().heapBytes ?? null);
    return { heapMB: audit.usedSize / 1_000_000, heapAudit: audit, heapBeforeCollection, legacyHeapBeforeCollection, legacyHeapAfterCollection };
  } finally { await cdp.detach(); }
}
