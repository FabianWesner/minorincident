import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'test-results/s182-l9-passenger'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
try {
  await session.open();
  await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
  const setup = await session.page.evaluate(async () => {
    const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await api.loadLevel('L9', { seed: 1, progression: 'L9-default' }); api.pause(); api.missions.begin(); api.cheats.god(true); api.camera.zoom(1.5);
    await api.step(1); await api.screenshotReady();
    const m = game.world.missions!, driver = m.l9!.driving.state;
    return { subtitle: m.state.subtitle?.id, samId: driver.samId, sam: game.world.entities.get(driver.samId)?.transform };
  });
  if (setup.subtitle !== 'L9.briefing' || !setup.samId) throw new Error(`Unexpected setup ${JSON.stringify(setup)}`);
  const frames: { frame: number; jpeg: Buffer }[] = [];
  for (let i = 0; i < 5; i++) {
    await session.page.evaluate(() => window.__SS__!.step(60));
    frames.push({ frame: i, jpeg: await session.snapshot() });
  }
  await session.makeSheet(frames, `${out}/sheet.jpg`, 420, 240);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ setup, errors: session.errors }, null, 2));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
