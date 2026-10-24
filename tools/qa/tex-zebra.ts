/** Headless source/production comparison and zebra motion evidence. E2E_PORT=4511 SCENE_PORT=4512. */
import type { GameView } from '../../src/render/GameView';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
const out = 'test-results/tex-zebra'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low', viewport: { width: 1280, height: 800 }, query: { tex: '1' } });
try {
  await session.open();
  const spec = readSpec('tests/scenes/zoo-s3/qa-zoo-zebra-kick.json');
  spec.script = []; spec.actors![0].at = [10, 8]; spec.actors![1].at = [-1, 0];
  spec.actors!.push({ id: 'healthy', kind: 'animal', species: 'zebra', at: [3, 0], yaw: 0 });
  spec.camera = { mode: 'game', target: [1, 0], zoom: 1.5 }; spec.frames = 180;
  await session.load(spec); await session.screenshot(`${out}/pilot-rest.png`);
  const debug = await session.page.evaluate(() => {
    const view = (window.__SCENE__ as unknown as { game: { view: GameView } }).game.view;
    return { snapshot: window.__SS__!.getState().render.infected, batches: [...(view['crowd']?.['batches'].values() ?? [])].filter(b => b.asset.includes('zebra')).map(b => {
      const uv = b.mesh.geometry.getAttribute('uv');
      return { asset: b.asset, lod: b.lod, uv: uv ? Array.from({ length: Math.min(20, uv.count) }, (_, i) => [uv.getX(i), uv.getY(i), b.mesh.geometry.getAttribute('_parts').getY(i)]) : null, material: (Array.isArray(b.mesh.material) ? b.mesh.material[0] : b.mesh.material).type };
    }) };
  });
  writeFileSync(`${out}/pilot-debug.json`, JSON.stringify(debug, null, 2));
  writeFileSync(`${out}/pilot-rest.json`, JSON.stringify({ metrics: await session.metrics(), state: await session.describe(), errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
