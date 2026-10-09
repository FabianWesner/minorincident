/** Headless L6 adult reference/peer evidence at the fixed game camera. */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { referenceFor } from './turntable';
import type { AssetDef } from '../../src/assets/types';

const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const ids = process.argv[2]?.split(',') ?? manifest.filter(a => a.animatedDrawBase).map(a => a.id);
const output = process.argv[3] ?? 'test-results/l6-shelter-adults-and-injuries';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 300, height: 280 } });
  for (const id of ids) {
    const def = manifest.find(a => a.id === id)!;
    const out = `${output}/${id}`; mkdirSync(out, { recursive: true });
    const sheet = new PNG({ width: 1500, height: 560 });
    for (let i = 0; i < sheet.data.length; i += 4) sheet.data.set([38,35,43,255], i);
    const reference = PNG.sync.read(readFileSync(referenceFor(id)));
    const scale = Math.min(300/reference.width, 230/reference.height);
    const w = Math.round(reference.width*scale), h = Math.round(reference.height*scale);
    for (const row of [0,1]) for (let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const from = (Math.floor(y/scale)*reference.width+Math.floor(x/scale))*4;
      reference.data.copy(sheet.data, ((row*280+35+y)*1500+Math.floor((300-w)/2)+x)*4, from, from+4);
    }
    const records: unknown[] = [], errors: string[] = [];
    const captureErrors = (message: import('@playwright/test').ConsoleMessage) => { if (message.type()==='error') errors.push(message.text()); };
    page.on('console', captureErrors);
    for (const [col, asset] of [id,id,id,def.animatedDrawBase!].entries()) {
      await page.goto(`http://127.0.0.1:${process.env.E2E_PORT ?? 3314}/preview/?asset=${encodeURIComponent(asset)}&production=1&test=1&renderer=webgl&inspection=1`);
      await page.waitForFunction(() => !!window.__ASSET__);
      await page.evaluate(() => window.__ASSET__!.ready);
      await page.locator('#toolbar').evaluate(el => { el.style.display='none'; });
      const size = manifest.find(a => a.id===asset)!.dimensions;
      const width = (size.x+size.z)/Math.SQRT2;
      const height = size.y*Math.cos(Math.PI*.2)+width*Math.sin(Math.PI*.2);
      const quality: 'high' | 'lod1' | 'lod2' = col === 1 ? 'lod1' : col === 2 ? 'lod2' : 'high';
      for (const [row, pixels] of [135,190].entries()) {
        const distance = Math.max(width,height)*280/(2*pixels*Math.tan(25*Math.PI/360));
        await page.evaluate(async ({quality,distance,label}) => {
          await window.__ASSET__!.deliveryView!(quality,distance);
          let el=document.querySelector<HTMLDivElement>('#qa-label');
          if(!el) { el=document.createElement('div'); el.id='qa-label'; el.style.cssText='position:fixed;top:0;left:0;right:0;background:#26232bcc;color:white;font:12px sans-serif;padding:5px'; document.body.append(el); }
          el.textContent=label;
        }, {quality,distance,label:`${asset} · ${quality==='high'?'LOD0':quality} · ${pixels}px`});
        const info = await page.evaluate(() => window.__ASSET__!.info());
        if(info.placeholder) throw new Error(`${asset} ${quality}: placeholder`);
        records.push({asset,quality,pixels,info});
        PNG.bitblt(PNG.sync.read(await page.screenshot()),sheet,0,0,300,280,(col+1)*300,row*280);
      }
    }
    page.off('console',captureErrors);
    writeFileSync(`${out}/game-reference-peer.png`,PNG.sync.write(sheet));
    writeFileSync(`${out}/game-reference-peer.json`,JSON.stringify({id,records,errors},null,2)+'\n');
    if(errors.length) throw new Error(errors.join('\n'));
    console.log(`${out}/game-reference-peer.png`);
  }
} finally { await browser.close(); }
