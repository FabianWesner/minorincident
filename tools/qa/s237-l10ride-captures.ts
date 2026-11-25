import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Backend } from '../scenelab/session';

const out = resolve('docs/reports/s237-l10ride/captures');
const scenes = [
  ['quarantine-gate', 3010, 95],
  ['billboard', 3076, 95],
  ['underpass', 3390, 74],
  ['hospital', 3502, 95],
] as const;
for (const tier of ['high', 'low'] as const) {
  const session = new SceneSession({ backend: 'webgl2' as Backend, tier, viewport: { width: 1280, height: 720 }, query: { zoom: '1' } });
  try {
    await session.open();
    await session.page.evaluate(async () => {
      const api = window.__SS__!;
      await api.loadLevel('L10', { seed: 1, checkpoint: 'cure-research' });
      if (api.missions.state()?.phase === 'briefing') api.missions.begin();
      api.pause(); api.camera.follow(); api.camera.zoom(1);
    });
    const cells = [];
    for (const [index, [name, x, z]] of scenes.entries()) {
      await session.page.evaluate(async ({ x, z }) => {
        const api = window.__SS__!;
        api.teleport(1, { x, z });
        await api.step(120);
        await api.screenshotReady();
      }, { x, z });
      const path = `${out}/${tier}/${name}.png`;
      mkdirSync(dirname(path), { recursive: true });
      await session.screenshot(path);
      cells.push({ frame: index, jpeg: await session.snapshot() });
    }
    await session.makeSheet(cells, `${out}/${tier}/setpieces.jpg`, 640, 520);
    console.log(`${tier}: captured ${scenes.map(([name]) => name).join(', ')}`);
  } finally { await session.close(); stopServer(); }
}
