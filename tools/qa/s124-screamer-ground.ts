import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
import { readFixture } from './fixture-io';
import { loadFixtureInPage } from './load-fixture';

// The restored crowd emits native scream pulses during these six seconds.
// Alternating tiers covers both render paths; switching is not the pulse cause.
// Run under tools/e2e-lock.sh with SCENE_PORT=4985 and optional L9_BACKEND=webgl2.
const backend = process.env.L9_BACKEND === 'webgl2' ? 'webgl2' : 'webgpu';
const mode = process.env.L9_ABLATE ?? 'none';
const out = `test-results/s124-pulse-${backend}-${mode}`;
const session = new SceneSession({ backend, tier: 'high' });
mkdirSync(out, { recursive: true });
try {
  await session.open();
  const fixture = readFixture('tests/fixtures/saves/qa/s124-l9-crowded-trucks.json.br');
  fixture.campaign.settings.quality = 'high';
  await loadFixtureInPage(session.page, fixture);
  await session.page.evaluate(mode => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    window.__SS__!.camera.follow(); window.__SS__!.camera.zoom(1.5);
    // Diagnostic controls preserve the same world and simulation events.
    if (mode === 'no-vfx') game.view.vfx?.removeFromParent();
    if (mode === 'no-field') Object.defineProperty(game.view.lightField!, 'active', { get: () => false });
  }, mode);
  const rows = [];
  for (let i = 0; i < 6; i++) {
    const tier: 'high' | 'low' = i % 2 ? 'high' : 'low';
    await session.page.evaluate(async (tier: 'high' | 'low') => {
      const api = window.__SS__!;
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      api.settings.set({ quality: tier });
      for (let tick = 0; tick < 60; tick++) {
        await api.step(1); game.view.frame(1 / 60);
      }
    }, tier);
    // Capture the actual pulse frame, without waiting for streaming/warmup.
    const bytes = await session.page.screenshot({ path: `${out}/${i}-${tier}.png` });
    const png = PNG.sync.read(bytes);
    let pink = 0;
    for (let p = 0; p < png.data.length; p += 4) {
      const [r, g, b] = png.data.subarray(p, p + 3);
      if (r > 160 && b > 180 && r - g > 30 && b - g > 45) pink++;
    }
    rows.push({ i, tier, pink });
    console.log(JSON.stringify(rows.at(-1)));
  }
  writeFileSync(`${out}/rows.json`, JSON.stringify({ backend, mode, rows, errors: session.errors }, null, 2));
  // Before the fix the matched HIGH frame has 190,108 bright-pink pixels.
  if (rows.some(row => row.pink > 5000) || session.errors.length) throw new Error('broad pink ground or browser errors');
} finally {
  await session.close(); stopServer();
}
