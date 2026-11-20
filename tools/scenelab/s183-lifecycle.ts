import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer } from './session';

const spec = JSON.parse(readFileSync('specs/scenes/catalog/s183-flame-fight.json', 'utf8')) as SceneSpec;
spec.script = [
  { frame: 0, actor: 'courier', do: { select: 'LEFT' } },
  { frame: 0, actor: 'courier', do: { aim: 'target', seconds: 3 } },
  { frame: 30, actor: 'courier', do: { attack: 'target', seconds: .25, move: [0, 0] } },
  { frame: 50, actor: 'courier', do: { attack: 'target', seconds: .8, move: [0, 0] } },
];
const session = new SceneSession({ backend: 'webgl2' });
try {
  await session.open(); await session.load(spec); await session.step(46);
  const tail = await session.page.evaluate(() => window.__SS__!.getState().render.vfx!.blasts.flameJet);
  assert(tail, 'release retains a tail');
  await session.step(30);
  const restarted = await session.page.evaluate(() => ({ jet: window.__SS__!.getState().render.vfx!.blasts.flameJet, attacks: window.__SS__!.events(0).filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.flamethrower').length }));
  assert(restarted.jet && restarted.attacks >= 2, 'second press fires and recreates a jet');
  for (const tier of ['low', 'high'] as const) {
    await session.page.evaluate(t => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      game.view.setQuality(t);
    }, tier);
    await session.step(2);
    const state = await session.page.evaluate(() => window.__SS__!.getState().render.vfx!);
    assert.equal(state.quality, tier);
    assert(state.blasts.flameJet, `jet remains active on ${tier}`);
    assert.equal(state.blasts.flameJet.cards, tier === 'low' ? 24 : 32);
    await session.screenshot(`test-results/s183-flame/lifecycle-${tier}.png`);
  }
  assert.deepEqual(session.errors, []);
  console.log(JSON.stringify({ tail: !!tail, attacks: restarted.attacks, errors: session.errors }));
} finally { await session.close(); stopServer(); }
