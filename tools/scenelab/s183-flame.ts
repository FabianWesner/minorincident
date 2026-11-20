import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, origin, port, stopServer } from './session';

const spec = JSON.parse(readFileSync('specs/scenes/catalog/s183-flame-fight.json', 'utf8')) as SceneSpec;
const backend = process.env.SCENE_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const session = new SceneSession({ backend, viewport: { width: 1280, height: 720 } });
const baseline = process.env.SCENE_BASELINE === '1';
const out = `test-results/s183-flame${baseline ? '-baseline' : backend === 'webgpu' ? '-webgpu' : ''}`;
const originals = new Map(baseline ? ['src/render/vfx/Vfx.ts', 'src/render/vfx/Blasts.ts'].map(path => [resolve(path), execFileSync('git', ['show', `3d9e12b1:${path}`], { encoding: 'utf8' })]) : []);
const server = baseline ? await createServer({ configFile: resolve('vite.config.ts'), cacheDir: '/private/tmp/s183-baseline-vite',
  plugins: [{ name: 's183-baseline', enforce: 'pre', load(id) { return originals.get(id.split('?')[0]); } }],
  server: { host: '127.0.0.1', port, strictPort: true } }) : null;
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  await server?.listen();
  await session.open();
  for (const tier of ['high', 'low'] as const) {
    session.options.tier = tier;
    if (tier === 'low') {
      await session.page.goto(`${origin}/?test=1&scenelab=1&${backend === 'webgl2' ? 'renderer=webgl&' : ''}profile=1&dpr=1&quality=low&audio=muted&seed=1`);
      await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
      await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    }
    await session.load(structuredClone(spec));
    let previous = 0;
    for (const frame of tier === 'high' ? [40, 46, 52, 58, 64, 70] : [52]) {
      await session.step(frame - previous); previous = frame;
      await session.screenshot(`${out}/${tier}-${frame}.png`);
      const evidence = await session.page.evaluate(() => ({ state: window.__SS__!.getState().render.vfx, perf: window.__SS__!.perf(), attacks: window.__SS__!.events(0).filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.flamethrower').length }));
      rows.push({ tier, frame, ...evidence });
    }
  }
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ rows, errors: session.errors }, null, 2));
  if (session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); await server?.close(); }
