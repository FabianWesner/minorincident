import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, stopServer, writeJson } from './session';

const session = new SceneSession({ backend: 'webgpu', tier: 'low' });
await session.open();
try {
  for (const phase of (process.argv[2] === 'all' ? ['before', 'after'] : [process.argv[2] === 'before' ? 'before' : 'after'])) {
  const out = resolve(`test-results/luna-fixes-1101/routes-${phase}`);
  mkdirSync(out, { recursive: true });
  const receipts: unknown[] = [];
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['low', 'high'] as const) {
    {
      session.options.backend = backend; session.options.tier = tier;
      await session.page.unrouteAll({ behavior: 'wait' });
      if (phase === 'before') for (const suffix of ['layout.json', 'base.glb']) await session.page.route(`**/assets/layouts/D-GROVE.${suffix}*`, route => route.fulfill({ body: execFileSync('git', ['show', `0e3e33219:public/assets/layouts/D-GROVE.${suffix}`], { maxBuffer: 8 * 1024 * 1024 }), contentType: suffix.endsWith('json') ? 'application/json' : 'model/gltf-binary' }));
      await session.page.goto(`http://127.0.0.1:4872/?test=1&scenelab=1&profile=1&dpr=1&quality=${tier}&audio=muted&seed=1${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
      await session.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
      await session.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.inspect.enable(false); a.camera.follow(); a.camera.zoom(.5); });
      for (const [name, x, z] of [['bags-west', -18, -49.25], ['crates', 0, -49.25], ['bags-east', 24, -49.25], ['chair', -39, -16.25]] as const) {
        await session.page.evaluate(([x, z]) => window.__SS__!.teleport('player', { x: x - 2, z }), [x, z]);
        await session.page.keyboard.down('KeyS'); await session.page.keyboard.down('KeyD');
        const path = [];
        for (let i = 0; i < 15; i++) { await session.page.evaluate(() => window.__SS__!.step(6)); path.push(await session.page.evaluate(() => window.__SS__!.getEntity(1)!.transform)); }
        await session.page.keyboard.up('KeyS'); await session.page.keyboard.up('KeyD');
        for (const zoom of [.5, 1.5]) {
          await session.page.evaluate(z => window.__SS__!.camera.zoom(z), zoom);
          for (let i = 0; i < 16; i++) await session.ready();
          await session.page.screenshot({ path: `${out}/${backend}-${tier}-${name}-z${zoom}.jpg`, type: 'jpeg', quality: 82 });
        }
        receipts.push({ phase, backend, tier, name, start: [x - 2, z], path });
      }
      if (session.errors.length) throw new Error(session.errors.join('\n'));
      console.log(`${phase} routes ${backend} ${tier} complete`);
    }
  }
  writeJson(`${out}/receipts.json`, receipts);
  }
} finally { await session.close(); stopServer(); }
