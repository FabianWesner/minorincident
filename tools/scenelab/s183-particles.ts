import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, origin, stopServer } from './session';

const spec = JSON.parse(readFileSync('specs/scenes/catalog/s183-flame-fight.json', 'utf8')) as SceneSpec;
const session = new SceneSession({ backend: 'webgl2' });
try {
  await session.open();
  for (const tier of ['high', 'low'] as const) {
    session.options.tier = tier;
    if (tier === 'low') {
      await session.page.goto(`${origin}/?test=1&scenelab=1&renderer=webgl&profile=1&dpr=1&quality=low&audio=muted&seed=1`);
      await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
      await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    }
    await session.load(structuredClone(spec)); await session.step(70);
    const result = await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const pool = game.view.vfx!.particles, g = pool.mesh.geometry;
      const o = g.getAttribute('fxOrigin'), m = g.getAttribute('fxMotion'), s = g.getAttribute('fxStyle');
      const now = pool.clock.value; let sparks = 0, smoke = 0, falling = 0;
      for (let i = 0; i < pool.budget; i++) {
        const age = now - o.getW(i), life = m.getW(i), shape = Math.round(s.getY(i)), gravity = s.getZ(i);
        if (age < 0 || age >= life) continue;
        if (shape === 12 && Math.abs(gravity - 5) < .01 && m.getX(i) > 0) { sparks++; if (m.getY(i) - age * gravity < 0) falling++; }
        if (shape === 14 && Math.abs(gravity + .3) < .01 && m.getY(i) > 0) smoke++;
      }
      return { sparks, falling, smoke, budget: pool.budget, count: pool.count };
    });
    assert(result.sparks > 0 && result.falling > 0 && result.smoke > 0, `${tier}: ${JSON.stringify(result)}`);
    console.log(JSON.stringify({ tier, ...result }));
  }
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
