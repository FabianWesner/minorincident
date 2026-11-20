import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const session = new SceneSession({ tier: 'low', backend: 'webgl2' });
try {
  await session.open();
  const rows = await session.page.evaluate(async hospital => {
    const a = window.__SS__!; await a.loadLevel(hospital ? 'D-CIVIC' : 'L1', { seed: 1 }); a.pause(); if (!hospital) a.missions.begin();
    const game = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game;
    const result = [];
    const poses: [string, number, number][] = hospital ? [['near', -8, 18], ['far', 0, 28], ['away', 35, 45], ['return', -8, 18]] : [['near', -70, 42.5], ['away', 0, 0], ['return', -70, 42.5]];
    for (const [name, x, z] of poses) {
      a.teleport('player', { x, z }); a.camera.follow(); game.view.view.reset(game.world.entities.get(1)!.transform, true);
      await a.screenshotReady(); await a.screenshotReady();
      const districts = (game.view as unknown as { districts: { lodState(): { assetId: string; lod: string }[] } }).districts;
      result.push({ name, state: a.getState().render.districts?.signVisibility, lod: districts.lodState().filter(row => row.assetId === (hospital ? 'bld.hospital' : 'bld.fire-station')) });
    }
    return result;
  }, process.argv[2] === 'hospital');
  console.log(JSON.stringify(rows));
} finally { await session.close(); stopServer(); }
