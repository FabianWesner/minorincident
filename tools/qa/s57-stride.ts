/** Dense production flamingo stride capture; run through e2e-lock, SCENE_PORT=4958. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Game } from '../../src/Game';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
const out = `test-results/s57-stride-${process.env.S57_SIDE ?? 'current'}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low', viewport: { width: 960, height: 540 } });
const shots = [40, 46, 52, 58, 250, 256, 262, 268], samples: { frame: number; hipY: number | null }[] = [];
const sheet = new PNG({ width: 1280, height: 600 });
try {
  await session.open();
  await session.load(readSpec('tests/scenes/catalog/foot-slide-flamingo-day.json'));
  for (let frame = 1; frame <= 360; frame++) {
    const hipY = await session.page.evaluate(async () => {
      const lab = window.__SCENE__!; await lab.step(1);
      const game = (lab as unknown as { game: Game }).game;
      return game.view.crowdFigures().find(f => f.joints?.hip && f.clip !== 'idle')?.joints?.hip[1] ?? null;
    });
    samples.push({ frame, hipY });
    const index = shots.indexOf(frame);
    if (index >= 0) {
      const png = PNG.sync.read(await session.page.screenshot({ path: `${out}/frame-${frame}.png` }));
      PNG.bitblt(png, sheet, 320, 160, 320, 300, index % 4 * 320, Math.floor(index / 4) * 300);
    }
  }
  writeFileSync(`${out}/strip.png`, PNG.sync.write(sheet));
  const range = (from: number, to: number) => { const heights = samples.filter(s => s.frame >= from && s.frame <= to && s.hipY !== null).map(s => s.hipY!); return heights.length ? (Math.max(...heights) - Math.min(...heights)) * 100 : null; };
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ shots, walkHipRangeCm: range(60, 180), runHipRangeCm: range(230, 350), metrics: await session.metrics(), errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
