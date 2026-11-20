import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const session = new SceneSession({ backend: 'webgl2', tier: 'high', seed: 32 });
const out = 'test-results/s182-entry'; mkdirSync(out, { recursive: true });
try {
  await session.open();
  await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
  await session.page.evaluate(async () => {
    const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await api.loadLevel('L10', { seed: 32, checkpoint: 'cure-crash' });
    if (game.world.missions?.state.phase === 'briefing') api.missions.begin();
    api.cheats.god(true); api.pause();
    const mission = game.world.missions!;
    while (mission.state.steps['research-hangar'].status !== 'active') mission.completeObjective();
    api.teleport(1, { x: 2707, z: 40 }); api.camera.follow(); api.camera.zoom(1.5);
    await api.step(10);
  });
  const rows: unknown[] = [], frames: { frame: number; jpeg: Buffer }[] = [];
  for (let i = 0; i < 24; i++) {
    const row = await session.page.evaluate(async () => {
      const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      api.input.set({ move: { x: 0, z: 1 } }); await api.step(30); api.input.clear();
      const m = game.world.missions!, player = game.world.entities.get(1)!.transform;
      return { tick: game.world.tick, x: player.x, z: player.z, subtitle: m.state.subtitle?.id };
    });
    rows.push(row); frames.push({ frame: i, jpeg: await session.snapshot() });
    if (row.subtitle === 'L10.voss-intro') break;
  }
  for (let i = 0; i < 3; i++) { await session.page.evaluate(() => window.__SS__!.step(60)); frames.push({ frame: frames.length, jpeg: await session.snapshot() }); }
  await session.makeSheet(frames, `${out}/entry.jpg`, 420, 240);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ rows, errors: session.errors }, null, 2));
  if (!rows.some((r: unknown) => (r as { subtitle?: string }).subtitle === 'L10.voss-intro') || session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
