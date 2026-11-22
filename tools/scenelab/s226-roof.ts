import { SceneSession, stopServer, writeJson } from './session';
import type { Game } from '../../src/Game';
const out = process.env.S226_ROOF_OUT ?? 'test-results/s226-apc-roof';
const session = new SceneSession({ tier: 'high', viewport: { width: 1600, height: 900 }, nativeFrameTiming: true });
try {
  await session.open();
  const state = await session.page.evaluate(async () => {
    const api = window.__SS__!;
    await api.loadLevel('L9', { seed: 1, progression: 'L9-default' });
    api.missions.begin(); api.pause();
    const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
    const sam = w.missions!.l9!.driving.state.samId, car = w.vehicles!.cars.get(w.missions!.l9!.state.carId)!;
    w.missions!.state.subtitle = { id: 'L9.briefing', text: 'Keep moving.', until: w.tick + 600 };
    return { sam, tick: w.tick, seated: car.entity.vehicle!.passengers?.some(p => p.id === sam && p.phase === 'seated') };
  });
  if (!state.sam || !state.seated) throw new Error(`Missing seated speaker: ${JSON.stringify(state)}`);
  await session.ready(); await session.screenshot(`${out}/speaking.png`); writeJson(`${out}/state.json`, state);
} finally { await session.close(); stopServer(); }
