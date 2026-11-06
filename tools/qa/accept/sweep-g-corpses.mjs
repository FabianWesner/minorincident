/** Current production corpse fixtures; setup is authored, observations are read only. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SceneSession, readSpec, stopServer } from '../../scenelab/session.ts';
import { provenance } from './probe.ts';

const out = 'test-results/sweep-g/G-14-scenes';
mkdirSync(out, { recursive: true });
const result = { ...provenance(), method: 'Authored permanent-corpse fixtures, native updates and renderer geometry bounds; no corpse placement or animation changes.', cells: [], errors: [] };
try {
  for (const tier of ['low', 'high']) {
    const session = new SceneSession({ backend: 'webgl2', tier });
    try {
      await session.open();
      for (const [file, frames] of [
        ['tests/scenes/catalog/corpse-placement-pile.json', [180, 600]],
        ['tests/scenes/catalog/l4-corpses-persist.json', [120, 7320]],
      ]) {
        const spec = readSpec(file);
        await session.load(spec);
        let at = 0;
        for (const frame of frames) {
          await session.step(frame - at); at = frame;
          await session.ready();
          const sample = await session.page.evaluate(() => {
            const game = window.__SCENE__.game, world = game.world;
            return { tick: world.tick, corpses: [...world.entities.iterate()].filter(e => e.corpse).map(e => ({ id: e.id, at: { ...e.transform }, health: e.health.current })), layout: window.__SS__.debug.corpseLayout() };
          });
          const captures = [];
          for (const zoom of [.5, 1.5]) {
            await session.page.evaluate(async z => { const a = window.__SS__; a.camera.follow(); a.camera.zoom(z); await a.screenshotReady(); }, zoom);
            const path = `${out}/${tier}-${spec.name}-f${frame}-z${zoom}.png`;
            await session.screenshot(path);
            captures.push({ file: path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
          }
          result.cells.push({ tier, case: spec.name, frame, sample, metrics: await session.metrics(), captures });
          console.log(tier, spec.name, frame, sample.corpses.length);
        }
      }
      result.errors.push(...session.errors);
    } catch (error) { result.errors.push({ tier, error: String(error) }); }
    finally { await session.close(); }
  }
} finally { stopServer(); writeFileSync('docs/reports/sweep-g/G-14-scenes.json', JSON.stringify(result, null, 2) + '\n'); }
