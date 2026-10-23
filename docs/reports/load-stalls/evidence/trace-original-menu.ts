// Forensics only: original timing loop, CDP capture, no GPU API wrappers. Set LOAD_OUT.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
/** PO 10-22: wall time from the L1 level click to the closed loading card (Begin), real menu input.
 * Usage: tsx tools/perf/l1-load-time.ts <origin> [webgpu|webgl2] [low|high] [runs] [menuWaitMs,comma-separated] */
import { chromium } from '@playwright/test';
const [origin, backend = 'webgpu', quality = 'low', runs = '1', menuWait = '0'] = process.argv.slice(2);
const webgpu = backend === 'webgpu';
const args = webgpu ? ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const out = process.env.LOAD_OUT!; mkdirSync(out, { recursive: true });
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
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');
    const performanceStartedAt = await page.evaluate(() => performance.now());
    await cdp.send('Profiler.start');
    const { categories } = await cdp.send('Tracing.getCategories');
    await cdp.send('Tracing.start', { categories: ['devtools.timeline', 'v8', 'blink.user_timing', ...categories.filter(name => /gpu|dawn/i.test(name))].join(','), transferMode: 'ReturnAsStream' });
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
    const details = await page.evaluate(`({bundle:document.querySelector('script[type=module][src]')?.src,measures:performance.getEntriesByType('measure').map(e=>({name:e.name,at:e.startTime,ms:e.duration})),resources:performance.getEntriesByType('resource').map(e=>({name:e.name,at:e.startTime,ms:e.duration,bytes:e.transferSize}))})`);
    const record = { origin, backend, quality, run: r, wait, ms, stages, ...details };
    writeFileSync(`${out}/L1-${r}.json`, JSON.stringify(record));
    console.log(JSON.stringify({ origin, backend, quality, run: r, wait, ms, stages }));
    writeFileSync(`${out}/L1-${r}.cpuprofile.gz`, gzipSync(JSON.stringify({ ...(await cdp.send('Profiler.stop')).profile, performanceStartedAt })));
    const complete = new Promise<string>(resolve => cdp.once('Tracing.tracingComplete', event => resolve(event.stream!)));
    await cdp.send('Tracing.end');
    const handle = await complete;
    let trace = '';
    for (;;) { const chunk = await cdp.send('IO.read', { handle }); trace += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data; if (chunk.eof) break; }
    await cdp.send('IO.close', { handle });
    writeFileSync(`${out}/L1-${r}.trace.json.gz`, gzipSync(trace));
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ origin, backend, quality, median: [...results].sort((a, b) => a - b)[results.length >> 1], results }));
