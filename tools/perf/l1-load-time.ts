/** PO 10-22: wall time from the L1 level click to the closed loading card (Begin), real menu input.
 * Usage: tsx tools/perf/l1-load-time.ts <origin> [webgpu|webgl2] [low|high] [runs] [menuWaitMs,comma-separated] */
import { chromium } from '@playwright/test';
const [origin, backend = 'webgpu', quality = 'low', runs = '1', menuWait = '0'] = process.argv.slice(2);
const webgpu = backend === 'webgpu';
const args = webgpu ? ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const results: number[] = [];
const waits = menuWait.split(',').map(Number);
for (let r = 0; r < Number(runs) * waits.length; r++) {
  const wait = waits[r % waits.length];
  const browser = await chromium.launch({ headless: true, args });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.setDefaultTimeout(240_000);
    await page.goto(`${origin}/?quality=${quality}&audio=muted&dpr=1${webgpu ? '' : '&renderer=webgl'}`);
    await page.getByTestId('start-game').click();
    await page.getByTestId('character-female').click();
    const level = page.getByTestId('level-L1');
    await level.waitFor();
    if (wait) await page.waitForTimeout(wait);
    await page.evaluate('globalThis.__name = fn => fn');
    await page.evaluate(() => {
      const w = window as unknown as { l1Stages: Record<string, number>; l1T0: number; l1Done?: number };
      w.l1Stages = {}; w.l1T0 = performance.now();
      const tick = () => {
        const card = document.querySelector<HTMLElement>('[data-testid=level-transition]');
        const status = document.querySelector('[data-testid=transition-status]')?.textContent ?? '';
        const progress = (document.querySelector('[data-testid=transition-progress]') as HTMLProgressElement | null)?.value ?? 0;
        if (card && !card.hidden) { const key = `${status} ${Math.floor(progress * 20) * 5}%`; w.l1Stages[key] ??= Math.round(performance.now() - w.l1T0); }
        if (card && card.hidden && Object.keys(w.l1Stages).length) { w.l1Done = Math.round(performance.now() - w.l1T0); return; }
        setTimeout(tick, 16);
      };
      setTimeout(tick, 0);
    });
    await level.click({ force: true });
    await page.waitForFunction(() => (window as unknown as { l1Done?: number }).l1Done !== undefined, undefined, { polling: 100 });
    const { ms, stages } = await page.evaluate(() => { const w = window as unknown as { l1Stages: Record<string, number>; l1Done: number }; return { ms: w.l1Done, stages: w.l1Stages }; });
    results.push(ms);
    console.log(JSON.stringify({ origin, backend, quality, run: r, wait, ms, stages }));
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ origin, backend, quality, median: [...results].sort((a, b) => a - b)[results.length >> 1], results }));
