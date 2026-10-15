/** Reproduce before/after at the same game camera. Baseline is served only to this browser. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, readSpec, stopServer } from '../../../tools/scenelab/session';
const baseline = process.argv[2];
if (!baseline) throw new Error('capture.ts <baseline commit>');
const out = 'docs/reports/alpha-look/comparisons'; mkdirSync(out, { recursive: true });
const spec = readSpec('tests/scenes/catalog/alpha-look-lineup.json');
const original = new Map(['inf.alpha', 'inf.mega-alpha'].flatMap(id => ['', '.lod1', '.lod2'].map(suffix => {
  const path = `assets/models/${id}${suffix}.glb`;
  return [path, execFileSync('git', ['show', `${baseline}:public/${path}`])];
})));
const captures = new Map<string, Buffer>();
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) for (const phase of ['before', 'after']) {
    const session = new SceneSession({ backend, tier, viewport: { width: 2560, height: 720 } });
    try {
      await session.open();
      if (phase === 'before') {
        await session.page.route('**/assets/models/inf.*alpha*.glb', route => {
          const path = new URL(route.request().url()).pathname.slice(1), body = original.get(path);
          return body ? route.fulfill({ body, contentType: 'model/gltf-binary' }) : route.continue();
        });
        await session.page.reload();
        await session.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
        await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
      }
      for (const zoom of [.5, 1, 1.5]) {
        await session.load({ ...spec, camera: { ...spec.camera!, zoom } }); await session.ready();
        const actualBackend = await session.page.evaluate(() => window.__SS__!.perf().backend);
        if (actualBackend !== (backend === 'webgl2' ? 'webgl' : 'webgpu')) throw new Error(`Requested ${backend}, got ${actualBackend}`);
        await session.page.evaluate(label => {
          document.querySelector('#comparison-label')?.remove();
          const el = document.createElement('div'); el.id = 'comparison-label'; el.textContent = label;
          el.style.cssText = 'position:fixed;top:8px;left:8px;background:#211e27;color:white;font:20px sans-serif;padding:8px;z-index:9999'; document.body.append(el);
        }, `${phase.toUpperCase()} · ${backend} · ${tier} · zoom ${zoom}`);
        const key = `${backend}-${tier}-z${zoom}`, shot = await session.page.screenshot();
        if (phase === 'before') captures.set(key, shot);
        else {
          const a = PNG.sync.read(captures.get(key)!), b = PNG.sync.read(shot), sheet = new PNG({ width: a.width * 2, height: a.height });
          PNG.bitblt(a, sheet, 0, 0, a.width, a.height, 0, 0); PNG.bitblt(b, sheet, 0, 0, b.width, b.height, a.width, 0);
          writeFileSync(`${out}/${key}.png`, PNG.sync.write(sheet));
        }
      }
      console.log(backend, tier, phase);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
