import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const session = new SceneSession({ tier: 'low', backend: 'webgl2' });
try {
  await session.open();
  const rows = await session.page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.pause(); a.missions.begin();
    const game = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game;
    const result = [];
    for (const [name, x, z] of [['near', -70, 42.5], ['away', 0, 0], ['return', -70, 42.5]] as const) {
      a.teleport('player', { x, z }); a.camera.follow(); game.view.view.reset(game.world.entities.get(1)!.transform, true);
      await a.screenshotReady(); await a.screenshotReady();
      result.push({ name, state: a.getState().render.districts?.signVisibility });
    }
    return result;
  });
  console.log(JSON.stringify(rows));
} finally { await session.close(); stopServer(); }
