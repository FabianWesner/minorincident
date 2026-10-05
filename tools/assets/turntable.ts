import { chromium, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  const main = '/Users/fabianwesner/Workspace/suburban-survivors';
  return id === 'veh.fire-engine' ? `${main}/assets/fire-engine/reference-upscaled.png` : `${main}/assets/${id}/reference-upscaled.png`;
}
export async function captureTurntable(page: Page, id: string, directory: string, baseURL: string): Promise<number[]> {
  mkdirSync(directory, { recursive: true });
  await page.goto(`${baseURL}/preview/?asset=${encodeURIComponent(id)}&test=1&renderer=webgl`);
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  await page.locator('#toolbar').evaluate((toolbar) => { toolbar.style.visibility = 'hidden'; });
  const images: string[] = [], occupancies: number[] = [];
  for (let i=0;i<5;i++) {
    await page.evaluate((view) => window.__ASSET__!.view(view),i);
    const path = `${directory}/turntable_${i}.png`;
    const png = await page.locator('canvas').screenshot({ path });
    images.push(path); occupancies.push(coverage(png));
  }
  await comparison(images, referenceFor(id), `${directory}/comparison.png`);
  writeFileSync(`${directory}/turntable.json`,JSON.stringify({ id, coverage: occupancies, ...await page.evaluate(() => window.__ASSET__!.info()) },null,2)+'\n');
  return occupancies;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: {width:1600,height:900} });
    const target = process.argv[2];
    const manifest: {id:string;status:string;script?:string;glb:string}[] = JSON.parse(readFileSync('src/assets/manifest.json','utf8'));
    const changed = target === '--changed' ? spawnSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).stdout.split('\n') : [];
    const selected = manifest.filter(a => target === '--all' ? ['integrated','final'].includes(a.status) : target === '--changed' ? changed.includes(a.glb) || (!!a.script && changed.includes(a.script)) : a.id === target);
    if (!selected.length && target !== '--changed') throw new Error('Usage: npm run assets:turntable -- <id>|--all|--changed (preview server must be running)');
    for (const {id} of selected) {
      const values = await captureTurntable(page,id,`test-results/assets/${id}`,`http://127.0.0.1:${process.env.E2E_PORT ?? 3313}`);
      if (values.some((v)=>v<.1||v>.8)) throw new Error(`Object coverage outside 10–80%: ${values}`);
    }
  } finally { await browser.close(); }
}
