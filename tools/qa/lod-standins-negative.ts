/** The Scene Lab load barrier must still reject missing walking prefetch on the first drawn tick. */
import type { Game } from '../../src/Game';
import { SceneSession, readSpec, stopServer, writeJson, type Backend } from '../scenelab/session';

const backend = (process.argv[2] ?? 'webgpu') as Backend;
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier });
    try {
      await session.open();
      const spec = readSpec('tests/scenes/catalog/l10-region-seam.json');
      if (spec.expect?.lodPlaceholderFramesMax !== 0) throw new Error('Negative control requires the unchanged zero gate');
      await session.load(spec);
      await session.page.evaluate(() => {
        const district = (window.__SCENE__ as unknown as { game: Game }).game.view.labProbes().districts!;
        const update = district.updateLods.bind(district);
        district.updateLods = view => update(view, { x: 0, z: 0 });
      });
      await session.step(spec.frames!);
      const metrics = await session.metrics();
      writeJson(`test-results/lod-standins/negative/${backend}-${tier}.json`, { lodPlaceholders: metrics.lodPlaceholders, errors: session.errors });
      if (!metrics.lodPlaceholders.frames || session.errors.length) throw new Error(`Missing prefetch escaped the zero gate (${backend}/${tier})`);
      console.log(`EXPECTED FAIL ${backend}/${tier}: lodPlaceholderFramesMax ${metrics.lodPlaceholders.frames} > 0`);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
