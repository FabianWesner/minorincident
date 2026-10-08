import { chromium, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { spawnSync } from 'node:child_process';
import { comparison } from './comparison';

export function coverage(bytes: Buffer): number {
  const png = PNG.sync.read(bytes), background = [...png.data.subarray(0,3)];
  let occupied = 0;
  for (let i=0;i<png.data.length;i+=4) if (background.some((v,j) => Math.abs(png.data[i+j]-v)>8)) occupied++;
  return occupied/(png.width*png.height);
}
export function referenceFor(id: string): string {
  const local = `assets/${id}/reference-upscaled.png`;
  if (existsSync(local)) return local;
  const common = spawnSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).stdout.trim();
  const main = resolve(common, '..');
  return id === 'veh.fire-engine' ? `${main}/assets/fire-engine/reference-upscaled.png` : `${main}/assets/${id}/reference-upscaled.png`;
}
export async function captureTurntable(page: Page, id: string, directory: string, baseURL: string, decay?: string): Promise<number[]> {
  mkdirSync(directory, { recursive: true });
  await page.goto(`${baseURL}/preview/?asset=${encodeURIComponent(id)}&test=1&renderer=webgl&production=1`);
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  if (decay) {
    await page.locator('#decay').evaluate((el, value) => { (el as HTMLSelectElement).value = value; }, decay);
    await page.evaluate(() => window.__ASSET__!.inspectionView!('high', 45));
  }
  await page.locator('#toolbar').evaluate((toolbar) => { toolbar.style.visibility = 'hidden'; });
  const images: string[] = [], occupancies: number[] = [];
  for (let i=0;i<5;i++) {
    await page.evaluate((view) => window.__ASSET__!.view(view),i);
    const path = `${directory}/turntable_${i}.png`;
    const png = await page.locator('canvas').screenshot({ path });
    images.push(path); occupancies.push(coverage(png));
  }
  await comparison(images, referenceFor(`${id}${decay ? `.${decay}` : ''}`), `${directory}/comparison.png`);
  writeFileSync(`${directory}/turntable.json`,JSON.stringify({ id, decay, coverage: occupancies, ...await page.evaluate(() => window.__ASSET__!.info()) },null,2)+'\n');
  return occupancies;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
  try {
    const page = await browser.newPage({ viewport: {width:1600,height:900} });
    const target = process.argv[2];
    const lodContact = process.argv.includes('--lod-contact');
    const decayIndex = process.argv.indexOf('--decay');
    const decay = decayIndex >= 0 ? process.argv[decayIndex + 1] : undefined;
    if (decayIndex >= 0 && !decay) throw new Error('--decay requires a variant');
    const outputIndex = process.argv.indexOf('--output');
    const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : 'test-results/assets';
    if (!output) throw new Error('--output requires a directory');
    const manifest: {id:string;status:string;script?:string;glb:string}[] = JSON.parse(readFileSync('src/assets/manifest.json','utf8'));
    const changed = target === '--changed' ? spawnSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).stdout.split('\n') : [];
    const selected = manifest.filter(a => target === '--all' ? ['integrated','final'].includes(a.status) : target === '--changed' ? changed.includes(a.glb) || (!!a.script && changed.includes(a.script)) : target?.split(',').includes(a.id));
    if (!selected.length && target !== '--changed') throw new Error('Usage: npm run assets:turntable -- <id>|--all|--changed (preview server must be running)');
    for (const {id} of selected) {
      if (lodContact) {
        const directory = `${output}/${id}${decay ? `.${decay}` : ''}`; mkdirSync(directory, { recursive: true });
        await page.setViewportSize({ width: 480, height: 360 });
        await page.goto(`http://127.0.0.1:${process.env.E2E_PORT ?? 3313}/preview/?asset=${encodeURIComponent(id)}&test=1&renderer=webgl&production=1&inspection=1`);
        if (decay) {
          const select = page.locator('#decay');
          await page.waitForFunction(() => !!window.__ASSET__);
          await page.evaluate(() => window.__ASSET__!.ready);
          await select.evaluate((el, value) => { (el as HTMLSelectElement).value = value; }, decay);
        }
        await page.waitForFunction(() => !!window.__ASSET__);
        await page.evaluate(() => window.__ASSET__!.ready);
        await page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
        const sheet = new PNG({ width: 1440, height: 1800 });
        const views: { quality: string; azimuth: number; triangles: number }[] = [];
        for (const [row, azimuth] of [45, 135, 225, 315, 0].entries()) {
          for (const [column, quality] of (['high', 'lod1', 'lod2'] as const).entries()) {
            await page.evaluate(async ({ quality, azimuth }) => { await window.__ASSET__!.inspectionView!(quality, azimuth); }, { quality, azimuth });
            const info = await page.evaluate(() => window.__ASSET__!.info());
            if (info.placeholder) throw new Error(`${id}:${quality}: placeholder`);
            views.push({ quality, azimuth, triangles: info.triangles });
            await page.evaluate(({ id, quality, azimuth, decay }) => {
              let label = document.querySelector<HTMLDivElement>('#lod-label');
              if (!label) { label = document.createElement('div'); label.id = 'lod-label'; label.style.cssText = 'position:fixed;top:0;left:0;color:white;background:#17151bcc;font:14px sans-serif;padding:5px'; document.body.append(label); }
              label.textContent = `${id}${decay ? `.${decay}` : ''} ${quality === 'high' ? 'lod0' : quality} · ${azimuth}°`;
            }, { id, quality, azimuth, decay });
            PNG.bitblt(PNG.sync.read(await page.screenshot()), sheet, 0, 0, 480, 360, column * 480, row * 360);
          }
        }
        writeFileSync(`${directory}/lod-contact.png`, PNG.sync.write(sheet));
        writeFileSync(`${directory}/lod-contact.json`, JSON.stringify({ id, decay, views }, null, 2) + '\n');
        console.log(`${directory}/lod-contact.png`);
        continue;
      }
      const values = await captureTurntable(page,id,`${output}/${id}${decay ? `.${decay}` : ''}`,`http://127.0.0.1:${process.env.E2E_PORT ?? 3313}`,decay);
      if (values.some((v)=>v<.1||v>.8)) throw new Error(`Object coverage outside 10–80%: ${values}`);
    }
  } finally { await browser.close(); }
}
