/** One pooled browser; matched marker-disabled/enabled captures and structural draw counts. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, origin } from './session';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const corpses = process.argv.includes('--corpses');
const timing = process.argv.includes('--perf');
const out = `test-results/s134-courierpin/review${corpses ? '-corpses' : ''}${process.argv.includes('--webgpu') ? '-webgpu' : ''}${timing ? '-perf' : ''}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: process.argv.includes('--webgpu') ? 'webgpu' : 'webgl2', tier: 'high', nativeFrameTiming: timing });
const rows: unknown[] = [];
let baselineServer: Awaited<ReturnType<typeof createServer>> | undefined;
try {
  await session.open();
  if (process.argv.includes('--baseline')) {
    const paths = ['src/render/GameView.ts', 'src/render/PaletteMaterial.ts', 'src/render/characters/courierDepth.ts', 'src/render/courierForeground.ts'];
    const sources = new Map(paths.map(path => [resolve(path), execFileSync('git', ['show', `4dca98d8:${path}`], { encoding: 'utf8' })]));
    baselineServer = await createServer({ configFile: resolve('vite.config.ts'), cacheDir: '/private/tmp/s133-before-vite', plugins: [{ name: 's133-baseline', enforce: 'pre', load(id) { return sources.get(id.split('?')[0]); } }], server: { host: '127.0.0.1', port: 5005, strictPort: true } });
    await baselineServer.listen();
    for (const side of ['before', 'after']) {
      await session.page.goto(`${side === 'before' ? 'http://127.0.0.1:5005' : origin}/?test=1&scenelab=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1`);
      await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__, null, { timeout: 120000 });
      await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
      for (const level of ['l4', 'l6', 'l1']) {
        const spec = readSpec(level === 'l1' ? 'tests/scenes/catalog/atmosphere-l1.json' : `tests/scenes/catalog/courier-read-${level}-dense.json`); spec.camera = { mode: 'game', target: 'courier', zoom: 1 };
        for (const actor of spec.actors ?? []) if (actor.kind === 'infected') actor.state = { chase: 'courier' };
        await session.load(spec); await session.step(60); await session.screenshot(`${out}/${level}-baseline-${side}.png`);
        rows.push({ level, side, state: await session.page.evaluate(() => { const lab = window.__SCENE__ as unknown as { game: { view: { view: { storyShot: boolean }, scene: import('three').Scene } } }; const pin = lab.game.view.scene.getObjectByName('courier-occlusion-pin'); return { render: window.__SS__!.getState().render.courierMark, story: lab.game.view.view.storyShot, pin: pin && { visible: pin.visible, position: pin.position.toArray(), scale: pin.scale.toArray() } }; }), revision: side === 'before' ? 's133 HEAD' : 's134 working tree', perf: await session.page.evaluate(() => window.__SS__!.perf()) });
      }
    }
  } else {
   for (const level of ['l4', 'l6']) {
    const spec = readSpec(`tests/scenes/catalog/courier-read-${level}-dense.json`);
    spec.camera = { mode: 'game', target: 'courier', zoom: 1 };
    for (const actor of spec.actors ?? []) if (actor.kind === 'infected') actor.state = { chase: 'courier' };
    await session.load(spec); await session.step(60);
    if (corpses) { await session.page.evaluate(() => { for (let i = 0; i < 16; i++) window.__SCENE__!.command(`infected-${i}`, { corpse: true, ageTicks: 180 }); }); await session.step(1); }
    for (const enabled of [false, true]) {
      await session.page.evaluate(on => {
        // Debug fixture owns the game; change only the marker's geometry submission.
        const lab = window.__SCENE__ as unknown as { game: { view: { scene: import('three').Scene } } };
        lab.game.view.scene.traverse(node => {
          if (node.name === 'courier-occlusion-pin') node.visible = on;
        });
      }, enabled);
      await session.ready();
      await session.screenshot(`${out}/${level}-${enabled ? 'after' : 'before'}.png`);
      const timings = timing ? await session.page.evaluate(async () => {
        const lab = window.__SCENE__ as unknown as { game: { view: { update(alpha: number): void } } };
        const cpu: number[] = [], intervals: number[] = []; let previous = 0;
        for (let i = 0; i < 780; i++) {
          const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
          const start = performance.now(); lab.game.view.update(1); const cost = performance.now() - start;
          if (i >= 180) { cpu.push(cost); intervals.push(now - previous); } previous = now;
        }
        cpu.sort((a, b) => a - b); intervals.sort((a, b) => a - b);
        return { samples: cpu.length, cpuMs: { median: cpu[300], p95: cpu[570] }, frameMs: { median: intervals[300], p95: intervals[570] } };
      }) : null;
      rows.push({ level, enabled, timings, perf: await session.page.evaluate(() => window.__SS__!.perf()) });
    }
   }
   const calm = readSpec('tests/scenes/catalog/atmosphere-l1.json'); calm.camera = { mode: 'game', target: 'courier', zoom: 1 };
   await session.load(calm); await session.step(60);
   for (const enabled of [false, true]) {
     await session.page.evaluate(on => { const lab = window.__SCENE__ as unknown as { game: { view: { scene: import('three').Scene } } }; lab.game.view.scene.traverse(node => { if (node.name === 'courier-occlusion-pin') node.visible = on; }); }, enabled);
     await session.ready(); await session.screenshot(`${out}/l1-calm-${enabled ? 'after' : 'before'}.png`);
     rows.push({ level: 'l1-calm', enabled, pin: await session.page.evaluate(() => window.__SS__!.getState().render.courierMark) });
   }
  }
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ rows, errors: session.errors }, null, 2));
} finally { await session.close(); await baselineServer?.close(); stopServer(); }
