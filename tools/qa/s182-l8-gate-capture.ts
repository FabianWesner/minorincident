import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'test-results/s182-l8-gate'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
try {
  await session.open();
  await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
  const cast = await session.page.evaluate(async () => {
    const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await api.loadLevel('L8', { seed: 1, progression: 'L8-default' }); api.pause(); api.missions.begin(); api.cheats.god(true); api.camera.zoom(1.5);
    await api.step(1);
    const mission = game.world.missions!, player = game.world.entities.get(1)!.transform, zoo = mission.l8!.state;
    return { subtitle: mission.state.subtitle?.id, player: { x: player.x, z: player.z }, guards: [...zoo.guards, zoo.reyesId, zoo.haleId].map(id => {
      const e = game.world.entities.get(id); return e && { id, x: e.transform.x, z: e.transform.z, health: e.health.current };
    }) };
  });
  if (cast.subtitle !== 'L8.gate-soldier') throw new Error(`Unexpected line ${cast.subtitle}`);
  const frames: { frame: number; jpeg: Buffer }[] = [], positions: unknown[] = [];
  for (let i = 0; i < 5; i++) {
    await session.page.evaluate(() => window.__SS__!.step(60));
    frames.push({ frame: i, jpeg: await session.snapshot() });
    positions.push(await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const npcs = game.view.labProbes().npcs as unknown as { civilians: { conversationPositions: Map<number, unknown> } };
      return [...npcs.civilians.conversationPositions.entries()];
    }));
  }
  const presented = await session.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const npcs = game.view.labProbes().npcs as unknown as { civilians: { conversationPositions: Map<number, unknown> } };
    return [...npcs.civilians.conversationPositions.entries()];
  });
  await session.makeSheet(frames, `${out}/sheet.jpg`, 420, 240);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ cast, positions, presented, errors: session.errors }, null, 2));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
