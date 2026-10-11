import { chromium, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { spawnSync } from 'node:child_process';
import { comparison } from './comparison';
import type { AssetDef } from '../../src/assets/types';
const assetManifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];

export function coverage(bytes: Buffer): number {
  const png = PNG.sync.read(bytes), background = [...png.data.subarray(0,3)];
  let occupied = 0;
  for (let i=0;i<png.data.length;i+=4) if (background.some((v,j) => Math.abs(png.data[i+j]-v)>8)) occupied++;
  return occupied/(png.width*png.height);
}
export function referenceFor(id: string): string {
  if (id === 'veh.military-truck.wrecked') {
    const local = `assets/${id}/reference-upscaled.png`;
    if (!existsSync(local)) return referenceFor('veh.military-truck');
  }
  const local = `assets/${id}/reference-upscaled.png`;
  if (existsSync(local)) return local;
  const common = spawnSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).stdout.trim();
  const main = resolve(common, '..');
  const path = id === 'veh.fire-engine' ? `${main}/assets/fire-engine/reference-upscaled.png` : `${main}/assets/${id}/reference-upscaled.png`;
  if (existsSync(path)) return path;
  // Aliases share the authored reference; rigid derivatives are compared with
  // their declared base, rather than inventing a reference for unreviewed art.
  const def = assetManifest.find(a => a.id === id);
  const canonical = def?.aliasOf ?? def?.sourceGlb?.split('/')[1] ?? def?.glb.split('/').at(-1)?.replace(/\.glb$/, '');
  if (canonical && canonical !== id) return referenceFor(canonical);
  if (def?.rigidDrawBase && def.rigidDrawBase !== id) return referenceFor(def.rigidDrawBase);
  return path;
}
export async function captureTurntable(page: Page, id: string, directory: string, baseURL: string, decay?: string): Promise<number[]> {
  mkdirSync(directory, { recursive: true });
  if (await page.evaluate(() => Boolean(window.__ASSET__?.selectAsset))) {
    await page.evaluate(id => window.__ASSET__!.selectAsset!(id), id);
  } else {
    await page.goto(`${baseURL}/preview/?asset=${encodeURIComponent(id)}&test=1&renderer=webgl&production=1`);
  }
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  if (decay) {
    await page.locator('#decay').evaluate((el, value) => { (el as HTMLSelectElement).value = value; }, decay);
    await page.evaluate(() => window.__ASSET__!.inspectionView!('high', 45));
  }
  await page.locator('#toolbar').evaluate((toolbar) => { toolbar.style.visibility = 'hidden'; });
  const images: string[] = [], occupancies: number[] = [];
  const touchesEdge = (png: Buffer): boolean => {
    const pixels = PNG.sync.read(png), background = [...pixels.data.subarray(0, 3)];
    const foreground = (x: number, y: number) => background.some((v, c) => Math.abs(pixels.data[(y * pixels.width + x) * 4 + c] - v) > 8);
    for (let x = 0; x < pixels.width; x++) if (foreground(x, 0) || foreground(x, pixels.height - 1)) return true;
    for (let y = 0; y < pixels.height; y++) if (foreground(0, y) || foreground(pixels.width - 1, y)) return true;
    return false;
  };
  const fullCanvas = async (): Promise<Buffer> => {
    let png = await page.locator('canvas').screenshot();
    for (let attempt = 0; touchesEdge(png) && attempt < 8; attempt++) {
      await page.evaluate(() => window.__ASSET__!.frame?.([-.1, -.1, 1.1, 1.1]));
      png = await page.locator('canvas').screenshot();
    }
    if (touchesEdge(png)) throw new Error(`${id}: visible geometry still touches the canvas boundary`);
    return png;
  };
  for (let i=0;i<5;i++) {
    await page.evaluate((view) => window.__ASSET__!.view(view),i);
    const path = `${directory}/turntable_${i}.png`;
    let png = await fullCanvas();
    let roll: number | undefined;
    // A single landscape/portrait viewport leaves thin tools and flat panels
    // below 10%. Fit the viewport to their rendered silhouette, then render
    // again; the camera still fits the complete model (no image crop).
    for (let attempt = 0; attempt < 4 && coverage(png) < .1; attempt++) {
      const pixels = PNG.sync.read(png), background = [...pixels.data.subarray(0, 3)];
      let left = pixels.width, top = pixels.height, right = 0, bottom = 0, count = 0, sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
      for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
        const offset = (y * pixels.width + x) * 4;
        if (background.some((v, c) => Math.abs(pixels.data[offset + c] - v) > 8)) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          count++; sumX += x; sumY += y; sumXX += x * x; sumYY += y * y; sumXY += x * y;
        }
      }
      if (left > right || top > bottom) break;
      if (attempt >= 2) roll = (roll ?? 0) - .5 * Math.atan2(2 * (sumXY / count - sumX * sumY / count ** 2), sumXX / count - (sumX / count) ** 2 - sumYY / count + (sumY / count) ** 2);
      const aspect = attempt === 2 ? 2 : (right - left + 1) / (bottom - top + 1);
      await page.setViewportSize(aspect > 1 ? { width: 1280, height: Math.max(64, Math.round(1280 / aspect)) } : { width: Math.max(64, Math.round(1280 * aspect)), height: 1280 });
      await page.evaluate(({ view, roll }) => window.__ASSET__!.view(view, roll), { view: i, roll });
      png = await fullCanvas();
    }
    // The projected GLB box can include invisible joints or loose buffer bounds.
    // Reframe from the actual rendered silhouette, keeping 15% border in the
    // renderer itself. Capture remains a full canvas image, with no image crop.
    for (let fit = 0; fit < 2 && coverage(png) < .1; fit++) {
      const pixels = PNG.sync.read(png), background = [...pixels.data.subarray(0, 3)];
      let left = pixels.width, top = pixels.height, right = 0, bottom = 0;
      for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
        const offset = (y * pixels.width + x) * 4;
        if (background.some((v, c) => Math.abs(pixels.data[offset + c] - v) > 8)) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (left > right || top > bottom) break;
      await page.evaluate(bounds => window.__ASSET__!.frame?.(bounds), [left / pixels.width, top / pixels.height, (right + 1) / pixels.width, (bottom + 1) / pixels.height] as [number, number, number, number]);
      png = await fullCanvas();
    }
    writeFileSync(path, png);
    images.push(path); occupancies.push(coverage(png));
  }
  if (await page.evaluate(() => !!window.__ASSET__!.lighting)) {
    for (const on of [true, false]) { await page.evaluate(async on => { await window.__ASSET__!.lighting!(true, on); }, on); await page.locator('canvas').screenshot({ path: `${directory}/night-${on ? 'on' : 'off'}.png` }); }
    await comparison([`${directory}/night-on.png`, `${directory}/night-off.png`], referenceFor(id), `${directory}/night-on-off.png`);
    await page.evaluate(async () => { await window.__ASSET__!.lighting!(false, true); });
  }
  const reference = referenceFor(`${id}${decay ? `.${decay}` : ''}`);
  await comparison(images, reference, `${directory}/comparison.png`);
  writeFileSync(`${directory}/turntable.json`,JSON.stringify({ id, decay, reference, referenceAvailable: existsSync(reference), coverage: occupancies, ...await page.evaluate(() => window.__ASSET__!.info()) },null,2)+'\n');
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
    const manifest: {id:string;status:string;script?:string;glb:string;animatedDrawBase?:string;dimensions:{x:number;y:number;z:number}}[] = JSON.parse(readFileSync('src/assets/manifest.json','utf8'));
    const changed = target === '--changed' ? spawnSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).stdout.split('\n') : [];
    const selected = manifest.filter(a => target === '--all' ? ['modeled','integrated','final'].includes(a.status) && !!a.glb && existsSync(a.glb) : target === '--changed' ? changed.includes(a.glb) || (!!a.script && changed.includes(a.script)) : target?.split(',').includes(a.id));
    if (!selected.length && target !== '--changed') throw new Error('Usage: npm run assets:turntable -- <id>|--all|--changed (preview server must be running)');
    for (const {id, animatedDrawBase, dimensions} of selected) {
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
      // Adult silhouettes need portrait framing for useful all-side occupancy.
      await page.setViewportSize(process.argv.includes('--compact') ? { width: dimensions.y > Math.max(dimensions.x, dimensions.z) ? 360 : 480, height: 360 } : id.endsWith('.lying') && animatedDrawBase ? { width: 640, height: 360 } : animatedDrawBase ? { width: 360, height: 640 } : { width: 1600, height: 900 });
      const values = await captureTurntable(page,id,`${output}/${id}${decay ? `.${decay}` : ''}`,`http://127.0.0.1:${process.env.E2E_PORT ?? 3313}`,decay);
      if (values.some((v)=>v<.1||v>.8)) throw new Error(`Object coverage outside 10–80%: ${values}`);
    }
  } finally { await browser.close(); }
}
