import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'test-results/s182-l5-speaker'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
try {
  await session.open();
  await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
  const setup = await session.page.evaluate(async () => {
    const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await api.loadLevel('L5', { seed: 1, progression: 'L5-default' }); api.pause(); api.missions.begin(); api.cheats.god(true); api.camera.zoom(1.5);
    const m = game.world.missions!, survivor = m.state.l5!.survivors.find(row => row.key === 'rosa')!, ring = m.def.anchors['l5-ring-rosa'];
    m.state.l5!.phase = 'search';
    api.teleport(1, { x: ring.x + 2.5, z: ring.z }); api.camera.follow();
    (game.view as unknown as { cellarBlend: number }).cellarBlend = 0;
    game.view.view.reset(game.world.entities.get(1)!.transform);
    await api.step(90); await api.screenshotReady();
    (m.l5 as unknown as { find: (row: typeof survivor) => void }).find(survivor);
    await api.step(1);
    return { id: survivor.id, subtitle: m.state.subtitle?.id, ring: { x: ring.x, z: ring.z } };
  });
  if (setup.subtitle !== 'L5.found.rosa') throw new Error(`Unexpected line ${setup.subtitle}`);
  const frames: { frame: number; jpeg: Buffer }[] = [];
  for (let i = 0; i < 4; i++) { await session.page.evaluate(() => window.__SS__!.step(60)); frames.push({ frame: i, jpeg: await session.snapshot() }); }
  await session.makeSheet(frames, `${out}/sheet.jpg`, 420, 240);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ setup, errors: session.errors }, null, 2));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
