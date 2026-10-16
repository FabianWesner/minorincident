import { execFileSync } from 'node:child_process';
/** LOD contact sheets for chosen assets: rows = asset x azimuth (45, 225), columns = LOD0/LOD1/LOD2.
 * Usage: sh tools/e2e-lock.sh npx tsx docs/reports/alpha-look/capture-lods.ts <outDir> <id> [<id> ...] [--backend webgl2|webgpu]
 * Writes sheet-NN.png (3 assets per sheet) and views.json (triangle info per cell). Headless, private Vite server. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, origin, stopServer, type Backend } from '../../../tools/scenelab/session';

const args = process.argv.slice(2), backendIndex = args.indexOf('--backend');
const backend = (backendIndex < 0 ? 'webgl2' : args.splice(backendIndex, 2)[1]) as Backend;
if (!['webgl2', 'webgpu'].includes(backend)) throw new Error('backend must be webgl2 or webgpu');
const [out, ...ids] = args;
if (!out || !ids.length) throw new Error('usage: lod-sheet.ts <outDir> <id>...');
const W = 360, H = 270, qualities = ['high', 'lod1', 'lod2'] as const, angles = [45, 225];
const session = new SceneSession({ backend, viewport: { width: W, height: H } });
try {
  await session.open();
  if (process.env.ALPHA_BASELINE) await session.page.route('**/assets/models/inf.*alpha*.glb', route => {
    const path = new URL(route.request().url()).pathname;
    const body = execFileSync('git', ['show', `${process.env.ALPHA_BASELINE}:public${path}`]);
    return route.fulfill({ body, contentType: 'model/gltf-binary' });
  });
  mkdirSync(out, { recursive: true });
  const rows: Buffer[][] = [], meta: unknown[] = [];
  for (const id of ids) {
    await session.page.goto(`${origin}/preview/?asset=${id}&test=1${backend === 'webgl2' ? '&renderer=webgl' : ''}&production=1&inspection=1`);
    await session.page.waitForFunction(() => !!window.__ASSET__);
    await session.page.evaluate(() => window.__ASSET__!.ready);
    const actualBackend = await session.page.evaluate(() => document.querySelector<HTMLCanvasElement>('#stage canvas')!.getContext('webgl2') ? 'webgl2' : 'webgpu');
    if (actualBackend !== backend) throw new Error(`Requested ${backend}, got ${actualBackend}`);
    await session.page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
    for (const angle of angles) {
      const row: Buffer[] = [];
      for (const quality of qualities) {
        await session.page.evaluate(async ({ quality, angle, id }) => {
          await window.__ASSET__!.inspectionView!(quality, angle);
          let label = document.querySelector<HTMLDivElement>('#lod-label');
          if (!label) { label = document.createElement('div'); label.id = 'lod-label'; label.style.cssText = 'position:fixed;top:0;left:0;color:white;background:#17151bcc;font:12px sans-serif;padding:4px'; document.body.append(label); }
          label.textContent = `${id} ${quality === 'high' ? 'LOD0' : quality.toUpperCase()} / ${angle}`;
        }, { quality, angle, id });
        const info = await session.page.evaluate(() => window.__ASSET__!.info());
        meta.push({ id, quality, angle, backend, ...info });
        row.push(await session.page.screenshot());
      }
      rows.push(row);
    }
  }
  const perSheet = 6;
  for (let s = 0; s * perSheet < rows.length; s++) {
    const chunk = rows.slice(s * perSheet, (s + 1) * perSheet);
    const sheet = new PNG({ width: W * 3, height: H * chunk.length });
    chunk.forEach((row, r) => row.forEach((buf, c) => PNG.bitblt(PNG.sync.read(buf), sheet, 0, 0, W, H, c * W, r * H)));
    writeFileSync(`${out}/sheet-${String(s + 1).padStart(2, '0')}.png`, PNG.sync.write(sheet));
  }
  writeFileSync(`${out}/views.json`, JSON.stringify(meta, null, 2) + '\n');
} finally { await session.close(); stopServer(); }
