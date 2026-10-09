/** Reference | three authored tiers | shipped peer at the fixed game camera. */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { referenceFor } from './turntable';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';

const output = process.argv[2] ?? 'test-results/l5-five-survivor-aftermath';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 300, height: 260 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${process.env.E2E_PORT ?? 3317}/preview/?asset=npc.dale.aftermath&test=1&renderer=webgl&production=1`);
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  await page.evaluate(async () => {
    // Vite transforms this tools module's browser imports with the game's dependencies.
    const url = '/tools/assets/aftermath-stage.ts';
    const module = await import(/* @vite-ignore */ url);
    (window as unknown as { reviewStage: unknown }).reviewStage = await module.createStage();
  });
  const reports: unknown[] = [];
  for (const def of (manifest as AssetDef[]).filter(a => a.id.endsWith('.aftermath') && a.rigDrawBase)) {
    const directory = `${output}/${def.id}`; mkdirSync(directory, { recursive: true });
    const sheet = new PNG({ width: 1500, height: 600 });
    for (let i = 0; i < sheet.data.length; i += 4) sheet.data.set([42, 39, 48, 255], i);
    const ref = PNG.sync.read(readFileSync(referenceFor(def.id)));
    // First figure of the reference turnaround is the front view.
    const refWidth = Math.floor(ref.width / 4), refHeight = ref.height;
    for (const [row, pixels] of [135, 190].entries()) {
      const scale = pixels / (refHeight * .9), width = Math.round(refWidth * scale), height = Math.round(refHeight * scale);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const from = (Math.floor(y / scale) * ref.width + Math.floor(x / scale)) * 4;
        const to = ((row * 300 + 40 + Math.floor((260 - height) / 2) + y) * 1500 + Math.floor((300 - width) / 2) + x) * 4;
        ref.data.copy(sheet.data, to, from, from + 4);
      }
      const columns = [
        { id: def.id, quality: 'high' as const }, { id: def.id, quality: 'lod1' as const }, { id: def.id, quality: 'lod2' as const },
        { id: def.rigDrawBase!.id, quality: 'high' as const, member: def.rigDrawBase!.member },
      ];
      for (const [index, column] of columns.entries()) {
        const metadata = await page.evaluate(async input => {
          const stage = (window as unknown as { reviewStage: { capture(id: string, quality: string, pixels: number, member?: string): Promise<unknown> } }).reviewStage;
          return stage.capture(input.id, input.quality, input.pixels, input.member);
        }, { ...column, pixels });
        reports.push(metadata);
        PNG.bitblt(PNG.sync.read(await page.screenshot()), sheet, 0, 0, 300, 260, (index + 1) * 300, row * 300 + 40);
      }
    }
    // Labels are rasterized by the same headless browser; no image dependency.
    await page.setViewportSize({ width: 1500, height: 600 });
    const encoded = PNG.sync.write(sheet).toString('base64');
    await page.setContent(`<body style="margin:0;background:#2a2730"><img style="position:absolute" src="data:image/png;base64,${encoded}"><div style="position:absolute;color:white;font:15px sans-serif;top:5px;left:8px">${def.id} · FOV25 / azimuth45 / polar0.30π · 135px top, 190px bottom</div>${['reference', 'LOD0', 'LOD1', 'LOD2', `shipped peer: ${def.rigDrawBase!.id}${def.rigDrawBase!.member ? ` / ${def.rigDrawBase!.member}` : ''}`].map((label, i) => `<div style="position:absolute;left:${i * 300 + 8}px;top:25px;color:white;font:12px sans-serif">${label}</div>`).join('')}</body>`);
    await page.screenshot({ path: `${directory}/game-reference-peer.png` });
    await page.screenshot({ path: `${directory}/game-reference-peer.jpg`, type: 'jpeg', quality: 90 });
    // Rebuild the stage after setContent replaced its canvas.
    await page.setViewportSize({ width: 300, height: 260 });
    await page.evaluate(async () => {
      const url = '/tools/assets/aftermath-stage.ts';
      const module = await import(/* @vite-ignore */ url);
      (window as unknown as { reviewStage: unknown }).reviewStage = await module.createStage();
    });
  }
  writeFileSync(`${output}/game-review.json`, JSON.stringify(reports, null, 2) + '\n');
} finally { await browser.close(); }
