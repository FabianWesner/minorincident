import { readFileSync, mkdirSync } from 'node:fs';
import type { Game } from '../../src/Game';
import type { FieldLight } from '../../src/render/LightField';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer } from './session';

const spec = JSON.parse(readFileSync('docs/reports/r15-flamer/scene.json', 'utf8')) as SceneSpec;
spec.time = 'night'; spec.weather = 'clear'; spec.actors!.find(a => a.id === 'target')!.at = [5.2, 0];
const session = new SceneSession({ backend: 'webgl2' });
const out = 'test-results/s183-light-mask'; mkdirSync(out, { recursive: true });
try {
  await session.open(); await session.load(spec); await session.step(45);
  await session.screenshot(`${out}/on.png`);
  await session.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const entries = (game.view.lightField! as unknown as { transients: { light: FieldLight }[] }).transients;
    for (const entry of entries) entry.light.on = false;
    game.view.update(1);
  });
  await session.screenshot(`${out}/off.png`);
  await session.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    game.view.probeVisibility({ courier: true, crowd: false });
  });
  await session.screenshot(`${out}/hidden.png`);
  if (session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
