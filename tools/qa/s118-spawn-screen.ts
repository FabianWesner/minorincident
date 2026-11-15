import { SceneSession, stopServer, writeJson } from '../scenelab/session';
import type { Game } from '../../src/Game';

const rows = [];
try {
  for (const tier of ['high', 'low'] as const) for (const zoom of [1, 1.5]) {
    const session = new SceneSession({ tier });
    try {
      await session.open();
      await session.page.evaluate('globalThis.__name = fn => fn');
      const result = await session.page.evaluate(async ({ zoom }) => {
        const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        await api.loadLevel('L9', { seed: 1, progression: 'L9-default' });
        api.missions.begin(); api.pause(); api.camera.zoom(zoom); api.bot.start('complete');
        for (let frame = 0; frame < 7000; frame++) {
          game.view.renderer.nextNodeFrame(); game.view.frame(1 / 60); await api.step(1);
          const state = game.world.missions!.l9!.driving.state;
          const bus = game.world.vehicles!.cars.get(state.busId)!;
          if (bus.entity.hidden) continue;
          const p = bus.entity.transform, projected = [];
          for (let x = -4; x <= 4; x++) for (const z of [-1.2, 0, 1.2]) for (const y of [0, 2, 4]) {
            projected.push(api.camera.project(p.x + Math.cos(p.yaw) * x + Math.sin(p.yaw) * z, y, p.z - Math.sin(p.yaw) * x + Math.cos(p.yaw) * z));
          }
          const minX = Math.min(...projected.map(p => p[0])), maxX = Math.max(...projected.map(p => p[0]));
          const minY = Math.min(...projected.map(p => p[1])), maxY = Math.max(...projected.map(p => p[1]));
          return { tick: game.world.tick, pose: { ...p }, projectedBounds: [minX, minY, maxX, maxY], outside: maxX < -1 || minX > 1 || maxY < -1 || minY > 1 };
        }
        return null;
      }, { zoom });
      rows.push({ tier, zoom, result }); console.log(JSON.stringify(rows.at(-1)));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
writeJson('docs/reports/s118-l9bus/spawn-screen.json', { method: 'Ordinary browser bot drive, first visible bus tick, independent render-camera projected hull bounds; no actor or health writes.', rows });
if (rows.some(row => !row.result?.outside)) process.exitCode = 1;
